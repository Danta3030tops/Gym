/* Mock Supabase for the PUBLIC app (public/). Injected before the page loads; nothing touches a real database.
   Data lives in localStorage ("mockp.db") so it survives reloads and is shared by pages in one browser context.
   Covers: auth (sign up / in / out, reset, update), rpc app_username_free, and a generic table API
   (select / insert / upsert / update / delete with eq, neq, in, order, limit, single, maybeSingle).
   plus the chat rpcs (app_open_chat, app_new_group, app_group_add, app_group_rename) and the message trigger.
   It does NOT enforce row level security and has no realtime: extend it as later milestones need. */
(function () {
  window.GYM_PUBLIC_CONFIG = { supabaseUrl: 'https://mock.supabase.co', supabaseAnonKey: 'mock-publishable-key-0123456789' };
  const KEY = 'mockp.db', PK = { app_profiles: 'id', app_state: 'user_id', app_routines: 'user_id', app_public: 'user_id' };
  const load = () => JSON.parse(localStorage.getItem(KEY) || '{"users":[],"t":{},"seq":1}'), save = d => localStorage.setItem(KEY, JSON.stringify(d));
  const uuid = () => crypto.randomUUID(), now = () => new Date().toISOString();
  const USER_RE = /^[a-z0-9_.]{3,20}$/;
  window.supabase = { createClient(url, key, opts) {
    const sk = (opts && opts.auth && opts.auth.storageKey) || 'mock-auth', subs = [];
    const getS = () => JSON.parse(localStorage.getItem(sk) || 'null');
    const setS = (s, ev) => { if (s) localStorage.setItem(sk, JSON.stringify(s)); else localStorage.removeItem(sk); subs.forEach(f => f(ev, s)); };
    const mk = u => ({ access_token: 't-' + u.id, user: { id: u.id, email: u.email, user_metadata: u.meta } });
    const auth = {
      async signUp({ email, password, options }) {
        const d = load(), meta = (options && options.data) || {}, un = String(meta.username || email.split('@')[0]).toLowerCase();
        if (d.users.some(u => u.email === email)) return { data: {}, error: { message: 'User already registered' } };
        const profs = d.t.app_profiles = d.t.app_profiles || [];
        if (!USER_RE.test(un) || profs.some(p => p.username === un)) return { data: {}, error: { message: 'Database error saving new user' } };
        const u = { id: uuid(), email, password, meta }; d.users.push(u);
        profs.push({ id: u.id, username: un, display_name: meta.display_name || un, role: meta.role === 'trainer' ? 'trainer' : 'user', color: meta.color || '#ff9f0a', bio: '', created_at: now() });
        save(d);
        if (window.__mockConfirmEmail) return { data: { user: mk(u).user, session: null }, error: null };
        const s = mk(u); setS(s, 'SIGNED_IN'); return { data: { user: s.user, session: s }, error: null };
      },
      async signInWithPassword({ email, password }) {
        const u = load().users.find(x => x.email === email && x.password === password);
        if (!u) return { data: {}, error: { message: 'Invalid login credentials' } };
        const s = mk(u); setS(s, 'SIGNED_IN'); return { data: { user: s.user, session: s }, error: null };
      },
      async signOut() { setS(null, 'SIGNED_OUT'); return { error: null }; },
      async getSession() { return { data: { session: getS() } }; },
      onAuthStateChange(cb) { subs.push(cb); return { data: { subscription: { unsubscribe() { } } } }; },
      async resetPasswordForEmail() { return { data: {}, error: null }; },
      async updateUser({ password }) { const d = load(), s = getS(), u = s && d.users.find(x => x.id === s.user.id); if (!u) return { error: { message: 'Not signed in' } }; if (password) u.password = password; save(d); return { data: { user: s.user }, error: null }; }
    };
    async function rpc(name, args) {
      if (name === 'app_username_free') { const u = String(args.u || '').toLowerCase(); return { data: USER_RE.test(u) && !(load().t.app_profiles || []).some(p => p.username === u), error: null }; }
      /* chats: the same rules as the database functions in supabase-public-schema.sql */
      const d = load(), s = getS(), me = s && s.user.id, T = t => (d.t[t] = d.t[t] || []), ok = v => { save(d); return { data: v, error: null }; }, no = msg => ({ data: null, error: { message: msg } });
      const pals = (a, b) => T('app_friends').some(r => r.status === 'accepted' && ((r.requester === a && r.addressee === b) || (r.requester === b && r.addressee === a)));
      const member = (c, u) => T('app_members').some(x => x.conv_id === c && x.user_id === u), join = (c, u) => { if (!member(c, u)) T('app_members').push({ id: d.seq++, conv_id: c, user_id: u, last_read: now() }); };
      const conv = (kind, title) => { const c = { id: uuid(), kind, title, created_by: me, created_at: now(), last_at: now(), last_text: '' }; T('app_convs').push(c); return c.id; };
      if (name === 'app_open_chat') {
        const o = args.other; if (!me || !o || o === me) return no('bad user'); if (!pals(me, o)) return no('not connected');
        const c = T('app_convs').find(v => v.kind === 'dm' && member(v.id, me) && member(v.id, o)); if (c) return ok(c.id);
        const id = conv('dm', ''); join(id, me); join(id, o); return ok(id);
      }
      if (name === 'app_new_group') {
        if (!me) return no('sign in'); const id = conv('group', String(args.title || '').slice(0, 40)); join(id, me);
        (args.people || []).forEach(p => { if (p !== me && pals(me, p)) join(id, p); }); return ok(id);
      }
      if (name === 'app_group_add') {
        if (!member(args.c, me) || !pals(me, args.p)) return no('not allowed'); if ((T('app_convs').find(v => v.id === args.c) || {}).kind !== 'group') return no('not a group');
        join(args.c, args.p); return ok(null);
      }
      if (name === 'app_group_rename') {
        if (!member(args.c, me)) return no('not allowed'); const c = T('app_convs').find(v => v.id === args.c && v.kind === 'group'); if (c) c.title = String(args.t || '').slice(0, 40); return ok(null);
      }
      return { data: null, error: { message: 'mock: unknown rpc ' + name } };
    }
    function from(t) {
      const q = { op: 'select', fl: [], ord: null, lim: null, one: null, payload: null };
      const match = r => q.fl.every(([k, c, v]) => k === 'eq' ? r[c] === v : k === 'neq' ? r[c] !== v : k === 'in' ? v.includes(r[c]) : true);
      const exec = () => {
        const d = load(), rows = d.t[t] = d.t[t] || [], pk = PK[t] || 'id'; let out;
        if (q.op === 'select') out = rows.filter(match);
        else if (q.op === 'insert' || q.op === 'upsert') {
          out = [].concat(q.payload).map(r => {
            r = { ...r }; if (r[pk] == null) r[pk] = d.seq++; if (!r.created_at) r.created_at = now();
            const i = rows.findIndex(x => x[pk] === r[pk]);
            if (i >= 0) { if (q.op === 'insert') throw { message: 'duplicate key value violates unique constraint' }; rows[i] = { ...rows[i], ...r }; return rows[i]; }
            rows.push(r); return r;
          });
          if (t === 'app_messages' && q.op === 'insert') out.forEach(r => { // what the app_msg_bump trigger does
            const c = (d.t.app_convs || []).find(v => v.id === r.conv_id); if (c) { c.last_at = r.created_at; c.last_text = String(r.body || (r.photo ? '📷 Photo' : '')).slice(0, 120); }
            const mb = (d.t.app_members || []).find(x => x.conv_id === r.conv_id && x.user_id === r.sender); if (mb) mb.last_read = r.created_at;
          });
        } else if (q.op === 'update') { out = rows.filter(match); out.forEach(r => Object.assign(r, q.payload)); }
        else if (q.op === 'delete') { out = rows.filter(match); d.t[t] = rows.filter(r => !match(r)); }
        if (q.op !== 'select') save(d);
        out = JSON.parse(JSON.stringify(out));
        if (q.ord) out.sort((a, b) => (a[q.ord[0]] > b[q.ord[0]] ? 1 : a[q.ord[0]] < b[q.ord[0]] ? -1 : 0) * (q.ord[1] ? 1 : -1));
        if (q.lim != null) out = out.slice(0, q.lim);
        if (q.one) { if (!out.length && q.one === 'single') return { data: null, error: { message: 'no rows' } }; return { data: out[0] || null, error: null }; }
        return { data: out, error: null };
      };
      const b = {
        select() { return b; }, eq(c, v) { q.fl.push(['eq', c, v]); return b; }, neq(c, v) { q.fl.push(['neq', c, v]); return b; }, in(c, v) { q.fl.push(['in', c, v]); return b; },
        order(c, o) { q.ord = [c, !o || o.ascending !== false]; return b; }, limit(n) { q.lim = n; return b; },
        single() { q.one = 'single'; return b; }, maybeSingle() { q.one = 'maybe'; return b; },
        insert(p) { q.op = 'insert'; q.payload = p; return b; }, upsert(p) { q.op = 'upsert'; q.payload = p; return b; },
        update(p) { q.op = 'update'; q.payload = p; return b; }, delete() { q.op = 'delete'; return b; },
        then(res, rej) { let r; try { r = exec(); } catch (e) { r = { data: null, error: e }; } return Promise.resolve(r).then(res, rej); }
      };
      return b;
    }
    return { auth, rpc, from, channel() { const ch = { on() { return ch; }, subscribe() { return ch; }, send() { return Promise.resolve('ok'); } }; return ch; }, removeChannel() { },
      storage: { from: () => ({ upload: async () => ({ error: null }), download: async () => ({ data: null, error: 'x' }), remove: async () => ({}) }) } };
  } };
})();

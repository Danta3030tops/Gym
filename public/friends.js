/* Public Gym app: friends. Add by username, accept / decline, friends list (table app_friends).
   A request is one row { requester, addressee, status: 'pending' | 'accepted' }; declining, cancelling and removing all delete it.
   Later milestones (leaderboard, chats, nudges) read friends through friendList() / friendIds() / isFriend(). */
'use strict';
const FR = { rows: [], profs: {}, loaded: false, busy: false, ch: null, err: false, at: 0 };
const frKey = () => 'gymp.friends.' + uid();
const frOther = r => r.requester === uid() ? r.addressee : r.requester;
const frName = p => p ? (p.display_name || p.username) : 'Someone';
const frColor = p => /^#[0-9a-f]{6}$/i.test((p && p.color) || '') ? p.color : ACCENTS[0][0]; // never trust another person's colour string
const frAv = p => `<div class="lv-av" style="--pc:${frColor(p)}">${esc(initials(frName(p)))}</div>`;
const frWho = p => `<div class="edn"><b>${esc(frName(p))}</b><span>@${esc(p ? p.username : '')}${p && p.role === 'trainer' ? ' · Coach' : ''}</span></div>`;
const frWith = st => FR.rows.filter(st).map(r => ({ r, p: FR.profs[frOther(r)] })).filter(x => x.p).sort((a, b) => frName(a.p).localeCompare(frName(b.p)));
const frAccepted = () => frWith(r => r.status === 'accepted');
const frIncoming = () => frWith(r => r.status === 'pending' && r.addressee === uid());
const frOutgoing = () => frWith(r => r.status === 'pending' && r.requester === uid());
/* for other files */
const friendList = () => frAccepted().map(x => x.p);
const friendIds = () => friendList().map(p => p.id);
const isFriend = id => friendIds().includes(id);

async function loadFriends() {
  if (appOff() || !sb || !navigator.onLine) return;
  const id = uid(); FR.at = Date.now();
  try {
    const [a, b] = await Promise.all([sb.from('app_friends').select('*').eq('requester', id), sb.from('app_friends').select('*').eq('addressee', id)]);
    if (a.error || b.error) throw a.error || b.error;
    const rows = [...a.data, ...b.data], ids = [...new Set(rows.map(r => r.requester === id ? r.addressee : r.requester))], profs = {};
    if (ids.length) { const p = await sb.from('app_profiles').select('id,username,display_name,role,color').in('id', ids); if (p.error) throw p.error; p.data.forEach(x => { profs[x.id] = x; }); }
    if (!session || uid() !== id) return; // signed out, or someone else signed in, while this was loading
    FR.rows = rows; FR.profs = profs; FR.loaded = true; FR.err = false; cacheSet(frKey(), { rows, profs });
  } catch (e) { FR.err = true; }
  frPaint();
}
function frPaint() {
  const b = $('frBadge'), n = session && ME ? frIncoming().length : 0;
  if (b) { b.hidden = !n; b.textContent = n > 9 ? '9+' : n; }
  if (!appOff() && tab === 'friends') renderFriends();
}
function renderFriends() {
  const inc = frIncoming(), out = frOutgoing(), acc = frAccepted(), off = !navigator.onLine;
  let h = `<div class="dayhead"><div><h2>Friends</h2><div class="sub">${acc.length ? acc.length + (acc.length === 1 ? ' friend' : ' friends') : 'Add people by their username'}</div></div></div>`;
  if (inc.length) h += `<div class="card" id="frReqs"><h3>Requests</h3>${inc.map(({ r, p }) => `<div class="edrow frow">${frAv(p)}${frWho(p)}<button class="chip acc" data-frok="${r.id}">Accept</button><button class="chip" data-frno="${r.id}">Decline</button></div>`).join('')}</div>`;
  h += `<div class="card" id="frList"><h3>Your friends</h3>${acc.length ? acc.map(({ r, p }) => `<div class="edrow frow" data-frview="${r.id}">${frAv(p)}${frWho(p)}<span class="frchev">›</span></div>`).join('')
    : `<div class="muted">${!FR.loaded && off ? 'You’re offline. Your friends show up here once you’re connected.' : 'No friends yet. Add someone by their username and they’ll get a request to accept.'}</div>`}
    <button class="btn acc" data-frnew>＋ Add a friend</button></div>`;
  if (out.length) h += `<div class="card" id="frSent"><h3>Sent</h3>${out.map(({ r, p }) => `<div class="edrow frow">${frAv(p)}${frWho(p)}<button class="chip" data-frcancel="${r.id}">Cancel</button></div>`).join('')}<div class="muted" style="margin-top:8px">Waiting for them to accept.</div></div>`;
  h += `<div class="foot">Your username is <b>@${esc(ME.username)}</b>. Share it so friends can add you.</div>`;
  $('friends').innerHTML = h;
  if (Date.now() - FR.at > 5000) loadFriends(); // opening the tab refreshes it
}
function frAddSheet() {
  openSheet(`<h3>Add a friend</h3><div class="sub">Type their username. They get a request and you’re friends once they accept.</div>
    <label class="fld">Username<input id="frUser" autocapitalize="none" autocorrect="off" autocomplete="off" spellcheck="false" maxlength="21" placeholder="their_username" enterkeyhint="send"></label>
    <div class="muted" id="frMsg" style="min-height:18px;margin:8px 0"></div>
    <button class="btn acc" data-fradd>Send request</button>`);
  setTimeout(() => { const el = $('frUser'); if (el) el.focus(); }, 350);
}
async function frAdd() {
  const el = $('frUser'), msg = $('frMsg'); if (!el || FR.busy) return;
  const u = el.value.trim().toLowerCase().replace(/^@/, ''), say = t => { if (msg.isConnected) msg.textContent = t; };
  if (!USER_RE.test(u)) return say('Usernames are 3 to 20 letters, numbers, dots or underscores.');
  if (u === ME.username) return say('That’s your own username.');
  if (!sb || !navigator.onLine) return say('You’re offline. Try again when you’re connected.');
  FR.busy = true; say('Looking…');
  try {
    const p = await sb.from('app_profiles').select('id,username,display_name,role,color').eq('username', u).maybeSingle(); if (p.error) throw p.error;
    if (!p.data) say(`No one here is called @${u}.`);
    else {
      await loadFriends(); if (FR.err) throw new Error('offline'); // fresh list, so a request is never sent twice
      const ex = FR.rows.find(r => frOther(r) === p.data.id);
      if (ex && ex.status === 'accepted') say(`You and ${frName(p.data)} are already friends.`);
      else if (ex && ex.requester === uid()) say('You’ve already asked. Waiting for them to accept.');
      else if (ex) { FR.busy = false; closeSheet(); return frAnswer(ex.id, true); } // they asked first: adding them back accepts it
      else {
        const r = await sb.from('app_friends').insert({ requester: uid(), addressee: p.data.id, status: 'pending' }); if (r.error) throw r.error;
        closeSheet(); toast(`Request sent to ${frName(p.data)}`); await loadFriends();
      }
    }
  } catch (e) { say('Couldn’t send that. Check your connection and try again.'); }
  FR.busy = false;
}
/* accept (ok) or decline / cancel / remove (all delete the row) */
async function frAnswer(rid, ok, doneMsg) {
  const row = FR.rows.find(r => String(r.id) === String(rid)); if (!row || FR.busy) return;
  if (!sb || !navigator.onLine) return toast('You’re offline. Try again when you’re connected.');
  FR.busy = true; const p = FR.profs[frOther(row)];
  const q = ok ? sb.from('app_friends').update({ status: 'accepted' }).eq('id', row.id).eq('addressee', uid()) : sb.from('app_friends').delete().eq('id', row.id);
  const { error } = await q.then(r => r, e => ({ error: e }));
  FR.busy = false;
  if (error) return toast('Couldn’t do that. Check your connection and try again.', 3500);
  toast(ok ? `🤝 You and ${frName(p)} are now friends` : doneMsg || 'Done');
  await loadFriends();
}
function frViewSheet(rid) {
  const row = FR.rows.find(r => String(r.id) === String(rid)), p = row && FR.profs[frOther(row)]; if (!p) return;
  const since = row.created_at ? new Date(row.created_at).toLocaleDateString([], { month: 'short', year: 'numeric' }) : '';
  openSheet(`<div class="hello" style="margin:0 0 12px">${frAv(p)}<div><b>${esc(frName(p))}</b><span>@${esc(p.username)}${p.role === 'trainer' ? ' · Coach' : ''}</span></div></div>
    <div class="muted">${since ? 'Friends since ' + esc(since) + '.' : 'You’re friends.'}</div>
    <button class="btn ghost" data-frrm="${row.id}" style="color:#ff453a">Remove friend</button>`);
}
function frRemoveSheet(rid) {
  const row = FR.rows.find(r => String(r.id) === String(rid)), p = row && FR.profs[frOther(row)]; if (!p) return;
  openSheet(`<h3>Remove ${esc(frName(p))}?</h3><div class="sub">You’ll stop seeing each other in the app. Either of you can send a new request later.</div>
    <button class="btn acc" data-frrmyes="${row.id}">Yes, remove</button><button class="btn ghost" data-frview="${row.id}">Keep</button>`);
}
document.addEventListener('click', e => {
  if (appOff()) return; const t = e.target.closest('[data-frnew],[data-fradd],[data-frok],[data-frno],[data-frcancel],[data-frview],[data-frrm],[data-frrmyes]'); if (!t) return; const d = t.dataset;
  if (d.frnew !== undefined) return frAddSheet();
  if (d.fradd !== undefined) return frAdd();
  if (d.frok) return frAnswer(d.frok, true);
  if (d.frno) return frAnswer(d.frno, false, 'Request declined');
  if (d.frcancel) return frAnswer(d.frcancel, false, 'Request cancelled');
  if (d.frrm) return frRemoveSheet(d.frrm);
  if (d.frrmyes) { closeSheet(); return frAnswer(d.frrmyes, false, 'Friend removed'); }
  if (d.frview) return frViewSheet(d.frview);
});
document.addEventListener('keydown', e => { if (!appOff() && e.key === 'Enter' && e.target.id === 'frUser') { e.preventDefault(); frAdd(); } });
document.addEventListener('visibilitychange', () => { if (!appOff() && !document.hidden) loadFriends(); });
addEventListener('online', () => { if (!appOff()) loadFriends(); });

/* called by startApp / stopApp in app.js */
function startFriends() {
  const c = cacheGet(frKey()) || {}; Object.assign(FR, { rows: c.rows || [], profs: c.profs || {}, loaded: !!c.rows, busy: false, err: false, at: 0 });
  frPaint(); loadFriends();
  if (sb && !FR.ch) { try { FR.ch = sb.channel('friends-' + uid()).on('postgres_changes', { event: '*', schema: 'public', table: 'app_friends' }, () => loadFriends()).subscribe(); } catch (e) { FR.ch = null; } }
}
function stopFriends() {
  if (FR.ch && sb) { try { sb.removeChannel(FR.ch); } catch (e) { } }
  Object.assign(FR, { rows: [], profs: {}, loaded: false, busy: false, ch: null, err: false, at: 0 });
  const b = $('frBadge'); if (b) b.hidden = true; const el = $('friends'); if (el) el.innerHTML = '';
}

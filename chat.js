/* =====================================================================
   CHAT: messages + photos between Dantá and Desrica, delivered live.
   Needs supabase-update-chat.sql run once.
   ===================================================================== */
const CHAT = { msgs: [], loaded: false, loading: false, err: '', ch: null, cl: null, st: 'off', urls: {}, fetching: {}, lastPoll: 0 };
const chatReadKey = () => 'gym.chatRead.' + PROF;
const chatRead = () => +localStorage.getItem(chatReadKey()) || 0;
const msgT = m => new Date(m.created_at).getTime();
const mine = m => m.profile === PROF;
function chatReader() { return clients[PROF] && clients[PROF].session ? clients[PROF] : Object.values(clients).find(c => c.session) || null; }
function chatSender() { return clients[PROF] && clients[PROF].session ? clients[PROF] : null; }
function unreadCount() { const r = chatRead(); return CHAT.msgs.filter(m => !mine(m) && msgT(m) > r).length; }
function markRead() { const last = CHAT.msgs[CHAT.msgs.length - 1]; localStorage.setItem(chatReadKey(), Math.max(Date.now(), last ? msgT(last) : 0)); chatBadges(); }

/* ---------- shell: tab, nav button, bubble ---------- */
$('t-more').insertAdjacentHTML('beforebegin', `<section class="tab" id="t-chat"><div id="chat"></div></section>`);
document.querySelector('nav [data-tab="more"]').insertAdjacentHTML('beforebegin',
  `<button data-tab="chat"><svg viewBox="0 0 24 24"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12z"/></svg>Chat<i class="nbadge hide" id="chatNavBadge"></i></button>`);
document.body.insertAdjacentHTML('beforeend', `<button id="chatBubble" class="hide" aria-label="Open chat"><svg viewBox="0 0 24 24"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12z"/></svg><i class="cbadge hide" id="chatBadge"></i></button>
  <div id="chatPeek" class="hide"></div>
  <input type="file" id="chatFile" accept="image/*" class="hide">`);
$('chatBubble').addEventListener('click', () => showTab('chat'));
$('chatPeek').addEventListener('click', () => { $('chatPeek').classList.add('hide'); showTab('chat'); });

function chatBadges() {
  const n = unreadCount(), txt = n > 9 ? '9+' : String(n);
  for (const id of ['chatBadge', 'chatNavBadge']) { const el = $(id); if (!el) continue; el.textContent = txt; el.classList.toggle('hide', !n); }
}
function chatBubble() {
  const on = tab === 'workout' && !!getCfg().url;
  $('chatBubble').classList.toggle('hide', !on);
  if (!on) $('chatPeek').classList.add('hide');
  chatBadges();
}
let peekT = null;
function peek(m) {
  if (tab !== 'workout') return;
  const el = $('chatPeek'), who = PROFILES[m.profile] ? PROFILES[m.profile].name : 'New message';
  el.innerHTML = `<b>${esc(who)}</b><span>${m.photo && !m.body ? '📷 Photo' : esc((m.photo ? '📷 ' : '') + (m.body || ''))}</span>`;
  el.classList.remove('hide'); el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
  clearTimeout(peekT); peekT = setTimeout(() => el.classList.add('hide'), 4500);
}

/* ---------- data ---------- */
async function loadChat(force) {
  const x = chatReader(); if (!x || CHAT.loading) return;
  if (!force && CHAT.loaded && Date.now() - CHAT.lastPoll < 15000) return;
  CHAT.loading = true; CHAT.lastPoll = Date.now();
  try {
    const { data, error } = await x.cl.from('gym_messages').select('*').order('created_at', { ascending: false }).limit(300);
    if (error) { CHAT.err = /PGRST205|42P01|does not exist|schema cache/i.test((error.code || '') + ' ' + (error.message || '')) ? 'setup' : 'net'; }
    else {
      CHAT.err = ''; const before = new Set(CHAT.msgs.map(m => m.id)), pend = CHAT.msgs.filter(m => m.tmp);
      const rows = (data || []).reverse(); const fresh = CHAT.loaded ? rows.filter(m => !before.has(m.id) && !mine(m)) : [];
      CHAT.msgs = rows.concat(pend); CHAT.loaded = true;
      fresh.forEach(incoming);
    }
  } catch (e) { CHAT.err = 'net'; }
  CHAT.loading = false;
  if (tab === 'chat') { renderChat(); markRead(); } else chatBadges();
}
function ensureChat() {
  const x = chatReader();
  if (!x) { if (CHAT.ch && CHAT.cl) try { CHAT.cl.removeChannel(CHAT.ch); } catch (e) { } CHAT.ch = CHAT.cl = null; CHAT.st = 'off'; return; }
  if (!CHAT.loaded) loadChat(true);
  if (CHAT.cl === x.cl && CHAT.ch && !/CLOSED|ERROR|TIMED_OUT/.test(CHAT.st)) return;
  if (CHAT.ch && CHAT.cl) try { CHAT.cl.removeChannel(CHAT.ch); } catch (e) { }
  CHAT.cl = x.cl; CHAT.st = 'connecting';
  try {
    CHAT.ch = x.cl.channel('gym-chat')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'gym_messages' }, pl => onMsg(pl.new))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'gym_messages' }, pl => { const id = pl.old && pl.old.id; if (id == null) return; CHAT.msgs = CHAT.msgs.filter(m => m.id !== id); if (tab === 'chat') renderChat(); chatBadges(); })
      .subscribe(st => { CHAT.st = st; if (st === 'SUBSCRIBED') loadChat(true); });
  } catch (e) { CHAT.ch = null; CHAT.st = 'off'; }
}
function onMsg(m) {
  if (!m || CHAT.msgs.some(x => x.id === m.id)) return;
  const tmpI = CHAT.msgs.findIndex(x => x.tmp && x.profile === m.profile && x.body === m.body && !!x.photo === !!m.photo && Math.abs(msgT(x) - msgT(m)) < 120000);
  if (tmpI >= 0 && mine(m)) { CHAT.msgs[tmpI] = m; } else { CHAT.msgs.push(m); if (!mine(m)) incoming(m); }
  CHAT.msgs.sort((a, b) => msgT(a) - msgT(b));
  if (tab === 'chat') { renderChat(); markRead(); } else chatBadges();
}
function incoming(m) {
  if (tab === 'chat' && !document.hidden) { beep(1046, .05, .08); return; }
  beep(880, .06, .14); setTimeout(() => beep(1175, .1, .14), 90); buzz([30, 50, 30]);
  if (tab === 'workout') peek(m);
  else { const who = PROFILES[m.profile] ? PROFILES[m.profile].name : 'New message'; toast(`💬 ${who}: ${m.photo && !m.body ? '📷 Photo' : (m.body || '').slice(0, 60)}`, 3200); }
}
setInterval(() => { if (getCfg().url) { ensureChat(); if (!document.hidden && CHAT.st !== 'SUBSCRIBED') loadChat(); } }, 5000);
document.addEventListener('visibilitychange', () => { if (!document.hidden && getCfg().url) { ensureChat(); loadChat(true); } });
setTimeout(() => { if (getCfg().url) ensureChat(); }, 1500);

async function photoUrl(path) {
  if (CHAT.urls[path]) return CHAT.urls[path];
  if (CHAT.fetching[path]) return CHAT.fetching[path];
  const x = chatReader(); if (!x) return null;
  return CHAT.fetching[path] = x.cl.storage.from('chat-photos').createSignedUrl(path, 60 * 60 * 6)
    .then(({ data }) => (CHAT.urls[path] = data && data.signedUrl) || null).catch(() => null)
    .finally(() => { delete CHAT.fetching[path]; });
}
function fillPhotos() {
  document.querySelectorAll('#chat img[data-path]').forEach(async im => {
    if (im.dataset.ok) return; const p = im.dataset.path; const u = CHAT.urls[p] || await photoUrl(p);
    if (u) { im.src = u; im.dataset.ok = 1; }
  });
}

/* ---------- sending ---------- */
async function sendText() {
  const ta = $('chatIn'); const body = ta.value.trim(); if (!body) return;
  const x = chatSender(); if (!x) return toast(`Sign in as ${PROFILES[PROF].name} (More tab) to send`);
  ta.value = ''; ta.style.height = ''; updSend();
  const tmp = { id: 'tmp' + Date.now(), tmp: true, profile: PROF, body, created_at: new Date().toISOString() };
  CHAT.msgs.push(tmp); renderChat(true);
  try {
    const { data, error } = await x.cl.from('gym_messages').insert({ profile: PROF, body }).select().single();
    if (error) throw error;
    const i = CHAT.msgs.indexOf(tmp); if (CHAT.msgs.some(m => m.id === data.id)) CHAT.msgs.splice(i, 1); else CHAT.msgs[i] = data;
  } catch (e) { tmp.failed = true; toast(chatErrText(e)); }
  renderChat(true);
}
async function sendPhoto(file) {
  const x = chatSender(); if (!x) return toast(`Sign in as ${PROFILES[PROF].name} (More tab) to send`);
  const body = ($('chatIn') && $('chatIn').value.trim()) || null; if ($('chatIn')) { $('chatIn').value = ''; updSend(); }
  let blob; try { blob = await compressImage(file); } catch (e) { return toast("Couldn't read that photo"); }
  const local = URL.createObjectURL(blob);
  const tmp = { id: 'tmp' + Date.now(), tmp: true, profile: PROF, body, photo: 'local', local, created_at: new Date().toISOString() };
  CHAT.msgs.push(tmp); renderChat(true);
  try {
    const path = `${x.session.user.id}/${Date.now()}.jpg`;
    const up = await x.cl.storage.from('chat-photos').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
    if (up.error) throw up.error;
    CHAT.urls[path] = local;
    const { data, error } = await x.cl.from('gym_messages').insert({ profile: PROF, body, photo: path }).select().single();
    if (error) throw error;
    const i = CHAT.msgs.indexOf(tmp); if (CHAT.msgs.some(m => m.id === data.id)) CHAT.msgs.splice(i, 1); else CHAT.msgs[i] = data;
  } catch (e) { tmp.failed = true; toast(chatErrText(e)); }
  renderChat(true);
}
function chatErrText(e) {
  const s = ((e && (e.code || '')) + ' ' + (e && e.message || '')).toLowerCase();
  if (/pgrst205|42p01|does not exist|schema cache|bucket not found/.test(s)) return 'Chat needs a one-time setup: run supabase-update-chat.sql';
  return navigator.onLine ? "Couldn't send. Try again" : "You're offline. Couldn't send";
}
async function deleteMsg(id) {
  const m = CHAT.msgs.find(x => x.id == id); closeSheet(); if (!m) return;
  if (m.tmp) { CHAT.msgs = CHAT.msgs.filter(x => x !== m); return renderChat(); }
  const x = chatSender(); if (!x) return;
  try {
    const { error } = await x.cl.from('gym_messages').delete().eq('id', m.id); if (error) throw error;
    if (m.photo) x.cl.storage.from('chat-photos').remove([m.photo]).catch(() => { });
    CHAT.msgs = CHAT.msgs.filter(y => y.id !== m.id); renderChat(); toast('Deleted');
  } catch (e) { toast("Couldn't delete"); }
}
async function retryMsg(id) {
  const m = CHAT.msgs.find(x => x.id == id); closeSheet(); if (!m) return;
  CHAT.msgs = CHAT.msgs.filter(x => x !== m);
  if (m.local) { const b = await fetch(m.local).then(r => r.blob()); if ($('chatIn')) $('chatIn').value = m.body || ''; return sendPhoto(new File([b], 'p.jpg', { type: 'image/jpeg' })); }
  $('chatIn').value = m.body || ''; sendText();
}

/* ---------- rendering ---------- */
const chatTime = t => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
function dayLabel(t) {
  const d = new Date(t), td = dk(new Date()), yd = dk(addDays(new Date(), -1));
  return dk(d) === td ? 'Today' : dk(d) === yd ? 'Yesterday' : fmtD(d, { weekday: 'short', month: 'short', day: 'numeric' });
}
function renderChat(scroll) {
  const box = $('chat'); if (!box) return;
  const o = other(), OP = PROFILES[o];
  const head = `<div class="dayhead"><div><h2>${esc(OP.name)}</h2><div class="sub">${CHAT.st === 'SUBSCRIBED' ? '<i class="lvdot"></i> Live' : chatReader() ? 'Connecting…' : 'Not signed in'}</div></div></div>`;
  let bodyH = '';
  if (!getCfg().url) bodyH = `<div class="card muted">Chat uses cloud sync. Connect it in the More tab first.</div>`;
  else if (!chatReader()) bodyH = `<div class="card muted">Sign in on the More tab to start chatting with ${esc(OP.name)}.</div>`;
  else if (CHAT.err === 'setup') bodyH = `<div class="card"><b>One-time setup needed</b><div class="muted" style="margin-top:6px">Run <code>supabase-update-chat.sql</code> in Supabase → SQL Editor, then reopen this tab.</div></div>`;
  else if (!CHAT.loaded) bodyH = `<div class="card muted">Loading messages…</div>`;
  else if (!CHAT.msgs.length) bodyH = `<div class="chatempty">💬<b>No messages yet</b><span>Say something to ${esc(OP.name)}, or send a progress pic 📷</span></div>`;
  else {
    let lastDay = '', prev = null;
    bodyH = CHAT.msgs.map(m => {
      const t = msgT(m), dl = dayLabel(t); let h = '';
      if (dl !== lastDay) { h += `<div class="cday">${dl}</div>`; lastDay = dl; prev = null; }
      const me = mine(m), grouped = prev && prev.profile === m.profile && t - msgT(prev) < 5 * 60e3; prev = m;
      const img = m.photo ? (m.local ? `<img src="${m.local}" alt="">` : `<img data-path="${esc(m.photo)}" src="${CHAT.urls[m.photo] || ''}" ${CHAT.urls[m.photo] ? 'data-ok="1"' : ''} alt="">`) : '';
      const st = m.failed ? ' · ⚠️ Not sent, tap to retry' : m.tmp ? ' · Sending…' : '';
      return h + `<div class="msg ${me ? 'me' : 'them'} ${grouped ? 'grp' : ''} ${m.failed ? 'fail' : ''}">
        <button class="mb ${m.photo ? 'ph' : ''}" data-msg="${esc(String(m.id))}">${img}${m.body ? `<span>${esc(m.body).replace(/\n/g, '<br>')}</span>` : ''}</button>
        <small>${chatTime(t)}${st}</small></div>`;
    }).join('');
  }
  const canSend = getCfg().url && chatSender() && CHAT.err !== 'setup';
  const keep = $('chatIn') ? $('chatIn').value : '';
  box.innerHTML = head + `<div class="chatlist" id="chatList">${bodyH}</div>` +
    (canSend ? `<div class="chatbar"><button class="cam" data-chatpic aria-label="Send a photo"><svg viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg></button>
      <textarea id="chatIn" rows="1" placeholder="Message ${esc(OP.name)}…" enterkeyhint="send"></textarea>
      <button class="send" data-chatsend aria-label="Send" disabled><svg viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7"/></svg></button></div>`
      : (chatReader() && !chatSender() && CHAT.err !== 'setup' ? `<div class="card muted" style="margin-top:10px">Sign in as ${esc(PROFILES[PROF].name)} on the More tab to send messages.</div>` : ''));
  if ($('chatIn')) { $('chatIn').value = keep; updSend(); }
  fillPhotos();
  const list = $('chatList');
  if (list) requestAnimationFrame(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: scroll ? 'smooth' : 'auto' }));
}
function updSend() { const b = document.querySelector('[data-chatsend]'), ta = $('chatIn'); if (!b || !ta) return; b.disabled = !ta.value.trim(); ta.style.height = 'auto'; ta.style.height = Math.min(120, ta.scrollHeight) + 'px'; }

document.addEventListener('input', e => { if (e.target.id === 'chatIn') updSend(); });
document.addEventListener('keydown', e => {
  if (e.target.id === 'chatIn' && e.key === 'Enter' && !e.shiftKey && !('ontouchstart' in window)) { e.preventDefault(); sendText(); }
});
$('chatFile').addEventListener('change', e => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) sendPhoto(f); });
document.addEventListener('click', e => {
  const t = e.target.closest('button'); if (!t) return; const d = t.dataset;
  if (d.chatsend !== undefined) return sendText();
  if (d.chatpic !== undefined) return $('chatFile').click();
  if (d.msgdel !== undefined) return deleteMsg(d.msgdel);
  if (d.msgretry !== undefined) return retryMsg(d.msgretry);
  if (d.msg !== undefined) {
    const m = CHAT.msgs.find(x => String(x.id) === d.msg); if (!m) return;
    if (m.failed) return retryMsg(m.id);
    const src = m.local || (m.photo && CHAT.urls[m.photo]);
    const pic = m.photo ? `<img class="chatfull" src="${src || ''}" alt="">` : '';
    if (!mine(m) && !pic) return;
    openSheet(`${pic}${m.body ? `<p style="margin:10px 2px">${esc(m.body)}</p>` : ''}<div class="muted" style="margin:6px 2px 12px">${PROFILES[m.profile] ? PROFILES[m.profile].name : ''} · ${dayLabel(msgT(m))}, ${chatTime(msgT(m))}</div>
      ${src ? `<a class="btn" href="${src}" download="gym-chat-${m.id}.jpg" target="_blank" rel="noopener" style="display:block;text-align:center;margin-bottom:8px">Save photo</a>` : ''}
      ${mine(m) && !m.tmp ? `<button class="btn ghost" data-msgdel="${esc(String(m.id))}" style="width:100%;color:#ff453a">Delete message</button>` : ''}`);
  }
});

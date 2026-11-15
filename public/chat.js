/* Public Gym app: chats. 1-on-1 chats with friends and group chats (tables app_convs, app_members, app_messages).
   Lives in the Friends tab as the "Chats" segment; an open conversation takes over the tab (CH.open).
   Conversations are created by the database functions app_open_chat / app_new_group, never by inserting rows directly.
   Text only for now: photo messages (bucket app-chat) are not built yet. */
'use strict';
const CH = { convs: [], mem: {}, mine: {}, profs: {}, open: null, back: null, msgs: [], mloaded: false, loaded: false, at: 0, busy: false, ch: null, t: null };
const chProf = id => (id === uid() ? ME : FR.profs[id] || TR.profs[id] || CH.profs[id]);
const chConv = id => CH.convs.find(c => c.id === id);
const chOthers = c => (CH.mem[c.id] || []).filter(id => id !== uid());
const chTitle = c => (c.kind === 'group' ? c.title || chOthers(c).map(id => frName(chProf(id)).split(' ')[0]).join(', ') || 'Group' : frName(chProf(chOthers(c)[0])));
const chUnread = c => !!(c.last_text && CH.mine[c.id] && new Date(c.last_at) > new Date(CH.mine[c.id]));
/* groups, 1-on-1 chats with people who are still friends, and 'coach' chats while the coach / client link stands */
const chVisible = () => CH.convs.filter(c => { const o = chOthers(c)[0]; return c.kind === 'group' || (c.kind === 'dm' ? isFriend(o) : c.kind === 'coach' && trLinked(o)); }).sort((a, b) => new Date(b.last_at) - new Date(a.last_at));
const chInbox = () => chVisible().filter(c => c.kind === 'coach' && trIsClient(chOthers(c)[0])); // a coach's chats with clients: shown in Clients → Inbox
const chFriendsSide = () => chVisible().filter(c => !(c.kind === 'coach' && trIsClient(chOthers(c)[0]))); // everything else: Friends → Chats
const chUnreadCount = () => chFriendsSide().filter(chUnread).length;
const chTime = t => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const chDay = t => { const d = new Date(t); return dk(d) === dk(new Date()) ? 'Today' : dk(d) === dk(addDays(new Date(), -1)) ? 'Yesterday' : fmtD(d, { weekday: 'short', month: 'short', day: 'numeric' }); };
const chOffline = () => { if (sb && navigator.onLine) return false; toast('You’re offline. Try again when you’re connected.'); return true; };
const chRpc = (fn, args) => sb.rpc(fn, args).then(r => r, e => ({ error: e }));

async function loadChats() {
  if (appOff() || !sb || !navigator.onLine) return;
  const id = uid(); CH.at = Date.now();
  try {
    const m = await sb.from('app_members').select('*').eq('user_id', id); if (m.error) throw m.error;
    const ids = m.data.map(x => x.conv_id), mine = {}, mem = {}, profs = {}; let convs = [];
    m.data.forEach(x => { mine[x.conv_id] = x.last_read; });
    if (ids.length) {
      const [c, all] = await Promise.all([sb.from('app_convs').select('*').in('id', ids), sb.from('app_members').select('*').in('conv_id', ids)]);
      if (c.error || all.error) throw c.error || all.error;
      convs = c.data; all.data.forEach(x => { (mem[x.conv_id] = mem[x.conv_id] || []).push(x.user_id); });
      const need = [...new Set(all.data.map(x => x.user_id))].filter(u => u !== id && !FR.profs[u]); // group members who aren't my friends
      if (need.length) { const p = await sb.from('app_profiles').select('id,username,display_name,role,color').in('id', need); if (p.error) throw p.error; p.data.forEach(x => { profs[x.id] = x; }); }
    }
    if (!session || uid() !== id) return;
    if (CH.open && mine[CH.open] && CH.mine[CH.open] > mine[CH.open]) mine[CH.open] = CH.mine[CH.open]; // I'm reading it right now
    Object.assign(CH, { convs, mem, mine, profs, loaded: true }); cacheSet('gymp.chats.' + id, { convs, mem, mine, profs });
    if (CH.open && !chConv(CH.open)) CH.open = null; // left, or removed
  } catch (e) { }
  frPaint();
}
const loadChatsSoon = () => { clearTimeout(CH.t); CH.t = setTimeout(loadChats, 400); };

/* ---------- conversation list ---------- */
function chRowHtml(c) {
  const grp = c.kind === 'group', un = chUnread(c);
  return `<div class="edrow frow cvrow${un ? ' unread' : ''}" data-chopen="${esc(c.id)}">${grp ? '<div class="lv-av" style="--pc:#636366">👥</div>' : frAv(chProf(chOthers(c)[0]))}
    <div class="edn"><b>${esc(chTitle(c))}${c.kind === 'coach' && !trIsClient(chOthers(c)[0]) ? ' · Coach' : ''}</b><span>${esc(c.last_text || 'No messages yet')}</span></div><span class="chwhen">${c.last_text ? esc(frAgo(c.last_at)) : ''}</span>${un ? '<i class="chdot"></i>' : ''}</div>`;
}
function chatsHtml() {
  const list = chFriendsSide(), fr = friendList().length;
  return `<div class="card" id="chConvs"><h3>Chats</h3>${list.length ? list.map(chRowHtml).join('') : `<div class="muted">${fr ? 'No chats yet. Message a friend, or start a group.' : 'Add a friend first, then you can chat here.'}</div>`}
    ${fr ? `<div class="grid2"><button class="btn acc" data-chnew>＋ New chat</button><button class="btn" data-chgroup>＋ New group</button></div>` : `<button class="btn acc" data-frnew>＋ Add a friend</button>`}</div>`;
}
function chNewSheet() {
  openSheet(`<h3>New chat</h3><div class="sub">Pick a friend to message.</div>
    ${frAccepted().map(({ p }) => `<div class="edrow frow" data-chdm="${esc(p.id)}">${frAv(p)}${frWho(p)}<span class="frchev">›</span></div>`).join('')}`);
}
const chPickRows = list => list.map(p => `<label class="edrow frow">${frAv(p)}${frWho(p)}<input type="checkbox" class="chpick" value="${esc(p.id)}"></label>`).join('');
function chGroupSheet() {
  openSheet(`<h3>New group</h3><div class="sub">Name it and pick who’s in. You can add more friends later.</div>
    <label class="fld">Group name<input id="chGName" maxlength="40" placeholder="Morning crew" autocomplete="off"></label>
    <div style="margin-top:10px">${chPickRows(friendList())}</div>
    <div class="muted" id="chGMsg" style="min-height:18px;margin:8px 0"></div><button class="btn acc" data-chgmake>Create group</button>`);
}
async function chOpenDm(fid) {
  if (CH.busy || chOffline()) return; CH.busy = true;
  const r = await chRpc('app_open_chat', { other: fid }); CH.busy = false;
  if (r.error || !r.data) return toast('Couldn’t open that chat. Try again in a moment.', 3500);
  closeSheet(); await loadChats(); openChat(r.data);
}
async function chMakeGroup() {
  const people = [...document.querySelectorAll('#sheetin .chpick:checked')].map(x => x.value), title = ($('chGName').value || '').trim(), msg = $('chGMsg');
  if (!people.length) { msg.textContent = 'Pick at least one friend.'; return; }
  if (CH.busy || chOffline()) return; CH.busy = true;
  const r = await chRpc('app_new_group', { title, people }); CH.busy = false;
  if (r.error || !r.data) { msg.textContent = 'Couldn’t create the group. Try again in a moment.'; return; }
  closeSheet(); await loadChats(); openChat(r.data);
}

/* ---------- one conversation ---------- */
function openChat(cid) {
  if (!chConv(cid)) return; CH.open = cid; CH.msgs = []; CH.mloaded = false; FR.seg = 'chats'; CH.back = tab !== 'friends' ? tab : null; // the thread shows in the Friends tab; Back returns to where it was opened
  if (tab !== 'friends') showTab('friends'); else renderFriends();
  window.scrollTo(0, document.documentElement.scrollHeight); loadMsgs();
}
function closeChat() { const b = CH.back; CH.open = null; CH.back = null; CH.msgs = []; CH.mloaded = false; if (b) showTab(b); else { renderFriends(); window.scrollTo(0, 0); } if (Date.now() - CH.at > 3000) loadChats(); else trPaint(); }
async function loadMsgs() {
  const cid = CH.open; if (!cid || !sb || !navigator.onLine) return;
  const r = await sb.from('app_messages').select('*').eq('conv_id', cid).order('created_at', { ascending: false }).limit(100).then(r => r, e => ({ error: e }));
  if (r.error || CH.open !== cid || appOff()) return;
  const got = r.data.slice().sort((a, b) => new Date(a.created_at) - new Date(b.created_at) || a.id - b.id);
  CH.msgs = got.concat(CH.msgs.filter(m => m.tmp || m.failed)); CH.mloaded = true; chMarkRead(cid);
  if (tab === 'friends') renderFriends();
}
function chMarkRead(cid) {
  const c = chConv(cid); if (!c) return;
  const was = chUnread(c), at = new Date(Math.max(Date.now(), new Date(c.last_at).getTime() + 1)).toISOString(); // never earlier than the newest message, even if this phone's clock is behind
  CH.mine[cid] = at;
  if (sb && navigator.onLine) sb.from('app_members').update({ last_read: at }).eq('conv_id', cid).eq('user_id', uid()).then(() => { }, () => { });
  if (was) { frBadge(); trPaint(); }
}
function threadHtml() {
  const c = chConv(CH.open), grp = c.kind === 'group', n = (CH.mem[c.id] || []).length, o = grp ? null : chProf(chOthers(c)[0]);
  let body = '', lastDay = '', prev = null;
  if (!CH.msgs.length) body = CH.mloaded ? `<div class="chatempty">💬<b>No messages yet</b><span>Say hi${grp ? '' : ' to ' + esc(frName(o).split(' ')[0])} 👋</span></div>` : `<div class="card muted">${navigator.onLine ? 'Loading messages…' : 'You’re offline. Messages load when you’re connected.'}</div>`;
  else body = CH.msgs.map(m => {
    const dl = chDay(m.created_at), me = m.sender === uid(); let h = '';
    if (dl !== lastDay) { h += `<div class="cday">${dl}</div>`; lastDay = dl; prev = null; }
    const grouped = prev && prev.sender === m.sender && new Date(m.created_at) - new Date(prev.created_at) < 5 * 60e3; prev = m;
    return h + `<div class="msg ${me ? 'me' : 'them'}${grouped ? ' grp' : ''}${m.failed ? ' fail' : ''}">${grp && !me && !grouped ? `<em class="mwho">${esc(frName(chProf(m.sender)))}</em>` : ''}
      <button class="mb" data-chmsg="${esc(String(m.id))}"><span>${esc(m.body || '').replace(/\n/g, '<br>')}</span></button><small>${chTime(m.created_at)}${m.failed ? ' · ⚠️ Not sent, tap to try again' : m.tmp ? ' · Sending…' : ''}</small></div>`;
  }).join('');
  return `<div class="dayhead chead"><button class="cbtn" data-chback aria-label="Back to chats">‹</button><div class="chttl"${grp ? ' data-chinfo' : ''}><h2>${esc(chTitle(c))}</h2><div class="sub">${grp ? n + (n === 1 ? ' person' : ' people') + ' · tap for details' : '@' + esc(o ? o.username : '')}</div></div></div>
    <div class="chatlist" id="chList">${body}</div>
    <div class="chatbar"><textarea id="chIn" rows="1" maxlength="2000" placeholder="Message…" enterkeyhint="send"></textarea><button class="send" data-chsend aria-label="Send" disabled><svg viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7"/></svg></button></div>`;
}
/* called by renderFriends when a conversation is open */
function renderThread() {
  const old = $('chIn'), keep = old ? old.value : '', foc = old && document.activeElement === old;
  $('friends').innerHTML = threadHtml();
  const ta = $('chIn'); ta.value = keep; chUpd(); if (foc) ta.focus();
  requestAnimationFrame(() => window.scrollTo(0, document.documentElement.scrollHeight));
}
function chUpd() { const b = document.querySelector('[data-chsend]'), ta = $('chIn'); if (!b || !ta) return; b.disabled = !ta.value.trim(); ta.style.height = 'auto'; ta.style.height = Math.min(120, ta.scrollHeight) + 'px'; }
async function sendChat(text) {
  const ta = $('chIn'), cid = CH.open, body = (text != null ? text : ta ? ta.value : '').trim().slice(0, 2000); if (!body || !cid) return;
  if (chOffline()) return;
  if (text == null && ta) { ta.value = ''; chUpd(); }
  const tmp = { id: 'tmp' + Date.now() + Math.random(), conv_id: cid, sender: uid(), body, created_at: new Date().toISOString(), tmp: true };
  CH.msgs.push(tmp); renderFriends();
  const r = await sb.from('app_messages').insert({ conv_id: cid, sender: uid(), body }).select().single().then(r => r, e => ({ error: e }));
  const i = CH.msgs.indexOf(tmp);
  if (r.error || !r.data) { tmp.tmp = false; tmp.failed = true; }
  else {
    if (i >= 0) { if (CH.msgs.some(m => m.id === r.data.id)) CH.msgs.splice(i, 1); else CH.msgs[i] = r.data; } // realtime may have delivered it first
    const c = chConv(cid); if (c) { c.last_at = r.data.created_at; c.last_text = body.slice(0, 120); CH.mine[cid] = new Date(new Date(c.last_at).getTime() + 1).toISOString(); }
  }
  if (CH.open === cid && !appOff() && tab === 'friends') renderFriends();
}
/* a message arriving over realtime */
function onChatMsg(m) {
  if (appOff() || !m || !m.conv_id) return;
  if (CH.open === m.conv_id) {
    if (!CH.msgs.some(x => x.id === m.id) && m.sender !== uid()) { CH.msgs.push(m); const c = chConv(m.conv_id); if (c) { c.last_at = m.created_at; c.last_text = (m.body || '').slice(0, 120); } chMarkRead(m.conv_id); if (tab === 'friends') renderFriends(); }
    return;
  }
  if (m.sender !== uid()) { const c = chConv(m.conv_id), who = frName(chProf(m.sender)); toast(`💬 ${c && c.kind === 'group' ? who + ' in ' + chTitle(c) : who}: ${(m.body || '').slice(0, 60)}`, 3500); buzz(20); }
  loadChatsSoon();
}
function chMsgSheet(mid) {
  const m = CH.msgs.find(x => String(x.id) === mid); if (!m) return;
  if (m.failed) { CH.msgs.splice(CH.msgs.indexOf(m), 1); return sendChat(m.body); }
  if (m.sender !== uid() || m.tmp) return;
  openSheet(`<p style="margin:4px 2px 10px">${esc(m.body || '')}</p><div class="muted" style="margin:0 2px 12px">${chDay(m.created_at)}, ${chTime(m.created_at)}</div><button class="btn ghost" data-chdel="${esc(String(m.id))}" style="color:#ff453a">Delete message</button>`);
}
async function chDelete(mid) {
  if (chOffline()) return; closeSheet();
  const { error } = await sb.from('app_messages').delete().eq('id', +mid).eq('sender', uid()).then(r => r, e => ({ error: e }));
  if (error) return toast('Couldn’t delete that. Try again in a moment.', 3500);
  CH.msgs = CH.msgs.filter(x => String(x.id) !== String(mid)); if (CH.open && tab === 'friends') renderFriends();
}

/* ---------- group details: members, rename, add a friend, leave ---------- */
function chInfoSheet() {
  const c = chConv(CH.open); if (!c || c.kind !== 'group') return;
  const ids = CH.mem[c.id] || [], canAdd = friendList().filter(p => !ids.includes(p.id));
  openSheet(`<h3>Group details</h3>
    <label class="fld">Group name<input id="chRName" maxlength="40" value="${esc(c.title || '')}" placeholder="${esc(chTitle(c))}" autocomplete="off"></label>
    <button class="btn" data-chrename>Save name</button>
    <h3 style="margin-top:16px">${ids.length} ${ids.length === 1 ? 'person' : 'people'}</h3>
    ${ids.map(id => { const p = chProf(id); return `<div class="edrow frow">${frAv(p)}<div class="edn"><b>${id === uid() ? 'You' : esc(frName(p))}</b><span>@${esc(p ? p.username : '')}</span></div></div>`; }).join('')}
    ${canAdd.length ? `<h3 style="margin-top:16px">Add a friend</h3>${canAdd.map(p => `<div class="edrow frow">${frAv(p)}${frWho(p)}<button class="chip acc" data-chadd="${esc(p.id)}">Add</button></div>`).join('')}` : ''}
    <button class="btn ghost" data-chleave style="color:#ff453a;margin-top:14px">Leave group</button>`);
}
async function chRename() {
  const cid = CH.open, t = ($('chRName').value || '').trim(); if (!cid || CH.busy || chOffline()) return; CH.busy = true;
  const r = await chRpc('app_group_rename', { c: cid, t }); CH.busy = false;
  if (r.error) return toast('Couldn’t rename the group. Try again in a moment.', 3500);
  const c = chConv(cid); if (c) c.title = t.slice(0, 40); closeSheet(); toast('Group renamed'); renderFriends();
}
async function chAdd(pid) {
  const cid = CH.open; if (!cid || CH.busy || chOffline()) return; CH.busy = true;
  const r = await chRpc('app_group_add', { c: cid, p: pid }); CH.busy = false;
  if (r.error) return toast('Couldn’t add them. Try again in a moment.', 3500);
  toast(`${frName(FR.profs[pid])} added`); await loadChats(); if (CH.open === cid) chInfoSheet();
}
async function chLeave() {
  const cid = CH.open; if (!cid || chOffline()) return;
  const { error } = await sb.from('app_members').delete().eq('conv_id', cid).eq('user_id', uid()).then(r => r, e => ({ error: e }));
  if (error) return toast('Couldn’t leave the group. Try again in a moment.', 3500);
  closeSheet(); CH.convs = CH.convs.filter(c => c.id !== cid); CH.open = null; toast('You left the group'); renderFriends(); loadChats();
}

document.addEventListener('click', e => {
  if (appOff()) return; const t = e.target.closest('[data-chopen],[data-chnew],[data-chgroup],[data-chdm],[data-chgmake],[data-chback],[data-chsend],[data-chmsg],[data-chdel],[data-chinfo],[data-chrename],[data-chadd],[data-chleave]'); if (!t) return; const d = t.dataset;
  if (d.chopen) return openChat(d.chopen);
  if (d.chnew !== undefined) return chNewSheet();
  if (d.chgroup !== undefined) return chGroupSheet();
  if (d.chdm) return chOpenDm(d.chdm);
  if (d.chgmake !== undefined) return chMakeGroup();
  if (d.chback !== undefined) return closeChat();
  if (d.chsend !== undefined) return sendChat();
  if (d.chdel) return chDelete(d.chdel);
  if (d.chmsg) return chMsgSheet(d.chmsg);
  if (d.chrename !== undefined) return chRename();
  if (d.chadd) return chAdd(d.chadd);
  if (d.chleave !== undefined) return chLeave();
  if (d.chinfo !== undefined) return chInfoSheet();
});
document.addEventListener('input', e => { if (e.target.id === 'chIn') chUpd(); });
document.addEventListener('keydown', e => { if (!appOff() && e.target.id === 'chIn' && e.key === 'Enter' && !e.shiftKey && !('ontouchstart' in window)) { e.preventDefault(); sendChat(); } });

/* called by startFriends / stopFriends / frRefresh in friends.js */
function startChat() {
  const c = cacheGet('gymp.chats.' + uid()) || {};
  Object.assign(CH, { convs: c.convs || [], mem: c.mem || {}, mine: c.mine || {}, profs: c.profs || {}, open: null, back: null, msgs: [], mloaded: false, loaded: !!c.convs, at: 0, busy: false });
  if (sb && !CH.ch) {
    try {
      CH.ch = sb.channel('chat-' + uid())
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'app_messages' }, x => onChatMsg(x && x.new))
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'app_convs' }, () => loadChatsSoon())
        .subscribe();
    } catch (e) { CH.ch = null; }
  }
}
function stopChat() {
  clearTimeout(CH.t); if (CH.ch && sb) { try { sb.removeChannel(CH.ch); } catch (e) { } }
  Object.assign(CH, { convs: [], mem: {}, mine: {}, profs: {}, open: null, back: null, msgs: [], mloaded: false, loaded: false, at: 0, busy: false, ch: null });
}

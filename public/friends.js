/* Public Gym app: friends. Add by username, accept / decline, friends list (table app_friends),
   leaderboard (friends' app_public summaries), nudges and other notifications (table app_notes).
   A request is one row { requester, addressee, status: 'pending' | 'accepted' }; declining, cancelling and removing all delete it.
   Other files read friends through friendList() / friendIds() / isFriend(). */
'use strict';
const FR = { rows: [], profs: {}, loaded: false, busy: false, ch: null, err: false, at: 0, seg: null };
const frKey = () => 'gymp.friends.' + uid();
const frOther = r => r.requester === uid() ? r.addressee : r.requester;
const frName = p => p ? (p.display_name || p.username) : 'Someone';
const frColor = p => /^#[0-9a-f]{6}$/i.test((p && p.color) || '') ? p.color : ACCENTS[0][0]; // never trust another person's colour string
const frAv = p => { const u = avUrl(p); return `<div class="lv-av" style="--pc:${frColor(p)}">${esc(initials(frName(p)))}${u ? `<img src="${esc(u)}" alt="" loading="lazy" onerror="this.remove()">` : ''}</div>`; }; // the initials stay underneath, so a picture that fails to load just disappears
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
    if (ids.length) { const p = await sb.from('app_profiles').select(PROF_COLS()).in('id', ids); if (p.error) throw p.error; p.data.forEach(x => { profs[x.id] = x; }); }
    if (!session || uid() !== id) return; // signed out, or someone else signed in, while this was loading
    FR.rows = rows; FR.profs = profs; FR.loaded = true; FR.err = false; cacheSet(frKey(), { rows, profs });
  } catch (e) { FR.err = true; }
  frPaint();
}
function frBadge() {
  const b = $('frBadge'), n = session && ME ? frIncoming().length + NT.rows.length + chUnreadCount() : 0;
  if (b) { b.hidden = !n; b.textContent = n > 9 ? '9+' : n; }
}
function frPaint() { frBadge(); if (!appOff() && tab === 'friends') renderFriends(); trPaint(); }
function renderFriends() {
  if (CH.open && chConv(CH.open)) return renderThread(); // an open conversation takes over the tab
  const inc = frIncoming(), out = frOutgoing(), acc = frAccepted(), off = !navigator.onLine, unread = chUnreadCount();
  if (!FR.seg) FR.seg = acc.length ? 'board' : 'people';
  let h = `<div class="dayhead"><div><h2>Friends</h2><div class="sub">${acc.length ? acc.length + (acc.length === 1 ? ' friend' : ' friends') : 'Add people by their username'}</div></div></div>
    <div class="seg" style="margin-top:0">${[['board', 'Leaderboard'], ['chats', 'Chats' + (unread ? ' · ' + unread : '')], ['people', 'People' + (inc.length ? ' · ' + inc.length : '')]].map(([k, t]) => `<button class="${FR.seg === k ? 'on' : ''}" data-frseg="${k}">${t}</button>`).join('')}</div>`;
  if (NT.rows.length) h += `<div class="card" id="frNotes"><h3>New for you</h3>${NT.rows.slice(0, 8).map(n => `<div class="hrow"><b style="flex:1;font-weight:500">${esc(noteText(n))}</b><span>${esc(frAgo(n.created_at))}</span></div>`).join('')}
    ${NT.rows.length > 8 ? `<div class="muted">and ${NT.rows.length - 8} more</div>` : ''}<button class="btn ghost" data-ntclear>Clear</button></div>`;
  if (FR.seg === 'board') h += boardHtml();
  else if (FR.seg === 'chats') h += chatsHtml();
  else {
    if (inc.length) h += `<div class="card" id="frReqs"><h3>Requests</h3>${inc.map(({ r, p }) => `<div class="edrow frow">${frAv(p)}${frWho(p)}<button class="chip acc" data-frok="${r.id}">Accept</button><button class="chip" data-frno="${r.id}">Decline</button></div>`).join('')}</div>`;
    h += `<div class="card" id="frList"><h3>Your friends</h3>${acc.length ? acc.map(({ r, p }) => `<div class="edrow frow" data-frview="${r.id}">${frAv(p)}${frWho(p)}<span class="frchev">›</span></div>`).join('')
      : `<div class="muted">${!FR.loaded && off ? 'You’re offline. Your friends show up here once you’re connected.' : 'No friends yet. Add someone by their username and they’ll get a request to accept.'}</div>`}
      <button class="btn acc" data-frnew>＋ Add a friend</button></div>`;
    if (ME.role === 'trainer') h += coachCardHtml(); // everyone else has the Coach tab
    if (out.length) h += `<div class="card" id="frSent"><h3>Sent</h3>${out.map(({ r, p }) => `<div class="edrow frow">${frAv(p)}${frWho(p)}<button class="chip" data-frcancel="${r.id}">Cancel</button></div>`).join('')}<div class="muted" style="margin-top:8px">Waiting for them to accept.</div></div>`;
    h += `<div class="foot">Your username is <b>@${esc(ME.username)}</b>. Share it so friends can add you.</div>`;
  }
  $('friends').innerHTML = h;
  if (Date.now() - FR.at > 5000) loadFriends(); // opening the tab refreshes it
  if (FR.seg === 'board' && Date.now() - LB.at > 5000) loadBoard();
  if (FR.seg === 'chats' && Date.now() - CH.at > 5000) loadChats();
}

/* ---------- leaderboard: me (from my own state) against friends' published summaries (app_public) ---------- */
const LB = { sums: {}, metric: 'week', at: 0 };
const LB_METRICS = [['week', 'This week', 'days trained this week'], ['month', 'This month', 'days trained this month'], ['streak', 'Streak', 'training days in a row'], ['prs', 'PRs', 'personal records this month']];
const frAgo = t => { const s = (Date.now() - new Date(t).getTime()) / 1000; return s < 90 ? 'just now' : s < 3600 ? Math.round(s / 60) + 'm ago' : s < 86400 ? Math.round(s / 3600) + 'h ago' : Math.round(s / 86400) + 'd ago'; };
/* a published summary goes stale (it was written on the day of the last sync), so read it against today's week and month */
function lbStats(sm) {
  const s = sm || {}, now = new Date(), wk = s.wk === weekKeyOf(now), mk = s.mk === monthKey(now);
  // every number is forced to a number: this row is written by the other person and is shown as HTML
  return { week: wk ? safeN(s.weekDays) : 0, sets: wk ? safeN(s.weekSets) : 0, month: mk ? safeN(s.monthDays) : 0, prs: mk ? safeN(s.prsMonth) : 0,
    streak: Date.now() - safeN(s.at) < 8 * 864e5 ? safeN(s.dayStreak) : 0, today: s.td === dk(now) && safeN(s.todaySets) > 0, lastT: safeN(s.lastT) };
}
async function loadBoard() {
  const ids = friendIds(); if (appOff() || !sb || !navigator.onLine || !ids.length) return;
  const id = uid(); LB.at = Date.now();
  const r = await sb.from('app_public').select('*').in('user_id', ids).then(r => r, e => ({ error: e }));
  if (r.error || !session || uid() !== id) return;
  LB.sums = {}; r.data.forEach(x => { LB.sums[x.user_id] = x.data || {}; }); cacheSet('gymp.board.' + id, LB.sums); clSettle();
  if (!appOff() && tab === 'friends' && FR.seg === 'board') renderFriends();
}
function boardHtml() {
  const acc = friendList();
  if (!acc.length) return `<div class="card" id="lb"><h3>Leaderboard</h3><div class="muted">Add a friend and you’ll both show up here, ranked by how much you’ve trained.</div><button class="btn acc" data-frnew>＋ Add a friend</button></div>`;
  const m = LB_METRICS.find(x => x[0] === LB.metric) || LB_METRICS[0], k = m[0];
  const rows = [{ p: ME, st: lbStats(summaryOf(S, PROF)), me: true, has: true }, ...acc.map(p => ({ p, st: lbStats(LB.sums[p.id]), has: !!LB.sums[p.id] }))];
  rows.sort((a, b) => b.st[k] - a.st[k] || b.st.sets - a.st.sets || frName(a.p).localeCompare(frName(b.p)));
  let rank = 0, prev = null;
  return `<div class="card" id="lb"><div class="lbhead"><span>Ranked by</span><select class="lbsel" id="lbSel" aria-label="Rank the leaderboard by">${LB_METRICS.map(([key, t]) => `<option value="${key}" ${key === k ? 'selected' : ''}>${t}</option>`).join('')}</select></div>${rows.map((x, i) => {
      if (x.st[k] !== prev) { rank = i + 1; prev = x.st[k]; }
      const sub = !x.has ? 'Nothing shared yet' : x.st.today ? '🔥 Trained today' : x.st.lastT ? 'Last trained ' + frAgo(x.st.lastT) : 'No workouts yet';
      return `<div class="edrow frow lbrow${x.me ? ' me' : ''}"><i class="lbrank">${rank === 1 && x.st[k] > 0 ? '🥇' : rank}</i>${frAv(x.p)}<div class="edn"><b>${x.me ? 'You' : esc(frName(x.p))}</b><span>${sub}</span></div>
        ${x.me ? '' : `<button class="chip" data-nudge="${esc(x.p.id)}" aria-label="${x.st.today ? 'Send hype' : 'Nudge'}">${x.st.today ? '🔥' : '👊'}</button>`}<b class="lbval">${x.st[k]}</b></div>`;
    }).join('')}<div class="muted" style="margin-top:10px;font-size:12px">Ranked by ${m[2]}. Tap 👊 to nudge a friend, or 🔥 to cheer one who trained today.</div></div>` + challengesHtml();
}

/* ---------- notifications (app_notes): nudges and hype now, trainer updates later ---------- */
const NT = { rows: [], max: 0 };
const NOTE_TEXT = { photos: n => `📸 ${n} asked to see your progress photos. Answer under Your coach.`, nudge: n => `👊 ${n} nudged you. Time to train!`, hype: n => `🔥 ${n} sent you some hype`,
  challenge: (n, x) => (x.data && x.data.off ? `🎯 ${n} ended your weekly challenge` : `🎯 ${n} set a weekly challenge with you: ${clType(x.data && x.data.type).t}`) };
NOTE_TEXT.routine = n => `✏️ ${n} updated your plan`; NOTE_TEXT.trainer_ok = n => `🤝 ${n} is now your coach`;
const noteText = n => (NOTE_TEXT[n.kind] ? NOTE_TEXT[n.kind](frName(FR.profs[n.from_id] || TR.profs[n.from_id] || CH.profs[n.from_id]), n) : n.body || 'Something new');
async function loadNotes() {
  if (appOff() || !sb || !navigator.onLine) return; const id = uid();
  const r = await sb.from('app_notes').select('*').eq('user_id', id).eq('read', false).order('created_at', { ascending: false }).limit(30).then(r => r, e => ({ error: e }));
  if (r.error || !session || uid() !== id) return;
  const fresh = r.data.filter(n => n.id > NT.max); NT.rows = r.data; clAdopt(r.data);
  if (fresh.length) { NT.max = Math.max(...fresh.map(n => n.id)); cacheSet('gymp.noteMax.' + id, NT.max); toast(fresh.length === 1 ? noteText(fresh[0]) : `${fresh.length} new notifications`, 3500); buzz(20); }
  if (fresh.some(n => n.kind === 'routine')) sync(); // my coach changed my plan: fetch it now
  frPaint();
}
async function clearNotes() {
  NT.rows = []; frPaint(); if (!sb || !navigator.onLine) return;
  await sb.from('app_notes').update({ read: true }).eq('user_id', uid()).eq('read', false).then(r => r, e => ({ error: e }));
}
async function sendNudge(fid) {
  const p = FR.profs[fid]; if (!p || !isFriend(fid)) return;
  if (!sb || !navigator.onLine) return toast('You’re offline. Try again when you’re connected.');
  const k = 'gymp.nudged.' + uid(), sent = cacheGet(k) || {}, hype = lbStats(LB.sums[fid]).today;
  if (Date.now() - (sent[fid] || 0) < 30 * 60000) return toast(`${frName(p)} already heard from you. Give it a bit.`);
  const { error } = await sb.from('app_notes').insert({ user_id: fid, from_id: uid(), kind: hype ? 'hype' : 'nudge', body: '', data: {}, read: false }).then(r => r, e => ({ error: e }));
  if (error) return toast('Couldn’t send that. Check your connection and try again.', 3500);
  sent[fid] = Date.now(); cacheSet(k, sent); toast(hype ? `🔥 Sent ${frName(p)} some hype` : `👊 Nudged ${frName(p)}`); buzz(20);
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
    const p = await sb.from('app_profiles').select(PROF_COLS()).eq('username', u).maybeSingle(); if (p.error) throw p.error;
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
    <button class="btn acc" data-chdm="${esc(p.id)}">💬 Message</button>
    <button class="btn ghost" data-frrm="${row.id}" style="color:#ff453a">Remove friend</button>`);
}
function frRemoveSheet(rid) {
  const row = FR.rows.find(r => String(r.id) === String(rid)), p = row && FR.profs[frOther(row)]; if (!p) return;
  openSheet(`<h3>Remove ${esc(frName(p))}?</h3><div class="sub">You’ll stop seeing each other in the app. Either of you can send a new request later.</div>
    <button class="btn acc" data-frrmyes="${row.id}">Yes, remove</button><button class="btn ghost" data-frview="${row.id}">Keep</button>`);
}
document.addEventListener('click', e => {
  if (appOff()) return; const t = e.target.closest('[data-frnew],[data-fradd],[data-frok],[data-frno],[data-frcancel],[data-frview],[data-frrm],[data-frrmyes],[data-frseg],[data-lbm],[data-nudge],[data-ntclear]'); if (!t) return; const d = t.dataset;
  if (d.frseg) { FR.seg = d.frseg; return renderFriends(); }
  if (d.lbm) { LB.metric = d.lbm; return renderFriends(); }
  if (d.nudge) return sendNudge(d.nudge);
  if (d.ntclear !== undefined) return clearNotes();
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
const frRefresh = () => loadFriends().then(loadTrainers).then(() => { loadNotes(); loadChats(); if (CH.open) loadMsgs(); if (tab === 'friends' && FR.seg === 'board') loadBoard(); });
document.addEventListener('visibilitychange', () => { if (!appOff() && !document.hidden) frRefresh(); });
addEventListener('online', () => { if (!appOff()) frRefresh(); });

/* called by startApp / stopApp in app.js */
function startFriends() {
  const c = cacheGet(frKey()) || {}; Object.assign(FR, { rows: c.rows || [], profs: c.profs || {}, loaded: !!c.rows, busy: false, err: false, at: 0, seg: null });
  Object.assign(LB, { sums: cacheGet('gymp.board.' + uid()) || {}, metric: 'week', at: 0 }); Object.assign(NT, { rows: [], max: cacheGet('gymp.noteMax.' + uid()) || 0 });
  startChat(); startTrainer(); frPaint(); loadFriends().then(loadTrainers).then(() => { loadNotes(); loadChats(); }); // notes and chats name people, so load friends first
  if (sb && !FR.ch) {
    try {
      FR.ch = sb.channel('friends-' + uid())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'app_friends' }, () => loadFriends())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'app_trainers' }, () => loadTrainers().then(loadChats))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'app_routines', filter: 'user_id=eq.' + uid() }, () => scheduleSync())
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'app_notes', filter: 'user_id=eq.' + uid() }, () => loadNotes())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'app_public' }, () => { if (!appOff() && tab === 'friends' && FR.seg === 'board') loadBoard(); })
        .subscribe();
    } catch (e) { FR.ch = null; }
  }
}
function stopFriends() {
  stopChat(); stopTrainer();
  if (FR.ch && sb) { try { sb.removeChannel(FR.ch); } catch (e) { } }
  Object.assign(FR, { rows: [], profs: {}, loaded: false, busy: false, ch: null, err: false, at: 0, seg: null });
  Object.assign(LB, { sums: {}, at: 0 }); Object.assign(NT, { rows: [], max: 0 });
  const b = $('frBadge'); if (b) b.hidden = true; const el = $('friends'); if (el) el.innerHTML = '';
}

document.addEventListener('change', e => { if (e.target.id !== 'lbSel' || appOff()) return; LB.metric = e.target.value; renderFriends(); });

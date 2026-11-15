/* Public Gym app: trainer portal (table app_trainers { client, trainer, status }).
   Client side: "Your coach" card in Friends → People (add a coach by username, message them, remove them).
   Coach side (ME.role === 'trainer'): a Clients tab with two segments, Clients (requests, client list, a client's
   training and plan, plan editing) and Inbox (the 'coach' conversations with clients).
   A coach edits a client's plan with the normal routine editor in extras.js, pointed at the client through ED_FOR. */
'use strict';
const TR = { rows: [], profs: {}, loaded: false, busy: false, at: 0, seg: 'clients', view: null, vr: null };
const trOther = r => (r.client === uid() ? r.trainer : r.client);
const trWith = f => TR.rows.filter(f).map(r => ({ r, p: TR.profs[trOther(r)] })).filter(x => x.p).sort((a, b) => frName(a.p).localeCompare(frName(b.p)));
const trCoach = () => { const l = trWith(r => r.client === uid()); return l.find(x => x.r.status === 'accepted') || l[0] || null; }; // one coach at a time in the UI
const trClients = () => trWith(r => r.trainer === uid() && r.status === 'accepted');
const trReqs = () => trWith(r => r.trainer === uid() && r.status === 'pending');
const trIsClient = id => TR.rows.some(r => r.trainer === uid() && r.client === id && r.status === 'accepted');
const trIsCoach = id => TR.rows.some(r => r.client === uid() && r.trainer === id && r.status === 'accepted');
const trLinked = id => trIsClient(id) || trIsCoach(id);
const trBadgeN = () => (session && ME && ME.role === 'trainer' ? trReqs().length + chInbox().filter(chUnread).length : 0);

async function loadTrainers() {
  if (appOff() || !sb || !navigator.onLine) return;
  const id = uid(); TR.at = Date.now();
  try {
    const [a, b] = await Promise.all([sb.from('app_trainers').select('*').eq('client', id), sb.from('app_trainers').select('*').eq('trainer', id)]);
    if (a.error || b.error) throw a.error || b.error;
    const rows = [...a.data, ...b.data], ids = [...new Set(rows.map(r => (r.client === id ? r.trainer : r.client)))], profs = {};
    if (ids.length) { const p = await sb.from('app_profiles').select('id,username,display_name,role,color').in('id', ids); if (p.error) throw p.error; p.data.forEach(x => { profs[x.id] = x; }); }
    if (!session || uid() !== id) return;
    Object.assign(TR, { rows, profs, loaded: true }); cacheSet('gymp.trainers.' + id, { rows, profs });
    if (TR.view && !trIsClient(TR.view)) { TR.view = null; TR.vr = null; }
  } catch (e) { }
  trPaint();
}
function trPaint() {
  const b = $('trBadge'), n = trBadgeN(); if (b) { b.hidden = !n; b.textContent = n > 9 ? '9+' : n; }
  if (appOff()) return;
  if (tab === 'clients') renderClients(); else if (tab === 'friends' && FR.seg === 'people' && !CH.open) renderFriends();
}

/* ---------- client side: the "Your coach" card (called by renderFriends) ---------- */
function coachCardHtml() {
  const c = trCoach();
  if (!c) return `<div class="card" id="trCard"><h3>Your coach</h3><div class="muted">Working with a trainer? Add them and they can follow your training, edit your plan and message you.</div><button class="btn" data-tradd>＋ Add your coach</button></div>`;
  return `<div class="card" id="trCard"><h3>Your coach</h3><div class="edrow frow">${frAv(c.p)}${frWho(c.p)}${c.r.status === 'accepted'
    ? `<button class="chip acc" data-chdm="${esc(c.p.id)}">💬</button><button class="chip" data-trrm="${c.r.id}">Remove</button>` : `<button class="chip" data-trcancel="${c.r.id}">Cancel</button>`}</div>
    <div class="muted" style="margin-top:8px">${c.r.status === 'accepted' ? 'Your coach can see your workouts and edit your plan. Removing them ends that straight away.' : 'Waiting for them to accept.'}</div>
    ${c.r.status !== 'accepted' ? '' : c.r.photos === 'asked' ? `<div class="nud" id="trPhAsk">📸 <b>${esc(frName(c.p).split(' ')[0])}</b> asked to see your progress photos. You can change this at any time.<div class="row" style="margin-top:8px"><button class="chip acc" data-trphotos="yes">Allow</button><button class="chip" data-trphotos="no">Not now</button></div></div>`
      : c.r.photos === 'yes' ? `<div class="hrow" id="trPhOn" style="margin-top:6px"><span>📸 Your coach can see your progress photos</span><button class="chip" data-trphotos="no">Stop sharing</button></div>` : ''}</div>`;
}
function trAddSheet() {
  openSheet(`<h3>Add your coach</h3><div class="sub">Type your trainer’s username. Once they accept, they can see your training and edit your plan.</div>
    <label class="fld">Coach’s username<input id="trUser" autocapitalize="none" autocorrect="off" autocomplete="off" spellcheck="false" maxlength="21" placeholder="coach_username" enterkeyhint="send"></label>
    <div class="muted" id="trMsg" style="min-height:18px;margin:8px 0"></div><button class="btn acc" data-trsend>Send request</button>`);
  setTimeout(() => { const el = $('trUser'); if (el) el.focus(); }, 350);
}
async function trAdd() {
  const el = $('trUser'), msg = $('trMsg'); if (!el || TR.busy) return;
  const u = el.value.trim().toLowerCase().replace(/^@/, ''), say = t => { if (msg.isConnected) msg.textContent = t; };
  if (!USER_RE.test(u)) return say('Usernames are 3 to 20 letters, numbers, dots or underscores.');
  if (u === ME.username) return say('That’s your own username.');
  if (!sb || !navigator.onLine) return say('You’re offline. Try again when you’re connected.');
  if (trCoach()) return say('You already have a coach. Remove them first to add another.');
  TR.busy = true; say('Looking…');
  try {
    const p = await sb.from('app_profiles').select('id,username,display_name,role,color').eq('username', u).maybeSingle(); if (p.error) throw p.error;
    if (!p.data) say(`No one here is called @${u}.`);
    else if (p.data.role !== 'trainer') say(`@${u} isn’t signed up as a coach.`);
    else {
      const r = await sb.from('app_trainers').insert({ client: uid(), trainer: p.data.id, status: 'pending' }); if (r.error) throw r.error;
      closeSheet(); toast(`Request sent to ${frName(p.data)}`); await loadTrainers();
    }
  } catch (e) { say('Couldn’t send that. Check your connection and try again.'); }
  TR.busy = false;
}
/* accept (the coach), or decline / cancel / remove (either side): the last three delete the row */
async function trAnswer(rid, ok, doneMsg) {
  const row = TR.rows.find(r => String(r.id) === String(rid)); if (!row || TR.busy) return;
  if (!sb || !navigator.onLine) return toast('You’re offline. Try again when you’re connected.');
  TR.busy = true; const p = TR.profs[trOther(row)];
  const q = ok ? sb.from('app_trainers').update({ status: 'accepted' }).eq('id', row.id).eq('trainer', uid()) : sb.from('app_trainers').delete().eq('id', row.id);
  const { error } = await q.then(r => r, e => ({ error: e }));
  TR.busy = false;
  if (error) return toast('Couldn’t do that. Check your connection and try again.', 3500);
  if (ok) sb.from('app_notes').insert({ user_id: row.client, from_id: uid(), kind: 'trainer_ok', body: '', data: {}, read: false }).then(() => { }, () => { });
  toast(ok ? `🤝 ${frName(p)} is now your client` : doneMsg || 'Done');
  await loadTrainers(); loadChats();
}
function trRemoveSheet(rid) {
  const row = TR.rows.find(r => String(r.id) === String(rid)), p = row && TR.profs[trOther(row)]; if (!p) return; const mine = row.client === uid();
  openSheet(`<h3>Remove ${esc(frName(p))}${mine ? ' as your coach' : ' as a client'}?</h3><div class="sub">${mine ? 'They stop seeing your training and can no longer edit your plan, straight away. Your plan stays as it is.' : 'You stop seeing their training and can no longer edit their plan.'}</div>
    <button class="btn acc" data-trrmyes="${row.id}">Yes, remove</button><button class="btn ghost" data-sheetclose>Keep</button>`);
}

/* ---------- coach side: the Clients tab ---------- */
function renderClients() {
  if (ME.role !== 'trainer') { $('clients').innerHTML = ''; return; }
  if (TR.view && trIsClient(TR.view)) { $('clients').innerHTML = clientViewHtml(); return; }
  const reqs = trReqs(), cl = trClients(), inbox = chInbox(), unread = inbox.filter(chUnread).length;
  let h = `<div class="dayhead"><div><h2>Clients</h2><div class="sub">${cl.length ? cl.length + (cl.length === 1 ? ' client' : ' clients') : 'People you coach'}</div></div></div>
    <div class="seg" style="margin-top:0">${[['clients', 'Clients' + (reqs.length ? ' · ' + reqs.length : '')], ['inbox', 'Inbox' + (unread ? ' · ' + unread : '')]].map(([k, t]) => `<button class="${TR.seg === k ? 'on' : ''}" data-trseg="${k}">${t}</button>`).join('')}</div>`;
  if (TR.seg === 'inbox') h += `<div class="card" id="trInbox"><h3>Messages from clients</h3>${inbox.length ? inbox.map(chRowHtml).join('') : '<div class="muted">No messages yet. Open a client and tap Message to start.</div>'}</div>`;
  else {
    if (reqs.length) h += `<div class="card" id="trReqs"><h3>Requests</h3>${reqs.map(({ r, p }) => `<div class="edrow frow">${frAv(p)}${frWho(p)}<button class="chip acc" data-trok="${r.id}">Accept</button><button class="chip" data-trno="${r.id}">Decline</button></div>`).join('')}</div>`;
    h += `<div class="card" id="trClients"><h3>Your clients</h3>${cl.length ? cl.map(({ p }) => { const st = lbStats(LB.sums[p.id]);
      return `<div class="edrow frow" data-trview="${esc(p.id)}">${frAv(p)}<div class="edn"><b>${esc(frName(p))}</b><span>${st.today ? '🔥 Trained today' : st.lastT ? 'Last trained ' + frAgo(st.lastT) : '@' + esc(p.username)} · ${st.week} this week</span></div><span class="frchev">›</span></div>`; }).join('')
      : `<div class="muted">No clients yet. Give people your username, <b>@${esc(ME.username)}</b>. They add you from Friends → People → Add your coach, and the request shows up here.</div>`}</div>`;
  }
  $('clients').innerHTML = h;
  if (Date.now() - TR.at > 5000) loadTrainers();
  if (cl.length && Date.now() - (TR.sumAt || 0) > 5000) trLoadSums();
}
/* clients' published summaries, into the same store the leaderboard uses */
async function trLoadSums() {
  const ids = trClients().map(x => x.p.id); if (!ids.length || !sb || !navigator.onLine) return; TR.sumAt = Date.now(); const id = uid();
  const r = await sb.from('app_public').select('*').in('user_id', ids).then(r => r, e => ({ error: e }));
  if (r.error || !session || uid() !== id) return;
  r.data.forEach(x => { LB.sums[x.user_id] = x.data || {}; }); if (!appOff() && tab === 'clients') renderClients();
}
async function trOpenClient(cid) {
  if (!trIsClient(cid)) return; TR.view = cid; TR.vr = { routine: null, st: null, loaded: false, err: false }; renderClients(); window.scrollTo(0, 0);
  if (!sb || !navigator.onLine) { TR.vr.err = true; return renderClients(); }
  const [rt, st, pb] = await Promise.all([sb.from('app_routines').select('*').eq('user_id', cid).maybeSingle(), sb.from('app_state').select('data').eq('user_id', cid).maybeSingle(), sb.from('app_public').select('*').eq('user_id', cid).maybeSingle()].map(q => q.then(r => r, e => ({ error: e }))));
  if (TR.view !== cid || appOff()) return;
  if (rt.error) TR.vr.err = true; else Object.assign(TR.vr, { routine: cleanRoutine(rt.data && rt.data.routine) || [], at: (rt.data && rt.data.updated_at) || null, st: (st.data && st.data.data) || null, loaded: true });
  if (pb.data) LB.sums[cid] = pb.data.data || {};
  renderClients();
}
/* the client's last few sessions, from their state (a coach may read app_state for their clients) */
function trSessions(st, routine) {
  const out = [];
  for (const wk in (st && st.logs) || {}) for (const di in st.logs[wk]) {
    let sets = 0, last = 0; for (const id in st.logs[wk][di]) for (const s of st.logs[wk][di][id].sets || []) if (s && s.t) { sets++; last = Math.max(last, s.t); }
    if (sets) out.push({ t: last, sets, title: (routine[di] && routine[di].title) || 'Workout' });
  }
  return out.sort((a, b) => b.t - a.t).slice(0, 6);
}
function clientViewHtml() {
  const p = TR.profs[TR.view], v = TR.vr || {}, st = lbStats(LB.sums[p.id]), row = TR.rows.find(r => r.client === p.id && r.trainer === uid());
  let h = `<div class="dayhead chead"><button class="cbtn" data-trback aria-label="Back to clients">‹</button><div class="chttl"><h2>${esc(frName(p))}</h2><div class="sub">@${esc(p.username)}</div></div></div>
    <div class="card" id="trSum"><div class="tstats"><div><b>${st.week}</b><span>days this week</span></div><div><b>${st.streak}</b><span>day streak</span></div><div><b>${st.prs}</b><span>PRs this month</span></div></div>
    <div class="muted" style="margin-top:8px">${st.today ? '🔥 Trained today' : st.lastT ? 'Last trained ' + frAgo(st.lastT) : 'No workouts logged yet'}</div>
    <button class="btn acc" data-chdm="${esc(p.id)}">💬 Message</button></div>`;
  if (v.err) h += `<div class="card muted">Couldn’t load their plan. Check your connection and open them again.</div>`;
  else if (!v.loaded) h += `<div class="card muted">Loading their plan…</div>`;
  else {
    const ses = trSessions(v.st, v.routine);
    h += `<div class="card" id="trPlan"><h3>Plan</h3>${v.routine.length ? v.routine.map(d => `<div class="pv"><div class="pv-h"><b>${esc(d.title)}</b><span>${esc(d.d || '')} · ${d.slots.length} exercises</span></div>${d.slots.map(sl => `<div class="pv-x"><b>${esc(sl.opts[0].n)}</b><span>${esc(String(sl.sets))} × ${esc(sl.reps)}</span></div>`).join('')}</div>`).join('') + `<button class="btn acc" data-tredit>✏️ Edit their plan</button><div class="muted" style="margin-top:8px">Changes apply straight away and ${esc(frName(p).split(' ')[0])} gets a notification.</div>`
      : `<div class="muted">${esc(frName(p).split(' ')[0])} hasn’t built a plan yet. They can do that from their Workout tab.</div>`}</div>
      <div class="card" id="trLog"><h3>Recent sessions</h3>${ses.length ? ses.map(s => `<div class="hrow"><span>${fmtD(new Date(s.t), { weekday: 'short', month: 'short', day: 'numeric' })}</span><b style="flex:1">${esc(s.title)}</b><b class="acc2">${s.sets} sets</b></div>`).join('') : '<div class="muted">Nothing logged yet.</div>'}</div>`;
  }
  return h + (v.loaded ? clientPhotosHtml(p, row, v) : '') + (row ? `<div class="foot"><button class="chip" data-trrm="${row.id}" style="color:#ff453a">Remove client</button></div>` : '');
}
/* edit a client's plan with the routine editor (extras.js reads ED_FOR) */
function trEdit() {
  const p = TR.profs[TR.view]; if (!p || !TR.vr || !TR.vr.loaded || !TR.vr.routine.length) return;
  ED_FOR = { id: p.id, name: frName(p).split(' ')[0], routine: clone(TR.vr.routine), at: TR.vr.at, noted: false }; edDay = 0; editRoutine();
}
/* called by mutRoutine in extras.js after every change a coach makes */
async function trSaveRoutine() {
  const e = ED_FOR; if (!e) return; if (TR.vr && TR.view === e.id) TR.vr.routine = e.routine;
  if (!sb || !navigator.onLine) return toast('You’re offline. That change wasn’t saved.', 3500);
  // don't save over a change the client made while this coach had the plan open
  const cur = await sb.from('app_routines').select('updated_at').eq('user_id', e.id).maybeSingle().then(r => r, x => ({ error: x }));
  if (!cur.error && cur.data && e.at && cur.data.updated_at !== e.at) { ED_FOR = null; closeSheet(); toast(`${e.name} changed their plan while you were editing. Here is the latest: make your change again.`, 5000); return trOpenClient(e.id); }
  const at = new Date().toISOString();
  const { error } = await sb.from('app_routines').upsert({ user_id: e.id, routine: e.routine, updated_by: uid(), updated_at: at, note: '' }).then(r => r, x => ({ error: x }));
  if (error) return toast('Couldn’t save that change. Check your connection.', 3500);
  e.at = at; if (TR.vr && TR.view === e.id) TR.vr.at = at;
  if (!e.noted) { e.noted = true; sb.from('app_notes').insert({ user_id: e.id, from_id: uid(), kind: 'routine', body: '', data: {}, read: false }).then(() => { }, () => { }); } // one notification per editing session
  if (!appOff() && tab === 'clients') renderClients();
}

document.addEventListener('click', e => {
  if (appOff()) return; const t = e.target.closest('[data-tradd],[data-trsend],[data-trcancel],[data-trrm],[data-trrmyes],[data-trok],[data-trno],[data-trseg],[data-trview],[data-trback],[data-tredit],[data-trphotos],[data-trphotoask]'); if (!t) return; const d = t.dataset;
  if (d.trphotos) return trPhotosAnswer(d.trphotos === 'yes');
  if (d.trphotoask !== undefined) return trPhotosAsk();
  if (d.tradd !== undefined) return trAddSheet();
  if (d.trsend !== undefined) return trAdd();
  if (d.trcancel) return trAnswer(d.trcancel, false, 'Request cancelled');
  if (d.trrm) return trRemoveSheet(d.trrm);
  if (d.trrmyes) { closeSheet(); return trAnswer(d.trrmyes, false, 'Removed'); }
  if (d.trok) return trAnswer(d.trok, true);
  if (d.trno) return trAnswer(d.trno, false, 'Request declined');
  if (d.trseg) { TR.seg = d.trseg; return renderClients(); }
  if (d.trview) return trOpenClient(d.trview);
  if (d.trback !== undefined) { TR.view = null; TR.vr = null; renderClients(); return window.scrollTo(0, 0); }
  if (d.tredit !== undefined) return trEdit();
});
document.addEventListener('keydown', e => { if (!appOff() && e.key === 'Enter' && e.target.id === 'trUser') { e.preventDefault(); trAdd(); } });

/* ---------- progress photos: the coach asks, the client decides (app_trainers.photos: no / asked / yes) ----------
   Until the client says yes the storage rules give the coach nothing; the client can withdraw it at any time. */
async function trPhotosAnswer(ok) {
  const c = trCoach(); if (!c || !sb || !navigator.onLine) return toast('You’re offline. Try again when you’re connected.');
  const { error } = await sb.rpc('app_photos_answer', { t: c.p.id, ok }).then(r => r, e => ({ error: e }));
  if (error) return toast('Couldn’t save that. Try again.');
  c.r.photos = ok ? 'yes' : 'no'; toast(ok ? '📸 Your coach can now see your progress photos' : 'Your progress photos are private', 3000); trPaint();
}
async function trPhotosAsk() {
  const cid = TR.view, row = TR.rows.find(r => r.client === cid && r.trainer === uid()); if (!row) return;
  if (!sb || !navigator.onLine) return toast('You’re offline. Try again when you’re connected.');
  const { error } = await sb.rpc('app_photos_ask', { c: cid }).then(r => r, e => ({ error: e }));
  if (error) return toast('Couldn’t send that. Try again.');
  row.photos = 'asked'; sb.from('app_notes').insert({ user_id: cid, from_id: uid(), kind: 'photos', body: '', data: {}, read: false }).then(() => { }, () => { });
  toast('Request sent'); renderClients();
}
function clientPhotosHtml(p, row, v) {
  const ph = (row && row.photos) || 'no', first = esc(frName(p).split(' ')[0]);
  if (ph !== 'yes') return `<div class="card" id="trPhotos"><h3>Progress photos</h3><div class="muted">${ph === 'asked' ? `Waiting for ${first} to answer your request.` : `Private. ${first} decides whether you can see them.`}</div>${ph === 'no' ? '<button class="btn" data-trphotoask>📸 Ask to see them</button>' : ''}</div>`;
  const all = (v.st && v.st.photos && typeof v.st.photos === 'object') ? v.st.photos : {}, ok = x => x && !x.del && typeof x.path === 'string' && x.path.startsWith(p.id + '/'); // only files in this client's own folder
  const months = Object.keys(all).filter(m => /^\d{4}-\d{2}$/.test(m) && all[m] && POSES.some(q => ok(all[m][q]))).sort().reverse().slice(0, 6);
  return `<div class="card" id="trPhotos"><h3>Progress photos</h3>${months.length ? months.map(m => `<div class="month"><div class="mh">${fmtMonth(m)}</div><div class="poses">${POSES.map(q => ok(all[m][q]) ? `<div class="pslot has"><img data-cph="${esc(all[m][q].path)}" alt=""><span class="pl">${q[0].toUpperCase() + q.slice(1)}</span></div>` : `<div class="pslot"><span>${q[0].toUpperCase() + q.slice(1)}</span><span style="font-size:10px">—</span></div>`).join('')}</div></div>`).join('')
    : `<div class="muted">${first} hasn’t uploaded any photos yet.</div>`}<div class="muted" style="font-size:12px;margin-top:8px">Shared with you by ${first}, who can stop sharing at any time.</div></div>`;
}
const trPhotoUrls = {};
async function trHydratePhotos() {
  for (const img of document.querySelectorAll('#clients img[data-cph]')) {
    const path = img.dataset.cph; if (img.getAttribute('src')) continue;
    if (!trPhotoUrls[path]) { const r = await sb.storage.from('app-photos').download(path).then(x => x, e => ({ error: e })); if (r.error || !r.data) continue; trPhotoUrls[path] = URL.createObjectURL(r.data); }
    if (img.isConnected) img.src = trPhotoUrls[path];
  }
}
const _renderClients = renderClients;
renderClients = function () { _renderClients(); if (!appOff() && sb) trHydratePhotos(); };

/* called by startFriends / stopFriends in friends.js */
function startTrainer() {
  const c = cacheGet('gymp.trainers.' + uid()) || {};
  Object.assign(TR, { rows: c.rows || [], profs: c.profs || {}, loaded: !!c.rows, busy: false, at: 0, sumAt: 0, seg: 'clients', view: null, vr: null });
  $('navClients').hidden = ME.role !== 'trainer'; if (typeof movePill === 'function') movePill();
  trPaint();
}
function stopTrainer() {
  Object.assign(TR, { rows: [], profs: {}, loaded: false, busy: false, at: 0, sumAt: 0, seg: 'clients', view: null, vr: null });
  for (const k in trPhotoUrls) { URL.revokeObjectURL(trPhotoUrls[k]); delete trPhotoUrls[k]; }
  ED_FOR = null; $('navClients').hidden = true; const b = $('trBadge'); if (b) b.hidden = true; const el = $('clients'); if (el) el.innerHTML = '';
}

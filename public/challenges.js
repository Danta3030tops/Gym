/* Public Gym app: weekly challenges with a friend (one per friend; resets every Monday).
   Stored in my own settings, S.settings.challenges[friendId] = { type, n, stake, u, by, since, off }, so it syncs with my state.
   The friend gets the same object in an app_notes row (kind 'challenge'); their app adopts it if it is newer than their copy (clAdopt).
   Scores come from the published summaries (app_public) the leaderboard already loads, so there is no extra table. */
'use strict';
const CL_TYPES = {
  days: { t: 'Most days', d: () => 'Most training days this week wins', icon: '📅', sub: 'Head-to-head' },
  sets: { t: 'Most sets', d: () => 'Most sets logged this week wins', icon: '🏋️', sub: 'Head-to-head' },
  prs: { t: 'PR race', d: () => 'Most personal records this week wins', icon: '🏆', sub: 'Head-to-head' },
  team: { t: 'Team goal', d: n => `You both train ${n} days this week`, icon: '🤝', sub: 'Work together' }
};
const CL_IDEAS = ['Loser buys the smoothies 🥤', 'Loser does 50 burpees', 'Winner picks the next workout', 'Loser buys lunch'];
let CLD = null; // the challenge being edited in the sheet
const clAll = () => (S && S.settings.challenges) || {};
const clOn = fid => { const c = clAll()[fid]; return c && !c.off ? c : null; };
const clActive = () => friendList().filter(p => clOn(p.id)).map(p => ({ p, c: clOn(p.id) }));
/* never trust what arrives in a note: rebuild the object field by field */
const clType = t => typeof t === 'string' && Object.hasOwn(CL_TYPES, t) ? CL_TYPES[t] : CL_TYPES.days; // not CL_TYPES[t]: "constructor" would match
const clClean = c => ({ type: typeof c.type === 'string' && Object.hasOwn(CL_TYPES, c.type) ? c.type : 'days', n: c.type === 'team' ? Math.max(1, Math.min(7, Math.round(+c.n) || 4)) : null, stake: String(c.stake || '').slice(0, 60), u: +c.u || 0, by: String(c.by || ''), since: +c.since || +c.u || 0, off: !!c.off });
/* this week's and last week's numbers out of a summary that may be up to a week old */
function clWeeks(sm) {
  const s = sm || {}, wk = weekKeyOf(new Date()), lw = dk(addDays(parseDk(wk), -7)), z = { days: 0, sets: 0, prs: 0 }, num3 = o => ({ days: safeN(o && o.days), sets: safeN(o && o.sets), prs: safeN(o && o.prs) }), now = { days: safeN(s.weekDays), sets: safeN(s.weekSets), prs: safeN(s.weekPRs) };
  if (s.wk === wk) return { cur: now, last: s.lw && s.lw.wk === lw ? num3(s.lw) : z, known: true };
  if (s.wk === lw) return { cur: z, last: now, known: true };
  return { cur: z, last: z, known: false }; // hasn't synced for over a week: can't call last week
}
const clScore = (c, w) => (c.type === 'sets' ? w.sets : c.type === 'prs' ? w.prs : w.days) || 0;
function clLastWeek(c, me, th) { // null when the challenge didn't exist last week, or their numbers are unknown
  if ((c.since || 0) >= parseDk(weekKeyOf(new Date())).getTime() || !th.known) return null;
  const a = clScore(c, me.last), b = clScore(c, th.last);
  return { a, b, win: c.type === 'team' ? (a >= c.n && b >= c.n ? 'team' : 'fail') : a > b ? 'me' : b > a ? 'them' : 'tie' };
}
function clCard({ p, c }) {
  const T = clType(c.type), me = clWeeks(summaryOf(S, PROF)), th = clWeeks(LB.sums[p.id]), a = clScore(c, me.cur), b = clScore(c, th.cur), mx = c.type === 'team' ? c.n : Math.max(1, a, b), nm = frName(p).split(' ')[0];
  const bar = (name, v, col) => `<div class="chrow"><span class="kq">${esc(name)}</span><div class="chbar"><i style="width:${Math.min(100, v / mx * 100)}%;background:${col}"></i></div><b>${v}${c.type === 'team' ? '/' + c.n : ''}</b></div>`;
  const r = clLastWeek(c, me, th), tally = Object.values((S.settings.clTally || {})[p.id] || {}), w = tally.filter(x => x === 'me').length, l = tally.filter(x => x === 'them').length;
  const res = !r ? '' : `<div class="chres">${r.win === 'team' ? '🎉 Last week: you both made it' : r.win === 'fail' ? '😬 Last week: goal missed' : r.win === 'tie' ? `🤝 Last week: tied ${r.a}–${r.b}` : `👑 Last week: <b>${r.win === 'me' ? 'you' : esc(nm)}</b> won ${Math.max(r.a, r.b)}–${Math.min(r.a, r.b)}`}${
    c.stake && (r.win === 'me' || r.win === 'them') ? `<br>${r.win === 'me' ? esc(nm) + ' owes' : 'You owe'}: <b>${esc(c.stake)}</b>` : c.stake && r.win === 'fail' ? `<br>You both owe: <b>${esc(c.stake)}</b>` : ''}</div>`;
  return `<div class="card chcard clcard"><div class="chtop"><div><b>${T.icon} ${T.t} · ${esc(nm)}</b><span>${T.d(c.n)}</span></div><button class="chip" data-cledit="${esc(p.id)}">Edit</button></div>
    ${bar('You', a, TH.acc)}${bar(nm, b, frColor(p))}
    ${c.stake ? `<div class="chstake">Stakes: <b>${esc(c.stake)}</b></div>` : ''}${res}${w + l ? `<div class="chtally">All-time: you ${w} · ${esc(nm)} ${l}</div>` : ''}</div>`;
}
/* shown under the leaderboard (called by boardHtml in friends.js) */
function challengesHtml() {
  const act = clActive(), free = friendList().some(p => !clOn(p.id));
  return act.map(clCard).join('') + (free ? `<div class="card chcard empty" id="clNew"><div><b>🎯 Weekly challenge</b><span>Take on a friend for the week, and decide what the loser owes.</span></div><button class="chip acc" data-clnew>Set one</button></div>` : '');
}
/* record last week's result once per friend and week, and celebrate a win. Called after the leaderboard loads. */
function clSettle() {
  if (appOff()) return; const me = clWeeks(summaryOf(S, PROF)), lwk = dk(addDays(parseDk(weekKeyOf(new Date())), -7)), all = { ...(S.settings.clTally || {}) }; let won = null, ch = false;
  clActive().forEach(({ p, c }) => {
    const r = clLastWeek(c, me, clWeeks(LB.sums[p.id])); if (!r || (all[p.id] || {})[lwk]) return;
    all[p.id] = { ...(all[p.id] || {}), [lwk]: r.win }; ch = true; if (r.win === 'me' || r.win === 'team') won = { p, r };
  });
  if (!ch) return; S.settings.clTally = all; touchSettings();
  if (won) setTimeout(() => celebrate('Challenge won 🏆', won.r.win === 'team' ? `You and ${frName(won.p)} both hit the goal last week` : `You beat ${frName(won.p)} last week`), 400);
}
function clSheet(fid) {
  const fr = friendList(); if (!fr.length) return;
  if (!fid || !isFriend(fid)) fid = (fr.find(p => !clOn(p.id)) || fr[0]).id;
  const ex = clOn(fid), c = CLD && CLD.fid === fid ? CLD : ex || { type: 'days', n: 4, stake: '' };
  CLD = { fid, type: c.type, n: c.n || 4, stake: c.stake || '' };
  openSheet(`<h3>Weekly challenge</h3><div class="sub">Resets every Monday. Your friend sees it too, and either of you can change it.</div>
    ${fr.length > 1 ? `<label class="fl">With</label><div class="chideas" style="margin:0 0 6px">${fr.map(p => `<button class="chip ${p.id === fid ? 'acc' : ''}" data-clwith="${esc(p.id)}">${esc(frName(p))}</button>`).join('')}</div>` : `<div class="muted" style="margin-top:8px">With <b>${esc(frName(fr[0]))}</b></div>`}
    <div class="chtypes">${Object.entries(CL_TYPES).map(([k, T]) => `<button class="chtype ${CLD.type === k ? 'on' : ''}" data-cltype="${k}"><b>${T.icon} ${T.t}</b><span>${T.sub}</span></button>`).join('')}</div>
    <div class="chn" id="clnRow" ${CLD.type === 'team' ? '' : 'hidden'}><span>Days each</span><div class="exstep"><button data-cln="-1">−</button><b id="clnV">${CLD.n}</b><button data-cln="1">+</button></div></div>
    <label class="fl">Stakes (optional)</label><input id="clStake" class="inp" maxlength="60" placeholder="e.g. ${esc(CL_IDEAS[0])}" value="${esc(CLD.stake)}">
    <div class="chideas">${CL_IDEAS.map(i => `<button class="chip" data-clidea="${esc(i)}">${esc(i)}</button>`).join('')}</div>
    <div class="grid2" style="margin-top:14px"><button class="btn acc" data-clsave>${ex ? 'Save challenge' : 'Send challenge'}</button>${ex ? '<button class="btn ghost" data-cloff>End challenge</button>' : '<button class="btn" data-sheetclose>Cancel</button>'}</div>`);
}
async function clSave(off) {
  const d = CLD; if (!d || !isFriend(d.fid) || chOffline()) return; // the friend has to hear about it, so this needs a connection
  const prev = clAll()[d.fid] || {}, now = Date.now(), n = d.type === 'team' ? d.n : null, same = !prev.off && prev.type === d.type && (prev.n || null) === n;
  const c = off ? { ...clClean(prev), off: true, u: now, by: uid() } : { type: d.type, n, stake: ($('clStake').value || '').trim().slice(0, 60), u: now, by: uid(), since: same && prev.since ? prev.since : now, off: false };
  const { error } = await sb.from('app_notes').insert({ user_id: d.fid, from_id: uid(), kind: 'challenge', body: '', data: c, read: false }).then(r => r, e => ({ error: e }));
  if (error) return toast('Couldn’t send that. Check your connection and try again.', 3500);
  S.settings.challenges = { ...clAll(), [d.fid]: c }; touchSettings(); CLD = null; closeSheet();
  toast(off ? 'Challenge ended' : `Challenge sent to ${frName(FR.profs[d.fid])} 💪`); if (tab === 'friends') renderFriends();
}
/* challenges that arrived as notes (called by loadNotes in friends.js): keep whichever copy is newer */
function clAdopt(rows) {
  const all = { ...clAll() }; let ch = false;
  rows.forEach(n => {
    if (n.kind !== 'challenge' || !n.data || !isFriend(n.from_id)) return;
    const c = clClean(n.data), cur = all[n.from_id]; if (c.u && (!cur || (cur.u || 0) < c.u)) { all[n.from_id] = c; ch = true; }
  });
  if (ch) { S.settings.challenges = all; touchSettings(); }
}
document.addEventListener('click', e => {
  if (appOff()) return; const t = e.target.closest('[data-clnew],[data-cledit],[data-clwith],[data-cltype],[data-cln],[data-clidea],[data-clsave],[data-cloff]'); if (!t) return; const d = t.dataset;
  if (d.clnew !== undefined) { CLD = null; return clSheet(); }
  if (d.cledit) { CLD = null; return clSheet(d.cledit); }
  if (!CLD) return;
  if (d.clwith) { CLD = null; return clSheet(d.clwith); }
  if (d.cltype) { CLD.type = d.cltype; CLD.stake = $('clStake').value; return clSheet(CLD.fid); }
  if (d.cln) { CLD.n = Math.max(1, Math.min(7, CLD.n + +d.cln)); $('clnV').textContent = CLD.n; return; }
  if (d.clidea) { $('clStake').value = d.clidea; return; }
  if (d.clsave !== undefined) return clSave(false);
  if (d.cloff !== undefined) return clSave(true);
});

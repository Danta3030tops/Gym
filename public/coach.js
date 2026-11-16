/* =====================================================================
   COACH: muscle map · workout summary · effort (reps in reserve) ·
   strength (est. 1RM) · 5-minute warm-ups
   ===================================================================== */

/* ---------------- which muscles an exercise works ---------------- */
const MUSCLES = [
  ['chest', 'Chest', 10], ['shoulders', 'Shoulders', 10], ['biceps', 'Biceps', 10], ['triceps', 'Triceps', 10], ['forearms', 'Forearms', 4],
  ['abs', 'Abs', 8], ['obliques', 'Obliques', 6], ['upperback', 'Upper back', 10], ['lats', 'Lats', 10], ['lowerback', 'Lower back', 4],
  ['glutes', 'Glutes', 10], ['quads', 'Quads', 10], ['hamstrings', 'Hamstrings', 10], ['calves', 'Calves', 8]];
const MNAME = Object.fromEntries(MUSCLES.map(m => [m[0], m[1]])), MTGT = Object.fromEntries(MUSCLES.map(m => [m[0], m[2]]));
const MR_GROUPS = [
  [['squat', 'frontsquat', 'goblet', 'gobletheel', 'smithsquat', 'beltsquat', 'boxsquat', 'jumpsquat', 'bwsquat'], ['quads', 'glutes'], ['hamstrings', 'abs']],
  [['hacksquat', 'sissysquat', 'legext'], ['quads'], ['glutes']],
  [['legpress'], ['quads', 'glutes'], ['hamstrings']],
  [['lunge', 'fwdlunge', 'revlunge', 'splitsquat', 'smithlunge', 'bulgarian', 'stepup', 'latlunge'], ['quads', 'glutes'], ['hamstrings']],
  [['curtsy'], ['glutes', 'quads'], []],
  [['hinge', 'sldl', 'goodmorning'], ['hamstrings', 'glutes'], ['lowerback']],
  [['deadlift', 'trapbar', 'sumodl'], ['hamstrings', 'glutes', 'lowerback'], ['quads', 'upperback', 'forearms']],
  [['rackpull'], ['upperback', 'lowerback', 'glutes'], ['forearms', 'hamstrings']],
  [['pullthrough', 'swing', 'kbswing'], ['glutes', 'hamstrings'], ['lowerback']],
  [['thrust', 'singlethrust', 'bridge'], ['glutes'], ['hamstrings']],
  [['kickback', 'donkey', 'abduct', 'abductmach', 'latwalk', 'hydrant', 'sidelying'], ['glutes'], []],
  [['legcurl', 'seatedcurl', 'standcurl', 'nordic', 'ballcurl'], ['hamstrings'], []],
  [['backext'], ['lowerback', 'glutes'], ['hamstrings']],
  [['calf', 'seatedcalf', 'donkeycalf', 'singlecalf', 'lpcalf', 'tibialis'], ['calves'], []],
  [['bench', 'declinebench', 'machpress'], ['chest'], ['triceps', 'shoulders']],
  [['inclinepress'], ['chest', 'shoulders'], ['triceps']],
  [['pushup', 'inclinepushup'], ['chest'], ['triceps', 'shoulders', 'abs']],
  [['dip'], ['chest', 'triceps'], ['shoulders']],
  [['benchdip'], ['triceps'], ['chest']],
  [['svend', 'fly', 'midfly', 'lowhighfly', 'highlowfly', 'dbfly', 'seatedfly'], ['chest'], ['shoulders']],
  [['landmine'], ['shoulders', 'chest'], ['triceps']],
  [['ohp', 'seatedpress', 'arnold', 'bbohp'], ['shoulders'], ['triceps']],
  [['latraise', 'cablelat', 'leanlat', 'seatedlat', 'frontraise', 'uprow'], ['shoulders'], []],
  [['reardelt', 'revpec', 'facepull', 'pullapart', 'yraise'], ['shoulders', 'upperback'], []],
  [['row', 'cprow', 'sealrow', 'tbar', 'seatedrow', 'invrow'], ['upperback', 'lats'], ['biceps', 'forearms']],
  [['renegade'], ['upperback', 'lats'], ['abs', 'biceps']],
  [['pullup', 'pulldown'], ['lats'], ['biceps', 'upperback']],
  [['straightarm', 'pullover'], ['lats'], []],
  [['curl', 'cablecurl', 'preacher', 'inclinecurl', 'spidercurl', 'conccurl'], ['biceps'], ['forearms']],
  [['pushdown', 'ohext', 'skull', 'cablekick', 'cableohext'], ['triceps'], []],
  [['crunch', 'situp', 'vup', 'abmachine', 'toetouch', 'revcrunch', 'legraise', 'kneeraise', 'captain', 'hollow', 'deadbug', 'lyingraise', 'rollout'], ['abs'], ['obliques']],
  [['bicycle'], ['abs', 'obliques'], []],
  [['twist', 'woodchop', 'pallof', 'lmrotate', 'sidebend', 'sideplank'], ['obliques'], ['abs']],
  [['plank', 'plankup', 'shouldertap', 'bearhold', 'climber'], ['abs'], ['shoulders']],
  [['birddog'], ['abs', 'lowerback'], ['glutes']],
  [['thruster'], ['quads', 'shoulders'], ['glutes', 'triceps']],
  [['burpee'], ['chest', 'quads'], ['abs']],
  [['sled'], ['quads', 'glutes'], ['calves']],
  [['ropes'], ['shoulders'], ['abs']]];
const MR = {}; for (const [pats, pri, sec] of MR_GROUPS) for (const p of pats) MR[p] = [pri, sec];
const CAT2M = { quads: ['quads'], glutes: ['glutes'], hamstrings: ['hamstrings'], calves: ['calves'], chest: ['chest'], back: ['upperback', 'lats'], shoulders: ['shoulders'], arms: ['biceps', 'triceps'], core: ['abs'] };
function musclesOfPat(pat) {
  if (MR[pat]) return MR[pat];
  const c = (PAT_CATS[pat] || []).filter(x => x !== 'cardio'); if (!c.length) return [[], []];
  return [CAT2M[c[0]] || [], c.slice(1).flatMap(x => CAT2M[x] || [])];
}
const patCache = {};
function patOfName(n) {
  if (!n) return null; const key = n.toLowerCase(); if (key in patCache) return patCache[key];
  let pat = null;
  for (const D of [DAYS, ROUTINE || []]) for (const d of D || []) for (const sl of d.slots) for (const o of sl.opts) if (!pat && o.n.toLowerCase() === key) pat = o.pat;
  if (!pat) { const l = typeof libFind === 'function' && libFind(n); if (l) pat = l.pat; }
  if (!pat) pat = ssPat(n, null);
  return patCache[key] = pat;
}
/* muscles hit by one logged entry: supersets credit both halves */
function entryMuscles(name) {
  const parts = ssParts(name) || [name], out = {};
  parts.forEach((p, half) => {
    const pat = ssParts(name) ? (patOfName(p) || patOfName(name)) : patOfName(name); if (!pat) return;
    const [pri, sec] = musclesOfPat(pat);
    for (const m of pri) out[m + '|' + half] = [m, 1, half];
    for (const m of sec) if (!out[m + '|' + half]) out[m + '|' + half] = [m, .5, half];
  });
  return Object.values(out);
}
/* sets per muscle for a set of log entries */
function muscleSets(filter) {
  const tot = {}, by = {};
  for (const wk in S.logs) for (const di in S.logs[wk]) for (const id in S.logs[wk][di]) {
    const e = S.logs[wk][di][id], sets = (e.sets || []).filter(s => s && s.t && filter(s, wk, +di)); if (!sets.length) continue;
    for (const [m, wgt] of entryMuscles(e.n)) {
      const n = sets.length * wgt;
      tot[m] = (tot[m] || 0) + n; (by[m] = by[m] || {})[e.n] = (by[m][e.n] || 0) + n;
    }
  }
  return { tot, by };
}

/* ---------------- muscle map (History → Muscles) ---------------- */
let mmWeek = 0; // 0 = this week, 1 = last week
function bodySVG(tot) {
  const lvl = m => { const v = tot[m] || 0, t = MTGT[m]; return v <= 0 ? 0 : v < t * .4 ? 1 : v < t * .8 ? 2 : v < t * 1.2 ? 3 : 4; };
  const F = m => `class="mm l${lvl(m)}" data-mus="${m}"`;
  const front = `
    <g transform="translate(0,0)">
      <circle cx="75" cy="20" r="11" class="mmhead"/><rect x="70" y="30" width="10" height="7" rx="3" class="mmhead"/>
      <path ${F('shoulders')} d="M52 40 q-12 2 -14 16 q8 2 14 -4 z M98 40 q12 2 14 16 q-8 2 -14 -4 z"/>
      <path ${F('chest')} d="M54 40 h20 v22 q-12 4 -20 -4 q-3 -10 0 -18 z M76 40 h20 q3 8 0 18 q-8 8 -20 4 z"/>
      <path ${F('biceps')} d="M39 58 q6 -2 12 0 l-2 24 q-5 3 -10 0 z M111 58 q-6 -2 -12 0 l2 24 q5 3 10 0 z"/>
      <path ${F('forearms')} d="M38 84 q5 2 10 0 l-3 26 q-4 2 -7 0 z M112 84 q-5 2 -10 0 l3 26 q4 2 7 0 z"/>
      <path ${F('abs')} d="M64 64 h22 l-1 40 q-10 5 -20 0 z"/>
      <path ${F('obliques')} d="M56 62 l7 3 l1 38 l-7 -6 q-4 -18 -1 -35 z M94 62 l-7 3 l-1 38 l7 -6 q4 -18 1 -35 z"/>
      <path ${F('quads')} d="M58 108 q8 -4 16 2 l-2 50 q-6 4 -12 0 q-5 -26 -2 -52 z M92 108 q-8 -4 -16 2 l2 50 q6 4 12 0 q5 -26 2 -52 z"/>
      <path ${F('calves')} d="M61 166 q5 -2 10 0 l-1 36 q-4 2 -7 0 z M89 166 q-5 -2 -10 0 l1 36 q4 2 7 0 z"/>
    </g>`;
  const back = `
    <g transform="translate(150,0)">
      <circle cx="75" cy="20" r="11" class="mmhead"/><rect x="70" y="30" width="10" height="7" rx="3" class="mmhead"/>
      <path ${F('upperback')} d="M60 37 q15 -6 30 0 l8 8 q-4 12 -23 20 q-19 -8 -23 -20 z"/>
      <path ${F('shoulders')} d="M52 40 q-12 2 -14 16 q8 2 14 -4 z M98 40 q12 2 14 16 q-8 2 -14 -4 z"/>
      <path ${F('lats')} d="M54 50 q8 12 21 17 l-2 22 q-12 -4 -18 -14 q-3 -12 -1 -25 z M96 50 q-8 12 -21 17 l2 22 q12 -4 18 -14 q3 -12 1 -25 z"/>
      <path ${F('triceps')} d="M39 58 q6 -2 12 0 l-2 24 q-5 3 -10 0 z M111 58 q-6 -2 -12 0 l2 24 q5 3 10 0 z"/>
      <path ${F('forearms')} d="M38 84 q5 2 10 0 l-3 26 q-4 2 -7 0 z M112 84 q-5 2 -10 0 l3 26 q4 2 7 0 z"/>
      <path ${F('lowerback')} d="M66 88 h18 l1 16 h-20 z"/>
      <path ${F('glutes')} d="M58 104 q8 -3 17 2 l0 22 q-10 4 -18 -2 q-2 -12 1 -22 z M92 104 q-8 -3 -17 2 l0 22 q10 4 18 -2 q2 -12 -1 -22 z"/>
      <path ${F('hamstrings')} d="M58 130 q8 3 16 0 l-2 32 q-6 4 -12 0 z M92 130 q-8 3 -16 0 l2 32 q6 4 12 0 z"/>
      <path ${F('calves')} d="M60 166 q6 -3 12 0 q2 18 -2 32 q-4 2 -7 0 q-5 -14 -3 -32 z M90 166 q-6 -3 -12 0 q-2 18 2 32 q4 2 7 0 q5 -14 3 -32 z"/>
    </g>`;
  return `<svg class="bodymap" viewBox="30 0 240 210" aria-label="Muscle map">${front}${back}<text x="105" y="209" class="mmlab">FRONT</text><text x="255" y="209" class="mmlab">BACK</text></svg>`;
}
function renderMuscles() {
  const wk0 = mmWeek ? dk(addDays(parseDk(curWeek), -7)) : curWeek, start = parseDk(wk0).getTime(), end = start + 7 * 864e5;
  const { tot, by } = muscleSets(s => s.t >= start && s.t < end);
  const rows = MUSCLES.map(([k, n, t]) => ({ k, n, t, v: Math.round((tot[k] || 0) * 2) / 2 })).sort((a, b) => b.v - a.v || b.t - a.t);
  const behind = rows.filter(r => r.v < r.t * .5 && ['chest', 'upperback', 'lats', 'shoulders', 'biceps', 'triceps', 'quads', 'hamstrings', 'glutes', 'abs'].includes(r.k) && mmWeek === 0);
  let h = `<div class="dayhead"><div><h2>Muscles worked</h2><div class="sub">Hard sets per muscle · ${mmWeek ? 'last week' : 'this week'}</div></div>
    <div class="seg mini">${[[0, 'This wk'], [1, 'Last wk']].map(([v, l]) => `<button class="${mmWeek === v ? 'on' : ''}" data-mmwk="${v}">${l}</button>`).join('')}</div></div>`;
  h += `<div class="card mmcard">${bodySVG(tot)}<div class="mmleg"><span><i class="mm l1"></i>Started</span><span><i class="mm l2"></i>Building</span><span><i class="mm l3"></i>On target</span><span><i class="mm l4"></i>Above</span></div></div>`;
  if (behind.length && Object.keys(tot).length) h += `<div class="card mmtip">💡 Behind this week: <b>${behind.slice(0, 3).map(r => r.n).join(', ')}</b>. Tap a muscle to see what hit it.</div>`;
  h += `<div class="card"><h3>Sets per muscle</h3><div class="mmrows">${rows.map(r => `<button class="mmrow" data-mus="${r.k}"><span>${r.n}</span><div class="mmbar"><i style="width:${Math.min(100, r.v / r.t * 100)}%" class="${r.v >= r.t ? 'full' : ''}"></i><em style="left:${Math.min(100, 100 / 1.3)}%"></em></div><b>${r.v || '·'}<small>/${r.t}</small></b></button>`).join('')}</div>
    <div class="muted" style="font-size:12px;margin-top:8px">Direct sets count 1, helper muscles count ½ (e.g. triceps on bench press). Most people grow well at about 10 hard sets a week per muscle.</div></div>`;
  $('histBody').innerHTML = h; window.__mmBy = by;
}
function muscleSheet(m) {
  const by = (window.__mmBy || {})[m] || {}, list = Object.entries(by).sort((a, b) => b[1] - a[1]);
  openSheet(`<h3>${MNAME[m]}</h3><div class="sub">${mmWeek ? 'Last week' : 'This week'} · target about ${MTGT[m]} sets</div>
    ${list.length ? list.map(([n, v]) => `<div class="hrow"><b style="flex:1">${esc(n)}</b><span>${Math.round(v * 2) / 2} set${v === 1 ? '' : 's'}</span></div>`).join('') : `<div class="muted" style="padding:20px 0">Nothing hit ${MNAME[m].toLowerCase()} ${mmWeek ? 'last' : 'this'} week yet.</div>`}`);
}

/* ---------------- effort: reps left in the tank ---------------- */
document.body.insertAdjacentHTML('beforeend', `<div id="effort" class="hide" role="dialog" aria-label="How hard was that set"><span>Reps left in the tank?</span><div>${['0', '1', '2', '3+'].map((l, i) => `<button data-rir="${i}">${l}</button>`).join('')}</div><button class="efx" data-rirx aria-label="Skip">✕</button></div>`);
let effT = null, effFor = null;
function askEffort(si, i) {
  if (S.settings.askEffort === false || DAYS[cur].slots[si].time) return;
  effFor = { wk: curWeek, di: cur, id: exId(exOf(cur, si)), i };
  const el = $('effort'); el.classList.remove('hide'); el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
  clearTimeout(effT); effT = setTimeout(hideEffort, 9000);
}
function hideEffort() { $('effort').classList.add('hide'); effFor = null; }
function setEffort(v) {
  if (!effFor) return hideEffort(); const e = ((S.logs[effFor.wk] || {})[effFor.di] || {})[effFor.id];
  if (e && e.sets[effFor.i]) { e.sets[effFor.i].rir = v; e.u = Date.now(); save(); }
  hideEffort(); toast(['💀 All out. Nice', '🔥 Hard set', '👍 Solid', '😎 Easy, go heavier next time'][v], 1600);
}

/* ---------------- workout summary ---------------- */
function daySummary(wk, di) {
  const day = (S.logs[wk] || {})[di] || {}, D = DAYS[di] || { title: 'Workout' };
  let sets = 0, vol = 0, tMin = Infinity, tMax = 0, rirs = [];
  const ex = [];
  for (const id in day) {
    const e = day[id], ss = (e.sets || []).filter(Boolean); if (!ss.length) continue;
    let best = null;
    for (const s of ss) {
      sets++; vol += (+s.w || 0) * (+s.r || 0) + (+s.w2 || 0) * (+s.r2 || 0);
      if (s.t) { tMin = Math.min(tMin, s.t); tMax = Math.max(tMax, s.t); }
      if (s.rir != null) rirs.push(s.rir);
      const sc = e.timed ? +s.r : e1rm(+s.w || 0, +s.r || 0) || +s.r; if (!best || sc > best.sc) best = { ...s, sc };
    }
    const prev = sessions(id).filter(x => x.t < (Math.min(...ss.map(s => s.t || Infinity)) - 3600e3)).pop();
    let delta = 0;
    if (prev && best) { const pb = Math.max(...prev.sets.map(s => e.timed ? +s.r : e1rm(+s.w || 0, +s.r || 0) || +s.r)); delta = best.sc > pb + .01 ? 1 : best.sc < pb - .01 ? -1 : 0; }
    ex.push({ n: e.n, timed: !!e.timed, best, sets: ss.length, delta, isNew: !prev });
  }
  const dur = tMax > tMin ? Math.round((tMax - tMin) / 60000) + 2 : sets ? Math.max(5, sets * 2) : 0;
  const dayStart = parseDk(dk(new Date(tMin === Infinity ? Date.now() : tMin))).getTime();
  const prs = Object.values(prScan(S).prs.filter(p => p.t >= dayStart && p.t < dayStart + 864e5).reduce((o, p) => { const k = p.id || p.n; if (!o[k] || e1rm(p.w, p.r) > e1rm(o[k].w, o[k].r)) o[k] = p; return o; }, {}));
  const lastWk = dk(addDays(parseDk(wk), -7)), prevDay = (S.logs[lastWk] || {})[di];
  let pVol = null, pSets = null;
  if (prevDay) { pVol = 0; pSets = 0; for (const id in prevDay) for (const s of (prevDay[id].sets || []).filter(Boolean)) { pSets++; pVol += (+s.w || 0) * (+s.r || 0) + (+s.w2 || 0) * (+s.r2 || 0); } }
  const mus = muscleSets((s, w2, d2) => w2 === wk && d2 === di).tot;
  return { title: D.title, date: tMin === Infinity ? new Date() : new Date(tMin), sets, vol: Math.round(vol), dur, prs, ex, pVol, pSets, rir: rirs.length ? rirs.reduce((a, b) => a + b, 0) / rirs.length : null, mus };
}
const kfmt = v => v >= 10000 ? (Math.round(v / 100) / 10) + 'k' : String(v);
function summarySheet(wk, di) {
  wk = wk || curWeek; di = di == null ? cur : di;
  const s = daySummary(wk, di); if (!s.sets) return toast('Log a set first');
  const pct = s.pVol ? Math.round((s.vol - s.pVol) / s.pVol * 100) : null;
  const effort = s.rir == null ? null : s.rir < .75 ? ['💀', 'All-out'] : s.rir < 1.75 ? ['🔥', 'Hard'] : s.rir < 2.6 ? ['👍', 'Solid'] : ['😎', 'Easy, go heavier'];
  const topM = Object.entries(s.mus).sort((a, b) => b[1] - a[1]).slice(0, 5);
  openSheet(`<div class="sumhead"><div class="sumbadge">🔥</div><h3>${esc(s.title)} done</h3><div class="sub">${fmtD(s.date, { weekday: 'long', month: 'short', day: 'numeric' })}</div></div>
    <div class="sumtiles"><div><b>${s.dur}<small>m</small></b><span>Time</span></div><div><b>${kfmt(s.vol)}</b><span>${unit()} lifted</span></div><div><b>${s.sets}</b><span>Sets</span></div><div><b class="${s.prs.length ? 'acc2' : ''}">${s.prs.length}</b><span>PR${s.prs.length === 1 ? '' : 's'}</span></div></div>
    ${pct != null ? `<div class="sumvs ${pct >= 0 ? 'up' : 'down'}">${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct)}% volume vs last week (${kfmt(s.pVol)} ${unit()}, ${s.pSets} sets)</div>` : `<div class="sumvs">First time logging this day. Next week you'll see how you compare.</div>`}
    ${s.prs.length ? `<div class="sumprs">${s.prs.map(p => `<div>🏆 <b>${esc(p.n)}</b> <span>${p.w}×${p.r}</span></div>`).join('')}</div>` : ''}
    <div class="sumlist">${s.ex.map(x => `<div class="hrow"><b style="flex:1">${esc(x.n)}</b><span>${x.best ? fmtSet(x.timed, x.best) : ''}</span><i class="sumd ${x.delta > 0 ? 'up' : x.delta < 0 ? 'down' : ''}">${x.isNew ? 'new' : x.delta > 0 ? '▲' : x.delta < 0 ? '▼' : '='}</i></div>`).join('')}</div>
    ${topM.length ? `<div class="summ">${topM.map(([m, v]) => `<span>${MNAME[m]} <b>${Math.round(v * 2) / 2}</b></span>`).join('')}</div>` : ''}
    ${effort ? `<div class="sumeff">${effort[0]} Average effort: <b>${effort[1]}</b> (${Math.round(s.rir * 10) / 10} reps left per set)</div>` : ''}
    <div class="grid2" style="margin-top:12px"><button class="btn acc" data-sumshare="${wk}:${di}">📤 Share</button><button class="btn" data-sheetclose>Close</button></div>`);
}
async function drawSummary(wk, di) {
  const s = daySummary(wk, di), W = 1080, H = 1350, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  const SANS = '-apple-system, BlinkMacSystemFont, "SF Pro Display", Inter, system-ui, sans-serif';
  const g = x.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, mix(themeColor, [0, 0, 0], .3)); g.addColorStop(.42, mix(themeColor, [0, 0, 0], .85)); g.addColorStop(1, '#000');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.strokeStyle = 'rgba(255,255,255,.16)'; x.lineWidth = 3; roundRect(x, 36, 36, W - 72, H - 72, 60); x.stroke();
  x.textAlign = 'center'; x.fillStyle = '#fff'; x.font = `800 96px ${SANS}`; x.fillText(s.title, W / 2, 230);
  x.globalAlpha = .8; x.font = `600 34px ${SANS}`; x.fillText(`${PROFILES[PROF].name} · ${fmtD(s.date, { weekday: 'long', month: 'short', day: 'numeric' })}`, W / 2, 292); x.globalAlpha = 1;
  [[s.dur + ' min', 'TIME'], [kfmt(s.vol), unit().toUpperCase() + ' LIFTED'], [s.sets, 'SETS'], [s.prs.length, s.prs.length === 1 ? 'PR' : "PR'S"]].forEach(([v, l], i) => {
    const cx = 100 + (i % 2) * 450, cy = 360 + Math.floor(i / 2) * 230;
    x.fillStyle = 'rgba(255,255,255,.1)'; roundRect(x, cx, cy, 430, 200, 40); x.fill();
    x.fillStyle = TH.acc; x.font = `800 84px ${SANS}`; x.fillText(String(v), cx + 215, cy + 116);
    x.fillStyle = '#fff'; x.globalAlpha = .75; x.font = `600 26px ${SANS}`; x.fillText(l, cx + 215, cy + 166); x.globalAlpha = 1;
  });
  x.textAlign = 'left'; x.font = `800 44px ${SANS}`; x.fillStyle = '#fff'; x.fillText('Best sets', 100, 880);
  x.font = `600 32px ${SANS}`;
  s.ex.slice(0, 6).forEach((e, i) => {
    const y = 940 + i * 54; x.fillStyle = '#fff'; x.fillText((e.delta > 0 ? '▲ ' : '') + e.n.slice(0, 30), 100, y);
    if (e.best) { x.textAlign = 'right'; x.fillStyle = TH.acc; x.fillText(fmtSet(e.timed, e.best), W - 100, y); x.textAlign = 'left'; }
  });
  x.textAlign = 'center'; x.globalAlpha = .6; x.fillStyle = '#fff'; x.font = `500 24px ${SANS}`; x.fillText('@' + ME.username + ' · SPOTT', W / 2, H - 70); x.globalAlpha = 1;
  return new Promise(r => c.toBlob(r, 'image/png'));
}
async function shareSummary(wk, di) {
  const b = await drawSummary(wk, +di), f = new File([b], `${ME.username}-${wk}-${di}.png`, { type: 'image/png' });
  try { if (navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], title: 'Workout summary' }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  download(f.name, b); toast('Saved. Share it from your photos/files');
}
/* hook the set flow: effort prompt + summary when the day is finished */
const _afterLog = afterLog;
afterLog = function (si) {
  const wasDone = window.__dayWasDone; _afterLog(si);
  const i = Math.max(0, setsOf(curWeek, cur, exId(exOf(cur, si))).length - 1);
  const logged = setsOf(curWeek, cur, exId(exOf(cur, si))); let li = -1; logged.forEach((s, k) => { if (s && (li < 0 || s.t >= logged[li].t)) li = k; });
  if (dayDone(curWeek, cur) && !wasDone) {
    const key = 'gymp.sumShown.' + uid() + '.' + curWeek + '.' + cur;
    if (!localStorage.getItem(key)) {
      localStorage.setItem(key, '1'); hideEffort(); $('toast').classList.remove('show');
      const open = () => { const pr = document.querySelector('#prpop.show, .prpop.show, #pr.show'); if (pr) return setTimeout(open, 500); summarySheet(curWeek, cur); };
      setTimeout(open, 900); return;
    }
  }
  askEffort(si, li >= 0 ? li : i);
};
document.addEventListener('click', e => { if (appOff()) return; const b = e.target.closest('[data-chk],[data-pace]'); if (b) window.__dayWasDone = dayDone(curWeek, cur); }, true);

/* friends: milestone 4 (challenges) */

/* ---------------- strength trends (History → PRs) ---------------- */
function strengthRows() {
  const out = [], seen = new Set();
  for (const wk in S.logs) for (const di in S.logs[wk]) for (const id in S.logs[wk][di]) { const e = S.logs[wk][di][id]; if (!e.timed && !seen.has(id)) seen.add(id); }
  for (const id of seen) {
    const h = sessions(id); if (h.length < 2 || h[0].timed) continue;
    const pts = h.map(x => ({ x: x.t, y: Math.round(Math.max(...x.sets.map(s => e1rm(+s.w || 0, +s.r || 0)))) })).filter(p => p.y > 0); if (pts.length < 2) continue;
    const cut = Date.now() - 56 * 864e5, base = pts.find(p => p.x >= cut) || pts[0], now = pts[pts.length - 1];
    const name = (Object.values(S.logs).flatMap(w => Object.values(w)).find(d => d[id]) || {})[id].n;
    out.push({ id, n: (ssParts(name) || [name])[0], now: now.y, best: Math.max(...pts.map(p => p.y)), ch: Math.round((now.y - base.y) * 10) / 10, pts });
  }
  return out.sort((a, b) => b.best - a.best).slice(0, 6);
}
function spark(pts) {
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const P2 = pts.map(p => [(p.x - x0) / ((x1 - x0) || 1) * 76 + 2, 22 - (p.y - y0) / ((y1 - y0) || 1) * 18]);
  return `<svg class="spark" viewBox="0 0 80 26"><polyline points="${P2.map(p => p.join(',')).join(' ')}" fill="none" stroke="var(--acc)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${P2[P2.length - 1][0]}" cy="${P2[P2.length - 1][1]}" r="2.6" fill="var(--acc)"/></svg>`;
}
function strengthSheet(id) {
  const r = strengthRows().find(x => x.id === id); if (!r) return;
  openSheet(`<h3>${esc(r.n)}</h3><div class="sub">Estimated 1-rep max over time</div>
    <div class="stats"><div class="stat"><b>${r.now}</b><span>Now (${unit()})</span></div><div class="stat"><b>${r.best}</b><span>Best</span></div><div class="stat"><b class="${r.ch > 0 ? 'up' : ''}">${r.ch > 0 ? '+' : ''}${r.ch}</b><span>8 weeks</span></div></div>
    ${lineChart(r.pts, { title: 'Est. 1RM from your best set each session' })}
    <div class="muted" style="font-size:12px;margin-top:8px">Estimated with the Epley formula (weight × (1 + reps ÷ 30)). It's a guide for tracking strength, not a number to go test.</div>`);
}
const _renderPRs = renderPRs;
renderPRs = function () {
  _renderPRs();
  const rows = strengthRows(); if (!rows.length) return;
  const card = document.createElement('div'); card.className = 'card';
  card.innerHTML = `<h3>Strength trend <small class="muted">est. 1-rep max</small></h3>${rows.map(r => `<button class="strow" data-strength="${esc(r.id)}"><b>${esc(r.n)}</b>${spark(r.pts)}<span>${r.now}<small> ${unit()}</small><i class="${r.ch > 0 ? 'up' : r.ch < 0 ? 'down' : ''}">${r.ch > 0 ? '▲' + r.ch : r.ch < 0 ? '▼' + (-r.ch) : '='}</i></span></button>`).join('')}`;
  const head = $('histBody').querySelector('.dayhead'); head ? head.after(card) : $('histBody').prepend(card);
};

/* ---------------- 5-minute warm-up ---------------- */
const DRILLS = {
  jack: ['Jumping jacks', 'Light and bouncy, get the blood moving'], highknees: ['High knees', 'Drive the knees up, stay on the balls of your feet'],
  armcircle: ['Arm circles', 'Small to big circles, switch direction halfway'], pullapart: ['Band pull-aparts', 'No band? Squeeze the shoulder blades with arms out'],
  catcow: ['Cat-cow', 'Slow, round up then drop and look up'], inchworm: ['Inchworms', 'Walk the hands out to a plank, then back'],
  openbook: ['Open book', 'Lie on your side, open the top arm across, switch halfway'], legswing: ['Leg swings', 'Hold something, swing front to back, switch legs halfway'],
  wgs: ["World's greatest stretch", 'Lunge, hand down, reach the other arm to the sky, switch sides'], bwsquat: ['Bodyweight squats', 'Slow and deep, arms forward'],
  bridge: ['Glute bridges', 'Squeeze the glutes 1 sec at the top'], hydrant: ['Fire hydrants', 'Knee out to the side, switch halfway'],
  birddog: ['Bird dog', 'Opposite arm and leg, switch each rep'], deadbug: ['Dead bug', 'Lower back pressed down, slow']
};
function warmupPlan(di) {
  const cats = {}; for (const sl of (DAYS[di] || { slots: [] }).slots) for (const c of PAT_CATS[sl.opts[0].pat] || []) cats[c] = (cats[c] || 0) + 1;
  const lower = (cats.quads || 0) + (cats.glutes || 0) + (cats.hamstrings || 0) + (cats.calves || 0), upper = (cats.chest || 0) + (cats.back || 0) + (cats.shoulders || 0) + (cats.arms || 0), core = cats.core || 0;
  const pick = [di % 2 ? 'highknees' : 'jack'];
  const L = (cats.glutes || 0) > (cats.quads || 0) ? ['legswing', 'wgs', 'bridge', 'hydrant', 'bwsquat'] : ['legswing', 'wgs', 'bwsquat', 'bridge', 'hydrant'];
  const U = ['armcircle', 'pullapart', 'catcow', 'inchworm', 'openbook'], C = ['catcow', 'birddog', 'deadbug', 'openbook', 'inchworm'];
  const order = core > lower && core > upper ? [C, U, L] : lower >= upper * 1.5 ? [L, C] : upper >= lower * 1.5 ? [U, C] : [L, U];
  const take = order.length === 3 ? [3, 1, 1] : order[0] === L && order[1] === U ? [3, 2] : [4, 1];
  order.forEach((list, k) => { let n = take[k]; for (const d of list) if (n > 0 && !pick.includes(d)) { pick.push(d); n--; } });
  return pick.slice(0, 6).map(k => ({ k, n: DRILLS[k][0], cue: DRILLS[k][1], sec: k === 'jack' || k === 'highknees' ? 45 : 40 }));
}
let WU = null;
const wuDone = () => localStorage.getItem('gymp.wu.' + uid() + '.' + dk(new Date())) === String(cur);
function warmupSheet() {
  const plan = warmupPlan(cur), tot = Math.round((plan.reduce((a, d) => a + d.sec, 0) + (plan.length - 1) * 8) / 60 * 10) / 10;
  openSheet(`<h3>Warm-up for ${esc(DAYS[cur].title)}</h3><div class="sub">${plan.length} moves · about ${Math.round(tot)} minutes · picked for today's muscles</div>
    <div class="wulist">${plan.map((d, i) => `<div class="wuitem"><div class="thumb"><div data-anim="${P[d.k] ? d.k : 'jack'}"></div></div><div><b>${i + 1}. ${d.n}</b><span>${d.sec}s · ${d.cue}</span></div></div>`).join('')}</div>
    <button class="btn acc" style="width:100%;margin-top:12px" data-wustart>▶ Start warm-up</button>`);
}
function wuStart() {
  closeSheet(); const plan = warmupPlan(cur);
  WU = { plan, i: 0, phase: 'ready', t0: performance.now(), left: 5, paused: false };
  document.body.insertAdjacentHTML('beforeend', `<div id="wu" class="show"><div class="wutop"><div class="wudots">${plan.map((_, i) => `<i data-wud="${i}"></i>`).join('')}</div><button class="wux" data-wuclose aria-label="Close">✕</button></div>
    <div class="wuname" id="wuName"></div><div class="wucue" id="wuCue"></div><div class="wufig" id="wuFig"></div>
    <div class="wuring"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="52" class="bg"/><circle cx="60" cy="60" r="52" class="fg" id="wuArc"/></svg><b id="wuT">5</b><span id="wuLab">Get ready</span></div>
    <div class="wunext" id="wuNext"></div><div class="pbtns"><button data-wuprev>Back</button><button data-wupause>Pause</button><button class="main" data-wuskip>Skip ›</button></div></div>`);
  requestAnimationFrame(wuTick); keepAwake();
}
function wuSet(i, phase) { WU.i = i; WU.phase = phase; WU.t0 = performance.now(); WU.last = null; }
function wuTick(now) {
  if (!WU) return; if (WU.paused) { WU.t0 += now - (WU.pn || now); WU.pn = now; requestAnimationFrame(wuTick); return; } WU.pn = now;
  const d = WU.plan[WU.i], dur = WU.phase === 'ready' ? (WU.i ? 8 : 5) : d.sec, e = (now - WU.t0) / 1000, left = Math.max(0, dur - e);
  $('wuName').textContent = (WU.phase === 'ready' ? 'Up next: ' : '') + d.n; $('wuCue').textContent = d.cue;
  $('wuFig').innerHTML = svgWrap(figure(P[d.k] ? d.k : 'jack', WU.phase === 'ready' ? 0 : loopT(P[d.k] ? d.k : 'jack', e * 1000)));
  $('wuT').textContent = Math.ceil(left); $('wuLab').textContent = WU.phase === 'ready' ? 'Get ready' : 'Go';
  const C = 2 * Math.PI * 52, a = $('wuArc'); a.style.strokeDasharray = C; a.style.strokeDashoffset = C * (left / dur);
  $('wu').classList.toggle('rdy', WU.phase === 'ready');
  document.querySelectorAll('[data-wud]').forEach((el, k) => { el.className = k < WU.i ? 'done' : k === WU.i ? 'on' : ''; });
  $('wuNext').textContent = WU.plan[WU.i + 1] ? 'Next: ' + WU.plan[WU.i + 1].n : 'Last one';
  const sec = Math.ceil(left); if (left <= 3 && left > 0 && WU.last !== sec) { WU.last = sec; beep(WU.phase === 'ready' ? 520 : 660, .08, .2); }
  if (left <= 0) {
    if (WU.phase === 'ready') { beep(880, .15, .3); buzz(80); wuSet(WU.i, 'go'); }
    else if (WU.i < WU.plan.length - 1) { beep(990, .12, .25); wuSet(WU.i + 1, 'ready'); }
    else return wuFinish();
  }
  requestAnimationFrame(wuTick);
}
function wuFinish() {
  beep(990, .3, .35); buzz([100, 60, 100]); localStorage.setItem('gymp.wu.' + uid() + '.' + dk(new Date()), String(cur));
  wuClose(); toast('✅ Warmed up. Time to lift', 2200); renderWorkout();
}
function wuClose() { WU = null; const el = $('wu'); if (el) el.remove(); }

/* ---------------- workout tab: warm-up row + finish link ---------------- */
let EXC_OPEN = null; // 'week:day' the person re-opened the folded card for
document.addEventListener('click', e => { const t = e.target.closest('[data-excopen]'); if (!t || appOff()) return; EXC_OPEN = t.dataset.excopen || null; $('excount').innerHTML = excountHtml(); });
const _excountHtml = excountHtml;
excountHtml = function () {
  const D = DAYS[cur], key = curWeek + ':' + cur, started = D.slots.some((sl, si) => doneToday(exOf(cur, si)));
  if (started && EXC_OPEN !== key) return `<button class="excmin" data-excopen="${key}"><span>${D.slots.length} exercise${D.slots.length === 1 ? '' : 's'} today${wuDone() ? ' · warmed up' : ''}</span><i>Change ›</i></button>`; // folded once the first set is in
  return _excountHtml().replace(/<\/div>$/, '') + `<button class="wurow ${wuDone() ? 'done' : ''}" data-wuopen><span>${wuDone() ? 'Warmed up' : '5-min warm-up before you start'}</span><i>${wuDone() ? 'Again' : 'Start'} ›</i></button>${started ? '<button class="exchide" data-excopen="">Hide</button>' : ''}</div>`;
};
const _renderWorkout = renderWorkout;
renderWorkout = function () {
  _renderWorkout();
  const any = DAYS[cur] && DAYS[cur].slots.some((sl, si) => setsOf(curWeek, cur, exId(exOf(cur, si))).some(Boolean));
  if (any) { const done = dayDone(curWeek, cur); $('list').insertAdjacentHTML('beforeend', `<button class="finrow" data-summary>${done ? '📊 See today\'s summary' : '🏁 Finish early & see summary'}</button>`); }
};

/* ---------------- clicks ---------------- */
document.addEventListener('click', e => { if (appOff()) return;
  const t = e.target.closest('button, [data-mus]'); if (!t) return; const d = t.dataset;
  if (d.rir !== undefined) return setEffort(+d.rir);
  if (d.rirx !== undefined) return hideEffort();
  if (d.mmwk !== undefined) { mmWeek = +d.mmwk; return renderMuscles(); }
  if (d.mus) return muscleSheet(d.mus);
  if (d.summary !== undefined) return summarySheet(curWeek, cur);
  if (d.sumshare) { const [wk, di] = d.sumshare.split(':'); return shareSummary(wk, di); }
  if (d.sheetclose !== undefined) return closeSheet();
  if (d.strength) return strengthSheet(d.strength);
  if (d.wuopen !== undefined) return warmupSheet();
  if (d.wustart !== undefined) return wuStart();
  if (d.wuclose !== undefined) return wuClose();
  if (d.wuskip !== undefined && WU) { if (WU.phase === 'ready') wuSet(WU.i, 'go'); else if (WU.i < WU.plan.length - 1) wuSet(WU.i + 1, 'ready'); else wuFinish(); return; }
  if (d.wuprev !== undefined && WU) { wuSet(Math.max(0, WU.phase === 'go' ? WU.i : WU.i - 1), 'ready'); return; }
  if (d.wupause !== undefined && WU) { WU.paused = !WU.paused; t.textContent = WU.paused ? 'Resume' : 'Pause'; return; }
  if (d.askeffort !== undefined) { S.settings.askEffort = S.settings.askEffort === false; touchSettings(); renderMore(); return; }
});

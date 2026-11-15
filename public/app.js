/* Public Gym app — core logic, ported from ../app.js for one signed-in person (see dev/public-version/PORTING.md).
   $, esc, toast, theme and state helpers come from core.js; sb, session, ME, ROUTINE, S from auth.js. */
'use strict';
for (const k in P) P[k].B = { ...P[k].A, ...P[k].B };

/* ================= utils ================= */
const pad = n => String(n).padStart(2, '0');
const dk = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const parseDk = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const weekKeyOf = d => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); const g = (x.getDay() + 6) % 7; return dk(addDays(x, -g)); };
const monthKey = d => d.getFullYear() + '-' + pad(d.getMonth() + 1);
const fmtD = (d, o = { month: 'short', day: 'numeric' }) => d.toLocaleDateString(undefined, o);
const fmtMonth = k => { const [y, m] = k.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }); };
const fmtT = s => Math.floor(s / 60) + ':' + pad(Math.max(0, Math.floor(s % 60)));
const exId = ex => ex.n.toLowerCase().replace(/[^a-z0-9]+/g, '-');
const nums = r => (String(r).match(/\d+/g) || []).map(Number);
const repTop = r => /fail/i.test(r) ? 0 : (nums(r).pop() || 0);
const repLow = r => nums(r)[0] || 0;
const clone = o => JSON.parse(JSON.stringify(o));

/* ================= state ================= */
/* The couple app's code reads PROFILES[PROF]; here that is always the signed-in person. */
const PROF = 'me';
const firstName = () => String(ME.display_name || ME.username).trim().split(/\s+/)[0];
const PROFILES = { me: { get name() { return ME.display_name || ME.username; }, get label() { return firstName() + '’s'; }, get mono() { return initials(this.name); }, get days() { return ROUTINE || []; }, get th() { return TH; }, get thL() { return TH; }, tagline: '' } };
let DAYS = [];
const uid = () => session.user.id;
const appOff = () => !session || !ME || document.body.classList.contains('out'); // signed out, or still in sign-in / setup
const LWS = () => 'gymp.lastWeekSeen.' + uid();
/* the week is the person's own training days: each routine day has wd, 1 = Monday … 7 = Sunday */
const wdOf = d => (d.getDay() + 6) % 7 + 1;
const todayExact = () => DAYS.findIndex(d => d.wd === wdOf(new Date()));
const todayIdx = () => { const t = wdOf(new Date()); let i = DAYS.findIndex(d => d.wd === t); if (i < 0) i = DAYS.findIndex(d => d.wd > t); return Math.max(0, i); };
const isTrainingDay = d => DAYS.some(x => x.wd === wdOf(d));
const dayDate = (wk, di) => addDays(parseDk(wk), ((DAYS[di] || {}).wd || di + 1) - 1);
let curWeek = weekKeyOf(new Date()), cur = 0;
let tab = 'workout';
const fmtSet = (timed, s) => timed ? (s.r >= 120 ? Math.round(s.r / 60) + ' min' : s.r + 's') + (s.w ? ' @' + s.w : '') : `${s.w || 'BW'}×${s.r}` + (s.r2 != null ? ` + ${s.w2 || 'BW'}×${s.r2}` : '');
/* supersets: "Bicep Curls + Tricep Pushdowns" → two halves, each with its own weight and reps */
const ssParts = n => { const a = String(n || '').split(' + '); return a.length === 2 ? a.map(x => x.trim()) : null; };
const SS_GUESS = [[/pushdown/i, 'pushdown'], [/skull/i, 'skull'], [/overhead.*ext|tricep ext/i, 'ohext'], [/kickback/i, 'cablekick'], [/curl/i, 'curl'], [/dip/i, 'dip'], [/overhead (db )?press|standing.*press/i, 'ohp'], [/shoulder press|db press/i, 'seatedpress'], [/frog pump|bridge/i, 'bridge'], [/lateral raise/i, 'latraise'], [/row/i, 'row']];
function ssPat(n, fb) { const l = typeof libFind === 'function' && libFind(n); if (l) return l.pat; const m = (window.FIG_NAMES || {})[n.toLowerCase()]; if (m && P[m]) return m; for (const [re, k] of SS_GUESS) if (re.test(n) && P[k]) return k; return fb; }

function persist() { if (session) saveLocal(uid(), S); }
function save() { persist(); scheduleSync(); }
function touchSettings() { S.settings.u = Date.now(); save(); }

/* routine access */
// swaps are keyed by the slot's place in the full routine (sl.k), so removing one doesn't shift the rest
const slotKey = (di, si) => { const sl = DAYS[di] && DAYS[di].slots[si]; return di + '-' + (sl && sl.k != null ? sl.k : si); };
function exOfSlot(sl, v) {
  v = v || 0;
  if (typeof v === 'string' && v.startsWith('n:')) { const n = v.slice(2); return sl.opts.find(o => o.n === n) || (typeof libFind === 'function' && libFind(n)) || sl.opts[0]; }
  return sl.opts[Math.min(+v || 0, sl.opts.length - 1)];
}
const exOf = (di, si) => exOfSlot(DAYS[di].slots[si], S.settings.swaps[slotKey(di, si)]);
const entry = (wk, di, id) => (((S.logs[wk] || {})[di] || {})[id]) || null;
const setsOf = (wk, di, id) => (entry(wk, di, id) || {}).sets || [];
function ensureEntry(wk, di, ex) {
  const id = exId(ex);
  S.logs[wk] = S.logs[wk] || {}; S.logs[wk][di] = S.logs[wk][di] || {};
  return S.logs[wk][di][id] = S.logs[wk][di][id] || { n: ex.n, sets: [], u: 0 };
}
/* all past sessions for an exercise, oldest → newest */
function sessions(id) {
  const out = [];
  for (const wk in S.logs) for (const di in S.logs[wk]) {
    const e = S.logs[wk][di][id]; if (!e) continue;
    const sets = (e.sets || []).filter(Boolean); if (!sets.length) continue;
    const t = Math.min(...sets.map(s => s.t || parseDk(wk).getTime()));
    out.push({ wk, di: +di, t, date: dk(new Date(t)), sets, timed: !!e.timed, note: e.note || '' });
  }
  return out.sort((a, b) => a.t - b.t);
}
const dayDone = (wk, di) => DAYS[di].slots.every((sl, si) => setsOf(wk, di, exId(exOf(di, si))).filter(Boolean).length >= sl.sets);
const dayAny = (wk, di) => { const d = (S.logs[wk] || {})[di]; return !!d && Object.values(d).some(e => (e.sets || []).some(Boolean)); };
const unit = () => S.settings.unit;
const inc = () => unit() === 'kg' ? 2.5 : 5;

/* ================= figure drawing ================= */
const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
/* joints move in arcs (angle interpolation) from whatever stays planted, so limbs keep their length and feet/hands don't slide */
const BONES = [['s', 'p'], ['h', 's'], ['e', 's'], ['w', 'e'], ['e2', 's'], ['w2', 'e2'], ['k', 'p'], ['f', 'k'], ['t', 'f'], ['k2', 'p'], ['f2', 'k2']];
function rig(pat) {
  const X = P[pat]; if (X._rig) return X._rig;
  const A = X.A, B = X.B, same = j => A[j] && B[j] && Math.hypot(A[j][0] - B[j][0], A[j][1] - B[j][1]) < .6;
  const adj = {}; for (const [a, b] of BONES) if (A[a] && A[b]) { (adj[a] = adj[a] || []).push(b); (adj[b] = adj[b] || []).push(a); }
  const fixed = ['f', 'f2', 'w', 'w2', 'p', 't'].filter(same);
  const root = X.lin ? null : (fixed.find(j => j === 'f' || j === 'f2') || fixed[0] || 'p');
  const par = {}, order = [];
  if (root) { const q = [root]; par[root] = null; while (q.length) { const j = q.shift(); order.push(j); for (const n of adj[j] || []) if (!(n in par)) { par[n] = j; q.push(n); } } }
  const pathTo = j => { const out = []; while (j != null) { out.unshift(j); j = par[j]; } return out; };
  const pins = fixed.filter(j => j !== root && j in par).map(j => ({ j, path: pathTo(j) }));
  return X._rig = { root, par, order, pins };
}
const angLerp = (a0, a1, t) => { let d = a1 - a0; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a0 + d * t; };
function poseAt(pat, t) {
  const A = P[pat].A, B = P[pat].B, o = {}, lin = k => [A[k][0] + (B[k][0] - A[k][0]) * t, A[k][1] + (B[k][1] - A[k][1]) * t];
  const R = rig(pat);
  if (!R.root) { for (const k in A) o[k] = lin(k); return o; }
  o[R.root] = lin(R.root);
  for (const j of R.order) {
    const pa = R.par[j]; if (!pa) continue;
    const a0 = Math.atan2(A[j][1] - A[pa][1], A[j][0] - A[pa][0]), a1 = Math.atan2(B[j][1] - B[pa][1], B[j][0] - B[pa][0]);
    const l0 = Math.hypot(A[j][1] - A[pa][1], A[j][0] - A[pa][0]), l1 = Math.hypot(B[j][1] - B[pa][1], B[j][0] - B[pa][0]);
    const a = angLerp(a0, a1, t), l = l0 + (l1 - l0) * t; o[j] = [o[pa][0] + l * Math.cos(a), o[pa][1] + l * Math.sin(a)];
  }
  /* pull other planted joints (hands on the floor, second foot) back onto their spot */
  for (const { j, path } of R.pins) {
    const want = lin(j), dx = want[0] - o[j][0], dy = want[1] - o[j][1]; if (Math.abs(dx) + Math.abs(dy) < .05) continue;
    const n = path.length - 1, idx = {}; path.forEach((nd, i) => idx[nd] = i);
    for (const m of R.order) { let a = m; while (a != null && !(a in idx)) a = R.par[a]; const i = a == null ? 0 : idx[a]; if (i) o[m] = [o[m][0] + dx * i / n, o[m][1] + dy * i / n]; }
  }
  for (const k in A) if (!o[k]) o[k] = lin(k);
  return o;
}
const ln = (a, b, w, c) => `<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/>`;
function figure(pat, t) {
  const p = poseAt(pat, ease(t)), B = TH.txt, D = TH.dim, A = TH.acc; let g = '';
  for (const pr of P[pat].props) {
    const a = pr.split(':'); switch (a[0]) {
      case 'floor': g += ln([2, 112], [118, 112], 2, D); break;
      case 'incline': g += ln([2, 114], [118, 104], 3, D); break;
      case 'ibench': g += ln([14, 52], [48, 94], 5, D) + ln([48, 94], [66, 94], 5, D) + ln([26, 68], [26, 112], 3, D) + ln([60, 94], [60, 112], 3, D); break;
      case 'chair': g += ln([42, 38], [42, 88], 4, D) + ln([42, 88], [70, 88], 4, D) + ln([46, 88], [46, 112], 3, D) + ln([66, 88], [66, 112], 3, D); break;
      case 'stool': g += ln([40, 89], [68, 89], 4, D) + ln([54, 89], [54, 112], 3, D); break;
      case 'pad45': g += ln([58, 80], [72, 95], 6, D) + ln([66, 90], [66, 112], 3, D) + ln([86, 108], [98, 100], 4, D); break;
      case 'bike': g += `<circle cx="28" cy="100" r="11" fill="none" stroke="${D}" stroke-width="2.5"/><circle cx="94" cy="100" r="11" fill="none" stroke="${D}" stroke-width="2.5"/>` + ln([28, 100], [44, 78], 3, D) + ln([44, 78], [66, 98], 3, D) + ln([66, 98], [94, 100], 3, D) + ln([86, 62], [94, 100], 3, D); break;
      case 'sled': g += ln([94, 56], [96, 104], 3, D) + `<rect x="90" y="100" width="26" height="10" rx="2" fill="${D}"/>`; break;
      case 'box': g += `<rect x="66" y="97" width="28" height="15" rx="2" fill="${D}"/>`; break;
      case 'rope': { const f = p[a[1]]; g += ln(f, [116, 110], 2, A); break; }
      case 'bench': g += `<rect x="${a[1]}" y="${a[3]}" width="${a[2] - a[1]}" height="6" rx="2" fill="${D}"/>` + ln([+a[1] + 6, +a[3] + 6], [+a[1] + 6, 112], 3, D) + ln([a[2] - 6, +a[3] + 6], [a[2] - 6, 112], 3, D); break;
      case 'step': g += `<rect x="50" y="108" width="26" height="4" fill="${D}"/>`; break;
      case 'seat': g += `<rect x="30" y="92" width="34" height="5" rx="2" fill="${D}"/>` + ln([47, 97], [47, 112], 3, D) + ln([96, 82], [96, 98], 3, D) + ln([2, 112], [118, 112], 2, D); break;
      case 'lpseat': g += ln([10, 48], [36, 98], 5, D) + ln([36, 98], [60, 98], 5, D) + ln([2, 112], [118, 112], 2, D); break;
      case 'platform': { const f = p[a[1]]; g += ln([f[0] + 4, f[1] - 16], [f[0] + 4, f[1] + 14], 5, D); break; }
      case 'pullbar': g += ln([30, 0], [94, 0], 4, D); break;
      case 'dipbars': g += ln([44, 64], [78, 64], 4, D) + ln([48, 64], [48, 112], 2, D) + ln([2, 112], [118, 112], 2, D); break;
      case 'cable': { const f = p[a[1]]; g += `<line x1="${f[0]}" y1="${f[1]}" x2="${a[2]}" y2="${a[3]}" stroke="${A}" stroke-width="1.2" stroke-dasharray="3 2"/><circle cx="${a[2]}" cy="${a[3]}" r="3" fill="${D}"/>`; break; }
      case 'landmine': { const f = p[a[1]]; g += ln([6, 110], f, 3, D); break; }
      case 'lm2': { const f = p[a[1]]; g += ln([60, 112], f, 3, D); break; }
      case 'wedge': g += `<path d="M48 112 L72 112 L48 104 Z" fill="${D}"/>`; break;
      case 'padback': { const off = (j) => [p[j][0] - 5, p[j][1] + 2]; g += ln(off('s'), off('p'), 6, D) + ln([p.p[0] - 6, p.p[1] + 4], [p.p[0] - 10, 112], 3, D); break; }
      case 'smith': g += ln([+a[1], -12], [+a[1], 112], 2, D) + ln([+a[1] + 4, -12], [+a[1] + 4, 112], 1, D); break;
      case 'belt': { const f = p[a[1]]; g += `<line x1="${f[0]}" y1="${f[1]}" x2="${f[0] + 2}" y2="${f[1] + 22}" stroke="${D}" stroke-width="1.5" stroke-dasharray="2 2"/><circle cx="${f[0] + 2}" cy="${f[1] + 28}" r="6" fill="none" stroke="${A}" stroke-width="3"/>` + `<rect x="34" y="108" width="52" height="4" fill="${D}"/>`; break; }
      case 'rbox': g += `<rect x="${a[1]}" y="${a[3]}" width="${a[2] - a[1]}" height="${112 - a[3]}" rx="2" fill="${D}"/>`; break;
      case 'rack': g += ln([88, 40], [88, 112], 3, D) + ln([78, +a[1]], [92, +a[1]], 3, D); break;
      case 'lowbar': g += ln([12, 50], [62, 50], 4, D) + ln([16, 50], [16, 112], 2, D) + ln([2, 112], [118, 112], 2, D); break;
      case 'cpad': g += ln([44, 104], [86, 60], 6, D) + ln([60, 88], [60, 112], 3, D) + ln([2, 112], [118, 112], 2, D); break;
      case 'sealbench': g += `<rect x="20" y="61" width="62" height="6" rx="2" fill="${D}"/>` + ln([26, 67], [26, 112], 3, D) + ln([76, 67], [76, 112], 3, D) + ln([2, 112], [118, 112], 2, D); break;
      case 'preacher': g += ln([p.s[0] - 3, p.s[1] + 7], [p.e[0] - 3, p.e[1] + 7], 6, D) + ln([p.e[0] - 6, p.e[1] + 8], [p.e[0] - 6, 112], 3, D); break;
      case 'dbench': g += ln([12, 94], [80, 79], 5, D) + ln([24, 92], [24, 112], 3, D) + ln([72, 81], [72, 112], 3, D) + `<circle cx="98" cy="86" r="4" fill="${D}"/>` + ln([2, 112], [118, 112], 2, D); break;
      case 'post': g += ln([+a[1], 30], [+a[1], 112], 3, D); break;
      case 'cpost': g += ln([+a[1], 40], [+a[1], 72], 6, D) + ln([+a[1], 72], [+a[1], 112], 3, D); break;
      case 'fbench': g += `<rect x="42" y="86" width="36" height="5" rx="2" fill="${D}"/>` + ln([60, 91], [60, 112], 3, D); break;
      case 'captain': g += ln([50, 30], [50, 80], 5, D) + ln([50, 50], [80, 50], 4, D) + ln([50, 80], [50, 112], 3, D) + ln([2, 112], [118, 112], 2, D); break;
      case 'legpad': { const f = p[a[1]]; g += `<circle cx="${f[0].toFixed(1)}" cy="${(f[1] - 4).toFixed(1)}" r="4" fill="${D}"/>`; break; }
      case 'anchor': { const f = p[a[1]]; g += `<rect x="${(f[0] - 6).toFixed(1)}" y="${(f[1] - 6).toFixed(1)}" width="10" height="6" rx="2" fill="${D}"/>`; break; }
      case 'ball': { const f = p[a[1]]; g += `<circle cx="${(f[0] + 2).toFixed(1)}" cy="${(f[1] + 11).toFixed(1)}" r="11" fill="none" stroke="${D}" stroke-width="2.5"/>`; break; }
      case 'kneepad': { const f = p[a[1]]; g += `<rect x="${(f[0] - 10).toFixed(1)}" y="${(f[1] - 9).toFixed(1)}" width="16" height="5" rx="2" fill="${D}"/>` + ln([96, 72], [96, 112], 3, D); break; }
      case 'wall': g += ln([+a[1], 0], [+a[1], 112], 4, D); break;
      case 'tread': g += `<rect x="8" y="108" width="100" height="5" rx="2.5" fill="${D}"/>` + ln([100, 108], [104, 46], 3, D) + ln([92, 50], [106, 46], 3, D); break;
      case 'stairs': g += `<path d="M2 112 H66 V100 H118" fill="none" stroke="${D}" stroke-width="3"/>`; break;
      case 'ellip': g += ln([10, 106], [104, 106], 4, D) + ln([84, 106], [86, 28], 3, D); break;
    }
  }
  if (p.k2) g += ln(p.p, p.k2, 4.5, TH.limb) + ln(p.k2, p.f2, 4.5, TH.limb);
  if (p.e2) g += ln(p.s, p.e2, 4, TH.limb) + ln(p.e2, p.w2, 4, TH.limb);
  g += ln(p.s, p.p, 6, B) + ln(p.p, p.k, 5, B) + ln(p.k, p.f, 5, B);
  if (p.t) g += ln(p.f, p.t, 4, B);
  g += ln(p.s, p.e, 4.5, B) + ln(p.e, p.w, 4.5, B);
  g += `<circle cx="${p.h[0].toFixed(1)}" cy="${p.h[1].toFixed(1)}" r="7" fill="${B}"/>`;
  for (const pr of P[pat].props) {
    const a = pr.split(':'); const f = p[a[1]];
    if (a[0] === 'barbell') g += `<circle cx="${f[0]}" cy="${f[1]}" r="10" fill="none" stroke="${A}" stroke-width="3"/><circle cx="${f[0]}" cy="${f[1]}" r="2.5" fill="${A}"/>`;
    if (a[0] === 'db') g += `<rect x="${f[0] - 7}" y="${f[1] - 3}" width="14" height="6" rx="2" fill="${A}"/>`;
    if (a[0] === 'plate') g += `<circle cx="${f[0]}" cy="${f[1]}" r="7" fill="none" stroke="${A}" stroke-width="3"/>`;
    if (a[0] === 'kb') g += `<circle cx="${f[0].toFixed(1)}" cy="${(f[1] + 7).toFixed(1)}" r="6.5" fill="${A}"/><circle cx="${f[0].toFixed(1)}" cy="${(f[1] + 1).toFixed(1)}" r="3.5" fill="none" stroke="${A}" stroke-width="2"/>`;
    if (a[0] === 'handle') g += ln([f[0], f[1] - 6], [f[0], f[1] + 6], 4, A);
    if (a[0] === 'hexbar') g += ln([f[0] - 16, f[1]], [f[0] + 16, f[1]], 3, A) + `<circle cx="${(f[0] - 16).toFixed(1)}" cy="${f[1].toFixed(1)}" r="9" fill="none" stroke="${A}" stroke-width="3"/><circle cx="${(f[0] + 16).toFixed(1)}" cy="${f[1].toFixed(1)}" r="9" fill="none" stroke="${A}" stroke-width="3"/>`;
    if (a[0] === 'hbar') { const f2 = p[a[2]]; g += ln([f[0] - 22, f[1]], [f2[0] + 22, f2[1]], 3, A) + `<rect x="${(f[0] - 30).toFixed(1)}" y="${(f[1] - 13).toFixed(1)}" width="7" height="26" rx="2" fill="${A}"/><rect x="${(f2[0] + 23).toFixed(1)}" y="${(f2[1] - 13).toFixed(1)}" width="7" height="26" rx="2" fill="${A}"/>`; }
    if (a[0] === 'band') { const f2 = p[a[2]]; g += ln(f, f2, 2.5, A); }
  }
  return g;
}
const svgWrap = inner => `<svg viewBox="0 -14 120 132" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
function loopT(pat, ms) { const [a, h, b] = P[pat].tempo.map(x => x * .8); const tot = a + h + b + .5, s = (ms / 1000) % tot; if (s < a) return s / a; if (s < a + h) return 1; if (s < a + h + b) return 1 - (s - a - h) / b; return 0; }
let lastFrame = 0;
function anim(ms) {
  if (ms - lastFrame > 40 && !document.hidden && !$('pacer').classList.contains('show')) { // the pacer covers the list and draws its own figure
    lastFrame = ms;
    // measure every figure first, then draw: mixing the two forced a full layout per figure, per frame
    const vis = [];
    for (const el of document.querySelectorAll('[data-anim]')) { const r = el.getBoundingClientRect(); if (r.width && r.bottom > 0 && r.top < innerHeight) vis.push(el); }
    for (const el of vis) {
      let pat = el.dataset.anim;
      if (pat.includes('|')) { const [a, b] = pat.split('|'), cyc = P[a].tempo.reduce((x, y) => x + y * .8, 0) + .5, n = Math.floor(ms / 1000 / cyc / 2); pat = n % 2 ? b : a; el.dataset.half = n % 2 ? 'B' : 'A'; }
      if (P[pat]) el.innerHTML = svgWrap(figure(pat, loopT(pat, ms)));
    }
  }
  requestAnimationFrame(anim);
}
requestAnimationFrame(anim);

/* ================= audio / haptics / wake ================= */
let AC = null;
function beep(f = 880, d = .12, v = .25) { try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); const o = AC.createOscillator(), g = AC.createGain(); o.frequency.value = f; g.gain.setValueAtTime(v, AC.currentTime); g.gain.exponentialRampToValueAtTime(.001, AC.currentTime + d); o.connect(g); g.connect(AC.destination); o.start(); o.stop(AC.currentTime + d + .02); } catch (e) { } }
const buzz = p => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) { } };
let wakeLock = null;
async function keepAwake() { if (!S.settings.wake || !('wakeLock' in navigator) || wakeLock || document.hidden) return; try { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => wakeLock = null); } catch (e) { } }

/* ================= header ================= */
function renderHeader() {
  const s = parseDk(curWeek), e = addDays(s, 6);
  $('wkpill').textContent = s.getMonth() === e.getMonth() ? `${fmtD(s)}–${e.getDate()}` : `${fmtD(s)} – ${fmtD(e)}`;
}

/* ================= WORKOUT ================= */
function renderWorkout() {
  if (!DAYS.length) { // a coach who skipped the plan
    for (const id of ['days', 'newweek', 'excount', 'nudge']) if ($(id)) $(id).innerHTML = '';
    $('weekline').textContent = ''; $('dtitle').textContent = 'Workout'; $('ddate').textContent = ''; $('dprog').textContent = ''; $('dbar').style.width = '0%';
    $('list').innerHTML = `<div class="card"><h3>No workout plan yet</h3><div class="muted">Answer a few questions and get a weekly routine built around your goal, your days and your equipment.</div><button class="btn acc" data-buildplan>Build my plan</button></div>`;
    return;
  }
  const today = todayExact();
  $('days').innerHTML = DAYS.map((d, i) => {
    const date = dayDate(curWeek, i);
    return `<button class="${i === cur ? 'on' : ''} ${i === today ? 'today' : ''}" data-day="${i}">${dayDone(curWeek, i) ? '<span class="dot"></span>' : ''}${esc(d.d)}<small>${date.getDate()} · ${esc(String(d.title).split(' ')[0])}</small></button>`;
  }).join('');
  const done = DAYS.filter((_, i) => dayDone(curWeek, i)).length;
  $('weekline').textContent = `This week: ${done} / ${DAYS.length} days complete${isDeload(curWeek) ? ' · 🧘 deload' : ''}`;

  // new week banner
  const lastSeen = localStorage.getItem(LWS());
  const prevKey = dk(addDays(parseDk(curWeek), -7));
  if (lastSeen && lastSeen !== curWeek && S.logs[prevKey]) {
    const st = weekStats(prevKey);
    $('newweek').innerHTML = `<div class="banner">🔄 <b>New week, fresh sheet.</b> Last week (${st.days}/${DAYS.length} days, ${st.sets} sets, ${st.vol.toLocaleString()} ${unit()} moved) is saved in History. <button class="chip" data-dismiss style="margin-top:8px">Got it</button></div>`;
  } else { $('newweek').innerHTML = ''; if (lastSeen !== curWeek) localStorage.setItem(LWS(), curWeek); }

  const D = DAYS[cur], date = dayDate(curWeek, cur);
  $('dtitle').textContent = D.title;
  $('ddate').textContent = fmtD(date, { weekday: 'long', month: 'short', day: 'numeric' });
  if ($('excount')) $('excount').innerHTML = typeof excountHtml === 'function' ? excountHtml() : '';
  let tot = 0, dn = 0;
  $('list').innerHTML = D.slots.map((sl, si) => {
    const ex = exOf(cur, si), id = exId(ex), tl = setsOf(curWeek, cur, id), done = tl.filter(Boolean).length;
    tot += sl.sets; dn += Math.min(done, sl.sets);
    const past = sessions(id).filter(s => !(s.wk === curWeek && s.di === cur)), last = past[past.length - 1];
    const tgt = S.settings.targets[id] ?? '';
    const AS = autoSuggest(sl, last, id), sug = AS.html;
    const ph = sl.time ? 'sec' : (repTop(sl.reps) || 'max');
    const ss = !sl.time && ssParts(ex.n);
    const jl = window.__justLogged && window.__justLogged.split(':').map(Number);
    const rows = Array.from({ length: sl.sets }, (_, i) => {
      const s = tl[i]; const lw = last && last.sets[i] ? last.sets[i].w : '';
      if (ss) {
        const lw2 = last && last.sets[i] && last.sets[i].w2 != null ? last.sets[i].w2 : '', rp = repTop(sl.reps) || 'max';
        return `<div class="set ss ${s ? 'ok' : ''} ${jl && jl[0] === si && jl[1] === i && s ? 'pop' : ''}"><div class="n">${i + 1}</div><div class="ssin">
        <div class="ssl"><span class="sstag">A</span><input inputmode="decimal" data-w="${si}:${i}" value="${esc(s ? s.w : (AS.deload ? AS.w : (tgt !== '' ? tgt : (AS.w !== '' ? AS.w : lw))))}" placeholder="${unit()}"><input inputmode="numeric" data-r="${si}:${i}" value="${esc(s ? s.r : '')}" placeholder="${rp}"></div>
        <div class="ssl"><span class="sstag b">B</span><input inputmode="decimal" data-w2="${si}:${i}" value="${esc(s ? (s.w2 ?? '') : lw2)}" placeholder="${unit()}"><input inputmode="numeric" data-r2="${si}:${i}" value="${esc(s ? (s.r2 ?? '') : '')}" placeholder="${rp}"></div>
        </div><button class="chk" data-chk="${si}:${i}" aria-label="Log set">✓</button></div>`;
      }
      return `<div class="set ${s ? 'ok' : ''} ${jl && jl[0] === si && jl[1] === i && s ? 'pop' : ''}"><div class="n">${i + 1}</div>
      <input inputmode="decimal" data-w="${si}:${i}" value="${esc(s ? s.w : (AS.deload ? AS.w : (tgt !== '' ? tgt : (AS.w !== '' ? AS.w : lw))))}" placeholder="${unit()}">
      <input inputmode="numeric" data-r="${si}:${i}" value="${esc(s ? s.r : '')}" placeholder="${ph}">
      <button class="chk" data-chk="${si}:${i}" aria-label="Log set">✓</button></div>`;
    }).join('');
    const jdone = jl && jl[0] === si && done >= sl.sets;
    return `<div class="card ${done >= sl.sets ? 'done' : ''} ${jdone ? 'justdone' : ''}" style="--i:${si}">
      <div class="top"><div class="info"><div class="num">EXERCISE ${si + 1}${sl.bonus ? ' · BONUS' : ''}${S.settings.swaps[slotKey(cur, si)] ? ' · SWAPPED' : ''}</div>
       <div class="name">${esc(ex.n)}</div>
       <div class="meta"><span><b>${safeN(sl.sets)} × ${esc(sl.reps)}</b></span><span>Rest ${fmtT(prefOf(id).rest || sl.rest)}${prefOf(id).rest ? ' ★' : ''}</span><span>Tempo ${P[ex.pat].tempo.join('-')}</span></div></div>
       <button class="thumb" data-form="${si}"><div data-anim="${ss ? ssPat(ss[0], ex.pat) + '|' + ssPat(ss[1], ex.pat) : ex.pat}"></div><div class="lbl">FORM</div></button></div>
      <div class="chips"><button class="chip acc" data-pace="${si}">▶ ${sl.time ? 'Start timer' : 'Pace set'}</button><button class="chip" data-swap="${si}">↻ Swap</button><button class="chip" data-exhist="${si}">📈 Progress</button>${extraChips(sl, ex, si)}</div>
      <div class="target">🎯 Target <input inputmode="decimal" data-tgt="${si}" value="${esc(tgt)}" placeholder="—"> ${unit()}${sug}</div>
      <div class="sets">${ss ? `<div class="sslegend"><span><b class="sstag">A</b>${esc(ss[0])}</span><span><b class="sstag b">B</b>${esc(ss[1])}</span></div>` : ''}<div class="sethdr ${ss ? 'ss' : ''}"><span>Set</span><span>Weight</span><span>${sl.time ? 'Secs' : 'Reps'}</span><span></span></div>${rows}</div>
      ${last ? `<div class="last">Last time (${fmtD(new Date(last.t), { weekday: 'short', month: 'short', day: 'numeric' })}): ${last.sets.map(s => fmtSet(last.timed, s)).join(', ')}</div>` : ''}
      ${noteHtml(si, id, last)}
    </div>`;
  }).join('');
  window.__justLogged = null;
  if (window.__stagger) { window.__stagger = false; const L = $('list'); L.classList.add('stagger'); clearTimeout(window.__stT); window.__stT = setTimeout(() => L.classList.remove('stagger'), 1200); }
  $('dprog').textContent = `${dn} / ${tot} sets`;
  $('dbar').style.width = (tot ? dn / tot * 100 : 0) + '%';
  renderNudges();
  document.querySelectorAll('textarea.note').forEach(t => { if (t.value) { t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; } });
}

function logSet(si, i, w, r, w2, r2) {
  const ex = exOf(cur, si), timed = !!DAYS[cur].slots[si].time, before = bestOf(exId(ex)), e = ensureEntry(curWeek, cur, ex), fresh = !e.sets[i];
  e.n = ex.n; if (timed) e.timed = true; e.sets[i] = { w: w === '' ? '' : +w, r: +r, t: (e.sets[i] && e.sets[i].t) || Date.now(), ...(e.sets[i] && e.sets[i].rir != null ? { rir: e.sets[i].rir } : {}) }; if (r2 != null) { e.sets[i].w2 = w2 === '' || w2 == null ? '' : +w2; e.sets[i].r2 = +r2; } e.u = Date.now(); save();
  if (fresh) checkPR(ex.n, before, e.sets[i], timed);
}
function unlogSet(si, i) { const e = entry(curWeek, cur, exId(exOf(cur, si))); if (e) { e.sets[i] = null; e.u = Date.now(); save(); } }
function readRow(si, i) {
  const w = document.querySelector(`[data-w="${si}:${i}"]`).value.trim();
  const sl = DAYS[cur].slots[si]; let r = document.querySelector(`[data-r="${si}:${i}"]`).value.trim();
  if (r === '') r = sl.time || repTop(sl.reps) || 0;
  const w2el = document.querySelector(`[data-w2="${si}:${i}"]`); if (!w2el) return { w, r };
  let r2 = document.querySelector(`[data-r2="${si}:${i}"]`).value.trim(); if (r2 === '') r2 = repTop(sl.reps) || r;
  return { w, r, w2: w2el.value.trim(), r2 };
}

function nextSetIdx(si) { const sl = DAYS[cur].slots[si], tl = setsOf(curWeek, cur, exId(exOf(cur, si))); for (let i = 0; i < sl.sets; i++) if (!tl[i]) return i; return -1; }
function afterLog(si) {
  const sl = DAYS[cur].slots[si], ex = exOf(cur, si), more = nextSetIdx(si);
  const nxt = DAYS[cur].slots[si + 1] ? exOf(cur, si + 1).n : null;
  if (more < 0 && !nxt && dayDone(curWeek, cur)) { toast(`🔥 ${DAYS[cur].title} done! Logged for ${fmtD(new Date(), { weekday: 'short', month: 'short', day: 'numeric' })}.`, 3500); }
  startRest(prefOf(exId(ex)).rest || sl.rest, more < 0 ? 'Exercise done · rest' : 'Rest', more < 0 ? (nxt ? 'Next: ' + nxt : 'Last exercise, you\'re finished today 🔥') : `${ex.n} · set ${more + 1} next`);
  if (RT[PROF]) { RT[PROF].exid = exId(ex); RT[PROF].exn = ex.n; }
}

/* ================= rest timer ================= */
const RT = {}; // rest timer per profile, so partner mode can run two at once
let rInt = null, rGoT = null;
function startRest(sec, label, sub) {
  RT[PROF] = { end: Date.now() + sec * 1000, dur: sec, label: label || 'Rest', sub: sub || '', done: false, lastBeep: null };
  clearTimeout(rGoT); ensureRestLoop(); tickRest(); keepAwake();
}
function ensureRestLoop() { if (!rInt) rInt = setInterval(tickRest, 200); }
function tickRest() {
  let any = false;
  for (const p in RT) {
    const r = RT[p]; if (r.done) continue; any = true;
    const left = (r.end - Date.now()) / 1000;
    if (left <= 3.05 && left > 0 && Math.ceil(left) !== r.lastBeep) { r.lastBeep = Math.ceil(left); beep(p === PROF ? 660 : 520, .08, .2); }
    if (left <= 0) {
      r.done = true; beep(990, .35, .35); buzz([200, 100, 200]);
      if (p === PROF) { const el = $('rest'); el.classList.add('go'); $('rt').textContent = 'GO'; $('rlab').textContent = 'Next set!'; clearTimeout(rGoT); rGoT = setTimeout(() => { if (!RT[PROF] || RT[PROF].done) el.classList.remove('show'); restChip(); }, 5000); }
      else toast(`${PROFILES[p].name}: rest is up, GO! 💪`, 3000);
    }
  }
  const r = RT[PROF], el = $('rest');
  if (r && !r.done) {
    const left = (r.end - Date.now()) / 1000;
    el.classList.add('show'); el.classList.remove('go');
    $('rt').textContent = fmtT(Math.ceil(Math.max(0, left)));
    $('rpb').style.width = Math.max(0, Math.min(100, (1 - left / r.dur) * 100)) + '%';
    $('rlab').textContent = r.label; $('rsub').textContent = r.sub;
  }
  restChip();
  if (!any) { clearInterval(rInt); rInt = null; }
}
function restChip() {
  const chip = $('rother'); if (!chip) return;
  const op = Object.keys(RT).find(p => p !== PROF && !RT[p].done);
  if (!op) { chip.classList.add('hide'); return; }
  chip.classList.remove('hide'); chip.dataset.prof = op;
  chip.classList.toggle('up', $('rest').classList.contains('show'));
  chip.style.setProperty('--c', PROFILES[op].th.acc);
  chip.textContent = `${PROFILES[op].name} · rest ${fmtT(Math.ceil(Math.max(0, (RT[op].end - Date.now()) / 1000)))}`;
}
function showRestFor() { const r = RT[PROF], el = $('rest'); el.classList.remove('go'); if (r && !r.done) { ensureRestLoop(); tickRest(); } else el.classList.remove('show'); restChip(); }
$('rminus').onclick = () => { const r = RT[PROF]; if (!r) return; r.end -= 15000; r.dur = Math.max(1, r.dur - 15); tickRest(); };
$('rplus').onclick = () => { const r = RT[PROF]; if (!r) return; r.end += 15000; r.dur += 15; tickRest(); };
$('rskip').onclick = () => { if (RT[PROF]) RT[PROF].done = true; $('rest').classList.remove('show'); restChip(); };

/* ================= sheets ================= */
function openSheet(html) { $('sheetin').innerHTML = html; $('ov').classList.add('show'); $('sheet').classList.add('show'); $('sheet').scrollTop = 0; }
function closeSheet() { $('ov').classList.remove('show'); $('sheet').classList.remove('show'); setTimeout(() => { if (!$('sheet').classList.contains('show')) $('sheetin').innerHTML = ''; }, 520); } // wait out the .5s slide, or the sheet empties while still on screen
$('ov').onclick = closeSheet; $('sx').onclick = closeSheet;

function formSheet(si) {
  const ex = exOf(cur, si), pt = P[ex.pat];
  openSheet(`<h3>${esc(ex.n)}</h3><div class="sub">Form guide · the figure moves at the rep tempo</div><div class="bigfig" data-anim="${ex.pat}"></div><ul class="cues">${ex.cues.map(c => `<li>${esc(c)}</li>`).join('')}</ul><div class="tempo">Tempo ${pt.tempo.join('-')}: ${pt.ph[0]} ${pt.tempo[0]}s${pt.tempo[1] ? ` · ${pt.ph[1]} ${pt.tempo[1]}s` : ''} · ${pt.ph[2]} ${pt.tempo[2]}s</div>`);
}
function lineChart(pts, opts = {}) {
  // pts: [{x:Date ms, y:number, label}]
  if (!pts.length) return '';
  const W = 320, H = 150, L = 34, R = 10, T = 22, Bm = 22;
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  let x0 = Math.min(...xs), x1 = Math.max(...xs); if (x0 === x1) { x0 -= 864e5; x1 += 864e5; }
  let y0 = Math.min(...ys), y1 = Math.max(...ys); const padY = (y1 - y0) * .15 || 2; y0 -= padY; y1 += padY;
  const X = x => L + (x - x0) / (x1 - x0) * (W - L - R), Y = y => T + (1 - (y - y0) / (y1 - y0)) * (H - T - Bm);
  const poly = pts.map(p => `${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join(' ');
  const grid = [y0 + padY, (y0 + y1) / 2, y1 - padY].map(v => `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="${TH.line}"/><text x="${L - 4}" y="${Y(v) + 3}" fill="${TH.mut}" font-size="9" text-anchor="end">${Math.round(v * 10) / 10}</text>`).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}">${grid}
    <text x="${L}" y="14" fill="${TH.mut}" font-size="10">${esc(opts.title || '')}</text>
    <text x="${L}" y="${H - 6}" fill="${TH.mut}" font-size="9">${fmtD(new Date(xs[0]))}</text>
    <text x="${W - R}" y="${H - 6}" fill="${TH.mut}" font-size="9" text-anchor="end">${fmtD(new Date(xs[xs.length - 1]))}</text>
    <polyline points="${poly}" fill="none" stroke="${TH.acc}" stroke-width="2.5" stroke-linejoin="round"/>
    ${pts.length < 40 ? pts.map(p => `<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="3" fill="${TH.txt}"/>`).join('') : ''}</svg>`;
}
function exHistSheet(si) {
  const ex = exOf(cur, si), id = exId(ex), h = sessions(id);
  let body = '<div class="muted" style="padding:30px 0;text-align:center">Nothing logged yet. Tick off some sets and your progress shows up here.</div>';
  if (h.length) {
    const timed = h.some(x => x.timed), pts = h.map(x => ({ x: x.t, y: Math.max(...x.sets.map(s => timed ? +s.r || 0 : +s.w || 0)) }));
    const best = Math.max(...pts.map(p => p.y)), first = pts[0].y;
    body = `<div class="stats"><div class="stat"><b>${best}</b><span>Best ${timed ? 'secs' : unit()}</span></div><div class="stat"><b class="${best > first ? 'up' : ''}">${best - first >= 0 ? '+' : ''}${best - first}</b><span>Since start</span></div><div class="stat"><b>${h.length}</b><span>Sessions</span></div></div>` +
      lineChart(pts, { title: timed ? 'Longest set each session (sec)' : 'Heaviest set each session' }) +
      (!timed && pts.some(p => p.y) ? (() => { const ep = h.map(x => ({ x: x.t, y: Math.round(Math.max(...x.sets.map(s => e1rm(+s.w || 0, +s.r || 0)))) })).filter(p => p.y); return ep.length ? `<div class="e1note">Estimated 1-rep max <b>${ep[ep.length - 1].y} ${unit()}</b> <span>best ${Math.max(...ep.map(p => p.y))}</span></div>` + lineChart(ep, { title: 'Estimated 1-rep max (from your best set each session)' }) : ''; })() : '') +
      `<div style="margin-top:8px">` + h.slice().reverse().slice(0, 15).map(x => `<div class="hrow"><span>${fmtD(new Date(x.t), { weekday: 'short', month: 'short', day: 'numeric', year: '2-digit' })}</span><b>${x.sets.map(s => fmtSet(x.timed, s)).join(' · ')}</b></div>`).join('') + `</div>`;
  }
  openSheet(`<h3>${esc(ex.n)}</h3><div class="sub">Weight progress over time</div>${body}`);
}

/* ================= rep pacer ================= */
let PC = null;
function openPacer(si) {
  const i = nextSetIdx(si), sl = DAYS[cur].slots[si], ex = exOf(cur, si);
  if (i < 0) { openSheet(`<h3>All sets done 💪</h3><div class="sub">Untick a set if you want to redo it.</div>`); return; }
  beep(1, .01, .001); keepAwake();
  S.settings.tempoScale = prefOf(exId(ex)).tempo || 1;
  PC = { si, i, sl, ex, pat: ex.pat, target: sl.time ? 0 : repTop(sl.reps), time: sl.time || 0, reps: 0, start: performance.now() + 3000, paused: false, pauseAt: 0, last: '', done: false };
  const w = document.querySelector(`[data-w="${si}:${i}"]`).value.trim();
  $('pn').textContent = `Set ${i + 1} of ${sl.sets} · ${w ? w + ' ' + unit() : 'Bodyweight'}`;
  $('ptitle').textContent = ex.n; $('ppause').textContent = 'Pause'; updTempo();
  $('pacer').classList.add('show'); requestAnimationFrame(pace);
}
function updTempo() { if (!PC) return; $('tval').textContent = PC.time ? '—' : P[PC.pat].tempo.map(x => +(x * S.settings.tempoScale).toFixed(1)).join('-'); }
function pace(nowMs) {
  if (!PC || PC.done) return;
  if (PC.paused) { requestAnimationFrame(pace); return; }
  const el = $('pphase'), pb = $('ppb'), fig = $('pfig'), rp = $('preps');
  const tgtTxt = PC.time ? ' <small>sec</small>' : (PC.target ? `<small> / ${PC.target}</small>` : '<small> reps</small>');
  const e = (nowMs - PC.start) / 1000;
  if (e < 0) {
    const c = Math.ceil(-e); el.className = 'phase'; el.textContent = 'Get ready · ' + c; pb.style.width = ((3 + e) / 3 * 100) + '%';
    fig.innerHTML = svgWrap(figure(PC.pat, 0)); rp.innerHTML = (PC.time || 0) + tgtTxt;
    if (PC.last !== 'c' + c) { PC.last = 'c' + c; beep(520, .08, .2); pvSay(String(c), true); }
    requestAnimationFrame(pace); return;
  }
  if (PC.time) {
    const left = PC.time - e; fig.innerHTML = svgWrap(figure(PC.pat, loopT(PC.pat, e * 1000)));
    el.className = 'phase hold'; el.textContent = 'HOLD STRONG'; pb.style.width = (e / PC.time * 100) + '%'; rp.innerHTML = Math.ceil(Math.max(0, left)) + tgtTxt;
    if (PC.lastSay !== 'go') { PC.lastSay = 'go'; pvSay('Hold', true); }
    const lc = Math.ceil(left); if ([30, 20, 10].includes(lc) && PC.lastSay !== 'v' + lc && PC.time > lc) { PC.lastSay = 'v' + lc; pvSay(lc + ' seconds'); }
    if (left <= 3 && left > 0 && PC.last !== 't' + Math.ceil(left)) { PC.last = 't' + Math.ceil(left); beep(660, .08, .2); pvSay(String(Math.ceil(left)), true); }
    if (left <= 0) { PC.reps = PC.time; finishPace(); return; }
    requestAnimationFrame(pace); return;
  }
  const [a, h, b] = P[PC.pat].tempo.map(x => x * S.settings.tempoScale), cyc = a + h + b, rep = Math.floor(e / cyc), s = e - rep * cyc;
  if (PC.target && rep >= PC.target) { PC.reps = PC.target; finishPace(); return; }
  PC.reps = rep; let t, ph, cls, frac;
  if (s < a) { t = s / a; ph = P[PC.pat].ph[0]; cls = 'phase'; frac = s / a; }
  else if (s < a + h) { t = 1; ph = P[PC.pat].ph[1]; cls = 'phase hold'; frac = (s - a) / h; }
  else { t = 1 - (s - a - h) / b; ph = P[PC.pat].ph[2]; cls = 'phase up'; frac = (s - a - h) / b; }
  const key = rep + ph; if (PC.last !== key) { PC.last = key; if (ph === P[PC.pat].ph[0]) beep(880, .1, .25); else beep(cls === 'phase hold' ? 600 : 740, .07, .18); pvRep(rep, ph, cls); }
  el.className = cls; el.textContent = ph.toUpperCase(); pb.style.width = (frac * 100) + '%';
  fig.innerHTML = svgWrap(figure(PC.pat, t)); rp.innerHTML = rep + tgtTxt;
  requestAnimationFrame(pace);
}

/* ================= voice coach (rep pacer only) ================= */
const pvOn = () => localStorage.getItem('gymp.pacerVoice') === '1';
let pvVoice = null;
function pvPick() {
  if (!('speechSynthesis' in window)) return null;
  const vs = speechSynthesis.getVoices().filter(v => /^en/i.test(v.lang)); if (!vs.length) return null;
  return vs.find(v => /Samantha|Daniel|Karen|Moira|Google US English|Google UK English Female/i.test(v.name)) || vs.find(v => v.localService) || vs[0];
}
if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = () => { pvVoice = pvPick(); };
function pvSay(text, cut) {
  if (!pvOn() || !('speechSynthesis' in window) || !text) return;
  try {
    if (cut) speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text); pvVoice = pvVoice || pvPick(); if (pvVoice) u.voice = pvVoice;
    u.rate = 1.08; u.pitch = 1; u.volume = 1; speechSynthesis.speak(u);
  } catch (e) { }
}
function pvStop() { try { if ('speechSynthesis' in window) speechSynthesis.cancel(); } catch (e) { } }
function pvRep(rep, ph, cls) {
  if (!pvOn() || !PC) return;
  const P0 = P[PC.pat].ph;
  if (ph === P0[0]) {
    if (rep === 0) return pvSay(ph, true);
    const left = PC.target ? PC.target - rep : null;
    pvSay(left === 1 ? `${rep}. Last one` : String(rep), true);
  } else if (cls === 'phase up' && P0[2] && rep === 0) pvSay(P0[2]);
}
function pvPaint() { const b = $('pvoice'); if (!b) return; const on = pvOn(); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); b.innerHTML = on ? '🔊 Voice on' : '🔈 Voice off'; }
$('pvoice').onclick = () => { localStorage.setItem('gymp.pacerVoice', pvOn() ? '0' : '1'); pvPaint(); if (pvOn()) { pvVoice = pvPick(); pvSay("Voice coach on. I'll count your reps.", true); } else pvStop(); };
pvPaint();
function finishPace() {
  if (!PC) return; PC.done = true; const { si, i } = PC; let reps = PC.reps;
  if (PC.time && !reps) reps = Math.max(0, Math.round((performance.now() - PC.start) / 1000));
  $('pacer').classList.remove('show'); beep(990, .25, .3); buzz(150); if (reps > 0) pvSay(PC.time ? 'Done. Nice hold.' : 'Done. ' + reps + ' reps.', true);
  const w = (document.querySelector(`[data-w="${si}:${i}"]`) || {}).value || '';
  const w2el = document.querySelector(`[data-w2="${si}:${i}"]`), r2el = document.querySelector(`[data-r2="${si}:${i}"]`);
  if (reps > 0) { window.__justLogged = si + ':' + i; logSet(si, i, w.trim(), reps, w2el ? w2el.value.trim() : undefined, w2el ? (r2el.value.trim() || reps) : undefined); renderWorkout(); afterLog(si); }
  PC = null;
}
$('pdone').onclick = finishPace;
$('pcancel').onclick = () => { if (PC) { PC.done = true; PC = null; } $('pacer').classList.remove('show'); pvStop(); };
$('ppause').onclick = e => { if (!PC) return; if (!PC.paused) { PC.paused = true; PC.pauseAt = performance.now(); e.target.textContent = 'Resume'; pvStop(); } else { PC.start += performance.now() - PC.pauseAt; PC.paused = false; e.target.textContent = 'Pause'; } };
function scaleTempo(f) { if (!PC) return; const n = performance.now(), el = n - PC.start, ns = Math.max(.5, Math.min(2, S.settings.tempoScale * f)); if (el > 0) PC.start = n - el * (ns / S.settings.tempoScale); S.settings.tempoScale = ns; setPref(exId(PC.ex), PC.ex.n, 'tempo', ns); touchSettings(); updTempo(); }
$('tslow').onclick = () => scaleTempo(1.25);
$('tfast').onclick = () => scaleTempo(.8);

/* ================= HISTORY ================= */
function weekStats(wk) {
  let sets = 0, vol = 0, days = 0; const W = S.logs[wk] || {};
  for (const di in W) { let any = false; for (const id in W[di]) for (const s of (W[di][id].sets || [])) if (s) { sets++; vol += (+s.w || 0) * (+s.r || 0) + (+s.w2 || 0) * (+s.r2 || 0); any = true; } if (any) days++; }
  return { sets, vol: Math.round(vol), days };
}
function renderWeeks() {
  const weeks = Object.keys(S.logs).filter(wk => weekStats(wk).sets > 0).sort().reverse();
  const totalSets = weeks.reduce((a, w) => a + weekStats(w).sets, 0);
  let h = `<div class="dayhead"><div><h2>History</h2><div class="sub">${weeks.length} week${weeks.length === 1 ? '' : 's'} logged · ${totalSets} sets total</div></div></div>`;
  if (!weeks.length) h += `<div class="card muted">Nothing here yet. Each week you train gets saved here automatically, and a fresh week starts every Monday.</div>`;
  h += weeks.map((wk, idx) => {
    const st = weekStats(wk), s = parseDk(wk), e = addDays(s, 6), W = S.logs[wk];
    const bw = Object.keys(S.body).filter(d => !S.body[d].del && d >= wk && d <= dk(e)).map(d => +S.body[d].w).filter(Boolean);
    const days = Object.keys(W).map(Number).sort((a, b) => a - b).map(di => {
      const exs = Object.values(W[di]).filter(x => (x.sets || []).some(Boolean)); if (!exs.length) return '';
      const ts = exs.flatMap(x => x.sets.filter(Boolean).map(s => s.t)).filter(Boolean);
      const when = ts.length ? fmtD(new Date(Math.min(...ts)), { weekday: 'short', month: 'short', day: 'numeric' }) : '';
      return `<div class="wday"><div class="dh">${DAYS[di] ? DAYS[di].d + ' · ' + DAYS[di].title : 'Day ' + (di + 1)} <span>· done ${when}</span></div>` +
        exs.map(x => `<div class="wex"><b>${esc(x.n)}</b><span>${x.sets.filter(Boolean).map(s => fmtSet(x.timed, s)).join(', ')}</span></div>`).join('') + `</div>`;
    }).join('');
    return `<div class="wk ${idx === 0 ? 'open' : ''}"><button data-wk>
      <div class="wt"><b>${wk === curWeek ? 'This week' : 'Week of ' + fmtD(s, { month: 'short', day: 'numeric', year: 'numeric' })}</b><span>${fmtD(s)} – ${fmtD(e)} · ${st.sets} sets · ${st.vol.toLocaleString()} ${unit()}${bw.length ? ` · BW ${(bw.reduce((a, b) => a + b, 0) / bw.length).toFixed(1)}` : ''}</span></div>
      <div class="dots">${DAYS.map((_, i) => `<i class="${dayAny(wk, i) ? 'on' : ''}"></i>`).join('')}</div></button>
      <div class="body">${days}</div></div>`;
  }).join('');
  $('histBody').innerHTML = h;
}

/* ================= BODY ================= */
const POSES = ['front', 'side', 'back'];
const bodyList = () => Object.keys(S.body).filter(d => !S.body[d].del && S.body[d].w !== '' && S.body[d].w != null).sort();
const photoMeta = (m, p) => { const x = (S.photos[m] || {})[p]; return x && !x.del ? x : null; };
async function renderBody() {
  const list = bodyList(), today = dk(new Date()), mk = monthKey(new Date());
  const pts = list.map(d => ({ x: parseDk(d).getTime(), y: +S.body[d].w }));
  const last = pts[pts.length - 1], first = pts[0];
  const ago30 = (() => { const cut = Date.now() - 30 * 864e5; const p = pts.filter(p => p.x <= cut).pop(); return p; })();
  const dlt = (a, b) => (a && b) ? (Math.round((a.y - b.y) * 10) / 10) : null;
  const sg = v => v == null ? '—' : (v > 0 ? '+' : '') + v;
  const te = S.body[today] && !S.body[today].del ? S.body[today] : {};
  const haveThisMonth = POSES.some(p => photoMeta(mk, p));
  let h = `<div class="dayhead"><div><h2>Body</h2><div class="sub">Bodyweight, measurements and monthly photos</div></div></div>`;
  if (!haveThisMonth) h += `<div class="banner">📸 <b>${fmtMonth(mk)} check-in is due.</b> Add your front, side and back photos below. Same spot, same lighting and same time of day each month makes the comparison honest.</div>`;
  h += `<div class="card"><h3>Log body stats</h3>
    <div class="grid2"><label class="fld">Date<input type="date" id="bDate" value="${today}" max="${today}"></label>
    <label class="fld">Weight (${unit()})<input id="bW" inputmode="decimal" value="${esc(te.w ?? '')}" placeholder="e.g. 175"></label>
    <label class="fld">Waist (in)<input id="bWaist" inputmode="decimal" value="${esc(te.waist ?? '')}" placeholder="optional"></label>
    <label class="fld">Body fat %<input id="bBf" inputmode="decimal" value="${esc(te.bf ?? '')}" placeholder="optional"></label>
    <label class="fld">Chest (in)<input id="bChest" inputmode="decimal" value="${esc(te.chest ?? '')}" placeholder="optional"></label>
    <label class="fld">Arms (in)<input id="bArms" inputmode="decimal" value="${esc(te.arms ?? '')}" placeholder="optional"></label>
    <label class="fld">Thighs (in)<input id="bThighs" inputmode="decimal" value="${esc(te.thighs ?? '')}" placeholder="optional"></label>
    <label class="fld">Hips / glutes (in)<input id="bHips" inputmode="decimal" value="${esc(te.hips ?? '')}" placeholder="optional"></label></div>
    <label class="fld" style="margin-top:10px">Note<input id="bNote" value="${esc(te.note ?? '')}" placeholder="optional, e.g. felt strong, slept bad"></label>
    <button class="btn acc" id="bSave">Save</button></div>`;
  h += `<div class="card"><h3>Weight trend</h3>
    <div class="stats"><div class="stat"><b>${last ? last.y : '—'}</b><span>Current ${unit()}</span></div><div class="stat"><b>${sg(dlt(last, ago30))}</b><span>30 days</span></div><div class="stat"><b>${sg(dlt(last, first))}</b><span>Since start</span></div></div>
    ${pts.length ? lineChart(pts, { title: `Bodyweight (${unit()})` }) : '<div class="muted">Log your weight a few times a week (same time, ideally in the morning) to see a trend.</div>'}
    ${list.length ? `<div style="margin-top:8px">${list.slice().reverse().slice(0, 12).map(d => { const b = S.body[d]; return `<div class="hrow"><span>${fmtD(parseDk(d), { weekday: 'short', month: 'short', day: 'numeric', year: '2-digit' })}</span><b>${b.w} ${unit()}${b.waist ? ` · W ${b.waist}"` : ''}${b.hips ? ` · H ${b.hips}"` : ''}${b.bf ? ` · ${b.bf}%` : ''}</b><button class="x" data-bdel="${d}">✕</button></div>${b.note ? `<div class="muted" style="font-size:12px;margin:-4px 0 6px 2px">${esc(b.note)}</div>` : ''}`; }).join('')}${list.length > 12 ? `<div class="muted" style="font-size:12px;padding-top:6px">+ ${list.length - 12} older entries (all included in export)</div>` : ''}</div>` : ''}
  </div>`;
  h += measureCard();
  // photos
  const months = Object.keys(S.photos).filter(m => POSES.some(p => photoMeta(m, p))).sort().reverse();
  const avgW = m => { const ws = list.filter(d => d.startsWith(m)).map(d => +S.body[d].w); return ws.length ? (ws.reduce((a, b) => a + b, 0) / ws.length).toFixed(1) + ' ' + unit() : ''; };
  h += `<div class="card"><h3>Monthly photo check-in</h3><div class="muted" style="margin-bottom:10px">${fmtMonth(mk)}: tap a slot to add or replace a photo.</div>
    <div class="poses">${POSES.map(p => slotHtml(mk, p, true)).join('')}</div>`;
  if (months.length > 1) {
    const a = months[months.length - 1], b = months[0];
    h += `<h3 style="margin-top:16px">Compare</h3><div class="grid2"><label class="fld">From<select id="cA">${months.map(m => `<option value="${m}" ${m === a ? 'selected' : ''}>${fmtMonth(m)}</option>`).join('')}</select></label><label class="fld">To<select id="cB">${months.map(m => `<option value="${m}" ${m === b ? 'selected' : ''}>${fmtMonth(m)}</option>`).join('')}</select></label></div>
      <div class="chips"><button class="chip ${cmpMode === 'side' ? 'on' : ''}" data-cmpmode="side">Side by side</button><button class="chip ${cmpMode === 'slider' ? 'on' : ''}" data-cmpmode="slider">⟷ Slider</button></div><div class="chips" id="cPose">${POSES.map((p, i) => `<button class="chip ${i === 0 ? 'on' : ''}" data-cpose="${p}">${p[0].toUpperCase() + p.slice(1)}</button>`).join('')}</div><div class="cmp" id="cmp"></div>`;
  }
  h += months.filter(m => m !== mk).map(m => `<div class="month"><div class="mh">${fmtMonth(m)}<span>${avgW(m)}</span></div><div class="poses">${POSES.map(p => slotHtml(m, p, false)).join('')}</div></div>`).join('');
  h += `</div>`;
  $('body').innerHTML = h;
  hydratePhotos();
  if (months.length > 1) renderCompare();
}
function slotHtml(m, p, editable) {
  const meta = photoMeta(m, p);
  const lbl = p[0].toUpperCase() + p.slice(1);
  if (meta) return `<button class="pslot has" data-photo="${m}|${p}"><img data-img="${m}|${p}" alt=""><span class="pl">${lbl}</span></button>`;
  if (!editable) return `<div class="pslot"><span>${lbl}</span><span style="font-size:10px">—</span></div>`;
  return `<button class="pslot" data-addphoto="${m}|${p}"><span class="plus">＋</span><span>${lbl}</span></button>`;
}
let cmpPose = 'front';
async function hydratePhotos() {
  for (const img of document.querySelectorAll('img[data-img]')) {
    const [m, p] = img.dataset.img.split('|'); const url = await photoURL(m, p); if (url) img.src = url;
  }
}
function photoSheet(m, p) {
  photoURL(m, p).then(url => {
    const b = S.body; const ws = Object.keys(b).filter(d => d.startsWith(m) && !b[d].del && b[d].w).map(d => +b[d].w);
    openSheet(`<h3>${fmtMonth(m)} · ${p}</h3><div class="sub">${ws.length ? 'Avg bodyweight that month: ' + (ws.reduce((x, y) => x + y, 0) / ws.length).toFixed(1) + ' ' + unit() : 'No bodyweight logged that month'}</div>
      ${url ? `<img class="bigimg" src="${url}">` : '<div class="muted">Photo is still downloading. Try again in a moment.</div>'}
      <div class="grid2"><button class="btn" data-addphoto="${m}|${p}">Replace</button><button class="btn ghost" data-pdel="${m}|${p}" style="color:var(--acc2)">Delete</button></div>`);
  });
}

/* ---- photo storage: IndexedDB locally, Supabase Storage in the cloud ---- */
let idbP = null;
function idb() { return idbP = idbP || new Promise((res, rej) => { const r = indexedDB.open('gymp-photos', 1); r.onupgradeneeded = () => r.result.createObjectStore('photos'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
async function idbRaw(k) { const db = await idb(); return new Promise(r => { const q = db.transaction('photos').objectStore('photos').get(k); q.onsuccess = () => r(q.result || null); q.onerror = () => r(null); }); }
async function idbGetP(prof, k) { return idbRaw(uid() + ':' + k); }
async function idbGet(k) { return idbGetP(PROF, k); }
async function idbClearProfile() { const db = await idb(); return new Promise(r => { const t = db.transaction('photos', 'readwrite'), st = t.objectStore('photos'); const q = st.openCursor(); q.onsuccess = () => { const c = q.result; if (c) { if (String(c.key).startsWith(uid() + ':')) c.delete(); c.continue(); } }; t.oncomplete = () => r(); t.onerror = () => r(); }); }
async function idbPut(k, v) { const db = await idb(); return new Promise((r, j) => { const t = db.transaction('photos', 'readwrite'); t.objectStore('photos').put(v, uid() + ':' + k); t.oncomplete = () => r(); t.onerror = () => j(t.error); }); }
async function idbDel(k) { const db = await idb(); return new Promise(r => { const t = db.transaction('photos', 'readwrite'); t.objectStore('photos').delete(uid() + ':' + k); t.oncomplete = () => r(); t.onerror = () => r(); }); }
const urlCache = {};
async function photoBlob(m, p) {
  const meta = photoMeta(m, p); if (!meta) return null;
  const k = `${m}-${p}-${meta.u}`; let blob = await idbGet(k);
  if (!blob && sb && session && meta.path && meta.up) {
    try { const { data, error } = await sb.storage.from(BUCKET).download(meta.path); if (!error && data) { blob = data; await idbPut(k, blob); } } catch (e) { }
  }
  return blob;
}
async function photoURL(m, p) {
  const meta = photoMeta(m, p); if (!meta) return null; const k = `${PROF}:${m}-${p}-${meta.u}`;
  if (urlCache[k]) return urlCache[k];
  const b = await photoBlob(m, p); if (!b) return null; return urlCache[k] = URL.createObjectURL(b);
}
async function compressImage(file) {
  let bmp; try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) {
    bmp = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); });
  }
  const max = 1440, sc = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise(r => c.toBlob(r, 'image/jpeg', .85));
}
let pendingPhoto = null;
$('photoInput').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f || !pendingPhoto) return;
  const [m, p] = pendingPhoto; pendingPhoto = null; savePhotoBlob(m, p, f); // shared with the ghost camera (extras.js)
});
async function deletePhoto(m, p) {
  const meta = photoMeta(m, p); if (!meta) return;
  await idbDel(`${m}-${p}-${meta.u}`);
  S.photos[m][p] = { del: true, u: Date.now(), oldPath: meta.path || null }; save(); closeSheet(); renderBody(); toast('Photo deleted');
}

/* ================= MORE (account, export, settings) ================= */
let deferredInstall = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; if (!appOff() && tab === 'more') renderMore(); });
function renderMore() {
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone, nm = ME.display_name || ME.username;
  let h = `<div class="dayhead"><div><h2>More</h2><div class="sub">Account, backups and settings</div></div></div>`;
  h += `<div class="card"><div class="hello" style="margin:0 0 10px"><div class="lv-av">${esc(initials(nm))}</div><div><b>${esc(nm)}</b><span>@${esc(ME.username)}${ME.role === 'trainer' ? ' · Coach' : ''}</span></div></div>
    <div class="muted">${esc(session.user.email || '')}<br>${lastSync ? 'Last synced ' + new Date(lastSync).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Not synced yet'}</div>
    <div class="grid2"><button class="btn acc" id="syncNow">Sync now</button><button class="btn" id="signOut">Sign out</button></div></div>`;
  // export
  h += `<div class="card"><h3>Export &amp; backup</h3><div class="muted">Download everything you've ever logged. The full backup can be imported back in on any phone.</div>
    <button class="btn acc" data-exp="json">⬇ Full backup (.json)</button>
    <div class="grid2"><button class="btn" data-exp="sets">Workouts (.csv)</button><button class="btn" data-exp="body">Body log (.csv)</button></div>
    <button class="btn" data-exp="fuel">Fuel log (.csv)</button>
    <button class="btn" data-exp="photos">Progress photos (.zip)</button>
    <button class="btn ghost" id="impBtn">⬆ Import a backup</button></div>`;
  // settings
  h += `<div class="card"><h3>Settings</h3>
    <div class="hrow"><span>Appearance</span><div class="row">${[['light', 'Light'], ['dark', 'Dark'], ['auto', 'Auto']].map(([k, l]) => `<button class="chip ${appearance === k ? 'on' : ''}" data-appear="${k}">${l}</button>`).join('')}</div></div>
    <div class="hrow"><span>Weight unit</span><div class="row"><button class="chip ${unit() === 'lb' ? 'on' : ''}" data-unit="lb">LB</button><button class="chip ${unit() === 'kg' ? 'on' : ''}" data-unit="kg">KG</button></div></div>
    <div class="hrow"><span>☕ Caffeine: keep the screen awake while the app is open${cafState === 'video' ? ' <small class="muted">(backup mode)</small>' : cafState === 'failed' ? ' <small class="muted">(not supported here)</small>' : ''}</span><button class="chip ${cafOn() ? 'on' : ''}" id="wakeT">${cafOn() ? 'On' : 'Off'}</button></div>
    <div class="hrow"><span>Rep pacer speed</span><div class="row"><b>${Math.round(100 / S.settings.tempoScale)}%</b><button class="chip" id="tReset">Reset</button></div></div>
    <div class="hrow"><span>Reset all swaps to your originals</span><button class="chip" id="swReset">Reset</button></div></div>`;
  h += moreExtras();
  if (!standalone) h += `<div class="card"><h3>Install on your phone</h3>${deferredInstall ? `<button class="btn acc" id="instBtn">Add to Home Screen</button>` : `<div class="muted"><b>iPhone:</b> Safari → Share button → <i>Add to Home Screen</i>.<br><b>Android:</b> Chrome → ⋮ menu → <i>Install app</i>.<br>It then opens full screen like a normal app and works offline at the gym.</div>`}</div>`;
  h += `<div class="foot">Gym Routine · data stays yours. Local data: ${(JSON.stringify(S).length / 1024).toFixed(0)} KB<br><button class="chip" id="wipe" style="margin-top:10px;color:var(--acc2)">Clear data on this phone</button></div>`;
  $('more').innerHTML = h;
}

function download(name, blob) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
}
const csvCell = v => { v = String(v ?? ''); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
const csv = rows => rows.map(r => r.map(csvCell).join(',')).join('\n');
const stamp = () => dk(new Date());
let JSZipP = null;
const loadJSZip = () => JSZipP = JSZipP || new Promise((res, rej) => { if (window.JSZip) return res(window.JSZip); const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'; s.onload = () => res(window.JSZip); s.onerror = () => { JSZipP = null; rej(); }; document.head.appendChild(s); });
async function doExport(kind) {
  if (kind === 'json') { download(`gym-${ME.username}-backup-${stamp()}.json`, new Blob([JSON.stringify({ exported: new Date().toISOString(), app: 'gym-routine', username: ME.username, ...S }, null, 1)], { type: 'application/json' })); }
  if (kind === 'sets') {
    const rows = [['week_start', 'routine_day', 'date', 'time', 'exercise', 'set', 'weight', 'unit', 'reps_or_secs', 'weight_b', 'reps_b']];
    for (const wk of Object.keys(S.logs).sort()) for (const di of Object.keys(S.logs[wk]).sort()) for (const id in S.logs[wk][di]) {
      const e = S.logs[wk][di][id]; (e.sets || []).forEach((s, i) => { if (!s) return; const d = new Date(s.t || parseDk(wk)); rows.push([wk, DAYS[di] ? DAYS[di].d + ' ' + DAYS[di].title : di, dk(d), d.toTimeString().slice(0, 5), e.n, i + 1, s.w, unit(), s.r, s.w2 ?? '', s.r2 ?? '']); });
    }
    download(`gym-${ME.username}-workouts-${stamp()}.csv`, new Blob([csv(rows)], { type: 'text/csv' }));
  }
  if (kind === 'body') {
    const rows = [['date', 'weight', 'unit', 'waist_in', 'chest_in', 'arms_in', 'thighs_in', 'hips_in', 'body_fat_pct', 'note']];
    for (const d of Object.keys(S.body).sort()) { const b = S.body[d]; if (b.del) continue; rows.push([d, b.w, unit(), b.waist, b.chest, b.arms, b.thighs, b.hips, b.bf, b.note]); }
    download(`gym-${ME.username}-body-${stamp()}.csv`, new Blob([csv(rows)], { type: 'text/csv' }));
  }
  if (kind === 'fuel') {
    const rows = [['date', 'calories', 'protein_g', 'water_glasses', 'steps', 'extra_cardio_min']];
    for (const d of Object.keys(S.fuel || {}).sort()) { const f = S.fuel[d]; rows.push([d, f.cal, f.protein, f.water, f.steps, f.cardio]); }
    download(`gym-${ME.username}-fuel-${stamp()}.csv`, new Blob([csv(rows)], { type: 'text/csv' }));
  }
  if (kind === 'photos') {
    const list = []; for (const m in S.photos) for (const p of POSES) if (photoMeta(m, p)) list.push([m, p]);
    if (!list.length) return toast('No photos yet');
    toast('Packing photos…', 6000);
    try {
      const JSZip = await loadJSZip(); const z = new JSZip();
      for (const [m, p] of list) { const b = await photoBlob(m, p); if (b) z.file(`${m}-${p}.jpg`, b); }
      download(`gym-${ME.username}-photos-${stamp()}.zip`, await z.generateAsync({ type: 'blob' })); toast('Photos exported');
    } catch (e) { toast('Need internet once to build the zip. Try again online.'); }
  }
}
$('importInput').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try {
    const d = JSON.parse(await f.text()); if (!d || !(d.v === 2 || d.v === 3) || !d.logs) throw 0;
    S = merge(S, d); save(); renderAll(); toast('✅ Backup imported and merged');
  } catch (err) { toast('That file isn\'t a Gym backup'); }
});

/* ================= cloud sync (Supabase) ================= */
const BUCKET = 'app-photos';
let syncT = null, lastSync = 0, syncing = false, syncAgain = false;
function setSync(state, text) { const el = $('sync'); el.className = 'sync ' + state; el.querySelector('span').textContent = text; }
function scheduleSync() { clearTimeout(syncT); syncT = setTimeout(sync, 1500); }
const syncAll = () => sync();
const routineRow = (id, routine) => ({ user_id: id, routine, updated_by: id, updated_at: new Date().toISOString(), note: '' });
const routineDirty = id => 'gymp.routineDirty.' + id; // set while this phone holds routine edits the server hasn't got yet
/* the routine lives in its own table (app_routines) so a trainer can edit it */
async function saveRoutine(routine) {
  const id = uid(); ROUTINE = routine; cacheSet('gymp.routine.' + id, { routine }); localStorage.setItem(routineDirty(id), '1');
  if (typeof applyRoutine === 'function') applyRoutine(); if (cur >= DAYS.length) cur = todayIdx(); renderAll();
  if (!sb || !navigator.onLine) return false;
  const { error } = await sb.from('app_routines').upsert(routineRow(id, routine)).then(r => r, e => ({ error: e }));
  if (!error) localStorage.removeItem(routineDirty(id));
  return !error;
}
async function sync() {
  if (!sb || !session || !ME) return; const id = uid(), mine = () => session && uid() === id;
  if (!navigator.onLine) { setSync('err', 'Offline · will sync later'); return; }
  if (syncing) { syncAgain = true; return; } syncing = true; setSync('busy', 'Syncing…');
  try {
    const { data, error } = await sb.from('app_state').select('data').eq('user_id', id).maybeSingle();
    if (error) throw error;
    if (!mine()) { syncing = false; if (syncAgain) { syncAgain = false; sync(); } return; } // signed out, or someone else signed in, while we waited
    if (data && data.data && data.data.logs) { S = merge(S, data.data); persist(); }
    await syncPhotos(id);
    const { error: e2 } = await sb.from('app_state').upsert({ user_id: id, data: S, updated_at: new Date().toISOString() });
    if (e2) throw e2;
    if (localStorage.getItem(routineDirty(id))) { const r = await sb.from('app_routines').upsert(routineRow(id, ROUTINE)); if (!r.error) localStorage.removeItem(routineDirty(id)); }
    else { // pick up edits made elsewhere (another phone, or a trainer)
      const r = await sb.from('app_routines').select('routine,updated_by').eq('user_id', id).maybeSingle();
      const got = r.data ? cleanRoutine(r.data.routine) : null;
      if (mine() && !r.error && r.data && JSON.stringify(got) !== JSON.stringify(ROUTINE)) { ROUTINE = got; cacheSet('gymp.routine.' + id, { routine: ROUTINE });
        if (r.data.updated_by && r.data.updated_by !== id) { Object.assign(S.settings, { swaps: {}, exSkip: {}, exSkipDef: {}, u: Date.now() }); persist(); } // a coach moved things around: my per-slot swaps and removals no longer line up
      }
    }
    if (!mine()) { syncing = false; if (syncAgain) { syncAgain = false; sync(); } return; }
    if (typeof publishSummary === 'function') await publishSummary(PROF, id, sb, S);
    lastSync = Date.now(); setSync('ok', 'Synced');
    if (S.settings.appearance && S.settings.appearance !== appearance) { appearance = S.settings.appearance; localStorage.setItem('gymp.appearance', appearance); applyTheme(); }
    if (typeof applyRoutine === 'function') applyRoutine(); if (cur >= DAYS.length) cur = todayIdx();
    if (!appOff()) renderAll(true);
  } catch (e) { console.warn(e); setSync('err', 'Sync failed · saved on device'); }
  syncing = false; if (syncAgain) { syncAgain = false; sync(); }
}
async function syncPhotos(id) {
  let changed = false;
  for (const m in S.photos) for (const p of POSES) {
    const meta = S.photos[m][p]; if (!meta) continue;
    if (meta.oldPath) { try { await sb.storage.from(BUCKET).remove([meta.oldPath]); } catch (e) { } delete meta.oldPath; changed = true; }
    if (meta.del || meta.up) continue;
    const blob = await idbRaw(id + ':' + `${m}-${p}-${meta.u}`); if (!blob) continue;
    const path = `${id}/${m}-${p}-${meta.u}.jpg`;
    const { error } = await sb.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: true });
    if (!error) { meta.path = path; meta.up = true; changed = true; }
  }
  if (changed) persist();
}
/* merge two states: newest wins per exercise-session, per body entry, per photo slot, settings as a block */
function merge(a, b) {
  const o = clone(a); b = clone(b);
  if ((b.settings && b.settings.u || 0) > (o.settings.u || 0)) o.settings = { ...o.settings, ...b.settings };
  for (const wk in b.logs || {}) for (const di in b.logs[wk]) for (const id in b.logs[wk][di]) {
    const x = b.logs[wk][di][id]; o.logs[wk] = o.logs[wk] || {}; o.logs[wk][di] = o.logs[wk][di] || {};
    const y = o.logs[wk][di][id]; if (!y || (x.u || 0) > (y.u || 0)) o.logs[wk][di][id] = x;
  }
  for (const d in b.body || {}) { const x = b.body[d], y = o.body[d]; if (!y || (x.u || 0) > (y.u || 0)) o.body[d] = x; }
  o.fuel = o.fuel || {}; for (const d in b.fuel || {}) { const x = b.fuel[d], y = o.fuel[d]; if (!y || (x.u || 0) > (y.u || 0)) o.fuel[d] = x; }
  for (const m in b.photos || {}) for (const p in b.photos[m]) {
    o.photos[m] = o.photos[m] || {}; const x = b.photos[m][p], y = o.photos[m][p];
    if (!y || (x.u || 0) > (y.u || 0)) o.photos[m][p] = x;
    else if (y && x.u === y.u && x.up && !y.up) o.photos[m][p] = { ...y, up: true, path: x.path };
  }
  return o;
}

/* ================= render & events ================= */
function renderAll(quiet) {
  if (appOff()) return;
  renderHeader();
  if (tab === 'workout') { if (!(quiet && document.activeElement && document.activeElement.matches('input'))) renderWorkout(); }
  if (tab === 'history') renderHistory();
  if (tab === 'fuel' && !(quiet && document.activeElement && document.activeElement.matches('input'))) renderFuel();
  if (tab === 'body' && !(quiet && document.activeElement && document.activeElement.matches('input,select'))) renderBody();
  if (tab === 'friends' && !quiet && typeof renderFriends === 'function') renderFriends();
  if (tab === 'clients' && !quiet && typeof renderClients === 'function') renderClients();
  if (tab === 'more' && !quiet) renderMore();
}
function showTab(t) {
  const ORD = ['workout', 'history', 'body', 'fuel', 'friends', 'clients', 'more'], from = ORD.indexOf(tab), to = ORD.indexOf(t);
  if (t === 'workout' && tab !== 'workout') window.__stagger = true;
  setTimeout(() => { const sec = $('t-' + t); if (!sec) return; sec.classList.remove('enter-l', 'enter-r', 'enter-f'); void sec.offsetWidth; sec.classList.add(from < 0 || from === to ? 'enter-f' : to > from ? 'enter-r' : 'enter-l'); if (typeof movePill === 'function') movePill(); }, 0);
  tab = t; document.querySelectorAll('nav button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  document.querySelectorAll('.tab').forEach(s => s.classList.toggle('on', s.id === 't-' + t));
  $('htitle').innerHTML = esc(PROFILES[PROF].label) + ' <span>' + { workout: 'Split', history: 'Log', body: 'Body', fuel: 'Fuel', friends: 'Friends', clients: 'Clients', more: 'App' }[t] + '</span>';
  renderAll(); window.scrollTo(0, 0);
}

document.addEventListener('click', async e => {
  if (appOff()) return;
  const t = e.target.closest('button'); if (!t) return; const d = t.dataset;
  if (d.tab) return showTab(d.tab);
  if (d.day !== undefined) { cur = +d.day; window.__stagger = true; renderWorkout(); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
  if (d.dismiss !== undefined) { localStorage.setItem(LWS(), curWeek); renderWorkout(); return; }
  if (d.swap !== undefined) return swapSheet(+d.swap);
  if (d.form !== undefined) return formSheet(+d.form);
  if (d.exhist !== undefined) return exHistSheet(+d.exhist);
  if (d.pace !== undefined) return openPacer(+d.pace);
  if (d.pick) { const [si, i] = d.pick.split(':').map(Number); if (i) S.settings.swaps[slotKey(cur, si)] = i; else delete S.settings.swaps[slotKey(cur, si)]; touchSettings(); closeSheet(); renderWorkout(); return; }
  if (d.chk) {
    const [si, i] = d.chk.split(':').map(Number);
    if (setsOf(curWeek, cur, exId(exOf(cur, si)))[i]) { unlogSet(si, i); renderWorkout(); }
    else { const { w, r, w2, r2 } = readRow(si, i); beep(1, .01, .001); window.__justLogged = si + ':' + i; logSet(si, i, w, r, w2, r2); renderWorkout(); afterLog(si); }
    return;
  }
  if (d.wk !== undefined) { t.parentElement.classList.toggle('open'); return; }
  // body
  if (t.id === 'bSave') {
    const date = $('bDate').value || dk(new Date()), w = $('bW').value.trim();
    if (!w) return toast('Enter your weight first');
    S.body[date] = { w: +w, waist: $('bWaist').value.trim(), bf: $('bBf').value.trim(), chest: $('bChest').value.trim(), arms: $('bArms').value.trim(), thighs: $('bThighs').value.trim(), hips: $('bHips').value.trim(), note: $('bNote').value.trim(), u: Date.now() };
    save(); renderBody(); toast('✅ Saved for ' + fmtD(parseDk(date), { weekday: 'short', month: 'short', day: 'numeric' })); return;
  }
  if (d.bdel) { S.body[d.bdel] = { del: true, u: Date.now() }; save(); renderBody(); return; }
  if (d.addphoto) return photoChoice(d.addphoto);
  if (d.photo) { const [m, p] = d.photo.split('|'); return photoSheet(m, p); }
  if (d.pdel) { const [m, p] = d.pdel.split('|'); return deletePhoto(m, p); }
  if (d.cpose) { cmpPose = d.cpose; document.querySelectorAll('[data-cpose]').forEach(b => b.classList.toggle('on', b === t)); renderCompare(); return; }
  // more
  if (d.exp) return doExport(d.exp);
  if (d.unit) { S.settings.unit = d.unit; touchSettings(); renderMore(); return; }
  switch (t.id) {
    case 'impBtn': $('importInput').click(); break;
    case 'wakeT': setCaffeine(!cafOn()); renderMore(); break;
    case 'tReset': S.settings.tempoScale = 1; touchSettings(); renderMore(); break;
    case 'swReset': S.settings.swaps = {}; touchSettings(); toast('All exercises back to your originals'); break;
    case 'instBtn': if (deferredInstall) { deferredInstall.prompt(); deferredInstall = null; renderMore(); } break;
    case 'syncNow': sync(); break;
    case 'wipe': openSheet(`<h3>Clear this phone?</h3><div class="sub">Removes your workouts, body logs and photos from this phone and signs you out. ${lastSync ? 'Your cloud copy is kept and comes back when you sign in again.' : '<b>You haven\'t synced yet, so anything logged here could be lost.</b> Export a backup first.'}</div><button class="btn acc" id="wipeYes">Yes, clear it</button>`); break;
    case 'wipeYes': localStorage.removeItem(stateKey(uid())); localStorage.removeItem(LWS()); localStorage.removeItem('gymp.routine.' + uid()); await idbClearProfile(); if (sb) await sb.auth.signOut().catch(() => { }); location.reload(); break;
  }
});
document.addEventListener('change', e => {
  if (appOff()) return;
  const d = e.target.dataset;
  if (d.tgt !== undefined) { const id = exId(exOf(cur, +d.tgt)); const v = e.target.value.trim(); if (v === '') delete S.settings.targets[id]; else S.settings.targets[id] = +v; touchSettings(); renderWorkout(); return; }
  if (d.w || d.r || d.w2 || d.r2) { const [si, i] = (d.w || d.r || d.w2 || d.r2).split(':').map(Number); if (setsOf(curWeek, cur, exId(exOf(cur, si)))[i]) { const { w, r, w2, r2 } = readRow(si, i); logSet(si, i, w, r, w2, r2); } return; }
  if (e.target.id === 'cA' || e.target.id === 'cB') renderCompare();
  if (e.target.id === 'bDate') { const b = S.body[e.target.value]; const v = b && !b.del ? b : {}; $('bW').value = v.w ?? ''; $('bWaist').value = v.waist ?? ''; $('bBf').value = v.bf ?? ''; $('bChest').value = v.chest ?? ''; $('bArms').value = v.arms ?? ''; $('bThighs').value = v.thighs ?? ''; $('bHips').value = v.hips ?? ''; $('bNote').value = v.note ?? ''; }
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden || appOff()) return;
  const nw = weekKeyOf(new Date()); if (nw !== curWeek) { curWeek = nw; applyRoutine(); cur = todayIdx(); renderAll(); }
  keepAwake(); syncAll();
});
window.addEventListener('online', () => { if (!appOff()) syncAll(); });
document.addEventListener('pointerdown', () => keepAwake());

/* ================= start / stop (called by auth.js) ================= */
function startApp() {
  curWeek = weekKeyOf(new Date()); applyTheme(ME.color);
  if (typeof applyRoutine === 'function') applyRoutine(); cur = todayIdx();
  document.body.classList.remove('out'); showTab('workout'); showRestFor(); keepAwake(); if (typeof cafPaint === 'function') cafPaint();
  setSync(navigator.onLine ? 'busy' : 'err', navigator.onLine ? 'Syncing…' : 'Offline · saved on device'); sync();
  if (typeof startFriends === 'function') startFriends();
}
function stopApp() {
  if (typeof stopFriends === 'function') stopFriends();
  clearTimeout(syncT); clearTimeout(rGoT); clearInterval(rInt); rInt = null; for (const k in RT) delete RT[k];
  $('rest').classList.remove('show', 'go');
  if (PC) { PC.done = true; PC = null; } $('pacer').classList.remove('show'); pvStop(); closeSheet();
  for (const k in urlCache) delete urlCache[k]; lastSync = 0; DAYS = []; localStorage.removeItem('gymp.session'); localStorage.removeItem('gymp.sessFired'); /* the session timer belongs to whoever was signed in */ document.body.classList.add('out');
}

/* Spott: "Generate a plan for me" and the auto-progression rules. Pure functions, no screen code, so dev/tests/unit-plan.py can test them.
   Uses EX / exMeta from exlib.js and WD_NAMES, LIB, libFind, fitsEquip from templates.js / library.js.
   TODO(pro): the generator and auto progression are Pro features (see the pricing spec). There's no subscription check in the app yet;
   when hasPro() exists, gate generatePlan's callers (onboard.js 'plan' step, Settings → Generate a plan, Regenerate) and autoplan.js on it. */
'use strict';
const GEN_V = 3; // settings.plan.gen: 3 = every day keeps to its own muscles (2 = the first generator, with full-body days; older plans came from buildRoutine in templates.js)
const GEN_AUTO = 2; // auto progression works on plans from generator 2 on
const AVOID = [['shoulders', 'Shoulders'], ['lowerback', 'Lower back'], ['knees', 'Knees'], ['wrists', 'Wrists']];
const GEN_SLOTS = { 30: 4, 45: 5, 60: 6, 90: 8 }; // session length → exercises per day
const GEN_DAYS = [2, 6]; // fewer or more days: start from scratch instead
const LVL = { new: { max: 2, aim: 1 }, some: { max: 3, aim: 2 }, seasoned: { max: 3, aim: 3 } }; // difficulty allowed, and what main lifts aim for
const KIT = { gym: ['body', 'db', 'gym'], home: ['body', 'db'], body: ['body'] };
const COMPOUND = ['hpush', 'vpush', 'hpull', 'vpull', 'squat', 'hinge'];
const FOCUS_M = { glutes: ['glutes'], legs: ['quads', 'hamstrings'], chest: ['chest'], back: ['back'], shoulders: ['shoulders', 'sidedelt', 'reardelt'], arms: ['biceps', 'triceps'], core: ['core'] };

/* day templates: a slot names a movement (and, for isolation work, a muscle). main = one of the day's big lifts. Slots are used in order. */
const sl = (mv, m, main, pref) => ({ mv, m: m || '', main: !!main, pref: pref || null });
/* Every day has one job. A day lists the muscles it trains (its zone, core is allowed everywhere) and every exercise on it,
   fallbacks and top-ups included, must train one of them: a leg move never lands on a push day.
   The layouts follow what coaches use: upper / lower in the PHUL style (a heavy day and a volume day for each half),
   push / pull / legs, the Arnold split (chest & back, shoulders & arms, legs), a body-part split, or full body if asked for.
   Order inside a day: the main lifts first, then the second compound, then isolation work for the same muscles, core last. */
const PUSH_Z = ['chest', 'shoulders', 'sidedelt', 'triceps'], PULL_Z = ['back', 'reardelt', 'biceps'], LEGS_Z = ['quads', 'hamstrings', 'glutes', 'calves'];
const ALL_Z = [...PUSH_Z, ...PULL_Z, ...LEGS_Z];
const INC = /incline/i, CLOSE = /close-grip|dip/i;
const DAY_T = {
  upA: ['Upper', [...PUSH_Z, ...PULL_Z], [sl('hpush', '', 1), sl('hpull', '', 1), sl('vpush'), sl('vpull'), sl('iso', 'triceps'), sl('iso', 'biceps'), sl('iso', 'sidedelt'), sl('core')], 'heavy'],
  loA: ['Lower', LEGS_Z, [sl('squat', '', 1), sl('hinge', '', 1), sl('lunge'), sl('iso', 'hamstrings'), sl('iso', 'calves'), sl('iso', 'quads'), sl('core'), sl('iso', 'glutes')], 'heavy'],
  upB: ['Upper', [...PUSH_Z, ...PULL_Z], [sl('hpush', '', 1, INC), sl('vpull', '', 1), sl('hpull'), sl('iso', 'chest'), sl('iso', 'sidedelt'), sl('iso', 'biceps'), sl('iso', 'triceps'), sl('iso', 'reardelt')], 'vol'],
  loB: ['Lower', LEGS_Z, [sl('hinge', 'glutes', 1), sl('squat', '', 1), sl('lunge'), sl('iso', 'quads'), sl('iso', 'hamstrings'), sl('iso', 'glutes'), sl('iso', 'calves'), sl('core')], 'vol'],
  push: ['Push', PUSH_Z, [sl('hpush', '', 1), sl('hpush', '', 0, INC), sl('vpush'), sl('iso', 'triceps'), sl('iso', 'sidedelt'), sl('iso', 'chest'), sl('iso', 'triceps'), sl('core')]],
  pull: ['Pull', PULL_Z, [sl('vpull', '', 1), sl('hpull', '', 1), sl('hpull'), sl('iso', 'reardelt'), sl('iso', 'biceps'), sl('iso', 'biceps', 0, /hammer|incline|preacher/i), sl('iso', 'back'), sl('core')]],
  legs: ['Legs', LEGS_Z, [sl('squat', '', 1), sl('hinge', '', 1), sl('lunge'), sl('iso', 'quads'), sl('iso', 'hamstrings'), sl('iso', 'calves'), sl('iso', 'glutes'), sl('core')]],
  pushB: ['Push', PUSH_Z, [sl('vpush', '', 1), sl('hpush', '', 1, INC), sl('hpush'), sl('iso', 'chest'), sl('iso', 'sidedelt'), sl('iso', 'triceps'), sl('iso', 'sidedelt'), sl('core')]],
  pullB: ['Pull', PULL_Z, [sl('hpull', '', 1), sl('vpull', '', 1), sl('hpull'), sl('iso', 'biceps'), sl('iso', 'reardelt'), sl('iso', 'back'), sl('iso', 'biceps'), sl('core')]],
  legsB: ['Legs', LEGS_Z, [sl('hinge', 'glutes', 1), sl('squat', '', 1), sl('lunge'), sl('iso', 'hamstrings'), sl('iso', 'glutes'), sl('iso', 'quads'), sl('iso', 'calves'), sl('core')]],
  fbA: ['Full Body', ALL_Z, [sl('squat', '', 1), sl('hpush', '', 1), sl('hpull'), sl('hinge'), sl('vpush'), sl('iso', 'biceps'), sl('iso', 'calves'), sl('core')]],
  fbB: ['Full Body', ALL_Z, [sl('hinge', '', 1), sl('vpull', '', 1), sl('hpush'), sl('lunge'), sl('iso', 'sidedelt'), sl('iso', 'triceps'), sl('iso', 'hamstrings'), sl('core')]],
  fbC: ['Full Body', ALL_Z, [sl('squat', '', 1), sl('hpull', '', 1), sl('vpush'), sl('hinge', 'glutes'), sl('hpush', '', 0, INC), sl('iso', 'reardelt'), sl('iso', 'biceps'), sl('core')]],
  chestback: ['Chest & Back', ['chest', 'back'], [sl('hpush', '', 1), sl('hpull', '', 1), sl('hpush', '', 0, INC), sl('vpull'), sl('iso', 'chest'), sl('hpull'), sl('iso', 'back'), sl('core')]],
  shoarms: ['Shoulders & Arms', ['shoulders', 'sidedelt', 'reardelt', 'biceps', 'triceps'], [sl('vpush', '', 1), sl('iso', 'sidedelt'), sl('iso', 'biceps'), sl('iso', 'triceps'), sl('iso', 'reardelt'), sl('iso', 'biceps'), sl('iso', 'triceps'), sl('core')]],
  chest: ['Chest', ['chest'], [sl('hpush', '', 1), sl('hpush', '', 1, INC), sl('hpush'), sl('iso', 'chest'), sl('hpush'), sl('iso', 'chest'), sl('core')]],
  back: ['Back', ['back', 'reardelt'], [sl('vpull', '', 1), sl('hpull', '', 1), sl('hpull'), sl('vpull'), sl('iso', 'back'), sl('iso', 'reardelt'), sl('core')]],
  shoulders: ['Shoulders', ['shoulders', 'sidedelt', 'reardelt'], [sl('vpush', '', 1), sl('iso', 'sidedelt'), sl('iso', 'reardelt'), sl('vpush'), sl('iso', 'sidedelt'), sl('iso', 'reardelt'), sl('core')]],
  arms: ['Arms', ['biceps', 'triceps'], [sl('hpush', 'triceps', 1, CLOSE), sl('iso', 'biceps'), sl('iso', 'triceps'), sl('iso', 'biceps'), sl('iso', 'triceps'), sl('iso', 'biceps'), sl('core')]],
  chesttri: ['Chest & Triceps', ['chest', 'triceps'], [sl('hpush', '', 1), sl('hpush', '', 1, INC), sl('iso', 'chest'), sl('iso', 'triceps'), sl('hpush'), sl('iso', 'triceps'), sl('core')]],
  backbi: ['Back & Biceps', ['back', 'reardelt', 'biceps'], [sl('vpull', '', 1), sl('hpull', '', 1), sl('hpull'), sl('iso', 'biceps'), sl('iso', 'reardelt'), sl('iso', 'biceps'), sl('core')]],
  legssho: ['Legs & Shoulders', [...LEGS_Z, 'shoulders', 'sidedelt', 'reardelt'], [sl('squat', '', 1), sl('vpush', '', 1), sl('hinge'), sl('iso', 'sidedelt'), sl('lunge'), sl('iso', 'hamstrings'), sl('iso', 'reardelt'), sl('iso', 'calves')]]
};
/* how the week is split. 'auto' is what coaches most often recommend for that many days */
const GEN_STYLES = [['auto', 'Pick for me', 'The best fit for your days'], ['ppl', 'Push / Pull / Legs', 'Chest, shoulders & triceps · back & biceps · legs'],
  ['ul', 'Upper / Lower', 'A heavy and a lighter day for each half'], ['arnold', 'Arnold split', 'Chest & back · shoulders & arms · legs'],
  ['bro', 'One body part a day', 'Chest, back, legs, shoulders, arms'], ['fb', 'Full body', 'Every muscle, every session']];
const cyc = (list, n) => Array.from({ length: n }, (_, i) => list[i % list.length]);
function genSplit(style, n) {
  const auto = { 2: ['upA', 'loA'], 3: ['push', 'pull', 'legs'], 4: ['upA', 'loA', 'upB', 'loB'], 5: ['push', 'pull', 'legs', 'upB', 'loB'], 6: ['push', 'pull', 'legs', 'pushB', 'pullB', 'legsB'] }[n];
  if (style === 'ppl' && n >= 3) return cyc(['push', 'pull', 'legs', 'pushB', 'pullB', 'legsB'], n);
  if (style === 'ul') return cyc(['upA', 'loA', 'upB', 'loB'], n);
  if (style === 'arnold' && n >= 3) return cyc(['chestback', 'shoarms', 'legs', 'chestback', 'shoarms', 'legsB'], n);
  if (style === 'bro') return { 2: ['upA', 'loA'], 3: ['chesttri', 'backbi', 'legssho'], 4: ['chesttri', 'backbi', 'legs', 'shoarms'], 5: ['chest', 'back', 'legs', 'shoulders', 'arms'], 6: ['chest', 'back', 'legs', 'shoulders', 'arms', 'legsB'] }[n];
  if (style === 'fb') return cyc(['fbA', 'fbB', 'fbC'], n);
  return auto;
}
/* focus areas add one exercise for that muscle on every day that trains it, right after the main lifts */
const FOCUS_X = { glutes: [sl('iso', 'glutes')], legs: [sl('iso', 'quads')], chest: [sl('iso', 'chest')], back: [sl('hpull')], shoulders: [sl('iso', 'sidedelt')], arms: [sl('iso', 'biceps'), sl('iso', 'triceps')], core: [sl('core')] };
const slotM = s => s.m || ({ hpush: 'chest', vpush: 'shoulders', hpull: 'back', vpull: 'back', squat: 'quads', lunge: 'quads', hinge: 'hamstrings', core: 'core' })[s.mv];
/* when nothing fits a slot (equipment or an injury rules it all out), try these instead, in order; if none fit, the slot is left out */
const GEN_FALL = { squat: ['lunge', 'hinge', 'iso:quads', 'iso:glutes'], lunge: ['squat', 'hinge', 'iso:glutes'], hinge: ['iso:glutes', 'iso:hamstrings'], hpush: ['vpush', 'iso:chest', 'iso:triceps'],
  vpush: ['hpush', 'iso:sidedelt'], hpull: ['vpull', 'iso:reardelt', 'iso:back'], vpull: ['hpull', 'iso:back', 'iso:reardelt'], core: [],
  'iso:quads': ['squat', 'lunge', 'iso:glutes'], 'iso:hamstrings': ['hinge', 'iso:glutes'], 'iso:glutes': ['hinge'], 'iso:calves': [], 'iso:biceps': ['hpull'], 'iso:triceps': ['iso:chest', 'hpush'],
  'iso:sidedelt': ['iso:reardelt', 'vpush'], 'iso:reardelt': ['hpull', 'iso:back'], 'iso:chest': ['hpush'], 'iso:back': ['hpull'] };
const fillKinds = zone => [...zone.map(m => 'iso:' + m), ...COMPOUND, 'lunge', 'core', 'core', 'core']; // tops up a day that injuries or equipment left short, from its own muscles only (or core)

/* can this person do this exercise? equipment they have, difficulty for their experience, nothing that loads an area they asked to avoid */
const exOk = (e, a) => !!e && KIT[a.equip || 'gym'].includes(e.eq) && e.d <= (LVL[a.level] || LVL.some).max && !e.st.some(x => (a.avoid || []).includes(x));
const slotKind = s => s.mv === 'iso' ? 'iso:' + s.m : s.mv;
const poolOf = kind => { const [mv, m] = kind.split(':'); return EX.filter(e => e.mv === mv && (!m || e.m === m)); };
function genDose(goal, level, s, e, tag) { // tag: 'heavy' or 'vol' on PHUL-style upper / lower days
  const comp = s.main || COMPOUND.includes(e.mv), nw = level === 'new';
  let d;
  if (goal === 'strength') d = comp ? { sets: nw ? 3 : level === 'seasoned' ? 5 : 4, reps: '3–6', rest: s.main ? 180 : 150 } : { sets: 3, reps: '6–10', rest: 90 };
  else if (goal === 'muscle') d = { sets: nw ? 3 : comp ? 4 : 3, reps: '8–12', rest: comp ? 120 : 75 };
  else d = { sets: nw ? 2 : 3, reps: '10–15', rest: 60 }; // general (and lose fat)
  if (goal === 'muscle' && tag === 'heavy' && s.main) d = { ...d, reps: '5–8', rest: 150 }; // the heavy day: fewer reps on the main lifts
  if (goal === 'muscle' && tag === 'vol' && !comp) d = { ...d, reps: '12–15', rest: 60 }; // the volume day: higher reps on the isolation work
  if (e.hold) d = { ...d, reps: e.hold + ' sec', time: e.hold, rest: 60 };
  return d;
}
const genOpt = e => { const l = typeof libFind === 'function' ? libFind(e.n) : null; return { n: e.n, pat: typeof P !== 'undefined' && P[e.pat] ? e.pat : 'squat', cues: (l && l.n === e.n && l.cues && l.cues.length ? l.cues : EX_CUE[e.n]) || [] }; };
/* answers: goal (strength | muscle | general | lean), level (new | some | seasoned), equip (gym | home | body), mins (30 | 45 | 60 | 90),
   avoid (shoulders, lowerback, knees, wrists), focus (FOCUS ids, up to 2), wds (weekdays 1–7; 2 to 6 of them) */
function generatePlan(a) {
  a = { goal: 'muscle', level: 'some', equip: 'gym', mins: 60, avoid: [], focus: [], ...a };
  let wds = (a.wds || []).filter(d => d >= 1 && d <= 7).sort((x, y) => x - y);
  if (wds.length < GEN_DAYS[0]) wds = [1, 4]; if (wds.length > GEN_DAYS[1]) wds = wds.slice(0, GEN_DAYS[1]);
  const lv = LVL[a.level] || LVL.some, n = GEN_SLOTS[a.mins] || (a.mins > 60 ? 8 : 6), week = new Map(); // exercise → times used this week
  const fm = (a.focus || []).flatMap(f => FOCUS_M[f] || []);
  const pick = (s, kind, today, zone) => {
    const c = poolOf(kind).filter(e => exOk(e, a) && !today.has(e.n) && (e.m === 'core' || zone.includes(e.m)));
    if (!c.length) return null;
    const score = e => (week.get(e.n) ? -6 * week.get(e.n) : 0) + (s.pref && s.pref.test(e.n) ? 5 : 0) + (s.m && kind === s.mv && e.m === s.m ? 4 : 0)
      + (s.main ? -Math.abs(e.d - lv.aim) * 2 + (e.eq === a.equip || (a.equip === 'home' && e.eq === 'db') ? 2 : 0) : -Math.max(0, e.d - 2));
    return c.reduce((b, e) => (score(e) > score(b) ? e : b)); // first best in library order: the same answers always give the same plan
  };
  const alts = (e, today, zone) => { // swap choices train the same muscle, so a swap never pulls the day off its job
    const fit = x => x && x.n !== e.n && exOk(x, a) && (x.m === e.m || (zone.includes(x.m) && x.mv === e.mv));
    const sim = e.sim.map(exMeta).filter(fit);
    const more = poolOf(e.mv === 'iso' ? 'iso:' + e.m : e.mv).filter(x => fit(x) && !sim.includes(x));
    return [...sim, ...more].slice(0, 3);
  };
  const keys = genSplit(a.split || 'auto', wds.length), seen = {}, dup = {};
  keys.forEach(k => { const t = DAY_T[k][0]; dup[t] = (dup[t] || 0) + 1; });
  return keys.map((key, di) => {
    const [title0, zone, slots0, tag] = DAY_T[key], today = new Set(), out = [];
    const title = dup[title0] > 1 ? title0 + ' ' + 'ABCDEF'[seen[title0] = (seen[title0] ?? -1) + 1] : title0; // "Upper A", "Upper B"
    const extra = (a.focus || []).flatMap(f => FOCUS_X[f] || []).filter(x => slotM(x) === 'core' || zone.includes(slotM(x)));
    const nm = slots0.filter(x => x.main).length, slots = [...slots0.slice(0, nm), ...extra, ...slots0.slice(nm)];
    for (const s of slots) {
      if (out.length >= n) break;
      let e = null;
      for (const kind of [slotKind(s), ...(GEN_FALL[slotKind(s)] || [])]) { e = pick(s, kind, today, zone); if (e) break; }
      if (!e) continue;
      today.add(e.n); week.set(e.n, (week.get(e.n) || 0) + 1);
      const d = genDose(a.goal, a.level, s, e, tag), plus = fm.includes(e.m) && !e.hold ? 1 : 0;
      out.push({ sets: Math.min(5, d.sets + plus), reps: d.reps, rest: d.rest, ...(d.time ? { time: d.time } : {}), mv: e.mv, ...(s.main ? { main: true } : {}), opts: [e, ...alts(e, today, zone)].map(genOpt) });
    }
    for (const kind of fillKinds(zone)) { // a day left with too little (say, a push day when shoulders and wrists are both off limits): add safe work
      if (out.length >= Math.min(n, 4)) break;
      const s = sl(kind.split(':')[0], kind.split(':')[1]), e = pick(s, kind, today, zone); if (!e) continue;
      today.add(e.n); week.set(e.n, (week.get(e.n) || 0) + 1); const d = genDose(a.goal, a.level, s, e, tag);
      out.push({ sets: d.sets, reps: d.reps, rest: d.rest, ...(d.time ? { time: d.time } : {}), mv: e.mv, opts: [e, ...alts(e, today, zone)].map(genOpt) });
    }
    if (a.goal === 'lean' && typeof LIB !== 'undefined') { // lose fat: a short cardio finisher, as the old builder did
      const pool = (LIB.cardio || []).filter(o => typeof fitsEquip !== 'function' || fitsEquip(o.n, a.equip)), m = a.mins <= 30 ? 8 : 12;
      if (pool[0]) out.push({ sets: 1, reps: m + ' min', time: m * 60, rest: 0, opts: pool.slice(0, 4).map(o => ({ n: o.n, pat: o.pat, cues: o.cues || [] })) });
    }
    return { d: WD_NAMES[wds[di]], wd: wds[di], title, slots: out };
  });
}

/* ---------- auto progression ---------- */
const JUMP = { kg: { upper: 2.5, lower: 5, dbiso: 1 }, lb: { upper: 5, lower: 10, dbiso: 2.5 } };
const LOWER_M = ['quads', 'hamstrings', 'glutes', 'calves'];
function jumpKind(name) {
  const e = exMeta(name);
  if (e) return e.mv === 'iso' && e.eq === 'db' ? 'dbiso' : ['squat', 'hinge', 'lunge'].includes(e.mv) || LOWER_M.includes(e.m) ? 'lower' : 'upper';
  if (/squat|deadlift|\brdl\b|lunge|leg |hip thrust|glute|calf|step-up|good morning/i.test(name)) return 'lower';
  return /(dumbbell|\bdb\b).*(curl|raise|fly|flye|extension|kickback)|(curl|raise|fly|extension).*(dumbbell|\bdb\b)|hammer curl|concentration/i.test(name) ? 'dbiso' : 'upper';
}
const jumpFor = (name, unit) => JUMP[unit === 'lb' ? 'lb' : 'kg'][jumpKind(name)];
const roundTo = (w, step) => Math.round(w / step) * step;
const nums2 = r => (String(r).match(/\d+/g) || []).map(Number);
/* history: this lift's past sessions, oldest first, each { sets: [{ w, r }] }. Returns the next target, or null when there's no weighted history.
   dir 'up': every set hit the top of the range → add the jump. dir 'down': missed the bottom of the range two sessions running → 10% off. */
function progTarget(history, reps, sets, name, unit) {
  const last = history[history.length - 1]; if (!last) return null;
  const r = nums2(reps), low = r[0] || 0, top = r[r.length - 1] || 0, ws = last.sets.filter(Boolean), maxW = Math.max(0, ...ws.map(s => +s.w || 0));
  if (!maxW || !top) return null;
  if (ws.length >= sets && ws.every(s => +s.r >= top)) return { w: Math.round((maxW + jumpFor(name, unit)) * 100) / 100, dir: 'up', from: maxW, why: `you hit ${top}s last time` };
  const prev = history[history.length - 2], miss = h => h && h.sets.filter(Boolean).some(s => +s.r < low);
  if (low && miss(last) && miss(prev) && Math.max(0, ...prev.sets.filter(Boolean).map(s => +s.w || 0)) >= maxW)
    return { w: roundTo(maxW * .9, unit === 'lb' ? 2.5 : 1.25), dir: 'down', from: maxW, why: 'you missed the bottom of the range two sessions in a row' };
  return { w: maxW, dir: null, from: maxW, why: '' };
}
/* no progress for 3 weeks: the best set in the last 21 days is no better than the best set before them (needs 21+ days of history and 2+ sessions in the window) */
const setScore = s => (+s.w || 0) ? (+s.w) * (1 + (+s.r || 0) / 30) : (+s.r || 0); // estimated 1-rep max; reps for bodyweight moves
function stalled(history, now = Date.now()) {
  const cut = now - 21 * 864e5, before = history.filter(h => h.t < cut), within = history.filter(h => h.t >= cut);
  if (!before.length || within.length < 2) return false;
  const best = hs => Math.max(0, ...hs.flatMap(h => h.sets.filter(Boolean).map(setScore)));
  return best(within) <= best(before.slice(-3)) * 1.005;
}
/* what to swap a stalled lift for: its similar exercises first, then anything else for the same movement, that this person can do */
function swapFor(name, a, skip = []) {
  const e = exMeta(name); if (!e) return null;
  const c = [...e.sim.map(exMeta), ...poolOf(e.mv === 'iso' ? 'iso:' + e.m : e.mv)].filter(x => x && x.n !== e.n && !skip.includes(x.n) && exOk(x, a || {}));
  return c[0] || null;
}

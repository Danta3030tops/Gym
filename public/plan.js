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
  fbC: ['Full Body', ALL_Z, [sl('squat', '', 1), sl('hpull', '', 1), sl('vpush'), sl('hinge'), sl('hpush', '', 0, INC), sl('iso', 'reardelt'), sl('iso', 'biceps'), sl('core')]],
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
const GEN_STYLES = [['auto', 'Pick for me', 'Every muscle twice a week, sized to your days'], ['ppl', 'Push / Pull / Legs', 'Chest, shoulders & triceps · back & biceps · legs'],
  ['ul', 'Upper / Lower', 'A heavy and a lighter day for each half'], ['arnold', 'Arnold split', 'Chest & back · shoulders & arms · legs'],
  ['bro', 'One body part a day', 'Chest, back, legs, shoulders, arms'], ['fb', 'Full body', 'Every muscle, every session']];
const cyc = (list, n) => Array.from({ length: n }, (_, i) => list[i % list.length]);
function genSplit(style, n) {
  const auto = { 2: ['fbA', 'fbB'], 3: ['upA', 'loA', 'fbC'], 4: ['upA', 'loA', 'upB', 'loB'], 5: ['upA', 'loA', 'push', 'pull', 'legs'], 6: ['push', 'pull', 'legs', 'pushB', 'pullB', 'legsB'] }[n]; // every muscle twice a week, so the weekly sets fit
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
/* sets, reps and rest. Research: growth is similar from about 5 to 30 reps when sets end 1–3 reps short of failure, so compounds sit in
   moderate ranges and small muscles in higher ones; longer rests (2–3 min) on compounds let more sets count. Sets here are a starting
   point: genBalance then moves them so each muscle lands in its weekly range. */
const HIGH_REP = ['calves', 'sidedelt', 'reardelt', 'core'];
function genDose(goal, level, s, e, tag) { // tag: 'heavy' or 'vol' on PHUL-style upper / lower days
  const comp = s.main || COMPOUND.includes(e.mv), nw = level === 'new', hi = HIGH_REP.includes(e.m);
  let d;
  if (goal === 'strength') d = s.main ? { sets: nw ? 3 : level === 'seasoned' ? 5 : 4, reps: '3–6', rest: 180 } : comp ? { sets: 3, reps: '5–8', rest: 150 } : { sets: 3, reps: hi ? '10–15' : '8–12', rest: 90 };
  else if (goal === 'muscle') d = s.main ? { sets: nw ? 3 : 4, reps: '6–10', rest: 150 } : comp ? { sets: 3, reps: '8–12', rest: 120 } : { sets: 3, reps: hi ? '12–20' : '10–15', rest: 60 };
  else d = comp ? { sets: nw ? 2 : 3, reps: '8–12', rest: 90 } : { sets: nw ? 2 : 3, reps: hi ? '15–20' : '12–15', rest: 60 }; // general (and lose fat)
  if (goal === 'muscle' && tag === 'heavy' && s.main) d = { ...d, reps: '5–8', rest: 180 }; // PHUL heavy day: fewer reps on the main lifts
  if (goal === 'muscle' && tag === 'vol' && s.main) d = { ...d, reps: '8–12' }; // PHUL volume day
  if (e.hold) d = { ...d, reps: e.hold + ' sec', time: e.hold, rest: 60 };
  return d;
}
/* ---------- weekly volume: the core of the generator ----------
   The strongest finding in the research (Schoenfeld 2017, Pelland et al. 2024 meta-regressions) is that weekly hard sets per muscle
   drive growth, with diminishing returns; a direct set counts 1, a set where the muscle helps counts 0.5 ("fractional sets").
   Gains from one session flatten out past roughly 10–11 fractional sets for a muscle, so big weekly numbers are spread over 2+ days.
   With volume equal, full body and split routines grow muscle the same (Ramos-Campo 2024), so the split is picked to fit the sets in. */
const VOL_M = ['chest', 'back', 'quads', 'hamstrings', 'glutes', 'shoulders', 'sidedelt', 'reardelt', 'biceps', 'triceps', 'calves'];
const VOL = { muscle: { new: [6, 12], some: [10, 16], seasoned: [12, 20] }, strength: { new: [6, 10], some: [8, 12], seasoned: [9, 14] },
  general: { new: [6, 10], some: [8, 12], seasoned: [8, 14] } }; // lose fat uses general: keep muscle while dieting, without piling on fatigue
const VOL_SCALE = { shoulders: .5, sidedelt: .6, reardelt: .5, calves: .6 }; // pressing and rowing already work the delts; calves need less to grow on most programs
const LOOSE = ['shoulders', 'glutes']; // mostly worked indirectly (pressing, squats and hinges), so going over their range is fine
const SESS_MAX = 10; // fractional sets for one muscle in one session
const setSecs = s => (s.rest || 60) + 40; // one set plus its rest
const sessSecs = mins => (mins - 5) * 60; // the session, less about 5 minutes of warm-up
const HELP = { hpush: { triceps: .5, shoulders: .5 }, vpush: { triceps: .5, sidedelt: .5 }, hpull: { biceps: .5, reardelt: .5 }, vpull: { biceps: .5 },
  squat: { glutes: .5 }, lunge: { glutes: .5 }, hinge: { glutes: .5 } };
function exVol(e) { // what one set of this exercise counts for, per muscle
  if (!e || e.m === 'core') return {};
  const v = { [e.m]: 1 }, h = HELP[e.mv] || {};
  for (const k in h) if (k !== e.m) v[k] = h[k];
  if (e.mv === 'hinge' && e.m === 'glutes') v.hamstrings = .5;
  if (e.mv === 'hpush' && e.m === 'triceps') v.chest = .5;
  return v;
}
function volTarget(a, m) {
  const [lo, hi] = (VOL[a.goal] || VOL.general)[a.level] || VOL.general.some, k = VOL_SCALE[m] || 1;
  const f = (a.focus || []).some(x => (FOCUS_M[x] || []).includes(m)) ? 1.3 : 1; // a focus area gets about a third more
  return [Math.round(lo * k * f), Math.round(hi * k * f)];
}
function planVolume(plan) { // { week: { muscle: sets }, days: [{ muscle: sets }], hits: { muscle: days trained } }
  const week = {}, days = [], hits = {};
  for (const d of plan) { const dv = {};
    for (const s of d.slots) { if (!s.mv || s.time) continue; const v = exVol(exMeta(s.opts[0].n)); for (const k in v) dv[k] = (dv[k] || 0) + v[k] * s.sets; }
    for (const k in dv) { week[k] = (week[k] || 0) + dv[k]; if (dv[k] >= 1.5) hits[k] = (hits[k] || 0) + 1; }
    days.push(dv); }
  return { week, days, hits };
}
/* stretch-position exercises grew more muscle in head-to-head studies (seated over lying leg curls, overhead over pushdown-style
   triceps work, Maeo 2021 and 2022), so the picker leans towards them when they fit */
const STRETCH = /seated leg curl|overhead|incline (db|dumbbell) curl|romanian|rdl|bayesian|pullover|deficit|cable lateral|bulgarian|standing calf/i;
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
    const c = poolOf(kind).filter(e => exOk(e, a) && !today.has(e.n) && (e.m === 'core' || zone.includes(e.m)) && !(s.main && e.hold)); // a main lift is never a hold
    if (!c.length) return null;
    const score = e => (week.get(e.n) ? -6 * week.get(e.n) : 0) + (s.pref && s.pref.test(e.n) ? 5 : 0) + (s.m && kind === s.mv && e.m === s.m ? 4 : 0)
      + (!s.main && STRETCH.test(e.n) ? 2 : 0) + (e.hold && kind !== 'core' ? -3 : 0) + (e.mv === 'hpush' && [...today].some(x => { const t = exMeta(x); return t && t.mv === 'hpush' && INC.test(x) === INC.test(e.n); }) ? -4 : 0) // a flat and an incline press, not two of one + (s.main ? -Math.abs(e.d - lv.aim) * 2 + (e.eq === a.equip || (a.equip === 'home' && e.eq === 'db') ? 2 : 0) : -Math.max(0, e.d - 2));
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
  const plan = keys.map((key, di) => {
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
      const d = genDose(a.goal, a.level, s, e, tag), plus = 0; // focus areas get their extra through volTarget
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
    return { d: WD_NAMES[wds[di]], wd: wds[di], title, slots: out, zone };
  });
  genBalance(plan, a, n, pick, alts, week);
  return plan.map(({ zone, ...d }) => d);
}
/* move sets until every muscle sits in its weekly range: first keep each session inside its time, then lift the muscle that is
   furthest below its range (more sets on its own exercises, else a new exercise for it on a day that trains it), then trim any
   muscle well over its range. Deterministic: same answers, same plan. */
function genBalance(plan, a, n, pick, alts, week) {
  const cap = sessSecs(a.mins || 60), meta = s => exMeta(s.opts[0].n);
  const lifts = d => d.slots.filter(s => s.mv && !s.time && meta(s)), total = d => d.slots.reduce((t, s) => t + (s.mv ? s.sets * setSecs(s) : (s.time || 0)), 0); // seconds
  const maxSets = s => (s.main ? 5 : 4), minSets = s => (s.main ? 3 : 2), keep = s => a.goal === 'strength' && s.main; // strength: the main lifts keep their sets
  const dose = (s, e, di) => genDose(a.goal, a.level, s, e, DAY_T[genSplit(a.split || 'auto', plan.length)[di]][3]);
  const vt = {}; for (const m of VOL_M) vt[m] = volTarget(a, m);
  // 1. each session fits its time: take sets from the muscle that has the most to spare
  plan.forEach(d => { for (let g = 0; g < 60 && total(d) > cap; g++) { const V = planVolume(plan).week;
    const c = lifts(d).filter(s => s.sets > minSets(s) && !keep(s)).sort((x, y) => ((V[meta(y).m] || 0) / ((vt[meta(y).m] || [1])[0] || 1)) - ((V[meta(x).m] || 0) / ((vt[meta(x).m] || [1])[0] || 1)) || (x.main ? 1 : 0) - (y.main ? 1 : 0))[0];
    if (c) { c.sets--; continue; }
    const i = d.slots.map((s, k) => [s, k]).reverse().find(([s]) => s.mv && !s.main); // still too long: drop the last smaller exercise
    if (i && lifts(d).length > 3) { d.slots.splice(i[1], 1); continue; }
    const k = lifts(d).filter(s => s.sets > minSets(s)).sort((x, y) => y.sets - x.sets)[0]; if (!k) break; k.sets--; } }); // last resort: the main lifts too
  // 1b. no session piles more than SESS_MAX sets on one muscle: take sets off its smaller exercises there
  plan.forEach((d, di) => { for (let g = 0; g < 40; g++) { const dv = planVolume(plan).days[di], m = VOL_M.find(k => (dv[k] || 0) > SESS_MAX); if (!m) break;
    const c = lifts(d).filter(s => exVol(meta(s))[m] && s.sets > minSets(s) && !keep(s)).sort((x, y) => (x.main ? 1 : 0) - (y.main ? 1 : 0) || exVol(meta(y))[m] - exVol(meta(x))[m])[0];
    if (c) { c.sets--; continue; }
    const i = d.slots.map((s, k) => [s, k]).reverse().find(([s]) => s.mv && !s.main && !s.time && meta(s) && exVol(meta(s))[m]); if (i && lifts(d).length > 3) { d.slots.splice(i[1], 1); continue; }
    const k = lifts(d).filter(s => exVol(meta(s))[m] && s.sets > minSets(s)).sort((x, y) => y.sets - x.sets)[0]; if (!k) break; k.sets--; } });
  // 2. raise the muscles below their range
  const stuck = new Set(), swapped = new Set(), s0 = s => s.sets;
  for (let g = 0; g < 300; g++) {
    const P = planVolume(plan), V = P.week;
    const low = VOL_M.filter(m => !stuck.has(m) && (V[m] || 0) < vt[m][0]).sort((x, y) => (V[x] || 0) / vt[x][0] - (V[y] || 0) / vt[y][0])[0];
    if (!low) break;
    const fits = (di, add) => { for (const k in add) if ((P.days[di][k] || 0) + add[k] > SESS_MAX || (k !== low && !LOOSE.includes(k) && (V[k] || 0) + add[k] > (vt[k] || [0, 99])[1])) return false; return true; };
    let best = null; // one more set on an exercise for this muscle, on the day with the least of it so far
    plan.forEach((d, di) => { for (const s of lifts(d)) { const e = meta(s), v = exVol(e); if (total(d) + setSecs(s) > cap) continue;
      if (e.m !== low || s.sets >= maxSets(s) || !fits(di, v)) continue;
      if (!best || (P.days[di][low] || 0) < (P.days[best[0]][low] || 0)) best = [di, s]; } });
    if (best) { best[1].sets++; continue; }
    let added = false; // or a new exercise for it, on a day that trains it and has room
    const order = plan.map((d, di) => di).sort((x, y) => (P.days[x][low] || 0) - (P.days[y][low] || 0));
    for (const di of order) { const d = plan[di];
      if (!d.zone.includes(low) || d.slots.filter(s => s.mv).length >= n || total(d) + 2 * 100 > cap) continue;
      const today = new Set(d.slots.map(s => s.opts[0] && s.opts[0].n)), kinds = ['iso:' + low, ...COMPOUND.filter(k => poolOf(k).some(e => e.m === low)), 'lunge'];
      let e = null, s = null; for (const kind of kinds) { s = sl(kind.split(':')[0], kind.split(':')[1]); e = pick(s, kind, today, d.zone); if (e && e.m === low && !e.hold) break; e = null; }
      if (!e || !fits(di, exVol(e))) continue;
      { const ds0 = dose(s, e, di); if (total(d) + 2 * setSecs(ds0) > cap) continue; }
      week.set(e.n, (week.get(e.n) || 0) + 1); const ds = dose(s, e, di), at = d.slots.findIndex(x => x.mv === 'core' || x.time);
      const slot = { sets: 2, reps: ds.reps, rest: ds.rest, mv: e.mv, opts: [e, ...alts(e, today, d.zone)].map(genOpt) };
      d.slots.splice(at < 0 ? d.slots.length : at, 0, slot); added = true; break; }
    if (!added) for (const di of order) { // a full day: trade an exercise whose muscle stays in range without it for one that trains this muscle
      const d = plan[di]; if (!d.zone.includes(low)) continue;
      const give = lifts(d).filter(s => !s.main && !swapped.has(s) && meta(s).m !== low && VOL_M.includes(meta(s).m) && (V[meta(s).m] || 0) - s.sets >= vt[meta(s).m][0]
        && ((P.hits[meta(s).m] || 0) > 2 || (P.days[di][meta(s).m] || 0) - s.sets >= 1.5)) // and it is still trained twice a week
        .sort((x, y) => ((V[meta(y).m] || 0) - s0(y)) / vt[meta(y).m][0] - ((V[meta(x).m] || 0) - s0(x)) / vt[meta(x).m][0])[0];
      if (!give) continue;
      const today = new Set(d.slots.map(s => s.opts[0] && s.opts[0].n)), kinds = ['iso:' + low, ...COMPOUND.filter(k => poolOf(k).some(e => e.m === low)), 'lunge'];
      let e = null, s = null; for (const kind of kinds) { s = sl(kind.split(':')[0], kind.split(':')[1]); e = pick(s, kind, today, d.zone); if (e && e.m === low && !e.hold) break; e = null; }
      if (!e) continue;
      { const v = exVol(e), add = {}; for (const k in v) add[k] = v[k] * Math.max(2, Math.min(3, give.sets)); if ((P.days[di][low] || 0) + add[low] > SESS_MAX) continue; }
      const ds = dose(s, e, di), slot = { sets: Math.max(2, Math.min(3, give.sets)), reps: ds.reps, rest: ds.rest, mv: e.mv, opts: [e, ...alts(e, today, d.zone)].map(genOpt) };
      d.slots.splice(d.slots.indexOf(give), 1, slot); swapped.add(slot); week.set(e.n, (week.get(e.n) || 0) + 1); added = true; break; }
    if (!added) stuck.add(low); // no room left for it: the session length or the days a week can't hold more
  }
  // 3. trim muscles well over their range, isolation work first
  const done = new Set();
  for (let g = 0; g < 200; g++) { const V = planVolume(plan).week;
    const high = VOL_M.find(m => !done.has(m) && !LOOSE.includes(m) && (V[m] || 0) > vt[m][1] + 1); if (!high) break;
    const c = plan.flatMap(lifts).filter(s => meta(s).m === high && s.sets > minSets(s) && !keep(s)).sort((x, y) => (x.main ? 1 : 0) - (y.main ? 1 : 0) || y.sets - x.sets)[0];
    if (c) { c.sets--; continue; }
    // already at the fewest sets: drop a whole exercise for it (never a main lift), from the day with the most of it, if that day keeps at least 4
    let gone = false; const P = planVolume(plan);
    for (const di of plan.map((_, i) => i).sort((x, y) => (P.days[y][high] || 0) - (P.days[x][high] || 0))) { const d = plan[di];
      const i = d.slots.map((s, k) => [s, k]).reverse().find(([s]) => s.mv && !s.main && !s.time && meta(s) && meta(s).m === high);
      if (i && lifts(d).length > 4) { d.slots.splice(i[1], 1); gone = true; break; } }
    if (!gone) done.add(high); }
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

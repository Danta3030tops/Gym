/* Public Gym app: builds a starter routine from the exercise library (../library.js) for a goal and days per week.
   Day shape matches the couple app ({ d, title, slots: [{ sets, reps, rest, time?, opts: [{ n, pat, cues }] }] }) plus
   `wd`, the weekday the day falls on (1 = Monday … 7 = Sunday), because not everyone trains five days. */
'use strict';
const GOALS = [
  ['muscle', '💪', 'Build muscle', 'Moderate weights, 8–12 reps'],
  ['strength', '🏋️', 'Get stronger', 'Heavier lifts, longer rests'],
  ['lean', '🔥', 'Lose fat & tone', 'Higher reps, short rests, cardio finisher'],
  ['general', '⚡', 'General fitness', 'A balanced mix of everything']
];
const LEVELS = [['new', 'New to the gym', 'Under 6 months of lifting'], ['some', 'Some experience', '6 months to 2 years'], ['seasoned', 'Experienced', '2+ years of steady training']];
const WD_NAMES = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
/* each slot: [category, preferred exercise]. The first two slots of a day are its main lifts. */
const SPLITS = {
  1: [
    [1, 'Full Body', [['quads', 'Barbell Back Squat'], ['chest', 'Flat Dumbbell Bench Press'], ['back', 'Lat Pulldown'], ['hamstrings', 'Romanian Deadlift'], ['shoulders', 'Seated Dumbbell Press'], ['core', 'Weighted Cable Crunch']]]
  ],
  2: [
    [1, 'Full Body A', [['quads', 'Barbell Back Squat'], ['chest', 'Flat Dumbbell Bench Press'], ['back', 'Lat Pulldown'], ['hamstrings', 'Romanian Deadlift'], ['shoulders', 'Seated Dumbbell Press'], ['core', 'Weighted Cable Crunch']]],
    [4, 'Full Body B', [['quads', 'Leg Press'], ['back', 'Barbell Bent-Over Row'], ['chest', 'Incline Dumbbell Press'], ['glutes', 'Barbell Hip Thrust'], ['shoulders', 'DB Lateral Raise'], ['core', 'Hanging Knee Raise']]]
  ],
  3: [
    [1, 'Full Body A', [['quads', 'Barbell Back Squat'], ['chest', 'Flat Dumbbell Bench Press'], ['back', 'Lat Pulldown'], ['hamstrings', 'Romanian Deadlift'], ['shoulders', 'Seated Dumbbell Press'], ['core', 'Weighted Cable Crunch']]],
    [3, 'Full Body B', [['quads', 'Leg Press'], ['back', 'Barbell Bent-Over Row'], ['chest', 'Incline Dumbbell Press'], ['glutes', 'Barbell Hip Thrust'], ['shoulders', 'DB Lateral Raise'], ['core', 'Hanging Knee Raise']]],
    [5, 'Full Body C', [['hamstrings', 'Dumbbell RDL'], ['chest', 'Machine Chest Press'], ['back', 'Dumbbell Row'], ['quads', 'Hack Squat'], ['arms', 'Dumbbell Curl'], ['core', 'Lying Leg Raise']]]
  ],
  4: [
    [1, 'Upper A', [['chest', 'Flat Barbell Bench Press'], ['back', 'Barbell Bent-Over Row'], ['shoulders', 'Seated Dumbbell Press'], ['back', 'Lat Pulldown'], ['arms', 'Barbell Curl'], ['arms', 'Hammer Curls']]],
    [2, 'Lower A', [['quads', 'Barbell Back Squat'], ['hamstrings', 'Romanian Deadlift'], ['quads', 'Leg Press'], ['hamstrings', 'Good Morning'], ['calves', 'Standing Calf Raise'], ['core', 'Weighted Cable Crunch']]],
    [4, 'Upper B', [['chest', 'Incline Dumbbell Press'], ['back', 'Pull-Ups'], ['shoulders', 'DB Lateral Raise'], ['back', 'Dumbbell Row'], ['chest', 'Machine Chest Press'], ['arms', 'EZ-Bar Curl']]],
    [5, 'Lower B', [['glutes', 'Barbell Hip Thrust'], ['quads', 'Hack Squat'], ['hamstrings', 'Dumbbell RDL'], ['glutes', 'Cable Glute Kickback'], ['calves', 'Seated Calf Raise'], ['core', 'Hanging Leg Raises']]]
  ],
  5: [
    [1, 'Legs', [['quads', 'Barbell Back Squat'], ['hamstrings', 'Romanian Deadlift'], ['quads', 'Leg Press'], ['glutes', 'Barbell Hip Thrust'], ['calves', 'Standing Calf Raise'], ['core', 'Weighted Cable Crunch']]],
    [2, 'Push', [['chest', 'Flat Barbell Bench Press'], ['shoulders', 'Seated Dumbbell Press'], ['chest', 'Incline Dumbbell Press'], ['shoulders', 'DB Lateral Raise'], ['chest', 'Machine Chest Press'], ['shoulders', 'Cable Lateral Raise']]],
    [3, 'Pull', [['back', 'Pull-Ups'], ['back', 'Barbell Bent-Over Row'], ['back', 'Lat Pulldown'], ['back', 'Dumbbell Row'], ['arms', 'Barbell Curl'], ['arms', 'Hammer Curls']]],
    [4, 'Glutes & Hamstrings', [['glutes', 'Smith Machine Hip Thrust'], ['hamstrings', 'Dumbbell RDL'], ['quads', 'Hack Squat'], ['glutes', 'Cable Glute Kickback'], ['calves', 'Seated Calf Raise'], ['core', 'Hanging Knee Raise']]],
    [5, 'Upper & Core', [['chest', 'Flat Dumbbell Bench Press'], ['back', 'Close-Grip Pulldown'], ['shoulders', 'Arnold Press'], ['arms', 'EZ-Bar Curl'], ['core', 'Lying Leg Raise'], ['core', 'Ab Wheel Rollout']]]
  ],
  6: [
    [1, 'Push A', [['chest', 'Flat Barbell Bench Press'], ['shoulders', 'Seated Dumbbell Press'], ['chest', 'Incline Dumbbell Press'], ['shoulders', 'DB Lateral Raise'], ['arms', 'Tricep Pushdown (rope)'], ['core', 'Weighted Cable Crunch']]],
    [2, 'Pull A', [['back', 'Pull-Ups'], ['back', 'Barbell Bent-Over Row'], ['back', 'Lat Pulldown'], ['shoulders', 'Face Pulls'], ['arms', 'Barbell Curl'], ['arms', 'Hammer Curls']]],
    [3, 'Legs A', [['quads', 'Barbell Back Squat'], ['hamstrings', 'Romanian Deadlift'], ['quads', 'Leg Press'], ['hamstrings', 'Lying Leg Curl'], ['calves', 'Standing Calf Raise'], ['core', 'Hanging Leg Raises']]],
    [4, 'Push B', [['shoulders', 'Barbell Overhead Press'], ['chest', 'Flat Dumbbell Bench Press'], ['chest', 'Machine Chest Press'], ['shoulders', 'Cable Lateral Raise'], ['arms', 'Overhead DB Extension'], ['core', 'Lying Leg Raise']]],
    [5, 'Pull B', [['back', 'Dumbbell Row'], ['back', 'Close-Grip Pulldown'], ['back', 'Seated Cable Row'], ['shoulders', 'Rear Delt DB Fly'], ['arms', 'EZ-Bar Curl'], ['arms', 'Incline DB Curl']]],
    [6, 'Legs B', [['glutes', 'Barbell Hip Thrust'], ['quads', 'Hack Squat'], ['hamstrings', 'Dumbbell RDL'], ['quads', 'Bulgarian Split Squat'], ['calves', 'Seated Calf Raise'], ['core', 'Hanging Knee Raise']]]
  ],
  7: [
    [1, 'Push A', [['chest', 'Flat Barbell Bench Press'], ['shoulders', 'Seated Dumbbell Press'], ['chest', 'Incline Dumbbell Press'], ['shoulders', 'DB Lateral Raise'], ['arms', 'Tricep Pushdown (rope)'], ['core', 'Weighted Cable Crunch']]],
    [2, 'Pull A', [['back', 'Pull-Ups'], ['back', 'Barbell Bent-Over Row'], ['back', 'Lat Pulldown'], ['shoulders', 'Face Pulls'], ['arms', 'Barbell Curl'], ['arms', 'Hammer Curls']]],
    [3, 'Legs A', [['quads', 'Barbell Back Squat'], ['hamstrings', 'Romanian Deadlift'], ['quads', 'Leg Press'], ['hamstrings', 'Lying Leg Curl'], ['calves', 'Standing Calf Raise'], ['core', 'Hanging Leg Raises']]],
    [4, 'Push B', [['shoulders', 'Barbell Overhead Press'], ['chest', 'Flat Dumbbell Bench Press'], ['chest', 'Machine Chest Press'], ['shoulders', 'Cable Lateral Raise'], ['arms', 'Overhead DB Extension'], ['core', 'Lying Leg Raise']]],
    [5, 'Pull B', [['back', 'Dumbbell Row'], ['back', 'Close-Grip Pulldown'], ['back', 'Seated Cable Row'], ['shoulders', 'Rear Delt DB Fly'], ['arms', 'EZ-Bar Curl'], ['arms', 'Incline DB Curl']]],
    [6, 'Legs B', [['glutes', 'Barbell Hip Thrust'], ['quads', 'Hack Squat'], ['hamstrings', 'Dumbbell RDL'], ['quads', 'Bulgarian Split Squat'], ['calves', 'Seated Calf Raise'], ['core', 'Hanging Knee Raise']]],
    [7, 'Core & Accessories', [['core', 'Plank'], ['glutes', 'Glute Bridge'], ['core', 'Dead Bug'], ['shoulders', 'Face Pulls'], ['core', 'Russian Twists'], ['calves', 'Tibialis Raise']]]
  ]
};
/* sets × reps and rest per goal: [main lifts, accessories] */
const DOSE = {
  muscle: [{ sets: 4, reps: '6–8', rest: 120 }, { sets: 3, reps: '8–12', rest: 90 }],
  strength: [{ sets: 4, reps: '4–6', rest: 150 }, { sets: 3, reps: '6–8', rest: 120 }],
  lean: [{ sets: 3, reps: '10–12', rest: 75 }, { sets: 3, reps: '12–15', rest: 60 }],
  general: [{ sets: 3, reps: '8–10', rest: 90 }, { sets: 3, reps: '10–12', rest: 75 }]
};
/* ---- setup answers that shape the plan ---- */
const FOCUS = [['glutes', '🍑', 'Glutes', ['glutes']], ['legs', '🦵', 'Legs', ['quads', 'hamstrings']], ['chest', '🫁', 'Chest', ['chest']], ['back', '🪽', 'Back', ['back']], ['shoulders', '🤸', 'Shoulders', ['shoulders']], ['arms', '💪', 'Arms', ['arms']], ['core', '🎯', 'Core', ['core']]];
const EQUIP = [['gym', '🏟️', 'Full gym', 'Barbells, machines and cables'], ['home', '🏠', 'Dumbbells at home', 'Dumbbells and a bench'], ['body', '🤸', 'No equipment', 'Bodyweight only, anywhere']];
const MINS = [[30, '30 min', 4], [45, '45 min', 5], [60, '60 min', 6], [90, '90 min', 8]]; // session length → exercises per day
const DEFAULT_WDS = { 1: [1], 2: [1, 4], 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 4, 5], 6: [1, 2, 3, 4, 5, 6], 7: [1, 2, 3, 4, 5, 6, 7] };
const WD_MIN = 1, WD_MAX = 7; // any number of days: the person decides
/* what each exercise needs, judged from its name */
const GYM_RE = /barbell|leg press|hack squat|pendulum|smith|belt squat|box squat|front squat|leg extension|leg curl|single-leg curl|deadlift|good morning|cable|back extension|reverse hyper|glute-ham|nordic|stability ball|machine|bench press|decline|hammer strength|pec deck|landmine|svend|pulldown|pull-ups?|chin-ups?|pendlay|chest-supported|t-bar|seal row|meadows|inverted row|rope (hammer|pullover)|\(rope\)|rack pull|face pulls|ez-bar|preacher|spider|pushdown|skull|chest dips|tricep dips|seated calf|donkey calf|leg press calf|hanging|captain|ab wheel|treadmill|stairmaster|elliptical|bike|rowing machine|sled|battle|kettlebell/i;
const DB_RE = /dumbbell|\bdb\b/i;
const LOAD_RE = /dumbbell|\bdb\b|goblet|arnold|lateral raise|front raise|y-raise|upright row|hammer curl|concentration|renegade|rdl|russian twist|weighted|swings|thrusters|overhead|band/i;
const needsGym = n => GYM_RE.test(n) && !DB_RE.test(n);
const fitsEquip = (n, equip) => equip === 'gym' || (!needsGym(n) && (equip === 'home' || !LOAD_RE.test(n)));
const CAT_FALLBACK = { hamstrings: 'glutes', back: 'core', shoulders: 'chest', arms: 'chest', calves: 'quads', chest: 'core', quads: 'glutes', glutes: 'quads' };

/* answers: goal, level, equip, mins (30/45/60), focus (ids from FOCUS, up to 2), wds (weekdays 1–7, Monday = 1; any number of them) */
function buildRoutine({ goal = 'general', days, wds, level = 'some', equip = 'gym', mins = 60, focus = [] } = {}) {
  wds = (wds && wds.length >= WD_MIN ? [...wds] : DEFAULT_WDS[days] || DEFAULT_WDS[4]).filter(d => d >= 1 && d <= 7).sort((a, b) => a - b).slice(0, WD_MAX);
  const split = SPLITS[wds.length] || SPLITS[4], used = new Set();
  let dose = DOSE[goal] || DOSE.general;
  if (equip === 'body') dose = [{ sets: dose[0].sets, reps: '10–15', rest: 60 }, { sets: 3, reps: '15–20', rest: 45 }]; // no load to add, so more reps
  const perDay = Math.min((MINS.find(m => m[0] === mins) || MINS[2])[2], level === 'new' ? 5 : 6);
  const focusCats = FOCUS.filter(f => focus.includes(f[0])).flatMap(f => f[3]);
  const opt = o => ({ n: o.n, pat: o.pat, cues: o.cues || [] });
  const free = o => !used.has(o.n.toLowerCase()) && fitsEquip(o.n, equip);
  const poolFor = cat => { let c = cat; for (let i = 0; i < 3; i++) { const pool = (LIB[c] || []).filter(free); if (pool.length) return pool; c = CAT_FALLBACK[c] || 'core'; } return (LIB.core || []).filter(o => fitsEquip(o.n, equip)); };
  const pick = (cat, want) => {
    const w = want && libFind(want), pool = poolFor(cat);
    const first = (w && free(w) ? w : null) || (w && pool.find(o => o.pat === w.pat)) || pool[0]; // same movement as the preferred lift when it has to change
    used.add(first.n.toLowerCase());
    let alts = pool.filter(o => o !== first).sort((a, b) => (b.pat === first.pat) - (a.pat === first.pat)).slice(0, 3); // swap options, same movement first
    if (alts.length < 3) alts = alts.concat((LIB[cat] || []).filter(o => o !== first && !alts.includes(o) && fitsEquip(o.n, equip))).slice(0, 3); // small pool: allow moves used on another day
    return [first, ...alts].map(opt);
  };
  return split.map(([, title, base], di) => {
    let slots = base.map(([cat, want]) => ({ cat, want, plus: 0 }));
    // focus areas: an extra set where the day already trains them, otherwise one focus exercise right after the main lifts
    if (focusCats.length) {
      const fc = focusCats[di % focusCats.length], hit = slots.filter(sl => focusCats.includes(sl.cat));
      if (hit.length) hit.slice(0, 2).forEach(sl => sl.plus = 1); else slots.splice(2, 0, { cat: fc, want: null, plus: 0 });
    }
    slots = slots.slice(0, perDay);
    const out = slots.map((sl, i) => {
      const d = sl.cat === 'core' || sl.cat === 'calves' ? { sets: 3, reps: equip === 'body' ? '15–20' : '12–15', rest: 60 } : dose[i < 2 ? 0 : 1];
      return { sets: Math.min(5, (level === 'new' ? Math.min(3, d.sets) : d.sets) + sl.plus), reps: d.reps, rest: d.rest, opts: pick(sl.cat, sl.want) };
    });
    if (goal === 'lean') {
      const pool = (LIB.cardio || []).filter(o => fitsEquip(o.n, equip)), c = pool[0], m = mins <= 30 ? 8 : 12;
      if (c) out.push({ sets: 1, reps: m + ' min', time: m * 60, rest: 0, opts: [c, ...pool.slice(1, 4)].map(opt) });
    }
    return { d: WD_NAMES[wds[di]], wd: wds[di], title, slots: out };
  });
}

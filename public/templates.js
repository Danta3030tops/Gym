/* Public Gym app: builds a starter routine from the exercise library (../library.js) for a goal and days per week.
   Day shape matches the couple app ({ d, title, slots: [{ sets, reps, rest, time?, opts: [{ n, pat, cues }] }] }) plus
   `wd`, the weekday the day falls on (1 = Monday … 5 = Friday), because not everyone trains five days. */
'use strict';
const GOALS = [
  ['muscle', '💪', 'Build muscle', 'Moderate weights, 8–12 reps'],
  ['strength', '🏋️', 'Get stronger', 'Heavier lifts, longer rests'],
  ['lean', '🔥', 'Lose fat & tone', 'Higher reps, short rests, cardio finisher'],
  ['general', '⚡', 'General fitness', 'A balanced mix of everything']
];
const LEVELS = [['new', 'New to the gym', 'Under 6 months of lifting'], ['some', 'Some experience', '6 months to 2 years'], ['seasoned', 'Experienced', '2+ years of steady training']];
const WD_NAMES = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
/* each slot: [category, preferred exercise]. The first two slots of a day are its main lifts. */
const SPLITS = {
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
  ]
};
/* sets × reps and rest per goal: [main lifts, accessories] */
const DOSE = {
  muscle: [{ sets: 4, reps: '6–8', rest: 120 }, { sets: 3, reps: '8–12', rest: 90 }],
  strength: [{ sets: 4, reps: '4–6', rest: 150 }, { sets: 3, reps: '6–8', rest: 120 }],
  lean: [{ sets: 3, reps: '10–12', rest: 75 }, { sets: 3, reps: '12–15', rest: 60 }],
  general: [{ sets: 3, reps: '8–10', rest: 90 }, { sets: 3, reps: '10–12', rest: 75 }]
};
function buildRoutine({ goal = 'general', days = 4, level = 'some' } = {}) {
  const split = SPLITS[days] || SPLITS[4], dose = DOSE[goal] || DOSE.general, used = new Set();
  const opt = o => ({ n: o.n, pat: o.pat, cues: o.cues || [] });
  const pick = (cat, want) => {
    const pool = LIB[cat] || [], free = o => !used.has(o.n.toLowerCase());
    const first = (libFind(want) && free(libFind(want)) ? libFind(want) : null) || pool.find(free) || pool[0];
    used.add(first.n.toLowerCase());
    // swap options: other free moves from the same group, same movement pattern first
    const alts = pool.filter(o => o !== first && free(o)).sort((a, b) => (b.pat === first.pat) - (a.pat === first.pat)).slice(0, 3);
    return [first, ...alts].map(opt);
  };
  return split.map(([wd, title, slots]) => {
    const list = level === 'new' ? slots.slice(0, 5) : slots; // fewer exercises while learning the movements
    const out = list.map(([cat, want], i) => {
      const d = cat === 'core' || cat === 'calves' ? { sets: 3, reps: '12–15', rest: 60 } : dose[i < 2 ? 0 : 1];
      return { sets: level === 'new' ? Math.min(3, d.sets) : d.sets, reps: d.reps, rest: d.rest, opts: pick(cat, want) };
    });
    if (goal === 'lean') { const c = libFind('Incline Treadmill Walk') || (LIB.cardio || [])[0]; if (c) out.push({ sets: 1, reps: '12 min', time: 720, rest: 0, opts: [c, ...(LIB.cardio || []).filter(o => o !== c).slice(0, 3)].map(opt) }); }
    return { d: WD_NAMES[wd], wd, title, slots: out };
  });
}

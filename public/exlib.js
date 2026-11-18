/* Spott: exercise library for the plan generator (plan.js). Spott only: the couple app never loads this file.
   One line per exercise:  name | figure pattern | primary muscle | movement | equipment | difficulty | stress areas | similar exercises
   movement:  hpush vpush hpull vpull squat hinge lunge core iso
   equipment: body = nothing (a floor, a sturdy table or chair) · db = dumbbells and a bench · gym = barbell, machine, cable or pull-up bar
              a dumbbell user can do body + db; a full gym can do everything
   difficulty: 1 easy to learn … 3 needs good technique
   stress areas: shoulders, lowerback, knees, wrists (an exercise that loads one of these is never given to someone who asked to avoid it)
   Names match the shared exercise library (library.js) where it has the move, so the stick figures and form cues carry over. */
'use strict';
const EX_RAW = `
Flat Barbell Bench Press|bench|chest|hpush|gym|2|shoulders,wrists|Flat Dumbbell Bench Press,Machine Chest Press,Smith Machine Bench
Flat Dumbbell Bench Press|bench|chest|hpush|db|1|shoulders|Flat Barbell Bench Press,Machine Chest Press,Push-Ups
Incline Barbell Press|bench|chest|hpush|gym|2|shoulders,wrists|Incline Dumbbell Press,Incline Machine Press,Incline Smith Press
Incline Dumbbell Press|bench|chest|hpush|db|1|shoulders|Incline Barbell Press,Incline Machine Press,Incline Push-Ups
Machine Chest Press|bench|chest|hpush|gym|1||Flat Dumbbell Bench Press,Flat Barbell Bench Press,Hammer Strength Press
Incline Machine Press|bench|chest|hpush|gym|1||Incline Dumbbell Press,Incline Smith Press,Machine Chest Press
Smith Machine Bench|bench|chest|hpush|gym|1|shoulders|Flat Barbell Bench Press,Machine Chest Press,Flat Dumbbell Bench Press
Push-Ups|plank|chest|hpush|body|1|wrists|Incline Push-Ups,Deficit Push-Ups,Flat Dumbbell Bench Press
Incline Push-Ups|plank|chest|hpush|body|1|wrists|Push-Ups,Incline Dumbbell Press,Machine Chest Press
Deficit Push-Ups|plank|chest|hpush|body|2|wrists,shoulders|Push-Ups,Flat Dumbbell Bench Press,Chest Dips
Chest Dips|dip|chest|hpush|gym|3|shoulders,wrists|Deficit Push-Ups,Machine Chest Press,Flat Barbell Bench Press
Barbell Overhead Press|ohp|shoulders|vpush|gym|3|shoulders,lowerback,wrists|Seated Dumbbell Press,Machine Shoulder Press,Arnold Press
Seated Dumbbell Press|ohp|shoulders|vpush|db|1|shoulders|Machine Shoulder Press,Arnold Press,Barbell Overhead Press
Arnold Press|ohp|shoulders|vpush|db|2|shoulders|Seated Dumbbell Press,Machine Shoulder Press,Landmine Press
Machine Shoulder Press|ohp|shoulders|vpush|gym|1|shoulders|Seated Dumbbell Press,Landmine Press,Arnold Press
Landmine Press|landmine|shoulders|vpush|gym|2||Machine Shoulder Press,Seated Dumbbell Press,Incline Dumbbell Press
Pike Push-Ups|plank|shoulders|vpush|body|2|shoulders,wrists|Seated Dumbbell Press,Push-Ups,Machine Shoulder Press
Barbell Bent-Over Row|row|back|hpull|gym|2|lowerback|Chest-Supported Row,Dumbbell Row,Seated Cable Row
Dumbbell Row|row|back|hpull|db|1||Chest-Supported Row,Seated Cable Row,Barbell Bent-Over Row
Chest-Supported Row|row|back|hpull|db|1||Dumbbell Row,Machine Row,Seated Cable Row
Seated Cable Row|seatedrow|back|hpull|gym|1||Machine Row,Chest-Supported Row,Dumbbell Row
Machine Row|seatedrow|back|hpull|gym|1||Seated Cable Row,Chest-Supported Row,Dumbbell Row
T-Bar Row|row|back|hpull|gym|2|lowerback|Barbell Bent-Over Row,Chest-Supported Row,Seated Cable Row
Inverted Row|row|back|hpull|body|2||Dumbbell Row,Seated Cable Row,Superman Hold
Pull-Ups|pullup|back|vpull|gym|3|shoulders|Lat Pulldown,Assisted Pull-Up,Chin-Ups
Chin-Ups|pullup|back|vpull|gym|3|shoulders|Pull-Ups,Close-Grip Pulldown,Lat Pulldown
Assisted Pull-Up|pullup|back|vpull|gym|1||Lat Pulldown,Pull-Ups,Close-Grip Pulldown
Lat Pulldown|pullup|back|vpull|gym|1||Close-Grip Pulldown,Assisted Pull-Up,Single-Arm Pulldown
Close-Grip Pulldown|pullup|back|vpull|gym|1||Lat Pulldown,Single-Arm Pulldown,Assisted Pull-Up
Single-Arm Pulldown|pullup|back|vpull|gym|1||Lat Pulldown,Close-Grip Pulldown,Dumbbell Pullover
Dumbbell Pullover|straightarm|back|vpull|db|2|shoulders|Straight-Arm Pulldown,Lat Pulldown,Dumbbell Row
Straight-Arm Pulldown|straightarm|back|vpull|gym|1||Lat Pulldown,Dumbbell Pullover,Close-Grip Pulldown
Superman Hold|backext|back|iso|body|1||Inverted Row,Bird Dog,Dumbbell Row
Barbell Back Squat|squat|quads|squat|gym|3|knees,lowerback|Leg Press (feet high & wide),Hack Squat,Goblet Squat
Front Squat|squat|quads|squat|gym|3|knees,wrists|Barbell Back Squat,Hack Squat,Goblet Squat
Hack Squat|squat|quads|squat|gym|2|knees|Leg Press (feet high & wide),Barbell Back Squat,Smith Machine Squat
Leg Press (feet high & wide)|legpress|quads|squat|gym|1|knees|Hack Squat,Goblet Squat,Barbell Back Squat
Smith Machine Squat|squat|quads|squat|gym|2|knees|Hack Squat,Leg Press (feet high & wide),Goblet Squat
Goblet Squat|squat|quads|squat|db|1|knees|Leg Press (feet high & wide),Bodyweight Squat,Hack Squat
Bodyweight Squat|squat|quads|squat|body|1|knees|Goblet Squat,Leg Press (feet high & wide),Wall Sit
Wall Sit|squat|quads|squat|body|1|knees|Bodyweight Squat,Goblet Squat,Leg Extension
Conventional Deadlift|hinge|hamstrings|hinge|gym|3|lowerback|Trap Bar Deadlift,Romanian Deadlift,Dumbbell RDL
Trap Bar Deadlift|hinge|hamstrings|hinge|gym|2|lowerback,knees|Conventional Deadlift,Romanian Deadlift,Dumbbell RDL
Romanian Deadlift|hinge|hamstrings|hinge|gym|2|lowerback|Dumbbell RDL,Good Morning,Cable Pull-Through
Dumbbell RDL|hinge|hamstrings|hinge|db|1|lowerback|Romanian Deadlift,Single-Leg RDL,Cable Pull-Through
Single-Leg RDL|hinge|hamstrings|hinge|db|2|lowerback|Dumbbell RDL,Romanian Deadlift,Glute Bridge
Good Morning|hinge|hamstrings|hinge|gym|3|lowerback|Romanian Deadlift,Dumbbell RDL,45° Back Extension
Cable Pull-Through|hinge|glutes|hinge|gym|1||Barbell Hip Thrust,Dumbbell RDL,45° Back Extension
45° Back Extension|hinge|hamstrings|hinge|gym|1|lowerback|Cable Pull-Through,Good Morning,Dumbbell RDL
Barbell Hip Thrust|thrust|glutes|hinge|gym|2||Hip Thrust Machine,Smith Machine Hip Thrust,Single-Leg Hip Thrust
Hip Thrust Machine|thrust|glutes|hinge|gym|1||Barbell Hip Thrust,Smith Machine Hip Thrust,Glute Bridge
Smith Machine Hip Thrust|thrust|glutes|hinge|gym|1||Barbell Hip Thrust,Hip Thrust Machine,Glute Bridge
Glute Bridge|thrust|glutes|hinge|body|1||Single-Leg Hip Thrust,Barbell Hip Thrust,Frog Pumps
Single-Leg Hip Thrust|thrust|glutes|hinge|body|2||Glute Bridge,Barbell Hip Thrust,Hip Thrust Machine
Bulgarian Split Squat|lunge|quads|lunge|db|2|knees|Reverse Lunge,Split Squat (static),Step-Ups
Reverse Lunge|lunge|quads|lunge|db|1|knees|Walking Lunges,Bulgarian Split Squat,Step-Ups
Walking Lunges|lunge|quads|lunge|db|2|knees|Reverse Lunge,Bulgarian Split Squat,Step-Ups
Step-Ups|lunge|quads|lunge|db|1|knees|Reverse Lunge,Bulgarian Split Squat,Split Squat (static)
Split Squat (static)|lunge|quads|lunge|body|1|knees|Reverse Lunge,Bulgarian Split Squat,Step-Ups
Smith Machine Lunge|lunge|quads|lunge|gym|2|knees|Reverse Lunge,Bulgarian Split Squat,Walking Lunges
Leg Extension|legext|quads|iso|gym|1|knees|Sissy Squat,Goblet Squat,Leg Press (feet high & wide)
Sissy Squat|squat|quads|iso|body|3|knees|Leg Extension,Bodyweight Squat,Wall Sit
Lying Leg Curl|legcurl|hamstrings|iso|gym|1||Seated Leg Curl,Stability Ball Leg Curl,Nordic Curl
Seated Leg Curl|legcurl|hamstrings|iso|gym|1||Lying Leg Curl,Stability Ball Leg Curl,Nordic Curl
Nordic Curl|legcurl|hamstrings|iso|body|3|knees|Lying Leg Curl,Seated Leg Curl,Stability Ball Leg Curl
Stability Ball Leg Curl|legcurl|hamstrings|iso|gym|1||Lying Leg Curl,Seated Leg Curl,Glute Bridge
Cable Glute Kickback|kickback|glutes|iso|gym|1||Glute Kickback Machine,Donkey Kicks,Hip Abduction Machine
Donkey Kicks|kickback|glutes|iso|body|1||Cable Glute Kickback,Fire Hydrants,Glute Bridge
Frog Pumps|thrust|glutes|iso|body|1||Glute Bridge,Donkey Kicks,Fire Hydrants
Hip Abduction Machine|abduct|glutes|iso|gym|1||Cable Hip Abduction,Fire Hydrants,Side-Lying Leg Raise
Fire Hydrants|abduct|glutes|iso|body|1||Side-Lying Leg Raise,Hip Abduction Machine,Donkey Kicks
Side-Lying Leg Raise|abduct|glutes|iso|body|1||Fire Hydrants,Hip Abduction Machine,Cable Hip Abduction
Standing Calf Raise|calf|calves|iso|gym|1||Seated Calf Raise,Single-Leg DB Calf Raise,Leg Press Calf Press
Seated Calf Raise|calf|calves|iso|gym|1||Standing Calf Raise,Leg Press Calf Press,Single-Leg DB Calf Raise
Single-Leg DB Calf Raise|calf|calves|iso|db|1||Standing Calf Raise,Seated Calf Raise,Bodyweight Calf Raise
Bodyweight Calf Raise|calf|calves|iso|body|1||Single-Leg DB Calf Raise,Standing Calf Raise,Seated Calf Raise
DB Lateral Raise|latraise|sidedelt|iso|db|1|shoulders|Cable Lateral Raise,Machine Lateral Raise,Seated Lateral Raise
Cable Lateral Raise|latraise|sidedelt|iso|gym|1|shoulders|DB Lateral Raise,Machine Lateral Raise,Lean-Away Lateral Raise
Machine Lateral Raise|latraise|sidedelt|iso|gym|1|shoulders|DB Lateral Raise,Cable Lateral Raise,Seated Lateral Raise
Seated Lateral Raise|latraise|sidedelt|iso|db|1|shoulders|DB Lateral Raise,Cable Lateral Raise,Machine Lateral Raise
Face Pulls|facepull|reardelt|iso|gym|1||Rear Delt DB Fly,Reverse Pec Deck,Band Pull-Apart
Rear Delt DB Fly|row|reardelt|iso|db|1||Face Pulls,Reverse Pec Deck,Band Pull-Apart
Reverse Pec Deck|fly|reardelt|iso|gym|1||Face Pulls,Rear Delt DB Fly,Band Pull-Apart
Band Pull-Apart|facepull|reardelt|iso|body|1||Rear Delt DB Fly,Face Pulls,Superman Hold
Cable Flyes|fly|chest|iso|gym|1|shoulders|Pec Deck,Dumbbell Flyes,Low-to-High Cable Fly
Pec Deck|fly|chest|iso|gym|1|shoulders|Cable Flyes,Dumbbell Flyes,Low-to-High Cable Fly
Dumbbell Flyes|fly|chest|iso|db|1|shoulders|Cable Flyes,Pec Deck,Svend Press
Barbell Curl|curl|biceps|iso|gym|1|wrists|EZ-Bar Curl,Dumbbell Curl,Cable Curl
EZ-Bar Curl|curl|biceps|iso|gym|1||Barbell Curl,Dumbbell Curl,Preacher Curl
Dumbbell Curl|curl|biceps|iso|db|1||Hammer Curls,Incline DB Curl,EZ-Bar Curl
Hammer Curls|curl|biceps|iso|db|1||Dumbbell Curl,Rope Hammer Curl,Cable Curl
Incline DB Curl|curl|biceps|iso|db|2|shoulders|Dumbbell Curl,Spider Curl,Cable Curl
Cable Curl|curl|biceps|iso|gym|1||EZ-Bar Curl,Dumbbell Curl,Preacher Curl
Preacher Curl|curl|biceps|iso|gym|1||EZ-Bar Curl,Spider Curl,Cable Curl
Tricep Pushdown (rope)|pushdown|triceps|iso|gym|1||Straight-Bar Pushdown,Overhead Cable Extension,Overhead DB Extension
Straight-Bar Pushdown|pushdown|triceps|iso|gym|1|wrists|Tricep Pushdown (rope),Overhead Cable Extension,Close-Grip Bench Press
Overhead Cable Extension|ohext|triceps|iso|gym|1|shoulders|Overhead DB Extension,Tricep Pushdown (rope),Skull Crushers
Overhead DB Extension|ohext|triceps|iso|db|1|shoulders|Overhead Cable Extension,Skull Crushers,Tricep Pushdown (rope)
Skull Crushers|skull|triceps|iso|gym|2|wrists|Overhead DB Extension,Tricep Pushdown (rope),Close-Grip Bench Press
Bench Dips|dip|triceps|iso|body|1|shoulders,wrists|Diamond Push-Ups,Overhead DB Extension,Tricep Pushdown (rope)
Diamond Push-Ups|plank|triceps|iso|body|2|wrists|Bench Dips,Overhead DB Extension,Tricep Pushdown (rope)
Close-Grip Bench Press|bench|triceps|hpush|gym|2|shoulders,wrists|Skull Crushers,Tricep Pushdown (rope),Diamond Push-Ups
Plank|plank|core|core|body|1||Dead Bug,Side Plank,Hollow Body Hold
Side Plank|sideplank|core|core|body|1|shoulders|Plank,Pallof Press,Dead Bug
Dead Bug|deadbug|core|core|body|1||Bird Dog,Plank,Lying Leg Raise
Bird Dog|deadbug|core|core|body|1||Dead Bug,Plank,Superman Hold
Lying Leg Raise|lyingraise|core|core|body|1|lowerback|Reverse Crunch,Hanging Knee Raise,Dead Bug
Reverse Crunch|legraise|core|core|body|1||Lying Leg Raise,Hanging Knee Raise,Dead Bug
Hanging Knee Raise|legraise|core|core|gym|2|shoulders|Captain's Chair Knee Raise,Reverse Crunch,Hanging Leg Raises
Hanging Leg Raises|legraise|core|core|gym|3|shoulders|Hanging Knee Raise,Captain's Chair Knee Raise,Lying Leg Raise
Weighted Cable Crunch|crunch|core|core|gym|1||Ab Crunch Machine,Decline Weighted Sit-Up,Reverse Crunch
Ab Wheel Rollout|plank|core|core|gym|3|lowerback,shoulders|Plank,Dead Bug,Hollow Body Hold
Hollow Body Hold|deadbug|core|core|body|2|lowerback|Dead Bug,Plank,V-Ups
Pallof Press|twist|core|core|gym|1||Side Plank,Cable Woodchopper,Dead Bug
Russian Twists|twist|core|core|body|1|lowerback|Bicycle Crunches,Pallof Press,Dead Bug
Bicycle Crunches|deadbug|core|core|body|1||Russian Twists,Dead Bug,Reverse Crunch
`;
const EX_HOLD = { 'Plank': 40, 'Side Plank': 30, 'Hollow Body Hold': 30, 'Wall Sit': 40, 'Superman Hold': 30 }; // timed holds: seconds per set
const EX_CUE = { // form cues for the moves the shared library doesn't have
  'Flat Barbell Bench Press': ['Shoulder blades pinned back', 'Bar to lower chest, press up and slightly back'],
  'Pike Push-Ups': ['Hips high, body in an upside-down V', 'Lower the top of your head toward the floor'],
  'Pull-Ups': ['Start from a dead hang', 'Pull your chest to the bar, elbows to your sides'],
  'Superman Hold': ['Lie face down, arms overhead', 'Lift arms, chest and legs a few inches and hold'],
  'Bodyweight Squat': ['Feet shoulder width, sit back and down', 'Knees track over your toes'],
  'Wall Sit': ['Back flat on the wall, thighs level with the floor', 'Hold and breathe'],
  'Romanian Deadlift': ['Soft knees, push your hips back', 'Bar close to your legs, flat back'],
  'Barbell Hip Thrust': ['Upper back on the bench, bar over your hips', 'Drive through your heels, squeeze at the top'],
  'Bodyweight Calf Raise': ['Balls of your feet on a step', 'Full stretch down, pause at the top'],
  'Standing Calf Raise': ['Full stretch at the bottom', 'Pause at the top'],
  'Barbell Curl': ['Elbows pinned to your sides', 'No swinging'],
  'Hanging Leg Raises': ['Hang still, no swinging', 'Lift your legs with your abs, lower slowly']
};
const EX = EX_RAW.trim().split('\n').map(l => {
  const [n, pat, m, mv, eq, d, st, sim] = l.split('|');
  return { n, pat, m, mv, eq, d: +d, st: st ? st.split(',') : [], sim: sim ? sim.split(',') : [], hold: EX_HOLD[n] || 0 };
});
const EXN = Object.fromEntries(EX.map(e => [e.n.toLowerCase(), e]));
const exMeta = n => EXN[String(n || '').toLowerCase()] || null;

/* ---------- movement patterns: two poses (A = start, B = end of first phase) ---------- */
const P = {
 squat:{A:{h:[60,18],s:[60,30],e:[50,36],w:[56,30],p:[60,62],k:[61,86],f:[60,110]},B:{h:[74,46],s:[67,57],e:[57,63],w:[63,57],p:[42,80],k:[70,84]},props:['floor','barbell:s'],tempo:[3,1,1],ph:['Sit down','Hold','Drive up']},
 hinge:{A:{h:[60,18],s:[60,30],e:[62,46],w:[64,62],p:[60,62],k:[61,86],f:[60,110]},B:{h:[90,44],s:[80,50],e:[80,66],w:[80,82],p:[50,62],k:[57,86],f:[58,110]},props:['floor','barbell:w'],tempo:[3,0,1],ph:['Hips back','','Squeeze up']},
 lunge:{A:{h:[60,18],s:[60,30],e:[60,46],w:[60,60],p:[60,62],k:[62,86],f:[60,110],k2:[58,86],f2:[60,110]},B:{h:[60,40],s:[60,52],e:[60,68],w:[60,82],p:[60,84],k:[80,86],f:[80,110],k2:[50,108],f2:[32,110]},props:['floor','db:w'],tempo:[2,1,1],ph:['Step & drop','Hold','Drive up']},
 legcurl:{A:{h:[18,66],s:[30,72],e:[32,82],w:[40,80],p:[70,72],k:[94,72],f:[114,72]},B:{f:[100,50]},props:['floor','bench:22:100:78'],tempo:[1,1,3],ph:['Curl','Squeeze','Lower slow']},
 thrust:{A:{h:[20,62],s:[30,70],e:[44,80],w:[56,92],p:[56,98],k:[78,84],f:[86,110]},B:{e:[44,72],w:[58,74],p:[58,74],k:[80,76]},props:['floor','bench:8:32:70','barbell:w'],tempo:[1,2,2],ph:['Hips up','Squeeze','Lower']},
 calf:{A:{h:[60,18],s:[60,30],e:[60,46],w:[60,60],p:[60,62],k:[60,86],f:[58,108],t:[70,108]},B:{h:[60,10],s:[60,22],e:[60,38],w:[60,52],p:[60,54],k:[60,78],f:[60,100]},props:['floor','step','db:w'],tempo:[1,2,2],ph:['Rise','Hold top','Lower slow']},
 bench:{A:{h:[16,70],s:[28,74],e:[30,58],w:[30,42],p:[72,74],k:[90,72],f:[98,110]},B:{e:[20,84],w:[30,66]},props:['floor','bench:14:86:78','barbell:w'],tempo:[3,1,1],ph:['Lower to chest','Pause','Press']},
 ohp:{A:{h:[60,18],s:[60,30],e:[48,38],w:[54,24],p:[60,62],k:[61,86],f:[60,110]},B:{e:[58,10],w:[60,-6]},props:['floor','db:w'],tempo:[1,1,2],ph:['Press up','Lockout','Lower']},
 landmine:{A:{h:[58,20],s:[58,32],e:[50,44],w:[62,36],p:[56,62],k:[58,86],f:[56,110]},B:{e:[74,24],w:[88,14]},props:['floor','landmine:w'],tempo:[1,1,2],ph:['Press','Squeeze','Lower']},
 row:{A:{h:[90,40],s:[80,46],e:[80,62],w:[80,78],p:[50,64],k:[58,86],f:[56,110]},B:{e:[64,46],w:[72,62]},props:['floor','db:w'],tempo:[1,1,2],ph:['Row','Squeeze','Lower']},
 seatedrow:{A:{h:[56,48],s:[54,60],e:[70,66],w:[88,70],p:[48,90],k:[74,80],f:[94,90]},B:{h:[50,48],s:[48,60],e:[34,68],w:[52,72]},props:['seat','cable:w:118:72'],tempo:[1,1,2],ph:['Pull','Squeeze','Return']},
 pullup:{A:{h:[60,30],s:[60,40],e:[62,20],w:[62,2],p:[60,72],k:[62,92],f:[62,110]},B:{h:[60,4],s:[60,16],e:[44,12],p:[60,48],k:[62,68],f:[62,86]},props:['pullbar'],tempo:[1,1,2],ph:['Pull up','Chin over','Lower']},
 straightarm:{A:{h:[66,22],s:[62,34],e:[76,24],w:[88,14],p:[56,64],k:[57,86],f:[56,110]},B:{e:[70,50],w:[68,64]},props:['floor','cable:w:116:-6'],tempo:[1,1,2],ph:['Pull down','Squeeze','Return']},
 facepull:{A:{h:[60,20],s:[60,32],e:[76,34],w:[92,30],p:[58,62],k:[59,86],f:[58,110]},B:{e:[54,24],w:[70,20]},props:['floor','cable:w:118:26'],tempo:[1,1,2],ph:['Pull to face','Squeeze','Return']},
 curl:{A:{h:[60,18],s:[60,30],e:[60,48],w:[62,64],p:[60,62],k:[61,86],f:[60,110]},B:{w:[72,34]},props:['floor','db:w'],tempo:[1,1,3],ph:['Curl','Squeeze','Lower slow']},
 legpress:{A:{h:[18,52],s:[24,62],e:[34,74],w:[42,80],p:[44,86],k:[56,56],f:[78,66]},B:{k:[72,66],f:[100,56]},props:['lpseat','platform:f'],tempo:[3,1,1],ph:['Lower slow','Pause','Press']},
 legraise:{A:{h:[60,30],s:[60,40],e:[62,20],w:[62,2],p:[60,72],k:[62,92],f:[62,110]},B:{k:[80,70],f:[102,70]},props:['pullbar'],tempo:[1,1,2],ph:['Raise','Hold','Lower slow']},
 crunch:{A:{h:[66,40],s:[62,52],e:[72,52],w:[68,42],p:[56,80],k:[56,108],f:[30,110]},B:{h:[90,84],s:[82,76],e:[88,90],w:[94,82]},props:['floor','cable:w:80:-6'],tempo:[1,1,2],ph:['Crunch','Squeeze','Return']},
 twist:{A:{h:[38,54],s:[42,66],e:[56,74],w:[64,84],p:[52,96],k:[72,80],f:[90,88]},B:{h:[36,56],s:[40,68],e:[30,80],w:[40,90]},props:['floor','plate:w'],tempo:[1,0,1],ph:['Twist','','Twist back']},
 plank:{A:{h:[20,84],s:[30,90],e:[30,108],w:[42,108],p:[66,94],k:[86,101],f:[106,108]},B:{h:[20,66],s:[30,72],e:[30,90],w:[30,108],p:[66,84],k:[86,96]},props:['floor'],tempo:[2,1,2],ph:['Push up','Hold','Back down']},
 fly:{A:{h:[60,18],s:[60,30],e:[46,30],w:[34,26],p:[60,62],k:[61,86],f:[60,110]},B:{e:[74,38],w:[86,44]},props:['floor','cable:w:4:8'],tempo:[1,1,2],ph:['Squeeze in','Hold','Open slow']},
 dip:{A:{h:[62,26],s:[60,38],e:[60,50],w:[60,62],p:[58,70],k:[60,92],f:[46,98]},B:{h:[66,44],s:[62,56],e:[46,52],p:[58,86],k:[60,106],f:[46,112]},props:['dipbars'],tempo:[2,1,1],ph:['Lower','Stretch','Press up']}
};
for(const k in P){P[k].B={...P[k].A,...P[k].B};}

/* ---------- routine ---------- */
const X=(n,pat,cues)=>({n,pat,cues});
const DAYS_KING=[
{d:'Mon',title:'Legs: Quads',slots:[
 {sets:4,reps:'6–8',rest:150,opts:[
  X('Barbell Back Squat','squat',['Bar on upper traps, brace your core before every rep','Knees track over toes, hit at least parallel','Drive through mid-foot, chest stays up']),
  X('Hack Squat','squat',['Feet mid-platform, shoulder width','Control the descent, go deep','Don\'t slam the knees locked at the top']),
  X('Goblet Squat','squat',['Hold the DB tight at your chest','Elbows inside the knees at the bottom','Sit straight down between your hips']),
  X('Smith Machine Squat','squat',['Feet slightly in front of the bar','Full depth, steady tempo','Good one to train heavy without a spotter'])]},
 {sets:3,reps:'10–12',rest:120,opts:[
  X('Leg Press','legpress',['Feet shoulder-width in the middle of the platform','Lower until the knees are ~90°, lower back stays on the pad','Press through the whole foot, don\'t lock the knees']),
  X('Hack Squat','squat',['Feet mid-platform','Go deep, control the descent']),
  X('Goblet Squat','squat',['Upright torso, elbows inside the knees']),
  X('Smith Machine Squat','squat',['Feet slightly forward','Full depth'])]},
 {sets:3,reps:'10 per leg',rest:90,opts:[
  X('Walking Lunges','lunge',['Long stride, torso upright','Back knee drops to just above the floor','Push through the front heel']),
  X('Bulgarian Split Squat','lunge',['Rear foot up on a bench','Front foot far enough out that the knee stays over the ankle','Drop straight down, drive up through the front heel']),
  X('Reverse Lunge','lunge',['Step back instead of forward, easier on the knees','Keep most of the weight in the front leg','Control the step back']),
  X('Step-Ups','lunge',['Box around knee height','Drive through the top leg only, no bouncing off the back foot','Control on the way down'])]},
 {sets:3,reps:'12',rest:75,opts:[
  X('Lying Leg Curl','legcurl',['Hips pressed into the pad','Curl all the way, squeeze 1 sec','2–3 seconds down']),
  X('Seated Leg Curl','legcurl',['Thigh pad snug, back against the seat','Full curl, slow return','Point toes up for more hamstring']),
  X('Nordic Curl','legcurl',['Anchor your heels under something solid','Lower as slowly as you can','Push off the floor to come back up']),
  X('Stability Ball Leg Curl','legcurl',['Lie on your back, heels on the ball','Lift hips and keep them up','Roll the ball in, then out slowly'])]},
 {sets:4,reps:'15',rest:60,opts:[
  X('Standing Calf Raise','calf',['Balls of feet on a step','Full stretch at the bottom','Hold 1 sec at the top, no bouncing']),
  X('Seated Calf Raise','calf',['Hits the soleus (lower calf)','Slow and full range']),
  X('Leg Press Calf Press','calf',['Toes on the bottom edge of the platform','Don\'t lock the knees hard']),
  X('Single-Leg DB Calf Raise','calf',['Hold a DB on the same side','Balance with your other hand','Slow and controlled'])]},
 {sets:3,reps:'10–15',rest:60,opts:[
  X('Hanging Leg Raises','legraise',['Dead hang, no swinging','Curl your pelvis up, don\'t just lift the legs','Lower slowly for the lower abs']),
  X('Captain\'s Chair Knee Raise','legraise',['Back against the pad','Knees to chest, curl the hips']),
  X('Lying Leg Raise','legraise',['Lower back pressed to the floor','Lower until just before the back arches']),
  X('Reverse Crunch','legraise',['On your back, knees bent','Roll your hips off the floor toward your chest'])]}
]},
{d:'Tue',title:'Push: Chest, Shoulders & Triceps',slots:[
 {sets:4,reps:'6–8',rest:150,opts:[
  X('Flat Barbell Bench Press','bench',['Shoulder blades pinned back and down','Bar touches lower chest, elbows ~45°','Feet planted, drive the bar up and slightly back']),
  X('Flat Dumbbell Bench Press','bench',['DBs start over the shoulders','Lower until you feel a deep chest stretch','Press up and slightly together']),
  X('Machine Chest Press','bench',['Seat height: handles at mid-chest','Great for pushing near failure safely']),
  X('Smith Machine Bench','bench',['Bar lines up with lower chest','Same setup as barbell, just more stable'])]},
 {sets:3,reps:'8–10',rest:120,opts:[
  X('Incline Dumbbell Press','inclinepress',['After flat pressing, this hits the upper chest','Bench at 30°, lower to the upper chest','Press up and slightly together']),
  X('Incline Barbell Press','inclinepress',['Bench at 30°, bar touches just under the collarbone']),
  X('Incline Machine Press','inclinepress',['Push near failure safely']),
  X('Flat Bench Press','bench',['Controlled descent, explosive press'])]},
 {sets:3,reps:'8–10',rest:105,opts:[
  X('Seated DB Shoulder Press','ohp',['Back flat against the bench','Press up, don\'t clank the DBs together','Lower to ear level']),
  X('Arnold Press','ohp',['Start palms facing you, rotate as you press']),
  X('Machine Shoulder Press','ohp',['Seat height: handles at shoulder level']),
  X('Standing DB Press','ohp',['Squeeze your glutes and abs, no leaning back'])]},
 {sets:3,reps:'12–15',rest:45,opts:[
  X('DB Lateral Raise','latraise',['Slight bend in the elbows','Lead with your elbows to shoulder height, not higher','Light weight, slow lower. This builds shoulder width']),
  X('Cable Lateral Raise','latraise',['Cable at the bottom, cross-body','Constant tension']),
  X('Seated Lateral Raise','latraise',['Removes swinging and cheating']),
  X('Lean-Away Lateral Raise','latraise',['Hold a pole, lean away, one arm at a time'])]},
 {sets:3,reps:'12',rest:60,opts:[
  X('Cable Flyes + Tricep Pushdown (rope)','fly',['SUPERSET: flyes, then pushdowns at the next cable','Flyes: soft elbows, hug a tree, squeeze','Pushdowns: elbows pinned, spread the rope at the bottom']),
  X('Pec Deck + Straight-Bar Pushdown','seatedfly',['Superset','Slow on the way back on the pec deck']),
  X('Dumbbell Flyes + Tricep Dips','fly',['Superset','Stop the flyes at a comfortable stretch'])]}
]},
{d:'Wed',title:'Pull: Back & Biceps',slots:[
 {sets:4,reps:'8–10',rest:120,opts:[
  X('Pull-Ups','pullup',['Full dead hang at the bottom','Drive elbows down to your back pockets','Chest to the bar, add weight once 10 reps is easy']),
  X('Lat Pulldown','pullup',['Thighs locked under the pad','Pull to the upper chest, lean back slightly','Control the bar up']),
  X('Assisted Pull-Up','pullup',['Use the least assistance you can','Full range of motion']),
  X('Chin-Ups','pullup',['Palms facing you','More biceps involvement'])]},
 {sets:4,reps:'8–10',rest:120,opts:[
  X('Barbell Bent-Over Row','row',['Hinge to ~45°, back flat','Pull to the belly button','Your main back thickness builder']),
  X('Pendlay Row','row',['Torso parallel, bar starts on the floor each rep','Explosive pull']),
  X('T-Bar Row','row',['Chest up, pull the handle to your stomach']),
  X('Chest-Supported Row','row',['Zero lower-back stress'])]},
 {sets:3,reps:'10–12',rest:90,opts:[
  X('Seated Cable Row (close grip)','seatedrow',['Sit tall','Squeeze the shoulder blades together, pause 1 sec','Let the shoulders stretch forward on the return']),
  X('Machine Row','seatedrow',['Chest on the pad','Drive elbows straight back']),
  X('Single-Arm Cable Row','seatedrow',['Rotate slightly into the pull']),
  X('Inverted Row','row',['Bar at waist height, body straight','Pull chest to the bar'])]},
 {sets:3,reps:'12–15',rest:60,opts:[
  X('Straight-Arm Pulldown + Face Pulls','straightarm',['SUPERSET: lats, then rear delts. Both on cables, side by side','Pulldown: arms locked, sweep the bar to your thighs','Face pulls: pull to your eyes, elbows high']),
  X('Rope Pullover + Band Pull-Apart','straightarm',['Superset','Flare the rope out at the bottom']),
  X('Dumbbell Pullover + Reverse Pec Deck','straightarm',['Superset','Big stretch overhead on the pullover'])]},
 {sets:3,reps:'10–12',rest:60,opts:[
  X('Hammer Curls + Preacher Curl','curl',['SUPERSET: two curl angles back to back for full biceps and forearms','Hammers: palms facing, slow on the way down','Preacher: armpit snug on the pad, don\'t lock out at the bottom']),
  X('Rope Hammer Curl + Cable Curl','curl',['Superset','Constant tension from the cable']),
  X('Cross-Body Hammer Curl + Spider Curl','curl',['Superset','Spider curls: chest on an incline bench, arms hanging'])]},
 {sets:3,reps:'12–15',rest:60,opts:[
  X('Weighted Cable Crunch','crunch',['Kneel, rope beside your head','Crunch your ribs toward your hips, don\'t pull with the arms','Hips stay still']),
  X('Decline Weighted Sit-Up','crunch',['Plate on your chest','Curl up one vertebra at a time']),
  X('Ab Crunch Machine','crunch',['Heavy and controlled','Squeeze hard at the bottom']),
  X('Ab Wheel Rollout','plank',['Kneel, roll out as far as you can with a flat back','Pull back with the abs'])]}
]},
{d:'Thu',title:'Legs: Glutes & Hamstrings',slots:[
 {sets:4,reps:'8–10',rest:150,opts:[
  X('Romanian Deadlift','hinge',['Soft knees, push your hips straight back','Bar slides down your thighs, back flat','Stop when the hamstrings are stretched, then squeeze glutes up']),
  X('Dumbbell RDL','hinge',['DBs close to your legs the whole time','Hips back, not down','Feel the hamstring stretch, don\'t chase the floor']),
  X('Good Morning','hinge',['Bar on upper back, slight knee bend','Hinge until the torso is near parallel','Go lighter than you think']),
  X('Cable Pull-Through','hinge',['Face away from the low pulley, rope between legs','Hips back, then snap them forward','Squeeze glutes hard at the top'])]},
 {sets:4,reps:'8–12',rest:120,opts:[
  X('Barbell Hip Thrust','thrust',['Upper back on the bench edge, bar padded over hips','Chin tucked, drive hips until the body is flat','Pause and squeeze at the top']),
  X('Smith Machine Hip Thrust','thrust',['Same setup, more stable bar path','Feet flat, shins vertical at the top']),
  X('Glute Bridge','thrust',['Shoulders on the floor, weight on the hips','Drive through heels','2 sec squeeze at the top']),
  X('Single-Leg Hip Thrust','thrust',['Bodyweight or a DB on the hip','Keep the pelvis level','Great for fixing side-to-side imbalance'])]},
 {sets:3,reps:'10 per leg',rest:90,opts:[
  X('Bulgarian Split Squat','lunge',['Rear foot up on a bench','Front foot far enough out that the knee stays over the ankle','Drop straight down, drive up through the front heel']),
  X('Walking Lunges','lunge',['Long stride, torso upright','Back knee drops to just above the floor','Push through the front heel']),
  X('Reverse Lunge','lunge',['Step back instead of forward, easier on the knees','Keep most of the weight in the front leg','Control the step back']),
  X('Step-Ups','lunge',['Box around knee height','Drive through the top leg only, no bouncing off the back foot','Control on the way down'])]},
 {sets:3,reps:'10–12',rest:75,opts:[
  X('Seated Leg Curl','legcurl',['Thigh pad snug, back against the seat','Full curl, slow return','Point toes up for more hamstring']),
  X('Lying Leg Curl','legcurl',['Hips pressed into the pad','Curl all the way, squeeze 1 sec','2–3 seconds down']),
  X('Nordic Curl','legcurl',['Anchor your heels under something solid','Lower as slowly as you can','Push off the floor to come back up']),
  X('Stability Ball Leg Curl','legcurl',['Lie on your back, heels on the ball','Lift hips and keep them up','Roll the ball in, then out slowly'])]},
 {sets:3,reps:'15',rest:60,opts:[
  X('Seated Calf Raise','calf',['Hits the soleus (lower calf)','Slow and full range']),
  X('Standing Calf Raise','calf',['Balls of feet on a step','Full stretch at the bottom','Hold 1 sec at the top, no bouncing']),
  X('Leg Press Calf Press','calf',['Toes on the bottom edge of the platform','Don\'t lock the knees hard']),
  X('Single-Leg DB Calf Raise','calf',['Hold a DB on the same side','Balance with your other hand','Slow and controlled'])]},
 {sets:3,reps:'15 per side',rest:60,opts:[
  X('Decline Russian Twist','twist',['Plate or DB held at your chest','Rotate through your torso, not just your arms','Feet anchored, controlled pace']),
  X('Cable Woodchopper','twist',['Cable high, chop down across your body','Pivot the back foot']),
  X('Landmine Rotation','twist',['Arms straight, move the bar end in an arc','Rotate the hips with it']),
  X('Seated Russian Twist','twist',['Feet off the floor for a harder version'])]}
]},
{d:'Fri',title:'Upper: Arms & Shoulders',slots:[
 {sets:3,reps:'8–10',rest:105,opts:[
  X('Close-Grip Bench Press','bench',['Hands just inside shoulder width, not touching','Elbows tucked close to your sides','Your heaviest tricep builder, it hits chest too']),
  X('Chest Dips','dip',['Stay more upright to bias the triceps','Lower until the shoulders are just below the elbows']),
  X('Diamond Push-Ups','pushup',['Hands together under your chest','Elbows brush your sides']),
  X('Landmine Press','landmine',['Press up and forward, follow the arc'])]},
 {sets:3,reps:'8–10',rest:75,opts:[
  X('Dumbbell Row + Overhead DB Press','row',['SUPERSET: row, then straight into the press. Pull and push muscles rest while the other works, so you save time','Row the DB to your hip, squeeze 1 sec','Press straight up, brace abs, no leaning back']),
  X('Chest-Supported Row + Seated Dumbbell Press','row',['Superset','Chest on an incline bench for the row','Back on a near-upright bench for the press']),
  X('Seated Cable Row + Arnold Press','seatedrow',['Superset','Squeeze the shoulder blades on the row','Rotate out as you press'])]},
 {sets:3,reps:'10–12',rest:90,opts:[
  X('Lat Pulldown','pullup',['Thighs locked under the pad','Pull to the upper chest, lean back slightly','Control the bar up']),
  X('Pull-Ups','pullup',['Full dead hang at the bottom','Drive elbows down to your back pockets','Chest to the bar, add weight once 10 reps is easy']),
  X('Assisted Pull-Up','pullup',['Use the least assistance you can','Full range of motion']),
  X('Chin-Ups','pullup',['Palms facing you','More biceps involvement'])]},
 {sets:3,reps:'10–12',rest:45,opts:[
  X('EZ-Bar Curl + Skull Crushers','curl',['SUPERSET: your heavy arm pair. Curls, then straight into skull crushers','Elbows pinned on the curls, no swinging','Lower the skull crushers to just behind your head, elbows pointing up']),
  X('Barbell Curl + Rope Pushdown','curl',['Superset','Spread the rope at the bottom of the pushdown']),
  X('Bicep Curls + Tricep Pushdowns','curl',['Superset','Elbows pinned at your sides on both'])]},
 {sets:3,reps:'12',rest:45,opts:[
  X('Incline DB Curl + Overhead Cable Extension','curl',['SUPERSET: stretch pair. Both moves hit the long heads that build arm size','Incline curl: let the arms hang behind you, curl without moving the elbows','Overhead extension: face away from the cable, full stretch behind your head']),
  X('Cable Curl + Overhead Tricep Extension','curl',['Superset','Constant tension on both']),
  X('Hammer Curls + Tricep Pushdown (rope)','curl',['Superset','Palms facing each other on the curls'])]},
 {sets:3,reps:'45 sec',time:45,rest:60,opts:[
  X('Plank-to-Pushup Transitions','plank',['Forearm plank, then push up to high plank','Hips stay square, no rocking side to side','Alternate the lead arm']),
  X('Plank','plank',['Squeeze glutes and quads','Straight line from head to heels']),
  X('Mountain Climbers','plank',['High plank, drive knees to chest','Fast but controlled']),
  X('Bear Crawl Hold','plank',['On hands and toes, knees hovering 1 inch off the floor','Back flat'])]}
]}
];


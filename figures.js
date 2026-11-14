/* =====================================================================
   FIGURES v2: a specific movement for (nearly) every exercise.
   Side-view poses are built from joint angles so limbs keep their length:
   angle 0 = pointing right, 90 = straight down, -90 = straight up.
   ===================================================================== */
(function () {
  const L = { tor: 32, neck: 12, ua: 16, fa: 16, th: 24, sh: 24, toe: 10 };
  const R = Math.PI / 180, r1 = v => Math.round(v * 10) / 10;
  const at = (a, deg, l) => [r1(a[0] + l * Math.cos(deg * R)), r1(a[1] + l * Math.sin(deg * R))];
  const back = (a, deg, l) => [r1(a[0] - l * Math.cos(deg * R)), r1(a[1] - l * Math.sin(deg * R))];
  /* S(o): o.p hip position, or o.f foot position (leg built upward), or o.w hand position (arm built inward)
     o.t torso angle, o.n neck angle, o.a [upper arm, forearm], o.a2, o.l [thigh, shin], o.l2, o.toe, o.x overrides */
  function S(o) {
    const l = o.l || [90, 90], a = o.a || [90, 90], t = o.t ?? -90, r = {};
    if (o.f) { r.f = o.f; r.k = back(o.f, l[1], L.sh); r.p = back(r.k, l[0], L.th); r.s = at(r.p, t, L.tor); }
    else if (o.w) { r.w = o.w; r.e = back(o.w, a[1], L.fa); r.s = back(r.e, a[0], L.ua); r.p = back(r.s, t, L.tor); }
    else { r.p = o.p; r.s = at(r.p, t, L.tor); }
    r.h = at(r.s, o.n ?? t, L.neck);
    if (!r.e) { r.e = at(r.s, a[0], L.ua); r.w = at(r.e, a[1], L.fa); }
    if (!r.k) { r.k = at(r.p, l[0], L.th); r.f = at(r.k, l[1], L.sh); }
    if (o.a2) { r.e2 = at(r.s, o.a2[0], L.ua); r.w2 = at(r.e2, o.a2[1], L.fa); }
    if (o.l2) { r.k2 = at(r.p, o.l2[0], L.th); r.f2 = at(r.k2, o.l2[1], L.sh); }
    if (o.toe != null) r.t = at(r.f, o.toe, L.toe);
    return Object.assign(r, o.x || {});
  }
  const F = { f: [60, 110] }; // feet planted mid-frame
  const db = ['floor', 'db:w'];
  const NEW = {
    /* ---------------- squats ---------------- */
    frontsquat: { A: S({ ...F, a: [10, 200] }), B: S({ ...F, l: [12, 110], t: -72, a: [22, 205] }), props: ['floor', 'barbell:w'], tempo: [3, 1, 1], ph: ['Sit down', 'Hold', 'Drive up'], cats: ['quads', 'glutes'] },
    goblet: { A: S({ ...F, a: [60, -60] }), B: S({ ...F, l: [12, 110], t: -66, a: [74, -52] }), props: db, tempo: [3, 1, 1], ph: ['Sit down', 'Hold', 'Drive up'], cats: ['quads', 'glutes'] },
    gobletheel: { A: S({ f: [60, 106], a: [60, -60], toe: 20 }), B: S({ f: [60, 106], l: [10, 114], t: -70, a: [74, -52], toe: 20 }), props: ['floor', 'wedge', 'db:w'], tempo: [3, 1, 1], ph: ['Sit down', 'Hold', 'Drive up'], cats: ['quads'] },
    hacksquat: { A: S({ f: [74, 110], l: [82, 96], t: -104, a: [140, -40] }), B: S({ f: [74, 110], l: [2, 116], t: -112, a: [140, -40] }), props: ['floor', 'padback'], tempo: [3, 1, 1], ph: ['Lower', 'Pause', 'Press up'], cats: ['quads', 'glutes'] },
    smithsquat: { A: S({ ...F, a: [150, -40] }), B: S({ ...F, l: [15, 112], t: -60, a: [150, -40] }), props: ['floor', 'smith:62', 'barbell:s'], tempo: [3, 1, 1], ph: ['Sit down', 'Hold', 'Drive up'], cats: ['quads', 'glutes'] },
    beltsquat: { A: S({ ...F, a: [40, 20] }), B: S({ ...F, l: [14, 112], t: -82, a: [44, 26] }), props: ['floor', 'belt:p'], tempo: [3, 1, 1], ph: ['Sit down', 'Hold', 'Drive up'], cats: ['quads', 'glutes'] },
    boxsquat: { A: S({ f: [66, 110], a: [150, -40] }), B: S({ f: [66, 110], l: [0, 106], t: -58, a: [150, -40] }), props: ['floor', 'rbox:22:46:88', 'barbell:s'], tempo: [2, 1, 1], ph: ['Sit back', 'Touch box', 'Drive up'], cats: ['quads', 'glutes'] },
    sissysquat: { A: S({ f: [62, 110], a: [0, 0] }), B: S({ f: [62, 110], l: [32, 122], t: -142, a: [-30, -20], toe: 0 }), props: ['floor'], tempo: [3, 1, 1], ph: ['Knees forward', 'Hold', 'Rise'], cats: ['quads'] },
    jumpsquat: { A: S({ ...F, l: [15, 112], t: -55, a: [125, 100] }), B: S({ f: [60, 92], t: -90, a: [-80, -85], toe: 80 }), props: ['floor'], tempo: [.5, .15, .8], ph: ['Explode', 'Air', 'Land soft'], cats: ['quads', 'glutes'] },
    /* ---------------- lunges ---------------- */
    fwdlunge: { A: S({ f: [36, 110], l: [90, 90], l2: [90, 90] }), B: S({ p: [66, 80], l: [15, 92], l2: [115, 165] }), props: db, tempo: [1.5, .5, 1], ph: ['Step forward', 'Drop', 'Push back'], cats: ['quads', 'glutes'] },
    revlunge: { A: S({ f: [78, 110], l: [90, 90], l2: [90, 90] }), B: S({ p: [56, 80], l: [15, 92], l2: [115, 165] }), props: db, tempo: [1.5, .5, 1], ph: ['Step back', 'Drop', 'Drive up'], cats: ['quads', 'glutes'] },
    splitsquat: { A: S({ p: [56, 64], l: [62, 82], l2: [118, 130] }), B: S({ p: [56, 80], l: [15, 92], l2: [115, 165] }), props: db, tempo: [2, 1, 1], ph: ['Lower', 'Hold', 'Drive up'], cats: ['quads', 'glutes'] },
    smithlunge: { A: S({ p: [56, 64], l: [62, 82], l2: [118, 130], a: [150, -40] }), B: S({ p: [56, 80], l: [15, 92], l2: [115, 165], a: [150, -40] }), props: ['floor', 'smith:56', 'barbell:s'], tempo: [2, 1, 1], ph: ['Lower', 'Hold', 'Drive up'], cats: ['quads', 'glutes'] },
    bulgarian: { A: S({ f: [68, 110], l: [70, 92], l2: [120, 182] }), B: S({ f: [68, 110], l: [20, 100], l2: [115, -134], t: -80 }), props: ['floor', 'bench:2:32:86', 'db:w'], tempo: [2, 1, 1], ph: ['Lower', 'Hold', 'Drive up'], cats: ['quads', 'glutes'] },
    curtsy: { A: { h: [60, 18], s: [60, 30], e: [52, 46], w: [50, 60], e2: [68, 46], w2: [70, 60], p: [60, 62], k: [56, 86], f: [56, 110], k2: [64, 86], f2: [64, 110] },
      B: { h: [60, 34], s: [60, 46], e: [52, 62], w: [50, 76], e2: [68, 62], w2: [70, 76], p: [60, 78], k: [56, 90], f: [56, 110], k2: [52, 99], f2: [38, 108] }, props: ['floor'], tempo: [2, 1, 1], ph: ['Step behind', 'Drop', 'Return'], cats: ['glutes', 'quads'] },
    /* ---------------- hinges ---------------- */
    deadlift: { A: S({ f: [58, 110], l: [20, 100], t: -32 }), B: S({ f: [58, 110] }), props: ['floor', 'barbell:w'], tempo: [1, 1, 2], ph: ['Pull', 'Lock out', 'Lower'], cats: ['hamstrings', 'glutes', 'back'] },
    rackpull: { A: S({ f: [58, 110], l: [40, 95], t: -45 }), B: S({ f: [58, 110] }), props: ['floor', 'rack:90', 'barbell:w'], tempo: [1, 1, 2], ph: ['Pull', 'Lock out', 'Lower'], cats: ['back', 'hamstrings'] },
    trapbar: { A: S({ f: [58, 110], l: [25, 105], t: -40 }), B: S({ f: [58, 110] }), props: ['floor', 'hexbar:w'], tempo: [1, 1, 2], ph: ['Drive', 'Lock out', 'Lower'], cats: ['hamstrings', 'quads', 'glutes'] },
    sumodl: { A: { h: [60, 46], s: [60, 58], e: [55, 74], w: [53, 90], e2: [65, 74], w2: [67, 90], p: [60, 76], k: [38, 86], f: [36, 110], k2: [82, 86], f2: [84, 110] },
      B: { h: [60, 18], s: [60, 30], e: [55, 46], w: [54, 62], e2: [65, 46], w2: [66, 62], p: [60, 62], k: [46, 86], f: [36, 110], k2: [74, 86], f2: [84, 110] }, props: ['floor', 'hbar:w:w2'], tempo: [1, 1, 2], ph: ['Pull', 'Lock out', 'Lower'], cats: ['glutes', 'hamstrings'] },
    sldl: { A: S({ f: [60, 110], l2: [95, 100] }), B: S({ f: [60, 110], l: [80, 92], t: -4, l2: [175, 178] }), props: db, tempo: [2, 1, 1], ph: ['Hinge', 'Balance', 'Stand'], cats: ['hamstrings', 'glutes'] },
    goodmorning: { A: S({ f: [60, 110], a: [150, -40] }), B: S({ f: [60, 110], l: [78, 94], t: -10, a: [112, -78] }), props: ['floor', 'barbell:s'], tempo: [2, 1, 1], ph: ['Hips back', 'Stretch', 'Squeeze up'], cats: ['hamstrings', 'glutes'] },
    pullthrough: { A: { h: [94, 40], s: [84, 46], e: [78, 62], w: [68, 76], p: [56, 64], k: [66, 86], f: [66, 110] }, B: S({ f: [66, 110] }), props: ['floor', 'cable:w:4:106'], tempo: [1, 1, 2], ph: ['Hips through', 'Squeeze', 'Hinge back'], cats: ['glutes', 'hamstrings'] },
    /* ---------------- rows ---------------- */
    reardelt: { A: { h: [60, 28], s: [60, 40], e: [55, 56], w: [55, 72], e2: [65, 56], w2: [65, 72], p: [60, 64], k: [53, 87], f: [52, 110], k2: [67, 87], f2: [68, 110] },
      B: { e: [45, 45], w: [29, 47], e2: [75, 45], w2: [91, 47] }, props: ['floor', 'db:w', 'db:w2'], tempo: [1, 1, 2], ph: ['Raise out', 'Squeeze', 'Lower'], cats: ['shoulders', 'back'] },
    invrow: { A: S({ w: [40, 46], a: [-95, -82], t: -156, l: [24, 24] }), B: S({ w: [40, 46], a: [-28, -150], t: -142, l: [38, 38] }), props: ['lowbar'], tempo: [1, 1, 2], ph: ['Pull chest up', 'Squeeze', 'Lower'], cats: ['back'] },
    cprow: { A: S({ p: [54, 86], t: -50, a: [90, 90], l: [150, 120] }), B: S({ p: [54, 86], t: -50, a: [152, 76], l: [150, 120] }), props: ['cpad', 'db:w'], tempo: [1, 1, 2], ph: ['Row', 'Squeeze', 'Lower'], cats: ['back'] },
    sealrow: { A: S({ p: [44, 57], t: 0, a: [90, 90], l: [176, 176] }), B: S({ p: [44, 57], t: 0, a: [-150, 70], l: [176, 176] }), props: ['sealbench', 'barbell:w'], tempo: [1, 1, 2], ph: ['Row', 'Squeeze', 'Lower'], cats: ['back'] },
    tbar: { A: S({ f: [60, 110], l: [60, 98], t: -30 }), B: S({ f: [60, 110], l: [60, 98], t: -30, a: [160, 70] }), props: ['floor', 'landmine:w', 'plate:w'], tempo: [1, 1, 2], ph: ['Row', 'Squeeze', 'Lower'], cats: ['back'] },
    renegade: { A: { h: [22, 68], s: [32, 76], e: [33, 92], w: [32, 108], e2: [33, 92], w2: [32, 108], p: [68, 88], k: [88, 98], f: [108, 108] },
      B: { e: [47, 70], w: [44, 86] }, props: ['floor', 'db:w', 'db:w2'], tempo: [1, 1, 1], ph: ['Row', 'Squeeze', 'Lower'], cats: ['back', 'core'] },
    /* ---------------- curls ---------------- */
    cablecurl: { A: S({ ...F, a: [92, 85] }), B: S({ ...F, a: [92, -62] }), props: ['floor', 'cable:w:92:110'], tempo: [1, 1, 3], ph: ['Curl', 'Squeeze', 'Lower slow'], cats: ['arms'] },
    preacher: { A: S({ p: [48, 84], t: -86, l: [2, 92], a: [45, 50] }), B: S({ p: [48, 84], t: -86, l: [2, 92], a: [45, -75] }), props: ['floor', 'preacher', 'stool', 'barbell:w'], tempo: [1, 1, 3], ph: ['Curl', 'Squeeze', 'Lower slow'], cats: ['arms'] },
    inclinecurl: { A: S({ p: [52, 91], t: -129, l: [5, 50], a: [95, 95] }), B: S({ p: [52, 91], t: -129, l: [5, 50], a: [95, -68] }), props: ['ibench', 'db:w'], tempo: [1, 1, 3], ph: ['Curl', 'Squeeze', 'Lower slow'], cats: ['arms'] },
    spidercurl: { A: S({ p: [54, 86], t: -50, a: [90, 90], l: [150, 120] }), B: S({ p: [54, 86], t: -50, a: [90, -40], l: [150, 120] }), props: ['cpad', 'db:w'], tempo: [1, 1, 3], ph: ['Curl', 'Squeeze', 'Lower slow'], cats: ['arms'] },
    conccurl: { A: S({ p: [46, 86], t: -45, l: [0, 92], a: [80, 95] }), B: S({ p: [46, 86], t: -45, l: [0, 92], a: [80, -62] }), props: ['floor', 'stool', 'db:w'], tempo: [1, 1, 3], ph: ['Curl', 'Squeeze', 'Lower slow'], cats: ['arms'] },
    /* ---------------- presses ---------------- */
    declinebench: { A: S({ p: [66, 72], t: 164, l: [-24, 72], a: [-82, -84] }), B: S({ p: [66, 72], t: 164, l: [-24, 72], a: [118, -72] }), props: ['dbench', 'barbell:w'], tempo: [3, 1, 1], ph: ['Lower to chest', 'Pause', 'Press'], cats: ['chest'] },
    machpress: { A: S({ p: [47, 86], t: -92, l: [0, 90], a: [168, -4] }), B: S({ p: [47, 86], t: -92, l: [0, 90], a: [4, 2] }), props: ['floor', 'chair', 'handle:w'], tempo: [1, 1, 2], ph: ['Press', 'Squeeze', 'Return'], cats: ['chest'] },
    svend: { A: S({ ...F, a: [100, -20] }), B: S({ ...F, a: [12, 6] }), props: ['floor', 'plate:w'], tempo: [1, 1, 2], ph: ['Press out', 'Squeeze', 'Bring in'], cats: ['chest'] },
    inclinepushup: { A: { h: [29, 50], s: [38, 58], e: [38, 74], w: [38, 90], p: [63, 78], k: [81, 93], f: [100, 109] }, B: { h: [19, 75], s: [30, 80], e: [24, 94], w: [38, 90], p: [60, 92], k: [82, 102], f: [104, 110] }, props: ['floor', 'bench:20:56:92'], tempo: [2, 0, 1], ph: ['Lower', '', 'Push up'], cats: ['chest', 'arms'] },
    benchdip: { A: { h: [38, 30], s: [38, 44], e: [37, 59], w: [36, 74], p: [42, 76], k: [64, 86], f: [64, 110] }, B: { h: [39, 52], s: [38, 66], e: [22, 64], w: [36, 74], p: [42, 98], k: [63, 86], f: [64, 110] }, props: ['floor', 'bench:4:38:76'], tempo: [2, 0, 1], ph: ['Lower', '', 'Press up'], cats: ['arms', 'chest'] },
    arnold: { A: { h: [50, 28], s: [50, 40], e: [62, 54], w: [56, 36], p: [50, 82], k: [74, 82], f: [76, 110] }, B: { e: [46, 20], w: [50, 4] }, props: ['floor', 'chair', 'db:w'], tempo: [1, 1, 2], ph: ['Rotate & press', 'Lockout', 'Lower & turn in'], cats: ['shoulders'] },
    bbohp: { A: { h: [57, 18], s: [60, 30], e: [70, 40], w: [66, 26], p: [60, 62], k: [61, 86], f: [60, 110] }, B: { h: [61, 18], e: [62, 14], w: [62, -2] }, props: ['floor', 'barbell:w'], tempo: [1, 1, 2], ph: ['Press up', 'Lockout', 'Lower'], cats: ['shoulders'] },
    /* ---------------- raises (front view) ---------------- */
    cablelat: { A: { h: [60, 18], s: [60, 30], e: [56, 46], w: [62, 60], e2: [70, 42], w2: [80, 48], p: [60, 62], k: [57, 86], f: [56, 110], k2: [63, 86], f2: [64, 110] }, B: { e: [44, 32], w: [29, 33] }, props: ['floor', 'cable:w:96:110'], tempo: [1, 1, 2], ph: ['Raise', 'Hold', 'Lower slow'], cats: ['shoulders'] },
    leanlat: { A: { h: [48, 20], s: [52, 32], e: [44, 47], w: [42, 61], e2: [67, 36], w2: [82, 40], p: [60, 62], k: [60, 86], f: [62, 110], k2: [66, 86], f2: [68, 110] }, B: { e: [37, 33], w: [22, 31] }, props: ['floor', 'post:84', 'db:w'], tempo: [1, 1, 2], ph: ['Raise', 'Hold', 'Lower slow'], cats: ['shoulders'] },
    seatedlat: { A: { h: [60, 40], s: [60, 52], e: [52, 68], w: [50, 82], e2: [68, 68], w2: [70, 82], p: [60, 84], k: [52, 92], f: [52, 110], k2: [68, 92], f2: [68, 110] }, B: { e: [44, 54], w: [29, 55], e2: [76, 54], w2: [91, 55] }, props: ['floor', 'fbench', 'db:w', 'db:w2'], tempo: [1, 1, 2], ph: ['Raise', 'Hold', 'Lower slow'], cats: ['shoulders'] },
    yraise: { A: S({ p: [54, 86], t: -50, a: [90, 90], l: [150, 120] }), B: S({ p: [54, 86], t: -50, a: [-48, -46], l: [150, 120] }), props: ['cpad', 'db:w'], tempo: [1, 1, 2], ph: ['Raise to Y', 'Hold', 'Lower'], cats: ['shoulders', 'back'] },
    pullapart: { A: { h: [60, 18], s: [60, 30], e: [55, 33], w: [57, 32], e2: [65, 33], w2: [63, 32], p: [60, 62], k: [57, 86], f: [56, 110], k2: [63, 86], f2: [64, 110] }, B: { e: [45, 31], w: [29, 31], e2: [75, 31], w2: [91, 31] }, props: ['floor', 'band:w:w2'], tempo: [1, 1, 2], ph: ['Pull apart', 'Squeeze', 'Return'], cats: ['shoulders', 'back'] },
    /* ---------------- flyes ---------------- */
    midfly: { A: S({ ...F, a: [178, 172] }), B: S({ ...F, a: [8, 4] }), props: ['floor', 'cable:w:2:30'], tempo: [1, 1, 2], ph: ['Hug in', 'Squeeze', 'Open slow'], cats: ['chest'] },
    lowhighfly: { A: S({ ...F, a: [120, 115] }), B: S({ ...F, a: [-12, -22] }), props: ['floor', 'cable:w:2:108'], tempo: [1, 1, 2], ph: ['Sweep up', 'Squeeze', 'Lower slow'], cats: ['chest', 'shoulders'] },
    highlowfly: { A: S({ ...F, a: [-122, -122] }), B: S({ ...F, a: [45, 50] }), props: ['floor', 'cable:w:2:-8'], tempo: [1, 1, 2], ph: ['Sweep down', 'Squeeze', 'Rise slow'], cats: ['chest'] },
    dbfly: { A: { h: [16, 70], s: [28, 74], e: [29, 58], w: [30, 42], p: [72, 74], k: [90, 72], f: [98, 110] }, B: { e: [24, 82], w: [16, 90] }, props: ['floor', 'bench:14:86:78', 'db:w'], tempo: [3, 1, 1], ph: ['Open wide', 'Stretch', 'Hug up'], cats: ['chest'] },
    revpec: { A: S({ p: [48, 86], t: -90, l: [0, 90], a: [6, 2] }), B: S({ p: [48, 86], t: -90, l: [0, 90], a: [178, 182] }), props: ['floor', 'stool', 'cpost:66'], tempo: [1, 1, 2], ph: ['Open back', 'Squeeze', 'Return'], cats: ['shoulders', 'back'] },
    /* ---------------- triceps ---------------- */
    cablekick: { A: S({ f: [60, 110], l: [75, 95], t: -40, a: [150, 90] }), B: S({ f: [60, 110], l: [75, 95], t: -40, a: [150, 152] }), props: ['floor', 'cable:w:112:106'], tempo: [1, 1, 2], ph: ['Extend back', 'Squeeze', 'Return'], cats: ['arms'] },
    cableohext: { A: S({ p: [60, 62], t: -78, l: [80, 95], l2: [110, 100], a: [-62, 198] }), B: S({ p: [60, 62], t: -78, l: [80, 95], l2: [110, 100], a: [-62, -38] }), props: ['floor', 'cable:w:2:26'], tempo: [1, 1, 2], ph: ['Extend', 'Squeeze', 'Return slow'], cats: ['arms'] },
    /* ---------------- core ---------------- */
    woodchop: { A: { h: [58, 18], s: [60, 30], e: [48, 18], w: [38, 6], e2: [52, 20], w2: [38, 6], p: [60, 62], k: [52, 86], f: [48, 110], k2: [68, 86], f2: [72, 110] },
      B: { h: [63, 21], s: [62, 33], e: [70, 48], w: [82, 60], e2: [66, 49], w2: [82, 60], p: [60, 64], k: [53, 87], k2: [69, 87] }, props: ['floor', 'cable:w:4:-8'], tempo: [1, .5, 2], ph: ['Chop down', 'Hold', 'Return'], cats: ['core'] },
    pallof: { A: S({ ...F, l: [86, 94], a: [110, -10] }), B: S({ ...F, l: [86, 94], a: [10, 6] }), props: ['floor', 'cable:w:2:44'], tempo: [1, 2, 1], ph: ['Press out', 'Resist', 'Bring in'], cats: ['core'] },
    lmrotate: { A: { h: [58, 18], s: [60, 30], e: [48, 26], w: [36, 22], e2: [50, 30], w2: [36, 22], p: [60, 62], k: [52, 86], f: [48, 110], k2: [68, 86], f2: [72, 110] },
      B: { h: [62, 18], e: [72, 26], w: [84, 22], e2: [70, 30], w2: [84, 22] }, props: ['floor', 'lm2:w'], tempo: [1, .3, 1], ph: ['Rotate', '', 'Rotate back'], cats: ['core'] },
    sidebend: { A: { h: [60, 18], s: [60, 30], e: [52, 46], w: [50, 60], e2: [70, 24], w2: [64, 16], p: [60, 62], k: [56, 86], f: [55, 110], k2: [64, 86], f2: [65, 110] },
      B: { h: [46, 23], s: [52, 33], e: [43, 48], w: [38, 62], e2: [62, 24], w2: [54, 19] }, props: ['floor', 'db:w'], tempo: [1, 1, 2], ph: ['Bend', 'Squeeze', 'Return'], cats: ['core'] },
    bicycle: { A: { h: [22, 88], s: [32, 94], e: [24, 82], w: [20, 88], p: [62, 102], k: [52, 82], f: [72, 86], k2: [86, 98], f2: [108, 94] },
      B: { h: [24, 88], s: [33, 95], e: [42, 86], w: [22, 88], k: [86, 98], f: [108, 94], k2: [52, 82], f2: [72, 86] }, props: ['floor'], tempo: [.7, .2, .7], ph: ['Twist', '', 'Switch'], cats: ['core'] },
    hollow: { A: { h: [22, 92], s: [32, 98], e: [18, 92], w: [4, 88], p: [62, 104], k: [86, 100], f: [108, 94] }, B: { h: [24, 88], s: [34, 95], e: [20, 88], w: [6, 82], k: [86, 97], f: [108, 88] }, props: ['floor'], tempo: [2, 2, 2], ph: ['Lift & hollow', 'Hold', 'Breathe'], cats: ['core'] },
    birddog: { A: { h: [90, 74], s: [78, 80], e: [78, 94], w: [78, 108], e2: [76, 94], w2: [76, 108], p: [46, 82], k: [46, 106], f: [22, 108], k2: [44, 106], f2: [20, 108] },
      B: { e: [94, 78], w: [110, 76], k2: [22, 82], f2: [-1, 80] }, props: ['floor'], tempo: [1.5, 1, 1.5], ph: ['Reach out', 'Hold', 'Return'], cats: ['core', 'glutes'] },
    toetouch: { A: { h: [14, 102], s: [26, 104], e: [28, 88], w: [30, 72], p: [60, 104], k: [60, 80], f: [60, 56] }, B: { h: [24, 88], s: [34, 93], e: [44, 78], w: [54, 63] }, props: ['floor'], tempo: [1, 1, 1], ph: ['Reach up', 'Touch', 'Lower'], cats: ['core'] },
    revcrunch: { A: { h: [14, 102], s: [26, 104], e: [40, 106], w: [54, 106], p: [60, 104], k: [60, 80], f: [84, 80] }, B: { p: [62, 96], k: [46, 78], f: [64, 62] }, props: ['floor'], tempo: [1, 1, 2], ph: ['Curl hips up', 'Squeeze', 'Lower slow'], cats: ['core'] },
    sidelying: { A: { h: [12, 96], s: [24, 100], e: [22, 108], w: [8, 104], e2: [40, 96], w2: [56, 98], p: [56, 102], k: [80, 104], f: [104, 106], k2: [80, 102], f2: [104, 104] }, B: { k2: [78, 89], f2: [100, 74] }, props: ['floor'], tempo: [1, 1, 2], ph: ['Lift', 'Hold', 'Lower slow'], cats: ['glutes'] },
    vup: { A: { h: [22, 104], s: [34, 104], e: [18, 102], w: [4, 100], p: [66, 104], k: [90, 104], f: [114, 104] }, B: { h: [38, 70], s: [45, 80], e: [60, 74], w: [76, 68], k: [81, 86], f: [97, 67] }, props: ['floor'], tempo: [1, 1, 2], ph: ['Fold up', 'Touch', 'Lower slow'], cats: ['core'] },
    abmachine: { A: S({ p: [47, 86], t: -92, l: [0, 90], a: [-40, -120] }), B: S({ p: [47, 86], t: -42, n: -20, l: [0, 90], a: [-10, -90] }), props: ['floor', 'chair'], tempo: [1, 1, 2], ph: ['Crunch', 'Squeeze', 'Return'], cats: ['core'] },
    kneeraise: { A: { h: [60, 30], s: [60, 40], e: [62, 20], w: [62, 2], p: [60, 72], k: [62, 92], f: [62, 110] }, B: { k: [83, 64], f: [79, 87], p: [61, 70] }, props: ['pullbar'], tempo: [1, 1, 2], ph: ['Knees up', 'Squeeze', 'Lower'], cats: ['core'] },
    captain: { A: { h: [58, 26], s: [58, 38], e: [62, 54], w: [78, 52], p: [58, 70], k: [58, 94], f: [58, 112] }, B: { k: [80, 64], f: [78, 88] }, props: ['captain'], tempo: [1, 1, 2], ph: ['Knees up', 'Squeeze', 'Lower'], cats: ['core'] },
    /* ---------------- plank family ---------------- */
    shouldertap: { A: { h: [22, 68], s: [32, 76], e: [33, 92], w: [32, 108], e2: [33, 92], w2: [32, 108], p: [68, 88], k: [88, 98], f: [108, 108] }, B: { e: [40, 90], w: [33, 77] }, props: ['floor'], tempo: [.5, .3, .5], ph: ['Tap', '', 'Plant'], cats: ['core'] },
    plankup: { A: { h: [20, 84], s: [30, 90], e: [30, 108], w: [42, 108], p: [66, 94], k: [86, 101], f: [106, 108] }, B: { h: [22, 68], s: [32, 76], e: [33, 92], w: [32, 108], p: [68, 88], k: [88, 98], f: [108, 108] }, props: ['floor'], tempo: [1, .5, 1], ph: ['Press up', 'Hold', 'Down to forearms'], cats: ['core', 'chest'] },
    climber: { A: { h: [22, 68], s: [32, 76], e: [33, 92], w: [32, 108], p: [68, 88], k: [50, 96], f: [72, 106], k2: [88, 98], f2: [108, 108] }, B: { k: [88, 98], f: [108, 108], k2: [50, 96], f2: [72, 106] }, props: ['floor'], tempo: [.35, 0, .35], ph: ['Drive', '', 'Switch'], cats: ['core', 'cardio'] },
    bearhold: { A: { h: [90, 72], s: [78, 78], e: [78, 93], w: [78, 108], p: [46, 80], k: [46, 102], f: [22, 108] }, B: { h: [90, 70], s: [78, 76], p: [46, 77], k: [46, 99] }, props: ['floor'], tempo: [2, 2, 2], ph: ['Knees hover', 'Hold', 'Breathe'], cats: ['core'] },
    /* ---------------- glutes ---------------- */
    donkey: { A: { h: [90, 74], s: [78, 80], e: [78, 94], w: [78, 108], p: [46, 82], k: [46, 106], f: [22, 108], k2: [44, 106], f2: [20, 108] }, B: { k: [23, 80], f: [21, 56] }, props: ['floor'], tempo: [1, 1, 2], ph: ['Kick up', 'Squeeze', 'Lower'], cats: ['glutes'] },
    abductmach: { A: { h: [60, 38], s: [60, 50], e: [50, 66], w: [46, 80], e2: [70, 66], w2: [74, 80], p: [60, 82], k: [56, 88], f: [54, 110], k2: [64, 88], f2: [66, 110] }, B: { k: [40, 86], f: [44, 110], k2: [80, 86], f2: [76, 110] }, props: ['floor', 'fbench'], tempo: [1, 1, 2], ph: ['Push out', 'Squeeze', 'Return slow'], cats: ['glutes'] },
    latwalk: { A: { h: [56, 32], s: [56, 44], e: [48, 58], w: [52, 68], e2: [64, 58], w2: [60, 68], p: [56, 74], k: [50, 92], f: [48, 110], k2: [62, 92], f2: [64, 110] },
      B: { h: [62, 32], s: [62, 44], e: [54, 58], w: [58, 68], e2: [70, 58], w2: [66, 68], p: [62, 74], k: [52, 92], f: [48, 110], k2: [76, 92], f2: [80, 110] }, props: ['floor', 'band:k:k2'], tempo: [.8, .2, .8], ph: ['Step out', '', 'Follow'], cats: ['glutes'] },
    hydrant: { A: { h: [60, 64], s: [60, 72], e: [50, 88], w: [50, 108], e2: [70, 88], w2: [70, 108], p: [60, 80], k: [52, 104], f: [50, 112], k2: [68, 104], f2: [70, 112] }, B: { k2: [84, 88], f2: [90, 96] }, props: ['floor'], tempo: [1, 1, 2], ph: ['Lift out', 'Hold', 'Lower'], cats: ['glutes'] },
    singlethrust: { A: { h: [20, 62], s: [30, 70], e: [44, 80], w: [56, 92], p: [56, 98], k: [78, 84], f: [86, 110], k2: [78, 90], f2: [100, 82] }, B: { e: [44, 72], w: [58, 76], p: [58, 74], k: [80, 76], k2: [82, 70], f2: [106, 66] }, props: ['floor', 'bench:8:32:70'], tempo: [1, 2, 2], ph: ['Hips up', 'Squeeze', 'Lower'], cats: ['glutes', 'hamstrings'] },
    /* ---------------- hamstrings ---------------- */
    seatedcurl: { A: S({ p: [47, 86], t: -96, l: [0, 0], a: [60, 20] }), B: S({ p: [47, 86], t: -96, l: [0, 112], a: [60, 20] }), props: ['floor', 'chair', 'legpad:f'], tempo: [1, 1, 3], ph: ['Curl down', 'Squeeze', 'Return slow'], cats: ['hamstrings'] },
    standcurl: { A: S({ f: [60, 110], t: -78, a: [20, 30], l2: [92, 90] }), B: S({ f: [60, 110], t: -78, a: [20, 30], l2: [92, 90], x: {} }), props: ['floor', 'post:90'], tempo: [1, 1, 3], ph: ['Curl', 'Squeeze', 'Lower slow'], cats: ['hamstrings'] },
    nordic: { A: { h: [52, 38], s: [52, 50], e: [60, 60], w: [68, 52], p: [52, 82], k: [52, 106], f: [28, 108] }, B: { h: [111, 72], s: [100, 78], e: [104, 94], w: [110, 106], p: [73, 94] }, props: ['floor', 'anchor:f'], tempo: [3, 0, 1], ph: ['Lower slow', 'Catch', 'Pull back up'], cats: ['hamstrings'] },
    ballcurl: { A: { h: [14, 102], s: [26, 104], e: [40, 108], w: [54, 108], p: [56, 92], k: [80, 92], f: [102, 88] }, B: { p: [58, 84], k: [76, 68], f: [84, 90] }, props: ['floor', 'ball:f'], tempo: [1, 1, 2], ph: ['Curl in', 'Squeeze', 'Roll out'], cats: ['hamstrings', 'glutes'] },
    /* ---------------- calves ---------------- */
    seatedcalf: { A: { h: [50, 42], s: [50, 54], e: [62, 66], w: [72, 76], p: [50, 86], k: [74, 86], f: [74, 108], t: [84, 110] }, B: { e: [62, 61], w: [72, 70], k: [74, 80], f: [74, 102] }, props: ['floor', 'stool', 'kneepad:k'], tempo: [1, 2, 2], ph: ['Rise', 'Hold top', 'Lower slow'], cats: ['calves'] },
    donkeycalf: { A: { h: [92, 60], s: [80, 62], e: [80, 73], w: [80, 84], p: [48, 62], k: [48, 86], f: [48, 108], t: [58, 110] }, B: { h: [92, 54], s: [80, 56], e: [81, 70], p: [48, 56], k: [48, 80], f: [48, 102] }, props: ['floor', 'bench:70:100:86', 'step'], tempo: [1, 2, 2], ph: ['Rise', 'Hold top', 'Lower slow'], cats: ['calves'] },
    tibialis: { A: { h: [47, 19], s: [50, 31], e: [50, 47], w: [52, 63], p: [58, 62], k: [63, 86], f: [68, 110], t: [78, 110] }, B: { t: [75, 102] }, props: ['floor', 'wall:42'], tempo: [1, 1, 2], ph: ['Toes up', 'Hold', 'Lower slow'], cats: ['calves'] },
    lpcalf: { A: { h: [18, 52], s: [24, 62], e: [34, 74], w: [42, 80], p: [44, 86], k: [72, 66], f: [100, 56], t: [103, 46] }, B: { t: [109, 48] }, props: ['lpseat', 'platform:t'], tempo: [1, 2, 2], ph: ['Push toes', 'Hold', 'Lower slow'], cats: ['calves'] },
    singlecalf: { A: { h: [60, 18], s: [60, 30], e: [60, 46], w: [60, 60], p: [60, 62], k: [60, 86], f: [58, 108], t: [70, 108], k2: [56, 86], f2: [42, 90] }, B: { h: [60, 10], s: [60, 22], e: [60, 38], w: [60, 52], p: [60, 54], k: [60, 78], f: [60, 100], k2: [56, 78], f2: [42, 82] }, props: ['floor', 'step', 'db:w'], tempo: [1, 2, 2], ph: ['Rise', 'Hold top', 'Lower slow'], cats: ['calves'] },
    /* ---------------- cardio ---------------- */
    run: { A: S({ p: [60, 60], t: -82, a: [120, 40], a2: [60, -40], l: [30, 100], l2: [110, 160] }), B: S({ p: [60, 60], t: -82, a: [60, -40], a2: [120, 40], l: [110, 160], l2: [30, 100] }), props: ['tread'], tempo: [.35, 0, .35], ph: ['Stride', '', 'Stride'], cats: ['cardio'] },
    highknees: { A: S({ p: [60, 62], a: [60, -50], a2: [120, 60], l: [-8, 92], l2: [90, 90] }), B: S({ p: [60, 62], a: [120, 60], a2: [60, -50], l: [90, 90], l2: [-8, 92] }), props: ['floor'], tempo: [.3, 0, .3], ph: ['Knee up', '', 'Switch'], cats: ['cardio'] },
    stairs: { A: S({ p: [56, 62], t: -84, a: [100, 60], l: [32, 96], l2: [96, 92] }), B: S({ p: [56, 62], t: -84, a: [100, 60], l: [96, 92], l2: [32, 96] }), props: ['stairs'], tempo: [.6, 0, .6], ph: ['Step', '', 'Step'], cats: ['cardio'] },
    elliptical: { A: S({ p: [58, 56], t: -86, a: [40, -30], a2: [70, -10], l: [62, 112], l2: [116, 70] }), B: S({ p: [58, 56], t: -86, a: [70, -10], a2: [40, -30], l: [116, 70], l2: [62, 112] }), props: ['ellip'], tempo: [.6, 0, .6], ph: ['Push', '', 'Pull'], cats: ['cardio'] },
    kbswing: { A: { h: [88, 46], s: [78, 52], e: [72, 68], w: [66, 84], p: [50, 62], k: [57, 84], f: [55, 110] }, B: { h: [60, 18], s: [60, 30], e: [76, 32], w: [92, 32], p: [60, 62], k: [61, 86], f: [60, 110] }, props: ['floor', 'kb:w'], tempo: [.7, .2, .8], ph: ['Snap hips', 'Float', 'Hike back'], cats: ['cardio', 'glutes'] }
  };
  /* ---------------- warm-up & mobility drills ---------------- */
  Object.assign(NEW, {
    armcircle: { A: { h: [60, 18], s: [60, 30], e: [45, 32], w: [29, 33], e2: [75, 32], w2: [91, 33], p: [60, 62], k: [57, 86], f: [56, 110], k2: [63, 86], f2: [64, 110] }, B: { e: [45, 27], w: [30, 22], e2: [75, 27], w2: [90, 22] }, props: ['floor'], tempo: [.35, 0, .35], ph: ['Circle', '', 'Circle'] },
    catcow: { A: { h: [91, 70], s: [78, 82], e: [78, 95], w: [78, 108], p: [46, 80], k: [46, 104], f: [22, 108] }, B: { h: [84, 89], s: [78, 74], e: [78, 91], p: [46, 73], k: [46, 97] }, props: ['floor'], tempo: [1.5, .5, 1.5], ph: ['Round up (cat)', 'Hold', 'Drop & look up (cow)'] },
    wgs: { A: { h: [88, 52], s: [78, 60], e: [76, 76], w: [74, 92], e2: [77, 76], w2: [76, 92], p: [54, 82], k: [78, 86], f: [80, 110], k2: [40, 100], f2: [17, 104] }, B: { h: [84, 48], e2: [78, 44], w2: [80, 28] }, props: ['floor'], tempo: [1.5, 1, 1.5], ph: ['Reach up & rotate', 'Hold', 'Hand down'] },
    legswing: { A: S({ f: [56, 110], a: [10, 0], l2: [110, 120] }), B: S({ f: [56, 110], a: [10, 0], l2: [40, 50] }), props: ['floor', 'post:90'], tempo: [.6, 0, .6], ph: ['Swing forward', '', 'Swing back'] },
    bwsquat: { A: S({ f: [60, 110], a: [0, 0] }), B: S({ f: [60, 110], l: [12, 110], t: -62, a: [-6, -4] }), props: ['floor'], tempo: [1.5, .5, 1], ph: ['Sit down', 'Hold', 'Stand'] },
    inchworm: { A: { h: [85, 103], s: [89, 92], e: [86, 100], w: [84, 108], p: [100, 62], k: [100, 86], f: [100, 110] }, B: { h: [24, 80], s: [36, 84], e: [36, 96], w: [36, 108], p: [66, 96], k: [83, 103] }, props: ['floor'], tempo: [2, .5, 2], ph: ['Walk hands out', 'Plank', 'Walk back'] },
    openbook: { A: { h: [18, 96], s: [30, 100], e: [46, 99], w: [62, 98], e2: [46, 102], w2: [62, 102], p: [60, 104], k: [80, 94], f: [78, 108] }, B: { e: [15, 98], w: [-1, 99] }, props: ['floor'], tempo: [1.5, 1, 1.5], ph: ['Open the book', 'Breathe', 'Close'] },
  });
  /* standing single-leg curl: free leg curls up behind */
  NEW.standcurl.B.k2 = [57.9, 85.9]; NEW.standcurl.B.f2 = [35.3, 77.7];
  /* hollow body & bear hold barely move: they are holds */
  for (const k of ['midfly', 'dbfly', 'revpec']) NEW[k].lin = true;
  Object.assign(P, NEW);
  if (P.seatedfly) P.seatedfly.lin = true; if (P.fly) P.fly.lin = true;
  for (const k in NEW) P[k].B = { ...P[k].A, ...P[k].B };

  /* exercise name → figure */
  window.FIG_NAMES = {
    'front squat': 'frontsquat', 'goblet squat': 'goblet', 'heel-elevated goblet squat': 'gobletheel', 'hack squat': 'hacksquat', 'pendulum squat': 'hacksquat',
    'smith machine squat': 'smithsquat', 'smith sumo squat': 'smithsquat', 'belt squat': 'beltsquat', 'box squat': 'boxsquat', 'sissy squat': 'sissysquat', 'jump squats': 'jumpsquat',
    'walking lunges': 'fwdlunge', 'forward lunge': 'fwdlunge', 'reverse lunge': 'revlunge', 'reverse lunge to knee drive': 'revlunge', 'split squat (static)': 'splitsquat',
    'smith machine lunge': 'smithlunge', 'bulgarian split squat': 'bulgarian', 'curtsy lunge': 'curtsy',
    'conventional deadlift': 'deadlift', 'rack pull': 'rackpull', 'trap bar deadlift': 'trapbar', 'sumo deadlift': 'sumodl', 'single-leg rdl': 'sldl', 'good morning': 'goodmorning', 'cable pull-through': 'pullthrough',
    'sumo squat (db)': 'sumodl', 'sumo db squat': 'sumodl',
    'rear delt db fly': 'reardelt', 'inverted row': 'invrow', 'chest-supported row': 'cprow', 'seal row': 'sealrow', 't-bar row': 'tbar', 'meadows row': 'tbar', 'renegade row': 'renegade', 'plank row (knees down)': 'renegade',
    'cable curl': 'cablecurl', 'rope hammer curl': 'cablecurl', 'preacher curl': 'preacher', 'incline db curl': 'inclinecurl', 'spider curl': 'spidercurl', 'concentration curl': 'conccurl',
    'decline bench press': 'declinebench', 'machine chest press': 'machpress', 'hammer strength press': 'machpress', 'svend press': 'svend', 'incline push-ups': 'inclinepushup',
    'bench dips': 'benchdip', 'bench dips + db curl': 'benchdip', 'arnold press': 'arnold', 'barbell overhead press': 'bbohp',
    'cable lateral raise': 'cablelat', 'lean-away lateral raise': 'leanlat', 'seated lateral raise': 'seatedlat', 'machine lateral raise': 'seatedlat', 'y-raise': 'yraise', 'band pull-apart': 'pullapart',
    'cable flyes': 'midfly', 'low-to-high cable fly': 'lowhighfly', 'high-to-low cable fly': 'highlowfly', 'dumbbell flyes': 'dbfly', 'reverse pec deck': 'revpec',
    'cable kickback (tricep)': 'cablekick', 'cable kickback (tricep) + cable curl': 'cablekick', 'overhead cable extension': 'cableohext', 'cable curl + overhead tricep extension': 'cablecurl',
    'cable woodchopper': 'woodchop', 'pallof press': 'pallof', 'landmine rotation': 'lmrotate', 'standing oblique crunch': 'sidebend',
    'bicycle crunches': 'bicycle', 'hollow body hold': 'hollow', 'bird dog': 'birddog', 'toe touches': 'toetouch', 'reverse crunch': 'revcrunch', 'side-lying leg raise': 'sidelying',
    'v-ups': 'vup', 'ab crunch machine': 'abmachine', 'hanging knee raise': 'kneeraise', "captain's chair knee raise": 'captain',
    'plank shoulder taps': 'shouldertap', 'plank-to-pushup transitions': 'plankup', 'mountain climbers': 'climber', 'slow mountain climbers': 'climber', 'bear crawl hold': 'bearhold',
    'donkey kicks': 'donkey', 'donkey kicks (ankle weight)': 'donkey', 'banded kickback': 'donkey', 'glute kickback machine': 'donkey',
    'hip abduction machine': 'abductmach', 'banded lateral walk': 'latwalk', 'fire hydrants': 'hydrant', 'single-leg hip thrust': 'singlethrust',
    'seated leg curl': 'seatedcurl', 'standing single-leg curl': 'standcurl', 'single-leg curl': 'standcurl', 'nordic curl': 'nordic', 'glute-ham raise': 'nordic', 'stability ball leg curl': 'ballcurl',
    'seated calf raise': 'seatedcalf', 'donkey calf raise': 'donkeycalf', 'tibialis raise': 'tibialis', 'leg press calf press': 'lpcalf', 'single-leg db calf raise': 'singlecalf', 'single-leg calf raise': 'singlecalf',
    'treadmill run': 'run', 'high knees': 'highknees', 'stairmaster': 'stairs', 'elliptical': 'elliptical', 'kettlebell swing': 'kbswing', 'kettlebell swings': 'kbswing'
  };
})();

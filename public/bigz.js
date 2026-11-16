/* ================= Coach Bigz =================
   Recorded voice coach. Clips live in voice/bigz/NNN.m4a (voice/bigz/manifest.json lists what each one says).
   One switch (localStorage gymp.pacerVoice, the old "voice" switch): the Coach Bigz button on the rep pacer and the row in Settings.
   Loaded last: it wraps pvSay, pvRep, pvStop, pvPaint, openPacer, startRest, tickRest, logSet, afterLog and renderMore.
   Where a clip can't be played (not downloaded yet, offline on first use) the phone's own voice still counts the reps. */
const BZ = { bytes: {}, buf: {}, q: [], cur: null, loading: null, last: {}, teaseT: null, hello: false };
const BZ_N = 117, BZ_CACHE = 'spott-voice-bigz-1'; // not a "gymp-" name, so an app update never throws the clips away
const BZ_CORE = [18, 19, 20, 21, ...Array.from({ length: 20 }, (_, i) => 22 + i), 42, 43, 44, 46, 15, 5, 7]; // kept decoded: these have to land on the beat
const BZ_TEASE = [51, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66];
const bzFile = n => `voice/bigz/${String(n).padStart(3, '0')}.m4a`;
const bzReady = () => Object.keys(BZ.bytes).length > BZ_N * .8;

function bzLoad() { // download once, keep for offline; safe to call again
  if (BZ.loading || Object.keys(BZ.bytes).length >= BZ_N) return BZ.loading;
  return BZ.loading = (async () => {
    let c = null; try { if ('caches' in window) c = await caches.open(BZ_CACHE); } catch (e) { }
    const one = async n => {
      if (BZ.bytes[n]) return;
      try {
        let r = c && await c.match(bzFile(n));
        if (!r) { r = await fetch(bzFile(n)); if (!r.ok) return; if (c) c.put(bzFile(n), r.clone()).catch(() => { }); }
        BZ.bytes[n] = await r.arrayBuffer();
      } catch (e) { }
    };
    const order = [...BZ_CORE, ...Array.from({ length: BZ_N }, (_, i) => i + 1).filter(n => !BZ_CORE.includes(n))];
    for (let i = 0; i < order.length; i += 8) await Promise.all(order.slice(i, i + 8).map(one));
    BZ.loading = null;
  })();
}
function bzCtx() { try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); return AC; } catch (e) { return null; } }
function bzDecode(n) {
  if (BZ.buf[n]) return Promise.resolve(BZ.buf[n]);
  const ac = bzCtx(), b = BZ.bytes[n]; if (!ac || !b) return Promise.reject();
  return new Promise((ok, no) => { const p = ac.decodeAudioData(b.slice(0), ok, no); if (p && p.catch) p.catch(no); })
    .then(buf => { if (BZ_CORE.includes(n)) BZ.buf[n] = buf; return buf; });
}
function bzPick(pool) { const k = pool.join(), a = pool.length > 1 ? pool.filter(n => n !== BZ.last[k]) : pool; return BZ.last[k] = a[Math.floor(Math.random() * a.length)]; }
function bzHalt() { const c = BZ.cur; BZ.cur = null; if (c && c.s) { try { c.s.onended = null; c.s.stop(); } catch (e) { } } }
/* mode: 'cut' = stop whatever is playing and say this now; 'q' = say it after what's playing; 'lo' = only if nothing else is waiting.
   Returns false when the clip isn't on this phone yet, so the caller can fall back. */
function bzPlay(n, mode) {
  if (!pvOn()) return false;
  if (Array.isArray(n)) n = bzPick(n);
  if (!BZ.bytes[n]) { bzLoad(); return false; }
  if (mode === 'cut') { BZ.q.length = 0; bzHalt(); }
  else if (mode === 'lo' ? BZ.q.length : BZ.q.length >= 3) return true;
  BZ.q.push(n); bzNext(); return true;
}
function bzNext() {
  if (BZ.cur || !BZ.q.length) return;
  const n = BZ.q.shift(), tok = BZ.cur = { n }, skip = () => { if (BZ.cur === tok) { BZ.cur = null; bzNext(); } };
  bzDecode(n).then(buf => {
    if (BZ.cur !== tok) return;
    const ac = bzCtx(), s = ac.createBufferSource(); s.buffer = buf; s.connect(ac.destination); tok.s = s; s.onended = skip; s.start();
  }).catch(skip);
}
function bzQuiet() { BZ.q.length = 0; bzHalt(); clearTimeout(BZ.teaseT); }

/* ---- which form cue suits this exercise ---- */
function bzCue(ex) {
  const n = ex.n.toLowerCase(), cats = (PAT_CATS[ex.pat] || []).join(' ');
  if (/plank|hold|hollow|dead bug|wall sit/.test(n)) return [111, 112, 113, 114];
  if (/curl/.test(n) && !/leg|ham/.test(n)) return [96, 97, 98, 99, 110];
  if (/pull-?down|pull-?up|chin|row|face pull/.test(n)) return [107, 108, 109, 98, 110];
  if (/deadlift|rdl|hinge|hip thrust|bridge|good morning|swing/.test(n)) return [93, 94, 95, 92, 90];
  if (/lunge|split|step/.test(n)) return [103, 104, 105, 89, 92];
  if (/squat|leg press/.test(n) || /quads/.test(cats)) return [89, 91, 92, 84, 90];
  if (/press|push|dip|bench/.test(n) || /chest|shoulders/.test(cats)) return [6, 85, 86, 87, 100, 101, 88];
  if (/core/.test(cats)) return [112, 113, 90];
  return [90, 99, 102, 98];
}
const bzPush = ex => /press|push|dip|bench|squat/.test(ex.n.toLowerCase());

/* ---- rep pacer: the old voice calls land here ---- */
const _bzSay = pvSay;
pvSay = function (text, cut) {
  if (!pvOn() || !text) return;
  const t = String(text), pre = PC && !PC.done && performance.now() < PC.start; let k = null;
  if (/^[123]$/.test(t)) { if (pre && t === '3' && BZ.cur) return; k = 21 - +t; } // 3·2·1 (the "ready" line is still talking over the 3)
  else if (t === 'Hold') k = 5;
  else if (t === '10 seconds') k = 48;
  else if (/^\d+ seconds$/.test(t)) { if (bzReady()) bzPlay([113, 114, 8], 'lo'); return; }
  else if (t === 'Done. Nice hold.') k = 7;
  else if (/^Done\. /.test(t)) k = [46, 15];
  if (k && bzPlay(k, cut ? 'cut' : 'q')) return;
  if (!bzReady()) _bzSay(text, cut); // clips not here yet: the phone's voice fills in
};
pvRep = function (rep, ph, cls) {
  if (!pvOn() || !PC) return;
  const P0 = P[PC.pat].ph, left = PC.target ? PC.target - rep : null;
  if (ph === P0[0]) {
    if (rep === 0) { if (bzPlay(21, 'cut')) bzPlay(bzCue(PC.ex), 'q'); else if (!bzReady()) _bzSay(ph, true); return; }
    // the recording says "Two!" twice and never "Three!" (clip 024 is a second "Two!"), so rep three borrows the count-in "Three." (018)
    if (rep > 20) { if (!bzReady()) _bzSay(String(rep), true); return; } // past twenty he lets the beeps count
    if (!bzPlay(rep === 3 ? 18 : 21 + rep, 'cut')) { if (!bzReady()) _bzSay(left === 1 ? `${rep}. Last one` : String(rep), true); return; }
    if (left === 2 && PC.target >= 6) bzPlay(43, 'q'); /* on a short set "Two! Two more!" just sounds like he said two twice */ else if (left === 1 && PC.target >= 3) bzPlay(44, 'q'); else if (PC.target >= 6 && rep === Math.round(PC.target / 2)) bzPlay(42, 'q');
  } else if (cls === 'phase up' && rep === 0 && bzPush(PC.ex)) bzPlay(4, 'lo');
};
const _bzStop = pvStop; pvStop = function () { _bzStop(); BZ.q.length = 0; bzHalt(); };
const _bzOpenPacer = openPacer;
openPacer = function (si) {
  clearTimeout(BZ.teaseT); _bzOpenPacer(si);
  if (!PC || !pvOn()) return;
  const slots = DAYS[cur].slots, lastSet = PC.i === PC.sl.sets - 1, lastEx = slots.every((sl, k) => k === si || nextSetIdx(k) < 0);
  bzPlay(lastSet && lastEx ? 14 : PC.i > 0 ? [11, 2] : /squat|deadlift|hip thrust|leg press/.test(PC.ex.n.toLowerCase()) ? [9, 1, 2] : [1, 2], 'cut');
};
{ const pp = $('ppause'), old = pp.onclick; pp.onclick = e => { old(e); if (PC && pvOn()) bzPlay(PC.paused ? 76 : 13, 'cut'); }; }

/* ---- rest timer ---- */
const _bzStartRest = startRest;
startRest = function (sec, label, sub) {
  _bzStartRest(sec, label, sub); clearTimeout(BZ.teaseT);
  if (sec >= 20 && !appOff() && !dayDone(curWeek, cur)) bzPlay([47, 12, 52, 53], 'lo');
};
const _bzTickRest = tickRest;
tickRest = function () {
  const r = RT[PROF], was = r && !r.done;
  if (was && pvOn()) {
    const left = (r.end - Date.now()) / 1000;
    if (r.dur >= 25 && left <= 10 && left > 9 && !r.bz10) { r.bz10 = 1; bzPlay(48, 'lo'); }
    if (r.dur >= 12 && left <= 5 && left > 4 && !r.bz5) { r.bz5 = 1; bzPlay(49, 'lo'); }
  }
  _bzTickRest();
  if (was && r.done && pvOn() && !PC && !appOff() && !dayDone(curWeek, cur)) {
    bzPlay([50, 13, 54], 'cut'); clearTimeout(BZ.teaseT); BZ.teaseT = setTimeout(bzTease, 30000);
  }
};
function bzTease() { // still standing around half a minute after the rest ended
  if (!pvOn() || PC || appOff() || document.visibilityState !== 'visible' || !$('t-workout').classList.contains('on')) return;
  if ((RT[PROF] && !RT[PROF].done) || dayDone(curWeek, cur)) return;
  bzPlay(BZ_TEASE, 'lo');
}

/* ---- milestones ---- */
const bzDaySets = () => DAYS[cur].slots.reduce((n, sl, si) => n + setsOf(curWeek, cur, exId(exOf(cur, si))).filter(Boolean).length, 0);
const bzExDone = () => DAYS[cur].slots.filter((sl, si) => nextSetIdx(si) < 0).length;
function bzHist(skipToday) { // has this person logged anything (optionally: on another day)?
  for (const wk in S.logs) for (const di in S.logs[wk]) { if (skipToday && wk === curWeek && +di === cur) continue; for (const id in S.logs[wk][di]) if ((S.logs[wk][di][id].sets || []).some(Boolean)) return true; }
  return false;
}
function bzLastT() { let t = 0; for (const wk in S.logs) for (const di in S.logs[wk]) for (const id in S.logs[wk][di]) for (const s of S.logs[wk][di][id].sets || []) if (s && s.t > t) t = s.t; return t; }
const _bzLogSet = logSet;
logSet = function (si, i, w, r, w2, r2) {
  const on = pvOn(), ex = exOf(cur, si), sl = DAYS[cur].slots[si], id = exId(ex);
  const had = !!setsOf(curWeek, cur, id)[i], before = on ? bestOf(id) : null, n0 = on ? bzDaySets() : 0, d0 = on ? bzExDone() : 0, old = on && bzHist(true);
  _bzLogSet(si, i, w, r, w2, r2); clearTimeout(BZ.teaseT);
  if (!on || had) return;
  const sw = +w || 0, sr = +r || 0, timed = !!sl.time, lo = timed ? 0 : (nums(sl.reps)[0] || 0), top = timed ? 0 : repTop(sl.reps), N = DAYS[cur].slots.length, d1 = bzExDone();
  let k = 0;
  if (before.any && !timed && sw && (sw > before.w || e1rm(sw, sr) > before.e + .01)) k = [70, 45];
  else if (n0 === 0) k = 68;
  else if (!before.any && !timed && old && !setsOf(curWeek, cur, id).filter(Boolean)[1]) k = 74;
  else if (N >= 4 && d1 < N && d0 < Math.ceil(N / 2) && d1 >= Math.ceil(N / 2)) k = 69;
  else if (lo && sr && sr < lo) k = sr < lo * .6 ? 78 : 80;
  else if (top && sw && nextSetIdx(si) < 0 && setsOf(curWeek, cur, id).every(s => s && +s.r >= top)) k = 79;
  if (k) bzPlay(k, 'q');
};
const _bzAfterLog = afterLog;
afterLog = function (si) {
  const was = window.__dayWasDone, first = !bzHistDone();
  _bzAfterLog(si);
  if (!pvOn() || was || !dayDone(curWeek, cur)) return;
  bzPlay(first ? 67 : [71, 115, 116, 117], 'q');
  const done = DAYS.filter((d, di) => dayDone(curWeek, di)).length;
  if (done >= DAYS.length && DAYS.length > 1) bzPlay(72, 'q'); else if (done >= 2) bzPlay(73, 'q');
  localStorage.setItem('gymp.bzDone.' + uid(), '1');
};
const bzHistDone = () => !!localStorage.getItem('gymp.bzDone.' + uid()) || Object.keys(S.logs || {}).some(wk => wk !== curWeek && Object.keys(S.logs[wk] || {}).length);

/* ---- small moments around the app ---- */
document.addEventListener('click', e => { if (!appOff() && pvOn() && e.target.closest('[data-exrm]')) bzPlay(77, 'cut'); }, true);
document.addEventListener('pointerdown', () => { // first tap of a visit: clips need a tap before a phone lets them play
  if (BZ.hello || appOff() || !pvOn()) return; BZ.hello = true; bzCtx();
  const t = bzLastT(); if (t && Date.now() - t > 7 * 864e5) setTimeout(() => { if (!PC) bzPlay([75, 83], 'lo'); }, 600);
});

/* ---- the switch ---- */
pvPaint = function () {
  const on = pvOn(), b = $('pvoice'); if (b) { b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); b.textContent = on ? 'Coach Bigz on' : 'Coach Bigz off'; }
  const t = $('bzT'); if (t) { t.classList.toggle('on', on); t.textContent = on ? 'On' : 'Off'; t.setAttribute('aria-pressed', on); }
  const m = $('hmBz'); if (m) { m.setAttribute('aria-pressed', on); $('hmBzS').textContent = on ? 'On' : 'Off'; $('hmBzS').classList.toggle('on', on); }
};
function bzToggle() {
  const on = !pvOn(); localStorage.setItem('gymp.pacerVoice', on ? '1' : '0'); pvPaint();
  if (!on) { pvStop(); bzQuiet(); return; }
  bzCtx(); const p = bzLoad(); BZ.hello = true;
  if (!bzPlay(3, 'cut') && p) p.then(() => { if (pvOn() && !BZ.cur) bzPlay(3, 'cut'); });
}
$('pvoice').onclick = bzToggle;
document.addEventListener('click', e => { if (e.target.closest('#bzT')) bzToggle(); else if (e.target.closest('#hmBz')) { bzToggle(); toast(pvOn() ? 'Coach Bigz is on' : 'Coach Bigz is off', 1800); } });
const _bzRenderMore = renderMore;
renderMore = function () {
  _bzRenderMore(); const at = $('tReset'), row = at && at.closest('.hrow'); if (!row) return;
  row.insertAdjacentHTML('beforebegin', `<div class="hrow"><span>Coach Bigz: counts your reps, calls your rests and keeps you honest</span><button class="chip" id="bzT"></button></div>`); pvPaint();
};
pvPaint(); if (pvOn()) bzLoad();

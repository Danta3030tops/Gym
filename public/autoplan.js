/* Spott: auto progression and plan regeneration for plans made by the generator (plan.js).
   On while settings.plan.gen >= 2 and settings.plan.auto isn't false. A coach editing the plan switches it off (app.js sync),
   because from then on the coach decides the targets. Regenerating the plan switches it back on.
   TODO(pro): gate on hasPro() once the app has a subscription check (see plan.js). */
'use strict';
const genOn = () => { const p = S.settings.plan; return !!(p && p.gen >= GEN_V && p.auto !== false); };
const hasCoach = () => { const c = typeof trCoach === 'function' ? trCoach() : null; return !!(c && c.r && c.r.status === 'accepted'); };
const EX_BY_ID = Object.fromEntries(EX.map(e => [e.n.toLowerCase().replace(/[^a-z0-9]+/g, '-'), e]));
const progNotes = () => (S.settings.prog = S.settings.prog || {}); // { [exercise id]: { from, at } }: lifts swapped in for a stalled one

/* the note on each exercise card: the next target, and why it moved */
const _apSuggest = autoSuggest;
autoSuggest = function (sl, last, id) {
  if (!genOn() || sl.time || isDeload(curWeek)) return _apSuggest(sl, last, id);
  const sw = progNotes()[id], swHtml = sw && Date.now() - sw.at < 14 * 864e5 ? `<div class="sug">Swapped in for ${esc(sw.from)}: no progress on it in 3 weeks</div>` : '';
  if (!last) return sw ? { w: '', html: swHtml } : _apSuggest(sl, last, id);
  const name = (EX_BY_ID[id] || {}).n || (last.n || id.replace(/-/g, ' ')), hist = sessions(id).filter(s => !(s.wk === curWeek && s.di === cur));
  const t = progTarget(hist, sl.reps, sl.sets, name, unit());
  if (!t) return _apSuggest(sl, last, id);
  const short = esc(name.replace(/\s*\(.*\)\s*/, '')), top = repTop(sl.reps);
  const html = swHtml + (t.dir === 'up' ? `<div class="sug up">${short} up to ${t.w} ${unit()}, ${t.why}</div>`
    : t.dir === 'down' ? `<div class="sug">${short} down to ${t.w} ${unit()}: ${t.why}</div>`
    : `<div class="sug">Stay at ${t.w} ${unit()} until every set hits ${top}</div>`);
  return { w: S.settings.autoFill === false ? '' : t.w, html };
};

/* after a lift's last set: no progress on it for 3 weeks → swap it for a similar exercise, and say why */
const _apAfterLog = afterLog;
afterLog = function (si) {
  _apAfterLog(si);
  if (!genOn() || nextSetIdx(si) >= 0) return;
  const sl = DAYS[cur].slots[si], ex = exOf(cur, si); if (!sl || sl.time || !exMeta(ex.n)) return;
  if (!stalled(sessions(exId(ex)))) return;
  const today = DAYS[cur].slots.map((_, k) => exOf(cur, k).n), want = swapFor(ex.n, S.settings.plan, today);
  let i = want ? sl.opts.findIndex(o => o.n === want.n) : -1;
  if (i < 0) i = sl.opts.findIndex(o => o.n !== ex.n && !today.includes(o.n) && exOk(exMeta(o.n), S.settings.plan));
  if (i < 0) return; // nothing suitable to swap to: keep going with it
  const to = sl.opts[i]; S.settings.swaps[slotKey(cur, si)] = i || undefined; if (!i) delete S.settings.swaps[slotKey(cur, si)];
  progNotes()[exId(to)] = { from: ex.n, at: Date.now() }; touchSettings();
  setTimeout(() => toast(`No progress on ${ex.n} in 3 weeks, so next time it’s ${to.n}. A new lift gets you moving again.`, 6000), 1600);
};

/* regenerate: same answers, fresh plan, after a confirmation */
function genAnswers() { const p = S.settings.plan || {}; return { goal: p.goal || 'muscle', level: p.level || 'some', equip: p.equip || 'gym', mins: p.mins || 60, avoid: p.avoid || [], focus: p.focus || [], wds: p.wds || [1, 2, 4, 5] }; }
function genConfirm() {
  if (hasCoach()) return toast('Your coach looks after your plan.', 3500);
  openSheet(`<h3>Replace your plan?</h3><div class="sub">A new plan is made from your answers. Everything you’ve logged stays, but your current exercises, edits and swaps are replaced.</div>
    <button class="btn acc" data-genyes>Replace my plan</button><button class="btn ghost" data-buildplan>Change my answers first</button><button class="btn ghost" data-genno>Cancel</button>`);
}
function genReplace() {
  const a = genAnswers(), routine = generatePlan(a);
  if (!routine.length) return toast('Couldn’t make a plan from those answers.', 3500);
  S.settings.swaps = {}; S.settings.exSkip = {}; S.settings.exSkipDef = {}; S.settings.prog = {};
  S.settings.plan = { ...S.settings.plan, ...a, gen: GEN_V, auto: true }; touchSettings();
  saveRoutine(routine); closeSheet(); toast('New plan ready'); if (typeof renderAll === 'function') renderAll();
}
document.addEventListener('click', e => {
  if (appOff()) return; const t = e.target.closest('[data-genre],[data-genyes],[data-genno]'); if (!t) return;
  if (t.dataset.genre !== undefined) return genConfirm();
  if (t.dataset.genyes !== undefined) return genReplace();
  if (t.dataset.genno !== undefined) return closeSheet();
});

/* Settings: what kind of plan this is, and the way to make a new one */
const _apRenderMore = renderMore;
renderMore = function () {
  _apRenderMore(); const at = $('swReset'), card = at && at.closest('.card'); if (!card) return;
  const p = S.settings.plan, coach = hasCoach();
  const line = coach ? 'Your coach looks after your plan.' : p && p.gen >= GEN_V ? (p.auto === false ? 'Generated for you, then edited by a coach, so targets no longer change on their own.' : 'Generated for you. Targets go up as you hit your reps, and a lift that stalls for 3 weeks is swapped.') : p ? 'Built from your setup answers.' : 'You wrote this plan yourself.';
  card.insertAdjacentHTML('afterend', `<div class="card" id="genCard"><h3>Training plan</h3><div class="muted">${line}</div>
    ${coach ? '' : p ? '<div class="grid2"><button class="btn" data-genre>Regenerate plan</button><button class="btn" data-buildplan>Change my answers</button></div>' : '<button class="btn" data-buildplan>Generate a plan for me</button>'}</div>`);
};

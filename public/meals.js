/* Spott: meal planner. The Fuel tab shows the meal plan and tracks macros (calories, protein, carbs, fat) per day.
   The plan rides in the person's app_routines row, as a trailing { meals } element of the routine array (see mealsOf / packRoutine in core.js),
   so their coach can edit it exactly like the workout plan and no new table is needed. What was eaten lives in S.fuel[date]. */
'use strict';
let ML_FOR = null, MLW = null; // ML_FOR: set while a coach edits a client's meal plan { id, name, noted }. MLW: the working copy on the editor sheet.
const MACROS = [['cal', 'Calories', 'kcal'], ['p', 'Protein', 'g'], ['c', 'Carbs', 'g'], ['f', 'Fat', 'g']];
const MEAL_NAMES = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Pre-workout', 'Post-workout', 'Meal 7', 'Meal 8'];
const r1 = v => Math.max(0, Math.round(num(v) * 10) / 10);
const macLine = i => `${r1(i.cal).toLocaleString()} kcal · ${r1(i.p)}p ${r1(i.c)}c ${r1(i.f)}f`;
const mealSum = items => items.reduce((a, i) => ({ cal: a.cal + num(i.cal), p: a.p + num(i.p), c: a.c + num(i.c), f: a.f + num(i.f) }), { cal: 0, p: 0, c: 0, f: 0 });
const blankMeals = () => ({ t: { cal: 0, p: 0, c: 0, f: 0 }, meals: [], by: '', tb: '', at: 0 });
const coachTargets = () => { const c = typeof trCoach === 'function' ? trCoach() : null; return !!(MEALS && MEALS.tb && c && c.r.status === 'accepted' && c.p.id === MEALS.tb && MACROS.some(([k]) => MEALS.t[k])); }; // only while that coach is still mine
const mealTargets = () => { const g = goals(), t = coachTargets() ? MEALS.t : {}; return { cal: t.cal || num(g.cal), p: t.p || num(g.protein), c: t.c || num(g.carbs), f: t.f || num(g.fat) }; };
const fromCoach = () => !!(MEALS && MEALS.by && MEALS.by !== uid());
const ateKey = (mi, ii, it) => mi + ':' + ii + ':' + it.n;

/* ---------- what was eaten on a day: totals plus a short list ---------- */
function logFood(d, it, k) {
  S.fuel = S.fuel || {}; const f = { ...fuelOf(d) }, add = (a, b) => r1(num(a) + num(b));
  f.cal = add(f.cal, it.cal); f.protein = add(f.protein, it.p); f.carbs = add(f.carbs, it.c); f.fat = add(f.fat, it.f);
  f.log = [...(f.log || []), { n: String(it.n || 'Food').slice(0, 60), cal: r1(it.cal), p: r1(it.p), c: r1(it.c), f: r1(it.f), ...(k ? { k } : {}) }].slice(-40);
  f.u = Date.now(); S.fuel[d] = f; save();
}
function unlogFood(d, i) {
  const f = { ...fuelOf(d) }, it = (f.log || [])[i]; if (!it) return; const sub = (a, b) => r1(num(a) - num(b));
  f.cal = sub(f.cal, it.cal); f.protein = sub(f.protein, it.p); f.carbs = sub(f.carbs, it.c); f.fat = sub(f.fat, it.f);
  f.log = f.log.filter((_, j) => j !== i); f.u = Date.now(); S.fuel[d] = f; save();
}

/* ---------- Fuel tab: macro rings, the plan, the day's list (called from renderFuel in extras.js) ---------- */
function mealsTopHtml() {
  const f = fuelOf(fuelDate), T = mealTargets(), M = MEALS && MEALS.meals.length ? MEALS : null, log = f.log || [];
  let h = `<div class="card" id="mlRings"><div class="frings">${ring(num(f.cal), T.cal, 'Calories', '', 'cal')}${ring(num(f.protein), T.p, 'Protein', 'g', 'protein')}${ring(num(f.carbs), T.c, 'Carbs', 'g', 'carbs')}${ring(num(f.fat), T.f, 'Fat', 'g', 'fat')}</div>
    ${coachTargets() ? '<div class="muted" style="margin-top:8px;text-align:center">Targets set by your coach</div>' : ''}
    <button class="btn acc" data-mllog>＋ Log food</button></div>`;
  if (M) h += `<div class="card" id="mlPlan"><h3>Meal plan</h3>${fromCoach() ? '<div class="muted" style="margin:-4px 0 8px">Written by your coach. Tick each food as you eat it.</div>' : ''}
    ${M.meals.map((m, mi) => { const s = mealSum(m.items); return `<div class="mlmeal"><div class="mlh"><b>${esc(m.n)}</b><span>${m.items.length ? macLine(s) : 'empty'}</span></div>
      ${m.items.map((it, ii) => { const on = log.some(x => x.k === ateKey(mi, ii, it)); return `<div class="mlitem ${on ? 'on' : ''}"><div><b>${esc(it.n)}</b><span>${macLine(it)}</span></div><button class="chk" data-mlate="${mi}:${ii}" aria-label="${on ? 'Untick' : 'Tick as eaten'}" aria-pressed="${on}">✓</button></div>`; }).join('')}</div>`; }).join('')}
    <button class="btn ghost" data-mledit>Edit meal plan</button></div>`;
  else h += `<div class="card" id="mlPlan"><h3>No meal plan yet</h3><div class="muted">Plan your meals and tick them off as you eat, or just log food as you go. If you have a coach, they can write your plan for you.</div><button class="btn" data-mledit>Build a meal plan</button></div>`;
  const extra = log.map((x, i) => [x, i]).filter(([x]) => !x.k || !M);
  if (extra.length) h += `<div class="card" id="mlLog"><h3>Also eaten</h3>${extra.map(([x, i]) => `<div class="mlitem"><div><b>${esc(x.n)}</b><span>${macLine(x)}</span></div><button class="cbtn" data-mlun="${i}" aria-label="Remove">✕</button></div>`).join('')}</div>`;
  return h;
}
function foodSheet(mode, back) { // mode: 'log' (eaten today) or 'plan:<meal index>'
  openSheet(`<h3>${mode === 'log' ? 'Log food' : 'Add a food'}</h3><div class="sub">${mode === 'log' ? 'Adds to ' + (fuelDate === todayKey() ? 'today' : 'that day') + '. Only the name is needed; fill in what you know.' : esc(MLW.meals[+mode.split(':')[1]].n)}</div>
    <label class="fld">Food<input id="mfN" maxlength="60" placeholder="e.g. Chicken and rice"></label>
    <div class="grid2" style="margin-top:8px">${MACROS.map(([k, t, u]) => `<label class="fld">${t} (${u})<input id="mf_${k}" inputmode="decimal" placeholder="${k === 'cal' ? 'blank = worked out' : '0'}"></label>`).join('')}</div>
    <button class="btn acc" data-mlsave="${mode}">Save</button>${back ? '<button class="btn ghost" data-mleditback>Back</button>' : ''}`);
  setTimeout(() => { const el = $('mfN'); if (el) el.focus(); }, 350);
}
function readFood() {
  const n = $('mfN').value.trim(); if (!n) { toast('Give it a name'); return null; }
  const it = { n, p: r1($('mf_p').value), c: r1($('mf_c').value), f: r1($('mf_f').value) };
  it.cal = $('mf_cal').value.trim() ? r1($('mf_cal').value) : Math.round(it.p * 4 + it.c * 4 + it.f * 9); // 4 / 4 / 9 kcal per gram
  return it;
}

/* ---------- the plan editor (mine, or a client's when ML_FOR is set) ---------- */
function mealsEdit() {
  const M = MLW, coach = !!ML_FOR;
  openSheet(`<h3>${coach ? 'Edit ' + esc(ML_FOR.name) + '’s meal plan' : 'Meal plan'}</h3><div class="sub">${coach ? 'Every change is saved to their plan straight away.' : 'Every change is saved straight away. Your daily targets are under Goals on the Fuel tab.'}</div>
    ${coach ? `<div class="au-lbl" style="margin:0 0 6px">Daily targets (blank = they set their own)</div><div class="grid2">${MACROS.map(([k, t, u]) => `<label class="fld">${t} (${u})<input inputmode="decimal" data-mlt="${k}" value="${M.t[k] || ''}" placeholder="—"></label>`).join('')}</div>` : ''}
    ${M.meals.map((m, mi) => `<div class="mlmeal ed"><div class="mlh"><input data-mln="${mi}" value="${esc(m.n)}" maxlength="40" aria-label="Meal name"><button class="cbtn" data-mldel="${mi}" aria-label="Remove this meal">✕</button></div>
      ${m.items.map((it, ii) => `<div class="mlitem"><div><b>${esc(it.n)}</b><span>${macLine(it)}</span></div><button class="cbtn" data-mlidel="${mi}:${ii}" aria-label="Remove">✕</button></div>`).join('')}
      <button class="chip" data-mliadd="${mi}">＋ Add food</button></div>`).join('')}
    ${M.meals.length ? '' : '<div class="muted" style="margin:10px 0">No meals yet. Add the first one.</div>'}
    ${M.meals.length < 8 ? '<button class="btn acc" data-mladd>＋ Add a meal</button>' : ''}<button class="btn ghost" data-mldone>Done</button>`);
}
let mlQueue = Promise.resolve(); // a coach's saves go one at a time, so a save never trips over the one before it
function mealsCommit() {
  const m = cleanMeals({ ...MLW, by: uid(), at: Date.now(), ...(ML_FOR ? { tb: uid() } : {}) }); MLW = clone(m);
  if (!ML_FOR) { MEALS = m; saveRoutine(ROUTINE || []); return; } // rides along with the routine row; re-renders
  const e = ML_FOR, v = TR.vr; if (!v || TR.view !== e.id) return; v.meals = m;
  mlQueue = mlQueue.then(() => mealsPush(e, v, m), () => { });
}
async function mealsPush(e, v, m) {
  if (TR.vr !== v) return;
  if (!sb || !navigator.onLine) return toast('You’re offline. That change wasn’t saved.', 3500);
  const cur = await sb.from('app_routines').select('updated_at').eq('user_id', e.id).maybeSingle().then(r => r, x => ({ error: x }));
  if (!cur.error && cur.data && v.at && !sameAt(cur.data.updated_at, v.at)) { ML_FOR = null; closeSheet(); toast(`${e.name} changed their plan while you were editing. Here is the latest: make your change again.`, 5000); return trOpenClient(e.id); }
  const at = new Date().toISOString();
  const { error } = await sb.from('app_routines').upsert({ user_id: e.id, routine: packRoutine(v.routine, m), updated_by: uid(), updated_at: at, note: '' }).then(r => r, x => ({ error: x }));
  if (error) return toast('Couldn’t save that change. Check your connection.', 3500);
  v.at = at;
  if (!e.noted) { e.noted = true; sb.from('app_notes').insert({ user_id: e.id, from_id: uid(), kind: 'routine', body: '', data: {}, read: false }).then(() => { }, () => { }); } // one notification per editing session
}
const mlSaveInputs = () => { // names typed on the editor sheet are kept when another button redraws it
  if (!MLW) return false; let ch = false;
  document.querySelectorAll('#sheetin [data-mln]').forEach(el => { const m = MLW.meals[+el.dataset.mln], v = el.value.trim(); if (m && v && v !== m.n) { m.n = v; ch = true; } });
  document.querySelectorAll('#sheetin [data-mlt]').forEach(el => { const v = r1(el.value); if (v !== num(MLW.t[el.dataset.mlt])) { MLW.t[el.dataset.mlt] = v; ch = true; } });
  return ch;
};

/* ---------- a coach's view of one client: their meal plan and today's macros ---------- */
const _mlRenderClients = renderClients;
renderClients = function () {
  _mlRenderClients(); const plan = $('trPlan'), v = TR.vr; if (!plan || !TR.view || !v || !v.loaded) return;
  const M = v.meals, f = ((v.st || {}).fuel || {})[todayKey()] || {}, has = M && M.meals.length, tg = M && MACROS.filter(([k]) => M.t[k]);
  plan.insertAdjacentHTML('afterend', `<div class="card" id="trMeals"><h3>Meal plan</h3>
    <div class="muted">${num(f.cal) || num(f.protein) ? `Today so far: ${macLine({ cal: f.cal, p: f.protein, c: f.carbs, f: f.fat })}` : 'Nothing logged today yet.'}</div>
    ${tg && tg.length ? `<div class="muted" style="margin-top:4px">Targets: ${tg.map(([k, t, u]) => `${r1(M.t[k]).toLocaleString()} ${u === 'kcal' ? 'kcal' : u + ' ' + t.toLowerCase()}`).join(' · ')}</div>` : ''}
    ${has ? M.meals.map(m => `<div class="pv"><div class="pv-h"><b>${esc(m.n)}</b><span>${m.items.length} food${m.items.length === 1 ? '' : 's'} · ${Math.round(mealSum(m.items).cal).toLocaleString()} kcal</span></div>${m.items.map(it => `<div class="pv-x"><b>${esc(it.n)}</b><span>${macLine(it)}</span></div>`).join('')}</div>`).join('') : '<div class="muted" style="margin-top:8px">No meal plan yet. Write one and it shows up on their Fuel tab.</div>'}
    <button class="btn ${has ? '' : 'acc'}" data-mledit="client">${has ? 'Edit meal plan' : 'Write a meal plan'}</button></div>`);
};

document.addEventListener('click', e => {
  if (appOff()) return; const t = e.target.closest('[data-mllog],[data-mlate],[data-mlun],[data-mledit],[data-mleditback],[data-mladd],[data-mldel],[data-mliadd],[data-mlidel],[data-mlsave],[data-mldone]'); if (!t) return; const d = t.dataset;
  if (d.mllog !== undefined) { MLW = null; return foodSheet('log'); }
  if (d.mlate) { const [mi, ii] = d.mlate.split(':').map(Number), it = MEALS && MEALS.meals[mi] && MEALS.meals[mi].items[ii]; if (!it) return;
    const k = ateKey(mi, ii, it), i = (fuelOf(fuelDate).log || []).findIndex(x => x.k === k); if (i >= 0) unlogFood(fuelDate, i); else logFood(fuelDate, it, k); return renderFuel(); }
  if (d.mlun) { unlogFood(fuelDate, +d.mlun); return renderFuel(); }
  if (d.mledit !== undefined) {
    if (d.mledit === 'client') { const p = TR.profs[TR.view]; if (!p || !TR.vr || !TR.vr.loaded) return; ML_FOR = { id: p.id, name: frName(p).split(' ')[0], noted: false }; MLW = clone(TR.vr.meals || blankMeals()); }
    else { ML_FOR = null; MLW = clone(MEALS || blankMeals()); }
    return mealsEdit();
  }
  if (!MLW && d.mlsave !== 'log') return;
  if (d.mleditback !== undefined) return mealsEdit();
  if (d.mlsave) {
    const it = readFood(); if (!it) return;
    if (d.mlsave === 'log') { logFood(fuelDate, it); closeSheet(); renderFuel(); return toast('Logged'); }
    const m = MLW.meals[+d.mlsave.split(':')[1]]; if (!m || m.items.length >= 20) return; m.items.push(it); mealsCommit(); return mealsEdit();
  }
  const dirty = mlSaveInputs();
  if (d.mladd !== undefined) { if (MLW.meals.length >= 8) return; MLW.meals.push({ n: MEAL_NAMES.find(n => !MLW.meals.some(m => m.n === n)) || 'Meal', items: [] }); mealsCommit(); return mealsEdit(); }
  if (d.mldel) { MLW.meals.splice(+d.mldel, 1); mealsCommit(); return mealsEdit(); }
  if (d.mlidel) { const [mi, ii] = d.mlidel.split(':').map(Number); MLW.meals[mi].items.splice(ii, 1); mealsCommit(); return mealsEdit(); }
  if (d.mliadd) return (dirty && mealsCommit(), foodSheet('plan:' + d.mliadd, true));
  if (d.mldone !== undefined) { if (dirty) mealsCommit(); const c = ML_FOR; ML_FOR = null; MLW = null; closeSheet(); if (c && tab === 'clients') renderClients(); else if (tab === 'fuel') renderFuel(); }
});
document.addEventListener('change', e => { if (appOff() || !MLW || !e.target.matches('#sheetin [data-mln],#sheetin [data-mlt]')) return; if (mlSaveInputs()) mealsCommit(); });

/* Spott: build your own meals. Put a meal together from ingredients (found with food search), save it, then log it in one tap
   or add it to a meal plan as one item. Saved in settings.myMeals, so it syncs with the rest of the person's settings.
   A coach writing a client's meal plan sees their own saved meals in food search. */
'use strict';
const MY_MAX = 50, MY_ITEMS = 25;
const MY = { draft: null }; // the meal on the builder sheet: { id, n, items: [{ n, cal, p, c, f }] }
const myMeals = () => (Array.isArray(S.settings.myMeals) ? S.settings.myMeals : []).filter(m => m && m.id && Array.isArray(m.items));
const myTot = m => mealSum(m.items);
function mySheet() {
  const m = MY.draft, t = myTot(m), isNew = !myMeals().some(x => x.id === m.id);
  openSheet(`<h3>${isNew ? 'Build a meal' : 'Edit meal'}</h3><div class="sub">Add the ingredients once, then log the whole meal in one tap.</div>
    <label class="fld">Meal name<input id="myN" maxlength="60" value="${esc(m.n)}" placeholder="e.g. Chicken, rice and veg"></label>
    <div style="margin-top:10px">${m.items.length ? m.items.map((it, i) => `<div class="mlitem"><div><b>${esc(it.n)}</b><span>${macLine(it)}</span></div><button class="cbtn" data-myidel="${i}" aria-label="Remove">✕</button></div>`).join('') : '<div class="muted">No ingredients yet.</div>'}</div>
    ${m.items.length ? `<div class="hrow" style="margin-top:6px"><span>Whole meal</span><b>${macLine(t)}</b></div>` : ''}
    ${m.items.length < MY_ITEMS ? '<button class="btn" data-myadd>＋ Add ingredient</button>' : ''}
    <button class="btn acc" data-mysave ${m.items.length ? '' : 'disabled'}>Save meal</button>
    ${isNew ? '' : '<button class="btn ghost" data-mydel style="color:#ff453a">Delete meal</button>'}`);
}
const myName = () => { const el = $('myN'); if (el && MY.draft) MY.draft.n = el.value.trim().slice(0, 60); };
function mySave() {
  myName(); const m = MY.draft; if (!m || !m.items.length) return;
  if (!m.n) { const el = $('myN'); if (el) el.focus(); return toast('Give the meal a name'); }
  const list = myMeals().filter(x => x.id !== m.id);
  if (list.length >= MY_MAX) return toast(`You can save up to ${MY_MAX} meals. Delete one first.`, 3500);
  S.settings.myMeals = [{ id: m.id, n: m.n, items: m.items.slice(0, MY_ITEMS), u: Date.now() }, ...list]; touchSettings();
  MY.draft = null; closeSheet(); toast('Meal saved'); if (typeof renderFuel === 'function' && tab === 'fuel') renderFuel();
}
/* a meal on the plan → save it as one of my meals, so it can be logged in one tap any day */
const myItems = items => items.slice(0, MY_ITEMS).map(i => ({ n: String(i.n || '').slice(0, 60), cal: num(i.cal), p: num(i.p), c: num(i.c), f: num(i.f) }));
const mySig = items => JSON.stringify(myItems(items).map(i => [i.n, i.cal, i.p, i.c, i.f]));
function myMealBtn(mi, m) {
  const saved = myMeals().some(x => mySig(x.items) === mySig(m.items));
  return saved ? '<div class="muted" style="margin-top:6px;font-size:13px">✓ In My meals</div>' : `<button class="chip" data-myfrom="${mi}" style="margin-top:6px">＋ Save as my meal</button>`;
}
/* the Fuel tab: a "My meals" card under the plan */
const _myTop = mealsTopHtml;
mealsTopHtml = function () {
  const ms = myMeals();
  return _myTop() + `<div class="card" id="myMeals"><h3>My meals</h3>${ms.length ? ms.map(m => `<div class="mlitem"><div data-myedit="${esc(m.id)}" role="button" tabindex="0"><b>${esc(m.n)}</b><span>${m.items.length} ingredient${m.items.length === 1 ? '' : 's'} · ${macLine(myTot(m))}</span></div><button class="chip acc" data-mylog="${esc(m.id)}">Log</button></div>`).join('')
    : '<div class="muted">Save meals you eat often, like your usual breakfast, and log them in one tap.</div>'}
    <button class="btn" data-mynew>＋ Build a meal</button></div>`;
};
document.addEventListener('click', e => {
  if (appOff()) return; const t = e.target.closest('[data-mynew],[data-myedit],[data-mylog],[data-myadd],[data-myidel],[data-mysave],[data-mydel],[data-mlsave="mym"],[data-myback],[data-myfrom]'); if (!t) return; const d = t.dataset;
  if (d.mynew !== undefined) { MY.draft = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), n: '', items: [] }; return mySheet(); }
  if (d.myedit) { const m = myMeals().find(x => x.id === d.myedit); if (!m) return; MY.draft = JSON.parse(JSON.stringify(m)); return mySheet(); }
  if (d.myfrom !== undefined) { const m = MEALS && MEALS.meals[+d.myfrom]; if (!m || !m.items.length) return; MY.draft = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), n: String(m.n || '').slice(0, 60), items: myItems(m.items) }; return mySheet(); }
  if (d.mylog) { const m = myMeals().find(x => x.id === d.mylog); if (!m) return; const s = myTot(m); logFood(fuelDate, { n: m.n, cal: s.cal, p: s.p, c: s.c, f: s.f }); renderFuel(); return toast(`Logged ${m.n}`); }
  if (!MY.draft) return;
  if (d.myadd !== undefined) { myName(); foodSheet('log'); const h = document.querySelector('#sheetin h3'), b = document.querySelector('#sheetin [data-mlsave]'); if (h) h.textContent = 'Add an ingredient'; const sub = document.querySelector('#sheetin .sub'); if (sub) sub.textContent = 'Search for it, or type the name and numbers yourself.'; if (b) { b.dataset.mlsave = 'mym'; b.textContent = 'Add to meal'; b.insertAdjacentHTML('afterend', '<button class="btn ghost" data-myback>Back</button>'); } return; }
  if (d.mlsave === 'mym') { const it = readFood(); if (!it) return; MY.draft.items.push(it); return mySheet(); }
  if (d.myback !== undefined) return mySheet();
  if (d.myidel) { myName(); MY.draft.items.splice(+d.myidel, 1); return mySheet(); }
  if (d.mysave !== undefined) return mySave();
  if (d.mydel !== undefined) { S.settings.myMeals = myMeals().filter(x => x.id !== MY.draft.id); touchSettings(); MY.draft = null; closeSheet(); toast('Meal deleted'); if (tab === 'fuel') renderFuel(); }
});
document.addEventListener('input', e => { if (e.target.id === 'myN') myName(); });

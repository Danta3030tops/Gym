/* ================= food search (Log food / Add a food) =================
   Built-in list: foods.json, 5,000+ foods from USDA FoodData Central (public domain), per 100 g, with household portions.
   Rebuilt by dev/public-version/foods/build_foods.py. Also searches what this person has eaten or planned before.
   "Search online" asks Open Food Facts for packaged foods through the food-search edge function
   (dev/public-version/edge-food-search/index.ts); until the owner creates it, that button says so. */
const FS = { db: null, loading: null, sel: null, online: null, q: '' };
const FS_SYN = { saltfish: 'cod dried salted', 'salt fish': 'cod dried salted', callaloo: 'amaranth leaves', chocho: 'chayote', cho: 'chayote', irish: 'potato', sorrel: 'roselle', pear: 'avocado', 'sweet potato': 'sweet potato', gungo: 'pigeon peas', gungu: 'pigeon peas', 'rice and peas': 'rice beans', 'rice & peas': 'rice beans', coco: 'taro', dasheen: 'taro', bully: 'corned beef', 'bully beef': 'corned beef' }; // Jamaican names for foods the USDA list has under another name
function fsLoad() {
  if (FS.db || FS.loading) return FS.loading;
  return FS.loading = fetch('foods.json').then(r => r.json()).then(d => {
    FS.db = (d.f || []).map((x, i) => ({ i, n: String(x[0]), l: String(x[0]).toLowerCase(), k: +x[1] || 0, p: +x[2] || 0, c: +x[3] || 0, f: +x[4] || 0, por: x.slice(5).reduce((a, v, j, arr) => (j % 2 ? a : [...a, [String(v), +arr[j + 1] || 0]]), []).filter(p => p[1] > 0) }));
    FS.loading = null;
  }).catch(() => { FS.loading = null; });
}
const fsWords = q => { let s = q.toLowerCase().trim(); for (const k in FS_SYN) if (s === k || s.startsWith(k + ' ')) { s = FS_SYN[k] + s.slice(k.length); break; } return s.split(/[^a-z0-9%]+/).filter(Boolean).slice(0, 6); };
function fsSearch(q) {
  const w = fsWords(q); if (!w.length || !FS.db) return [];
  const re = w.map(x => new RegExp('(^|[^a-z])' + x.replace(/[^a-z0-9%]/g, ''))), out = [];
  for (const it of FS.db) {
    if (!re.every(r => r.test(it.l))) continue;
    const head = it.l.split(',')[0]; let s = -it.l.length / 12;
    if (it.l.startsWith(w[0])) s += 8; if (w.every(x => head.includes(x))) s += 5; if (it.i < 60) s += 3; // the raw / dry staples come first in the file
    if (/\b(baby|infant|toddler)\b/.test(it.l)) s -= 10;
    out.push([s, it]);
  }
  return out.sort((a, b) => b[0] - a[0]).slice(0, 25).map(x => x[1]);
}
function fsRecent() { // what this person has eaten or planned before, newest first, one row per name
  const seen = new Set(), out = [], push = it => { const n = String(it.n || '').trim(), k = n.toLowerCase(); if (!n || seen.has(k)) return; seen.add(k); out.push({ n, cal: r1(it.cal), p: r1(it.p), c: r1(it.c), f: r1(it.f) }); };
  Object.keys(S.fuel || {}).sort().reverse().slice(0, 60).forEach(d => (S.fuel[d].log || []).slice().reverse().forEach(push));
  [MEALS, MLW].forEach(M => M && (M.meals || []).forEach(m => (m.items || []).forEach(push)));
  return out.slice(0, 200);
}
const fsKcalLine = it => `${Math.round(it.k)} kcal per 100 g${it.por[0] ? ` · ${esc(it.por[0][0])}: ${Math.round(it.k * it.por[0][1] / 100)} kcal` : ''}`;
function fsResults() {
  const box = $('fsRes'); if (!box) return; const q = FS.q.trim();
  if (FS.sel) { box.innerHTML = ''; return; }
  const rec = fsRecent(), w = fsWords(q), rmatch = q ? rec.filter(r => w.every(x => r.n.toLowerCase().includes(x))).slice(0, 4) : rec.slice(0, 6);
  if (!FS.db && q) { box.innerHTML = '<div class="muted fsnote">Loading foods…</div>'; fsLoad().then(() => { if ($('fsRes')) fsResults(); }); return; }
  const hits = q ? fsSearch(q) : [];
  let h = '';
  if (rmatch.length) h += `<div class="fshd">${q ? 'You’ve had' : 'Recent'}</div>` + rmatch.map(r => `<button class="fsr" data-fsr="r:${esc(r.n)}"><b>${esc(r.n)}</b><span>${macLine(r)}</span></button>`).join('');
  if (hits.length) h += `<div class="fshd">Foods</div>` + hits.map(it => `<button class="fsr" data-fsr="u:${it.i}"><b>${esc(it.n)}</b><span>${fsKcalLine(it)}</span></button>`).join('');
  if (q && !hits.length && !rmatch.length) h += `<div class="muted fsnote">No match in the built-in list.</div>`;
  if (FS.online && FS.online.q === q) h += FS.online.html;
  else if (q.length >= 3) h += `<button class="chip fsonl" data-fsonline>Search packaged foods online for “${esc(q.slice(0, 40))}”</button>`;
  if (!q && !rmatch.length) h += `<div class="muted fsnote">Type a food to search 5,000+ foods, or fill in the boxes below yourself.</div>`;
  box.innerHTML = h;
}
async function fsOnline() {
  const q = FS.q.trim(); if (q.length < 3) return;
  if (!sb || !navigator.onLine) return toast('You’re offline. The built-in list still works.', 3500);
  FS.online = { q, html: '<div class="muted fsnote">Searching online…</div>', items: [] }; fsResults();
  let r; try { r = await sb.functions.invoke('food-search', { body: { q } }); } catch (e) { r = { error: e }; }
  if (!FS.online || FS.online.q !== q) return;
  const items = (!r.error && r.data && Array.isArray(r.data.items)) ? r.data.items.filter(x => x && x.n).slice(0, 20) : null;
  if (!items) { const off = r.error && /404|not found|Failed to send|FunctionsHttpError|FunctionsFetchError/i.test(String(r.error.name || '') + String(r.error.message || '') + String(r.error.context && r.error.context.status || ''));
    FS.online.html = `<div class="muted fsnote">${off ? 'Online search isn’t switched on yet.' : 'Couldn’t search online. Try again in a moment.'}</div>`; return fsResults(); }
  FS.online.items = items.map(x => ({ n: String(x.n).slice(0, 80) + (x.b ? ' · ' + String(x.b).slice(0, 30) : ''), k: +x.cal || 0, p: +x.p || 0, c: +x.c || 0, f: +x.f || 0, por: +x.sg > 0 ? [['1 serving', +x.sg]] : [] }));
  FS.online.html = (items.length ? `<div class="fshd">Packaged foods</div>` + FS.online.items.map((it, j) => `<button class="fsr" data-fsr="o:${j}"><b>${esc(it.n)}</b><span>${fsKcalLine(it)}</span></button>`).join('') : '<div class="muted fsnote">Nothing found online either.</div>')
    + '<div class="muted fsnote">Packaged foods include data from Open Food Facts (openfoodfacts.org).</div>';
  fsResults();
}
function fsPick(key) {
  const [t, v] = [key.slice(0, 1), key.slice(2)];
  if (t === 'u') { const it = FS.db && FS.db[+v]; if (!it) return; FS.sel = { n: it.n, k: it.k, p: it.p, c: it.c, f: it.f, por: it.por }; }
  else if (t === 'o') { const it = FS.online && FS.online.items[+v]; if (!it) return; FS.sel = { ...it }; }
  else { const r = fsRecent().find(x => x.n === v); if (!r) return; FS.sel = { n: r.n, fixed: r }; }
  const s = FS.sel, opts = s.fixed ? [['as before', 0]] : [...s.por, ['100 g', 100], ['grams', 1], ['oz', 28.35]];
  $('fsPick').hidden = false;
  $('fsPick').innerHTML = `<div class="fssel"><b>${esc(s.n)}</b><button class="cbtn" data-fsclear aria-label="Pick a different food">✕</button></div>
    <div class="grid2"><label class="fld">How much<input id="fsAmt" inputmode="decimal" value="1"></label>
    <label class="fld">Portion<select id="fsPor">${opts.map(([l, g], j) => `<option value="${j}">${esc(l)}${g && l !== 'grams' && l !== '100 g' && l !== 'oz' ? ` (${Math.round(g)} g)` : ''}</option>`).join('')}</select></label></div>`;
  FS.opts = opts; $('fsRes').innerHTML = ''; fsFill();
}
function fsFill() {
  const s = FS.sel; if (!s) return; const amt = Math.max(0, num(($('fsAmt') || {}).value)), [lab, g] = FS.opts[+(($('fsPor') || {}).value) || 0] || ['', 0];
  let m; if (s.fixed) m = { cal: s.fixed.cal * amt, p: s.fixed.p * amt, c: s.fixed.c * amt, f: s.fixed.f * amt };
  else { const grams = amt * g; m = { cal: s.k * grams / 100, p: s.p * grams / 100, c: s.c * grams / 100, f: s.f * grams / 100 }; }
  const qty = s.fixed ? (amt === 1 ? '' : `×${r1(amt)}`) : lab === 'grams' ? `${r1(amt)} g` : lab === '100 g' ? `${r1(amt * 100)} g` : `${r1(amt)} ${lab}`;
  const nm = qty ? `${s.n.slice(0, 56 - qty.length).replace(/[ ,·]+$/, '')} (${qty})` : s.n.slice(0, 60);
  const set = (id, v) => { const el = $(id); if (el) el.value = v; };
  set('mfN', nm); set('mf_cal', Math.round(m.cal)); set('mf_p', r1(m.p)); set('mf_c', r1(m.c)); set('mf_f', r1(m.f));
}
const _fsFoodSheet = foodSheet;
foodSheet = function (mode, back) {
  _fsFoodSheet(mode, back); FS.sel = null; FS.q = ''; FS.online = null; fsLoad();
  const at = document.querySelector('#sheetin label.fld'); if (!at) return;
  at.insertAdjacentHTML('beforebegin', `<div class="fs"><input id="fsQ" type="search" placeholder="Search foods: rice, chicken, plantain…" autocomplete="off" enterkeyhint="search" aria-label="Search foods"><div id="fsRes"></div><div id="fsPick" hidden></div></div>`);
  fsResults(); clearTimeout(FS.focusT); FS.focusT = setTimeout(() => { const q = $('fsQ'); if (q) q.focus(); }, 360);
};
document.addEventListener('input', e => {
  if (e.target.id === 'fsQ') { FS.q = e.target.value; clearTimeout(FS.t); FS.t = setTimeout(fsResults, 120); }
  else if (e.target.id === 'fsAmt') fsFill();
});
document.addEventListener('change', e => { if (e.target.id === 'fsPor') { const l = (FS.opts[+e.target.value] || [])[0]; if (l === 'grams' && num($('fsAmt').value) <= 5) $('fsAmt').value = 100; else if (l !== 'grams' && num($('fsAmt').value) >= 20) $('fsAmt').value = 1; fsFill(); } });
document.addEventListener('click', e => {
  if (appOff()) return; const t = e.target.closest('[data-fsr],[data-fsclear],[data-fsonline]'); if (!t) return;
  if (t.dataset.fsr) return fsPick(t.dataset.fsr);
  if (t.dataset.fsonline !== undefined) return fsOnline();
  if (t.dataset.fsclear !== undefined) { FS.sel = null; $('fsPick').hidden = true; $('fsPick').innerHTML = ''; fsResults(); const q = $('fsQ'); if (q) q.focus(); }
});

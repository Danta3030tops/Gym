/* Public Gym app: first-time setup. Name and colour → goal → schedule → plan preview → saved to the account. */
'use strict';
const OB = { i: 0, name: '', color: '', goal: '', days: 4, level: 'some', unit: 'lb', routine: null, busy: false };
const OB_STEPS = ['profile', 'goal', 'schedule', 'plan'];
function startOnboarding() {
  Object.assign(OB, { i: 0, name: ME.display_name && ME.display_name !== ME.username ? ME.display_name : '', color: ME.color || themeColor, goal: '', days: 4, level: 'some', unit: 'lb', routine: null, busy: false });
  document.body.classList.add('out'); $('auth').classList.remove('show'); $('onb').classList.add('show');
  renderOb('fwd');
}
function renderOb(dir) {
  const step = OB_STEPS[OB.i], el = $('obStep'), coach = ME.role === 'trainer';
  $('obDots').innerHTML = OB_STEPS.map((_, i) => `<i class="${i <= OB.i ? 'on' : ''}"></i>`).join('');
  $('obBack').hidden = OB.i === 0;
  $('obSkip').hidden = !(coach && step === 'goal'); // coaches don't need a plan of their own
  let h = '';
  if (step === 'profile') h = `<h1 class="ob-h">Welcome, @${esc(ME.username)}</h1><p class="ob-p">What should people call you${coach ? ', coach' : ''}?</p>
    <div class="grp"><label><span>Name</span><input id="obName" autocomplete="name" autocapitalize="words" maxlength="30" value="${esc(OB.name)}" placeholder="Your name"></label></div>
    <div class="au-lbl">Your colour</div>
    <div class="swatches">${ACCENTS.map(([c, n]) => `<button class="sw ${c === OB.color ? 'on' : ''}" data-color="${c}" style="--c:${c}" aria-label="${n}"></button>`).join('')}</div>
    <div class="ob-foot"><button class="au-go" data-obnext>Continue</button></div>`;
  if (step === 'goal') h = `<h1 class="ob-h">What’s your main goal?</h1><p class="ob-p">This sets your reps, rests and exercise mix. You can change it later.</p>
    <div class="pick one">${GOALS.map(([k, ic, t, s]) => `<button class="pk row ${OB.goal === k ? 'on' : ''}" data-goal="${k}"><i>${ic}</i><div><b>${t}</b><span>${s}</span></div></button>`).join('')}</div>
    <div class="ob-foot"><button class="au-go" data-obnext ${OB.goal ? '' : 'disabled'}>Continue</button></div>`;
  if (step === 'schedule') h = `<h1 class="ob-h">How often will you train?</h1><p class="ob-p">Pick what you can keep up every week. Consistency beats ambition.</p>
    <div class="dayn">${[3, 4, 5].map(n => `<button class="pk ${OB.days === n ? 'on' : ''}" data-days="${n}"><b>${n}</b><span>days a week</span></button>`).join('')}</div>
    <div class="au-lbl">Experience</div>
    <div class="pick one">${LEVELS.map(([k, t, s]) => `<button class="pk ${OB.level === k ? 'on' : ''}" data-level="${k}"><b>${t}</b><span>${s}</span></button>`).join('')}</div>
    <div class="au-lbl">Weights in</div>
    <div class="seg" style="margin:0">${[['lb', 'Pounds (lb)'], ['kg', 'Kilograms (kg)']].map(([k, t]) => `<button class="${OB.unit === k ? 'on' : ''}" data-unit="${k}">${t}</button>`).join('')}</div>
    <div class="ob-foot"><button class="au-go" data-obnext>Build my plan</button></div>`;
  if (step === 'plan') {
    OB.routine = buildRoutine({ goal: OB.goal, days: OB.days, level: OB.level });
    h = `<h1 class="ob-h">Your plan is ready</h1><p class="ob-p">${OB.routine.length} days a week, built for “${esc((GOALS.find(g => g[0] === OB.goal) || [])[2] || '')}”. Every exercise can be swapped once you’re in.</p>
      ${OB.routine.map(d => `<div class="pv"><div class="pv-h"><b>${esc(d.title)}</b><span>${esc(d.d)} · ${d.slots.length} exercises</span></div>${d.slots.map(sl => `<div class="pv-x"><b>${esc(sl.opts[0].n)}</b><span>${sl.sets} × ${esc(sl.reps)}</span></div>`).join('')}</div>`).join('')}
      <div class="ob-foot"><button class="au-go" id="obDone">Start training</button></div>`;
  }
  el.className = 'ob-step ' + (dir == null ? 'fwd' : dir); /* '' = redraw in place, no slide */ el.innerHTML = h; $('onb').scrollTop = 0;
}
function obGo(d) {
  if (OB_STEPS[OB.i] === 'profile') { const n = $('obName').value.trim(); if (d > 0 && !n) { $('obName').focus(); return toast('Add your name first'); } OB.name = n; }
  OB.i = Math.max(0, Math.min(OB_STEPS.length - 1, OB.i + d)); renderOb(d > 0 ? 'fwd' : 'back');
}
async function finishOnboarding(routine) {
  if (OB.busy) return; OB.busy = true;
  const uid = session.user.id, b = $('obDone'), name = OB.name || ME.username; if (b) { b.disabled = true; b.textContent = 'Saving…'; }
  try {
    const p = await sb.from('app_profiles').update({ display_name: name, color: OB.color }).eq('id', uid); if (p.error) throw p.error;
    const r = await sb.from('app_routines').upsert({ user_id: uid, routine, updated_by: uid, updated_at: new Date().toISOString(), note: '' }); if (r.error) throw r.error;
    ST.settings = { ...ST.settings, unit: OB.unit, goal: OB.goal || null, daysPerWeek: routine.length || null, level: OB.level, u: Date.now() }; saveLocal(uid, ST);
    const s = await sb.from('app_state').upsert({ user_id: uid, data: ST, updated_at: new Date().toISOString() }); if (s.error) throw s.error;
    ME = { ...ME, display_name: name, color: OB.color }; ROUTINE = routine;
    cacheSet('gymp.me.' + uid, ME); cacheSet('gymp.routine.' + uid, { routine });
    showHome(); toast(routine.length ? '🔥 You’re all set' : '✅ You’re all set, coach');
  } catch (e) { if (b) { b.disabled = false; b.textContent = 'Start training'; } toast('Couldn’t save. Check your connection and try again.', 4000); }
  OB.busy = false;
}
$('onb').addEventListener('click', e => {
  const t = e.target.closest('button'); if (!t) return; const d = t.dataset;
  if (t.id === 'obBack') return obGo(-1);
  if (t.id === 'obSkip') { OB.name = OB.name || ME.username; return finishOnboarding([]); }
  if (t.id === 'obDone') return finishOnboarding(OB.routine);
  if (d.obnext !== undefined) return obGo(1);
  if (d.color) { OB.color = d.color; OB.name = $('obName').value; applyTheme(d.color); return renderOb(''); }
  if (d.goal) { OB.goal = d.goal; return renderOb(''); }
  if (d.days) { OB.days = +d.days; return renderOb(''); }
  if (d.level) { OB.level = d.level; return renderOb(''); }
  if (d.unit) { OB.unit = d.unit; return renderOb(''); }
});

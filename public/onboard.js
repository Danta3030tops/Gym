/* Public Gym app: first-time setup. Name and colour → goal → schedule → plan preview → saved to the account. */
'use strict';
const OB = { i: 0, name: '', color: '', goal: '', focus: [], wds: [1, 2, 4, 5], mins: 60, equip: 'gym', level: 'some', unit: 'lb', routine: null, busy: false };
const OB_STEPS = ['profile', 'start', 'goal', 'focus', 'schedule', 'setup', 'plan', 'blank']; // 'blank' is only reached from 'start', by choosing an empty plan
const OB_GOAL = OB_STEPS.indexOf('goal');
const obAnswers = () => ({ goal: OB.goal, focus: OB.focus, wds: OB.wds, mins: OB.mins, equip: OB.equip, level: OB.level });
function startOnboarding(fromStep) {
  Object.assign(OB, { i: fromStep || 0, first: fromStep || 0, name: ME.display_name && ME.display_name !== ME.username ? ME.display_name : '', color: ME.color || themeColor, goal: '', mode: 'auto', focus: [], wds: [1, 2, 4, 5], mins: 60, equip: 'gym', level: 'some', unit: 'lb', routine: null, busy: false });
  document.body.classList.add('out'); $('auth').classList.remove('show'); $('onb').classList.add('show');
  renderOb('fwd');
}
function renderOb(dir) {
  const step = OB_STEPS[OB.i], el = $('obStep'), coach = ME.role === 'trainer';
  $('obDots').innerHTML = (step === 'blank' ? [0, 1, 2] : OB_STEPS.slice(0, -1)).map((_, i) => `<i class="${step === 'blank' || i <= OB.i ? 'on' : ''}"></i>`).join('');
  $('obBack').hidden = OB.i === (OB.first || 0) && !OB.first; $('obBack').textContent = OB.first && OB.i === OB.first ? '✕' : '‹';
  $('obSkip').hidden = !(coach && step === 'goal' && !OB.first); // coaches don't need a plan of their own
  let h = '';
  if (step === 'profile') h = `<h1 class="ob-h">Welcome, @${esc(ME.username)}</h1><p class="ob-p">What should people call you${coach ? ', coach' : ''}?</p>
    <div class="grp"><label><span>Name</span><input id="obName" autocomplete="name" autocapitalize="words" maxlength="30" value="${esc(OB.name)}" placeholder="Your name"></label></div>
    <div class="au-lbl">Your colour</div>
    <div class="swatches">${ACCENTS.map(([c, n]) => `<button class="sw ${c === OB.color ? 'on' : ''}" data-color="${c}" style="--c:${c}" aria-label="${n}"></button>`).join('')}</div>
    <div class="ob-foot"><button class="au-go" data-obnext>Continue</button></div>`;
  if (step === 'start') h = `<h1 class="ob-h">How do you want to start?</h1><p class="ob-p">You can switch at any time from Edit plan in the menu.</p>
    <div class="pick one"><button class="pk row ${OB.mode === 'auto' ? 'on' : ''}" data-mode="auto"><div><b>Build me a plan</b><span>Answer a few questions and get a weekly routine made for your goal, days and equipment.</span></div></button>
    <button class="pk row ${OB.mode === 'blank' ? 'on' : ''}" data-mode="blank"><div><b>Start from scratch</b><span>An empty week. Name your own days and add your own exercises, or let your coach build it for you.</span></div></button></div>
    <div class="ob-foot"><button class="au-go" data-obnext>Continue</button></div>`;
  if (step === 'blank') h = `<h1 class="ob-h">Which days will you train?</h1><p class="ob-p">Each day starts empty. You, or your coach, decide what goes on it. Days can be added, moved or removed later.</p>
    <div class="wdays">${[1, 2, 3, 4, 5, 6, 7].map(d => `<button class="wd ${OB.wds.includes(d) ? 'on' : ''}" data-wd="${d}" aria-pressed="${OB.wds.includes(d)}">${WD_NAMES[d]}</button>`).join('')}</div>
    <div class="au-hint" id="obDays">${OB.wds.length} day${OB.wds.length === 1 ? '' : 's'} a week</div>
    <div class="au-lbl">Weights in</div>
    <div class="seg" style="margin:0">${[['lb', 'Pounds (lb)'], ['kg', 'Kilograms (kg)']].map(([k, t]) => `<button class="${OB.unit === k ? 'on' : ''}" data-unit="${k}">${t}</button>`).join('')}</div>
    <div class="ob-foot"><button class="au-go" id="obBlank">Start with an empty plan</button></div>`;
  if (step === 'goal') h = `<h1 class="ob-h">What’s your main goal?</h1><p class="ob-p">This sets your reps, rests and exercise mix. You can change it later.</p>
    <div class="pick one">${GOALS.map(([k, ic, t, s]) => `<button class="pk row ${OB.goal === k ? 'on' : ''}" data-goal="${k}"><i>${ic}</i><div><b>${t}</b><span>${s}</span></div></button>`).join('')}</div>
    <div class="ob-foot"><button class="au-go" data-obnext ${OB.goal ? '' : 'disabled'}>Continue</button></div>`;
  if (step === 'focus') h = `<h1 class="ob-h">Anything you want to focus on?</h1><p class="ob-p">Pick up to two areas and they get extra work each week. Or skip this for a balanced plan.</p>
    <div class="pick">${FOCUS.map(([k, , t]) => `<button class="pk ${OB.focus.includes(k) ? 'on' : ''}" data-focus="${k}"><b>${t}</b></button>`).join('')}</div>
    <div class="ob-foot"><button class="au-go" data-obnext>${OB.focus.length ? 'Continue' : 'No preference'}</button></div>`;
  if (step === 'schedule') h = `<h1 class="ob-h">When will you train?</h1><p class="ob-p">Pick the days you can keep up every week. Consistency beats ambition.</p>
    <div class="wdays">${[1, 2, 3, 4, 5, 6, 7].map(d => `<button class="wd ${OB.wds.includes(d) ? 'on' : ''}" data-wd="${d}" aria-pressed="${OB.wds.includes(d)}">${WD_NAMES[d]}</button>`).join('')}</div>
    <div class="au-hint" id="obDays">${OB.wds.length} day${OB.wds.length === 1 ? '' : 's'} a week${OB.wds.length === 7 ? ' · no rest day, so keep some sessions easy' : ''}</div>
    <div class="au-lbl">How long is a session?</div>
    <div class="dayn">${MINS.map(([m, t, n]) => `<button class="pk ${OB.mins === m ? 'on' : ''}" data-mins="${m}"><b>${t.replace(' min', '')}</b><span>minutes</span></button>`).join('')}</div>
    <div class="ob-foot"><button class="au-go" data-obnext>Continue</button></div>`;
  if (step === 'setup') h = `<h1 class="ob-h">Where do you train?</h1><p class="ob-p">Your plan only uses equipment you have.</p>
    <div class="pick one">${EQUIP.map(([k, ic, t, s]) => `<button class="pk row ${OB.equip === k ? 'on' : ''}" data-equip="${k}"><i>${ic}</i><div><b>${t}</b><span>${s}</span></div></button>`).join('')}</div>
    <div class="au-lbl">Experience</div>
    <div class="pick one">${LEVELS.map(([k, t, s]) => `<button class="pk ${OB.level === k ? 'on' : ''}" data-level="${k}"><b>${t}</b><span>${s}</span></button>`).join('')}</div>
    <div class="au-lbl">Weights in</div>
    <div class="seg" style="margin:0">${[['lb', 'Pounds (lb)'], ['kg', 'Kilograms (kg)']].map(([k, t]) => `<button class="${OB.unit === k ? 'on' : ''}" data-unit="${k}">${t}</button>`).join('')}</div>
    <div class="ob-foot"><button class="au-go" data-obnext>Build my plan</button></div>`;
  if (step === 'plan') {
    OB.routine = buildRoutine(obAnswers());
    h = `<h1 class="ob-h">Your plan is ready</h1><p class="ob-p">${OB.routine.length} day${OB.routine.length === 1 ? '' : 's'} a week, built for “${esc((GOALS.find(g => g[0] === OB.goal) || [])[2] || '')}”. Every exercise can be swapped once you’re in.</p>
      ${OB.routine.map(d => `<div class="pv"><div class="pv-h"><b>${esc(d.title)}</b><span>${esc(d.d)} · ${d.slots.length} exercises</span></div>${d.slots.map(sl => `<div class="pv-x"><b>${esc(sl.opts[0].n)}</b><span>${sl.sets} × ${esc(sl.reps)}</span></div>`).join('')}</div>`).join('')}
      <div class="ob-foot"><button class="au-go" id="obDone">Start training</button></div>`;
  }
  el.className = 'ob-step ' + (dir == null ? 'fwd' : dir); /* '' = redraw in place, no slide */ el.innerHTML = h; $('onb').scrollTop = 0;
}
function obGo(d) {
  if (OB_STEPS[OB.i] === 'profile') { const n = $('obName').value.trim(); if (d > 0 && !n) { $('obName').focus(); return toast('Add your name first'); } OB.name = n; }
  const step = OB_STEPS[OB.i], at = k => OB_STEPS.indexOf(k);
  if (step === 'start' && d > 0 && OB.mode === 'blank') OB.i = at('blank'); else if (step === 'blank' && d < 0) OB.i = at('start');
  else OB.i = Math.max(0, Math.min(at('plan'), OB.i + d));
  renderOb(d > 0 ? 'fwd' : 'back');
}
async function finishOnboarding(routine, blank) {
  if (OB.busy) return; OB.busy = true;
  const uid = session.user.id, b = $('obDone'), name = OB.name || ME.username; if (b) { b.disabled = true; b.textContent = 'Saving…'; }
  try {
    const p = await sb.from('app_profiles').update({ display_name: name, color: OB.color }).eq('id', uid); if (p.error) throw p.error;
    const r = await sb.from('app_routines').upsert({ user_id: uid, routine: packRoutine(routine, MEALS), updated_by: uid, updated_at: new Date().toISOString(), note: '' }); if (r.error) throw r.error;
    S.settings = { ...S.settings, unit: OB.unit, plan: routine.length && !blank ? obAnswers() : null, u: Date.now() }; saveLocal(uid, S);
    const s = await sb.from('app_state').upsert({ user_id: uid, data: S, updated_at: new Date().toISOString() }); if (s.error) throw s.error;
    ME = { ...ME, display_name: name, color: OB.color }; ROUTINE = routine;
    cacheSet('gymp.me.' + uid, ME); cacheSet('gymp.routine.' + uid, { routine: packRoutine(routine, MEALS) });
    showHome(); toast(blank ? 'Your empty week is ready' : routine.length ? 'You’re all set' : 'You’re all set, coach');
  } catch (e) { if (b) { b.disabled = false; b.textContent = 'Start training'; } toast('Couldn’t save. Check your connection and try again.', 4000); }
  OB.busy = false;
}
$('onb').addEventListener('click', e => {
  const t = e.target.closest('button'); if (!t) return; const d = t.dataset;
  if (t.id === 'obBack') { if (OB.first && OB.i === OB.first) return showHome(); return obGo(-1); } // ✕ leaves the plan builder
  if (t.id === 'obSkip') { OB.name = OB.name || ME.username; return finishOnboarding([]); }
  if (t.id === 'obDone') return finishOnboarding(OB.routine);
  if (t.id === 'obBlank') return finishOnboarding(OB.wds.map((wd, i) => ({ d: WD_NAMES[wd], wd, title: 'Day ' + (i + 1), slots: [] })), true);
  if (d.mode) { OB.mode = d.mode; return renderOb(''); }
  if (d.obnext !== undefined) return obGo(1);
  if (d.color) { OB.color = d.color; OB.name = $('obName').value; applyTheme(d.color); return renderOb(''); }
  if (d.goal) { OB.goal = d.goal; return renderOb(''); }
  if (d.focus) { OB.focus = OB.focus.includes(d.focus) ? OB.focus.filter(x => x !== d.focus) : [...OB.focus, d.focus].slice(-2); return renderOb(''); }
  if (d.wd) { const n = +d.wd, on = OB.wds.includes(n); if (on && OB.wds.length <= WD_MIN) return toast('Pick at least one day'); OB.wds = on ? OB.wds.filter(x => x !== n) : [...OB.wds, n].sort((a, b) => a - b); return renderOb(''); }
  if (d.mins) { OB.mins = +d.mins; return renderOb(''); }
  if (d.equip) { OB.equip = d.equip; return renderOb(''); }
  if (d.level) { OB.level = d.level; return renderOb(''); }
  if (d.unit) { OB.unit = d.unit; return renderOb(''); }
});
document.addEventListener('click', e => { if (e.target.closest('[data-buildplan]') && session) { if (typeof closeSheet === 'function') closeSheet(); startOnboarding(OB_GOAL); OB.name = ME.display_name || ME.username; OB.unit = S.settings.unit || 'lb'; } });

/* Public Gym app: first-time setup. Name and colour → goal → schedule → plan preview → saved to the account. */
'use strict';
const OB = { i: 0, name: '', color: '', goal: '', focus: [], avoid: [], wds: [1, 2, 4, 5], mins: 60, equip: 'gym', level: 'some', unit: 'lb', routine: null, busy: false, coachU: '' };
const OB_STEPS = ['profile', 'coach', 'start', 'goal', 'focus', 'schedule', 'setup', 'avoid', 'plan', 'blank', 'coachpick']; // 'blank' is only reached from 'start' (an empty plan), 'coachpick' from 'coach' (training with a coach)
const OB_GOAL = OB_STEPS.indexOf('goal');
const obAnswers = () => ({ goal: OB.goal, focus: OB.focus, wds: OB.wds, mins: OB.mins, split: OB.split || 'auto', equip: OB.equip, level: OB.level, avoid: OB.avoid, gen: GEN_V, auto: true }); // saved in settings.plan, so the plan can be regenerated
const splitHint = n => { const k = genSplit('auto', Math.min(6, Math.max(2, n))); return k ? 'For ' + k.length + ' days: ' + [...new Set(k.map(x => DAY_T[x][0]))].join(' / ') : 'The best fit for your days'; };
function startOnboarding(fromStep) {
  Object.assign(OB, { i: fromStep || 0, first: fromStep || 0, name: ME.display_name && ME.display_name !== ME.username ? ME.display_name : '', color: ME.color || themeColor, goal: '', mode: 'auto', focus: [], avoid: [], wds: [1, 2, 4, 5], mins: 60, split: 'auto', equip: 'gym', level: 'some', unit: 'lb', routine: null, busy: false, coachU: '' });
  document.body.classList.add('out'); $('auth').classList.remove('show'); $('onb').classList.add('show');
  renderOb('fwd');
}
function renderOb(dir) {
  const step = OB_STEPS[OB.i], el = $('obStep'), coach = ME.role === 'trainer';
  $('obDots').innerHTML = (step === 'blank' || step === 'coachpick' ? [0, 1, 2] : OB_STEPS.slice(0, OB_STEPS.indexOf('plan') + 1)).map((_, i) => `<i class="${step === 'blank' || i <= OB.i ? 'on' : ''}"></i>`).join('');
  $('obBack').hidden = OB.i === (OB.first || 0) && !OB.first; $('obBack').textContent = OB.first && OB.i === OB.first ? '✕' : '‹';
  $('obSkip').hidden = !(coach && step === 'goal' && !OB.first); // coaches don't need a plan of their own
  let h = '';
  if (step === 'profile') h = `<h1 class="ob-h">Welcome, @${esc(ME.username)}</h1><p class="ob-p">What should people call you${coach ? ', coach' : ''}?</p>
    <div class="grp"><label><span>Name</span><input id="obName" autocomplete="name" autocapitalize="words" maxlength="30" value="${esc(OB.name)}" placeholder="Your name"></label></div>
    <div class="au-lbl">Your colour</div>
    <div class="swatches">${ACCENTS.map(([c, n]) => `<button class="sw ${c === OB.color ? 'on' : ''}" data-color="${c}" style="--c:${c}" aria-label="${n}"></button>`).join('')}</div>
    <div class="ob-foot"><button class="au-go" data-obnext>Continue</button></div>`;
  if (step === 'coach') h = `<h1 class="ob-h">Are you training with a coach?</h1><p class="ob-p">If you have a personal trainer, they can write your plan and see your training here.</p>
    <div class="pick one"><button class="pk row" data-coachq="yes"><div><b>Yes, add my coach</b><span>Send them a request. Your coach builds your plan once they accept.</span></div></button>
    <button class="pk row" data-coachq="no"><div><b>Not right now</b><span>Build your own plan, or let the app make one for you. You can add a coach later.</span></div></button></div>`;
  if (step === 'coachpick') h = `<h1 class="ob-h">Who’s your coach?</h1><p class="ob-p">Type their Spott username. We’ll send them a request; you can start using the app straight away.</p>
    <div class="grp"><label><span>Username</span><input id="obCoach" autocapitalize="none" autocorrect="off" autocomplete="off" spellcheck="false" maxlength="21" placeholder="coach_username" value="${esc(OB.coachU)}"></label></div>
    <div class="ob-foot"><button class="au-go" id="obCoachGo">Send request</button></div>`;
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
    <div class="au-lbl">How do you like to split your week?</div>
    <div class="pick one">${GEN_STYLES.map(([k, t, s]) => `<button class="pk row ${(OB.split || 'auto') === k ? 'on' : ''}" data-split="${k}"><div><b>${t}</b><span>${k === 'auto' ? splitHint(OB.wds.length) : s}</span></div></button>`).join('')}</div>
    <div class="ob-foot"><button class="au-go" data-obnext>Continue</button></div>`;
  if (step === 'setup') h = `<h1 class="ob-h">Where do you train?</h1><p class="ob-p">Your plan only uses equipment you have.</p>
    <div class="pick one">${EQUIP.map(([k, ic, t, s]) => `<button class="pk row ${OB.equip === k ? 'on' : ''}" data-equip="${k}"><i>${ic}</i><div><b>${t}</b><span>${s}</span></div></button>`).join('')}</div>
    <div class="au-lbl">Experience</div>
    <div class="pick one">${LEVELS.map(([k, t, s]) => `<button class="pk ${OB.level === k ? 'on' : ''}" data-level="${k}"><b>${t}</b><span>${s}</span></button>`).join('')}</div>
    <div class="au-lbl">Weights in</div>
    <div class="seg" style="margin:0">${[['lb', 'Pounds (lb)'], ['kg', 'Kilograms (kg)']].map(([k, t]) => `<button class="${OB.unit === k ? 'on' : ''}" data-unit="${k}">${t}</button>`).join('')}</div>
    <div class="ob-foot"><button class="au-go" data-obnext>Continue</button></div>`;
  if (step === 'avoid') h = `<h1 class="ob-h">Anything to go easy on?</h1><p class="ob-p">Pick any area that’s injured or sore. Your plan leaves out exercises that load it.</p>
    <div class="pick">${AVOID.map(([k, t]) => `<button class="pk ${OB.avoid.includes(k) ? 'on' : ''}" data-avoid="${k}" aria-pressed="${OB.avoid.includes(k)}"><b>${t}</b></button>`).join('')}<button class="pk ${OB.avoid.length ? '' : 'on'}" data-avoid="none" aria-pressed="${!OB.avoid.length}"><b>None</b></button></div>
    <div class="ob-foot"><button class="au-go" data-obnext>Build my plan</button></div>`;
  if (step === 'plan') {
    OB.routine = generatePlan(obAnswers());
    h = `<h1 class="ob-h">Your plan is ready</h1><p class="ob-p">${OB.routine.length} day${OB.routine.length === 1 ? '' : 's'} a week, built for “${esc((GOALS.find(g => g[0] === OB.goal) || [])[2] || '')}”. Every exercise can be swapped once you’re in.</p>
      ${OB.routine.map(d => `<div class="pv"><div class="pv-h"><b>${esc(d.title)}</b><span>${esc(d.d)} · ${d.slots.length} exercises</span></div>${d.slots.map(sl => `<div class="pv-x"><b>${esc(sl.opts[0].n)}</b><span>${sl.sets} × ${esc(sl.reps)}</span></div>`).join('')}</div>`).join('')}
      <div class="ob-foot"><button class="au-go" id="obDone">Start training</button></div>`;
  }
  el.className = 'ob-step ' + (dir == null ? 'fwd' : dir); /* '' = redraw in place, no slide */ el.innerHTML = h; $('onb').scrollTop = 0;
}
function obGo(d) {
  if (OB_STEPS[OB.i] === 'profile') { const n = $('obName').value.trim(); if (d > 0 && !n) { $('obName').focus(); return toast('Add your name first'); } OB.name = n; }
  const step = OB_STEPS[OB.i], at = k => OB_STEPS.indexOf(k);
  if (step === 'schedule' && d > 0 && (OB.wds.length < GEN_DAYS[0] || OB.wds.length > GEN_DAYS[1])) return toast(`A generated plan is for ${GEN_DAYS[0]} to ${GEN_DAYS[1]} days a week. For ${OB.wds.length}, go back and start from scratch.`, 4500);
  if (step === 'start' && d > 0 && OB.mode === 'blank') OB.i = at('blank'); else if (step === 'blank' && d < 0) OB.i = at('start');
  else if (step === 'coachpick' && d < 0) OB.i = at('coach');
  else OB.i = Math.max(0, Math.min(at('plan'), OB.i + d));
  if (OB_STEPS[OB.i] === 'coach' && ME.role === 'trainer') OB.i = Math.max(0, OB.i + (d > 0 ? 1 : -1)); // coaches aren't asked whether they have a coach
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
    if (OB.coachU) { const u = OB.coachU; OB.coachU = ''; setTimeout(() => { if (typeof trAddSheet !== 'function' || appOff()) return; trAddSheet(); const el = $('trUser'); if (el) { el.value = u; trAdd(); } }, 900); } // send the coach request from the normal add-coach sheet
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
  if (d.coachq) { OB.i = OB_STEPS.indexOf(d.coachq === 'yes' ? 'coachpick' : 'start'); return renderOb('fwd'); }
  if (t.id === 'obCoachGo') { const u = ($('obCoach').value || '').trim().toLowerCase().replace(/^@/, ''); if (!USER_RE.test(u)) return toast('Usernames are 3 to 20 letters, numbers, dots or underscores.', 3500);
    OB.coachU = u; return finishOnboarding(OB.wds.map((wd, i) => ({ d: WD_NAMES[wd], wd, title: 'Day ' + (i + 1), slots: [] })), true); }
  if (d.avoid) { OB.avoid = d.avoid === 'none' ? [] : OB.avoid.includes(d.avoid) ? OB.avoid.filter(x => x !== d.avoid) : [...OB.avoid, d.avoid]; return renderOb(''); }
  if (d.obnext !== undefined) return obGo(1);
  if (d.color) { OB.color = d.color; OB.name = $('obName').value; applyTheme(d.color); return renderOb(''); }
  if (d.goal) { OB.goal = d.goal; return renderOb(''); }
  if (d.focus) { OB.focus = OB.focus.includes(d.focus) ? OB.focus.filter(x => x !== d.focus) : [...OB.focus, d.focus].slice(-2); return renderOb(''); }
  if (d.wd) { const n = +d.wd, on = OB.wds.includes(n); if (on && OB.wds.length <= WD_MIN) return toast('Pick at least one day'); OB.wds = on ? OB.wds.filter(x => x !== n) : [...OB.wds, n].sort((a, b) => a - b); return renderOb(''); }
  if (d.mins) { OB.mins = +d.mins; return renderOb(''); }
  if (d.split) { OB.split = d.split; return renderOb(''); }
  if (d.equip) { OB.equip = d.equip; return renderOb(''); }
  if (d.level) { OB.level = d.level; return renderOb(''); }
  if (d.unit) { OB.unit = d.unit; return renderOb(''); }
});
document.addEventListener('click', e => { if (e.target.closest('[data-buildplan]') && session) { if (typeof closeSheet === 'function') closeSheet(); startOnboarding(OB_GOAL); OB.name = ME.display_name || ME.username; OB.unit = S.settings.unit || 'lb';
  const p = S.settings.plan; if (p) { Object.assign(OB, { goal: p.goal || '', focus: p.focus || [], avoid: p.avoid || [], wds: p.wds || OB.wds, mins: p.mins || 60, split: p.split || 'auto', equip: p.equip || 'gym', level: p.level || 'some' }); renderOb(''); } } }); // changing answers starts from the old ones

"""Smoke test for the PUBLIC app (public/): sign-up, first-time setup, sign-out / sign-in, coach account.
Run from the repo root (same setup as smoke.py):
  python3 -m http.server 8765 &
  python3 dev/tests/smoke-public.py
mock-public.js replaces window.supabase and sets the config, so nothing touches a real database."""
import os
from playwright.sync_api import sync_playwright
here = os.path.dirname(os.path.abspath(__file__)); mock = open(os.path.join(here, 'mock-public.js')).read()
URL = 'http://localhost:8765/public/'
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, service_workers='block', color_scheme='dark')
    ctx.add_init_script(mock); ctx.route('**/@supabase/**', lambda r: r.abort())
    errs = []; A = ctx.new_page(); A.on('pageerror', lambda e: errs.append(str(e)))
    shot = lambda n: A.screenshot(path=os.path.join(here, f'last-run-public-{n}.png'))
    db = lambda: A.evaluate("JSON.parse(localStorage.getItem('mockp.db'))")
    A.goto(URL); A.evaluate("localStorage.clear()"); A.reload(); A.wait_for_timeout(500)
    assert A.is_visible('#auth.show'), 'sign-in screen should show when signed out'
    assert not A.is_visible('.wrap'), 'app must be hidden while signed out'
    shot('1-signin')

    # wrong login
    A.fill('#auEmail', 'nobody@example.com'); A.fill('#auPass', 'whatever1'); A.click('#auGo'); A.wait_for_timeout(300)
    assert 'Wrong email or password' in A.inner_text('#auErr')

    # create account: validation, then success
    A.click('[data-aumode="up"]'); A.wait_for_timeout(200)
    A.fill('#auUser', 'ab'); A.wait_for_timeout(100); assert 'Too short' in A.inner_text('#auUserSt')
    A.fill('#auUser', 'Test_User'); A.wait_for_timeout(600)
    assert A.input_value('#auUser') == 'test_user', 'username is lowercased as typed'
    assert 'Free' in A.inner_text('#auUserSt')
    A.fill('#auEmail', 'test@example.com'); A.fill('#auPass', 'short'); A.click('#auGo'); A.wait_for_timeout(200)
    assert '8 or more' in A.inner_text('#auErr')
    shot('2-signup')
    A.fill('#auPass', 'longenough1'); A.click('#auGo'); A.wait_for_timeout(500)
    assert A.is_visible('#onb.show'), 'first-time setup should follow sign-up'

    # setup: name is required, colour applies live
    A.click('[data-obnext]'); A.wait_for_timeout(200); assert A.is_visible('#obName'), 'name is required'
    A.fill('#obName', 'Test Person'); A.click('[data-color="#0a84ff"]'); A.wait_for_timeout(150)
    assert A.input_value('#obName') == 'Test Person', 'picking a colour keeps the typed name'
    assert A.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--acc').trim()") == '#0a84ff'
    shot('3-setup-profile')
    A.click('[data-obnext]'); A.wait_for_timeout(300)
    assert A.is_disabled('[data-obnext]'), 'goal is required'
    A.click('[data-goal="lean"]'); A.click('[data-obnext]'); A.wait_for_timeout(300)
    # focus: up to two areas
    for f in ['glutes', 'arms', 'core']: A.click(f'[data-focus="{f}"]')
    assert A.evaluate("OB.focus.join()") == 'arms,core', 'only the last two focus picks are kept'
    A.click('[data-focus="core"]'); A.click('[data-focus="glutes"]'); shot('4a-setup-focus'); A.click('[data-obnext]'); A.wait_for_timeout(300)
    # schedule: default Mon Tue Thu Fri; drop to Mon Thu Fri (can't go below 3), then swap Thu for Sunday; all 7 can't be picked
    assert A.locator('[data-wd]').count() == 7, 'weekends are offered'
    A.click('[data-wd="2"]'); A.click('[data-wd="1"]'); A.wait_for_timeout(100)
    assert A.evaluate("OB.wds.join()") == '1,4,5', 'at least three days stay selected'
    for d in [2, 3, 6, 7]: A.click(f'[data-wd="{d}"]')
    assert A.evaluate("OB.wds.join()") == '1,2,3,4,5,6', 'six days at most'
    for d in [2, 3, 6, 7, 4]: A.click(f'[data-wd="{d}"]')
    assert A.evaluate("OB.wds.join()") == '1,5,7'
    A.click('[data-mins="45"]'); shot('4b-setup-schedule'); A.click('[data-obnext]'); A.wait_for_timeout(300)
    A.click('[data-equip="home"]'); A.click('[data-level="some"]'); A.click('[data-unit="kg"]'); shot('4c-setup-equipment')
    A.click('[data-obnext]'); A.wait_for_timeout(300)
    assert A.locator('.pv').count() == 3, '3-day plan'
    assert A.evaluate("OB.routine.map(d => d.d).join()") == 'Mon,Fri,Sun', 'plan lands on the chosen weekdays'
    plan = A.evaluate("OB.routine.map(d => d.slots.map(s => s.opts[0].n))")
    lifts = [n for d in plan for n in d[:-1]]; assert len(lifts) == len(set(lifts)), 'no exercise repeats across the week'
    assert all(len(d) == 6 for d in plan), '45 min: 5 exercises + cardio finisher per day'
    assert A.evaluate("OB.routine.every(d => d.slots.every(s => s.opts.length >= 2 && s.opts.every(o => P[o.pat] && fitsEquip(o.n, 'home'))))"), 'every option has a figure and fits home equipment'
    assert A.evaluate("OB.routine.every(d => d.slots.some(s => LIB.glutes.concat(LIB.arms).some(o => o.n === s.opts[0].n)))"), 'focus areas show up every day'
    # the builder holds up for every combination of answers
    bad = A.evaluate("""(() => { const out = [];
      for (const goal of ['muscle','strength','lean','general']) for (const equip of ['gym','home','body']) for (const mins of [30,45,60]) for (const level of ['new','seasoned']) for (const wds of [[1,3,5],[2,4,6,7],[1,2,3,4,5],[1,2,3,5,6,7]]) for (const focus of [[],['glutes','arms'],['back','shoulders']]) {
        const r = buildRoutine({ goal, equip, mins, level, wds, focus }), names = r.flatMap(d => d.slots.filter(s => !s.time || s.sets > 1).map(s => s.opts[0].n));
        const want = Math.min({30:4,45:5,60:6}[mins], level === 'new' ? 5 : 6) + (goal === 'lean' ? 1 : 0);
        if (r.length !== wds.length || r.map(d => d.wd).join() !== wds.join() || r.some(d => d.slots.length !== want) || r.some(d => d.slots.some(s => !s.opts.length || s.opts.some(o => !o || !P[o.pat] || !fitsEquip(o.n, equip)))) || (equip !== 'body' && new Set(names).size !== names.length)) out.push([goal, equip, mins, level, wds.length, focus.join('+')].join(' '));
      } return out; })()""")
    assert not bad, bad[:8]
    shot('5-setup-plan')
    A.click('#obDone'); A.wait_for_timeout(500)
    assert A.is_visible('.wrap') and not A.is_visible('#onb.show'), 'app shows after setup'
    assert A.locator('#home .card').count() == 3
    d = db(); me = d['t']['app_profiles'][0]
    assert me['display_name'] == 'Test Person' and me['color'] == '#0a84ff' and me['role'] == 'user'
    assert len(d['t']['app_routines'][0]['routine']) == 3 and d['t']['app_state'][0]['data']['settings']['unit'] == 'kg' and d['t']['app_state'][0]['data']['settings']['plan']['equip'] == 'home'
    shot('6-home')

    # session survives a reload; sign out; username now taken; sign back in
    A.reload(); A.wait_for_timeout(600); assert A.is_visible('.wrap') and A.locator('#home .card').count() == 3
    A.click('#signOut'); A.wait_for_timeout(300); assert A.is_visible('#auth.show') and not A.is_visible('.wrap')
    A.click('[data-aumode="up"]'); A.fill('#auUser', 'test_user'); A.wait_for_timeout(600); assert 'Taken' in A.inner_text('#auUserSt')
    A.click('[data-aumode="in"]'); A.fill('#auEmail', 'test@example.com'); A.fill('#auPass', 'longenough1'); A.click('#auGo'); A.wait_for_timeout(500)
    assert A.is_visible('.wrap') and not A.is_visible('#onb.show'), 'returning user skips setup'

    # coach account: can skip the plan
    A.click('#signOut'); A.wait_for_timeout(300); A.click('[data-aumode="up"]')
    A.fill('#auUser', 'coach.kay'); A.fill('#auEmail', 'coach@example.com'); A.fill('#auPass', 'longenough1'); A.click('[data-role="trainer"]'); A.click('#auGo'); A.wait_for_timeout(500)
    A.fill('#obName', 'Coach Kay'); A.click('[data-obnext]'); A.wait_for_timeout(300)
    assert A.is_visible('#obSkip'), 'coaches can skip their own plan'; A.click('#obSkip'); A.wait_for_timeout(500)
    assert A.is_visible('.wrap') and 'Coach' in A.inner_text('#home')
    assert db()['t']['app_profiles'][1]['role'] == 'trainer'

    # forgot password
    A.click('#signOut'); A.wait_for_timeout(300); A.click('[data-aumode="forgot"]'); A.fill('#auEmail', 'test@example.com'); A.click('#auGo'); A.wait_for_timeout(300)
    assert 'reset link' in A.inner_text('#auErr')
    assert not errs, errs
    print('OK public'); b.close()

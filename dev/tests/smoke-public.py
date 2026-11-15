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
    A.click('[data-days="3"]'); A.click('[data-level="new"]'); A.click('[data-unit="kg"]'); shot('4-setup-schedule')
    A.click('[data-obnext]'); A.wait_for_timeout(300)
    assert A.locator('.pv').count() == 3, '3-day plan'
    plan = A.evaluate("OB.routine.map(d => d.slots.map(s => s.opts[0].n))")
    flat = [n for d in plan for n in d]; assert len(flat) - flat.count('Incline Treadmill Walk') == len(set(flat)) - 1, 'no exercise repeats across the week (cardio finisher aside)'
    assert all(len(d) == 6 for d in plan), 'new lifter: 5 exercises + cardio finisher per day'
    assert A.evaluate("OB.routine.every(d => d.slots.every(s => s.opts.length >= 2 && s.opts.every(o => P[o.pat])))"), 'every slot has swap options with a figure'
    shot('5-setup-plan')
    A.click('#obDone'); A.wait_for_timeout(500)
    assert A.is_visible('.wrap') and not A.is_visible('#onb.show'), 'app shows after setup'
    assert A.locator('#home .card').count() == 3
    d = db(); me = d['t']['app_profiles'][0]
    assert me['display_name'] == 'Test Person' and me['color'] == '#0a84ff' and me['role'] == 'user'
    assert len(d['t']['app_routines'][0]['routine']) == 3 and d['t']['app_state'][0]['data']['settings']['unit'] == 'kg'
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

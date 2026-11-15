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
    # schedule: default Mon Tue Thu Fri; any number of days from one to all seven
    assert A.locator('[data-wd]').count() == 7, 'weekends are offered'
    for d in [2, 4, 5, 1]: A.click(f'[data-wd="{d}"]')
    assert A.evaluate("OB.wds.join()") == '1', 'one day is allowed, zero is not'
    for d in [2, 3, 4, 5, 6, 7]: A.click(f'[data-wd="{d}"]')
    assert A.evaluate("OB.wds.join()") == '1,2,3,4,5,6,7', 'all seven days are allowed'
    for d in [2, 3, 4, 6]: A.click(f'[data-wd="{d}"]')
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
      for (const goal of ['muscle','strength','lean','general']) for (const equip of ['gym','home','body']) for (const mins of [30,45,60]) for (const level of ['new','seasoned']) for (const wds of [[3],[2,6],[1,3,5],[2,4,6,7],[1,2,3,4,5],[1,2,3,5,6,7],[1,2,3,4,5,6,7]]) for (const focus of [[],['glutes','arms'],['back','shoulders']]) {
        const r = buildRoutine({ goal, equip, mins, level, wds, focus }), names = r.flatMap(d => d.slots.filter(s => !s.time || s.sets > 1).map(s => s.opts[0].n));
        const want = Math.min({30:4,45:5,60:6}[mins], level === 'new' ? 5 : 6) + (goal === 'lean' ? 1 : 0);
        if (r.length !== wds.length || r.map(d => d.wd).join() !== wds.join() || r.some(d => d.slots.length !== want) || r.some(d => d.slots.some(s => !s.opts.length || s.opts.some(o => !o || !P[o.pat] || !fitsEquip(o.n, equip)))) || (equip === 'gym' && new Set(names).size !== names.length)) out.push([goal, equip, mins, level, wds.length, focus.join('+')].join(' '));
      } return out; })()""")
    assert not bad, bad[:8]
    shot('5-setup-plan')
    A.click('#obDone'); A.wait_for_timeout(500)
    assert A.is_visible('.wrap') and not A.is_visible('#onb.show'), 'app shows after setup'
    assert A.locator('#days button').count() == 3 and A.inner_text('#days').replace('\n', ' ').count('Mon') == 1, 'day strip shows the 3 training days'
    assert A.evaluate("DAYS.map(d => d.wd).join()") == '1,5,7'
    assert A.locator('#list .card').count() == 6, 'selected day lists its 6 exercises'
    assert 'Test' in A.inner_text('#htitle')
    d = db(); me = d['t']['app_profiles'][0]
    assert me['display_name'] == 'Test Person' and me['color'] == '#0a84ff' and me['role'] == 'user'
    assert len(d['t']['app_routines'][0]['routine']) == 3 and d['t']['app_state'][0]['data']['settings']['unit'] == 'kg' and d['t']['app_state'][0]['data']['settings']['plan']['equip'] == 'home'
    shot('6-home')

    # session survives a reload; sign out; username now taken; sign back in
    # log a set, check it lands in the state blob and the cloud copy, visit every tab
    A.fill('[data-w="0:0"]', '20'); A.fill('[data-r="0:0"]', '10'); A.click('[data-chk="0:0"]'); A.wait_for_timeout(2500)
    assert A.locator('.set.ok').count() == 1, 'set is ticked'
    assert A.is_visible('#rest.show'), 'rest timer starts'
    sets = A.evaluate("Object.values(Object.values(Object.values(S.logs)[0])[0])[0].sets"); assert sets[0]['w'] == 20 and sets[0]['r'] == 10
    cloud = db()['t']['app_state'][0]['data']['logs']; assert cloud, 'state synced to app_state'
    assert db()['t'].get('app_public'), 'summary published to app_public'
    A.click('#rskip')
    for t in ['history', 'body', 'fuel', 'more', 'workout']:
        A.click(f'nav button[data-tab="{t}"]'); A.wait_for_timeout(400); assert A.is_visible(f'#t-{t}.on'), t
        if t == 'history':
            for seg in ['muscles', 'prs', 'weeks']: A.click(f'[data-hseg="{seg}"]'); A.wait_for_timeout(250)
            assert A.locator('[data-hseg]').count() == 3, 'no scoreboard yet'
        if t == 'more': assert '@test_user' in A.inner_text('#more'); shot('7-more')
    shot('6-workout')
    A.reload(); A.wait_for_timeout(800); assert A.is_visible('.wrap') and A.locator('#list .card').count() == 6 and A.locator('.set.ok').count() == 1, 'session and log survive a reload'
    A.click('nav button[data-tab="more"]'); A.wait_for_timeout(300)
    A.click('#signOut'); A.wait_for_timeout(300); assert A.is_visible('#auth.show') and not A.is_visible('.wrap') and not A.is_visible('nav')
    A.click('[data-aumode="up"]'); A.fill('#auUser', 'test_user'); A.wait_for_timeout(600); assert 'Taken' in A.inner_text('#auUserSt')
    A.click('[data-aumode="in"]'); A.fill('#auEmail', 'test@example.com'); A.fill('#auPass', 'longenough1'); A.click('#auGo'); A.wait_for_timeout(500)
    assert A.is_visible('.wrap') and not A.is_visible('#onb.show'), 'returning user skips setup'
    assert A.locator('.set.ok').count() == 1, 'log is back after signing in again'

    # routine editor: edits go to app_routines, and the plan can be rebuilt from the setup answers
    rt = lambda: db()['t']['app_routines'][0]['routine']
    di = A.evaluate('cur'); before = [sl['opts'][0]['n'] for sl in rt()[di]['slots']]
    A.click('nav button[data-tab="more"]'); A.wait_for_timeout(300); A.click('[data-edopen]'); A.wait_for_timeout(400)
    assert A.locator('.edrow').count() == len(before), 'editor lists the day'
    A.click('[data-edmv="0:1"]'); A.wait_for_timeout(400)
    assert [sl['opts'][0]['n'] for sl in rt()[di]['slots']][:2] == [before[1], before[0]], 'reorder is saved to app_routines'
    A.click(f'[data-eddel="{len(before) - 1}"]'); A.wait_for_timeout(400)
    assert len(rt()[di]['slots']) == len(before) - 1 and A.locator('.edrow').count() == len(before) - 1, 'remove is saved to app_routines'
    assert 'routine' not in db()['t']['app_state'][0]['data'], 'the routine stays out of the state blob'
    A.click('[data-edreset]'); A.wait_for_timeout(500)
    assert [sl['opts'][0]['n'] for sl in rt()[di]['slots']] == before, 'rebuild restores the plan from the setup answers'
    A.click('nav button[data-tab="workout"]'); A.wait_for_timeout(300); assert A.locator('#list .card').count() == 6
    assert A.evaluate("localStorage.getItem('gymp.routineDirty.' + session.user.id)") is None, 'no unsynced routine edits left'

    # coach account: can skip the plan
    A.click('nav button[data-tab="more"]'); A.wait_for_timeout(300); A.click('#signOut'); A.wait_for_timeout(300); A.click('[data-aumode="up"]')
    A.fill('#auUser', 'coach.kay'); A.fill('#auEmail', 'coach@example.com'); A.fill('#auPass', 'longenough1'); A.click('[data-role="trainer"]'); A.click('#auGo'); A.wait_for_timeout(500)
    A.fill('#obName', 'Coach Kay'); A.click('[data-obnext]'); A.wait_for_timeout(300)
    assert A.is_visible('#obSkip'), 'coaches can skip their own plan'; A.click('#obSkip'); A.wait_for_timeout(500)
    assert A.is_visible('.wrap') and A.is_visible('[data-buildplan]'), 'coach without a plan sees the empty state'
    assert db()['t']['app_profiles'][1]['role'] == 'trainer'
    for t in ['history', 'body', 'fuel', 'more', 'workout']: A.click(f'nav button[data-tab="{t}"]'); A.wait_for_timeout(300)
    # ...and can build one later
    A.click('[data-buildplan]'); A.wait_for_timeout(300); assert A.is_visible('#onb.show') and A.is_visible('#onb [data-goal]')
    A.click('#onb [data-goal="strength"]'); A.click('#onb [data-obnext]'); A.wait_for_timeout(200); A.click('#onb [data-obnext]'); A.wait_for_timeout(200)
    A.click('#onb [data-wd="6"]'); A.click('#onb [data-obnext]'); A.wait_for_timeout(200); A.click('#onb [data-obnext]'); A.wait_for_timeout(300); A.click('#obDone'); A.wait_for_timeout(600)
    assert A.locator('#days button').count() == 5 and A.locator('#list .card').count() == 6, 'coach now has a 5-day plan incl. Saturday'

    # friends (milestone 3): add by username, accept / decline / cancel / remove. Signed in as coach.kay here.
    fr = lambda: db()['t'].get('app_friends', [])
    def signin(email):
        A.click('nav button[data-tab="more"]'); A.wait_for_timeout(300); A.click('#signOut'); A.wait_for_timeout(300)
        A.fill('#auEmail', email); A.fill('#auPass', 'longenough1'); A.click('#auGo'); A.wait_for_timeout(700)
        assert A.is_visible('.wrap'), 'signed in as ' + email
    def add(u):
        A.click('[data-frnew]'); A.wait_for_timeout(450); A.fill('#frUser', u); A.click('[data-fradd]'); A.wait_for_timeout(450)
    tabF = lambda: (A.click('nav button[data-tab="friends"]'), A.wait_for_timeout(400))
    tabF(); assert 'No friends yet' in A.inner_text('#friends') and '@coach.kay' in A.inner_text('#friends') and not A.is_visible('#frBadge')
    add('zz'); assert '3 to 20' in A.inner_text('#frMsg')
    A.fill('#frUser', 'nobody_here'); A.click('[data-fradd]'); A.wait_for_timeout(400); assert 'No one here' in A.inner_text('#frMsg')
    A.fill('#frUser', 'coach.kay'); A.click('[data-fradd]'); A.wait_for_timeout(400); assert 'your own' in A.inner_text('#frMsg')
    A.fill('#frUser', '@Test_User'); A.press('#frUser', 'Enter'); A.wait_for_timeout(500)
    assert not A.is_visible('#sheet.show') and len(fr()) == 1 and fr()[0]['status'] == 'pending', 'request row is created'
    assert 'Test Person' in A.inner_text('#frSent') and A.locator('#frList .frow').count() == 0
    add('test_user'); assert 'already asked' in A.inner_text('#frMsg') and len(fr()) == 1, 'no duplicate request'
    A.click('#sx'); A.wait_for_timeout(600); A.click('[data-frcancel]'); A.wait_for_timeout(500); assert fr() == [] and not A.is_visible('#frSent'), 'cancel deletes the request'
    add('test_user'); assert len(fr()) == 1; shot('8-friends-sent')
    # the other person sees it, with a badge, and declines
    signin('test@example.com'); assert A.is_visible('#frBadge') and A.inner_text('#frBadge') == '1', 'badge on the Friends tab'
    tabF(); assert 'Coach Kay' in A.inner_text('#frReqs') and 'Coach' in A.inner_text('#frReqs .edn span'); shot('9-friends-request')
    A.click('[data-frno]'); A.wait_for_timeout(500); assert fr() == [] and not A.is_visible('#frReqs') and not A.is_visible('#frBadge'), 'decline deletes the request'
    # ask the other way; adding someone who already asked you accepts their request
    add('coach.kay'); assert len(fr()) == 1
    signin('coach@example.com'); tabF(); assert A.is_visible('[data-frok]')
    add('test_user'); assert len(fr()) == 1 and fr()[0]['status'] == 'accepted', 'adding back accepts'
    assert A.locator('#frList .frow').count() == 1 and 'Test Person' in A.inner_text('#frList') and not A.is_visible('#frReqs') and not A.is_visible('#frBadge')
    assert A.evaluate('friendList().map(p => p.username).join()') == 'test_user' and A.evaluate('isFriend(friendIds()[0])')
    shot('10-friends-list')
    # both sides see the friendship; it survives a reload; either can remove it
    signin('test@example.com'); tabF(); assert 'Coach Kay' in A.inner_text('#frList') and '1 friend' in A.inner_text('#friends')
    A.reload(); A.wait_for_timeout(800); tabF(); assert A.locator('#frList .frow').count() == 1
    A.click('#frList .frow'); A.wait_for_timeout(450); assert 'Friends since' in A.inner_text('#sheetin')
    A.click('[data-frrm]'); A.wait_for_timeout(450); A.click('[data-frrmyes]'); A.wait_for_timeout(600)
    assert fr() == [] and 'No friends yet' in A.inner_text('#friends'), 'remove deletes the friendship'
    # accept with the button
    add('coach.kay'); signin('coach@example.com'); tabF(); A.click('[data-frok]'); A.wait_for_timeout(500)
    assert fr()[0]['status'] == 'accepted' and A.locator('#frList .frow').count() == 1
    # signing out clears the list from the screen
    A.click('nav button[data-tab="more"]'); A.wait_for_timeout(300); A.click('#signOut'); A.wait_for_timeout(300)
    assert A.evaluate("FR.rows.length === 0 && document.getElementById('friends').innerHTML === ''")
    A.fill('#auEmail', 'coach@example.com'); A.fill('#auPass', 'longenough1'); A.click('#auGo'); A.wait_for_timeout(700)

    # forgot password
    A.click('nav button[data-tab="more"]'); A.wait_for_timeout(300); A.click('#signOut'); A.wait_for_timeout(300); A.click('[data-aumode="forgot"]'); A.fill('#auEmail', 'test@example.com'); A.click('#auGo'); A.wait_for_timeout(300)
    assert 'reset link' in A.inner_text('#auErr')
    assert not errs, errs
    print('OK public'); b.close()

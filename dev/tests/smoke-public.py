"""Smoke test for the PUBLIC app (public/): sign-up, first-time setup, sign-out / sign-in, coach account.
Run from the repo root (same setup as smoke.py):
  python3 -m http.server 8765 &
  python3 dev/tests/smoke-public.py
mock-public.js replaces window.supabase and sets the config, so nothing touches a real database.
No fixed sleeps: every step waits for what it expects (until / has), so a slow machine only makes it slower, never flaky."""
import os, time, re, base64
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout
here = os.path.dirname(os.path.abspath(__file__)); mock = open(os.path.join(here, 'mock-public.js')).read()
URL = 'http://localhost:8765/public/'
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, service_workers='block', color_scheme='dark')
    ctx.add_init_script(mock); ctx.route('**/@supabase/**', lambda r: r.abort())
    def serve(route):  # python's http.server resets connections when ~15 scripts arrive at once; fetch again instead of loading a half-broken page
        for _ in range(5):
            try: return route.fulfill(response=route.fetch())
            except Exception: time.sleep(0.2)
        route.abort()
    ctx.route(URL.split('/public')[0] + '/**', serve)
    errs = []; A = ctx.new_page(); A.on('pageerror', lambda e: errs.append(str(e))); A.set_default_timeout(10000)
    shot = lambda n: (A.wait_for_timeout(450), A.screenshot(path=os.path.join(here, f'last-run-public-{n}.png')))  # the pause lets tab and card animations finish
    db = lambda: A.evaluate("JSON.parse(localStorage.getItem('mockp.db'))")
    def until(c, msg='condition not met', timeout=8000, page=None):  # wait for a JS expression (str) or a python callable to turn true; AssertionError(msg) on timeout
        pg = page or A
        if isinstance(c, str):
            try: return pg.wait_for_function(c, timeout=timeout)
            except PWTimeout: raise AssertionError(msg)
        end = time.time() + timeout / 1000
        while True:
            try:
                if c(): return
            except Exception: pass  # not there yet (element missing, row not written)
            if time.time() > end: raise AssertionError(msg)
            pg.wait_for_timeout(50)
    has = lambda sel, s, msg=None: until(lambda: s in A.inner_text(sel), msg or f'{sel} should show {s!r}')
    cnt = lambda sel, n, msg=None: until(lambda: A.locator(sel).count() == n, msg or f'{sel} should have {n} match(es)')
    def go(t):  # Body, Fuel and Settings live in the header menu; the rest are on the tab bar
        if t in ('body', 'fuel', 'more'): A.click('#menuBtn'); A.click(f'#hmenu [data-tab="{t}"]')
        else: A.click(f'nav button[data-tab="{t}"]')
    def nx(sel='[data-obnext]'):  # Continue in the setup flow, and wait for the next step to be drawn
        i = A.evaluate('OB.i'); A.click(sel); until(f'OB.i > {i}', 'setup should move to the next step')
    def reload():  # wait until the page has settled on the sign-in screen, setup, or the app
        A.reload(); A.wait_for_function("document.querySelector('#auth.show,#onb.show') || !document.body.classList.contains('out')", timeout=15000)
    A.goto(URL); A.evaluate("localStorage.clear()"); reload()
    assert A.is_visible('#auth.show'), 'sign-in screen should show when signed out'
    assert not A.is_visible('.wrap'), 'app must be hidden while signed out'
    shot('1-signin')

    # wrong login
    A.fill('#auEmail', 'nobody@example.com'); A.fill('#auPass', 'whatever1'); A.click('#auGo'); has('#auErr', 'Wrong email or password')

    # create account: validation, then success
    A.click('[data-aumode="up"]')
    A.fill('#auUser', 'ab'); has('#auUserSt', 'Too short')
    A.fill('#auUser', 'Test_User'); has('#auUserSt', 'Free')  # the username check is debounced; wait for its answer
    assert A.input_value('#auUser') == 'test_user', 'username is lowercased as typed'
    A.fill('#auEmail', 'test@example.com'); A.fill('#auPass', 'short'); A.click('#auGo'); has('#auErr', '8 or more')
    shot('2-signup')
    A.fill('#auPass', 'longenough1'); A.click('#auGo'); until(lambda: A.is_visible('#onb.show'), 'first-time setup should follow sign-up')

    # setup: name is required, colour applies live
    A.click('[data-obnext]'); assert A.is_visible('#obName'), 'name is required'
    A.fill('#obName', 'Test Person'); A.click('[data-color="#0a84ff"]')
    until(lambda: A.input_value('#obName') == 'Test Person', 'picking a colour keeps the typed name')
    until("getComputedStyle(document.documentElement).getPropertyValue('--acc').trim() === '#0a84ff'", 'colour applies live')
    shot('3-setup-profile')
    nx(); until(lambda: A.is_visible('[data-mode="blank"]') and 'on' in A.get_attribute('[data-mode="auto"]', 'class'), 'setup asks how to start, a built plan is the default'); shot('3b-setup-start')
    nx(); until(lambda: A.is_disabled('[data-obnext]'), 'goal is required')
    A.click('[data-goal="lean"]'); nx()
    # focus: up to two areas
    for f in ['glutes', 'arms', 'core']: A.click(f'[data-focus="{f}"]')
    assert A.evaluate("OB.focus.join()") == 'arms,core', 'only the last two focus picks are kept'
    A.click('[data-focus="core"]'); A.click('[data-focus="glutes"]'); shot('4a-setup-focus'); nx()
    # schedule: default Mon Tue Thu Fri; any number of days from one to all seven
    assert A.locator('[data-wd]').count() == 7, 'weekends are offered'
    for d in [2, 4, 5, 1]: A.click(f'[data-wd="{d}"]')
    assert A.evaluate("OB.wds.join()") == '1', 'one day is allowed, zero is not'
    for d in [2, 3, 4, 5, 6, 7]: A.click(f'[data-wd="{d}"]')
    assert A.evaluate("OB.wds.join()") == '1,2,3,4,5,6,7', 'all seven days are allowed'
    for d in [2, 3, 4, 6]: A.click(f'[data-wd="{d}"]')
    assert A.evaluate("OB.wds.join()") == '1,5,7'
    A.click('[data-mins="45"]'); shot('4b-setup-schedule'); nx()
    A.click('[data-equip="home"]'); A.click('[data-level="some"]'); A.click('[data-unit="kg"]'); shot('4c-setup-equipment')
    nx()
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
    A.click('#obDone'); A.wait_for_selector('#onb.show', state='hidden'); A.wait_for_selector('.wrap', state='visible')
    until(lambda: A.is_visible('.wrap') and not A.is_visible('#onb.show'), 'app shows after setup')
    until(lambda: A.locator('#days button').count() == 3 and A.inner_text('#days').replace('\n', ' ').count('Mon') == 1, 'day strip shows the 3 training days')
    until("DAYS.map(d => d.wd).join() === '1,5,7'", 'training days are Mon, Fri, Sun')
    cnt('#list .card', 6, 'selected day lists its 6 exercises')
    has('#htitle', 'Workout')
    d = db(); me = d['t']['app_profiles'][0]  # setup saves everything before it shows the app
    assert me['display_name'] == 'Test Person' and me['color'] == '#0a84ff' and me['role'] == 'user'
    assert len(d['t']['app_routines'][0]['routine']) == 3 and d['t']['app_state'][0]['data']['settings']['unit'] == 'kg' and d['t']['app_state'][0]['data']['settings']['plan']['equip'] == 'home'
    shot('6-home')
    A.click('#menuBtn'); until(lambda: A.is_visible('#hmenu [data-tab="body"]') and A.is_visible('#hmenu [data-edopen]') and A.is_visible('#hmenu [data-sessopen]'), 'the header menu opens'); shot('6b-menu')
    A.click('#menuBtn'); until(lambda: not A.is_visible('#hmenu'), 'and closes')

    # session survives a reload; sign out; username now taken; sign back in
    # log a set, check it lands in the state blob and the cloud copy, visit every tab
    # profile picture: picked in Settings, shrunk and saved to the profile, and it can be removed
    png = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==')
    go('more'); A.click('#avPick'); has('#sheetin', 'Profile picture'); A.set_input_files('#avInput', {'name': 'me.png', 'mimeType': 'image/png', 'buffer': png})
    until(lambda: re.match(r'^[0-9a-f-]{36}/\d+\.jpg$', db()['t']['app_profiles'][0]['avatar'] or '') and A.evaluate("avUrl(ME).endsWith('/app-avatars/' + ME.avatar) && ME.avatar.startsWith(ME.id + '/')"), 'the picture is saved to the profile')
    assert A.evaluate("avUrl({ id: ME.id, avatar: 'x/../../evil.jpg' }) === '' && avUrl({ id: 'someone-else', avatar: ME.avatar }) === ''"), 'a path outside the person’s own folder is never used'
    A.click('#avPick'); A.click('[data-avrm]'); until(lambda: db()['t']['app_profiles'][0]['avatar'] == '' and A.evaluate("ME.avatar === ''"), 'and it can be removed')
    # Coach Bigz: off by default, switched on in Settings; his clips download and the right ones are queued
    go('more'); has('#more', 'Coach Bigz'); assert A.inner_text('#bzT') == 'Off' and A.text_content('#pvoice') == 'Coach Bigz off', 'Coach Bigz starts off'
    A.click('#bzT'); until("pvOn() && document.querySelector('#bzT').textContent === 'On' && document.querySelector('#pvoice').textContent === 'Coach Bigz on'", 'the Settings switch turns Coach Bigz on')
    until("Object.keys(BZ.bytes).length === 117", 'all 117 clips download', timeout=20000)
    A.evaluate("window.__bz = []; const _p = BZ.q.push.bind(BZ.q); BZ.q.push = n => { __bz.push(n); return _p(n); }; 0"); go('workout')
    d = A.evaluate("bzDecode(22).then(b => b.duration, () => 0)"); print('  clip 22 decodes to', round(d, 2), 's' if d else '(this browser build cannot decode the clips; queueing is still checked)')
    until("!BZ.cur && !BZ.q.length", 'his hello finishes', timeout=6000)
    A.fill('[data-w="0:0"]', '20'); A.fill('[data-r="0:0"]', '10'); A.click('[data-chk="0:0"]')
    until(lambda: A.evaluate('__bz')[:1] == [68] and any(n in A.evaluate('__bz') for n in (47, 12, 52, 53)), 'Coach Bigz calls the first set and the rest')
    A.evaluate("__bz.length = 0; openPacer(0)"); until(lambda: A.evaluate('__bz')[:1][0] in (11, 2) and all(n in A.evaluate('__bz') for n in (19, 20, 21)), 'Coach Bigz opens the next set, counts in and says go', timeout=9000)
    until(lambda: 22 in A.evaluate('__bz'), 'Coach Bigz counts the first rep', timeout=12000); A.click('#pcancel')
    A.click('#menuBtn'); assert A.inner_text('#hmBzS') == 'On', 'the menu shows Coach Bigz is on'; A.click('#hmBz'); until("!pvOn() && document.querySelector('#hmBzS').textContent === 'Off' && document.querySelector('#hmenu').hidden", 'the menu switch turns Coach Bigz off')
    A.evaluate("bzToggle()"); assert A.evaluate("pvOn()"), 'and back on'
    A.evaluate("bzToggle()"); assert A.text_content('#pvoice') == 'Coach Bigz off' and not A.evaluate("!!(BZ.cur || BZ.q.length)"), 'switching Coach Bigz off stops him'
    assert A.evaluate("__bz.length = 0, bzPlay(47, 'q'), pvSay('1', true), __bz.length") == 0, 'nothing is queued while Coach Bigz is off'
    cnt('.set.ok', 1, 'set is ticked')
    until(lambda: A.is_visible('#rest.show'), 'rest timer starts')
    sets = A.evaluate("Object.values(Object.values(Object.values(S.logs)[0])[0])[0].sets"); assert sets[0]['w'] == 20 and sets[0]['r'] == 10
    until(lambda: db()['t']['app_state'][0]['data']['logs'], 'state synced to app_state')  # the 1.5 s sync debounce: wait for its result in the mock database
    until(lambda: db()['t'].get('app_public'), 'summary published to app_public')
    A.click('#rskip')
    for t in ['history', 'body', 'fuel', 'more', 'workout']:
        go(t); until(lambda: A.is_visible(f'#t-{t}.on'), t)
        if t == 'history':
            for seg in ['muscles', 'prs', 'weeks']: A.click(f'[data-hseg="{seg}"]')
            assert A.locator('[data-hseg]').count() == 3, 'no scoreboard yet'
        if t == 'more': has('#more', '@test_user'); shot('7-more')
    shot('6-workout')
    reload(); until(lambda: A.is_visible('.wrap') and A.locator('#list .card').count() == 6 and A.locator('.set.ok').count() == 1, 'session and log survive a reload')
    go('more')
    A.click('#signOut'); until(lambda: A.is_visible('#auth.show') and not A.is_visible('.wrap') and not A.is_visible('nav'), 'signing out shows the sign-in screen')
    A.click('[data-aumode="up"]'); A.fill('#auUser', 'test_user'); has('#auUserSt', 'Taken')
    A.click('[data-aumode="in"]'); A.fill('#auEmail', 'test@example.com'); A.fill('#auPass', 'longenough1'); A.click('#auGo')
    until(lambda: A.is_visible('.wrap') and not A.is_visible('#onb.show'), 'returning user skips setup')
    cnt('.set.ok', 1, 'log is back after signing in again')

    # sign in with a username instead of an email (the "login" server function; emails never reach the browser)
    def login(u, pw): A.fill('#auEmail', u); A.fill('#auPass', pw); A.click('#auGo')
    go('more'); A.click('#signOut'); until(lambda: A.is_visible('#auth.show'), 'signed out')
    login('a b', 'longenough1'); has('#auErr', 'email or username')
    login('test_user', 'wrongpass1'); has('#auErr', 'Wrong email or password')
    until(lambda: A.is_visible('#auth.show') and not A.is_visible('.wrap') and A.is_enabled('#auGo') and A.evaluate('session') is None, 'a wrong password does not sign anyone in')
    login('nobody_here', 'longenough1'); has('#auErr', 'Wrong email or password', 'an unknown username gets the same answer as a wrong password'); until(lambda: A.is_enabled('#auGo'))
    A.evaluate('window.__mockNoLogin = true')
    login('test_user', 'longenough1'); has('#auErr', 'Use your email instead', 'friendly message while the login function is not deployed'); until(lambda: A.is_enabled('#auGo'))
    A.evaluate('window.__mockNoLogin = false')
    login('Test_User', 'longenough1')  # typed with capitals: usernames are matched in lower case
    until(lambda: A.is_visible('.wrap') and not A.is_visible('#onb.show') and A.evaluate("session && session.user.email") == 'test@example.com' and A.evaluate('ME.username') == 'test_user', 'username + password signs in')
    cnt('.set.ok', 1, 'log is back after signing in by username')
    reload(); until(lambda: A.is_visible('.wrap') and A.evaluate('ME && ME.username') == 'test_user', 'a username sign-in survives a reload')

    # routine editor: edits go to app_routines, and the plan can be rebuilt from the setup answers
    rt = lambda: db()['t']['app_routines'][0]['routine']
    di = A.evaluate('cur'); before = [sl['opts'][0]['n'] for sl in rt()[di]['slots']]
    go('more'); A.click('[data-edopen]')
    cnt('.edrow', len(before), 'editor lists the day')
    A.click('[data-edmv="0:1"]')
    until(lambda: [sl['opts'][0]['n'] for sl in rt()[di]['slots']][:2] == [before[1], before[0]], 'reorder is saved to app_routines')
    A.click(f'[data-eddel="{len(before) - 1}"]')
    until(lambda: len(rt()[di]['slots']) == len(before) - 1 and A.locator('.edrow').count() == len(before) - 1, 'remove is saved to app_routines')
    assert 'routine' not in db()['t']['app_state'][0]['data'], 'the routine stays out of the state blob'
    A.click('[data-edreset]'); until(lambda: [sl['opts'][0]['n'] for sl in rt()[di]['slots']] == before, 'rebuild restores the plan from the setup answers')
    go('workout'); cnt('#list .card', 6)
    until("localStorage.getItem('gymp.routineDirty.' + session.user.id) === null", 'no unsynced routine edits left')

    # coach account: can skip the plan
    go('more'); A.click('#signOut'); A.click('[data-aumode="up"]')
    A.fill('#auUser', 'coach.kay'); A.fill('#auEmail', 'coach@example.com'); A.fill('#auPass', 'longenough1'); A.click('[data-role="trainer"]'); A.click('#auGo')
    A.fill('#obName', 'Coach Kay'); nx(); nx()
    until(lambda: A.is_visible('#obSkip'), 'coaches can skip their own plan'); A.click('#obSkip')
    until(lambda: A.is_visible('.wrap') and A.is_visible('[data-buildplan]'), 'coach without a plan sees the empty state')
    assert db()['t']['app_profiles'][1]['role'] == 'trainer'
    for t in ['history', 'body', 'fuel', 'more', 'workout']: go(t); until(lambda: A.is_visible(f'#t-{t}.on'), t)
    # ...and can build one later
    A.click('[data-buildplan]'); until(lambda: A.is_visible('#onb.show') and A.is_visible('#onb [data-goal]'), 'plan builder opens')
    A.click('#onb [data-goal="strength"]'); nx('#onb [data-obnext]'); nx('#onb [data-obnext]')
    A.click('#onb [data-wd="6"]'); nx('#onb [data-obnext]'); nx('#onb [data-obnext]'); A.click('#obDone')
    until(lambda: A.locator('#days button').count() == 5 and A.locator('#list .card').count() == 6, 'coach now has a 5-day plan incl. Saturday')

    # friends (milestone 3): add by username, accept / decline / cancel / remove. Signed in as coach.kay here.
    fr = lambda: db()['t'].get('app_friends', [])
    def signin(email):
        go('more'); A.click('#signOut')
        A.fill('#auEmail', email); A.fill('#auPass', 'longenough1'); A.click('#auGo')
        until(lambda: A.is_visible('.wrap') and A.evaluate("session && session.user.email") == email, 'signed in as ' + email)
    def add(u):  # sends the request and waits until the app has answered (it ignores a second click while it is busy)
        A.click('[data-frnew]'); A.fill('#frUser', u); A.click('[data-fradd]'); until('!FR.busy', 'friend request should finish')
    seg = lambda k: (A.click(f'[data-frseg="{k}"]'), until(f"FR.seg === '{k}'", k))
    tabF = lambda: (go('friends'), seg('people'))
    tabF(); has('#friends', 'No friends yet'); assert '@coach.kay' in A.inner_text('#friends') and not A.is_visible('#frBadge')
    add('zz'); has('#frMsg', '3 to 20')
    A.fill('#frUser', 'nobody_here'); A.click('[data-fradd]'); has('#frMsg', 'No one here'); until('!FR.busy')
    A.fill('#frUser', 'coach.kay'); A.click('[data-fradd]'); has('#frMsg', 'your own'); until('!FR.busy')
    A.fill('#frUser', '@Test_User'); A.press('#frUser', 'Enter')
    until(lambda: not A.is_visible('#sheet.show') and len(fr()) == 1 and fr()[0]['status'] == 'pending', 'request row is created')
    until(lambda: 'Test Person' in A.inner_text('#frSent') and A.locator('#frList .frow').count() == 0, 'request shows as sent')
    add('test_user'); has('#frMsg', 'already asked'); assert len(fr()) == 1, 'no duplicate request'
    A.click('#sx'); A.click('[data-frcancel]'); until(lambda: fr() == [] and not A.is_visible('#frSent'), 'cancel deletes the request')
    add('test_user'); until(lambda: len(fr()) == 1); shot('8-friends-sent')
    # the other person sees it, with a badge, and declines
    signin('test@example.com'); until(lambda: A.is_visible('#frBadge') and A.inner_text('#frBadge') == '1', 'badge on the Friends tab')
    tabF(); until(lambda: 'Coach Kay' in A.inner_text('#frReqs') and 'Coach' in A.inner_text('#frReqs .edn span'), 'request is listed'); shot('9-friends-request')
    A.click('[data-frno]'); until(lambda: fr() == [] and not A.is_visible('#frReqs') and not A.is_visible('#frBadge'), 'decline deletes the request')
    # ask the other way; adding someone who already asked you accepts their request
    add('coach.kay'); until(lambda: len(fr()) == 1)
    signin('coach@example.com'); tabF(); until(lambda: A.is_visible('[data-frok]'), 'incoming request has an accept button')
    add('test_user'); until(lambda: len(fr()) == 1 and fr()[0]['status'] == 'accepted', 'adding back accepts')
    until(lambda: A.locator('#frList .frow').count() == 1 and 'Test Person' in A.inner_text('#frList') and not A.is_visible('#frReqs') and not A.is_visible('#frBadge'), 'friend is listed')
    until("friendList().map(p => p.username).join() === 'test_user' && isFriend(friendIds()[0])", 'friendList / isFriend')
    shot('10-friends-list')
    # both sides see the friendship; it survives a reload; either can remove it
    signin('test@example.com'); tabF(); has('#frList', 'Coach Kay'); has('#friends', '1 friend')
    reload(); tabF(); cnt('#frList .frow', 1)
    A.click('#frList .frow'); has('#sheetin', 'Friends since')
    A.click('[data-frrm]'); A.click('[data-frrmyes]')
    until(lambda: fr() == [] and 'No friends yet' in A.inner_text('#friends'), 'remove deletes the friendship')
    # accept with the button
    add('coach.kay'); until(lambda: len(fr()) == 1); signin('coach@example.com'); tabF(); A.click('[data-frok]')
    until(lambda: fr()[0]['status'] == 'accepted' and A.locator('#frList .frow').count() == 1, 'accept button accepts')
    # leaderboard and nudges (milestone 4). coach.kay has logged nothing; test_user logged a set today.
    notes = lambda: db()['t'].get('app_notes', [])
    A.click('[data-frseg="board"]')
    until(lambda: A.locator('#lb .lbrow').count() == 2 and 'Test Person' in A.locator('#lb .lbrow').nth(0).inner_text() and A.locator('#lb .lbrow .lbval').nth(0).inner_text() == '1', 'friend who trained leads the week')
    until(lambda: 'You' in A.locator('#lb .lbrow.me').inner_text() and 'Trained today' in A.locator('#lb .lbrow').nth(0).inner_text(), 'board labels me and the one who trained today')
    for m in ['month', 'streak', 'prs', 'week']: A.select_option('#lbSel', m); cnt('#lb .lbrow', 2)
    shot('11-leaderboard')
    A.click('[data-nudge]'); until(lambda: len(notes()) == 1 and notes()[0]['kind'] == 'hype', 'someone who trained today gets hype, not a nudge')
    A.click('[data-nudge]'); has('#toast', 'already heard from you'); assert len(notes()) == 1, 'no spamming'
    signin('test@example.com'); until(lambda: A.inner_text('#frBadge') == '1', 'unread note shows on the badge')
    go('friends')
    until(lambda: 'Coach Kay sent you some hype' in A.inner_text('#frNotes') and A.is_visible('#lb'), 'with friends, the tab opens on the leaderboard'); shot('12-notes')
    until(lambda: 'You' in A.locator('#lb .lbrow').nth(0).inner_text(), 'I lead my own board')
    A.click('[data-ntclear]'); until(lambda: notes()[0]['read'] is True and not A.is_visible('#frNotes') and not A.is_visible('#frBadge'), 'clearing notes marks them read')
    A.click('[data-nudge]'); until(lambda: len(notes()) == 2 and notes()[1]['kind'] == 'nudge' and notes()[1]['read'] is False, 'someone who has not trained gets a nudge')
    reload(); until(lambda: not A.is_visible('#frBadge'), 'cleared notes stay cleared')
    signin('coach@example.com'); until(lambda: A.inner_text('#frBadge') == '1', 'nudge shows on the badge'); tabF(); has('#frNotes', 'Test Person nudged you')
    # chats (milestone 4): 1-on-1 and group. Signed in as coach.kay, friends with test_user.
    T = lambda n: db()['t'].get(n, [])
    def say(text): A.fill('#chIn', text); A.click('[data-chsend]'); until(lambda: any(m['body'] == text for m in T('app_messages')), 'message is saved: ' + text)
    seg('chats'); has('#chConvs', 'No chats yet')
    A.click('[data-chnew]'); A.click('#sheetin [data-chdm]')
    until(lambda: A.is_visible('#chIn') and 'Test Person' in A.inner_text('.chead') and A.is_disabled('[data-chsend]'), 'chat opens with send disabled while empty')
    until(lambda: len(T('app_convs')) == 1 and T('app_convs')[0]['kind'] == 'dm' and len(T('app_members')) == 2, 'dm conversation is created')
    say('Hello from coach'); until(lambda: A.locator('.msg.me').count() == 1 and T('app_messages')[0]['body'] == 'Hello from coach' and T('app_convs')[0]['last_text'] == 'Hello from coach', 'my message shows')
    A.click('[data-chback]'); until(lambda: 'Hello from coach' in A.inner_text('#chConvs') and A.locator('.cvrow.unread').count() == 0, 'my own message is not unread')
    # opening a chat with the same friend again reuses the conversation (from the friend's sheet this time)
    seg('people'); A.click('#frList .frow'); A.click('#sheetin [data-chdm]')
    until(lambda: len(T('app_convs')) == 1 and A.locator('.msg.me').count() == 1, 'same conversation, history loaded'); shot('13-chat')
    signin('test@example.com'); until(lambda: A.inner_text('#frBadge') == '1', 'unread chat shows on the badge')
    go('friends'); seg('chats')
    cnt('.cvrow.unread', 1); A.click('.cvrow')
    until(lambda: A.locator('.msg.them').count() == 1 and 'Hello from coach' in A.inner_text('#chList') and not A.is_visible('#frBadge'), 'reading clears the badge')
    say('Hey coach'); until(lambda: A.locator('.msg').count() == 2 and len(T('app_messages')) == 2, 'reply is sent')
    A.fill('#chIn', 'line one'); A.press('#chIn', 'Enter'); until(lambda: len(T('app_messages')) == 3, 'Enter sends')
    A.locator('.msg.me .mb').last.click(); A.click('[data-chdel]')
    until(lambda: len(T('app_messages')) == 2 and A.locator('.msg').count() == 2, 'delete my own message')
    # group chat: needs at least one friend, can be renamed
    A.click('[data-chback]'); A.click('[data-chgroup]')
    A.click('[data-chgmake]'); has('#chGMsg', 'at least one')
    A.fill('#chGName', 'Lifters'); A.check('#sheetin .chpick'); A.click('[data-chgmake]')
    until(lambda: 'Lifters' in A.inner_text('.chead') and '2 people' in A.inner_text('.chead') and [c['kind'] for c in T('app_convs')] == ['dm', 'group'] and len(T('app_members')) == 4, 'group is created')
    say('First!'); A.click('[data-chinfo]'); A.fill('#chRName', 'Squad'); A.click('[data-chrename]')
    until(lambda: 'Squad' in A.inner_text('.chead') and T('app_convs')[1]['title'] == 'Squad', 'group is renamed'); shot('14-group')
    # invite link: made in the group details, and replacing it kills the old one
    A.click('[data-chinfo]'); A.click('[data-glon]'); until(lambda: A.is_visible('#glUrl') and T('app_convs')[1]['invite'], 'an invite link is created')
    tok1 = T('app_convs')[1]['invite']; assert len(tok1) == 32 and A.input_value('#glUrl').endswith('?g=' + tok1), 'the link carries the group’s code'
    A.click('[data-glnew]'); until(lambda: T('app_convs')[1]['invite'] not in (None, tok1) and A.input_value('#glUrl').endswith(T('app_convs')[1]['invite']), 'replacing the link makes a new code')
    A.evaluate("closeSheet()")
    reload(); go('friends'); seg('chats')
    until(lambda: A.locator('.cvrow').count() == 2 and A.locator('.cvrow.unread').count() == 0 and 'Squad' in A.locator('.cvrow').nth(0).inner_text(), 'chats list after reload'); shot('15-chats')
    # the other member sees both as unread (plus one unread nudge), reads the group, then leaves it
    signin('coach@example.com'); until(lambda: A.inner_text('#frBadge') == '3', 'badge counts both chats and the nudge')
    go('friends'); seg('chats'); cnt('.cvrow.unread', 2)
    A.click('.cvrow'); until(lambda: 'First!' in A.inner_text('#chList') and 'Test Person' in A.inner_text('.mwho'), 'group messages name the sender')
    A.click('[data-chinfo]'); until(lambda: A.is_visible('[data-chleave]') and A.locator('#sheetin [data-chadd]').count() == 0, 'everyone is already in')
    A.click('[data-chleave]'); until(lambda: len(T('app_members')) == 3 and A.locator('.cvrow').count() == 1 and A.inner_text('#frBadge') == '2', 'leaving the group')
    # opening an invite link: an old code is refused; a live one asks first, then lands in the group
    A.goto(URL + '?g=' + tok1); until(lambda: 'no longer works' in A.inner_text('#toast') and '?g=' not in A.url, 'a replaced link is refused and dropped from the address bar', timeout=15000)
    A.goto(URL + '?g=' + T('app_convs')[1]['invite']); until(lambda: 'Join this group?' in A.inner_text('#sheetin') and 'Squad' in A.inner_text('#sheetin') and '1 person' in A.inner_text('#sheetin'), 'a live link asks before joining', timeout=15000)
    A.click('[data-gljoin]'); until(lambda: len(T('app_members')) == 4 and 'Squad' in A.inner_text('.chead') and A.evaluate("!localStorage.getItem('gymp.join')"), 'joining by link opens the group')
    A.click('[data-chinfo]'); A.click('[data-chleave]'); until(lambda: len(T('app_members')) == 3, 'and they can leave again'); go('friends'); seg('chats')
    seg('people')
    # weekly challenge with a friend (milestone 4). coach.kay sets one with test_user, who has trained 1 day this week.
    chal = lambda: [n for n in notes() if n['kind'] == 'challenge']
    openF = lambda: go('friends')
    seg('board'); until(lambda: A.is_visible('#clNew') and A.locator('.clcard').count() == 0, 'no challenge yet')
    A.click('[data-clnew]'); A.click('[data-cltype="team"]'); until(lambda: A.is_visible('#clnRow'), 'team goal has a target row')
    A.click('[data-cln="1"]'); until(lambda: A.inner_text('#clnV') == '5', 'target goes up')
    A.click('[data-cltype="days"]'); until(lambda: not A.is_visible('#clnRow'), 'most-days has no target row'); A.click('[data-clidea]'); A.click('[data-clsave]')
    until(lambda: len(chal()) == 1 and chal()[0]['data']['type'] == 'days' and 'smoothies' in chal()[0]['data']['stake'], 'the friend is told through app_notes')
    until(lambda: A.locator('.clcard').count() == 1 and 'Most days' in A.inner_text('.clcard') and not A.is_visible('#clNew'), 'challenge card shows')
    until(lambda: [A.locator('.clcard .chrow b').nth(i).inner_text() for i in (0, 1)] == ['0', '1'], 'my score, then theirs')
    assert A.evaluate("Object.keys(S.settings.challenges).length") == 1; shot('16-challenge')
    signin('test@example.com'); openF()
    has('#frNotes', 'set a weekly challenge with you: Most days')
    until(lambda: A.locator('.clcard').count() == 1 and 'Coach' in A.inner_text('.clcard') and 'smoothies' in A.inner_text('.clcard'), 'the friend sees the same challenge')
    until(lambda: [A.locator('.clcard .chrow b').nth(i).inner_text() for i in (0, 1)] == ['1', '0'], 'scores from the friend side')
    # either side can change it, and the newer copy wins
    A.click('[data-cledit]'); A.click('[data-cltype="team"]'); A.click('[data-clsave]')
    until(lambda: 'Team goal' in A.inner_text('.clcard') and '1/4' in A.inner_text('.clcard') and len(chal()) == 2, 'the friend changes the challenge')
    signin('coach@example.com'); openF(); until(lambda: 'Team goal' in A.inner_text('.clcard') and '0/4' in A.inner_text('.clcard'), 'the change reaches the person who set it')
    A.click('[data-cledit]'); A.click('[data-cloff]'); until(lambda: A.locator('.clcard').count() == 0 and A.is_visible('#clNew'), 'challenge ends')
    signin('test@example.com'); openF(); until(lambda: A.locator('.clcard').count() == 0 and 'ended your weekly challenge' in A.inner_text('#frNotes'), 'ending it ends it for both')
    signin('coach@example.com'); openF(); seg('people')
    # trainer portal (milestone 5). coach.kay is a coach (role trainer); test_user adds them as their coach.
    tr = lambda: T('app_trainers'); kinds = lambda k: [n for n in notes() if n['kind'] == k]
    coach_id = T('app_profiles')[1]['id']; test_id = T('app_profiles')[0]['id']
    plan = lambda: [r for r in T('app_routines') if r['user_id'] == test_id][0]
    openC = lambda: go('clients'); openCo = lambda: (go('coach'), until(lambda: A.is_visible('#t-coach.on'), 'Coach tab opens'))
    until(lambda: A.is_visible('#navClients'), 'coaches get the Clients tab')
    openC(); until(lambda: 'No clients yet' in A.inner_text('#trClients') and '@coach.kay' in A.inner_text('#trClients'), 'no clients yet')
    signin('test@example.com'); until(lambda: not A.is_visible('#navClients'), 'everyone else does not'); assert A.is_visible('#navCoach'), 'and gets the Coach tab instead'
    openCo(); has('#trCard', 'Add your coach')
    A.click('[data-tradd]'); A.fill('#trUser', 'test_user'); A.click('[data-trsend]'); has('#trMsg', 'your own'); until('!TR.busy')
    A.fill('#trUser', 'nobody_here'); A.click('[data-trsend]'); has('#trMsg', 'No one here'); until('!TR.busy')
    A.fill('#trUser', '@Coach.Kay'); A.press('#trUser', 'Enter')
    until(lambda: len(tr()) == 1 and tr()[0]['status'] == 'pending' and tr()[0]['client'] == test_id and 'Waiting' in A.inner_text('#trCard'), 'coach request is pending')
    A.click('[data-trcancel]'); until(lambda: tr() == [] and 'Add your coach' in A.inner_text('#trCard'), 'cancelling the coach request')
    A.click('[data-tradd]'); A.fill('#trUser', 'coach.kay'); A.click('[data-trsend]'); until(lambda: len(tr()) == 1, 'coach request is sent again')
    # the coach sees the request with a badge on the Clients tab, and accepts
    signin('coach@example.com'); until(lambda: A.inner_text('#trBadge') == '1', 'coach request badge')
    openC(); has('#trReqs', 'Test Person'); A.click('[data-trok]')
    until(lambda: tr()[0]['status'] == 'accepted' and A.locator('#trClients .frow').count() == 1 and not A.is_visible('#trReqs') and not A.is_visible('#trBadge') and len(kinds('trainer_ok')) == 1, 'coach accepts the client')
    # open the client: stats, plan, recent sessions
    A.click('#trClients .frow')
    until(lambda: 'Test Person' in A.inner_text('#clients') and A.locator('#trPlan .pv').count() == 3 and A.locator('#trLog .hrow').count() == 1 and A.inner_text('#trSum .tstats b >> nth=0') == '1', 'client view shows stats, plan and sessions')
    shot('17-client')
    # progress photos are private until the client says yes: the coach can only ask
    ph = lambda: tr()[0].get('photos', 'no')
    until(lambda: 'Private' in A.inner_text('#trPhotos') and A.locator('#trPhotos [data-trphotoask]').count() == 1 and A.locator('#trPhotos img').count() == 0, 'photos are private, with an Ask button')
    A.click('[data-trphotoask]')
    until(lambda: ph() == 'asked' and len(kinds('photos')) == 1 and kinds('photos')[0]['user_id'] == test_id, 'the request is saved and the client is told')
    until(lambda: 'Waiting for Test' in A.inner_text('#trPhotos') and A.locator('#trPhotos [data-trphotoask]').count() == 0, 'no second Ask while waiting')
    # edit their plan with the routine editor: saved to the client's row straight away, one notification per editing session
    n0 = len(plan()['routine'][0]['slots']); first = plan()['routine'][0]['slots'][0]['opts'][0]['n']
    A.click('[data-tredit]'); until(lambda: 'Test’s plan' in A.inner_text('#sheetin') and A.locator('.edrow').count() == n0 and not A.is_visible('[data-edreset]'), 'client plan editor opens')
    A.click('[data-eddel="0"]')
    until(lambda: len(plan()['routine'][0]['slots']) == n0 - 1 and plan()['updated_by'] == coach_id and plan()['routine'][0]['slots'][0]['opts'][0]['n'] != first, 'the edit lands in the client row')
    names = lambda: [sl['opts'][0]['n'] for sl in plan()['routine'][0]['slots']]; nm = names()
    A.click('[data-edmv="0:1"]'); until(lambda: names()[:2] == [nm[1], nm[0]], 'the move lands in the client row'); assert len(kinds('routine')) == 1, 'one notification, not one per change'
    mine = [r for r in T('app_routines') if r['user_id'] == coach_id][0]; assert len(mine['routine']) == 5 and mine['updated_by'] == coach_id, 'the coach’s own plan is untouched'
    A.click('#sx'); until(lambda: A.locator('#trPlan .pv').nth(0).locator('.pv-x').count() == n0 - 1, 'the client view shows the edited plan')
    # message the client: a coach conversation, opened from the Clients tab and returning to it; it lives in the Inbox, not in Friends → Chats
    A.click('#trSum [data-chdm]'); say('Tweaked your Monday')
    until(lambda: [c['kind'] for c in T('app_convs')] == ['dm', 'group', 'coach'] and 'Test Person' in A.inner_text('.chead'), 'coach conversation is created')
    A.click('[data-chback]'); until(lambda: A.is_visible('#clients') and A.is_visible('#trSum'), 'Back returns to the client')
    A.click('[data-trback]'); A.click('[data-trseg="inbox"]')
    until(lambda: A.locator('#trInbox .cvrow').count() == 1 and 'Tweaked your Monday' in A.inner_text('#trInbox'), 'inbox shows the coach chat'); shot('18-inbox')
    openF(); seg('chats'); cnt('#chConvs .cvrow', 1, 'client chats stay out of the coach’s friends chats')
    # the coach's own plan editor still edits their own plan
    go('more'); A.click('[data-edopen]'); until(lambda: 'Edit routine' in A.inner_text('#sheetin') and A.evaluate('ED_FOR === null'), 'own plan editor'); A.click('#sx')
    # the client is told, gets the new plan, and can message or remove the coach
    signin('test@example.com')
    until("ROUTINE[0].slots.length === %d && Object.keys(S.settings.swaps).length === 0" % (n0 - 1), 'the edited plan arrives on the client')
    openF(); until(lambda: 'Coach Kay updated your plan' in A.inner_text('#frNotes') and 'Coach Kay is now your coach' in A.inner_text('#frNotes'), 'client is told about the coach and the plan')
    seg('chats'); until(lambda: A.locator('#chConvs .cvrow').count() == 3 and 'Coach Kay · Coach' in A.locator('#chConvs .cvrow').nth(0).inner_text() and A.locator('#chConvs .cvrow.unread').count() >= 1, 'client sees the coach chat')
    openCo(); until(lambda: 'Coach Kay' in A.inner_text('#trCard') and A.is_visible('#trCard [data-chdm]'), 'my coach card'); shot('19-my-coach')
    # the coach asked for progress photos: the client sees the note and decides
    openF(); has('#frNotes', 'Coach Kay asked to see your progress photos'); openCo()
    until(lambda: 'Coach asked to see your progress photos' in A.inner_text('#trPhAsk') and A.is_visible('#trPhAsk [data-trphotos="yes"]') and A.is_visible('#trPhAsk [data-trphotos="no"]') and not A.is_visible('#trPhOn'), 'client sees the request with Allow / Not now')
    shot('20-photo-request')
    A.click('#trPhAsk [data-trphotos="no"]'); until(lambda: ph() == 'no' and not A.is_visible('#trPhAsk') and not A.is_visible('#trPhOn'), 'Not now keeps them private')
    def openClient(): openC(); A.click('#trClients .frow'); until(lambda: A.is_visible('#trPhotos'), 'client view shows the photos card')
    setphotos = lambda v: A.evaluate("([id, v]) => { const d = JSON.parse(localStorage.getItem('mockp.db')), st = d.t.app_state.find(r => r.user_id === id); if (v) st.data.photos = v; else delete st.data.photos; localStorage.setItem('mockp.db', JSON.stringify(d)); }", [test_id, v])
    signin('coach@example.com'); openClient()
    until(lambda: 'Private' in A.inner_text('#trPhotos') and A.locator('#trPhotos [data-trphotoask]').count() == 1, 'after a no the coach can ask again')
    A.click('[data-trphotoask]'); until(lambda: ph() == 'asked' and len(kinds('photos')) == 2, 'asked again')
    signin('test@example.com'); openCo(); until(lambda: A.is_visible('#trPhAsk'), 'the request is back')
    A.click('#trPhAsk [data-trphotos="yes"]')
    until(lambda: ph() == 'yes' and A.is_visible('#trPhOn') and not A.is_visible('#trPhAsk') and 'Stop sharing' in A.inner_text('#trPhOn'), 'Allow shares the photos and offers Stop sharing')
    reload(); openCo(); until(lambda: A.is_visible('#trPhOn'), 'the answer survives a reload')
    # the coach now sees the Progress photos card without the Ask button; only files in the client's own folder are shown
    signin('coach@example.com'); openClient()
    until(lambda: 'uploaded any photos yet' in A.inner_text('#trPhotos') and 'Shared with you by Test' in A.inner_text('#trPhotos') and A.locator('#trPhotos [data-trphotoask]').count() == 0, 'coach sees the photos card without the Ask button')
    setphotos({'2026-10': {'front': {'path': test_id + '/2026-10-front.jpg', 'u': 1, 'up': True}, 'side': {'path': 'someone-else/x.jpg', 'u': 1, 'up': True}, 'back': {'del': True, 'u': 1}}})
    A.click('[data-trback]'); A.click('#trClients .frow')
    until(lambda: A.locator('#trPhotos .pslot').count() == 3 and A.locator('#trPhotos .pslot.has').count() == 1 and A.get_attribute('#trPhotos img', 'data-cph') == test_id + '/2026-10-front.jpg', 'only the photo in the client’s own folder is listed')
    shot('21-client-photos'); setphotos(None)
    # the client stops sharing: private again on both sides
    signin('test@example.com'); openCo(); A.click('#trPhOn [data-trphotos="no"]')
    until(lambda: ph() == 'no' and not A.is_visible('#trPhOn') and not A.is_visible('#trPhAsk'), 'Stop sharing makes the photos private again')
    signin('coach@example.com'); openClient()
    until(lambda: 'Private' in A.inner_text('#trPhotos') and A.locator('#trPhotos img').count() == 0 and A.locator('#trPhotos [data-trphotoask]').count() == 1, 'the coach is back to the Ask button')
    # meal plan: the coach writes it from the client view, with daily targets
    until(lambda: 'No meal plan yet' in A.inner_text('#trMeals') and 'Nothing logged today' in A.inner_text('#trMeals'), 'client view has a meal plan card')
    A.click('[data-mledit="client"]'); has('#sheetin', 'Test’s meal plan'); A.fill('[data-mlt="cal"]', '2200'); A.fill('[data-mlt="p"]', '160'); A.click('[data-mladd]')
    until(lambda: A.input_value('[data-mln="0"]') == 'Breakfast' and A.input_value('[data-mlt="cal"]') == '2200', 'a meal is added and the targets typed before it are kept')
    A.fill('[data-mlnote="0"]', 'Eat before 9 <b>am</b>'); A.press('[data-mlnote="0"]', 'Tab')
    A.click('[data-mliadd="0"]'); A.fill('#mfN', 'Eggs on toast'); A.fill('#mf_p', '20'); A.fill('#mf_c', '30'); A.fill('#mf_f', '10'); A.click('[data-mlsave]')
    until(lambda: 'Eggs on toast' in A.inner_text('#sheetin') and '290 kcal' in A.inner_text('#sheetin'), 'calories are worked out from the macros when left blank')
    A.click('[data-mldone]')
    mp = lambda: [x for x in plan()['routine'] if 'meals' in x]
    until(lambda: len(mp()) == 1 and mp()[0]['meals']['t']['cal'] == 2200 and mp()[0]['meals']['by'] == coach_id and mp()[0]['meals']['meals'][0]['items'][0]['cal'] == 290 and plan()['updated_by'] == coach_id, 'the meal plan is saved in the client row')
    assert len([x for x in plan()['routine'] if 'slots' in x]) == A.evaluate("TR.vr.routine.length"), 'the workout days are untouched'
    until(lambda: 'Eggs on toast' in A.inner_text('#trMeals') and '2,200 kcal' in A.inner_text('#trMeals'), 'and shows on the client view'); shot('25-coach-meal-plan')
    # the client sees it on Fuel, ticks a food, and logs something extra
    signin('test@example.com'); nd = A.evaluate("ROUTINE.length"); go('fuel')
    until(lambda: 'Eat before 9 <b>am</b>' in A.inner_text('#mlPlan .mlnote'), 'the client sees the coach’s note on the meal, shown as plain text')
    until(lambda: 'Written by your coach' in A.inner_text('#mlPlan') and 'Targets set by your coach' in A.inner_text('#mlRings') and '2,200' in A.inner_text('#mlRings'), 'the client sees the coach’s meal plan and targets')
    assert nd == len([x for x in plan()['routine'] if 'slots' in x]) and A.evaluate("DAYS.length") == nd, 'the meal plan is not mistaken for a workout day'
    A.click('[data-mlate="0:0"]'); until(lambda: A.evaluate("fuelOf(fuelDate).cal") == 290 and A.evaluate("fuelOf(fuelDate).protein") == 20 and A.locator('.mlitem.on').count() == 1, 'ticking a food adds its macros')
    A.click('[data-mllog]'); A.fill('#mfN', 'Protein shake'); A.fill('#mf_cal', '150'); A.fill('#mf_p', '25'); A.click('[data-mlsave="log"]')
    until(lambda: A.evaluate("fuelOf(fuelDate).cal") == 440 and A.evaluate("fuelOf(fuelDate).protein") == 45 and 'Protein shake' in A.inner_text('#mlLog'), 'logging a food adds to the day'); shot('26-fuel')
    A.click('[data-mlate="0:0"]'); until(lambda: A.evaluate("fuelOf(fuelDate).cal") == 150 and A.locator('.mlitem.on').count() == 0, 'unticking takes it off again')
    A.click('[data-mlun]'); until(lambda: A.evaluate("fuelOf(fuelDate).cal") == 0 and not A.is_visible('#mlLog'), 'and a logged food can be removed')
    reload(); go('fuel'); until(lambda: 'Eggs on toast' in A.inner_text('#mlPlan') and A.evaluate("ROUTINE.length") == nd, 'the meal plan survives a reload')
    # editing the workout plan keeps the meal plan
    A.click('#menuBtn'); A.click('#hmenu [data-edopen]'); A.fill('#edTitle', 'Renamed day'); A.click('#sx') if False else A.click('[data-edday="0"]')
    until(lambda: len(mp()) == 1 and plan()['updated_by'] == test_id and any(d.get('title') == 'Renamed day' for d in plan()['routine']), 'saving the workout plan keeps the meal plan in the row'); A.click('#sx')
    openCo()
    A.click('[data-trrm]'); A.click('[data-trrmyes]')
    until(lambda: tr() == [] and 'Add your coach' in A.inner_text('#trCard'), 'removing the coach deletes the link')
    openF(); seg('chats'); cnt('#chConvs .cvrow', 2, 'the coach chat goes with it')
    signin('coach@example.com'); openC(); until(lambda: 'No clients yet' in A.inner_text('#trClients') and not A.is_visible('#trBadge'), 'coach has no clients again')
    A.click('[data-trseg="inbox"]'); cnt('#trInbox .cvrow', 0)
    openF(); seg('people')
    # three accounts (milestone 6): a third person joins, for the leaderboard, group "add a friend", and the non-coach check
    go('more'); A.click('#signOut'); A.click('[data-aumode="up"]')
    A.fill('#auUser', 'sam_lifts'); A.fill('#auEmail', 'sam@example.com'); A.fill('#auPass', 'longenough1'); A.click('#auGo')
    A.fill('#obName', 'Sam Lee'); nx('#onb [data-obnext]'); nx('#onb [data-obnext]'); A.click('#onb [data-goal="strength"]')
    for _ in range(4): nx('#onb [data-obnext]')
    A.click('#obDone'); until(lambda: A.is_visible('.wrap') and len(T('app_profiles')) == 3, 'third account is set up')
    openF(); add('coach.kay'); until(lambda: len(fr()) == 2); add('test_user'); until(lambda: len(fr()) == 3 and A.locator('#frSent .frow').count() == 2, 'sam has two pending requests')
    openCo(); A.click('[data-tradd]'); A.fill('#trUser', 'test_user'); A.click('[data-trsend]')
    until(lambda: 'isn’t signed up as a coach' in A.inner_text('#trMsg') and tr() == [], 'only coaches can be added as a coach'); A.click('#sx')
    signin('coach@example.com'); openF(); seg('people'); A.click('[data-frok]'); cnt('#frList .frow', 2)
    seg('board'); until(lambda: A.locator('#lb .lbrow').count() == 3 and 'Test Person' in A.locator('#lb .lbrow').nth(0).inner_text(), 'three on the board, the one who trained first')
    # group: start with one friend, add the other from the group details
    seg('chats'); A.click('[data-chgroup]'); A.fill('#chGName', 'Trio'); A.locator('#sheetin .chpick').nth(0).check(); A.click('[data-chgmake]')
    until(lambda: '2 people' in A.inner_text('.chead') and any(c['title'] == 'Trio' for c in T('app_convs')), 'Trio is created')
    trio = [c for c in T('app_convs') if c['title'] == 'Trio'][0]['id']; members = lambda: [m for m in T('app_members') if m['conv_id'] == trio]
    A.click('[data-chinfo]'); cnt('#sheetin [data-chadd]', 1)
    A.click('[data-chadd]'); until(lambda: len(members()) == 3 and A.locator('#sheetin [data-chadd]').count() == 0, 'the other friend is added')
    A.click('#sx'); until(lambda: '3 people' in A.inner_text('.chead'), 'header counts three'); say('Welcome both')
    # a member who is not friends with everyone still sees names (profiles of other members are loaded)
    signin('sam@example.com'); until(lambda: A.inner_text('#frBadge') == '1', 'sam has one unread chat'); openF(); seg('chats'); A.click('.cvrow')
    until(lambda: 'Coach Kay' in A.inner_text('.mwho') and '3 people' in A.inner_text('.chead'), 'sam sees names in the group'); say('Hi all')
    A.click('[data-chinfo]'); until(lambda: 'Test Person' in A.inner_text('#sheetin') and A.locator('#sheetin [data-chadd]').count() == 0, 'group details list everyone'); A.click('#sx')
    signin('test@example.com'); openF(); seg('chats'); until(lambda: 'Trio' in A.locator('#chConvs .cvrow').nth(0).inner_text() and 'Hi all' in A.locator('#chConvs .cvrow').nth(0).inner_text(), 'Trio leads the chats with the last message')
    A.click('.cvrow'); until(lambda: [x.strip() for x in A.locator('.mwho').all_inner_texts()] == ['Coach Kay', 'Sam Lee'], 'names of both senders, friend or not')
    signin('coach@example.com'); openF(); seg('people')
    # signing out clears the list from the screen
    go('more'); A.click('#signOut')
    until("FR.rows.length === 0 && document.getElementById('friends').innerHTML === ''", 'signing out clears the friends list')
    A.fill('#auEmail', 'coach@example.com'); A.fill('#auPass', 'longenough1'); A.click('#auGo'); until(lambda: A.is_visible('.wrap'), 'coach signs back in')

    # forgot password
    go('more'); A.click('#signOut'); A.click('[data-aumode="forgot"]'); A.fill('#auEmail', 'test@example.com'); A.click('#auGo')
    has('#auErr', 'reset link')
    assert not errs, errs

    # start from scratch: a fourth person skips the built plan and gets an empty week to fill in by hand
    A.click('.au-go[data-aumode="in"], .au-link[data-aumode="in"]'); A.click('[data-aumode="up"]')
    A.fill('#auUser', 'blank_bo'); A.fill('#auEmail', 'bo@example.com'); A.fill('#auPass', 'longenough1'); A.click('#auGo')
    A.fill('#obName', 'Bo Blank'); nx('#onb [data-obnext]'); A.click('[data-mode="blank"]'); A.click('#onb [data-obnext]')
    until(lambda: A.is_visible('#obBlank') and A.locator('#onb .wd.on').count() == 4, 'choosing an empty plan goes straight to picking days')
    A.click('#obBack'); until(lambda: A.is_visible('[data-mode="auto"]'), 'back returns to the choice'); A.click('#onb [data-obnext]')
    A.click('#onb [data-wd="2"]'); A.click('#onb [data-wd="4"]'); A.click('#onb [data-unit="kg"]'); shot('22-setup-blank'); A.click('#obBlank')
    until(lambda: A.is_visible('.wrap') and len(T('app_profiles')) == 4, 'fourth account is set up')
    bo = [r for r in T('app_routines') if r['user_id'] == T('app_profiles')[3]['id']][0]['routine']
    assert [d['wd'] for d in bo] == [1, 5] and all(d['slots'] == [] for d in bo), 'the plan is two empty days'
    assert A.evaluate("S.settings.plan") is None and A.evaluate("S.settings.unit") == 'kg', 'no setup answers are stored for an empty plan'
    until(lambda: A.is_visible('#emptyDay') and A.locator('#days button').count() == 2 and not A.is_visible('.excount'), 'an empty day says so, with no exercise counter'); shot('23-empty-day')
    A.click('[data-edaddhere]'); A.fill('#esN', 'Leg Press'); A.click('[data-edsave]')
    until(lambda: A.evaluate("ROUTINE[cur].slots.length") == 1, 'the exercise is added to the day'); A.click('#sx')
    cnt('#list .card', 1, 'a hand-built day is not padded out to four exercises')
    # the editor: name the day, add a third day, move it, remove it
    A.click('#menuBtn'); A.click('#hmenu [data-edopen]'); A.fill('#edTitle', 'Legs and glutes'); A.click('[data-eddayadd]')
    until(lambda: A.evaluate("ROUTINE.length") == 3 and A.evaluate("ROUTINE[cur].title") == 'Legs and glutes' and A.evaluate("ROUTINE[2].slots.length") == 0, 'a third, empty day is added and the name is kept')
    A.select_option('#edWd', '3'); until(lambda: A.evaluate("ROUTINE[2].wd") == 3 and A.evaluate("ROUTINE[2].d") == 'Wed', 'the new day moves to Wednesday')
    A.click('#sx'); until(lambda: [x.split('\n')[0] for x in A.locator('#days button').all_inner_texts()] == ['Mon', 'Wed', 'Fri'] if A.evaluate("cur") == 1 else A.inner_text('#days').replace('\n', ' ').index('Wed') < A.inner_text('#days').replace('\n', ' ').index('Fri'), 'days show in weekday order')
    A.click('#menuBtn'); A.click('#hmenu [data-edopen]'); A.click('[data-edday="2"]'); A.click('[data-eddayrm]')
    until(lambda: A.evaluate("ROUTINE.length") == 2, 'an unused day can be removed'); A.click('#sx')
    # the exercise count and warm-up fold away after the first set, and the options sit behind the ··· button
    go('workout'); A.click('#days button >> nth=0'); until(lambda: A.is_visible('.excount .exstep') and A.is_visible('[data-wuopen]'), 'counter and warm-up show before the first set')
    assert not A.is_visible('[data-swap="0"]'); A.click('[data-exmore]'); until(lambda: A.is_visible('[data-swap="0"]') and A.is_visible('[data-pace="0"]'), 'the ··· button shows the options')
    A.fill('[data-w="0:0"]', '60'); A.fill('[data-r="0:0"]', '10'); A.click('[data-chk="0:0"]')
    until(lambda: A.is_visible('.excmin') and not A.is_visible('.excount') and '1 exercise today' in A.inner_text('.excmin'), 'the card folds once a set is logged'); A.click('#rskip'); shot('24-folded')
    A.click('.excmin'); until(lambda: A.is_visible('.excount .exstep') and A.is_visible('[data-wuopen]') and A.is_visible('.exchide'), 'tapping it opens the card again')
    A.click('.exchide'); until(lambda: A.is_visible('.excmin'), 'and Hide folds it')
    A.click('#menuBtn'); A.click('#hmenu [data-edopen]'); A.click('[data-eddayrm]'); has('#toast', 'already has logged workouts'); A.click('#sx')
    # no coach: build your own meal plan and set your own targets
    go('fuel'); has('#mlPlan', 'No meal plan yet'); A.click('[data-mledit]'); assert not A.is_visible('[data-mlt="cal"]'), 'your own targets live under Goals'
    A.click('[data-mladd]'); A.click('[data-mladd]'); A.fill('[data-mln="1"]', 'Second breakfast'); A.click('[data-mliadd="1"]'); A.fill('#mfN', 'Porridge'); A.fill('#mf_cal', '300'); A.click('[data-mlsave]'); A.click('[data-mldone]')
    until(lambda: A.evaluate("MEALS.meals.map(m => m.n).join()") == 'Breakfast,Second breakfast' and A.evaluate("MEALS.meals[1].items[0].cal") == 300 and 'Porridge' in A.inner_text('#mlPlan') and 'coach' not in A.inner_text('#mlPlan'), 'own meal plan is saved, with the renamed meal')
    A.fill('[data-goal="carbs"]', '250'); A.press('[data-goal="carbs"]', 'Tab'); until(lambda: A.evaluate("mealTargets().c") == 250 and '/ 250' in A.inner_text('#mlRings'), 'own carb target shows on the ring')
    assert not errs, errs
    # offline (milestone 6): the service worker caches every file the page loads, and the app opens with no network
    import re
    html = open(os.path.join(here, '../../public/index.html')).read(); sw = open(os.path.join(here, '../../public/sw.js')).read()
    shell = re.findall(r"'([^']+)'", re.search(r'const SHELL = \[(.*?)\];', sw, re.S).group(1))
    for src in re.findall(r'<script src="([^"]+)"', html):
        if not src.startswith('http'): assert (src if src.startswith('..') else './' + src) in shell, src + ' is loaded by index.html but missing from SHELL in public/sw.js'
    for f in shell: assert f == './' or os.path.exists(os.path.join(here, '../../public', f)), f + ' is in SHELL but does not exist'
    ctx2 = b.new_context(viewport={'width': 390, 'height': 844}); ctx2.add_init_script(mock); B = ctx2.new_page()
    B.goto(URL); B.evaluate("navigator.serviceWorker.ready.then(() => 1)")
    cached = lambda: B.evaluate("caches.keys().then(ns => Promise.all(ns.filter(n => n.startsWith('gymp-')).map(n => caches.open(n).then(c => c.keys()).then(ks => ks.map(k => new URL(k.url).pathname))))).then(a => a.flat())")
    until(lambda: all(f in cached() for f in ['/public/app.js', '/public/trainer.js', '/library.js', '/public/index.html']), 'the public app has its own cache with every file cached', page=B)  # filled while the worker installs
    ctx2.set_offline(True); B.reload(); until(lambda: B.is_visible('#auth.show'), 'opens offline from the cache', page=B)
    ctx2.close()
    print('OK public'); b.close()

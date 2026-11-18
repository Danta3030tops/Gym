"""Unit tests for Spott's plan generator and auto-progression rules (public/plan.js, public/exlib.js).
Run from the repo root, with the same setup as the smoke tests:
  python3 -m http.server 8765 &
  python3 dev/tests/unit-plan.py
Loads only the plain-data and pure-function files into a blank page, then checks named cases and every combination of setup answers."""
import json
from playwright.sync_api import sync_playwright
BASE = 'http://localhost:8765/'
FILES = ['data.js', 'data-qxeen.js', 'figures.js', 'library.js', 'public/templates.js', 'public/exlib.js', 'public/plan.js']
fails = []
def check(ok, msg):
    if not ok: fails.append(msg)
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(BASE + 'dev/tests/unit-plan.py')  # any page on the server: we only need its origin
    pg.set_content('<!doctype html><meta charset="utf-8"><title>t</title>')
    for f in FILES: pg.add_script_tag(content=open(f, encoding='utf-8').read())  # inline, so the en dashes in rep ranges keep their encoding
    assert not errs, errs
    J = lambda js: pg.evaluate(js)
    # helpers in the page: what a plan's exercises are, and the library facts about each
    J("""window.U = { ex: plan => plan.flatMap(d => d.slots.filter(s => s.mv).flatMap(s => s.opts.map(o => o.n))),
                      main: plan => plan.flatMap(d => d.slots.filter(s => s.mv).map(s => exMeta(s.opts[0].n))) }""")

    # the library itself: 60+ exercises, every pattern has a figure, every swap target that exists is a real entry
    lib = J("({ n: EX.length, badPat: EX.filter(e => !P[e.pat]).map(e => e.n), bad: EX.filter(e => !['body','db','gym'].includes(e.eq) || !(e.d >= 1 && e.d <= 3)).map(e => e.n), dup: EX.length - new Set(EX.map(e => e.n.toLowerCase())).size })")
    check(lib['n'] >= 60, f"library has {lib['n']} exercises, want 60+")
    check(not lib['badPat'] and not lib['bad'] and lib['dup'] == 0, f'library entries are well formed: {lib}')

    # 1. bodyweight-only beginner, 2 days
    r = J("(() => { const pl = generatePlan({ goal: 'general', level: 'new', equip: 'body', mins: 45, avoid: [], wds: [1, 4] }); return { days: pl.map(d => d.title), eq: [...new Set(U.ex(pl).map(n => exMeta(n).eq))], maxD: Math.max(...U.ex(pl).map(n => exMeta(n).d)), n: pl.map(d => d.slots.length), sets: [...new Set(pl.flatMap(d => d.slots.map(s => s.sets)))], reps: [...new Set(pl.flatMap(d => d.slots.filter(s => !s.time).map(s => s.reps)))] }; })()")
    check(r['days'] == ['Full Body A', 'Full Body B'], f'bodyweight beginner, 2 days: full body split, got {r["days"]}')
    check(r['eq'] == ['body'], f'bodyweight beginner: only bodyweight moves, got {r["eq"]}')
    check(r['maxD'] <= 2, f'beginner: nothing harder than difficulty 2, got {r["maxD"]}')
    check(all(4 <= x <= 5 for x in r['n']), f'45 min: up to 5 exercises a day, got {r["n"]}')
    check(r['sets'] == [2] and r['reps'] == ['10–15'], f'general, beginner: 2 sets of 10–15, got {r["sets"]} {r["reps"]}')

    # 2. dumbbell-only intermediate, 4 days, shoulder injury
    r = J("(() => { const pl = generatePlan({ goal: 'muscle', level: 'some', equip: 'home', mins: 60, avoid: ['shoulders'], wds: [1, 2, 4, 5] }); return { days: pl.map(d => d.title), eq: [...new Set(U.ex(pl).map(n => exMeta(n).eq))].sort(), sh: U.ex(pl).filter(n => exMeta(n).st.includes('shoulders')), n: pl.map(d => d.slots.length), dose: [...new Set(pl.flatMap(d => d.slots.filter(s => !s.time).map(s => s.sets + 'x' + s.reps)))].sort() }; })()")
    check(r['days'] == ['Upper A', 'Lower A', 'Upper B', 'Lower B'], f'dumbbells, 4 days: upper / lower, got {r["days"]}')
    check(set(r['eq']) <= {'body', 'db'}, f'dumbbells only: no gym kit, got {r["eq"]}')
    check(not r['sh'], f'shoulder injury: nothing that loads the shoulders, got {r["sh"]}')
    check(all(x >= 5 for x in r['n']), f'dumbbells + shoulder injury still fills the days: {r["n"]}')
    check(set(r['dose']) <= {'3x8–12', '4x8–12'}, f'muscle: 3–4 sets of 8–12, got {r["dose"]}')

    # 3. full-gym advanced, 6 days
    r = J("(() => { const pl = generatePlan({ goal: 'strength', level: 'seasoned', equip: 'gym', mins: 90, avoid: [], wds: [1, 2, 3, 4, 5, 6] }); return { days: pl.map(d => d.title), n: pl.map(d => d.slots.length), main: pl.map(d => d.slots[0].sets + 'x' + d.slots[0].reps), acc: [...new Set(pl.flatMap(d => d.slots.filter(s => s.mv === 'iso').map(s => s.sets + 'x' + s.reps)))], gym: U.ex(pl).some(n => exMeta(n).eq === 'gym'), same: pl[0].slots.map(s => s.opts[0].n).join() === pl[3].slots.map(s => s.opts[0].n).join() }; })()")
    check(r['days'] == ['Push A', 'Pull A', 'Legs A', 'Push B', 'Pull B', 'Legs B'], f'6 days: push / pull / legs twice, got {r["days"]}')
    check(all(x == 8 for x in r['n']), f'90 min: 8 exercises a day, got {r["n"]}')
    check(all(m == '5x3–6' for m in r['main']), f'strength, advanced: main lifts 5 x 3–6, got {r["main"]}')
    check(r['acc'] == ['3x6–10'], f'strength accessories: 3 x 6–10, got {r["acc"]}')
    check(r['gym'] and not r['same'], 'full gym uses gym kit, and the B days differ from the A days')

    # the push day from the brief, at 30 min: heavy press, incline press, shoulder press or raise, triceps
    r = J("generatePlan({ goal: 'muscle', level: 'some', equip: 'gym', mins: 30, wds: [1,2,3,4,5] })[0].slots.map(s => [s.opts[0].n, exMeta(s.opts[0].n).mv, exMeta(s.opts[0].n).m])")
    check(len(r) == 4 and r[0][1] == 'hpush' and 'Incline' in r[1][0] and r[2][1] == 'vpush' and r[3][2] == 'triceps', f'30-min push day: press, incline, shoulder press, triceps; got {r}')
    r = J("[2,3,4,5,6].map(n => generatePlan({ wds: [1,2,3,4,5,6].slice(0, n) }).map(d => d.title).join('/'))")
    check(r == ['Full Body A/Full Body B', 'Full Body A/Full Body B/Full Body C', 'Upper A/Lower A/Upper B/Lower B', 'Push/Pull/Legs/Upper A/Lower B', 'Push A/Pull A/Legs A/Push B/Pull B/Legs B'], f'splits by days a week: {r}')

    # every combination of answers: never equipment they don't have, never an injured area, never too hard; swap options included
    r = J("""(() => { const bad = [], few = []; let plans = 0;
      const sub = xs => xs.reduce((a, x) => a.concat(a.map(s => [...s, x])), [[]]);
      for (const goal of ['strength', 'muscle', 'general', 'lean']) for (const level of ['new', 'some', 'seasoned']) for (const equip of ['gym', 'home', 'body'])
      for (const mins of [30, 45, 60, 90]) for (const days of [2, 3, 4, 5, 6]) for (const avoid of sub(['shoulders', 'lowerback', 'knees', 'wrists'])) {
        const a = { goal, level, equip, mins, avoid, wds: [1, 2, 3, 4, 5, 6].slice(0, days) }, pl = generatePlan(a); plans++;
        if (pl.length !== days) bad.push(['days', a]);
        for (const d of pl) { const lifts = d.slots.filter(s => s.mv);
          if (lifts.length > GEN_SLOTS[mins]) bad.push(['too many', a, d.title]);
          if (new Set(lifts.map(s => s.opts[0].n)).size !== lifts.length) bad.push(['repeat in a day', a, d.title]);
          if (lifts.length < 3) few.push([a, d.title, lifts.length]);
          for (const s of lifts) for (const o of s.opts) { const e = exMeta(o.n);
            if (!e || !KIT[equip].includes(e.eq)) bad.push(['equipment', o.n, a]);
            else if (e.st.some(x => avoid.includes(x))) bad.push(['injury', o.n, a]);
            else if (e.d > LVL[level].max) bad.push(['too hard', o.n, a]); } } }
      return { plans, bad: bad.slice(0, 5), nbad: bad.length, few: few.slice(0, 3), nfew: few.length }; })()""")
    check(r['nbad'] == 0, f"{r['nbad']} rule breaks across {r['plans']} plans, e.g. {r['bad']}")
    check(r['nfew'] == 0, f"{r['nfew']} days with fewer than 3 exercises, e.g. {r['few']}")
    print(f"  {r['plans']} plans checked")

    # 4. weight increase: every set at the top of the range → +2.5 kg upper, +5 kg lower, +1 kg dumbbell isolation (lb: 5 / 10 / 2.5)
    up = lambda n, u, w: J(f"progTarget([{{ sets: [{{ w: {w}, r: 12 }}, {{ w: {w}, r: 12 }}, {{ w: {w}, r: 12 }}] }}], '8–12', 3, {json.dumps(n)}, '{u}')")
    r = up('Flat Barbell Bench Press', 'kg', 60); check(r['w'] == 62.5 and r['dir'] == 'up' and r['why'] == 'you hit 12s last time', f'bench +2.5 kg: {r}')
    r = up('Barbell Back Squat', 'kg', 100); check(r['w'] == 105, f'squat +5 kg: {r}')
    r = up('DB Lateral Raise', 'kg', 8); check(r['w'] == 9, f'dumbbell isolation +1 kg: {r}')
    r = up('Flat Barbell Bench Press', 'lb', 135); check(r['w'] == 140, f'bench in lb +5: {r}')
    r = up('Romanian Deadlift', 'lb', 135); check(r['w'] == 145, f'RDL in lb +10: {r}')
    r = up('Some Leg Machine', 'kg', 50); check(r['w'] == 55, f'unknown lift named for legs counts as lower body: {r}')
    r = J("progTarget([{ sets: [{ w: 60, r: 12 }, { w: 60, r: 11 }, { w: 60, r: 12 }] }], '8–12', 3, 'Flat Barbell Bench Press', 'kg')")
    check(r['w'] == 60 and r['dir'] is None, f'one set short of the top: same weight, got {r}')
    r = J("progTarget([{ sets: [{ w: 60, r: 12 }, { w: 60, r: 12 }] }], '8–12', 3, 'Flat Barbell Bench Press', 'kg')")
    check(r['dir'] is None, f'not all sets done: no increase, got {r}')

    # 5. deload: missed the bottom of the range two sessions in a row → 10% off
    r = J("progTarget([{ sets: [{ w: 100, r: 6 }, { w: 100, r: 7 }, { w: 100, r: 8 }] }, { sets: [{ w: 100, r: 7 }, { w: 100, r: 6 }, { w: 100, r: 6 }] }], '8–12', 3, 'Barbell Back Squat', 'kg')")
    check(r['w'] == 90 and r['dir'] == 'down', f'two misses: 100 → 90 kg, got {r}')
    r = J("progTarget([{ sets: [{ w: 100, r: 9 }, { w: 100, r: 8 }, { w: 100, r: 8 }] }, { sets: [{ w: 100, r: 7 }, { w: 100, r: 9 }, { w: 100, r: 8 }] }], '8–12', 3, 'Barbell Back Squat', 'kg')")
    check(r['dir'] is None and r['w'] == 100, f'one miss: stay put, got {r}')

    # 6. three-week stall: swap for a similar exercise that still fits the person
    hist = lambda pts: json.dumps([{'t': t, 'sets': [{'w': w, 'r': rr}] * 3} for t, w, rr in pts])
    day = 864e5; now = 100 * day
    flat = hist([(now - 35 * day, 60, 10), (now - 28 * day, 60, 10), (now - 20 * day, 60, 10), (now - 13 * day, 60, 10), (now - 6 * day, 60, 9)])
    grow = hist([(now - 35 * day, 60, 10), (now - 28 * day, 60, 10), (now - 20 * day, 60, 11), (now - 13 * day, 62.5, 10), (now - 6 * day, 62.5, 11)])
    short = hist([(now - 15 * day, 60, 10), (now - 8 * day, 60, 10), (now - 1 * day, 60, 10)])
    check(J(f"stalled({flat}, {now})") is True, 'no progress for 3 weeks is a stall')
    check(J(f"stalled({grow}, {now})") is False, 'progress in the last 3 weeks is not a stall')
    check(J(f"stalled({short}, {now})") is False, 'under 3 weeks of history is not a stall')
    r = J("swapFor('Flat Barbell Bench Press', { equip: 'gym', level: 'some', avoid: [] })"); check(r and r['n'] == 'Flat Dumbbell Bench Press', f'bench stalls → its first similar exercise: {r and r["n"]}')
    r = J("swapFor('Flat Barbell Bench Press', { equip: 'home', level: 'some', avoid: ['shoulders'] })"); check(r and r['eq'] in ('body', 'db') and 'shoulders' not in r['st'], f'swap respects equipment and injuries: {r}')
    r = J("swapFor('Barbell Back Squat', { equip: 'gym', level: 'some', avoid: [] }, ['Leg Press (feet high & wide)'])"); check(r and r['n'] == 'Hack Squat', f'swap skips what the day already has: {r and r["n"]}')
    b.close()
for f in fails: print('FAIL', f)
print('OK plan' if not fails else f'{len(fails)} failed')
raise SystemExit(1 if fails else 0)

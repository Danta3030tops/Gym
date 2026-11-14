"""Smoke test: loads the app with seeded data and a mock Supabase, removes/adds an exercise.
Run from the repo root:
  python3 -m http.server 8765 &        # serve the app
  pip install playwright && playwright install chromium
  python3 dev/tests/smoke.py
The mock (mock.js) replaces window.supabase, so nothing touches the real database.
It covers gym_state / gym_public / realtime only; extend it for gym_messages if you test chat."""
import json, os
from playwright.sync_api import sync_playwright
here = os.path.dirname(os.path.abspath(__file__))
seed = json.load(open(os.path.join(here, 'seed.json'))); mock = open(os.path.join(here, 'mock.js')).read()
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, service_workers='block')
    ctx.add_init_script(mock); ctx.route('**/@supabase/**', lambda r: r.abort())
    errs = []; A = ctx.new_page(); A.on('pageerror', lambda e: errs.append(str(e)))
    A.goto('http://localhost:8765/')
    A.evaluate("s=>{localStorage.clear();localStorage.setItem('gym.v2.king',JSON.stringify(s.king));localStorage.setItem('gym.v2.qxeen',JSON.stringify(s.qxeen));}", seed)
    A.reload(); A.wait_for_timeout(800)          # the profile picker needs ~500ms before it renders
    A.click('[data-prof="king"]'); A.wait_for_timeout(1600)
    names = lambda: A.evaluate("DAYS[cur].slots.map((s,i)=>exOf(cur,i).n+'#'+s.k)")
    start = names(); print('start', start)
    A.click('[data-exc="-1"]'); A.wait_for_timeout(500)
    A.click('[data-exrm="1"]'); A.wait_for_timeout(600)
    assert len(names()) == len(start) - 1, 'remove failed'
    A.click('[data-exc="1"]'); A.wait_for_timeout(500)
    A.click('[data-exadd="1"]'); A.wait_for_timeout(600)
    assert names() == start, 'add back failed'
    for t in ['history', 'body', 'fuel', 'chat', 'more', 'workout']:
        A.click(f'nav button[data-tab="{t}"]'); A.wait_for_timeout(400)
    A.screenshot(path=os.path.join(here, 'last-run.png'))
    assert not errs, errs
    print('OK'); b.close()

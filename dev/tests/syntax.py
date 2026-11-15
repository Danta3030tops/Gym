"""Parse-check JavaScript files without Node: python3 dev/tests/syntax.py public/app.js public/extras.js
Prints OK or the syntax error for each file. Needs Playwright (same as the smoke tests). Does not run the code."""
import sys
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(); bad = 0
    for f in sys.argv[1:]:
        r = pg.evaluate("src => { try { new Function(src); return 'OK'; } catch (e) { return 'SYNTAX ERROR: ' + e.message; } }", open(f).read())
        print(f, r); bad += r != 'OK'
    b.close(); sys.exit(1 if bad else 0)

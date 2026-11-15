import sys, os
from playwright.sync_api import sync_playwright
out = sys.argv[1]
DEFS = '''<defs>
<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffc24a"/><stop offset=".55" stop-color="#ff9500"/><stop offset="1" stop-color="#f26a00"/></linearGradient>
<radialGradient id="glow" cx=".28" cy=".12" r=".9"><stop offset="0" stop-color="#fff" stop-opacity=".42"/><stop offset=".45" stop-color="#fff" stop-opacity=".06"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
<linearGradient id="gl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity=".86"/></linearGradient>
<linearGradient id="gl2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".62"/><stop offset="1" stop-color="#fff" stop-opacity=".34"/></linearGradient>
<filter id="sh" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="14" stdDeviation="18" flood-color="#8a3a00" flood-opacity=".38"/></filter>
</defs><rect width="1024" height="1024" fill="url(#bg)"/><rect width="1024" height="1024" fill="url(#glow)"/>'''
G = {
 # A: a bar with a spot above it: reads as a person under the bar, and as "spot"
 'a': '''<g filter="url(#sh)" fill="url(#gl)"><circle cx="512" cy="372" r="92"/>
   <rect x="262" y="560" width="500" height="60" rx="30"/>
   <rect x="296" y="478" width="76" height="224" rx="38"/><rect x="652" y="478" width="76" height="224" rx="38"/>
   <rect x="196" y="520" width="64" height="140" rx="32" fill="url(#gl2)"/><rect x="764" y="520" width="64" height="140" rx="32" fill="url(#gl2)"/></g>''',
 # B: two overlapping glass discs: you and your spotter (and two plates)
 'b': '''<g filter="url(#sh)"><circle cx="408" cy="512" r="218" fill="url(#gl2)"/><circle cx="616" cy="512" r="218" fill="url(#gl2)"/>
   <path d="M512 320.3A218 218 0 0 1 512 703.7A218 218 0 0 1 512 320.3Z" fill="url(#gl)"/></g>
   <circle cx="408" cy="512" r="218" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="5"/><circle cx="616" cy="512" r="218" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="5"/>''',
 # C: S monogram, one thick round stroke
 'c': '''<g filter="url(#sh)"><path d="M672 372C640 268 372 250 366 404C360 548 664 470 658 628C652 776 392 762 350 652" fill="none" stroke="url(#gl)" stroke-width="104" stroke-linecap="round" stroke-linejoin="round"/></g>''',
}
if len(sys.argv) > 3: G = {sys.argv[3]: G[sys.argv[3]]}
svgs = {k: f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">{DEFS}{v}</svg>' for k, v in G.items()}
for k, s in svgs.items(): open(os.path.join(out, f'logo-{k}.svg'), 'w').write(s)
mode = sys.argv[2] if len(sys.argv) > 2 else 'preview'
with sync_playwright() as p:
    b = p.chromium.launch()
    if mode == 'preview':
        pg = b.new_page(viewport={'width': 1180, 'height': 520}, device_scale_factor=1)
        cells = ''.join(f'<div style="text-align:center;font:600 26px -apple-system,Helvetica;color:#ddd"><div style="width:300px;height:300px;border-radius:68px;overflow:hidden;margin:0 0 14px;box-shadow:0 20px 50px rgba(0,0,0,.5)">{s}</div>{k.upper()}<div style="margin:18px auto 0;width:64px;height:64px;border-radius:15px;overflow:hidden">{s}</div></div>' for k, s in svgs.items())
        pg.set_content(f'<body style="margin:0;background:#111;display:flex;gap:70px;justify-content:center;align-items:center;height:520px">{cells}</body>')
        pg.screenshot(path=os.path.join(out, 'preview.png'))
    else:  # export PNGs for one logo: name:size:pad
        k = list(svgs)[0]
        for name, size, scale in [('icon-192.png', 192, 1), ('icon-512.png', 512, 1), ('apple-touch-icon.png', 180, 1), ('maskable-512.png', 512, .8)]:
            pg = b.new_page(viewport={'width': size, 'height': size}, device_scale_factor=1)
            inner = svgs[k] if scale == 1 else svgs[k].replace(DEFS, DEFS + f'<g transform="translate(512 512) scale({scale}) translate(-512 -512)">').replace('</svg>', '</g></svg>')
            pg.set_content(f'<body style="margin:0"><div style="width:{size}px;height:{size}px">{inner}</div></body>'); pg.screenshot(path=os.path.join(out, name)); pg.close()
    b.close()

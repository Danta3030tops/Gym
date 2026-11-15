/* Public Gym app: shared helpers, theme, local state. Loaded first. */
'use strict';
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let toastT;
function toast(msg, ms = 2600) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms); }

/* ---------- theme: one accent colour per person, light / dark / auto ---------- */
const ACCENTS = [['#ff9f0a', 'Orange'], ['#bf5af2', 'Violet'], ['#0a84ff', 'Blue'], ['#30d158', 'Green'], ['#ff375f', 'Pink'], ['#64d2ff', 'Teal'], ['#ffd60a', 'Yellow'], ['#ff453a', 'Red']];
const hexRgb = h => { const n = parseInt(String(h).replace('#', ''), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const rgbHex = a => '#' + a.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const mix = (h, to, t) => rgbHex(hexRgb(h).map((v, i) => v + (to[i] - v) * t));
const luma = h => { const [r, g, b] = hexRgb(h); return (r * 299 + g * 587 + b * 114) / 1000; };
function themeFor(color, mode) {
  const c = /^#[0-9a-f]{6}$/i.test(color || '') ? color : ACCENTS[0][0], [r, g, b] = hexRgb(c);
  const onacc = luma(c) > 150 ? '#1c1100' : '#ffffff';
  if (mode === 'light') {
    const acc = mix(c, [0, 0, 0], .06);
    return { bg: '#f4f3f7', card: '#ffffff', card2: 'rgba(60,60,67,.06)', line: 'rgba(60,60,67,.14)', txt: '#000000', mut: 'rgba(60,60,67,.64)', acc, acc2: mix(c, [0, 0, 0], .32), onacc, dim: '#cdcad2', limb: '#8e8e93', navbg: 'rgba(255,255,255,.62)', bannerbg: `linear-gradient(135deg,rgba(${r},${g},${b},.2),rgba(${r},${g},${b},.06))`, bannerline: `rgba(${r},${g},${b},.3)` };
  }
  return { bg: '#000000', card: 'rgba(255,255,255,.07)', card2: 'rgba(255,255,255,.1)', line: 'rgba(255,255,255,.1)', txt: '#ffffff', mut: 'rgba(235,235,245,.62)', acc: c, acc2: mix(c, [255, 255, 255], .32), onacc, dim: '#48484a', limb: '#8e8e93', navbg: 'rgba(40,40,44,.55)', bannerbg: `linear-gradient(135deg,rgba(${r},${g},${b},.24),rgba(${r},${g},${b},.07))`, bannerline: `rgba(${r},${g},${b},.32)` };
}
const lightMQ = window.matchMedia ? matchMedia('(prefers-color-scheme: light)') : null;
let TH = themeFor(ACCENTS[0][0], 'dark'), themeColor = localStorage.getItem('gymp.color') || ACCENTS[0][0], appearance = localStorage.getItem('gymp.appearance') || 'auto';
const resolveMode = () => appearance === 'auto' ? (lightMQ && lightMQ.matches ? 'light' : 'dark') : appearance;
function applyTheme(color) {
  if (color) { themeColor = color; try { localStorage.setItem('gymp.color', color); } catch (e) { } }
  const mode = resolveMode(), root = document.documentElement; TH = themeFor(themeColor, mode);
  root.dataset.mode = mode; root.style.colorScheme = mode;
  for (const k in TH) root.style.setProperty('--' + k, TH[k]);
  document.querySelector('meta[name=theme-color]').setAttribute('content', TH.bg);
}
if (lightMQ && lightMQ.addEventListener) lightMQ.addEventListener('change', () => { if (appearance === 'auto') applyTheme(); });
applyTheme();

/* ---------- local state: one blob per signed-in user, synced to app_state ---------- */
const blankState = () => ({ v: 3, settings: { unit: 'lb', swaps: {}, targets: {}, tempoScale: 1, wake: true, u: 0 }, logs: {}, body: {}, photos: {}, fuel: {}, updated: 0 });
const stateKey = uid => 'gymp.v1.' + uid;
function loadLocal(uid) { try { const d = JSON.parse(localStorage.getItem(stateKey(uid)) || 'null'); return d ? { ...blankState(), ...d, settings: { ...blankState().settings, ...(d.settings || {}) } } : blankState(); } catch (e) { return blankState(); } }
function saveLocal(uid, st) { st.updated = Date.now(); try { localStorage.setItem(stateKey(uid), JSON.stringify(st)); } catch (e) { toast('Phone storage is full'); } }
const initials = n => { const p = String(n || '?').trim().split(/\s+/); return ((p[0] || '?')[0] + (p[1] ? p[1][0] : (p[0] || '')[1] || '')).toUpperCase(); };

/* ---------- never trust data other people can write ----------
   A friend's summary, a client's routine and a coach's edits all arrive as free-form JSON that the other person controls.
   Numbers are forced to numbers and text is cut to size here, at the door; text is still esc()'d wherever it is shown. */
const safeN = v => Math.max(0, Math.floor(+v) || 0);
function cleanRoutine(r) {
  if (!Array.isArray(r)) return r == null ? null : [];
  const str = (v, n) => String(v ?? '').slice(0, n), okPat = k => typeof P !== 'undefined' && typeof k === 'string' && Object.hasOwn(P, k);
  return r.filter(d => d && Array.isArray(d.slots)).slice(0, 7).map((d, di) => ({ ...d, d: str(d.d, 12), title: str(d.title, 60), wd: Math.min(7, Math.max(1, safeN(d.wd) || di + 1)),
    slots: d.slots.filter(sl => sl && Array.isArray(sl.opts) && sl.opts.some(Boolean)).slice(0, 20).map(sl => {
      const o = { ...sl, sets: Math.min(10, Math.max(1, safeN(sl.sets) || 1)), reps: str(sl.reps, 30), rest: Math.min(3600, safeN(sl.rest)),
        opts: sl.opts.filter(Boolean).slice(0, 12).map(x => ({ n: str(x.n, 80), pat: okPat(x.pat) ? x.pat : 'squat', cues: (Array.isArray(x.cues) ? x.cues : []).slice(0, 8).map(c => str(c, 200)) })) };
      if (sl.time) o.time = Math.min(7200, safeN(sl.time)); else delete o.time;
      return o;
    }) }));
}

/* Public Gym app: sign in, create account, password reset, and loading the signed-in person's profile.
   Accounts are a username (public handle, how friends find you) plus a real email (sign-in and password reset) and a password. */
'use strict';
const CFG = window.GYM_PUBLIC_CONFIG || {};
let sb = null, session = null, ME = null, ROUTINE = null, S = blankState();
const USER_RE = /^[a-z0-9_.]{3,20}$/, EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const AU = { mode: 'in', role: 'user', busy: false, nameT: null, nameOk: null, nameFor: '' };

const AU_COPY = {
  in: ['Welcome back', 'Sign in to pick up where you left off.'],
  up: ['Create your account', 'Track your training, add friends, or coach clients.'],
  forgot: ['Reset your password', 'Enter your email and we’ll send you a link to set a new one.'],
  newpw: ['Choose a new password', 'You’re almost back in.'],
  check: ['Check your email', '']
};
function showAuth(mode, note) {
  AU.mode = mode || 'in'; AU.busy = false;
  document.body.classList.add('out'); $('onb').classList.remove('show'); $('auth').classList.add('show');
  const [title, sub] = AU_COPY[AU.mode]; $('auTitle').textContent = title; $('auSub').textContent = sub;
  $('auSeg').classList.toggle('hide', !(AU.mode === 'in' || AU.mode === 'up'));
  document.querySelectorAll('[data-aumode]').forEach(b => b.classList.toggle('on', b.dataset.aumode === AU.mode));
  const f = $('auForm'), err = `<div class="au-err ${note && note.ok ? 'ok' : ''}" id="auErr" role="alert">${esc(note ? note.text : '')}</div>`;
  if (!sb) { f.innerHTML = `<div class="banner">⚙️ <b>Not connected yet.</b> This app needs its Supabase project URL and key in <b>config.js</b> before anyone can sign in.</div>`; $('auFoot').textContent = ''; return; }
  if (AU.mode === 'in') f.innerHTML = `<div class="grp">
      <label><span>Login</span><input id="auEmail" type="text" inputmode="email" autocomplete="username" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Email or username"></label>
      <label><span>Password</span><input id="auPass" type="password" autocomplete="current-password" placeholder="Your password"></label></div>
    ${err}<button class="au-go" id="auGo">Sign in</button><button type="button" class="au-link" data-aumode="forgot">Forgot password?</button>`;
  else if (AU.mode === 'up') f.innerHTML = `<div class="grp">
      <label><span>Username</span><input id="auUser" autocomplete="username" autocapitalize="off" autocorrect="off" spellcheck="false" maxlength="20" placeholder="how friends find you"><i class="st" id="auUserSt"></i></label>
      <label><span>Email</span><input id="auEmail" type="email" inputmode="email" autocomplete="email" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="you@example.com"></label>
      <label><span>Password</span><input id="auPass" type="password" autocomplete="new-password" placeholder="8 or more characters"></label></div>
    <div class="au-hint" id="auHint">3–20 characters: lowercase letters, numbers, dots and underscores.</div>
    <div class="au-lbl">I’m here to</div>
    <div class="pick">${[['user', '🏃', 'Train', 'Log workouts and train with friends'], ['trainer', '📋', 'Coach', 'Everything above, plus clients']].map(([k, ic, t, s]) => `<button type="button" class="pk ${AU.role === k ? 'on' : ''}" data-role="${k}"><i>${ic}</i><b>${t}</b><span>${s}</span></button>`).join('')}</div>
    ${err}<button class="au-go" id="auGo">Create account</button>`;
  else if (AU.mode === 'forgot') f.innerHTML = `<div class="grp"><label><span>Email</span><input id="auEmail" type="email" inputmode="email" autocomplete="email" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="you@example.com"></label></div>
    ${err}<button class="au-go" id="auGo">Send reset link</button><button type="button" class="au-link" data-aumode="in">Back to sign in</button>`;
  else if (AU.mode === 'newpw') f.innerHTML = `<div class="grp"><label><span>Password</span><input id="auPass" type="password" autocomplete="new-password" placeholder="8 or more characters"></label></div>
    ${err}<button class="au-go" id="auGo">Save password</button>`;
  else f.innerHTML = `${err}<button type="button" class="au-go" data-aumode="in">Back to sign in</button>`;
  $('auFoot').textContent = AU.mode === 'up' ? 'Your email is only used to sign in and to reset your password. Other people see your username, never your email.' : '';
}
function auErr(text, ok) { const e = $('auErr'); if (e) { e.textContent = text || ''; e.classList.toggle('ok', !!ok); } }
function auBusy(on, label) { AU.busy = on; const b = $('auGo'); if (b) { b.disabled = on; if (label) b.textContent = label; } }
const authMsg = m => /invalid login/i.test(m) ? 'Wrong email or password.'
  : /already registered|already exists/i.test(m) ? 'That email already has an account. Sign in instead.'
  : /not confirmed/i.test(m) ? 'Confirm your email first: tap the link we sent you, then sign in.'
  : /database error|duplicate|unique/i.test(m) ? 'That username was just taken. Pick another.'
  : /rate limit|too many/i.test(m) ? 'Too many tries. Wait a minute and try again.'
  : /fetch|network|failed to/i.test(m) ? 'Can’t reach the server. Check your connection and try again.'
  : (m || 'Something went wrong. Try again.');

/* Username sign-in goes through the "login" server function, which looks the email up on the server: emails never reach a browser. */
async function signInByUsername(login, password) {
  const r = await sb.functions.invoke('login', { body: { login, password } }).then(x => x, e => ({ data: null, error: e }));
  if (r.data && r.data.access_token) return sb.auth.setSession({ access_token: r.data.access_token, refresh_token: r.data.refresh_token });
  let msg = r.data && r.data.error;
  if (!msg && r.error && r.error.context && r.error.context.json) msg = await r.error.context.json().then(b => b && b.error, () => null);
  return { data: {}, error: { message: msg || 'Username sign-in isn’t available right now. Use your email instead.' } };
}

/* live "is this username free?" check while typing */
function checkUsername() {
  const v = $('auUser').value = $('auUser').value.toLowerCase().replace(/\s/g, ''), st = $('auUserSt');
  clearTimeout(AU.nameT); AU.nameOk = null; AU.nameFor = v; st.className = 'st'; st.textContent = '';
  if (!v) return;
  if (!USER_RE.test(v)) { st.className = 'st bad'; st.textContent = v.length < 3 ? 'Too short' : 'Not allowed'; AU.nameOk = false; return; }
  st.textContent = '…';
  AU.nameT = setTimeout(async () => {
    const { data, error } = await sb.rpc('app_username_free', { u: v }).then(r => r, () => ({ error: true }));
    if (AU.nameFor !== v || !$('auUserSt')) return; // they kept typing, or left the form
    if (error) { $('auUserSt').textContent = ''; return; } // can't check right now: sign-up itself still enforces it
    AU.nameOk = !!data; $('auUserSt').className = 'st ' + (data ? 'ok' : 'bad'); $('auUserSt').textContent = data ? '✓ Free' : 'Taken';
  }, 350);
}

async function submitAuth() {
  if (AU.busy || !sb) return;
  const val = id => ($(id) ? $(id).value : '').trim(), email = val('auEmail').toLowerCase(), pass = $('auPass') ? $('auPass').value : '';
  auErr('');
  try {
    if (AU.mode === 'in') {
      if (!EMAIL_RE.test(email) && !USER_RE.test(email)) return auErr('Enter your email or username.');
      if (!pass) return auErr('Enter your password.');
      auBusy(true, 'Signing in…');
      const { data, error } = EMAIL_RE.test(email) ? await sb.auth.signInWithPassword({ email, password: pass }) : await signInByUsername(email, pass);
      if (error) { auBusy(false, 'Sign in'); return auErr(authMsg(error.message)); }
      session = data.session; await enter();
    } else if (AU.mode === 'up') {
      const username = val('auUser').toLowerCase();
      if (!USER_RE.test(username)) return auErr('Pick a username: 3–20 lowercase letters, numbers, dots or underscores.');
      if (AU.nameOk === false && AU.nameFor === username) return auErr('That username is taken. Pick another.');
      if (!EMAIL_RE.test(email)) return auErr('Enter a real email, so you can reset your password if you forget it.');
      if (pass.length < 8) return auErr('Use a password with 8 or more characters.');
      auBusy(true, 'Creating account…');
      const free = await sb.rpc('app_username_free', { u: username }).then(r => r, () => ({ error: true }));
      if (!free.error && free.data === false) { auBusy(false, 'Create account'); return auErr('That username is taken. Pick another.'); }
      const { data, error } = await sb.auth.signUp({ email, password: pass, options: { data: { username, display_name: username, role: AU.role }, emailRedirectTo: location.origin + location.pathname } });
      if (error) { auBusy(false, 'Create account'); return auErr(authMsg(error.message)); }
      if (!data.session) return showAuth('check', { ok: true, text: `We sent a confirmation link to ${email}. Tap it, then come back and sign in.` });
      session = data.session; await enter();
    } else if (AU.mode === 'forgot') {
      if (!EMAIL_RE.test(email)) return auErr('Enter the email you signed up with.');
      auBusy(true, 'Sending…');
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
      if (error) { auBusy(false, 'Send reset link'); return auErr(authMsg(error.message)); }
      showAuth('check', { ok: true, text: `If ${email} has an account, a reset link is on its way. Open it on this phone.` });
    } else if (AU.mode === 'newpw') {
      if (pass.length < 8) return auErr('Use a password with 8 or more characters.');
      auBusy(true, 'Saving…');
      const { error } = await sb.auth.updateUser({ password: pass });
      if (error) { auBusy(false, 'Save password'); return auErr(authMsg(error.message)); }
      toast('✅ Password changed'); await enter();
    }
  } catch (e) { auBusy(false); showAuth(AU.mode, { text: authMsg(String(e && e.message || e)) }); }
}
$('auth').addEventListener('click', e => {
  const m = e.target.closest('[data-aumode]'); if (m) return showAuth(m.dataset.aumode);
  const r = e.target.closest('[data-role]'); if (r) { AU.role = r.dataset.role; document.querySelectorAll('[data-role]').forEach(b => b.classList.toggle('on', b === r)); }
});
$('auForm').addEventListener('submit', e => { e.preventDefault(); submitAuth(); });
$('auForm').addEventListener('input', e => { if (e.target.id === 'auUser') checkUsername(); });

/* ---------- after sign-in: load profile + routine, then first-time setup or the app ---------- */
const cacheGet = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
const cacheSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } };
async function enter() {
  const uid = session.user.id; let prof = null, rt, offline = false;
  try {
    const a = await sb.from('app_profiles').select('*').eq('id', uid).maybeSingle(); if (a.error) throw a.error; prof = a.data;
    const b = await sb.from('app_routines').select('routine').eq('user_id', uid).maybeSingle(); if (b.error) throw b.error; rt = b.data;
  } catch (e) { offline = true; prof = cacheGet('gymp.me.' + uid); const c = cacheGet('gymp.routine.' + uid); rt = c ? { routine: c.routine } : null; }
  if (!prof) return showAuth('in', { text: offline ? 'Can’t reach the server. Check your connection and try again.' : 'Your profile is missing. Sign in again, or create a new account.' });
  ME = prof; ROUTINE = rt ? cleanRoutine(rt.routine) : null; MEALS = rt ? mealsOf(rt.routine) : null; S = loadLocal(uid);
  if (!offline) { cacheSet('gymp.me.' + uid, prof); if (rt) cacheSet('gymp.routine.' + uid, { routine: rt.routine }); }
  applyTheme(prof.color);
  $('auth').classList.remove('show');
  if (!rt && !offline) startOnboarding(); else showHome();
}
/* hand over to the app (public/app.js) */
function showHome() { $('onb').classList.remove('show'); $('auth').classList.remove('show'); startApp(); }
document.addEventListener('click', async e => {
  if (e.target.closest('#signOut')) { stopApp(); await sb.auth.signOut().catch(() => { }); session = null; ME = null; ROUTINE = null; MEALS = null; S = blankState(); showAuth('in'); }
});

(async function initAuth() {
  if (CFG.supabaseUrl && CFG.supabaseAnonKey && window.supabase && window.supabase.createClient) {
    try { sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'gymp-auth' } }); } catch (e) { sb = null; }
  }
  if (!sb) return showAuth('in');
  sb.auth.onAuthStateChange((ev, s) => {
    if (ev === 'PASSWORD_RECOVERY') { session = s; showAuth('newpw'); }
    else if (ev === 'SIGNED_OUT') { session = null; if (ME) { stopApp(); ME = null; ROUTINE = null; MEALS = null; S = blankState(); showAuth('in'); } }
    else if (s) session = s; // token refreshes
  });
  const { data } = await sb.auth.getSession().catch(() => ({ data: {} }));
  session = data && data.session || null;
  if ($('auth').classList.contains('show') && AU.mode === 'newpw') return; // arrived from a reset link
  if (session) await enter(); else showAuth('in');
})();

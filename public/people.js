/* ================= profile pictures + group invite links =================
   Both need dev/public-version/supabase-public-update-3.sql. Until it has been run the profile has no "avatar"
   field and a chat has no "invite" field, and this file shows nothing new (HAS_AV / glHas below).
   avUrl() and frAv() live in friends.js so every avatar in the app picks the picture up. */
const HAS_AV = () => !!ME && 'avatar' in ME;

/* ---------- profile picture: pick, shrink to a 320px square JPEG, upload, point the profile at it ---------- */
const AV = { busy: false };
document.body.insertAdjacentHTML('beforeend', '<input type="file" accept="image/*" id="avInput" hidden>');
function avSheet() {
  if (!HAS_AV()) return;
  openSheet(`<h3>Profile picture</h3><div class="sub">Friends, group chats and your coach see it next to your name.</div>
    <div class="avbig">${frAv(ME)}</div>
    <button class="btn acc" data-avpick>${ME.avatar ? 'Choose a new photo' : 'Choose a photo'}</button>
    ${ME.avatar ? '<button class="btn ghost" data-avrm style="color:#ff453a">Remove photo</button>' : ''}`);
}
async function avSquare(file) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => createImageBitmap(file));
  const s = Math.min(bmp.width, bmp.height), c = document.createElement('canvas'); c.width = c.height = 320;
  c.getContext('2d').drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, 320, 320);
  return new Promise(r => c.toBlob(r, 'image/jpeg', .85));
}
async function avSet(path) { // path '' removes it
  const id = uid(), old = ME.avatar;
  const { error } = await sb.from('app_profiles').update({ avatar: path }).eq('id', id).then(r => r, e => ({ error: e }));
  if (error) return false;
  if (uid() !== id) return true;
  ME.avatar = path; cacheSet('gymp.me.' + id, ME);
  if (old && old !== path && old.startsWith(id + '/')) sb.storage.from('app-avatars').remove([old]).then(() => { }, () => { }); // tidy up; no harm if it stays
  return true;
}
async function avUpload(file) {
  if (AV.busy || !file || !HAS_AV()) return;
  if (!sb || !navigator.onLine) return toast('You’re offline. Try again when you’re connected.', 3500);
  AV.busy = true; toast('Saving your picture…', 8000);
  try {
    const blob = await avSquare(file); if (!blob) throw 0;
    const path = uid() + '/' + Date.now() + '.jpg';
    const up = await sb.storage.from('app-avatars').upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' }); if (up.error) throw up.error;
    if (!await avSet(path)) throw 0;
    toast('Profile picture updated'); closeSheet(); renderAll();
  } catch (e) { toast('Couldn’t save that picture. Try a different photo.', 3500); }
  AV.busy = false;
}
$('avInput').onchange = e => { const f = e.target.files[0]; e.target.value = ''; avUpload(f); };
document.addEventListener('click', async e => {
  if (appOff()) return;
  if (e.target.closest('#avPick')) return avSheet();
  if (e.target.closest('[data-avpick]')) return $('avInput').click();
  if (e.target.closest('[data-avrm]')) {
    if (AV.busy || !sb || !navigator.onLine) return toast('You’re offline. Try again when you’re connected.', 3500);
    AV.busy = true; const ok = await avSet(''); AV.busy = false;
    if (!ok) return toast('Couldn’t remove it. Try again in a moment.', 3500);
    toast('Profile picture removed'); closeSheet(); renderAll();
  }
});
const _pplRenderMore = renderMore;
renderMore = function () { // the avatar at the top of Settings becomes the button that changes it
  _pplRenderMore(); const av = document.querySelector('#more .hello .lv-av'); if (!av || !HAS_AV()) return;
  av.outerHTML = `<button class="avbtn" id="avPick" aria-label="Change your profile picture">${frAv(ME)}<i>Edit</i></button>`;
};

/* ---------- group invite links ---------- */
const GL_RE = /^[0-9a-f]{32}$/, GL_KEY = 'gymp.join';
const glHas = c => !!c && 'invite' in c;
const glUrl = tok => location.origin + location.pathname + '?g=' + tok;
const _pplInfoSheet = chInfoSheet;
chInfoSheet = function () {
  _pplInfoSheet(); const c = chConv(CH.open), at = document.querySelector('#sheetin [data-chleave]'); if (!at || !glHas(c)) return;
  const on = typeof c.invite === 'string' && GL_RE.test(c.invite);
  at.insertAdjacentHTML('beforebegin', `<h3 style="margin-top:16px">Invite link</h3>` + (on
    ? `<div class="muted">Anyone on Spott who has this link can join the group and read its messages.</div>
       <input class="glink" id="glUrl" readonly value="${esc(glUrl(c.invite))}" aria-label="Invite link">
       <div class="grid2"><button class="btn acc" data-glshare>Share link</button><button class="btn" data-glnew>Replace link</button></div>
       <button class="btn ghost" data-gloff>Turn the link off</button>`
    : `<div class="muted">Make a link you can send to people. Anyone on Spott who opens it can join this group.</div>
       <button class="btn" data-glon>Create invite link</button>`));
};
async function glSet(fn, args, okMsg) {
  const cid = CH.open; if (!cid || CH.busy || !sb || !navigator.onLine) return toast('You’re offline. Try again when you’re connected.', 3500);
  CH.busy = true; const r = await chRpc(fn, args(cid)); CH.busy = false;
  if (r.error) return toast('Couldn’t change the link. Try again in a moment.', 3500);
  const c = chConv(cid); if (c) c.invite = fn === 'app_group_link_off' ? null : r.data;
  toast(okMsg); if (CH.open === cid) chInfoSheet();
}
async function glShare() {
  const c = chConv(CH.open); if (!c || !c.invite) return; const url = glUrl(c.invite), title = 'Join ' + (c.title || 'my group') + ' on Spott';
  try { if (navigator.share) { await navigator.share({ title, text: title, url }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(url); toast('Link copied'); } catch (e) { const el = $('glUrl'); if (el) { el.focus(); el.select(); } toast('Copy the link above', 3500); }
}
document.addEventListener('click', e => {
  if (appOff()) return; const t = e.target.closest('[data-glon],[data-glnew],[data-gloff],[data-glshare],[data-gljoin],[data-glno],#glUrl'); if (!t) return;
  if (t.id === 'glUrl') return t.select();
  if (t.dataset.glon !== undefined) return glSet('app_group_link', c => ({ c, fresh: false }), 'Invite link created');
  if (t.dataset.glnew !== undefined) return glSet('app_group_link', c => ({ c, fresh: true }), 'New link made. The old one no longer works.');
  if (t.dataset.gloff !== undefined) return glSet('app_group_link_off', c => ({ c }), 'Invite link turned off');
  if (t.dataset.glshare !== undefined) return glShare();
  if (t.dataset.glno !== undefined) { glForget(); return closeSheet(); }
  if (t.dataset.gljoin !== undefined) return glJoin();
});

/* opening an invite link: remember the code, drop it from the address bar, and ask once the person is signed in and set up */
const GL = { tok: null, asked: false, busy: false };
const glForget = () => { GL.tok = null; try { localStorage.removeItem(GL_KEY); } catch (e) { } };
try {
  const q = new URLSearchParams(location.search), g = q.get('g');
  if (g !== null) { if (GL_RE.test(g)) localStorage.setItem(GL_KEY, g); q.delete('g'); history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash); }
  const s = localStorage.getItem(GL_KEY); if (s && GL_RE.test(s)) GL.tok = s; else if (s) localStorage.removeItem(GL_KEY);
} catch (e) { }
async function glAsk() {
  if (!GL.tok || GL.asked || GL.busy || appOff() || !sb || !navigator.onLine || $('sheet').classList.contains('show')) return;
  GL.busy = true; const tok = GL.tok, r = await chRpc('app_group_peek', { tok }); GL.busy = false;
  if (appOff() || GL.tok !== tok) return;
  if (r.error) { GL.asked = true; return; } // links not switched on in the database yet, or a hiccup: ask again next launch
  const g = (r.data || [])[0]; GL.asked = true;
  if (!g) { glForget(); return toast('That invite link no longer works.', 4000); }
  if (g.joined) { glForget(); await loadChats(); showTab('friends'); return openChat(g.id); }
  const n = Math.max(1, +g.members || 1);
  openSheet(`<h3>Join this group?</h3><div class="sub">You opened an invite link.</div>
    <div class="card" style="margin:10px 0"><b style="font-size:18px">${esc(g.title || 'Group chat')}</b><div class="muted">${n} ${n === 1 ? 'person' : 'people'} in it</div></div>
    <div class="muted">Everyone in the group will see your name and what you post there.</div>
    <button class="btn acc" data-gljoin>Join group</button><button class="btn ghost" data-glno>Not now</button>`);
}
async function glJoin() {
  if (!GL.tok || GL.busy) return; if (!sb || !navigator.onLine) return toast('You’re offline. Try again when you’re connected.', 3500);
  GL.busy = true; const r = await chRpc('app_group_join', { tok: GL.tok }); GL.busy = false;
  if (r.error) { const full = /full/i.test(r.error.message || ''); if (!full) glForget(); closeSheet(); return toast(full ? 'That group is full.' : 'That invite link no longer works.', 4000); }
  glForget(); closeSheet(); await loadChats(); showTab('friends'); openChat(r.data); toast('You joined the group');
}
if (GL.tok) { const iv = setInterval(() => { if (!GL.tok || GL.asked) return clearInterval(iv); glAsk(); }, 900); }

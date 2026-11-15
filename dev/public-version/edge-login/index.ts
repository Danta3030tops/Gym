// Supabase Edge Function "login": sign in with a username OR an email, plus the password.
// The username → email lookup happens here on the server, so nobody's email is ever sent to a browser.
// Deploy in the Gym Public project: Edge Functions → Deploy a new function → Via Editor → name it "login" → paste this file.
// In the function's settings turn OFF "Verify JWT" (the app calls it before anyone is signed in).
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided to every function automatically.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const BAD = { error: 'Invalid login credentials' }; // same answer for "no such user" and "wrong password": never reveal which

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  let login = '', password = '';
  try { const b = await req.json(); login = String(b.login ?? '').trim().toLowerCase(); password = String(b.password ?? ''); } catch { return json(BAD, 400); }
  if (!login || !password || login.length > 254 || password.length > 200) return json(BAD, 400);

  const url = Deno.env.get('SUPABASE_URL')!;
  let email = login;
  if (!login.includes('@')) {
    if (!/^[a-z0-9_.]{3,20}$/.test(login)) return json(BAD, 400);
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: prof } = await admin.from('app_profiles').select('id').eq('username', login).maybeSingle();
    if (!prof) return json(BAD, 400);
    const { data: u } = await admin.auth.admin.getUserById(prof.id);
    if (!u?.user?.email) return json(BAD, 400);
    email = u.user.email;
  }
  const anon = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await anon.auth.signInWithPassword({ email, password });
  if (error || !data.session) return json({ error: /not confirmed/i.test(error?.message ?? '') ? 'Email not confirmed' : BAD.error }, 400);
  return json({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
});

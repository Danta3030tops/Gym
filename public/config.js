// Supabase connection for the public Gym app.
// This must be a NEW Supabase project (not the couple app's): run dev/public-version/supabase-public-schema.sql in it,
// then paste its Project URL and publishable (anon) key here. The publishable key is safe in a public site.
window.GYM_PUBLIC_CONFIG = window.GYM_PUBLIC_CONFIG || { // (tests set this first to point at the mock)
  supabaseUrl: "",
  supabaseAnonKey: ""
};

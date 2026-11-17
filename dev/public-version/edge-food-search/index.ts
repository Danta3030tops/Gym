// Supabase Edge Function "food-search": searches Open Food Facts for packaged foods, for Spott's "Search packaged foods online".
// Why a function: Open Food Facts doesn't let a website call its name search directly from the browser, but a server can.
// Deploy in the GYM PUBLIC project: Edge Functions → Deploy a new function → Via Editor → name it "food-search" → paste this file.
// Leave "Verify JWT" ON (the default): only signed-in Spott users can use it.
// Data: Open Food Facts, openfoodfacts.org, Open Database License. The app shows the credit under the results.
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const n = (v: unknown) => { const x = Number(v); return Number.isFinite(x) && x >= 0 && x < 5000 ? Math.round(x * 10) / 10 : null; };

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  let q = '';
  try { q = String((await req.json()).q ?? '').trim().slice(0, 60); } catch { return json({ error: 'bad request' }, 400); }
  if (q.length < 2) return json({ items: [] });
  const url = 'https://search.openfoodfacts.org/search?' + new URLSearchParams({ q, page_size: '25', fields: 'product_name,brands,nutriments,serving_quantity' });
  let hits: any[] = [];
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Spott gym tracker (food-search function)' }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return json({ error: 'search unavailable' }, 502);
    hits = (await r.json()).hits || [];
  } catch { return json({ error: 'search unavailable' }, 502); }
  const items = [];
  for (const h of hits) {
    const t = h.nutriments || {}, cal = n(t['energy-kcal_100g']), p = n(t.proteins_100g), c = n(t.carbohydrates_100g), f = n(t.fat_100g);
    const name = String(h.product_name || '').trim();
    if (!name || cal === null || p === null || c === null || f === null) continue; // only foods with all four numbers
    const brands = Array.isArray(h.brands) ? h.brands.join(', ') : String(h.brands || '');
    items.push({ n: name.slice(0, 80), b: brands.trim().slice(0, 40), cal, p, c, f, sg: n(h.serving_quantity) || 0 });
    if (items.length >= 20) break;
  }
  return json({ items });
});

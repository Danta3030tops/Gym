# Drafts Jamaican dishes from standard recipes: each ingredient's USDA values (SR Legacy, public domain) added up, then split into servings.
# Output: jamaican-draft.md (for the owner to check) and jamaican-draft.json (merged into foods.json once approved).
# Estimates only: home recipes vary, and cooking losses (fat poured off, water boiled away) aren't modelled. Water, salt, herbs and spices count as 0.
import csv, json, re, sys
SR = sys.argv[1]; OUT = sys.argv[2]
# ingredient key -> words that must all appear in the USDA name (first match, shortest name wins), or fixed per-100 g values with a source
ING = {
 'ackee': {'fixed': (140, 4, 11, 9), 'src': 'not in USDA: Grace "Ackees in salt water" label, per 100 g, via Open Food Facts (ODbL). Check against a can'},
 'saltfish': 'fish cod atlantic dried salted', 'flour': 'wheat flour white all-purpose enriched bleached', 'cornmeal': 'cornmeal whole-grain yellow',
 'sugar': 'sugars granulated', 'brownsugar': 'sugars brown', 'oil': 'oil soybean salad or cooking', 'butter': 'butter salted',
 'milk': 'milk whole 3.25% milkfat with added vitamin d', 'condensed': 'milk canned condensed sweetened', 'coconutmilk': 'nuts coconut milk canned liquid expressed',
 'rice': 'rice white long-grain raw enriched', 'kidneydry': 'beans kidney red mature seeds raw', 'goat': 'game meat goat raw',
 'thigh': 'chicken broilers or fryers thigh meat and skin raw', 'leg': 'chicken broilers or fryers leg meat and skin raw', 'oxtail': 'beef composite of trimmed retail cuts separable lean and fat trimmed to 1/8" fat all grades raw', # no oxtail in USDA: stand-in, real oxtail is fattier
 'butterbeans': 'beans lima large mature seeds canned', 'potato': 'potatoes flesh and skin raw', 'onion': 'onions raw', 'tomato': 'tomatoes red ripe raw year round average',
 'sweetpepper': 'peppers sweet green raw', 'carrot': 'carrots raw', 'okra': 'okra raw', 'cabbage': 'cabbage raw', 'scallion': 'onions spring or scallions raw',
 'callaloo': 'amaranth leaves raw', 'snapper': 'fish snapper mixed species raw', 'mackerel': 'fish mackerel atlantic raw', 'vinegar': 'vinegar distilled',
 'crackers': 'crackers standard snack-type regular', 'soy': 'soy sauce made from soy shoyu', 'ketchup': 'catsup', 'cassava': 'cassava raw', 'saltpork': 'pork cured salt pork raw',
 'groundbeef': 'beef ground 80% lean meat 20% fat raw', 'shortening': 'shortening vegetable household composite', 'breadcrumbs': 'bread crumbs dry grated plain',
 'bakingpowder': 'leavening agents baking powder double-acting sodium aluminum sulfate', 'curry': 'spices curry powder', 'garlic': 'garlic raw', 'molasses': 'molasses',
}
# name, serves, serving description, estimated grams per serving, [(ingredient, grams), ...]
DISHES = [
 ('Ackee and saltfish', 4, '1 serving', 240, [('ackee', 300), ('saltfish', 225), ('onion', 110), ('tomato', 120), ('sweetpepper', 75), ('oil', 27), ('garlic', 6)]),
 ('Festival', 8, '1 festival', 70, [('flour', 250), ('cornmeal', 125), ('sugar', 40), ('bakingpowder', 8), ('milk', 120), ('oil', 45)]),
 ('Fried dumpling', 8, '1 dumpling', 55, [('flour', 250), ('bakingpowder', 6), ('oil', 45)]),
 ('Boiled dumpling (spinners)', 8, '1 dumpling', 50, [('flour', 250)]),
 ('Rice and peas', 10, '1 cup', 200, [('rice', 400), ('kidneydry', 150), ('coconutmilk', 400), ('scallion', 20)]),
 ('Curry goat', 6, '1 serving (no bone)', 180, [('goat', 750), ('potato', 300), ('onion', 150), ('curry', 15), ('oil', 30), ('garlic', 10)]),
 ('Brown stew chicken', 4, '1 serving (no bone)', 200, [('thigh', 700), ('onion', 100), ('tomato', 100), ('sweetpepper', 75), ('brownsugar', 15), ('ketchup', 30), ('oil', 30)]),
 ('Jerk chicken', 4, '1 quarter leg (no bone)', 150, [('leg', 900), ('scallion', 60), ('onion', 60), ('oil', 30), ('soy', 30), ('brownsugar', 15)]),
 ('Curry chicken', 4, '1 serving (no bone)', 200, [('thigh', 700), ('potato', 250), ('onion', 100), ('curry', 15), ('oil', 30)]),
 ('Oxtail stew', 4, '1 serving (no bone)', 230, [('oxtail', 650), ('butterbeans', 240), ('carrot', 100), ('onion', 100), ('oil', 30), ('brownsugar', 10)]),
 ('Stew peas', 10, '1 cup', 250, [('kidneydry', 450), ('saltpork', 225), ('coconutmilk', 400), ('flour', 125), ('onion', 60), ('scallion', 20)]),
 ('Steamed callaloo', 4, '1 cup', 130, [('callaloo', 450), ('onion', 60), ('tomato', 100), ('oil', 15)]),
 ('Steamed cabbage', 4, '1 cup', 140, [('cabbage', 450), ('carrot', 100), ('onion', 60), ('oil', 15)]),
 ('Escovitch fish', 4, '1 serving (no bone)', 170, [('snapper', 600), ('flour', 30), ('oil', 40), ('vinegar', 120), ('onion', 100), ('carrot', 60), ('sweetpepper', 60)]),
 ('Steamed fish', 4, '1 serving (no bone)', 220, [('snapper', 600), ('okra', 100), ('carrot', 60), ('onion', 60), ('butter', 15), ('crackers', 30)]),
 ('Run down (mackerel in coconut milk)', 4, '1 serving', 220, [('mackerel', 450), ('coconutmilk', 400), ('onion', 100), ('tomato', 150)]),
 ('Saltfish fritters (stamp and go)', 12, '1 fritter', 35, [('flour', 250), ('saltfish', 115), ('scallion', 30), ('onion', 30), ('oil', 60)]),
 ('Bammy', 4, '1 bammy', 110, [('cassava', 600), ('coconutmilk', 60), ('oil', 20)]),
 ('Beef patty', 8, '1 patty', 140, [('flour', 450), ('shortening', 170), ('groundbeef', 400), ('breadcrumbs', 40), ('onion', 60), ('curry', 10)]),
 ('Cornmeal porridge', 4, '1 cup', 250, [('cornmeal', 120), ('milk', 500), ('condensed', 100)]),
 ('Bulla', 8, '1 bulla', 85, [('flour', 450), ('brownsugar', 225), ('butter', 30), ('molasses', 30), ('bakingpowder', 8)]),
]
foods = [(re.sub(r'\s*\(Includes[^)]*\)', '', r['description']), r['fdc_id']) for r in csv.DictReader(open(SR + '/food.csv'))]
want = {k: v for k, v in ING.items() if isinstance(v, str)}
pick = {}
for k, words in want.items():
    ws = words.lower().split(); m = sorted([f for f in foods if all(w in re.sub(r'[^a-z0-9%.-]+', ' ', f[0].lower()).split() or w in f[0].lower() for w in ws)], key=lambda f: len(f[0]))
    if not m: print('NO MATCH', k, ':', words); continue
    pick[k] = m[0]
if len(pick) < len(want): sys.exit(1)
ids = {v[1] for v in pick.values()}; val = {}
for r in csv.DictReader(open(SR + '/food_nutrient.csv')):
    if r['fdc_id'] in ids and r['nutrient_id'] in ('1008', '1003', '1005', '1004'): val.setdefault(r['fdc_id'], {})[r['nutrient_id']] = float(r['amount'] or 0)
def per100(k):
    v = ING[k]
    if isinstance(v, dict): return v['fixed']
    x = val[pick[k][1]]; return (x.get('1008', 0), x.get('1003', 0), x.get('1005', 0), x.get('1004', 0))
md = ['# Jamaican dishes: draft for checking', '', 'Worked out from standard recipes using USDA ingredient values. **Estimates**: home cooking varies, and fat poured off or water boiled away isn\'t counted.',
      'Please check each recipe and the serving size; correct anything that looks off for a typical Jamaican portion.', '',
      '| Dish | Serving | kcal | Protein g | Carbs g | Fat g | Recipe (whole pot) |', '|---|---|---|---|---|---|---|']
out = []
for name, serves, sdesc, sg, ings in DISHES:
    tot = [0, 0, 0, 0]
    for k, g in ings:
        for i, v in enumerate(per100(k)): tot[i] += v * g / 100
    s = [x / serves for x in tot]; k100 = [x * 100 / sg for x in s]
    md.append(f"| {name} | {sdesc} (~{sg} g) | {round(s[0])} | {s[1]:.1f} | {s[2]:.1f} | {s[3]:.1f} | serves {serves}: " + ', '.join(f'{k} {g} g' for k, g in ings) + ' |')
    out.append([name + ' (estimate)', round(k100[0]), round(k100[1], 1), round(k100[2], 1), round(k100[3], 1), sdesc, float(sg)])
md += ['', '"Serves" is how many servings the whole pot makes; the grams per serving are my estimate of the cooked weight.', '', '## Ingredients used', ''] + [f'- **{k}**: {pick[k][0]}' for k in sorted(pick)] + [f'- **{k}**: {ING[k]["src"]}' for k in ING if isinstance(ING[k], dict)]
open(OUT + '/jamaican-draft.md', 'w').write('\n'.join(md) + '\n'); json.dump(out, open(OUT + '/jamaican-draft.json', 'w'), indent=0)
print(len(out), 'dishes')

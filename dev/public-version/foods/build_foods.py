# Builds public/foods.json from USDA FoodData Central (public domain):
#   FNDDS 2021-2023 survey foods ("as eaten": cooked dishes, drinks, snacks) + a few raw / dry staples from SR Legacy that lifters weigh.
# Values are per 100 g: kcal, protein, carbs, fat. Up to 3 household portions per food as [label, grams].
import csv, collections, json, re, sys
FN, SR, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
def nut(folder, ids):
    v = collections.defaultdict(dict)
    for r in csv.DictReader(open(folder + '/food_nutrient.csv')):
        k = {'208': '1008', '203': '1003', '205': '1005', '204': '1004'}.get(r['nutrient_id'], r['nutrient_id']) # the survey list uses the old nutrient numbers
        if r['fdc_id'] in ids and k in ('1008', '1003', '1005', '1004'): v[r['fdc_id']][k] = float(r['amount'] or 0)
    return v
def clean(n):
    n = re.sub(r',? ?\bNS as to [^,]*', '', n); n = re.sub(r',? ?\bNFS\b', '', n); n = re.sub(r'\s*\((?:Includes|includes)[^)]*\)', '', n)
    n = re.sub(r', (?:regular|enriched|broilers? or fryers|dark meat)\b', '', n); n = re.sub(r'\s+,', ',', n); n = re.sub(r'\s{2,}', ' ', n).strip(' ,')
    return n
def portions(rows):
    out, seen = [], set()
    for lab, g in rows:
        lab = (lab or '').strip(); g = float(g or 0)
        if not lab or g <= 0 or 'not specified' in lab.lower() or 'yield' in lab.lower() or len(lab) > 32 or lab.lower() in seen: continue
        seen.add(lab.lower()); out.append([lab, round(g, 1)])
        if len(out) == 3: break
    return out
skip_cat = {'9002','9004','9006','9007','9008','9010','9012','9202','9204','9402','9404','9602'}
cat = {r['fdc_id']: r['wweia_category_number'] for r in csv.DictReader(open(FN + '/survey_fndds_food.csv'))}
fn = {r['fdc_id']: r['description'] for r in csv.DictReader(open(FN + '/food.csv')) if cat.get(r['fdc_id']) not in skip_cat}
fp = collections.defaultdict(list)
for r in csv.DictReader(open(FN + '/food_portion.csv')): fp[r['fdc_id']].append((r['portion_description'], r['gram_weight']))
# SR Legacy: raw / dry staples (exact names), for people who weigh food before cooking
STAPLES = ['Chicken, broiler or fryers, breast, skinless, boneless, meat only, raw', 'Chicken, broilers or fryers, dark meat, thigh, meat only, raw', 'Chicken, broilers or fryers, dark meat, drumstick, meat only, raw',
  'Beef, ground, 80% lean meat / 20% fat, raw', 'Beef, ground, 90% lean meat / 10% fat, raw', 'Beef, ground, 93% lean meat / 7% fat, raw',
  'Pork, fresh, loin, center loin (chops), bone-in, separable lean only, raw', 'Fish, salmon, Atlantic, farmed, raw', 'Fish, tilapia, raw', 'Fish, cod, Atlantic, raw',
  'Fish, cod, Atlantic, dried and salted', 'Fish, mackerel, Atlantic, raw', 'Fish, snapper, mixed species, raw', 'Crustaceans, shrimp, raw', 'Fish, tuna, light, canned in water, drained solids',
  'Turkey, ground, 93% lean, 7% fat, raw', 'Egg, whole, raw, fresh', 'Egg, white, raw, fresh',
  'Rice, white, long-grain, regular, raw, enriched', 'Rice, brown, long-grain, raw', 'Cereals, oats, regular and quick, not fortified, dry', 'Pasta, dry, enriched',
  'Quinoa, uncooked', 'Potatoes, flesh and skin, raw', 'Sweet potato, raw, unprepared', 'Yam, raw', 'Plantains, green, raw', 'Plantains, yellow, raw', 'Breadfruit, raw',
  'Cassava, raw', 'Taro, raw', 'Cornmeal, whole-grain, yellow', 'Wheat flour, white, all-purpose, enriched, bleached', 'Beans, kidney, red, mature seeds, raw',
  'Pigeon peas (red gram), mature seeds, raw', 'Lentils, raw', 'Chickpeas (garbanzo beans, bengal gram), mature seeds, raw', 'Peanut butter, smooth style, without salt',
  'Oil, olive, salad or cooking', 'Oil, coconut', 'Nuts, coconut milk, canned (liquid expressed from grated meat and water)', 'Chayote, fruit, raw', 'Okra, raw', 'Pumpkin, raw',
  'Amaranth leaves, raw', 'Soursop, raw', 'Guavas, common, raw', 'Roselle, raw', 'Mangos, raw', 'Papayas, raw', 'Avocados, raw, all commercial varieties']
srd = {re.sub(r'\s*\(Includes[^)]*\)', '', r['description']): r['fdc_id'] for r in csv.DictReader(open(SR + '/food.csv'))}
missing = [s for s in STAPLES if s not in srd]
mu = {r['id']: r['name'] for r in csv.DictReader(open(SR + '/measure_unit.csv'))}
sp = collections.defaultdict(list)
for r in csv.DictReader(open(SR + '/food_portion.csv')):
    a = r['amount']; a = '' if a in ('1', '1.0') else (a.rstrip('0').rstrip('.') + ' ')
    sp[r['fdc_id']].append((((a or '1 ') + (r['modifier'] or mu.get(r['measure_unit_id'], ''))).strip(), r['gram_weight']))
sr_ids = {srd[s] for s in STAPLES if s in srd}
fv, sv = nut(FN, set(fn)), nut(SR, sr_ids)
foods, seen = [], set()
def add(name, v, por):
    if not v or '1003' not in v: return
    p, c, f = v.get('1003', 0), v.get('1005', 0), v.get('1004', 0); k = v.get('1008') or round(p * 4 + c * 4 + f * 9)
    key = name.lower()
    if key in seen: return
    seen.add(key); foods.append([name, round(k), round(p, 1), round(c, 1), round(f, 1)] + [x for pr in por for x in pr])
for s in STAPLES:
    if s in srd: add(clean(s) + (', raw' if ', raw' not in s and 'dry' not in s and 'uncooked' not in s and 'canned' not in s and 'salted' not in s and 'Oil' not in s and 'butter' not in s and 'flour' not in s.lower() and 'Cornmeal' not in s else ''), sv[srd[s]], portions(sp[srd[s]]))
for i, n in sorted(fn.items(), key=lambda x: x[1]): add(clean(n), fv[i], portions(fp[i]))
json.dump({'v': 1, 'src': 'USDA FoodData Central: FNDDS 2021-2023 and SR Legacy (public domain)', 'cols': ['name', 'kcal', 'protein', 'carbs', 'fat', 'portion label, grams, ...'], 'per': '100 g', 'f': foods},
          open(OUT, 'w'), ensure_ascii=False, separators=(',', ':'))
print(len(foods), 'foods; staples missing from SR:', missing)

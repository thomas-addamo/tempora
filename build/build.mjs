// Tempora — pipeline dati ad alta definizione.
//
// Fonti:
//   - historical-basemaps (A. Ourednik, GPL-3.0): confini dal 3000 a.C. al 1880
//   - CShapes 2.0 (ETH Zurigo, CC BY-NC-SA 4.0): confini precisi di stati e colonie dal 1886 al 2019
//   - Natural Earth 10m e 50m (pubblico dominio): linea di costa e nomi italiani dei paesi
//
// Ogni carta viene estesa fino alla costa vera: i pezzi di terra che la fonte non copre vengono
// assegnati al territorio confinante con cui condividono più bordo (o al più vicino entro 200 km).
// La costa precisa è un livello unico (data/terra-*.json) usato come maschera nel disegno.
//
// Uso: node build/build.mjs <cartella sorgenti> <node_modules>
//   <cartella sorgenti> contiene raw/ (historical-basemaps), ne/ (Natural Earth), cshapes/CShapes-2.0.geojson
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const [srcDir, modDirArg] = process.argv.slice(2);
if (!srcDir || !modDirArg) { console.error("Uso: node build/build.mjs <sorgenti> <node_modules>"); process.exit(1); }
const modDir = path.resolve(modDirArg);
const require = createRequire(path.join(modDir, "x.js"));
const d3 = require("d3-geo");
const topo = require("topojson-client");
const MS = path.join(modDir, ".bin", "mapshaper");
const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, "..", "data");
const tmp = path.join(srcDir, "_tmp");
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(tmp, { recursive: true });
const ms = args => execFileSync(MS, args, { stdio: "pipe", maxBuffer: 1 << 28 });
const R = 6371.0088;
const SOLO = process.env.SOLO ? process.env.SOLO.split(",").map(Number) : null; // per prove: SOLO=1279,1914

/* ── Costa ─────────────────────────────────────────────── */
const land10 = path.join(tmp, "land10.json");
ms(["-i", path.join(srcDir, "ne/ne_10m_land.geojson"), "-simplify", "30%", "weighted", "keep-shapes", "-o", "format=geojson", land10]);
ms(["-i", path.join(srcDir, "ne/ne_10m_land.geojson"), "-simplify", "22%", "weighted", "keep-shapes", "-o", "format=topojson", "quantization=400000", path.join(outDir, "terra-10.json")]);
ms(["-i", path.join(srcDir, "ne/ne_50m_land.geojson"), "-o", "format=topojson", "quantization=100000", path.join(outDir, "terra-50.json")]);
console.log("costa pronta");

/* ── Nomi italiani ─────────────────────────────────────── */
const neC = JSON.parse(fs.readFileSync(path.join(srcDir, "ne/ne_10m_admin_0_countries.geojson"), "utf8"));
const neIt = new Map();
for (const f of neC.features) {
  const q = f.properties;
  for (const k of ["NAME", "NAME_LONG", "ADMIN", "NAME_EN", "FORMAL_EN", "NAME_SORT"]) if (q[k] && q.NAME_IT && !neIt.has(q[k].toLowerCase())) neIt.set(q[k].toLowerCase(), q.NAME_IT);
}
const IT_EXTRA = {
  "Alaska": "Alaska", "Hawaii": "Hawaii", "Newfoundland": "Terranova", "Guadeloupe": "Guadalupa", "Martinique": "Martinica", "Surinam": "Suriname", "French Guyana": "Guyana francese",
  "German Federal Republic": "Germania Ovest", "German Democratic Republic": "Germania Est", "Danzig": "Città libera di Danzica", "Austria-Hungary": "Austria-Ungheria", "Czechoslovakia": "Cecoslovacchia",
  "Macedonia (FYROM/North Macedonia)": "Macedonia del Nord", "Yugoslavia": "Jugoslavia", "Bosnia-Herzegovina": "Bosnia ed Erzegovina", "Rumania": "Romania", "French West Africa": "Africa occidentale francese",
  "Cote D'Ivoire": "Costa d'Avorio", "German Togoland": "Togo tedesco", "British Togoland": "Togo britannico", "Kamerun": "Camerun tedesco", "British Cameroons": "Camerun britannico",
  "Congo, Democratic Republic of (Zaire)": "Congo (Rep. Dem.)", "Zanzibar": "Zanzibar", "Rwanda-Urundi": "Ruanda-Urundi", "British Somaliland (Somaliland Republic)": "Somalia britannica",
  "Federation of Rhodesia and Nyasaland": "Federazione della Rhodesia e del Nyasaland", "Cape Colony": "Colonia del Capo", "Natal": "Natal", "Transvaal": "Transvaal", "Orange Free State": "Stato Libero dell'Orange",
  "Swaziland (Eswatini)": "Swaziland", "Reunion": "Riunione", "Spanish Morocco": "Marocco spagnolo", "Spanish Sahara": "Sahara spagnolo", "Spanish West Africa": "Africa occidentale spagnola",
  "Yemen, People's Republic of": "Yemen del Sud", "Aden": "Aden", "Tibet": "Tibet", "Korea": "Corea", "Korea, People's Republic of": "Corea del Nord", "Korea, Republic of": "Corea del Sud",
  "Vietnam, Democratic Republic of": "Vietnam del Nord", "Vietnam, Republic of": "Vietnam del Sud", "Federated Malay States": "Stati Malesi Federati", "Unfederated Malay States": "Stati Malesi non Federati",
  "Sabah (North Borneo)": "Borneo del Nord", "Sarawak": "Sarawak", "Straits Settlements": "Insediamenti dello Stretto", "West Irian (Dutch New Guinea)": "Nuova Guinea olandese",
  "New South Wales": "Nuovo Galles del Sud", "Western Australia": "Australia Occidentale", "South Australia": "Australia Meridionale", "Victoria": "Victoria", "Queensland": "Queensland", "Tasmania": "Tasmania",
  "Papua": "Papua", "New Guinea (German New Guinea) (Kaiser Wilhelmsland)": "Nuova Guinea tedesca", "New Caledonia and Dependencies": "Nuova Caledonia", "Inini": "Inini", "Bosnia": "Bosnia", "Herzegovina": "Erzegovina",
  "Lagos": "Colonia di Lagos", "Oil Rivers Protectorate": "Protettorato dei Fiumi dell'Olio", "Southern Nigeria": "Nigeria meridionale", "Northern Nigeria": "Nigeria settentrionale", "Italian Somaliland": "Somalia italiana",
  "Northeastern Rhodesia": "Rhodesia nord-orientale", "Northwestern Rhodesia": "Rhodesia nord-occidentale", "British Bechuanaland": "Bechuanaland britannico", "Southern zone of Spanish Morocco": "Zona meridionale del Marocco spagnolo",
  "Gaza": "Striscia di Gaza", "West Bank": "Cisgiordania", "Federation of South Arabia": "Federazione dell'Arabia del Sud", "East Aden Protectorate": "Protettorato di Aden Est", "Bokhara": "Emirato di Bukhara", "Khiva": "Khanato di Khiva",
  "Southern Sakhalin Island": "Sachalin meridionale", "Jammu and Kashmir": "Jammu e Kashmir", "Perak": "Perak", "Selangore": "Selangor", "Pahang": "Pahang", "German Solomon Islands": "Isole Salomone tedesche",
  "Italy": "Italia", "Germany": "Germania", "Russian Empire": "Impero russo", "USSR": "Unione Sovietica", "Russia": "Russia", "Ottoman Empire": "Impero ottomano", "Turkey": "Turchia", "Persia": "Persia", "Iran": "Iran",
  "United States of America": "Stati Uniti d'America", "United Kingdom": "Regno Unito", "France": "Francia", "Spain": "Spagna", "Portugal": "Portogallo", "China": "Cina", "Japan": "Giappone", "India": "India", "Brazil": "Brasile"
};
const itDi = n => IT_EXTRA[n] || neIt.get(n.toLowerCase()) || neIt.get(n.replace(/\s*\(.*\)/, "").toLowerCase()) || null;

/* ── Utilità geometriche (piane, indipendenti dal verso degli anelli) ── */
function anelli(geom) {
  if (!geom) return [];
  if (geom.type === "Polygon") return geom.coordinates;
  if (geom.type === "MultiPolygon") return geom.coordinates.flat();
  return [];
}
function contiene(geom, [x, y]) {
  let dentro = false;
  for (const r of anelli(geom)) for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}
function areaKm2(geom) {
  let a = d3.geoArea({ type: "Feature", geometry: geom });
  if (a > 2 * Math.PI) a = 4 * Math.PI - a;
  return a * R * R;
}
function puntoEtichetta(geom) {
  const polys = geom.type === "MultiPolygon" ? geom.coordinates : [geom.coordinates];
  let best = null, bestA = -1;
  for (const c of polys) {
    if (!c || !c.length) continue;
    let a = d3.geoArea({ type: "Polygon", coordinates: c }); if (a > 2 * Math.PI) a = 4 * Math.PI - a;
    if (a > bestA) { bestA = a; best = c; }
  }
  if (!best) return null;
  const r = best[0]; let cx = 0, cy = 0, A = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const f = r[j][0] * r[i][1] - r[i][0] * r[j][1]; cx += (r[j][0] + r[i][0]) * f; cy += (r[j][1] + r[i][1]) * f; A += f; }
  let p = A ? [cx / (3 * A), cy / (3 * A)] : r[0];
  if (!contiene({ type: "Polygon", coordinates: best }, p)) p = d3.geoCentroid({ type: "Polygon", coordinates: best });
  return [Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100];
}

/* ── Estensione alla costa ─────────────────────────────── */
function cartaAllaCosta(geojsonIn, anno) {
  const merged = path.join(tmp, `m_${anno}.json`), assegnato = path.join(tmp, `a_${anno}.geojson`);
  ms(["-i", geojsonIn, land10, "combine-files", "snap",
    "-rename-layers", "h,land",
    "-dissolve2", "NAME", "copy-fields=SUBJECTO,BORDERPRECISION", "target=h",
    "-dissolve", "target=h", "+", "name=u",
    "-erase", "u", "target=land", "+", "name=g",
    "-explode", "target=g",
    "-each", 'NAME="__gap"', "target=g",
    "-merge-layers", "target=h,g", "force", "name=m",
    "-o", "target=m", "format=topojson", "quantization=400000", merged]);
  const log = execFileSync("node", [path.join(here, "assegna-coste.mjs"), merged, assegnato, modDir], { stdio: "pipe" }).toString().trim();
  const out = path.join(tmp, `f_${anno}.json`), outHd = path.join(tmp, `h_${anno}.json`);
  const dis = path.join(tmp, `d_${anno}.json`);
  ms(["-i", assegnato, "-dissolve2", "NAME", "copy-fields=SUBJECTO,BORDERPRECISION", "-filter", 'NAME !== ""', "-o", "format=geojson", dis]);
  // vista del mondo: ~1,5 km di tolleranza, punti sulla costa ridotti (la costa vera è disegnata a parte)
  ms(["-i", dis, "-filter-islands", "min-area=60km2", "-simplify", "interval=1500", "keep-shapes", "-o", "format=topojson", "quantization=100000", out]);
  // alta definizione, caricata quando si ingrandisce
  ms(["-i", dis, "-filter-islands", "min-area=1km2", "-simplify", "interval=200", "keep-shapes", "-o", "format=topojson", "quantization=400000", outHd]);
  return { t: JSON.parse(fs.readFileSync(out, "utf8")), hd: JSON.parse(fs.readFileSync(outHd, "utf8")), log };
}

const entities = {}; // nome -> {anno: km²}
const meta = {};     // nome -> nome italiano
const adjN = new Map(), adjS = new Map();
const link = (m, a, b) => { if (!a || !b || a === b) return; (m.get(a) || m.set(a, new Set()).get(a)).add(b); (m.get(b) || m.set(b, new Set()).get(b)).add(a); };

function proprieta(t, info) {
  const obj = t.objects[Object.keys(t.objects)[0]];
  for (const g of obj.geometries) {
    const P = g.properties || {}, n = (P.NAME || "").trim(), i = info.get(n) || {};
    g.properties = { n, s: i.s || P.SUBJECTO || n, p: i.p || P.BORDERPRECISION || 1 };
  }
  t.objects = { t: obj };
  return t;
}
function scriviCarta({ t, hd, log }, anno, info) {
  fs.writeFileSync(path.join(outDir, `${anno}-hd.json`), JSON.stringify(proprieta(hd, info)));
  const obj = t.objects[Object.keys(t.objects)[0]];
  for (const g of obj.geometries) {
    const P = g.properties || {};
    const n = (P.NAME || "").trim();
    const i = info.get(n) || {};
    g.properties = { n, s: i.s || P.SUBJECTO || n, p: i.p || P.BORDERPRECISION || 1 };
    if (i.a) g.properties.a = Math.round(i.a);
    if (i.l) g.properties.l = i.l;
    if (n) { (entities[n] || (entities[n] = {}))[anno] = Math.round(i.a || 0); if (!meta[n]) { const it = itDi(n); if (it && it !== n) meta[n] = it; } }
  }
  const nb = topo.neighbors(obj.geometries);
  nb.forEach((list, i) => list.forEach(j => { const A = obj.geometries[i].properties, B = obj.geometries[j].properties; link(adjN, A.n, B.n); link(adjS, A.s, B.s); }));
  t.objects = { t: obj };
  fs.writeFileSync(path.join(outDir, `${anno}.json`), JSON.stringify(t));
  const kb = f => Math.round(fs.statSync(path.join(outDir, f)).size / 1024);
  console.log(`${anno}: ${kb(`${anno}.json`)} KB + hd ${kb(`${anno}-hd.json`)} KB · ${log}`);
}

/* ── 1. historical-basemaps fino al 1880 ─────────────────── */
const rawDir = path.join(srcDir, "raw");
const hbFiles = fs.readdirSync(rawDir).filter(f => /^world_(bc)?\d+\.geojson$/.test(f));
const hbYear = f => { const m = f.match(/^world_(bc)?(\d+)/); return m[1] ? -Number(m[2]) : Number(m[2]); };
const hbYears = hbFiles.map(hbYear).sort((a, b) => a - b);
const hbCache = new Map();
const leggiHB = y => {
  if (!hbCache.has(y)) {
    const d = JSON.parse(fs.readFileSync(path.join(rawDir, hbFiles.find(f => hbYear(f) === y)), "utf8"));
    for (const f of d.features) { const p = f.properties; p.NAME = (p.NAME || "").trim(); p.SUBJECTO = (p.SUBJECTO || p.NAME).trim(); p.BORDERPRECISION = p.BORDERPRECISION || 1; }
    hbCache.set(y, d);
  }
  return hbCache.get(y);
};
const anniUsati = [];
for (const y of hbYears.filter(y => y < 1886 && (!SOLO || SOLO.includes(y)))) {
  const d = leggiHB(y);
  const info = new Map();
  for (const f of d.features) {
    if (!f.properties.NAME || !f.geometry) continue;
    const n = f.properties.NAME;
    const i = info.get(n) || { a: 0, l: null, s: f.properties.SUBJECTO, p: f.properties.BORDERPRECISION, maxA: 0 };
    const a = areaKm2(f.geometry);
    i.a += a;
    if (a > i.maxA) { i.maxA = a; i.l = puntoEtichetta(f.geometry); }
    info.set(n, i);
  }
  const inp = path.join(tmp, `hb_${y}.geojson`);
  fs.writeFileSync(inp, JSON.stringify(d));
  scriviCarta(cartaAllaCosta(inp, y), y, info);
  anniUsati.push(y);
}

/* ── 2. CShapes dal 1886 al 2019 ─────────────────────────── */
const cs = JSON.parse(fs.readFileSync(path.join(srcDir, "cshapes/CShapes-2.0.geojson"), "utf8"));
const CS_ANNI = [1886, 1890, 1895, 1900, 1905, 1910, 1914, 1918, 1920, 1925, 1930, 1935, 1938, 1940, 1942, 1945, 1950, 1955, 1960, 1965, 1970, 1975, 1980, 1985, 1990, 1992, 1995, 2000, 2005, 2010, 2015, 2019];
const nomeCS = (n, y) => {
  if (n === "Italy/Sardinia") return "Italy";
  if (n === "Germany (Prussia)") return "Germany";
  if (n === "Russia (Soviet Union)") return y < 1922 ? "Russian Empire" : y < 1992 ? "USSR" : "Russia";
  if (n === "Turkey (Ottoman Empire)") return y < 1923 ? "Ottoman Empire" : "Turkey";
  if (n === "Iran (Persia)") return y < 1935 ? "Persia" : "Iran";
  return n;
};
const vivo = (p, y) => {
  const s = p.gwsyear * 10000 + p.gwsmonth * 100 + p.gwsday, e = p.gweyear * 10000 + p.gwemonth * 100 + p.gweday, d = y * 10000 + 701;
  return s <= d && d < e;
};
for (const y of CS_ANNI.filter(y => !SOLO || SOLO.includes(y))) {
  const feats = cs.features.filter(f => f.geometry && vivo(f.properties, y)).map(f => ({ type: "Feature", geometry: f.geometry, properties: { ...f.properties } }));
  // sovrano: dalla carta storica più vicina, se il territorio vi risulta dipendente
  const hbY = hbYears.reduce((b, a) => Math.abs(a - y) < Math.abs(b - y) ? a : b, hbYears[0]);
  const hb = leggiHB(hbY).features.filter(f => f.properties.NAME && f.geometry);
  const hbDi = pt => pt && hb.find(f => contiene(f.geometry, pt));
  const info = new Map(), hbNome = new Map();
  for (const f of feats) {
    const n = nomeCS(f.properties.cntry_name, y);
    const l = puntoEtichetta(f.geometry);
    const h = hbDi([f.properties.caplong, f.properties.caplat]) || hbDi(l);
    hbNome.set(n, h ? h.properties : null);
    info.set(n, { a: f.properties.area || areaKm2(f.geometry), l, p: 3 });
    f.properties = { NAME: n, SUBJECTO: n, BORDERPRECISION: 3 };
  }
  for (const [n, h] of hbNome) {
    if (!h || h.SUBJECTO === h.NAME) { info.get(n).s = n; continue; }
    // la madrepatria: prima per nome identico, altrimenti il territorio più piccolo che nella fonte storica porta il nome del sovrano
    const ALIAS = { "United Kingdom of Great Britain and Ireland": "United Kingdom", "Great Britain": "United Kingdom", "British Empire": "United Kingdom",
      "German Empire": "Germany", "Russia": nomeCS("Russia (Soviet Union)", y), "Soviet Union": "USSR", "Kingdom of Italy": "Italy", "Empire of Japan": "Japan", "Japanese Empire": "Japan" };
    const sogg = ALIAS[h.SUBJECTO] || h.SUBJECTO;
    let madre = hbNome.has(sogg) && sogg !== n ? sogg : null;
    if (!madre) {
      const cand = [...hbNome].filter(([m, hm]) => m !== n && hm && hm.NAME === sogg && hm.SUBJECTO === hm.NAME).map(([m]) => m);
      cand.sort((x, y) => info.get(x).a - info.get(y).a);
      madre = cand[0] || null;
    }
    info.get(n).s = madre || n;
  }
  // correzioni manuali: colonie che la fonte storica non attribuisce o attribuisce male [nome, da, fino a (escluso), madrepatria]
  const PROPRIETARI = [
    [/^(Alaska|Hawaii|Puerto Rico)$/, 0, 9999, "United States of America"], ["Philippines", 0, 1946, "United States of America"],
    [/^(Kamerun|German Togoland|New Guinea \(German|German Solomon)/, 0, 1920, "Germany"], ["Namibia", 0, 1915, "Germany"], ["Tanzania (Tanganyika)", 0, 1919, "Germany"],
    ["Indonesia", 0, 1949, "Netherlands"], ["Surinam", 0, 1975, "Netherlands"], ["West Irian (Dutch New Guinea)", 0, 1963, "Netherlands"],
    ["Italian Somaliland", 0, 1960, "Italy"], ["British Somaliland (Somaliland Republic)", 0, 1960, "United Kingdom"],
    [/^(Spanish|Southern zone of Spanish)/, 0, 9999, "Spain"],
    [/^(New South Wales|Western Australia|South Australia|Victoria|Queensland|Tasmania)$/, 0, 1901, "United Kingdom"],
    [/^(Guadeloupe|Martinique|French Guyana|Reunion|Inini|New Caledonia)/, 0, 9999, "France"],
    ["Korea", 1910, 1945, "Japan"], ["Taiwan", 1895, 1945, "Japan"], ["Southern Sakhalin Island", 0, 1946, "Japan"]
  ];
  for (const [n, i] of info) for (const [re, da, a, madre] of PROPRIETARI) {
    const ok = typeof re === "string" ? re === n : re.test(n);
    if (ok && y >= da && y < a && info.has(madre)) i.s = madre;
  }
  for (const f of feats) f.properties.SUBJECTO = info.get(f.properties.NAME).s;
  const inp = path.join(tmp, `cs_${y}.geojson`);
  fs.writeFileSync(inp, JSON.stringify({ type: "FeatureCollection", features: feats }));
  scriviCarta(cartaAllaCosta(inp, y), y, info);
  anniUsati.push(y);
}

/* ── Indice ──────────────────────────────────────────────── */
function colorize(adj, k = 9) {
  const order = [...adj.keys()].sort((a, b) => adj.get(b).size - adj.get(a).size);
  const col = {};
  for (const n of order) {
    const used = new Array(k).fill(0);
    for (const m of adj.get(n)) if (m in col) used[col[m]]++;
    let best = 0; for (let c = 1; c < k; c++) if (used[c] < used[best]) best = c;
    col[n] = best;
  }
  return col;
}
fs.writeFileSync(path.join(outDir, "index.json"), JSON.stringify({
  fonti: ["historical-basemaps, A. Ourednik (GPL-3.0)", "CShapes 2.0, ETH Zurigo (CC BY-NC-SA 4.0)", "Natural Earth (pubblico dominio)"],
  years: anniUsati.sort((a, b) => a - b),
  colorsN: colorize(adjN), colorsS: colorize(adjS),
  it: meta,
  entities
}));
fs.copyFileSync(path.join(rawDir, "LICENSE"), path.join(outDir, "LICENSE-historical-basemaps.txt"));
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`${anniUsati.length} carte, ${Object.keys(entities).length} entità`);

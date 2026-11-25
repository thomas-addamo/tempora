// Assegna i pezzi di terra non coperti ("__gap") al territorio confinante con cui condividono più bordo.
// Uso: node assegna-coste.mjs <topojson in> <geojson out> <node_modules>
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const [inp, out, modDir] = process.argv.slice(2);
const require = createRequire(path.join(path.resolve(modDir), "x.js"));
const topo = require("topojson-client");

const t = JSON.parse(fs.readFileSync(inp, "utf8"));
const obj = t.objects[Object.keys(t.objects)[0]];
const G = obj.geometries;

// lunghezza (in gradi, approssimata) di ogni arco
const tr = t.transform;
const arcLen = t.arcs.map(arc => {
  let x = 0, y = 0, px = null, py = null, L = 0;
  for (const p of arc) {
    if (tr) { x += p[0]; y += p[1]; } else { x = p[0]; y = p[1]; }
    const X = tr ? x * tr.scale[0] + tr.translate[0] : x, Y = tr ? y * tr.scale[1] + tr.translate[1] : y;
    if (px != null) L += Math.hypot((X - px) * Math.cos(Y * Math.PI / 180), Y - py);
    px = X; py = Y;
  }
  return L;
});
const archi = g => {
  const s = [];
  const walk = a => Array.isArray(a) ? a.forEach(walk) : s.push(a < 0 ? ~a : a);
  walk(g.arcs || []);
  return s;
};
const perArco = new Map();
G.forEach((g, i) => { for (const a of archi(g)) (perArco.get(a) || perArco.set(a, []).get(a)).push(i); });

const nome = G.map(g => g.properties.NAME);
const isGap = G.map(g => g.properties.NAME === "__gap");
let cambiati = 1, giri = 0;
while (cambiati && giri < 12) {
  cambiati = 0; giri++;
  for (let i = 0; i < G.length; i++) {
    if (!isGap[i] || nome[i] !== "__gap") continue;
    const peso = new Map();
    for (const a of archi(G[i])) for (const j of perArco.get(a)) {
      if (j === i || nome[j] === "__gap" || nome[j] === "") continue;
      peso.set(nome[j], (peso.get(nome[j]) || 0) + arcLen[a]);
    }
    let best = null, bw = 0;
    for (const [n, w] of peso) if (w > bw) { bw = w; best = n; }
    if (best) { nome[i] = best; cambiati++; }
  }
}
// isole e pezzi staccati: al territorio più vicino entro ~200 km
const decod = t.arcs.map(arc => {
  let x = 0, y = 0; const pts = [];
  for (const p of arc) {
    if (tr) { x += p[0]; y += p[1]; pts.push([x * tr.scale[0] + tr.translate[0], y * tr.scale[1] + tr.translate[1]]); }
    else pts.push(p);
  }
  return pts;
});
const griglia = new Map(); // celle da 2° con i vertici dei territori
const cella = (x, y) => `${Math.floor(x / 2)},${Math.floor(y / 2)}`;
G.forEach((g, i) => {
  if (isGap[i] || !nome[i]) return;
  for (const a of archi(g)) for (const p of decod[a]) {
    const k = cella(p[0], p[1]);
    (griglia.get(k) || griglia.set(k, []).get(k)).push([p[0], p[1], nome[i]]);
  }
});
let isole = 0;
for (let i = 0; i < G.length; i++) {
  if (!isGap[i] || nome[i] !== "__gap") continue;
  const pts = archi(G[i]).flatMap(a => decod[a]);
  if (!pts.length) continue;
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  let best = null, bd = 1.8; // gradi (~200 km)
  const gx = Math.floor(cx / 2), gy = Math.floor(cy / 2);
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
    for (const [x, y, n] of griglia.get(`${gx + dx},${gy + dy}`) || []) {
      const d = Math.hypot((x - cx) * Math.cos(cy * Math.PI / 180), y - cy);
      if (d < bd) { bd = d; best = n; }
    }
  }
  if (best) { nome[i] = best; isole++; }
}

const props = new Map();
G.forEach((g, i) => { if (!isGap[i]) props.set(g.properties.NAME, g.properties); });
const fc = topo.feature(t, obj);
const feats = [];
fc.features.forEach((f, i) => {
  if (nome[i] === "__gap") return;
  const p = props.get(nome[i]) || {};
  f.properties = { NAME: nome[i], SUBJECTO: p.SUBJECTO || nome[i], BORDERPRECISION: p.BORDERPRECISION || 1, AREA: p.AREA || 0 };
  feats.push(f);
});
fs.writeFileSync(out, JSON.stringify({ type: "FeatureCollection", features: feats }));
const assegnati = nome.filter((n, i) => isGap[i] && n !== "__gap").length;
console.log(`coste: ${assegnati}/${isGap.filter(Boolean).length} pezzi assegnati (${isole} per vicinanza)`);

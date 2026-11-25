# Tempora — atlante storico del mondo

Prototipo di un atlante interattivo: confini politici dal 3000 a.C. al 2019 su coste ad alta risoluzione, linea del tempo con ere ed eventi, confini che si trasformano (morphing) da una carta all'altra, proiezione piana o globo, scheda di ogni entità con l'estensione nel tempo, ricerca e visita guidata in 14 tappe. Design system: Fornace (carta avorio, terracotta, Bricolage Grotesque / Source Serif 4 / DM Sans), con un tema "Notte".

## Struttura

- `index.html`: l'app (d3 7.9, topojson-client 3.1, flubber 0.4 da CDN; nessun build).
- `data/<anno>.json`: 71 carte TopoJSON per la vista del mondo; `data/<anno>-hd.json`: la stessa carta in alta definizione, caricata quando si ingrandisce.
- `data/terra-50.json`, `data/terra-10.json`: la costa Natural Earth; fa da maschera a tutti i territori, così le coste sono precise in ogni epoca.
- `data/index.json`: anni, superficie di ogni entità per anno, nomi italiani, colori calcolati sui confinanti.
- `build/build.mjs` e `build/assegna-coste.mjs`: rigenerano `data/` dalle fonti. I pezzi di terra che la fonte storica non copre vengono assegnati al territorio confinante con cui condividono più bordo, o al più vicino entro 200 km.

## Rigenerare i dati

La cartella delle sorgenti deve contenere `raw/` (GeoJSON di historical-basemaps), `ne/` (ne_10m_land, ne_50m_land, ne_10m_admin_0_countries) e `cshapes/CShapes-2.0.geojson`.

```bash
npm i mapshaper@0.6.102 d3-geo@3.1.1 topojson-client@3.1.0
node build/build.mjs <cartella sorgenti> ./node_modules
```

## Avvio locale

```bash
python3 -m http.server 5178
```

## Fonti e licenze

- Fino al 1880: [historical-basemaps](https://github.com/aourednik/historical-basemaps) di André Ourednik, GPL-3.0. I confini interni antichi sono approssimati: ogni entità riporta la precisione indicata dalla fonte (1–3).
- Dal 1886 al 2019: [CShapes 2.0](https://icr.ethz.ch/data/cshapes/), ETH Zurigo, CC BY-NC-SA 4.0 (solo uso non commerciale).
- Coste e nomi italiani: [Natural Earth](https://www.naturalearthdata.com/), pubblico dominio.

## Copyright

© 2026 Thomas Addamo, tutti i diritti riservati su codice, design e testi; i dati in `data/` restano sotto le licenze delle fonti. Vedi [LICENSE](LICENSE), [copyright.html](copyright.html) e [privacy.html](privacy.html).

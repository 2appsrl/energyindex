// Genera i path SVG delle 6 zone GME da coordinate geografiche reali.
// Proiezione equirettangolare con compressione della longitudine al coseno
// della latitudine media italiana (~42°N), altrimenti lo stivale esce largo.

const LON0 = 6.4, LAT0 = 47.3;
const K = 34;                      // px per grado di latitudine
const KX = K * Math.cos(42 * Math.PI / 180); // ~25.3 px per grado di longitudine

const X = (lon) => +( (lon - LON0) * KX ).toFixed(1);
const Y = (lat) => +( (LAT0 - lat) * K ).toFixed(1);

// ── Confini condivisi fra zone (stessi punti in entrambe → niente fessure) ──
const B_NORD_CNOR = [ // Apennino tosco-emiliano: costa ligure → Adriatico
  [10.05,44.05],[10.30,44.12],[10.70,44.18],[11.40,44.15],[12.00,44.05],[12.74,43.96],
];
const B_CNOR_CSUD = [ // Tirreno → Adriatico, passando fra Umbria/Lazio e Marche/Abruzzo
  [11.50,42.35],[12.20,42.45],[12.90,42.60],[13.40,42.75],[13.90,42.90],
];
const B_CSUD_SUD = [ // Adriatico (confine Abruzzo/Molise) → Tirreno (Campania/Basilicata)
  [14.75,42.05],[14.60,41.75],[14.90,41.45],[15.20,41.15],[15.40,40.90],[15.60,40.50],[15.63,40.07],
];

const rev = (a) => [...a].reverse();

const ZONES = {
  nord: [
    // Confine alpino: Ventimiglia → Monte Bianco → Brennero → Trieste
    [7.55,43.79],[7.35,44.12],[6.90,44.36],[7.00,44.90],[6.80,45.13],[7.10,45.50],
    [6.85,45.85],[7.60,45.97],[8.10,46.25],[8.45,46.46],[9.05,46.50],[9.45,46.50],
    [10.10,46.62],[10.45,46.87],[11.00,46.80],[11.50,47.00],[12.20,47.09],[12.80,46.68],
    [13.40,46.55],[13.65,46.20],[13.60,45.98],[13.78,45.65],
    // Costa adriatica: laguna veneta → delta del Po → Romagna
    [13.53,45.79],[13.40,45.68],[12.85,45.60],[12.33,45.44],[12.28,45.22],[12.50,44.95],
    [12.28,44.42],[12.40,44.20],[12.57,44.06],
    ...B_NORD_CNOR.slice(-1).map(p=>p), // Cattolica
    ...rev(B_NORD_CNOR).slice(1),       // rientro verso la costa ligure
    // Costa ligure verso ovest
    [9.85,44.10],[9.20,44.32],[8.95,44.40],[8.50,44.30],[8.15,44.05],
  ],
  cnor: [
    ...B_NORD_CNOR,                     // Carrara → Cattolica
    // Costa adriatica marchigiana
    [12.90,43.90],[13.51,43.60],[13.65,43.43],[13.73,43.30],[13.88,42.96],
    ...rev(B_CNOR_CSUD).slice(1),       // Martinsicuro → Chiarone
    // Costa tirrenica toscana verso nord
    [11.18,42.42],[10.95,42.65],[10.78,42.95],[10.50,43.15],[10.30,43.55],[10.25,43.90],
  ],
  csud: [
    ...B_CNOR_CSUD,                     // Chiarone → Martinsicuro
    // Costa adriatica abruzzese
    [14.22,42.47],[14.40,42.35],[14.70,42.10],
    ...B_CSUD_SUD,                      // fino a Sapri
    // Costa tirrenica: Cilento → Napoli → Lazio
    [15.28,40.02],[14.99,40.35],[14.77,40.68],[14.25,40.85],[13.57,41.22],[12.63,41.45],
    [12.23,41.77],[11.79,42.09],
  ],
  sud: [
    ...rev(B_CSUD_SUD),                 // Sapri → Adriatico
    // Molise, Gargano, Puglia
    [14.99,42.00],[15.35,41.92],[15.90,41.92],[16.18,41.88],[16.05,41.70],[15.92,41.62],
    [16.28,41.32],[16.87,41.13],[17.30,40.95],[17.94,40.63],[18.50,40.15],[18.36,39.80],
    [17.98,40.06],[17.23,40.47],[16.85,40.40],
    // Golfo di Taranto e Calabria ionica
    [16.50,39.73],[16.63,39.60],[17.13,39.08],[17.10,38.90],[16.60,38.80],[16.55,38.68],
    [16.07,37.93],[15.65,38.11],
    // Costa tirrenica calabrese verso nord
    [15.72,38.25],[15.85,38.36],[15.90,38.68],[16.10,38.73],[16.23,38.90],[16.08,39.13],
    [16.03,39.36],[15.82,39.68],[15.77,39.90],[15.72,39.99],
  ],
  sici: [
    [15.64,38.19],[15.24,38.28],[14.02,38.04],[13.36,38.13],[12.88,38.03],[12.50,38.02],
    [12.43,37.80],[12.59,37.65],[13.08,37.50],[13.58,37.28],[14.25,37.07],[14.85,36.73],
    [15.14,36.68],[15.28,37.07],[15.22,37.24],[15.09,37.50],[15.29,37.85],
  ],
  sard: [
    [9.19,41.24],[9.38,41.18],[9.50,40.92],[9.72,40.58],[9.70,40.38],[9.70,39.94],
    [9.58,39.42],[9.62,39.10],[9.11,39.21],[8.68,38.90],[8.44,39.06],[8.30,39.15],
    [8.40,39.88],[8.50,40.30],[8.31,40.56],[8.16,40.56],[8.23,40.93],[8.70,40.92],
  ],
};

// Catmull-Rom → Bezier cubica: ammorbidisce le coste senza perdere i vertici.
function smoothClosedPath(pts) {
  const p = pts.map(([lon,lat]) => [X(lon), Y(lat)]);
  const n = p.length;
  const at = (i) => p[(i % n + n) % n];
  let d = `M ${at(0)[0]} ${at(0)[1]}`;
  for (let i = 0; i < n; i++) {
    const p0 = at(i-1), p1 = at(i), p2 = at(i+1), p3 = at(i+2);
    const t = 0.18; // tensione bassa: coste morbide ma riconoscibili
    const c1 = [ +(p1[0] + (p2[0]-p0[0]) * t).toFixed(1), +(p1[1] + (p2[1]-p0[1]) * t).toFixed(1) ];
    const c2 = [ +(p2[0] - (p3[0]-p1[0]) * t).toFixed(1), +(p2[1] - (p3[1]-p1[1]) * t).toFixed(1) ];
    d += ` C ${c1[0]} ${c1[1]}, ${c2[0]} ${c2[1]}, ${p2[0]} ${p2[1]}`;
  }
  return d + " Z";
}

// Centroide per posizionare l'etichetta
function centroid(pts) {
  const p = pts.map(([lon,lat]) => [X(lon), Y(lat)]);
  const s = p.reduce((a,[x,y]) => [a[0]+x, a[1]+y], [0,0]);
  return [ +(s[0]/p.length).toFixed(0), +(s[1]/p.length).toFixed(0) ];
}

let maxX = 0, maxY = 0;
for (const pts of Object.values(ZONES)) {
  for (const [lon,lat] of pts) { maxX = Math.max(maxX, X(lon)); maxY = Math.max(maxY, Y(lat)); }
}
console.log(`viewBox suggerito: 0 0 ${Math.ceil(maxX)+8} ${Math.ceil(maxY)+8}\n`);
for (const [code, pts] of Object.entries(ZONES)) {
  const [cx, cy] = centroid(pts);
  console.log(`${code}|${cx}|${cy}|${smoothClosedPath(pts)}`);
}

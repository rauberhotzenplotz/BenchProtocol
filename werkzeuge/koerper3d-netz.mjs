/* Erzeugt public/modelle/koerper3d.bin — das Netz des 3D-Körpermodells.

   Aufruf (Node 24, liest die .ts-Datei direkt):
     node werkzeuge/koerper3d-netz.mjs

   Aus den Formen in src/features/statistik/koerper3dModell.ts wird eine
   einzige glatte Oberfläche: alle Ellipsoide und Kapseln als
   Abstandsfelder, weich miteinander verschmolzen ("smooth union"), dann
   mit Surface Nets in ein Dreiecksnetz gewandelt. Jeder Punkt merkt sich,
   zu welcher Muskelregion er gehört und wie stark — so lässt sich die
   Hitze zur Laufzeit auf die Haut malen, mit weichen Übergängen statt
   harter Kanten.

   Gerechnet wird einmal hier, nicht auf dem Handy: rund eine Million
   Gitterpunkte mal fünfzig Formen kosteten dort Sekunden.

   Dateiformat (little-endian):
     0  'BPK3'                 Kennung
     4  u16 Version (1)        6  u16 Anzahl Regionen
     8  u32 Punkte             12 u32 Indizes
     16 f32×3 Minimum          28 f32×3 Maximum
     40 Positionen  u16×3 je Punkt, auf die Box quantisiert
        Normalen    i8×3 je Punkt
        Region      u8 je Punkt (255 = keine)
        Anteil      u8 je Punkt (0–255, wie stark die Region wirkt)
        Indizes     u16 je Index (das Netz bleibt unter 65 536 Punkten) */
import { writeFileSync, mkdirSync } from 'node:fs'
import { GRUNDKOERPER, MUSKELN, REGIONEN } from '../src/features/statistik/koerper3dModell.ts'

const ZELLE = 0.0085
const GLATT_GRUND = 0.045 // wie weich die Körperteile ineinander übergehen
const GLATT_MUSKEL = 0.022 // wie weich die Muskeln aus dem Körper wachsen

// ── Abstandsfelder ────────────────────────────────────────────────────
const len = (x, y, z) => Math.sqrt(x * x + y * y + z * z)

/** Drehung, die die y-Achse auf `achse` legt — als Basisvektoren, damit
    ein Punkt ins lokale System des Ellipsoids zurückgedreht werden kann. */
function basis(achse) {
  if (!achse) return null
  const l = len(...achse)
  const y = achse.map(v => v / l)
  const hilfe = Math.abs(y[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]
  let x = [y[1] * hilfe[2] - y[2] * hilfe[1], y[2] * hilfe[0] - y[0] * hilfe[2], y[0] * hilfe[1] - y[1] * hilfe[0]]
  const lx = len(...x)
  x = x.map(v => v / lx)
  const z = [x[1] * y[2] - x[2] * y[1], x[2] * y[0] - x[0] * y[2], x[0] * y[1] - x[1] * y[0]]
  return { x, y, z }
}

/** Abstand zu einem Ellipsoid, Näherung nach Inigo Quilez — genau genug
    für eine weiche Vereinigung, und ohne Iteration. */
function feld(f) {
  if (f.art === 'kapsel') {
    const [ax, ay, az] = f.a
    const [bx, by, bz] = f.b
    const abx = bx - ax, aby = by - ay, abz = bz - az
    const ab2 = abx * abx + aby * aby + abz * abz
    return (px, py, pz) => {
      const apx = px - ax, apy = py - ay, apz = pz - az
      const t = Math.max(0, Math.min(1, (apx * abx + apy * aby + apz * abz) / ab2))
      return len(apx - abx * t, apy - aby * t, apz - abz * t) - f.radius
    }
  }
  const [cx, cy, cz] = f.mitte
  const [rx, ry, rz] = f.radien
  const b = basis(f.achse)
  return (px, py, pz) => {
    let x = px - cx, y = py - cy, z = pz - cz
    if (b) {
      const lx = x * b.x[0] + y * b.x[1] + z * b.x[2]
      const ly = x * b.y[0] + y * b.y[1] + z * b.y[2]
      const lz = x * b.z[0] + y * b.z[1] + z * b.z[2]
      x = lx; y = ly; z = lz
    }
    const k0 = len(x / rx, y / ry, z / rz)
    const k1 = len(x / (rx * rx), y / (ry * ry), z / (rz * rz))
    return k1 === 0 ? -Math.min(rx, ry, rz) : (k0 * (k0 - 1)) / k1
  }
}

/** Weiches Minimum: verschmilzt zwei Formen zu einer, mit einer
    Hohlkehle der Breite k statt einer harten Kante. */
function smin(a, b, k) {
  const h = Math.max(k - Math.abs(a - b), 0) / k
  return Math.min(a, b) - h * h * k * 0.25
}

const grund = GRUNDKOERPER.map(feld)
const muskeln = MUSKELN.map(m => ({ region: REGIONEN.indexOf(m.region), d: feld(m) }))

function abstand(x, y, z) {
  let d = grund[0](x, y, z)
  for (let i = 1; i < grund.length; i++) d = smin(d, grund[i](x, y, z), GLATT_GRUND)
  for (const m of muskeln) d = smin(d, m.d(x, y, z), GLATT_MUSKEL)
  return d
}

/** Welche Region an einem Punkt der Oberfläche liegt, und wie stark: voll
    auf dem Muskel, ausblendend über gut einen Zentimeter daneben. */
function region(x, y, z) {
  let beste = -1
  let bester = Infinity
  for (const m of muskeln) {
    const d = m.d(x, y, z)
    if (d < bester) {
      bester = d
      beste = m.region
    }
  }
  const anteil = Math.max(0, Math.min(1, 1 - (bester - 0.002) / 0.016))
  return anteil > 0 ? { region: beste, anteil } : { region: 255, anteil: 0 }
}

// ── Gitter ────────────────────────────────────────────────────────────
const MIN = [-0.4, -0.03, -0.2]
const MAX = [0.4, 1.78, 0.22]
const nx = Math.ceil((MAX[0] - MIN[0]) / ZELLE)
const ny = Math.ceil((MAX[1] - MIN[1]) / ZELLE)
const nz = Math.ceil((MAX[2] - MIN[2]) / ZELLE)
const knoten = (i, j, k) => (k * (ny + 1) + j) * (nx + 1) + i
const werte = new Float32Array((nx + 1) * (ny + 1) * (nz + 1))
const start = Date.now()
for (let k = 0; k <= nz; k++)
  for (let j = 0; j <= ny; j++)
    for (let i = 0; i <= nx; i++)
      werte[knoten(i, j, k)] = abstand(MIN[0] + i * ZELLE, MIN[1] + j * ZELLE, MIN[2] + k * ZELLE)
console.error(`Feld ${nx}×${ny}×${nz} in ${((Date.now() - start) / 1000).toFixed(1)} s`)

// ── Surface Nets ──────────────────────────────────────────────────────
// Ein Punkt je Zelle, durch die die Oberfläche geht, gemittelt aus den
// Schnittpunkten der Kanten; je Kante mit Vorzeichenwechsel ein Viereck
// aus den vier Zellen um sie herum.
const zelle = (i, j, k) => (k * ny + j) * nx + i
const punktIndex = new Int32Array(nx * ny * nz).fill(-1)
const pos = []
const KANTEN = [
  [0, 1], [2, 3], [4, 5], [6, 7], // x
  [0, 2], [1, 3], [4, 6], [5, 7], // y
  [0, 4], [1, 5], [2, 6], [3, 7], // z
]
const ECKE = n => [n & 1, (n >> 1) & 1, (n >> 2) & 1]
for (let k = 0; k < nz; k++)
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const v = []
      for (let n = 0; n < 8; n++) {
        const [a, b, c] = ECKE(n)
        v.push(werte[knoten(i + a, j + b, k + c)])
      }
      if (v.every(w => w > 0) || v.every(w => w <= 0)) continue
      let sx = 0, sy = 0, sz = 0, anzahl = 0
      for (const [p, q] of KANTEN) {
        if (v[p] > 0 === v[q] > 0) continue
        const t = v[p] / (v[p] - v[q])
        const ep = ECKE(p), eq = ECKE(q)
        sx += ep[0] + (eq[0] - ep[0]) * t
        sy += ep[1] + (eq[1] - ep[1]) * t
        sz += ep[2] + (eq[2] - ep[2]) * t
        anzahl++
      }
      punktIndex[zelle(i, j, k)] = pos.length / 3
      pos.push(MIN[0] + (i + sx / anzahl) * ZELLE, MIN[1] + (j + sy / anzahl) * ZELLE, MIN[2] + (k + sz / anzahl) * ZELLE)
    }

const indizes = []
const viereck = (a, b, c, d, umdrehen) => {
  if ([a, b, c, d].some(x => x < 0)) return
  if (umdrehen) indizes.push(a, c, b, a, d, c)
  else indizes.push(a, b, c, a, c, d)
}
for (let k = 1; k < nz; k++)
  for (let j = 1; j < ny; j++)
    for (let i = 1; i < nx; i++) {
      const innen = werte[knoten(i, j, k)] <= 0
      // Kante entlang x, y, z ab Knoten (i,j,k)
      if (innen !== werte[knoten(i + 1, j, k)] <= 0)
        viereck(punktIndex[zelle(i, j - 1, k - 1)], punktIndex[zelle(i, j, k - 1)], punktIndex[zelle(i, j, k)], punktIndex[zelle(i, j - 1, k)], !innen)
      if (innen !== werte[knoten(i, j + 1, k)] <= 0)
        viereck(punktIndex[zelle(i - 1, j, k - 1)], punktIndex[zelle(i - 1, j, k)], punktIndex[zelle(i, j, k)], punktIndex[zelle(i, j, k - 1)], !innen)
      if (innen !== werte[knoten(i, j, k + 1)] <= 0)
        viereck(punktIndex[zelle(i - 1, j - 1, k)], punktIndex[zelle(i, j - 1, k)], punktIndex[zelle(i, j, k)], punktIndex[zelle(i - 1, j, k)], !innen)
    }

// ── Auf die Oberfläche ziehen, Normalen, Regionen ─────────────────────
const anzahlPunkte = pos.length / 3
const normalen = new Float32Array(pos.length)
const regionen = new Uint8Array(anzahlPunkte)
const anteile = new Uint8Array(anzahlPunkte)
const E = 0.0008
const gradient = (x, y, z) => {
  const gx = abstand(x + E, y, z) - abstand(x - E, y, z)
  const gy = abstand(x, y + E, z) - abstand(x, y - E, z)
  const gz = abstand(x, y, z + E) - abstand(x, y, z - E)
  const l = len(gx, gy, gz) || 1
  return [gx / l, gy / l, gz / l]
}
for (let p = 0; p < anzahlPunkte; p++) {
  let x = pos[p * 3], y = pos[p * 3 + 1], z = pos[p * 3 + 2]
  // Zwei Newton-Schritte genau auf die Fläche — die gemittelten
  // Kantenschnitte liegen sonst um Bruchteile einer Zelle daneben.
  for (let s = 0; s < 2; s++) {
    const d = abstand(x, y, z)
    const [gx, gy, gz] = gradient(x, y, z)
    x -= gx * d; y -= gy * d; z -= gz * d
  }
  pos[p * 3] = x; pos[p * 3 + 1] = y; pos[p * 3 + 2] = z
  const n = gradient(x, y, z)
  normalen.set(n, p * 3)
  const r = region(x, y, z)
  regionen[p] = r.region
  anteile[p] = Math.round(r.anteil * 255)
}

// ── Schreiben ─────────────────────────────────────────────────────────
const box = [[Infinity, Infinity, Infinity], [-Infinity, -Infinity, -Infinity]]
for (let p = 0; p < anzahlPunkte; p++)
  for (let a = 0; a < 3; a++) {
    box[0][a] = Math.min(box[0][a], pos[p * 3 + a])
    box[1][a] = Math.max(box[1][a], pos[p * 3 + a])
  }
if (anzahlPunkte > 65535) throw new Error(`${anzahlPunkte} Punkte — zu viele für 16-Bit-Indizes, ZELLE vergrößern`)
const kopf = 40
const groessePos = anzahlPunkte * 6
const groesseNorm = anzahlPunkte * 3
const ohneIndizes = kopf + groessePos + groesseNorm + anzahlPunkte * 2
const aufgefuellt = Math.ceil(ohneIndizes / 2) * 2
const puffer = Buffer.alloc(aufgefuellt + indizes.length * 2)
puffer.write('BPK3', 0, 'ascii')
puffer.writeUInt16LE(1, 4)
puffer.writeUInt16LE(REGIONEN.length, 6)
puffer.writeUInt32LE(anzahlPunkte, 8)
puffer.writeUInt32LE(indizes.length, 12)
for (let a = 0; a < 3; a++) {
  puffer.writeFloatLE(box[0][a], 16 + a * 4)
  puffer.writeFloatLE(box[1][a], 28 + a * 4)
}
let o = kopf
for (let p = 0; p < anzahlPunkte; p++)
  for (let a = 0; a < 3; a++, o += 2)
    puffer.writeUInt16LE(Math.round(((pos[p * 3 + a] - box[0][a]) / (box[1][a] - box[0][a])) * 65535), o)
for (let p = 0; p < anzahlPunkte * 3; p++, o++) puffer.writeInt8(Math.round(normalen[p] * 127), o)
for (let p = 0; p < anzahlPunkte; p++, o++) puffer.writeUInt8(regionen[p], o)
for (let p = 0; p < anzahlPunkte; p++, o++) puffer.writeUInt8(anteile[p], o)
o = aufgefuellt
for (const i of indizes) {
  puffer.writeUInt16LE(i, o)
  o += 2
}
mkdirSync(new URL('../public/modelle/', import.meta.url), { recursive: true })
writeFileSync(new URL('../public/modelle/koerper3d.bin', import.meta.url), puffer)
console.error(`${anzahlPunkte} Punkte, ${indizes.length / 3} Dreiecke, ${(puffer.length / 1024).toFixed(0)} KB in ${((Date.now() - start) / 1000).toFixed(1)} s`)

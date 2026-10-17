/** Das 3D-Körpermodell als reine Daten — Formen, Lagen, Größen. Gerendert
    wird in Koerper3D.tsx; hier steht nichts, was WebGL braucht, damit sich
    das Modell ohne Grafikkarte prüfen lässt.

    Stilisiert statt anatomisch: glatte Ellipsoide und Kapseln, je
    Muskelregion eine eigene Form. Die Regionen sind dieselben 22 Schlüssel
    wie im flachen Modell (koerperModell.ts), damit muskelHitze() beide
    gleichermaßen einfärbt.

    Koordinaten in Metern, Füße auf y = 0, Blick nach +z. Die linke
    Körperseite liegt bei +x — von vorn gesehen also rechts im Bild. */

export type Vec3 = readonly [number, number, number]

export interface Form {
  /** Ellipsoid: Mitte und drei Halbachsen. Kapsel: Strecke a–b mit Radius. */
  art: 'ellipsoid' | 'kapsel'
  mitte?: Vec3
  radien?: Vec3
  a?: Vec3
  b?: Vec3
  radius?: number
  /** Richtung der langen (y-)Achse eines Ellipsoids, z. B. entlang eines
      Oberarms. Fehlt sie, steht das Ellipsoid aufrecht. */
  achse?: Vec3
}

export interface MuskelForm extends Form {
  /** Region im Sinne von koerperModell.ts / muskelHitze.ts. */
  region: string
}

/** Für die paarigen Teile: dieselbe Form auf der anderen Körperseite. */
function gespiegelt<T extends Form>(f: T): T {
  const m = (v?: Vec3): Vec3 | undefined => (v ? [-v[0], v[1], v[2]] : undefined)
  return { ...f, mitte: m(f.mitte), a: m(f.a), b: m(f.b), achse: m(f.achse) }
}

const beide = <T extends Form>(f: T): T[] => [f, gespiegelt(f)]

// Gelenkpunkte der linken Körperseite (+x); die rechte entsteht gespiegelt.
const SCHULTER: Vec3 = [0.23, 1.38, 0]
const ELLBOGEN: Vec3 = [0.27, 1.1, 0]
const HANDGELENK: Vec3 = [0.3, 0.85, 0.02]
const HUEFTE: Vec3 = [0.095, 0.93, 0]
const KNIE: Vec3 = [0.105, 0.52, 0]
const KNOECHEL: Vec3 = [0.105, 0.1, 0]

const richtung = (a: Vec3, b: Vec3): Vec3 => [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
const OBERARM = richtung(ELLBOGEN, SCHULTER)
const UNTERARM = richtung(HANDGELENK, ELLBOGEN)
const OBERSCHENKEL = richtung(KNIE, HUEFTE)
const UNTERSCHENKEL = richtung(KNOECHEL, KNIE)

/** Der neutrale Körper, auf dem die Muskeln liegen. */
export const GRUNDKOERPER: readonly Form[] = [
  { art: 'ellipsoid', mitte: [0, 1.62, 0], radien: [0.095, 0.115, 0.105] }, // Kopf
  { art: 'kapsel', a: [0, 1.46, -0.005], b: [0, 1.55, 0], radius: 0.05 }, // Hals
  { art: 'ellipsoid', mitte: [0, 1.25, 0], radien: [0.2, 0.27, 0.12] }, // Rumpf
  { art: 'ellipsoid', mitte: [0, 1.08, 0], radien: [0.15, 0.14, 0.1] }, // Taille
  { art: 'ellipsoid', mitte: [0, 0.97, 0], radien: [0.17, 0.12, 0.11] }, // Becken
  ...beide({ art: 'ellipsoid', mitte: [0.215, 1.4, 0], radien: [0.06, 0.06, 0.06] } as Form), // Schultergelenk
  ...beide({ art: 'kapsel', a: SCHULTER, b: ELLBOGEN, radius: 0.048 } as Form),
  ...beide({ art: 'kapsel', a: ELLBOGEN, b: HANDGELENK, radius: 0.04 } as Form),
  ...beide({ art: 'ellipsoid', mitte: [0.305, 0.79, 0.02], radien: [0.03, 0.05, 0.02] } as Form), // Hand
  ...beide({ art: 'kapsel', a: HUEFTE, b: KNIE, radius: 0.075 } as Form),
  ...beide({ art: 'kapsel', a: KNIE, b: KNOECHEL, radius: 0.052 } as Form),
  ...beide({ art: 'ellipsoid', mitte: [0.105, 0.04, 0.04], radien: [0.04, 0.03, 0.09] } as Form), // Fuß
  ...beide({ art: 'ellipsoid', mitte: [0.105, 0.51, 0.05], radien: [0.045, 0.045, 0.04] } as Form), // Knie
]

/** Die Muskeln, je eine Form pro Region und Seite. Mitten und Halbachsen
    sind so gewählt, dass jede Form ein Stück aus dem Grundkörper ragt —
    sonst verschwände sie in ihm und bliebe trotz Farbe unsichtbar. */
export const MUSKELN: readonly MuskelForm[] = [
  ...beide<MuskelForm>({ region: 'chest', art: 'ellipsoid', mitte: [0.085, 1.325, 0.098], radien: [0.1, 0.072, 0.036] }),
  ...beide<MuskelForm>({ region: 'front-deltoids', art: 'ellipsoid', mitte: [0.22, 1.4, 0.026], radien: [0.064, 0.074, 0.05] }),
  ...beide<MuskelForm>({ region: 'back-deltoids', art: 'ellipsoid', mitte: [0.22, 1.4, -0.026], radien: [0.064, 0.074, 0.05] }),
  ...beide<MuskelForm>({ region: 'biceps', art: 'ellipsoid', mitte: [0.252, 1.24, 0.03], radien: [0.04, 0.1, 0.035], achse: OBERARM }),
  ...beide<MuskelForm>({ region: 'triceps', art: 'ellipsoid', mitte: [0.255, 1.24, -0.035], radien: [0.042, 0.1, 0.035], achse: OBERARM }),
  ...beide<MuskelForm>({ region: 'forearm', art: 'ellipsoid', mitte: [0.286, 0.98, 0.03], radien: [0.042, 0.1, 0.036], achse: UNTERARM }),
  // Der gerade Bauchmuskel als zwei lange Hälften links und rechts der
  // Mittellinie — sechs einzelne Kugeln sahen aus wie Perlen.
  ...beide<MuskelForm>({ region: 'abs', art: 'ellipsoid', mitte: [0.04, 1.11, 0.094], radien: [0.042, 0.135, 0.03] }),
  ...beide<MuskelForm>({ region: 'obliques', art: 'ellipsoid', mitte: [0.123, 1.09, 0.07], radien: [0.046, 0.095, 0.036] }),
  { region: 'trapezius', art: 'ellipsoid', mitte: [0, 1.44, -0.058], radien: [0.16, 0.075, 0.045] },
  ...beide<MuskelForm>({ region: 'upper-back', art: 'ellipsoid', mitte: [0.105, 1.27, -0.086], radien: [0.1, 0.14, 0.038] }),
  ...beide<MuskelForm>({ region: 'lower-back', art: 'ellipsoid', mitte: [0.042, 1.075, -0.093], radien: [0.045, 0.09, 0.03] }),
  ...beide<MuskelForm>({ region: 'gluteal', art: 'ellipsoid', mitte: [0.085, 0.93, -0.083], radien: [0.088, 0.085, 0.055] }),
  ...beide<MuskelForm>({ region: 'quadriceps', art: 'ellipsoid', mitte: [0.1, 0.73, 0.036], radien: [0.076, 0.19, 0.046], achse: OBERSCHENKEL }),
  ...beide<MuskelForm>({ region: 'hamstring', art: 'ellipsoid', mitte: [0.1, 0.73, -0.036], radien: [0.07, 0.18, 0.046], achse: OBERSCHENKEL }),
  ...beide<MuskelForm>({ region: 'adductor', art: 'ellipsoid', mitte: [0.045, 0.8, 0], radien: [0.04, 0.11, 0.055], achse: OBERSCHENKEL }),
  ...beide<MuskelForm>({ region: 'abductors', art: 'ellipsoid', mitte: [0.165, 0.92, 0], radien: [0.035, 0.06, 0.06] }),
  ...beide<MuskelForm>({ region: 'calves', art: 'ellipsoid', mitte: [0.105, 0.36, -0.035], radien: [0.05, 0.1, 0.045], achse: UNTERSCHENKEL }),
  { region: 'left-soleus', art: 'ellipsoid', mitte: [0.105, 0.22, -0.03], radien: [0.04, 0.07, 0.035], achse: UNTERSCHENKEL },
  gespiegelt<MuskelForm>({ region: 'right-soleus', art: 'ellipsoid', mitte: [0.105, 0.22, -0.03], radien: [0.04, 0.07, 0.035], achse: UNTERSCHENKEL }),
]

/** Deutsche Namen der Regionen, für die Anzeige beim Antippen. */
export const REGION_NAMEN: Record<string, string> = {
  chest: 'Brust',
  'front-deltoids': 'Vordere Schulter',
  'back-deltoids': 'Hintere Schulter',
  biceps: 'Bizeps',
  triceps: 'Trizeps',
  forearm: 'Unterarm',
  abs: 'Bauch',
  obliques: 'Seitliche Bauchmuskeln',
  trapezius: 'Trapez',
  'upper-back': 'Oberer Rücken',
  'lower-back': 'Unterer Rücken',
  gluteal: 'Gesäß',
  quadriceps: 'Quadrizeps',
  hamstring: 'Beinbeuger',
  adductor: 'Adduktoren',
  abductors: 'Abduktoren',
  calves: 'Waden',
  'left-soleus': 'Schollenmuskel links',
  'right-soleus': 'Schollenmuskel rechts',
}

/** Feste Reihenfolge der Regionen. Das vorberechnete Netz
    (public/modelle/koerper3d.bin) speichert je Punkt nur die Nummer der
    Region in dieser Liste — wer sie umsortiert, muss das Netz neu erzeugen
    (werkzeuge/koerper3d-netz.mjs). */
export const REGIONEN: readonly string[] = [...new Set(MUSKELN.map(m => m.region))]

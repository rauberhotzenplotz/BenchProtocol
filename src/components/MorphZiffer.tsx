import { useLayoutEffect, useRef } from 'react'

/* ── Ziffern als Vektor-Züge ──────────────────────────────────────
   Jede Ziffer ist ein einzelner, durchgehender Strich — als Kette von
   Stützpunkten in einem 100×160-Raster beschrieben, nicht als fertiger
   SVG-Pfad. Der Grund: für weiches Morphing müssen Anfangs- und Zielform
   dieselbe Punktzahl haben und ihre Punkte einander der Reihe nach
   entsprechen. Beides stellt der Code selbst her (neuAbtasten), statt es
   in handgeschriebenen Pfad-Strings mühsam von Hand gleichziehen zu
   müssen.

   Geschlossene Formen (0, 8) enden schlicht dort, wo sie beginnen — so
   ist jede Ziffer ein offener Linienzug und das Morphing zwischen offen
   und geschlossen braucht keinen Sonderfall. */

type Punkt = [number, number]

/** Stützpunkte für die 0 — als Ellipse gerechnet statt abgetippt. Der
    Zug beginnt oben in der Mitte und endet dort wieder. */
function ellipse(cx: number, cy: number, rx: number, ry: number, n = 32): Punkt[] {
  const punkte: Punkt[] = Array.from({ length: n }, (_, i) => {
    const w = (i / n) * Math.PI * 2 - Math.PI / 2
    return [cx + rx * Math.cos(w), cy + ry * Math.sin(w)]
  })
  punkte.push([...punkte[0]] as Punkt)
  return punkte
}

const SKELETTE: Record<string, Punkt[]> = {
  '0': ellipse(50, 80, 33, 63),
  '1': [[26, 46], [50, 17], [50, 143]],
  '2': [[17, 50], [20, 32], [34, 18], [56, 16], [75, 26], [80, 48], [70, 70], [46, 94], [19, 143], [84, 143]],
  '3': [[20, 36], [31, 20], [54, 14], [74, 24], [76, 46], [58, 66], [46, 69], [64, 73], [79, 90], [80, 116], [66, 138], [40, 146], [18, 131]],
  '4': [[64, 143], [64, 17], [16, 106], [84, 106]],
  '5': [[79, 18], [30, 18], [25, 66], [48, 58], [70, 66], [81, 92], [75, 122], [52, 144], [27, 138], [16, 120]],
  '6': [[74, 22], [52, 25], [34, 40], [24, 66], [21, 96], [26, 122], [42, 141], [64, 143], [78, 127], [79, 104], [66, 86], [44, 84], [28, 95], [22, 110]],
  '7': [[17, 19], [83, 19], [40, 143]],
  '8': [
    [50, 79], [28, 68], [23, 44], [33, 23], [52, 16], [70, 24], [77, 45], [70, 68],
    [50, 79], [27, 90], [19, 114], [29, 137], [50, 145], [71, 137], [81, 114], [72, 90], [50, 79],
  ],
  '9': [[26, 138], [48, 135], [66, 120], [76, 94], [79, 64], [74, 38], [58, 19], [36, 17], [22, 33], [21, 56], [34, 74], [56, 76], [72, 65], [78, 50]],
}

/** Punkte je Ziffer nach dem Neu-Abtasten. Mehr Punkte heißt weicheres
    Morphing und treuere Ecken, kostet aber pro Bild etwas Rechenzeit. */
const PUNKTZAHL = 30

/** Legt gleichmäßig verteilte Punkte auf einen Linienzug — damit hat
    jede Ziffer am Ende exakt dieselbe Punktzahl, und Punkt i der einen
    Form entspricht der gleichen relativen Position auf der anderen. */
function neuAbtasten(roh: Punkt[], n: number): Punkt[] {
  const laengen: number[] = []
  for (let i = 0; i < roh.length - 1; i++) {
    laengen.push(Math.hypot(roh[i + 1][0] - roh[i][0], roh[i + 1][1] - roh[i][1]))
  }
  const gesamt = laengen.reduce((s, l) => s + l, 0)
  if (gesamt === 0) return Array.from({ length: n }, () => [...roh[0]] as Punkt)

  const raus: Punkt[] = []
  let seg = 0
  let davor = 0
  for (let i = 0; i < n; i++) {
    const ziel = (gesamt * i) / (n - 1)
    while (seg < laengen.length - 1 && davor + laengen[seg] < ziel) {
      davor += laengen[seg]
      seg++
    }
    const t = laengen[seg] > 0 ? (ziel - davor) / laengen[seg] : 0
    const a = roh[seg]
    const b = roh[seg + 1]
    raus.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])
  }
  return raus
}

const ZIFFERN: Record<string, Punkt[]> = Object.fromEntries(
  Object.entries(SKELETTE).map(([z, p]) => [z, neuAbtasten(p, PUNKTZAHL)]),
)

/** Dieselben Ziffern rückwärts durchlaufen. Gezeichnet sieht das exakt
    gleich aus — nur die Reihenfolge der Punkte dreht sich um. Genau das
    braucht das Morphing: laufen zwei Ziffern gegenläufig (die 0 von oben
    im Uhrzeigersinn, die 9 von ihrem Fuß aufwärts), müssten die Punkte
    quer durcheinander wandern und die Form klappt unterwegs in sich
    zusammen. Mit der passenden Richtung nehmen alle Punkte den kurzen Weg. */
const ZIFFERN_RUECK: Record<string, Punkt[]> = Object.fromEntries(
  Object.entries(ZIFFERN).map(([z, p]) => [z, [...p].reverse()]),
)

function wanderung(a: Punkt[], b: Punkt[]): number {
  let summe = 0
  for (let i = 0; i < a.length; i++) {
    summe += (a[i][0] - b[i][0]) ** 2 + (a[i][1] - b[i][1]) ** 2
  }
  return summe
}

/** 0 und 8 enden dort, wo sie beginnen — bei ihnen ist der Startpunkt
    frei auf der Form verschiebbar, ohne dass sich am Gezeichneten etwas
    ändert. Das ist der zweite Freiheitsgrad neben der Laufrichtung. */
function istSchleife(p: Punkt[]): boolean {
  return Math.hypot(p[0][0] - p[p.length - 1][0], p[0][1] - p[p.length - 1][1]) < 0.5
}

function verschoben(p: Punkt[], k: number): Punkt[] {
  const n = p.length - 1
  const raus: Punkt[] = Array.from({ length: n }, (_, i) => [...p[(i + k) % n]] as Punkt)
  raus.push([...raus[0]] as Punkt)
  return raus
}

/** Weiche Kurve durch alle Punkte (Catmull-Rom als Bézier geschrieben) —
    ohne das Glätten sähe der Zug aus 30 Einzelpunkten kantig aus. */
function pfad(p: Punkt[]): string {
  const n = p.length
  const hole = (i: number) => p[Math.max(0, Math.min(n - 1, i))]
  let d = `M${p[0][0].toFixed(1)} ${p[0][1].toFixed(1)}`
  for (let i = 0; i < n - 1; i++) {
    const p0 = hole(i - 1)
    const p1 = hole(i)
    const p2 = hole(i + 1)
    const p3 = hole(i + 2)
    const c1x = p1[0] + (p2[0] - p0[0]) / 6
    const c1y = p1[1] + (p2[1] - p0[1]) / 6
    const c2x = p2[0] - (p3[0] - p1[0]) / 6
    const c2y = p2[1] - (p3[1] - p1[1]) / 6
    d += `C${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`
  }
  return d
}

const DAUER = 480

function bewegungAn(): boolean {
  if (document.documentElement.dataset.motion === 'off') return false
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function weich(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

/** Eine Ziffernstelle, die sich beim Wechsel in die nächste verformt,
    statt zu springen oder auszublenden.

    Der Pfad wird ausschließlich im Effekt gesetzt, nie über JSX: der
    Timer rendert im Sekundentakt neu, auch für Stellen, die sich gar
    nicht ändern. Käme das d-Attribut aus dem Rendern, malte React dabei
    kurz die Zielform, bevor die Animation wieder an den Anfang springt.
    Nebenbei bleibt so jedes Einzelbild ein reiner DOM-Zugriff statt eines
    React-Renders — das hält die Bewegung auch auf dem Handy flüssig. */
export function MorphZiffer({ zeichen }: { zeichen: string }) {
  const pfadRef = useRef<SVGPathElement>(null)
  const standRef = useRef<Punkt[] | null>(null)
  const rafRef = useRef(0)

  useLayoutEffect(() => {
    const vorwaerts = ZIFFERN[zeichen] ?? ZIFFERN['0']

    const setzen = (punkte: Punkt[]) => {
      standRef.current = punkte
      pfadRef.current?.setAttribute('d', pfad(punkte))
    }

    // Beim ersten Aufbau gibt es keine Vorgängerform zum Verformen.
    if (standRef.current == null || !bewegungAn()) {
      setzen(vorwaerts)
      return
    }

    // Vom aktuell gezeichneten Stand aus starten, nicht von der vorigen
    // Zielform — sonst würde ein Wechsel mitten in der Bewegung springen.
    const stand = standRef.current.map(p => [...p] as Punkt)
    const rueckwaerts = ZIFFERN_RUECK[zeichen] ?? ZIFFERN_RUECK['0']

    // Unter allen Varianten, die dasselbe zeichnen, die mit dem kürzesten
    // Gesamtweg wählen: Laufrichtung des Ziels und — bei geschlossenen
    // Formen — der Startpunkt auf dem Ring. Sonst wandern die Punkte quer
    // übereinander und die Ziffer klappt unterwegs sichtbar zusammen.
    const staende = istSchleife(stand)
      ? Array.from({ length: stand.length - 1 }, (_, k) => verschoben(stand, k))
      : [stand]
    let start = stand
    let ziel = vorwaerts
    let kuerzester = Infinity
    for (const s of staende) {
      for (const z of [vorwaerts, rueckwaerts]) {
        const weg = wanderung(s, z)
        if (weg < kuerzester) {
          kuerzester = weg
          start = s
          ziel = z
        }
      }
    }

    const t0 = performance.now()
    const schritt = (jetzt: number) => {
      const roh = Math.min(1, (jetzt - t0) / DAUER)
      const e = weich(roh)
      setzen(start.map((p, i) => [p[0] + (ziel[i][0] - p[0]) * e, p[1] + (ziel[i][1] - p[1]) * e] as Punkt))
      if (roh < 1) rafRef.current = requestAnimationFrame(schritt)
    }
    rafRef.current = requestAnimationFrame(schritt)
    return () => cancelAnimationFrame(rafRef.current)
  }, [zeichen])

  return (
    <svg className="gym-ziffer" viewBox="0 0 100 160" aria-hidden="true">
      <path ref={pfadRef} />
    </svg>
  )
}

export function MorphDoppelpunkt() {
  return (
    <svg className="gym-doppelpunkt" viewBox="0 0 34 160" aria-hidden="true">
      <circle cx="17" cy="57" r="8" />
      <circle cx="17" cy="113" r="8" />
    </svg>
  )
}

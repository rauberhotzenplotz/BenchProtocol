import { useEffect, useRef, useState } from 'react'
import {
  ACESFilmicToneMapping,
  AmbientLight,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  PerspectiveCamera,
  Raycaster,
  Scene,
  SRGBColorSpace,
  Vector2,
  WebGLRenderer,
} from 'three'
import { REGIONEN, REGION_NAMEN } from './koerper3dModell'
import { netzLesen, type KoerperNetz } from './koerper3dNetz'
import { frischeVon, hitzeFarbe, type FlaechenHitze } from './muskelHitze'

/* Das Körpermodell in 3D — drehbar per Wischen, mit Nachlauf.

   Die Figur ist ein einziges glattes Netz, vorberechnet von
   werkzeuge/koerper3d-netz.mjs. Jeder Punkt weiß, zu welcher Muskelregion
   er gehört und wie stark; die Hitze wird als Punktfarbe auf diese Haut
   gemalt und läuft zum Rand jeder Region weich in den Körper aus.

   Gezeichnet wird nur, solange sich etwas bewegt: beim Ziehen, während
   des Nachlaufs, beim Einblenden und nach einer Änderung. Danach steht die
   Szene, und die Grafikkarte hat Pause — ein Statistik-Tab soll den Akku
   nicht leeren, nur weil er offen ist.

   Wischen nach links/rechts dreht, nach oben/unten scrollt weiter die
   Seite (touch-action: pan-y). Ohne diese Trennung bliebe der Daumen auf
   dem Modell hängen, sobald man an ihm vorbei nach unten will. */

const GRUND_FARBE = '#3a3a45'
const OHNE_DATEN_FARBE = '#4a4a56'
const AKZENT = '#40d6c7'

/** Wie stark ein Muskel von innen leuchtet — frischer Reiz und viel Arbeit
    leuchten mehr. Dieselbe Rechnung wie im flachen Modell
    (MuskelHeatmap.tsx), auf das Licht einer 3D-Fläche übertragen. */
function glutVon(h: FlaechenHitze): number {
  const frisch = frischeVon(h.tage)
  const last = Math.min(1, h.saetze / 10)
  return (0.05 + frisch * 0.34) * (0.55 + last * 0.45)
}

function tageText(tage: number): string {
  if (tage < 1) return 'heute'
  if (tage < 2) return 'gestern'
  return `vor ${Math.floor(tage)} Tagen`
}

/** Weicher Kontaktschatten unter den Füßen: ein radialer Verlauf auf
    einer Scheibe statt echter Schattenberechnung — sieht ruhiger aus und
    kostet nichts. */
function schattenTextur(): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const verlauf = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  verlauf.addColorStop(0, 'rgba(0,0,0,0.55)')
  verlauf.addColorStop(0.55, 'rgba(0,0,0,0.22)')
  verlauf.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = verlauf
  g.fillRect(0, 0, 128, 128)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return t
}

/** Das Netz wird einmal geladen und dann behalten — auch über ein
    Verlassen und Wiederkehren des Tabs hinweg. Der Abruf startet schon,
    wenn dieses Modul geladen wird, also parallel zum Aufbau der Karte. */
let netzVersprechen: Promise<KoerperNetz> | null = null
function netzLaden(): Promise<KoerperNetz> {
  netzVersprechen ??= fetch(`${import.meta.env.BASE_URL}modelle/koerper3d.bin`)
    .then(r => {
      if (!r.ok) throw new Error(`Netz nicht geladen: ${r.status}`)
      return r.arrayBuffer()
    })
    .then(netzLesen)
  netzVersprechen.catch(() => (netzVersprechen = null))
  return netzVersprechen
}
netzLaden()

interface Props {
  flaechen: Map<string, FlaechenHitze>
  /** WebGL steht nicht zur Verfügung — der Aufrufer zeigt dann das flache
      Modell. */
  onFehler: () => void
}

export default function Koerper3D({ flaechen, onFehler }: Props) {
  const behaelter = useRef<HTMLDivElement>(null)
  const [auswahl, setAuswahl] = useState<string | null>(null)
  // Brücke von React in die Szene: Die Szene lebt außerhalb des
  // Render-Zyklus, React gibt ihr nur Daten und Befehle.
  const szene = useRef<{
    faerben: (f: Map<string, FlaechenHitze>, auswahl: string | null) => void
    drehenNach: (ziel: number) => void
  } | null>(null)

  useEffect(() => {
    const el = behaelter.current
    if (!el) return

    let renderer: WebGLRenderer
    try {
      renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' })
    } catch {
      onFehler()
      return
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.outputColorSpace = SRGBColorSpace
    renderer.toneMapping = ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    el.appendChild(renderer.domElement)

    const scene = new Scene()
    const kamera = new PerspectiveCamera(26, 1, 0.1, 20)
    kamera.position.set(0, 0.98, 4.2)
    kamera.lookAt(0, 0.89, 0)

    scene.add(new AmbientLight('#ffffff', 0.12))
    scene.add(new HemisphereLight('#dfe6ff', '#121216', 0.55))
    const fuehrung = new DirectionalLight('#ffffff', 1.25)
    fuehrung.position.set(2.4, 3.2, 3)
    scene.add(fuehrung)
    const fuell = new DirectionalLight('#a7b0ff', 0.32)
    fuell.position.set(-3, 1.2, 2)
    scene.add(fuell)
    // Kantenlicht von hinten in der Akzentfarbe: zeichnet die Silhouette
    // gegen den dunklen Kartengrund nach.
    const kante = new DirectionalLight(AKZENT, 1.6)
    kante.position.set(-1.5, 2.2, -3.2)
    scene.add(kante)
    const kante2 = new DirectionalLight(AKZENT, 0.9)
    kante2.position.set(1.8, 1.4, -3)
    scene.add(kante2)

    const figur = new Group()
    scene.add(figur)

    const material = new MeshPhysicalMaterial({
      vertexColors: true,
      roughness: 0.5,
      metalness: 0.03,
      clearcoat: 0.32,
      clearcoatRoughness: 0.55,
    })
    const geometrie = new BufferGeometry()
    let netz: KoerperNetz | null = null
    let farben: Float32Array | null = null
    let koerper: Mesh | null = null
    let abgebaut = false
    // Zuletzt gewünschte Färbung — kommt sie, bevor das Netz da ist, wird
    // sie nach dem Laden nachgeholt.
    let faerbung: { f: Map<string, FlaechenHitze>; gewaehlt: string | null } | null = null

    const textur = schattenTextur()
    const schatten = new Mesh(
      new CircleGeometry(0.5, 48),
      new MeshBasicMaterial({ map: textur, transparent: true, depthWrite: false }),
    )
    schatten.rotation.x = -Math.PI / 2
    schatten.position.y = 0.002
    scene.add(schatten)

    // ── Zeichnen auf Abruf ──────────────────────────────────────────
    let drehY = 0
    let neigung = 0
    let tempo = 0
    let ziel: number | null = null
    let rahmen = 0
    let zieht = false

    const bild = () => {
      rahmen = 0
      let weiter = false
      if (ziel != null) {
        // Weich zum Ziel (Vorn/Hinten-Knopf, Einblenden).
        const rest = ziel - drehY
        drehY += rest * 0.14
        if (Math.abs(rest) < 0.0015) {
          drehY = ziel
          ziel = null
        } else weiter = true
      } else if (!zieht && Math.abs(tempo) > 0.0002) {
        drehY += tempo
        tempo *= 0.94
        weiter = true
      }
      if (!zieht && Math.abs(neigung) > 0.001) {
        // Die Neigung federt nach dem Loslassen zurück — gekippt bleiben
        // soll die Figur nicht.
        neigung *= 0.88
        weiter = true
      }
      figur.rotation.set(neigung, drehY, 0)
      renderer.render(scene, kamera)
      if (weiter) anfordern()
    }
    const anfordern = () => {
      if (!rahmen) rahmen = requestAnimationFrame(bild)
    }

    const groesse = () => {
      const breite = el.clientWidth
      const hoehe = Math.round(Math.min(440, breite * 1.18))
      renderer.setSize(breite, hoehe)
      kamera.aspect = breite / hoehe
      kamera.updateProjectionMatrix()
      anfordern()
    }
    const beobachter = new ResizeObserver(groesse)
    beobachter.observe(el)
    groesse()

    // ── Eingabe ─────────────────────────────────────────────────────
    const canvas = renderer.domElement
    let startX = 0
    let startY = 0
    let letztesX = 0
    let letztesY = 0
    let letzteZeit = 0
    let richtung: 'offen' | 'drehen' | 'scrollen' = 'offen'
    let zeigerId: number | null = null

    const runter = (e: PointerEvent) => {
      zeigerId = e.pointerId
      startX = letztesX = e.clientX
      startY = letztesY = e.clientY
      letzteZeit = e.timeStamp
      richtung = 'offen'
      tempo = 0
      ziel = null
    }
    const bewegt = (e: PointerEvent) => {
      if (e.pointerId !== zeigerId) return
      const dx = e.clientX - startX
      const dy = e.clientY - startY
      if (richtung === 'offen' && Math.hypot(dx, dy) > 6) {
        richtung = Math.abs(dx) > Math.abs(dy) ? 'drehen' : 'scrollen'
        if (richtung === 'drehen') {
          zieht = true
          canvas.setPointerCapture(e.pointerId)
        }
      }
      if (richtung !== 'drehen') return
      const schrittX = e.clientX - letztesX
      const schrittY = e.clientY - letztesY
      const dt = Math.max(1, e.timeStamp - letzteZeit)
      drehY += schrittX * 0.0105
      neigung = Math.max(-0.3, Math.min(0.3, neigung + schrittY * 0.004))
      // Tempo je Bild (16 ms) aus der letzten Bewegung — daraus wird der
      // Nachlauf, wenn der Finger loslässt.
      tempo = ((schrittX * 0.0105) / dt) * 16
      letztesX = e.clientX
      letztesY = e.clientY
      letzteZeit = e.timeStamp
      anfordern()
    }
    const raycaster = new Raycaster()
    const hoch = (e: PointerEvent) => {
      if (e.pointerId !== zeigerId) return
      zeigerId = null
      if (richtung === 'drehen') {
        zieht = false
        // Wer zum Stillstand gekommen ist, bevor er loslässt, will keinen
        // Nachlauf.
        if (e.timeStamp - letzteZeit > 80) tempo = 0
        anfordern()
        return
      }
      if (richtung !== 'offen') return
      // Antippen: welcher Muskel liegt unter dem Finger? Der Grundkörper
      // zählt mit — was hinter ihm liegt, ist nicht angetippt.
      const box = canvas.getBoundingClientRect()
      const punkt = new Vector2(((e.clientX - box.left) / box.width) * 2 - 1, -((e.clientY - box.top) / box.height) * 2 + 1)
      raycaster.setFromCamera(punkt, kamera)
      if (!koerper || !netz) return
      const treffer = raycaster.intersectObject(koerper, false)[0]
      const punktNr = treffer?.face?.a
      // Nur, wo die Region auch sichtbar ist — am ausgeblendeten Rand
      // zählt der Tipp als daneben.
      const nr = punktNr != null && netz.anteile[punktNr] > 0.35 ? netz.regionen[punktNr] : 255
      const region = nr === 255 ? null : REGIONEN[nr]
      setAuswahl(a => (a === region ? null : region))
    }
    const abbruch = (e: PointerEvent) => {
      if (e.pointerId !== zeigerId) return
      zeigerId = null
      zieht = false
      anfordern()
    }
    canvas.addEventListener('pointerdown', runter)
    canvas.addEventListener('pointermove', bewegt)
    canvas.addEventListener('pointerup', hoch)
    canvas.addEventListener('pointercancel', abbruch)

    szene.current = {
      faerben: (f, gewaehlt) => {
        faerbung = { f, gewaehlt }
        if (!netz || !farben) return
        const grund = new Color(GRUND_FARBE)
        const ohne = new Color(OHNE_DATEN_FARBE)
        const weiss = new Color('#ffffff')
        // Je Region einmal die Zielfarbe: Hitzefarbe, aufgehellt nach Glut —
        // ein frisch trainierter Muskel leuchtet heller als ein erholter.
        const ziel = REGIONEN.map(region => {
          const h = f.get(region)
          if (!h) return ohne.clone()
          const c = new Color(hitzeFarbe(h.tage))
          c.lerp(weiss, glutVon(h) * 0.35)
          if (gewaehlt && region !== gewaehlt) c.multiplyScalar(0.72)
          if (region === gewaehlt) c.lerp(weiss, 0.28)
          return c
        })
        // Wie deutlich eine Region überhaupt auf der Haut steht: frisch
        // Trainiertes voll, Erholtes nur als Tönung. Sonst trug ein seit
        // Tagen ruhender Körper überall dieselbe kräftige Farbe — wie ein
        // Anzug, nicht wie eine Belastungskarte.
        const deutlich = REGIONEN.map(region => {
          const h = f.get(region)
          return region === gewaehlt ? 1 : h ? 0.42 + 0.58 * frischeVon(h.tage) : 0.3
        })
        const gewaehltNr = gewaehlt ? REGIONEN.indexOf(gewaehlt) : -1
        for (let i = 0; i < netz.regionen.length; i++) {
          const r = netz.regionen[i]
          let a = r === 255 ? 0 : netz.anteile[i] * deutlich[r]
          // Die gewählte Region etwas weiter in den Körper auslaufen lassen,
          // damit sie sich deutlich abhebt.
          if (r === gewaehltNr) a = Math.min(1, a * 1.25)
          const c = r === 255 ? grund : ziel[r]
          farben[i * 3] = grund.r + (c.r - grund.r) * a
          farben[i * 3 + 1] = grund.g + (c.g - grund.g) * a
          farben[i * 3 + 2] = grund.b + (c.b - grund.b) * a
        }
        geometrie.getAttribute('color').needsUpdate = true
        anfordern()
      },
      drehenNach: z => {
        // Den kürzeren Weg nehmen, egal wie oft schon gedreht wurde.
        const voll = Math.PI * 2
        const basis = Math.round(drehY / voll) * voll
        const kandidaten = [basis + z - voll, basis + z, basis + z + voll]
        ziel = kandidaten.reduce((a, k) => (Math.abs(k - drehY) < Math.abs(a - drehY) ? k : a))
        tempo = 0
        anfordern()
      },
    }

    netzLaden()
      .then(n => {
        if (abgebaut) return
        netz = n
        geometrie.setAttribute('position', new BufferAttribute(n.positionen, 3))
        geometrie.setAttribute('normal', new BufferAttribute(n.normalen, 3))
        farben = new Float32Array(n.regionen.length * 3)
        geometrie.setAttribute('color', new BufferAttribute(farben, 3))
        geometrie.setIndex(new BufferAttribute(n.indizes, 1))
        geometrie.computeBoundingSphere()
        koerper = new Mesh(geometrie, material)
        figur.add(koerper)
        if (faerbung) szene.current?.faerben(faerbung.f, faerbung.gewaehlt)
        anfordern()
      })
      .catch(() => {
        if (!abgebaut) onFehler()
      })

    // Einblenden: eine halbe Vierteldrehung zurück in die Vorderansicht —
    // zeigt ohne Worte, dass sich hier etwas drehen lässt.
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      drehY = -0.7
      ziel = 0
    }
    anfordern()

    return () => {
      szene.current = null
      cancelAnimationFrame(rahmen)
      beobachter.disconnect()
      canvas.removeEventListener('pointerdown', runter)
      canvas.removeEventListener('pointermove', bewegt)
      canvas.removeEventListener('pointerup', hoch)
      canvas.removeEventListener('pointercancel', abbruch)
      abgebaut = true
      geometrie.dispose()
      material.dispose()
      schatten.geometry.dispose()
      ;(schatten.material as MeshBasicMaterial).dispose()
      textur.dispose()
      renderer.dispose()
      canvas.remove()
    }
    // onFehler wird nur beim Aufbau gebraucht; ein neuer Rückruf soll die
    // Szene nicht neu bauen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    szene.current?.faerben(flaechen, auswahl)
  }, [flaechen, auswahl])

  const gewaehlt = auswahl ? flaechen.get(auswahl) : undefined

  return (
    <div className="k3d">
      <div ref={behaelter} className="k3d-buehne" aria-label="Körpermodell, zum Drehen seitlich wischen" role="img" />
      <div className="k3d-leiste">
        <button type="button" className="k3d-knopf" onClick={() => szene.current?.drehenNach(0)}>
          Vorn
        </button>
        <span className="k3d-info" aria-live="polite">
          {auswahl ? (
            <>
              <b>{REGION_NAMEN[auswahl] ?? auswahl}</b>
              {/* Die Sätze zählen nur die letzten 7 Tage, der Zeitpunkt reicht
                  weiter zurück — ohne Sätze also "zuletzt vor …" statt
                  "0 Sätze · vor 16 Tagen". */}
              {!gewaehlt
                ? 'noch nie trainiert'
                : gewaehlt.saetze > 0
                  ? `${gewaehlt.saetze} ${gewaehlt.saetze === 1 ? 'Satz' : 'Sätze'} · ${tageText(gewaehlt.tage)}`
                  : `diese Woche nicht · zuletzt ${tageText(gewaehlt.tage)}`}
            </>
          ) : (
            'Wischen zum Drehen · Antippen für Details'
          )}
        </span>
        <button type="button" className="k3d-knopf" onClick={() => szene.current?.drehenNach(Math.PI)}>
          Hinten
        </button>
      </div>
    </div>
  )
}

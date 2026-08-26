import { useMemo, useState } from 'react'
import type { LoggedSet } from '../../types/db'
import type { DayWithExercises } from '../training/queries'
import { MODELL_VIEWBOX, VORDERSEITE, RUECKSEITE } from './koerperModell'
import { muskelHitze, frischeVon, hitzeFarbe, hitzeFarbeBlass, type FlaechenHitze } from './muskelHitze'

/** Flächen ohne eigene Daten — Kopf, Hals, Knie. Sie bleiben als blasse
    Kontur stehen, damit die Figur vollständig ist, statt Löcher zu haben. */
const OHNE_DATEN = new Set(['head', 'neck', 'knees'])

function Flaeche({ schluessel, punkte, hitze }: { schluessel: string; punkte: string[]; hitze?: FlaechenHitze }) {
  const polygone = punkte.map((p, i) => <polygon key={i} points={p} />)

  if (!hitze || OHNE_DATEN.has(schluessel)) {
    return <g className="mh-still">{polygone}</g>
  }

  const farbe = hitzeFarbe(hitze.tage)
  const frisch = frischeVon(hitze.tage)
  // Wie stark eine Fläche leuchtet, hängt an beidem: wie frisch der Reiz
  // war und wie viel Arbeit sie gesehen hat. Die Farbe allein trüge das
  // nicht — eine Gruppe mit zwei Sätzen soll nicht so brennen wie eine
  // mit zwölf.
  const last = Math.min(1, hitze.saetze / 10)
  const glut = (0.3 + frisch * 0.62) * (0.55 + last * 0.45)
  const fuellung = 0.2 + frisch * 0.42 + last * 0.12
  const takt = frisch > 0.65 ? ' frisch' : frisch > 0.3 ? ' mittel' : ''

  return (
    <>
      <g className={'mh-halo' + takt} style={{ color: farbe, opacity: glut }}>
        {polygone}
      </g>
      <g className="mh-flaeche" style={{ color: farbe, opacity: fuellung }}>
        {polygone}
      </g>
    </>
  )
}

function Koerper({ seite, flaechen }: { seite: 'vorn' | 'hinten'; flaechen: Map<string, FlaechenHitze> }) {
  const modell = seite === 'vorn' ? VORDERSEITE : RUECKSEITE
  return (
    <svg className="mh-koerper" viewBox={MODELL_VIEWBOX} aria-hidden="true">
      {Object.entries(modell).map(([schluessel, punkte]) => (
        <Flaeche key={schluessel} schluessel={schluessel} punkte={punkte} hitze={flaechen.get(schluessel)} />
      ))}
    </svg>
  )
}

/** Belastung und Erholung als eingefärbtes Körpermodell.

    Beide Größen stehen in den Daten, nichts ist geschätzt: Die Last sind
    die abgehakten Sätze der letzten Woche, die Erholung ist die Zeit seit
    dem letzten Haken. Frisch Gereiztes leuchtet magenta und kühlt über
    Violett zu einem hellen Blau aus.

    Das Modell selbst stammt aus react-body-highlighter (MIT, © 2020
    GV79) — siehe koerperModell.ts. */
export function MuskelHeatmap({
  days,
  allSets,
}: {
  days: DayWithExercises[]
  allSets: LoggedSet[]
}) {
  const [seite, setSeite] = useState<'vorn' | 'hinten'>('vorn')
  // Gemerkt, weil dafür alle je geloggten Sätze durchlaufen werden.
  const hitze = useMemo(() => muskelHitze(days, allSets), [days, allSets])

  if (hitze.gruppen.length === 0) {
    return (
      <div className="card mh-karte">
        <h3>
          <span className="tick" />
          Belastung &amp; Regeneration
        </h3>
        <p className="muted tiny" style={{ margin: 0 }}>
          Noch keine abgehakten Sätze mit Muskelgruppe. Sobald du Sätze abhakst, färbt sich das Modell
          nach dem, was zuletzt dran war.
        </p>
      </div>
    )
  }

  return (
    <div className="card mh-karte">
      <h3>
        <span className="tick" />
        Belastung &amp; Regeneration
        <span className="mh-zahl">
          {hitze.frischeGruppen} {hitze.frischeGruppen === 1 ? 'Gruppe' : 'Gruppen'} frisch
        </span>
      </h3>

      <div className="mh-buehne">
        <span className="mh-seite">{seite === 'vorn' ? 'Vorderseite' : 'Rückseite'}</span>
        <Koerper seite={seite} flaechen={hitze.flaechen} />
        <button
          type="button"
          className="mh-drehen"
          onClick={() => setSeite(s => (s === 'vorn' ? 'hinten' : 'vorn'))}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
          Drehen
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
      </div>

      <div className="mh-legende">
        <div className="mh-balken" />
        <div className="mh-enden">
          <span className="mh-ende frisch">
            <b>Frisch gereizt</b>
            heute trainiert
          </span>
          <span className="mh-ende erholt">
            <b>Erholt</b>
            eine Woche Ruhe
          </span>
        </div>
      </div>

      <div className="mh-gruppen">
        {hitze.gruppen.slice(0, 8).map(g => (
          <span key={g.name} className="mh-chip" style={{ borderColor: hitzeFarbeBlass(g.tage, 0.4) }}>
            {g.name} <b style={{ color: hitzeFarbe(g.tage) }}>{g.saetze}</b>
          </span>
        ))}
      </div>
    </div>
  )
}

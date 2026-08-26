import { useMemo } from 'react'
import type { LoggedSet } from '../../types/db'
import type { DayWithExercises } from '../training/queries'
import { gruppeSetsByExercise } from '../training/calc'
import { istSaetzeJeGruppeUndTag } from '../volume/calc'
import { druckZugBilanz } from './druckZug'
import { CountUp } from '../../components/CountUp'

const WARNTEXT: Record<'zu-wenig-zug' | 'zu-wenig-druck', string> = {
  'zu-wenig-zug':
    'Erhöhter Druck-Anteil. Mehr Zugsätze (Rücken, hintere Schulter) halten die Schultern hinten und beugen einer runden Haltung vor.',
  'zu-wenig-druck':
    'Deutlich mehr Zug als Druck. Für ein rundes Oberkörpertraining darf die Brust- und Schulterarbeit aufholen.',
}

/** Verhältnis von Drück- zu Zugsätzen — der laufenden Woche, und solange
    die noch leer ist, der Vorwoche.

    Entstanden aus einem Entwurf, der als sechsachsiges Netzdiagramm
    gedacht war ("Biomechanischer Radar"). Vier der sechs Achsen —
    Schulterstabilität, Haltungsbalance, hintere Delta-Aktivierung,
    Rumpf-Stabilität — lassen sich aus Satzprotokollen nicht ermitteln;
    sie hätten erfundene Zahlen im Gewand einer Messung gezeigt. Übrig
    bleiben die zwei belegbaren Größen, und für zwei Größen ist kein Netz
    die richtige Form, sondern eine Waage.

    Gezählt werden ausschließlich tatsächlich abgehakte Sätze, über
    dieselbe Tabelle, aus der auch das Volumen-Kontrollblatt lebt. Übungen
    ohne Muskelgruppe zählen nirgends mit — steht die Karte also niedriger
    als erwartet, fehlt vermutlich eine Zuordnung. */
export function DruckZugCard({
  days,
  setsByExercise,
  allSets,
  week,
}: {
  days: DayWithExercises[]
  setsByExercise: Map<string, LoggedSet[]>
  /** Alle je geloggten Sätze — gebraucht für den Rückfall auf die Vorwoche. */
  allSets: LoggedSet[]
  week: number
}) {
  const jetzt = druckZugBilanz(istSaetzeJeGruppeUndTag(days, setsByExercise))

  // Am Wochenanfang ist noch nichts abgehakt, und eine leere Karte so weit
  // oben im Cockpit wäre jeden Montag ein blinder Fleck. Dann steht hier
  // die Vorwoche — deutlich als solche gekennzeichnet, denn eine fremde
  // Woche als laufende auszugeben wäre schlimmer als gar keine Zahl.
  //
  // Gemerkt, weil dafür alle je geloggten Sätze durchlaufen werden. Der
  // Zweig greift ohnehin nur, solange die laufende Woche leer ist.
  const vorwoche = useMemo(() => {
    if (jetzt.punktzahl != null || week <= 1) return null
    const saetze = gruppeSetsByExercise(allSets.filter(s => s.week === week - 1))
    const b = druckZugBilanz(istSaetzeJeGruppeUndTag(days, saetze))
    return b.punktzahl == null ? null : b
  }, [jetzt.punktzahl, week, allSets, days])

  const bilanz = vorwoche ?? jetzt
  const ausVorwoche = vorwoche != null

  if (bilanz.punktzahl == null) {
    return (
      <div className="card dz-karte">
        <h3>
          <span className="tick" />
          Druck-Zug-Bilanz
        </h3>
        <p className="muted tiny" style={{ margin: 0 }}>
          Noch keine abgehakten Sätze — weder in dieser Woche noch in der Vorwoche. Sobald Brust-,
          Schulter- oder Rückenarbeit im Protokoll steht, steht hier das Verhältnis.
        </p>
      </div>
    )
  }

  const gesamt = bilanz.druecken + bilanz.ziehen
  const druckAnteil = (bilanz.druecken / gesamt) * 100
  const gutt = bilanz.lage === 'ausgeglichen'

  return (
    <div className={'card dz-karte' + (gutt ? '' : ' schief')}>
      <h3>
        <span className="tick" />
        Druck-Zug-Bilanz
        {ausVorwoche && <span className="dz-vorwoche">Vorwoche</span>}
        <span className="dz-punkte">
          <CountUp value={bilanz.punktzahl} decimals={1} />
          <u> / 10</u>
        </span>
      </h3>

      <div className="dz-koepfe">
        <span className="dz-kopf druck">
          <b>{bilanz.druecken}</b> Drücken
        </span>
        <span className="dz-kopf zug">
          Ziehen <b>{bilanz.ziehen}</b>
        </span>
      </div>

      {/* Die Waage: eine Leiste, zwei Waagschalen. Die Mittelmarke zeigt,
          wo ein ausgeglichenes Verhältnis läge — je weiter der Übergang
          davon abweicht, desto schiefer die Woche. */}
      <div
        className="dz-waage"
        role="img"
        aria-label={`${bilanz.druecken} Drücksätze gegen ${bilanz.ziehen} Zugsätze, Bilanz ${bilanz.punktzahl} von 10`}
      >
        <span className="dz-schale druck" style={{ width: `${druckAnteil}%` }} />
        <span className="dz-schale zug" style={{ width: `${100 - druckAnteil}%` }} />
        <span className="dz-mitte" aria-hidden="true" />
      </div>

      <div className="dz-gruppen">
        {bilanz.gruppen.map(g => (
          <span key={g.name} className={'dz-chip ' + (g.kette === 'druecken' ? 'druck' : 'zug')}>
            {g.name} <b>{g.saetze}</b>
          </span>
        ))}
      </div>

      {(bilanz.lage === 'zu-wenig-zug' || bilanz.lage === 'zu-wenig-druck') && (
        <div className="dz-warnung">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 4 L21 19 H3 Z" />
            <path d="M12 10v4" />
            <path d="M12 17h.01" />
          </svg>
          <p>
            <b>Warnung</b>
            {WARNTEXT[bilanz.lage]}
          </p>
        </div>
      )}
    </div>
  )
}

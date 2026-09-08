import { useMemo, useState } from 'react'
import { useActivePlan } from '../plans/active-plan-context'
import { useDays, useAllSetsForExercises, useAllSessionsForDays } from '../training/queries'
import { satzE1rm } from '../training/calc'
import { PlanPicker } from '../plans/PlanPicker'
import { formatGewicht } from '../../lib/zahlen'
import { cssVars } from '../../lib/style'
import { Liniendiagramm, Verteilung, Balkenreihe } from './Diagramme'
import {
  belastung,
  intensitaetsZonen,
  regression,
  schwerpunkt,
  serien,
  streuung,
  tonnage,
  uebungsAnteile,
  verwertbar,
  wiederholungsVerteilung,
  wochenReihe,
  wochentagsMuster,
} from './calc'

/** Zahl mit Tausenderpunkten, ohne Nachkommastellen. */
const ganz = (n: number) => Math.round(n).toLocaleString('de-DE')

/** Tonnage lesbar: unter 10 t in Kilogramm, darüber in Tonnen. Wer
    120 000 kg liest, zählt Stellen; wer 120 t liest, weiß es sofort. */
function tonnageText(kg: number): { wert: string; einheit: string } {
  return kg >= 10_000 ? { wert: (kg / 1000).toFixed(1).replace('.', ','), einheit: 't' } : { wert: ganz(kg), einheit: 'kg' }
}

function stunden(minuten: number): string {
  const h = Math.floor(minuten / 60)
  const m = Math.round(minuten % 60)
  // Kompakt als "1:46 h": Ausgeschrieben brach die Angabe in der
  // Kennzahlkachel auf zwei Zeilen um und riss die Reihe auseinander.
  return h ? `${h}:${String(m).padStart(2, '0')} h` : `${m} min`
}

/** "1 Woche" statt "1 Wochen". */
const wochenText = (n: number) => (n === 1 ? '1 Woche' : `${n} Wochen`)

function Kachel({ wert, einheit, label, hinweis }: { wert: string; einheit?: string; label: string; hinweis?: string }) {
  return (
    <div className="st-kachel" title={hinweis}>
      <div className="st-kachel-wert">
        {wert}
        {einheit && <em>{einheit}</em>}
      </div>
      <div className="st-kachel-lab">{label}</div>
    </div>
  )
}

function Karte({
  titel,
  unterzeile,
  kinder,
  fussnote,
  i,
}: {
  titel: string
  unterzeile?: string
  kinder: React.ReactNode
  fussnote?: string
  i: number
}) {
  return (
    <div className="card st-karte" style={cssVars({ '--i': i })}>
      <h3>
        <span className="tick" />
        {titel}
        {unterzeile && <span className="st-fenster">{unterzeile}</span>}
      </h3>
      {kinder}
      {fussnote && <p className="st-fuss">{fussnote}</p>}
    </div>
  )
}

export function StatistikPage() {
  const { activePlan } = useActivePlan()
  const { data: days } = useDays(activePlan?.id)
  const exerciseIds = (days ?? []).flatMap(d => d.exercises.map(ex => ex.id))
  const dayIds = (days ?? []).map(d => d.id)
  const bereich = activePlan?.id ?? 'ohne-plan'
  const { data: alleSaetze } = useAllSetsForExercises(exerciseIds, bereich)
  const { data: sessions } = useAllSessionsForDays(dayIds, bereich)

  const [gewaehlteUebung, setGewaehlteUebung] = useState<string | null>(null)

  const saetze = useMemo(() => alleSaetze ?? [], [alleSaetze])
  const einheiten = useMemo(() => sessions ?? [], [sessions])

  const namen = useMemo(() => {
    const m = new Map<string, string>()
    for (const t of days ?? []) for (const ex of t.exercises) m.set(ex.id, ex.name)
    return m
  }, [days])

  /** Bestes je erreichtes e1RM pro Übung — Bezugspunkt der
      Intensitätszonen und Grundlage der Übungsauswahl unten. */
  const besteE1rm = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of verwertbar(saetze)) {
      const e = satzE1rm(s.kg, s.reps, s.rpe)
      if (e != null && e > (m.get(s.exercise_id) ?? 0)) m.set(s.exercise_id, e)
    }
    return m
  }, [saetze])

  const reihe = useMemo(() => wochenReihe(saetze, einheiten), [saetze, einheiten])
  const anteile = useMemo(() => uebungsAnteile(saetze, namen), [saetze, namen])
  const last = useMemo(() => belastung(saetze), [saetze])
  const gute = useMemo(() => verwertbar(saetze), [saetze])

  const volumenTrend = useMemo(
    () => regression(reihe.map(w => ({ x: w.woche, y: w.tonnage }))),
    [reihe],
  )
  const wochenStreuung = useMemo(() => streuung(reihe.map(w => w.tonnage)), [reihe])

  /** e1RM-Verlauf der gewählten Übung: je Woche der beste Satz. */
  const uebungsVerlauf = useMemo(() => {
    const id = gewaehlteUebung ?? anteile[0]?.id
    if (!id) return []
    const jeWoche = new Map<number, number>()
    for (const s of gute) {
      if (s.exercise_id !== id) continue
      const e = satzE1rm(s.kg, s.reps, s.rpe)
      if (e != null && e > (jeWoche.get(s.week) ?? 0)) jeWoche.set(s.week, e)
    }
    return [...jeWoche.entries()].sort((a, b) => a[0] - b[0]).map(([woche, e1rm]) => ({ woche, e1rm }))
  }, [gewaehlteUebung, anteile, gute])

  const uebungsTrend = useMemo(
    () => regression(uebungsVerlauf.map(p => ({ x: p.woche, y: p.e1rm }))),
    [uebungsVerlauf],
  )

  if (!activePlan) {
    return (
      <section className="view on frisch">
        <div className="view-head">
          <div>
            <h2>Statistik</h2>
            <p>Leg deinen ersten Trainingsplan an, dann gibt es hier etwas zu rechnen.</p>
          </div>
          <PlanPicker />
        </div>
      </section>
    )
  }

  if (!days) return null

  const gesamtTonnage = tonnage(gute)
  const gesamtMinuten = einheiten.filter(s => s.status === 'completed').reduce((a, s) => a + (s.minutes ?? 0), 0)
  const beendete = einheiten.filter(s => s.status === 'completed' && s.ended_at).length
  const s = serien(einheiten)
  const tt = tonnageText(gesamtTonnage)
  const schwer = schwerpunkt(anteile)
  const aktiveUebung = gewaehlteUebung ?? anteile[0]?.id ?? null

  if (!gute.length) {
    return (
      <section className="view on frisch">
        <div className="view-head">
          <div>
            <span className="eyebrow">Auswertung</span>
            <h2>Statistik</h2>
            <p>Noch kein abgehakter Satz mit Gewicht und Wiederholungen. Sobald du trainierst, füllt sich diese Seite.</p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="view on frisch">
      <div className="view-head" style={cssVars({ '--i': 0 })}>
        <div>
          <span className="eyebrow">Auswertung</span>
          <h2>Statistik</h2>
          <p>
            Alles aus deinen abgehakten Sätzen gerechnet — nichts geschätzt. Wo die Daten nicht reichen, bleibt eine
            Stelle leer statt einer erfundenen Zahl.
          </p>
        </div>
      </div>

      <div className="st-kpi" style={cssVars({ '--i': 1 })}>
        <Kachel wert={tt.wert} einheit={tt.einheit} label="Gesamtvolumen" hinweis="Gewicht × Wiederholungen, über alle abgehakten Sätze" />
        <Kachel wert={ganz(beendete)} label="Einheiten" />
        <Kachel wert={ganz(gute.length)} label="Sätze" />
        <Kachel wert={ganz(gute.reduce((a, x) => a + (x.reps ?? 0), 0))} label="Wiederholungen" />
        <Kachel wert={stunden(gesamtMinuten)} label="Trainingszeit" />
        <Kachel wert={ganz(s.laengste)} einheit="Wo" label="Längste Serie" hinweis="Aufeinanderfolgende Wochen mit mindestens einer Einheit" />
      </div>

      <Karte
        i={2}
        titel="Wochenvolumen"
        unterzeile={wochenText(reihe.length)}
        kinder={
          <>
            {reihe.length < 2 ? (
              // Ein einzelner Punkt ist kein Verlauf. Lieber sagen, was
              // fehlt, als ein leeres Achsenkreuz zeigen.
              <p className="st-leer">
                Ein Verlauf braucht mindestens zwei Wochen. Bisher liegt {wochenText(reihe.length)} vor — ab der
                nächsten erscheint hier die Linie samt Trend.
              </p>
            ) : (
              <Liniendiagramm
                punkte={reihe.map(w => ({ label: `W${w.woche}`, wert: w.tonnage }))}
                einheit="kg"
                trend={volumenTrend}
                ariaLabel="Tonnage je Trainingswoche"
              />
            )}
            {/* Die Kennzahlenzeile nur, wenn es auch etwas zu kennzeichnen
                gibt — drei Striche neben dem Leerhinweis sagen nichts. */}
            {reihe.length >= 2 && (
              <div className="st-zahlen">
                <span>
                  Trend
                  <b>
                    {volumenTrend
                      ? `${volumenTrend.steigung >= 0 ? '+' : '−'}${ganz(Math.abs(volumenTrend.steigung))} kg/Woche`
                      : '—'}
                  </b>
                </span>
                <span>
                  Bestimmtheit
                  <b>{volumenTrend ? volumenTrend.r2.toFixed(2).replace('.', ',') : '—'}</b>
                </span>
                <span>
                  Streuung
                  <b>{wochenStreuung?.vk != null ? `${(wochenStreuung.vk * 100).toFixed(0)} %` : '—'}</b>
                </span>
              </div>
            )}
          </>
        }
        fussnote="Die Trendgerade ist eine Ausgleichsrechnung über alle Wochen. Die Bestimmtheit sagt, wie gut sie zu den Punkten passt: unter 0,3 ist die Steigung eher Rauschen als Richtung. Die Streuung ist der Variationskoeffizient — wie stark die Wochen um ihren Mittelwert schwanken."
      />

      <Karte
        i={3}
        titel="Belastungssteuerung"
        unterzeile="7 gegen 28 Tage"
        kinder={
          <>
            <div className="st-kpi eng">
              <Kachel wert={tonnageText(last.akut).wert} einheit={tonnageText(last.akut).einheit} label="Akut · 7 Tage" />
              <Kachel
                wert={tonnageText(last.chronisch).wert}
                einheit={tonnageText(last.chronisch).einheit}
                label="Chronisch · Ø Woche"
              />
              <Kachel
                wert={last.verhaeltnis != null ? last.verhaeltnis.toFixed(2).replace('.', ',') : '—'}
                label="Verhältnis"
                hinweis="Akut geteilt durch chronisch"
              />
              <Kachel
                wert={last.monotonie != null ? last.monotonie.toFixed(2).replace('.', ',') : '—'}
                label="Monotonie"
                hinweis="Mittlere Tageslast geteilt durch ihre Streuung"
              />
            </div>
            {last.verhaeltnis != null && (
              <div className="st-band" role="img" aria-label={`Verhältnis ${last.verhaeltnis.toFixed(2)}`}>
                <span className="st-band-zone niedrig" />
                <span className="st-band-zone gut" />
                <span className="st-band-zone hoch" />
                <i
                  className="st-band-marke"
                  style={{ left: `${Math.min(100, Math.max(0, (last.verhaeltnis / 2) * 100)).toFixed(1)}%` }}
                />
                <span className="st-band-lab links">0,8</span>
                <span className="st-band-lab rechts">1,3</span>
              </div>
            )}
          </>
        }
        fussnote="Als Last dient die Tonnage — ein RPE tragen nur Bankdrücken-Sätze, eine Kennzahl mit wechselndem Fundament wäre schlechter als eine gröbere. Das Verhältnis stammt aus der Sportwissenschaft und ist dort umstritten: Es sagt nichts über Verletzungen voraus, beschreibt aber, wie weit die laufende Woche von der Gewöhnung abweicht. Unter vier Wochen Vorlauf bleibt es leer."
      />

      {anteile.length > 0 && (
        <Karte
          i={4}
          titel="Kraftverlauf"
          unterzeile="bestes e1RM je Woche"
          kinder={
            <>
              <div className="st-wahl">
                {anteile.slice(0, 6).map(a => (
                  <button
                    key={a.id}
                    type="button"
                    className={'chip' + (a.id === aktiveUebung ? ' neon' : ' mute')}
                    onClick={() => setGewaehlteUebung(a.id)}
                  >
                    {a.name}
                  </button>
                ))}
              </div>
              {uebungsVerlauf.length >= 2 ? (
                <>
                  <Liniendiagramm
                    punkte={uebungsVerlauf.map(p => ({ label: `W${p.woche}`, wert: p.e1rm }))}
                    einheit="kg"
                    farbe="var(--violet)"
                    trend={uebungsTrend}
                    ariaLabel="Geschätztes Einwiederholungsmaximum je Woche"
                  />
                  <div className="st-zahlen">
                    <span>
                      Bestwert
                      <b>{formatGewicht(Math.max(...uebungsVerlauf.map(p => p.e1rm)))} kg</b>
                    </span>
                    <span>
                      Trend
                      <b>
                        {uebungsTrend
                          ? `${uebungsTrend.steigung >= 0 ? '+' : '−'}${formatGewicht(Math.abs(uebungsTrend.steigung))} kg/Woche`
                          : '—'}
                      </b>
                    </span>
                    <span>
                      Bestimmtheit
                      <b>{uebungsTrend ? uebungsTrend.r2.toFixed(2).replace('.', ',') : '—'}</b>
                    </span>
                  </div>
                </>
              ) : (
                <p className="st-leer">
                  Für diese Übung liegen noch keine zwei Wochen mit Sätzen vor. Ab der zweiten erscheint hier der
                  Verlauf des geschätzten Einwiederholungsmaximums.
                </p>
              )}
            </>
          }
          fussnote="Das geschätzte Einwiederholungsmaximum kommt je Satz aus der RPE-Tabelle, sonst über Epley. Genommen wird der beste Satz der Woche — nicht der Durchschnitt, denn die Bestmarke ist das, was sich verschiebt."
        />
      )}

      <Karte
        i={5}
        titel="Intensitätszonen"
        unterzeile="Anteil am besten e1RM"
        kinder={
          <Verteilung
            faecher={intensitaetsZonen(saetze, besteE1rm).map(f => ({
              name: f.name,
              anteil: f.anteil,
              zusatz: `${f.saetze} Sätze`,
            }))}
            ariaLabel="Verteilung der Sätze auf Intensitätszonen"
          />
        }
        fussnote="Bezugspunkt ist das beste je erreichte e1RM der jeweiligen Übung, nicht ein tagesaktuelles — sonst verschöbe jede neue Bestleistung rückwirkend die ganze Geschichte. Übungen ohne brauchbaren Bezugswert bleiben außen vor."
      />

      <Karte
        i={6}
        titel="Wiederholungsbereiche"
        kinder={
          <Verteilung
            faecher={wiederholungsVerteilung(saetze).map(f => ({
              name: f.name,
              anteil: f.anteil,
              zusatz: `${f.saetze} Sätze`,
            }))}
            farbe="var(--magenta)"
            ariaLabel="Verteilung der Sätze auf Wiederholungsbereiche"
          />
        }
        fussnote="Die Etiketten sind die geläufigen Einordnungen aus der Trainingslehre — eine Beschreibung, kein Naturgesetz."
      />

      <Karte
        i={7}
        titel="Wochenrhythmus"
        kinder={
          <Balkenreihe
            werte={wochentagsMuster(einheiten).map(t => ({
              name: t.name,
              wert: t.einheiten,
              titel: `${t.name}: ${t.einheiten} Einheiten, ${stunden(t.minuten)}`,
            }))}
            farbe="var(--violet)"
            ariaLabel="Einheiten je Wochentag"
          />
        }
        fussnote="Zeigt den Rhythmus, den man selbst nicht bemerkt — etwa dass ein Wochentag seit Monaten ausfällt."
      />

      <Karte
        i={8}
        titel="Wo die Arbeit hingeht"
        unterzeile={schwer != null ? `${schwer} Übungen tragen die Hälfte` : undefined}
        kinder={
          <Verteilung
            faecher={anteile.slice(0, 8).map(a => ({
              name: a.name,
              anteil: a.anteil,
              zusatz: `${ganz(a.tonnage)} kg`,
            }))}
            farbe="var(--good)"
            ariaLabel="Volumenanteil je Übung"
          />
        }
        fussnote="Anteil am Gesamtvolumen, die acht größten. Meist steckt der Großteil der Arbeit in einer Handvoll Übungen — welche das sind, überrascht regelmäßig."
      />
    </section>
  )
}

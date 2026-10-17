import { useMemo, useState } from 'react'
import { useActivePlan } from '../plans/active-plan-context'
import { useDays, useAllSetsForExercises, useAllSessionsForDays } from '../training/queries'
import { satzE1rm, durchschnittsDauerJeUebung } from '../training/calc'
import { PlanPicker } from '../plans/PlanPicker'
import { formatGewicht } from '../../lib/zahlen'
import { cssVars } from '../../lib/style'
import { Liniendiagramm, Balkenreihe, VerteilungsKurve } from './Diagramme'
import { MuskelHeatmap } from './MuskelHeatmap'
import { WiederholungsSpektrum } from './WiederholungsSpektrum'
import { TonnageJeEinheit, DauerJeEinheit, DauerJeUebung } from './EinheitenKarten'
import {
  einheitenDaten,
  intensitaetsKurve,
  wiederholungsKurve,
  INTENSITAETS_BAENDER,
  glaetten,
  type IntensitaetsArt,
  regression,
  serien,
  streuung,
  tonnage,
  uebungsAnteile,
  verwertbar,
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
  i,
}: {
  titel: string
  unterzeile?: string
  kinder: React.ReactNode
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
  // Last oder Anstrengung — siehe intensitaetsKurve in calc.ts.
  const [intensitaetsArt, setIntensitaetsArt] = useState<IntensitaetsArt>('last')
  const kurve = useMemo(() => intensitaetsKurve(saetze, besteE1rm, intensitaetsArt), [saetze, besteE1rm, intensitaetsArt])
  // Kein Satz liegt über der eigenen Bestleistung — Obergrenze 100 %.
  const kurveGlatt = useMemo(() => glaetten(kurve, 2, 100), [kurve])
  const wdhKurve = useMemo(() => wiederholungsKurve(saetze), [saetze])
  const anteile = useMemo(() => uebungsAnteile(saetze, namen), [saetze, namen])
  const gute = useMemo(() => verwertbar(saetze), [saetze])

  // Grundlage der einheitenbezogenen Karten: je Einheit ein Punkt mit
  // Tonnage, Dauer und Satzstand.
  const punkte = useMemo(() => einheitenDaten(days ?? [], einheiten, saetze), [days, einheiten, saetze])
  const dauerJeUebung = useMemo(
    () => durchschnittsDauerJeUebung(days ?? [], einheiten, saetze),
    [days, einheiten, saetze],
  )

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
            <p>Leg deinen ersten Trainingsplan an.</p>
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
  const aktiveUebung = gewaehlteUebung ?? anteile[0]?.id ?? null

  if (!gute.length) {
    return (
      <section className="view on frisch">
        <div className="view-head">
          <div>
            <h2>Statistik</h2>
            <p>Noch kein abgehakter Satz — sobald du trainierst, füllt sich diese Seite.</p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="view on frisch">
      <div className="view-head" style={cssVars({ '--i': 0 })}>
        <div>
          <h2>Statistik</h2>
        </div>
      </div>

      <div className="st-kpi" style={cssVars({ '--i': 1 })}>
        <Kachel wert={tt.wert} einheit={tt.einheit} label="Volumen" hinweis="Gewicht × Wiederholungen, über alle abgehakten Sätze" />
        <Kachel wert={ganz(beendete)} label="Einheiten" />
        <Kachel wert={ganz(gute.length)} label="Sätze" />
        <Kachel wert={ganz(gute.reduce((a, x) => a + (x.reps ?? 0), 0))} label="Wiederholungen" />
        <Kachel wert={stunden(gesamtMinuten)} label="Trainingszeit" />
        <Kachel wert={ganz(s.laengste)} einheit="Wo" label="Längste Serie" hinweis="Aufeinanderfolgende Wochen mit mindestens einer Einheit" />
      </div>

      <div className="st-uebernommen" style={cssVars({ '--i': 2 })}>
        <MuskelHeatmap days={days} allSets={saetze} />
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
              <p className="st-leer">Ein Verlauf braucht zwei Wochen — bisher {wochenText(reihe.length)}.</p>
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
      />

      {anteile.length > 0 && (
        <Karte
          i={4}
          titel="Kraftverlauf"
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
                    farbe="var(--ton-b)"
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
                          ? `${uebungsTrend.steigung >= 0 ? '+' : '−'}${formatGewicht(Math.round(Math.abs(uebungsTrend.steigung) * 10) / 10)} kg/Woche`
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
                <p className="st-leer">Für diese Übung liegen noch keine zwei Wochen mit Sätzen vor.</p>
              )}
            </>
          }
        />
      )}

      <Karte
        i={5}
        titel="Intensitätszonen"
        unterzeile={intensitaetsArt === 'last' ? '% vom besten 1RM' : '% vom Bestwert'}
        kinder={
          <>
            <div className="st-wahl">
              {(['last', 'anstrengung'] as const).map(art => (
                <button
                  key={art}
                  type="button"
                  className={'chip' + (art === intensitaetsArt ? ' neon' : ' mute')}
                  aria-pressed={art === intensitaetsArt}
                  onClick={() => setIntensitaetsArt(art)}
                >
                  {art === 'last' ? 'Last' : 'Anstrengung'}
                </button>
              ))}
            </div>
            <p className="muted tiny st-art-hinweis">
              {intensitaetsArt === 'last'
                ? 'Gewicht im Verhältnis zum besten 1RM der Übung — ohne Rücksicht auf die Wiederholungen.'
                : 'Wie nah der Satz an die Bestleistung kam — Gewicht und Wiederholungen zusammen. 10 Wdh. bis zum Versagen zählen hier fast 100 %.'}
            </p>
            <VerteilungsKurve
              punkte={kurve.map(p => ({ x: p.prozent, saetze: p.saetze }))}
              glatt={kurveGlatt.map(p => ({ x: p.prozent, wert: p.wert }))}
              baender={INTENSITAETS_BAENDER}
              xSchritt={10}
              xText={v => `${v} %`}
              tipTitel={v => `${v} % vom Bestwert`}
              ariaLabel={
                intensitaetsArt === 'last'
                  ? 'Anzahl der Sätze je Prozent vom besten geschätzten 1RM'
                  : 'Anzahl der Sätze je Prozent Anstrengung, gemessen am besten geschätzten 1RM'
              }
            />
            {/* Was die Kurve zeigt, in drei Zahlen — immer im gewählten Maß. */}
            {kurve.length > 0 && (
              <div className="st-zahlen">
                <span>
                  Schwerpunkt
                  <b>{kurveGlatt.reduce((a, p) => (p.wert > a.wert ? p : a), kurveGlatt[0]).prozent} %</b>
                </span>
                <span>
                  Durchschnitt
                  <b>
                    {Math.round(
                      kurve.reduce((a, p) => a + p.prozent * p.saetze, 0) / kurve.reduce((a, p) => a + p.saetze, 0),
                    )}{' '}
                    %
                  </b>
                </span>
                <span>
                  80 %+
                  <b>
                    {Math.round(
                      (kurve.filter(p => p.prozent >= 80).reduce((a, p) => a + p.saetze, 0) /
                        kurve.reduce((a, p) => a + p.saetze, 0)) *
                        100,
                    )}{' '}
                    %
                  </b>
                </span>
              </div>
            )}
          </>
        }
      />

      <Karte i={6} titel="Wiederholungsbereiche" kinder={<WiederholungsSpektrum kurve={wdhKurve} />} />

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
            farbe="var(--ton-b)"
            ariaLabel="Einheiten je Wochentag"
          />
        }
      />

      <Karte
        i={10}
        titel="Tonnage je Einheit"
        kinder={<TonnageJeEinheit punkte={punkte} />}
      />

      <Karte
        i={11}
        titel="Dauer je Einheit"
        kinder={<DauerJeEinheit punkte={punkte} />}
      />

      <Karte
        i={12}
        titel="Dauer je Übung"
        kinder={<DauerJeUebung eintraege={dauerJeUebung} />}
      />
    </section>
  )
}

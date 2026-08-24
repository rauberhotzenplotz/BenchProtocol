import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { Exercise, Plan } from '../../types/db'
import type { DayWithExercises } from '../training/queries'
import {
  useCreateDay,
  useUpdateDay,
  useDeleteDay,
  useCreateExercise,
  useUpdateExercise,
  useDeleteExercise,
} from '../training/queries'
import { useUpdatePlan } from './queries'
import { naechsteSortierung, umsortieren, neueSortierNummern } from '../training/calc'
import { useVolumeRows } from '../volume/queries'
import { UebungAuswahl } from '../training/UebungAuswahl'
import { neueId } from '../../lib/offline/keys'
import { onKeyDownAndroidBackspaceFix } from '../../lib/nativeShell'
import { useZiehSortieren, ziehStil } from '../../lib/ziehSortieren'
import { useSchliessenPerZurueck } from '../../lib/backClose'

interface Props {
  plan: Plan
  days: DayWithExercises[]
  onClose: () => void
}

/** Bearbeitung des ganzen Plans an einer Stelle: Tage anlegen, umbenennen,
    sortieren und löschen, und je Tag die Übungen zusammenstellen.

    Bisher war das über die App verstreut — den Tagesnamen ändert man in
    der Tagesansicht, Übungen legt man dort an, und Tage anlegen ging gar
    nicht. Wer einen Plan von Grund auf aufbaut, springt so ständig hin und
    her. Hier steht alles untereinander.

    Vollbild statt Dialogkarte: Auf dem Handy ist ein Plan mit mehreren
    Tagen und je einer Handvoll Übungen länger als ein Sheet, und beim
    Aufbauen springt man viel zwischen den Tagen. */
export function PlanEditor({ plan, days, onClose }: Props) {
  const updatePlan = useUpdatePlan()
  const createDay = useCreateDay()
  const updateDay = useUpdateDay()
  const deleteDay = useDeleteDay()
  const createExercise = useCreateExercise()
  const updateExercise = useUpdateExercise()
  const deleteExercise = useDeleteExercise()

  // Wie GymModeAP: bedingt gemountet statt über ein offen-Prop, das
  // Mounten selbst ist hier das Öffnen.
  useSchliessenPerZurueck(true, onClose)

  // Die Muskelgruppen des Volumen-Kontrollblatts sind das Vokabular, aus
  // dem der Übungs-Picker seine Zuordnung wählt (siehe UebungAuswahl).
  const { data: volumeRows } = useVolumeRows(plan.id)
  const muskelgruppen = (volumeRows ?? []).map(r => r.muscle_group)

  const [offenerTag, setOffenerTag] = useState<string | null>(days[0]?.id ?? null)
  const [neueUebungFuer, setNeueUebungFuer] = useState<string | null>(null)
  const [loeschenTag, setLoeschenTag] = useState<string | null>(null)

  const sortierteTage = [...days].sort((a, b) => a.sort_order - b.sort_order)

  const tagAnlegen = () => {
    const id = neueId()
    createDay.mutate({
      id,
      plan_id: plan.id,
      name: `Tag ${sortierteTage.length + 1}`,
      sort_order: naechsteSortierung(sortierteTage),
    })
    setOffenerTag(id)
  }

  /** Nummeriert die Tage nach dem Verschieben durch. Früher wurden nur
      die sort_order zweier Nachbarn getauscht — das tut aber nichts,
      wenn beide dieselbe Nummer tragen, und genau das kam in den echten
      Daten vor. Geschrieben wird nur, was sich ändert; offline landen
      die Schreibvorgänge der Reihe nach in der Warteschlange. */
  const tageSortieren = (von: number, nach: number) => {
    for (const { id, sort_order } of neueSortierNummern(umsortieren(sortierteTage, von, nach))) {
      updateDay.mutate({ id, patch: { sort_order } })
    }
  }

  const uebungenSortieren = (liste: Exercise[], von: number, nach: number) => {
    for (const { id, sort_order } of neueSortierNummern(umsortieren(liste, von, nach))) {
      updateExercise.mutate({ id, patch: { sort_order } })
    }
  }

  return createPortal(
    <div className="planed">
      <div className="planed-kopf">
        <button className="zurueck" onClick={onClose}>
          <svg viewBox="0 0 24 24">
            <path d="M19 12H5M11 18l-6-6 6-6" />
          </svg>
          Fertig
        </button>
        <span className="eyebrow">Plan bearbeiten</span>
      </div>

      <div className="planed-inhalt">
        <div className="field">
          <label>Name des Plans</label>
          <input
            className="inp"
            defaultValue={plan.name}
            maxLength={40}
            onKeyDown={onKeyDownAndroidBackspaceFix}
            onBlur={e => {
              const wert = e.target.value.trim()
              if (wert && wert !== plan.name) updatePlan.mutate({ id: plan.id, patch: { name: wert } })
              else e.target.value = plan.name
            }}
          />
        </div>

        {sortierteTage.length === 0 && (
          <p className="muted tiny" style={{ margin: '18px 0' }}>
            Noch keine Trainingstage. Leg unten den ersten an.
          </p>
        )}

        {sortierteTage.map((tag, i) => {
          const offen = offenerTag === tag.id
          const uebungen = [...tag.exercises].sort((a, b) => a.sort_order - b.sort_order)
          return (
            <div key={tag.id} className={'planed-tag' + (offen ? ' offen' : '')}>
              <div className="planed-tagkopf">
                <button
                  className="planed-auf"
                  onClick={() => setOffenerTag(offen ? null : tag.id)}
                  aria-expanded={offen}
                >
                  <span className="planed-tagname">{tag.name}</span>
                  <span className="planed-tagzahl">
                    {uebungen.length} {uebungen.length === 1 ? 'Übung' : 'Übungen'}
                  </span>
                  <svg className={offen ? 'auf' : ''} viewBox="0 0 24 24">
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>
                <div className="planed-tagtasten">
                  <button className="rowbtn" title="Nach oben" disabled={i === 0} onClick={() => tageSortieren(i, i - 1)}>
                    <svg viewBox="0 0 24 24">
                      <path d="m18 15-6-6-6 6" />
                    </svg>
                  </button>
                  <button
                    className="rowbtn"
                    title="Nach unten"
                    disabled={i === sortierteTage.length - 1}
                    onClick={() => tageSortieren(i, i + 1)}
                  >
                    <svg viewBox="0 0 24 24">
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </button>
                </div>
              </div>

              {offen && (
                <div className="planed-tagkoerper">
                  <div className="field">
                    <label>Name des Tages</label>
                    <input
                      className="inp"
                      defaultValue={tag.name}
                      maxLength={40}
                      onKeyDown={onKeyDownAndroidBackspaceFix}
                      onBlur={e => {
                        const wert = e.target.value.trim()
                        if (wert && wert !== tag.name) updateDay.mutate({ id: tag.id, patch: { name: wert } })
                        else e.target.value = tag.name
                      }}
                    />
                  </div>

                  {uebungen.length === 0 && (
                    <p className="muted tiny" style={{ margin: '10px 0' }}>
                      Noch keine Übungen an diesem Tag.
                    </p>
                  )}

                  <TagUebungen
                    uebungen={uebungen}
                    onSortieren={(vonPlatz, nachPlatz) => uebungenSortieren(uebungen, vonPlatz, nachPlatz)}
                    onEntfernen={id => deleteExercise.mutate(id)}
                    onFeld={(id, patch) => updateExercise.mutate({ id, patch })}
                  />

                  <div className="planed-tagfuss">
                    <button className="btn sm" onClick={() => setNeueUebungFuer(tag.id)}>
                      + Übung
                    </button>
                    {loeschenTag === tag.id ? (
                      <>
                        <button className="btn ghost sm" onClick={() => setLoeschenTag(null)}>
                          Abbrechen
                        </button>
                        <button
                          className="btn sm danger"
                          onClick={() => {
                            deleteDay.mutate(tag.id)
                            setLoeschenTag(null)
                            if (offenerTag === tag.id) setOffenerTag(null)
                          }}
                        >
                          Wirklich löschen
                        </button>
                      </>
                    ) : (
                      <button className="btn ghost sm danger" onClick={() => setLoeschenTag(tag.id)}>
                        Tag löschen
                      </button>
                    )}
                  </div>

                  {neueUebungFuer === tag.id && (
                    <div style={{ marginTop: 12 }}>
                      <UebungAuswahl
                        planTyp={plan.typ}
                        muskelgruppen={muskelgruppen}
                        onAbbrechen={() => setNeueUebungFuer(null)}
                        onAnlegen={werte => {
                          // Kein await: offline pausiert die Mutation, das
                          // Formular bliebe sonst stehen. Die ID entsteht hier.
                          createExercise.mutate({
                            id: neueId(),
                            day_id: tag.id,
                            sort_order: naechsteSortierung(uebungen),
                            ...werte,
                          })
                          setNeueUebungFuer(null)
                        }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}

        <button className="btn primary" style={{ marginTop: 16 }} onClick={tagAnlegen}>
          + Trainingstag
        </button>
      </div>
    </div>,
    document.body,
  )
}

/** Übungsliste eines Tages.

    Eigene Komponente, weil useZiehSortieren nicht innerhalb der
    Tages-Schleife aufgerufen werden darf — Hooks müssen bei jedem Render
    in derselben Zahl und Reihenfolge laufen.

    Umsortiert wird per Aufnehmen und Ziehen: gedrückt halten, dann
    verschieben. Die Pfeiltasten bleiben daneben stehen, weil sie mit
    einer Hand und ohne Zielen funktionieren — beim Aufbauen eines Plans
    am Schreibtisch oft der schnellere Weg. */
function TagUebungen({
  uebungen,
  onSortieren,
  onEntfernen,
  onFeld,
}: {
  uebungen: Exercise[]
  onSortieren: (von: number, nach: number) => void
  onEntfernen: (id: string) => void
  onFeld: (id: string, patch: Partial<Exercise>) => void
}) {
  const [kasten, setKasten] = useState<HTMLDivElement | null>(null)
  const zieh = useZiehSortieren({ behaelter: kasten, achse: 'y', aus: uebungen.length < 2, onSortieren })

  return (
    <div ref={setKasten}>
      {uebungen.map((ex, j) => (
        <div
          key={ex.id}
          data-zieh={j}
          style={ziehStil(zieh.zustand, j)}
          className={'planed-ueb' + (zieh.zustand?.von === j ? ' zieht' : '')}
        >
          <div className="planed-ueb-kopf">
            <span className="planed-ueb-name">{ex.name}</span>
            <div className="planed-tagtasten">
              <button className="rowbtn" title="Nach oben" disabled={j === 0} onClick={() => onSortieren(j, j - 1)}>
                <svg viewBox="0 0 24 24">
                  <path d="m18 15-6-6-6 6" />
                </svg>
              </button>
              <button
                className="rowbtn"
                title="Nach unten"
                disabled={j === uebungen.length - 1}
                onClick={() => onSortieren(j, j + 1)}
              >
                <svg viewBox="0 0 24 24">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
              <button className="rowbtn del" title="Übung entfernen" onClick={() => onEntfernen(ex.id)}>
                <svg viewBox="0 0 24 24">
                  <path d="M4 7h16M9 7V5h6v2M7 7l1 13h8l1-13" />
                </svg>
              </button>
            </div>
          </div>
          <div className="planed-ueb-felder">
            <label className="planed-klein">
              <span>Schema</span>
              <input
                className="inp mono"
                defaultValue={ex.scheme ?? ''}
                placeholder="z. B. 4 × 8"
                onKeyDown={onKeyDownAndroidBackspaceFix}
                onBlur={e => onFeld(ex.id, { scheme: e.target.value.trim() || null })}
              />
            </label>
            <label className="planed-klein">
              <span>Pause</span>
              <input
                className="inp mono"
                defaultValue={ex.rest ?? ''}
                placeholder="z. B. 2 min"
                onKeyDown={onKeyDownAndroidBackspaceFix}
                onBlur={e => onFeld(ex.id, { rest: e.target.value.trim() || null })}
              />
            </label>
          </div>
        </div>
      ))}
    </div>
  )
}

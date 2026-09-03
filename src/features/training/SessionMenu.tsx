import { useState, type CSSProperties } from 'react'
import type { TrainingSession } from '../../types/db'
import { usePauseSession, useResumeSession, useResetSessionSets } from './queries'
import { useSchliessenPerZurueck } from '../../lib/backClose'

interface Props {
  session: TrainingSession
  dayId: string
  week: number
  exerciseIds: string[]
  /** Läuft dieselbe Mutation wie der bisherige "Beenden"-Knopf — hier nur
      als Eintrag in diesem Menü, damit Abschließen/Pausieren/Zurücksetzen
      an einer Stelle stehen (siehe Alpha-Progression-Vorbild). */
  onAbschliessen: () => void
  /** GymMode braucht den Auslöser absolut positioniert (Pendant zum
      Schließen-Knopf oben links) statt inline wie in SessionView. */
  wrapStyle?: CSSProperties
  /** Seite, an der das Menü unter dem Auslöser aufklappt — 'right' (Standard)
      passt für einen rechtsbündigen Auslöser, 'left' für einen linken
      (GymMode: der Auslöser sitzt oben links, das Menü darf nicht über den
      schmalen Handybildschirm hinaus nach links ragen). */
  menuAlign?: 'left' | 'right'
}

/** Session-Zustandsmenü: Abschließen, Pausieren/Fortsetzen (je nach
    session.paused_at) und Zurücksetzen (mit zweistufiger Bestätigung wie
    "Alle Daten löschen" in SettingsPage.tsx). Pausieren/Fortsetzen und
    Zurücksetzen sind eigene Mutationen (lib/offline/training.ts) — nur
    Abschließen bleibt beim Aufrufer, da SessionView und GymMode dabei
    unterschiedliche Nebeneffekte haben (Pausentimer stoppen, Ansicht
    schließen). */
export function SessionMenu({ session, dayId, week, exerciseIds, onAbschliessen, wrapStyle, menuAlign = 'right' }: Props) {
  const [offen, setOffen] = useState(false)
  const [zuruecksetzenBestaetigen, setZuruecksetzenBestaetigen] = useState(false)
  const pauseSession = usePauseSession()
  const resumeSession = useResumeSession()
  const resetSessionSets = useResetSessionSets()

  useSchliessenPerZurueck(offen, () => { setOffen(false); setZuruecksetzenBestaetigen(false) })
  // Eigener Stapel-Eintrag für die Rückfrage: ein "Zurück" soll erst die
  // Rückfrage abbrechen (zurück zum Menü) und ein zweites erst das Menü
  // schließen, nicht beides auf einmal.
  useSchliessenPerZurueck(zuruecksetzenBestaetigen, () => setZuruecksetzenBestaetigen(false))

  const pausiert = session.paused_at != null

  const schliessen = () => {
    setOffen(false)
    setZuruecksetzenBestaetigen(false)
  }

  return (
    <span className="session-menu-wrap" style={wrapStyle}>
      <button
        className="rowbtn einst"
        aria-haspopup="true"
        aria-expanded={offen}
        aria-label="Einheit-Menü"
        onClick={() => setOffen(o => !o)}
      >
        <svg viewBox="0 0 24 24">
          <circle cx="12" cy="5" r="1.6" />
          <circle cx="12" cy="12" r="1.6" />
          <circle cx="12" cy="19" r="1.6" />
        </svg>
      </button>

      {offen && (
        <>
          <div className="session-menu-hinter" onClick={schliessen} />
          <div
            className="session-menu"
            role="menu"
            aria-label="Einheit-Menü"
            style={menuAlign === 'left' ? { right: 'auto', left: 0 } : undefined}
          >
            <button
              role="menuitem"
              className="session-menu-eintrag"
              onClick={() => {
                schliessen()
                onAbschliessen()
              }}
            >
              Abschließen
            </button>
            <button
              role="menuitem"
              className="session-menu-eintrag"
              onClick={() => {
                schliessen()
                if (pausiert) {
                  resumeSession.mutate({
                    id: session.id,
                    dayId,
                    week,
                    startedAt: session.started_at,
                    pausedAt: session.paused_at!,
                    jetzt: new Date().toISOString(),
                  })
                } else {
                  pauseSession.mutate({ id: session.id, dayId, week, pausedAt: new Date().toISOString() })
                }
              }}
            >
              {pausiert ? 'Fortsetzen' : 'Pausieren'}
            </button>
            {zuruecksetzenBestaetigen ? (
              <div className="session-menu-bestaetigen">
                <span>Alle Sätze dieser Woche löschen?</span>
                <div className="row" style={{ gap: 8 }}>
                  <button className="btn ghost sm" onClick={() => setZuruecksetzenBestaetigen(false)}>
                    Abbrechen
                  </button>
                  <button
                    className="btn sm danger"
                    onClick={() => {
                      schliessen()
                      resetSessionSets.mutate({ exerciseIds, week })
                    }}
                  >
                    Zurücksetzen
                  </button>
                </div>
              </div>
            ) : (
              <button role="menuitem" className="session-menu-eintrag gefahr" onClick={() => setZuruecksetzenBestaetigen(true)}>
                Zurücksetzen
              </button>
            )}
          </div>
        </>
      )}
    </span>
  )
}

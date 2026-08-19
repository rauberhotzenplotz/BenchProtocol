import { useEffect, useRef, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { useIsMutating, useQueryClient } from '@tanstack/react-query'
import { Nav } from './Nav'
import { UpdateBanner } from './UpdateBanner'
import { OfflineBanner } from './OfflineBanner'
import { RestTimerBar } from './RestTimerBar'
import { Mark } from './Mark'
import { BootScreen } from './BootScreen'
import { useAuth } from '../auth/auth-context'
import { useActivePlan } from '../features/plans/active-plan-context'
import { pruefeWochenabschluss } from '../features/training/wochenAbschluss'
import { nebelPhase } from './nebelPhase'

function useClock() {
  const [zeit, setZeit] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setZeit(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return zeit.toLocaleTimeString('de-DE')
}

/** Trägt die Blockphase ans <html>, damit der Hintergrundnebel sie
    aufgreifen kann. Der Umweg über ein Attribut statt über Props ist
    nötig, weil der Nebel außerhalb des Plan-Kontexts hängt — er steht ja
    auch auf der Anmeldeseite. Gleiche Bauart wie data-motion. */
function useNebelPhase() {
  const { activePlan } = useActivePlan()
  const phase = nebelPhase(activePlan)
  useEffect(() => {
    document.documentElement.dataset.phase = phase
    return () => {
      delete document.documentElement.dataset.phase
    }
  }, [phase])
}

/** Schaltet die Woche weiter, sobald alle Trainingstage erledigt sind
    (siehe wochenAbschluss.ts). Der Aufruf steckt zusätzlich im onSuccess
    von endSession — dort greift er unmittelbar nach dem Beenden einer
    Einheit. Hier läuft dieselbe Prüfung noch einmal beim Laden, weil eine
    Woche auch auf anderem Weg vollständig werden kann: eine Einheit wird
    nachträglich übersprungen, eine gelöschte Einheit kommt zurück, oder
    die Daten ändern sich auf einem zweiten Gerät. Ohne diese zweite
    Stelle bliebe ein bereits vollständiger Zustand für immer stehen, weil
    kein weiteres "Beenden" mehr folgt.

    Nur online: pruefeWochenabschluss() liest frisch vom Server und ist
    bewusst nicht warteschlangentauglich (siehe dort). Offline passiert
    nichts — beim nächsten Laden mit Netz zieht die Prüfung nach.

    Der Ref-Wächter verhindert überlappende Läufe, während die Prüfung
    selbst noch unterwegs ist; nach dem Schreiben löst die invalidierte
    Planliste einen erneuten Lauf aus, der dann null liefert (die frische
    Woche hat noch keine erledigten Tage) und damit terminiert. */
function useWochenAbschluss(plan: ReturnType<typeof useActivePlan>['activePlan']) {
  const qc = useQueryClient()
  const laeuft = useRef(false)
  useEffect(() => {
    if (!plan || laeuft.current || !navigator.onLine) return
    laeuft.current = true
    pruefeWochenabschluss(qc, plan.id)
      .catch(() => {
        // Ein fehlgeschlagener Abschluss-Check darf die App nicht stören —
        // beim nächsten Laden wird es ohnehin erneut versucht.
      })
      .finally(() => {
        laeuft.current = false
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nur bei geändertem Plan/Woche neu prüfen, qc ist stabil
  }, [plan?.id, plan?.week])
}

export function AppShell() {
  const uhrzeit = useClock()
  const speichertGerade = useIsMutating() > 0
  const { signOut } = useAuth()
  const { activePlan } = useActivePlan()
  useNebelPhase()
  useWochenAbschluss(activePlan)

  return (
    <div className="app">
      <BootScreen />
      <aside className="rail">
        <Mark />
        <Nav />
        <div className="rail-foot">
          <div className="pulse-dot" title={speichertGerade ? 'Speichert …' : 'Mit Konto verbunden'} />
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <h1>
            Bench<em>Protocol</em>
          </h1>
          <UpdateBanner />
          <OfflineBanner />
          <span className="spacer" />
          <div className="clock">{uhrzeit}</div>
          <button className="btn ghost sm" onClick={() => void signOut()}>
            Abmelden
          </button>
        </header>

        <main className="stage">
          <Outlet />
        </main>
      </div>
      <RestTimerBar />
    </div>
  )
}

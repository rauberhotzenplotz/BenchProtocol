import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { useIsMutating } from '@tanstack/react-query'
import { Nav } from './Nav'
import { UpdateBanner } from './UpdateBanner'
import { OfflineBanner } from './OfflineBanner'
import { RestTimerBar } from './RestTimerBar'
import { Mark } from './Mark'
import { BootScreen } from './BootScreen'
import { useAuth } from '../auth/auth-context'
import { useActivePlan } from '../features/plans/active-plan-context'
import { useUpdatePlan } from '../features/plans/queries'
import { naechsteWoche } from '../features/training/wochenAutomatik'
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

/** Ersetzt die frühere manuelle W1–W4/Deload-Auswahl (siehe
    wochenAutomatik.ts): prüft bei jedem Laden des aktiven Plans, ob seit
    Beginn der eingetragenen Woche 7 Tage vergangen sind, und schreibt bei
    Bedarf die neue Woche. Läuft einmal je geänderter Woche, nicht bei
    jedem Rendern — die Prüfung selbst ist reine Zeit-Arithmetik, ein
    erneuter Aufruf nach dem Schreiben liefert dann null. */
function useWochenAutomatik(plan: ReturnType<typeof useActivePlan>['activePlan']) {
  const updatePlan = useUpdatePlan()
  useEffect(() => {
    if (!plan) return
    const naechste = naechsteWoche(plan)
    if (naechste) updatePlan.mutate({ id: plan.id, patch: naechste })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nur bei geänderter Woche neu prüfen, nicht bei jeder Mutation von updatePlan
  }, [plan?.id, plan?.week, plan?.week_started_at])
}

export function AppShell() {
  const uhrzeit = useClock()
  const speichertGerade = useIsMutating() > 0
  const { signOut } = useAuth()
  const { activePlan } = useActivePlan()
  useNebelPhase()
  useWochenAutomatik(activePlan)

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

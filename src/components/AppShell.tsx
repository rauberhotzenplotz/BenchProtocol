import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { useIsMutating } from '@tanstack/react-query'
import { Nav } from './Nav'
import { UpdateBanner } from './UpdateBanner'
import { RestTimerBar } from './RestTimerBar'
import { Mark } from './Mark'
import { BootScreen } from './BootScreen'
import { useAuth } from '../auth/auth-context'
import { useActivePlan } from '../features/plans/active-plan-context'
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

export function AppShell() {
  const uhrzeit = useClock()
  const speichertGerade = useIsMutating() > 0
  const { signOut } = useAuth()
  useNebelPhase()

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

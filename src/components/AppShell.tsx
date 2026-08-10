import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { useIsMutating } from '@tanstack/react-query'
import { Nav } from './Nav'
import { UpdateBanner } from './UpdateBanner'
import { useAuth } from '../auth/auth-context'

function useClock() {
  const [zeit, setZeit] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setZeit(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return zeit.toLocaleTimeString('de-DE')
}

export function AppShell() {
  const uhrzeit = useClock()
  const speichertGerade = useIsMutating() > 0
  const { signOut } = useAuth()

  return (
    <div className="app">
      <aside className="rail">
        <div className="mark" aria-hidden="true">
          <svg viewBox="0 0 64 64">
            <g className="plate">
              <circle cx="32" cy="32" r="25" fill="none" stroke="#35F0D0" strokeWidth="1.1" opacity=".38" />
              <circle cx="32" cy="7" r="2.4" fill="#35F0D0" />
              <circle cx="57" cy="32" r="1.6" fill="#8B7CFF" />
            </g>
            <g className="plate2">
              <circle cx="32" cy="32" r="17" fill="none" stroke="#8B7CFF" strokeWidth="1.1" opacity=".38" strokeDasharray="4 7" />
              <circle cx="32" cy="49" r="1.8" fill="#FF4D9D" />
            </g>
            <rect x="14" y="30" width="36" height="4" rx="2" fill="#35F0D0" opacity=".9" />
            <rect x="10" y="25" width="5" height="14" rx="2" fill="#E6EDF5" />
            <rect x="49" y="25" width="5" height="14" rx="2" fill="#E6EDF5" />
          </svg>
        </div>
        <Nav />
        <div className="rail-foot">
          <div className="pulse-dot" title={speichertGerade ? 'Speichert …' : 'Mit Konto verbunden'} />
          <span className="tiny mono" style={{ color: 'var(--ink-4)' }}>
            {speichertGerade ? 'SYNC' : 'OK'}
          </span>
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
    </div>
  )
}

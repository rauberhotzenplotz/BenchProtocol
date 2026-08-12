import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  IconDash,
  IconTrain,
  IconBench,
  IconVolume,
  IconRecords,
  IconSettings,
  IconGuide,
  IconImport,
  IconBlocks,
} from './icons'

/* Drei Bereiche haben einen eigenen Knopf, der Rest liegt hinter "Mehr" —
   sonst wird die Leiste auf dem Handy zu eng (Pendant zu NAV/MEHR aus der
   alten App). */
const NAV_ITEMS = [
  { to: '/cockpit', label: 'Cockpit', Icon: IconDash },
  { to: '/training', label: 'Training', Icon: IconTrain },
  { to: '/bank', label: 'Bank', Icon: IconBench },
]

const MEHR_ITEMS = [
  { to: '/rekorde', label: 'Rekorde', sub: 'Bestleistung je Wiederholungszahl', Icon: IconRecords },
  { to: '/volumen', label: 'Volumen', sub: 'Arbeitssätze je Muskelgruppe', Icon: IconVolume },
  { to: '/bloecke', label: 'Blöcke', sub: 'RPE-basierte Blockprogression je Übung', Icon: IconBlocks },
  { to: '/import', label: 'Import', sub: 'Plan aus Excel einlesen', Icon: IconImport },
  { to: '/anleitung', label: 'Anleitung', sub: 'Progression, Technik, Bedienung', Icon: IconGuide },
  { to: '/einstellungen', label: 'Einstellungen', sub: 'Konto, Training, Speicher', Icon: IconSettings },
]

function IconMehr() {
  return (
    <>
      <circle cx="5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="19" cy="12" r="1.6" />
    </>
  )
}

export function Nav() {
  const [offen, setOffen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    if (!offen) return
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && setOffen(false)
    document.addEventListener('keydown', onEsc)
    return () => document.removeEventListener('keydown', onEsc)
  }, [offen])

  const mehrAktiv = MEHR_ITEMS.some(m => location.pathname === m.to)

  return (
    <>
      <nav id="nav" aria-label="Bereiche">
        {NAV_ITEMS.map(({ to, label, Icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => 'nav-btn' + (isActive ? ' on' : '')} aria-label={label}>
            <svg viewBox="0 0 24 24">
              <Icon />
            </svg>
            <span>{label}</span>
          </NavLink>
        ))}
        <button
          className={'nav-btn' + (mehrAktiv ? ' on' : '')}
          aria-haspopup="true"
          aria-expanded={offen}
          aria-label="Weitere Bereiche"
          onClick={() => setOffen(o => !o)}
        >
          <svg viewBox="0 0 24 24">
            <IconMehr />
          </svg>
          <span>Mehr</span>
        </button>
      </nav>

      {offen && (
        <>
          <div className="mehr-hinter" onClick={() => setOffen(false)} />
          <div className="mehr-feld" role="menu" aria-label="Weitere Bereiche">
            {MEHR_ITEMS.map(({ to, label, sub, Icon }) => (
              <NavLink
                key={to}
                to={to}
                role="menuitem"
                className={({ isActive }) => 'mehr-eintrag' + (isActive ? ' on' : '')}
                onClick={() => setOffen(false)}
              >
                <svg viewBox="0 0 24 24">
                  <Icon />
                </svg>
                <span>
                  <b>{label}</b>
                  <small>{sub}</small>
                </span>
              </NavLink>
            ))}
          </div>
        </>
      )}
    </>
  )
}

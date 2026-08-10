import { NavLink } from 'react-router-dom'
import { IconDash, IconTrain, IconBench, IconVolume, IconRecords, IconSettings } from './icons'

const ITEMS = [
  { to: '/cockpit', label: 'Cockpit', Icon: IconDash },
  { to: '/training', label: 'Training', Icon: IconTrain },
  { to: '/bank', label: 'Bank', Icon: IconBench },
  { to: '/rekorde', label: 'Rekorde', Icon: IconRecords },
  { to: '/volumen', label: 'Volumen', Icon: IconVolume },
  { to: '/einstellungen', label: 'Einstellungen', Icon: IconSettings },
]

export function Nav() {
  return (
    <nav id="nav" aria-label="Bereiche">
      {ITEMS.map(({ to, label, Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) => 'nav-btn' + (isActive ? ' on' : '')}
          aria-label={label}
        >
          <svg viewBox="0 0 24 24">
            <Icon />
          </svg>
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

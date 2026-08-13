import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Mark } from './Mark'

const ANZEIGEDAUER = 750
const FADEDAUER = 260

/** Kurzer Vollbild-Aufbau des Logos beim App-Start (schon angemeldet) —
    läuft genau einmal, weil AppShell (der einzige Aufrufer) über die
    gesamte SPA-Sitzung hinweg nur einmal mountet, nicht bei jeder
    Routen-Navigation innerhalb der App. */
export function BootScreen() {
  const [sichtbar, setSichtbar] = useState(true)
  const [ausblendend, setAusblendend] = useState(false)

  useEffect(() => {
    const t1 = setTimeout(() => setAusblendend(true), ANZEIGEDAUER)
    const t2 = setTimeout(() => setSichtbar(false), ANZEIGEDAUER + FADEDAUER)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [])

  if (!sichtbar) return null

  return createPortal(
    <div className={'boot' + (ausblendend ? ' aus' : '')} aria-hidden="true">
      <Mark aufbau />
    </div>,
    document.body,
  )
}

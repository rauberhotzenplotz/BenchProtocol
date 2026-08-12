import { useEffect, useRef, useState, type ReactNode } from 'react'
import { RestTimerContext } from './rest-timer-context'

function restSekunden(endAt: number | null): number {
  return endAt == null ? 0 : Math.max(0, Math.ceil((endAt - Date.now()) / 1000))
}

/** Zeitrechnung über den Zielzeitpunkt (Date.now() + Sekunden), nicht über
    gezählte Ticks — ein gedrosselter Hintergrundtab lässt sonst die Uhr
    nachgehen. Derselbe Ansatz wie in der alten App. Date.now() wird bewusst
    nur innerhalb von Effekten aufgerufen, nie direkt beim Rendern (das
    machte den Compiler zurecht unglücklich — Komponenten müssen rein sein). */
export function RestTimerProvider({ children }: { children: ReactNode }) {
  const [label, setLabel] = useState<string | null>(null)
  const [endAt, setEndAt] = useState<number | null>(null)
  const [totalSeconds, setTotalSeconds] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [gymActive, setGymActive] = useState(false)
  const gepiept = useRef(false)

  useEffect(() => {
    if (endAt == null) return
    const id = setInterval(() => setSecondsLeft(restSekunden(endAt)), 250)
    return () => clearInterval(id)
  }, [endAt])

  useEffect(() => {
    if (endAt == null) return
    if (secondsLeft > 0) { gepiept.current = false; return }
    if (gepiept.current) return
    gepiept.current = true
    if (navigator.vibrate) navigator.vibrate([200, 100, 200])
    const weg = setTimeout(() => {
      setEndAt(null)
      setLabel(null)
    }, 4000)
    return () => clearTimeout(weg)
  }, [secondsLeft, endAt])

  return (
    <RestTimerContext.Provider
      value={{
        label,
        totalSeconds,
        secondsLeft,
        start: (seconds, l) => {
          if (seconds <= 0) return
          setLabel(l)
          setTotalSeconds(seconds)
          setSecondsLeft(seconds)
          setEndAt(Date.now() + seconds * 1000)
        },
        stop: () => {
          setEndAt(null)
          setSecondsLeft(0)
          setLabel(null)
        },
        addSeconds: delta => setEndAt(e => (e == null ? e : e + delta * 1000)),
        gymActive,
        setGymActive,
      }}
    >
      {children}
    </RestTimerContext.Provider>
  )
}

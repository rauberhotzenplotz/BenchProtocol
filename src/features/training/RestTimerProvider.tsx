import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { RestSekundenContext, RestTimerContext } from './rest-timer-context'

/** Bewusst ohne Math.max(0, …): die Pause soll über 0 hinaus weiterzählen
    (negativ), bis jemand sie aktiv stoppt oder eine neue startet — siehe
    RestTimerBar/GymModeAP für die "überzogen"-Anzeige. */
function restSekunden(endAt: number | null): number {
  return endAt == null ? 0 : Math.ceil((endAt - Date.now()) / 1000)
}

/** Zeitrechnung über den Zielzeitpunkt (Date.now() + Sekunden), nicht über
    gezählte Ticks — ein gedrosselter Hintergrundtab lässt sonst die Uhr
    nachgehen. Derselbe Ansatz wie in der alten App. Date.now() wird bewusst
    nur innerhalb von Effekten aufgerufen, nie direkt beim Rendern (das
    machte den Compiler zurecht unglücklich — Komponenten müssen rein sein).

    Zwei Contexts statt einem: Der Sekundenstand geht eigene Wege, damit
    ein Tick nicht den ganzen Baum unter dem Provider neu rendert — die
    Begründung steht ausführlich in rest-timer-context.ts. Aus demselben
    Grund ist der Steuerungs-Wert memoisiert: Ohne useMemo wäre er bei
    jedem Render des Providers ein neues Objekt und würde alle Verbraucher
    mitziehen, obwohl sich inhaltlich nichts geändert hat. */
export function RestTimerProvider({ children }: { children: ReactNode }) {
  const [label, setLabel] = useState<string | null>(null)
  const [endAt, setEndAt] = useState<number | null>(null)
  const [totalSeconds, setTotalSeconds] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [gymActive, setGymActive] = useState(false)
  const [reopenGym, setReopenGym] = useState<(() => void) | null>(null)
  const gepiept = useRef(false)

  useEffect(() => {
    if (endAt == null) return
    // Der Takt bleibt bei 250 ms, obwohl die Anzeige nur sekundenweise
    // springt: So sitzt der Sprung dicht am echten Sekundenwechsel statt
    // bis zu einer Sekunde daneben. Teuer ist das nicht mehr — setState
    // mit unverändertem Wert steigt in React ohne Render wieder aus, und
    // gerendert wird seit der Context-Trennung ohnehin nur noch die
    // Anzeige selbst.
    const id = setInterval(() => setSecondsLeft(restSekunden(endAt)), 250)
    return () => clearInterval(id)
  }, [endAt])

  // Einmaliger Stups beim Nulldurchgang — die Pause selbst räumt sich
  // danach nicht mehr automatisch ab, sie zählt bewusst negativ weiter
  // (siehe secondsLeft-Kommentar oben), bis "Erledigt"/"Überspringen"/
  // "Beenden" sie explizit stoppen.
  useEffect(() => {
    if (endAt == null) return
    if (secondsLeft > 0) { gepiept.current = false; return }
    if (gepiept.current) return
    gepiept.current = true
    if (navigator.vibrate) navigator.vibrate([200, 100, 200])
  }, [secondsLeft, endAt])

  const abgelaufen = endAt != null && secondsLeft <= 0

  const steuerung = useMemo(
    () => ({
      label,
      totalSeconds,
      abgelaufen,
      start: (seconds: number, l: string) => {
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
      addSeconds: (delta: number) => setEndAt(e => (e == null ? e : e + delta * 1000)),
      gymActive,
      setGymActive,
      reopenGym,
      setReopenGym: (fn: (() => void) | null) => setReopenGym(() => fn),
    }),
    [label, totalSeconds, abgelaufen, gymActive, reopenGym],
  )

  return (
    <RestTimerContext.Provider value={steuerung}>
      <RestSekundenContext.Provider value={secondsLeft}>{children}</RestSekundenContext.Provider>
    </RestTimerContext.Provider>
  )
}

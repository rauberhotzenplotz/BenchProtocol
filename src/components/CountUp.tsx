import { useEffect, useRef, useState } from 'react'

interface Props {
  value: number
  decimals?: number
  duration?: number
}

/** Zählt einmal beim Einblenden von 0 auf den Zielwert hoch (Ease-out-
    kubisch, wie früher im Original) — spätere Änderungen von value folgen
    danach direkt, ohne erneut bei 0 zu starten. */
export function CountUp({ value, decimals = 0, duration = 850 }: Props) {
  const [anzeige, setAnzeige] = useState(0)
  const [fertig, setFertig] = useState(false)
  const zielRef = useRef(value)

  useEffect(() => {
    const ziel = zielRef.current
    const t0 = performance.now()
    let raf = 0
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / duration)
      const e = 1 - Math.pow(1 - p, 3)
      setAnzeige(ziel * e)
      if (p < 1) raf = requestAnimationFrame(step)
      else setFertig(true)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [duration])

  // Deutsches Komma: Die Zahl steht neben Werten, die formatGewicht
  // schreibt -- "62,5 kg" hier und "62.5 kg" dort auf einem Schirm fiel auf.
  return <>{(fertig ? value : anzeige).toFixed(decimals).replace(".", ",")}</>
}

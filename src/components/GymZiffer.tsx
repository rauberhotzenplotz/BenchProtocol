import { useLayoutEffect, useRef, useState } from 'react'

/** Eine Ziffernstelle in der App-eigenen Anzeigeschrift. Beim Wechsel rollt
    die alte Ziffer wie bei einem Kilometerzähler nach oben weg, während die
    neue von unten nachzieht — statt eines eigenen Vektor-Nachbaus, der nie
    ganz wie die echte Schrift aussah. Die Rollbewegung ist eine reine
    CSS-Animation (siehe .gz-roll); data-motion="off" bremst sie global ab,
    dafür ist hier kein eigener Sonderfall nötig. */
export function GymZiffer({ zeichen }: { zeichen: string }) {
  const [alt, setAlt] = useState(zeichen)
  const [neu, setNeu] = useState(zeichen)
  const [dreht, setDreht] = useState(false)
  const vorherRef = useRef(zeichen)

  useLayoutEffect(() => {
    if (vorherRef.current === zeichen) return
    setAlt(vorherRef.current)
    setNeu(zeichen)
    setDreht(true)
    vorherRef.current = zeichen
  }, [zeichen])

  return (
    <span className="gz-box">
      {dreht ? (
        <span className="gz-roll" onAnimationEnd={() => setDreht(false)}>
          <span className="gz-glyph">{alt}</span>
          <span className="gz-glyph">{neu}</span>
        </span>
      ) : (
        <span className="gz-glyph gz-still">{neu}</span>
      )}
    </span>
  )
}

export function GymDoppelpunkt() {
  return <span className="gz-box gz-doppelpunkt">:</span>
}

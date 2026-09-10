/** Das Zeichen der App: eine Hantel, von zwei Ringen umlaufen.

    Farben kommen aus den Tokens statt aus festen Hex-Werten -- vorher
    steckten hier drei Leuchtfarben fest verdrahtet, und ein Designwechsel
    liess ausgerechnet das Markenzeichen im alten Look zurueck. */
export function Mark() {
  return (
    <div className="mark" aria-hidden="true">
      <svg viewBox="0 0 64 64">
        <g className="plate">
          <circle cx="32" cy="32" r="25" fill="none" stroke="var(--ink-4)" strokeWidth="1.1" opacity=".55" />
          <circle cx="32" cy="7" r="2.4" fill="var(--akzent)" />
          <circle cx="57" cy="32" r="1.6" fill="var(--ink-3)" />
        </g>
        <g className="plate2">
          <circle cx="32" cy="32" r="17" fill="none" stroke="var(--ink-4)" strokeWidth="1.1" opacity=".5" strokeDasharray="4 7" />
          <circle cx="32" cy="49" r="1.8" fill="var(--ink-3)" />
        </g>
        <rect x="14" y="30" width="36" height="4" rx="2" fill="var(--akzent)" opacity=".9" />
        <rect x="10" y="25" width="5" height="14" rx="2" fill="var(--akzent)" />
        <rect x="49" y="25" width="5" height="14" rx="2" fill="var(--akzent)" />
      </svg>
    </div>
  )
}

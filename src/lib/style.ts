import type { CSSProperties } from 'react'

/** Die Original-App steuert den gestaffelten Eintritts-Animation-Delay
    über die CSS-Variable --i auf jedem Abschnitt (siehe global.css,
    ".view.on.frisch > *"). React kennt CSS-Variablen nicht im Typ
    CSSProperties — dieser kleine Helfer erspart den Cast an jeder Stelle. */
export function cssVars(vars: Record<string, string | number>): CSSProperties {
  return vars as CSSProperties
}

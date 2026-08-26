/* Erzeugt src/features/cockpit/koerperModell.ts aus den Modelldaten von
   react-body-highlighter. Aufruf: node modell-ts.mjs <assets.ts> */
import { readFileSync } from 'node:fs'
const quelle = readFileSync(process.argv[2], 'utf8')
const schluessel = k => ({ ABDUCTOR: 'adductor', ABDUCTORS: 'abductors' })[k] ?? k.toLowerCase().replace(/_/g, '-')
function lesen(name) {
  const start = quelle.indexOf(`export const ${name}`)
  const ende = quelle.indexOf('export const', start + 10)
  const block = quelle.slice(start, ende === -1 ? undefined : ende)
  const g = new Map()
  const re = /muscle:\s*MuscleType\.([A-Z_]+),\s*svgPoints:\s*\[([\s\S]*?)\]/g
  let m
  while ((m = re.exec(block)) !== null) {
    const k = schluessel(m[1])
    const p = [...m[2].matchAll(/'([^']+)'/g)].map(x => x[1].trim().replace(/\s+/g, ' '))
    g.set(k, [...(g.get(k) ?? []), ...p])
  }
  return g
}
const raus = g => [...g].map(([k, p]) => `  '${k}': [\n${p.map(x => `    '${x}',`).join('\n')}\n  ],`).join('\n')

process.stdout.write(`/** Polygondaten eines menschlichen Körpermodells, Vorder- und Rückansicht,
    22 Muskelgruppen — das Koordinatensystem ist 100 × 200.

    Übernommen aus react-body-highlighter:
    https://github.com/giavinh79/react-body-highlighter
    MIT-Lizenz, Copyright (c) 2020 GV79.

    Nur die Punktlisten sind übernommen; eingefärbt und angeordnet wird in
    MuskelHeatmap.tsx. Erzeugt von werkzeuge/koerpermodell.mjs — nicht von
    Hand ändern, sonst weichen Datei und Quelle voneinander ab. */

export type ModellSchluessel = string

/** Seitenverhältnis des Modells, für die Darstellung. */
export const MODELL_VIEWBOX = '0 0 100 200'

export const VORDERSEITE: Record<ModellSchluessel, string[]> = {
${raus(lesen('anteriorData'))}
}

export const RUECKSEITE: Record<ModellSchluessel, string[]> = {
${raus(lesen('posteriorData'))}
}
`)

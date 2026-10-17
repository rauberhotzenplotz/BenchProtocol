/** Liest das vorberechnete Netz des 3D-Körpermodells
    (public/modelle/koerper3d.bin, erzeugt von werkzeuge/koerper3d-netz.mjs).
    Reine Datenarbeit ohne WebGL — deshalb eigene Datei und testbar. */

export interface KoerperNetz {
  positionen: Float32Array
  normalen: Float32Array
  /** Region je Punkt als Nummer in REGIONEN (koerper3dModell.ts); 255 = keine. */
  regionen: Uint8Array
  /** Wie stark die Region am Punkt wirkt, 0–1 — weich zum Rand hin. */
  anteile: Float32Array
  indizes: Uint16Array
  anzahlRegionen: number
}

/** Zerlegt die Binärdatei. Kopiert jeden Abschnitt in ein eigenes Array,
    statt Sichten auf den Puffer zu legen: Die Abschnitte beginnen nicht
    zwingend an Grenzen, die ein Float32Array verlangt. */
export function netzLesen(puffer: ArrayBuffer): KoerperNetz {
  const v = new DataView(puffer)
  const kennung = String.fromCharCode(v.getUint8(0), v.getUint8(1), v.getUint8(2), v.getUint8(3))
  if (kennung !== 'BPK3') throw new Error(`Unbekanntes Netzformat: ${kennung}`)
  const anzahlRegionen = v.getUint16(6, true)
  const punkte = v.getUint32(8, true)
  const anzahlIndizes = v.getUint32(12, true)
  const min = [v.getFloat32(16, true), v.getFloat32(20, true), v.getFloat32(24, true)]
  const max = [v.getFloat32(28, true), v.getFloat32(32, true), v.getFloat32(36, true)]

  let o = 40
  const positionen = new Float32Array(punkte * 3)
  for (let i = 0; i < punkte * 3; i++, o += 2) {
    const a = i % 3
    positionen[i] = min[a] + (v.getUint16(o, true) / 65535) * (max[a] - min[a])
  }
  const normalen = new Float32Array(punkte * 3)
  for (let i = 0; i < punkte * 3; i++, o++) normalen[i] = v.getInt8(o) / 127
  const regionen = new Uint8Array(puffer.slice(o, o + punkte))
  o += punkte
  const anteile = new Float32Array(punkte)
  for (let i = 0; i < punkte; i++, o++) anteile[i] = v.getUint8(o) / 255
  o = Math.ceil(o / 2) * 2
  const indizes = new Uint16Array(anzahlIndizes)
  for (let i = 0; i < anzahlIndizes; i++, o += 2) indizes[i] = v.getUint16(o, true)

  return { positionen, normalen, regionen, anteile, indizes, anzahlRegionen }
}

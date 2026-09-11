/* Fuenf gedeckte Toene statt fuenf Leuchtfarben. Sie muessen sich
   voneinander unterscheiden lassen, nicht auffallen: In der neuen Optik
   ist Farbe die Ausnahme, und ein Trainingstag ist kein Alarm. Alle fuenf
   liegen auf aehnlicher Helligkeit, damit kein Tag wichtiger aussieht als
   die anderen. */
const TAG_PALETTE = ['#7E8EB6', '#6FBE94', '#BA8C7C', '#9A8CB8', '#C7A469']

/** Feste Farbe je Trainingstag, nach seiner Position in der Tagesliste —
    dieselbe Zuordnung überall, wo Tage nebeneinander auftauchen (Kalender,
    Datumsstreifen, Diagramme, Tageskarten), damit man sie auf einen
    Blick unterscheidet statt an gleichfarbigen Chips raten zu müssen. */
export function tagFarbe(days: { id: string }[], dayId: string): string {
  const idx = days.findIndex(d => d.id === dayId)
  return TAG_PALETTE[idx >= 0 ? idx % TAG_PALETTE.length : 0]
}

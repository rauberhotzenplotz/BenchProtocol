const TAG_PALETTE = ['#35F0D0', '#8B7CFF', '#FF4D9D', '#3FE08A', '#FFC44D']

/** Feste Farbe je Trainingstag, nach seiner Position in der Tagesliste —
    dieselbe Zuordnung überall, wo Tage nebeneinander auftauchen (Kalender,
    Datumsstreifen, Cockpit-Charts, Tageskarten), damit man sie auf einen
    Blick unterscheidet statt an gleichfarbigen Chips raten zu müssen. */
export function tagFarbe(days: { id: string }[], dayId: string): string {
  const idx = days.findIndex(d => d.id === dayId)
  return TAG_PALETTE[idx >= 0 ? idx % TAG_PALETTE.length : 0]
}

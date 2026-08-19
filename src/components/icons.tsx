/** Handgezeichnete Icons aus der bestehenden App — 1:1 übernommen, damit die
    Optik der Navigation gleich bleibt. Jedes Icon liefert nur den Inhalt
    eines <svg viewBox="0 0 24 24">, der Rahmen kommt vom Aufrufer. */

export function IconDash() {
  return <path d="M3 13h7V3H3zM14 21h7v-8h-7zM14 9h7V3h-7zM3 21h7v-5H3z" />
}
export function IconTrain() {
  return <path d="M5 8v8M19 8v8M2 10v4M22 10v4M5 12h14" />
}
export function IconBench() {
  return <path d="M4 20V9M20 20V9M3 6h18M8 6v3M16 6v3M8 13h8" />
}
export function IconVolume() {
  return <path d="M4 20V10M10 20V4M16 20v-8M22 20v-5" />
}
export function IconRecords() {
  return (
    <path d="M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3M9 20h6M12 14v6" />
  )
}
export function IconCalendar() {
  return (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  )
}
export function IconImport() {
  return <path d="M12 3v11M8 10.5 12 14.5l4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
}
export function IconGuide() {
  return (
    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5zM4 5.5V20.5M8 8h7M8 12h5" />
  )
}
export function IconBlocks() {
  return <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM17 20l3-8-3-8" />
}
export function IconLibrary() {
  return (
    <path d="M5 4h9a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM17 7h2v13h-2M8 8h6M8 12h6" />
  )
}
export function IconSettings() {
  return (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1" />
    </>
  )
}

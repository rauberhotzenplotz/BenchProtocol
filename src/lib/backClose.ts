import { useEffect, useRef } from 'react'

/** Überlagernde Bildschirme (ZahlRad, Gym-Modus, Kalender-Dialog, Menüs …)
    laufen über lokalen Komponenten-State, nicht über Routen — weder die
    Handy-Zurück-Taste (siehe registerNativeBackButton in nativeShell.ts,
    die nur window.history.back() aufruft) noch eine Zurück-Geste im
    Browser kennen sie deshalb. Ohne diesen Hook navigiert "Zurück" also
    direkt in der Routen-Historie weiter und wirft z. B. mitten aus dem
    Gym-Modus bis ins Cockpit, statt nur den Dialog zu schließen.

    Der Hook schiebt beim Öffnen einen eigenen history-Eintrag nach und
    trägt sich in einen gemeinsamen Stapel ein. Bei "Zurück" feuert genau
    ein popstate-Ereignis, das immer nur den obersten Stapeleintrag
    schließt — verschachtelte Dialoge (z. B. eine Bestätigung über dem
    Gym-Modus) gehen dadurch Schritt für Schritt zu, nicht alle auf
    einmal. Schließt man stattdessen per Knopf/Antippen daneben, räumt der
    Hook den nachgeschobenen Eintrag selbst wieder ab (ein history.back()),
    damit "Zurück" später nicht ins Leere trifft. */

let stapel: Array<() => void> = []

/** Wie viele popstate-Ereignisse noch von eigenen history.back()-Aufrufen
    stammen und deshalb niemanden schließen dürfen.

    Ein history.back() wirkt nicht sofort, sondern schickt sein popstate
    erst später los — bis dahin ist nicht zu erkennen, ob das Ereignis von
    der Zurück-Taste kommt oder vom Aufräumen dieses Hooks. Ohne diese
    Unterscheidung schloss ein Bildschirm sich selbst, sobald er kurz
    hintereinander ab- und wieder aufgebaut wurde.

    Genau das passiert im Entwicklungsmodus bei jedem Öffnen: React ruft
    Effekte dort absichtlich doppelt auf (Mounten, Aufräumen, erneut
    Mounten). Das Aufräumen löste ein history.back() aus, dessen popstate
    erst eintraf, als der zweite Durchlauf sich längst wieder eingetragen
    hatte — und schloss ihn. Der Gym-Modus ließ sich dadurch im
    Dev-Server überhaupt nicht mehr öffnen. */
let eigeneRuecknahmen = 0

function beiZurueck() {
  if (eigeneRuecknahmen > 0) {
    eigeneRuecknahmen--
    return
  }
  const oberster = stapel[stapel.length - 1]
  oberster?.()
}

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', beiZurueck)
}

export function useSchliessenPerZurueck(offen: boolean, onSchliessen: () => void) {
  const schliessenRef = useRef(onSchliessen)
  // Nachgezogen im Effekt statt beim Rendern: Ein Render kann verworfen
  // werden, eine dabei gesetzte Ref bliebe trotzdem stehen.
  useEffect(() => {
    schliessenRef.current = onSchliessen
  })

  useEffect(() => {
    if (!offen) return
    window.history.pushState({ overlay: true }, '')
    let perZurueckGeschlossen = false
    const eintrag = () => {
      perZurueckGeschlossen = true
      stapel = stapel.filter(e => e !== eintrag)
      schliessenRef.current()
    }
    stapel.push(eintrag)
    return () => {
      stapel = stapel.filter(e => e !== eintrag)
      // Per Knopf oder Antippen daneben geschlossen: den eigenen
      // history-Eintrag wieder abräumen, damit "Zurück" später nicht ins
      // Leere trifft. Das dabei ausgelöste popstate ist unseres.
      if (!perZurueckGeschlossen) {
        eigeneRuecknahmen++
        window.history.back()
      }
    }
  }, [offen])
}

const SCHLUESSEL = 'benchProtocol.vibration'

export function vibrationAn(): boolean {
  return localStorage.getItem(SCHLUESSEL) !== 'off'
}

export function setVibrationAn(an: boolean) {
  localStorage.setItem(SCHLUESSEL, an ? 'on' : 'off')
}

/** Kurze Rückmeldung über den Vibrationsmotor. Im Studio hat man das Handy
    oft nicht im Blick — ein Satz ist abgehakt, ohne hinzusehen.

    Bewusst still fehlschlagend: iOS kennt die Schnittstelle gar nicht,
    Desktop-Browser haben keinen Motor, und manche Browser werfen, wenn der
    Aufruf nicht aus einer Nutzergeste kommt. In all diesen Fällen soll
    nichts passieren, statt den Aufrufer zu stören. */
export function vibrieren(muster: number | number[]) {
  if (!vibrationAn()) return
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return
  try {
    navigator.vibrate(muster)
  } catch {
    // Kein Motor, keine Geste, keine Erlaubnis — alles kein Grund für einen Fehler.
  }
}

/** Ein Satz sitzt: ein kurzer, trockener Stups. */
export const SATZ_ERLEDIGT = 22

/** Eine Übung klebt jetzt an der Hand: ein einzelner, leichter Tupfer.
    Bewusst schwächer als SATZ_ERLEDIGT — das Aufnehmen ist ein Zwischen-
    schritt, kein Ergebnis. */
export const AUFGENOMMEN = 14

/** Einheit geschafft: kurz-kurz-lang, deutlich als Abschluss erkennbar. */
export const TRAINING_FERTIG = [26, 70, 26, 70, 120]

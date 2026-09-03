/** Wo der Nutzer zuletzt im Trainings-Tab stand.

    Drei Beschwerden hängen an derselben Lücke: Der Trainings-Tab merkte
    sich nichts. Welcher Tag offen war, ob der Gym-Modus lief und bei
    welcher Übung — alles lag in useState und war nach einem Neustart weg.
    In der Praxis heißt "Neustart" auf dem Handy schon: Android hat die
    WebView im Hintergrund weggeräumt, während man zwischen zwei Sätzen
    aufs Telefon geschaut hat.

    Folgen waren:
    - Nach dem Wiederöffnen stand man am Anfang der Einheit statt beim
      laufenden Satz.
    - Die schwebende Pausenuhr konnte nur zurück in den Gym-Modus
      springen, solange dessen SessionView gemountet war. Wer den Tab
      gewechselt hatte, landete in der Tagesübersicht.

    Bewusst localStorage und nicht der Query-Cache: Das hier ist
    Bedienzustand, keine Trainingsdaten. Er soll nicht synchronisiert
    werden, nicht in die Offline-Warteschlange geraten und auf einem
    zweiten Gerät nichts verändern. */

const SCHLUESSEL = 'benchProtocol.trainingsStand'

export interface TrainingsStand {
  /** Welcher Trainingstag zuletzt offen war. */
  dayId: string
  /** Für welche Woche — ein Stand aus einer abgeschlossenen Woche soll
      nicht in die neue hineinwirken. */
  woche: number
  /** Ob der Gym-Modus lief. */
  gymOffen: boolean
  /** Welche Übung im Gym-Modus vorne stand. */
  uebIdx: number
}

/** Auslesen und prüfen — als reine Funktion, damit die Prüfung ohne
    localStorage testbar bleibt. Alles Unerwartete ergibt null: Ein
    kaputter Eintrag darf den Trainings-Tab nicht lahmlegen, und ein
    verworfener Stand kostet nur einen Tap. */
export function standAus(roh: string | null): TrainingsStand | null {
  if (!roh) return null
  let wert: unknown
  try {
    wert = JSON.parse(roh)
  } catch {
    return null
  }
  if (typeof wert !== 'object' || wert === null) return null
  const s = wert as Partial<TrainingsStand>
  if (typeof s.dayId !== 'string' || !s.dayId) return null
  if (typeof s.woche !== 'number' || !Number.isFinite(s.woche)) return null
  return {
    dayId: s.dayId,
    woche: s.woche,
    gymOffen: s.gymOffen === true,
    uebIdx: typeof s.uebIdx === 'number' && s.uebIdx >= 0 ? Math.floor(s.uebIdx) : 0,
  }
}

/** Der gemerkte Stand, sofern er zu dieser Woche gehört. Eine ältere
    Woche gilt als erledigt — dort weiterzumachen wäre falsch. */
export function standFuerWoche(woche: number): TrainingsStand | null {
  const stand = standLesen()
  return stand && stand.woche === woche ? stand : null
}

export function standLesen(): TrainingsStand | null {
  try {
    return standAus(localStorage.getItem(SCHLUESSEL))
  } catch {
    return null
  }
}

export function standSchreiben(stand: TrainingsStand | null) {
  try {
    if (stand) localStorage.setItem(SCHLUESSEL, JSON.stringify(stand))
    else localStorage.removeItem(SCHLUESSEL)
  } catch {
    // Privater Modus o. Ä. — dann eben ohne Gedächtnis.
  }
}

/** Einzelne Felder fortschreiben, ohne den Rest zu verlieren. Der
    Gym-Modus kennt nur seinen Übungsindex, die TrainingPage nur den Tag —
    beide sollen sich nicht gegenseitig überschreiben. */
export function standAendern(patch: Partial<TrainingsStand> & { dayId: string; woche: number }) {
  const alt = standLesen()
  const gleicherTag = alt?.dayId === patch.dayId && alt?.woche === patch.woche
  standSchreiben({
    gymOffen: gleicherTag ? alt.gymOffen : false,
    uebIdx: gleicherTag ? alt.uebIdx : 0,
    ...patch,
  })
}

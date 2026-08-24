import type { KeyboardEvent } from 'react'
import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { ueberlagerungOffen } from './backClose'

/** Steht die App auf ihrem allerersten Eintrag, gibt es nichts mehr, wohin
    "Zurück" führen könnte — dann soll sie sich beenden, wie auf Android
    üblich.

    Gefragt wird react-router, das in history.state einen laufenden Index
    mitführt. window.history.length taugt dafür nicht: Der Wert zählt auch
    Einträge vor uns und schrumpft beim Zurückgehen nie wieder. */
function amAnfangDerHistorie(): boolean {
  const stand = window.history.state as { idx?: number } | null
  return typeof stand?.idx === 'number' ? stand.idx === 0 : window.history.length <= 1
}

/** Android-Hardware-Zurück-Taste: ohne diesen Listener beendet sie die App
    sofort, egal wo man gerade ist — Capacitor fängt sie nicht automatisch
    ab. Läuft nur nativ (Capacitor.isNativePlatform()), auf der PWA im
    Browser tut sich hier nichts.

    Bewusst ohne das mitgelieferte canGoBack: Das meldet die
    Navigations-Historie der WebView, also tatsächlich geladene Seiten.
    Eine Single-Page-App lädt genau einmal und legt danach nur noch
    history-Einträge per pushState an — canGoBack bleibt deshalb dauerhaft
    false, und die Zurück-Taste beendete die App selbst dann, wenn der
    Gym-Modus offen war. Auf dem Gerät nachgewiesen: Das Logbuch zeigte
    "Notifying listeners for event backButton" direkt gefolgt von
    "exitApp", während die Seite drei history-Einträge hatte.

    Reihenfolge der Prüfung: Erst eine offene Überlagerung (Gym-Modus,
    ZahlRad, Menü …), die per history.back() ihr popstate bekommt und sich
    selbst schließt (siehe backClose.ts). Sonst eine Seite zurück. Und nur
    ganz am Anfang wirklich beenden. */
export function registerNativeBackButton() {
  if (!Capacitor.isNativePlatform()) return

  void App.addListener('backButton', () => {
    if (ueberlagerungOffen() || !amAnfangDerHistorie()) window.history.back()
    else void App.exitApp()
  })
}

/** Android-WebView-Bug (auf einem Testgerät reproduziert, Chromium/WebView
    150 + Gboard): Backspace/Entf liefert ein keydown, dessen
    defaultPrevented schon VOR jedem eigenen Code auf true steht - die
    Tastatur kündigt die Löschung an, liefert aber nie das input-Event, das
    sie eigentlich auslösen müsste. Das Feld bleibt dadurch unverändert
    stehen, obwohl die Taste "funktioniert" (die Tastatur selbst zählt
    intern richtig runter). Erkennungsmerkmal ist genau dieses schon
    gesetzte defaultPrevented: auf einem normalen Browser bzw. einer
    funktionierenden WebView steht es an dieser Stelle noch nicht, der
    Fallback greift dort also nicht ein und doppelt nichts.

    Löscht das Zeichen bzw. die Selektion deshalb selbst über den nativen
    value-Setter (umgeht Reacts eigene Wert-Verfolgung) und stößt danach
    ein echtes input-Event an, damit das normale onChange des Feldes
    unverändert weiterläuft - als onKeyDown neben das bestehende onChange
    hängen, sonst keine Änderung am Feld nötig. */
export function onKeyDownAndroidBackspaceFix(e: KeyboardEvent<HTMLInputElement>) {
  if (e.key !== 'Backspace' && e.key !== 'Delete') return
  if (!e.defaultPrevented) return

  const el = e.currentTarget
  const start = el.selectionStart ?? el.value.length
  const end = el.selectionEnd ?? el.value.length
  let vonHier: number
  let bisHier: number
  if (start !== end) {
    vonHier = start
    bisHier = end
  } else if (e.key === 'Backspace') {
    if (start === 0) return
    vonHier = start - 1
    bisHier = start
  } else {
    if (start === el.value.length) return
    vonHier = start
    bisHier = start + 1
  }

  const neuerWert = el.value.slice(0, vonHier) + el.value.slice(bisHier)
  const nativerSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
  nativerSetter.call(el, neuerWert)
  el.setSelectionRange(vonHier, vonHier)
  el.dispatchEvent(new Event('input', { bubbles: true }))
  e.preventDefault()
}

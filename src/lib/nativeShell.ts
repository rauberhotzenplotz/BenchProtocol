import type { KeyboardEvent } from 'react'
import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'

/** Android-Hardware-Zurück-Taste: ohne diesen Listener beendet sie die App
    sofort, egal wo man gerade ist — Capacitor fängt sie nicht automatisch
    ab. Läuft nur nativ (Capacitor.isNativePlatform()), auf der PWA im
    Browser tut sich hier nichts. canGoBack spiegelt die Browser-History
    der WebView wider, die react-router-dom (BrowserRouter) ganz normal
    mitschreibt — ein Tab-Wechsel über Nav.tsx erzeugt also einen Eintrag,
    den die Zurück-Taste rückgängig machen kann. Modal-artige Overlays
    (ZahlRad, Gym-Modus, Kalender) laufen über lokalen Komponenten-State,
    nicht über Routen — die Zurück-Taste schließt sie also (noch) nicht
    gezielt, sondern navigiert/verlässt die App wie gewohnt. */
export function registerNativeBackButton() {
  if (!Capacitor.isNativePlatform()) return

  void App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) window.history.back()
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

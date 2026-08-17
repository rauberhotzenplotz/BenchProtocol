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

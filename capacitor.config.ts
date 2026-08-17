import type { CapacitorConfig } from '@capacitor/cli'

// App-ID nach dem üblichen Rückwärts-Domain-Schema — vor der ersten
// echten Veröffentlichung im Play Store noch änderbar, danach nicht mehr
// (die ID ist Teil der Paket-Identität). Bis dahin beliebig anpassbar.
const config: CapacitorConfig = {
  appId: 'com.benchprotocol.app',
  appName: 'Bench Protocol',
  // Capacitor packt den fertigen Vite-Build (dist/) in die native Hülle —
  // exakt dieselben Dateien, die auch die PWA ausliefert. "npm run build"
  // muss vor jedem "npx cap sync" gelaufen sein.
  webDir: 'dist',
  backgroundColor: '#080B10',
  android: {
    backgroundColor: '#080B10',
  },
}

export default config

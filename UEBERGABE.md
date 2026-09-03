# Weiterbauen auf einem anderen Gerät

Diese Datei liegt bewusst **im Repo**: Ein `git clone` genügt, um sie zu haben — man
braucht keinen Zugriff auf einen Chatverlauf und keine Anhänge.

Stand beim Schreiben: Branch `main`, Commit `c91bffc`, 194 Tests grün,
Node 24.19 / npm 11.17.

## Das Wichtigste zuerst

Der gesamte Code liegt in `github.com/rauberhotzenplotz/BenchProtocol`, Branch `main`.
Ein `git clone` holt alles — **bis auf vier Dateien**, die absichtlich nicht im Repo
liegen. Ohne die erste davon startet die App gar nicht.

**Achtung bei der Ordnerstruktur:** Die Repo-Wurzel ist der `app/`-Ordner, nicht der
übergeordnete `Plan/`-Ordner. Ein Clone ergibt also direkt den Ordner mit der
`package.json`.

## Die vier Dateien außerhalb des Repos

### 1. `.env.local` — ohne das läuft nichts

Supabase-Adresse und anon key, ausgeschlossen über `*.local` in `.gitignore`.
Die Werte stehen **nicht** in diesem Repo: Sie sind im Supabase-Dashboard unter
**Project Settings → API** abzulesen und in eine neue Datei `.env.local` neben der
`package.json` zu schreiben:

```
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

Der anon key ist kein Geheimnis im engeren Sinn — er steckt ohnehin in jedem gebauten
Bündel, die Absicherung passiert über Row Level Security. Er steht hier trotzdem nicht
im Klartext, weil ein Repo an Orte gelangt, an die ein Schlüssel nicht muss. Abschreiben
aus dem Dashboard dauert eine Minute.

### 2. `android/local.properties` — Pfad anpassen

Zeigt Gradle, wo das Android-SDK liegt. Android Studio legt die Datei beim ersten Öffnen
des `android/`-Ordners selbst an — dann braucht man sie gar nicht von Hand. Sonst:

```properties
sdk.dir=E\:\\Daten\\MyAppCreations\\SDKFolder
```

Der Pfad gilt für das Ausgangsgerät und ist zu ersetzen. Rückwärtsschrägstriche werden
doppelt geschrieben, der Doppelpunkt hinter dem Laufwerksbuchstaben mit `\` geschützt —
so verlangt es das `.properties`-Format.

### 3. `dev-server.cmd` — Pfad anpassen

Nur nötig, wenn der Browser-Bereich von Claude Code den Entwicklungsserver starten soll;
sonst reicht `npm run dev` von Hand. Liegt im Projektordner und wird bewusst nicht
eingecheckt, weil er den Ordnerpfad des jeweiligen Rechners enthält.

```bat
@echo off
set PATH=C:\Program Files\nodejs;%PATH%
cd /d "E:\Daten\Fitness\Plan\app"
npm run dev
```

Beide Pfade — Node und Projektordner — auf dem neuen Gerät anpassen.

### 4. `.claude/launch.json` — optional

Liegt **außerhalb** des Repos, eine Ebene über dem Projektordner. Verbindet den
Browser-Bereich mit dem Entwicklungsserver auf Port 5173 und verweist auf
`dev-server.cmd`, also denselben Pfad mit anpassen.

```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "bench-protocol-dev",
      "runtimeExecutable": "E:\\Daten\\Fitness\\Plan\\app\\dev-server.cmd",
      "runtimeArgs": [],
      "port": 5173
    }
  ]
}
```

## Einrichten

**1. Holen und installieren**

```bash
git clone https://github.com/rauberhotzenplotz/BenchProtocol.git
cd BenchProtocol
npm install
```

**2. Zugangsdaten ablegen** — `.env.local` anlegen, siehe oben.

**3. Läuft es?**

```bash
npm run dev     # http://localhost:5173
npm run test    # 194 Tests
npm run lint
npm run build
```

Sind die 194 Tests grün und der Bau fehlerfrei, steht die Grundlage.

**4. Nur für die Android-App**

```bash
npm run build
npx cap sync android
cd android
JAVA_HOME="…/Android Studio/jbr" ./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

Gradle braucht das JDK, das bei Android Studio mitkommt (Ordner `jbr`). Die
System-Java-Version reicht nicht.

## Fallstricke, die Zeit gekostet haben

**Installieren aktualisiert die App nicht.** Nach `adb install` liefert der Service
Worker weiter das alte Bündel aus — man prüft dann ahnungslos die vorige Fassung.
Erkennbar am Dateinamen in `performance.getEntriesByType('resource')`: steht dort ein
anderes `assets/index-*.js` als im Build, ist es der alte Stand. Abhilfe in der WebView:
Registrierung holen, `update()`, dann `waiting.postMessage({ type: 'SKIP_WAITING' })`,
auf `controllerchange` warten und erst dann neu laden.

**`canGoBack` ist immer false.** Capacitors `canGoBack` meldet die Navigations-Historie
der WebView, also geladene Seiten. Diese App lädt genau einmal und arbeitet danach nur
mit `pushState`. Die Zurück-Logik in `src/lib/nativeShell.ts` hängt deshalb bewusst nicht
daran. Nur am echten Gerät prüfbar.

**`navigator.onLine` lügt.** In der Android-WebView meldet `navigator.onLine` auch ohne
Netz `true`. Die gesamte Offline-Schicht in `src/lib/offline/netz.ts` misst deshalb
Erreichbarkeit, statt der Angabe zu glauben. Diese Grundannahme bitte nicht
„vereinfachen".

**Werkzeug-Eigenheiten.** Git-Bash verbiegt Pfade wie `/sdcard/…` — `MSYS_NO_PATHCONV=1`
voranstellen. Android Studio und `adb` streiten sich um den Server; Studio schließen,
bevor über das Kabel gearbeitet wird. Bildschirmfotos vom Gerät sind 1080 × 2340 und für
die meisten Werkzeuge zu groß — `Page.captureScreenshot` über das DevTools-Protokoll
liefert die kleinere CSS-Auflösung.

## Wo die App gerade steht

Die letzten Runden, jüngste zuerst:

| Commit | Was |
| --- | --- |
| `c91bffc` | Heatmap und Druck-Zug-Bilanz zählen dasselbe rollende Sieben-Tage-Fenster |
| `5c05d1f` | Muskel-Heatmap im Cockpit — Körpermodell, nach Belastung und Erholung eingefärbt |
| `988ea9f` | Druck-Zug-Bilanz im Cockpit |
| `e1f335b` | Lastverteilung im Bank-Tab |
| `949ac98` | Tote Kalender-Regeln entfernt |
| `389ceeb` | Lange Dialoge ließen sich nicht scrollen |
| `dce0a0c` | 29 Hammer-Strength-Geräte im Übungskatalog |
| `9868626` | Suche lädt nach, statt bei 30 Treffern aufzuhören |
| `432d60b` | Zahleneingabe: mehr Rollweg, Feld startet leer |
| `0d30884` | Hardware-Zurück-Taste beendete die App statt zurückzugehen |

Auf dem Handy läuft dieser Stand bereits. Die Datenbank ist aktuell: Migration `0013`
(Hammer Strength) ist ausgeführt, der Katalog hat 3275 Einträge.

## Offene Punkte

- **Das Cockpit ist voll geworden.** Zwischen Kennzahlen und Sternbild stehen jetzt zwei
  große Karten. Ob beide dort bleiben sollen, ist noch nicht entschieden.
- **Bekanntheits-Rangliste hat eine Lücke.** Die Ankerliste für „Brust" kennt nur
  *bench press*, nicht *incline press*. Schräg- und Negativbankdrücken landen beim
  Blättern deshalb weit hinten — auch bestehende Einträge, nicht nur die neuen
  Hammer-Strength-Geräte. Eine Änderung an `werkzeuge/katalog-bekanntheit.mjs` würde die
  Ränge des ganzen Katalogs neu berechnen und muss auf dem Gerät laufen.
- **Zahlenformat ist uneinheitlich.** `CountUp` nutzt `toFixed` und zeigt Dezimalpunkte,
  der Gym-Modus hat einen eigenen Helfer mit Komma. App-weit umzustellen wäre eine eigene
  Entscheidung.
- **Ein kleiner Render alle zwei Sekunden** im Trainingstab, rein lokal, ohne Netzanfrage.
  Kosten im Mikrosekundenbereich, nie zu Ende verfolgt.
- **Der Plan-Editor ist nie am Gerät geprüft worden** — nur im Browser. Er nutzt denselben
  Zieh-Hook wie der Trainingstab, der geprüft ist.

## Wie hier gearbeitet wird

- Kommentare, Bezeichner und Commit-Nachrichten auf Deutsch. In Bezeichnern keine
  Umlaute, sondern `ae`/`oe`/`ue` — also `naechsteSortierung`, nicht `nächsteSortierung`.
- Kommentare erklären das **Warum**, nicht das Was. Besonders dort, wo eine Lösung seltsam
  aussieht und einen Grund hat.
- Reine Funktionen mit Tests, Darstellung getrennt davon. Abgeleiteter Zustand beim
  Rendern statt `useEffect`-Kaskaden.
- Jede Animation mit `prefers-reduced-motion` abgesichert.
- Migrationen führt der Nutzer aus, nie das Werkzeug. SQL wird übergeben, dann gewartet.
- Beim Testen mit echten Trainingsdaten: vorher festhalten, hinterher exakt zurücksetzen.
- Nie `git add -A` — Dateien einzeln benennen. Committen und Pushen nur auf ausdrückliche
  Ansage.

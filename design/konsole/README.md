# Trainings-Konsole (Neon)

Das erste Design der App, eingefroren bei Commit `77e4077` plus den
Lesbarkeitsarbeiten vom September 2026.

## Idee

Ein Gym-Display. Die App sollte aussehen wie ein Gerät im Studio, nicht wie
eine Webseite: sehr dunkler Grund, Neon-Türkis als einzige Signalfarbe,
schmale Versalien mit weiter Sperrung, und ein animierter Weltraum-Nebel
als Hintergrund (`Nebel.tsx` — vier Gaswolken, Korn, zwei Sternenfelder,
zwei Sternschnuppen, Randabdunklung; reines CSS, damit es auf dem
Compositor läuft und die CPU im Studio nicht wachhält).

Kennzeichen:

- Leuchten als Gestaltungsmittel: fast jedes farbige Element trägt
  `box-shadow: 0 0 Npx <farbe>`, Zahlen zusätzlich `text-shadow`.
- Versalien mit `letter-spacing` von .1em bis .22em für Etiketten,
  Kartenköpfe und Knöpfe.
- Bahnschrift (schmal laufend) für Zahlen und Überschriften, Cascadia Mono
  für Etiketten und Messwerte.
- Runde Ecken bis 16 px, Karten mit Verlaufsfüllung.

## Farben

| Variable | Wert | Rolle |
|---|---|---|
| `--ground` | `#080B10` | Seitengrund |
| `--ground-2` | `#05070A` | tiefster Grund |
| `--surface` | `#0E131B` | Karte |
| `--surface-2` | `#151D28` | erhöhte Fläche |
| `--surface-3` | `#1B2532` | Eingabefeld |
| `--line` | `#1E2836` | Rahmen |
| `--line-soft` | `#17202B` | Trennlinie |
| `--ink` | `#E6EDF5` | Text |
| `--ink-2` | `#A7B6C8` | Text, zweite Stufe |
| `--ink-3` | `#6E7F94` | Nebentext |
| `--ink-4` | `#5E7189` | Etiketten |
| `--neon` | `#35F0D0` | Signalfarbe, aktiver Zustand |
| `--neon-deep` | `#14B39A` | dieselbe, gedeckt |
| `--violet` | `#8B7CFF` | zweite Datenreihe |
| `--magenta` | `#FF4D9D` | dritte Datenreihe |
| `--good` | `#3FE08A` | erledigt |
| `--warn` | `#FFC44D` | Deload, Achtung |
| `--crit` | `#FF5C5C` | Fehler, Löschen |

## Schriften

```
--f-display: "Bahnschrift", "DIN Condensed", "Oswald", "Arial Narrow", system-ui, sans-serif
--f-body:    "Segoe UI Variable Text", "Segoe UI", system-ui, -apple-system, sans-serif
--f-mono:    "Cascadia Mono", "Consolas", ui-monospace, "SF Mono", monospace
```

## Radien

`--r-s: 6px`, `--r-m: 10px`, `--r-l: 16px`

## Wiederherstellen

Siehe `../README.md`. Neben dem Stylesheet gehoeren die Dateien in
`komponenten/` dazu: dort stecken die Farben, die aus gutem Grund im Code
stehen — die fuenf Tagesfarben, die Farbrampe der Muskel-Heatmap, das
Markenzeichen und der Weltraum-Nebel samt seiner Blockphase.

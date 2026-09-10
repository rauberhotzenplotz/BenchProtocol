# Graphit

Das aktuelle Design. Es liegt nicht als Kopie hier, sondern lebt in
`src/styles/global.css` — dieser Ordner beschreibt nur, wie es gedacht ist.

## Idee

Vorbild war der Look des YouTube-Kanals *Optimum*: sehr dunkel, sehr
ruhig, und alles, was zu sehen ist, hat einen Grund. Kein Gaming-Look,
keine Leuchtreklame — eher ein gut gebautes Gerät als ein Bildschirm, der
auf sich aufmerksam macht.

Vier Regeln:

1. **Farbe bedeutet etwas.** Es gibt genau eine Signalfarbe (`--akzent`,
   ein helles Blau) und drei Zustandsfarben. Alles andere sind Graustufen.
   Der Grund ist nicht neutral grau, sondern trägt einen Hauch Blau —
   exakt neutral gehalten las sich dasselbe Dunkel als *aschfahl*.
2. **Es gibt keine Karten.** Ein Abschnitt besteht aus einer Marke (Mono,
   versal, klein), einer Haarlinie darunter und dem Inhalt, der direkt auf
   dem Grund steht. Listen sind Zeilen mit Trennlinie statt einzelner
   Kacheln. Was hervorsticht, tut es durch Größe und eine schmale Marke an
   der Kante — nicht durch einen Rahmen um sich herum. Das ist die Sprache
   eines Messgeräts: Beschriftung, Skala, Wert.
3. **Flächen trennen sich durch Helligkeit**, nicht durch Leuchten. Kein
   Schatten ohne Versatz — ein Schein täuscht Höhe vor, wo keine ist.
4. **Rangfolge entsteht durch Größe, Gewicht und Abstand.** Versalien mit
   weiter Sperrung bleiben den kleinsten Etiketten vorbehalten, wo sie als
   Beschriftung gelesen werden und nicht als Text.

## Was gegenüber der Konsole weggefallen ist

| Weg | Warum |
|---|---|
| 112 Leucht-Schatten (`box-shadow: 0 0 …`) und alle `text-shadow` | Ein Schein ohne Versatz ist kein Licht, sondern Unschärfe. |
| Der animierte Weltraum-Nebel (10 Ebenen) | Hinter jeder Karte bewegte sich etwas; der Blick kam nie zur Ruhe. |
| 15 von 19 Dauerschleifen | Ein Punkt, der neben jeder Überschrift blinkt, sagt nichts — er blinkt immer. |
| Versalien an 61 Stellen | Alles groß heißt: nichts ist wichtiger als der Rest. |
| Bahnschrift als Anzeigeschrift | Auf Android gar nicht vorhanden — dort fiel sie immer schon auf Roboto zurück. Jetzt überall dieselbe Systemschrift. |
| Farbverläufe auf Karten, Knöpfen und Fortschrittsbalken | Ein Balken soll seine Länge zeigen, nicht changieren. |
| Rahmen an Karten, Kacheln, Marken, Eingabefeldern | Drei Rahmenstärken übereinander auf 375 px — das Auge zählt Kanten statt Inhalt. |
| Die Karten selbst | Egal wie ein Kasten gefärbt ist, die Form bleibt dieselbe — und damit der Eindruck. Jetzt: Marke, Haarlinie, Inhalt. |
| Plaketten um Zahlen und Kurzangaben | "4 × 5" braucht keine Kapsel. Ein Trennpunkt tut dasselbe ohne Kante. |
| Überzeilen, Untertitel, Fußnoten, Schalter-Erklärungen | Stand in der Oberfläche, gelesen wurde es einmal. Was davon zu wissen nötig ist, steht jetzt in der Anleitung. |

Geblieben sind: die beiden Ringe im Markenzeichen und das Atmen der frisch
gereizten Muskelflächen in der Heatmap — dort ist die Bewegung die
Aussage.

## Diagramme

Jeder Verlauf sieht gleich aus, weil es nur noch einen gibt: `Liniendiagramm`
in `src/features/statistik/Diagramme.tsx`. Der Block-Tab hat seine eigene
Kurve verloren und benutzt dieselbe.

Der Aufbau nach der Vorlage: ein Netz aus Streuwerten im Hintergrund in der
Farbe der Reihe, darüber die Linie in Weiß mit einem Ring je Messpunkt, in
den unteren Ecken Start- und Endwert, oben rechts der aktuelle. Achsenzahlen
gibt es keine — die Eckwerte sagen, worum es geht.

Das Netz ist **nicht zufällig**: Jeder Messpunkt wirft zwei Trabanten, deren
Versatz sich aus seinem Index errechnet. Dadurch steht das Netz bei jedem
Zeichnen an derselben Stelle, und seine Streuung wächst mit der Schwankung
zwischen den Wochen. Ein Diagramm, das bei jedem Rendern anders aussieht,
wäre kein Diagramm.

## Farben

Alle Farbwerte der App kommen aus dem Token-Block am Kopf von
`global.css`; im Regelwerk steht kein einziges Zahlentripel mehr außer
Schwarz und Weiß. Ein weiterer Designwechsel ist damit im Wesentlichen ein
Austausch dieses Blocks.

| Variable | Wert | Rolle |
|---|---|---|
| `--ground` | `#0B0D12` | Seitengrund |
| `--ground-2` | `#07080C` | tiefster Grund |
| `--surface` | `#12151C` | Karte |
| `--surface-2` | `#191D26` | erhöhte Fläche, Marken, Hover |
| `--surface-3` | `#212632` | Eingabefeld |
| `--line` | `#262C39` | Rahmen (nur noch selten) |
| `--line-soft` | `#1B202A` | Trennlinie |
| `--ink` | `#E4E8F0` | Text |
| `--ink-2` | `#A6AEBF` | Text, zweite Stufe |
| `--ink-3` | `#7F8797` | Nebentext |
| `--ink-4` | `#6A7181` | Etiketten |
| `--akzent` | `#89B4FA` | Signalfarbe: aktiv, ausgewählt, Hauptknopf |
| `--akzent-tief` | `#5E80B8` | dieselbe Rolle, zurückgenommen |
| `--auf-akzent` | `#0B0D12` | Schrift **auf** akzentfarbener Fläche |
| `--ton-b` | `#B49CE8` | Datenreihe B |
| `--ton-c` | `#E7A98C` | Datenreihe C |
| `--good` | `#86D9A8` | erledigt |
| `--warn` | `#E7C07B` | Deload, Achtung |
| `--crit` | `#E88C8C` | Fehler, Löschen |

Jede Farbe existiert zusätzlich als `--…-rgb` (nacktes Zahlentripel), damit
Regeln `rgba(var(--akzent-rgb), .13)` schreiben können.

Die fünf Trainingstagfarben stehen in
`src/features/training/dayColor.ts` und sind auf dieselbe Weise gedeckt.

## Schriften

Eine Familie für Text und Anzeige, Mono nur für Zahlen und Etiketten:

```
--f-display: "Segoe UI Variable Display", "Segoe UI", system-ui, …
--f-body:    "Segoe UI Variable Text", "Segoe UI", system-ui, …
--f-mono:    "Cascadia Mono", "Consolas", ui-monospace, "SF Mono", "Roboto Mono", monospace
```

## Maße

Radien: `--r-s: 6px`, `--r-m: 10px`, `--r-l: 14px`.

Abstände als Leiter, damit „eine Stufe mehr Luft“ überall dasselbe heißt:
`--a-1: 6px`, `--a-2: 10px`, `--a-3: 16px`, `--a-4: 24px`, `--a-5: 36px`.
Sie ersetzen die früheren krummen Einzelwerte (11, 13, 14, 16 …).

## Zurück zum Vorgänger

Siehe `../README.md`.

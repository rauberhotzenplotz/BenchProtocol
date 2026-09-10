# Designs

Die App hat genau ein Stylesheet: `src/styles/global.css`. Struktur und
Optik stecken darin zusammen, es gibt keinen Theme-Schalter zur Laufzeit.
Ein Designwechsel heißt deshalb: die Datei austauschen — plus eine Handvoll
Komponenten, in denen Farben aus gutem Grund im Code stehen (Tagesfarben,
Farbrampe der Heatmap, das Markenzeichen).

In diesem Ordner liegt jedes Design, das die App einmal hatte, vollständig.
Das ist die Rückfahrkarte, wenn ein neuer Entwurf nicht gefällt.

## Vorhandene Designs

| Ordner | Name | Stand |
|---|---|---|
| `konsole/` | Trainings-Konsole (Neon) | eingefroren bei Commit `77e4077`, September 2026 |
| `graphit/` | Graphit | aktiv — lebt in `src/styles/global.css`, beschrieben in `graphit/README.md` |

## Zurückwechseln

Der zuverlässige Weg ist git: Der Designwechsel ist **ein** Commit, und
`git revert` davon stellt alles her, auch die Umbenennungen
(`Nebel.tsx` → `Grund.tsx`) und die gelöschte `nebelPhase.ts`, die eine
Dateikopie nicht mitbringt.

```bash
git log --oneline --grep="Graphit"
git revert <commit>
```

Von Hand geht es auch, dann sind das diese Dateien:

```bash
cp design/konsole/global.css                    src/styles/global.css
cp design/konsole/komponenten/Nebel.tsx         src/components/Nebel.tsx
cp design/konsole/komponenten/nebelPhase.ts     src/components/nebelPhase.ts
cp design/konsole/komponenten/Mark.tsx          src/components/Mark.tsx
cp design/konsole/komponenten/MuskelChips.tsx   src/components/MuskelChips.tsx
cp design/konsole/komponenten/Sparkline.tsx     src/components/Sparkline.tsx
cp design/konsole/komponenten/dayColor.ts       src/features/training/dayColor.ts
cp design/konsole/komponenten/muskelHitze.ts    src/features/statistik/muskelHitze.ts
```

Danach noch von Hand: `src/App.tsx` wieder auf `<Nebel />` umstellen,
`src/components/Grund.tsx` löschen, und in `src/components/AppShell.tsx`
den Aufruf `useNebelPhase()` samt Hook zurückholen (steht im Commit).
Deshalb ist `git revert` der kürzere Weg.

Wenn ein Design länger bleibt, gehört sein Stand hier neu eingefroren —
die Kopien werden nicht mitgepflegt, wenn im laufenden Stylesheet etwas
repariert wird.

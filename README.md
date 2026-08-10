# Bench Protocol — App

React + Vite + TypeScript + PWA + Supabase. Mehrbenutzerfähiger Nachfolger der
Single-File-HTML-App (`werkzeuge/trainingsplan.html` im übergeordneten Ordner),
mit echtem Login und Datentrennung pro Konto über Row Level Security.

## Einrichten

```bash
npm install
cp .env.example .env.local   # dann Werte eintragen, siehe unten
```

`.env.local` braucht zwei Werte aus dem Supabase-Dashboard
(**Project Settings → API**):

```
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

Der anon key ist kein Geheimnis im eigentlichen Sinn (er landet ohnehin im
Browser-Bundle) — die eigentliche Absicherung passiert über Row Level
Security in der Datenbank, nicht über Geheimhaltung dieses Keys.

## Datenbank

Das Schema liegt in `supabase/migrations/0001_init.sql`. Einmalig im
Supabase-Dashboard unter **SQL Editor → New query** einfügen und ausführen.
Die Datei ist idempotent (kann gefahrlos erneut laufen).

## Entwickeln

```bash
npm run dev       # lokaler Dev-Server
npm run build     # Typecheck + Produktions-Build
npm run lint      # ESLint
```

## Umfang dieser Fassung

Umgesetzt: Auth (E-Mail/Passwort + Magic Link), Trainingspläne verwalten,
Training-Tab (Tage, Übungen, Sätze loggen, Einheiten starten/beenden),
Cockpit (unterschiedliche Widgets je nach Plan-Typ „Bankfokus“/„Standard“),
Bank-Tab (Ausgangsdaten, 4-Wochen-Progression, 1RM-Rechner, Ziel), Rekorde,
Wochenvolumen-Kontrollblatt, PWA-Installierbarkeit.

Bewusst noch nicht übernommen (siehe Übergabe-Notiz im Chat für Details):
Excel/CSV-Import, Gym-Modus (Vollbild-Workout), eigenständiges
Trainingsfenster, Satzpausen-Countdown-Timer, Kalender/Verlaufs-Heatmap,
Backup-Export.

## Deploy (Vercel)

1. Dieses Verzeichnis als eigenes GitHub-Repo pushen.
2. In Vercel „New Project“ → das Repo verbinden (Framework wird als Vite
   automatisch erkannt).
3. Unter Project Settings → Environment Variables dieselben zwei Werte wie
   in `.env.local` eintragen.
4. Deploy.

import { cssVars } from '../../lib/style'

/* Die einzige Seite, auf der Text der Inhalt ist -- und der Ort, an dem
   das steht, was ueberall sonst aus der Oberflaeche geflogen ist:
   Fussnoten unter Diagrammen, Erklaerungen unter Schaltern, Untertitel
   unter Ueberschriften. Nicht als Fliesstext, sondern als Nachschlagewerk:
   Begriff, Gedankenstrich, ein Satz. So findet man eine Antwort, ohne
   einen Absatz zu lesen. */

function Eintrag({ was, text }: { was: string; text: string }) {
  return (
    <div className="hilfe-zeile">
      <dt>{was}</dt>
      <dd>{text}</dd>
    </div>
  )
}

export function GuidePage() {
  return (
    <section className="view on frisch">
      <div className="view-head" style={cssVars({ '--i': 0 })}>
        <div>
          <h2>Anleitung</h2>
        </div>
      </div>

      <div className="card" style={cssVars({ '--i': 1 })}>
        <h3>Trainieren</h3>
        <dl className="hilfe">
          <Eintrag was="Einheit starten" text="Tag antippen, dann „Training starten“. Erst danach lassen sich Sätze abhaken." />
          <Eintrag was="Gym-Modus" text="Der Knopf „Gym“ öffnet die Vollbildansicht für das Studio: ein Satz, große Zahlen, Pausenuhr." />
          <Eintrag was="Satzpause" text="Startet nach jedem abgehakten Satz von selbst, wenn sie in den Einstellungen an ist." />
          <Eintrag was="Aufwärmen" text="Vor dem ersten Arbeitssatz eine Prozentleiter, aus dem Arbeitsgewicht gerechnet. Wird nicht protokolliert." />
        </dl>
      </div>

      <div className="card" style={{ ...cssVars({ '--i': 2 }), marginTop: 'var(--a-3)' }}>
        <h3>Pläne</h3>
        <dl className="hilfe">
          <Eintrag was="Bankfokus" text="4-Wochen-Block mit Prozent-Progression, 1RM-Rechner und Ziel-Fortschritt. Woche 4 ist Deload." />
          <Eintrag was="Standard" text="Freie Tage und Übungen, läuft unbegrenzt weiter." />
          <Eintrag was="Block abschließen" text="Wertet die Aufbauwochen aus und setzt daraus das Arbeitsgewicht des nächsten Blocks. Die Wochen zählen weiter, geloggte Sätze bleiben." />
          <Eintrag was="Umschalten" text="Über den Knopf mit dem Plan-Namen oben. Gewichte und Verlauf bleiben bei den Übungen." />
        </dl>
      </div>

      <div className="card" style={{ ...cssVars({ '--i': 3 }), marginTop: 'var(--a-3)' }}>
        <h3>Zahlen</h3>
        <dl className="hilfe">
          <Eintrag was="e1RM" text="Geschätztes Einwiederholungsmaximum. Je Satz aus der RPE-Tabelle, sonst über Epley." />
          <Eintrag was="Tonnage" text="Gewicht × Wiederholungen, über alle abgehakten Sätze." />
          <Eintrag was="RPE" text="Wie schwer ein Satz war: 10 heißt nichts mehr in Reserve, 8 heißt zwei Wiederholungen mehr wären gegangen." />
          <Eintrag was="Bestimmtheit" text="Wie gut die Trendlinie zu den Punkten passt. Unter 0,3 ist die Steigung eher Rauschen als Richtung." />
          <Eintrag was="Belastungssteuerung" text="Die letzten 7 Tage gegen den Schnitt der letzten 28. Braucht vier Wochen Vorlauf, sonst bleibt sie leer." />
          <Eintrag was="Intensitätszonen" text="Anteil am besten je erreichten e1RM der jeweiligen Übung." />
        </dl>
      </div>

      <div className="card" style={{ ...cssVars({ '--i': 4 }), marginTop: 'var(--a-3)' }}>
        <h3>Daten</h3>
        <dl className="hilfe">
          <Eintrag was="Offline" text="Die App läuft ohne Netz weiter. Änderungen gehen in eine Warteschlange und werden nachgereicht." />
          <Eintrag was="Sicherung" text="Unter Einstellungen: alles als JSON-Datei herunterladen und wieder einspielen." />
          <Eintrag was="Sichtbarkeit" text="Alle Daten liegen unter deinem Konto und sind nur für dich sichtbar." />
        </dl>
      </div>
    </section>
  )
}

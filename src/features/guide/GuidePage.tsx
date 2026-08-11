import { cssVars } from '../../lib/style'

export function GuidePage() {
  return (
    <section className="view on frisch">
      <div className="view-head" style={cssVars({ '--i': 0 })}>
        <div>
          <span className="eyebrow">Bedienung</span>
          <h2>Anleitung</h2>
          <p>Kurzer Überblick über die Bereiche und die Bankdrücken-Progression.</p>
        </div>
      </div>

      <div className="grid g2" style={{ ...cssVars({ '--i': 1 }), gap: 14 }}>
        <div className="card">
          <h3>
            <span className="tick" />
            Trainingspläne
          </h3>
          <p className="muted tiny" style={{ marginTop: 8 }}>
            Du kannst beliebig viele Trainingspläne anlegen — über den Knopf mit dem Plan-Namen oben in Cockpit,
            Training oder Bank. Zwei Arten stehen zur Wahl:
          </p>
          <ul style={{ margin: '9px 0 0', paddingLeft: 17, color: 'var(--ink-2)', fontSize: 12.8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <li><strong>Bankfokus</strong> — eigener 4-Wochen-Block mit Prozent-Progression, 1RM-Rechner und Ziel-Fortschritt.</li>
            <li><strong>Standard</strong> — freie Tage und Übungen ohne Bankdrücken-Steuerung, läuft unbegrenzt weiter statt in festen 4-Wochen-Blöcken.</li>
          </ul>
        </div>

        <div className="card">
          <h3>
            <span className="tick" />
            Training
          </h3>
          <p className="muted tiny" style={{ marginTop: 8 }}>
            Tippe auf einen Trainingstag, um die Einheit zu öffnen. Übung anlegen, dann Sätze eintragen — Gewicht,
            Wiederholungen und optional RPE. Ein Satz zählt erst nach dem Abhaken (✓) als erledigt, und das geht erst,
            sobald die Einheit läuft (Knopf „Training starten“).
          </p>
          <p className="muted tiny" style={{ marginTop: 8 }}>
            Ist die automatische Satzpause an (Einstellungen), startet nach jedem abgehakten Satz von selbst ein
            Countdown über die bei der Übung hinterlegte Pause.
          </p>
        </div>

        <div className="card">
          <h3>
            <span className="tick" />
            Cockpit
          </h3>
          <p className="muted tiny" style={{ marginTop: 8 }}>
            Überblick über die aktuelle Woche: was als Nächstes ansteht, wie oft und wie lange du zuletzt trainiert
            hast, sowie — bei einem Bankfokus-Plan — geschätztes 1RM, heutige Bankvorgabe und Wochenvolumen. Bei
            einem Standardplan zeigt die Kachel „Tonnage letztes Training“ stattdessen die bewegte Last der zuletzt
            beendeten Einheit.
          </p>
        </div>

        <div className="card">
          <h3>
            <span className="tick" />
            Bankdrücken-Progression
          </h3>
          <p className="muted tiny" style={{ marginTop: 8 }}>
            Im Bank-Tab eines Bankfokus-Plans legst du Arbeitsgewicht, Wiederholungen und Wiederholungen in Reserve
            fest — daraus rechnet Epley ein geschätztes 1RM. Die beiden Wochentabellen leiten daraus die Kilo-Vorgabe
            für „schwer“ und „mit Pause“ über vier Wochen ab (Woche 4 = Deload). Die Prozentsätze lassen sich pro
            Zeile anpassen.
          </p>
          <p className="muted tiny" style={{ marginTop: 8 }}>
            Am Ende eines Blocks: „Block abschließen“ erhöht das Arbeitsgewicht um 2,5 kg, setzt die Woche auf 1
            zurück und räumt die geloggten Sätze der vier Wochen auf — für einen sauberen Neustart.
          </p>
        </div>

        <div className="card">
          <h3>
            <span className="tick" />
            Rekorde &amp; Volumen
          </h3>
          <p className="muted tiny" style={{ marginTop: 8 }}>
            <strong>Rekorde</strong> zeigt je Übung den besten geloggten Satz pro Wiederholungszahl, nach geschätztem
            1RM sortiert. <strong>Volumen</strong> ist ein manuell gepflegtes Kontrollblatt: Arbeitssätze je
            Muskelgruppe und Trainingstag, mit Zielband 8–20 Sätze pro Woche.
          </p>
        </div>

        <div className="card">
          <h3>
            <span className="tick" />
            Konto &amp; Daten
          </h3>
          <p className="muted tiny" style={{ marginTop: 8 }}>
            Alle Daten liegen unter deinem Konto und sind nur für dich sichtbar. Unter Einstellungen kannst du die
            automatische Satzpause abschalten oder — unwiderruflich — alle eigenen Trainingspläne löschen.
          </p>
        </div>
      </div>
    </section>
  )
}

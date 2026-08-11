import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../auth/auth-context'
import { supabase } from '../../lib/supabase'
import { cssVars } from '../../lib/style'
import { useActivePlan } from '../plans/active-plan-context'
import { autoPauseAn, setAutoPauseAn } from '../training/pause'

export function SettingsPage() {
  const { user } = useAuth()
  const { plans } = useActivePlan()
  const qc = useQueryClient()
  const [busy, setBusy] = useState(false)
  const [bestaetigen, setBestaetigen] = useState(false)
  const [autoPause, setAutoPause] = useState(autoPauseAn())

  const alleDatenLoeschen = async () => {
    setBusy(true)
    try {
      // RLS begrenzt das ohnehin auf die eigenen Zeilen; Kind-Tabellen
      // hängen per on delete cascade an plans.
      const { error } = await supabase.from('plans').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      if (error) throw error
      await qc.invalidateQueries({ queryKey: ['plans', user?.id] })
      setBestaetigen(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="view on frisch">
      <div className="view-head" style={cssVars({ '--i': 0 })}>
        <div>
          <span className="eyebrow">App</span>
          <h2>Einstellungen</h2>
          <p>Konto und Speicher.</p>
        </div>
      </div>

      <div className="card" style={cssVars({ '--i': 1 })}>
        <h3>
          <span className="tick" />
          Konto
        </h3>
        <p className="muted tiny">Angemeldet als {user?.email}</p>
      </div>

      <div className="card" style={{ ...cssVars({ '--i': 2 }), marginTop: 14 }}>
        <h3>
          <span className="tick" />
          Training
        </h3>
        <div className="setzeile">
          <div className="txt">
            <b>Satzpause automatisch starten</b>
            <small>Sobald ein Satz abgehakt wird, läuft die Pause der Übung von selbst los.</small>
          </div>
          <div className="pills" role="group" aria-label="Satzpause automatisch starten">
            <button
              className={'pill' + (autoPause ? ' on' : '')}
              onClick={() => {
                setAutoPause(true)
                setAutoPauseAn(true)
              }}
            >
              An
            </button>
            <button
              className={'pill' + (!autoPause ? ' on' : '')}
              onClick={() => {
                setAutoPause(false)
                setAutoPauseAn(false)
              }}
            >
              Aus
            </button>
          </div>
        </div>
      </div>

      <div className="card" style={{ ...cssVars({ '--i': 3 }), marginTop: 14 }}>
        <h3>
          <span className="tick" />
          Daten
        </h3>
        <div className="setzeile" style={{ marginTop: 6 }}>
          <div className="txt">
            <b>Alle Daten löschen</b>
            <small>Löscht alle deine Trainingspläne, Tage, Übungen und geloggten Sätze unwiderruflich.</small>
          </div>
          {!bestaetigen ? (
            <button className="btn sm danger" onClick={() => setBestaetigen(true)} disabled={!plans.length}>
              Löschen
            </button>
          ) : (
            <div className="row" style={{ gap: 8 }}>
              <button className="btn ghost sm" onClick={() => setBestaetigen(false)}>
                Abbrechen
              </button>
              <button className="btn sm danger" onClick={() => void alleDatenLoeschen()} disabled={busy}>
                Ja, alles löschen
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

import { useState } from 'react'
import { useLibrarySearch, useCreateLibraryEntry, useUpdateLibraryEntry, useDeleteLibraryEntry } from './queries'
import { PAUSE_MINUTEN, formatPause, pauseMinuten } from '../training/pause'
import { ZahlEingabe } from '../../components/ZahlRad'
import { neueId } from '../../lib/offline/keys'
import { cssVars } from '../../lib/style'
import { onKeyDownAndroidBackspaceFix } from '../../lib/nativeShell'

/** Bibliothek aus Übungsvorlagen: Schema und Pause je Übungsname, einmal
    gepflegt statt bei jedem neuen Plan erneut eingetippt. Nicht an einen
    Plan gebunden — quer über alle Pläne nutzbar, dieselbe Übung taucht
    oft in mehreren wieder auf.

    Reine Vorlage, keine Verknüpfung: der Übungs-Picker (SessionView.tsx
    UebungAuswahl) übernimmt Schema/Pause beim Anlegen nur als Startwert.
    Eine spätere Änderung hier wirkt sich nicht auf schon angelegte
    Übungen aus, und umgekehrt ändert das Bearbeiten einer Übung nie die
    Bibliothek.

    Seit dem Import eines ganzen Übungskatalogs (~3245 Einträge) zeigt
    diese Seite nicht mehr alles auf einmal — dieselbe serverseitige
    Suche wie im Picker (useLibrarySearch), sonst wäre die Liste beim
    Öffnen unbedienbar lang. */
export function ExerciseLibraryPage() {
  const [suche, setSuche] = useState('')
  const {
    data: suchSeiten,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetching,
  } = useLibrarySearch(suche)
  // Die Suche liefert seitenweise (siehe useLibrarySearch); hier reicht
  // ein Knopf statt der Wächter-Zeile aus dem Picker — diese Seite
  // scrollt mit dem Fenster, hat also keine eigene Rollfläche, an der
  // sich ein IntersectionObserver festmachen könnte.
  const eintraege = suchSeiten?.pages.flat()
  const createEntry = useCreateLibraryEntry()
  const updateEntry = useUpdateLibraryEntry()
  const deleteEntry = useDeleteLibraryEntry()

  const [neuOffen, setNeuOffen] = useState(false)
  const [neuName, setNeuName] = useState('')
  const [neuScheme, setNeuScheme] = useState('3 × 10')
  const [neuRestMin, setNeuRestMin] = useState(2)

  const anlegen = () => {
    if (!neuName.trim()) return
    createEntry.mutate({
      id: neueId(),
      name: neuName.trim(),
      scheme: neuScheme.trim() || null,
      rest: formatPause(neuRestMin),
      sort_order: 0,
    })
    setNeuName('')
    setNeuScheme('3 × 10')
    setNeuRestMin(2)
    setNeuOffen(false)
  }

  return (
    <section className="view on frisch">
      <div className="view-head" style={cssVars({ '--i': 0 })}>
        <div>
          <span className="eyebrow">Vorlagen</span>
          <h2>Übungen</h2>
        </div>
      </div>

      <div className="card" style={cssVars({ '--i': 1 })}>
        <p className="muted tiny" style={{ margin: '0 0 14px' }}>
          Schema und Pause je Übungsname — beim Anlegen einer Übung in einem Plan schlägt die App sie vor. Nur eine
          Vorlage: die Übung bleibt danach unabhängig editierbar.
        </p>

        <div className="field" style={{ marginBottom: 14 }}>
          <label>Suchen</label>
          {/* onKeyDown fängt einen Android-WebView-Bug ab (siehe
              onKeyDownAndroidBackspaceFix in lib/nativeShell.ts) - alle
              Textfelder dieser Seite bekommen ihn deshalb mit. */}
          <input
            className="inp"
            placeholder="Name auf Deutsch oder Englisch, ab zwei Zeichen"
            defaultValue={suche}
            onChange={e => setSuche(e.target.value)}
            onKeyDown={onKeyDownAndroidBackspaceFix}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />
        </div>

        {suche.trim().length >= 2 && (
          <>
            {isFetching && !eintraege && <p className="muted tiny" style={{ margin: '0 0 14px' }}>Suche …</p>}
            {eintraege && eintraege.length === 0 && (
              <p className="muted tiny" style={{ margin: '0 0 14px' }}>Keine Vorlage gefunden.</p>
            )}
            {eintraege && eintraege.length > 0 && (
              <div className="bib-liste" style={{ marginBottom: 14 }}>
                <div className="bib-kopf">
                  <span>Name</span>
                  <span>Schema</span>
                  <span>Pause</span>
                  <span />
                </div>
                {eintraege.map(e => (
                  <div key={e.id} className="bib-zeile">
                    <input
                      className="inp"
                      defaultValue={e.name}
                      onKeyDown={onKeyDownAndroidBackspaceFix}
                      onBlur={ev => {
                        const wert = ev.target.value.trim()
                        if (wert && wert !== e.name) updateEntry.mutate({ id: e.id, patch: { name: wert } })
                        else ev.target.value = e.name
                      }}
                    />
                    <input
                      className="inp mono"
                      defaultValue={e.scheme ?? ''}
                      placeholder="z. B. 4 × 8"
                      onKeyDown={onKeyDownAndroidBackspaceFix}
                      onBlur={ev => updateEntry.mutate({ id: e.id, patch: { scheme: ev.target.value.trim() || null } })}
                    />
                    <ZahlEingabe
                      wert={pauseMinuten(e.rest)}
                      werte={PAUSE_MINUTEN}
                      format={formatPause}
                      titel="Pause"
                      einheit="min"
                      className="mono"
                      onWahl={n => updateEntry.mutate({ id: e.id, patch: { rest: formatPause(n ?? 2) } })}
                    />
                    <button className="rowbtn del" title="Vorlage löschen" onClick={() => deleteEntry.mutate(e.id)}>
                      <svg viewBox="0 0 24 24">
                        <path d="M4 7h16M9 7V5h6v2M7 7l1 13h8l1-13" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
            {hasNextPage && (
              <button
                className="btn ghost sm"
                style={{ marginBottom: 14 }}
                disabled={isFetchingNextPage}
                onClick={() => void fetchNextPage()}
              >
                {isFetchingNextPage ? 'Lädt …' : 'Mehr laden'}
              </button>
            )}
          </>
        )}

        {neuOffen ? (
          <div className="bib-neu">
            <div className="bib-zeile">
              {/* siehe Kommentar am Suchfeld oben in dieser Datei -
                  onKeyDownAndroidBackspaceFix fängt den Android-WebView-
                  Backspace-Bug ab. */}
              <input
                className="inp"
                autoFocus
                placeholder="Übungsname"
                defaultValue={neuName}
                onChange={e => setNeuName(e.target.value)}
                onKeyDown={e => {
                  onKeyDownAndroidBackspaceFix(e)
                  if (e.key === 'Enter') anlegen()
                }}
              />
              <input className="inp mono" defaultValue={neuScheme} onChange={e => setNeuScheme(e.target.value)} onKeyDown={onKeyDownAndroidBackspaceFix} />
              <ZahlEingabe
                wert={neuRestMin}
                werte={PAUSE_MINUTEN}
                format={formatPause}
                titel="Pause"
                einheit="min"
                className="mono"
                onWahl={n => setNeuRestMin(n ?? 2)}
              />
              <span />
            </div>
            <div className="row" style={{ marginTop: 10, gap: 8 }}>
              <button className="btn ghost sm" onClick={() => setNeuOffen(false)}>
                Abbrechen
              </button>
              <button className="btn primary sm" disabled={!neuName.trim()} onClick={anlegen}>
                Anlegen
              </button>
            </div>
          </div>
        ) : (
          <button className="btn sm ghost" style={{ marginTop: (eintraege ?? []).length > 0 ? 14 : 0 }} onClick={() => setNeuOffen(true)}>
            <svg viewBox="0 0 24 24">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Vorlage hinzufügen
          </button>
        )}
      </div>
    </section>
  )
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { BenchSlot, Plan } from '../../types/db'
import { PAUSE_MINUTEN, formatPause, pauseMinuten } from './pause'
import {
  useLibrarySearch,
  MUSKELGRUPPEN,
  useLibraryByMuscleGroup,
  useLibraryKatalog,
  katalogFiltern,
  SEITENGROESSE,
  type KatalogEintrag,
} from '../exerciseLibrary/queries'
import { useIstOnline } from '../../lib/offline/netz'
import { onKeyDownAndroidBackspaceFix } from '../../lib/nativeShell'
import { ZahlEingabe } from '../../components/ZahlRad'
/** Übung zu einem Plan hinzufügen: reine Auswahl aus der Bibliothek, kein
    Freitext mehr — neue Übungen legt man auf der "Übungen"-Seite an (siehe
    ExerciseLibraryPage). Zwei Schritte: erst suchen (serverseitig über
    useLibrarySearch, 3245 Katalogeinträge sind zu viele für eine lokale
    Liste), dann am gewählten Treffer Schema/Pause/Bank-Zuordnung/
    Muskelgruppe als Startwert bestätigen oder anpassen. */
export function UebungAuswahl({
  planTyp,
  muskelgruppen,
  onAnlegen,
  onAbbrechen,
}: {
  planTyp: Plan['typ']
  muskelgruppen: string[]
  onAnlegen: (w: {
    name: string
    scheme: string
    rest: string
    note: string
    bench_slot: BenchSlot | null
    muscle_group: string | null
    library_id: string | null
  }) => void
  onAbbrechen: () => void
}) {
  const [suche, setSuche] = useState('')
  const sucheAktiv = suche.trim().length >= 2

  // Durchsuchen nach Muskelgruppe: eigener Zustand statt Teil der
  // Textsuche, weil beides gleichzeitig verfügbar bleiben soll (siehe
  // Aufgabenstellung) — Tippen gewinnt einfach optisch, sobald es zwei
  // Zeichen sind, ohne dass die gewählte Gruppe deshalb verlorenginge.
  // Ist bereits eine Gruppe gewählt, filtert die Suche zusätzlich darauf.
  const [muskelgruppe, setMuskelgruppe] = useState<string | null>(null)
  const {
    data: suchSeiten,
    fetchNextPage: sucheWeiter,
    hasNextPage: sucheHatMehr,
    isFetchingNextPage: sucheLaedtWeiter,
    isFetching,
  } = useLibrarySearch(suche, muskelgruppe)
  const {
    data: browseSeiten,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: browseLaedt,
  } = useLibraryByMuscleGroup(muskelgruppe)

  // Ohne Netz liefern beide Abfragen oben nichts — dann übernimmt die
  // lokale Kopie des Katalogs (siehe useLibraryKatalog), sonst ließe sich
  // offline keine Übung hinzufügen. Der Katalog wird im Hintergrund
  // gehalten und mitgesichert, das Umschalten kostet also keine Ladezeit.
  const istOnline = useIstOnline()
  const { data: katalog } = useLibraryKatalog()
  const offlineKatalog = !istOnline && !!katalog?.length

  // Gemerkt aus demselben Grund wie offlineGefiltert weiter unten: Ohne
  // Memo lief der Durchlauf über alle 3246 Einträge samt Sortierung bei
  // jedem Render der Auswahl, nicht nur bei geänderter Eingabe — gemessen
  // 1,2 bis 2,1 ms auf dem Rechner, auf dem Handy ein Vielfaches.
  // Ohne Grenze: Wie viel davon zu sehen ist, entscheidet weiter unten
  // derselbe Seitenzähler wie beim Blättern.
  const offlineTreffer = useMemo(
    () => (offlineKatalog ? katalogFiltern(katalog, suche, muskelgruppe) : []),
    [offlineKatalog, katalog, suche, muskelgruppe],
  )

  // Blättern ohne Netz: dieselbe Seitengröße und dieselbe Wächter-Zeile wie
  // online, nur zählt hier ein lokaler Seitenzähler statt fetchNextPage.
  // Der gefilterte Katalog wird gemerkt, sonst würde bei jedem Nachschub
  // erneut über alle 3246 Einträge sortiert.
  // Der Seitenzähler hängt an der Muskelgruppe, statt beim Wechsel per
  // Effekt zurückgesetzt zu werden — abgeleiteter Zustand beim Rendern,
  // dasselbe Muster wie in ZahlRad.tsx. Ein Effekt wäre hier nicht nur
  // unnötig, sondern würde eine Kaskade auslösen: erst die neue Gruppe
  // rendern, dann den Zähler zurücksetzen, dann erneut rendern.
  // Ein Zähler für beide Listen. Der Schlüssel beschreibt, was gerade zu
  // sehen ist — wechselt die Suche oder die Gruppe, fängt das Blättern von
  // selbst wieder bei Seite 1 an, ohne Effekt und ohne Kaskade (dasselbe
  // Muster wie in ZahlRad.tsx).
  const [blaettern, setBlaettern] = useState<{ schluessel: string; seiten: number }>({ schluessel: '', seiten: 1 })
  const zeigtSucheJetzt = sucheAktiv
  const ansichtsSchluessel = zeigtSucheJetzt ? 'suche:' + suche.trim() + '|' + muskelgruppe : 'gruppe:' + muskelgruppe
  const offlineSeiten = blaettern.schluessel === ansichtsSchluessel ? blaettern.seiten : 1
  const offlineGefiltert = useMemo(
    () => (offlineKatalog ? katalogFiltern(katalog, '', muskelgruppe) : []),
    [offlineKatalog, katalog, muskelgruppe],
  )

  const treffer = offlineKatalog
    ? offlineTreffer.slice(0, offlineSeiten * SEITENGROESSE)
    : (suchSeiten?.pages.flat() ?? undefined)
  const browseTreffer = offlineKatalog
    ? offlineGefiltert.slice(0, offlineSeiten * SEITENGROESSE)
    : (browseSeiten?.pages.flat() ?? [])

  // Welche Liste gerade sichtbar ist, entscheidet, was nachgeladen wird —
  // es steht immer nur eine von beiden auf dem Schirm.
  const hatMehr = offlineKatalog
    ? (zeigtSucheJetzt ? treffer!.length < offlineTreffer.length : browseTreffer.length < offlineGefiltert.length)
    : (zeigtSucheJetzt ? sucheHatMehr : hasNextPage)
  const laedtNach = zeigtSucheJetzt ? sucheLaedtWeiter : isFetchingNextPage
  const mehrLaden = useCallback(() => {
    if (offlineKatalog) {
      setBlaettern(v => ({
        schluessel: ansichtsSchluessel,
        seiten: (v.schluessel === ansichtsSchluessel ? v.seiten : 1) + 1,
      }))
    } else if (zeigtSucheJetzt) void sucheWeiter()
    else void fetchNextPage()
  }, [offlineKatalog, ansichtsSchluessel, zeigtSucheJetzt, sucheWeiter, fetchNextPage])

  // IntersectionObserver auf einer unsichtbaren Wächter-Zeile am
  // Listenende statt eines Scroll-Ereignishorchers: löst zuverlässig aus,
  // sobald sie ins Bild kommt, ohne bei jedem Scroll-Pixel neu zu
  // rechnen. root ist die scrollende Trefferliste selbst (.bib-treffer),
  // nicht der Bildschirm — die Liste hat ihre eigene Scrollfläche.
  const listeRef = useRef<HTMLDivElement | null>(null)
  const waechterRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!hatMehr) return
    const waechter = waechterRef.current
    const wurzel = listeRef.current
    if (!waechter || !wurzel) return
    const beobachter = new IntersectionObserver(
      eintraege => {
        if (eintraege[0].isIntersecting) mehrLaden()
      },
      { root: wurzel, rootMargin: '200px' },
    )
    beobachter.observe(waechter)
    return () => beobachter.disconnect()
  }, [hatMehr, mehrLaden, ansichtsSchluessel])

  const [gewaehlt, setGewaehlt] = useState<KatalogEintrag | null>(null)
  const [scheme, setScheme] = useState('3 × 10')
  const [restMin, setRestMin] = useState(2)
  const [benchSlot, setBenchSlot] = useState<BenchSlot | null>(null)
  const [muscleGroup, setMuscleGroup] = useState<string | null>(null)

  const waehlen = (e: KatalogEintrag) => {
    setGewaehlt(e)
    setScheme(e.scheme || '3 × 10')
    setRestMin(e.rest ? pauseMinuten(e.rest) || 2 : 2)
    // Bank-Zuordnung nur übernehmen, wenn der Plan sie überhaupt nutzt.
    setBenchSlot(planTyp === 'bench' ? e.bench_slot : null)
    // Die Muskelgruppe des Katalogeintrags ist Freitext aus dem Import und
    // gehört nicht zwangsläufig zum Wortschatz dieses Plans (siehe
    // Volumen-Tab) — nur übernehmen, wenn sie dort exakt schon vorkommt,
    // sonst lieber leer statt einer neuen, nirgends ausgewerteten Kategorie.
    const passt = e.muscle_group && muskelgruppen.some(g => g.toLowerCase() === e.muscle_group!.toLowerCase())
    setMuscleGroup(passt ? muskelgruppen.find(g => g.toLowerCase() === e.muscle_group!.toLowerCase())! : null)
  }

  if (!gewaehlt) {
    // Suche gewinnt rein optisch, sobald zwei Zeichen stehen — die
    // gewählte Muskelgruppe bleibt dabei im Hintergrund gemerkt, ein
    // Leeren des Suchfelds zeigt sie sofort wieder.
    const zeigtSuche = sucheAktiv
    const zeigtBrowse = !zeigtSuche && !!muskelgruppe

    return (
      <div className="card">
        <div className="stack">
          <div className="field">
            <label>Übung suchen</label>
            {/* onKeyDown fängt einen Android-WebView-Bug ab (siehe
                onKeyDownAndroidBackspaceFix in lib/nativeShell.ts) -
                Backspace bleibt auf einem Testgerät sonst wirkungslos,
                obwohl die Tastatur reagiert. defaultValue statt value, da
                suche hier nie von außen gesetzt wird (nur über dieses
                onChange selbst). autoCorrect/autoCapitalize/spellCheck aus,
                da Übungsnamen keine Rechtschreibprüfung brauchen. */}
            <input
              className="inp"
              autoFocus
              placeholder="z. B. Bankdrücken oder Bench Press"
              defaultValue={suche}
              onChange={e => setSuche(e.target.value)}
              onKeyDown={onKeyDownAndroidBackspaceFix}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
            />
          </div>

          {/* Immer sichtbar, auch ohne Sucheingabe — Durchsuchen nach
              Muskelgruppe ist der zweite, gleichberechtigte Einstieg. */}
          <div className="bib-muskelgruppen">
            {MUSKELGRUPPEN.map(g => (
              <button
                key={g}
                type="button"
                className={'chip' + (muskelgruppe === g ? ' neon' : ' mute')}
                onClick={() => setMuskelgruppe(m => (m === g ? null : g))}
              >
                {g}
              </button>
            ))}
          </div>

          {suche.trim().length > 0 && !sucheAktiv && (
            <p className="muted tiny" style={{ margin: 0 }}>
              Noch ein Zeichen mehr …
            </p>
          )}

          {zeigtSuche && (
            <div className="bib-treffer" ref={listeRef}>
              {isFetching && !treffer && <p className="muted tiny" style={{ margin: 0 }}>Suche …</p>}
              {treffer && treffer.length === 0 && (
                <p className="muted tiny" style={{ margin: 0 }}>Keine Übung gefunden.</p>
              )}
              {treffer?.map(e => (
                <button key={e.id} type="button" className="bib-treffer-zeile" onClick={() => waehlen(e)}>
                  <span className="bib-treffer-name">{e.name}</span>
                  <span className="bib-treffer-meta">
                    {[e.equipment, e.muscle_group].filter(Boolean).join(' · ')}
                  </span>
                </button>
              ))}
              {/* Dieselbe Wächter-Zeile wie beim Blättern: Auch die Suche
                  lädt jetzt nach, statt nach 30 Treffern kommentarlos
                  aufzuhören. */}
              {hatMehr && (
                <div ref={waechterRef} className="muted tiny" style={{ textAlign: 'center', padding: '6px 0' }}>
                  {laedtNach ? 'Lädt weitere …' : ''}
                </div>
              )}
            </div>
          )}

          {zeigtBrowse && (
            <div className="bib-treffer" ref={listeRef}>
              {browseLaedt && !offlineKatalog && <p className="muted tiny" style={{ margin: 0 }}>Lädt …</p>}
              {(!browseLaedt || offlineKatalog) && browseTreffer.length === 0 && (
                <p className="muted tiny" style={{ margin: 0 }}>Keine Übung für „{muskelgruppe}“.</p>
              )}
              {browseTreffer.map(e => (
                <button key={e.id} type="button" className="bib-treffer-zeile" onClick={() => waehlen(e)}>
                  <span className="bib-treffer-name">{e.name}</span>
                  <span className="bib-treffer-meta">{[e.equipment, e.difficulty].filter(Boolean).join(' · ')}</span>
                </button>
              ))}
              {/* Unsichtbare Wächter-Zeile statt eines "Mehr laden"-Knopfs:
                  kommt sie ins Bild, holt der IntersectionObserver oben
                  von selbst die nächste Seite — ohne Netz aus dem lokalen
                  Katalog, sonst vom Server. Der Hinweis erscheint nur beim
                  echten Nachladen; offline ist der Nachschub sofort da. */}
              {hatMehr && (
                <div ref={waechterRef} className="muted tiny" style={{ textAlign: 'center', padding: '6px 0' }}>
                  {laedtNach ? 'Lädt weitere …' : ''}
                </div>
              )}
            </div>
          )}

          <div className="row" style={{ gap: 8 }}>
            <button className="btn ghost sm" onClick={onAbbrechen}>
              Abbrechen
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="stack">
        <div className="field">
          <label>Übung</label>
          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            <b style={{ fontFamily: 'var(--f-display)', fontSize: 16, letterSpacing: '.02em' }}>{gewaehlt.name}</b>
            <span className="spacer" />
            <button className="btn ghost sm" onClick={() => setGewaehlt(null)}>
              Andere wählen
            </button>
          </div>
        </div>
        <div className="grid g2" style={{ gap: 10 }}>
          <div className="field">
            <label>Schema</label>
            {/* siehe Kommentar am Suchfeld weiter oben in dieser Datei -
                onKeyDown fängt den Android-WebView-Backspace-Bug ab. */}
            <input
              className="inp mono"
              defaultValue={scheme}
              onChange={e => setScheme(e.target.value)}
              onKeyDown={onKeyDownAndroidBackspaceFix}
            />
          </div>
          <div className="field">
            <label>Pause</label>
            <ZahlEingabe
              wert={restMin}
              werte={PAUSE_MINUTEN}
              format={formatPause}
              titel="Pause"
              einheit="min"
              className="mono"
              onWahl={n => setRestMin(n ?? 2)}
            />
          </div>
        </div>
        {planTyp === 'bench' && (
          <div className="field">
            <label>Bank-Zuordnung</label>
            <div className="row" style={{ gap: 6 }}>
              <button
                type="button"
                className={'chip' + (benchSlot === null ? ' neon' : ' mute')}
                onClick={() => setBenchSlot(null)}
              >
                Keine
              </button>
              <button
                type="button"
                className={'chip' + (benchSlot === 'd1' ? ' neon' : ' mute')}
                onClick={() => setBenchSlot('d1')}
              >
                Bankdrücken schwer
              </button>
              <button
                type="button"
                className={'chip' + (benchSlot === 'd3' ? ' neon' : ' mute')}
                onClick={() => setBenchSlot('d3')}
              >
                Bankdrücken leicht
              </button>
            </div>
          </div>
        )}
        {muskelgruppen.length > 0 && (
          <div className="field">
            <label>Muskelgruppe</label>
            <select className="inp" value={muscleGroup ?? ''} onChange={e => setMuscleGroup(e.target.value || null)}>
              <option value="">Keine</option>
              {muskelgruppen.map(g => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="row" style={{ gap: 8 }}>
          <button className="btn ghost sm" onClick={onAbbrechen}>
            Abbrechen
          </button>
          <button
            className="btn primary sm"
            onClick={() =>
              onAnlegen({
                name: gewaehlt.name,
                scheme,
                rest: formatPause(restMin),
                note: '',
                bench_slot: benchSlot,
                muscle_group: muscleGroup,
                library_id: gewaehlt.id,
              })
            }
          >
            Anlegen
          </button>
        </div>
      </div>
    </div>
  )
}

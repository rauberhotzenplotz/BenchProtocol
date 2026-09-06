/* Übungskatalog eindeutschen und ausdünnen.
 *
 * Ausgangslage: Der Katalog stammt aus einer Functional-Fitness-Datenbank
 * (Fitness_Datenbank_DE_Jargon_FINAL.xlsx, 3242 Zeilen). Die vorhandene
 * "Übersetzung" hat nur das Gerät eingedeutscht und die Bewegung stehen
 * lassen -- 2856 der 3242 Namen tragen noch englische Wörter, 1053 sind
 * unverändert englisch, 2363 haben fünf Wörter oder mehr. Gesucht wird im
 * Studio aber nach "Bankdrücken", nicht nach "Eigengewichts Alternating
 * Heel Taps".
 *
 * Zwei Eingriffe:
 *
 * 1. Ausdünnen. Die Datenbank ist auf Geräte ausgerichtet, die in keinem
 *    normalen Studio stehen (861 Kettlebell, 195 Clubbell, 165 Slider,
 *    125 Turnringe, 107 Macebell ...). Deren Bewegungen tragen zugleich
 *    die kryptischsten Namen. Sie fliegen raus.
 *
 * 2. Übersetzen. Was bleibt, bekommt einen deutschen Namen, gebaut aus
 *    Gerät + Bewegung + Zusätzen. Bewegungen ohne Eintrag im Wörterbuch
 *    fliegen ebenfalls raus: Ein halb übersetzter Name ist schlimmer als
 *    keiner, und was sich nicht benennen lässt, sucht auch niemand.
 *
 * Dazu kommt: Der Katalog kennt gar keine Maschinen. Weder Beinpresse
 * noch Latzug, Butterfly oder Beinbeuger stehen darin -- ausgerechnet die
 * Geräte, an denen die meisten Leute trainieren. Die 29 Hammer-Strength-
 * Einträge aus Migration 0013 decken einen Teil ab, der Rest wird hier
 * ergänzt.
 *
 * Ausführung:
 *   node werkzeuge/katalog-deutsch.mjs "<pfad zur xlsx>"
 * Schreibt supabase/migrations/0014_katalog_deutsch.sql.
 */
import readXlsxFile from 'read-excel-file/node'
import { writeFileSync } from 'node:fs'

// ── Geräte ───────────────────────────────────────────────────────────

/** Was bleibt, mit deutschem Namen. Alles andere fliegt raus. */
export const GERAET_DE = {
  Barbell: 'Langhantel',
  Dumbbell: 'Kurzhantel',
  Cable: 'Kabelzug',
  Bodyweight: '',
  'EZ Bar': 'SZ-Stange',
  'Trap Bar': 'Trap-Bar',
  'Pull Up Bar': 'Klimmzugstange',
  Landmine: 'Landmine',
  'Weight Plate': 'Hantelscheibe',
  Kettlebell: 'Kettlebell',
  'Resistance Band': 'Widerstandsband',
  Miniband: 'Miniband',
  Superband: 'Superband',
  'Medicine Ball': 'Medizinball',
  'Ab Wheel': 'Bauchroller',
}

// ── Bewegungen ───────────────────────────────────────────────────────

/** Englische Bewegung -> deutscher Name. Reihenfolge zählt: Der erste
    Treffer gewinnt, längere Wendungen stehen deshalb vor kürzeren
    ("romanian deadlift" vor "deadlift", "bench press" vor "press"). */
export const BEWEGUNG = [
  // Brust
  [/close grip bench press/, 'Enges Bankdrücken'],
  [/incline bench press|incline press/, 'Schrägbankdrücken'],
  [/decline bench press|decline press/, 'Negativbankdrücken'],
  [/floor press/, 'Bodendrücken'],
  [/bench press/, 'Bankdrücken'],
  [/chest press/, 'Brustdrücken'],
  [/push ?up/, 'Liegestütz'],
  [/pull ?over/, 'Überzug'],
  // Muss vor der Brust-Zeile stehen: \bfly\b traf sonst auch "Reverse
  // Fly", und eine Übung für die hintere Schulter hieß danach wie eine
  // Brustübung. Die Muskelangaben blieben dabei richtig — nur der Name
  // versprach etwas anderes.
  [/rear delt fly|reverse fly/, 'Reverse Flys'],
  [/chest fly|pec fly|\bfly\b|flye/, 'Fliegende'],
  [/\bdip\b|\bdips\b/, 'Dip'],

  // Rücken
  [/lat ?pull ?down|pulldown/, 'Latzug'],
  [/bent over row/, 'Vorgebeugtes Rudern'],
  [/upright row/, 'Aufrechtes Rudern'],
  [/renegade row/, 'Renegade Row'],
  [/\brow\b|rowing/, 'Rudern'],
  [/chin ?up/, 'Klimmzug im Untergriff'],
  [/pull ?up/, 'Klimmzug'],
  [/face pull/, 'Face Pull'],
  [/rack pull/, 'Rack Pull'],
  [/good ?morning/, 'Good Morning'],
  [/hyper ?extension|back extension/, 'Rückenstrecken'],
  [/\bshrug/, 'Schulterheben'],

  // Beine
  [/front squat/, 'Frontkniebeuge'],
  [/back squat/, 'Kniebeuge'],
  [/goblet squat/, 'Goblet-Kniebeuge'],
  [/split squat/, 'Split-Kniebeuge'],
  [/pistol squat/, 'Pistol Squat'],
  [/sissy squat/, 'Sissy Squat'],
  [/hack squat/, 'Hackenschmidt-Kniebeuge'],
  [/wall sit/, 'Wandsitzen'],
  [/\bsquat\b/, 'Kniebeuge'],
  [/leg press/, 'Beinpresse'],
  [/leg extension/, 'Beinstrecken'],
  [/leg curl|hamstring curl/, 'Beinbeugen'],
  [/romanian deadlift|\brdl\b/, 'Rumänisches Kreuzheben'],
  [/stiff ?legg?e?d? deadlift/, 'Gestrecktes Kreuzheben'],
  [/sumo deadlift/, 'Sumo-Kreuzheben'],
  [/deadlift/, 'Kreuzheben'],
  [/curtsy lunge/, 'Curtsy-Ausfallschritt'],
  [/reverse lunge/, 'Ausfallschritt rückwärts'],
  [/walking lunge/, 'Gehender Ausfallschritt'],
  [/lunge/, 'Ausfallschritt'],
  [/step ?up/, 'Step-up'],
  [/calf raise/, 'Wadenheben'],
  [/hip thrust/, 'Hüftstoß'],
  [/glute bridge|hip bridge/, 'Glute Bridge'],
  [/hip abduction|abduction/, 'Abduktion'],
  [/hip adduction|adduction/, 'Adduktion'],
  [/nordic curl|nordic hamstring/, 'Nordic Curl'],
  [/glute ham raise/, 'Glute-Ham-Raise'],
  [/kickback/, 'Kickback'],

  // Schultern
  [/overhead press|military press|shoulder press/, 'Schulterdrücken'],
  [/push press/, 'Push Press'],
  [/arnold press/, 'Arnold-Drücken'],
  [/lateral raise|side raise/, 'Seitheben'],
  [/front raise/, 'Frontheben'],
  [/external rotation/, 'Außenrotation'],
  [/internal rotation/, 'Innenrotation'],
  [/handstand push ?up/, 'Handstand-Liegestütz'],

  // Arme
  [/hammer curl/, 'Hammercurl'],
  [/preacher curl/, 'Scottcurl'],
  [/concentration curl/, 'Konzentrationscurl'],
  [/spider curl/, 'Spidercurl'],
  [/reverse curl/, 'Reverse Curl'],
  [/wrist curl/, 'Handgelenkcurl'],
  [/bicep(s)? curl|arm curl/, 'Bizepscurl'],
  [/\bcurl\b/, 'Curl'],
  [/skull ?crusher/, 'Skullcrusher'],
  [/tricep(s)? push ?down|push ?down/, 'Trizepsdrücken'],
  [/tricep(s)? extension|overhead extension/, 'Trizepsstrecken'],
  [/tricep(s)? kickback/, 'Trizeps-Kickback'],

  // Rumpf
  [/russian twist/, 'Russian Twist'],
  [/sit ?up/, 'Sit-up'],
  [/crunch/, 'Crunch'],
  [/leg raise|knee raise/, 'Beinheben'],
  [/mountain climber/, 'Mountain Climber'],
  [/ab ?wheel|roll ?out/, 'Bauchroller'],
  [/dead ?bug/, 'Dead Bug'],
  [/bird ?dog/, 'Bird Dog'],
  [/wood ?chop|chop/, 'Holzhacker'],
  [/side plank/, 'Seitstütz'],
  [/plank/, 'Unterarmstütz'],
  [/hollow hold/, 'Hollow Hold'],
  [/farmer.?s? (walk|carry)/, 'Farmer’s Walk'],
  [/suitcase carry/, 'Koffertragen'],
  [/\bcarry\b/, 'Tragen'],
  [/\bswing\b/, 'Swing'],
  [/turkish get ?up|get ?up/, 'Turkish Get-up'],
  [/\bthruster\b/, 'Thruster'],
  [/\bclean\b/, 'Umsetzen'],
  [/\bsnatch\b/, 'Reißen'],
  [/\bjerk\b/, 'Stoßen'],
]

// ── Zusätze ──────────────────────────────────────────────────────────

/** Beschreibende Beiworte. Werden hinter den Bewegungsnamen gehängt.
    Wieder längste Wendung zuerst. */
export const ZUSATZ = [
  [/single arm|one arm|unilateral/, 'einarmig'],
  [/single leg|one leg/, 'einbeinig'],
  [/alternating/, 'im Wechsel'],
  [/bulgarian/, 'bulgarisch'],
  [/incline/, 'Schrägbank'],
  [/decline/, 'Negativbank'],
  [/seated/, 'sitzend'],
  [/standing/, 'stehend'],
  [/kneeling/, 'kniend'],
  [/lying|supine/, 'liegend'],
  [/prone/, 'in Bauchlage'],
  [/bent ?over/, 'vorgebeugt'],
  [/close grip|narrow grip/, 'enger Griff'],
  [/wide grip/, 'weiter Griff'],
  [/neutral grip/, 'neutraler Griff'],
  [/reverse grip|underhand/, 'Untergriff'],
  [/overhand/, 'Obergriff'],
  [/overhead/, 'über Kopf'],
  [/behind the neck/, 'im Nacken'],
  [/feet elevated|elevated/, 'erhöht'],
  [/deficit/, 'aus dem Defizit'],
  [/paused|pause/, 'mit Pause'],
  [/isometric|hold/, 'isometrisch'],
  [/tempo/, 'im Tempo'],
  [/eccentric/, 'exzentrisch'],
  [/assisted/, 'unterstützt'],
  [/banded/, 'mit Band'],
  [/\bjump\b|jumping/, 'mit Sprung'],
]

/** Wörter, die im deutschen Namen nichts verloren haben — Füllsel der
    Quelle oder bereits durch Gerät/Bewegung abgedeckt. */
const RAUSCHEN =
  /^(the|to|a|an|and|with|of|on|in|at|for|from|double|both|two|arm|arms|leg|legs|hand|hands|foot|feet|body|weight|bar|ball|band|machine|cable|barbell|dumbbell|kettlebell|bodyweight|ez|trap|pull|up|plate|landmine|miniband|superband|resistance|medicine|ab|wheel|press|raise|row|curl|squat|lunge|extension|fly|flye|crunch|thrust|bridge|dip|plank|twist|deadlift|shrug|pushdown|pullover|pulldown|down|over|under|out|through|start|stop|order|switch|position|style|variation|version)$/i

// ── Übersetzung ──────────────────────────────────────────────────────

/** Baut aus dem englischen Namen einen deutschen.
    Gibt null zurück, wenn keine Bewegung erkannt wurde — solche Einträge
    fliegen aus dem Katalog. */
export function eindeutschen(nameEn, geraet) {
  const text = String(nameEn ?? '').toLowerCase()
  let rest = text

  // Verbundübungen zuerst aussortieren. "Face Pull To Overhead Press" und
  // "Glute Bridge Isometric Bench Press" bestehen aus zwei Bewegungen;
  // die Übersetzung unten erkennt nur die erste und ließe die zweite
  // stillschweigend verschwinden. Ein Name, der etwas anderes verspricht
  // als die Übung ist, richtet mehr Schaden an als ein fehlender Eintrag.
  if (KOMBI.test(text)) return null

  const treffer = BEWEGUNG.find(([muster]) => muster.test(rest))
  if (!treffer) return null
  const bewegung = treffer[1]
  rest = rest.replace(treffer[0], ' ')
  // Eine zweite, andere Bewegung im selben Namen: ebenfalls eine
  // Verbundübung, nur ohne verräterisches "to".
  if (BEWEGUNG.some(([muster, wort]) => wort !== bewegung && muster.test(rest))) return null

  const zusaetze = []
  for (const [muster, wort] of ZUSATZ) {
    if (muster.test(rest)) {
      zusaetze.push(wort)
      rest = rest.replace(muster, ' ')
    }
  }

  // Was jetzt noch an echten Wörtern übrig ist, konnte nicht übersetzt
  // werden. Ein einzelnes Restwort ist zu verschmerzen, mehr nicht --
  // sonst entstehen wieder halb englische Namen.
  const uebrig = rest
    .split(/[^a-zA-Z]+/)
    .filter(Boolean)
    .filter(w => !RAUSCHEN.test(w))
    .filter(w => !String(geraet ?? '').toLowerCase().includes(w))
  if (uebrig.length > 1) return null

  const geraetDe = GERAET_DE[geraet] ?? ''
  const teile = [geraetDe, bewegung].filter(Boolean).join(' ')
  return {
    name: zusaetze.length ? `${teile}, ${zusaetze.join(', ')}` : teile,
    bewegung,
    /** Wie viele Beiworte der Name trägt. Steuert die Rangfolge: Die
        nackte Grundübung hat null und steht damit immer vorn. */
    zusaetze: zusaetze.length,
  }
}

/** Ableitungen und Verbundübungen. Übernommen aus katalog-bekanntheit.mjs,
    wo dieselbe Erkennung die Rangfolge steuert. */
const KOMBI = /\bto\b|\bclean\b|\bsnatch\b|\bjerk\b|\bthruster\b|\bcomplex\b|\bburpee\b|\bget ?up\b/i

// ── Maschinen ────────────────────────────────────────────────────────

/** Der Katalog kennt keine einzige Maschine — er stammt aus einer
    Functional-Fitness-Sammlung. Ausgerechnet die Geräte, an denen die
    meisten Leute im Studio stehen, fehlen also vollständig. Weil sich
    Übungen nicht mehr von Hand anlegen lassen, werden sie hier ergänzt.

    Aufbau je Zeile: Name, Muskelgruppe, Hauptmuskel, Sekundärmuskel,
    Schema, Pause. */
export const MASCHINEN = [
  ['Beinpresse', 'Quadrizeps', 'Quadriceps Femoris', 'Gluteus Maximus', '4 × 10', '2 min'],
  ['Hackenschmidt-Maschine', 'Quadrizeps', 'Quadriceps Femoris', 'Gluteus Maximus', '4 × 10', '2 min'],
  ['Beinstrecker', 'Quadrizeps', 'Quadriceps Femoris', null, '3 × 12', '90 s'],
  ['Beinbeuger liegend', 'Beinbeuger', 'Biceps Femoris', 'Gastrocnemius', '3 × 12', '90 s'],
  ['Beinbeuger sitzend', 'Beinbeuger', 'Biceps Femoris', 'Gastrocnemius', '3 × 12', '90 s'],
  ['Wadenmaschine stehend', 'Waden', 'Gastrocnemius', 'Soleus', '4 × 12', '60 s'],
  ['Wadenmaschine sitzend', 'Waden', 'Soleus', 'Gastrocnemius', '4 × 15', '60 s'],
  ['Adduktorenmaschine', 'Adduktoren', 'Adductor Magnus', null, '3 × 15', '60 s'],
  ['Abduktorenmaschine', 'Abduktoren', 'Gluteus Medius', 'Gluteus Maximus', '3 × 15', '60 s'],
  ['Hüftstoß-Maschine', 'Gesäß', 'Gluteus Maximus', 'Biceps Femoris', '4 × 10', '2 min'],
  ['Latzug', 'Rücken', 'Latissimus Dorsi', 'Biceps Brachii', '4 × 10', '2 min'],
  ['Latzug eng', 'Rücken', 'Latissimus Dorsi', 'Biceps Brachii', '3 × 10', '2 min'],
  ['Rudermaschine sitzend', 'Rücken', 'Latissimus Dorsi', 'Posterior Deltoids', '4 × 10', '2 min'],
  ['T-Bar-Rudern', 'Rücken', 'Latissimus Dorsi', 'Posterior Deltoids', '4 × 10', '2 min'],
  ['Überzugmaschine', 'Rücken', 'Latissimus Dorsi', 'Pectoralis Major', '3 × 12', '90 s'],
  ['Rückenstreckmaschine', 'Rücken', 'Erector Spinae', 'Gluteus Maximus', '3 × 12', '90 s'],
  ['Brustpresse', 'Brust', 'Pectoralis Major', 'Triceps Brachii', '4 × 10', '2 min'],
  ['Brustpresse Schrägbank', 'Brust', 'Pectoralis Major', 'Anterior Deltoids', '4 × 10', '2 min'],
  ['Butterfly', 'Brust', 'Pectoralis Major', 'Anterior Deltoids', '3 × 12', '90 s'],
  ['Butterfly Reverse', 'Schultern', 'Posterior Deltoids', 'Latissimus Dorsi', '3 × 15', '60 s'],
  ['Dip-Maschine', 'Trizeps', 'Triceps Brachii', 'Pectoralis Major', '3 × 10', '90 s'],
  ['Schulterpresse Maschine', 'Schultern', 'Anterior Deltoids', 'Triceps Brachii', '4 × 10', '2 min'],
  ['Seitheben-Maschine', 'Schultern', 'Lateral Deltoids', null, '3 × 15', '60 s'],
  ['Bizepsmaschine', 'Bizeps', 'Biceps Brachii', 'Brachioradialis', '3 × 12', '90 s'],
  ['Trizepsmaschine', 'Trizeps', 'Triceps Brachii', null, '3 × 12', '90 s'],
  ['Bauchmaschine', 'Bauchmuskeln', 'Rectus Abdominis', 'Obliques', '3 × 15', '60 s'],
  ['Rumpfrotationsmaschine', 'Bauchmuskeln', 'Obliques', 'Rectus Abdominis', '3 × 15', '60 s'],
  ['Klimmzugmaschine unterstützt', 'Rücken', 'Latissimus Dorsi', 'Biceps Brachii', '3 × 8', '2 min'],
  ['Beinpresse einbeinig', 'Quadrizeps', 'Quadriceps Femoris', 'Gluteus Maximus', '3 × 10', '90 s'],
  ['Smith-Maschine Kniebeuge', 'Quadrizeps', 'Quadriceps Femoris', 'Gluteus Maximus', '4 × 8', '2 min'],
  ['Smith-Maschine Bankdrücken', 'Brust', 'Pectoralis Major', 'Triceps Brachii', '4 × 8', '2 min'],
  ['Smith-Maschine Schulterdrücken', 'Schultern', 'Anterior Deltoids', 'Triceps Brachii', '4 × 8', '2 min'],
]

// ── Rangfolge ────────────────────────────────────────────────────────

/** Bekannteste Bewegungen je Muskelgruppe, absteigend — geprüft gegen den
    fertigen deutschen Namen.

    Ersetzt die englische Ankerliste aus katalog-bekanntheit.mjs. Deren
    bekannte Schwäche war, dass sie für "Brust" nur `bench press` kannte:
    Schräg- und Negativbankdrücken fielen ans Ende der Gruppe. Hier steht
    jede Variante mit eigenem Rang. */
export const ANKER_DE = {
  Brust: [/^\S*\s?Bankdrücken/, /Schrägbankdrücken/, /Brustdrücken|Brustpresse/, /Negativbankdrücken/, /Liegestütz/, /Fliegende|Butterfly/, /^Dip|Dip-Maschine/, /Überzug/, /Bodendrücken/, /Enges Bankdrücken/],
  Rücken: [/Latzug/, /Rudern|Rudermaschine/, /Klimmzug/, /Kreuzheben/, /Rückenstrecken|Rückenstreckmaschine/, /Überzugmaschine/, /Good Morning/, /Rack Pull/, /Face Pull/, /Schulterheben/],
  Schultern: [/Schulterdrücken|Schulterpresse/, /Seitheben/, /Frontheben/, /Reverse Flys|Butterfly Reverse/, /Push Press/, /Arnold-Drücken/, /Aufrechtes Rudern/, /Außenrotation|Innenrotation/, /Handstand/],
  Bizeps: [/Bizepscurl/, /Hammercurl/, /Scottcurl/, /Klimmzug im Untergriff/, /Konzentrationscurl/, /Spidercurl/, /Reverse Curl/, /Bizepsmaschine/, /^\S*\s?Curl/],
  Trizeps: [/Trizepsdrücken/, /Trizepsstrecken/, /Skullcrusher/, /Enges Bankdrücken/, /^Dip|Dip-Maschine/, /Trizeps-Kickback/, /Trizepsmaschine/],
  Quadrizeps: [/^\S*\s?Kniebeuge/, /Beinpresse/, /Beinstrecken|Beinstrecker/, /Ausfallschritt/, /Frontkniebeuge/, /Split-Kniebeuge/, /Hackenschmidt/, /Step-up/, /Wandsitzen/, /Sissy|Pistol/],
  Beinbeuger: [/Beinbeugen|Beinbeuger/, /Rumänisches Kreuzheben/, /Gestrecktes Kreuzheben/, /Good Morning/, /Nordic Curl/, /Glute-Ham-Raise/],
  Gesäß: [/Hüftstoß/, /Glute Bridge/, /Kreuzheben/, /Kickback/, /Abduktion/, /Ausfallschritt/],
  Waden: [/Wadenheben|Wadenmaschine/],
  Bauchmuskeln: [/Crunch/, /Unterarmstütz|Seitstütz/, /Sit-up/, /Beinheben/, /Russian Twist/, /Bauchroller/, /Bauchmaschine/, /Holzhacker/, /Dead Bug|Bird Dog/, /Mountain Climber/, /Hollow Hold/],
  Trapez: [/Schulterheben/, /Aufrechtes Rudern/, /Farmer/],
  Unterarme: [/Handgelenkcurl/, /Farmer/, /Reverse Curl/, /Tragen|Koffertragen/],
  Adduktoren: [/Adduktion|Adduktorenmaschine/, /Sumo/],
  Abduktoren: [/Abduktion|Abduktorenmaschine/],
  Hüftbeuger: [/Beinheben/, /Mountain Climber/],
  Schienbeine: [/Wadenheben/],
}

/** Mehrgelenkige Grundübungen. Sie brauchen weniger Wiederholungen und
    längere Pausen als Isolationsübungen. */
const VERBUND = /Kniebeuge|Kreuzheben|Bankdrücken|Brustdrücken|Brustpresse|Schulterdrücken|Schulterpresse|Rudern|Latzug|Klimmzug|Beinpresse|Liegestütz|Dip|Ausfallschritt|Step-up|Hüftstoß|Push Press|Thruster|Hackenschmidt|Good Morning|Umsetzen|Reißen|Stoßen/

/** Kleine Muskeln: kurze Pause, höhere Wiederholungszahl. */
const KLEIN = /^(Waden|Bauchmuskeln|Unterarme|Adduktoren|Abduktoren|Schienbeine|Hüftbeuger)$/

/** Schema und Pause als Startwert.

    Die Quelle liefert überhaupt kein Schema und Pausenzeiten, die nicht
    zur Übung passen ("45 Sek." fürs Langhantel-Bankdrücken). Weil beim
    Anlegen einer Übung genau diese Werte übernommen werden, bekam bisher
    fast alles die Notvorgabe "3 × 10" — unabhängig davon, ob es eine
    Kniebeuge oder Seitheben war. */
export function vorgabe(eintrag) {
  if (VERBUND.test(eintrag.name)) return { scheme: '4 × 8', rest: '2 min' }
  if (KLEIN.test(eintrag.gruppe ?? '')) return { scheme: '3 × 15', rest: '60 s' }
  return { scheme: '3 × 12', rest: '90 s' }
}

/** Kleiner Wert = weiter oben. Vier Stufen, die sich nicht überlappen. */
export const GERAET_TIER = {
  Maschine: 0,
  Barbell: 0,
  Dumbbell: 1,
  Cable: 1,
  Bodyweight: 1,
  'Pull Up Bar': 1,
  'EZ Bar': 2,
  'Trap Bar': 2,
  Landmine: 2,
  Kettlebell: 3,
  'Resistance Band': 3,
  Miniband: 3,
  Superband: 3,
  'Weight Plate': 4,
  'Medicine Ball': 4,
  'Ab Wheel': 4,
}

/** Bekanntheitsrang aus dem fertigen deutschen Namen.

    Anders als die englische Vorgängerfassung braucht sie die Wortzahl nur
    noch als letzte Entscheidungshilfe: Weil die Namen hier selbst gebaut
    werden, ist bekannt, wie viele Beiworte sie tragen. Die nackte
    Grundübung hat null Beiworte und steht damit zwangsläufig vor jeder
    ihrer Varianten — genau das ging vorher schief. */
export function bewerte(eintrag) {
  const anker = ANKER_DE[eintrag.gruppe] ?? []
  let bewegung = anker.findIndex(muster => muster.test(eintrag.name))
  if (bewegung === -1) bewegung = anker.length
  const geraet = GERAET_TIER[eintrag.geraet] ?? 4
  const zusaetze = Math.min(eintrag.zusaetze ?? 0, 8)
  const woerter = Math.min(eintrag.name.trim().split(/\s+/).length, 9)
  return 1 + bewegung * 1000 + geraet * 100 + zusaetze * 10 + woerter
}

// ── Hauptlauf ────────────────────────────────────────────────────────

// Nur beim direkten Aufruf laufen -- die Wörterbücher oben werden auch
// importiert (etwa zum Nachprüfen einzelner Namen).
const direkt = process.argv[1]?.endsWith('katalog-deutsch.mjs')
const datei = process.argv[2]
if (direkt && !datei) {
  console.error('Aufruf: node werkzeuge/katalog-deutsch.mjs "<pfad zur xlsx>"')
  process.exit(1)
}

async function hauptlauf() {
  const roh = await readXlsxFile(datei)
  const zeilen = Array.isArray(roh) && roh[0]?.data ? roh[0].data : roh
  const kopf = zeilen[0].map(z => String(z ?? ''))
  const daten = zeilen.slice(1)
  const sp = n => kopf.findIndex(k => k === n)

  const I = {
    en: sp('Übung'),
    clean: sp('Deutsche Übungsbezeichnung_clean'),
    gruppe: sp('Zielmuskelgruppe'),
    haupt: sp('Hauptmuskel'),
    sek: sp('Sekundärer Muskel'),
    ter: sp('Tertiärer Muskel'),
    geraet: sp('Hauptgerät'),
    schwer: sp('Schwierigkeitsgrad'),
    pause: sp('Pausenzeit (empfohlen)'),
  }

  const feld = (z, k) => {
    const w = z[I[k]]
    return w == null ? null : String(w).trim() || null
  }

  let ohneGeraet = 0
  let ohneBewegung = 0
  const behalten = []
  const namen = new Set()

  for (const z of daten) {
    const geraet = feld(z, 'geraet')
    if (!(geraet in GERAET_DE)) {
      ohneGeraet++
      continue
    }
    const neu = eindeutschen(feld(z, 'en'), geraet)
    if (!neu) {
      ohneBewegung++
      continue
    }
    // Gleichnamige Varianten treten auf, sobald zwei englische Namen auf
    // dieselbe Bewegung samt Zusätzen zusammenfallen. Der erste gewinnt;
    // ein zweiter Eintrag mit identischem Namen wäre im Picker nicht zu
    // unterscheiden.
    if (namen.has(neu.name)) continue
    namen.add(neu.name)
    behalten.push({
      name: neu.name,
      zusaetze: neu.zusaetze,
      altName: feld(z, 'clean'),
      nameEn: feld(z, 'en'),
      gruppe: feld(z, 'gruppe'),
      haupt: feld(z, 'haupt'),
      sek: feld(z, 'sek'),
      ter: feld(z, 'ter'),
      geraet,
      schwer: feld(z, 'schwer'),
      pause: feld(z, 'pause'),
    })
  }

  // Maschinen ergänzen — sie fehlen in der Quelle vollständig.
  for (const [name, gruppe, haupt, sek, schema, pause] of MASCHINEN) {
    if (namen.has(name)) continue
    namen.add(name)
    behalten.push({
      name,
      zusaetze: 0,
      altName: null,
      nameEn: null,
      gruppe,
      haupt,
      sek,
      ter: null,
      geraet: 'Maschine',
      schwer: 'Fortgeschritten',
      pause,
      schema,
    })
  }

  for (const e of behalten) {
    e.rang = bewerte(e)
    const v = vorgabe(e)
    // Maschinen bringen ihr Schema selbst mit, alles andere bekommt die
    // Vorgabe -- die Quelle hat gar keins.
    e.schema = e.schema ?? v.scheme
    e.pause = v.rest
  }
  behalten.sort((a, b) => a.rang - b.rang || a.name.localeCompare(b.name, 'de'))

  console.log('Quelle:', daten.length, 'Zeilen')
  console.log('  ausgeschieden, Gerät nicht im Studio:', ohneGeraet)
  console.log('  ausgeschieden, Bewegung nicht übersetzbar:', ohneBewegung)
  console.log('  behalten:', behalten.length)
  console.log('\nStichprobe:')
  for (let i = 0; i < behalten.length; i += Math.max(1, Math.floor(behalten.length / 25))) {
    console.log('  ', behalten[i].altName, '  ->  ', behalten[i].name)
  }

  const jeGeraet = new Map()
  for (const e of behalten) jeGeraet.set(e.geraet, (jeGeraet.get(e.geraet) ?? 0) + 1)
  console.log('\nNach Gerät:')
  for (const [k, v] of [...jeGeraet.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(4)}  ${k}`)

  const jeGruppe = new Map()
  for (const e of behalten) jeGruppe.set(e.gruppe, (jeGruppe.get(e.gruppe) ?? 0) + 1)
  console.log('\nNach Muskelgruppe (jeweils die drei bestplatzierten):')
  for (const [k, v] of [...jeGruppe.entries()].sort((a, b) => b[1] - a[1])) {
    const oben = behalten.filter(e => e.gruppe === k).slice(0, 3).map(e => e.name)
    console.log(`  ${String(v).padStart(4)}  ${k.padEnd(14)} ${oben.join(' · ')}`)
  }

  // ── SQL ──────────────────────────────────────────────────────────────

  const q = w => (w == null || w === '' ? 'null' : `'${String(w).replace(/'/g, "''")}'`)

  // alt_name ist der Name, unter dem der Eintrag heute in der Datenbank
  // steht (Spalte "Deutsche Übungsbezeichnung_clean" der Quelle). Über ihn
  // werden bestehende Zeilen wiedergefunden und an Ort und Stelle
  // aktualisiert, statt sie zu löschen und neu anzulegen — nur so behalten
  // sie ihre id und damit die Verknüpfung aus exercises.library_id.
  // Maschinen haben keinen Vorgänger und tragen hier null.
  const werte = behalten
    .map(e =>
      `    (${[q(e.altName), q(e.name), q(e.nameEn), q(e.altName), q(e.gruppe), q(e.haupt), q(e.sek), q(e.ter), q(e.geraet), q(e.schwer), q(e.schema ?? null), q(e.pause), e.rang].join(', ')})`,
    )
    .join(',\n')

  const sql = `-- Übungskatalog: deutsche Namen, ausgedünnt, neu sortiert.
  --
  -- Erzeugt von werkzeuge/katalog-deutsch.mjs aus
  -- Fitness_Datenbank_DE_Jargon_FINAL.xlsx. Nicht von Hand ändern, sondern
  -- den Generator anpassen und neu laufen lassen.
  --
  -- Ausgangslage: Der Katalog stammte aus einer Functional-Fitness-Sammlung.
  -- 2856 der 3242 Namen trugen englische Wörter, 1053 waren unverändert
  -- englisch ("Eigengewichts Alternating Heel Taps"), 2363 hatten fünf
  -- Wörter oder mehr. Zwei Drittel der Einträge hingen an Geräten, die in
  -- keinem normalen Studio stehen -- 861 Kettlebell, 195 Clubbell, 165
  -- Slider, 125 Turnringe. Maschinen fehlten dagegen vollständig.
  --
  -- Danach stehen ${behalten.length} Einträge im Katalog, alle auf Deutsch, mit
  -- Haupt-, Sekundär- und Tertiärmuskel und einem Bekanntheitsrang, der die
  -- Grundübung je Muskelgruppe nach vorn stellt.
  --
  -- Bestehende Zeilen werden aktualisiert, nicht ersetzt: Sie behalten ihre
  -- id, und exercises.library_id in bestehenden Plänen bleibt gültig. Nur
  -- was wegfällt, wird gelöscht -- dort setzt der Fremdschlüssel
  -- library_id auf null (on delete set null, siehe 0011). Die Übungen in
  -- den Plänen und alle geloggten Sätze bleiben in jedem Fall unangetastet.
  --
  -- Läuft für jeden Nutzer, der schon einen Katalog hat -- exercise_library
  -- hängt an RLS und gehört je Zeile einem Nutzer.

  begin;

  create temporary table katalog_neu (
    alt_name        text,
    name            text not null,
    name_en         text,
    name_de_raw     text,
    muscle_group    text,
    primary_muscle  text,
    secondary_muscle text,
    tertiary_muscle text,
    equipment       text,
    difficulty      text,
    scheme          text,
    rest            text,
    popularity      int
  ) on commit drop;

  insert into katalog_neu values
  ${werte};

  -- 1. Bestehende Einträge an Ort und Stelle aktualisieren, gefunden über
  --    ihren bisherigen Namen. Bewusst kein Löschen-und-neu-Anlegen: Die
  --    Zeilen behalten so ihre id, und exercises.library_id in bestehenden
  --    Plänen bleibt gültig.
  update exercise_library el set
    name             = k.name,
    name_en          = k.name_en,
    name_de_raw      = k.name_de_raw,
    muscle_group     = k.muscle_group,
    primary_muscle   = k.primary_muscle,
    secondary_muscle = k.secondary_muscle,
    tertiary_muscle  = k.tertiary_muscle,
    equipment        = k.equipment,
    difficulty       = k.difficulty,
    scheme           = coalesce(el.scheme, k.scheme),
    rest             = coalesce(el.rest, k.rest),
    popularity       = k.popularity
  from katalog_neu k
  where el.name = k.alt_name and k.alt_name is not null;

  -- 2. Alles, was nicht übernommen wurde, entfernen: die Geräte, die in
  --    keinem Studio stehen, die nicht übersetzbaren Bewegungen und die von
  --    Hand angelegten Vorlagen. Letztere fallen weg, weil sich Übungen
  --    nicht mehr selbst anlegen lassen und ihnen die Muskelzuordnung
  --    fehlt, die das Cockpit jetzt auswertet.
  delete from exercise_library
  where name not in (select name from katalog_neu);

  -- 3. Was noch fehlt, anlegen — vor allem die Maschinen, die die Quelle
  --    gar nicht kennt. Je Nutzer, der schon einen Katalog hat.
  insert into exercise_library
    (user_id, name, name_en, name_de_raw, muscle_group, primary_muscle, secondary_muscle,
     tertiary_muscle, equipment, difficulty, scheme, rest, sort_order, popularity)
  select
    n.user_id, k.name, k.name_en, k.name_de_raw, k.muscle_group, k.primary_muscle,
    k.secondary_muscle, k.tertiary_muscle, k.equipment, k.difficulty, k.scheme, k.rest, 0, k.popularity
  from (select distinct user_id from exercise_library) as n
  cross join katalog_neu k
  where not exists (
    select 1 from exercise_library el where el.user_id = n.user_id and el.name = k.name
  );

  commit;
  `

  const ziel = new URL('../supabase/migrations/0014_katalog_deutsch.sql', import.meta.url)
  writeFileSync(ziel, sql)
  console.log(`\nGeschrieben: supabase/migrations/0014_katalog_deutsch.sql (${Math.round(sql.length / 1024)} KB)`)
}

if (direkt) await hauptlauf()

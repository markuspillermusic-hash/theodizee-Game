# Briefing · Ausschnitt

**Stand:** 11. August 2026 · Branch `v3-entwicklung-kreislauf` · letzter Commit `9d6f761`

**Zweck:** Übergabedokument für das Spiel. Wer das hier liest, weiß danach, was das Spiel sagen
will, warum jedes Level so gebaut ist, wie es gebaut ist, welche Fehler wir schon gemacht und
korrigiert haben — und was als Nächstes ansteht.

Ergänzende Dokumente, die nicht ersetzt werden:
`docs/KONZEPT-V3-entwicklung-und-kreislauf.md` (gültiger Entwurf),
`docs/KONZEPT-echos-drehbuch.md` (die sechs Situationen und die Drehregel),
`LEVEL_DESIGN.md` (Mechanik im Detail), `ASSET_GUIDE.md` (Technik der Medien),
`README.md` (Start, Build, Steuerung).

---

## 1 · Was das Spiel ist

Ein browserbasiertes, abstraktes Spiel für **eine gemeinsame Unterrichtsstunde in Jgst. 11**,
Block D des Jahresverlaufsplans, zur Theodizeefrage. Am Beamer, gemeinsam, nicht als Hausaufgabe.

Ablauf:

```
Titel → Einführung → 6 Level → Echos → personalisiertes Gesamt-Replay → stehendes Endbild
```

Der Titel ist das Programm: Man sieht immer nur einen **Ausschnitt**. Die spielbaren Abschnitte
verraten ihre Identität nicht. Erst die Echos deuten an, erst das Replay löst auf.

Das Spiel **inszeniert eine Deutungsmöglichkeit**. Es beweist nichts. Die begriffliche Einordnung
gehört ins Unterrichtsgespräch danach.

---

## 2 · Die Projektidee: Entwicklung und Kreislauf

Aus dem dritten Akt des Gesamt-Replays und aus Block D:

> Energie → Leben → Fürsorge → Schutz → Opfer → Beziehung → Liebe

**Entwicklung.** Mit jeder Stufe wächst die Fähigkeit — und mit ihr die Verletzlichkeit. Gras kann
nicht verlieren, weil ihm nichts fehlen kann. Ein Mensch kann alles verlieren, weil er lieben kann.
Das ist Hicks *soul-making*, und es ist die spielbare These.

**Kreislauf.** Was auf einer Stufe endet, ist Bedingung der nächsten. Kein Ende ist folgenlos, und
keines wird dadurch ungeschehen.

**Leitsatz für die Steuerung:** *Was du kannst, ist was du verlieren kannst.*

---

## 3 · Die Meta-Ebene in drei Wissensständen

| Wann | Was ankommt |
|---|---|
| Während des Spiels | Nichts. Nur Verben und Mengen im HUD, kein Name, keine Art. Was benannt ist, kann nicht mehr aufgedeckt werden. |
| Im Echo nach jedem Level | Die eigene Stufe. „Das war ein Grashalm." Die Verbindung zwischen den Stufen wird nie behauptet. |
| Im Gesamt-Replay | Dass alle sechs dieselbe Kette waren. |

Die Aussage ist **nicht** „es gibt einen Plan, also war das Leid halb so schlimm", sondern:
*jede Perspektive war real, und keine war vollständig.*

### Die Umkehrung in Level 1

Ein dunkler, bedrohlicher Schatten senkt sich über den Halm; ein schnelles, warmes Signal verjagt
ihn. **Der Schatten ist das Zebra, der Retter ist der Löwe.** Für das Gras ist der Pflanzenfresser
das Ungeheuer und das Raubtier der Erlöser — und drei Minuten später erlebt dieselbe Klasse genau
diesen Löwen als das Grauen.

Bedingungen: Der Schatten muss als breite, weiche, grasende Masse erkennbar sein (ohne
Wiedererkennbarkeit gibt es nichts aufzudecken). In Level 2 wirft der eigene Körper beim Fressen
genau diesen Schatten. **Kein Wort erklärt das.**

### Perspektivpaare statt Sinnsprüche

Im zweiten Akt des Replays bekommt jedes Ereignis zwei Sätze. Beide wahr, keiner hebt den anderen
auf.

| Ereignis | Von unten | Von oben |
|---|---|---|
| Der Schatten über dem Halm | „Etwas Dunkles kam, um mich zu fressen. Ein Schneller hat es verjagt." | „Ich hatte Hunger. Dann kam der Löwe." |
| Die Jagd in der Herde | „Ich bin gelaufen, so schnell ich konnte." | „Zum ersten Mal seit drei Tagen etwas für die Jungen." |
| Der lange Rückweg | „Sie hat nicht alles nach Hause gebracht." | „Zwei von dreien haben überlebt." |
| Die Schwelle im Rauch | „Jemand stand die ganze Zeit vor mir." | „Er ist durchgekommen." |
| Der Ruf ohne Antwort | „Ich habe weiter gerufen." | „Ich habe es gehört. Ich konnte nicht mehr." |

Sprichwörter werden **nicht** verwendet (verworfen am 09.08.).

---

## 4 · Die Leitlinien, die sich bewährt haben

Diese Regeln sind aus Fehlern entstanden. Sie stehen hier, damit sie nicht noch einmal verletzt
werden.

1. **Fortschritt ist Leistung, nicht Uhr.** In Version 1 war `progress = elapsedMs / storyDuration`.
   Der Schatten kam, weil 31 % der Zeit vergangen waren. Das machte den Spieler zum Zuschauer.
   Seit V2 enden Level 3–6, wenn ihr Soll erreicht ist; `maximumDurationMs` ist nur Notbremse.

2. **Ein Ziel, dessen Verfehlen nichts kostet, ist eine Beschriftung, kein Ziel.** ODER-Tore der
   Form `if (gesammelt >= 5 || zeit >= 18s)` sind verboten.

3. **Ohne sichtbare Wirksamkeit keine verborgene.** Die didaktische Regel „unvermeidliches Leid darf
   nicht als Steuerungsversagen erscheinen" war zu weit verallgemeinert worden: aus „der Ausgang ist
   nicht deine Schuld" wurde „nichts ist deine Leistung". Damit war auch die Pointe leer. Man kann
   eine verborgene Wirksamkeit nur enthüllen, wenn es vorher eine sichtbare gab.

4. **Jede Mechanik muss zu einem drehbaren Replay passen.** Vor jeder Änderung wird geprüft, ob die
   beiden Filme eines Abschnitts noch durch *ein eindeutiges Spielerverhalten* ausgewählt werden.
   Das Replay muss nicht perfekt matchen — die Filmcuts dürfen so gesetzt sein, dass der Zuschauer
   sich und sein Spielverhalten darin wiedererkennt.

5. **Erst die Situation, dann das Bild.** Ein schönes Bild ist keine Situation. Reihenfolge:
   *Wer ist das, wo, was passiert?* → Replay-Szene → daraus der unscharfe Echo-Ausschnitt.

6. **Nichts benennen, was das Replay aufdecken soll.** Kein „Gras sammeln" im HUD.

7. **Kein Verlieren.** Es gibt keine Niederlage, nur Güte: *knapp · solide · stark*.

8. **Struktur zuerst, Feinjustierung zuletzt.** Wir haben uns mehrfach in Details verrannt und
   funktionierende Level „verschlimmbessert". Erst wenn das Ganze steht, wird justiert.

---

## 5 · Eine Steuerung mit fünf Schichten

| Stufe | Neue Schicht | Was verloren gehen kann |
|---|---|---|
| 1 · Gras | Ausrichten | nur sich selbst |
| 2 · Zebra | + Bewegen | den eigenen Körper |
| 3 · Löwin | + Tragen | das Anvertraute |
| 4 · Mensch, Schützender | + Abschirmen | den, den man schützt |
| 5 · Mensch, Geretteter | + Antworten | das Gegenüber |
| 6 · Ende | — | alles, in umgekehrter Reihenfolge |

Was zuletzt gelernt wurde, geht zuerst verloren. Der letzte mögliche Zug des Spiels ist derselbe wie
der allererste: **die Wendung zum Licht.**

**Wer man in Level 4 und 5 ist** (entschieden 10.08.): In Level 4 ist man der **Schützende** — man
stellt sich dazwischen, bleibt an der Schwelle zurück und erfährt nie, ob es sich gelohnt hat. Der
Übergang gibt die Kamera an den Geschützten weiter; in Level 5 ist man **er**. Die Kette lautet:
jemand gibt sich für dich hin → du bindest dich → du verlierst → du lässt los.

Level 5 und 6 sind **derselbe Mensch**, jung und alt.

---

## 6 · Die sechs Level

Jedes: ein Verb, ein Gegenüber, ein Widerstand, ein Takt von 8 bis 12 Sekunden.

### 1 · Bleibe — Gras

Der Halm wächst nur bei gelungener Ausrichtung zum Licht; mit der Länge steigen Reichweite und
Beweglichkeit. Das Licht zieht in einem Bogen über den Raum. Der dunkle Schatten kommt, wird vom
schnellen warmen Signal vertrieben, kehrt später unvermeidlich zurück.

> **Status: bewusst auf dem alten Stand.** Ein Umbau auf „Lichtwellen fangen" (Knoten setzen) wurde
> gebaut und am 11.08. wieder **zurückgesetzt** auf Commit `8f7d803`. Begründung des Nutzers: Das
> Wachsen hat Sinn ergeben, die Knoten nicht. Die berechtigte Kritik war „langatmig", nicht „falsch".
> Wenn hier je wieder angefasst wird, dann an der Länge, nicht an der Idee.

### 2 · Folge — Zebra

Bleibt unverändert. Sammeln in der Herde, vier autonome Konkurrenten, dann die Jagd. Das Ende ist
unabhängig von der Leistung unvermeidlich. Zwei Anschlüsse an Level 1: Startenergie ist das
Wachstum von dort, die Grasfelder sind die Halme von dort.

### 3 · Versorge — Löwin *(neu am 11.08.)*

Ein einziger langer Rückweg mit **schwerer** Last (10 Stücke). Drei Junge am Bau, jedes mit eigenem
Hunger und eigenem Lebensbalken, jedes in Bewegung — unruhiger, je hungriger.

- **Verteidigt wird mit der Leertaste**, nicht mit Stehenbleiben. Ein zulaufender Ring zeigt das
  Reaktionsfenster; wer nicht drückt, verliert ein Stück.
- Die Last macht wirklich langsam (`maxSpeed` 4,2 → 1,1 bei voller Ladung, Konkurrenten 3,9).
  Weglaufen ist unmöglich. Wer ignoriert, ist schneller — weil leichter.
- Die **Übergabe läuft Stück für Stück**, jedes ans hungrigste Junge, mit Lichtring und Ton. Danach
  sinken die Balken wieder: das ist der Grund, noch einmal loszugehen. Der Kreislauf steht im Bild,
  nicht im Text.
- Der zweite Gang führt über einen **Zaun mit Scheinwerfern** — die Grenze eines Menschengebiets.
  Hier kommen zum ersten Mal Menschen im Spiel vor.

Botprüfung: „wehrt sich" 20 s / 10 von 10 / 3 abgewehrt · „ignoriert" 17 s / 8 von 10.

### 4 · Bewahre — der Schützende, „Dazwischen"

Man sammelt nichts und geht nicht selbst zum Ausgang. Ein Schutzbefohlener geht allein zur Schwelle;
Glut kommt in Wellen mit sichtbarer Vorwarnung. Die einzige Aufgabe: den eigenen Körper dazwischen
bringen. Abgefangene Glut **krümmt sich in den Spieler hinein** und wird zu einem Funken — sie darf
nicht wie ein Einschlag aussehen, wenn sie als abgefangen zählt.

Wichtig aus der Botprüfung: Abschirmen muss **gerichtet** sein. Bei senkrechter Streuung landete
zusätzliche Glut folgenlos neben dem Geschützten, und das Level war in 11 s durch.

Bewertet wird, wie viel **er** noch hat (`throughHits`).

### 5 · Verbinde — der Gerettete, „Zuruf und Antwort"

Der Ruf reist sichtbar durch den Raum und braucht dafür **immer gleich lang**, egal wo man steht.

> Eine frühere Fassung koppelte die Laufzeit an den Abstand. Das bestrafte genau die naheliegende
> Handlung — hingehen — und die stillschweigende Regel, sich erst wieder zu entfernen, ergab keinen
> Sinn. Der Nutzer hat das zu Recht als unverständlich gemeldet.

Die **Wahl des Gegenübers läuft über die Mechanik**: Am Anfang rufen drei; wem man zuerst antwortet,
mit dem geht das Leben weiter. Soll: acht Wechsel. Dann werden die Rufe unregelmäßig, schwächer,
bleiben aus. Man kann weiter rufen; es kommt nichts zurück — auch direkt danebenstehend nicht.

### 6 · Lass los — das Leben, das Licht weitergeben

Ein ganzes Menschenleben. Man entzündet andere; **Weitergeben kostet nichts, es vergrößert den
eigenen Schein** (`radius = BASE + entzündete × RADIUS_PER_SOUL`). Wer entzündet ist, leuchtet
selbst und hält die Finsternis mit zurück — auch ohne einen.

Vier Gesichter des Leids: **Verlust** (einer stirbt), **Endlichkeit** (zwei rufen gleichzeitig von
zwei Enden — man kann nicht an zwei Orten sein), **Ohnmacht** (einer hinter verschlossener Tür),
**Einsamkeit** (einer dreht sich zur Wand).

Am Ende versagt der Körper, nicht das Werk. Dann kommt das große Licht, und **alles, was je
gebrannt hat, brennt wieder**. Gezählt wird *Entzündet* — auch die, die später erloschen sind.

---

## 7 · Wofür das Licht steht

*Entschieden am 10.08., nach einem Fehlentwurf.*

Das Licht ist **weitergegebene Liebe**, nicht Lebenskraft. Es unterliegt keiner Erhaltung: Es wird
nicht weniger, wenn man es teilt. Ein früherer Entwurf modellierte es als schwindenden Vorrat — das
machte Liebe zu einem knappen Gut, das man verwaltet, und sagte damit genau das Falsche.

Knapp ist nicht das Licht, **knapp ist der Mensch**: Lebenszeit, Körper, Reichweite. Daraus kommt
der ganze Widerstand — als Endlichkeit, nicht als Geiz.

Die Finsternis ist **unpersönlich**: Kälte, Erlöschen, keine bösartigen Menschen. Sobald Gestalten
einfach „die Bösen" wären, widerspräche das der Grundregel, dass jede Perspektive real ist.

---

## 8 · Die sechs Situationen (Grundlage für alle Filme)

| # | Situation | Das Dunkle | Der Rand |
|---|---|---|---|
| 1 | Morgen auf einer Lichtung. Ein Halm zwischen Steinen. Etwas Großes reißt Gras ab, ein Schnelles jagt es fort. Später kommt es wieder. | das Zebra | Steine |
| 2 | Mittag, dieselbe Lichtung. Ein Zebra äst in der Herde, Konkurrenz um die guten Stellen. Die Löwin reißt erst ein anderes Tier, kommt später wieder. | die Löwin | Staubwolke |
| 3 | Nachmittag, der lange Rückweg. Die Löwin schleppt die Beute zu ihren Jungen, Hyänen nehmen Teile. Ihr Leben endet später am Zaun mit Scheinwerfern. | die Hyänen | Zaun |
| 4 | **Nacht, ein brennendes Haus.** Ein Erwachsener bringt ein Kind zur Tür, stellt sich mit dem Körper unter herabfallende Trümmer. Das Kind kommt hinaus. **Es lebt.** Der Erwachsene bleibt im Haus. | der Rauch | Schwelle |
| 5 | Jahre später, zwei Menschen. Das gerettete Kind ist erwachsen. Alltag: einer ruft den Namen, der andere antwortet. Dann wird der andere krank. Die Antworten kommen später, leiser, gar nicht mehr. Danach ruft man weiter. | die Krankheit | Hof |
| 6 | Eine Nacht, derselbe Mensch, alt. **Nachtschicht in einer Wärmestube.** Er geht von Bett zu Bett, deckt zu, bleibt sitzen. Am Morgen setzt er sich und steht nicht mehr auf. Die Lichter brennen weiter. | die Kälte | Tür des Saals |

Drei Fragen zu Level 4, die lange offen waren und jetzt feststehen: Geschützt wird **ein Kind, das
dir anvertraut ist** (ob eigenes, bleibt offen). Geschützt wird **vor herabfallenden brennenden
Trümmern**, nichts Symbolisches. Und: **Die Schwelle ist der Ausgang, nicht der Tod.**

---

## 9 · Echos und Replay

Ein Echo ist **kein eigener Film**, sondern ein kurzer, unscharfer Ausschnitt aus der Szene, die das
Gesamt-Replay am Ende vollständig zeigt. Nur so funktioniert die Staffelung.

Zwischen den Abschnitten steht die **Weißblende**: der Zustand zwischen zwei Leben. Das Spiel bietet
damit das Modell der Seelenwanderung an — als Deutung, nicht als Behauptung. Deshalb muss die Kette
ab 3 → 4 kein Fressen mehr sein.

### Verbindliche Filmliste

Zwei Varianten pro Level, jede eigenständig drehbar, **ein** Selektor. Mehr ist nicht finanzierbar,
weniger macht das Replay beliebig.

| Level | Film A | Film B | Selektor |
|---|---|---|---|
| 1 · Gras | zum Licht gestreckt | im Schatten geblieben | `primaryDirection` |
| 2 · Zebra | mitten in der Herde | am Rand | `metrics.groupNearRatio` |
| 3 · Löwin | warme Spur | kühle Spur | `choices.trail` |
| 4 · Schützender | kommt fast unversehrt durch | kommt gezeichnet durch | `metrics.throughHits` ≤ 4 |
| 5 · Bindung | Bernstein · Violett · Blau | — | `choices.preferredSignal` |
| 6 · Leben | viele Lichter bleiben | wenige bleiben | `choices.light` |

**Behobene Regression (10.08.):** Echo 4 wählte über `choices.route` aus — oben oder unten. Das
setzt in „Dazwischen" aber der Schutzbefohlene mit seinem Weg, nicht die spielende Person. Der Wert
war praktisch zufällig geworden.

### Die Regel für alle Aufnahmen

> **Nie die ganze Gestalt. Kein Gesicht, kein Auge, keine vollständige Figur.**
> Nur Teile, Spuren, Licht und Schatten.

Gilt **in den Echos**; im Gesamt-Replay darf mehr zu sehen sein, dort ist Klarheit ja der Zweck.
Gründe: Ein Unterarm gehört jedem, ein Gesicht gehört einem. Hände, Kerzen, Fenster, Rauch und
Türrahmen sind das, was Bildmodelle zuverlässig können; konsistente Gesichter das, was sie am
schlechtesten können. Und es entfallen Persönlichkeitsrechte sowie Kinder in Gefahrensituationen.

### Wiederkehrende Motive als Klammer

| Motiv | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|
| **Licht von außen** | Morgensonne | Mittagslicht | Scheinwerfer | Türrahmen | Fenster | Flamme |
| **Etwas Dunkles** | Zebra | Löwin | Hyänen | Rauch | Krankheit | Kälte |
| **Ein Rand** | Steine | Staubwolke | Zaun | Schwelle | Hof | Tür |
| **Staub oder Rauch** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

### Produktionsreihenfolge

1. **Echo 5** — zwei Fenster bei Nacht, keine Darsteller. Einfachster Clip, bester Beleg für die Regel.
2. **Echo 6** — Kerzen und Hände.
3. **Echo 4** — Rauch und Funken machen die Arbeit.
4. **Echo 2 und 3** — Tieraufnahmen; Archiv oder KI, Rechtelage prüfen.
5. **Echo 1** — liegt als Storyboard vor.
6. **Die Replay-Szenen zuletzt**, wenn alle sechs Situationen im Bild bestätigt sind.

Jede erzeugte Datei bekommt einen Eintrag in `public/assets/PROVENANCE.md` mit Modell, Datum, Prompt
und Job-Kennung.

---

## 10 · Übergänge ohne Schnitt

Kein Fade, kein Briefing. Die Kamera folgt nie dem Spieler, sondern dem, **was weitergeht**.

| Übergang | Was zu sehen ist | Stand |
|---|---|---|
| 1 → 2 | Der Halm wird abgerissen, die Kamera folgt ihm ins Maul | offen |
| 2 → 3 | Der eigene Körper wird fortgetragen; die Kamera bleibt am Körper | offen |
| 3 → 4 | Die Last erreicht die Jungen; das Bild bleibt an einem von ihnen | offen |
| 4 → 5 | Der Geschützte kommt durch die Schwelle; die Kamera geht mit ihm | **gebaut** |
| 5 → 6 | Kein Wechsel. Das Bild bleibt, nur die Zeit läuft weiter | offen |

Beim Bau von 4 → 5 tauchte ein Ladescreen auf: `afterLevelFinished()` blendete 900 ms auf Schwarz,
dazu kam die Briefing-Schattierung mit 0,94 Alpha. Behoben durch Überschreiben von
`afterLevelFinished` und einen `soft`-Modus für das Briefing. Wer die übrigen vier baut, wird
denselben Punkt beachten müssen.

---

## 11 · Das Ende: das Gesamtbild als Erfahrung

**Entscheidung vom 09.08.: Das Spiel gibt das Gesamtbild. Es lässt den Schluss nicht offen.**

Begründung: Block E folgt unmittelbar auf Block D und bringt eine Nahtoderfahrung „ohne Rahmung,
ohne Bewertung", dazu Julian von Norwich, Ijob 38, **Metz** und den Höhlenrückkehrer. Der
Widerspruch ist damit eingeplant, drei Wochen später und namentlich. Das Spiel muss ihn nicht selbst
leisten.

Damit das Gesamtbild eine Erfahrung wird und keine Behauptung, passiert es in der Steuerung:

1. **Die Fäden werden sichtbar.** Die Kopplungen zwischen den Leveln leuchten auf — echte Werte
   dieses Durchlaufs, keine Animation.
2. **Die Kamera löst sich.** Kein HUD, keine Restzeit, kein Ziel; die Kamera hängt an keinem
   Lebewesen mehr. Freie Bewegung über das Ganze. Der Ausschnitt als Fessel fällt weg.
3. **Das Gewebe.** Die sechs Fäden schließen sich zu einer Fläche.
4. **Die Rückkehr.** Das Bild verengt sich wieder auf einen dunklen Ausschnitt. Das Spiel erklärt
   nichts. Die Unaussprechlichkeit ist der beständigste Zug von Nahtoderfahrungsberichten; ein
   erklärender Schlusssatz wäre der Erfahrung untreu.

Im Standbild führt vom Lichtpunkt ein feiner Faden aus dem Bild hinaus. Offene Frage fürs
Unterrichtsgespräch: *Ist der Faden noch da — oder bildet er sich das ein?*

Außerdem festgehalten: **kein** konkreter Erfahrungsbericht und **kein** Name im Spiel (das Zeugnis
gehört in Block E), **kein** Beweisanspruch, und der Satz „Nichts geht im Ganzen verloren" entfällt —
das Bild zeigt es bereits, gesagt würde es zur Behauptung.

---

## 12 · Technisches Gerüst

**Stack:** Phaser 3.90 · TypeScript ~6.0.2 · Vite ^8.2.0 · Node 24.
`erasableSyntaxOnly` ist gesetzt — **keine TS-Parameter-Properties** im Konstruktor.

```
src/game/
├── states/          Szenen: Boot, Preload, Title, Intro, Level01–06,
│                    Echo01–05, Transition45, FinaleReplay, End
│                    TimedLevelScene = Basis mit advanceLevel / collectResult /
│                    applyHint / afterLevelFinished
├── systems/         GoalTracker, HintManager, InputManager, ReplayDirector
├── components/      ObjectiveHud, LevelBriefing
├── config/          levels.ts (Zeiten), gameConfig.ts, replayManifest.ts (13 Clips)
└── visuals.ts       gemeinsames Bildsystem: palette, glow/glowEllipse, self(),
                     hazard, ground, dust, vignette, Sparks
```

**`GoalTracker`** bündelt: **Soll** (zählbare Zahl im HUD, vor dem Start genannt), **Puffer**
(zweite Ressource, sinkt durch Fehler), **Rückschlag** (Fehler kostet sichtbar), **Güte**
(*knapp · solide · stark*).

**`self()`** zeichnet in allen Leveln dieselbe Spielerfigur — die Wiedererkennbarkeit über die
Stufen hinweg ist Teil der Aussage.

**`glow()`** leitet die Zahl der Schichten aus dem Radius ab
(`clamp(radius / 24, 12, 22)`); mit fester Schichtzahl gab es sichtbare Ringe.

### Befehle

```bash
npm run dev
```

```bash
npm run build
```

`build` läuft `typecheck` → `vite build` → `make-offline.mjs`. Letzteres erzeugt die
**Offline-Fassung** `index.html` im Projektstamm: CSS und der gesamte Phaser-Code eingebettet, per
Doppelklick startbar. Nach jeder Quelltextänderung neu erzeugen.

---

## 13 · Wie wir das Spiel prüfen

Das Grundproblem war: Claude kann das Spiel nicht sehen. Gelöst in zwei Stufen.

**Stufe 1 — eingebaute Prüfstrecke** (`src/dev/qa.ts`). `window.__qa.run()` taktet Phaser von Hand
(`game.step()`), `window.__qa.live()` lässt das Spiel normal laufen und besetzt nur die Steuerung.
Pro Level ein Bot. `preserveDrawingBuffer: import.meta.env.DEV` ist nötig, um das WebGL-Canvas
auslesen zu können.

**Stufe 2 — echter Browser** (`scripts/qa.mjs`, Playwright + Chromium headless). Nimmt ganze
Bildschirme auf, samt DOM-Oberfläche außerhalb des Canvas, optional als Video.

```bash
node scripts/qa.mjs --state Level03 --seconds 70 --every 5
```

Voraussetzung: `npm run dev` läuft. Bilder landen in `docs/qa/`.

**Was das gefunden hat, was ohne Bild nie aufgefallen wäre:** Level 4 war in 11 s durch; die
Stille in Level 6 war unspielbar, weil die Drift die Geschwindigkeit über der Schwelle hielt;
Level 5 hatte zwei gültige Fenster pro Takt; Level 4 zeichnete Rauch mit der absoluten Uhr,
wertete ihn aber mit der Levelzeit; die Prüfstrecke selbst griff über `getScenes(true)[0]` die
Preload-Szene ab, sodass der Bot ins Leere lief.

---

## 14 · Vorgaben aus `AGENTS.md` (verbindlich)

- Lehrerinhalte werden zur Bauzeit **entfernt**, nicht versteckt.
- **Kein Klartext-Passwort** im ausgelieferten Build.
- Fremdmedien werden **nie lokal ausgeliefert** — Zwei-Klick-Einbettung.
- Der Live-Dienst speichert **nur Aggregate**.
- **Dateinamen ASCII**, ohne Umlaute und Leerzeichen.
- **Vor jeder Veröffentlichung** die Rechtsprüfung durchlaufen.

---

## 15 · Stand und offene Punkte

**Branches:** `main` · `v2-mechanik` (V2 erhalten, dazu Tag `v2-mechanik-stand`) ·
`v3-entwicklung-kreislauf` (aktuell). Alle auf `github.com/markuspillermusic-hash/theodizee-Game`.

| Teil | Stand |
|---|---|
| Level 1 · Bleibe | auf bewährter Fassung, bewusst nicht angefasst |
| Level 2 · Folge | unverändert, trägt |
| Level 3 · Versorge | **neu am 11.08.**, botgeprüft, vom Nutzer bestätigt |
| Level 4 · Bewahre | V3, botgeprüft |
| Level 5 · Verbinde | V3, feste Laufzeit, botgeprüft |
| Level 6 · Lass los | V3, Licht als weitergegebene Liebe |
| Übergang 4 → 5 | gebaut |
| Übergänge 1→2, 2→3, 3→4, 5→6 | **offen** |
| Finale (Fäden, freie Kamera, Gewebe, Rückkehr) | **offen** |
| Echo-Videos | prozedurale Fallbacks laufen; echte Clips **offen**, beginnend mit Echo 5 |
| Klassentest am Beamer | **offen** |

**Als Nächstes**, in dieser Reihenfolge:

1. Die vier fehlenden Übergänge — damit die Kette ohne Schnitt durchläuft.
2. Das neue Finale mit den echten Kopplungswerten.
3. Erst dann Feinjustierung.
4. Zuletzt die Filmmedien, beginnend mit Echo 5.

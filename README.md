# Ausschnitt

`Ausschnitt` ist ein browserbasiertes, abstraktes Spiel für eine gemeinsame Unterrichtssituation in
Jahrgangsstufe 11. Die vollständige Spielmechanik des Masterbriefings ist als lokal lauffähiger
Prototyp umgesetzt:

`Titel → Einführung → 6 Level → 5 Echos → personalisiertes Gesamt-Replay → stehendes Endbild`

Die spielbaren Abschnitte verraten ihre Identitäten zunächst nicht. Erst die Echos und das Finale
öffnen schrittweise die Verbindung von Gras, Zebra, Löwenfamilie und menschlicher Geschichte. Das
Spiel inszeniert eine christlich-leibnizianische Deutungsmöglichkeit der Theodizeefrage; es behauptet
nicht, diese damit zu beweisen.

## Aktueller Medienstand

- Alle Spielmechaniken, Übergänge, Hilfen und Auswertungen sind vollständig testbar.
- Echo 1 besitzt zwei lokale MP4-Platzhalter und einen prozeduralen Fallback.
- Echo 2 bis 5 und das Gesamt-Replay laufen derzeit als ausgearbeitete prozedurale Fallbackfilme.
- Drei mit Higgsfield erzeugte Storyboardframes für Echo 1 liegen unter
  `public/assets/images/storyboard/echo-01/`.
- Die endgültigen KI-Videos werden erst nach Prüfung der Mechanik eingesetzt.

Fehlende Filmdateien stoppen das Spiel nicht.

## Voraussetzungen

- Node.js 20.19 oder neuer, wenn Quellcode verändert oder neu gebaut werden soll
- aktueller Chromium-basierter Browser empfohlen
- Lautsprecher und Beamer im Format 16:9

## Direkt per Doppelklick starten

Die `index.html` im Projektstamm ist die fertige Offline-Fassung. Sie enthält CSS und den gesamten
JavaScript-/Phaser-Code eingebettet und kann direkt in Chrome oder Edge geöffnet werden. Lokale
Medien bleiben austauschbar unter `public/assets/` daneben liegen.

Nach Änderungen am Quellcode die Offline-Fassung neu erzeugen:

```powershell
npm.cmd run build
```

## Entwicklungsstart

```powershell
npm.cmd install
npm.cmd run dev
```

Vite zeigt anschließend die lokale Adresse an, üblicherweise `http://localhost:5173/dev.html`.

## Produktionsbuild

```powershell
npm.cmd run build
npm.cmd run preview
```

Der Build erzeugt zusätzlich `dist/index.html`. Sowohl diese Datei als auch die `index.html` im
Projektstamm sind offlinefähig.

## Steuerung

- `W`, `A`, `S`, `D` oder Pfeiltasten: räumliche Bewegung
- Maus oder Berührung: Zielpunkt setzen; Antippen löst in Aktionsphasen zugleich eine Resonanz aus
- Leertaste: Rhythmusantwort beziehungsweise Versuch in Level 5
- primärer DOM-Button: Start und neuer Durchlauf
- Vollbild: über die Lehrersteuerung

Die Level besitzen keine Niederlage. Feste Erzählzeiten, drei Hilfestufen und ein kontrollierter
Abschluss verhindern Blockaden. Unvermeidliche Ereignisse werden nicht als Folge schlechter
Steuerung dargestellt.

## Mechaniken

| Abschnitt | Mechanik | Personalisierte Daten |
|---|---|---|
| 1 · Bleibe | Wachstum im Licht; Sonnenbogen mit Untergang und Wiederaufgang | Richtung, Lichtzeit, erreichte Länge |
| 2 · Folge | kompakte gestreifte Signalkörper, Nahrungssuche, Konkurrenz und frühe unvermeidliche Jagd | Funde, Konkurrenzverluste, Energie, Fluchtbewegung |
| 3 · Versorge | zwei Empfänger, eine Tragkraft, driftende Gefahrenfelder · Soll 8 | Versorgungen, Fracht, Rückschläge, Weg, Güte |
| 4 · Bewahre | „Dazwischen": einen Schutzbefohlenen mit dem eigenen Körper decken · Soll 14 | Abgefangen, Durchgekommenes, sein Zustand, deine Kraft |
| 5 · Verbinde | „Zuruf und Antwort": sichtbar reisender Ruf, Antwort beim Eintreffen · Soll 8 Wechsel | Treffer, Genauigkeit, Signal, Nähe, unbeantwortete Rufe |
| 6 · Lass los | „Rückwärts": fünf Muster aus den vorigen Leveln halten, dann fallen die Schichten rückwärts weg | Erinnerungen, verlorene Schichten, Wendung zum Licht |
| Übergang 4 → 5 | Schnittloser Wechsel: die Kamera folgt dem, der durchkommt | — |
| Finale | fünfteilige Zusammenschau | Richtung, Spur, Weg und Beziehungsmotiv |

Level 3 bis 6 enden, sobald ihr Soll erreicht ist; die Zeitgrenze ist nur noch Notbremse und löst
kurz davor automatisch die höchste Hilfestufe aus. Gemessene Werte bei perfektem Spiel: 42 s, 51 s (Level 4),
32 s (Level 5) und rund 24 s. Mit Echos, Übergängen und Spielerwechseln ergibt das ungefähr 30 bis
35 Minuten. Der Testmodus verkürzt den kompletten automatischen Durchlauf auf rund 1,5 Minuten.

## Lehrersteuerung

Öffnen über den unauffälligen Button rechts oben oder `Strg + Umschalt + L`.

Verfügbar sind:

- Pause und Fortsetzen
- nächste Hilfestufe auslösen
- Abschnitt kontrolliert abschließen oder neu starten
- jedes Level, Echo, Gesamt-Replay und Endbild direkt starten
- kompletten Durchlauf einschließlich lokaler Telemetrie zurücksetzen
- Musik- und Effektlautstärke getrennt regeln
- Untertitel ein- und ausschalten
- Vollbild
- Testmodus mit stark verkürzten Zeiten

Die Steuerung ist Teil des lokalen Autorenentwurfs und kein Zugriffsschutz.

## Debugmodus

Im Entwicklungsserver mit `Strg + Umschalt + D` ein- oder ausblenden. Angezeigt werden:

- FPS und aktiver State
- Restzeit und Hilfestufe
- Preload- und Videostatus
- ausgewählte Echo- beziehungsweise Finalevariante
- lokal gespeicherte Telemetrie

Der Shortcut wird im Produktionsbuild nicht registriert.

## Prüfstrecke für Bildkontrolle

In manchen Prüfumgebungen wird die Seite nicht zusammengesetzt. Dann feuert `requestAnimationFrame`
nicht: Es läuft kein `update`, es wird nichts gezeichnet, Szenenwechsel bleiben in der Warteschlange
stehen, und ein Screenshot von außen ist unmöglich.

Der Entwicklungsserver löst das. `window.__qa` taktet Phasers Schleife von Hand — `game.step()`
erledigt Warteschlange, Szenen-Update, Zeitgeber, Tweens und das Rendern in einem Aufruf. Danach
wird das Canvas ausgelesen und über `POST /__qa/shot` als PNG unter `docs/qa/` abgelegt.

```js
await window.__qa.run({
  state: 'Level04',
  seconds: 70,
  shots: [26, 50, 54, 58],          // Sekunden, zu denen ein Bild entsteht
  label: 'kette',
  bots: {                            // Steuerung je Szene, optional
    Level04: (scene) => (x, y) => ({ x: 1, y: 0, active: true }),
  },
})
```

Zurück kommt die Liste der durchlaufenen Szenen, die Bildpfade, die Texte der Bedienoberfläche und
der Zeitpunkt des Levelabschlusses. Ohne `bots` läuft der untätige Durchlauf.

Zwei Voraussetzungen sind dafür im Code hinterlegt und gelten **nur** im Entwicklungsserver:
`preserveDrawingBuffer` in der Renderkonfiguration, ohne das der WebGL-Puffer nach dem Zeichnen
geleert und jede Aufnahme schwarz wäre, sowie das Vite-Plugin, das die Bilder schreibt. Im
Produktions- und Offline-Build entfällt beides.

### Echter Browser mit laufender Bildschleife

Für Bewegung, Übergänge und die Oberfläche ausserhalb des Canvas reicht das Handtakten nicht.
`scripts/qa.mjs` startet Chromium über Playwright, lässt das Spiel normal laufen, besetzt nur die
Steuerung und nimmt ganze Bildschirme auf:

```powershell
npm.cmd run dev
npm.cmd run qa -- --state Level04 --seconds 66 --shots 26,50,54,58,62
npm.cmd run qa -- --state Level06 --every 4 --seconds 40 --video
```

Optionen: `--state`, `--seconds`, `--shots` (Sekunden, kommagetrennt), `--every` (dichte Reihe),
`--label`, `--out`, `--video`, `--url`. Ausgegeben werden die erreichte Szene, die Bildrate, die
Texte der Oberfläche, die Bildpfade und alle Konsolenfehler. Die Steuerungsbots je Abschnitt stehen
oben in `scripts/qa.mjs`.

Die Bildrate liegt im Headless-Betrieb bei etwa 25 Bildern je Sekunde, weil dort ohne
Grafikbeschleunigung gezeichnet wird. Für die Beurteilung von Aufbau und Lesbarkeit genügt das; für
Aussagen über Flüssigkeit ist weiterhin der Beamer massgeblich.

`docs/qa/` ist nicht versioniert. Aufnahmen, die als Beleg dienen sollen, gehören in einen datierten
Ordner unter `docs/`.

## Speicherung und Datenschutz

Erfasst werden ausschließlich abstrakte Verhaltenswerte des gemeinsamen Durchlaufs. Es gibt keine
Namen, Konten, Serverübertragung oder externe Analyse. `localStorage` ist optional; bei einer Blockade
bleibt die laufende Sitzung im Arbeitsspeicher spielbar. „Neuer Durchlauf“ löscht die Telemetrie.

## Konfiguration

- Levelzeiten und Hilfszeitpunkte: `src/game/config/levels.ts`
- Farben, Steuerempfindlichkeit und Testzeitfaktor: `src/game/config/gameConfig.ts`
- Echo-Clips und Auswahlbedingungen: `src/game/config/replayManifest.ts`
- prozedurale Audiomotive: `src/game/config/audioManifest.ts`

## Bildsystem

`src/game/visuals.ts` ist die gemeinsame Grundlage aller Abschnitte: eine Palette, weiches Licht mit
echter Abnahme, die immer gleiche Lichtgestalt der spielenden Figur, Gefahrenfelder, treibender Staub
und Vignette.

Phaser-Grafiken kennen keinen Radialverlauf. Weiches Licht entsteht deshalb aus konzentrischen
Kreisen mit quadratisch abnehmender Deckkraft; die Zahl der Schichten richtet sich nach dem Radius,
sonst entstehen sichtbare Ringe.

Die wichtigste Regel: **Die spielende Figur sieht in allen sechs Abschnitten gleich aus.** Dasselbe
Licht geht durch alle Gestalten — der Kreislauf, sichtbar in einer einzigen Form.

## Architektur

- Phaser-Szenen bilden die explizite Zustandsmaschine.
- `TimedLevelScene` bündelt Zeitgrenze, Hilfen, Telemetrie und Lehrerereignisse für Level 2 bis 6.
- `GameServices` stellt Audio, Video, Speicherung, Telemetrie, Replay-Auswahl und DOM-UI bereit.
- Audio wird mit Web Audio getrennt von den stummen Videos erzeugt.
- Jede Echo-Szene zeichnet unter dem Video einen prozeduralen Fallback.
- Das Finale liest wenige robuste Verhaltensmerkmale, rekonstruiert aber keine exakten Bewegungen.

## Qualitätschecks

```powershell
npm.cmd run typecheck
npm.cmd run build
```

Vor dem Unterrichtseinsatz zusätzlich den vollständigen regulären Durchlauf am konkreten Beamer und
mit der Klassenraum-Audioanlage testen.

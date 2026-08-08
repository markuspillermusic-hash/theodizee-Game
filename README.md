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
| 3 · Versorge | aktive Empfangspulse, Spur-Etappen, Ressource, Risiko und Rückkehr | Pulse, Spur, Frachtstärke, Rückkehrbewegungen |
| 4 · Bewahre | vertrauter Resonanz folgen, Rauchzonen, riskante Wegwahl, Weitergehen | Weg, Rauchexposition, Klarheit, Nähe, Reaktion |
| 5 · Verbinde | Begegnung, spielbarer Pulsrhythmus, Verantwortung, Rettungsversuche, Bleiben | Rhythmustreffer, bevorzugtes Signal, Entscheidung, Versuche |
| 6 · Lass los | Erinnerungsmuster aufsuchen; danach Kontroll- und Wahrnehmungsabbau | Erinnerungen, Aktivität, Loslassen, Hilfebedarf |
| Finale | fünfteilige Zusammenschau | Richtung, Spur, Weg und Beziehungsmotiv |

Die regulären Konfigurationszeiten ergeben mit Übergängen und Spielerwechseln ungefähr 30 bis
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

## Speicherung und Datenschutz

Erfasst werden ausschließlich abstrakte Verhaltenswerte des gemeinsamen Durchlaufs. Es gibt keine
Namen, Konten, Serverübertragung oder externe Analyse. `localStorage` ist optional; bei einer Blockade
bleibt die laufende Sitzung im Arbeitsspeicher spielbar. „Neuer Durchlauf“ löscht die Telemetrie.

## Konfiguration

- Levelzeiten und Hilfszeitpunkte: `src/game/config/levels.ts`
- Farben, Steuerempfindlichkeit und Testzeitfaktor: `src/game/config/gameConfig.ts`
- Echo-Clips und Auswahlbedingungen: `src/game/config/replayManifest.ts`
- prozedurale Audiomotive: `src/game/config/audioManifest.ts`

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

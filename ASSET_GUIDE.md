# Asset Guide

## Zielstruktur

```text
public/assets/
  audio/
    ambience/
    effects/
    motifs/
    music/
  video/
    echoes/
      level-01/
      level-02/
      level-03/
      level-04/
      level-05/
    finale/
  images/
  fonts/
  config/
```

## Inhalt der Echos

Was in den Clips zu sehen ist, steht in `docs/KONZEPT-echos-drehbuch.md`. Dort gilt für alle sechs
Echos die Regel, die für Echo 1 schon in den Storyboard-Prompts steht: **nie die ganze Gestalt,
kein Gesicht, kein Auge.** Nur Teile, Spuren, Licht und Schatten.

## Videoanforderungen

- Format: H.264/AAC-freies MP4 als Primärdatei; optional WebM als Fallback
- Seitenverhältnis: 16:9
- Empfohlene Arbeitsauflösung: 1920 × 1080; Prototypen dürfen 1280 × 720 verwenden
- Bildrate: 24 oder 25 fps
- keine eingebrannte Musik; Filmton nur, wenn er bewusst als austauschbare Effektspur benötigt wird
- keine eingebrannten Untertitel oder Fachtexte
- `faststart`/vorangestellter MP4-Metadatenblock für schnelles lokales Starten

## Dateibenennung

ASCII, klein, Bindestriche, keine Leerzeichen:

```text
echo-01-left.mp4
echo-01-right.mp4
echo-02-group-near.mp4
finale-lion-perspective-child.mp4
```

Clip-ID und Dateiname sollen denselben Stamm besitzen.

## Längen

- Echo 1: 10–15 Sekunden
- Echo 2: 15–20 Sekunden
- Echo 3: 20–25 Sekunden
- Echo 4: 25–30 Sekunden
- Echo 5: 30–40 Sekunden
- Finale: besser kurze, austauschbare Segmente als eine einzige 6-Minuten-Datei

## Replay-Manifest

Eine neue Variante wird in `src/game/config/replayManifest.ts` ergänzt:

```ts
{
  id: 'echo-01-calm',
  levelId: 'level-01',
  srcMp4: 'assets/video/echoes/level-01/echo-01-calm.mp4',
  durationMs: 12_000,
  playbackRate: 1,
  tags: ['center', 'calm', 'macro'],
  caption: '[Wind. Eine grüne Spitze bleibt ruhig im Licht.]',
  conditions: [{ field: 'movementIntensity', operator: 'lt', value: 0.002 }],
}
```

Spezifische Regeln müssen vor allgemeinen Fallbackregeln stehen. Pro Level muss mindestens eine
Variante ohne schwer erfüllbare Bedingung erreichbar bleiben.

## Audio

Der aktuelle Prototyp erzeugt Musik und Motive prozedural über Web Audio. Für spätere Audiodateien:

- Musik und Effekte getrennt halten
- bevorzugt WAV für Bearbeitung, Ogg/MP3 für Auslieferung
- keine Musik in Videodateien einbrennen
- einheitliche Lautheit und ausreichend Headroom für Klassenraumlautsprecher
- Lizenz und Quelle pro Datei in `public/assets/PROVENANCE.md` festhalten

## Fallbackverhalten

`VideoManager` fängt Lade- und Wiedergabefehler ab. Unter dem Video läuft immer eine prozedurale
Fallbacksequenz; ein fehlender Clip stoppt deshalb weder Echo noch State Machine. Echo 2 bis 5 sind
bereits vollständig auf diese Weise testbar. Der Debugmodus zeigt den Fehlerstatus.

## Aktueller Austauschstand

- Echo 1: `echo-01-left.mp4` und `echo-01-right.mp4` sind lokale Platzhalter.
- Echo 2 bis 5: Varianten sind im Manifest angelegt; reale MP4-Dateien fehlen bewusst noch.
- Finale: wird bis zur Filmproduktion vollständig prozedural und personalisiert dargestellt.
- Echo-1-Storyboard: `public/assets/images/storyboard/echo-01/` enthält drei 2K-Frames und eine
  dokumentierte Vergleichsansicht.

Eine neue Filmdatei kann unter dem im Manifest genannten Pfad abgelegt werden. Nach einem erneuten
Build wird sie automatisch geladen; an Szenen- oder Telemetriecode ist keine Änderung erforderlich.

## Rechte und Provenienz

Für jedes endgültige Asset dokumentieren:

- Quelle und Urheber/Rechteinhaber
- Erzeugungs- oder Abrufdatum
- Lizenz und Bearbeitungsrecht
- erforderliche Namensnennung
- Prompt/Modell/Job-ID bei KI-Medien
- Einwilligung und Veröffentlichungsumfang bei erkennbaren Personen

„Im Unterricht genutzt“ ist keine pauschale Erlaubnis für eine öffentliche Website.

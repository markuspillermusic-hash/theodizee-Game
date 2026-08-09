# Level Design

## Didaktische Leitlinie

Das Spiel ist ein philosophisch-theologisches Gedankenexperiment, kein Beweis einer Theodizee. Jede
Einzelperspektive bleibt real; das spätere Ganze darf Leid nicht nachträglich zum Scheinproblem machen.
Die Deutung entsteht zuerst aus Mechanik, Wiedererkennung und Perspektivwechsel. Eine begriffliche
Einordnung gehört in das Unterrichtsgespräch nach dem Spiel.

## Level 1 · Bleibe — implementiert

- **Mechanik:** Ein kurzer, an einen Ursprung gebundener Halm wächst nur bei gelungener Ausrichtung.
  Mit seiner Länge steigen Reichweite und Beweglichkeit. Das Licht zieht in einem Bogen über den Raum,
  geht unter und steigt später von der Gegenseite wieder auf.
- **Dramaturgie:** Eine dunkle Störung nähert sich, ein schnelles Signal vertreibt sie, später kehrt die
  Störung unvermeidlich zurück.
- **Hilfen:** Lichtkontrast; sanfte magnetische Unterstützung; getragene Bewegung.
- **Telemetrie:** Richtung, Durchschnittsposition, Richtungswechsel, Bewegung, Zögern, Lichtzeit und Wachstum.
- **Echo:** zwei lokale MP4-Varianten und prozeduraler Fallback.

## Level 2 · Folge — implementiert

- **Mechanik:** Frei bewegliche, kompakte Signalkörper sammeln kleine aufgerichtete Nährfelder.
  Energie verändert Körpergröße, Beweglichkeit und Zahl der umlaufenden Resonanzpunkte. Vier autonome
  Konkurrenten besitzen eigene Ziele, Bewegungsrhythmen und Abstandsverhalten; es gibt keine Schweife.
- **Dramaturgie:** Nach etwa 19 Sekunden jagt das schnelle Motiv aus Level 1 einen Konkurrenten und
  trägt ihn ungefähr nach 30 Sekunden fort. Danach richtet es sich gegen den Spieler. Die eigene
  Energie fällt, die Bewegung wird schwerer und das Ende bleibt unabhängig von der Leistung unvermeidlich.
- **Hilfen:** hellere Nahrungspulse; Resonanz zum nächsten freien Signal; gestützte Bewegung.
- **Telemetrie:** Funde, an Konkurrenten verlorene Signale, Energie, Nähe, Fluchtrichtung,
  Richtungswechsel und geringster Jagdabstand.
- **Echo:** enge oder weite Herdenvariante; Filmdateien optional, prozeduraler Fallback vorhanden.

## Gerüst ab Version 2 — Soll, Puffer, Rückschlag, Güte

Level 3 bis 6 laufen seit der Überarbeitung vom 2026-08-09 nicht mehr auf die Uhr, sondern auf ein
Ziel. `GoalTracker` bündelt vier Dinge:

- **Soll** — eine zählbare Zahl im HUD, vor dem Start genannt.
- **Puffer** — eine zweite Ressource, die durch Fehler sinkt.
- **Rückschlag** — leerer Puffer nimmt Fortschritt zurück, füllt sich wieder und beendet nie das
  Level. Die Regel „keine Niederlage" gilt jetzt für das Ende, nicht mehr für den Weg dorthin.
- **Güte** — *knapp / solide / stark* aus Zeit und Rückschlägen; sie ersetzt die kosmetische
  Echo-Variantenwahl und ist die spätere Grundlage der Kopplung zwischen den Leveln.

Der Abschnitt endet, sobald das Soll erreicht ist. `maximumDurationMs` ist nur noch Notbremse: bei
78 % davon schaltet die Szene selbst auf Hilfestufe 3, statt hart abzuschneiden.

**Sprachregel:** HUD, Briefing und Anweisungen nennen ausschließlich Verben und Mengen, niemals
Wesen oder Stoffe. Nur so können Echo und Replay überhaupt noch etwas aufdecken.

## Level 3 · Versorge — überarbeitet

- **Mechanik:** drei aktiv zu fangende Pulse; danach zwei Empfänger mit unabhängig sinkendem
  Bedarf, eine wandernde Quelle und fünf driftende Gefahrenfelder. Getragene Fracht ist der Puffer
  und schwindet in den Feldern; leere Fracht bedeutet Rückschlag und neuen Weg zur Quelle.
- **Soll:** 8 Versorgungen. **Puffer:** Fracht. **Rückschlag:** −1, wenn ein Empfänger leer läuft
  oder die Fracht zerfällt; danach 7 Sekunden Schonfrist pro Empfänger.
- **Aussage:** Beide gleichzeitig voll zu versorgen ist nicht möglich. Das ist keine Behauptung des
  Textes, sondern eine Eigenschaft der Zahlen.
- **Gemessen:** perfektes Spiel 42 s, Untätigkeit endet nach 128 s an der Notbremse.

## Level 4 · Bewahre — überarbeitet

- **Mechanik:** Das Begleitsignal geht seinen eigenen, langsamen Weg und wartet nur, wenn man
  zurückfällt. Sieben Etappen liegen an den Rändern des Korridors, der Rauch liegt zwischen
  Begleitspur und Etappen. **Eine Etappe zählt nur bei einer Klarheit über 0,4** — das erzwingt den
  Wechsel aus Vorankommen und Auftanken, statt ihn nur nahezulegen.
- **Soll:** 7 Etappen und der Ausgang. **Puffer:** Klarheit. **Rückschlag:** eine Etappe zurück.
- **Wahl:** Der obere Korridor ist dichter im Rauch, der untere ruhiger. Gemessen 44 s gegen 34 s
  bei gleichem Ergebnis — unterschiedliche Anstrengung, nicht unterschiedlicher Erfolg.

## Level 5 · Verbinde — überarbeitet

- **Mechanik:** Die Rhythmusantwort trägt jetzt den ganzen Abschnitt. Der Takt zieht mit der Serie
  an (1500 ms auf 900 ms), das Antwortfenster wird enger, ein Fehlschlag setzt die Serie zurück und
  nimmt Verbindung; ein leerer Puffer lässt kurz stolpern.
- **Soll:** eine Serie von 8 Treffern, danach 3 Rettungsversuche zu je 3 Treffern in Folge.
- **Verlustphase:** Die Mechanik bleibt vollständig erhalten, der Takt wird unruhig, und jeder
  gelungene Versuch verglüht schneller als der vorige. Der Spieler antwortet weiter richtig, und es
  wirkt trotzdem immer weniger. Das ist der Kern des Spiels und wird gespielt, nicht erzählt.

## Level 6 · Lass los — überarbeitet

- **Mechanik:** Sieben vertraute Muster müssen nicht angetippt, sondern kurz **gehalten** werden.
  Ab dem Wendepunkt bauen Geschwindigkeit (5,6 auf 1,5), Eingabeverzögerung (bis 420 ms), Abdrift
  und Reichweite messbar ab — in der Steuerung, nicht im Bild.
- **Aussage:** Das Erreichbare wird kleiner als das Gewollte. Wer nicht alle sieben schafft, hat
  nichts falsch gemacht; es gibt in dieser Hälfte keinen Rückschlag mehr, nur noch Ruhe als Ausgang.

## Gesamt-Replay — implementiert

Das prozedurale Replay besitzt fünf Akte:

1. Identitäten
2. verschiedene Perspektiven auf dasselbe Ereignis
3. Wirkungskette von Energie bis Liebe
4. gleichzeitige Sichtbarkeit des Zusammenhangs
5. Wiedererkennen ohne Auflösung der einzelnen Stimmen

Richtung aus Level 1, Gruppennähe, Spur, Fluchtweg und bevorzugtes Beziehungssignal verändern die
Bildkomposition. Das Replay behauptet keine exakte Bewegungsrekonstruktion. Es endet mit einem
stehenden, für das Unterrichtsgespräch nutzbaren Gesamtbild.

## Offene Medienarbeit

Die Mechanik ist vollständig. Offen bleiben die endgültigen realistischen Echos, Filmschnitte des
Finales, ausgearbeitete Musikproduktion und ein regulärer 30- bis 35-minütiger Unterrichtstest mit
Klasse. Diese Arbeiten sollen die vorhandenen Fallbacks ersetzen, nicht die Zustandslogik verändern.

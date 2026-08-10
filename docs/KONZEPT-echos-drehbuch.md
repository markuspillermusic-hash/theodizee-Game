# Drehkonzept der Echos

Stand 2026-08-10. Ergänzt `ASSET_GUIDE.md` (Technik) und `replayManifest.ts` (Varianten und
Untertitel) um die Bildebene: Was ist zu sehen, und wie ist es überhaupt herstellbar.

---

## Das Problem

Echo 1 bis 3 kann man sich sofort vorstellen: ein Halm, eine Herde, eine Löwin. Tiere und Pflanzen
in der Natur, dokumentarisch, ohne Darsteller.

Ab Echo 4 sind es **Menschen**. Damit kommen auf einen Schlag: Gesichter und damit Besetzung,
Wiedererkennbarkeit über mehrere Einstellungen, eine bestimmte Kultur, Zeit und Kleidung — und bei
KI-Erzeugung genau die Dinge, die Modelle schlecht können. Ein erkennbarer Mensch ist immer *ein
bestimmter* Mensch. Das widerspricht dem Spiel, das von jeder Stufe sagt: Das hättest du sein können.

---

## Die Regel

> **Nie die ganze Gestalt. Kein Gesicht, kein Auge, keine vollständige Figur.**
> Nur Teile, Spuren, Licht und Schatten.

Das ist keine Notlösung und auch nichts Neues: Es ist die Vorgabe, die für Echo 1 schon gilt. In den
Prompts des vorhandenen Storyboards steht wörtlich *no complete animal, no face, no eye*. Die Regel
wird hier nur auf alle sechs Echos ausgedehnt.

Sie löst drei Probleme gleichzeitig:

- **Universalität.** Ein Unterarm gehört jedem. Ein Gesicht gehört einem.
- **Herstellbarkeit.** Hände, Kerzen, Fenster, Rauch, Türrahmen sind genau das, was Bild- und
  Videomodelle zuverlässig können. Konsistente Gesichter über mehrere Einstellungen sind das, was
  sie am schlechtesten können.
- **Recht und Ethik.** Keine erkennbaren Personen, keine Kinder in Gefahrensituationen, keine
  Persönlichkeitsrechte. Das entlastet die Rechtsprüfung erheblich.

**Zweite Regel:** kein eingebrannter Text, keine Schrift, kein Wasserzeichen. Steht schon im
`ASSET_GUIDE.md` und gilt weiter.

---

## Echo 1 · Gras — „Was über mir geschah"

*10–15 s. Bodennah, extremes Makro, sehr geringe Schärfentiefe.*

Ein einzelner Halm gegen die frühe Sonne. Eine dunkle, weiche Masse zieht dahinter durch das Bild —
breit, gemächlich, nie ganz zu sehen. Ein schneller warmer Streifen quert, die Masse weicht. Der
Halm federt zurück ins Licht.

| Variante | Bild | Selektor |
|---|---|---|
| `echo-01-hell` | der Halm über den ganzen Clip zum Licht gestreckt, warm durchleuchtet | hoher Anteil Lichtzeit |
| `echo-01-dunkel` | derselbe Halm, überwiegend im Schatten der Masse, kühl und matt | niedriger Anteil |

Storyboard und Prompts liegen bereits unter `public/assets/images/storyboard/echo-01/`.

---

## Echo 2 · Zebra — „Wovon ich lebte"

*15–20 s. Bodennah, mitlaufend, viel Staub.*

Nie das ganze Tier: Beine im Staub, ein Ausschnitt gestreifter Flanke, ein Ohr, ein Atemzug.
Die Herde nur als Bewegung im unscharfen Hintergrund. Gegen Ende bricht Unruhe aus; etwas Schnelles
zieht als Bewegungsunschärfe durch, und der Staub legt sich über eine Lücke.

| Variante | Bild | Selektor |
|---|---|---|
| `echo-02-near` | eng, viele Beine, Enge und Staub, ständig Körper im Bild | hohe Gruppennähe |
| `echo-02-wide` | weit, ein einzelner gestreifter Körper gegen leeren Horizont | niedrige Gruppennähe |

---

## Echo 3 · Löwin — „Was ich heimbrachte"

*20–25 s. Tief, schleppend, Abend.*

Pfoten im Gras. Ein Schulterblatt, das arbeitet. Dahinter eine dunkle Masse, die mitgeschleift wird —
nie als Kadaver erkennbar, nur als Gewicht und als Spur, die sich durch das Gras zieht. Am Ende
Dunkelheit unter einem Felsvorsprung, darin kleine Bewegungen und ein Laut.

| Variante | Bild | Selektor |
|---|---|---|
| `echo-03-warm` | trockenes Gras, tiefe Abendsonne, langer offener Weg | warme Spur |
| `echo-03-cool` | ausgetrocknetes Flussbett, blaue Stunde, nasser Sand | kühle Spur |

---

## Echo 4 · Der Schützende — „Wer vor mir stand"

*25–30 s. Kamera auf Kindhöhe, durchgehend vorwärts, Rauch.*

Die Kamera **ist** das Kind — sie geht, sie sieht nach vorn, sie wird nie gezeigt. Am linken
Bildrand ist ständig ein erwachsener Unterarm, eine Schulter, ein Stück Ärmel. Bei jedem
Funkenschlag schiebt sich der Arm ins Bild und deckt die Sicht kurz ab. Man hört ihn eher, als man
ihn sieht.

Dann ein heller Türrahmen. Der eigene Schatten wird lang und geht hindurch. **Der Arm folgt nicht.**
Letzte Einstellung, unscharf im Rücken: der Arm sinkt.

| Variante | Bild | Selektor |
|---|---|---|
| `echo-04-heil` | gleichmäßiger Gang, Ärmel unversehrt, das Licht am Ende klar | `metrics.throughHits` ≤ 4 |
| `echo-04-gezeichnet` | derselbe Gang, langsamer, Asche auf der Schulter, ein Ärmel versengt | sonst |

**Benötigt:** einen Arm, einen Türrahmen, Rauch, Funken. Kein Gesicht, keine Besetzung, kein Kind
im Bild.

---

## Echo 5 · Die Bindung — „Wer geantwortet hat"

*30–40 s. Nacht. Eine einzige Einstellung, statisch.*

**Zwei erleuchtete Fenster über einen dunklen Hof.** Das eine blinkt kurz. Das andere antwortet.
Wieder. Wieder. Der Wechsel wird dichter und selbstverständlicher.

Dann antwortet das ferne Fenster später als sonst. Dann schwächer. Dann gar nicht mehr.

Letzte Einstellung, lange gehalten: das eigene Fenster blinkt weiter ins Dunkel.

| Variante | Bild | Selektor |
|---|---|---|
| `echo-05-amber` | warmes Glühlampenlicht drüben | `choices.preferredSignal` = amber |
| `echo-05-violet` | bläulich flackerndes Licht drüben | = violet |
| `echo-05-blue` | eine Kerze drüben | = blue |

**Benötigt:** eine Nacht, zwei Fenster, eine schaltbare Lampe. **Null Darsteller.** Und es ist genau
die Mechanik des Levels: ein Ruf mit Laufzeit über eine Entfernung, den irgendwann niemand mehr
erwidert.

---

## Echo 6 · Das Leben — „Was weitergegeben wurde"

*30 s. Eine lange Einstellung, dunkler Raum.*

Eine Flamme wird entzündet. Eine Hand neigt sie zur nächsten Kerze. Diese Kerze neigt sich zur
übernächsten. **Hände und Flammen, sonst nichts** — kein Gesicht, keine Gestalt.

Das ist das Bild der Osternacht. Jede Klasse kennt es aus eigener Anschauung, und es sagt ohne ein
Wort, was das Level spielt: Licht wird nicht weniger, wenn man es weitergibt.

Zum Schluss fährt die Kamera zurück, und die Flammen überstrahlen ins Weiß — der Anschluss an das
Gesamt-Replay.

| Variante | Bild | Selektor |
|---|---|---|
| `echo-06-viele` | das Bild füllt sich mit Flammen, der Raum wird hell | `choices.light` = viele |
| `echo-06-wenige` | wenige Flammen, weit auseinander — aber sie brennen, und der Raum ist nicht mehr ganz dunkel | sonst |

**Benötigt:** Kerzen und Hände.

---

## Woran die Klasse den Zusammenhang erkennt

Vier Motive kehren durch alle sechs Echos wieder. Sie sind die Klammer, und sie müssen in jedem
Clip bewusst gesetzt werden:

| Motiv | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|
| **Licht von außen** | Sonne | Mittagslicht | Abendsonne | Türrahmen | Fenster | Flamme |
| **Etwas Dunkles, nie ganz sichtbar** | die Masse | der Schnelle | die Last | Rauch | die Nacht | der Raum |
| **Ein Rand, hinter dem etwas bleibt** | Horizont | Lücke im Staub | Felsvorsprung | Schwelle | Hof | Dunkel |
| **Staub in der Luft** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

---

## Produktionsreihenfolge

1. **Echo 5** zuerst. Zwei Fenster bei Nacht, keine Darsteller — technisch der einfachste Clip und
   zugleich der beste Beleg dafür, ob die Regel trägt.
2. **Echo 6**, weil Kerzen und Hände ebenso einfach sind und das Schlussbild festlegen.
3. **Echo 4**, weil Rauch und Funken die meiste Arbeit machen.
4. **Echo 2 und 3** als Tieraufnahmen; hier ist Archivmaterial oder KI-Erzeugung zu prüfen —
   Rechtelage nach Abschnitt 16 des Skills, Herkunft dokumentieren.
5. **Echo 1** liegt als Storyboard vor und wird zuletzt in Bewegung umgesetzt.

Vor der ersten Veröffentlichung gilt unverändert die Rechtsprüfung; jede erzeugte Datei bekommt
einen Eintrag in `public/assets/PROVENANCE.md` mit Modell, Datum, Prompt und Job-Kennung.

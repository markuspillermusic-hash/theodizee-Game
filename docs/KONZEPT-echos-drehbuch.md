# Die sechs Situationen · Replay, Echo, Drehkonzept

Stand 2026-08-10, ersetzt die erste Fassung. Ergänzt `ASSET_GUIDE.md` (Technik) und
`replayManifest.ts` (Varianten und Untertitel).

---

## Die Reihenfolge, in der gedacht werden muss

Ein Echo ist **kein eigener Film**. Es ist ein kurzer, unscharfer Ausschnitt aus der Szene, die das
Gesamt-Replay am Ende vollständig und klar zeigt. Nur so funktioniert die Staffelung: erst eine
Ahnung, dann das Ganze.

Daraus folgt die Arbeitsreihenfolge, die bisher falsch herum lief:

1. **Die Situation.** Wer ist das, wo, wann, was passiert, wovor schützt wer wen?
2. **Die Replay-Szene.** Dieselbe Situation, klar und von außen.
3. **Das Echo.** Zehn bis dreißig Sekunden daraus, unscharf, ohne den erklärenden Zusammenhang.

Die erste Fassung dieses Dokuments hat mit Schritt 3 angefangen und schöne Bilder gesucht. Das war
der Fehler. Ein schönes Bild ist keine Situation.

## Was die sechs Leben verbindet

Zwischen den Abschnitten steht die Weißblende und das Echo: **der Zustand zwischen zwei Leben.**
Das Spiel bietet damit das Modell der Seelenwanderung an — als eine Deutung, nicht als Behauptung.
Deshalb muss die Kette von 3 nach 4 kein Fressen mehr sein. Bei 1 bis 3 ist sie es zufällig, weil
diese drei Leben so enden.

**Levels 5 und 6 sind derselbe Mensch**, jung und alt. Das steht schon im Übergangskonzept: „5 → 6:
Kein Wechsel. Das Bild bleibt, nur die Zeit läuft weiter."

---

## 1 · Gras — Morgen auf einer Lichtung

**Situation.** Ein Halm wächst zwischen Steinen. Über ihm zieht der Morgen. Etwas Großes,
Weiches senkt sich und reißt Gras ab — ein Zebra. Ein schnelles, warmes Etwas jagt es fort; für den
Halm ist das die Rettung. Später kommt das Zebra wieder, und diesmal wird der Halm gefressen.

**Replay.** Weit: die Lichtung, das äsende Zebra, im Hintergrund die Löwin. Man sieht beide ganz.

**Echo (10–15 s).** Makro am Boden. Nur der Halm und das Licht; die Masse dahinter unscharf und nie
ganz im Bild.

| Variante | Unterschied | Selektor |
|---|---|---|
| `echo-01-hell` | der Halm über den Clip zum Licht gestreckt, warm durchleuchtet | hoher Anteil Lichtzeit |
| `echo-01-dunkel` | überwiegend im Schatten, kühl und matt | niedriger Anteil |

---

## 2 · Zebra — Mittag auf derselben Lichtung

**Situation.** Ein Zebra äst in der Herde. Es hat Konkurrenz um die guten Stellen. Eine Löwin nähert
sich, reißt zuerst ein anderes Tier, kommt später wieder und holt dieses.

**Replay.** Die Jagd von außen, in ganzer Länge. Man sieht, dass der Halm aus Abschnitt 1 gerade
gefressen wurde.

**Echo (15–20 s).** Bodennah, mitlaufend: Beine im Staub, ein Flankenausschnitt, ein Atemzug. Die
Herde nur als Bewegung im Unscharfen.

| Variante | Unterschied | Selektor |
|---|---|---|
| `echo-02-near` | eng, viele Körper, Staub, Enge | hohe Gruppennähe |
| `echo-02-wide` | weit, ein einzelnes Tier gegen leeren Horizont | niedrige Gruppennähe |

---

## 3 · Löwin — Nachmittag, der lange Rückweg

**Situation.** Die Löwin schleppt die Beute zu ihren Jungen. Hyänen nehmen unterwegs Teile. Sie
kommt nie mit allem an. Ihr eigenes Leben endet später an einem **Zaun mit Scheinwerfern** — die
Grenze eines Menschengebiets. Das ist die Stelle, an der zum ersten Mal Menschen im Spiel
vorkommen.

**Replay.** Der Weg von außen, die Jungen, dann der Zaun und das Licht.

**Echo (20–25 s).** Pfoten im Gras, ein arbeitendes Schulterblatt, die geschleifte Spur. Am Ende
harte senkrechte Linien und ein Licht, das nicht zur Landschaft gehört.

| Variante | Unterschied | Selektor |
|---|---|---|
| `echo-03-warm` | trockenes Gras, tiefe Abendsonne | warme Spur |
| `echo-03-cool` | ausgetrocknetes Flussbett, blaue Stunde | kühle Spur |

---

## 4 · Der Schützende — Nacht, ein brennendes Haus

**Das war bisher offen und ist die Ursache der Verwirrung.** Hier steht es fest:

**Situation.** Ein Haus brennt. Ein Erwachsener bringt ein Kind zur Tür. Von der Decke fallen
brennende Teile. Der Erwachsene stellt sich mit dem eigenen Körper dazwischen, immer wieder, aus
wechselnden Richtungen. Das Kind erreicht die Tür und **kommt hinaus ins Freie. Es lebt.** Der
Erwachsene bleibt im Haus.

Zu den drei Fragen:

- **Wen schütze ich?** Ein Kind, das dir anvertraut ist. Ob eigenes Kind oder nicht, bleibt offen —
  gezeigt wird nur ein Arm und ein Kind, nie eine Familie.
- **Wovor?** Vor herabfallenden brennenden Trümmern. Nichts Symbolisches.
- **Stirbt es, wenn es ins Licht geht?** Nein. **Die Schwelle ist der Ausgang, nicht der Tod.** Das
  Kind wird gerettet; du stirbst. Das ist die Stufe „Opfer" in der Kette des Finales — und der
  Grund, warum es überhaupt einen Abschnitt 5 gibt.

**Replay.** Von außen: das brennende Haus, die Tür, das Kind, das herauskommt, und der, der nicht
mehr herauskommt.

**Echo (25–30 s).** Kamera auf Kindhöhe, vorwärts durch Rauch. Am linken Bildrand ständig ein
erwachsener Unterarm; bei jedem Herabfallen schiebt er sich ins Bild. Dann der helle Türrahmen, der
eigene Schatten geht hindurch, der Arm folgt nicht.

| Variante | Unterschied | Selektor |
|---|---|---|
| `echo-04-heil` | gleichmäßiger Gang, Ärmel unversehrt | `metrics.throughHits` ≤ 4 |
| `echo-04-gezeichnet` | langsamer, Asche auf der Schulter, ein Ärmel versengt | sonst |

---

## 5 · Der Gerettete — Jahre später, zwei Menschen

**Situation.** Das gerettete Kind ist erwachsen. Es lebt mit einem Menschen zusammen. Das Spiel ist
ihr Alltag: **einer ruft den Namen des anderen, der antwortet.** Über den Hof, durch die Wohnung,
vom anderen Zimmer aus. Hunderte kleiner Bestätigungen, dass der andere da ist.

Dann wird der andere krank. Die Antworten kommen später. Dann leiser. Dann gar nicht mehr.
Danach ruft man weiter.

Zu deinen Fragen:

- **Auf welche Rufe reagiere ich?** Auf deinen Namen. Am Anfang rufen drei Menschen; wem du zuerst
  antwortest, mit dem geht das Leben weiter. So wird aus der Mechanik die Wahl.
- **Warum?** Weil genau das Beziehung im Alltag ist — nicht die großen Gesten, sondern die
  verlässliche Antwort.
- **Wie?** In dem Moment, in dem der Ruf ankommt. Nicht früher, nicht später. Die Laufzeit ist
  wörtlich die Zeit, die eine Stimme über eine Entfernung braucht.

**Replay.** Von außen: zwei Menschen in einer Wohnung, das Rufen, die Krankheit, das Ausbleiben.

**Echo (30–40 s).** Nacht über einem Hof. Zwei erleuchtete Fenster. Eines blinkt kurz auf, das
andere antwortet. Dichter, selbstverständlicher. Dann später. Dann schwächer. Dann nicht mehr.
Lange gehalten: das eigene Fenster blinkt weiter ins Dunkel.

| Variante | Unterschied | Selektor |
|---|---|---|
| `echo-05-amber` | warmes Glühlampenlicht drüben | `choices.preferredSignal` = amber |
| `echo-05-violet` | bläulich flackerndes Licht drüben | = violet |
| `echo-05-blue` | eine Kerze drüben | = blue |

---

## 6 · Das Leben — eine Nacht, dieselbe Person, alt

**Situation.** Derselbe Mensch, viele Jahre später. Eine **Nachtschicht in einer Wärmestube** —
ein Saal mit Betten, draußen Kälte. Er geht von einem zum anderen: setzt sich dazu, deckt zu,
bleibt sitzen. Wer Zuwendung bekommen hat, wendet sich später selbst dem Nächsten zu.

Die Kälte kriecht herein, wo niemand ist. Sie ist niemandes Absicht — sie ist einfach das, was
passiert, wenn keiner da ist.

Im Lauf der Nacht wird er langsamer. Am Morgen setzt er sich und steht nicht mehr auf. **Die
Lichter, die er angezündet hat, brennen weiter, ohne ihn.**

Damit stimmen die vier Gesichter des Leids aus der Mechanik mit der Situation überein: einer stirbt
in der Nacht (Verlust), zwei rufen gleichzeitig von zwei Enden des Saals (Endlichkeit), einer liegt
hinter einer verschlossenen Tür (Ohnmacht), einer dreht sich zur Wand (Einsamkeit).

**Replay.** Der Saal von außen, die ganze Nacht im Zeitraffer. Am Ende: er sitzt, und ringsum
brennen die Lichter.

**Echo (30 s).** Nur Hände und Flammen. Eine Hand neigt eine Kerze zur nächsten, die zur
übernächsten. Kein Gesicht. Zum Schluss fährt die Kamera zurück, und die Flammen überstrahlen ins
Weiß — der Anschluss ans Gesamt-Replay.

Das ist das Bild der Osternacht. Es steht hier **nicht** anstelle der Situation, sondern ist der
Ausschnitt daraus, den das Echo zeigt.

| Variante | Unterschied | Selektor |
|---|---|---|
| `echo-06-viele` | das Bild füllt sich mit Flammen, der Saal wird hell | `choices.light` = viele |
| `echo-06-wenige` | wenige Flammen, weit auseinander — aber sie brennen | sonst |

---

## Die Regel für alle Aufnahmen

> **Nie die ganze Gestalt. Kein Gesicht, kein Auge, keine vollständige Figur.**
> Nur Teile, Spuren, Licht und Schatten.

Sie steht schon in den Prompts des Echo-1-Storyboards (*no complete animal, no face, no eye*) und
gilt ab jetzt für alle sechs — **in den Echos**. Im Gesamt-Replay darf mehr zu sehen sein; dort ist
Klarheit ja der Zweck. Der Unterschied zwischen Andeutung und Auflösung ist damit auch ein
Unterschied der Bildsprache.

Gründe: Ein Unterarm gehört jedem, ein Gesicht gehört einem. Hände, Kerzen, Fenster, Rauch und
Türrahmen sind das, was Bildmodelle zuverlässig können; konsistente Gesichter über mehrere
Einstellungen das, was sie am schlechtesten können. Und es entfallen Persönlichkeitsrechte sowie
Kinder in Gefahrensituationen.

## Wiederkehrende Motive als Klammer

| Motiv | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|
| **Licht von außen** | Morgensonne | Mittagslicht | Scheinwerfer | Türrahmen | Fenster | Flamme |
| **Etwas Dunkles, nie ganz sichtbar** | das Zebra | die Löwin | die Hyänen | der Rauch | die Krankheit | die Kälte |
| **Ein Rand, hinter dem etwas bleibt** | Steine | Staubwolke | Zaun | Schwelle | Hof | Tür des Saals |
| **Staub oder Rauch in der Luft** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

## Produktionsreihenfolge

1. **Echo 5** — zwei Fenster bei Nacht, keine Darsteller. Der einfachste Clip und der beste Beleg,
   ob die Regel trägt.
2. **Echo 6** — Kerzen und Hände.
3. **Echo 4** — Rauch und Funken machen die meiste Arbeit.
4. **Echo 2 und 3** — Tieraufnahmen; Archivmaterial oder KI-Erzeugung prüfen, Rechtelage nach
   Abschnitt 16 des Skills, Herkunft dokumentieren.
5. **Echo 1** — liegt als Storyboard vor.
6. **Die Replay-Szenen** zuletzt, wenn alle sechs Situationen im Bild bestätigt sind.

Jede erzeugte Datei bekommt einen Eintrag in `public/assets/PROVENANCE.md` mit Modell, Datum,
Prompt und Job-Kennung. Vor der ersten Veröffentlichung gilt die Rechtsprüfung.

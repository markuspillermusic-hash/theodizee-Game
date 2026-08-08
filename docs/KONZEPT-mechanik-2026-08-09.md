# Überarbeitungsvorschlag Spielmechanik · 2026-08-09

Anlass: Die Level fühlen sich nach Zeit-Absitzen an, nicht nach Mini-Spielen mit einem
nachvollziehbaren, herausfordernden Ziel. Dieses Dokument benennt die Ursache im Code, schlägt ein
verändertes Gerüst vor und beschreibt Level für Level die Folgen.

---

## 1 · Befund

Der Eindruck täuscht nicht. Er hat eine klar lokalisierbare Ursache.

### 1.1 Der Fortschritt ist die Uhr, nicht die Leistung

`TimedLevelScene.advanceLevel()` berechnet den dramaturgischen Fortschritt als

```ts
const progress = Phaser.Math.Clamp(this.elapsedMs / this.storyDurationMs, 0, 1)
```

Alles Erzählerische hängt an diesem Wert. In `Level01State` steuern Schwellen wie `progress >= 0.31`,
`>= 0.43`, `>= 0.77` das Auftauchen der Störung, das schnelle Signal und den Schlussschatten. Der
Schatten kommt also, weil 31 % der Zeit vergangen sind — nicht, weil der Spieler etwas erreicht oder
versäumt hat. Der Spieler ist Zuschauer eines Ablaufs, den er begleitet.

### 1.2 Wo Ziele existieren, sind sie durch ODER-Tore entwertet

`Level02State.updatePhase()` schaltet weiter mit:

```ts
if (this.phase === 0 && (this.foodCollected >= 5 || this.elapsedMs >= 18_000 * scale))
```

Das ist die richtige Absicht — aber der Zeitzweig macht das Leistungsziel folgenlos. Wer nichts tut,
kommt exakt gleich weit, nur ohne Zahl im HUD. Ein Ziel, dessen Verfehlen nichts kostet, ist kein Ziel,
sondern eine Beschriftung.

### 1.3 Es gibt in keinem Level einen Rückschlag

In Level 1 wächst `growth` faktisch monoton: `updateGrowth()` verändert `growth` ausschließlich, wenn
`lightQuality > 0.08`, und dann in Richtung eines Zielwerts, der nur in einem schmalen Zeitfenster
(`sequenceProgress` zwischen 0,31 und 0,43) überhaupt sinken kann. Der Zähler geht praktisch nie
zurück. Damit fehlt die Grundbedingung von Spannung: dass ein Fehler etwas kostet.

### 1.4 Kein Entscheidungszyklus

Das eigene Audit vom 06.08. fordert unter „Übergreifende Chancen“ einen wiederkehrenden 5- bis
15-sekündigen Entscheidungszyklus. Er ist nicht umgesetzt. Level 1 ist eine durchgehende
90-Sekunden-Nachführaufgabe auf einer einzigen Achse: links oder rechts, gedämpft, ohne Zäsur. Es gibt
keinen Moment, in dem man sich für etwas entscheidet und danach sieht, ob es richtig war.

### 1.5 Vorhandene Spannungsquellen bleiben Kulisse

`Level01State.wind` wird in `updateWind()` bewegt und in `drawWorld()` gezeichnet — aber
`updateMovement()` liest den Wind nie. Der sichtbar stärker werdende Sturm hat keine Kraft. Ähnlich in
Level 2: 28 Nährfelder respawnen nach 2,3–4,4 s für fünf Akteure. Es herrscht kein Mangel, also gibt
es trotz vier Konkurrenten keine Konkurrenz.

### 1.6 Die Verhüllung ist inkonsistent

Level 1 bleibt abstrakt („Wachstum“, „Halte die Spitze im Licht“). Level 2 schreibt „Gras sammeln“ ins
HUD und „Sammle 15 Grasfelder“ ins Briefing. Damit ist im zweiten Abschnitt bereits gesagt, dass wir
ein grasfressendes Tier sind — und rückwirkend, was Level 1 war. Die Ebene, die erst das Echo andeuten
und erst das Replay auflösen soll, wird durch eine HUD-Beschriftung vorweggenommen.

### 1.7 Die eigentliche Diagnose

Der Entwurf hat die richtige didaktische Regel — *unvermeidliches Leid darf nicht als Steuerungsversagen
erscheinen* — zu weit verallgemeinert. Aus „der Ausgang ist nicht deine Schuld“ wurde „nichts ist deine
Leistung“. Das kostet nicht nur Spielspaß. Es kostet die Pointe: Wenn im Spiel nie etwas an mir lag,
dann ist die Aussage des Finales — *es lag an dir, nur auf einer Ebene, die du nicht sehen konntest* —
leer. Man kann eine verborgene Wirksamkeit nur enthüllen, wenn es vorher eine sichtbare gab.

---

## 2 · Die drei Ebenen, die derzeit zusammenfallen

| Ebene | Frage | Soll gesteuert werden von | Ist gesteuert von |
|---|---|---|---|
| **Spielziel** | Was will ich erreichen? | Können des Spielers | — existiert kaum |
| **Erzählausgang** | Was passiert der Figur? | Feststehende Dramaturgie | Uhr |
| **Schnitt** | Wann endet der Abschnitt? | Zielerreichung | Uhr |

Der gesamte Vorschlag besteht darin, diese drei zu entkoppeln:

> **Du kannst dein Ziel verfehlen. Das Verfehlen ändert nicht, ob die Figur stirbt — es ändert, wie
> viel sie erreicht hat, bevor sie stirbt.**

Das ist gleichzeitig besseres Spieldesign und die schärfere theologische Aussage. Die Theodizeefrage
lautet nicht „warum kann ich nichts tun“, sondern „warum trifft Leid auch den, der alles richtig
gemacht hat“. Die zweite Frage kann das Spiel nur stellen, wenn man vorher etwas richtig machen konnte.

---

## 3 · Die härteste Designgrenze: die Unterrichtssituation

Bevor Mechaniken: Wer spielt eigentlich?

Pro Abschnitt eine andere Person, am Beamer, vor der Klasse, ohne Übungsdurchgang, mit etwa fünf
Sekunden Zeit, die Steuerung zu begreifen, unter sozialem Druck. Daraus folgen drei nicht
verhandelbare Regeln:

1. **In drei Sekunden lesbar.** Ein Satz, eine Zahl, ein sichtbares Ziel. Keine zweite Regel, die erst
   nach 20 Sekunden erklärt wird.
2. **Leicht zu verstehen, schwer gut zu machen.** Nicht „schwer zu schaffen“. Das Modell ist die
   Jahrmarktsbude: Jeder trifft irgendwas, wenige treffen viel.
3. **Bewertung in Stufen statt bestanden/durchgefallen.** Niemand steht vor der Klasse als der, der
   verloren hat. Es gibt *knapp*, *solide*, *stark* — und alle drei führen weiter.

Das ist kein Kompromiss gegenüber „echten Mini-Spielen“. Es ist die Beschreibung guter Mini-Spiele.

---

## 4 · Gerüst: Soll · Puffer · Güte · Schnitt

Ein gemeinsames Muster für alle sechs Level. Technisch eine Geschwisterklasse zu `TimedLevelScene`
(Arbeitsname `GoalLevelScene`); die Architektur aus `GameServices`, Telemetrie, Hilfestufen und
Lehrersteuerung bleibt unverändert.

**Soll** — eine Zahl, vor dem Start genannt, dauerhaft im HUD. „12 von 12“. Nicht Prozent, sondern
zählbare Einheiten: Fortschritt muss als Ereignis erlebbar sein, nicht als Balken.

**Puffer** — eine zweite Ressource, die durch Fehler sinkt (Substanz, Energie, Klarheit, Vertrauen).
Sichtbar, klein gehalten, regenerierbar.

**Rückschlag statt Niederlage** — Puffer leer bedeutet: Verlust am Soll (etwa −2 Einheiten), kurze
Erschütterung, weiterspielen. Nie Bildschirmtod, nie Neustart. Die Regel „keine Niederlage“ bleibt
gewahrt; sie gilt jetzt nur noch für das Ende, nicht mehr für den Weg dorthin.

**Schnitt durch Zielerreichung** — der Erzählausgang beginnt, **wenn das Soll erreicht ist**. Die Uhr
bleibt nur als Notbremse bei etwa 150 % der Sollzeit, und sie greift nicht durch Abbruch, sondern
indem Hilfestufe 3 automatisch einsetzt und das Soll auf den erreichten Stand abgesenkt wird. Wer gut
spielt, ist in 45 Sekunden fertig; wer schwach spielt, in 80. Das ist die Umkehrung des heutigen
Zustands, in dem gutes Spiel exakt gleich lange dauert wie gar keins.

**Güte in drei Stufen** — aus Restpuffer, Zeit und Rückschlägen wird *knapp / solide / stark*
abgeleitet. Dieser Wert ersetzt die heutige, rein kosmetische Echo-Variantenwahl in
`ReplayDirector.select()` und wird zusätzlich zum Kopplungswert des nächsten Levels (Abschnitt 5).

**Entscheidungszyklus** — jedes Level bekommt einen 8- bis 12-Sekunden-Takt, in dem eine sichtbare
Alternative auftaucht, gewählt wird und die Folge erscheint. Das ist der Unterschied zwischen einer
Aufgabe und einer Nachführübung.

---

## 5 · Der eigentliche Hebel: die Kette

Das ist der Teil, der die Meta-Ebene trägt.

Heute wirkt Telemetrie nur auf die Wahl einer Echo-Variante — also auf Bilder, nicht auf Spiel. Der
Vorschlag: **die Güte eines Levels verändert die Welt des nächsten Levels.**

- Level 1 (Halm, Wachstum) → Verteilung und Größe der Nährfelder in Level 2
- Level 2 (Herde, Energie) → Zahl und Kraft der Versorgungspulse in Level 3
- Level 3 (Versorgung) → Belastbarkeit des vertrauten Signals in Level 4
- Level 4 (Weg) → Ausgangsvertrauen der Beziehungssignale in Level 5
- Level 5 (Bindung) → Dichte und Klarheit der Erinnerungsmuster in Level 6

Die spielende Person in Level 3 weiß nicht, warum ihre Welt so aussieht. Sie war es nicht. Es war die
Person zwei Abschnitte vorher. Erst das Replay zeigt die Kette.

**Zwei Bedingungen, ohne die das schadet:**

**(a) Die Kopplung verändert Charakter, nicht Schwierigkeit.** Schwaches Level 1 darf Level 2 nicht
härter machen — sonst kaskadiert eine schwache erste Runde in eine frustrierte Klasse, und der
Vorwurf, das Spiel bestrafe, wäre berechtigt. Konkret: schwaches Level 1 ergibt *wenige große*
Nährfelder (mehr Weg, gleicher Ertrag), starkes Level 1 *viele kleine* (kürzere Wege, mehr Zäsuren).
Erwartungswert gleich, Aussehen und Rhythmus verschieden — und im Replay eindeutig zuzuordnen.

**(b) Die Kette darf nicht zur Belohnungslogik werden.** „Gras hat sich angestrengt, deshalb ging es
dem Zebra gut“ wäre exakt die Rechtfertigungsfigur, die `LEVEL_DESIGN.md` ausdrücklich nicht behaupten
will. Die Kopplung sagt deshalb nicht *besser oder schlechter*, sondern *anders*. Das Replay zeigt
Zusammenhang, nicht Vergeltung.

Der Gewinn ist erheblich: Die Behauptung des Finales — dein Handeln hatte eine Bedeutung, die du in
deinem Ausschnitt nicht sehen konntest — ist dann keine Botschaft, die das Spiel dem Publikum sagt,
sondern eine Tatsache, die die Klasse am eigenen Durchlauf überprüfen kann. Der Unterschied zwischen
Behauptung und Nachweis ist genau der Unterschied, den ein Gedankenexperiment im Religionsunterricht
braucht.

---

## 6 · Level für Level

### Level 1 · Bleibe — kürzen und physikalisieren

*Problem:* 78–105 Sekunden eindimensionale Nachführung ohne Zäsur und ohne Kosten. Der schwächste
Abschnitt steht an der schlechtesten Stelle: ganz vorn.

*Vorschlag:* Die Achse bleibt eindimensional — Verwurzelung ist die Aussage dieses Levels, freie
Bewegung wäre falsch. Stattdessen bekommt sie Physik und Takt.

- **Wind wird Kraft.** Die bereits existierenden Partikel wirken auf `velocity`. Böen kommen in
  Wellen von 8–12 Sekunden mit sichtbarer Vorwarnung (Partikel verdichten sich, Ton zieht an). Das
  ist der Entscheidungszyklus: früh gegenhalten oder nachgeben und danach zurückholen.
- **Soll: 12 Lichtstunden.** Jede vollständige Sekunde im hellen Kern ergibt eine Marke, sichtbar als
  Ring am Halm. Zählbar, nicht prozentual.
- **Puffer: Substanz.** Außerhalb des Lichts sinkt sie. Bei null bricht ein Ring — sichtbarer,
  hörbarer, schmerzhafter Rückschlag, aber kein Ende.
- **Das Licht wird enger, je länger man wächst.** Steigende Schwierigkeit statt gleichbleibender.
- **Dauer: Soll bei ~45 s erreichbar, Notbremse bei 80 s.** Statt heute 78–105 s.

### Level 2 · Folge — Mangel herstellen

*Problem:* Ziel durch ODER-Tor entwertet, keine Ressourcenknappheit, Konkurrenten ohne Biss.

*Vorschlag:*

- **Respawn deutlich verlangsamen** und die Feldzahl senken. Erst wenn Gras knapp ist, ist ein
  Konkurrent ein Konkurrent.
- **Die ODER-Tore fallen.** Phasenwechsel nur noch über `foodCollected`. Die Uhr bleibt Notbremse.
- **Sichtbarer Wettbewerb.** Die vier anderen bekommen einen lesbaren Punktestand. Die Frage jedes
  Zyklus lautet: das nahe Feld sichern oder dem Konkurrenten das bessere wegnehmen?
- **Der Sprint bekommt Kosten und Nutzen.** Er existiert bereits (`justActionDown`, −0,09 Energie);
  bei knappem Gras wird er zur echten Entscheidung statt zur Verzierung.
- **Beschriftung entliteralisieren:** „Gras sammeln“ → „Aufnehmen“. Siehe Abschnitt 7.

### Level 3 · Versorge — zwei Bedürfnisse, eine Kraft

*Vorschlag:* Aus der Spur wird ein Verteilungsproblem. **Zwei** Empfänger mit unterschiedlichem
Bedarf, eine begrenzte Tragkraft, ein Risikofeld auf dem kurzen Weg. Soll: sechs erfolgreiche
Versorgungen. Puffer: die getragene Ressource, die im Risikofeld schwindet. Der Zyklus ist die
wiederkehrende Frage *kurz und riskant oder lang und sicher* — mit sichtbar unterschiedlichem Ergebnis
statt kosmetischer Variante. Dass man nie beide vollständig versorgen kann, ist die Aussage des
Abschnitts und muss mechanisch stimmen, nicht nur behauptet sein.

### Level 4 · Bewahre — Sicht als Ressource

*Vorschlag:* Klarheit wird zum Puffer und ist ausdrücklich *ausgabefähig*: Nähe zum vertrauten Signal
stellt sie wieder her, kostet aber Weg. Soll: fünf Etappenmarken. Der Zyklus ist die wiederkehrende
Wahl zwischen Vorankommen und Auftanken — eine Entscheidung, die man in acht Sekunden versteht und in
acht Sekunden bereut. Rauchkontakt kostet eine Etappenmarke zurück.

### Level 5 · Verbinde — der Rhythmus wird zum Können

*Vorschlag:* Das Antwortfenster existiert bereits und ist die beste vorhandene Mechanik im ganzen
Spiel. Sie ist nur folgenlos. Also: **Serie zählt.** Soll: eine Folge von acht Treffern. Fehlschlag
setzt die Serie zurück, nicht das Level. Das Muster wird schneller und unregelmäßiger. In der
Verlustphase bleibt die Rhythmusmechanik erhalten, aber die Antwort kommt zunehmend verspätet und
schließlich gar nicht zurück — der Spieler spielt weiter richtig und es wirkt trotzdem nicht mehr. Das
ist der Kern des ganzen Spiels und muss der Moment sein, an dem die Steuerung selbst die Erfahrung
trägt. Heute wird er erzählt; er sollte gespielt werden.

### Level 6 · Lass los — Ziel wird Erinnerung

*Vorschlag:* Die Zweiteilung bleibt richtig. Der aktive erste Teil bekommt ein zählbares Soll: sieben
Erinnerungsmuster. Der Kontrollabbau greift danach härter — Eingabeverzögerung, driftende Achsen,
schrumpfendes Sichtfeld. Wer noch nicht alle sieben hat, spürt, wie das Erreichbare kleiner wird als
das Gewollte. Es gibt keinen Rückschlag mehr; das ist die Aussage. Kein Puffer, kein Ausgleich, nur
Ruhe als Ausgang.

---

## 7 · Sprachregel für die Verhüllung

Eine Regel, die alle sechs Level bindet:

> Im HUD, im Briefing und in jeder Anweisung stehen ausschließlich **Verben und Mengen**, niemals
> **Wesen und Stoffe**.

„Aufnehmen · 7 von 15“ statt „Gras sammeln“. „Antworten · Serie 5“ statt „Beziehung“. Das ist keine
Verschleierung, sondern die Bedingung dafür, dass Echo und Replay überhaupt etwas aufdecken können.
Der Nebeneffekt ist ein besseres HUD: Verben sind kürzer und in drei Sekunden lesbar.

---

## 8 · Was die Echos leisten müssen

Heute zeigt das Echo dieselbe Szene realistisch von außen. Das deckt die Identität auf, deutet aber
keine Meta-Ebene an. Vorschlag: **jedes Echo endet mit einer Spur, die im nächsten Level mechanisch
wiederkehrt** — das gefressene Feld, der fortgetragene Körper, die verlassene Schwelle. Nicht als
Symbol, sondern als dasselbe Objekt.

Der Zuschauer sieht am Ende von Echo 2 etwas, das er in Level 3 wiedersieht, ohne zu wissen, warum es
dort ist. Das ist die Ahnung, die das Replay dann einlöst. Die Echos behaupten nichts; sie legen aus.

---

## 9 · Was das Replay dadurch gewinnt

Das Replay muss dann nicht mehr fünf Akte lang eine These illustrieren. Es kann etwas Stärkeres:
**die Kette rückwärts vorführen.** Sechs Zahlen, sechs Welten, eine Linie. „Diese Nährfelder standen
so, weil vier Minuten vorher jemand anders im Licht geblieben ist.“

Für das Unterrichtsgespräch ist das ein anderer Gegenstand. Nicht „das Spiel sagt, alles habe einen
Sinn“, sondern „wir haben eine Wirkung erzeugt, die keiner von uns im eigenen Ausschnitt sehen konnte
— und die Frage ist, ob man daraus etwas über die Wirklichkeit folgern darf oder nicht“. Die zweite
Fassung ist diskutierbar. Die erste ist es nicht.

---

## 10 · Risiken, offen benannt

- **Die Kette kann als Vergeltungslogik missverstanden werden.** Abschnitt 5(b) ist keine Feinheit,
  sondern trägt die theologische Zulässigkeit des ganzen Entwurfs. Wenn sich Kopplung „als
  Belohnung“ liest, muss sie zurückgebaut werden.
- **Echte Ziele erzeugen echtes Verfehlen vor der Klasse.** Deshalb Stufen statt bestanden, deshalb
  Rückschlag statt Tod, deshalb automatische Hilfestufe 3 statt Abbruch. Das muss im ersten
  Klassentest gezielt beobachtet werden.
- **Kürzere Level bei gleicher Gesamtzeit** verschieben Zeit vom Spiel zu Echos und Gespräch. Das
  halte ich für richtig, es ist aber eine Entscheidung, keine Nebenwirkung.
- **Der Aufwand ist real.** Betroffen sind sechs Level-States, ein neues Szenen-Gerüst, der
  `ReplayDirector` und das Finale. Nicht betroffen sind `GameServices`, Audio, Video, Telemetrie,
  Lehrersteuerung, Build und Offline-Fassung. Es ist eine Überarbeitung der Spiellogik, kein
  Architekturumbau.

---

## 11 · Vorgeschlagene Reihenfolge

1. **`GoalLevelScene`** mit Soll, Puffer, Rückschlag, Gütestufen und zielgetriebenem Schnitt.
2. **Level 1 und Level 5 umbauen.** Das schwächste und das stärkste Level. Wenn diese beiden nach
   dem Umbau als Mini-Spiele funktionieren, trägt das Gerüst; wenn nicht, ist wenig verloren.
3. **Entscheidung an dieser Stelle** — vor dem Rest.
4. Level 2, 3, 4, 6 nachziehen.
5. Kette und Sprachregel durchsetzen.
6. Echo-Spuren und Replay als Kettenauflösung.
7. Erst danach die endgültigen Filmmedien. Sie an eine Mechanik zu binden, die sich noch ändert,
   wäre teure Doppelarbeit.

Schritt 1 und 2 sind der eigentliche Test dieses Vorschlags. Alles Weitere hängt davon ab, ob sich
Level 1 danach spielt wie ein Spiel.

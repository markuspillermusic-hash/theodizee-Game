# Entwicklung und Kreislauf · Neuentwurf der Minispiele · 2026-08-09

Ausgangspunkt ist diesmal nicht die vorhandene Mechanik, sondern die Projektidee. Erst danach
folgt der Abgleich mit der bestehenden Fassung und die Umbauempfehlung.

---

## 1 · Was das Spiel eigentlich behauptet

Die Idee steht ausformuliert im Spiel selbst und im Jahresverlaufsplan.

Im dritten Akt des Gesamt-Replays:

> Energie → Leben → Fürsorge → Schutz → Opfer → Beziehung → Liebe

Im Schlussbild:

> Du hast immer nur einen Ausschnitt gesehen.

Und im Jahresverlaufsplan, Block D, Stunde 9 bis 10: **Hicks soul-making gegen Metz' Compassion.**
Hick begründet Leid als Bedingung von Reifung; Metz verweigert genau diese Verrechnung.

Daraus ergibt sich die doppelte Bewegung, die das Spiel trägt:

**Entwicklung.** Von Stufe zu Stufe wächst die Fähigkeit — und mit ihr die Verletzlichkeit. Gras
kann nicht verlieren, weil es nichts hat. Ein Mensch kann alles verlieren, weil er lieben kann.
Höhere Güter setzen die Möglichkeit tieferen Leids voraus. Das ist Hicks Position, und sie ist die
spielbare These.

**Kreislauf.** Was auf einer Stufe endet, ist die Bedingung der nächsten. Das Gras wird gefressen und
ist dadurch die Kraft des Zebras. Das Zebra wird gerissen und ist dadurch das Überleben der
Löwenjungen. Kein Ende ist folgenlos, aber auch keines wird dadurch ungeschehen.

Beides zusammen ist das Spiel. Beides zusammen fehlt der jetzigen Fassung.

---

## 2 · Warum die jetzige Fassung nicht abholt

Die Diagnose liegt nicht bei den einzelnen Minispielen. Sie liegt eine Ebene darüber.

### 2.1 Sechs Steuerungen statt einer, die wächst

Jedes Level bringt ein neues Bedienkonzept mit: eine Achse, dann freie Bewegung, dann Fähren, dann
Etappen, dann ein Taktring, dann Stillhalten. Der Spieler lernt sechsmal etwas Neues und **nimmt
nichts mit**. Damit findet die Entwicklung ausschließlich in der Fiktion statt und nie in den
Händen. Wer nichts angesammelt hat, kann am Ende auch nichts verlieren — und genau der Verlust ist
die Pointe.

### 2.2 Der Kreislauf wird behauptet, nicht gespielt

Jedes Level endet mit `cameras.main.fadeOut()` und `scene.start(next)`. Der Tod ist ein **Schnitt**.
Danach beginnt eine neue Welt mit neuen Regeln und einem neuen Briefing. Dass die eine Existenz in
die andere übergeht, sagt erst das Replay — vier Abschnitte später, als Text. Ein Kreislauf, den man
nur erzählt bekommt, ist kein Kreislauf, sondern eine Behauptung.

### 2.3 Die Ziele sind Aufgaben, keine Anliegen

„Sammle 7 Etappen", „triff 8 Pulse", „versorge 8-mal" sind Zähler. Sie sind messbar und fair — das
war der Fortschritt von Version 2 — aber sie sind nicht **wichtig**. Niemand fiebert einem Zähler
entgegen. Man fiebert mit, wenn etwas auf dem Spiel steht, das man nicht ersetzen kann.

Das ist der Grund, warum das Spiel dich nicht abholt: Es fehlt in fünf von sechs Abschnitten ein
Gegenüber, dem es schlechter geht, wenn man schlecht spielt.

---

## 3 · Leitidee: ein Verb, das wächst — und wieder abgegeben wird

Statt sechs Mechaniken **eine Steuerung mit sechs Schichten**. Jede Stufe legt genau eine Schicht
dazu. Level 6 nimmt sie in umgekehrter Reihenfolge wieder weg.

| Stufe | Neue Schicht | Was sie kann | Was sie dadurch verlieren kann |
|---|---|---|---|
| 1 · Gras | **Ausrichten** | sich dem zuwenden, was gibt | nur sich selbst |
| 2 · Zebra | **Bewegen** | suchen, fliehen | den eigenen Körper |
| 3 · Löwin | **Tragen** | etwas für andere holen | das Anvertraute |
| 4 · Mensch, Kind | **Abschirmen** | sich dazwischenstellen | den, den man schützt |
| 5 · Mensch, Bindung | **Antworten** | wechselseitig, im Takt | das Gegenüber |
| 6 · Mensch, Ende | — | alles Gelernte | alles, in umgekehrter Reihenfolge |

Der letzte Satz ist der wichtigste des ganzen Entwurfs: **Was zuletzt gelernt wurde, geht zuerst
verloren. Was am Anfang stand, bleibt am längsten.** Im letzten Moment von Level 6 kann man nur noch
eines — sich ausrichten. Auf eine Lichtquelle. Auf dieselbe wie in Level 1.

Damit schließt sich der Kreis buchstäblich in der Steuerung, und das Schlussbild braucht keinen
erklärenden Satz mehr.

---

## 4 · Der Kreislauf als Mechanik: Übergänge ohne Schnitt

Die sechs Level werden durch **fünf nahtlose Übergänge** verbunden. Kein Fade, kein Briefing, keine
Zäsur — die Kamera bleibt, wo sie ist, und folgt der Energie.

| Übergang | Was der Spieler sieht | Was er in der Hand behält |
|---|---|---|
| 1 → 2 | Der Halm wird abgerissen. Die Kamera folgt ihm ins Maul. Das Bild weitet sich. | Die Taste bleibt gedrückt; die Form darunter wechselt |
| 2 → 3 | Der eigene Körper wird fortgetragen. Die Kamera bleibt am Körper, nicht am Spieler. | Man ist plötzlich der, der trägt |
| 3 → 4 | Die Nahrung erreicht die Jungen. Eines davon wird zum Bild, das bleibt. | Man ist das Junge |
| 4 → 5 | Der Geschützte kommt durch die Schwelle. Die Kamera geht mit ihm, nicht mit dem Schützenden. | Man ist der Gerettete |
| 5 → 6 | Der Ruf bleibt unbeantwortet. Das Bild bleibt. | Nichts wechselt — nur die Zeit |

Der Effekt: Der Spieler erlebt jeden Tod **von innen und danach von außen**, ohne dass es erklärt
wird. Wer eben noch das Gras war, kaut jetzt darauf. Das ist der Kreislauf, gespielt statt behauptet
— und es ist der Moment, in dem eine Klasse still wird.

**Technisch:** Die Übergänge sind eigene kurze Szenen (5 bis 8 Sekunden) ohne Ziel und ohne HUD.
Sie ersetzen die heutigen Fades. Die Echos bleiben, wo sie sind — sie deuten weiterhin die Identität
an; der Übergang zeigt nur die Kette.

---

## 5 · Die sechs Minispiele

Jedes folgt derselben Regel: **ein Verb, ein Gegenüber, ein Widerstand, ein 8- bis 12-Sekunden-Takt.**

### Level 1 · Bleibe — „Die Wellen fangen"

*Verb: Ausrichten. Gegenüber: noch keines — das ist der Punkt.*

Statt 60 Sekunden Nachführung im wandernden Licht: Das Licht kommt in **Wellen**. Wolken ziehen; alle
7 bis 9 Sekunden öffnet sich ein heller Streifen an einer vorhersehbaren Stelle und wandert durch.
Wer rechtzeitig dort steht und die Welle **vollständig** mitnimmt, setzt einen sichtbaren **Knoten**
an den Halm. Soll: 6 Knoten.

Der Wind — heute reine Dekoration, siehe `Level01State.updateWind()` — wird zur Kraft und macht das
Halten zur Aufgabe. Der Schatten nimmt nicht das Wachstum, sondern die **laufende Welle**.

Warum das besser ist: Antizipation statt Dauertracking. Man sieht die nächste Welle kommen und
entscheidet sich, statt permanent zu korrigieren. Und es beendet die Länge, die dir aufgefallen ist:
6 Wellen × 8 Sekunden ≈ 50 Sekunden mit Spannungsspitzen statt 90 Sekunden Gleichmaß.

### Level 2 · Folge — bleibt

Du findest es gut, und es ist das einzige Level mit echter Konkurrenz. Zwei Änderungen:
Die Startenergie ist das, was Level 1 gewachsen ist. Und die Grasfelder **sind** die Halme aus Level 1
— dieselbe Form, dieselbe Knotenzahl.

### Level 3 · Versorge — „Heimbringen"

*Verb: + Tragen. Gegenüber: die Jungen.*

Die heutige Fähren-Schleife (achtmal derselbe Weg) ist der Kern des Problems: Wiederholung ohne
Steigerung. Ersatz: **ein einziger langer Rückweg mit einer schweren Last.**

Man zieht die Beute über eine Strecke. Sie ist schwer, man ist langsam. In Wellen nähern sich
Konkurrenten. Pro Welle eine Entscheidung: **stehenbleiben und verteidigen** (kostet Zeit, und die
Jungen warten) oder **weiterziehen** (kostet ein Stück der Last). Beides ist legitim, beides kostet.

Soll: so viel wie möglich nach Hause bringen — messbar in dem, was die Jungen am Ende haben. Kein
Zähler von acht identischen Wegen, sondern eine einzige Kurve, die abfällt und die man
verlangsamen kann.

Das ist auch inhaltlich richtig: Fürsorge ist keine Serie erledigter Aufgaben, sondern der Versuch,
Verlust zu begrenzen.

### Level 4 · Bewahre — „Dazwischen"

*Verb: + Abschirmen. Gegenüber: der, den man schützt.*

Dein Befund stimmt: Punkte einsammeln in unsichtbarem Rauch. Der Abschnitt hat kein Gegenüber und
deshalb keine Dringlichkeit. Vollständiger Ersatz:

**Du sammelst nichts. Du gehst nicht einmal selbst zum Ausgang.** Ein Schutzbefohlener geht von
allein, langsam, geradeaus. Von den Seiten kommen in Wellen Glut, Rauch und herabfallende Teile —
sichtbar angekündigt, mit Vorwarnzeit. Deine einzige Aufgabe ist, deinen Körper dazwischen zu
bringen. Jeder Treffer, den du nimmst, kostet **dich**. Jeder Treffer, den du durchlässt, kostet
**ihn**.

Soll: ihn bis zur Schwelle bringen — bewertet daran, wie viel er noch hat, nicht wie viel du hast.
Am Ende geht er hindurch und du bleibst zurück.

Das ist in drei Sekunden verstanden („stell dich dazwischen"), schwer gut zu machen (Wellen von
mehreren Seiten, man kann nicht überall sein) und es ist die **Umkehrung von Level 3**: dort hat man
etwas geholt, hier gibt man etwas her. Genau das ist die Entwicklung.

### Level 5 · Verbinde — „Zuruf und Antwort"

*Verb: + Antworten. Gegenüber: der andere Mensch.*

Deine Frage — *wann genau soll man drücken?* — ist keine Verständnisfrage, sondern ein Designfehler.
Der Ring schrumpft von außen nach innen, aber gültig ist der Druck sowohl **kurz nach dem Neustart
des Rings** als auch **kurz vor seinem Zusammenfallen** (`beatPhase < window || beatPhase > 1 - window`
in `Level05State.updateRhythm`). Zwei getrennte richtige Momente, dazwischen falsch. Das kann niemand
lesen.

Ersatz mit räumlichem statt abstraktem Takt: **Der Ruf reist sichtbar.** Vom Gegenüber löst sich eine
Welle und läuft durch den Raum auf dich zu. Du antwortest in dem Moment, in dem sie **dich erreicht**.
Kein Fenster, das man auswendig lernen muss — ein Ereignis, das ankommt. Wer näher steht, bekommt
schnellere Folgen; Nähe ist damit selbst eine Entscheidung.

Soll: ein gemeinsames Muster über 8 Wechsel. Danach kommen die Rufe unregelmäßig, dann schwächer,
dann gar nicht mehr. **Du kannst weiter rufen. Es kommt nichts zurück.** Die Steuerung bleibt bis zum
Schluss dieselbe und funktioniert einwandfrei — nur das Gegenüber ist weg.

Das ersetzt die heutigen „drei Rettungszonen", die man durch bloßes Herumlaufen erfüllt, durch den
einen Moment, der den ganzen Abschnitt trägt.

### Level 6 · Lass los — „Rückwärts"

*Verb: keines mehr. Gegenüber: alles Bisherige.*

Deine zweite Beobachtung — *welche Objekte sind eigentlich vertraute Muster?* — trifft einen echten
Mangel: Die drei Formen sind abstrakte Kreise und Rauten ohne Bezug. Ersatz:

Die Muster sind **buchstäblich die Dinge aus den vorigen Leveln**: der Lichtstreifen aus 1, ein
Grasfeld aus 2, die Last aus 3, der Geschützte aus 4, die Rufwelle aus 5. Fünf Muster, jedes sofort
wiedererkennbar. Wer aufmerksam gespielt hat, weiß ohne ein Wort, was gemeint ist.

Und der Abbau ist nicht mehr ein Zahlenwert, sondern das Abgeben der Schichten in umgekehrter
Reihenfolge:

1. **Antworten** erlischt — die Taste tut nichts mehr.
2. **Abschirmen** erlischt — man kann sich nicht mehr dazwischenstellen.
3. **Tragen** erlischt — was man hält, gleitet weg.
4. **Bewegen** erlischt — es bleibt nur noch die Richtung.
5. **Ausrichten** bleibt. Ein Licht erscheint. Man wendet sich ihm zu. Ende.

Der Schluss ist damit keine Stillhalte-Prüfung, sondern die letzte mögliche Handlung — und es ist
dieselbe, die im ersten Level die erste war.

---

## 6 · Abgleich mit der bestehenden Fassung

| Bestandteil | Bewertung |
|---|---|
| `GameServices`, Audio, Video, Telemetrie, Speicherung | **bleibt vollständig** |
| Lehrersteuerung, Hilfestufen, Debugoverlay, Build, Offlinefassung | **bleibt vollständig** |
| `GoalTracker` (Soll · Puffer · Rückschlag · Güte) | **bleibt** und passt unverändert auf alle sechs Entwürfe |
| `TimedLevelScene` samt Notbremse | **bleibt** |
| Echos 1 bis 5 und ihre Auswahlbedingungen | **bleiben**; ergänzt um die Übergänge |
| Level 2 · Folge | **bleibt**, zwei kleine Anschlüsse |
| Level 1 · Wachstumslogik | **umgebaut** zu Wellen; Wind wird wirksam |
| Level 3 · Fähren-Schleife | **entfällt**, ersetzt durch den einen Rückweg |
| Level 4 · Etappen und Klarheitsökonomie | **entfällt vollständig**, ersetzt durch Abschirmen |
| Level 5 · Taktring | **entfällt**, ersetzt durch die reisende Welle; Serienlogik bleibt |
| Level 6 · Stillhalten und abstrakte Muster | **entfällt**, ersetzt durch rückwärtigen Schichtabbau |
| Fades zwischen den Leveln | **entfallen**, ersetzt durch fünf Übergangsszenen |
| Neu nötig | `LayerManager` (welche Schicht ist aktiv), fünf Übergangsszenen, Kopplungswerte |

Die Architekturarbeit aus Version 2 ist also nicht verloren. Was ersetzt wird, sind die
Level-Innenleben — und dort vor allem das, was du selbst als zu leicht, unverständlich oder
langatmig erlebt hast.

---

## 7 · Ein theologischer Einwand, den ich benennen muss

Der Entwurf macht Hicks soul-making **spielbar** — und damit überzeugend. Das ist ein Problem, denn
im Jahresverlaufsplan steht Hick nicht allein, sondern ausdrücklich **im Streit mit Metz**, der die
Kompensationslogik verweigert. Direkt davor steht Iwan Karamasow, der die Eintrittskarte zurückgibt,
und Psalm 88, der einzige ohne Wendung zum Guten.

Ein Spiel, das am Ende sagt „Nichts geht im Ganzen verloren" — so lautet heute der fünfte Akt des
Replays — hat die Frage entschieden, bevor die Klasse sie diskutiert. Es steht dann auf Hicks Seite,
und Metz kommt im Unterrichtsgespräch nur noch als Widerspruch gegen ein Erlebnis vor. Das ist
didaktisch unfair verteilt.

**Empfehlung:** Das Schlussbild bleibt offen. Der fünfte Akt zeigt die Kette weiterhin — aber die
letzte Aussage lautet nicht, dass nichts verloren geht, sondern stellt beides nebeneinander: was
sichtbar geworden ist, und was trotzdem verloren blieb. Konkret bietet sich an, das Gesicht der
Stufe, die man selbst gespielt hat, am Ende **nicht** in das Gesamtbild aufzulösen, sondern daneben
stehen zu lassen. Dann hat die Klasse zwei Bilder statt einer Botschaft — und Metz hat eine Chance.

Das kostet nichts an Wirkung. Es verschiebt sie nur von der Antwort zur Frage, und das ist die
Aufgabe von Block D.

---

## 8 · Umbauempfehlung

**Zuerst ein Tragfähigkeitstest, kein Durchmarsch.** Zwei Level plus ein Übergang, dann Entscheidung:

1. **Level 4 · „Dazwischen"** — das Level, das dich am wenigsten gefordert hat, mit der stärksten
   neuen Idee. Wenn Abschirmen funktioniert, funktioniert das Prinzip „Gegenüber statt Zähler".
2. **Level 5 · „Zuruf und Antwort"** — der Abschnitt, der den emotionalen Kern trägt und heute an
   einem lesbaren Taktfenster scheitert.
3. **Der Übergang 4 → 5 ohne Schnitt** — der Prüfstein für den Kreislauf. Wenn dieser Moment nicht
   trägt, trägt die ganze Idee nicht, und wir wissen es nach zwei Leveln statt nach sechs.

Danach entscheidest du. Erst dann Level 1, 3, 6 und die übrigen Übergänge. Die endgültigen Filmmedien
bleiben weiterhin ganz am Ende — sie an eine Mechanik zu binden, die sich noch bewegt, wäre teure
Doppelarbeit.

**Aufwand, ehrlich geschätzt:** Schritt 1 bis 3 ist ungefähr so viel Arbeit wie die gesamte Version 2.
Der vollständige Umbau ist etwa das Doppelte. Nicht betroffen ist die Infrastruktur.

---

## 9 · Sofortkorrekturen, unabhängig vom Umbau

Drei deiner vier Beobachtungen sind Fehler, keine Geschmacksfragen. Sie werden sofort behoben, damit
die aktuelle Fassung überhaupt beurteilbar bleibt:

- **Level 6, Ruhe wird nicht registriert:** Die Abdrift hält die Geschwindigkeit dauerhaft über der
  Schwelle von 0,35, ab der die Eingabe als „aktiv" gilt. Im Beharrungszustand liegt sie bei
  0,41 × Abbau — bei vollem Abbau also immer darüber. Die Ruhephase ist dadurch **nicht gewinnbar**;
  das Level endet nur über die Notbremse.
- **Level 5, unklarer Auslösezeitpunkt:** zwei getrennte gültige Fenster pro Takt. Wird auf ein
  einziges Fenster am Zusammenfallen des Rings reduziert.
- **Level 4, keine sichtbare Verdunklung:** Rauch und Schleier liegen bei Alpha 0,10 bis 0,21 auf
  fast schwarzem Grund und sind praktisch unsichtbar. Wer die Gefahr nicht sieht, weicht ihr nicht
  aus — und merkt auch nichts vom Verlust.
- **Level 1, Länge nach dem Schatten:** Der Rest hängt an einem Wachstumswert, der bei perfektem
  Lichtkontakt rund 60 Sekunden braucht. Wird auf etwa die Hälfte gekürzt.

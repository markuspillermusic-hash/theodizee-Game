import Phaser from 'phaser'
import { ObjectiveHud } from '../components/ObjectiveHud'
import { GAME_HEIGHT, GAME_WIDTH } from '../config/gameConfig'
import { levels } from '../config/levels'
import { GoalTracker } from '../systems/GoalTracker'
import type { AssistanceLevel, Direction, LevelResult } from '../types'
import { TimedLevelScene } from './TimedLevelScene'
import { dust, glow, ground, palette, self, Sparks, vignette } from '../visuals'

/**
 * Die vier Gesichter des Leids, die dieser Abschnitt durchgeht. Keines ist abwendbar, keines ist
 * ein Fehler der spielenden Person — und keines wird am Ende gelöscht.
 */
type Facet = 'verlust' | 'schuld' | 'ohnmacht' | 'einsamkeit'

interface Station {
  facet: Facet
  x: number
  y: number
  color: number
  /** Zwei Zeilen für das Unterrichtsgespräch: was man tut und was dabei nicht geht. */
  instruction: string
}

const STATIONS: Station[] = [
  { facet: 'verlust', x: 560, y: 380, color: 0x8fd0d8, instruction: 'Bleib bei ihr.' },
  { facet: 'schuld', x: 1_020, y: 760, color: 0xd97a4a, instruction: 'Beide brauchen dich.' },
  { facet: 'ohnmacht', x: 1_420, y: 360, color: 0xb59ad8, instruction: 'Du kommst nicht hinüber.' },
  { facet: 'einsamkeit', x: 1_680, y: 760, color: 0x9eb77f, instruction: 'Ruf, wenn du willst.' },
]

const LAYERS = ['Ausrichten', 'Bewegen', 'Tragen', 'Abschirmen', 'Antworten'] as const

const STATION_MS = 11_000
const LAYER_STEP_MS = 4_200
const LIGHT_MS = 16_000
const ALIGN_REQUIRED_MS = 2_200
const LIGHT_X = 960
const LIGHT_Y = 540

/**
 * Lass los · „Ein Leben".
 *
 * Der Abschnitt erzählt ein Menschenleben in vier Stationen. Jede zeigt ein anderes Gesicht des
 * Leids, und keine lässt sich abwenden:
 *
 * - **Verlust**: Ein Begleitlicht löst sich und treibt fort. Man kann ihm nachgehen; es bleibt
 *   immer knapp ausserhalb der Reichweite.
 * - **Schuld**: Zwei Lichter brauchen einen zugleich. Wem man sich zuwendet, den hält man — das
 *   andere verliert genau dadurch.
 * - **Ohnmacht**: Ein Licht leidet hinter einer Grenze, die man nicht überschreiten kann. Man kann
 *   nur danebenbleiben oder weitergehen.
 * - **Einsamkeit**: Man kann rufen. Es kommt nichts zurück.
 *
 * Jede Station hinterlässt eine dunkle Kerbe an der eigenen Gestalt. Danach fallen die erworbenen
 * Fähigkeiten rückwärts weg, bis nur noch Ausrichten bleibt.
 *
 * Im Schluss wächst ein Licht heran, das nicht erklärt wird. Wer sich ihm zuwendet, sieht die vier
 * Kerben nacheinander **aufleuchten** statt verschwinden: Nichts wird gelöscht, alles wird
 * aufgenommen. Das ist die Aussage des ganzen Spiels, und sie steht in keinem Satz.
 */
export class Level06State extends TimedLevelScene {
  private graphics!: Phaser.GameObjects.Graphics
  private player = new Phaser.Math.Vector2(240, 560)
  private velocity = new Phaser.Math.Vector2()
  private facing = 0
  private phase = 0
  private phaseStartedAt = 0
  private stationIndex = 0
  private stationStartedAt = 0
  private carried: Facet[] = []
  private companion = new Phaser.Math.Vector2(0, 0)
  private companionAlpha = 1
  private pairLeft = 1
  private pairRight = 1
  private chosenSide: 'left' | 'right' | null = null
  private beyond = 1
  private calls = 0
  private layersLost = 0
  private alignMs = 0
  private aligned = false
  private litMarks = 0
  private activeMs = 0
  private sampleClock = 0
  private sparks = new Sparks()
  private layerLabels: Phaser.GameObjects.Text[] = []
  private objectiveHud!: ObjectiveHud
  private goal!: GoalTracker

  constructor() {
    super('Level06')
  }

  create(): void {
    this.player.set(240, 560)
    this.velocity.set(0, 0)
    this.facing = 0
    this.phase = 0
    this.phaseStartedAt = 0
    this.stationIndex = 0
    this.stationStartedAt = 0
    this.carried = []
    this.companion.set(360, 420)
    this.companionAlpha = 1
    this.pairLeft = 1
    this.pairRight = 1
    this.chosenSide = null
    this.beyond = 1
    this.calls = 0
    this.layersLost = 0
    this.alignMs = 0
    this.aligned = false
    this.litMarks = 0
    this.activeMs = 0
    this.sampleClock = 0
    this.sparks = new Sparks()
    this.graphics = this.add.graphics()
    this.layerLabels.forEach((label) => label.destroy())
    this.layerLabels = LAYERS.map((name, index) => this.add.text(
      224, 292 + (LAYERS.length - 1 - index) * 34, name.toUpperCase(),
      { fontFamily: 'Arial, sans-serif', fontSize: '17px', color: '#cfd6cb' },
    ).setDepth(30).setAlpha(0))
    this.objectiveHud = new ObjectiveHud(this)
    this.goal = new GoalTracker(this.objectiveHud, { label: 'Getragen', target: STATIONS.length })
    this.cameras.main.setBackgroundColor(0x070709)
    this.beginTimedLevel('Level06', levels.level06, 'AUSSCHNITT · 06', 'Geh weiter.', 'release', {
      goal: 'Geh durch dein Leben. Nicht alles lässt sich halten.',
      controls: 'WASD / Pfeiltasten · Leertaste zum Rufen · Maus oder Berührung',
    })
  }

  update(time: number, delta: number): void {
    if (this.finished) return
    const progress = this.advanceLevel(delta)
    if (this.finished || progress < 0) return
    this.goal.advance(delta)
    this.updatePhase(delta)
    this.updateControl(delta)
    if (this.phase === 1) this.updateStation(delta)
    if (this.phase === 3) this.updateAlignment(delta)
    this.drawWorld(time)
  }

  protected applyHint(level: AssistanceLevel): void {
    this.services.setAssistance(level)
    if (level === 1) this.services.ui.setHint('Manches lässt sich nicht halten. Geh weiter.')
    if (level === 2) this.services.ui.setHint('Es gibt hier nichts falsch zu machen.')
    if (level === 3) this.services.ui.setHint(this.phase >= 3 ? 'Wende dich dem Licht zu.' : 'Der Weg führt nach rechts.')
  }

  protected collectResult(): LevelResult {
    return {
      choices: {
        released: this.aligned,
        heldOn: this.chosenSide ?? 'none',
      },
      metrics: {
        stationsPassed: this.carried.length,
        stationTarget: STATIONS.length,
        layersLost: this.layersLost,
        litMarks: this.litMarks,
        calls: this.calls,
        alignedToLight: this.aligned ? 1 : 0,
        activeRatio: this.elapsedMs ? this.activeMs / this.elapsedMs : 0,
        gradeScore: this.aligned ? 2 : this.carried.length >= 3 ? 1 : 0,
      },
    }
  }

  protected afterLevelFinished(): void {
    this.services.audio.stopAmbient(1.2)
    this.services.ui.setScene('')
    this.cameras.main.fadeOut(2_200, 255, 255, 250)
    const testMode = this.services.getStatus().testMode
    this.time.delayedCall(testMode ? 380 : 2_300, () => this.scene.start('FinaleReplay'))
  }

  private timeScale(): number {
    return this.services.getTimeScale()
  }

  private canMove(): boolean {
    return this.layersLost < 4
  }

  private layerAlive(index: number): boolean {
    return index < LAYERS.length - this.layersLost
  }

  private station(): Station {
    return STATIONS[Math.min(this.stationIndex, STATIONS.length - 1)]
  }

  private updatePhase(delta: number): void {
    const scale = this.timeScale()
    if (this.phase === 0) {
      // Aufbrechen: kurz, hell, ohne Widerstand. Der Vergleichspunkt für alles Weitere.
      if (this.elapsedMs >= 9_000 * scale || this.player.x > 480) this.enterPhase(1)
      return
    }
    if (this.phase === 1) {
      if (this.elapsedMs - this.stationStartedAt < STATION_MS * scale) return
      this.finishStation()
      return
    }
    if (this.phase === 2) {
      const step = LAYER_STEP_MS * scale * (this.hintManager.getLevel() >= 3 ? 1.4 : 1)
      const lost = Math.min(4, Math.floor((this.elapsedMs - this.phaseStartedAt) / step))
      if (lost !== this.layersLost) {
        this.layersLost = lost
        this.services.audio.pulse(78 - lost * 7, 0.06)
        this.cameras.main.shake(200, 0.0026)
      }
      if (this.layersLost >= 4) this.enterPhase(3)
      return
    }
    if (this.phase === 3 && this.elapsedMs - this.phaseStartedAt >= LIGHT_MS * scale) this.finishLevel()
    void delta
  }

  private enterPhase(next: number): void {
    this.phase = next
    this.phaseStartedAt = this.elapsedMs
    if (next === 1) {
      this.stationStartedAt = this.elapsedMs
      this.beginStation()
    } else if (next === 2) {
      this.services.ui.setInstruction('Es wird weniger.')
      this.services.ui.setHint('')
      this.services.audio.playMotif('release', 0.2)
    } else if (next === 3) {
      this.velocity.set(0, 0)
      this.goal.relabel('Zuwenden', 1)
      this.goal.setValue(0)
      this.services.ui.setInstruction('')
      this.services.ui.setHint('')
      this.services.audio.playMotif('release', 0.3)
    }
  }

  private beginStation(): void {
    const station = this.station()
    this.services.ui.setInstruction(station.instruction)
    this.services.audio.playMotif(station.facet === 'einsamkeit' ? 'release' : 'bond', 0.16)
    if (station.facet === 'verlust') this.companion.set(station.x, station.y)
    if (station.facet === 'schuld') {
      this.pairLeft = 1
      this.pairRight = 1
      this.chosenSide = null
    }
    if (station.facet === 'ohnmacht') this.beyond = 1
  }

  private finishStation(): void {
    const station = this.station()
    this.carried.push(station.facet)
    this.goal.add(1)
    this.sparks.emit(this.player.x, this.player.y, station.color, 110, 700)
    this.services.audio.pulse(96, 0.05)
    this.stationIndex += 1
    if (this.stationIndex >= STATIONS.length) {
      this.enterPhase(2)
      return
    }
    this.stationStartedAt = this.elapsedMs
    this.beginStation()
  }

  /** Der Ablauf innerhalb einer Station. Nichts davon ist zu gewinnen. */
  private updateStation(delta: number): void {
    const scale = this.timeScale()
    const local = Phaser.Math.Clamp((this.elapsedMs - this.stationStartedAt) / (STATION_MS * scale), 0, 1)
    const station = this.station()

    if (station.facet === 'verlust') {
      // Sie bleibt immer knapp ausserhalb der Reichweite und verblasst.
      const away = new Phaser.Math.Vector2(this.companion.x - this.player.x, this.companion.y - this.player.y)
      const distance = away.length()
      if (distance < 190) this.companion.add(away.normalize().scale((190 - distance) * 0.06))
      this.companion.x = Phaser.Math.Clamp(this.companion.x + 0.55 * (delta / 16.667), 120, GAME_WIDTH - 120)
      this.companion.y = Phaser.Math.Clamp(this.companion.y - 0.24 * (delta / 16.667), 140, GAME_HEIGHT - 140)
      this.companionAlpha = Phaser.Math.Clamp(1 - local * 1.15, 0, 1)
      return
    }

    if (station.facet === 'schuld') {
      // Nähe hält das eine und lässt genau dadurch das andere fallen.
      const left = new Phaser.Math.Vector2(station.x - 300, station.y - 60)
      const right = new Phaser.Math.Vector2(station.x + 300, station.y - 60)
      const toLeft = Phaser.Math.Distance.BetweenPoints(this.player, left)
      const toRight = Phaser.Math.Distance.BetweenPoints(this.player, right)
      const near = 230
      const rate = (delta / scale) * 0.00016
      if (toLeft < near) {
        this.pairLeft = Math.min(1, this.pairLeft + rate * 1.4)
        this.pairRight = Math.max(0.08, this.pairRight - rate * 1.6)
        this.chosenSide = 'left'
      } else if (toRight < near) {
        this.pairRight = Math.min(1, this.pairRight + rate * 1.4)
        this.pairLeft = Math.max(0.08, this.pairLeft - rate * 1.6)
        this.chosenSide = 'right'
      } else {
        this.pairLeft = Math.max(0.08, this.pairLeft - rate * 0.9)
        this.pairRight = Math.max(0.08, this.pairRight - rate * 0.9)
      }
      return
    }

    if (station.facet === 'ohnmacht') {
      // Es verlischt, egal wie nah man steht. Die Grenze ist keine Aufgabe.
      this.beyond = Phaser.Math.Clamp(1 - local * 0.92, 0.06, 1)
      return
    }

    if (this.inputManager.justActionDown()) {
      this.calls += 1
      this.sparks.emit(this.player.x, this.player.y, 0xd9d6c6, 220, 1_400)
      this.services.audio.pulse(188, 0.03)
    }
  }

  private updateControl(delta: number): void {
    const input = this.inputManager.getVector(this.player.x, this.player.y)
    const frameScale = Phaser.Math.Clamp(delta / 16.667, 0.4, 2.4)
    if (input.active) {
      this.activeMs += delta
      const direction: Direction = input.x < -0.2 ? 'left' : input.x > 0.2 ? 'right' : 'center'
      this.services.telemetry.recordDirection(direction)
    }

    if (this.canMove()) {
      const power = Phaser.Math.Linear(0.7, 0.22, this.layersLost / 4)
      if (input.active) {
        this.velocity.x += input.x * power * frameScale
        this.velocity.y += input.y * power * frameScale
      }
      const maxSpeed = Phaser.Math.Linear(6.4, 2, this.layersLost / 4)
      this.velocity.scale(Math.pow(input.active ? 0.92 : 0.85, frameScale)).limit(maxSpeed)
      this.player.x = Phaser.Math.Clamp(this.player.x + this.velocity.x * frameScale, 160, GAME_WIDTH - 160)
      this.player.y = Phaser.Math.Clamp(this.player.y + this.velocity.y * frameScale, 200, GAME_HEIGHT - 180)
      if (this.velocity.lengthSq() > 0.05) this.facing = this.velocity.angle()
    } else if (input.active) {
      // Nur noch Ausrichten — dasselbe, was der Halm in Level 1 konnte.
      this.facing = Phaser.Math.Angle.RotateTo(this.facing, Math.atan2(input.y, input.x), 0.045 * frameScale)
      this.velocity.set(0, 0)
    }

    this.sampleClock += delta
    if (this.sampleClock >= 120) {
      this.services.telemetry.sample((this.player.x - 960) / 680, this.velocity.length() / 8, !input.active, this.sampleClock)
      this.sampleClock = 0
    }
  }

  private updateAlignment(delta: number): void {
    const toLight = Phaser.Math.Angle.Between(this.player.x, this.player.y, LIGHT_X, LIGHT_Y)
    const spread = this.hintManager.getLevel() >= 3 ? 0.7 : 0.42
    const off = Math.abs(Phaser.Math.Angle.Wrap(this.facing - toLight))
    if (off <= spread) this.alignMs += delta
    else this.alignMs = Math.max(0, this.alignMs - delta * 0.6)

    if (!this.aligned && this.alignMs >= ALIGN_REQUIRED_MS * this.timeScale()) {
      this.aligned = true
      this.goal.setValue(1)
      this.services.audio.playMotif('release', 0.34)
    }
    if (!this.aligned) return

    // Nichts wird gelöscht. Eine Kerbe nach der anderen leuchtet auf.
    const since = this.elapsedMs - (this.phaseStartedAt + ALIGN_REQUIRED_MS * this.timeScale())
    const shouldBeLit = Phaser.Math.Clamp(Math.floor(since / (1_700 * this.timeScale())), 0, this.carried.length)
    while (this.litMarks < shouldBeLit) {
      const facet = this.carried[this.litMarks]
      const station = STATIONS.find((entry) => entry.facet === facet)
      this.litMarks += 1
      this.sparks.emit(this.player.x, this.player.y, station?.color ?? palette.licht, 180, 1_300)
      this.services.audio.pulse(210 + this.litMarks * 22, 0.05)
    }
  }

  private lightGrowth(): number {
    if (this.phase < 3) return 0
    return Phaser.Math.Clamp((this.elapsedMs - this.phaseStartedAt) / (LIGHT_MS * this.timeScale()), 0, 1)
  }

  private drawWorld(time: number): void {
    const g = this.graphics
    const dim = Phaser.Math.Clamp(this.layersLost / 4, 0, 1)
    const growth = this.lightGrowth()
    g.clear()
    ground(
      g,
      Phaser.Display.Color.GetColor(Math.round(14 + growth * 40), Math.round(14 + growth * 36), Math.round(22 + growth * 30)),
      Phaser.Display.Color.GetColor(Math.round(22 + growth * 44), Math.round(18 + growth * 38), Math.round(24 + growth * 30)),
    )
    dust(g, time, 42, 0xd6d2e0, 0.008)

    this.drawPath(g)
    if (this.phase === 1) this.drawStation(g, time)
    this.drawLayers(g)
    if (this.phase === 3) this.drawLight(g, time, growth)
    this.sparks.draw(g)
    this.drawSelf(g, time, dim)

    if (this.phase >= 2) {
      const field = Phaser.Math.Linear(940, 300, dim)
      g.lineStyle(3, 0xd9d7ca, 0.06)
      g.strokeCircle(this.player.x, this.player.y, field)
    }
    vignette(g, 0.36 * (1 - growth * 0.7))

    // Am Ende nimmt das Licht das ganze Bild.
    if (growth > 0.62) {
      const wash = Phaser.Math.Clamp((growth - 0.62) / 0.38, 0, 1)
      g.fillStyle(0xfffdf4, Math.pow(wash, 2.2) * 0.96)
      g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
    }
  }

  /** Die Lebenslinie: eine leise Spur von links nach rechts, an der die Stationen liegen. */
  private drawPath(g: Phaser.GameObjects.Graphics): void {
    if (this.phase >= 3) return
    g.lineStyle(1.4, 0xcfd6cb, 0.1)
    g.beginPath()
    g.moveTo(200, 560)
    STATIONS.forEach((station) => g.lineTo(station.x, station.y))
    g.lineTo(GAME_WIDTH - 200, 560)
    g.strokePath()
    STATIONS.forEach((station, index) => {
      const done = index < this.stationIndex
      const current = index === this.stationIndex
      g.fillStyle(station.color, done ? 0.5 : current ? 0.32 : 0.14)
      g.fillCircle(station.x, station.y, current ? 9 : 6)
      if (current) glow(g, station.x, station.y, 120, station.color, 0.12)
    })
  }

  private drawStation(g: Phaser.GameObjects.Graphics, time: number): void {
    const station = this.station()
    if (station.facet === 'verlust') {
      if (this.companionAlpha <= 0.02) return
      glow(g, this.companion.x, this.companion.y, 150, station.color, 0.3 * this.companionAlpha)
      g.lineStyle(2, station.color, 0.5 * this.companionAlpha)
      g.strokeCircle(this.companion.x, this.companion.y, 22)
      g.fillStyle(0xdff4f6, 0.9 * this.companionAlpha)
      g.fillCircle(this.companion.x, this.companion.y, 8)
      g.lineStyle(1.5, station.color, 0.16 * this.companionAlpha)
      g.lineBetween(this.player.x, this.player.y, this.companion.x, this.companion.y)
      return
    }
    if (station.facet === 'schuld') {
      const left = new Phaser.Math.Vector2(station.x - 300, station.y - 60)
      const right = new Phaser.Math.Vector2(station.x + 300, station.y - 60)
      this.drawNeedy(g, left.x, left.y, this.pairLeft, station.color)
      this.drawNeedy(g, right.x, right.y, this.pairRight, 0xe8b969)
      return
    }
    if (station.facet === 'ohnmacht') {
      // Die Grenze ist eine Wand aus Licht, die man sieht und nicht durchdringt.
      const wallX = station.x + 130
      for (let index = 0; index < 26; index += 1) {
        const y = 180 + index * 34
        g.lineStyle(2, 0x6f6a86, 0.16 + Math.sin(time * 0.001 + index) * 0.05)
        g.lineBetween(wallX, y, wallX + 26, y + 18)
      }
      glow(g, station.x + 320, station.y + 120, 200, station.color, 0.24 * this.beyond)
      g.fillStyle(0xe6dcf4, 0.85 * this.beyond)
      g.fillCircle(station.x + 320, station.y + 120, 9)
      return
    }
    // Einsamkeit: nichts steht da. Genau das ist es.
    g.lineStyle(1.4, station.color, 0.1)
    g.strokeCircle(station.x, station.y, 240 + Math.sin(time * 0.001) * 12)
  }

  private drawNeedy(g: Phaser.GameObjects.Graphics, x: number, y: number, strength: number, color: number): void {
    glow(g, x, y, 130 * strength + 30, color, 0.26 * strength)
    g.lineStyle(6, 0x241f28, 0.55)
    g.strokeCircle(x, y, 28)
    g.lineStyle(6, color, 0.85)
    g.beginPath()
    g.arc(x, y, 28, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * strength, false)
    g.strokePath()
    g.fillStyle(0xf2ecdd, 0.8 * strength + 0.15)
    g.fillCircle(x, y, 7)
  }

  private drawLayers(g: Phaser.GameObjects.Graphics): void {
    if (this.phase < 2) {
      this.layerLabels.forEach((label) => label.setAlpha(0))
      return
    }
    const fade = this.phase === 3 ? Phaser.Math.Clamp(1 - this.lightGrowth() * 2.2, 0, 1) : 1
    const x = 92
    let y = 300
    for (let index = LAYERS.length - 1; index >= 0; index -= 1) {
      const alive = this.layerAlive(index)
      const last = index === 0
      g.fillStyle(alive ? (last ? palette.licht : 0xcfd6cb) : 0x4a4f48, (alive ? 0.85 : 0.3) * fade)
      g.fillRect(x, y, 116, 5)
      const label = this.layerLabels[index]
      if (label) {
        label.setY(y - 11)
        label.setAlpha((alive ? (last ? 0.95 : 0.7) : 0.28) * fade)
        label.setColor(alive && last ? '#f0cd8a' : '#cfd6cb')
      }
      if (!alive) {
        g.lineStyle(2, 0x6d7269, 0.55 * fade)
        g.lineBetween(x - 8, y + 2, x + 124, y + 2)
        if (label) g.lineBetween(label.x - 4, y + 2, label.x + label.width + 4, y + 2)
      }
      y += 34
    }
  }

  private drawLight(g: Phaser.GameObjects.Graphics, time: number, growth: number): void {
    const ready = Phaser.Math.Clamp(this.alignMs / (ALIGN_REQUIRED_MS * this.timeScale()), 0, 1)
    const radius = 240 + growth * 1_500 + ready * 220
    glow(g, LIGHT_X, LIGHT_Y, radius, palette.licht, 0.2 + growth * 0.3 + ready * 0.16)
    glow(g, LIGHT_X, LIGHT_Y, radius * 0.35, 0xfff8e4, 0.24 + growth * 0.34)
    g.fillStyle(0xfffdf2, 0.75 + ready * 0.25)
    g.fillCircle(LIGHT_X, LIGHT_Y, 16 + Math.sin(time * 0.0015) * 3 + growth * 26)
    if (ready > 0.05 && !this.aligned) {
      g.lineStyle(2.5, 0xf6e9c6, ready * 0.4)
      g.lineBetween(this.player.x, this.player.y, LIGHT_X, LIGHT_Y)
    }
  }

  /** Die eigene Gestalt mit den Kerben dessen, was sie getragen hat. */
  private drawSelf(g: Phaser.GameObjects.Graphics, time: number, dim: number): void {
    const strength = 1 - dim * 0.4
    self(g, this.player.x, this.player.y, time, 1 - dim * 0.25, strength)

    this.carried.forEach((facet, index) => {
      const station = STATIONS.find((entry) => entry.facet === facet)
      const angle = -Math.PI / 2 + (index / STATIONS.length) * Math.PI * 2
      const mx = this.player.x + Math.cos(angle) * 34
      const my = this.player.y + Math.sin(angle) * 34
      const lit = index < this.litMarks
      if (lit) {
        glow(g, mx, my, 68, station?.color ?? palette.licht, 0.42)
        g.fillStyle(station?.color ?? palette.licht, 0.95)
        g.fillCircle(mx, my, 6.5)
      } else {
        g.fillStyle(0x1a1620, 0.9)
        g.fillCircle(mx, my, 6)
        g.lineStyle(1.6, station?.color ?? 0x6d7269, 0.45)
        g.strokeCircle(mx, my, 6)
      }
    })

    if (this.canMove()) return
    g.lineStyle(4, 0xf2e9c4, 0.9 * strength)
    g.lineBetween(
      this.player.x, this.player.y,
      this.player.x + Math.cos(this.facing) * 52,
      this.player.y + Math.sin(this.facing) * 52,
    )
  }
}

import Phaser from 'phaser'
import { LevelBriefing } from '../components/LevelBriefing'
import { ObjectiveHud } from '../components/ObjectiveHud'
import { gameConfig, GAME_HEIGHT, GAME_WIDTH } from '../config/gameConfig'
import { levels } from '../config/levels'
import { GoalTracker } from '../systems/GoalTracker'
import { HintManager } from '../systems/HintManager'
import { InputManager } from '../systems/InputManager'
import type { AssistanceLevel, Direction } from '../types'
import { dust, glow, glowEllipse, ground, palette, self as drawSelf, Sparks, vignette } from '../visuals'
import { BaseScene } from './BaseScene'

interface Gust {
  startsAt: number
  duration: number
  strength: number
}

const KNOT_TARGET = 5
const WAVE_PERIOD_MS = 8_400
/** Wieviel Zeit im hellen Streifen ein Glied wachsen laesst. */
const LIGHT_REQUIRED_MS = 2_600

/**
 * Bleibe · „Die Wellen fangen".
 *
 * Der Halm ist verwurzelt: eine Achse, mehr nicht. Das ist die Aussage des Abschnitts, freie
 * Bewegung wäre falsch. Die frühere Fassung machte daraus 90 Sekunden gleichmässige Nachführung
 * ohne Zäsur — langatmig und ohne Entscheidung.
 *
 * Jetzt kommt das Licht in **Wellen**: Alle acht Sekunden öffnet sich ein heller Streifen an einer
 * vorhersehbaren Seite und wandert durch. Wer rechtzeitig darin steht und die Welle weit genug
 * mitnimmt, setzt einen sichtbaren Knoten an den Halm. Antizipation statt Dauerkorrektur.
 *
 * Der Wind war bisher reine Dekoration — er wurde gezeichnet, aber nie gelesen. Jetzt ist er Kraft,
 * kommt in angekündigten Böen und macht das Halten zur Aufgabe.
 *
 * Der dunkle Schatten ist das Zebra, der schnelle warme Streifen der Löwe. Für das Gras ist der
 * Pflanzenfresser das Ungeheuer und das Raubtier der Erlöser. Kein Wort erklärt das; das Replay
 * zeigt dieselben Sekunden später von aussen.
 */
export class Level01State extends BaseScene {
  private readonly config = levels.level01
  private graphics!: Phaser.GameObjects.Graphics
  private inputManager!: InputManager
  private hintManager!: HintManager
  private objectiveHud!: ObjectiveHud
  private goal!: GoalTracker
  private briefing!: LevelBriefing
  private sparks = new Sparks()

  private elapsedMs = 0
  private maximumDurationMs = 0
  private position = 0
  private velocity = 0
  private growth = 0.08
  private waveIndex = -1
  private waveStartedAt = 0
  private waveFrom = 0
  private waveTo = 0
  private waveFill = 0
  private knots: number[] = []
  private lightMs = 0
  private darkMs = 0
  private gusts: Gust[] = []
  private shadowFrom = -1
  private shadowGoneAt = -1
  private shadowRestAt = 0
  private swiftFrom = -1
  private outcomeAt = -1
  private finished = false

  constructor() {
    super('Level01')
  }

  create(): void {
    this.elapsedMs = 0
    this.position = 0
    this.velocity = 0
    this.growth = 0.08
    this.waveIndex = -1
    this.waveStartedAt = 0
    this.waveFill = 0
    this.knots = []
    this.lightMs = 0
    this.darkMs = 0
    this.shadowFrom = -1
    this.shadowGoneAt = -1
    this.shadowRestAt = 0
    this.swiftFrom = -1
    this.outcomeAt = -1
    this.finished = false
    this.sparks = new Sparks()

    const scale = this.services.getTimeScale()
    this.maximumDurationMs = this.config.maximumDurationMs * scale
    this.gusts = [2, 4, 5].map((wave) => ({
      startsAt: wave * WAVE_PERIOD_MS * scale + 2_600 * scale,
      duration: 2_600 * scale,
      strength: 0.0009 + wave * 0.00016,
    }))

    this.services.enterState('Level01', this.maximumDurationMs)
    this.services.telemetry.startLevel(this.config.id)
    this.services.ui.setScene('AUSSCHNITT · 01', 'Nimm die Welle mit.')
    this.services.ui.setHint('A / D · ← / → · Maus · Berührung')
    this.services.ui.hideAction()
    this.services.ui.setCaption('')
    void this.services.audio.unlock().then(() => this.services.audio.startAmbient('light'))

    this.cameras.main.setBackgroundColor(gameConfig.background)
    this.cameras.main.fadeIn(1_000, 2, 8, 6)
    this.graphics = this.add.graphics()
    this.objectiveHud = new ObjectiveHud(this)
    this.goal = new GoalTracker(this.objectiveHud, {
      label: 'Wachsen', target: KNOT_TARGET, bufferLabel: 'Welle',
    })
    this.goal.resetBuffer(0)
    this.briefing = new LevelBriefing(this, {
      goal: 'Das Licht wandert in Wellen durch. Steh lange genug darin, dann wächst der Halm ein Glied.',
      controls: 'A / D oder ← / → · Maus oder Berührung',
    }, this.services.getStatus().testMode)
    this.inputManager = new InputManager(this)
    this.hintManager = new HintManager(
      this.config.hintTimesMs.map((time) => time * scale),
      (level) => this.applyHint(level),
    )

    this.events.on('teacher:complete', this.finishLevel, this)
    this.events.on('teacher:hint', this.forceHint, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this)
  }

  update(time: number, delta: number): void {
    if (this.finished || this.briefing.isActive()) return
    this.elapsedMs += delta
    this.goal.advance(delta)
    this.hintManager.update(this.elapsedMs)
    this.services.setStatus({ remainingMs: Math.max(0, this.maximumDurationMs - this.elapsedMs) })

    this.updateWave(delta)
    this.updateMovement(delta)
    this.updateDrama()
    this.drawWorld(time)

    if (this.outcomeAt >= 0 && this.elapsedMs - this.outcomeAt >= 6_500 * this.services.getTimeScale()) this.finishLevel()
    if (this.elapsedMs >= this.maximumDurationMs) this.finishLevel()
  }

  private timeScale(): number {
    return this.services.getTimeScale()
  }

  /** Halblänge des hellen Streifens in Positionseinheiten. Hilfestufen machen ihn breiter. */
  private bandHalfWidth(): number {
    const assist = this.hintManager.getLevel()
    return 0.18 + (assist >= 1 ? 0.05 : 0) + (assist >= 3 ? 0.07 : 0)
  }

  /**
   * Der Streifen wandert ohne Unterbrechung durch die ganze Periode — von ausserhalb des Bildes
   * bis wieder hinaus. Die vorige Fassung liess ihn mitten im Bild verschwinden und an der anderen
   * Seite neu auftauchen; das las sich als Flackern, nicht als Wanderung.
   */
  private waveCentre(): number {
    if (this.waveIndex < 0) return -1.45
    const local = Phaser.Math.Clamp(
      (this.elapsedMs - this.waveStartedAt) / (WAVE_PERIOD_MS * this.timeScale()), 0, 1,
    )
    return Phaser.Math.Linear(this.waveFrom, this.waveTo, local)
  }

  private waveActive(): boolean {
    return this.waveIndex >= 0 && this.outcomeAt < 0
  }

  private inLight(): boolean {
    if (!this.waveActive()) return false
    if (this.shadowCovers()) return false
    return Math.abs(this.tipPosition() - this.waveCentre()) <= this.bandHalfWidth()
  }

  private tipPosition(): number {
    return this.position * Phaser.Math.Clamp(0.62 + this.growth * 0.36, 0.62, 0.98)
  }

  private updateWave(delta: number): void {
    if (this.outcomeAt >= 0) return
    const period = WAVE_PERIOD_MS * this.timeScale()
    const due = Math.floor(this.elapsedMs / period)
    if (due > this.waveIndex && this.goal.value < KNOT_TARGET) {
      this.waveIndex = due
      this.waveStartedAt = this.elapsedMs
      this.waveFill = 0
      const fromLeft = due % 2 === 0
      this.waveFrom = fromLeft ? -1.45 : 1.45
      this.waveTo = -this.waveFrom
      this.services.audio.pulse(150 + due * 12, 0.03)
    }

    if (!this.waveActive()) return

    // Ein Glied entsteht aus gesammelter Lichtzeit, nicht pro Welle. Vorher verfiel alles, was
    // ueber eine Wellengrenze hinausging — man konnte lange im Licht stehen und trotzdem nichts
    // zeigen.
    const required = LIGHT_REQUIRED_MS * this.timeScale()
    if (this.inLight()) {
      this.lightMs += delta
      this.waveFill = Math.min(1, this.waveFill + delta / required)
      if (Math.random() < 0.06) this.services.audio.pulse(240 + this.goal.value * 18, 0.012)
    } else {
      this.darkMs += delta
      // Der Schatten nimmt, was schon gewachsen war.
      if (this.shadowCovers()) this.waveFill = Math.max(0, this.waveFill - delta / (required * 1.6))
    }
    if (this.waveFill >= 1) this.settleWave()
    this.goal.resetBuffer(this.waveFill)
  }

  /** Eine Welle zählt nur, wenn man weit genug drin war. Halbe Sachen ergeben keinen Knoten. */
  private settleWave(): void {
    this.knots.push(this.growth)
    this.growth = Math.min(1, this.growth + 0.18)
    this.goal.add(1)
    this.sparks.emit(this.tipX(), this.tipY(), palette.licht, 120, 720)
    this.services.audio.pulse(268, 0.06)
    this.waveFill = 0
  }

  private updateMovement(delta: number): void {
    const axis = this.inputManager.getAxis()
    const pointer = this.inputManager.getPointerTarget()
    const controls = gameConfig.controls
    const frameScale = Phaser.Math.Clamp(delta / 16.667, 0.4, 2.5)
    const mobility = 0.95 + this.growth * 0.5

    if (axis !== 0) this.velocity += axis * controls.acceleration * mobility * frameScale
    if (pointer !== null) this.velocity += (pointer - this.position) * controls.pointerPull * mobility * frameScale
    // Der Wind ist jetzt Kraft, nicht Kulisse.
    this.velocity += this.windForce() * frameScale
    this.velocity *= Math.pow(controls.damping, frameScale)
    this.velocity = Phaser.Math.Clamp(this.velocity, -controls.maxVelocity * mobility, controls.maxVelocity * mobility)
    this.position = Phaser.Math.Clamp(this.position + this.velocity * frameScale, -0.98, 0.98)
    if (Math.abs(this.position) >= 0.98) this.velocity *= -0.3

    const direction: Direction = axis < 0 ? 'left' : axis > 0 ? 'right' : 'center'
    this.services.telemetry.recordDirection(direction)
    this.services.telemetry.sample(this.tipPosition(), this.velocity, this.inLight(), delta)
  }

  private windForce(): number {
    const gust = this.gusts.find(
      (entry) => this.elapsedMs >= entry.startsAt && this.elapsedMs <= entry.startsAt + entry.duration,
    )
    if (!gust) return Math.sin(this.elapsedMs * 0.0007) * 0.00012
    const local = (this.elapsedMs - gust.startsAt) / gust.duration
    const shape = Math.sin(local * Math.PI)
    const damp = this.hintManager.getLevel() >= 2 ? 0.55 : 1
    return Math.sign(Math.sin(gust.startsAt)) * gust.strength * shape * damp
  }

  private gustStrength(): number {
    const gust = this.gusts.find(
      (entry) => this.elapsedMs >= entry.startsAt - 900 && this.elapsedMs <= entry.startsAt + entry.duration,
    )
    if (!gust) return 0
    const local = (this.elapsedMs - (gust.startsAt - 900)) / (gust.duration + 900)
    return Phaser.Math.Clamp(Math.sin(local * Math.PI), 0, 1)
  }

  /**
   * Der Schatten schiebt sich heran und bleibt stehen, bis das schnelle Signal ihn verjagt. Vorher
   * lief er stur durch und der Schnelle war ohne Wirkung — die Rettung war reine Behauptung.
   */
  private shadowCentre(): number | null {
    if (this.shadowFrom < 0) return null
    const scale = this.timeScale()
    if (this.shadowGoneAt >= 0) {
      const back = (this.elapsedMs - this.shadowGoneAt) / (1_900 * scale)
      if (back > 1) return null
      return Phaser.Math.Linear(this.shadowRestAt, 1.9, back)
    }
    const local = Phaser.Math.Clamp((this.elapsedMs - this.shadowFrom) / (3_200 * scale), 0, 1)
    return Phaser.Math.Linear(1.9, this.shadowRestAt, Phaser.Math.Easing.Sine.Out(local))
  }

  private shadowCovers(): boolean {
    const centre = this.shadowCentre()
    if (centre === null) return false
    return Math.abs(this.tipPosition() - centre) < 0.34
  }

  private updateDrama(): void {
    const scale = this.timeScale()
    if (this.shadowFrom < 0 && this.goal.value >= 2) {
      this.shadowFrom = this.elapsedMs
      // Es stellt sich genau dorthin, wo man gerade steht.
      this.shadowRestAt = Phaser.Math.Clamp(this.tipPosition(), -0.5, 0.5)
      this.services.ui.setInstruction('Etwas Dunkles nimmt dir das Licht.')
      this.services.audio.pulse(58, 0.08)
    }
    if (this.shadowFrom >= 0 && this.swiftFrom < 0 && this.elapsedMs - this.shadowFrom >= 4_600 * scale) {
      this.swiftFrom = this.elapsedMs
      this.services.audio.playSwiftMotif()
    }
    if (this.swiftFrom >= 0 && this.shadowGoneAt < 0 && this.elapsedMs - this.swiftFrom >= 900 * scale) {
      this.shadowGoneAt = this.elapsedMs
      this.services.ui.setInstruction('Etwas Schnelles hat es verjagt.')
      this.services.audio.pulse(196, 0.05)
    }
    if (this.shadowGoneAt >= 0 && this.elapsedMs - this.shadowGoneAt >= 2_400 * scale) {
      this.services.ui.setInstruction('Nimm die Welle mit.')
    }
    if (this.outcomeAt < 0 && this.goal.reached) {
      this.outcomeAt = this.elapsedMs
      this.services.ui.setInstruction('')
      this.services.ui.setHint('')
      this.services.audio.pulse(64, 0.09)
    }
  }

  private tipX(): number {
    return GAME_WIDTH / 2 + this.tipPosition() * 640
  }

  private tipY(): number {
    return Phaser.Math.Linear(930, 300, Phaser.Math.Easing.Sine.Out(this.growth))
  }

  private drawWorld(time: number): void {
    const g = this.graphics
    g.clear()
    ground(g, 0x0a1110, 0x121a12)

    // Die Welle: ein warmer Streifen, der durch das Bild wandert.
    if (this.waveActive()) {
      const centre = this.waveCentre()
      const x = GAME_WIDTH / 2 + centre * 640
      const half = this.bandHalfWidth() * 640
      glowEllipse(g, x, 620, half * 4.6, 1_500, palette.licht, 0.24)
      glowEllipse(g, x, 620, half * 1.7, 1_250, 0xfff1cf, 0.2)
      g.lineStyle(2, 0xffe9bd, 0.14)
      g.lineBetween(x - half, 150, x - half, GAME_HEIGHT - 60)
      g.lineBetween(x + half, 150, x + half, GAME_HEIGHT - 60)
    }

    const gust = this.gustStrength()
    dust(g, time, 46, 0xcfe0cf, 0.02 + gust * 0.08)
    for (let index = 0; index < 40; index += 1) {
      const speed = 0.05 + (index % 5) * 0.03 + gust * 0.4
      const x = (index * 173 + time * speed) % (GAME_WIDTH + 300) - 150
      const y = 140 + ((index * 211) % 820)
      g.lineStyle(1.4, 0x9fc4ae, 0.05 + gust * 0.22)
      g.lineBetween(x, y, x + 26 + gust * 90, y - 3)
    }

    this.drawShadow(g)
    this.drawSwift(g)
    this.drawStalk(g, time)
    this.sparks.draw(g)

    if (this.outcomeAt >= 0) {
      const local = Phaser.Math.Clamp(
        (this.elapsedMs - this.outcomeAt) / (6_500 * this.timeScale()), 0, 1,
      )
      g.fillStyle(0x000000, Math.max(0, local - 0.5) * 1.8)
      g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
    }
    vignette(g, 0.4)
  }

  /** Breite, weiche, grasende Masse — im Rückblick als Zebra wiederzuerkennen. */
  private drawShadow(g: Phaser.GameObjects.Graphics): void {
    const centre = this.shadowCentre()
    const outro = this.outcomeAt >= 0
      ? Phaser.Math.Clamp((this.elapsedMs - this.outcomeAt) / (3_400 * this.timeScale()), 0, 1)
      : null
    const x = outro !== null ? GAME_WIDTH / 2 + Phaser.Math.Linear(1.6, 0, outro) * 640
      : centre === null ? null : GAME_WIDTH / 2 + centre * 640
    if (x === null) return
    const scale = outro !== null ? 1 + outro * 0.5 : 1
    g.fillStyle(0x05090a, 0.94)
    g.fillEllipse(x, 700, 900 * scale, 520 * scale)
    g.fillStyle(0x0d1614, 0.7)
    g.fillEllipse(x + 120 * scale, 660, 560 * scale, 330 * scale)
    g.fillStyle(0x000000, 0.5)
    g.fillEllipse(x - 190 * scale, 830, 340 * scale, 190 * scale)
  }

  private drawSwift(g: Phaser.GameObjects.Graphics): void {
    if (this.swiftFrom < 0) return
    const local = (this.elapsedMs - this.swiftFrom) / (2_400 * this.timeScale())
    if (local < 0 || local > 1) return
    const x = Phaser.Math.Linear(GAME_WIDTH + 320, -320, local)
    const y = 470 + Math.sin(local * Math.PI * 2.4) * 90
    glowEllipse(g, x, y, 520, 170, palette.gefahr, 0.3)
    g.fillStyle(0xf3b183, 0.85)
    g.fillEllipse(x, y, 190, 46)
  }

  private drawStalk(g: Phaser.GameObjects.Graphics, time: number): void {
    const rootX = GAME_WIDTH / 2
    const rootY = 1_020
    const tipX = this.tipX()
    const tipY = this.tipY()
    const bend = tipX - rootX
    const sway = Math.sin(time * 0.0017) * (5 + this.growth * 14)
    const points: Array<[number, number]> = [
      [rootX, rootY],
      [rootX + bend * 0.16 - sway * 0.4, Phaser.Math.Linear(rootY, tipY, 0.32)],
      [rootX + bend * 0.58 + sway, Phaser.Math.Linear(rootY, tipY, 0.7)],
      [tipX, tipY],
    ]
    g.lineStyle(13 + this.growth * 10, 0x16281f, 0.55)
    g.beginPath()
    points.forEach(([x, y], index) => (index === 0 ? g.moveTo(x, y) : g.lineTo(x, y)))
    g.strokePath()
    g.lineStyle(4 + this.growth * 5, palette.halm, 0.95)
    g.beginPath()
    points.forEach(([x, y], index) => (index === 0 ? g.moveTo(x, y) : g.lineTo(x, y)))
    g.strokePath()

    // Jeder Knoten bleibt sichtbar am Halm stehen — der Fortschritt ist der Körper.
    // Jede gefangene Welle ist ein gewachsenes Glied. Der Zaehler ist der Koerper.
    this.knots.forEach((at, index) => {
      const t = (index + 1) / (KNOT_TARGET + 1)
      const x = Phaser.Math.Linear(rootX, tipX, t) + Math.sin(time * 0.0017 + index) * 4
      const y = Phaser.Math.Linear(rootY, tipY, t)
      g.lineStyle(9 + this.growth * 7, palette.halm, 0.5)
      g.strokeCircle(x, y, 7)
      glow(g, x, y, 40, palette.licht, 0.22)
      g.fillStyle(0xfff0cb, 0.9)
      g.fillCircle(x, y, 4.5)
      void at
    })

    const quality = this.inLight() ? 1 : 0.45
    glow(g, tipX, tipY, 96 * quality + 34, palette.licht, 0.3 * quality + 0.08)
    drawSelf(g, tipX, tipY, time, 0.72, 1)
  }

  private applyHint(level: AssistanceLevel): void {
    this.services.setAssistance(level)
    if (level === 1) this.services.ui.setHint('Der helle Streifen wird breiter.')
    if (level === 2) this.services.ui.setHint('Die Böen drücken schwächer.')
    if (level === 3) this.services.ui.setHint('Streifen und Vorwarnung werden maximal deutlich.')
  }

  private forceHint(): void {
    this.hintManager.forceNext()
  }

  private finishLevel(): void {
    if (this.finished) return
    this.finished = true
    const total = Math.max(1, this.lightMs + this.darkMs)
    const lightRatio = this.lightMs / total
    const telemetry = this.services.telemetry.finalizeLevel({
      choices: {
        // Selektor für das Echo: zum Licht gestreckt oder im Schatten geblieben.
        reach: lightRatio >= 0.42 ? 'hell' : 'dunkel',
      },
      metrics: {
        lightRatio,
        knots: this.goal.value,
        knotTarget: KNOT_TARGET,
        finalGrowth: this.growth,
        setbacks: this.goal.setbackCount,
      },
    }, this.elapsedMs)
    const variant = this.services.replay.select(this.config.id, telemetry)
    this.services.setStatus({ selectedVariant: variant.id, remainingMs: 0 })
    this.services.ui.setInstruction('')
    this.services.ui.setHint('')
    this.services.ui.setCaption('')
    this.cameras.main.fadeOut(1_050, 2, 5, 4)
    this.time.delayedCall(1_080, () => this.scene.start(this.config.nextState))
  }

  private shutdown(): void {
    this.inputManager.destroy()
    this.events.off('teacher:complete', this.finishLevel, this)
    this.events.off('teacher:hint', this.forceHint, this)
  }
}

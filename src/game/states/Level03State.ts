import Phaser from 'phaser'
import { ObjectiveHud } from '../components/ObjectiveHud'
import { GAME_HEIGHT, GAME_WIDTH } from '../config/gameConfig'
import { levels } from '../config/levels'
import { GoalTracker } from '../systems/GoalTracker'
import type { AssistanceLevel, Direction, LevelResult } from '../types'
import { TimedLevelScene } from './TimedLevelScene'
import { dust, glow, glowEllipse, ground, palette, self as drawSelf, Sparks, vignette } from '../visuals'

type Trail = 'warm' | 'cool'

interface Rival {
  x: number
  y: number
  state: 'kommt' | 'zoegert' | 'weicht'
  holdMs: number
}

const CARGO_START = 10
const STAGE_TARGET = 10
const DEN_X = 260
const KILL_X = 1_720
const SNATCH_RANGE = 196
const DEFEND_SPEED = 1.1
const WAVE_INTERVAL_MS = 4_200

/**
 * Versorge · „Heimbringen".
 *
 * Die vorige Fassung liess achtmal denselben Weg laufen: Wiederholung ohne Steigerung. Jetzt ist es
 * **ein einziger langer Rückweg mit einer schweren Last**.
 *
 * In Wellen nähern sich Konkurrenten. Pro Welle eine Entscheidung, und beide Seiten kosten:
 * **Ziehen** bringt Weg, macht aber angreifbar — wer sich bewegt, verliert ein Stück. **Stehen und
 * sich wehren** hält sie ab, kostet aber Zeit, und die Jungen zu Hause werden schwächer.
 *
 * Man kann nicht gleichzeitig ziehen und sich wehren. Niemand kommt mit hundert Prozent an; das ist
 * die Aussage des Abschnitts, und sie steht in den Zahlen, nicht im Text.
 *
 * Das Leben der Löwin endet nicht hier, sondern am Zaun mit den Scheinwerfern — dort kommen zum
 * ersten Mal Menschen im Spiel vor.
 */
export class Level03State extends TimedLevelScene {
  private graphics!: Phaser.GameObjects.Graphics
  private player = new Phaser.Math.Vector2(KILL_X, 560)
  private velocity = new Phaser.Math.Vector2()
  private cargo = CARGO_START
  private droppedAt: Array<{ x: number; y: number }> = []
  private rivals: Rival[] = []
  private waveAt = 5_200
  private waveIndex = 0
  private trail: Trail | null = null
  private cubNeed = 0.9
  private delivered = 0
  private defendedMs = 0
  private phase = 0
  private phaseStartedAt = 0
  private sampleClock = 0
  private safetyNetApplied = false
  private sparks = new Sparks()
  private objectiveHud!: ObjectiveHud
  private goal!: GoalTracker

  constructor() {
    super('Level03')
  }

  create(): void {
    this.player.set(KILL_X, 560)
    this.velocity.set(0, 0)
    this.cargo = CARGO_START
    this.droppedAt = []
    this.rivals = []
    this.waveAt = 4_000
    this.waveIndex = 0
    this.trail = null
    this.cubNeed = 0.9
    this.delivered = 0
    this.defendedMs = 0
    this.phase = 0
    this.phaseStartedAt = 0
    this.sampleClock = 0
    this.safetyNetApplied = false
    this.sparks = new Sparks()
    this.graphics = this.add.graphics()
    this.objectiveHud = new ObjectiveHud(this)
    this.goal = new GoalTracker(this.objectiveHud, {
      label: 'Heimweg', target: STAGE_TARGET, bufferLabel: 'Last',
    })
    this.objectiveHud.setSecondary('Sie', this.cubNeed)
    this.cameras.main.setBackgroundColor(0x0b0a08)
    this.beginTimedLevel('Level03', levels.level03, 'AUSSCHNITT · 03', 'Zieh sie nach Hause.', 'care', {
      goal: 'Bring so viel wie möglich heim. Ziehen bringt Weg, Stehenbleiben wehrt sie ab — beides kostet.',
      controls: 'WASD / Pfeiltasten · Maus oder Berührung',
    })
  }

  update(time: number, delta: number): void {
    if (this.finished) return
    const progress = this.advanceLevel(delta)
    if (this.finished || progress < 0) return
    this.goal.advance(delta)
    this.applySafetyNet()
    this.updatePhase(delta)
    this.updatePlayer(delta)
    if (this.phase === 0) {
      this.updateRivals(delta)
      this.updateProgress()
    }
    this.objectiveHud.setSecondary('Sie', this.cubNeed)
    this.sample(delta)
    this.drawWorld(time)
  }

  protected applyHint(level: AssistanceLevel): void {
    this.services.setAssistance(level)
    if (level === 1) this.services.ui.setHint('Die Konkurrenten kündigen sich deutlicher an.')
    if (level === 2) this.services.ui.setHint('Stehenbleiben wehrt sie schneller ab.')
    if (level === 3) this.services.ui.setHint('Sie nehmen seltener etwas mit.')
  }

  protected collectResult(): LevelResult {
    const trail = this.trail ?? (this.player.y < 560 ? 'warm' : 'cool')
    return {
      choices: {
        trail,
        approach: trail === 'warm' ? 'upper' : 'lower',
        grade: this.homeGrade(),
      },
      metrics: {
        ...this.goal.metrics(this.elapsedMs, this.levelConfig.expectedDurationMs),
        delivered: this.delivered,
        cargoStart: CARGO_START,
        lostPieces: CARGO_START - this.delivered,
        cubNeed: this.cubNeed,
        defendedRatio: this.elapsedMs ? this.defendedMs / this.elapsedMs : 0,
      },
    }
  }

  /** Bewertet wird, was ankommt — und in welchem Zustand die Jungen sind. */
  private homeGrade(): 'knapp' | 'solide' | 'stark' {
    const score = this.delivered / CARGO_START * 0.7 + this.cubNeed * 0.3
    if (score >= 0.86) return 'stark'
    if (score >= 0.62) return 'solide'
    return 'knapp'
  }

  private timeScale(): number {
    return this.services.getTimeScale()
  }

  private applySafetyNet(): void {
    if (this.safetyNetApplied || this.phase !== 0) return
    if (this.elapsedMs < this.maximumDurationMs * 0.76) return
    this.safetyNetApplied = true
    while (this.hintManager.getLevel() < 3) this.hintManager.forceNext()
  }

  private updatePhase(delta: number): void {
    const scale = this.timeScale()
    if (this.phase === 0) {
      // Die Jungen warten und werden schwächer, während man unterwegs ist.
      this.cubNeed = Phaser.Math.Clamp(this.cubNeed - (delta / scale) * 0.000021, 0, 1)
      if (this.player.x <= DEN_X + 60) {
        this.phase = 1
        this.phaseStartedAt = this.elapsedMs
        this.delivered = this.cargo
        this.cubNeed = Phaser.Math.Clamp(this.cubNeed + this.delivered * 0.035, 0, 1)
        this.goal.setValue(STAGE_TARGET)
        this.sparks.emit(DEN_X, 560, palette.licht, 220, 1_100)
        this.services.ui.setInstruction('')
        this.services.audio.playMotif('group', 0.2)
      }
      return
    }
    if (this.phase === 1 && this.elapsedMs - this.phaseStartedAt >= 6_000 * scale) {
      this.phase = 2
      this.phaseStartedAt = this.elapsedMs
      this.services.ui.setInstruction('')
      this.services.ui.setHint('')
      this.services.audio.pulse(58, 0.09)
      return
    }
    if (this.phase === 2 && this.elapsedMs - this.phaseStartedAt >= 7_000 * scale) this.finishLevel()
  }

  private updatePlayer(delta: number): void {
    if (this.phase > 0) {
      this.velocity.scale(0.9)
      return
    }
    const input = this.inputManager.getVector(this.player.x, this.player.y)
    const frameScale = Phaser.Math.Clamp(delta / 16.667, 0.4, 2.4)
    // Je mehr man noch trägt, desto schwerer geht es.
    const load = this.cargo / CARGO_START
    const power = Phaser.Math.Linear(0.66, 0.3, load)
    if (input.active) {
      this.velocity.x += input.x * power * frameScale
      this.velocity.y += input.y * power * frameScale
      const direction: Direction = input.x < -0.2 ? 'left' : input.x > 0.2 ? 'right' : 'center'
      this.services.telemetry.recordDirection(direction)
    }
    const maxSpeed = Phaser.Math.Linear(3.6, 1.8, load)
    this.velocity.scale(Math.pow(0.88, frameScale)).limit(maxSpeed)
    this.player.x = Phaser.Math.Clamp(this.player.x + this.velocity.x * frameScale, DEN_X, KILL_X)
    this.player.y = Phaser.Math.Clamp(this.player.y + this.velocity.y * frameScale, 250, 880)

    if (!this.trail && this.player.x < 1_380) this.trail = this.player.y < 560 ? 'warm' : 'cool'
    if (this.velocity.length() < DEFEND_SPEED) this.defendedMs += delta
  }

  private updateProgress(): void {
    const covered = Phaser.Math.Clamp((KILL_X - this.player.x) / (KILL_X - DEN_X), 0, 1)
    const stage = Math.floor(covered * STAGE_TARGET)
    if (stage > this.goal.value) {
      this.goal.setValue(stage)
      this.services.audio.pulse(178 + stage * 9, 0.03)
    }
    this.goal.resetBuffer(this.cargo / CARGO_START)
  }

  private updateRivals(delta: number): void {
    const scale = this.timeScale()
    this.waveAt -= delta / scale
    if (this.waveAt <= 0) {
      this.spawnWave()
      this.waveAt = WAVE_INTERVAL_MS
    }

    const frameScale = Phaser.Math.Clamp(delta / 16.667, 0.4, 2.4)
    const standing = this.velocity.length() < DEFEND_SPEED
    const holdNeeded = (this.hintManager.getLevel() >= 2 ? 1_700 : 2_400) * scale
    const snatchChance = this.hintManager.getLevel() >= 3 ? 0.45 : 1

    this.rivals.forEach((rival) => {
      if (rival.state === 'weicht') {
        const away = new Phaser.Math.Vector2(rival.x - this.player.x, rival.y - this.player.y).normalize()
        rival.x += away.x * 3.4 * frameScale
        rival.y += away.y * 3.4 * frameScale
        return
      }
      const toPlayer = new Phaser.Math.Vector2(this.player.x - rival.x, this.player.y - rival.y)
      const distance = toPlayer.length()
      if (distance > SNATCH_RANGE) {
        rival.state = 'kommt'
        rival.holdMs = 0
        toPlayer.normalize()
        rival.x += toPlayer.x * 4.3 * frameScale
        rival.y += toPlayer.y * 4.3 * frameScale
        return
      }
      // In Reichweite entscheidet sich alles daran, ob man sich bewegt.
      if (standing) {
        rival.state = 'zoegert'
        rival.holdMs += delta
        if (rival.holdMs >= holdNeeded) {
          rival.state = 'weicht'
          this.services.audio.pulse(120, 0.03)
        }
        return
      }
      rival.state = 'weicht'
      rival.holdMs = 0
      if (this.cargo > 0 && Math.random() < snatchChance) {
        this.cargo -= 1
        this.droppedAt.push({ x: this.player.x, y: this.player.y })
        this.sparks.emit(this.player.x, this.player.y, palette.gefahr, 110, 620)
        this.services.audio.pulse(72, 0.07)
        this.cameras.main.shake(200, 0.004)
      }
    })
    this.rivals = this.rivals.filter(
      (rival) => rival.x > -260 && rival.x < GAME_WIDTH + 260 && rival.y > -260 && rival.y < GAME_HEIGHT + 260,
    )
  }

  private spawnWave(): void {
    this.waveIndex += 1
    const count = this.waveIndex < 2 ? 1 : this.waveIndex < 4 ? 2 : 3
    for (let index = 0; index < count; index += 1) {
      const fromTop = (this.waveIndex + index) % 2 === 0
      this.rivals.push({
        x: this.player.x + (index % 2 === 0 ? -560 : 620) + index * 90,
        y: fromTop ? -140 : GAME_HEIGHT + 140,
        state: 'kommt',
        holdMs: 0,
      })
    }
    this.services.audio.pulse(96, 0.035)
    this.services.ui.setInstruction(this.waveIndex === 1 ? 'Bleib stehen, dann weichen sie.' : 'Zieh weiter oder stell dich.')
  }

  private sample(delta: number): void {
    this.sampleClock += delta
    if (this.sampleClock < 110) return
    this.services.telemetry.sample(
      (this.player.x - 960) / 810, this.velocity.length() / 8, this.velocity.length() < DEFEND_SPEED, this.sampleClock,
    )
    this.sampleClock = 0
  }

  private drawWorld(time: number): void {
    const g = this.graphics
    g.clear()
    ground(g, 0x0b0a08, this.trail === 'cool' ? 0x121a1c : 0x1e1710)
    dust(g, time, 44, 0xe0d3b6, 0.014)

    // Die zwei Wege: offenes Gras oben, ausgetrocknetes Flussbett unten.
    g.lineStyle(2, 0xd8a86a, this.trail === 'warm' ? 0.14 : 0.06)
    g.lineBetween(DEN_X, 430, KILL_X, 400)
    g.lineStyle(2, 0x82b3bd, this.trail === 'cool' ? 0.14 : 0.06)
    g.lineBetween(DEN_X, 720, KILL_X, 760)

    // Der Bau mit den Jungen.
    glowEllipse(g, DEN_X, 560, 420, 340, palette.licht, 0.12 + this.cubNeed * 0.16)
    for (let index = 0; index < 3; index += 1) {
      const x = DEN_X - 40 + index * 46
      const y = 500 + index * 46
      const pulse = 1 + Math.sin(time * 0.003 + index * 1.6) * 0.16
      g.lineStyle(5, this.cubNeed < 0.35 ? 0xd98b5c : 0xefca88, 0.5 + this.cubNeed * 0.4)
      g.strokeCircle(x, y, 20 * pulse)
      g.fillStyle(0xf0d49a, 0.7)
      g.fillCircle(x, y, 6)
    }

    // Was unterwegs liegen blieb.
    this.droppedAt.forEach((piece) => {
      glow(g, piece.x, piece.y, 46, palette.gefahr, 0.12)
      g.fillStyle(0x7a4a30, 0.6)
      g.fillEllipse(piece.x, piece.y, 26, 14)
    })

    if (this.phase === 0) this.drawRivals(g, time)

    // Die Last am eigenen Körper.
    if (this.cargo > 0 && this.phase === 0) {
      const size = 34 + (this.cargo / CARGO_START) * 40
      g.fillStyle(0x2a1b12, 0.92)
      g.fillEllipse(this.player.x + 46, this.player.y + 18, size * 1.7, size)
      g.lineStyle(2.4, 0x9a7550, 0.7)
      g.strokeEllipse(this.player.x + 46, this.player.y + 18, size * 1.7, size)
    }
    drawSelf(g, this.player.x, this.player.y, time, this.phase === 0 ? 1 : 0.8)
    this.sparks.draw(g)

    if (this.phase >= 2) this.drawFence(g)
    vignette(g, 0.42)
  }

  private drawRivals(g: Phaser.GameObjects.Graphics, time: number): void {
    this.rivals.forEach((rival, index) => {
      const colour = rival.state === 'zoegert' ? 0x8d6a52 : palette.gefahr
      glow(g, rival.x, rival.y, 92, colour, rival.state === 'weicht' ? 0.1 : 0.2)
      g.fillStyle(0x120c0a, 0.9)
      g.fillEllipse(rival.x, rival.y, 66, 34)
      g.lineStyle(2.6, colour, 0.8)
      g.strokeEllipse(rival.x, rival.y, 66, 34)
      if (rival.state === 'kommt') {
        g.lineStyle(2, colour, 0.28)
        g.lineBetween(rival.x, rival.y, this.player.x, this.player.y)
      }
      if (rival.state === 'zoegert') {
        const pulse = 1 + Math.sin(time * 0.008 + index) * 0.2
        g.lineStyle(3, 0xd8c49a, 0.4)
        g.strokeCircle(rival.x, rival.y, 52 * pulse)
      }
    })
  }

  /** Das Ende der Löwin: harte senkrechte Linien und ein Licht, das nicht zur Landschaft gehört. */
  private drawFence(g: Phaser.GameObjects.Graphics): void {
    const local = Phaser.Math.Clamp((this.elapsedMs - this.phaseStartedAt) / (7_000 * this.timeScale()), 0, 1)
    for (let x = 1_180; x < GAME_WIDTH + 120; x += 78) {
      g.lineStyle(4, 0xb8c1bd, 0.1 + local * 0.4)
      g.lineBetween(x, 140, x, GAME_HEIGHT - 60)
    }
    glowEllipse(g, 1_640, 520, 900 * local, 700 * local, 0xe9f2ff, 0.3 * local)
    g.fillStyle(0xf4f8ff, 0.5 + local * 0.45)
    g.fillCircle(1_640, 520, 16 + local * 22)
    g.fillStyle(0x000000, Math.max(0, local - 0.68) * 3.1)
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
  }
}

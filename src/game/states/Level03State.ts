import Phaser from 'phaser'
import { ObjectiveHud } from '../components/ObjectiveHud'
import { GAME_HEIGHT, GAME_WIDTH } from '../config/gameConfig'
import { levels } from '../config/levels'
import { GoalTracker } from '../systems/GoalTracker'
import type { AssistanceLevel, Direction, LevelResult } from '../types'
import { TimedLevelScene } from './TimedLevelScene'
import { dust, glow, glowEllipse, ground, palette, self as drawSelf, Sparks, vignette } from '../visuals'

type Trail = 'warm' | 'cool'

interface Cub {
  x: number
  y: number
  homeX: number
  homeY: number
  need: number
  eating: number
  phase: number
}

interface Rival {
  x: number
  y: number
  /** Ab wann es zupackt. Bis dahin kann man es vertreiben. */
  grabAt: number
  fleeing: boolean
}

const CARGO_START = 10
const STAGE_TARGET = 10
const DEN_X = 300
const KILL_X = 1_700
const FENCE_X = 1_420
const REACH = 235
const GRAB_MS = 1_500
const WAVE_INTERVAL_MS = 4_600
const HUNGER_RATE = 0.000015

/**
 * Versorge · „Heimbringen".
 *
 * Drei Junge am Bau, jedes mit eigenem Hunger, der sichtbar sinkt. Man schleppt die Beute heim, sie
 * fressen davon, die Balken steigen — und sinken gleich wieder. Deshalb muss man noch einmal los.
 * Das ist der Kreislauf, den dieser Abschnitt spielt.
 *
 * Unterwegs kommen Konkurrenten. **Verteidigt wird mit der Leertaste**, nicht mit Stehenbleiben:
 * Wer nicht rechtzeitig reagiert, verliert ein Stück. Eine frühere Fassung liess sich einfach
 * durchlaufen — man konnte die Angreifer ignorieren, und die Entscheidung war keine.
 *
 * Der zweite Gang führt über einen Zaun. Dahinter liegt das Nächste, und man fragt nicht, was es
 * ist. Dort kommen zum ersten Mal Menschen im Spiel vor.
 */
export class Level03State extends TimedLevelScene {
  private graphics!: Phaser.GameObjects.Graphics
  private player = new Phaser.Math.Vector2(KILL_X, 560)
  private velocity = new Phaser.Math.Vector2()
  private cargo = CARGO_START
  private droppedAt: Array<{ x: number; y: number }> = []
  private cubs: Cub[] = []
  private rivals: Rival[] = []
  private waveAt = 4_200
  private waveIndex = 0
  private trail: Trail | null = null
  private delivered = 0
  private fedAtDelivery = 0
  private repelled = 0
  private crossedFence = false
  private feedQueue = 0
  private nextFeedAt = 0
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
    this.cubs = [
      { x: 250, y: 470, homeX: 250, homeY: 470, need: 0.44, eating: 0, phase: 0.4 },
      { x: 330, y: 585, homeX: 330, homeY: 585, need: 0.32, eating: 0, phase: 2.1 },
      { x: 245, y: 700, homeX: 245, homeY: 700, need: 0.52, eating: 0, phase: 4.0 },
    ]
    this.rivals = []
    this.waveAt = 3_000
    this.waveIndex = 0
    this.trail = null
    this.delivered = 0
    this.fedAtDelivery = 0
    this.repelled = 0
    this.crossedFence = false
    this.feedQueue = 0
    this.nextFeedAt = 0
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
    this.objectiveHud.setSecondary('Sie', this.averageNeed())
    this.cameras.main.setBackgroundColor(0x0b0a08)
    this.beginTimedLevel('Level03', levels.level03, 'AUSSCHNITT · 03', 'Zieh sie nach Hause.', 'care', {
      goal: 'Drei warten und werden schwächer. Zieh die Beute heim — und wehr die Konkurrenten mit der Leertaste ab.',
      controls: 'WASD / Pfeiltasten · Leertaste: verteidigen',
    })
  }

  update(time: number, delta: number): void {
    if (this.finished) return
    const progress = this.advanceLevel(delta)
    if (this.finished || progress < 0) return
    this.goal.advance(delta)
    this.applySafetyNet()
    this.updateCubs(delta, time)
    this.updatePhase(delta)
    this.updatePlayer(delta)
    if (this.phase === 0) {
      this.updateRivals(delta)
      this.updateProgress()
    }
    this.objectiveHud.setSecondary('Sie', this.averageNeed())
    this.sample(delta)
    this.drawWorld(time)
  }

  protected applyHint(level: AssistanceLevel): void {
    this.services.setAssistance(level)
    if (level === 1) this.services.ui.setHint('Leertaste, sobald einer heran ist.')
    if (level === 2) this.services.ui.setHint('Du hast mehr Zeit zum Reagieren.')
    if (level === 3) this.services.ui.setHint('Sie kommen seltener und langsamer.')
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
        repelled: this.repelled,
        cubNeed: this.fedAtDelivery,
        crossedFence: this.crossedFence ? 1 : 0,
      },
    }
  }

  /** Bewertet wird, was ankommt — und wie satt sie danach sind. */
  private homeGrade(): 'knapp' | 'solide' | 'stark' {
    const score = this.delivered / CARGO_START * 0.6 + this.fedAtDelivery * 0.4
    if (score >= 0.82) return 'stark'
    if (score >= 0.58) return 'solide'
    return 'knapp'
  }

  private timeScale(): number {
    return this.services.getTimeScale()
  }

  private averageNeed(): number {
    return this.cubs.reduce((sum, cub) => sum + cub.need, 0) / Math.max(1, this.cubs.length)
  }

  private applySafetyNet(): void {
    if (this.safetyNetApplied || this.phase !== 0) return
    if (this.elapsedMs < this.maximumDurationMs * 0.76) return
    this.safetyNetApplied = true
    while (this.hintManager.getLevel() < 3) this.hintManager.forceNext()
  }

  /** Die Jungen bewegen sich, werden hungriger — und fressen sichtbar, wenn etwas ankommt. */
  private updateCubs(delta: number, time: number): void {
    const step = delta / this.timeScale()
    this.cubs.forEach((cub, index) => {
      const restless = 1 - cub.need
      cub.x = cub.homeX + Math.sin(time * 0.0009 + cub.phase) * (14 + restless * 26)
      cub.y = cub.homeY + Math.cos(time * 0.0011 + cub.phase * 1.6) * (10 + restless * 20)
      cub.eating = Math.max(0, cub.eating - delta)
      if (this.phase >= 3) return
      cub.need = Phaser.Math.Clamp(cub.need - step * HUNGER_RATE * (1 + index * 0.12), 0, 1)
    })

    // Die Übergabe läuft Stück für Stück, damit man sieht, dass sie fressen.
    if (this.feedQueue <= 0 || this.elapsedMs < this.nextFeedAt) return
    const hungriest = [...this.cubs].sort((a, b) => a.need - b.need)[0]
    hungriest.need = Phaser.Math.Clamp(hungriest.need + 0.13, 0, 1)
    hungriest.eating = 520 * this.timeScale()
    this.feedQueue -= 1
    this.nextFeedAt = this.elapsedMs + 340 * this.timeScale()
    this.sparks.emit(hungriest.x, hungriest.y, palette.licht, 90, 520)
    this.services.audio.pulse(206 + (this.feedQueue % 4) * 22, 0.04)
  }

  private updatePhase(delta: number): void {
    const scale = this.timeScale()
    if (this.phase === 0) {
      if (this.player.x <= DEN_X + 90) {
        this.phase = 1
        this.phaseStartedAt = this.elapsedMs
        this.delivered = this.cargo
        this.feedQueue = this.cargo
        this.nextFeedAt = this.elapsedMs + 300 * scale
        this.cargo = 0
        this.goal.setValue(STAGE_TARGET)
        this.goal.resetBuffer(0)
        this.services.ui.setInstruction('Sie fressen.')
        this.services.audio.playMotif('group', 0.2)
      }
      return
    }
    if (this.phase === 1) {
      if (this.feedQueue <= 0 && this.fedAtDelivery === 0) this.fedAtDelivery = this.averageNeed()
      if (this.feedQueue <= 0 && this.elapsedMs - this.phaseStartedAt >= 4_200 * scale) {
        this.phase = 2
        this.phaseStartedAt = this.elapsedMs
        this.goal.relabel('Nochmal', 1)
        this.goal.setValue(0)
        this.services.ui.setInstruction('Sie werden schon wieder schwächer. Geh noch einmal.')
        this.services.ui.setHint('Draußen rechts bewegt sich etwas.')
        this.services.audio.playMotif('care', 0.16)
      }
      return
    }
    if (this.phase === 2) {
      if (this.player.x >= FENCE_X + 40) {
        this.crossedFence = true
        this.phase = 3
        this.phaseStartedAt = this.elapsedMs
        this.goal.setValue(1)
        this.services.ui.setInstruction('')
        this.services.ui.setHint('')
        this.services.audio.pulse(58, 0.09)
      } else if (this.elapsedMs - this.phaseStartedAt >= 18_000 * scale) {
        this.phase = 3
        this.phaseStartedAt = this.elapsedMs
        this.services.ui.setInstruction('')
        this.services.ui.setHint('')
      }
      return
    }
    if (this.phase === 3 && this.elapsedMs - this.phaseStartedAt >= 7_000 * scale) this.finishLevel()
    void delta
  }

  private updatePlayer(delta: number): void {
    if (this.phase === 1 || this.phase >= 3) {
      this.velocity.scale(0.9)
      return
    }
    const input = this.inputManager.getVector(this.player.x, this.player.y)
    const frameScale = Phaser.Math.Clamp(delta / 16.667, 0.4, 2.4)
    const load = this.phase === 2 ? 0 : this.cargo / CARGO_START
    const power = Phaser.Math.Linear(0.6, 0.2, load)
    if (input.active) {
      this.velocity.x += input.x * power * frameScale
      this.velocity.y += input.y * power * frameScale
      const direction: Direction = input.x < -0.2 ? 'left' : input.x > 0.2 ? 'right' : 'center'
      this.services.telemetry.recordDirection(direction)
    }
    const maxSpeed = Phaser.Math.Linear(4.2, 1.1, load)
    this.velocity.scale(Math.pow(0.89, frameScale)).limit(maxSpeed)
    const limitRight = this.phase === 2 ? FENCE_X + 60 : KILL_X
    this.player.x = Phaser.Math.Clamp(this.player.x + this.velocity.x * frameScale, DEN_X - 40, limitRight)
    this.player.y = Phaser.Math.Clamp(this.player.y + this.velocity.y * frameScale, 250, 880)
    if (!this.trail && this.player.x < 1_320) this.trail = this.player.y < 560 ? 'warm' : 'cool'
  }

  private grabWindow(): number {
    const assist = this.hintManager.getLevel()
    return (GRAB_MS + (assist >= 2 ? 700 : 0)) * this.timeScale()
  }

  private updateRivals(delta: number): void {
    const scale = this.timeScale()
    this.waveAt -= delta / scale
    if (this.waveAt <= 0) {
      this.spawnWave()
      this.waveAt = WAVE_INTERVAL_MS * (this.hintManager.getLevel() >= 3 ? 1.5 : 1)
    }

    // Verteidigen ist eine eigene Taste. Wer nicht reagiert, verliert etwas.
    const defends = this.inputManager.justActionDown()
    const frameScale = Phaser.Math.Clamp(delta / 16.667, 0.4, 2.4)
    let repelledOne = false

    this.rivals.forEach((rival) => {
      if (rival.fleeing) {
        const away = new Phaser.Math.Vector2(rival.x - this.player.x, rival.y - this.player.y).normalize()
        rival.x += away.x * 5.2 * frameScale
        rival.y += away.y * 5.2 * frameScale
        return
      }
      const toPlayer = new Phaser.Math.Vector2(this.player.x - rival.x, this.player.y - rival.y)
      const distance = toPlayer.length()
      if (distance > REACH) {
        rival.grabAt = 0
        toPlayer.normalize()
        rival.x += toPlayer.x * 3.9 * frameScale
        rival.y += toPlayer.y * 3.9 * frameScale
        return
      }
      if (rival.grabAt === 0) {
        rival.grabAt = this.elapsedMs + this.grabWindow()
        this.services.audio.pulse(104, 0.03)
      }
      if (defends && !repelledOne) {
        repelledOne = true
        rival.fleeing = true
        this.repelled += 1
        this.sparks.emit(rival.x, rival.y, palette.licht, 130, 560)
        this.services.audio.pulse(188, 0.05)
        return
      }
      if (this.elapsedMs < rival.grabAt) return
      rival.fleeing = true
      if (this.cargo > 0) {
        this.cargo -= 1
        this.droppedAt.push({ x: this.player.x, y: this.player.y })
        this.sparks.emit(this.player.x, this.player.y, palette.gefahr, 120, 620)
        this.services.audio.pulse(70, 0.08)
        this.cameras.main.shake(220, 0.005)
      }
    })

    this.rivals = this.rivals.filter(
      (rival) => rival.x > -300 && rival.x < GAME_WIDTH + 300 && rival.y > -300 && rival.y < GAME_HEIGHT + 300,
    )
  }

  private spawnWave(): void {
    this.waveIndex += 1
    const count = this.waveIndex < 3 ? 1 : 2
    for (let index = 0; index < count; index += 1) {
      const fromTop = (this.waveIndex + index) % 2 === 0
      this.rivals.push({
        x: this.player.x + (index % 2 === 0 ? -520 : 580),
        y: fromTop ? -160 : GAME_HEIGHT + 160,
        grabAt: 0,
        fleeing: false,
      })
    }
    if (this.waveIndex === 1) this.services.ui.setInstruction('Leertaste, wenn einer heran ist.')
    else if (this.waveIndex === 2) this.services.ui.setInstruction('Zieh weiter nach links.')
  }

  private updateProgress(): void {
    const covered = Phaser.Math.Clamp((KILL_X - this.player.x) / (KILL_X - DEN_X), 0, 1)
    const stage = Math.floor(covered * STAGE_TARGET)
    if (stage > this.goal.value) {
      this.goal.setValue(stage)
      this.services.audio.pulse(176 + stage * 9, 0.03)
    }
    this.goal.resetBuffer(this.cargo / CARGO_START)
  }

  private sample(delta: number): void {
    this.sampleClock += delta
    if (this.sampleClock < 110) return
    this.services.telemetry.sample(
      (this.player.x - 960) / 810, this.velocity.length() / 8, this.averageNeed() > 0.5, this.sampleClock,
    )
    this.sampleClock = 0
  }

  private drawWorld(time: number): void {
    const g = this.graphics
    g.clear()
    ground(g, 0x0b0a08, this.trail === 'cool' ? 0x121a1c : 0x1e1710)
    dust(g, time, 44, 0xe0d3b6, 0.014)

    g.lineStyle(2, 0xd8a86a, this.trail === 'warm' ? 0.14 : 0.06)
    g.lineBetween(DEN_X, 430, KILL_X, 400)
    g.lineStyle(2, 0x82b3bd, this.trail === 'cool' ? 0.14 : 0.06)
    g.lineBetween(DEN_X, 720, KILL_X, 760)

    this.drawCubs(g, time)
    this.droppedAt.forEach((piece) => {
      glow(g, piece.x, piece.y, 48, palette.gefahr, 0.12)
      g.fillStyle(0x7a4a30, 0.6)
      g.fillEllipse(piece.x, piece.y, 26, 14)
    })

    if (this.phase >= 2) this.drawFence(g)
    if (this.phase === 2) this.drawNextPrey(g, time)
    if (this.phase === 0) this.drawRivals(g)

    if (this.cargo > 0 && this.phase === 0) {
      const size = 30 + (this.cargo / CARGO_START) * 42
      g.fillStyle(0x2a1b12, 0.92)
      g.fillEllipse(this.player.x + 48, this.player.y + 18, size * 1.7, size)
      g.lineStyle(2.4, 0x9a7550, 0.7)
      g.strokeEllipse(this.player.x + 48, this.player.y + 18, size * 1.7, size)
    }
    drawSelf(g, this.player.x, this.player.y, time, this.phase === 0 ? 1 : 0.85)
    this.sparks.draw(g)
    vignette(g, 0.42)
  }

  /** Drei Junge, jedes mit eigenem Balken: leer, satt, wieder leer. Das ist die Aufgabe. */
  private drawCubs(g: Phaser.GameObjects.Graphics, time: number): void {
    glowEllipse(g, DEN_X - 20, 585, 520, 460, palette.licht, 0.06 + this.averageNeed() * 0.1)
    this.cubs.forEach((cub, index) => {
      const hungry = cub.need < 0.35
      const colour = hungry ? 0xd98b5c : 0xefca88
      const pulse = 1 + Math.sin(time * (hungry ? 0.006 : 0.0028) + index * 1.7) * 0.14
      glow(g, cub.x, cub.y, 92 + cub.eating * 0.08, colour, 0.1 + cub.need * 0.2)
      // Lebensbalken als Ring: fällt sichtbar, steigt beim Fressen.
      g.lineStyle(7, 0x241c14, 0.7)
      g.strokeCircle(cub.x, cub.y, 30)
      g.lineStyle(7, colour, 0.92)
      g.beginPath()
      g.arc(cub.x, cub.y, 30, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * cub.need, false)
      g.strokePath()
      g.fillStyle(cub.eating > 0 ? 0xfff2d2 : 0xf0d49a, 0.85)
      g.fillCircle(cub.x, cub.y, 8 * pulse)
      if (cub.eating > 0) {
        g.lineStyle(3, palette.licht, Phaser.Math.Clamp(cub.eating / 400, 0, 1) * 0.7)
        g.strokeCircle(cub.x, cub.y, 44)
      }
      if (hungry && this.phase < 3) {
        g.lineStyle(2, colour, 0.2 + Math.sin(time * 0.007 + index) * 0.12)
        g.strokeCircle(cub.x, cub.y, 52 * pulse)
      }
    })
  }

  private drawRivals(g: Phaser.GameObjects.Graphics): void {
    this.rivals.forEach((rival) => {
      const waiting = !rival.fleeing && rival.grabAt > 0
      const left = waiting ? Phaser.Math.Clamp((rival.grabAt - this.elapsedMs) / this.grabWindow(), 0, 1) : 1
      const colour = rival.fleeing ? 0x8d6a52 : palette.gefahr
      glow(g, rival.x, rival.y, 96, colour, rival.fleeing ? 0.08 : 0.22)
      g.fillStyle(0x120c0a, 0.9)
      g.fillEllipse(rival.x, rival.y, 68, 34)
      g.lineStyle(2.6, colour, 0.85)
      g.strokeEllipse(rival.x, rival.y, 68, 34)
      if (!rival.fleeing && rival.grabAt === 0) {
        g.lineStyle(2, colour, 0.26)
        g.lineBetween(rival.x, rival.y, this.player.x, this.player.y)
      }
      // Der zulaufende Ring ist die Zeit, die zum Verteidigen bleibt.
      if (!waiting) return
      g.lineStyle(5, 0xf3d9a8, 0.85)
      g.strokeCircle(rival.x, rival.y, 40 + left * 62)
      g.lineStyle(2, 0xf3d9a8, 0.3)
      g.strokeCircle(rival.x, rival.y, 40)
    })
  }

  /** Das Nächste liegt draußen und bewegt sich — damit klar ist, dass es Beute ist. */
  private drawNextPrey(g: Phaser.GameObjects.Graphics, time: number): void {
    const x = FENCE_X + 190 + Math.sin(time * 0.0011) * 60
    const y = 540 + Math.cos(time * 0.0014) * 90
    glowEllipse(g, x, y, 260, 200, palette.licht, 0.22)
    g.fillStyle(0xf6dda0, 0.9)
    g.fillEllipse(x, y, 46, 24)
    g.lineStyle(2, palette.licht, 0.3)
    g.lineBetween(this.player.x, this.player.y, x, y)
  }

  private drawFence(g: Phaser.GameObjects.Graphics): void {
    const lit = this.phase >= 3
      ? Phaser.Math.Clamp((this.elapsedMs - this.phaseStartedAt) / (7_000 * this.timeScale()), 0, 1)
      : 0
    for (let y = 150; y < GAME_HEIGHT - 60; y += 46) {
      g.lineStyle(3, 0xb8c1bd, 0.18 + lit * 0.42)
      g.lineBetween(FENCE_X, y, FENCE_X + 26, y + 26)
    }
    g.lineStyle(4, 0xb8c1bd, 0.26 + lit * 0.5)
    g.lineBetween(FENCE_X, 150, FENCE_X, GAME_HEIGHT - 60)
    if (lit <= 0) return
    glowEllipse(g, 1_700, 520, 1_100 * lit, 820 * lit, 0xe9f2ff, 0.34 * lit)
    g.fillStyle(0xf4f8ff, 0.5 + lit * 0.45)
    g.fillCircle(1_700, 520, 16 + lit * 24)
    g.fillStyle(0x000000, Math.max(0, lit - 0.68) * 3.1)
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
  }
}

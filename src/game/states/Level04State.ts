import Phaser from 'phaser'
import { ObjectiveHud } from '../components/ObjectiveHud'
import { GAME_HEIGHT, GAME_WIDTH } from '../config/gameConfig'
import { levels } from '../config/levels'
import type { AssistanceLevel, Direction, LevelResult } from '../types'
import { TimedLevelScene } from './TimedLevelScene'

type Route = 'upper' | 'lower'

export class Level04State extends TimedLevelScene {
  private graphics!: Phaser.GameObjects.Graphics
  private player = new Phaser.Math.Vector2(280, 560)
  private velocity = new Phaser.Math.Vector2()
  private parent = new Phaser.Math.Vector2(390, 540)
  private route: Route | null = null
  private phase = 0
  private phaseStartedAt = 0
  private nearParentMs = 0
  private warningStartedAt = 0
  private reactionMs = 0
  private reacted = false
  private reversals = 0
  private lastHorizontal: Direction = 'center'
  private leaveDelayMs = 0
  private parentStoppedAt = 0
  private leftParent = false
  private sampleClock = 0
  private clarity = 1
  private clarityTotal = 0
  private claritySamples = 0
  private minimumClarity = 1
  private smokeContacts = 0
  private smokeCooldown = 0
  private objectiveHud!: ObjectiveHud

  constructor() {
    super('Level04')
  }

  create(): void {
    this.player.set(280, 560)
    this.velocity.set(0, 0)
    this.parent.set(390, 540)
    this.route = null
    this.phase = 0
    this.phaseStartedAt = 0
    this.nearParentMs = 0
    this.warningStartedAt = 0
    this.reactionMs = 0
    this.reacted = false
    this.reversals = 0
    this.lastHorizontal = 'center'
    this.leaveDelayMs = 0
    this.parentStoppedAt = 0
    this.leftParent = false
    this.sampleClock = 0
    this.clarity = 1
    this.clarityTotal = 0
    this.claritySamples = 0
    this.minimumClarity = 1
    this.smokeContacts = 0
    this.smokeCooldown = 0
    this.graphics = this.add.graphics()
    this.objectiveHud = new ObjectiveHud(this)
    this.cameras.main.setBackgroundColor(0x070707)
    this.beginTimedLevel('Level04', levels.level04, 'AUSSCHNITT · 04', 'Bleibe bei dem Signal.', 'memory', {
      goal: 'Bleibe beim Begleitsignal, wähle einen Korridor und erreiche den Ausgang.',
      controls: 'WASD / Pfeiltasten · Maus oder Berührung',
    })
  }

  update(time: number, delta: number): void {
    if (this.finished) return
    const progress = this.advanceLevel(delta)
    if (this.finished || progress < 0) return
    this.updatePhase()
    this.updateParent(delta)
    this.updatePlayer(delta)
    this.updateTelemetry(delta)
    this.updateObjectiveHud()
    this.drawWorld(time, this.getVisualProgress())
  }

  protected applyHint(level: AssistanceLevel): void {
    this.services.setAssistance(level)
    if (level === 1) this.services.ui.setHint('Begleitsignal und freie Korridore pulsieren deutlicher.')
    if (level === 2) this.services.ui.setHint('Eine Linie weist zum nächsten freien Bereich.')
    if (level === 3) this.services.ui.setHint('Begleitsignal, Ziel und sichere Korridore werden maximal deutlich.')
  }

  protected collectResult(): LevelResult {
    return {
      choices: { route: this.route ?? (this.player.y < GAME_HEIGHT / 2 ? 'upper' : 'lower') },
      metrics: {
        reactionMs: this.reactionMs,
        nearParentRatio: this.elapsedMs ? this.nearParentMs / this.elapsedMs : 0,
        reversals: this.reversals,
        leaveDelayMs: this.leaveDelayMs,
        smokeContacts: this.smokeContacts,
        averageClarity: this.claritySamples ? this.clarityTotal / this.claritySamples : 1,
        minimumClarity: this.minimumClarity,
      },
    }
  }

  private updatePhase(): void {
    const scale = this.services.getTimeScale()
    if (this.phase === 0 && (this.nearParentMs >= 10_000 * scale || this.elapsedMs >= 24_000 * scale)) {
      this.phase = 1
      this.phaseStartedAt = this.elapsedMs
      this.warningStartedAt = this.elapsedMs
      this.services.ui.setInstruction('Wähle einen freien Korridor.')
      this.services.ui.setCaption('')
      this.services.audio.pulse(82, 0.055)
    } else if (this.phase === 1 && this.route) {
      this.phase = 2
      this.phaseStartedAt = this.elapsedMs
      this.services.ui.setInstruction('Bleib in Reichweite und erreiche den Ausgang.')
      this.services.audio.playMotif('familiar')
    } else if (this.phase === 2 && this.player.x >= 1690) {
      this.phase = 3
      this.phaseStartedAt = this.elapsedMs
      this.parentStoppedAt = this.elapsedMs
      this.services.ui.setInstruction('')
      this.services.ui.setCaption('')
    } else if (this.phase === 3 && this.elapsedMs - this.phaseStartedAt >= 5_000 * scale) {
      this.finishLevel()
    }
  }

  private getVisualProgress(): number {
    if (this.phase === 0) return Phaser.Math.Linear(0, 0.28, Phaser.Math.Clamp(this.nearParentMs / (10_000 * this.services.getTimeScale()), 0, 1))
    if (this.phase === 1) return 0.38
    if (this.phase === 2) return Phaser.Math.Linear(0.55, 0.82, Phaser.Math.Clamp((this.player.x - 820) / 870, 0, 1))
    return Phaser.Math.Linear(0.86, 1, Phaser.Math.Clamp((this.elapsedMs - this.phaseStartedAt) / (5_000 * this.services.getTimeScale()), 0, 1))
  }

  private updateObjectiveHud(): void {
    const distance = Phaser.Math.Distance.BetweenPoints(this.player, this.parent)
    if (this.phase === 0) {
      const connection = Phaser.Math.Clamp(1 - distance / 520, 0, 1)
      this.objectiveHud.set('Verbindung', `${Math.round(connection * 100)} %`, connection)
    } else if (this.phase === 1) {
      this.objectiveHud.set('Korridor wählen', this.route ? 'GEWÄHLT' : 'OFFEN', this.route ? 1 : Phaser.Math.Clamp((this.player.x - 520) / 300, 0, 0.9))
    } else if (this.phase === 2) {
      const exitProgress = Phaser.Math.Clamp((this.player.x - 820) / 950, 0, 1)
      this.objectiveHud.set('Ausgang', `${Math.round(exitProgress * 100)} %`, exitProgress)
    } else this.objectiveHud.set('Runde', 'BEENDET', 1)
  }

  private updateParent(delta: number): void {
    const routeY = this.route === 'lower' ? 750 : this.route === 'upper' ? 330 : 540
    const distance = Phaser.Math.Distance.BetweenPoints(this.player, this.parent)
    if (this.phase === 3 || distance > 330) return
    const target = this.phase === 0
      ? new Phaser.Math.Vector2(700, 540)
      : new Phaser.Math.Vector2(this.phase === 1 ? 820 : Math.min(1510, Math.max(900, this.player.x - 120)), routeY)
    const step = (this.phase === 0 ? 0.045 : 0.07) * delta
    const angle = Phaser.Math.Angle.BetweenPoints(this.parent, target)
    const remaining = Phaser.Math.Distance.BetweenPoints(this.parent, target)
    this.parent.x += Math.cos(angle) * Math.min(step, remaining)
    this.parent.y += Math.sin(angle) * Math.min(step, remaining)
  }

  private updatePlayer(delta: number): void {
    const input = this.inputManager.getVector(this.player.x, this.player.y)
    const frameScale = Phaser.Math.Clamp(delta / 16.667, 0.4, 2.4)
    if (input.active) {
      this.velocity.x += input.x * 0.74 * frameScale
      this.velocity.y += input.y * 0.74 * frameScale
      const direction: Direction = input.x < -0.25 ? 'left' : input.x > 0.25 ? 'right' : 'center'
      this.services.telemetry.recordDirection(direction)
      if (direction !== 'center' && this.lastHorizontal !== 'center' && direction !== this.lastHorizontal) this.reversals += 1
      if (direction !== 'center') this.lastHorizontal = direction
      if (!this.reacted && this.phase >= 1) {
        this.reacted = true
        this.reactionMs = Math.max(0, this.elapsedMs - this.warningStartedAt)
      }
    }

    if (!this.route && this.player.x > 820) {
      this.route = this.player.y < 540 ? 'upper' : 'lower'
      this.services.audio.pulse(this.route === 'upper' ? 247 : 185, 0.04)
    }

    const smokeStrength = this.getSmokeStrength(this.player.x, this.player.y, this.elapsedMs)
    const parentDistance = Phaser.Math.Distance.BetweenPoints(this.player, this.parent)
    if (smokeStrength > 0.12) {
      this.clarity = Math.max(0.2, this.clarity - delta * 0.00022 * smokeStrength)
      this.smokeCooldown = Math.max(0, this.smokeCooldown - delta)
      if (smokeStrength > 0.48 && this.smokeCooldown === 0) {
        this.smokeContacts += 1
        this.smokeCooldown = 1_150 * this.services.getTimeScale()
        this.services.audio.pulse(74, 0.035)
      }
    } else {
      const recovery = parentDistance < 245 ? 0.00024 : 0.00009
      this.clarity = Math.min(1, this.clarity + delta * recovery)
    }
    this.minimumClarity = Math.min(this.minimumClarity, this.clarity)
    const claritySpeed = Phaser.Math.Linear(5.4, 9.2, this.clarity)
    this.velocity.scale(Math.pow(0.89, frameScale)).limit(claritySpeed)
    this.player.x = Phaser.Math.Clamp(this.player.x + this.velocity.x * frameScale, 120, 1800)
    this.player.y = Phaser.Math.Clamp(this.player.y + this.velocity.y * frameScale, 190, 890)
  }

  private updateTelemetry(delta: number): void {
    const distance = Phaser.Math.Distance.BetweenPoints(this.player, this.parent)
    if (distance < 245) this.nearParentMs += delta
    if (this.phase === 3 && !this.leftParent && (distance > 290 || this.player.x > 1430)) {
      this.leftParent = true
      this.leaveDelayMs = Math.max(0, this.elapsedMs - this.parentStoppedAt)
    }
    this.sampleClock += delta
    if (this.sampleClock >= 110) {
      this.services.telemetry.sample((this.player.y - 540) / 360, this.velocity.length() / 10, distance < 245, this.sampleClock)
      this.clarityTotal += this.clarity
      this.claritySamples += 1
      this.sampleClock = 0
    }
  }

  private drawWorld(time: number, progress: number): void {
    const g = this.graphics
    g.clear()
    this.drawBackdrop(g, 0x080908, 0x171315)
    const routeY = this.route === 'lower' ? 750 : this.route === 'upper' ? 330 : 540

    for (let index = 0; index < 34; index += 1) {
      const x = (index * 163 + time * 0.018) % (GAME_WIDTH + 240) - 120
      const y = 180 + ((index * 97) % 720) + Math.sin(time * 0.0007 + index) * 45
      const radius = 30 + (index % 5) * 18
      g.fillStyle(0xaaa3a0, 0.018 + (index % 3) * 0.012)
      g.fillCircle(x, y, radius)
    }

    if (progress > 0.28) {
      const smokePockets = this.getSmokePockets(time)
      smokePockets.forEach((pocket, index) => {
        const strength = this.route === 'upper' && index < 3 ? 0.17 : 0.1
        g.fillStyle(0xb5aaa5, strength)
        g.fillCircle(pocket.x, pocket.y, pocket.radius)
        g.lineStyle(2, 0xd1c3bb, strength * 0.62)
        g.strokeCircle(pocket.x, pocket.y, pocket.radius)
      })
    }

    if (progress > 0.28) {
      const alpha = this.hintManager.getLevel() >= 1 ? 0.3 : 0.15
      g.lineStyle(3, 0xc8d3cb, alpha)
      g.beginPath()
      g.moveTo(700, 540)
      g.lineTo(980, 310)
      g.lineTo(1810, 310)
      g.strokePath()
      g.beginPath()
      g.moveTo(700, 540)
      g.lineTo(980, 770)
      g.lineTo(1810, 770)
      g.strokePath()
      const blockedY = routeY < 540 ? 770 : 310
      g.fillStyle(0x1a1010, 0.28)
      g.fillRect(1050, blockedY - 115, 520, 230)
    }

    const parentAlpha = this.phase === 3 ? Phaser.Math.Clamp(1 - (progress - 0.79) / 0.19, 0.08, 1) : 1
    for (let ring = 0; ring < 3; ring += 1) {
      g.lineStyle(3 - ring * 0.5, 0x9eced0, parentAlpha * (0.44 - ring * 0.1))
      g.strokeCircle(this.parent.x, this.parent.y, 28 + ring * 18 + Math.sin(time * 0.003 + ring) * 5)
    }
    g.fillStyle(0xc8eef0, parentAlpha * 0.9)
    g.fillCircle(this.parent.x, this.parent.y, 9)

    const connected = Phaser.Math.Distance.BetweenPoints(this.player, this.parent) < 270
    g.lineStyle(2, 0xb5dfe0, connected ? 0.34 : 0.08)
    g.lineBetween(this.parent.x, this.parent.y, this.player.x, this.player.y)
    g.fillStyle(0xf0e9d9, 0.95)
    g.fillCircle(this.player.x, this.player.y, 10)
    g.lineStyle(3, 0xe0c88e, 0.65)
    g.strokeCircle(this.player.x, this.player.y, 22)
    const sightRadius = Phaser.Math.Linear(145, 440, this.clarity)
    g.lineStyle(3, 0xe8e4d8, 0.06 + this.clarity * 0.1)
    g.strokeCircle(this.player.x, this.player.y, sightRadius)
    if (this.clarity < 0.7) {
      const veilAlpha = (0.7 - this.clarity) * 0.32
      g.fillStyle(0x8f8784, veilAlpha)
      g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
    }

    const exitX = 1770
    if (this.phase >= 2) {
      const glow = 0.12 + Math.sin(time * 0.003) * 0.05
      g.fillStyle(0xe8eadc, glow)
      g.fillRect(exitX - 60, routeY - 120, 120, 240)
      g.lineStyle(4, 0xe7e8d7, 0.55)
      g.strokeRect(exitX - 60, routeY - 120, 120, 240)
    }
    if (progress > 0.93) {
      const veil = Phaser.Math.Clamp((progress - 0.93) / 0.07, 0, 1)
      g.fillStyle(0x030303, veil * 0.95)
      g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
    }
  }

  private getSmokePockets(time: number): Array<{ x: number; y: number; radius: number }> {
    const drift = Math.sin(time * 0.00055) * 42
    return [
      { x: 1030 + drift, y: 340, radius: 128 },
      { x: 1280 - drift * 0.5, y: 305, radius: 142 },
      { x: 1510 + drift * 0.35, y: 370, radius: 118 },
      { x: 1160 - drift * 0.3, y: 610, radius: 94 },
      { x: 1480 + drift * 0.45, y: 675, radius: 88 },
    ]
  }

  private getSmokeStrength(x: number, y: number, time: number): number {
    if (this.phase === 0) return 0
    return this.getSmokePockets(time).reduce((strongest, pocket) => {
      const distance = Phaser.Math.Distance.Between(x, y, pocket.x, pocket.y)
      return Math.max(strongest, Phaser.Math.Clamp(1 - distance / pocket.radius, 0, 1))
    }, 0)
  }
}

import Phaser from 'phaser'
import { ObjectiveHud } from '../components/ObjectiveHud'
import { GAME_HEIGHT, GAME_WIDTH } from '../config/gameConfig'
import { levels } from '../config/levels'
import { GoalTracker } from '../systems/GoalTracker'
import type { AssistanceLevel, Direction, LevelResult } from '../types'
import { TimedLevelScene } from './TimedLevelScene'

type Route = 'upper' | 'lower'

interface Stage {
  x: number
  y: number
  reached: boolean
}

const STAGE_TARGET = 7
const CLARITY_REQUIRED = 0.4
const EXIT_X = 1780

/**
 * Bewahre.
 *
 * Klarheit ist hier keine Anzeige, sondern eine ausgebbare Ressource: Rauch nimmt sie, Nähe zum
 * vertrauten Signal gibt sie zurück — kostet aber Weg. Der wiederkehrende Konflikt zwischen
 * Vorankommen und Auftanken ist die Aufgabe des Abschnitts.
 */
export class Level04State extends TimedLevelScene {
  private graphics!: Phaser.GameObjects.Graphics
  private player = new Phaser.Math.Vector2(240, 545)
  private velocity = new Phaser.Math.Vector2()
  private parent = new Phaser.Math.Vector2(400, 545)
  private route: Route | null = null
  private phase = 0
  private phaseStartedAt = 0
  private stages: Stage[] = []
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
  private refuelMs = 0
  private blockedCooldown = 0
  private blockedStages = 0
  private safetyNetApplied = false
  private objectiveHud!: ObjectiveHud
  private goal!: GoalTracker

  constructor() {
    super('Level04')
  }

  create(): void {
    this.player.set(240, 545)
    this.velocity.set(0, 0)
    this.parent.set(400, 545)
    this.route = null
    this.phase = 0
    this.phaseStartedAt = 0
    this.stages = []
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
    this.refuelMs = 0
    this.blockedCooldown = 0
    this.blockedStages = 0
    this.safetyNetApplied = false
    this.graphics = this.add.graphics()
    this.objectiveHud = new ObjectiveHud(this)
    this.goal = new GoalTracker(this.objectiveHud, {
      label: 'Etappen', target: STAGE_TARGET, bufferLabel: 'Klarheit', setbackCost: 1, bufferAfterSetback: 0.7,
    })
    this.cameras.main.setBackgroundColor(0x070707)
    this.beginTimedLevel('Level04', levels.level04, 'AUSSCHNITT · 04', 'Folge dem Signal.', 'memory', {
      goal: 'Erreiche 7 Etappen und den Ausgang. Eine Etappe zählt nur bei klarer Sicht — Rauch nimmt Klarheit, Nähe zum Signal gibt sie zurück.',
      controls: 'WASD / Pfeiltasten · Maus oder Berührung',
    })
  }

  update(time: number, delta: number): void {
    if (this.finished) return
    const progress = this.advanceLevel(delta)
    if (this.finished || progress < 0) return
    this.goal.advance(delta)
    this.applySafetyNet()
    this.updatePhase()
    this.updateParent(delta)
    this.updatePlayer(delta)
    this.blockedCooldown = Math.max(0, this.blockedCooldown - delta)
    this.updateStages()
    this.updateTelemetry(delta)
    this.drawWorld(time, this.getVisualProgress())
  }

  protected applyHint(level: AssistanceLevel): void {
    this.services.setAssistance(level)
    if (level === 1) this.services.ui.setHint('Etappen, Signal und Rauchfelder werden deutlicher.')
    if (level === 2) this.services.ui.setHint('Eine Linie weist zur nächsten Etappe.')
    if (level === 3) this.services.ui.setHint('Rauch nimmt weniger Klarheit; Nähe gibt sie schneller zurück.')
  }

  protected collectResult(): LevelResult {
    const route: Route = this.route ?? (this.player.y < GAME_HEIGHT / 2 ? 'upper' : 'lower')
    return {
      choices: {
        route,
        grade: this.goal.grade(this.elapsedMs, this.levelConfig.expectedDurationMs),
      },
      metrics: {
        ...this.goal.metrics(this.elapsedMs, this.levelConfig.expectedDurationMs),
        reactionMs: this.reactionMs,
        nearParentRatio: this.elapsedMs ? this.nearParentMs / this.elapsedMs : 0,
        refuelRatio: this.elapsedMs ? this.refuelMs / this.elapsedMs : 0,
        reversals: this.reversals,
        leaveDelayMs: this.leaveDelayMs,
        smokeContacts: this.smokeContacts,
        blockedStages: this.blockedStages,
        averageClarity: this.claritySamples ? this.clarityTotal / this.claritySamples : 1,
        minimumClarity: this.minimumClarity,
      },
    }
  }

  private applySafetyNet(): void {
    if (this.safetyNetApplied || this.phase !== 2) return
    if (this.elapsedMs < this.maximumDurationMs * 0.78) return
    this.safetyNetApplied = true
    while (this.hintManager.getLevel() < 3) this.hintManager.forceNext()
  }

  private updatePhase(): void {
    const scale = this.services.getTimeScale()
    if (this.phase === 0 && this.player.x > 760) {
      this.phase = 1
      this.phaseStartedAt = this.elapsedMs
      this.warningStartedAt = this.elapsedMs
      this.services.ui.setInstruction('Wähle oben oder unten.')
      this.services.audio.pulse(82, 0.055)
    } else if (this.phase === 1 && this.route) {
      this.phase = 2
      this.phaseStartedAt = this.elapsedMs
      this.stages = this.buildStages(this.route)
      this.services.ui.setInstruction('Nimm alle 7 Etappen mit.')
      this.services.audio.playMotif('familiar')
    } else if (this.phase === 2 && this.goal.reached && this.player.x >= EXIT_X - 90) {
      this.phase = 3
      this.phaseStartedAt = this.elapsedMs
      this.parentStoppedAt = this.elapsedMs
      this.services.ui.setInstruction('')
      this.services.ui.setHint('')
    } else if (this.phase === 3 && this.elapsedMs - this.phaseStartedAt >= 5_000 * scale) {
      this.finishLevel()
    }
  }

  private getVisualProgress(): number {
    if (this.phase === 0) return Phaser.Math.Linear(0, 0.2, Phaser.Math.Clamp((this.player.x - 240) / 520, 0, 1))
    if (this.phase === 1) return 0.3
    if (this.phase === 2) return Phaser.Math.Linear(0.36, 0.84, this.goal.value / STAGE_TARGET)
    return Phaser.Math.Linear(0.86, 1, Phaser.Math.Clamp(
      (this.elapsedMs - this.phaseStartedAt) / (5_000 * this.services.getTimeScale()), 0, 1,
    ))
  }

  /**
   * Oben: kurzer Weg, dichter Rauch. Unten: längerer Weg mit mehr Höhenwechsel, kaum Rauch.
   * Beide sind spielbar; sie unterscheiden sich in der Art der Anstrengung, nicht im Erfolg.
   */
  private buildStages(route: Route): Stage[] {
    const points = route === 'upper'
      ? [[980, 250], [1130, 505], [1290, 245], [1440, 505], [1580, 245], [1690, 505], [1760, 250]]
      : [[950, 862], [1110, 592], [1280, 862], [1440, 592], [1590, 862], [1700, 592], [1770, 858]]
    return points.map(([x, y]) => ({ x, y, reached: false }))
  }

  private routeBand(): { top: number; bottom: number } {
    if (this.route === 'upper') return { top: 200, bottom: 530 }
    if (this.route === 'lower') return { top: 560, bottom: 880 }
    return { top: 190, bottom: 890 }
  }

  private updateParent(delta: number): void {
    const routeY = this.route === 'lower' ? 720 : this.route === 'upper' ? 380 : 545
    const distance = Phaser.Math.Distance.BetweenPoints(this.player, this.parent)
    if (this.phase === 3 || distance > 320) return
    // Eigener Takt statt Anheften an den Spieler: Auftanken kostet dadurch wirklich Weg.
    const ownPace = 940 + ((this.elapsedMs - this.phaseStartedAt) / (52_000 * this.services.getTimeScale())) * (EXIT_X - 1_070)
    const target = this.phase === 0
      ? new Phaser.Math.Vector2(820, 545)
      : new Phaser.Math.Vector2(this.phase === 1 ? 860 : Phaser.Math.Clamp(ownPace, 940, EXIT_X - 130), routeY)
    const step = (this.phase === 0 ? 0.052 : 0.05) * delta
    const angle = Phaser.Math.Angle.BetweenPoints(this.parent, target)
    const remaining = Phaser.Math.Distance.BetweenPoints(this.parent, target)
    this.parent.x += Math.cos(angle) * Math.min(step, remaining)
    this.parent.y += Math.sin(angle) * Math.min(step, remaining)
  }

  private updatePlayer(delta: number): void {
    const input = this.inputManager.getVector(this.player.x, this.player.y)
    const frameScale = Phaser.Math.Clamp(delta / 16.667, 0.4, 2.4)
    if (input.active) {
      this.velocity.x += input.x * 0.76 * frameScale
      this.velocity.y += input.y * 0.76 * frameScale
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
      this.route = this.player.y < 545 ? 'upper' : 'lower'
      this.services.audio.pulse(this.route === 'upper' ? 247 : 185, 0.04)
    }

    this.updateClarity(delta)
    const claritySpeed = Phaser.Math.Linear(2.5, 5.4, this.clarity)
    this.velocity.scale(Math.pow(0.89, frameScale)).limit(claritySpeed)
    this.player.x = Phaser.Math.Clamp(this.player.x + this.velocity.x * frameScale, 120, GAME_WIDTH - 60)
    this.player.y = Phaser.Math.Clamp(this.player.y + this.velocity.y * frameScale, 190, 890)

    // Die getroffene Wahl bindet: hinter der Gabelung bleibt nur der gewählte Korridor.
    if (this.route && this.player.x > 960) {
      const band = this.routeBand()
      if (this.player.y < band.top) {
        this.player.y = band.top
        this.velocity.y = Math.abs(this.velocity.y) * 0.3
      } else if (this.player.y > band.bottom) {
        this.player.y = band.bottom
        this.velocity.y = -Math.abs(this.velocity.y) * 0.3
      }
    }
  }

  private updateClarity(delta: number): void {
    if (this.phase !== 2) return
    const scale = this.services.getTimeScale()
    const assistance = this.hintManager.getLevel()
    const smokeStrength = this.getSmokeStrength(this.player.x, this.player.y, this.elapsedMs)
    const parentDistance = Phaser.Math.Distance.BetweenPoints(this.player, this.parent)

    if (smokeStrength > 0.1) {
      const drainScale = assistance >= 3 ? 0.55 : 1
      const emptied = this.goal.drainBuffer((delta / scale) * 0.0011 * smokeStrength * drainScale)
      this.smokeCooldown = Math.max(0, this.smokeCooldown - delta)
      if (smokeStrength > 0.45 && this.smokeCooldown === 0) {
        this.smokeContacts += 1
        this.smokeCooldown = 1_150 * scale
        this.services.audio.pulse(74, 0.035)
      }
      if (emptied) {
        this.stages.filter((stage) => stage.reached).slice(-1).forEach((stage) => { stage.reached = false })
        this.cameras.main.shake(320, 0.006)
        this.services.audio.pulse(50, 0.1)
      }
    } else if (parentDistance < 190) {
      this.refuelMs += delta
      this.goal.fillBuffer((delta / scale) * (assistance >= 3 ? 0.00040 : 0.00028))
    } else {
      this.goal.fillBuffer((delta / scale) * 0.000012)
    }

    this.clarity = Phaser.Math.Clamp(this.goal.bufferValue, 0.18, 1)
    this.minimumClarity = Math.min(this.minimumClarity, this.clarity)
  }

  /**
   * Eine Etappe zählt nur, wenn die Wahrnehmung klar genug ist. Das erzwingt den
   * Wechsel zwischen Vorankommen und Auftanken, statt ihn nur nahezulegen.
   */
  private updateStages(): void {
    if (this.phase !== 2) return
    this.stages.forEach((stage) => {
      if (stage.reached) return
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, stage.x, stage.y) > 62) return
      if (this.clarity < CLARITY_REQUIRED) {
        if (this.blockedCooldown > 0) return
        this.blockedCooldown = 1_400 * this.services.getTimeScale()
        this.blockedStages += 1
        this.services.ui.setHint('Zu unklar. Geh zurück zum Signal.')
        this.services.audio.pulse(88, 0.03)
        return
      }
      stage.reached = true
      this.services.audio.pulse(198 + this.goal.value * 16, 0.042)
      if (this.goal.add(1)) this.services.ui.setInstruction('Geh zum Ausgang.')
    })
  }

  private updateTelemetry(delta: number): void {
    const distance = Phaser.Math.Distance.BetweenPoints(this.player, this.parent)
    if (distance < 190) this.nearParentMs += delta
    if (this.phase === 3 && !this.leftParent && (distance > 290 || this.player.x > 1430)) {
      this.leftParent = true
      this.leaveDelayMs = Math.max(0, this.elapsedMs - this.parentStoppedAt)
    }
    this.sampleClock += delta
    if (this.sampleClock >= 110) {
      this.services.telemetry.sample((this.player.y - 540) / 360, this.velocity.length() / 10, distance < 190, this.sampleClock)
      this.clarityTotal += this.clarity
      this.claritySamples += 1
      this.sampleClock = 0
    }
  }

  private drawWorld(time: number, progress: number): void {
    const g = this.graphics
    g.clear()
    this.drawBackdrop(g, 0x080908, 0x171315)
    const assistance = this.hintManager.getLevel()
    const routeY = this.route === 'lower' ? 720 : this.route === 'upper' ? 380 : 545

    for (let index = 0; index < 34; index += 1) {
      const x = (index * 163 + time * 0.018) % (GAME_WIDTH + 240) - 120
      const y = 180 + ((index * 97) % 720) + Math.sin(time * 0.0007 + index) * 45
      g.fillStyle(0xaaa3a0, 0.018 + (index % 3) * 0.012)
      g.fillCircle(x, y, 30 + (index % 5) * 18)
    }

    if (this.phase >= 1) {
      const alpha = assistance >= 1 ? 0.3 : 0.15
      g.lineStyle(3, 0xc8d3cb, alpha)
      g.beginPath()
      g.moveTo(760, 545)
      g.lineTo(980, 340)
      g.lineTo(GAME_WIDTH - 60, 340)
      g.strokePath()
      g.beginPath()
      g.moveTo(760, 545)
      g.lineTo(980, 750)
      g.lineTo(GAME_WIDTH - 60, 750)
      g.strokePath()
    }

    if (this.phase >= 1) {
      this.getSmokePockets(this.elapsedMs).forEach((pocket) => {
        const strength = pocket.radius > 0 ? 0.26 + pocket.density * 0.22 : 0
        g.fillStyle(0xb5aaa5, strength)
        g.fillCircle(pocket.x, pocket.y, pocket.radius)
        g.lineStyle(assistance >= 1 ? 4 : 3, 0xd8cbc2, Math.min(0.85, strength * 1.5))
        g.strokeCircle(pocket.x, pocket.y, pocket.radius)
      })
    }

    // Etappen
    const nextStage = this.stages.find((stage) => !stage.reached)
    this.stages.forEach((stage) => {
      const pulse = 1 + Math.sin(time * 0.004 + stage.x) * 0.12
      if (stage.reached) {
        g.lineStyle(3, 0x9ccfae, 0.5)
        g.strokeCircle(stage.x, stage.y, 26)
        g.fillStyle(0xb6e0c2, 0.7)
        g.fillCircle(stage.x, stage.y, 7)
        return
      }
      g.fillStyle(0xe9dfae, assistance >= 1 ? 0.16 : 0.1)
      g.fillCircle(stage.x, stage.y, 54 * pulse)
      g.lineStyle(4, 0xf0e6b4, 0.62)
      g.strokeCircle(stage.x, stage.y, 30 * pulse)
      g.fillStyle(0xf6f0cd, 0.85)
      g.fillCircle(stage.x, stage.y, 6)
    })
    if (assistance >= 2 && nextStage) {
      g.lineStyle(assistance === 3 ? 5 : 3, 0xf4e4b8, 0.2)
      g.lineBetween(this.player.x, this.player.y, nextStage.x, nextStage.y)
    }

    const parentAlpha = this.phase === 3 ? Phaser.Math.Clamp(1 - (progress - 0.86) / 0.14, 0.08, 1) : 1
    for (let ring = 0; ring < 3; ring += 1) {
      g.lineStyle(3 - ring * 0.5, 0x9eced0, parentAlpha * (0.44 - ring * 0.1))
      g.strokeCircle(this.parent.x, this.parent.y, 28 + ring * 18 + Math.sin(time * 0.003 + ring) * 5)
    }
    // Der Auftankradius muss sichtbar sein, sonst ist die Entscheidung nicht lesbar.
    g.lineStyle(2, 0x9eced0, parentAlpha * (this.clarity < 0.999 ? 0.2 : 0.08))
    g.strokeCircle(this.parent.x, this.parent.y, 190)
    g.fillStyle(0xc8eef0, parentAlpha * 0.9)
    g.fillCircle(this.parent.x, this.parent.y, 9)

    const connected = Phaser.Math.Distance.BetweenPoints(this.player, this.parent) < 190
    g.lineStyle(2, 0xb5dfe0, connected ? 0.36 : 0.08)
    g.lineBetween(this.parent.x, this.parent.y, this.player.x, this.player.y)
    g.fillStyle(0xf0e9d9, 0.95)
    g.fillCircle(this.player.x, this.player.y, 10)
    g.lineStyle(3, 0xe0c88e, 0.65)
    g.strokeCircle(this.player.x, this.player.y, 22)
    g.lineStyle(3, 0xe8e4d8, 0.06 + this.clarity * 0.1)
    g.strokeCircle(this.player.x, this.player.y, Phaser.Math.Linear(140, 440, this.clarity))
    if (this.clarity < 0.85) {
      g.fillStyle(0x8f8784, (0.85 - this.clarity) * 0.95)
      g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
    }

    const setback = this.goal.setbackFlash
    if (setback > 0) {
      g.fillStyle(0x2c1712, setback * 0.32)
      g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
    }

    if (this.phase >= 2) {
      const open = this.goal.reached
      const glow = (open ? 0.2 : 0.07) + Math.sin(time * 0.003) * 0.04
      g.fillStyle(0xe8eadc, glow)
      g.fillRect(EXIT_X - 60, routeY - 120, 120, 240)
      g.lineStyle(4, 0xe7e8d7, open ? 0.62 : 0.22)
      g.strokeRect(EXIT_X - 60, routeY - 120, 120, 240)
    }
    if (progress > 0.93) {
      g.fillStyle(0x030303, Phaser.Math.Clamp((progress - 0.93) / 0.07, 0, 1) * 0.95)
      g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
    }
  }

  private getSmokePockets(time: number): Array<{ x: number; y: number; radius: number; density: number }> {
    const drift = Math.sin(time * 0.00055) * 44
    if (this.route === 'lower') {
      return [
        { x: 980 + drift * 0.5, y: 812, radius: 92, density: 0.8 },
        { x: 1200 - drift * 0.45, y: 645, radius: 92, density: 0.8 },
        { x: 1410 + drift * 0.4, y: 812, radius: 92, density: 0.8 },
        { x: 1610 - drift * 0.4, y: 645, radius: 92, density: 0.8 },
        { x: 1740 + drift * 0.3, y: 806, radius: 86, density: 0.75 },
      ]
    }
    if (this.route === 'upper') {
      return [
        { x: 1000 + drift * 0.5, y: 306, radius: 96, density: 1 },
        { x: 1210 - drift * 0.45, y: 452, radius: 96, density: 1 },
        { x: 1400 + drift * 0.4, y: 300, radius: 96, density: 1 },
        { x: 1580 - drift * 0.4, y: 452, radius: 96, density: 1 },
        { x: 1720 + drift * 0.3, y: 312, radius: 90, density: 0.95 },
      ]
    }
    return [{ x: 1030 + drift, y: 360, radius: 118, density: 0.7 }, { x: 1160 - drift * 0.3, y: 700, radius: 92, density: 0.5 }]
  }

  private getSmokeStrength(x: number, y: number, time: number): number {
    if (this.phase === 0) return 0
    return this.getSmokePockets(time).reduce((strongest, pocket) => {
      const distance = Phaser.Math.Distance.Between(x, y, pocket.x, pocket.y)
      return Math.max(strongest, Phaser.Math.Clamp(1 - distance / pocket.radius, 0, 1) * pocket.density)
    }, 0)
  }
}

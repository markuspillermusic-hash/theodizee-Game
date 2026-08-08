import Phaser from 'phaser'
import { ObjectiveHud } from '../components/ObjectiveHud'
import { GAME_HEIGHT, GAME_WIDTH } from '../config/gameConfig'
import { levels } from '../config/levels'
import type { AssistanceLevel, Direction, LevelResult } from '../types'
import { TimedLevelScene } from './TimedLevelScene'

type Trail = 'warm' | 'cool'

export class Level03State extends TimedLevelScene {
  private graphics!: Phaser.GameObjects.Graphics
  private player = new Phaser.Math.Vector2(720, 610)
  private velocity = new Phaser.Math.Vector2()
  private phase = 0
  private phaseStartedAt = 0
  private trail: Trail | null = null
  private carrying = false
  private cargoIntegrity = 1
  private receivedPulses = 0
  private missedPulses = 0
  private resolvedPulses = new Set<number>()
  private trailStep = 0
  private trailWaypointsPassed = 0
  private returnCount = 0
  private nearYoungMs = 0
  private riskMs = 0
  private searchMs = 0
  private sampleClock = 0
  private objectiveHud!: ObjectiveHud

  constructor() {
    super('Level03')
  }

  create(): void {
    this.player.set(720, 610)
    this.velocity.set(0, 0)
    this.phase = 0
    this.phaseStartedAt = 0
    this.trail = null
    this.carrying = false
    this.cargoIntegrity = 1
    this.receivedPulses = 0
    this.missedPulses = 0
    this.resolvedPulses.clear()
    this.trailStep = 0
    this.trailWaypointsPassed = 0
    this.returnCount = 0
    this.nearYoungMs = 0
    this.riskMs = 0
    this.searchMs = 0
    this.sampleClock = 0
    this.graphics = this.add.graphics()
    this.objectiveHud = new ObjectiveHud(this)
    this.cameras.main.setBackgroundColor(0x080705)
    this.beginTimedLevel('Level03', levels.level03, 'AUSSCHNITT · 03', 'Fange 3 Pulse.', 'care', {
      goal: 'Fange 3 Pulse. Folge danach einer Spur und bringe 3 Ladungen zurück.',
      controls: 'WASD / Pfeiltasten · Maus oder Berührung',
    })
  }

  update(time: number, delta: number): void {
    if (this.finished) return
    const progress = this.advanceLevel(delta)
    if (this.finished || progress < 0) return
    this.updatePhase()
    const visualProgress = this.getVisualProgress()
    this.updatePlayer(delta)
    this.updateMechanic(delta, visualProgress, time)
    this.updateObjectiveHud()
    this.drawWorld(time, visualProgress)
  }

  protected applyHint(level: AssistanceLevel): void {
    this.services.setAssistance(level)
    if (level === 1) this.services.ui.setHint('Pulse, Spurpunkte und Ziel leuchten deutlicher.')
    if (level === 2) this.services.ui.setHint('Eine Linie weist zum nächsten Zielpunkt.')
    if (level === 3) this.services.ui.setHint('Ziele, Spur und Gefahren werden maximal deutlich.')
  }

  protected collectResult(): LevelResult {
    return {
      choices: {
        trail: this.trail ?? (this.player.y < GAME_HEIGHT / 2 ? 'warm' : 'cool'),
        approach: this.player.y < GAME_HEIGHT / 2 ? 'upper' : 'lower',
      },
      metrics: {
        returnCount: this.returnCount,
        receivedPulses: this.receivedPulses,
        missedPulses: this.missedPulses,
        trailWaypointsPassed: this.trailWaypointsPassed,
        cargoIntegrity: this.cargoIntegrity,
        nearYoungMs: this.nearYoungMs,
        riskRatio: this.elapsedMs ? this.riskMs / this.elapsedMs : 0,
        searchMs: this.searchMs,
      },
    }
  }

  private updatePhase(): void {
    const scale = this.services.getTimeScale()
    if (this.phase === 0 && (this.receivedPulses >= 3 || this.elapsedMs >= 25_000 * scale)) {
      this.phase = 1
      this.phaseStartedAt = this.elapsedMs
      this.services.ui.setInstruction('Folge einer Spur und hole 3 Ladungen.')
      this.services.audio.playMotif('care')
    } else if (this.phase === 1 && (this.returnCount >= 3 || this.elapsedMs >= this.storyDurationMs * 0.84)) {
      this.phase = 3
      this.phaseStartedAt = this.elapsedMs
      this.services.ui.setInstruction('')
      this.services.ui.setCaption('')
      this.services.audio.pulse(62, 0.07)
    } else if (this.phase === 3 && this.elapsedMs - this.phaseStartedAt >= 7_000 * scale) {
      this.finishLevel()
    }
  }

  private getVisualProgress(): number {
    if (this.phase === 0) return Phaser.Math.Linear(0, 0.275, Phaser.Math.Clamp(this.elapsedMs / (25_000 * this.services.getTimeScale()), 0, 1))
    if (this.phase === 1) return 0.45
    return Phaser.Math.Linear(0.86, 1, Phaser.Math.Clamp((this.elapsedMs - this.phaseStartedAt) / (7_000 * this.services.getTimeScale()), 0, 1))
  }

  private updatePlayer(delta: number): void {
    const input = this.inputManager.getVector(this.player.x, this.player.y)
    const frameScale = Phaser.Math.Clamp(delta / 16.667, 0.4, 2.4)
    const speed = this.phase === 0 ? 0.48 : 0.72
    if (input.active) {
      this.velocity.x += input.x * speed * frameScale
      this.velocity.y += input.y * speed * frameScale
      const direction: Direction = input.x < -0.2 ? 'left' : input.x > 0.2 ? 'right' : 'center'
      this.services.telemetry.recordDirection(direction)
    }

    this.velocity.scale(Math.pow(0.9, frameScale)).limit(this.phase === 0 ? 6.2 : 9.4)
    this.player.x = Phaser.Math.Clamp(this.player.x + this.velocity.x * frameScale, 150, 1770)
    this.player.y = Phaser.Math.Clamp(this.player.y + this.velocity.y * frameScale, 190, 890)
  }

  private updateMechanic(delta: number, progress: number, time: number): void {
    const young = new Phaser.Math.Vector2(430, 620)
    const distanceYoung = Phaser.Math.Distance.BetweenPoints(this.player, young)
    if (distanceYoung < 250) this.nearYoungMs += delta
    if (this.phase === 1) this.searchMs += delta

    if (this.phase === 0) {
      for (let index = 0; index < 4; index += 1) {
        if (this.resolvedPulses.has(index)) continue
        const pulse = this.getIncomingPulse(progress, index)
        if (pulse.flight > 1) {
          this.resolvedPulses.add(index)
          this.missedPulses += 1
        } else if (pulse.flight >= 0 && Phaser.Math.Distance.Between(this.player.x, this.player.y, pulse.x, pulse.y) < 72) {
          this.resolvedPulses.add(index)
          this.receivedPulses += 1
          this.services.audio.pulse(178 + index * 18, 0.04)
        }
      }
    }

    if (this.phase === 1 && !this.trail && this.player.x > 690) {
      this.trail = this.player.y < 545 ? 'warm' : 'cool'
      this.trailStep = 1
      this.services.audio.pulse(this.trail === 'warm' ? 220 : 165, 0.04)
    }
    if (this.phase === 1 && this.trail && !this.carrying) {
      const waypoints = this.getTrailWaypoints(this.trail)
      const waypoint = waypoints[Math.min(this.trailStep, waypoints.length - 1)]
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, waypoint.x, waypoint.y) < 105) {
        this.trailStep = Math.min(waypoints.length - 1, this.trailStep + 1)
        this.trailWaypointsPassed += 1
        this.services.audio.pulse(this.trail === 'warm' ? 206 : 158, 0.018)
      }
    }
    const resourceY = this.trail === 'cool' ? 735 : 350
    const distanceResource = Phaser.Math.Distance.Between(this.player.x, this.player.y, 1530, resourceY)
    const reachedResource = this.trail ? this.trailStep >= this.getTrailWaypoints(this.trail).length - 1 : false
    if (this.phase === 1 && !this.carrying && reachedResource && distanceResource < 105) {
      this.carrying = true
      this.cargoIntegrity = 1
      this.services.ui.setInstruction('Bring es zurück.')
      this.services.audio.playMotif('care')
    }
    if (this.carrying) {
      const inHazard = this.getHazards(time).some((hazard) => (
        Phaser.Math.Distance.Between(this.player.x, this.player.y, hazard.x, hazard.y) < hazard.radius
      ))
      if (inHazard) {
        this.riskMs += delta
        this.cargoIntegrity = Math.max(0.18, this.cargoIntegrity - delta * 0.00012)
      }
    }
    if (this.phase === 1 && this.carrying && distanceYoung < 145) {
      this.carrying = false
      this.returnCount += 1
      this.trailStep = 0
      this.services.audio.playMotif('group', 0.1)
      if (this.phase === 1) this.services.ui.setInstruction('Hole die nächste Ladung.')
    }

    this.sampleClock += delta
    if (this.sampleClock >= 110) {
      this.services.telemetry.sample((this.player.x - 960) / 810, this.velocity.length() / 10, distanceYoung < 250, this.sampleClock)
      this.sampleClock = 0
    }
    if (progress > 0.985) this.services.ui.setCaption('')
  }

  private updateObjectiveHud(): void {
    if (this.phase === 0) this.objectiveHud.set('Pulse fangen', `${this.receivedPulses}/3`, this.receivedPulses / 3)
    else if (this.phase === 1) this.objectiveHud.set('Ladungen', `${this.returnCount}/3`, this.returnCount / 3)
    else this.objectiveHud.set('Runde', 'BEENDET', 1)
  }

  private drawWorld(time: number, progress: number): void {
    const g = this.graphics
    g.clear()
    this.drawBackdrop(g, 0x070705, 0x17110a)
    const young = [{ x: 390, y: 575 }, { x: 455, y: 642 }, { x: 510, y: 580 }]

    if (this.phase === 0) {
      const arrival = Phaser.Math.Clamp(progress / 0.28, 0, 1)
      const adultX = Phaser.Math.Linear(1600, 820, arrival)
      const adultY = 560 + Math.sin(time * 0.002) * 35
      g.lineStyle(2, 0xe8c989, 0.16)
      g.lineBetween(adultX, adultY, this.player.x, this.player.y)
      g.fillStyle(0xe2b86f, 0.18)
      g.fillCircle(adultX, adultY, 62 + Math.sin(time * 0.003) * 7)
      g.fillStyle(0xf1d292, 0.88)
      g.fillCircle(adultX, adultY, 12)
      for (let index = 0; index < 4; index += 1) {
        if (this.resolvedPulses.has(index)) continue
        const pulse = this.getIncomingPulse(progress, index)
        if (pulse.flight < 0 || pulse.flight > 1) continue
        const alpha = this.hintManager.getLevel() >= 1 ? 0.9 : 0.64
        g.fillStyle(0xf2c878, alpha)
        g.fillCircle(pulse.x, pulse.y, 8 + Math.sin(time * 0.006 + index) * 2)
        g.lineStyle(2, 0xe7bd72, alpha * 0.35)
        g.strokeCircle(pulse.x, pulse.y, 24 + Math.sin(time * 0.004 + index) * 5)
      }
    } else {
      this.drawTrail(g, time, 350, 0xe9b968, this.trail === 'warm')
      this.drawTrail(g, time, 735, 0x79aeb9, this.trail === 'cool')
      const resourceY = this.trail === 'cool' ? 735 : 350
      g.fillStyle(this.trail === 'cool' ? 0x8fc6cf : 0xf1c778, this.carrying ? 0.18 : 0.72)
      g.fillCircle(1530, resourceY, 16 + Math.sin(time * 0.004) * 5)
    }

    young.forEach((point, index) => {
      const pulse = 1 + Math.sin(time * 0.003 + index * 1.8) * 0.18
      g.fillStyle(0xd8aa69, 0.12)
      g.fillCircle(point.x, point.y, 36 * pulse)
      g.lineStyle(2, 0xefca88, 0.52)
      g.strokeCircle(point.x, point.y, 13 * pulse)
      g.fillStyle(0xf0d49a, 0.86)
      g.fillCircle(point.x, point.y, 5)
    })

    if (this.phase === 1) {
      this.getHazards(time).forEach((hazard, index) => {
        const alpha = this.hintManager.getLevel() >= 1 ? 0.2 : 0.12
        g.fillStyle(0x351c16, alpha)
        g.fillCircle(hazard.x, hazard.y, hazard.radius)
        g.lineStyle(this.hintManager.getLevel() >= 2 ? 4 : 2, 0xc77e58, alpha + 0.08)
        g.strokeCircle(hazard.x, hazard.y, hazard.radius + Math.sin(time * 0.003 + index) * 7)
      })
    }
    if (this.carrying) {
      g.lineStyle(4, 0xffdda0, 0.12 + this.cargoIntegrity * 0.3)
      g.strokeCircle(this.player.x, this.player.y, 34 + Math.sin(time * 0.005) * 8)
    }
    g.fillStyle(0xf4ddac, 0.96)
    g.fillCircle(this.player.x, this.player.y, this.phase === 0 ? 8 : 12)
    g.lineStyle(3, 0xe0ad64, 0.72)
    g.strokeCircle(this.player.x, this.player.y, 22)

    if (this.phase >= 3) {
      const local = Phaser.Math.Clamp((progress - 0.86) / 0.14, 0, 1)
      for (let x = 1450; x < 1900; x += 90) {
        g.lineStyle(3, 0xb8c1bd, 0.18 + local * 0.2)
        g.lineBetween(x, 180, x, 900)
      }
      g.fillStyle(0xe9f2e9, 0.24)
      g.fillCircle(1670, 550, 38)
      g.fillStyle(0xf4f6ef, 0.88)
      g.fillCircle(1670, 550, 7)
      const wave = Phaser.Math.Easing.Cubic.In(local) * 760
      g.lineStyle(12, 0xf0d7a0, 0.3)
      g.strokeCircle(1780, 540, wave)
      g.fillStyle(0x020202, Math.max(0, local - 0.72) * 3.4)
      g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
    }
  }

  private drawTrail(g: Phaser.GameObjects.Graphics, time: number, targetY: number, color: number, selected: boolean): void {
    const alpha = this.hintManager.getLevel() >= 1 ? 0.34 : selected ? 0.26 : 0.13
    for (let index = 0; index < 14; index += 1) {
      const t = index / 13
      const x = Phaser.Math.Linear(560, 1530, t)
      const y = Phaser.Math.Linear(610, targetY, t) + Math.sin(time * 0.0015 + index) * 24
      g.fillStyle(color, alpha + (selected ? 0.08 : 0))
      g.fillCircle(x, y, 3 + (index % 3))
    }
  }

  private getTrailWaypoints(trail: Trail): Array<{ x: number; y: number }> {
    return trail === 'warm'
      ? [{ x: 610, y: 590 }, { x: 790, y: 510 }, { x: 995, y: 420 }, { x: 1240, y: 365 }, { x: 1530, y: 350 }]
      : [{ x: 610, y: 635 }, { x: 800, y: 690 }, { x: 1010, y: 760 }, { x: 1250, y: 700 }, { x: 1530, y: 735 }]
  }

  private getHazards(time: number): Array<{ x: number; y: number; radius: number }> {
    return [
      { x: 900 + Math.sin(time * 0.0009) * 105, y: 420 + Math.cos(time * 0.0006) * 65, radius: 98 },
      { x: 1160 + Math.cos(time * 0.0007) * 85, y: 610 + Math.sin(time * 0.0008) * 120, radius: 112 },
      { x: 1370 + Math.sin(time * 0.0011) * 75, y: 500 + Math.cos(time * 0.0009) * 125, radius: 90 },
    ]
  }

  private getIncomingPulse(progress: number, index: number): { x: number; y: number; flight: number } {
    const local = Phaser.Math.Clamp(progress / 0.28, 0, 1)
    const flight = local * 4.25 - index * 1.04
    const t = Phaser.Math.Clamp(flight, 0, 1)
    return {
      x: Phaser.Math.Linear(1480, 650, t),
      y: Phaser.Math.Linear(520 + index * 35, 610, t) + Math.sin(t * Math.PI * 2 + index) * 85,
      flight,
    }
  }
}

import Phaser from 'phaser'
import { ObjectiveHud } from '../components/ObjectiveHud'
import { GAME_HEIGHT, GAME_WIDTH } from '../config/gameConfig'
import { levels } from '../config/levels'
import { GoalTracker } from '../systems/GoalTracker'
import type { AssistanceLevel, Direction, LevelResult } from '../types'
import { TimedLevelScene } from './TimedLevelScene'

type Trail = 'warm' | 'cool'

interface Receiver {
  x: number
  y: number
  need: number
  starved: number
  cooldownMs: number
}

interface SourceSlot {
  x: number
  y: number
}

const SOURCE_SLOTS: SourceSlot[] = [
  { x: 1590, y: 300 },
  { x: 1600, y: 575 },
  { x: 1580, y: 840 },
]

const PULSE_TARGET = 3
const SUPPLY_TARGET = 8

/**
 * Versorge.
 *
 * Der Abschnitt ist ein Verteilungsproblem: zwei Empfänger mit unabhängig sinkendem Bedarf, eine
 * begrenzte Tragkraft und zwei Wege mit unterschiedlichem Risiko. Wer beide gleichzeitig voll
 * versorgen will, schafft es nicht — das ist die Aussage des Abschnitts und muss mechanisch
 * stimmen, nicht bloß behauptet sein.
 */
export class Level03State extends TimedLevelScene {
  private graphics!: Phaser.GameObjects.Graphics
  private player = new Phaser.Math.Vector2(720, 610)
  private velocity = new Phaser.Math.Vector2()
  private phase = 0
  private phaseStartedAt = 0
  private trail: Trail | null = null
  private carrying = false
  private cargo = 0
  private cargoIntegrityTotal = 0
  private cargoIntegritySamples = 0
  private receivedPulses = 0
  private missedPulses = 0
  private resolvedPulses = new Set<number>()
  private returnCount = 0
  private sourceIndex = 1
  private riskMs = 0
  private upperRouteMs = 0
  private lowerRouteMs = 0
  private sampleClock = 0
  private safetyNetApplied = false
  private objectiveHud!: ObjectiveHud
  private goal!: GoalTracker
  private receivers: Receiver[] = []

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
    this.cargo = 0
    this.cargoIntegrityTotal = 0
    this.cargoIntegritySamples = 0
    this.receivedPulses = 0
    this.missedPulses = 0
    this.resolvedPulses.clear()
    this.returnCount = 0
    this.sourceIndex = 1
    this.riskMs = 0
    this.upperRouteMs = 0
    this.lowerRouteMs = 0
    this.sampleClock = 0
    this.safetyNetApplied = false
    this.receivers = [
      { x: 330, y: 385, need: 0.72, starved: 0, cooldownMs: 0 },
      { x: 330, y: 795, need: 0.86, starved: 0, cooldownMs: 0 },
    ]
    this.graphics = this.add.graphics()
    this.objectiveHud = new ObjectiveHud(this)
    this.goal = new GoalTracker(this.objectiveHud, { label: 'Aufnehmen', target: PULSE_TARGET })
    this.cameras.main.setBackgroundColor(0x080705)
    this.beginTimedLevel('Level03', levels.level03, 'AUSSCHNITT · 03', 'Fange 3 Pulse.', 'care', {
      goal: 'Fange 3 Pulse. Versorge danach beide Empfänger 8-mal — keiner darf leer werden.',
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
    this.updatePlayer(delta)
    if (this.phase === 0) this.updatePulses(delta)
    else if (this.phase === 1) this.updateSupply(delta, time)
    this.sample(delta)
    this.drawWorld(time, this.getVisualProgress())
  }

  protected applyHint(level: AssistanceLevel): void {
    this.services.setAssistance(level)
    if (level === 1) this.services.ui.setHint('Bedarf, Quelle und Gefahrenfelder leuchten deutlicher.')
    if (level === 2) this.services.ui.setHint('Eine Linie weist zum dringlicheren Empfänger.')
    if (level === 3) this.services.ui.setHint('Gefahrenfelder schwächen die Fracht langsamer.')
  }

  protected collectResult(): LevelResult {
    const trail = this.trail ?? (this.upperRouteMs >= this.lowerRouteMs ? 'warm' : 'cool')
    return {
      choices: {
        trail,
        approach: this.upperRouteMs >= this.lowerRouteMs ? 'upper' : 'lower',
        grade: this.goal.grade(this.elapsedMs, this.levelConfig.expectedDurationMs),
      },
      metrics: {
        ...this.goal.metrics(this.elapsedMs, this.levelConfig.expectedDurationMs),
        returnCount: this.returnCount,
        receivedPulses: this.receivedPulses,
        missedPulses: this.missedPulses,
        cargoIntegrity: this.cargoIntegritySamples ? this.cargoIntegrityTotal / this.cargoIntegritySamples : 1,
        starvedEvents: this.receivers.reduce((sum, receiver) => sum + receiver.starved, 0),
        balance: Math.abs(this.receivers[0].need - this.receivers[1].need),
        riskRatio: this.elapsedMs ? this.riskMs / this.elapsedMs : 0,
        upperRouteRatio: this.elapsedMs ? this.upperRouteMs / this.elapsedMs : 0,
      },
    }
  }

  /** Kurz vor der Notbremse maximale Hilfe geben, statt hart abzuschneiden. */
  private applySafetyNet(): void {
    if (this.safetyNetApplied || this.phase !== 1) return
    if (this.elapsedMs < this.maximumDurationMs * 0.78) return
    this.safetyNetApplied = true
    while (this.hintManager.getLevel() < 3) this.hintManager.forceNext()
  }

  private updatePhase(): void {
    if (this.phase === 0 && this.goal.reached) {
      this.phase = 1
      this.phaseStartedAt = this.elapsedMs
      this.goal.relabel('Versorgen', SUPPLY_TARGET)
      this.goal.resetBuffer(1)
      this.services.ui.setInstruction('Versorge beide. Keiner darf leer werden.')
      this.services.audio.playMotif('care')
      return
    }
    if (this.phase === 1 && this.goal.reached) {
      this.phase = 3
      this.phaseStartedAt = this.elapsedMs
      this.services.ui.setInstruction('')
      this.services.ui.setHint('')
      this.services.audio.pulse(62, 0.07)
      return
    }
    if (this.phase === 3 && this.elapsedMs - this.phaseStartedAt >= 7_000 * this.services.getTimeScale()) {
      this.finishLevel()
    }
  }

  private getVisualProgress(): number {
    if (this.phase === 0) return Phaser.Math.Linear(0, 0.24, this.goal.value / PULSE_TARGET)
    if (this.phase === 1) return Phaser.Math.Linear(0.28, 0.84, this.goal.value / SUPPLY_TARGET)
    return Phaser.Math.Linear(0.86, 1, Phaser.Math.Clamp(
      (this.elapsedMs - this.phaseStartedAt) / (7_000 * this.services.getTimeScale()), 0, 1,
    ))
  }

  private updatePlayer(delta: number): void {
    const input = this.inputManager.getVector(this.player.x, this.player.y)
    const frameScale = Phaser.Math.Clamp(delta / 16.667, 0.4, 2.4)
    const speed = this.phase === 0 ? 0.52 : 0.78
    if (input.active) {
      this.velocity.x += input.x * speed * frameScale
      this.velocity.y += input.y * speed * frameScale
      const direction: Direction = input.x < -0.2 ? 'left' : input.x > 0.2 ? 'right' : 'center'
      this.services.telemetry.recordDirection(direction)
    }

    // Tragen kostet Beweglichkeit. Das macht den Rückweg zur eigentlichen Aufgabe.
    const laden = this.carrying ? 7.1 : 9.6
    this.velocity.scale(Math.pow(0.9, frameScale)).limit(this.phase === 0 ? 6.6 : laden)
    this.player.x = Phaser.Math.Clamp(this.player.x + this.velocity.x * frameScale, 150, 1770)
    this.player.y = Phaser.Math.Clamp(this.player.y + this.velocity.y * frameScale, 190, 890)
  }

  private updatePulses(delta: number): void {
    const local = Phaser.Math.Clamp(this.elapsedMs / (20_000 * this.services.getTimeScale()), 0, 1)
    for (let index = 0; index < 4; index += 1) {
      if (this.resolvedPulses.has(index)) continue
      const pulse = this.getIncomingPulse(local, index)
      if (pulse.flight > 1) {
        this.resolvedPulses.add(index)
        this.missedPulses += 1
        this.services.audio.pulse(96, 0.02)
        continue
      }
      if (pulse.flight < 0) continue
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, pulse.x, pulse.y) > 66) continue
      this.resolvedPulses.add(index)
      this.receivedPulses += 1
      this.services.audio.pulse(178 + index * 18, 0.04)
      this.goal.add(1)
    }
    // Alle vier Pulse verpasst: Der Abschnitt darf nicht blockieren.
    if (this.resolvedPulses.size >= 4 && !this.goal.reached) this.goal.add(PULSE_TARGET - this.goal.value)
    void delta
  }

  private updateSupply(delta: number, time: number): void {
    const scale = this.services.getTimeScale()
    const source = SOURCE_SLOTS[this.sourceIndex]

    // Bedarf sinkt unabhängig weiter. Zwei Empfänger, eine Person: Es geht nicht auf.
    this.receivers.forEach((receiver) => {
      receiver.cooldownMs = Math.max(0, receiver.cooldownMs - delta)
      receiver.need = Phaser.Math.Clamp(receiver.need - (delta / scale) * 0.000044, 0, 1)
      if (receiver.need > 0 || receiver.cooldownMs > 0) return
      // Schonfrist: Wer gar nicht spielt, soll nicht im Sekundentakt erschüttert werden.
      receiver.cooldownMs = 7_000 * scale
      receiver.starved += 1
      receiver.need = 0.45
      this.goal.setback()
      if (receiver.starved <= 3) this.cameras.main.shake(260, 0.005)
      this.services.audio.pulse(58, 0.09)
    })

    if (!this.carrying) {
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, source.x, source.y) < 96) {
        this.carrying = true
        this.cargo = 1
        this.goal.resetBuffer(1)
        this.services.ui.setInstruction('Bring es zu dem, der weniger hat.')
        this.services.audio.playMotif('care')
      }
    } else {
      const strength = this.getHazardStrength(this.player.x, this.player.y, time)
      if (strength > 0.05) {
        this.riskMs += delta
        // Der Puffer ist die Fracht. Leer bedeutet Rückschlag, nicht Ende.
        const drainScale = this.hintManager.getLevel() >= 3 ? 0.45 : 1
        const emptied = this.goal.drainBuffer((delta / scale) * 0.00092 * strength * drainScale)
        this.cargo = this.goal.bufferValue
        if (emptied) {
          this.carrying = false
          this.cargo = 0
          this.cameras.main.shake(300, 0.006)
          this.services.audio.pulse(52, 0.1)
          this.services.ui.setInstruction('Hol neue Fracht.')
        }
      }
      this.cargoIntegrityTotal += this.cargo
      this.cargoIntegritySamples += 1

      if (this.carrying) {
        const target = this.receivers.find((receiver) => (
          Phaser.Math.Distance.Between(this.player.x, this.player.y, receiver.x, receiver.y) < 125
        ))
        if (target) this.deliver(target)
      }
    }

    if (this.player.y < 520) this.upperRouteMs += delta
    else this.lowerRouteMs += delta
    if (!this.trail && this.player.x > 900) this.trail = this.player.y < 520 ? 'warm' : 'cool'
  }

  private deliver(receiver: Receiver): void {
    const gain = this.cargo * 0.62
    receiver.need = Phaser.Math.Clamp(receiver.need + gain, 0, 1)
    this.carrying = false
    this.cargo = 0
    this.returnCount += 1
    this.sourceIndex = (this.sourceIndex + 1) % SOURCE_SLOTS.length
    this.services.audio.playMotif('group', 0.1)
    this.services.audio.pulse(196 + this.returnCount * 12, 0.045)
    if (!this.goal.add(1)) this.services.ui.setInstruction('Hol die nächste Fracht.')
  }

  private sample(delta: number): void {
    this.sampleClock += delta
    if (this.sampleClock < 110) return
    const nearest = Math.min(...this.receivers.map((receiver) => (
      Phaser.Math.Distance.Between(this.player.x, this.player.y, receiver.x, receiver.y)
    )))
    this.services.telemetry.sample((this.player.x - 960) / 810, this.velocity.length() / 10, nearest < 250, this.sampleClock)
    this.sampleClock = 0
  }

  private drawWorld(time: number, progress: number): void {
    const g = this.graphics
    g.clear()
    this.drawBackdrop(g, 0x070705, 0x17110a)
    const assistance = this.hintManager.getLevel()

    if (this.phase === 0) {
      this.drawPulsePhase(g, time)
    } else {
      this.drawSupplyPhase(g, time, assistance)
    }

    this.drawReceivers(g, time, assistance)

    if (this.carrying) {
      g.lineStyle(5, 0xffdda0, 0.14 + this.cargo * 0.42)
      g.strokeCircle(this.player.x, this.player.y, 32 + this.cargo * 14 + Math.sin(time * 0.005) * 5)
    }
    g.fillStyle(0xf4ddac, 0.96)
    g.fillCircle(this.player.x, this.player.y, this.phase === 0 ? 8 : 12)
    g.lineStyle(3, 0xe0ad64, 0.72)
    g.strokeCircle(this.player.x, this.player.y, 22)

    const setback = this.goal.setbackFlash
    if (setback > 0) {
      g.fillStyle(0x40140c, setback * 0.3)
      g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
    }

    if (this.phase >= 3) this.drawOutcome(g, progress)
  }

  private drawPulsePhase(g: Phaser.GameObjects.Graphics, time: number): void {
    const local = Phaser.Math.Clamp(this.elapsedMs / (20_000 * this.services.getTimeScale()), 0, 1)
    const adultX = Phaser.Math.Linear(1600, 900, Phaser.Math.Clamp(local * 3, 0, 1))
    const adultY = 560 + Math.sin(time * 0.002) * 35
    g.lineStyle(2, 0xe8c989, 0.16)
    g.lineBetween(adultX, adultY, this.player.x, this.player.y)
    g.fillStyle(0xe2b86f, 0.18)
    g.fillCircle(adultX, adultY, 62 + Math.sin(time * 0.003) * 7)
    g.fillStyle(0xf1d292, 0.88)
    g.fillCircle(adultX, adultY, 12)
    for (let index = 0; index < 4; index += 1) {
      if (this.resolvedPulses.has(index)) continue
      const pulse = this.getIncomingPulse(local, index)
      if (pulse.flight < 0 || pulse.flight > 1) continue
      const alpha = this.hintManager.getLevel() >= 1 ? 0.92 : 0.68
      g.fillStyle(0xf2c878, alpha)
      g.fillCircle(pulse.x, pulse.y, 9 + Math.sin(time * 0.006 + index) * 2)
      g.lineStyle(2, 0xe7bd72, alpha * 0.4)
      g.strokeCircle(pulse.x, pulse.y, 26 + (1 - pulse.flight) * 34)
    }
  }

  private drawSupplyPhase(g: Phaser.GameObjects.Graphics, time: number, assistance: AssistanceLevel): void {
    // Zwei Bänder: oben kurz und belastet, unten lang und ruhig.
    g.lineStyle(2, 0xd8a86a, 0.07)
    g.lineBetween(360, 420, 1560, 330)
    g.lineStyle(2, 0x82b3bd, 0.07)
    g.lineBetween(360, 790, 1560, 830)

    this.getHazards(time).forEach((hazard, index) => {
      const alpha = assistance >= 1 ? 0.24 : 0.14
      g.fillStyle(0x3a1d13, alpha)
      g.fillCircle(hazard.x, hazard.y, hazard.radius)
      g.lineStyle(assistance >= 2 ? 4 : 2, 0xc97b49, alpha + 0.12)
      g.strokeCircle(hazard.x, hazard.y, hazard.radius + Math.sin(time * 0.003 + index) * 8)
    })

    if (!this.carrying) {
      const source = SOURCE_SLOTS[this.sourceIndex]
      const pulse = 1 + Math.sin(time * 0.004) * 0.16
      g.fillStyle(0xf1c778, 0.14)
      g.fillCircle(source.x, source.y, 74 * pulse)
      g.lineStyle(3, 0xf3d08a, 0.6)
      g.strokeCircle(source.x, source.y, 34 * pulse)
      g.fillStyle(0xf6dda0, 0.9)
      g.fillCircle(source.x, source.y, 14)
      if (assistance >= 2) {
        g.lineStyle(3, 0xf4e4b8, 0.18)
        g.lineBetween(this.player.x, this.player.y, source.x, source.y)
      }
    } else if (assistance >= 2) {
      const urgent = this.receivers[0].need <= this.receivers[1].need ? this.receivers[0] : this.receivers[1]
      g.lineStyle(3, 0xf4e4b8, 0.18)
      g.lineBetween(this.player.x, this.player.y, urgent.x, urgent.y)
    }
  }

  private drawReceivers(g: Phaser.GameObjects.Graphics, time: number, assistance: AssistanceLevel): void {
    this.receivers.forEach((receiver, index) => {
      const urgent = receiver.need < 0.3
      const pulse = 1 + Math.sin(time * (urgent ? 0.007 : 0.003) + index * 1.8) * (urgent ? 0.26 : 0.16)
      g.fillStyle(urgent ? 0xd8794f : 0xd8aa69, (assistance >= 1 ? 0.18 : 0.12))
      g.fillCircle(receiver.x, receiver.y, 52 * pulse)
      // Bedarfsbogen: sichtbar, wie viel bleibt.
      g.lineStyle(7, 0x2a1f14, 0.55)
      g.strokeCircle(receiver.x, receiver.y, 34)
      g.lineStyle(7, urgent ? 0xe08a55 : 0xf0c684, 0.85)
      g.beginPath()
      g.arc(receiver.x, receiver.y, 34, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * receiver.need, false)
      g.strokePath()
      g.fillStyle(0xf0d49a, 0.88)
      g.fillCircle(receiver.x, receiver.y, 6)
    })
  }

  private drawOutcome(g: Phaser.GameObjects.Graphics, progress: number): void {
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

  private getHazards(time: number): Array<{ x: number; y: number; radius: number }> {
    return [
      { x: 820 + Math.sin(time * 0.0009) * 120, y: 360 + Math.cos(time * 0.0006) * 90, radius: 122 },
      { x: 1080 + Math.cos(time * 0.0007) * 100, y: 470 + Math.sin(time * 0.0008) * 140, radius: 134 },
      { x: 1340 + Math.sin(time * 0.0011) * 90, y: 380 + Math.cos(time * 0.0009) * 120, radius: 118 },
      { x: 980 + Math.sin(time * 0.0013 + 2) * 90, y: 700 + Math.cos(time * 0.0005) * 70, radius: 104 },
      { x: 1300 + Math.cos(time * 0.0012 + 1) * 80, y: 760 + Math.sin(time * 0.0007) * 60, radius: 92 },
    ]
  }

  private getHazardStrength(x: number, y: number, time: number): number {
    return this.getHazards(time).reduce((strongest, hazard) => {
      const distance = Phaser.Math.Distance.Between(x, y, hazard.x, hazard.y)
      return Math.max(strongest, Phaser.Math.Clamp(1 - distance / hazard.radius, 0, 1))
    }, 0)
  }

  private getIncomingPulse(local: number, index: number): { x: number; y: number; flight: number } {
    const flight = local * 5.4 - index * 1.12
    const t = Phaser.Math.Clamp(flight, 0, 1)
    return {
      x: Phaser.Math.Linear(1520, 560, t),
      y: Phaser.Math.Linear(430 + index * 62, 640, t) + Math.sin(t * Math.PI * 2 + index * 1.7) * 110,
      flight,
    }
  }
}

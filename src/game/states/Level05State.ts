import Phaser from 'phaser'
import { ObjectiveHud } from '../components/ObjectiveHud'
import { GAME_HEIGHT, GAME_WIDTH } from '../config/gameConfig'
import { levels } from '../config/levels'
import { GoalTracker } from '../systems/GoalTracker'
import type { AssistanceLevel, Direction, LevelResult } from '../types'
import { TimedLevelScene } from './TimedLevelScene'

type SignalId = 'amber' | 'violet' | 'blue'

interface RelationSignal {
  id: SignalId
  color: number
  x: number
  y: number
  shape: 'circle' | 'diamond' | 'ring'
}

const STREAK_TARGET = 8
const RESCUE_TARGET = 3
const RESCUE_BURST = 3

/**
 * Verbinde.
 *
 * Die Rhythmusantwort ist die tragende Mechanik des ganzen Spiels und läuft deshalb durch alle
 * Phasen durch. In der Verlustphase bleibt sie vollständig erhalten: Der Spieler antwortet weiter
 * richtig, und es wirkt trotzdem immer weniger. Das ist der Kern des Abschnitts und darf nicht
 * erzählt, sondern muss gespielt werden.
 */
export class Level05State extends TimedLevelScene {
  private graphics!: Phaser.GameObjects.Graphics
  private player = new Phaser.Math.Vector2(960, 780)
  private velocity = new Phaser.Math.Vector2()
  private phase = 0
  private preferred: SignalId | null = null
  private dwell: Record<SignalId, number> = { amber: 0, violet: 0, blue: 0 }
  private sharedMs = 0
  private decision: 'left' | 'right' | null = null
  private attempts: string[] = []
  private lossMovementTotal = 0
  private lossSamples = 0
  private stayMs = 0
  private sampleClock = 0
  private phaseStartedAt = 0
  private rhythmHits = 0
  private rhythmMisses = 0
  private streak = 0
  private maximumRhythmCombo = 0
  private lastResolvedBeat = -1
  private responseFlash = 0
  private stumbleMs = 0
  private revival = 0
  private revivalDecay = 0.00042
  private burstHits = 0
  private safetyNetApplied = false
  private objectiveHud!: ObjectiveHud
  private goal!: GoalTracker

  constructor() {
    super('Level05')
  }

  create(): void {
    this.player.set(960, 780)
    this.velocity.set(0, 0)
    this.phase = 0
    this.preferred = null
    this.dwell = { amber: 0, violet: 0, blue: 0 }
    this.sharedMs = 0
    this.decision = null
    this.attempts = []
    this.lossMovementTotal = 0
    this.lossSamples = 0
    this.stayMs = 0
    this.sampleClock = 0
    this.phaseStartedAt = 0
    this.rhythmHits = 0
    this.rhythmMisses = 0
    this.streak = 0
    this.maximumRhythmCombo = 0
    this.lastResolvedBeat = -1
    this.responseFlash = 0
    this.stumbleMs = 0
    this.revival = 0
    this.revivalDecay = 0.00042
    this.burstHits = 0
    this.safetyNetApplied = false
    this.graphics = this.add.graphics()
    this.objectiveHud = new ObjectiveHud(this)
    this.goal = new GoalTracker(this.objectiveHud, { label: 'Wählen', target: 1 })
    this.cameras.main.setBackgroundColor(0x07060a)
    this.beginTimedLevel('Level05', levels.level05, 'AUSSCHNITT · 05', 'Wähle ein Signal.', 'bond', {
      goal: 'Wähle ein Signal und antworte im Takt. Ziel: eine Serie von 8 Treffern.',
      controls: 'WASD / Pfeiltasten · Leertaste im Takt · Maus oder Berührung',
    })
  }

  update(time: number, delta: number): void {
    if (this.finished) return
    const progress = this.advanceLevel(delta)
    if (this.finished || progress < 0) return
    this.goal.advance(delta)
    this.applySafetyNet()
    this.updatePhase()
    const visualProgress = this.getVisualProgress()
    const signals = this.getSignals(time, visualProgress)
    this.updatePlayer(delta)
    this.updateMechanics(delta, signals)
    this.drawWorld(time, visualProgress, signals)
  }

  protected applyHint(level: AssistanceLevel): void {
    this.services.setAssistance(level)
    if (level === 1) this.services.ui.setHint('Das Taktfenster wird breiter und deutlicher.')
    if (level === 2) this.services.ui.setHint('Die Reichweite zum Signal wird größer.')
    if (level === 3) this.services.ui.setHint('Takt und Zielbereiche werden maximal deutlich.')
  }

  protected collectResult(): LevelResult {
    const preferred = this.preferred ?? this.selectPreferred()
    return {
      choices: {
        preferredSignal: preferred,
        responsibility: this.decision ?? (this.player.x < GAME_WIDTH / 2 ? 'left' : 'right'),
        rescueOrder: this.attempts.join('>') || 'none',
        grade: this.goal.grade(this.elapsedMs, this.levelConfig.expectedDurationMs),
      },
      metrics: {
        ...this.goal.metrics(this.elapsedMs, this.levelConfig.expectedDurationMs),
        sharedMs: this.sharedMs,
        rescueAttempts: this.attempts.length,
        lossMovement: this.lossSamples ? this.lossMovementTotal / this.lossSamples : 0,
        stayMs: this.stayMs,
        preferredDwellMs: this.dwell[preferred],
        rhythmHits: this.rhythmHits,
        rhythmMisses: this.rhythmMisses,
        rhythmAccuracy: this.rhythmHits + this.rhythmMisses > 0
          ? this.rhythmHits / (this.rhythmHits + this.rhythmMisses)
          : 0,
        maximumRhythmCombo: this.maximumRhythmCombo,
      },
    }
  }

  private applySafetyNet(): void {
    if (this.safetyNetApplied || this.phase !== 1) return
    if (this.elapsedMs < this.maximumDurationMs * 0.6) return
    this.safetyNetApplied = true
    while (this.hintManager.getLevel() < 3) this.hintManager.forceNext()
  }

  private updatePhase(): void {
    const scale = this.services.getTimeScale()
    const stayTarget = Math.max(500, 6_000 * scale)
    if (this.phase === 0 && this.goal.reached) this.enterPhase(1)
    else if (this.phase === 1 && this.goal.reached) this.enterPhase(2)
    else if (this.phase === 2 && this.decision) this.enterPhase(3)
    else if (this.phase === 3 && this.goal.reached) this.enterPhase(4)
    else if (this.phase === 4 && this.stayMs >= stayTarget) this.finishLevel()
  }

  private enterPhase(next: number): void {
    this.phase = next
    this.phaseStartedAt = this.elapsedMs
    this.lastResolvedBeat = -1
    if (next === 1) {
      this.preferred = this.selectPreferred()
      this.goal.relabel('Serie', STREAK_TARGET)
      this.goal.setValue(0)
      this.goal.resetBuffer(0.75)
      this.services.ui.setInstruction('Antworte im Takt · Leertaste oder tippen.')
      this.services.audio.playMotif('bond')
    } else if (next === 2) {
      this.goal.relabel('Entscheiden', 1)
      this.goal.setValue(0)
      this.services.ui.setInstruction('Wähle links oder rechts.')
    } else if (next === 3) {
      this.goal.relabel('Versuche', RESCUE_TARGET)
      this.goal.setValue(0)
      this.burstHits = 0
      this.services.ui.setInstruction('Antworte weiter. Drei Versuche.')
      this.services.audio.pulse(110, 0.05)
    } else if (next === 4) {
      this.goal.relabel('Bleiben', 1)
      this.goal.setValue(0)
      this.services.ui.setInstruction('Bleib ruhig in der Nähe.')
      this.services.audio.playMotif('release', 0.2)
    }
  }

  private getVisualProgress(): number {
    if (this.phase === 0) return Phaser.Math.Linear(0, 0.16, this.goal.bufferValue)
    if (this.phase === 1) return Phaser.Math.Linear(0.18, 0.45, this.goal.value / STREAK_TARGET)
    if (this.phase === 2) return 0.5
    if (this.phase === 3) return Phaser.Math.Linear(0.58, 0.82, this.goal.value / RESCUE_TARGET)
    return Phaser.Math.Linear(0.84, 1, Phaser.Math.Clamp(
      this.stayMs / Math.max(500, 6_000 * this.services.getTimeScale()), 0, 1,
    ))
  }

  private updatePlayer(delta: number): void {
    const input = this.inputManager.getVector(this.player.x, this.player.y)
    const frameScale = Phaser.Math.Clamp(delta / 16.667, 0.4, 2.4)
    const stumbling = this.stumbleMs > 0
    if (input.active && !stumbling) {
      this.velocity.x += input.x * 0.72 * frameScale
      this.velocity.y += input.y * 0.72 * frameScale
      const direction: Direction = input.x < -0.2 ? 'left' : input.x > 0.2 ? 'right' : 'center'
      this.services.telemetry.recordDirection(direction)
    }
    this.velocity.scale(Math.pow(stumbling ? 0.82 : 0.9, frameScale)).limit(9.2)
    this.player.x = Phaser.Math.Clamp(this.player.x + this.velocity.x * frameScale, 130, 1790)
    this.player.y = Phaser.Math.Clamp(this.player.y + this.velocity.y * frameScale, 170, 900)
  }

  private updateMechanics(delta: number, signals: RelationSignal[]): void {
    const scale = this.services.getTimeScale()
    this.responseFlash = Math.max(0, this.responseFlash - delta * 0.0022)
    this.stumbleMs = Math.max(0, this.stumbleMs - delta)
    this.revival = Math.max(0, this.revival - delta * this.revivalDecay)

    const nearest = [...signals].sort((a, b) => this.distanceTo(a) - this.distanceTo(b))[0]
    if (this.phase === 0) {
      if (nearest && this.distanceTo(nearest) < 180) this.dwell[nearest.id] += delta
      const target = Math.max(250, 2_500 * scale)
      const best = Math.max(...Object.values(this.dwell))
      this.goal.resetBuffer(Phaser.Math.Clamp(best / target, 0, 1))
      if (best >= target) this.goal.setValue(1)
    }

    const preferred = signals.find((signal) => signal.id === (this.preferred ?? this.selectPreferred())) ?? signals[0]
    const distancePreferred = this.distanceTo(preferred)

    if (this.phase === 1) {
      if (distancePreferred < 190 && this.velocity.length() < 5.8) this.sharedMs += delta
      this.updateRhythm(distancePreferred, delta)
    }

    if (this.phase === 2 && !this.decision) {
      if (this.player.x < 480) this.chooseResponsibility('left')
      if (this.player.x > 1440) this.chooseResponsibility('right')
    }

    if (this.phase === 3) {
      this.lossMovementTotal += this.velocity.length()
      this.lossSamples += 1
      this.updateRhythm(distancePreferred, delta)
    }

    if (this.phase === 4) {
      const stayTarget = Math.max(500, 6_000 * scale)
      if (distancePreferred < 165 && this.velocity.length() < 2.5) {
        this.stayMs += delta
        this.goal.resetBuffer(Phaser.Math.Clamp(this.stayMs / stayTarget, 0, 1))
        // Ohne diese Zeile bliebe das Soll unerreicht und jede Güte wäre „knapp“.
        if (this.stayMs >= stayTarget) this.goal.setValue(1)
      } else this.stayMs = Math.max(0, this.stayMs - delta * 0.35)
    }

    this.sampleClock += delta
    if (this.sampleClock >= 110) {
      this.services.telemetry.sample((this.player.x - 960) / 820, this.velocity.length() / 10, distancePreferred < 180, this.sampleClock)
      this.sampleClock = 0
    }
  }

  /** Taktdauer. Sie zieht mit der Serie an; in der Verlustphase wird sie zusätzlich unruhig. */
  private beatDuration(): number {
    const scale = this.services.getTimeScale()
    if (this.phase === 3) {
      const drift = Math.sin(this.elapsedMs * 0.0004) * 240
      return Math.max(95, (1_420 + drift) * scale)
    }
    return Math.max(95, (1_500 - Math.min(this.streak, STREAK_TARGET) * 68) * scale)
  }

  private updateRhythm(distancePreferred: number, delta: number): void {
    const assistance = this.hintManager.getLevel()
    const beatDuration = this.beatDuration()
    const elapsed = Math.max(0, this.elapsedMs - this.phaseStartedAt)
    const beat = Math.floor(elapsed / beatDuration)
    const beatPhase = (elapsed % beatDuration) / beatDuration

    // Das Fenster wird mit der Serie enger; Hilfestufen öffnen es wieder.
    const base = this.phase === 3 ? 0.2 : Phaser.Math.Linear(0.21, 0.13, this.streak / STREAK_TARGET)
    const window = base + (assistance >= 1 ? 0.06 : 0) + (assistance >= 3 ? 0.05 : 0)
    const inWindow = beatPhase < window || beatPhase > 1 - window
    const reach = assistance >= 2 ? 300 : 235
    const closeEnough = distancePreferred < reach

    if (this.phase === 1) this.goal.drainBuffer((delta / this.services.getTimeScale()) * 0.000018)

    if (!this.inputManager.justActionDown()) return
    if (beat === this.lastResolvedBeat || this.stumbleMs > 0) return
    this.lastResolvedBeat = beat

    if (inWindow && closeEnough) {
      this.rhythmHits += 1
      this.streak += 1
      this.maximumRhythmCombo = Math.max(this.maximumRhythmCombo, this.streak)
      this.responseFlash = 1
      this.services.audio.pulse(220 + (this.streak % 4) * 24, 0.045)
      if (this.phase === 1) {
        this.goal.fillBuffer(0.14)
        this.goal.setValue(this.streak)
      } else {
        this.registerRescueHit()
      }
      return
    }

    this.rhythmMisses += 1
    this.streak = 0
    this.responseFlash = -0.65
    this.services.audio.pulse(92, 0.025)
    if (this.phase === 1) {
      this.goal.setValue(0)
      // Ein leerer Puffer stolpert kurz, beendet aber nichts.
      if (this.goal.drainBuffer(0.3)) {
        this.stumbleMs = 900 * this.services.getTimeScale()
        this.cameras.main.shake(240, 0.004)
      }
    } else {
      this.burstHits = 0
    }
  }

  /**
   * Rettungsversuch: drei Treffer in Folge lassen das Signal kurz aufleuchten. Jeder weitere
   * Versuch verglüht schneller als der vorige — richtig gespielt und trotzdem vergeblich.
   */
  private registerRescueHit(): void {
    this.burstHits += 1
    this.revival = Math.min(1, this.revival + 0.32)
    if (this.burstHits < RESCUE_BURST) return
    this.burstHits = 0
    this.attempts.push(['halten', 'rufen', 'bleiben'][Math.min(this.attempts.length, 2)])
    this.revival = 1
    this.revivalDecay *= 1.75
    this.services.audio.playMotif(this.attempts.length === 1 ? 'care' : 'familiar', 0.14)
    this.goal.setValue(this.attempts.length)
  }

  private chooseResponsibility(choice: 'left' | 'right'): void {
    this.decision = choice
    this.goal.setValue(1)
    this.services.audio.playMotif(choice === 'left' ? 'care' : 'familiar')
  }

  private selectPreferred(): SignalId {
    return (Object.entries(this.dwell) as Array<[SignalId, number]>).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'amber'
  }

  private getSignals(time: number, progress: number): RelationSignal[] {
    const loss = Phaser.Math.Clamp((progress - 0.58) / 0.42, 0, 1)
    const preferred = this.preferred ?? this.selectPreferred()
    const base: RelationSignal[] = [
      { id: 'amber', color: 0xe8b969, x: 480, y: 470, shape: 'circle' },
      { id: 'violet', color: 0xb59ad8, x: 960, y: 320, shape: 'diamond' },
      { id: 'blue', color: 0x79bfca, x: 1440, y: 520, shape: 'ring' },
    ]
    return base.map((signal, index) => {
      const orbit = this.phase === 1 ? 55 : 25
      const collapse = signal.id === preferred && this.phase >= 3 ? loss : 0
      return {
        ...signal,
        x: Phaser.Math.Linear(signal.x + Math.sin(time * 0.0008 + index * 2) * orbit, 980, collapse * 0.75),
        y: Phaser.Math.Linear(signal.y + Math.cos(time * 0.001 + index * 1.5) * orbit, 520, collapse * 0.75),
      }
    })
  }

  private drawWorld(time: number, progress: number, signals: RelationSignal[]): void {
    const g = this.graphics
    g.clear()
    const colorGrowth = Phaser.Math.Clamp((progress - 0.14) / 0.34, 0, 1)
    g.fillGradientStyle(0x07060a, 0x090811, Phaser.Display.Color.GetColor(
      Math.round(18 + colorGrowth), Math.round(12 + colorGrowth * 27), Math.round(20 + colorGrowth * 20),
    ), 0x08070b, 1)
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)

    const preferredId = this.preferred ?? this.selectPreferred()
    signals.forEach((signal, index) => {
      const isPreferred = signal.id === preferredId
      // In der Verlustphase trägt nur noch das kurz aufflackernde Wiederbeleben.
      const weakening = isPreferred && this.phase >= 3
        ? Phaser.Math.Clamp(0.1 + this.revival * 0.9, 0.06, 1)
        : 1
      g.lineStyle(2.5, signal.color, this.distanceTo(signal) < 190 ? 0.38 : 0.08)
      g.lineBetween(this.player.x, this.player.y, signal.x, signal.y)
      this.drawSignal(g, signal, time, index, weakening)
    })

    const preferred = signals.find((signal) => signal.id === preferredId) ?? signals[0]
    if (this.phase === 1 || this.phase === 3) this.drawBeatRing(g, preferred)
    if (this.phase === 2) {
      this.drawNeed(g, 300, 560, 0xe6a96a, 'circle', time)
      this.drawNeed(g, 1620, 560, 0x7fc8d0, 'diamond', time + 800)
    }
    if (this.phase === 4) {
      g.lineStyle(this.hintManager.getLevel() >= 1 ? 6 : 3, preferred.color, 0.35)
      g.strokeCircle(preferred.x, preferred.y, 165)
    }
    if (this.hintManager.getLevel() >= 2 && this.phase !== 3) {
      const target = this.phase === 2
        ? new Phaser.Math.Vector2(this.player.x < 960 ? 320 : 1600, 520)
        : new Phaser.Math.Vector2(preferred.x, preferred.y)
      g.lineStyle(this.hintManager.getLevel() === 3 ? 5 : 3, 0xf4e4b8, 0.2)
      g.lineBetween(this.player.x, this.player.y, target.x, target.y)
    }

    const stumble = Phaser.Math.Clamp(this.stumbleMs / Math.max(1, 900 * this.services.getTimeScale()), 0, 1)
    g.fillStyle(0xf4eee3, 0.96 - stumble * 0.4)
    g.fillCircle(this.player.x, this.player.y, 11)
    g.lineStyle(3, 0xf1dcc0, 0.6)
    g.strokeCircle(this.player.x, this.player.y, 23 + Math.sin(time * 0.003) * 3)

    if (progress > 0.94) {
      g.fillStyle(0x040307, Phaser.Math.Clamp((progress - 0.94) / 0.06, 0, 1) * 0.88)
      g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
    }
  }

  /** Der zulaufende Ring ist das Taktfenster. Er muss immer sichtbar sein, auch im Verlust. */
  private drawBeatRing(g: Phaser.GameObjects.Graphics, preferred: RelationSignal): void {
    const beatDuration = this.beatDuration()
    const beatPhase = ((this.elapsedMs - this.phaseStartedAt) % beatDuration) / beatDuration
    const closing = 1 - beatPhase
    const alpha = this.phase === 3 ? 0.16 : 0.24
    g.lineStyle(4, preferred.color, alpha + Math.max(0, this.responseFlash) * 0.4)
    g.strokeCircle(preferred.x, preferred.y, 38 + closing * 92)
    g.lineStyle(2, preferred.color, 0.22)
    g.strokeCircle(preferred.x, preferred.y, 38)
    if (this.responseFlash < 0) {
      g.lineStyle(3, 0xb2705a, -this.responseFlash * 0.5)
      g.strokeCircle(preferred.x, preferred.y, 60)
    }
  }

  private drawSignal(g: Phaser.GameObjects.Graphics, signal: RelationSignal, time: number, index: number, strength: number): void {
    const pulse = 1 + Math.sin(time * 0.003 + index * 1.7) * 0.16
    g.fillStyle(signal.color, 0.08 * strength)
    g.fillCircle(signal.x, signal.y, 54 * pulse)
    g.lineStyle(3, signal.color, 0.62 * strength)
    if (signal.shape === 'circle') g.strokeCircle(signal.x, signal.y, 20 * pulse)
    else if (signal.shape === 'diamond') g.strokePoints([
      new Phaser.Geom.Point(signal.x, signal.y - 24 * pulse), new Phaser.Geom.Point(signal.x + 24 * pulse, signal.y),
      new Phaser.Geom.Point(signal.x, signal.y + 24 * pulse), new Phaser.Geom.Point(signal.x - 24 * pulse, signal.y),
    ], true)
    else {
      g.strokeCircle(signal.x, signal.y, 24 * pulse)
      g.strokeCircle(signal.x, signal.y, 11 * pulse)
    }
    g.fillStyle(signal.color, 0.88 * strength)
    g.fillCircle(signal.x, signal.y, 6)
  }

  private drawNeed(g: Phaser.GameObjects.Graphics, x: number, y: number, color: number, shape: 'circle' | 'diamond', time: number): void {
    const pulse = 1 + Math.sin(time * 0.004) * 0.16
    g.fillStyle(color, 0.09)
    g.fillCircle(x, y, 90 * pulse)
    g.lineStyle(5, color, 0.48)
    if (shape === 'circle') g.strokeCircle(x, y, 34 * pulse)
    else g.strokePoints([
      new Phaser.Geom.Point(x, y - 42 * pulse), new Phaser.Geom.Point(x + 42 * pulse, y),
      new Phaser.Geom.Point(x, y + 42 * pulse), new Phaser.Geom.Point(x - 42 * pulse, y),
    ], true)
  }

  private distanceTo(signal: RelationSignal): number {
    return Phaser.Math.Distance.Between(this.player.x, this.player.y, signal.x, signal.y)
  }
}

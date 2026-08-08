import Phaser from 'phaser'
import { ObjectiveHud } from '../components/ObjectiveHud'
import { GAME_HEIGHT, GAME_WIDTH } from '../config/gameConfig'
import { levels } from '../config/levels'
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
  private attempted = new Set<string>()
  private lossMovementTotal = 0
  private lossSamples = 0
  private stayMs = 0
  private sampleClock = 0
  private phaseStartedAt = 0
  private rhythmHits = 0
  private rhythmMisses = 0
  private rhythmCombo = 0
  private maximumRhythmCombo = 0
  private lastResolvedBeat = -1
  private responseFlash = 0
  private attemptFlashMs = 0
  private objectiveHud!: ObjectiveHud

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
    this.attempted.clear()
    this.lossMovementTotal = 0
    this.lossSamples = 0
    this.stayMs = 0
    this.sampleClock = 0
    this.phaseStartedAt = 0
    this.rhythmHits = 0
    this.rhythmMisses = 0
    this.rhythmCombo = 0
    this.maximumRhythmCombo = 0
    this.lastResolvedBeat = -1
    this.responseFlash = 0
    this.attemptFlashMs = 0
    this.graphics = this.add.graphics()
    this.objectiveHud = new ObjectiveHud(this)
    this.cameras.main.setBackgroundColor(0x07060a)
    this.beginTimedLevel('Level05', levels.level05, 'AUSSCHNITT · 05', 'Wähle ein Signal.', 'bond', {
      goal: 'Wähle ein Signal, triff 6 Pulse und stabilisiere anschließend das Netzwerk.',
      controls: 'WASD / Pfeiltasten · Leertaste im Takt · Maus oder Berührung',
    })
  }

  update(time: number, delta: number): void {
    if (this.finished) return
    const progress = this.advanceLevel(delta)
    if (this.finished || progress < 0) return
    this.updatePhase()
    const visualProgress = this.getVisualProgress()
    const signals = this.getSignals(time, visualProgress)
    this.updatePlayer(delta)
    this.updateMechanics(delta, signals)
    this.updateObjectiveHud()
    this.drawWorld(time, visualProgress, signals)
  }

  protected applyHint(level: AssistanceLevel): void {
    this.services.setAssistance(level)
    if (level === 1) this.services.ui.setHint('Taktfenster, Zielzonen und Reichweite werden deutlicher.')
    if (level === 2) this.services.ui.setHint('Eine Linie weist zum nächsten Zielbereich.')
    if (level === 3) this.services.ui.setHint(this.phase >= 4 ? 'Der Stabilitätskreis wird deutlich markiert.' : 'Taktfenster und Zielbereiche werden maximal deutlich.')
  }

  protected collectResult(): LevelResult {
    const preferred = this.preferred ?? this.selectPreferred()
    return {
      choices: {
        preferredSignal: preferred,
        responsibility: this.decision ?? (this.player.x < GAME_WIDTH / 2 ? 'left' : 'right'),
        rescueOrder: this.attempts.join('>') || 'none',
      },
      metrics: {
        sharedMs: this.sharedMs,
        rescueAttempts: this.attempts.length,
        lossMovement: this.lossSamples ? this.lossMovementTotal / this.lossSamples : 0,
        stayMs: this.stayMs,
        preferredDwellMs: this.dwell[preferred],
        rhythmHits: this.rhythmHits,
        rhythmMisses: this.rhythmMisses,
        maximumRhythmCombo: this.maximumRhythmCombo,
      },
    }
  }

  private updatePhase(): void {
    const scale = this.services.getTimeScale()
    const dwellTarget = Math.max(250, 3_500 * scale)
    const stayTarget = Math.max(500, 8_000 * scale)
    const bestDwell = Math.max(...Object.values(this.dwell))
    if (this.phase === 0 && (bestDwell >= dwellTarget || this.elapsedMs >= 25_000 * scale)) this.enterPhase(1)
    else if (this.phase === 1 && (this.rhythmHits >= 6 || this.elapsedMs - this.phaseStartedAt >= 48_000 * scale)) this.enterPhase(2)
    else if (this.phase === 2 && this.decision) this.enterPhase(3)
    else if (this.phase === 3 && this.attempts.length >= 3) this.enterPhase(4)
    else if (this.phase === 4 && this.stayMs >= stayTarget) this.finishLevel()
  }

  private enterPhase(next: number): void {
    this.phase = next
    this.phaseStartedAt = this.elapsedMs
    if (next === 1) {
      this.preferred = this.selectPreferred()
      this.services.ui.setInstruction('Triff 6 Pulse · Leertaste oder tippen.')
      this.services.audio.playMotif('bond')
    } else if (next === 2) {
      this.services.ui.setInstruction('Wähle links oder rechts.')
      this.services.ui.setCaption('')
    } else if (next === 3) {
      this.services.ui.setInstruction('Aktiviere 3 verschiedene Zonen.')
      this.services.ui.setCaption('')
      this.services.audio.pulse(110, 0.05)
    } else if (next === 4) {
      this.services.ui.setInstruction('Halte die Verbindung kurz stabil.')
      this.services.ui.setCaption('')
      this.services.audio.playMotif('release', 0.2)
    }
  }

  private getVisualProgress(): number {
    const scale = this.services.getTimeScale()
    if (this.phase === 0) return Phaser.Math.Linear(0, 0.19, Phaser.Math.Clamp(Math.max(...Object.values(this.dwell)) / Math.max(250, 3_500 * scale), 0, 1))
    if (this.phase === 1) return Phaser.Math.Linear(0.2, 0.43, Phaser.Math.Clamp(this.rhythmHits / 6, 0, 1))
    if (this.phase === 2) return 0.5
    if (this.phase === 3) return Phaser.Math.Linear(0.58, 0.81, Phaser.Math.Clamp(this.attempts.length / 3, 0, 1))
    return Phaser.Math.Linear(0.83, 1, Phaser.Math.Clamp(this.stayMs / Math.max(500, 8_000 * scale), 0, 1))
  }

  private updatePlayer(delta: number): void {
    const input = this.inputManager.getVector(this.player.x, this.player.y)
    const frameScale = Phaser.Math.Clamp(delta / 16.667, 0.4, 2.4)
    if (input.active) {
      this.velocity.x += input.x * 0.72 * frameScale
      this.velocity.y += input.y * 0.72 * frameScale
      const direction: Direction = input.x < -0.2 ? 'left' : input.x > 0.2 ? 'right' : 'center'
      this.services.telemetry.recordDirection(direction)
    }

    this.velocity.scale(Math.pow(0.9, frameScale))
    this.velocity.limit(9.2)
    this.player.x = Phaser.Math.Clamp(this.player.x + this.velocity.x * frameScale, 130, 1790)
    this.player.y = Phaser.Math.Clamp(this.player.y + this.velocity.y * frameScale, 170, 900)
  }

  private updateMechanics(delta: number, signals: RelationSignal[]): void {
    const nearest = [...signals].sort((a, b) => this.distanceTo(a) - this.distanceTo(b))[0]
    if (this.phase === 0 && nearest && this.distanceTo(nearest) < 180) this.dwell[nearest.id] += delta

    const preferred = signals.find((signal) => signal.id === (this.preferred ?? this.selectPreferred())) ?? signals[0]
    const distancePreferred = this.distanceTo(preferred)
    this.responseFlash = Math.max(0, this.responseFlash - delta * 0.0022)
    this.attemptFlashMs = Math.max(0, this.attemptFlashMs - delta)
    if (this.phase === 1 && distancePreferred < 190 && this.velocity.length() < 5.8) {
      this.sharedMs += delta
      if (Math.floor(this.sharedMs / 1_400) !== Math.floor((this.sharedMs - delta) / 1_400)) this.services.audio.pulse(220 + (this.sharedMs % 3) * 18, 0.022)
    }
    if (this.phase === 1) this.updateRhythm(distancePreferred)

    if (this.phase === 2 && !this.decision) {
      if (this.player.x < 480) this.chooseResponsibility('left')
      if (this.player.x > 1440) this.chooseResponsibility('right')
    }

    if (this.phase === 3) {
      this.lossMovementTotal += this.velocity.length()
      this.lossSamples += 1
      if (this.player.y < 300) this.registerAttempt('suchen')
      if (this.player.x < 390) this.registerAttempt('bringen')
      if (this.player.x > 1530) this.registerAttempt('schützen')
      if (this.inputManager.justActionDown()) this.registerAttempt('rufen')
    }

    if (this.phase === 4 && distancePreferred < 150 && this.velocity.length() < 2.5) this.stayMs += delta
    else if (this.phase === 4) this.stayMs = Math.max(0, this.stayMs - delta * 0.35)
    this.sampleClock += delta
    if (this.sampleClock >= 110) {
      this.services.telemetry.sample((this.player.x - 960) / 820, this.velocity.length() / 10, distancePreferred < 180, this.sampleClock)
      this.sampleClock = 0
    }
  }

  private chooseResponsibility(choice: 'left' | 'right'): void {
    this.decision = choice
    this.services.audio.playMotif(choice === 'left' ? 'care' : 'familiar')
    this.services.ui.setCaption('')
  }

  private updateObjectiveHud(): void {
    const scale = this.services.getTimeScale()
    if (this.phase === 0) {
      const best = Math.max(...Object.values(this.dwell))
      const target = Math.max(250, 3_500 * scale)
      this.objectiveHud.set('Signal wählen', `${Math.min(100, Math.round(best / target * 100))} %`, best / target)
    } else if (this.phase === 1) this.objectiveHud.set('Rhythmus', `${Math.min(this.rhythmHits, 6)}/6`, this.rhythmHits / 6)
    else if (this.phase === 2) this.objectiveHud.set('Entscheidung', this.decision ? 'GEWÄHLT' : 'OFFEN', this.decision ? 1 : 0)
    else if (this.phase === 3) this.objectiveHud.set('Zonen', `${Math.min(this.attempts.length, 3)}/3`, this.attempts.length / 3)
    else {
      const target = Math.max(500, 8_000 * scale)
      this.objectiveHud.set('Verbindung', `${Math.min(100, Math.round(this.stayMs / target * 100))} %`, this.stayMs / target)
    }
  }

  private registerAttempt(attempt: string): void {
    if (this.attempted.has(attempt)) return
    this.attempted.add(attempt)
    this.attempts.push(attempt)
    this.attemptFlashMs = Math.max(500, 2_600 * this.services.getTimeScale())
    this.services.audio.pulse(130 + this.attempts.length * 22, 0.035)
  }

  private updateRhythm(distancePreferred: number): void {
    const beatDuration = Math.max(95, 1_450 * this.services.getTimeScale())
    const elapsed = Math.max(0, this.elapsedMs - this.phaseStartedAt)
    const beat = Math.floor(elapsed / beatDuration)
    const beatPhase = (elapsed % beatDuration) / beatDuration
    const assistance = this.hintManager.getLevel()
    const window = assistance >= 1 ? 0.25 : 0.17
    const inWindow = beatPhase < window || beatPhase > 1 - window
    const closeEnough = distancePreferred < (assistance >= 2 ? 260 : 215)
    if (!this.inputManager.justActionDown()) return
    if (beat === this.lastResolvedBeat) return
    this.lastResolvedBeat = beat
    if (inWindow && closeEnough) {
      this.rhythmHits += 1
      this.rhythmCombo += 1
      this.maximumRhythmCombo = Math.max(this.maximumRhythmCombo, this.rhythmCombo)
      this.responseFlash = 1
      this.services.audio.pulse(220 + (this.rhythmCombo % 4) * 24, 0.045)
    } else {
      this.rhythmMisses += 1
      this.rhythmCombo = 0
      this.responseFlash = -0.65
      this.services.audio.pulse(92, 0.025)
    }
  }

  private selectPreferred(): SignalId {
    return (Object.entries(this.dwell) as Array<[SignalId, number]>).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'amber'
  }

  private assistanceTarget(signals: RelationSignal[]): Phaser.Math.Vector2 {
    if (this.phase === 2) return new Phaser.Math.Vector2(this.player.x < 960 ? 320 : 1600, 520)
    if (this.phase === 3 && this.attempts.length < 3) {
      const targets = [new Phaser.Math.Vector2(960, 220), new Phaser.Math.Vector2(250, 560), new Phaser.Math.Vector2(1670, 560)]
      return targets[this.attempts.length]
    }
    const preferred = signals.find((signal) => signal.id === (this.preferred ?? this.selectPreferred())) ?? signals[0]
    return new Phaser.Math.Vector2(preferred.x, preferred.y)
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
      const isPreferred = signal.id === preferred
      const collapse = isPreferred && this.phase >= 3 ? loss : 0
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
    const lowerColor = Phaser.Display.Color.GetColor(
      Math.round(18 + colorGrowth),
      Math.round(12 + colorGrowth * 27),
      Math.round(20 + colorGrowth * 20),
    )
    g.fillGradientStyle(0x07060a, 0x090811, lowerColor, 0x08070b, 1)
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)

    signals.forEach((signal, index) => {
      const preferred = signal.id === (this.preferred ?? this.selectPreferred())
      const weakening = preferred && this.phase >= 3 ? Phaser.Math.Clamp(1 - (progress - 0.58) / 0.42, 0.06, 1) : 1
      const distance = this.distanceTo(signal)
      const connected = distance < 190
      g.lineStyle(2.5, signal.color, connected ? 0.38 : 0.08)
      g.lineBetween(this.player.x, this.player.y, signal.x, signal.y)
      this.drawSignal(g, signal, time, index, weakening)
    })

    if (this.hintManager.getLevel() >= 2) {
      const target = this.assistanceTarget(signals)
      g.lineStyle(this.hintManager.getLevel() === 3 ? 5 : 3, 0xf4e4b8, 0.2)
      g.lineBetween(this.player.x, this.player.y, target.x, target.y)
      g.strokeCircle(target.x, target.y, 64 + Math.sin(time * 0.004) * 8)
    }

    if (this.phase === 4) {
      const preferredSignal = signals.find((signal) => signal.id === (this.preferred ?? this.selectPreferred())) ?? signals[0]
      g.lineStyle(this.hintManager.getLevel() >= 1 ? 6 : 3, preferredSignal.color, 0.35)
      g.strokeCircle(preferredSignal.x, preferredSignal.y, 150)
    }

    if (this.phase === 1) {
      const beatDuration = Math.max(95, 1_450 * this.services.getTimeScale())
      const beatPhase = ((this.elapsedMs - this.phaseStartedAt) % beatDuration) / beatDuration
      const preferredSignal = signals.find((signal) => signal.id === (this.preferred ?? this.selectPreferred())) ?? signals[0]
      const closing = 1 - beatPhase
      g.lineStyle(4, preferredSignal.color, 0.22 + Math.max(0, this.responseFlash) * 0.38)
      g.strokeCircle(preferredSignal.x, preferredSignal.y, 38 + closing * 88)
      for (let index = 0; index < signals.length; index += 1) {
        const a = signals[index]
        const b = signals[(index + 1) % signals.length]
        g.lineStyle(3, a.color, 0.12 + Math.min(0.28, this.sharedMs / 14_000))
        g.lineBetween(a.x, a.y, b.x, b.y)
      }
    }

    if (this.phase === 2) {
      this.drawNeed(g, 300, 560, 0xe6a96a, 'circle', time)
      this.drawNeed(g, 1620, 560, 0x7fc8d0, 'diamond', time + 800)
    }

    if (this.phase === 3) {
      this.drawAttemptZones(g, time)
      if (this.attemptFlashMs > 0) {
        const preferredSignal = signals.find((signal) => signal.id === (this.preferred ?? this.selectPreferred())) ?? signals[0]
        const strength = Phaser.Math.Clamp(this.attemptFlashMs / Math.max(500, 2_600 * this.services.getTimeScale()), 0, 1)
        g.fillStyle(preferredSignal.color, strength * 0.15)
        g.fillCircle(preferredSignal.x, preferredSignal.y, 95 + strength * 80)
        g.lineStyle(5, preferredSignal.color, strength * 0.42)
        g.strokeCircle(preferredSignal.x, preferredSignal.y, 42 + strength * 35)
      }
    }

    g.fillStyle(0xf4eee3, 0.96)
    g.fillCircle(this.player.x, this.player.y, 11)
    g.lineStyle(3, 0xf1dcc0, 0.6)
    g.strokeCircle(this.player.x, this.player.y, 23 + Math.sin(time * 0.003) * 3)

    if (progress > 0.94) {
      const fade = Phaser.Math.Clamp((progress - 0.94) / 0.06, 0, 1)
      g.fillStyle(0x040307, fade * 0.88)
      g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
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

  private drawAttemptZones(g: Phaser.GameObjects.Graphics, time: number): void {
    const zones = [
      { x: 960, y: 210, color: 0xcac6ac }, { x: 245, y: 560, color: 0xd5a96c }, { x: 1680, y: 560, color: 0x86b9c0 },
    ]
    zones.forEach((zone, index) => {
      g.lineStyle(2, zone.color, 0.13 + Math.sin(time * 0.002 + index) * 0.04)
      g.strokeCircle(zone.x, zone.y, 44 + index * 6)
      g.lineBetween(zone.x - 18, zone.y, zone.x + 18, zone.y)
    })
  }

  private distanceTo(signal: RelationSignal): number {
    return Phaser.Math.Distance.Between(this.player.x, this.player.y, signal.x, signal.y)
  }
}

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

interface Call {
  startedAt: number
  speed: number
  strength: number
  resolved: boolean
  outgoing: boolean
}

const EXCHANGE_TARGET = 8
const FADING_TARGET = 4
const UNANSWERED_TARGET = 3
const CALL_SPEED = 0.62
const BASE_TOLERANCE = 62

/**
 * Verbinde · „Zuruf und Antwort".
 *
 * Der Ruf reist sichtbar durch den Raum. Beantwortet wird er in dem Moment, in dem er ankommt —
 * kein abstraktes Taktfenster, das man auswendig lernen muss, sondern ein Ereignis mit einem Ort.
 * Nähe verkürzt die Laufzeit und ist damit selbst eine Entscheidung.
 *
 * Am Ende bleibt die Mechanik vollständig erhalten und funktioniert einwandfrei. Nur es kommt
 * nichts mehr zurück.
 */
export class Level05State extends TimedLevelScene {
  private graphics!: Phaser.GameObjects.Graphics
  private player = new Phaser.Math.Vector2(1_180, 640)
  private velocity = new Phaser.Math.Vector2()
  private phase = 0
  private phaseStartedAt = 0
  private preferred: SignalId | null = null
  private dwell: Record<SignalId, number> = { amber: 0, violet: 0, blue: 0 }
  private call: Call | null = null
  private nextCallAt = 0
  private exchanges = 0
  private streak = 0
  private bestStreak = 0
  private hits = 0
  private misses = 0
  private fadingDelivered = 0
  private unanswered = 0
  private sharedMs = 0
  private closeMs = 0
  private stumbleMs = 0
  private flash = 0
  private sampleClock = 0
  private safetyNetApplied = false
  private exchangeTarget = EXCHANGE_TARGET
  private objectiveHud!: ObjectiveHud
  private goal!: GoalTracker

  constructor() {
    super('Level05')
  }

  create(): void {
    this.player.set(1_180, 640)
    this.velocity.set(0, 0)
    this.phase = 0
    this.phaseStartedAt = 0
    this.preferred = null
    this.dwell = { amber: 0, violet: 0, blue: 0 }
    this.call = null
    this.nextCallAt = 0
    this.exchanges = 0
    this.streak = 0
    this.bestStreak = 0
    this.hits = 0
    this.misses = 0
    this.fadingDelivered = 0
    this.unanswered = 0
    this.sharedMs = 0
    this.closeMs = 0
    this.stumbleMs = 0
    this.flash = 0
    this.sampleClock = 0
    this.safetyNetApplied = false
    this.exchangeTarget = EXCHANGE_TARGET
    this.graphics = this.add.graphics()
    this.objectiveHud = new ObjectiveHud(this)
    this.goal = new GoalTracker(this.objectiveHud, { label: 'Wählen', target: 1 })
    this.cameras.main.setBackgroundColor(0x08070c)
    this.beginTimedLevel('Level05', levels.level05, 'AUSSCHNITT · 05', 'Geh zu einem.', 'bond', {
      goal: 'Wähle ein Gegenüber. Antworte dann jedes Mal, wenn der Ruf dich erreicht.',
      controls: 'WASD / Pfeiltasten · Leertaste beim Eintreffen · Maus oder Berührung',
    })
    // Nahtloser Anschluss aus Level 4: aus dem hellen Durchgang heraus, nicht aus Schwarz.
    this.cameras.main.fadeIn(1_100, 232, 206, 158)
  }

  update(time: number, delta: number): void {
    if (this.finished) return
    const progress = this.advanceLevel(delta)
    if (this.finished || progress < 0) return
    this.goal.advance(delta)
    this.applySafetyNet()
    this.flash = Math.max(0, this.flash - delta * 0.0024)
    this.stumbleMs = Math.max(0, this.stumbleMs - delta)
    this.updatePlayer(delta)
    this.updateMechanics(delta)
    this.updatePhase()
    this.sample(delta)
    this.drawWorld(time)
  }

  protected applyHint(level: AssistanceLevel): void {
    this.services.setAssistance(level)
    if (level === 1) this.services.ui.setHint('Der Ruf wird deutlicher und der Antwortmoment breiter.')
    if (level === 2) this.services.ui.setHint('Ein Ring zeigt, wo der Ruf gerade steht.')
    if (level === 3) this.services.ui.setHint('Der Ruf läuft langsamer und der Antwortmoment ist weit.')
  }

  protected collectResult(): LevelResult {
    const preferred = this.preferred ?? this.selectPreferred()
    return {
      choices: {
        preferredSignal: preferred,
        responsibility: this.player.x < GAME_WIDTH / 2 ? 'left' : 'right',
        rescueOrder: this.unanswered > 0 ? 'gerufen' : 'none',
        grade: this.answerGrade(),
      },
      metrics: {
        ...this.goal.metrics(this.elapsedMs, this.levelConfig.expectedDurationMs),
        rhythmHits: this.hits,
        rhythmMisses: this.misses,
        rhythmAccuracy: this.hits + this.misses > 0 ? this.hits / (this.hits + this.misses) : 0,
        maximumRhythmCombo: this.bestStreak,
        exchanges: this.exchanges,
        unansweredCalls: this.unanswered,
        sharedMs: this.sharedMs,
        closeRatio: this.elapsedMs ? this.closeMs / this.elapsedMs : 0,
        preferredDwellMs: this.dwell[preferred],
      },
    }
  }

  /**
   * Notbremse: volle Hilfe — und das Soll sinkt auf das, was noch erreichbar ist. Ohne das kann ein
   * schwacher Durchlauf in Phase 1 hängenbleiben und die ganze Unterrichtszeit aufbrauchen.
   */
  private applySafetyNet(): void {
    if (this.phase !== 1) return
    if (!this.safetyNetApplied && this.elapsedMs >= this.maximumDurationMs * 0.5) {
      this.safetyNetApplied = true
      while (this.hintManager.getLevel() < 3) this.hintManager.forceNext()
      this.lowerTarget(this.exchanges + 2)
      return
    }
    // Zweite Stufe: Wer auch mit voller Hilfe nicht weiterkommt, wird weitergeführt. Das Ende des
    // Abschnitts ist der Teil, der im Unterricht zählt — den darf niemand verpassen.
    if (this.safetyNetApplied && this.elapsedMs >= this.maximumDurationMs * 0.6) {
      this.exchangeTarget = Math.max(1, this.exchanges)
      this.enterPhase(2)
    }
  }

  private lowerTarget(next: number): void {
    const target = Math.max(1, Math.min(EXCHANGE_TARGET, next))
    if (target === this.exchangeTarget) return
    this.exchangeTarget = target
    this.goal.relabel('Wechsel', this.exchangeTarget)
    this.goal.setValue(this.exchanges)
  }

  /** Die Güte hängt hier an der Treffgenauigkeit, nicht an Zeit und Rückschlägen. */
  private answerGrade(): 'knapp' | 'solide' | 'stark' {
    const attempts = this.hits + this.misses
    if (attempts === 0) return 'knapp'
    const accuracy = this.hits / attempts
    if (accuracy >= 0.85) return 'stark'
    if (accuracy >= 0.55) return 'solide'
    return 'knapp'
  }

  private tolerance(): number {
    const assistance = this.hintManager.getLevel()
    return BASE_TOLERANCE + (assistance >= 1 ? 26 : 0) + (assistance >= 3 ? 26 : 0)
  }

  private callSpeed(): number {
    const slow = this.hintManager.getLevel() >= 3 ? 0.76 : 1
    return CALL_SPEED * slow * (this.phase === 2 ? 0.72 : 1)
  }

  private partner(): RelationSignal {
    const id = this.preferred ?? this.selectPreferred()
    return this.baseSignals().find((signal) => signal.id === id) ?? this.baseSignals()[0]
  }

  private baseSignals(): RelationSignal[] {
    return [
      { id: 'amber', color: 0xe8b969, x: 470, y: 430, shape: 'circle' },
      { id: 'violet', color: 0xb59ad8, x: 960, y: 300, shape: 'diamond' },
      { id: 'blue', color: 0x79bfca, x: 1_450, y: 470, shape: 'ring' },
    ]
  }

  private selectPreferred(): SignalId {
    return (Object.entries(this.dwell) as Array<[SignalId, number]>).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'amber'
  }

  private distanceToPartner(): number {
    const partner = this.partner()
    return Phaser.Math.Distance.Between(this.player.x, this.player.y, partner.x, partner.y)
  }

  private updatePhase(): void {
    const scale = this.services.getTimeScale()
    if (this.phase === 0 && this.goal.reached) return this.enterPhase(1)
    if (this.phase === 1 && this.exchanges >= this.exchangeTarget) return this.enterPhase(2)
    if (this.phase === 2 && this.fadingDelivered >= FADING_TARGET && !this.call) return this.enterPhase(3)
    if (this.phase === 3 && (this.unanswered >= UNANSWERED_TARGET || this.elapsedMs - this.phaseStartedAt >= 16_000 * scale)) {
      this.goal.setValue(this.goal.target)
      this.finishLevel()
    }
  }

  private enterPhase(next: number): void {
    this.phase = next
    this.phaseStartedAt = this.elapsedMs
    this.call = null
    if (next === 1) {
      this.preferred = this.selectPreferred()
      this.goal.relabel('Wechsel', this.exchangeTarget)
      this.goal.setValue(0)
      this.goal.resetBuffer(0.8)
      this.nextCallAt = this.elapsedMs + 700 * this.services.getTimeScale()
      this.services.ui.setInstruction('Antworte, wenn der Ruf dich erreicht.')
      this.services.audio.playMotif('bond')
    } else if (next === 2) {
      this.goal.relabel('Schwächer', FADING_TARGET)
      this.goal.setValue(0)
      this.nextCallAt = this.elapsedMs + 1_600 * this.services.getTimeScale()
      this.services.ui.setInstruction('Antworte weiter.')
      this.services.audio.playMotif('care', 0.14)
    } else if (next === 3) {
      this.goal.relabel('Deine Rufe', UNANSWERED_TARGET)
      this.goal.setValue(0)
      this.goal.resetBuffer(0)
      this.services.ui.setInstruction('Du kannst rufen.')
      this.services.audio.playMotif('release', 0.18)
    }
  }

  private updatePlayer(delta: number): void {
    const input = this.inputManager.getVector(this.player.x, this.player.y)
    const frameScale = Phaser.Math.Clamp(delta / 16.667, 0.4, 2.4)
    if (input.active && this.stumbleMs <= 0) {
      this.velocity.x += input.x * 0.74 * frameScale
      this.velocity.y += input.y * 0.74 * frameScale
      const direction: Direction = input.x < -0.2 ? 'left' : input.x > 0.2 ? 'right' : 'center'
      this.services.telemetry.recordDirection(direction)
    }
    this.velocity.scale(Math.pow(this.stumbleMs > 0 ? 0.82 : 0.9, frameScale)).limit(9.2)
    this.player.x = Phaser.Math.Clamp(this.player.x + this.velocity.x * frameScale, 130, 1_790)
    this.player.y = Phaser.Math.Clamp(this.player.y + this.velocity.y * frameScale, 170, 900)
  }

  private updateMechanics(delta: number): void {
    const scale = this.services.getTimeScale()
    const pressed = this.inputManager.justActionDown() && this.stumbleMs <= 0

    if (this.phase === 0) {
      const nearest = this.baseSignals()
        .map((signal) => ({ signal, d: Phaser.Math.Distance.Between(this.player.x, this.player.y, signal.x, signal.y) }))
        .sort((a, b) => a.d - b.d)[0]
      if (nearest && nearest.d < 170) this.dwell[nearest.signal.id] += delta
      const target = Math.max(250, 2_400 * scale)
      const best = Math.max(...Object.values(this.dwell))
      this.goal.resetBuffer(Phaser.Math.Clamp(best / target, 0, 1))
      if (best >= target) this.goal.setValue(1)
      return
    }

    const distance = this.distanceToPartner()
    if (distance < 260) {
      this.closeMs += delta
      this.sharedMs += delta
    }

    if (this.phase === 3) {
      if (pressed) {
        this.unanswered += 1
        this.call = { startedAt: this.elapsedMs, speed: this.callSpeed(), strength: 0.5, resolved: false, outgoing: true }
        this.goal.setValue(this.unanswered)
        this.services.audio.pulse(196, 0.03)
      }
      if (this.call && (this.elapsedMs - this.call.startedAt) * this.call.speed > distance + 260) this.call = null
      return
    }

    // Neuer Ruf
    if (!this.call && this.elapsedMs >= this.nextCallAt) {
      const strength = this.phase === 2 ? 1 - this.fadingDelivered * 0.22 : 1
      this.call = { startedAt: this.elapsedMs, speed: this.callSpeed(), strength, resolved: false, outgoing: false }
      this.services.audio.pulse(150 + this.exchanges * 6, 0.028 * strength)
    }
    if (!this.call) return

    const radius = (this.elapsedMs - this.call.startedAt) * this.call.speed
    const offset = radius - distance

    if (pressed && !this.call.resolved && !this.call.outgoing) {
      if (Math.abs(offset) <= this.tolerance()) this.registerHit()
      else this.registerMiss()
      return
    }

    // Der Ruf ist vorbeigelaufen, ohne beantwortet zu werden.
    if (!this.call.resolved && offset > this.tolerance() + 40) this.registerMiss()
  }

  private registerHit(): void {
    if (!this.call) return
    this.call.resolved = true
    this.hits += 1
    this.streak += 1
    this.bestStreak = Math.max(this.bestStreak, this.streak)
    this.flash = 1
    this.services.audio.pulse(232 + (this.streak % 4) * 26, 0.05)
    const scale = this.services.getTimeScale()
    if (this.phase === 1) {
      this.exchanges += 1
      this.goal.setValue(this.exchanges)
      this.goal.fillBuffer(0.13)
      // Die Pause richtet sich nach der Laufzeit: Wer nah steht, bekommt einen dichteren Wechsel.
      this.nextCallAt = this.elapsedMs + (this.distanceToPartner() / this.callSpeed()) + 620 * scale
    } else {
      this.fadingDelivered += 1
      this.goal.setValue(this.fadingDelivered)
      this.nextCallAt = this.elapsedMs + 2_400 * scale
    }
    this.call = null
  }

  private registerMiss(): void {
    if (!this.call) return
    this.call.resolved = true
    this.misses += 1
    this.streak = 0
    this.flash = -0.7
    this.services.audio.pulse(92, 0.026)
    const scale = this.services.getTimeScale()
    if (this.phase === 1) {
      if (this.goal.drainBuffer(0.26)) {
        this.stumbleMs = 900 * scale
        this.cameras.main.shake(220, 0.004)
      }
      this.nextCallAt = this.elapsedMs + 1_100 * scale
    } else {
      this.fadingDelivered += 1
      this.goal.setValue(this.fadingDelivered)
      this.nextCallAt = this.elapsedMs + 2_400 * scale
    }
    this.call = null
  }

  private sample(delta: number): void {
    this.sampleClock += delta
    if (this.sampleClock < 110) return
    const distance = this.phase === 0 ? 999 : this.distanceToPartner()
    this.services.telemetry.sample((this.player.x - 960) / 820, this.velocity.length() / 10, distance < 260, this.sampleClock)
    this.sampleClock = 0
  }

  private drawWorld(time: number): void {
    const g = this.graphics
    g.clear()
    const warmth = this.phase === 1 ? Phaser.Math.Clamp(this.exchanges / this.exchangeTarget, 0, 1) : this.phase >= 2 ? 0.3 : 0
    g.fillGradientStyle(0x08070c, 0x090811, Phaser.Display.Color.GetColor(
      Math.round(18 + warmth * 14), Math.round(12 + warmth * 24), Math.round(20 + warmth * 18),
    ), 0x08070b, 1)
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)

    const partnerId = this.preferred ?? this.selectPreferred()
    const fade = this.phase === 2
      ? Phaser.Math.Clamp(1 - this.fadingDelivered / (FADING_TARGET + 1), 0.18, 1)
      : this.phase === 3 ? 0.12 : 1

    this.baseSignals().forEach((signal, index) => {
      const isPartner = signal.id === partnerId
      if (this.phase > 0 && !isPartner) return
      const strength = this.phase === 0 ? 1 : fade
      this.drawSignal(g, signal, time, index, strength)
    })

    if (this.phase > 0) this.drawCall(g)

    if (this.phase === 0) {
      const target = Math.max(250, 2_400 * this.services.getTimeScale())
      const best = Math.max(...Object.values(this.dwell))
      if (best > 0) {
        g.lineStyle(4, 0xf4e4b8, 0.3)
        g.strokeCircle(this.player.x, this.player.y, 40 + (best / target) * 26)
      }
    }

    const stumble = this.stumbleMs > 0
    g.fillStyle(0xf4eee3, stumble ? 0.5 : 0.96)
    g.fillCircle(this.player.x, this.player.y, 11)
    g.lineStyle(3, 0xf1dcc0, 0.6)
    g.strokeCircle(this.player.x, this.player.y, 23 + Math.sin(time * 0.003) * 3)
    if (this.flash > 0) {
      g.lineStyle(5, 0xf6e6bc, this.flash * 0.6)
      g.strokeCircle(this.player.x, this.player.y, 34 + (1 - this.flash) * 40)
    } else if (this.flash < 0) {
      g.lineStyle(3, 0xb2705a, -this.flash * 0.55)
      g.strokeCircle(this.player.x, this.player.y, 40)
    }

    if (this.phase === 3) {
      const local = Phaser.Math.Clamp((this.elapsedMs - this.phaseStartedAt) / (16_000 * this.services.getTimeScale()), 0, 1)
      g.fillStyle(0x040307, local * 0.55)
      g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
    }
  }

  /** Der Ruf ist ein Kreisbogen um das Gegenüber. Wo er den Spieler schneidet, ist der Moment. */
  private drawCall(g: Phaser.GameObjects.Graphics): void {
    if (!this.call) return
    const partner = this.partner()
    const radius = (this.elapsedMs - this.call.startedAt) * this.call.speed
    if (radius <= 4) return
    const origin = this.call.outgoing ? this.player : new Phaser.Math.Vector2(partner.x, partner.y)
    const alpha = (this.call.outgoing ? 0.34 : 0.68) * this.call.strength
    g.lineStyle(this.call.outgoing ? 2.4 : 4.2, this.call.outgoing ? 0xf1dcc0 : partner.color, alpha)
    g.strokeCircle(origin.x, origin.y, radius)
    g.lineStyle(1.6, this.call.outgoing ? 0xf1dcc0 : partner.color, alpha * 0.4)
    g.strokeCircle(origin.x, origin.y, Math.max(0, radius - 26))

    if (this.call.outgoing || this.hintManager.getLevel() < 2) return
    // Hilfestufe 2: der Punkt, an dem der Ruf den Spieler treffen wird
    const angle = Phaser.Math.Angle.Between(origin.x, origin.y, this.player.x, this.player.y)
    g.fillStyle(partner.color, 0.75)
    g.fillCircle(origin.x + Math.cos(angle) * radius, origin.y + Math.sin(angle) * radius, 8)
  }

  private drawSignal(
    g: Phaser.GameObjects.Graphics, signal: RelationSignal, time: number, index: number, strength: number,
  ): void {
    const pulse = 1 + Math.sin(time * 0.003 + index * 1.7) * 0.16
    g.fillStyle(signal.color, 0.09 * strength)
    g.fillCircle(signal.x, signal.y, 58 * pulse)
    g.lineStyle(3, signal.color, 0.66 * strength)
    if (signal.shape === 'circle') g.strokeCircle(signal.x, signal.y, 22 * pulse)
    else if (signal.shape === 'diamond') g.strokePoints([
      new Phaser.Geom.Point(signal.x, signal.y - 26 * pulse), new Phaser.Geom.Point(signal.x + 26 * pulse, signal.y),
      new Phaser.Geom.Point(signal.x, signal.y + 26 * pulse), new Phaser.Geom.Point(signal.x - 26 * pulse, signal.y),
    ], true)
    else {
      g.strokeCircle(signal.x, signal.y, 26 * pulse)
      g.strokeCircle(signal.x, signal.y, 12 * pulse)
    }
    g.fillStyle(signal.color, 0.9 * strength)
    g.fillCircle(signal.x, signal.y, 7)
  }
}

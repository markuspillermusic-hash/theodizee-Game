import Phaser from 'phaser'
import { ObjectiveHud } from '../components/ObjectiveHud'
import { GAME_HEIGHT, GAME_WIDTH } from '../config/gameConfig'
import { levels } from '../config/levels'
import { GoalTracker } from '../systems/GoalTracker'
import type { AssistanceLevel, Direction, LevelResult } from '../types'
import { TimedLevelScene } from './TimedLevelScene'
import { dust, glow, ground, self, vignette } from '../visuals'

type SignalId = 'amber' | 'violet' | 'blue'

interface RelationSignal {
  id: SignalId
  color: number
  x: number
  y: number
  shape: 'circle' | 'diamond' | 'ring'
}

interface Call {
  from: SignalId | 'player'
  startedAt: number
  travelMs: number
  strength: number
  resolved: boolean
}

const EXCHANGE_TARGET = 8
const FADING_TARGET = 4
const UNANSWERED_TARGET = 3
const BASE_TOLERANCE_MS = 190

/**
 * Verbinde · „Zuruf und Antwort".
 *
 * Der Ruf reist sichtbar durch den Raum und braucht dafür **immer gleich lang**, egal wo man
 * steht. Damit ist der Antwortmoment überall lesbar; es gibt keine versteckte Regel, die einen
 * zwingt, sich erst wieder zu entfernen.
 *
 * Auch die Wahl des Gegenübers läuft über die Mechanik: Am Anfang rufen drei, und wem man zuerst
 * antwortet, mit dem geht es weiter. Niemand muss irgendwohin laufen, ohne zu wissen warum.
 *
 * Zum Schluss bleibt die Steuerung vollständig erhalten und funktioniert einwandfrei. Nur es kommt
 * nichts mehr zurück — auch dann nicht, wenn man direkt danebensteht.
 */
export class Level05State extends TimedLevelScene {
  private graphics!: Phaser.GameObjects.Graphics
  private player = new Phaser.Math.Vector2(960, 640)
  private velocity = new Phaser.Math.Vector2()
  private phase = 0
  private phaseStartedAt = 0
  private preferred: SignalId | null = null
  private call: Call | null = null
  private nextCallAt = 0
  private openingIndex = 0
  private exchanges = 0
  private exchangeTarget = EXCHANGE_TARGET
  private streak = 0
  private bestStreak = 0
  private hits = 0
  private misses = 0
  private fadingDelivered = 0
  private unanswered = 0
  private closeMs = 0
  private stumbleMs = 0
  private flash = 0
  private sampleClock = 0
  private safetyNetApplied = false
  private objectiveHud!: ObjectiveHud
  private goal!: GoalTracker

  constructor() {
    super('Level05')
  }

  create(): void {
    this.player.set(960, 640)
    this.velocity.set(0, 0)
    this.phase = 0
    this.phaseStartedAt = 0
    this.preferred = null
    this.call = null
    this.nextCallAt = 900
    this.openingIndex = 0
    this.exchanges = 0
    this.exchangeTarget = EXCHANGE_TARGET
    this.streak = 0
    this.bestStreak = 0
    this.hits = 0
    this.misses = 0
    this.fadingDelivered = 0
    this.unanswered = 0
    this.closeMs = 0
    this.stumbleMs = 0
    this.flash = 0
    this.sampleClock = 0
    this.safetyNetApplied = false
    this.graphics = this.add.graphics()
    this.objectiveHud = new ObjectiveHud(this)
    this.goal = new GoalTracker(this.objectiveHud, { label: 'Antworten', target: 1 })
    this.cameras.main.setBackgroundColor(0x08070c)
    this.beginTimedLevel('Level05', levels.level05, 'AUSSCHNITT · 05', 'Drei rufen. Antworte einem.', 'bond', {
      goal: 'Ein Ruf läuft auf dich zu. Antworte genau in dem Moment, in dem er dich erreicht.',
      controls: 'Leertaste oder tippen · WASD / Pfeiltasten zum Bewegen',
    }, true)
    // Nahtloser Anschluss aus Level 4: aus der hellen Schwelle heraus, nicht aus Schwarz.
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
    if (level === 1) this.services.ui.setHint('Der Antwortmoment wird großzügiger.')
    if (level === 2) this.services.ui.setHint('Ein heller Punkt zeigt, wo der Ruf gerade ist.')
    if (level === 3) this.services.ui.setHint('Die Rufe laufen langsamer und der Moment ist weit.')
  }

  protected collectResult(): LevelResult {
    const preferred = this.preferred ?? 'amber'
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
        closeRatio: this.elapsedMs ? this.closeMs / this.elapsedMs : 0,
      },
    }
  }

  /** Die Güte hängt an der Treffgenauigkeit, nicht an Zeit und Rückschlägen. */
  private answerGrade(): 'knapp' | 'solide' | 'stark' {
    const attempts = this.hits + this.misses
    if (attempts === 0) return 'knapp'
    const accuracy = this.hits / attempts
    if (accuracy >= 0.85) return 'stark'
    if (accuracy >= 0.55) return 'solide'
    return 'knapp'
  }

  private toleranceMs(): number {
    const assistance = this.hintManager.getLevel()
    return (BASE_TOLERANCE_MS + (assistance >= 1 ? 80 : 0) + (assistance >= 3 ? 80 : 0)) * this.services.getTimeScale()
  }

  /** Feste Laufzeit: Der Antwortmoment ist unabhängig davon, wo man steht. */
  private travelMs(): number {
    const scale = this.services.getTimeScale()
    const slow = this.hintManager.getLevel() >= 3 ? 1.3 : 1
    if (this.phase === 0) return 1_400 * scale * slow
    if (this.phase === 2) return (900 + ((this.fadingDelivered * 431) % 700)) * scale * slow
    const eased = Phaser.Math.Linear(1_200, 760, Phaser.Math.Clamp(this.exchanges / this.exchangeTarget, 0, 1))
    // Ab dem vierten Wechsel wird der Takt unregelmaessig. Wer das Muster kennt, muss trotzdem
    // zuhoeren statt mitzuzaehlen.
    const jitter = this.exchanges >= 3 ? 1 + Math.sin(this.exchanges * 2.399) * 0.3 : 1
    return eased * jitter * scale * slow
  }

  private signals(): RelationSignal[] {
    return [
      { id: 'amber', color: 0xe8b969, x: 380, y: 380, shape: 'circle' },
      { id: 'violet', color: 0xb59ad8, x: 1_000, y: 250, shape: 'diamond' },
      { id: 'blue', color: 0x79bfca, x: 1_560, y: 430, shape: 'ring' },
    ]
  }

  private partner(): RelationSignal {
    const id = this.preferred ?? 'amber'
    return this.signals().find((signal) => signal.id === id) ?? this.signals()[0]
  }

  private origin(call: Call): Phaser.Math.Vector2 {
    if (call.from === 'player') return this.player
    const signal = this.signals().find((entry) => entry.id === call.from) ?? this.signals()[0]
    return new Phaser.Math.Vector2(signal.x, signal.y)
  }

  private applySafetyNet(): void {
    if (this.phase !== 1) return
    if (!this.safetyNetApplied && this.elapsedMs >= this.maximumDurationMs * 0.5) {
      this.safetyNetApplied = true
      while (this.hintManager.getLevel() < 3) this.hintManager.forceNext()
      this.exchangeTarget = Math.max(1, Math.min(EXCHANGE_TARGET, this.exchanges + 2))
      this.goal.relabel('Wechsel', this.exchangeTarget)
      this.goal.setValue(this.exchanges)
      return
    }
    // Zweite Stufe: Das Ende des Abschnitts ist der Teil, der im Unterricht zählt.
    if (this.safetyNetApplied && this.elapsedMs >= this.maximumDurationMs * 0.62) this.enterPhase(2)
  }

  private updatePhase(): void {
    const scale = this.services.getTimeScale()
    if (this.phase === 0 && this.preferred) return this.enterPhase(1)
    // Wer nicht antwortet, bekommt nach einer Weile ein Gegenueber zugewiesen. Ohne das bleibt
    // ein zoegernder Durchlauf in der Wahlphase stehen und sieht vom Abschnitt gar nichts.
    if (this.phase === 0 && this.elapsedMs >= 17_000 * scale) {
      this.preferred = this.call && this.call.from !== 'player' ? this.call.from : 'amber'
      this.services.ui.setHint('Einer bleibt bei dir.')
      return this.enterPhase(1)
    }
    if (this.phase === 1 && this.exchanges >= this.exchangeTarget) return this.enterPhase(2)
    if (this.phase === 2 && this.fadingDelivered >= FADING_TARGET && !this.call) return this.enterPhase(3)
    if (this.phase === 3 && (this.unanswered >= UNANSWERED_TARGET || this.elapsedMs - this.phaseStartedAt >= 15_000 * scale)) {
      this.goal.setValue(this.goal.target)
      this.finishLevel()
    }
  }

  private enterPhase(next: number): void {
    if (this.phase === next) return
    this.phase = next
    this.phaseStartedAt = this.elapsedMs
    this.call = null
    const scale = this.services.getTimeScale()
    if (next === 1) {
      this.goal.relabel('Wechsel', this.exchangeTarget)
      this.goal.setValue(0)
      this.goal.resetBuffer(0.8)
      this.nextCallAt = this.elapsedMs + 900 * scale
      this.services.ui.setInstruction('Antworte, wenn der Ruf dich erreicht.')
      this.services.audio.playMotif('bond')
    } else if (next === 2) {
      this.goal.relabel('Schwächer', FADING_TARGET)
      this.goal.setValue(0)
      this.nextCallAt = this.elapsedMs + 1_800 * scale
      this.services.ui.setInstruction('Antworte weiter.')
      this.services.audio.playMotif('care', 0.14)
    } else if (next === 3) {
      this.goal.relabel('Deine Rufe', UNANSWERED_TARGET)
      this.goal.setValue(0)
      this.goal.resetBuffer(0)
      this.services.ui.setInstruction('Du kannst rufen.')
      this.services.ui.setHint('Leertaste')
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
    this.player.y = Phaser.Math.Clamp(this.player.y + this.velocity.y * frameScale, 200, 940)
  }

  private updateMechanics(delta: number): void {
    const scale = this.services.getTimeScale()
    const pressed = this.inputManager.justActionDown() && this.stumbleMs <= 0

    if (this.phase !== 0 && Phaser.Math.Distance.BetweenPoints(this.player, this.partner()) < 260) {
      this.closeMs += delta
    }

    if (this.phase === 3) {
      if (pressed) {
        this.unanswered += 1
        this.call = { from: 'player', startedAt: this.elapsedMs, travelMs: 1_100 * scale, strength: 0.5, resolved: false }
        this.goal.setValue(this.unanswered)
        this.services.audio.pulse(196, 0.03)
      }
      if (this.call && this.elapsedMs - this.call.startedAt > this.call.travelMs * 1.6) this.call = null
      return
    }

    if (!this.call && this.elapsedMs >= this.nextCallAt) this.startIncomingCall()
    if (!this.call) return

    const age = this.elapsedMs - this.call.startedAt
    const offset = age - this.call.travelMs

    if (pressed && !this.call.resolved) {
      if (Math.abs(offset) <= this.toleranceMs()) this.registerHit()
      else this.registerMiss()
      return
    }
    if (!this.call.resolved && offset > this.toleranceMs() + 220 * scale) this.registerMiss()
  }

  /** Zu Beginn rufen die drei reihum. Wem man zuerst antwortet, mit dem geht es weiter. */
  private startIncomingCall(): void {
    const scale = this.services.getTimeScale()
    if (this.phase === 0) {
      const order: SignalId[] = ['amber', 'violet', 'blue']
      const from = order[this.openingIndex % order.length]
      this.openingIndex += 1
      this.call = { from, startedAt: this.elapsedMs, travelMs: this.travelMs(), strength: 1, resolved: false }
      this.services.audio.pulse(150 + this.openingIndex * 14, 0.03)
      return
    }
    const strength = this.phase === 2 ? Math.max(0.2, 1 - this.fadingDelivered * 0.22) : 1
    this.call = {
      from: this.partner().id, startedAt: this.elapsedMs, travelMs: this.travelMs(), strength, resolved: false,
    }
    this.services.audio.pulse(150 + this.exchanges * 6, 0.028 * strength)
    void scale
  }

  private registerHit(): void {
    if (!this.call) return
    this.call.resolved = true
    this.hits += 1
    this.streak += 1
    this.bestStreak = Math.max(this.bestStreak, this.streak)
    this.flash = 1
    const scale = this.services.getTimeScale()

    if (this.phase === 0) {
      // Die Wahl geschieht durch die Antwort selbst — kein Hinlaufen, keine zusätzliche Regel.
      this.preferred = this.call.from === 'player' ? 'amber' : this.call.from
      this.services.audio.pulse(250, 0.06)
      this.call = null
      return
    }

    this.services.audio.pulse(232 + (this.streak % 4) * 26, 0.05)
    if (this.phase === 1) {
      this.exchanges += 1
      this.goal.setValue(this.exchanges)
      this.goal.fillBuffer(0.13)
      const pause = this.exchanges >= 3 ? 480 + ((this.exchanges * 613) % 900) : 820
      this.nextCallAt = this.elapsedMs + pause * scale
    } else {
      this.fadingDelivered += 1
      this.goal.setValue(this.fadingDelivered)
      this.nextCallAt = this.elapsedMs + 2_300 * scale
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
    if (this.phase === 0) {
      this.call = null
      this.nextCallAt = this.elapsedMs + 700 * scale
      return
    }
    if (this.phase === 1) {
      if (this.goal.drainBuffer(0.24)) {
        this.stumbleMs = 800 * scale
        this.cameras.main.shake(200, 0.0035)
      }
      this.nextCallAt = this.elapsedMs + 1_000 * scale
    } else {
      this.fadingDelivered += 1
      this.goal.setValue(this.fadingDelivered)
      this.nextCallAt = this.elapsedMs + 2_300 * scale
    }
    this.call = null
  }

  private sample(delta: number): void {
    this.sampleClock += delta
    if (this.sampleClock < 110) return
    const distance = this.phase === 0 ? 999 : Phaser.Math.Distance.BetweenPoints(this.player, this.partner())
    this.services.telemetry.sample((this.player.x - 960) / 820, this.velocity.length() / 10, distance < 260, this.sampleClock)
    this.sampleClock = 0
  }

  private drawWorld(time: number): void {
    const g = this.graphics
    g.clear()
    const warmth = this.phase === 1 ? Phaser.Math.Clamp(this.exchanges / this.exchangeTarget, 0, 1) : this.phase >= 2 ? 0.25 : 0
    ground(g, 0x0a0910, Phaser.Display.Color.GetColor(
      Math.round(20 + warmth * 16), Math.round(15 + warmth * 26), Math.round(24 + warmth * 20),
    ))
    dust(g, time, 42, 0xd9d2e4, 0.011)

    const partnerId = this.preferred
    this.signals().forEach((signal, index) => {
      if (this.phase > 0 && signal.id !== partnerId) return
      const strength = this.phase === 2
        ? Math.max(0.18, 1 - this.fadingDelivered / (FADING_TARGET + 1))
        : this.phase === 3 ? 0.12 : 1
      this.drawSignal(g, signal, time, index, this.phase === 0 ? 1 : strength)
    })

    this.drawCall(g)

    // Empfangsring: der Ort, an dem der Ruf ankommt. Er macht den Moment sichtbar.
    const receiving = this.phase !== 3 && this.call !== null && !this.call.resolved
    if (receiving) {
      const offset = Math.abs((this.elapsedMs - this.call!.startedAt) - this.call!.travelMs)
      const near = Phaser.Math.Clamp(1 - offset / (this.toleranceMs() * 2.2), 0, 1)
      g.lineStyle(3 + near * 4, 0xf6e6bc, 0.2 + near * 0.7)
      g.strokeCircle(this.player.x, this.player.y, 36)
    }

    const stumble = this.stumbleMs > 0
    self(g, this.player.x, this.player.y, time, 1, stumble ? 0.5 : 1)
    if (this.flash > 0) {
      g.lineStyle(5, 0xf6e6bc, this.flash * 0.6)
      g.strokeCircle(this.player.x, this.player.y, 36 + (1 - this.flash) * 42)
    } else if (this.flash < 0) {
      g.lineStyle(3, 0xb2705a, -this.flash * 0.55)
      g.strokeCircle(this.player.x, this.player.y, 44)
    }

    vignette(g, 0.42)
    if (this.phase === 3) {
      const local = Phaser.Math.Clamp((this.elapsedMs - this.phaseStartedAt) / (15_000 * this.services.getTimeScale()), 0, 1)
      g.fillStyle(0x040307, local * 0.55)
      g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
    }
  }

  /**
   * Der Ruf ist ein Bogen, der vom Rufenden zum Empfänger wächst. Er erreicht den Spieler exakt
   * nach der Laufzeit — auch wenn der sich bewegt.
   */
  private drawCall(g: Phaser.GameObjects.Graphics): void {
    if (!this.call) return
    const origin = this.origin(this.call)
    const target = this.call.from === 'player'
      ? new Phaser.Math.Vector2(this.partner().x, this.partner().y)
      : this.player
    const distance = Phaser.Math.Distance.BetweenPoints(origin, target)
    const local = Phaser.Math.Clamp((this.elapsedMs - this.call.startedAt) / this.call.travelMs, 0, 1.6)
    const radius = distance * local
    if (radius <= 3) return
    const color = this.call.from === 'player'
      ? 0xf1dcc0
      : (this.signals().find((signal) => signal.id === this.call!.from) ?? this.signals()[0]).color
    const alpha = (this.call.from === 'player' ? 0.32 : 0.7) * this.call.strength
    g.lineStyle(this.call.from === 'player' ? 2.4 : 4.2, color, alpha * (local > 1 ? 0.35 : 1))
    g.strokeCircle(origin.x, origin.y, radius)
    g.lineStyle(1.6, color, alpha * 0.35)
    g.strokeCircle(origin.x, origin.y, Math.max(0, radius - 24))

    if (this.hintManager.getLevel() < 2 || this.call.from === 'player') return
    const angle = Phaser.Math.Angle.BetweenPoints(origin, target)
    g.fillStyle(color, 0.85)
    g.fillCircle(origin.x + Math.cos(angle) * radius, origin.y + Math.sin(angle) * radius, 9)
  }

  private drawSignal(
    g: Phaser.GameObjects.Graphics, signal: RelationSignal, time: number, index: number, strength: number,
  ): void {
    const pulse = 1 + Math.sin(time * 0.003 + index * 1.7) * 0.16
    glow(g, signal.x, signal.y, 150 * pulse, signal.color, 0.24 * strength)
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

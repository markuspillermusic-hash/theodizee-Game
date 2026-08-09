import Phaser from 'phaser'
import { ObjectiveHud } from '../components/ObjectiveHud'
import { GAME_HEIGHT, GAME_WIDTH } from '../config/gameConfig'
import { levels } from '../config/levels'
import { GoalTracker } from '../systems/GoalTracker'
import type { AssistanceLevel, Direction, LevelResult } from '../types'
import { TimedLevelScene } from './TimedLevelScene'

interface MemorySignal {
  x: number
  y: number
  color: number
  shape: number
}

interface DelayedInput {
  atMs: number
  x: number
  y: number
  active: boolean
}

const MEMORY_TARGET = 7
const MEMORY_POINTS: MemorySignal[] = [
  { x: 470, y: 320, color: 0xe8b969, shape: 0 },
  { x: 1480, y: 300, color: 0xb59ad8, shape: 1 },
  { x: 960, y: 800, color: 0x79bfca, shape: 2 },
  { x: 330, y: 780, color: 0xe8b969, shape: 1 },
  { x: 1600, y: 790, color: 0xb59ad8, shape: 2 },
  { x: 300, y: 540, color: 0x79bfca, shape: 0 },
  { x: 1620, y: 520, color: 0xe8b969, shape: 2 },
]

/**
 * Lass los.
 *
 * Der Abschnitt hat zwei Hälften. Zuerst wird aktiv gesammelt; die zuvor gewachsene Kontrolle
 * trägt. Nach dem Wendepunkt bauen Geschwindigkeit, Reaktion und Sichtfeld messbar ab — nicht als
 * Bild, sondern in der Steuerung. Dass das Erreichbare kleiner wird als das Gewollte, ist die
 * Aussage und darf nicht als Bedienfehler erscheinen.
 */
export class Level06State extends TimedLevelScene {
  private graphics!: Phaser.GameObjects.Graphics
  private player = new Phaser.Math.Vector2(960, 570)
  private velocity = new Phaser.Math.Vector2()
  private drift = new Phaser.Math.Vector2()
  private tension = 0.18
  private decay = 0
  private activeMs = 0
  private releaseMs = 0
  private currentReleaseMs = 0
  private longestReleaseMs = 0
  private sampleClock = 0
  private requiredReleaseMs = 4_000
  private released = false
  private lastChannel = -1
  private memoriesVisited = new Set<number>()
  private releasePhaseStarted = false
  private turningPointAt = -1
  private inputHistory: DelayedInput[] = []
  private memoryHold: number[] = []
  private objectiveHud!: ObjectiveHud
  private goal!: GoalTracker

  constructor() {
    super('Level06')
  }

  create(): void {
    this.player.set(960, 570)
    this.velocity.set(0, 0)
    this.drift.set(0, 0)
    this.tension = 0.18
    this.decay = 0
    this.activeMs = 0
    this.releaseMs = 0
    this.currentReleaseMs = 0
    this.longestReleaseMs = 0
    this.sampleClock = 0
    this.requiredReleaseMs = Math.max(500, 4_000 * this.services.getTimeScale())
    this.released = false
    this.lastChannel = -1
    this.memoriesVisited.clear()
    this.releasePhaseStarted = false
    this.turningPointAt = -1
    this.inputHistory = []
    this.memoryHold = []
    this.graphics = this.add.graphics()
    this.objectiveHud = new ObjectiveHud(this)
    this.goal = new GoalTracker(this.objectiveHud, {
      label: 'Erinnern', target: MEMORY_TARGET, bufferLabel: 'Kontrolle',
    })
    this.cameras.main.setBackgroundColor(0x060609)
    this.beginTimedLevel('Level06', levels.level06, 'AUSSCHNITT · 06', 'Suche die vertrauten Muster.', 'release', {
      goal: 'Sammle so viele vertraute Muster wie möglich. Halte am Ende still.',
      controls: 'WASD / Pfeiltasten · Maus oder Berührung',
    })
  }

  update(time: number, delta: number): void {
    if (this.finished) return
    const progress = this.advanceLevel(delta)
    if (this.finished || progress < 0) return
    this.goal.advance(delta)
    this.updateDecay(delta, progress)
    this.updateMemoryCollection(time, delta)
    this.updateControl(delta, progress)
    this.updateChannelCue(progress)
    this.drawWorld(time, progress)
    if (this.currentReleaseMs >= this.requiredReleaseMs) {
      this.released = true
      this.goal.setValue(this.goal.target)
      this.finishLevel()
    }
  }

  protected applyHint(level: AssistanceLevel): void {
    this.services.setAssistance(level)
    if (level === 1) this.services.ui.setHint(this.releasePhaseStarted ? 'Vier Sekunden keine Taste und keine Bewegung.' : 'Unbesuchte Muster leuchten stärker.')
    if (level === 2) this.services.ui.setHint(this.releasePhaseStarted ? 'Vier Sekunden keine Taste und keine Bewegung.' : 'Eine Linie zeigt zum nächsten Muster.')
    if (level === 3) this.services.ui.setHint(this.releasePhaseStarted ? 'Der Ruhefortschritt wird groß angezeigt.' : 'Der Abbau verlangsamt sich.')
  }

  protected collectResult(): LevelResult {
    return {
      choices: { released: this.released, heldOn: this.activeMs > this.releaseMs },
      metrics: {
        goalCount: this.memoriesVisited.size,
        goalTarget: MEMORY_TARGET,
        activeRatio: this.elapsedMs ? this.activeMs / this.elapsedMs : 0,
        releaseMs: this.releaseMs,
        longestReleaseMs: this.longestReleaseMs,
        finalTension: this.tension,
        finalDecay: this.decay,
        memoriesVisited: this.memoriesVisited.size,
      },
    }
  }

  protected afterLevelFinished(): void {
    this.services.audio.stopAmbient(0.8)
    this.services.ui.setScene('')
    this.cameras.main.fadeOut(1_050, 255, 255, 245)
    const testMode = this.services.getStatus().testMode
    this.time.delayedCall(testMode ? 380 : 1_150, () => this.scene.start('FinaleReplay'))
  }

  /**
   * Wendepunkt und Abbau. Vor dem Wendepunkt ist Aktivität die richtige Strategie, danach nicht
   * mehr — reines Nichtstun ab Levelstart bleibt in beiden Hälften die schlechteste Wahl.
   */
  private updateDecay(delta: number, progress: number): void {
    const scale = this.services.getTimeScale()
    if (this.turningPointAt < 0) {
      if (this.memoriesVisited.size >= 3 || progress >= 0.34) {
        this.turningPointAt = this.elapsedMs
        this.services.ui.setInstruction('Nimm mit, was noch geht.')
        this.services.audio.playMotif('release', 0.18)
      }
      this.goal.resetBuffer(1)
      return
    }
    const span = 21_000 * scale * (this.hintManager.getLevel() >= 3 ? 1.5 : 1)
    this.decay = Phaser.Math.Clamp((this.elapsedMs - this.turningPointAt) / span, 0, 1)
    this.goal.resetBuffer(1 - this.decay)
    void delta
  }

  private updateControl(delta: number, progress: number): void {
    const raw = this.inputManager.getVector(this.player.x, this.player.y)
    const frameScale = Phaser.Math.Clamp(delta / 16.667, 0.4, 2.4)

    // Verzögerte Eingabe: Der Befehl kommt an, nur später. Das ist Abbau, nicht Ruckeln.
    this.inputHistory.push({ atMs: this.elapsedMs, x: raw.x, y: raw.y, active: raw.active })
    const lagMs = this.decay * 420 * this.services.getTimeScale()
    while (this.inputHistory.length > 2 && this.inputHistory[1].atMs <= this.elapsedMs - lagMs) this.inputHistory.shift()
    const input = this.inputHistory[0]

    const active = raw.active || this.inputManager.isActionDown() || this.velocity.length() > 0.35
    const canRelease = this.memoriesVisited.size >= MEMORY_TARGET || this.decay >= 0.86

    if (canRelease && !this.releasePhaseStarted) {
      this.releasePhaseStarted = true
      this.currentReleaseMs = 0
      this.goal.relabel('Ruhe', 1)
      this.goal.setValue(0)
      this.services.ui.setInstruction('Halte 4 Sekunden still.')
      this.services.ui.setHint('Keine Taste und keine Bewegung.')
      this.services.audio.playMotif('release', 0.2)
    }

    if (active) {
      this.activeMs += delta
      this.currentReleaseMs = Math.max(0, this.currentReleaseMs - delta * 0.55)
      if (this.turningPointAt >= 0) this.tension = Phaser.Math.Clamp(this.tension + delta * 0.00032, 0, 1)
      if (input.active) {
        const power = Phaser.Math.Linear(0.52, 0.12, this.decay)
        this.velocity.x += input.x * power * frameScale
        this.velocity.y += input.y * power * frameScale
      }
      const direction: Direction = raw.x < -0.2 ? 'left' : raw.x > 0.2 ? 'right' : 'center'
      this.services.telemetry.recordDirection(direction)
    } else if (canRelease) {
      this.releaseMs += delta
      this.currentReleaseMs += delta
      this.longestReleaseMs = Math.max(this.longestReleaseMs, this.currentReleaseMs)
      this.tension = Phaser.Math.Clamp(this.tension - delta * 0.00042, 0, 1)
      this.goal.setValue(this.currentReleaseMs >= this.requiredReleaseMs ? 1 : 0)
    } else {
      this.currentReleaseMs = 0
      this.tension = Phaser.Math.Clamp(this.tension - delta * 0.00008, 0.08, 1)
    }

    // Abdrift: Die Richtung gehört zunehmend nicht mehr einem selbst.
    if (this.decay > 0) {
      const angle = Math.sin(this.elapsedMs * 0.00035) * 2.4 + Math.cos(this.elapsedMs * 0.00021) * 1.7
      this.drift.set(Math.cos(angle), Math.sin(angle)).scale(this.decay * 0.09 * frameScale)
      this.velocity.add(this.drift)
    }

    const maxSpeed = Phaser.Math.Linear(4.2, 1.5, this.decay)
    this.velocity.scale(Math.pow(raw.active ? 0.91 : 0.82, frameScale)).limit(maxSpeed)
    this.player.x = Phaser.Math.Clamp(this.player.x + this.velocity.x * frameScale, 250, 1670)
    this.player.y = Phaser.Math.Clamp(this.player.y + this.velocity.y * frameScale, 240, 840)

    this.sampleClock += delta
    if (this.sampleClock >= 120) {
      this.services.telemetry.sample((this.player.x - 960) / 680, this.velocity.length() / 8, !active, this.sampleClock)
      this.sampleClock = 0
    }
    void progress
  }

  private updateChannelCue(progress: number): void {
    const channel = Math.min(4, Math.floor(progress * 5))
    if (channel === this.lastChannel) return
    this.lastChannel = channel
    if (channel > 0) this.services.audio.playMotif('release', 0.22)
  }

  /**
   * Ein Muster wird nicht angetippt, sondern kurz gehalten. Unter Abdrift und wachsender
   * Verzögerung ist genau das die Aufgabe: etwas festhalten, das nicht stillhält.
   */
  private updateMemoryCollection(time: number, delta: number): void {
    if (this.releasePhaseStarted) return
    const signals = this.getFamiliarSignals(time)
    const reach = Phaser.Math.Linear(72, 40, this.decay)
    const required = 620 * this.services.getTimeScale()
    signals.forEach((signal, index) => {
      if (this.memoriesVisited.has(index)) return
      const held = this.memoryHold[index] ?? 0
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, signal.x, signal.y) > reach) {
        this.memoryHold[index] = Math.max(0, held - delta * 1.4)
        return
      }
      const next = held + delta
      this.memoryHold[index] = next
      if (next < required) return
      this.memoriesVisited.add(index)
      this.services.audio.pulse(168 + index * 22, 0.045)
      this.goal.add(1)
    })
  }

  private memoryHoldRatio(index: number): number {
    const required = 620 * this.services.getTimeScale()
    return Phaser.Math.Clamp((this.memoryHold[index] ?? 0) / required, 0, 1)
  }

  private drawWorld(time: number, progress: number): void {
    const g = this.graphics
    g.clear()
    const fade = Phaser.Math.Clamp(progress * 0.5 + this.decay * 0.45 + this.tension * 0.12, 0, 0.96)
    g.fillStyle(Phaser.Display.Color.GetColor(
      Math.round(23 - fade * 18), Math.round(20 - fade * 15), Math.round(31 - fade * 25),
    ), 1)
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)

    const familiar = this.getFamiliarSignals(time)
    const nextIndex = familiar.findIndex((_, index) => !this.memoriesVisited.has(index))
    if (!this.releasePhaseStarted && nextIndex >= 0 && this.hintManager.getLevel() >= 2) {
      g.lineStyle(this.hintManager.getLevel() === 3 ? 5 : 3, familiar[nextIndex].color, 0.24)
      g.lineBetween(this.player.x, this.player.y, familiar[nextIndex].x, familiar[nextIndex].y)
    }

    familiar.forEach((signal, index) => {
      const visited = this.memoriesVisited.has(index)
      // Unerreichte Muster verblassen mit dem Abbau; erreichte bleiben als Verbindung stehen.
      const alpha = visited ? 0.78 : Phaser.Math.Clamp(0.52 - this.decay * 0.4, 0.05, 0.52)
      const pulse = 1 + Math.sin(time * 0.002 + index) * 0.12
      g.lineStyle(visited ? 5 : 3, signal.color, alpha)
      if (signal.shape === 0) g.strokeCircle(signal.x, signal.y, 24 * pulse)
      else if (signal.shape === 1) g.strokePoints([
        new Phaser.Geom.Point(signal.x, signal.y - 27), new Phaser.Geom.Point(signal.x + 27, signal.y),
        new Phaser.Geom.Point(signal.x, signal.y + 27), new Phaser.Geom.Point(signal.x - 27, signal.y),
      ], true)
      else {
        g.strokeCircle(signal.x, signal.y, 26 * pulse)
        g.strokeCircle(signal.x, signal.y, 11 * pulse)
      }
      g.fillStyle(signal.color, alpha * 0.9)
      g.fillCircle(signal.x, signal.y, 5)
      const hold = visited ? 0 : this.memoryHoldRatio(index)
      if (hold > 0.02) {
        g.lineStyle(6, signal.color, 0.75)
        g.beginPath()
        g.arc(signal.x, signal.y, 36, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * hold, false)
        g.strokePath()
      }
      if (visited) {
        g.lineStyle(2, signal.color, 0.18)
        g.lineBetween(this.player.x, this.player.y, signal.x, signal.y)
      }
    })

    const fieldRadius = Phaser.Math.Clamp(900 - this.decay * 640 - this.tension * 190, 115, 900)
    g.fillStyle(0xece9dc, 0.018)
    g.fillCircle(this.player.x, this.player.y, fieldRadius)
    g.lineStyle(3, 0xd9d7ca, 0.08 + (1 - this.tension) * 0.09)
    g.strokeCircle(this.player.x, this.player.y, fieldRadius)

    g.fillStyle(0xf3f0e6, Phaser.Math.Clamp(1 - this.decay * 0.35, 0.35, 1))
    g.fillCircle(this.player.x, this.player.y, 9 - this.decay * 3)

    if (this.releasePhaseStarted) {
      const centerGlow = Phaser.Math.Clamp(this.currentReleaseMs / this.requiredReleaseMs, 0, 1)
      g.fillStyle(0xf2edcf, centerGlow * 0.16)
      g.fillCircle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 170 + Math.sin(time * 0.001) * 18)
      g.fillStyle(0xf5f1dc, centerGlow * 0.92)
      g.fillCircle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 5)
    }

    const edge = Phaser.Math.Clamp(this.decay * 0.6 + this.tension * 0.5, 0, 0.92)
    g.fillStyle(0x000000, edge)
    g.fillRect(0, 0, GAME_WIDTH, Math.max(0, (GAME_HEIGHT - fieldRadius * 1.1) / 2))
  }

  private getFamiliarSignals(time: number): MemorySignal[] {
    // Nach dem Wendepunkt ziehen die Muster zur Mitte und werden gleichzeitig schwerer erreichbar.
    const pull = this.decay * 0.34
    return MEMORY_POINTS.map((signal, index) => ({
      ...signal,
      x: Phaser.Math.Linear(signal.x + Math.sin(time * 0.0007 + index) * 34, 960, pull),
      y: Phaser.Math.Linear(signal.y + Math.cos(time * 0.0009 + index * 1.4) * 28, 540, pull),
    }))
  }
}

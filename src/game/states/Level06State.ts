import Phaser from 'phaser'
import { ObjectiveHud } from '../components/ObjectiveHud'
import { GAME_HEIGHT, GAME_WIDTH } from '../config/gameConfig'
import { levels } from '../config/levels'
import type { AssistanceLevel, Direction, LevelResult } from '../types'
import { TimedLevelScene } from './TimedLevelScene'

export class Level06State extends TimedLevelScene {
  private graphics!: Phaser.GameObjects.Graphics
  private player = new Phaser.Math.Vector2(960, 570)
  private velocity = new Phaser.Math.Vector2()
  private tension = 0.18
  private activeMs = 0
  private releaseMs = 0
  private currentReleaseMs = 0
  private longestReleaseMs = 0
  private sampleClock = 0
  private requiredReleaseMs = 18_000
  private released = false
  private lastChannel = -1
  private memoriesVisited = new Set<number>()
  private releasePhaseStarted = false
  private objectiveHud!: ObjectiveHud

  constructor() {
    super('Level06')
  }

  create(): void {
    this.player.set(960, 570)
    this.velocity.set(0, 0)
    this.tension = 0.18
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
    this.graphics = this.add.graphics()
    this.objectiveHud = new ObjectiveHud(this)
    this.objectiveHud.set('Signale', '0/3', 0)
    this.cameras.main.setBackgroundColor(0x060609)
    this.beginTimedLevel('Level06', levels.level06, 'AUSSCHNITT · 06', 'Berühre alle 3 Signale.', 'release', {
      goal: 'Berühre alle 3 Signale. Halte danach 4 Sekunden vollständig still.',
      controls: 'WASD / Pfeiltasten · Maus oder Berührung',
    })
    this.services.ui.setHint('Die drei Zielsignale sind im Spielfeld verteilt.')
  }

  update(time: number, delta: number): void {
    if (this.finished) return
    const progress = this.advanceLevel(delta)
    if (this.finished || progress < 0) return
    this.updateMemoryCollection(time, progress)
    this.updateControl(delta, progress)
    this.updateChannelCue(progress)
    if (this.releasePhaseStarted) {
      const releaseProgress = Phaser.Math.Clamp(this.currentReleaseMs / this.requiredReleaseMs, 0, 1)
      this.objectiveHud.set('Stillhalten', `${Math.round(releaseProgress * 100)} %`, releaseProgress)
    } else this.objectiveHud.set('Signale', `${this.memoriesVisited.size}/3`, this.memoriesVisited.size / 3)
    this.drawWorld(time, progress)
    if (this.currentReleaseMs >= this.requiredReleaseMs) {
      this.released = true
      this.finishLevel()
    }
  }

  protected applyHint(level: AssistanceLevel): void {
    this.services.setAssistance(level)
    if (level === 1) this.services.ui.setHint(this.releasePhaseStarted ? 'Vier Sekunden keine Taste und keine Bewegung.' : 'Unbesuchte Ziele leuchten stärker.')
    if (level === 2) this.services.ui.setHint('Vier Sekunden keine Taste und keine Bewegung.')
    if (level === 3) this.services.ui.setHint(this.releasePhaseStarted ? 'Der Ruhefortschritt wird groß und deutlich angezeigt.' : 'Eine Führungslinie zeigt zum nächsten Signal.')
  }

  protected collectResult(): LevelResult {
    return {
      choices: { released: this.released, heldOn: this.activeMs > this.releaseMs },
      metrics: {
        activeRatio: this.elapsedMs ? this.activeMs / this.elapsedMs : 0,
        releaseMs: this.releaseMs,
        longestReleaseMs: this.longestReleaseMs,
        finalTension: this.tension,
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

  private updateControl(delta: number, progress: number): void {
    const input = this.inputManager.getVector(this.player.x, this.player.y)
    const frameScale = Phaser.Math.Clamp(delta / 16.667, 0.4, 2.4)
    const active = input.active || this.inputManager.isActionDown() || this.velocity.length() > 0.35
    const canRelease = this.memoriesVisited.size >= 3 || progress >= 0.72

    if (canRelease && !this.releasePhaseStarted) {
      this.releasePhaseStarted = true
      this.currentReleaseMs = 0
      this.services.ui.setInstruction('Halte 4 Sekunden still.')
      this.services.ui.setHint('Keine Taste und keine Bewegung.')
      this.services.audio.playMotif('release', 0.2)
    }

    if (active) {
      this.activeMs += delta
      this.currentReleaseMs = Math.max(0, this.currentReleaseMs - delta * 0.55)
      this.tension = Phaser.Math.Clamp(this.tension + delta * 0.00032, 0, 1)
      this.velocity.x += input.x * 0.58 * frameScale
      this.velocity.y += input.y * 0.58 * frameScale
      const direction: Direction = input.x < -0.2 ? 'left' : input.x > 0.2 ? 'right' : 'center'
      this.services.telemetry.recordDirection(direction)
    } else if (canRelease) {
      this.releaseMs += delta
      this.currentReleaseMs += delta
      this.longestReleaseMs = Math.max(this.longestReleaseMs, this.currentReleaseMs)
      this.tension = Phaser.Math.Clamp(this.tension - delta * 0.00042, 0, 1)
    } else {
      this.currentReleaseMs = 0
      this.tension = Phaser.Math.Clamp(this.tension - delta * 0.00008, 0.08, 1)
    }

    this.velocity.scale(Math.pow(input.active ? 0.91 : 0.82, frameScale)).limit(7.5)
    this.player.x = Phaser.Math.Clamp(this.player.x + this.velocity.x * frameScale, 280, 1640)
    this.player.y = Phaser.Math.Clamp(this.player.y + this.velocity.y * frameScale, 240, 840)
    this.sampleClock += delta
    if (this.sampleClock >= 120) {
      this.services.telemetry.sample((this.player.x - 960) / 680, this.velocity.length() / 8, !active, this.sampleClock)
      this.sampleClock = 0
    }
  }

  private updateChannelCue(progress: number): void {
    const channel = Math.min(4, Math.floor(progress * 5))
    if (channel === this.lastChannel) return
    this.lastChannel = channel
    if (channel > 0) this.services.ui.setCaption('')
    if (channel > 0) this.services.audio.playMotif('release', 0.22)
  }

  private updateMemoryCollection(time: number, progress: number): void {
    const signals = this.getFamiliarSignals(time, progress)
    signals.forEach((signal, index) => {
      if (this.memoriesVisited.has(index)) return
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, signal.x, signal.y) > 72) return
      this.memoriesVisited.add(index)
      this.services.audio.pulse(170 + index * 34, 0.045)
      if (this.memoriesVisited.size === 3) this.services.ui.setCaption('')
    })
  }

  private drawWorld(time: number, progress: number): void {
    const g = this.graphics
    g.clear()
    const fade = Phaser.Math.Clamp(progress * 0.86 + this.tension * 0.2, 0, 0.96)
    const color = Phaser.Display.Color.GetColor(
      Math.round(23 - fade * 18),
      Math.round(20 - fade * 15),
      Math.round(31 - fade * 25),
    )
    g.fillStyle(color, 1)
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)

    const familiar = this.getFamiliarSignals(time, progress)
    const nextTarget = familiar.find((_, index) => !this.memoriesVisited.has(index))
    if (!this.releasePhaseStarted && nextTarget && this.hintManager.getLevel() >= 2) {
      g.lineStyle(this.hintManager.getLevel() === 3 ? 5 : 3, nextTarget.color, 0.24)
      g.lineBetween(this.player.x, this.player.y, nextTarget.x, nextTarget.y)
    }
    familiar.forEach((signal, index) => {
      const visited = this.memoriesVisited.has(index)
      const disappear = visited && this.releasePhaseStarted
        ? Phaser.Math.Clamp(1 - progress * (0.9 + index * 0.16), 0.08, 1)
        : 1
      if (disappear <= 0) return
      const x = signal.x
      const y = signal.y
      const pulse = 1 + Math.sin(time * 0.002 + index) * 0.12
      g.lineStyle(visited ? 5 : 3, signal.color, disappear * (visited ? 0.72 : 0.42))
      if (signal.shape === 0) g.strokeCircle(x, y, 24 * pulse)
      else if (signal.shape === 1) g.strokePoints([
        new Phaser.Geom.Point(x, y - 27), new Phaser.Geom.Point(x + 27, y),
        new Phaser.Geom.Point(x, y + 27), new Phaser.Geom.Point(x - 27, y),
      ], true)
      else {
        g.strokeCircle(x, y, 26 * pulse)
        g.strokeCircle(x, y, 11 * pulse)
      }
      g.fillStyle(signal.color, disappear * 0.72)
      g.fillCircle(x, y, 5)
      if (visited) {
        g.lineStyle(2, signal.color, disappear * 0.2)
        g.lineBetween(this.player.x, this.player.y, x, y)
      }
    })

    const fieldRadius = Phaser.Math.Clamp(900 - progress * 610 - this.tension * 250, 115, 900)
    g.fillStyle(0xece9dc, 0.018)
    g.fillCircle(this.player.x, this.player.y, fieldRadius)
    g.lineStyle(3, 0xd9d7ca, 0.08 + (1 - this.tension) * 0.09)
    g.strokeCircle(this.player.x, this.player.y, fieldRadius)

    const pointAlpha = Phaser.Math.Clamp(1 - progress * 0.35, 0.35, 1)
    g.fillStyle(0xf3f0e6, pointAlpha)
    g.fillCircle(this.player.x, this.player.y, 9 - progress * 3)
    if (progress > 0.72) {
      const centerGlow = Phaser.Math.Clamp((progress - 0.72) / 0.28, 0, 1) * (1 - this.tension)
      g.fillStyle(0xf2edcf, centerGlow * 0.14)
      g.fillCircle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 170 + Math.sin(time * 0.001) * 18)
      g.fillStyle(0xf5f1dc, centerGlow * 0.92)
      g.fillCircle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 5)
    }

    const edge = Phaser.Math.Clamp(progress * 0.65 + this.tension * 0.6, 0, 0.92)
    g.fillStyle(0x000000, edge)
    g.fillRect(0, 0, GAME_WIDTH, Math.max(0, (GAME_HEIGHT - fieldRadius * 1.1) / 2))
  }

  private getFamiliarSignals(time: number, progress: number): Array<{ x: number; y: number; color: number; shape: number }> {
    const base = [
      { x: 440, y: 430, color: 0xe8b969, shape: 0 },
      { x: 960, y: 300, color: 0xb59ad8, shape: 1 },
      { x: 1460, y: 520, color: 0x79bfca, shape: 2 },
    ]
    return base.map((signal, index) => ({
      ...signal,
      x: Phaser.Math.Linear(signal.x + Math.sin(time * 0.0007 + index) * 34, 960, progress * 0.32),
      y: Phaser.Math.Linear(signal.y + Math.cos(time * 0.0009 + index * 1.4) * 28, 520, progress * 0.32),
    }))
  }
}

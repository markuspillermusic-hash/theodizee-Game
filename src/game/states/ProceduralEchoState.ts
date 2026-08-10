import Phaser from 'phaser'
import { GAME_HEIGHT, GAME_WIDTH } from '../config/gameConfig'
import type { GameStateKey, ReplayClipVariant } from '../types'
import { BaseScene } from './BaseScene'

export abstract class ProceduralEchoState extends BaseScene {
  private graphics!: Phaser.GameObjects.Graphics
  private variant!: ReplayClipVariant
  private elapsedMs = 0
  private durationMs = 1
  private finished = false
  private readonly number: 2 | 3 | 4 | 5
  private readonly nextState: GameStateKey

  protected constructor(
    key: GameStateKey,
    number: 2 | 3 | 4 | 5,
    nextState: GameStateKey,
  ) {
    super(key)
    this.number = number
    this.nextState = nextState
  }

  create(): void {
    this.elapsedMs = 0
    this.finished = false
    const levelId = `level-0${this.number}`
    this.variant = this.services.replay.select(levelId, this.services.telemetry.get(levelId))
    this.durationMs = this.services.getStatus().testMode ? 3_600 : this.variant.durationMs
    this.services.enterState(`Echo0${this.number}` as GameStateKey, this.durationMs)
    this.services.setStatus({ selectedVariant: this.variant.id })
    this.services.ui.setScene(`ECHO · 0${this.number}`)
    this.services.ui.setInstruction('')
    this.services.ui.setHint('')
    this.services.ui.setCaption(this.variant.caption)
    this.services.audio.startAmbient('echo')
    this.graphics = this.add.graphics()
    this.cameras.main.setBackgroundColor(0x020304)
    // Der Rueckblick beginnt und endet im Licht: der Zustand zwischen zwei Leben.
    this.cameras.main.fadeIn(1_100, 255, 255, 250)
    void this.services.video.play(this.variant).then((result) => this.services.setStatus({ videoStatus: result.reason }))

    this.events.on('teacher:complete', this.finishEcho, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off('teacher:complete', this.finishEcho, this)
      this.services.video.skip()
      this.services.ui.setCaption('')
    })
  }

  update(time: number, delta: number): void {
    if (this.finished) return
    this.elapsedMs += delta
    const progress = Phaser.Math.Clamp(this.elapsedMs / this.durationMs, 0, 1)
    this.services.setStatus({ remainingMs: Math.max(0, this.durationMs - this.elapsedMs) })
    this.drawFallback(time, progress)
    if (this.elapsedMs >= this.durationMs) this.finishEcho()
  }

  private drawFallback(time: number, progress: number): void {
    if (this.number === 2) this.drawEchoTwo(time, progress)
    if (this.number === 3) this.drawEchoThree(time, progress)
    if (this.number === 4) this.drawEchoFour(time, progress)
    if (this.number === 5) this.drawEchoFive(time, progress)
  }

  private drawEchoTwo(time: number, progress: number): void {
    const g = this.graphics
    g.clear()
    g.fillGradientStyle(0x060604, 0x100d08, 0x21180e, 0x070604, 1)
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
    const direction = this.variant.tags.includes('near') ? 1 : -1
    for (let index = 0; index < 8; index += 1) {
      const x = ((index * 310 + progress * 1600 * direction + 5000) % 2400) - 240
      const y = 460 + (index % 3) * 90 + Math.sin(time * 0.002 + index) * 24
      g.fillStyle(0xd0c4a0, 0.16)
      g.fillEllipse(x, y, 210, 96)
      for (let stripe = -2; stripe <= 2; stripe += 1) {
        g.lineStyle(12, 0x191714, 0.56)
        g.lineBetween(x + stripe * 32, y - 42, x + stripe * 15, y + 42)
      }
      g.fillStyle(0xd9c697, 0.12)
      g.fillCircle(x - 70, 790, 10 + (index % 4) * 4)
    }
    if (progress > 0.58) {
      const x = Phaser.Math.Linear(-420, 620, (progress - 0.58) / 0.42)
      g.fillStyle(0x020202, 0.86)
      g.fillTriangle(x - 260, 330, x + 210, 570, x - 280, 820)
      g.lineStyle(6, 0xc88e50, 0.3)
      g.lineBetween(x - 300, 600, x + 80, 570)
    }
    this.drawFade(g, progress)
  }

  private drawEchoThree(time: number, progress: number): void {
    const g = this.graphics
    g.clear()
    g.fillGradientStyle(0x080604, 0x160e08, 0x28170b, 0x070605, 1)
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
    const warm = this.variant.tags.includes('warm')
    const adultX = Phaser.Math.Linear(1540, 780, Phaser.Math.Clamp(progress * 1.5, 0, 1))
    const adultY = warm ? 390 : 680
    g.fillStyle(warm ? 0xe6b665 : 0x8ebac3, 0.14)
    g.fillCircle(adultX, adultY, 100 + Math.sin(time * 0.003) * 10)
    g.fillStyle(0xf0cc86, 0.9)
    g.fillCircle(adultX, adultY, 15)
    ;[[700, 560], [790, 650], [875, 555]].forEach(([x, y], index) => {
      g.lineStyle(3, 0xe9c886, 0.55)
      g.strokeCircle(x, y, 24 + Math.sin(time * 0.003 + index) * 5)
      g.fillStyle(0xf0d8a7, 0.84)
      g.fillCircle(x, y, 6)
    })
    if (progress > 0.66) {
      for (let x = 1420; x < 1920; x += 82) {
        g.lineStyle(3, 0xdde3de, 0.19)
        g.lineBetween(x, 180, x, 900)
      }
      const wave = Phaser.Math.Clamp((progress - 0.78) / 0.22, 0, 1) * 900
      g.lineStyle(14, 0xf3e2b7, 0.34)
      g.strokeCircle(1840, 540, wave)
    }
    this.drawFade(g, progress)
  }

  private drawEchoFour(time: number, progress: number): void {
    const g = this.graphics
    g.clear()
    g.fillGradientStyle(0x070707, 0x101113, 0x25191a, 0x080707, 1)
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
    const upper = this.variant.tags.includes('upper')
    const routeY = upper ? 340 : 740
    for (let index = 0; index < 28; index += 1) {
      g.fillStyle(0xb9afad, 0.025 + (index % 3) * 0.012)
      g.fillCircle((index * 157 + time * 0.02) % 2100 - 90, 180 + (index * 113) % 720, 45 + (index % 5) * 13)
    }
    const travel = Phaser.Math.Clamp(progress * 1.22, 0, 1)
    const childX = Phaser.Math.Linear(260, 1660, travel)
    const parentX = Phaser.Math.Linear(360, 1250, Math.min(1, travel * 1.1))
    const y = Phaser.Math.Linear(540, routeY, Math.min(1, progress * 1.8))
    g.lineStyle(4, 0x9cd3d2, 0.36)
    g.lineBetween(parentX, y, childX, y)
    g.fillStyle(0xc8eeee, Math.max(0.08, 1 - progress * 0.92))
    g.fillCircle(parentX, y, 14)
    g.fillStyle(0xf2e5c7, 0.92)
    g.fillCircle(childX, y, 10)
    g.lineStyle(4, 0xe8e5d4, 0.48)
    g.strokeRect(1690, routeY - 120, 100, 240)
    this.drawFade(g, progress)
  }

  private drawEchoFive(time: number, progress: number): void {
    const g = this.graphics
    g.clear()
    g.fillGradientStyle(0x08060a, 0x140e18, 0x16302d, 0x09070b, 1)
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
    const amber = this.variant.tags.includes('amber')
    const points = [
      { x: 540, y: 430, color: 0xe8b969 }, { x: 960, y: 300, color: 0xb59ad8 }, { x: 1390, y: 520, color: 0x79bfca },
    ]
    points.forEach((point, index) => {
      const weakening = index === (amber ? 0 : 1) && progress > 0.58 ? 1 - (progress - 0.58) / 0.42 : 1
      g.lineStyle(3, point.color, 0.22 * weakening)
      g.lineBetween(GAME_WIDTH / 2, 720, point.x, point.y)
      g.fillStyle(point.color, 0.12 * weakening)
      g.fillCircle(point.x, point.y, 70 + Math.sin(time * 0.002 + index) * 10)
      g.fillStyle(point.color, 0.84 * weakening)
      g.fillCircle(point.x, point.y, 9)
    })
    if (progress > 0.7) {
      const chosen = points[amber ? 0 : 1]
      g.fillStyle(0xf1eee4, 0.9)
      g.fillCircle(chosen.x + 95, chosen.y + 75, 9)
      g.lineStyle(2, 0xf1eee4, 0.3)
      g.lineBetween(chosen.x, chosen.y, chosen.x + 95, chosen.y + 75)
    }
    this.drawFade(g, progress)
  }

  private drawFade(g: Phaser.GameObjects.Graphics, progress: number): void {
    const fade = progress > 0.9 ? (progress - 0.9) / 0.1 : 0
    g.fillStyle(0x010101, fade)
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
  }

  private finishEcho(): void {
    if (this.finished) return
    this.finished = true
    this.services.video.skip()
    this.services.ui.setCaption('')
    this.cameras.main.fadeOut(1_000, 255, 255, 250)
    this.time.delayedCall(1_030, () => this.scene.start(this.nextState))
  }
}

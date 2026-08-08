import Phaser from 'phaser'
import { GAME_HEIGHT, GAME_WIDTH } from '../config/gameConfig'
import type { ReplayClipVariant } from '../types'
import { BaseScene } from './BaseScene'

export class Echo01State extends BaseScene {
  private graphics!: Phaser.GameObjects.Graphics
  private variant!: ReplayClipVariant
  private elapsedMs = 0
  private durationMs = 12_000
  private finished = false

  constructor() {
    super('Echo01')
  }

  create(): void {
    this.elapsedMs = 0
    this.finished = false
    const telemetry = this.services.telemetry.get('level-01')
    this.variant = this.services.replay.select('level-01', telemetry)
    this.durationMs = this.services.getStatus().testMode ? 3_500 : this.variant.durationMs
    this.services.enterState('Echo01', this.durationMs)
    this.services.setStatus({ selectedVariant: this.variant.id })
    this.services.ui.setScene('ECHO · 01')
    this.services.ui.setInstruction('')
    this.services.ui.setHint('')
    this.services.ui.setCaption(this.variant.caption)
    this.services.audio.startAmbient('echo')

    this.cameras.main.setBackgroundColor(0x020806)
    this.cameras.main.fadeIn(650, 2, 8, 6)
    this.graphics = this.add.graphics()
    void this.services.video.play(this.variant).then((result) => {
      this.services.setStatus({ videoStatus: result.reason })
    })

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
    this.services.setStatus({ remainingMs: Math.max(0, this.durationMs - this.elapsedMs) })
    this.drawProceduralFallback(time, this.elapsedMs / this.durationMs)
    if (this.elapsedMs >= this.durationMs) this.finishEcho()
  }

  private drawProceduralFallback(time: number, progress: number): void {
    const graphics = this.graphics
    const direction = this.variant.tags.includes('left') ? -1 : 1
    graphics.clear()
    graphics.fillGradientStyle(0x020806, 0x07120c, 0x0a1c11, 0x020806, 1)
    graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)

    const bloomX = GAME_WIDTH / 2 + direction * 210
    for (let radius = 520; radius >= 120; radius -= 80) {
      graphics.fillStyle(0xddebb6, 0.012 + (520 - radius) * 0.000055)
      graphics.fillEllipse(bloomX, 340, radius * 1.55, radius)
    }

    const tipX = GAME_WIDTH / 2 + direction * (190 + Math.sin(time * 0.0014) * 80)
    const tipY = 360 + Math.sin(time * 0.0011 + direction) * 24
    graphics.lineStyle(34, 0x163727, 0.52)
    graphics.beginPath()
    graphics.moveTo(GAME_WIDTH / 2, GAME_HEIGHT + 80)
    graphics.lineTo(GAME_WIDTH / 2 + direction * 60, 770)
    graphics.lineTo(tipX, tipY)
    graphics.strokePath()
    graphics.lineStyle(5, 0xa2c28c, 0.82)
    graphics.beginPath()
    graphics.moveTo(GAME_WIDTH / 2, GAME_HEIGHT + 80)
    graphics.lineTo(GAME_WIDTH / 2 + direction * 60, 770)
    graphics.lineTo(tipX, tipY)
    graphics.strokePath()
    graphics.fillStyle(0xe6f2bf, 0.76)
    graphics.fillCircle(tipX, tipY, 10)

    if (progress > 0.56 && progress < 0.82) {
      const blurX = Phaser.Math.Linear(-500, 2350, (progress - 0.56) / 0.26)
      graphics.fillStyle(0x020403, 0.8)
      graphics.fillEllipse(blurX, 610, 720, 360)
      graphics.lineStyle(9, 0xd4ad69, 0.22)
      graphics.lineBetween(blurX - 420, 430, blurX + 340, 730)
    }

    const fade = progress > 0.88 ? (progress - 0.88) / 0.12 : 0
    graphics.fillStyle(0x010201, fade)
    graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
  }

  private finishEcho(): void {
    if (this.finished) return
    this.finished = true
    this.services.video.skip()
    this.services.ui.setCaption('')
    this.cameras.main.fadeOut(820, 2, 6, 5)
    this.time.delayedCall(850, () => this.scene.start('Level02'))
  }
}

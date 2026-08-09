import Phaser from 'phaser'
import { GAME_HEIGHT, GAME_WIDTH } from '../config/gameConfig'
import { BaseScene } from './BaseScene'

const DURATION_MS = 6_400

/**
 * Übergang 4 → 5, ohne Schnitt.
 *
 * Die Kamera folgt nicht dem Spieler, sondern dem, was weitergeht: Der Geschützte tritt durch die
 * Schwelle, der Schützende bleibt zurück und verblasst. Wer eben noch davorstand, ist nach diesem
 * Übergang der Gerettete — und weiß nicht, dass er eben noch der andere war.
 *
 * Kein Fade nach Schwarz, kein Briefing, kein HUD. Level 5 blendet aus derselben warmen Helligkeit
 * wieder auf, in die dieser Übergang mündet.
 */
export class Transition45State extends BaseScene {
  private graphics!: Phaser.GameObjects.Graphics
  private elapsedMs = 0
  private durationMs = DURATION_MS
  private started = false

  constructor() {
    super('Transition45')
  }

  create(): void {
    this.elapsedMs = 0
    this.started = false
    this.durationMs = DURATION_MS * this.services.getTimeScale()
    this.services.enterState('Transition45', this.durationMs)
    this.services.ui.setScene('', '')
    this.services.ui.setHint('')
    this.services.ui.setCaption('')
    this.services.ui.hideAction()
    this.cameras.main.setBackgroundColor(0x0b0908)
    this.graphics = this.add.graphics()
    this.events.on('teacher:complete', this.leave, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off('teacher:complete', this.leave, this)
    })
  }

  update(_time: number, delta: number): void {
    this.elapsedMs += delta
    const local = Phaser.Math.Clamp(this.elapsedMs / this.durationMs, 0, 1)
    this.services.setStatus({ remainingMs: Math.max(0, this.durationMs - this.elapsedMs) })
    this.draw(local)
    if (local >= 1) this.leave()
  }

  private leave(): void {
    if (this.started) return
    this.started = true
    this.services.setStatus({ remainingMs: 0 })
    this.scene.start('Level05')
  }

  private draw(local: number): void {
    const g = this.graphics
    g.clear()

    // Die Welt zieht nach links, weil die Kamera mit ihm mitgeht.
    const shift = Phaser.Math.Easing.Sine.InOut(local) * 760
    const wardX = 1_720 - shift + Phaser.Math.Easing.Sine.Out(local) * 520
    const wardY = 545
    const playerX = 1_500 - shift
    const brightness = Phaser.Math.Easing.Quadratic.In(local)

    g.fillGradientStyle(0x0a0908, 0x0a0908, 0x1c1512, 0x1c1512, 1)
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)

    // Die Schwelle, jetzt von der anderen Seite
    const thresholdX = 1_680 - shift
    g.fillStyle(0xe8eadc, 0.16 + brightness * 0.3)
    g.fillRect(thresholdX - 40, 200, 96, 620)
    g.lineStyle(4, 0xe7e8d7, 0.5)
    g.strokeRect(thresholdX - 40, 200, 96, 620)

    // Der Zurückbleibende: verliert Licht, bleibt aber bis zuletzt sichtbar
    const leftBehind = Phaser.Math.Clamp(1 - local * 1.35, 0, 1)
    if (leftBehind > 0.02) {
      g.fillStyle(0xf0e9d9, leftBehind * 0.1)
      g.fillCircle(playerX, 545, 76)
      g.fillStyle(0xf0e9d9, leftBehind * 0.9)
      g.fillCircle(playerX, 545, 12)
      g.lineStyle(3, 0xe0c88e, leftBehind * 0.6)
      g.strokeCircle(playerX, 545, 24)
      g.lineStyle(1.5, 0xb5dfe0, leftBehind * 0.22)
      g.lineBetween(playerX, 545, wardX, wardY)
    }

    // Der Weitergehende: wird zum Mittelpunkt und nimmt das Bild ein
    const grow = 1 + Phaser.Math.Easing.Quadratic.In(local) * 2.6
    g.fillStyle(0x9ecdd0, 0.12 + brightness * 0.2)
    g.fillCircle(wardX, wardY, 54 * grow)
    g.lineStyle(6, 0x9ecdd0, 0.9)
    g.strokeCircle(wardX, wardY, 30 * grow)
    g.fillStyle(0xc8eef0, 0.95)
    g.fillCircle(wardX, wardY, 8 * grow)

    // Die Helligkeit übernimmt das Bild — in genau den Ton, aus dem Level 5 wieder aufblendet.
    const wash = Phaser.Math.Clamp((local - 0.62) / 0.38, 0, 1)
    g.fillStyle(0xe8ce9e, Phaser.Math.Easing.Quadratic.In(wash))
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
  }
}

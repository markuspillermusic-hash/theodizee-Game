import Phaser from 'phaser'
import { GAME_HEIGHT, GAME_WIDTH } from '../config/gameConfig'
import { BaseScene } from './BaseScene'

export class TitleState extends BaseScene {
  private rings: Phaser.GameObjects.Arc[] = []

  constructor() {
    super('Title')
  }

  create(): void {
    this.services.enterState('Title')
    this.services.audio.stopAmbient()
    this.services.ui.setScene('SECHS AUSSCHNITTE · EIN ZUSAMMENHANG')
    this.services.ui.setHint('Gemeinsam am Beamer · nach jedem Echo wechselt die steuernde Person')
    this.services.ui.setCaption('')
    this.cameras.main.setBackgroundColor(0x020806)
    this.addAtmosphere(42)

    const glow = this.add.circle(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 30, 190, 0xa8caa3, 0.025)
    this.tweens.add({ targets: glow, alpha: 0.07, scale: 1.18, duration: 3_600, yoyo: true, repeat: -1 })
    this.rings = [230, 310, 410].map((radius, index) => {
      const ring = this.add.circle(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 30, radius)
      ring.setStrokeStyle(2, 0x789182, 0.13 - index * 0.025)
      return ring
    })

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 48, 'Ausschnitt', {
      color: '#edf4e7',
      fontFamily: 'Georgia, Cambria, serif',
      fontSize: '148px',
      fontStyle: 'italic',
    }).setOrigin(0.5)
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 92, 'DU SIEHST, WAS DIR MÖGLICH IST', {
      color: '#9fb0a5',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '21px',
      letterSpacing: 8,
    }).setOrigin(0.5)

    this.services.ui.showAction('AUSSCHNITT ÖFFNEN', () => this.begin())
    this.input.once('pointerup', () => this.begin())
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.services.ui.hideAction())
  }

  update(time: number): void {
    this.rings.forEach((ring, index) => {
      ring.setScale(1 + Math.sin(time * 0.00025 + index * 1.3) * 0.018)
      ring.setAlpha(0.55 + Math.sin(time * 0.00036 + index) * 0.25)
    })
  }

  private begin(): void {
    if (!this.scene.isActive()) return
    void this.services.audio.unlock()
    this.cameras.main.fadeOut(680, 2, 8, 6)
    this.time.delayedCall(700, () => this.scene.start('Intro'))
  }
}

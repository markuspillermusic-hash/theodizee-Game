import Phaser from 'phaser'
import { GAME_HEIGHT, GAME_WIDTH } from '../config/gameConfig'
import { BaseScene } from './BaseScene'

export class IntroState extends BaseScene {
  constructor() {
    super('Intro')
  }

  create(): void {
    this.services.enterState('Intro')
    this.services.ui.setScene('AUSSCHNITT · 01')
    this.services.ui.setHint('A / D · ← / → · Maus · Berührung')
    this.cameras.main.setBackgroundColor(0x020806)
    this.cameras.main.fadeIn(900, 2, 8, 6)
    this.addAtmosphere(26, 0x9dbca7)

    const aperture = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 520, 3, 0xdcebbb, 0.85)
    const point = this.add.circle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 7, 0xf1f5d4, 1)
    this.tweens.add({ targets: aperture, width: 920, alpha: 0.18, duration: 3_200, ease: 'Sine.inOut' })
    this.tweens.add({ targets: point, scale: 1.8, alpha: 0.4, duration: 1_400, yoyo: true, repeat: -1 })

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 130, 'Du musst nicht wissen, was du bist.', {
      color: '#e6eee4',
      fontFamily: 'Georgia, Cambria, serif',
      fontSize: '48px',
    }).setOrigin(0.5)
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 132, 'Nimm wahr, was antwortet.', {
      color: '#95aa9d',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '22px',
      letterSpacing: 5,
    }).setOrigin(0.5)

    this.services.ui.showAction('BEREIT', () => this.beginLevel())
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.services.ui.hideAction())
  }

  private beginLevel(): void {
    void this.services.audio.unlock()
    this.cameras.main.fadeOut(520, 2, 8, 6)
    this.time.delayedCall(540, () => this.scene.start('Level01'))
  }
}

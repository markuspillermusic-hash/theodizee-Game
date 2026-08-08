import Phaser from 'phaser'
import { GAME_HEIGHT, GAME_WIDTH } from '../config/gameConfig'
import { BaseScene } from './BaseScene'

export class EndState extends BaseScene {
  constructor() {
    super('End')
  }

  create(): void {
    this.services.enterState('End')
    this.services.audio.startAmbient('finale')
    this.services.ui.setScene('')
    this.services.ui.setHint('Das Bild kann für das anschließende Gespräch stehen bleiben.')
    this.services.ui.setCaption('')
    this.cameras.main.setBackgroundColor(0x05070a)
    this.cameras.main.fadeIn(1_800, 2, 4, 6)

    const colors = [0x8fb17e, 0xd4c49c, 0xe6b665, 0x9ed1d2, 0xb59ad8, 0xe8b969]
    const nodes = colors.map((color, index) => {
      const angle = index / colors.length * Math.PI * 2 - Math.PI / 2
      const node = this.add.circle(
        GAME_WIDTH / 2 + Math.cos(angle) * 430,
        GAME_HEIGHT / 2 + Math.sin(angle) * 230,
        8,
        color,
        0.82,
      )
      node.setStrokeStyle(2, color, 0.35)
      return node
    })
    nodes.forEach((node, index) => {
      this.tweens.add({ targets: node, scale: 1.5, alpha: 0.48, duration: 2_600 + index * 240, yoyo: true, repeat: -1, ease: 'Sine.inOut' })
    })
    this.add.circle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 180, 0xf1e8c8, 0.035)
    this.add.circle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 7, 0xf6f0da, 0.95)
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 16, 'Du hast immer nur einen Ausschnitt gesehen.', {
      color: '#f3f0e8',
      fontFamily: 'Georgia, Cambria, serif',
      fontSize: '64px',
      fontStyle: 'italic',
      align: 'center',
    }).setOrigin(0.5)
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 92, 'ENDE', {
      color: '#a9b4ac',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '18px',
      letterSpacing: 7,
    }).setOrigin(0.5)
    this.services.ui.showAction('NEUER DURCHLAUF', () => {
      this.services.telemetry.reset()
      this.scene.start('Title')
    })
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.services.ui.hideAction())
  }
}

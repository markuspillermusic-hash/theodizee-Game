import Phaser from 'phaser'
import { GAME_WIDTH } from '../config/gameConfig'

export class ObjectiveHud {
  private readonly panel: Phaser.GameObjects.Graphics
  private readonly label: Phaser.GameObjects.Text
  private readonly value: Phaser.GameObjects.Text
  private progress = 0

  constructor(scene: Phaser.Scene) {
    this.panel = scene.add.graphics().setDepth(40)
    this.label = scene.add.text(GAME_WIDTH - 430, 88, '', {
      fontFamily: 'Arial, sans-serif', fontSize: '17px', color: '#b9c1b8',
    }).setDepth(41)
    this.value = scene.add.text(GAME_WIDTH - 110, 82, '', {
      fontFamily: 'Arial, sans-serif', fontSize: '28px', fontStyle: 'bold', color: '#f1eddc',
    }).setOrigin(1, 0).setDepth(41)
  }

  set(label: string, value: string, progress = 0): void {
    this.label.setText(label.toUpperCase())
    this.value.setText(value)
    this.progress = Phaser.Math.Clamp(progress, 0, 1)
    this.draw()
  }

  private draw(): void {
    const x = GAME_WIDTH - 455
    const y = 65
    const width = 370
    this.panel.clear()
    this.panel.fillStyle(0x020504, 0.68)
    this.panel.fillRoundedRect(x, y, width, 82, 12)
    this.panel.lineStyle(2, 0xcfd4c4, 0.16)
    this.panel.strokeRoundedRect(x, y, width, 82, 12)
    this.panel.fillStyle(0xffffff, 0.08)
    this.panel.fillRoundedRect(x + 22, y + 61, width - 44, 5, 3)
    this.panel.fillStyle(0xe4d995, 0.72)
    this.panel.fillRoundedRect(x + 22, y + 61, (width - 44) * this.progress, 5, 3)
  }
}

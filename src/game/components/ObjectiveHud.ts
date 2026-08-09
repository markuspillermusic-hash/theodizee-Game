import Phaser from 'phaser'
import { GAME_WIDTH } from '../config/gameConfig'

export class ObjectiveHud {
  private readonly panel: Phaser.GameObjects.Graphics
  private readonly label: Phaser.GameObjects.Text
  private readonly value: Phaser.GameObjects.Text
  private readonly bufferLabel: Phaser.GameObjects.Text
  private progress = 0
  private buffer: number | null = null
  private bufferWarning = false

  constructor(scene: Phaser.Scene) {
    this.panel = scene.add.graphics().setDepth(40)
    this.label = scene.add.text(GAME_WIDTH - 430, 88, '', {
      fontFamily: 'Arial, sans-serif', fontSize: '17px', color: '#b9c1b8',
    }).setDepth(41)
    this.value = scene.add.text(GAME_WIDTH - 110, 82, '', {
      fontFamily: 'Arial, sans-serif', fontSize: '28px', fontStyle: 'bold', color: '#f1eddc',
    }).setOrigin(1, 0).setDepth(41)
    this.bufferLabel = scene.add.text(GAME_WIDTH - 430, 150, '', {
      fontFamily: 'Arial, sans-serif', fontSize: '14px', color: '#9aa39c',
    }).setDepth(41)
  }

  set(label: string, value: string, progress = 0): void {
    this.label.setText(label.toUpperCase())
    this.value.setText(value)
    this.progress = Phaser.Math.Clamp(progress, 0, 1)
    this.draw()
  }

  /** Zweiter Balken für den Puffer. `null` blendet ihn aus. */
  setBuffer(label: string | null, value: number | null): void {
    this.buffer = value === null ? null : Phaser.Math.Clamp(value, 0, 1)
    this.bufferWarning = this.buffer !== null && this.buffer < 0.3
    this.bufferLabel.setText(label === null ? '' : label.toUpperCase())
    this.bufferLabel.setColor(this.bufferWarning ? '#e0a071' : '#9aa39c')
    this.draw()
  }

  private draw(): void {
    const x = GAME_WIDTH - 455
    const y = 65
    const width = 370
    const height = this.buffer === null ? 82 : 118
    this.panel.clear()
    this.panel.fillStyle(0x020504, 0.68)
    this.panel.fillRoundedRect(x, y, width, height, 12)
    this.panel.lineStyle(2, 0xcfd4c4, 0.16)
    this.panel.strokeRoundedRect(x, y, width, height, 12)
    this.panel.fillStyle(0xffffff, 0.08)
    this.panel.fillRoundedRect(x + 22, y + 61, width - 44, 5, 3)
    this.panel.fillStyle(0xe4d995, 0.72)
    this.panel.fillRoundedRect(x + 22, y + 61, (width - 44) * this.progress, 5, 3)
    if (this.buffer === null) return
    this.panel.fillStyle(0xffffff, 0.07)
    this.panel.fillRoundedRect(x + 22, y + 97, width - 44, 5, 3)
    this.panel.fillStyle(this.bufferWarning ? 0xd98b5c : 0x8fbfae, 0.78)
    this.panel.fillRoundedRect(x + 22, y + 97, (width - 44) * this.buffer, 5, 3)
  }
}

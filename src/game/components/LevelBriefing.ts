import Phaser from 'phaser'
import { GAME_HEIGHT, GAME_WIDTH } from '../config/gameConfig'

export interface LevelBriefingCopy {
  goal: string
  controls: string
}

export class LevelBriefing {
  private readonly scene: Phaser.Scene
  private readonly objects: Phaser.GameObjects.GameObject[] = []
  private active = true
  private dismissible = false

  /**
   * `soft` haelt den Bildschirm durchscheinend. Nach einem schnittlosen Uebergang darf das
   * Briefing die vorige Szene nicht zudecken, sonst wirkt der Wechsel wie ein Ladebildschirm.
   */
  constructor(scene: Phaser.Scene, copy: LevelBriefingCopy, testMode: boolean, soft = false) {
    this.scene = scene
    const shade = scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020504, soft ? 0.5 : 0.94).setDepth(100)
    const panel = scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 960, 540, 0x090d0b, soft ? 0.9 : 0.98)
      .setStrokeStyle(2, 0xded8b9, 0.24).setDepth(101)
    const eyebrow = scene.add.text(GAME_WIDTH / 2, 315, 'DEIN ZIEL', {
      fontFamily: 'Arial, sans-serif', fontSize: '18px', color: '#9ca69e',
    }).setOrigin(0.5).setDepth(102)
    const goal = scene.add.text(GAME_WIDTH / 2, 425, copy.goal, {
      fontFamily: 'Georgia, Cambria, serif', fontSize: '42px', color: '#f2efe4',
      align: 'center', wordWrap: { width: 820 }, lineSpacing: 8,
    }).setOrigin(0.5).setDepth(102)
    const controlsLabel = scene.add.text(GAME_WIDTH / 2, 575, 'STEUERUNG', {
      fontFamily: 'Arial, sans-serif', fontSize: '16px', color: '#9ca69e',
    }).setOrigin(0.5).setDepth(102)
    const controls = scene.add.text(GAME_WIDTH / 2, 625, copy.controls, {
      fontFamily: 'Arial, sans-serif', fontSize: '22px', color: '#d9d6ca', align: 'center',
      wordWrap: { width: 820 },
    }).setOrigin(0.5).setDepth(102)
    const button = scene.add.rectangle(GAME_WIDTH / 2, 735, 330, 70, 0x2b3029, 1)
      .setStrokeStyle(2, 0xe6dfbd, 0.5).setDepth(102)
    const buttonText = scene.add.text(GAME_WIDTH / 2, 735, 'STARTEN', {
      fontFamily: 'Arial, sans-serif', fontSize: '20px', fontStyle: 'bold', color: '#f4f0df',
    }).setOrigin(0.5).setDepth(103)
    this.objects.push(shade, panel, eyebrow, goal, controlsLabel, controls, button, buttonText)

    scene.time.delayedCall(testMode ? 80 : 550, () => { this.dismissible = true })
    scene.input.keyboard?.on('keydown', this.dismiss, this)
    scene.input.on('pointerdown', this.dismiss, this)
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this)
  }

  isActive(): boolean {
    return this.active
  }

  destroy(): void {
    this.scene.input.keyboard?.off('keydown', this.dismiss, this)
    this.scene.input.off('pointerdown', this.dismiss, this)
    this.objects.forEach((object) => object.destroy())
    this.objects.length = 0
    this.active = false
  }

  private dismiss(): void {
    if (!this.active || !this.dismissible) return
    this.destroy()
  }
}

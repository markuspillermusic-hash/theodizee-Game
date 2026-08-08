import { GAME_HEIGHT, GAME_WIDTH } from '../config/gameConfig'
import { BaseScene } from './BaseScene'

export class PreloadState extends BaseScene {
  constructor() {
    super('Preload')
  }

  create(): void {
    this.services.enterState('Preload')
    this.services.setStatus({ preloadStatus: 'prüft lokale Medien und Fallbacks' })
    this.cameras.main.setBackgroundColor(0x020806)

    const mark = this.add.circle(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 26, 7, 0xeaf7bf, 0.9)
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 44, 'LOKALE MEDIEN WERDEN GEPRÜFT', {
      color: '#9eb2a5',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '18px',
      letterSpacing: 6,
    }).setOrigin(0.5)
    this.tweens.add({ targets: mark, alpha: 0.18, scale: 2.4, duration: 900, yoyo: true, repeat: -1 })

    const variants = this.services.replay.all()
    void Promise.all(variants.map((variant) => this.services.video.preload(variant))).then((results) => {
      const loaded = results.filter(Boolean).length
      this.services.setStatus({ preloadStatus: `${loaded}/${results.length} Filmclips bereit · Fallbacks aktiv` })
      this.time.delayedCall(280, () => this.scene.start('Title'))
    })
  }
}

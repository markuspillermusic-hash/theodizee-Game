import { BaseScene } from './BaseScene'

export class BootState extends BaseScene {
  constructor() {
    super('Boot')
  }

  create(): void {
    this.services.enterState('Boot')
    this.scene.start('Preload')
  }
}

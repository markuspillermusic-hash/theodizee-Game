import Phaser from 'phaser'
import { getActiveGameServices, type GameServices } from '../systems/GameServices'

export abstract class BaseScene extends Phaser.Scene {
  protected get services(): GameServices {
    return getActiveGameServices()
  }

  protected addAtmosphere(count: number, color = 0xa8c7ad): Phaser.GameObjects.Arc[] {
    return Array.from({ length: count }, () => {
      const particle = this.add.circle(
        Phaser.Math.Between(40, 1880),
        Phaser.Math.Between(40, 1040),
        Phaser.Math.FloatBetween(1.2, 3.8),
        color,
        Phaser.Math.FloatBetween(0.06, 0.28),
      )
      this.tweens.add({
        targets: particle,
        x: particle.x + Phaser.Math.Between(-80, 120),
        y: particle.y + Phaser.Math.Between(-50, 45),
        alpha: { from: particle.alpha, to: Math.max(0.02, particle.alpha * 0.25) },
        duration: Phaser.Math.Between(4_000, 9_000),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
      })
      return particle
    })
  }
}

import Phaser from 'phaser'

export class InputManager {
  private readonly scene: Phaser.Scene
  private readonly cursors: Phaser.Types.Input.Keyboard.CursorKeys
  private readonly keys: Record<'left' | 'right', Phaser.Input.Keyboard.Key>
  private pointerTarget: number | null = null
  private pointerActive = false

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    const keyboard = scene.input.keyboard
    if (!keyboard) throw new Error('Keyboard input is unavailable')
    this.cursors = keyboard.createCursorKeys()
    this.keys = keyboard.addKeys({ left: 'A', right: 'D' }) as Record<'left' | 'right', Phaser.Input.Keyboard.Key>
    scene.input.on('pointerdown', this.onPointer, this)
    scene.input.on('pointermove', this.onPointerMove, this)
    scene.input.on('pointerup', this.onPointerUp, this)
  }

  getAxis(): number {
    const left = this.cursors.left.isDown || this.keys.left.isDown
    const right = this.cursors.right.isDown || this.keys.right.isDown
    return Number(right) - Number(left)
  }

  getPointerTarget(): number | null {
    return this.pointerActive ? this.pointerTarget : null
  }

  destroy(): void {
    this.scene.input.off('pointerdown', this.onPointer, this)
    this.scene.input.off('pointermove', this.onPointerMove, this)
    this.scene.input.off('pointerup', this.onPointerUp, this)
  }

  private onPointer(pointer: Phaser.Input.Pointer): void {
    this.pointerActive = true
    this.pointerTarget = Phaser.Math.Clamp((pointer.x / this.scene.scale.width) * 2 - 1, -1, 1)
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!pointer.isDown) return
    this.onPointer(pointer)
  }

  private onPointerUp(): void {
    this.pointerActive = false
  }
}

import Phaser from 'phaser'

export interface InputVector {
  x: number
  y: number
  active: boolean
}

export class SpatialInputManager {
  private readonly scene: Phaser.Scene
  private readonly cursors: Phaser.Types.Input.Keyboard.CursorKeys
  private readonly keys: Record<'left' | 'right' | 'up' | 'down' | 'action', Phaser.Input.Keyboard.Key>
  private pointerTarget: { x: number; y: number } | null = null
  private pointerActionQueued = false

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    const keyboard = scene.input.keyboard
    if (!keyboard) throw new Error('Keyboard input is unavailable')
    this.cursors = keyboard.createCursorKeys()
    this.keys = keyboard.addKeys({ left: 'A', right: 'D', up: 'W', down: 'S', action: 'SPACE' }) as typeof this.keys
    scene.input.on('pointerdown', this.onPointerDown, this)
    scene.input.on('pointermove', this.onPointerMove, this)
    scene.input.on('pointerup', this.onPointerUp, this)
  }

  getVector(currentX: number, currentY: number): InputVector {
    if (this.pointerTarget) {
      const dx = this.pointerTarget.x - currentX
      const dy = this.pointerTarget.y - currentY
      const length = Math.hypot(dx, dy)
      if (length < 10) return { x: 0, y: 0, active: false }
      return { x: dx / length, y: dy / length, active: true }
    }
    const x = Number(this.cursors.right.isDown || this.keys.right.isDown) - Number(this.cursors.left.isDown || this.keys.left.isDown)
    const y = Number(this.cursors.down.isDown || this.keys.down.isDown) - Number(this.cursors.up.isDown || this.keys.up.isDown)
    const length = Math.hypot(x, y)
    return length ? { x: x / length, y: y / length, active: true } : { x: 0, y: 0, active: false }
  }

  isActionDown(): boolean {
    return this.keys.action.isDown || this.cursors.space.isDown
  }

  justActionDown(): boolean {
    const triggered = Phaser.Input.Keyboard.JustDown(this.keys.action) || this.pointerActionQueued
    this.pointerActionQueued = false
    return triggered
  }

  clearTransientInput(): void {
    this.pointerActionQueued = false
  }

  destroy(): void {
    this.scene.input.off('pointerdown', this.onPointerDown, this)
    this.scene.input.off('pointermove', this.onPointerMove, this)
    this.scene.input.off('pointerup', this.onPointerUp, this)
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    this.pointerActionQueued = true
    this.pointerTarget = { x: pointer.x, y: pointer.y }
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (pointer.isDown) this.pointerTarget = { x: pointer.x, y: pointer.y }
  }

  private onPointerUp(): void {
    this.pointerTarget = null
  }
}

import Phaser from 'phaser'
import { GAME_HEIGHT, GAME_WIDTH } from '../config/gameConfig'
import type { LevelTelemetry } from '../types'
import { BaseScene } from './BaseScene'

export class FinaleReplayState extends BaseScene {
  private graphics!: Phaser.GameObjects.Graphics
  private elapsedMs = 0
  private durationMs = 300_000
  private beat = -1
  private finished = false
  private telemetry: Record<string, LevelTelemetry> = {}

  constructor() {
    super('FinaleReplay')
  }

  create(): void {
    this.elapsedMs = 0
    this.beat = -1
    this.finished = false
    this.telemetry = this.services.telemetry.getAll()
    this.durationMs = this.services.getStatus().testMode ? 20_000 : 300_000
    this.services.enterState('FinaleReplay', this.durationMs)
    this.services.ui.setScene('GESAMT-REPLAY')
    this.services.ui.setHint('Die gespeicherten Bewegungen kehren wieder.')
    this.services.ui.setCaption('')
    this.services.ui.hideAction()
    this.services.audio.startAmbient('finale')
    this.services.setStatus({ selectedVariant: this.describePlan() })
    this.graphics = this.add.graphics()
    this.cameras.main.setBackgroundColor(0x020305)
    this.cameras.main.fadeIn(1_500, 255, 255, 245)
    this.events.on('teacher:complete', this.finish, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.events.off('teacher:complete', this.finish, this))
  }

  update(time: number, delta: number): void {
    if (this.finished) return
    this.elapsedMs += delta
    const progress = Phaser.Math.Clamp(this.elapsedMs / this.durationMs, 0, 1)
    this.services.setStatus({ remainingMs: Math.max(0, this.durationMs - this.elapsedMs) })
    this.updateBeat(progress)
    this.drawReplay(time, progress)
    if (this.elapsedMs >= this.durationMs) this.finish()
  }

  private updateBeat(progress: number): void {
    const next = progress < 0.2 ? 0 : progress < 0.4 ? 1 : progress < 0.62 ? 2 : progress < 0.82 ? 3 : 4
    if (next === this.beat) return
    this.beat = next
    if (next === 0) {
      this.services.ui.setScene('GESAMT-REPLAY · IDENTITÄTEN')
      this.services.ui.setInstruction('Die Formen erhalten einen Namen.')
      this.services.ui.setCaption('[Gras. Zebra. Löwenfamilie. Kind. Erwachsener Mensch. Ein Leben am Ende.]')
      this.services.audio.playMotif('group')
    } else if (next === 1) {
      this.services.ui.setScene('GESAMT-REPLAY · PERSPEKTIVEN')
      this.services.ui.setInstruction('Dasselbe Ereignis. Verschiedene Wirklichkeiten.')
      this.services.ui.setCaption('[Rettung für das Gras. Gefahr für das Zebra. Fürsorge für die Jungen. Bedrohung für das Kind.]')
      this.services.audio.playSwiftMotif()
    } else if (next === 2) {
      this.services.ui.setScene('GESAMT-REPLAY · WIRKUNGSKETTE')
      this.services.ui.setInstruction('Energie → Leben → Fürsorge → Schutz → Opfer → Beziehung → Liebe')
      this.services.ui.setCaption('[Kein Ausschnitt enthält die ganze Kette. Jeder wirkt in den nächsten hinein.]')
      this.services.audio.playMotif('care')
    } else if (next === 3) {
      this.services.ui.setScene('GESAMT-REPLAY · DAS GANZE')
      this.services.ui.setInstruction('Jede Perspektive war real. Keine war vollständig.')
      this.services.ui.setCaption('[Freude und Leid bleiben unterscheidbar und werden zugleich als Zusammenhang sichtbar.]')
      this.services.audio.playMotif('bond')
    } else {
      this.services.ui.setScene('GESAMT-REPLAY · WIEDERERKENNEN')
      this.services.ui.setInstruction('Nichts geht im Ganzen verloren.')
      this.services.ui.setCaption('[Vertraute Motive kehren wieder. Die einzelnen Stimmen bleiben hörbar.]')
      this.services.audio.playMotif('whole', 0.22)
    }
  }

  private drawReplay(time: number, progress: number): void {
    if (this.beat === 0) this.drawIdentities(time, progress / 0.2)
    else if (this.beat === 1) this.drawPerspectives(time, (progress - 0.2) / 0.2)
    else if (this.beat === 2) this.drawChain(time, (progress - 0.4) / 0.22)
    else if (this.beat === 3) this.drawWhole(time, (progress - 0.62) / 0.2)
    else this.drawRecognition(time, (progress - 0.82) / 0.18)
  }

  private drawIdentities(time: number, local: number): void {
    const g = this.graphics
    g.clear()
    g.fillGradientStyle(0x030705, 0x07100b, 0x15160f, 0x040505, 1)
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
    const left = this.telemetry['level-01']?.primaryDirection === 'left'
    const bend = left ? -95 : 95
    g.lineStyle(7, 0x8fb17e, 0.75)
    g.beginPath()
    g.moveTo(220, 820)
    g.lineTo(220 + bend * 0.35, 650)
    g.lineTo(220 + bend, 450)
    g.strokePath()

    const near = (this.telemetry['level-02']?.metrics.groupNearRatio ?? 0.5) as number
    for (let index = 0; index < 5; index += 1) {
      const spread = Phaser.Math.Linear(110, 55, near)
      const x = 500 + index * spread
      g.fillStyle(0xd4c49c, 0.58)
      g.fillEllipse(x, 590 + Math.sin(index) * 40, 82, 34)
      g.lineStyle(7, 0x171510, 0.75)
      g.lineBetween(x - 20, 574, x + 10, 607)
    }

    const trailWarm = this.telemetry['level-03']?.choices.trail !== 'cool'
    const familyColor = trailWarm ? 0xe6b665 : 0x84b9c3
    ;[[900, 610], [970, 550], [1040, 625]].forEach(([x, y], index) => {
      g.lineStyle(3, familyColor, 0.6)
      g.strokeCircle(x, y, 18 + index * 3)
    })
    g.fillStyle(familyColor, 0.82)
    g.fillCircle(970, 470, 15)

    const upper = this.telemetry['level-04']?.choices.route !== 'lower'
    g.lineStyle(4, 0x9ed1d2, 0.5)
    g.lineBetween(1230, upper ? 470 : 680, 1360, upper ? 400 : 740)
    g.fillStyle(0xe8e4d7, 0.9)
    g.fillCircle(1360, upper ? 400 : 740, 10)

    const relationColor = this.relationColor()
    g.lineStyle(3, relationColor, 0.55)
    g.strokeCircle(1600, 520, 48 + Math.sin(time * 0.002) * 8)
    g.fillStyle(relationColor, 0.88)
    g.fillCircle(1600, 520, 10)
    g.lineStyle(2, 0xece8de, 0.26)
    g.strokeCircle(1760, 570, Phaser.Math.Linear(90, 24, Phaser.Math.Clamp(local, 0, 1)))
  }

  private drawPerspectives(time: number, local: number): void {
    const g = this.graphics
    g.clear()
    g.fillGradientStyle(0x050504, 0x140e08, 0x121517, 0x040405, 1)
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
    const centerX = 960
    const centerY = 540
    g.fillStyle(0xd49d58, 0.13)
    g.fillTriangle(centerX - 110, centerY - 90, centerX + 130, centerY, centerX - 110, centerY + 90)
    g.lineStyle(5, 0xe2b26e, 0.55)
    g.lineBetween(centerX - 160, centerY, centerX + 90, centerY)
    const nodes = [
      { x: 300, y: 300, color: 0x8fb17e }, { x: 330, y: 780, color: 0xd4c49c },
      { x: 1570, y: 300, color: 0xe6b665 }, { x: 1600, y: 760, color: 0xe8e4d7 },
    ]
    nodes.forEach((node, index) => {
      const pulse = 1 + Math.sin(time * 0.002 + index) * 0.12
      g.lineStyle(3, node.color, 0.28 + local * 0.16)
      g.lineBetween(centerX, centerY, node.x, node.y)
      g.fillStyle(node.color, 0.12)
      g.fillCircle(node.x, node.y, 66 * pulse)
      g.fillStyle(node.color, 0.86)
      g.fillCircle(node.x, node.y, 9)
    })
  }

  private drawChain(time: number, local: number): void {
    const g = this.graphics
    g.clear()
    g.fillGradientStyle(0x040604, 0x09110c, 0x171713, 0x050405, 1)
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
    const colors = [0xe9e2a6, 0x8fb17e, 0xd1c294, 0xe3aa61, 0x9ccdd0, 0xb99dd7, 0xf0bd85]
    const countVisible = Math.ceil(Phaser.Math.Clamp(local, 0, 1) * colors.length)
    colors.forEach((color, index) => {
      const x = 240 + index * 240
      const y = 540 + Math.sin(index * 1.45) * 120
      if (index < countVisible) {
        g.fillStyle(color, 0.1)
        g.fillCircle(x, y, 72 + Math.sin(time * 0.002 + index) * 8)
        g.fillStyle(color, 0.92)
        g.fillCircle(x, y, 10)
      }
      if (index > 0 && index < countVisible) {
        const previousX = 240 + (index - 1) * 240
        const previousY = 540 + Math.sin((index - 1) * 1.45) * 120
        g.lineStyle(5, color, 0.34)
        g.lineBetween(previousX, previousY, x, y)
      }
    })
  }

  private drawWhole(time: number, local: number): void {
    const g = this.graphics
    g.clear()
    g.fillGradientStyle(0x030506, 0x071012, 0x18121d, 0x040506, 1)
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
    const colors = [0x8fb17e, 0xd4c49c, 0xe6b665, 0x9ed1d2, this.relationColor(), 0xece8de]
    colors.forEach((color, index) => {
      const angle = index / colors.length * Math.PI * 2 + time * 0.00008
      const radius = Phaser.Math.Linear(330, 250, local)
      const x = GAME_WIDTH / 2 + Math.cos(angle) * radius
      const y = GAME_HEIGHT / 2 + Math.sin(angle) * radius * 0.58
      g.lineStyle(2.5, color, 0.22 + local * 0.12)
      g.lineBetween(GAME_WIDTH / 2, GAME_HEIGHT / 2, x, y)
      g.fillStyle(color, 0.13)
      g.fillCircle(x, y, 64)
      g.fillStyle(color, 0.9)
      g.fillCircle(x, y, 9)
    })
    g.fillStyle(0xf0e8ca, 0.08 + local * 0.08)
    g.fillCircle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 150 + Math.sin(time * 0.001) * 15)
  }

  private drawRecognition(time: number, local: number): void {
    const g = this.graphics
    g.clear()
    g.fillGradientStyle(0x05070a, 0x11151c, 0x281d2c, 0x07110f, 1)
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
    const colors = [0x8fb17e, 0xd4c49c, 0xe6b665, 0x9ed1d2, this.relationColor(), 0xece8de]
    colors.forEach((color, index) => {
      const angle = index / colors.length * Math.PI * 2 - Math.PI / 2
      const radiusX = 360 + index % 2 * 70
      const radiusY = 210 + index % 3 * 35
      const x = 960 + Math.cos(angle) * radiusX
      const y = 545 + Math.sin(angle) * radiusY
      const pulse = 1 + Math.sin(time * 0.0015 + index) * 0.12
      g.lineStyle(2, color, 0.22 + local * 0.22)
      g.strokeCircle(x, y, 48 * pulse)
      g.fillStyle(color, 0.92)
      g.fillCircle(x, y, 9)
    })
    const lostColor = this.relationColor()
    const returnAlpha = Phaser.Math.Clamp(local * 1.8, 0, 1)
    g.fillStyle(lostColor, 0.1 * returnAlpha)
    g.fillCircle(960, 545, 180 + Math.sin(time * 0.001) * 20)
    g.lineStyle(4, lostColor, 0.55 * returnAlpha)
    g.strokeCircle(960, 545, 36)
    g.fillStyle(0xf6efd8, 0.92 * returnAlpha)
    g.fillCircle(960, 545, 8)
  }

  private relationColor(): number {
    const preferred = this.telemetry['level-05']?.choices.preferredSignal
    if (preferred === 'violet') return 0xb59ad8
    if (preferred === 'blue') return 0x79bfca
    return 0xe8b969
  }

  private describePlan(): string {
    const side = this.telemetry['level-01']?.primaryDirection ?? 'center'
    const route = String(this.telemetry['level-04']?.choices.route ?? 'upper')
    const bond = String(this.telemetry['level-05']?.choices.preferredSignal ?? 'amber')
    return `finale:${side}:${route}:${bond}`
  }

  private finish(): void {
    if (this.finished) return
    this.finished = true
    this.services.ui.setCaption('')
    this.services.ui.setInstruction('')
    this.cameras.main.fadeOut(1_500, 1, 2, 3)
    this.time.delayedCall(1_550, () => this.scene.start('End'))
  }
}

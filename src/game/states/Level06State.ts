import Phaser from 'phaser'
import { ObjectiveHud } from '../components/ObjectiveHud'
import { GAME_HEIGHT, GAME_WIDTH } from '../config/gameConfig'
import { levels } from '../config/levels'
import { GoalTracker } from '../systems/GoalTracker'
import type { AssistanceLevel, Direction, LevelResult } from '../types'
import { TimedLevelScene } from './TimedLevelScene'

type MemoryKind = 'licht' | 'gras' | 'last' | 'gehueteter' | 'ruf'

interface MemorySignal {
  kind: MemoryKind
  x: number
  y: number
  color: number
}

/** Die Schichten in der Reihenfolge, in der sie erworben wurden. Sie fallen rückwärts weg. */
const LAYERS = ['Ausrichten', 'Bewegen', 'Tragen', 'Abschirmen', 'Antworten'] as const

const MEMORY_TARGET = 5
const HOLD_MS = 640
const LAYER_STEP_MS = 6_200
const ALIGN_REQUIRED_MS = 1_700
const LIGHT_X = 1_780
const LIGHT_Y = 470

/**
 * Lass los · „Rückwärts".
 *
 * Die fünf vertrauten Muster sind buchstäblich die Dinge aus den vorigen Leveln: der Lichtstreifen,
 * ein Grasbüschel, die Last, der Gehütete, die Rufwelle. Wer aufmerksam gespielt hat, erkennt sie
 * ohne ein Wort.
 *
 * Nach dem Wendepunkt fallen die erworbenen Schichten in umgekehrter Reihenfolge weg — zuletzt
 * gelernt, zuerst verloren. Übrig bleibt Ausrichten: das Erste, was der Halm in Level 1 konnte.
 * Ein Licht erscheint, man wendet sich ihm zu. Damit schließt sich der Kreis in der Steuerung, und
 * das Schlussbild braucht keinen erklärenden Satz.
 *
 * Nicht alle fünf Muster zu erreichen ist der Normalfall und darf nicht als Versagen erscheinen:
 * Das Erreichbare wird kleiner als das Gewollte.
 */
export class Level06State extends TimedLevelScene {
  private graphics!: Phaser.GameObjects.Graphics
  private player = new Phaser.Math.Vector2(960, 600)
  private velocity = new Phaser.Math.Vector2()
  private facing = -Math.PI / 2
  private memories: MemorySignal[] = []
  private memoryHold: number[] = []
  private visited = new Set<number>()
  private turningPointAt = -1
  private layersLost = 0
  private alignMs = 0
  private aligned = false
  private lightAt = -1
  private activeMs = 0
  private stillMs = 0
  private sampleClock = 0
  private objectiveHud!: ObjectiveHud
  private goal!: GoalTracker

  constructor() {
    super('Level06')
  }

  create(): void {
    this.player.set(960, 600)
    this.velocity.set(0, 0)
    this.facing = -Math.PI / 2
    this.memories = [
      { kind: 'licht', x: 430, y: 330, color: 0xe8b969 },
      { kind: 'gras', x: 1_500, y: 330, color: 0x9eb77f },
      { kind: 'last', x: 340, y: 780, color: 0xd9a25f },
      { kind: 'gehueteter', x: 1_560, y: 790, color: 0x9ecdd0 },
      { kind: 'ruf', x: 960, y: 250, color: 0xb59ad8 },
    ]
    this.memoryHold = []
    this.visited.clear()
    this.turningPointAt = -1
    this.layersLost = 0
    this.alignMs = 0
    this.aligned = false
    this.lightAt = -1
    this.activeMs = 0
    this.stillMs = 0
    this.sampleClock = 0
    this.graphics = this.add.graphics()
    this.objectiveHud = new ObjectiveHud(this)
    this.goal = new GoalTracker(this.objectiveHud, { label: 'Erinnern', target: MEMORY_TARGET })
    this.cameras.main.setBackgroundColor(0x070709)
    this.beginTimedLevel('Level06', levels.level06, 'AUSSCHNITT · 06', 'Such die vertrauten Muster.', 'release', {
      goal: 'Halte die vertrauten Muster noch einmal fest, solange du es kannst.',
      controls: 'WASD / Pfeiltasten · Maus oder Berührung',
    })
  }

  update(time: number, delta: number): void {
    if (this.finished) return
    const progress = this.advanceLevel(delta)
    if (this.finished || progress < 0) return
    this.goal.advance(delta)
    this.updateDecay(delta, progress)
    this.updateMemories(delta)
    this.updateControl(delta)
    this.updateAlignment(delta)
    this.drawWorld(time)
  }

  protected applyHint(level: AssistanceLevel): void {
    this.services.setAssistance(level)
    if (level === 1) this.services.ui.setHint(this.lightAt >= 0 ? 'Wende dich dem Licht zu.' : 'Halte ein Muster kurz fest.')
    if (level === 2) this.services.ui.setHint(this.lightAt >= 0 ? 'Wende dich dem Licht zu.' : 'Eine Linie zeigt zum nächsten Muster.')
    if (level === 3) this.services.ui.setHint(this.lightAt >= 0 ? 'Der Bogen zum Licht wird weit.' : 'Der Abbau verlangsamt sich.')
  }

  protected collectResult(): LevelResult {
    return {
      choices: { released: this.aligned, heldOn: this.activeMs > this.stillMs },
      metrics: {
        memoriesVisited: this.visited.size,
        memoryTarget: MEMORY_TARGET,
        layersLost: this.layersLost,
        alignedToLight: this.aligned ? 1 : 0,
        activeRatio: this.elapsedMs ? this.activeMs / this.elapsedMs : 0,
        gradeScore: this.visited.size >= 4 ? 2 : this.visited.size >= 2 ? 1 : 0,
      },
    }
  }

  protected afterLevelFinished(): void {
    this.services.audio.stopAmbient(0.8)
    this.services.ui.setScene('')
    this.cameras.main.fadeOut(1_400, 255, 255, 245)
    const testMode = this.services.getStatus().testMode
    this.time.delayedCall(testMode ? 380 : 1_500, () => this.scene.start('FinaleReplay'))
  }

  private timeScale(): number {
    return this.services.getTimeScale()
  }

  private canMove(): boolean {
    return this.layersLost < 4
  }

  private layerAlive(index: number): boolean {
    // LAYERS[0] ist Ausrichten und bleibt immer. Verloren wird von hinten.
    return index < LAYERS.length - this.layersLost
  }

  /**
   * Wendepunkt und Rückbau. Vor dem Wendepunkt trägt die gewachsene Kontrolle; danach fällt alle
   * 4,6 Sekunden eine Schicht weg — in der Reihenfolge, in der sie erworben wurde, von hinten.
   */
  private updateDecay(delta: number, progress: number): void {
    if (this.turningPointAt < 0) {
      if (this.visited.size >= 4 || progress >= 0.4) {
        this.turningPointAt = this.elapsedMs
        this.services.ui.setInstruction('Nimm mit, was noch geht.')
        this.services.audio.playMotif('release', 0.18)
      }
      return
    }
    const step = LAYER_STEP_MS * this.timeScale() * (this.hintManager.getLevel() >= 3 ? 1.5 : 1)
    const lost = Math.min(4, Math.floor((this.elapsedMs - this.turningPointAt) / step))
    if (lost === this.layersLost) return
    this.layersLost = lost
    this.services.audio.pulse(74 - lost * 6, 0.06)
    this.cameras.main.shake(220, 0.003)
    if (this.layersLost >= 4 && this.lightAt < 0) this.enterLight()
    void delta
  }

  private enterLight(): void {
    this.lightAt = this.elapsedMs
    this.velocity.set(0, 0)
    this.goal.relabel('Ausrichten', 1)
    this.goal.setValue(0)
    this.services.ui.setInstruction('Wende dich dem Licht zu.')
    this.services.ui.setHint('')
    this.services.audio.playMotif('release', 0.24)
  }

  private updateMemories(delta: number): void {
    if (this.lightAt >= 0) return
    const reach = Phaser.Math.Linear(74, 42, this.layersLost / 4)
    const required = HOLD_MS * this.timeScale()
    this.memories.forEach((memory, index) => {
      if (this.visited.has(index)) return
      const held = this.memoryHold[index] ?? 0
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, memory.x, memory.y) > reach) {
        this.memoryHold[index] = Math.max(0, held - delta * 1.4)
        return
      }
      // Ab dem Verlust von „Tragen" gleitet weg, was man festhalten will.
      const grip = this.layerAlive(2) ? 1 : 0.35
      const next = held + delta * grip
      this.memoryHold[index] = next
      if (next < required) return
      this.visited.add(index)
      this.services.audio.pulse(168 + index * 22, 0.05)
      this.goal.add(1)
    })
  }

  private holdRatio(index: number): number {
    return Phaser.Math.Clamp((this.memoryHold[index] ?? 0) / (HOLD_MS * this.timeScale()), 0, 1)
  }

  private updateControl(delta: number): void {
    const input = this.inputManager.getVector(this.player.x, this.player.y)
    const frameScale = Phaser.Math.Clamp(delta / 16.667, 0.4, 2.4)
    if (input.active) this.activeMs += delta
    else this.stillMs += delta

    if (input.active) {
      const direction: Direction = input.x < -0.2 ? 'left' : input.x > 0.2 ? 'right' : 'center'
      this.services.telemetry.recordDirection(direction)
    }

    if (this.canMove()) {
      const power = Phaser.Math.Linear(0.62, 0.2, this.layersLost / 4)
      if (input.active) {
        this.velocity.x += input.x * power * frameScale
        this.velocity.y += input.y * power * frameScale
      }
      const maxSpeed = Phaser.Math.Linear(4.6, 1.5, this.layersLost / 4)
      this.velocity.scale(Math.pow(input.active ? 0.92 : 0.84, frameScale)).limit(maxSpeed)
      this.player.x = Phaser.Math.Clamp(this.player.x + this.velocity.x * frameScale, 240, 1_660)
      this.player.y = Phaser.Math.Clamp(this.player.y + this.velocity.y * frameScale, 220, 880)
      if (this.velocity.lengthSq() > 0.05) this.facing = this.velocity.angle()
    } else if (input.active) {
      // Nur noch Ausrichten. Genau das, was der Halm in Level 1 konnte.
      const target = Math.atan2(input.y, input.x)
      this.facing = Phaser.Math.Angle.RotateTo(this.facing, target, 0.05 * frameScale)
      this.velocity.set(0, 0)
    }

    this.sampleClock += delta
    if (this.sampleClock >= 120) {
      this.services.telemetry.sample((this.player.x - 960) / 680, this.velocity.length() / 8, !input.active, this.sampleClock)
      this.sampleClock = 0
    }
  }

  private updateAlignment(delta: number): void {
    if (this.lightAt < 0 || this.aligned) return
    // Am Ende geschieht es, ob man sich zuwendet oder nicht. Niemand bleibt hier haengen.
    if (this.elapsedMs - this.lightAt >= 18_000 * this.timeScale()) {
      this.aligned = false
      this.services.audio.playMotif('release', 0.3)
      this.finishLevel()
      return
    }
    const toLight = Phaser.Math.Angle.Between(this.player.x, this.player.y, LIGHT_X, LIGHT_Y)
    const spread = this.hintManager.getLevel() >= 3 ? 0.6 : 0.34
    const off = Math.abs(Phaser.Math.Angle.Wrap(this.facing - toLight))
    if (off <= spread) {
      this.alignMs += delta
      if (this.alignMs >= ALIGN_REQUIRED_MS * this.timeScale()) {
        this.aligned = true
        this.goal.setValue(1)
        this.services.audio.playMotif('release', 0.3)
        this.finishLevel()
      }
    } else this.alignMs = Math.max(0, this.alignMs - delta * 0.8)
  }

  private drawWorld(time: number): void {
    const g = this.graphics
    g.clear()
    const dim = Phaser.Math.Clamp(this.layersLost / 4, 0, 1)
    g.fillStyle(Phaser.Display.Color.GetColor(
      Math.round(23 - dim * 17), Math.round(20 - dim * 15), Math.round(31 - dim * 24),
    ), 1)
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)

    this.drawMemories(g, time)
    this.drawLayers(g)
    if (this.lightAt >= 0) this.drawLight(g, time)
    this.drawPlayer(g, time, dim)

    // Das Sichtfeld schrumpft mit jeder verlorenen Schicht.
    const field = Phaser.Math.Linear(880, 250, dim)
    g.lineStyle(3, 0xd9d7ca, 0.07)
    g.strokeCircle(this.player.x, this.player.y, field)
    const edge = Phaser.Math.Clamp(dim * 0.72, 0, 0.9)
    g.fillStyle(0x000000, edge)
    g.fillRect(0, 0, GAME_WIDTH, Math.max(0, (GAME_HEIGHT - field * 1.15) / 2))
    g.fillRect(0, GAME_HEIGHT - Math.max(0, (GAME_HEIGHT - field * 1.15) / 2), GAME_WIDTH, Math.max(0, (GAME_HEIGHT - field * 1.15) / 2))
  }

  /** Die Anzeige der Schichten macht den Rückbau lesbar, ohne dass ein Satz ihn erklären muss. */
  private drawLayers(g: Phaser.GameObjects.Graphics): void {
    if (this.turningPointAt < 0) return
    const x = 92
    let y = 300
    for (let index = LAYERS.length - 1; index >= 0; index -= 1) {
      const alive = this.layerAlive(index)
      g.fillStyle(alive ? (index === 0 ? 0xe8b969 : 0xcfd6cb) : 0x4a4f48, alive ? 0.8 : 0.35)
      g.fillRect(x, y, 116, 5)
      if (!alive) {
        g.lineStyle(2, 0x6d7269, 0.6)
        g.lineBetween(x - 8, y + 2, x + 124, y + 2)
      }
      y += 34
    }
  }

  private drawMemories(g: Phaser.GameObjects.Graphics, time: number): void {
    const fadeUnreached = this.lightAt >= 0 ? 0 : Phaser.Math.Clamp(0.62 - this.layersLost * 0.14, 0.06, 0.62)
    const next = this.memories.findIndex((_, index) => !this.visited.has(index))
    if (this.lightAt < 0 && next >= 0 && this.hintManager.getLevel() >= 2) {
      g.lineStyle(3, this.memories[next].color, 0.22)
      g.lineBetween(this.player.x, this.player.y, this.memories[next].x, this.memories[next].y)
    }
    this.memories.forEach((memory, index) => {
      const visited = this.visited.has(index)
      const alpha = visited ? 0.8 : fadeUnreached
      if (alpha <= 0.02) return
      this.drawMemoryShape(g, memory, alpha, time, index)
      const hold = visited ? 0 : this.holdRatio(index)
      if (hold > 0.02) {
        g.lineStyle(6, memory.color, 0.8)
        g.beginPath()
        g.arc(memory.x, memory.y, 40, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * hold, false)
        g.strokePath()
      }
      if (visited) {
        g.lineStyle(2, memory.color, 0.2)
        g.lineBetween(this.player.x, this.player.y, memory.x, memory.y)
      }
    })
  }

  /** Jedes Muster ist die Form aus seinem Level, nicht ein abstraktes Zeichen. */
  private drawMemoryShape(
    g: Phaser.GameObjects.Graphics, memory: MemorySignal, alpha: number, time: number, index: number,
  ): void {
    const pulse = 1 + Math.sin(time * 0.002 + index) * 0.1
    const { x, y, color } = memory
    g.fillStyle(color, alpha * 0.12)
    g.fillCircle(x, y, 48 * pulse)
    switch (memory.kind) {
      case 'licht': {
        g.fillStyle(color, alpha * 0.5)
        g.fillTriangle(x - 16, y - 30, x + 16, y - 30, x + 8, y + 30)
        g.fillStyle(0xf4f8d8, alpha)
        g.fillCircle(x, y, 5)
        break
      }
      case 'gras': {
        g.lineStyle(3, color, alpha)
        g.lineBetween(x, y + 22, x + 2, y - 24)
        g.lineStyle(2, color, alpha * 0.7)
        g.lineBetween(x - 10, y + 22, x - 14, y - 12)
        g.lineBetween(x + 10, y + 22, x + 15, y - 10)
        g.fillStyle(0xe6ddaa, alpha)
        g.fillCircle(x + 2, y - 24, 4)
        break
      }
      case 'last': {
        g.lineStyle(4, color, alpha)
        g.strokeEllipse(x, y, 62, 34)
        g.fillStyle(color, alpha * 0.3)
        g.fillEllipse(x, y, 44, 22)
        break
      }
      case 'gehueteter': {
        g.lineStyle(4, color, alpha)
        g.strokeCircle(x, y, 22 * pulse)
        g.fillStyle(0xc8eef0, alpha)
        g.fillCircle(x, y, 7)
        break
      }
      default: {
        g.lineStyle(4, color, alpha)
        g.beginPath()
        g.arc(x, y, 30 * pulse, -1.1, 1.1, false)
        g.strokePath()
        g.lineStyle(2, color, alpha * 0.6)
        g.beginPath()
        g.arc(x, y, 46 * pulse, -0.9, 0.9, false)
        g.strokePath()
        break
      }
    }
  }

  private drawLight(g: Phaser.GameObjects.Graphics, time: number): void {
    const grow = Phaser.Math.Clamp((this.elapsedMs - this.lightAt) / (4_000 * this.timeScale()), 0, 1)
    const ready = Phaser.Math.Clamp(this.alignMs / (ALIGN_REQUIRED_MS * this.timeScale()), 0, 1)
    for (let ring = 4; ring >= 0; ring -= 1) {
      g.fillStyle(0xe8b969, (0.03 + ready * 0.05) * (1 + ring * 0.2))
      g.fillCircle(LIGHT_X, LIGHT_Y, (60 + ring * 70) * grow)
    }
    g.fillStyle(0xf4f8d8, 0.5 + ready * 0.5)
    g.fillCircle(LIGHT_X, LIGHT_Y, 10 + Math.sin(time * 0.002) * 2 + ready * 8)
    if (ready > 0.02) {
      g.lineStyle(3, 0xf2e9c4, ready * 0.5)
      g.lineBetween(this.player.x, this.player.y, LIGHT_X, LIGHT_Y)
    }
  }

  private drawPlayer(g: Phaser.GameObjects.Graphics, time: number, dim: number): void {
    const radius = 10 - dim * 3
    g.fillStyle(0xf3f0e6, 1 - dim * 0.35)
    g.fillCircle(this.player.x, this.player.y, radius)
    // Die Blickrichtung ist die letzte Fähigkeit und muss deshalb sichtbar sein.
    const length = this.canMove() ? 26 : 46
    g.lineStyle(this.canMove() ? 2 : 4, 0xf2e9c4, this.canMove() ? 0.4 : 0.9)
    g.lineBetween(
      this.player.x, this.player.y,
      this.player.x + Math.cos(this.facing) * length,
      this.player.y + Math.sin(this.facing) * length,
    )
    g.lineStyle(2, 0xd9d7ca, 0.16 + Math.sin(time * 0.002) * 0.04)
    g.strokeCircle(this.player.x, this.player.y, radius + 12)
  }
}

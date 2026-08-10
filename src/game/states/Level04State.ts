import Phaser from 'phaser'
import { ObjectiveHud } from '../components/ObjectiveHud'
import { GAME_HEIGHT, GAME_WIDTH } from '../config/gameConfig'
import { levels } from '../config/levels'
import { GoalTracker } from '../systems/GoalTracker'
import type { AssistanceLevel, Direction, LevelResult } from '../types'
import { TimedLevelScene } from './TimedLevelScene'

type Route = 'upper' | 'lower'

interface Ember {
  fromX: number
  fromY: number
  toX: number
  toY: number
  /** Der Punkt, an dem man stehen muss, um sie abzufangen: zwischen ihm und der Einschlagrichtung. */
  shieldX: number
  shieldY: number
  spawnedAt: number
  impactAt: number
  resolved: boolean
}

const SHIELD_TARGET = 14
const WARD_START_X = 240
const EXIT_X = 1620
const SHIELD_RADIUS = 82
const SHIELD_OFFSET = 96
const TELEGRAPH_MS = 1_350
const WAVE_INTERVAL_MS = 5_600
const FAREWELL_MS = 9_500

/**
 * Bewahre · „Dazwischen".
 *
 * Der Abschnitt hat kein Sammelziel und keinen eigenen Weg. Ein Schutzbefohlener geht allein zur
 * Schwelle; von den Seiten schlägt in Wellen Glut ein. Die einzige Aufgabe ist, den eigenen Körper
 * dazwischen zu bringen. Was dich trifft, kostet dich. Was durchkommt, kostet ihn.
 *
 * Bewertet wird, wie viel *er* am Ende noch hat — das erste Level, dessen Ziel nicht der eigene
 * Zähler ist.
 */
export class Level04State extends TimedLevelScene {
  private graphics!: Phaser.GameObjects.Graphics
  private player = new Phaser.Math.Vector2(420, 545)
  private velocity = new Phaser.Math.Vector2()
  private ward = new Phaser.Math.Vector2(WARD_START_X, 545)
  private wardIntegrity = 1
  private embers: Ember[] = []
  private wave = 0
  private waveAt = 2_600
  private phase = 0
  private phaseStartedAt = 0
  private staggerMs = 0
  private absorbed = 0
  private throughHits = 0
  private nearWardMs = 0
  private sampleClock = 0
  private route: Route = 'lower'
  private safetyNetApplied = false
  private objectiveHud!: ObjectiveHud
  private goal!: GoalTracker

  constructor() {
    super('Level04')
  }

  create(): void {
    this.player.set(420, 545)
    this.velocity.set(0, 0)
    this.ward.set(WARD_START_X, 545)
    this.wardIntegrity = 1
    this.embers = []
    this.wave = 0
    this.waveAt = 2_600
    this.phase = 0
    this.phaseStartedAt = 0
    this.staggerMs = 0
    this.absorbed = 0
    this.throughHits = 0
    this.nearWardMs = 0
    this.sampleClock = 0
    this.route = 'lower'
    this.safetyNetApplied = false
    this.graphics = this.add.graphics()
    this.objectiveHud = new ObjectiveHud(this)
    this.goal = new GoalTracker(this.objectiveHud, {
      label: 'Abgefangen', target: SHIELD_TARGET, bufferLabel: 'Deine Kraft', setbackCost: 1, bufferAfterSetback: 0.7,
    })
    this.objectiveHud.setSecondary('Er', 1)
    this.cameras.main.setBackgroundColor(0x0b0908)
    this.beginTimedLevel('Level04', levels.level04, 'AUSSCHNITT · 04', 'Stell dich dazwischen.', 'memory', {
      goal: 'Er geht allein zur Schwelle. Bring deinen Körper zwischen ihn und die Glut.',
      controls: 'WASD / Pfeiltasten · Maus oder Berührung',
    })
  }

  update(time: number, delta: number): void {
    if (this.finished) return
    const progress = this.advanceLevel(delta)
    if (this.finished || progress < 0) return
    this.goal.advance(delta)
    this.applySafetyNet()
    this.staggerMs = Math.max(0, this.staggerMs - delta)
    this.updateWard(delta)
    this.updatePlayer(delta)
    this.updateEmbers(delta)
    this.updatePhase()
    this.objectiveHud.setSecondary('Er', this.wardIntegrity)
    this.sample(delta)
    this.drawWorld(time)
  }

  protected applyHint(level: AssistanceLevel): void {
    this.services.setAssistance(level)
    if (level === 1) this.services.ui.setHint('Die Einschlagstellen werden deutlicher markiert.')
    if (level === 2) this.services.ui.setHint('Die Vorwarnzeit wird länger.')
    if (level === 3) this.services.ui.setHint('Dein Schutzbereich wird größer und die Glut schwächer.')
  }

  protected collectResult(): LevelResult {
    return {
      choices: {
        route: this.route,
        grade: this.wardGrade(),
      },
      metrics: {
        ...this.goal.metrics(this.elapsedMs, this.levelConfig.expectedDurationMs),
        wardIntegrity: this.wardIntegrity,
        absorbed: this.absorbed,
        throughHits: this.throughHits,
        ownStrength: this.goal.bufferValue,
        nearWardRatio: this.elapsedMs ? this.nearWardMs / this.elapsedMs : 0,
        wavesSurvived: this.wave,
      },
    }
  }

  /** Die Güte hängt an seinem Zustand, nicht an deinem Zähler. Das ist die Aussage des Levels. */
  private wardGrade(): 'knapp' | 'solide' | 'stark' {
    if (this.throughHits <= 4) return 'stark'
    if (this.throughHits <= 8) return 'solide'
    return 'knapp'
  }

  private assistance(): AssistanceLevel {
    return this.hintManager.getLevel()
  }

  private shieldRadius(): number {
    return this.assistance() >= 3 ? SHIELD_RADIUS + 34 : SHIELD_RADIUS
  }

  private telegraphMs(): number {
    const bonus = this.assistance() >= 2 ? 450 : 0
    return (TELEGRAPH_MS + bonus) * this.services.getTimeScale()
  }

  private wardSpeed(): number {
    return (EXIT_X - WARD_START_X) / (46_000 * this.services.getTimeScale())
  }

  private applySafetyNet(): void {
    if (this.safetyNetApplied || this.phase !== 0) return
    if (this.elapsedMs < this.maximumDurationMs * 0.78) return
    this.safetyNetApplied = true
    while (this.hintManager.getLevel() < 3) this.hintManager.forceNext()
  }

  private updatePhase(): void {
    const scale = this.services.getTimeScale()
    if (this.phase === 0 && this.ward.x >= EXIT_X) {
      this.phase = 1
      this.phaseStartedAt = this.elapsedMs
      this.embers = []
      this.services.ui.setInstruction('Er geht hindurch.')
      this.services.ui.setHint('')
      this.services.audio.playMotif('familiar', 0.16)
      return
    }
    if (this.phase === 1 && this.elapsedMs - this.phaseStartedAt >= FAREWELL_MS * scale) this.finishLevel()
  }

  /** Er geht in eigenem Tempo und wartet nicht. Man kann ihn nicht führen, nur begleiten. */
  private updateWard(delta: number): void {
    if (this.phase === 0) {
      this.ward.x = Math.min(EXIT_X, this.ward.x + this.wardSpeed() * delta)
      this.ward.y = 545 + Math.sin(this.ward.x * 0.0042) * 96
    } else {
      // Im Abschied geht er nur noch wenige Schritte und verliert sich im Licht der Schwelle.
      const local = Phaser.Math.Clamp(
        (this.elapsedMs - this.phaseStartedAt) / (FAREWELL_MS * this.services.getTimeScale()), 0, 1,
      )
      this.ward.x = EXIT_X + 30 + Phaser.Math.Easing.Sine.Out(local) * 86
      void delta
    }
    this.route = this.ward.y < 545 ? 'upper' : 'lower'
  }

  private updatePlayer(delta: number): void {
    const input = this.inputManager.getVector(this.player.x, this.player.y)
    const frameScale = Phaser.Math.Clamp(delta / 16.667, 0.4, 2.4)
    // In der Schlussphase reagiert die Figur nicht mehr. Es gibt nichts mehr zu tun.
    if (input.active && this.staggerMs <= 0 && this.phase === 0) {
      this.velocity.x += input.x * 0.92 * frameScale
      this.velocity.y += input.y * 0.92 * frameScale
      const direction: Direction = input.x < -0.25 ? 'left' : input.x > 0.25 ? 'right' : 'center'
      this.services.telemetry.recordDirection(direction)
    }
    // Bewusst schneller als er: Man kann überall sein — nur nicht gleichzeitig.
    this.velocity.scale(Math.pow(this.staggerMs > 0 ? 0.8 : 0.9, frameScale)).limit(10.4)
    this.player.x = Phaser.Math.Clamp(this.player.x + this.velocity.x * frameScale, 110, GAME_WIDTH - 90)
    this.player.y = Phaser.Math.Clamp(this.player.y + this.velocity.y * frameScale, 180, GAME_HEIGHT - 120)

    if (this.phase === 0 && this.staggerMs <= 0) {
      this.goal.fillBuffer((delta / this.services.getTimeScale()) * 0.00004)
    }
    if (Phaser.Math.Distance.BetweenPoints(this.player, this.ward) < 200) this.nearWardMs += delta
  }

  private updateEmbers(delta: number): void {
    if (this.phase !== 0) return
    this.waveAt -= delta / this.services.getTimeScale()
    if (this.waveAt <= 0) {
      this.spawnWave()
      this.waveAt = WAVE_INTERVAL_MS
    }

    this.embers.forEach((ember) => {
      if (ember.resolved || this.elapsedMs < ember.impactAt) return
      ember.resolved = true
      this.resolveEmber(ember)
    })

    if (this.embers.length > 0 && this.embers.every((ember) => ember.resolved)) this.embers = []
  }

  /**
   * Eine Welle zielt auf die Stelle, an der er beim Einschlag stehen wird — nicht auf ihn selbst.
   * Dadurch ist die Vorwarnung räumlich lesbar und man kann sich tatsächlich davorstellen.
   */
  private spawnWave(): void {
    this.wave += 1
    const count = this.wave < 3 ? 1 : this.wave < 6 ? 2 : 3
    const telegraph = this.telegraphMs()
    const scale = this.services.getTimeScale()
    // Alle Geschosse einer Welle zielen auf ihn, kommen aber aus verschiedenen Richtungen und
    // fast gleichzeitig. Abfangen heisst, sich auf einer Seite dazwischenzustellen — und damit
    // die andere offen zu lassen. Man kann nicht ueberall gleichzeitig sein.
    const angles = [-2.36, 0.79, -0.79, 2.36]
    for (let index = 0; index < count; index += 1) {
      const lead = telegraph + index * 240 * scale
      const futureX = Math.min(EXIT_X, this.ward.x + this.wardSpeed() * lead)
      const futureY = 545 + Math.sin(futureX * 0.0042) * 96
      const angle = angles[(this.wave + index) % angles.length]
      this.embers.push({
        fromX: futureX + Math.cos(angle) * 1_500,
        fromY: futureY + Math.sin(angle) * 1_500,
        toX: futureX,
        toY: futureY,
        shieldX: futureX + Math.cos(angle) * SHIELD_OFFSET,
        shieldY: futureY + Math.sin(angle) * SHIELD_OFFSET,
        spawnedAt: this.elapsedMs + index * 240 * scale,
        impactAt: this.elapsedMs + lead,
        resolved: false,
      })
    }
    this.services.audio.pulse(96, 0.03)
  }

  private resolveEmber(ember: Ember): void {
    const damageScale = this.assistance() >= 3 ? 0.6 : 1
    const toShield = Phaser.Math.Distance.Between(this.player.x, this.player.y, ember.shieldX, ember.shieldY)

    if (toShield <= this.shieldRadius()) {
      this.absorbed += 1
      this.goal.add(1)
      this.services.audio.pulse(196 + Math.min(6, this.goal.value) * 12, 0.05)
      this.cameras.main.shake(160, 0.004)
      if (this.goal.drainBuffer(0.19 * damageScale)) {
        this.staggerMs = 1_500 * this.services.getTimeScale()
        this.cameras.main.shake(340, 0.007)
        this.services.audio.pulse(54, 0.1)
        this.services.ui.setHint('Kurz außer Gefecht. Er geht weiter.')
      }
      return
    }
    {
      this.throughHits += 1
      this.wardIntegrity = Math.max(0.1, this.wardIntegrity - 0.088 * damageScale)
      this.services.audio.pulse(62, 0.09)
      this.cameras.main.shake(300, 0.006)
    }
  }

  /**
   * Kein Abblenden nach Schwarz: Der Uebergang setzt genau auf diesem Bild auf. Ein Fade hier
   * erzeugte den Ladebildschirm-Eindruck zwischen Level 4 und 5.
   */
  protected afterLevelFinished(): void {
    this.time.delayedCall(80, () => this.scene.start(this.levelConfig.nextState))
  }

  private sample(delta: number): void {
    this.sampleClock += delta
    if (this.sampleClock < 110) return
    const distance = Phaser.Math.Distance.BetweenPoints(this.player, this.ward)
    this.services.telemetry.sample((this.player.y - 545) / 360, this.velocity.length() / 10, distance < 200, this.sampleClock)
    this.sampleClock = 0
  }

  private drawWorld(time: number): void {
    const g = this.graphics
    g.clear()
    this.drawBackdrop(g, 0x0a0908, 0x1a1512)
    const assistance = this.assistance()

    // Rauch bleibt Atmosphäre. Die Gefahr in diesem Level ist die Glut, und die ist immer sichtbar.
    for (let index = 0; index < 16; index += 1) {
      const x = (index * 233 + time * 0.012) % (GAME_WIDTH + 320) - 160
      const y = 180 + ((index * 149) % 680) + Math.sin(time * 0.0005 + index) * 46
      g.fillStyle(0xb5aaa5, 0.008 + (index % 3) * 0.004)
      g.fillCircle(x, y, 90 + (index % 4) * 46)
    }

    // Die Schwelle ist warmes Licht, kein Bauteil. Sie liegt unterhalb der Anzeige rechts oben.
    const farewell = this.phase === 1
      ? Phaser.Math.Clamp((this.elapsedMs - this.phaseStartedAt) / (FAREWELL_MS * this.services.getTimeScale()), 0, 1)
      : 0
    const glow = 0.2 + Math.sin(time * 0.003) * 0.05 + farewell * 0.5
    for (let halo = 3; halo >= 0; halo -= 1) {
      g.fillStyle(0xe8c98a, glow * 0.09 * (1 + halo * 0.4))
      g.fillRect(EXIT_X - 46 - halo * 26, 280 - halo * 22, 92 + halo * 52, 540 + halo * 44)
    }
    g.fillStyle(0xf3e6c4, Phaser.Math.Clamp(glow, 0, 0.92))
    g.fillRect(EXIT_X - 40, 280, 84, 540)
    g.lineStyle(3, 0xf6efd8, 0.5 + farewell * 0.4)
    g.strokeRect(EXIT_X - 40, 280, 84, 540)

    g.lineStyle(1, 0xcfd6cb, 0.14)
    g.beginPath()
    for (let x = WARD_START_X; x <= EXIT_X; x += 24) {
      const y = 545 + Math.sin(x * 0.0042) * 96
      if (x === WARD_START_X) g.moveTo(x, y)
      else g.lineTo(x, y)
    }
    g.strokePath()

    this.drawEmbers(g, assistance)

    // Er wird heller, je weiter er kommt; erst ganz am Ende verliert er sich im Licht.
    const wardAlpha = this.phase === 1 ? Phaser.Math.Clamp(1.25 - farewell * 1.25, 0.05, 1) : 1
    const wardColor = this.wardIntegrity < 0.4 ? 0xd98b5c : 0x9ecdd0
    g.fillStyle(wardColor, 0.1 * wardAlpha)
    g.fillCircle(this.ward.x, this.ward.y, 54)
    g.lineStyle(6, 0x2a2320, 0.6 * wardAlpha)
    g.strokeCircle(this.ward.x, this.ward.y, 30)
    g.lineStyle(6, wardColor, 0.9 * wardAlpha)
    g.beginPath()
    g.arc(this.ward.x, this.ward.y, 30, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * this.wardIntegrity, false)
    g.strokePath()
    g.fillStyle(0xc8eef0, 0.92 * wardAlpha)
    g.fillCircle(this.ward.x, this.ward.y, 8)

    // Die Verbindung bleibt, bis er nicht mehr zu sehen ist.
    if (this.phase === 1) {
      g.lineStyle(2, 0xb5dfe0, (1 - farewell) * 0.3)
      g.lineBetween(this.player.x, this.player.y, this.ward.x, this.ward.y)
    }

    const stagger = this.staggerMs > 0
    // Der Schutzkreis fällt in sich zusammen; das Eigene erlischt, nachdem es gereicht hat.
    const shield = this.shieldRadius() * (1 - farewell)
    const own = (1 - farewell) * this.goal.bufferValue
    if (shield > 2) {
      g.fillStyle(0xf0e9d9, 0.05 + own * 0.07)
      g.fillCircle(this.player.x, this.player.y, shield)
      g.lineStyle(2, 0xe0c88e, 0.18 + own * 0.26)
      g.strokeCircle(this.player.x, this.player.y, shield)
    }
    g.fillStyle(stagger ? 0xb99a72 : 0xf0e9d9, Phaser.Math.Clamp(0.96 - farewell * 0.86, 0.08, 0.96))
    g.fillCircle(this.player.x, this.player.y, 12 - farewell * 5)
    g.lineStyle(3, 0xe0c88e, Phaser.Math.Clamp(0.72 - farewell * 0.68, 0.04, 0.72))
    g.strokeCircle(this.player.x, this.player.y, 24)

    const setback = this.goal.setbackFlash
    if (setback > 0) {
      g.fillStyle(0x2c1712, setback * 0.34)
      g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
    }

  }

  private drawEmbers(g: Phaser.GameObjects.Graphics, assistance: AssistanceLevel): void {
    this.embers.forEach((ember) => {
      if (ember.resolved || this.elapsedMs < ember.spawnedAt) return
      const local = Phaser.Math.Clamp(
        (this.elapsedMs - ember.spawnedAt) / Math.max(1, ember.impactAt - ember.spawnedAt), 0, 1,
      )
      const x = Phaser.Math.Linear(ember.fromX, ember.toX, local)
      const y = Phaser.Math.Linear(ember.fromY, ember.toY, local)
      // Bahn und Einschlagstelle müssen vor dem Einschlag lesbar sein. Sonst ist Schützen Glück.
      g.lineStyle(assistance >= 1 ? 2.4 : 1.8, 0xc97b49, 0.5)
      g.lineBetween(ember.fromX, ember.fromY, ember.toX, ember.toY)
      g.lineStyle(assistance >= 1 ? 4 : 3, 0xc97b49, 0.4 + local * 0.45)
      g.strokeCircle(ember.shieldX, ember.shieldY, this.shieldRadius() * (1.6 - local * 0.6))
      g.fillStyle(0xc97b49, 0.16)
      g.fillCircle(ember.shieldX, ember.shieldY, this.shieldRadius() * 0.55)
      g.lineStyle(2, 0xc97b49, 0.3)
      g.lineBetween(ember.shieldX, ember.shieldY, ember.toX, ember.toY)
      g.fillStyle(0xf0a76a, 0.95)
      g.fillCircle(x, y, 11)
      g.fillStyle(0xffe0b0, 0.5)
      g.fillCircle(x, y, 5)
    })
  }
}

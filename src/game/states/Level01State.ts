import Phaser from 'phaser'
import { LevelBriefing } from '../components/LevelBriefing'
import { ObjectiveHud } from '../components/ObjectiveHud'
import { gameConfig, GAME_HEIGHT, GAME_WIDTH } from '../config/gameConfig'
import { levels } from '../config/levels'
import { HintManager } from '../systems/HintManager'
import { InputManager } from '../systems/InputManager'
import type { AssistanceLevel, Direction } from '../types'
import { BaseScene } from './BaseScene'

interface WindParticle {
  x: number
  y: number
  speed: number
  length: number
}

export class Level01State extends BaseScene {
  private readonly config = levels.level01
  private graphics!: Phaser.GameObjects.Graphics
  private inputManager!: InputManager
  private hintManager!: HintManager
  private wind: WindParticle[] = []
  private elapsedMs = 0
  private storyDurationMs = 0
  private maximumDurationMs = 0
  private position = 0
  private velocity = 0
  private growth = 0.06
  private growthTarget = 0.06
  private lightCenter = 0
  private lightY = 610
  private lightVisibility = 1
  private lightRadius = 0.34
  private exposureMs = 0
  private lastSampleAt = 0
  private lastInLight = false
  private swiftPlayed = false
  private lightPhase = -1
  private finished = false
  private objectiveHud!: ObjectiveHud
  private briefing!: LevelBriefing
  private lightAngle = -1.2
  private firstThreatStartedAt = -1
  private firstThreatRepelledAt = -1
  private outcomeStartedAt = -1
  private sequenceProgress = 0

  constructor() {
    super('Level01')
  }

  create(): void {
    this.elapsedMs = 0
    this.position = 0
    this.velocity = 0
    this.growth = 0.06
    this.growthTarget = 0.06
    this.lightCenter = 0
    this.lightY = 610
    this.lightVisibility = 1
    this.lightRadius = 0.34
    this.exposureMs = 0
    this.lastSampleAt = 0
    this.lastInLight = false
    this.swiftPlayed = false
    this.lightPhase = -1
    this.finished = false
    this.lightAngle = -1.2
    this.firstThreatStartedAt = -1
    this.firstThreatRepelledAt = -1
    this.outcomeStartedAt = -1
    this.sequenceProgress = 0
    this.wind = []

    const timeScale = this.services.getTimeScale()
    this.storyDurationMs = this.config.storyDurationMs * timeScale
    this.maximumDurationMs = this.config.maximumDurationMs * timeScale
    const hintTimes = this.config.hintTimesMs.map((time) => time * timeScale)

    this.services.enterState('Level01', this.maximumDurationMs)
    this.services.telemetry.startLevel(this.config.id)
    this.services.ui.setScene('AUSSCHNITT · 01', 'Bleibe im Licht.')
    this.services.ui.setHint('A / D · ← / → · Maus · Berührung')
    this.services.ui.hideAction()
    this.services.ui.setCaption('')
    void this.services.audio.unlock().then(() => this.services.audio.startAmbient('light'))

    this.cameras.main.setBackgroundColor(gameConfig.background)
    this.cameras.main.fadeIn(1_000, 2, 8, 6)
    this.graphics = this.add.graphics()
    this.objectiveHud = new ObjectiveHud(this)
    this.objectiveHud.set('Wachstum', '0 %', 0)
    this.briefing = new LevelBriefing(this, {
      goal: 'Bleibe im Licht, wachse und weiche dem Schatten aus.',
      controls: 'A / D oder ← / → · Maus oder Berührung',
    }, this.services.getStatus().testMode)
    this.inputManager = new InputManager(this)
    this.wind = Array.from({ length: 52 }, () => ({
      x: Phaser.Math.Between(-100, GAME_WIDTH),
      y: Phaser.Math.Between(130, 940),
      speed: Phaser.Math.FloatBetween(0.025, 0.09),
      length: Phaser.Math.Between(18, 72),
    }))
    this.hintManager = new HintManager(hintTimes, (level) => this.applyHint(level))

    this.events.on('teacher:complete', this.finishLevel, this)
    this.events.on('teacher:hint', this.forceHint, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this)
  }

  update(time: number, delta: number): void {
    if (this.finished || this.briefing.isActive()) return
    this.elapsedMs += delta
    const growthProgress = Phaser.Math.Clamp((this.growth - 0.06) / 0.28, 0, 1)
    this.updateSequence(delta, growthProgress)
    const progress = this.sequenceProgress
    this.services.setStatus({ remainingMs: Math.max(0, this.maximumDurationMs - this.elapsedMs) })
    this.hintManager.update(this.elapsedMs)

    this.updateLight()
    this.updateMovement(delta)
    this.updateGrowth(delta)
    this.updateWind(delta, progress)
    this.updateLightPhase(progress)
    this.objectiveHud.set('Wachstum', `${Math.round(growthProgress * 100)} %`, growthProgress)
    this.drawWorld(time, progress)
    this.sampleTelemetry(delta)

    if (!this.swiftPlayed && progress >= 0.405) {
      this.swiftPlayed = true
      this.services.audio.playSwiftMotif()
      this.services.ui.setCaption('')
    }
    if (progress >= 0.53 && progress < 0.73) this.services.ui.setCaption('')
    if ((this.outcomeStartedAt >= 0 && this.elapsedMs - this.outcomeStartedAt >= 7_000 * this.services.getTimeScale()) || this.elapsedMs >= this.maximumDurationMs) this.finishLevel()
  }

  private updateSequence(delta: number, growthProgress: number): void {
    const scaledSecond = 1_000 * this.services.getTimeScale()
    if (this.firstThreatStartedAt < 0 && (growthProgress >= 0.25 || this.elapsedMs >= 18 * scaledSecond)) {
      this.firstThreatStartedAt = this.elapsedMs
      this.services.ui.setInstruction('Weiche dem Schatten aus.')
    }
    if (this.firstThreatStartedAt >= 0 && this.firstThreatRepelledAt < 0) {
      const threatLocal = Phaser.Math.Clamp((this.elapsedMs - this.firstThreatStartedAt) / (8 * scaledSecond), 0, 1)
      if (threatLocal < 0.6) this.sequenceProgress = Phaser.Math.Linear(0.31, 0.43, threatLocal / 0.6)
      else if (threatLocal < 0.78) this.sequenceProgress = Phaser.Math.Linear(0.43, 0.49, (threatLocal - 0.6) / 0.18)
      else this.sequenceProgress = Phaser.Math.Linear(0.49, 0.52, (threatLocal - 0.78) / 0.22)
      if (threatLocal >= 1) {
        this.firstThreatRepelledAt = this.elapsedMs
        this.services.ui.setInstruction('Erreiche 100 %.')
      }
    } else if (this.firstThreatStartedAt < 0) {
      this.sequenceProgress = Phaser.Math.Linear(0, 0.3, Phaser.Math.Clamp(growthProgress / 0.25, 0, 1))
    } else if (this.outcomeStartedAt < 0) {
      this.sequenceProgress = Phaser.Math.Linear(0.52, 0.76, Phaser.Math.Clamp((growthProgress - 0.25) / 0.75, 0, 1))
    }

    if (this.firstThreatRepelledAt >= 0 && this.outcomeStartedAt < 0 && (growthProgress >= 1 || this.elapsedMs >= this.storyDurationMs)) {
      this.outcomeStartedAt = this.elapsedMs
      this.services.ui.setInstruction('')
      this.services.ui.setHint('')
    }
    if (this.outcomeStartedAt >= 0) {
      const outcomeLocal = Phaser.Math.Clamp((this.elapsedMs - this.outcomeStartedAt) / (7 * scaledSecond), 0, 1)
      this.sequenceProgress = Phaser.Math.Linear(0.77, 1, outcomeLocal)
    }

    this.lightAngle += delta * (0.001 + growthProgress * 0.00115) / this.services.getTimeScale()
  }

  private updateLight(): void {
    const growthProgress = Phaser.Math.Clamp((this.growth - 0.06) / 0.28, 0, 1)
    const amplitude = 0.19 + growthProgress * 0.34
    this.lightCenter = Math.sin(this.lightAngle) * amplitude + Math.sin(this.lightAngle * 0.43 + 1.2) * 0.075
    const normalizedGrowth = Phaser.Math.Clamp((this.growth - 0.06) / 0.76, 0, 1)
    this.lightY = Phaser.Math.Linear(900, 455, Phaser.Math.Easing.Sine.Out(normalizedGrowth))
    this.lightVisibility = 1
    const assistanceWidth = this.hintManager.getLevel() >= 3 ? 0.05 : this.hintManager.getLevel() >= 2 ? 0.025 : 0
    this.lightRadius = Phaser.Math.Linear(0.3, 0.17, growthProgress) + assistanceWidth
  }

  private updateMovement(delta: number): void {
    const axis = this.inputManager.getAxis()
    const pointerTarget = this.inputManager.getPointerTarget()
    const controls = gameConfig.controls
    const frameScale = Phaser.Math.Clamp(delta / 16.667, 0.4, 2.5)
    const mobility = 0.62 + this.growth * 0.62

    if (axis !== 0) this.velocity += axis * controls.acceleration * mobility * frameScale
    if (pointerTarget !== null) this.velocity += (pointerTarget - this.position) * controls.pointerPull * mobility * frameScale
    this.velocity *= Math.pow(controls.damping, frameScale)
    this.velocity = Phaser.Math.Clamp(this.velocity, -controls.maxVelocity * mobility, controls.maxVelocity * mobility)
    this.position = Phaser.Math.Clamp(this.position + this.velocity * frameScale, -0.96, 0.96)
    if (Math.abs(this.position) >= 0.96) this.velocity *= -0.28

    const direction: Direction = axis < 0 || this.velocity < -0.002 ? 'left' : axis > 0 || this.velocity > 0.002 ? 'right' : 'center'
    this.services.telemetry.recordDirection(direction)
  }

  private updateGrowth(delta: number): void {
    const equivalentDelta = delta / this.services.getTimeScale()
    const lightQuality = this.getLightQuality()
    if (lightQuality > 0.08) {
      this.growthTarget = Phaser.Math.Clamp(this.growthTarget + equivalentDelta * 0.0000102 * lightQuality, 0.06, 0.82)
      const smoothing = Phaser.Math.Clamp(equivalentDelta * 0.00018, 0, 0.08)
      this.growth += (this.growthTarget - this.growth) * smoothing
    }
    if (lightQuality > 0.35) {
      this.exposureMs += equivalentDelta
    }
    if (this.sequenceProgress >= 0.31 && this.sequenceProgress < 0.43) {
      const local = (this.sequenceProgress - 0.31) / 0.12
      const shadowX = Phaser.Math.Linear(-500, 820, local)
      const shadowPosition = (shadowX - GAME_WIDTH / 2) / 590
      const effectivePosition = this.position * this.getReach()
      const distance = Math.abs(effectivePosition - shadowPosition)
      if (distance < 0.48) {
        const impact = 1 - distance / 0.48
        this.growthTarget = Math.max(0.06, this.growthTarget - equivalentDelta * 0.000009 * impact)
        this.velocity += Math.sign(effectivePosition - shadowPosition || 1) * 0.0012 * impact
      }
    }
  }

  private updateWind(delta: number, progress: number): void {
    const gust = progress > 0.36 && progress < 0.5 ? 2.9 : progress > 0.79 ? 2.15 : 1
    this.wind.forEach((particle) => {
      particle.x += particle.speed * delta * gust
      particle.y += Math.sin((particle.x + particle.y) * 0.004) * 0.08 * delta
      if (particle.x > GAME_WIDTH + 100) {
        particle.x = -particle.length
        particle.y = Phaser.Math.Between(150, 930)
      }
    })
  }

  private updateLightPhase(progress: number): void {
    const phase = progress < 0.3 ? 0 : progress < 0.52 ? 1 : progress < 0.76 ? 2 : 3
    if (phase === this.lightPhase) return
    this.lightPhase = phase
    if (phase === 0) this.services.ui.setInstruction('Halte die Spitze im Licht.')
    if (phase === 1) this.services.ui.setInstruction('Folge dem Licht.')
    if (phase === 2) this.services.ui.setInstruction('Halte den Kontakt.')
    if (phase === 3) this.services.ui.setInstruction('Erreiche 100 %.')
  }

  private drawWorld(time: number, progress: number): void {
    const g = this.graphics
    g.clear()
    const night = 1 - this.lightVisibility
    g.fillGradientStyle(0x020806, 0x020806, Phaser.Display.Color.GetColor(4, Math.round(19 - night * 11), Math.round(13 - night * 8)), 0x020806, 1)
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)

    const lightX = GAME_WIDTH / 2 + this.lightCenter * 590
    const radiusScale = this.lightRadius / 0.34
    const lightVeils = [
      { width: 760, height: 850, dx: -54, dy: 34, alpha: 0.026 },
      { width: 610, height: 720, dx: 42, dy: -26, alpha: 0.031 },
      { width: 470, height: 585, dx: -22, dy: 18, alpha: 0.038 },
      { width: 330, height: 430, dx: 35, dy: 5, alpha: 0.047 },
      { width: 185, height: 275, dx: -10, dy: -16, alpha: 0.065 },
    ]
    lightVeils.forEach((veil, index) => {
      const driftX = Math.sin(time * (0.00018 + index * 0.000025) + index * 1.7) * (18 - index * 2)
      const driftY = Math.cos(time * (0.00015 + index * 0.00002) + index * 1.3) * (13 - index)
      g.fillStyle(gameConfig.colors.light, this.lightVisibility * veil.alpha)
      g.fillEllipse(
        lightX + (veil.dx + driftX) * radiusScale,
        this.lightY + (veil.dy + driftY) * radiusScale,
        veil.width * radiusScale,
        veil.height * radiusScale,
      )
    })

    g.lineStyle(1.5, 0x8eb3a0, 0.12)
    this.wind.forEach((particle) => g.lineBetween(particle.x, particle.y, particle.x + particle.length, particle.y - 4))
    for (let index = 0; index < 8; index += 1) {
      const x = 150 + index * 245 + Math.sin(index * 2.1) * 48
      const y = 930 - ((time * 0.024 + index * 105) % 360)
      g.fillStyle(gameConfig.colors.moisture, 0.06 + night * 0.16)
      g.fillCircle(x, y, 3 + (index % 3))
    }

    this.drawDisturbance(g, progress)
    this.drawSwiftSignal(g, progress)
    this.drawTetheredSignal(g, time, progress)

    if (progress > 0.91) {
      const veil = Phaser.Math.Easing.Sine.In((progress - 0.91) / 0.09)
      g.fillStyle(0x010302, veil * 0.96)
      g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
    }
  }

  private drawTetheredSignal(g: Phaser.GameObjects.Graphics, time: number, progress: number): void {
    const rootX = GAME_WIDTH / 2
    const rootY = 1015
    const effectivePosition = this.position * this.getReach()
    const tipX = rootX + effectivePosition * 590
    const normalizedGrowth = Phaser.Math.Clamp((this.growth - 0.06) / 0.76, 0, 1)
    const baseTipY = Phaser.Math.Linear(925, 465, Phaser.Math.Easing.Sine.Out(normalizedGrowth))
    const tipY = baseTipY + Math.sin(time * 0.0011) * (4 + normalizedGrowth * 8) + Math.abs(this.velocity) * 240
    const visibility = this.getSignalVisibility(progress, tipX, tipY)
    if (visibility <= 0.01) return
    const lightQuality = this.getLightQuality()
    const glow = Phaser.Math.Linear(0.46, 1, lightQuality)
    const width = 2 + this.growth * 3.2
    const bend = tipX - rootX
    const sway = Math.sin(time * 0.00165) * (4 + normalizedGrowth * 11)
    const lowerX = rootX + bend * 0.18 - sway * 0.35
    const lowerY = Phaser.Math.Linear(rootY, tipY, 0.34)
    const upperX = rootX + bend * 0.6 + sway
    const upperY = Phaser.Math.Linear(rootY, tipY, 0.73)

    g.lineStyle(8 + this.growth * 8, 0x173226, 0.34 * visibility)
    g.beginPath()
    g.moveTo(rootX, rootY)
    g.lineTo(lowerX, lowerY)
    g.lineTo(upperX, upperY)
    g.lineTo(tipX, tipY)
    g.strokePath()
    g.lineStyle(width, gameConfig.colors.growth, 0.72 * visibility)
    g.beginPath()
    g.moveTo(rootX, rootY)
    g.lineTo(lowerX, lowerY)
    g.lineTo(upperX, upperY)
    g.lineTo(tipX, tipY)
    g.strokePath()
    g.fillStyle(gameConfig.colors.light, 0.08 * glow * visibility)
    g.fillCircle(tipX, tipY, 20 + this.growth * 18)
    g.fillStyle(0xf4f8d8, glow * visibility)
    g.fillCircle(tipX, tipY, 4.5 + this.growth * 3)
  }

  private getSignalVisibility(progress: number, tipX: number, tipY: number): number {
    if (progress < 0.77) return 1
    const local = (progress - 0.77) / 0.23
    const shadowX = Phaser.Math.Linear(2350, 980, local)
    const scale = Phaser.Math.Linear(0.7, 1.38, local)
    const dx = (tipX - shadowX) / (325 * scale)
    const dy = (tipY - 650) / (200 * scale)
    return Phaser.Math.Clamp((dx * dx + dy * dy - 0.72) / 0.28, 0, 1)
  }

  private drawDisturbance(g: Phaser.GameObjects.Graphics, progress: number): void {
    let x: number | null = null
    let scale = 1
    if (progress >= 0.31 && progress < 0.43) {
      x = Phaser.Math.Linear(-500, 820, (progress - 0.31) / 0.12)
    } else if (progress >= 0.43 && progress < 0.52) {
      x = Phaser.Math.Linear(820, -620, (progress - 0.43) / 0.09)
    } else if (progress >= 0.77) {
      x = Phaser.Math.Linear(2350, 980, (progress - 0.77) / 0.23)
      scale = Phaser.Math.Linear(0.7, 1.38, (progress - 0.77) / 0.23)
    }
    if (x === null) return
    g.fillStyle(0x010302, 0.94)
    g.fillEllipse(x, 650, 650 * scale, 400 * scale)
    g.fillStyle(0x0a130e, 0.8)
    g.fillEllipse(x + 70 * scale, 640, 420 * scale, 260 * scale)
    g.lineStyle(4, 0x667768, 0.15)
    g.strokeEllipse(x, 650, 680 * scale, 420 * scale)
  }

  private drawSwiftSignal(g: Phaser.GameObjects.Graphics, progress: number): void {
    if (progress < 0.395 || progress > 0.49) return
    const local = (progress - 0.395) / 0.095
    const x = Phaser.Math.Linear(2150, -280, local)
    const y = 460 + Math.sin(local * Math.PI * 3) * 70
    g.lineStyle(7, gameConfig.colors.warning, 0.58)
    g.lineBetween(x + 270, y - 34, x, y)
    g.fillStyle(gameConfig.colors.warning, 0.78)
    g.fillTriangle(x - 28, y, x + 22, y - 18, x + 18, y + 22)
    g.fillStyle(0xf4e4b3, 0.46)
    g.fillCircle(x + 8, y, 13)
  }

  private sampleTelemetry(delta: number): void {
    this.lastSampleAt += delta
    if (this.lastSampleAt < 90) return
    const inLight = this.isInLight()
    this.services.telemetry.sample(this.position * this.getReach(), this.velocity, inLight, this.lastSampleAt)
    if (inLight && !this.lastInLight) this.services.audio.pulse(176 + this.growth * 80, 0.022)
    this.lastInLight = inLight
    this.lastSampleAt = 0
  }

  private isInLight(): boolean {
    return this.getLightQuality() > 0.16
  }

  private getLightQuality(): number {
    if (this.lightVisibility <= 0.18) return 0
    const effectivePosition = this.position * this.getReach()
    const normalizedDistance = Math.abs(effectivePosition - this.lightCenter) / Math.max(0.01, this.lightRadius)
    const center = Phaser.Math.Clamp(1 - normalizedDistance, 0, 1)
    return Phaser.Math.SmoothStep(center, 0, 1) * this.lightVisibility
  }

  private getReach(): number {
    return Phaser.Math.Clamp(0.2 + this.growth * 1.05, 0.25, 0.98)
  }

  private applyHint(level: AssistanceLevel): void {
    this.services.setAssistance(level)
    if (level === 1) this.services.ui.setHint('Im hellsten Bereich steigt der Zähler schneller.')
    if (level === 2) this.services.ui.setHint('Lichtmitte und Schattenrand werden deutlich markiert.')
    if (level === 3) this.services.ui.setHint('Das Lichtfeld wird etwas breiter und kontrastreicher.')
  }

  private forceHint(): void {
    this.hintManager.forceNext()
  }

  private finishLevel(): void {
    if (this.finished) return
    this.finished = true
    const telemetry = this.services.telemetry.finalizeLevel({ metrics: {
      finalPosition: this.position,
      preferredSide: this.position,
      finalGrowth: this.growth,
      storedGrowth: this.growthTarget,
      lightExposureMs: this.exposureMs,
    } }, this.elapsedMs)
    const variant = this.services.replay.select(this.config.id, telemetry)
    this.services.setStatus({ selectedVariant: variant.id, remainingMs: 0 })
    this.services.ui.setInstruction('')
    this.services.ui.setHint('')
    this.services.ui.setCaption('')
    this.cameras.main.fadeOut(1_050, 2, 5, 4)
    this.time.delayedCall(1_080, () => this.scene.start(this.config.nextState))
  }

  private shutdown(): void {
    this.inputManager.destroy()
    this.events.off('teacher:complete', this.finishLevel, this)
    this.events.off('teacher:hint', this.forceHint, this)
  }
}

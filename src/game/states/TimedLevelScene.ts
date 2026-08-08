import Phaser from 'phaser'
import { LevelBriefing, type LevelBriefingCopy } from '../components/LevelBriefing'
import type { AmbientKey } from '../config/audioManifest'
import { GAME_HEIGHT, GAME_WIDTH } from '../config/gameConfig'
import { HintManager } from '../systems/HintManager'
import { SpatialInputManager } from '../systems/SpatialInputManager'
import type { AssistanceLevel, GameStateKey, LevelConfig, LevelResult } from '../types'
import { BaseScene } from './BaseScene'

export abstract class TimedLevelScene extends BaseScene {
  protected elapsedMs = 0
  protected storyDurationMs = 1
  protected maximumDurationMs = 1
  protected inputManager!: SpatialInputManager
  protected hintManager!: HintManager
  protected levelConfig!: LevelConfig
  protected finished = false
  private briefing?: LevelBriefing
  private briefingWasActive = false

  protected beginTimedLevel(
    state: GameStateKey,
    config: LevelConfig,
    sceneLabel: string,
    instruction: string,
    ambient: AmbientKey,
    briefingCopy?: LevelBriefingCopy,
  ): void {
    this.elapsedMs = 0
    this.finished = false
    this.levelConfig = config
    const scale = this.services.getTimeScale()
    this.storyDurationMs = config.storyDurationMs * scale
    this.maximumDurationMs = config.maximumDurationMs * scale
    const hints = config.hintTimesMs.map((time) => time * scale)

    this.services.enterState(state, this.maximumDurationMs)
    this.services.telemetry.startLevel(config.id)
    this.services.ui.setScene(sceneLabel, instruction)
    this.services.ui.setHint('WASD · Pfeiltasten · Maus · Berührung')
    this.services.ui.setCaption('')
    this.services.ui.hideAction()
    void this.services.audio.unlock().then(() => this.services.audio.startAmbient(ambient))

    this.cameras.main.fadeIn(720, 2, 8, 6)
    this.inputManager = new SpatialInputManager(this)
    if (briefingCopy) {
      this.briefing = new LevelBriefing(this, briefingCopy, this.services.getStatus().testMode)
      this.briefingWasActive = true
    }
    this.hintManager = new HintManager(hints, (level) => this.applyHint(level))
    this.events.on('teacher:complete', this.finishLevel, this)
    this.events.on('teacher:hint', this.forceHint, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdownTimedLevel, this)
  }

  protected advanceLevel(delta: number): number {
    if (this.finished) return 1
    if (this.briefing?.isActive()) {
      this.services.setStatus({ remainingMs: this.maximumDurationMs })
      return -1
    }
    if (this.briefingWasActive) {
      this.briefingWasActive = false
      this.inputManager.clearTransientInput()
    }
    this.elapsedMs += delta
    this.hintManager.update(this.elapsedMs)
    this.services.setStatus({ remainingMs: Math.max(0, this.maximumDurationMs - this.elapsedMs) })
    const progress = Phaser.Math.Clamp(this.elapsedMs / this.storyDurationMs, 0, 1)
    if (this.elapsedMs >= this.maximumDurationMs) this.finishLevel()
    return progress
  }

  protected finishLevel(): void {
    if (this.finished) return
    this.finished = true
    const telemetry = this.services.telemetry.finalizeLevel(this.collectResult(), this.elapsedMs)
    if (this.levelConfig.echoId) {
      const variant = this.services.replay.select(this.levelConfig.id, telemetry)
      this.services.setStatus({ selectedVariant: variant.id, remainingMs: 0 })
    } else {
      this.services.setStatus({ remainingMs: 0 })
    }
    this.services.ui.setInstruction('')
    this.services.ui.setHint('')
    this.services.ui.setCaption('')
    this.afterLevelFinished()
  }

  protected afterLevelFinished(): void {
    this.cameras.main.fadeOut(900, 2, 5, 4)
    this.time.delayedCall(930, () => this.scene.start(this.levelConfig.nextState))
  }

  protected drawBackdrop(graphics: Phaser.GameObjects.Graphics, top: number, bottom: number): void {
    graphics.fillGradientStyle(top, top, bottom, bottom, 1)
    graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
  }

  protected abstract applyHint(level: AssistanceLevel): void
  protected abstract collectResult(): LevelResult

  private forceHint(): void {
    this.hintManager.forceNext()
  }

  private shutdownTimedLevel(): void {
    this.inputManager.destroy()
    this.events.off('teacher:complete', this.finishLevel, this)
    this.events.off('teacher:hint', this.forceHint, this)
  }
}

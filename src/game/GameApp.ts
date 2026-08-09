import Phaser from 'phaser'
import { GAME_HEIGHT, GAME_WIDTH, gameConfig } from './config/gameConfig'
import { BootState } from './states/BootState'
import { Echo01State } from './states/Echo01State'
import { Echo02State } from './states/Echo02State'
import { Echo03State } from './states/Echo03State'
import { Echo04State } from './states/Echo04State'
import { Echo05State } from './states/Echo05State'
import { EndState } from './states/EndState'
import { FinaleReplayState } from './states/FinaleReplayState'
import { IntroState } from './states/IntroState'
import { Level01State } from './states/Level01State'
import { Level02State } from './states/Level02State'
import { Level03State } from './states/Level03State'
import { Level04State } from './states/Level04State'
import { Level05State } from './states/Level05State'
import { Level06State } from './states/Level06State'
import { PreloadState } from './states/PreloadState'
import { TitleState } from './states/TitleState'
import { Transition45State } from './states/Transition45State'
import { DebugOverlay } from './systems/DebugOverlay'
import { GameServices, setActiveGameServices } from './systems/GameServices'
import { TeacherControls, type TeacherControlApi } from './systems/TeacherControls'
import type { GameStateKey } from './types'

export class GameApp implements TeacherControlApi {
  readonly services: GameServices
  readonly game: Phaser.Game
  private tickerId: number

  constructor() {
    const video = document.getElementById('cinema') as HTMLVideoElement | null
    if (!video) throw new Error('Missing cinema video element')
    this.services = new GameServices(video)
    setActiveGameServices(this.services)

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      parent: 'game-root',
      backgroundColor: gameConfig.background,
      antialias: true,
      transparent: false,
      render: {
        antialias: true,
        roundPixels: false,
        powerPreference: 'high-performance',
      },
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: GAME_WIDTH,
        height: GAME_HEIGHT,
      },
      input: {
        keyboard: true,
        mouse: true,
        touch: true,
      },
      scene: [
        BootState, PreloadState, TitleState, IntroState,
        Level01State, Echo01State, Level02State, Echo02State, Level03State, Echo03State,
        Level04State, Transition45State, Echo04State, Level05State, Echo05State, Level06State,
        FinaleReplayState, EndState,
      ],
    }

    this.game = new Phaser.Game(config)
    new TeacherControls(this, this.services)
    new DebugOverlay(this.services)
    this.tickerId = window.setInterval(() => {
      this.services.setStatus({ fps: Math.round(this.game.loop.actualFps) })
    }, 250)
  }

  togglePause(): void {
    const scene = this.currentScene()
    if (!scene) return
    const key = scene.scene.key
    if (scene.scene.isPaused()) {
      this.game.scene.resume(key)
      void this.services.audio.resume()
      this.services.video.resume()
      this.services.setStatus({ paused: false })
    } else {
      this.game.scene.pause(key)
      void this.services.audio.pause()
      this.services.video.pause()
      this.services.setStatus({ paused: true })
    }
  }

  requestHint(): void {
    this.currentScene()?.events.emit('teacher:hint')
  }

  completeCurrent(): void {
    this.currentScene()?.events.emit('teacher:complete')
  }

  restartCurrent(): void {
    const scene = this.currentScene()
    if (!scene) return
    this.services.video.skip()
    this.services.ui.clear()
    this.game.scene.start(scene.scene.key)
  }

  resetSession(): void {
    this.services.telemetry.reset()
    this.services.video.skip()
    this.services.ui.clear()
    this.services.audio.stopAmbient()
    const current = this.currentScene()
    if (current) this.game.scene.stop(current.scene.key)
    this.game.scene.start('Title')
  }

  startState(state: GameStateKey): void {
    this.services.video.skip()
    this.services.ui.clear()
    const current = this.currentScene()
    if (current) this.game.scene.stop(current.scene.key)
    this.game.scene.start(state)
  }

  async toggleFullscreen(): Promise<void> {
    const shell = document.getElementById('game-shell')
    if (!shell) return
    if (document.fullscreenElement) await document.exitFullscreen()
    else await shell.requestFullscreen()
  }

  destroy(): void {
    window.clearInterval(this.tickerId)
    this.game.destroy(true)
  }

  private currentScene(): Phaser.Scene | null {
    return this.game.scene.scenes.find((scene) => scene.scene.isActive() || scene.scene.isPaused()) ?? null
  }
}

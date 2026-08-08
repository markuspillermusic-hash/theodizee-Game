import { TEST_TIME_SCALE } from '../config/gameConfig'
import type { AssistanceLevel, GameStateKey, RuntimeStatus } from '../types'
import { AudioManager } from './AudioManager'
import { GameEventBus } from './GameEventBus'
import { ReplayDirector } from './ReplayDirector'
import { SaveManager } from './SaveManager'
import { StageUi } from './StageUi'
import { TelemetryManager } from './TelemetryManager'
import { VideoManager } from './VideoManager'

export class GameServices {
  readonly events = new GameEventBus()
  readonly save = new SaveManager()
  readonly telemetry = new TelemetryManager(this.save)
  readonly replay = new ReplayDirector()
  readonly audio = new AudioManager()
  readonly video: VideoManager
  readonly ui = new StageUi()

  private status: RuntimeStatus = {
    state: 'Boot',
    remainingMs: null,
    assistanceLevel: 0,
    paused: false,
    preloadStatus: 'wartet',
    videoStatus: 'bereit',
    selectedVariant: null,
    testMode: false,
    fps: 0,
  }

  constructor(videoElement: HTMLVideoElement) {
    this.video = new VideoManager(videoElement)
  }

  setStatus(patch: Partial<RuntimeStatus>): void {
    this.status = { ...this.status, ...patch }
    this.events.emit<RuntimeStatus>('runtime-status', this.getStatus())
  }

  enterState(state: GameStateKey, remainingMs: number | null = null): void {
    this.setStatus({ state, remainingMs, assistanceLevel: 0, paused: false })
  }

  setAssistance(level: AssistanceLevel): void {
    this.telemetry.markAssistance(level)
    this.setStatus({ assistanceLevel: level })
  }

  setTestMode(testMode: boolean): void {
    this.setStatus({ testMode })
  }

  getTimeScale(): number {
    return this.status.testMode ? TEST_TIME_SCALE : 1
  }

  getStatus(): RuntimeStatus {
    return { ...this.status, videoStatus: this.video.getStatus() }
  }

  getDebugSnapshot(): Record<string, unknown> {
    return {
      runtime: this.getStatus(),
      telemetry: this.telemetry.getAll(),
    }
  }
}

let activeServices: GameServices | null = null

export function setActiveGameServices(services: GameServices): void {
  activeServices = services
}

export function getActiveGameServices(): GameServices {
  if (!activeServices) throw new Error('Game services are not initialized')
  return activeServices
}

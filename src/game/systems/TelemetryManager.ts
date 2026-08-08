import type { AssistanceLevel, Direction, LevelResult, LevelTelemetry, SessionSnapshot } from '../types'
import { SaveManager } from './SaveManager'

interface ActiveLevel {
  levelId: string
  startedAt: number
  firstDirection?: Direction
  lastDirection: Direction
  directionChanges: number
  positionTotal: number
  movementTotal: number
  samples: number
  optimalLightMs: number
  hesitationCount: number
  assistanceLevel: AssistanceLevel
}

export class TelemetryManager {
  private readonly levels: Record<string, LevelTelemetry> = {}
  private readonly saveManager: SaveManager
  private active: ActiveLevel | null = null

  constructor(saveManager: SaveManager) {
    this.saveManager = saveManager
    const saved = this.saveManager.load()
    if (saved) Object.assign(this.levels, saved.levels)
  }

  startLevel(levelId: string): void {
    this.active = {
      levelId,
      startedAt: performance.now(),
      lastDirection: 'center',
      directionChanges: 0,
      positionTotal: 0,
      movementTotal: 0,
      samples: 0,
      optimalLightMs: 0,
      hesitationCount: 0,
      assistanceLevel: 0,
    }
  }

  recordDirection(direction: Direction): void {
    if (!this.active || direction === 'center') return
    if (!this.active.firstDirection) this.active.firstDirection = direction
    if (this.active.lastDirection !== 'center' && this.active.lastDirection !== direction) {
      this.active.directionChanges += 1
    }
    this.active.lastDirection = direction
  }

  sample(normalizedPosition: number, movement: number, inOptimalLight: boolean, deltaMs: number): void {
    if (!this.active) return
    this.active.positionTotal += normalizedPosition
    this.active.movementTotal += Math.abs(movement)
    this.active.samples += 1
    if (inOptimalLight) this.active.optimalLightMs += deltaMs
    if (Math.abs(movement) < 0.0015 && this.active.samples % 10 === 0) this.active.hesitationCount += 1
  }

  markAssistance(level: AssistanceLevel): void {
    if (this.active) this.active.assistanceLevel = level
  }

  finalizeLevel(result: LevelResult = {}, durationMs?: number): LevelTelemetry {
    const active = this.active
    if (!active) {
      return this.levels['level-01'] ?? this.createEmpty('level-01')
    }

    const averagePosition = active.samples ? active.positionTotal / active.samples : 0
    const primaryDirection: Direction = averagePosition < -0.08 ? 'left' : averagePosition > 0.08 ? 'right' : 'center'
    const telemetry: LevelTelemetry = {
      levelId: active.levelId,
      durationMs: durationMs ?? Math.max(0, performance.now() - active.startedAt),
      primaryDirection,
      firstDirection: active.firstDirection,
      movementIntensity: active.samples ? active.movementTotal / active.samples : 0,
      hesitationCount: active.hesitationCount,
      assistanceLevel: active.assistanceLevel,
      choices: result.choices ?? {},
      metrics: {
        averagePosition,
        directionChanges: active.directionChanges,
        optimalLightMs: active.optimalLightMs,
        ...(result.metrics ?? {}),
      },
    }

    this.levels[active.levelId] = telemetry
    this.active = null
    this.persist()
    return telemetry
  }

  get(levelId: string): LevelTelemetry | null {
    return this.levels[levelId] ?? null
  }

  getAll(): Record<string, LevelTelemetry> {
    return structuredClone(this.levels)
  }

  reset(): void {
    Object.keys(this.levels).forEach((key) => delete this.levels[key])
    this.active = null
    this.saveManager.clear()
  }

  private persist(): void {
    const snapshot: SessionSnapshot = {
      version: 1,
      updatedAt: new Date().toISOString(),
      levels: this.levels,
    }
    this.saveManager.save(snapshot)
  }

  private createEmpty(levelId: string): LevelTelemetry {
    return {
      levelId,
      durationMs: 0,
      primaryDirection: 'center',
      movementIntensity: 0,
      hesitationCount: 0,
      assistanceLevel: 0,
      choices: {},
      metrics: {},
    }
  }
}

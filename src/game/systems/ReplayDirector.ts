import { replayManifest } from '../config/replayManifest'
import type { LevelTelemetry, ReplayClipVariant, ReplayCondition } from '../types'

export class ReplayDirector {
  select(levelId: string, telemetry: LevelTelemetry | null): ReplayClipVariant {
    const candidates = replayManifest.filter((clip) => clip.levelId === levelId)
    if (!candidates.length) throw new Error(`No replay variants configured for ${levelId}`)
    if (!telemetry) return candidates[1] ?? candidates[0]
    return candidates.find((clip) => this.matchesAll(clip.conditions ?? [], telemetry)) ?? candidates[0]
  }

  allFor(levelId: string): ReplayClipVariant[] {
    return replayManifest.filter((clip) => clip.levelId === levelId)
  }

  all(): ReplayClipVariant[] {
    return [...replayManifest]
  }

  private matchesAll(conditions: ReplayCondition[], telemetry: LevelTelemetry): boolean {
    return conditions.every((condition) => {
      const actual = this.readField(telemetry, condition.field)
      const expected = condition.value
      switch (condition.operator) {
        case 'eq': return actual === expected
        case 'neq': return actual !== expected
        case 'gt': return typeof actual === 'number' && typeof expected === 'number' && actual > expected
        case 'gte': return typeof actual === 'number' && typeof expected === 'number' && actual >= expected
        case 'lt': return typeof actual === 'number' && typeof expected === 'number' && actual < expected
        case 'lte': return typeof actual === 'number' && typeof expected === 'number' && actual <= expected
      }
    })
  }

  private readField(telemetry: LevelTelemetry, path: string): unknown {
    return path.split('.').reduce<unknown>((value, key) => {
      if (!value || typeof value !== 'object') return undefined
      return (value as Record<string, unknown>)[key]
    }, telemetry)
  }
}

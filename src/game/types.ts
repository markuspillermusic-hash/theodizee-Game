export type Direction = 'left' | 'right' | 'center'
export type AssistanceLevel = 0 | 1 | 2 | 3

export interface LevelTelemetry {
  levelId: string
  durationMs: number
  primaryDirection: Direction
  firstDirection?: Direction
  movementIntensity: number
  hesitationCount: number
  assistanceLevel: AssistanceLevel
  choices: Record<string, string | number | boolean>
  metrics: Record<string, number>
}

export interface SessionSnapshot {
  version: 1
  updatedAt: string
  levels: Record<string, LevelTelemetry>
}

export type GameStateKey =
  | 'Boot'
  | 'Preload'
  | 'Title'
  | 'Intro'
  | 'Level01'
  | 'Echo01'
  | 'Level02'
  | 'Echo02'
  | 'Level03'
  | 'Echo03'
  | 'Level04'
  | 'Transition45'
  | 'Echo04'
  | 'Level05'
  | 'Echo05'
  | 'Level06'
  | 'FinaleReplay'
  | 'End'

export interface RuntimeStatus {
  state: GameStateKey
  remainingMs: number | null
  assistanceLevel: AssistanceLevel
  paused: boolean
  preloadStatus: string
  videoStatus: string
  selectedVariant: string | null
  testMode: boolean
  fps: number
}

export interface ReplayCondition {
  field: string
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte'
  value: string | number | boolean
}

export interface ReplayClipVariant {
  id: string
  levelId: string
  srcMp4: string
  srcWebm?: string
  durationMs: number
  playbackRate: number
  tags: string[]
  caption: string
  conditions?: ReplayCondition[]
}

export interface LevelConfig {
  id: string
  title: string
  expectedDurationMs: number
  storyDurationMs: number
  maximumDurationMs: number
  hintTimesMs: [number, number, number]
  echoId?: string
  nextState: GameStateKey
}

export interface LevelResult {
  choices?: Record<string, string | number | boolean>
  metrics?: Record<string, number>
}

import type { LevelConfig } from '../types'

export const levels: Record<string, LevelConfig> = {
  level01: {
    id: 'level-01', title: 'Bleibe', expectedDurationMs: 78_000, storyDurationMs: 90_000,
    maximumDurationMs: 105_000, hintTimesMs: [25_000, 48_000, 72_000], echoId: 'echo-01', nextState: 'Echo01',
  },
  level02: {
    id: 'level-02', title: 'Folge', expectedDurationMs: 62_000, storyDurationMs: 72_000,
    maximumDurationMs: 82_000, hintTimesMs: [18_000, 38_000, 58_000], echoId: 'echo-02', nextState: 'Echo02',
  },
  level03: {
    id: 'level-03', title: 'Versorge', expectedDurationMs: 105_000, storyDurationMs: 125_000,
    maximumDurationMs: 145_000, hintTimesMs: [35_000, 72_000, 105_000], echoId: 'echo-03', nextState: 'Echo03',
  },
  level04: {
    id: 'level-04', title: 'Bewahre', expectedDurationMs: 100_000, storyDurationMs: 120_000,
    maximumDurationMs: 140_000, hintTimesMs: [32_000, 68_000, 102_000], echoId: 'echo-04', nextState: 'Echo04',
  },
  level05: {
    id: 'level-05', title: 'Verbinde', expectedDurationMs: 135_000, storyDurationMs: 155_000,
    maximumDurationMs: 175_000, hintTimesMs: [42_000, 88_000, 132_000], echoId: 'echo-05', nextState: 'Echo05',
  },
  level06: {
    id: 'level-06', title: 'Lass los', expectedDurationMs: 62_000, storyDurationMs: 75_000,
    maximumDurationMs: 90_000, hintTimesMs: [20_000, 42_000, 62_000], nextState: 'FinaleReplay',
  },
}

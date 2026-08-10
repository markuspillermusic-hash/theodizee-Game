import type { LevelConfig } from '../types'

/**
 * `expectedDurationMs` ist ab Version 2 kein Zielwert mehr, sondern der Vergleichsmaßstab für die
 * Güte: Level 3 bis 6 enden, sobald ihr Soll erreicht ist. `maximumDurationMs` ist nur noch die
 * Notbremse; kurz davor schaltet die Szene selbst auf Hilfestufe 3, statt hart abzuschneiden.
 */
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
    id: 'level-03', title: 'Versorge', expectedDurationMs: 66_000, storyDurationMs: 100_000,
    maximumDurationMs: 128_000, hintTimesMs: [30_000, 60_000, 92_000], echoId: 'echo-03', nextState: 'Echo03',
  },
  level04: {
    id: 'level-04', title: 'Bewahre', expectedDurationMs: 58_000, storyDurationMs: 76_000,
    maximumDurationMs: 92_000, hintTimesMs: [20_000, 40_000, 62_000], echoId: 'echo-04', nextState: 'Transition45',
  },
  level05: {
    id: 'level-05', title: 'Verbinde', expectedDurationMs: 66_000, storyDurationMs: 90_000,
    maximumDurationMs: 104_000, hintTimesMs: [22_000, 46_000, 74_000], echoId: 'echo-05', nextState: 'Echo05',
  },
  level06: {
    id: 'level-06', title: 'Lass los', expectedDurationMs: 79_000, storyDurationMs: 96_000,
    maximumDurationMs: 108_000, hintTimesMs: [24_000, 50_000, 80_000], echoId: 'echo-06', nextState: 'FinaleReplay',
  },
}

export const GAME_WIDTH = 1920
export const GAME_HEIGHT = 1080

export const gameConfig = {
  background: 0x020806,
  colors: {
    ink: 0x020806,
    light: 0xeaf7bf,
    growth: 0x9fc48b,
    moisture: 0x8ccfc7,
    warning: 0xe6b974,
    quiet: 0x7e9b8b,
  },
  controls: {
    acceleration: 0.00072,
    damping: 0.91,
    pointerPull: 0.0062,
    maxVelocity: 0.022,
  },
  debugEnabledInProduction: false,
} as const

export const TEST_TIME_SCALE = 0.035

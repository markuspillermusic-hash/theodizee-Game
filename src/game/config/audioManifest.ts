export const audioManifest = {
  ambient: {
    light: { rootHz: 98, upperHz: 147, gain: 0.045 },
    echo: { rootHz: 82, upperHz: 123, gain: 0.052 },
    motion: { rootHz: 73, upperHz: 164, gain: 0.042 },
    care: { rootHz: 110, upperHz: 165, gain: 0.046 },
    memory: { rootHz: 92, upperHz: 138, gain: 0.043 },
    bond: { rootHz: 123, upperHz: 185, gain: 0.05 },
    release: { rootHz: 69, upperHz: 104, gain: 0.038 },
    finale: { rootHz: 98, upperHz: 196, gain: 0.056 },
  },
  motifs: {
    swift: [196, 277, 233],
    group: [147, 165, 196],
    care: [165, 220, 247],
    familiar: [185, 247, 277],
    bond: [220, 277, 330],
    release: [165, 147, 110],
    whole: [147, 196, 247, 294],
  },
} as const

export type AmbientKey = keyof typeof audioManifest.ambient
export type MotifKey = keyof typeof audioManifest.motifs

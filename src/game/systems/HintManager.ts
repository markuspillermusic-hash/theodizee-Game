import type { AssistanceLevel } from '../types'

export class HintManager {
  private level: AssistanceLevel = 0
  private readonly hintTimesMs: readonly number[]
  private readonly onChange: (level: AssistanceLevel) => void

  constructor(
    hintTimesMs: readonly number[],
    onChange: (level: AssistanceLevel) => void,
  ) {
    this.hintTimesMs = hintTimesMs
    this.onChange = onChange
  }

  update(elapsedMs: number): AssistanceLevel {
    let target: AssistanceLevel = 0
    if (elapsedMs >= this.hintTimesMs[0]) target = 1
    if (elapsedMs >= this.hintTimesMs[1]) target = 2
    if (elapsedMs >= this.hintTimesMs[2]) target = 3
    if (target > this.level) this.setLevel(target)
    return this.level
  }

  forceNext(): AssistanceLevel {
    this.setLevel(Math.min(3, this.level + 1) as AssistanceLevel)
    return this.level
  }

  getLevel(): AssistanceLevel {
    return this.level
  }

  private setLevel(level: AssistanceLevel): void {
    if (level === this.level) return
    this.level = level
    this.onChange(level)
  }
}

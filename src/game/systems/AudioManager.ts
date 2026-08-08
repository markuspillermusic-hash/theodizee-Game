import { audioManifest, type AmbientKey, type MotifKey } from '../config/audioManifest'

export class AudioManager {
  private context: AudioContext | null = null
  private musicBus: GainNode | null = null
  private effectsBus: GainNode | null = null
  private activeDrones: Array<{ oscillator: OscillatorNode; gain: GainNode }> = []
  private musicVolume = 0.38
  private effectsVolume = 0.65

  async unlock(): Promise<void> {
    this.ensureContext()
    if (this.context?.state === 'suspended') await this.context.resume()
  }

  startAmbient(kind: AmbientKey): void {
    this.ensureContext()
    this.stopAmbient(0.45)
    if (!this.context || !this.musicBus) return

    const config = audioManifest.ambient[kind]
    const now = this.context.currentTime
    const pair = [config.rootHz, config.upperHz].map((frequency, index) => {
      const oscillator = this.context!.createOscillator()
      const gain = this.context!.createGain()
      oscillator.type = index === 0 ? 'sine' : 'triangle'
      oscillator.frequency.value = frequency
      oscillator.detune.value = index === 0 ? -7 : 5
      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.exponentialRampToValueAtTime(config.gain * (index === 0 ? 1 : 0.45), now + 2.6)
      oscillator.connect(gain).connect(this.musicBus!)
      oscillator.start(now)
      return { oscillator, gain }
    })
    this.activeDrones = pair
  }

  playSwiftMotif(): void {
    this.playMotif('swift', 0.12, 'sawtooth')
  }

  playMotif(kind: MotifKey, spacing = 0.14, wave: OscillatorType = 'sine'): void {
    this.ensureContext()
    if (!this.context || !this.effectsBus) return
    const now = this.context.currentTime
    audioManifest.motifs[kind].forEach((frequency, index) => {
      const oscillator = this.context!.createOscillator()
      const gain = this.context!.createGain()
      const start = now + index * spacing
      oscillator.type = wave
      oscillator.frequency.setValueAtTime(frequency, start)
      oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.16, start + 0.16)
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.09, start + 0.025)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.23)
      oscillator.connect(gain).connect(this.effectsBus!)
      oscillator.start(start)
      oscillator.stop(start + 0.25)
    })
  }

  pulse(frequency = 164, intensity = 0.035): void {
    this.ensureContext()
    if (!this.context || !this.effectsBus) return
    const oscillator = this.context.createOscillator()
    const gain = this.context.createGain()
    const now = this.context.currentTime
    oscillator.type = 'sine'
    oscillator.frequency.value = frequency
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(intensity, now + 0.03)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42)
    oscillator.connect(gain).connect(this.effectsBus)
    oscillator.start(now)
    oscillator.stop(now + 0.45)
  }

  stopAmbient(fadeSeconds = 0.8): void {
    if (!this.context) return
    const now = this.context.currentTime
    this.activeDrones.forEach(({ oscillator, gain }) => {
      try {
        const currentGain = Math.max(0.0001, gain.gain.value)
        gain.gain.cancelScheduledValues(now)
        gain.gain.setValueAtTime(currentGain, now)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + fadeSeconds)
        oscillator.stop(now + fadeSeconds + 0.05)
      } catch {
        // Oscillator may already have stopped during a scene change.
      }
    })
    this.activeDrones = []
  }

  setMusicVolume(value: number): void {
    this.musicVolume = value
    if (this.musicBus && this.context) this.musicBus.gain.setTargetAtTime(value, this.context.currentTime, 0.08)
  }

  setEffectsVolume(value: number): void {
    this.effectsVolume = value
    if (this.effectsBus && this.context) this.effectsBus.gain.setTargetAtTime(value, this.context.currentTime, 0.08)
  }

  async pause(): Promise<void> {
    if (this.context?.state === 'running') await this.context.suspend()
  }

  async resume(): Promise<void> {
    if (this.context?.state === 'suspended') await this.context.resume()
  }

  private ensureContext(): void {
    if (this.context) return
    const AudioContextClass = window.AudioContext
    if (!AudioContextClass) return
    this.context = new AudioContextClass()
    this.musicBus = this.context.createGain()
    this.effectsBus = this.context.createGain()
    this.musicBus.gain.value = this.musicVolume
    this.effectsBus.gain.value = this.effectsVolume
    this.musicBus.connect(this.context.destination)
    this.effectsBus.connect(this.context.destination)
  }
}

import { audioManifest, type AmbientKey, type MotifKey } from '../config/audioManifest'

export interface NoiseOptions {
  /** Dauer in Millisekunden. */
  durationMs?: number
  /** Mittenfrequenz des Bandpasses. Tief = Wucht, hoch = Zischen. */
  centreHz?: number
  /** Zielfrequenz, auf die der Filter fährt. Ohne Angabe bleibt er stehen. */
  sweepToHz?: number
  /** Güte des Filters. Hoch = schmal und tonal, niedrig = breit und rauschend. */
  q?: number
  intensity?: number
  /** −1 links bis +1 rechts. */
  pan?: number
  /** Anteil, der in den Hall geht. */
  space?: number
}

/**
 * Klang ohne Dateien: Oszillatoren, gefiltertes Rauschen und ein erzeugter Hall.
 *
 * Bis August 2026 gab es nur zwei Sinusdronen, ein Motiv und einen Sinus-Piep. Das klang nach
 * Messton, nicht nach Ort. Drei Dinge fehlten und sind jetzt da:
 *
 * - **Hall.** Eine erzeugte Impulsantwort auf einem eigenen Bus. Jeder Ton steht damit in einem
 *   Raum statt im Nichts.
 * - **Rauschen.** Ein Sinus kann kein Fell, kein Feuer und keinen Atem. Gefiltertes Rauschen kann
 *   alles drei — über Mittenfrequenz und Filterfahrt unterscheiden sich Hieb, Knurren und Wind.
 * - **Panorama und Farbe.** Wer von links kommt, ist links zu hören; wer erschöpft ist, hört
 *   dumpfer. Beides trägt Information, nicht nur Stimmung.
 */
export class AudioManager {
  private context: AudioContext | null = null
  private masterBus: GainNode | null = null
  private colourFilter: BiquadFilterNode | null = null
  private musicBus: GainNode | null = null
  private effectsBus: GainNode | null = null
  private reverbBus: GainNode | null = null
  private noiseSource: AudioBuffer | null = null
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
      oscillator.connect(gain)
      this.route(gain, 0.4)
      oscillator.start(start)
      oscillator.stop(start + 0.25)
    })
  }

  pulse(frequency = 164, intensity = 0.035, pan = 0): void {
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
    oscillator.connect(gain)
    this.route(gain, 0.35, pan)
    oscillator.start(now)
    oscillator.stop(now + 0.45)
  }

  /**
   * Gefiltertes Rauschen. Trägt alles, was kein Ton ist: Hieb, Fell, Atem, Wind, Feuer.
   */
  noise(options: NoiseOptions = {}): void {
    this.ensureContext()
    if (!this.context || !this.effectsBus) return
    const buffer = this.ensureNoise()
    if (!buffer) return
    const {
      durationMs = 220, centreHz = 900, sweepToHz, q = 1.4, intensity = 0.09, pan = 0, space = 0.3,
    } = options
    const now = this.context.currentTime
    const seconds = durationMs / 1_000

    const source = this.context.createBufferSource()
    source.buffer = buffer
    source.loop = true
    source.playbackRate.value = 0.8 + Math.random() * 0.4

    const filter = this.context.createBiquadFilter()
    filter.type = 'bandpass'
    filter.Q.value = q
    filter.frequency.setValueAtTime(centreHz, now)
    if (sweepToHz) filter.frequency.exponentialRampToValueAtTime(Math.max(40, sweepToHz), now + seconds)

    const gain = this.context.createGain()
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(intensity, now + Math.min(0.02, seconds * 0.2))
    gain.gain.exponentialRampToValueAtTime(0.0001, now + seconds)

    source.connect(filter).connect(gain)
    this.route(gain, space, pan)
    source.start(now)
    source.stop(now + seconds + 0.05)
  }

  /**
   * Aufschlag: ein Klick, der sofort in die Tiefe fällt. Für alles, was trifft oder auftrifft.
   */
  thump(frequency = 90, intensity = 0.14, pan = 0): void {
    this.ensureContext()
    if (!this.context || !this.effectsBus) return
    const now = this.context.currentTime
    const oscillator = this.context.createOscillator()
    const gain = this.context.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(frequency * 2.6, now)
    oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.55, now + 0.16)
    gain.gain.setValueAtTime(intensity, now)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.34)
    oscillator.connect(gain)
    this.route(gain, 0.45, pan)
    oscillator.start(now)
    oscillator.stop(now + 0.36)
    this.noise({ durationMs: 90, centreHz: 2_200, sweepToHz: 380, q: 0.8, intensity: intensity * 0.5, pan, space: 0.2 })
  }

  /**
   * Klangfarbe des Ganzen. 20000 = offen, 900 = dumpf. Für Erschöpfung, Rauch, Unterwasser,
   * Sterben — überall dort, wo die Welt zurücktritt.
   */
  setColour(cutoffHz: number, seconds = 0.6): void {
    this.ensureContext()
    if (!this.colourFilter || !this.context) return
    this.colourFilter.frequency.setTargetAtTime(cutoffHz, this.context.currentTime, Math.max(0.02, seconds / 3))
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

  /** Trocken auf den Effektbus, nass in den Hall — dazu die Position im Panorama. */
  private route(node: GainNode, space: number, pan = 0): void {
    if (!this.context || !this.effectsBus) return
    let tail: AudioNode = node
    if (pan !== 0 && typeof this.context.createStereoPanner === 'function') {
      const panner = this.context.createStereoPanner()
      panner.pan.value = Math.max(-1, Math.min(1, pan))
      node.connect(panner)
      tail = panner
    }
    tail.connect(this.effectsBus)
    if (space > 0 && this.reverbBus) {
      const send = this.context.createGain()
      send.gain.value = space
      tail.connect(send).connect(this.reverbBus)
    }
  }

  private ensureNoise(): AudioBuffer | null {
    if (this.noiseSource || !this.context) return this.noiseSource
    const rate = this.context.sampleRate
    const buffer = this.context.createBuffer(1, Math.floor(rate * 2), rate)
    const data = buffer.getChannelData(0)
    for (let index = 0; index < data.length; index += 1) data[index] = Math.random() * 2 - 1
    this.noiseSource = buffer
    return buffer
  }

  /** Abklingendes Rauschen als Impulsantwort. Kostet nichts und ersetzt eine Halldatei. */
  private buildImpulse(seconds: number, decay: number): AudioBuffer {
    const rate = this.context!.sampleRate
    const length = Math.max(1, Math.floor(rate * seconds))
    const buffer = this.context!.createBuffer(2, length, rate)
    for (let channel = 0; channel < 2; channel += 1) {
      const data = buffer.getChannelData(channel)
      for (let index = 0; index < length; index += 1) {
        const position = index / length
        data[index] = (Math.random() * 2 - 1) * Math.pow(1 - position, decay)
      }
    }
    return buffer
  }

  private ensureContext(): void {
    if (this.context) return
    const AudioContextClass = window.AudioContext
    if (!AudioContextClass) return
    this.context = new AudioContextClass()

    this.masterBus = this.context.createGain()
    this.masterBus.gain.value = 1
    this.colourFilter = this.context.createBiquadFilter()
    this.colourFilter.type = 'lowpass'
    this.colourFilter.frequency.value = 20_000
    this.masterBus.connect(this.colourFilter).connect(this.context.destination)

    this.musicBus = this.context.createGain()
    this.effectsBus = this.context.createGain()
    this.musicBus.gain.value = this.musicVolume
    this.effectsBus.gain.value = this.effectsVolume
    this.musicBus.connect(this.masterBus)
    this.effectsBus.connect(this.masterBus)

    try {
      const convolver = this.context.createConvolver()
      convolver.buffer = this.buildImpulse(2.4, 2.8)
      this.reverbBus = this.context.createGain()
      this.reverbBus.gain.value = 0.9
      this.reverbBus.connect(convolver).connect(this.masterBus)
      const musicSend = this.context.createGain()
      musicSend.gain.value = 0.35
      this.musicBus.connect(musicSend).connect(this.reverbBus)
    } catch {
      this.reverbBus = null
    }
  }
}

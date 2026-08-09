import Phaser from 'phaser'
import type { ObjectiveHud } from '../components/ObjectiveHud'

export type Grade = 'knapp' | 'solide' | 'stark'

export interface GoalOptions {
  /** Kurzes Verb im HUD, niemals ein Wesen oder Stoff. Siehe Sprachregel im Konzept. */
  label: string
  target: number
  /** Beschriftung des Pufferbalkens; ohne Angabe bleibt der Balken ausgeblendet. */
  bufferLabel?: string
  /** Einheiten, die ein Rückschlag kostet. */
  setbackCost?: number
  /** Puffer, der nach einem Rückschlag wiederhergestellt wird. */
  bufferAfterSetback?: number
}

/**
 * Soll, Puffer, Rückschlag und Güte für ein Level.
 *
 * Der Tracker trägt die Regel aus `docs/KONZEPT-mechanik-2026-08-09.md`: Ein Ziel darf verfehlt
 * werden, ein Fehler kostet etwas — aber es gibt keine Niederlage. Ein leerer Puffer nimmt
 * Fortschritt zurück und füllt sich wieder; er beendet das Level nie.
 */
export class GoalTracker {
  private count = 0
  private buffer = 1
  private setbacks = 0
  private bestBuffer = 1
  private worstBuffer = 1
  private readonly options: Required<GoalOptions>
  private readonly hud: ObjectiveHud
  private setbackFlashMs = 0
  private gainFlashMs = 0

  constructor(hud: ObjectiveHud, options: GoalOptions) {
    this.hud = hud
    this.options = {
      bufferLabel: '',
      setbackCost: 1,
      bufferAfterSetback: 0.55,
      ...options,
    }
    this.refresh()
  }

  get value(): number {
    return this.count
  }

  get target(): number {
    return this.options.target
  }

  get reached(): boolean {
    return this.count >= this.options.target
  }

  get bufferValue(): number {
    return this.buffer
  }

  get setbackCount(): number {
    return this.setbacks
  }

  /** 0 bis 1, blendet kurz nach einem Rückschlag auf. Für Bildschirmeffekte. */
  get setbackFlash(): number {
    return Phaser.Math.Clamp(this.setbackFlashMs / 900, 0, 1)
  }

  get gainFlash(): number {
    return Phaser.Math.Clamp(this.gainFlashMs / 520, 0, 1)
  }

  advance(delta: number): void {
    this.setbackFlashMs = Math.max(0, this.setbackFlashMs - delta)
    this.gainFlashMs = Math.max(0, this.gainFlashMs - delta)
  }

  /** Fortschritt am Soll. Gibt zurück, ob das Soll damit erreicht ist. */
  add(units = 1): boolean {
    const before = this.count
    this.count = Phaser.Math.Clamp(this.count + units, 0, this.options.target)
    if (this.count > before) this.gainFlashMs = 520
    this.refresh()
    return this.reached
  }

  /** Zählerstand direkt setzen. Für Soll-Werte, die eine Serie sind und bei einem Fehler fallen. */
  setValue(units: number): boolean {
    const before = this.count
    this.count = Phaser.Math.Clamp(units, 0, this.options.target)
    if (this.count > before) this.gainFlashMs = 520
    this.refresh()
    return this.reached
  }

  /**
   * Rückschlag: nimmt Fortschritt zurück, stellt den Puffer teilweise wieder her und meldet
   * zurück, dass die Szene eine Erschütterung zeigen soll. Beendet nie das Level.
   */
  setback(): void {
    this.setbacks += 1
    this.count = Math.max(0, this.count - this.options.setbackCost)
    this.buffer = this.options.bufferAfterSetback
    this.setbackFlashMs = 900
    this.refresh()
  }

  /** Puffer verbrauchen. Bei Erreichen von null wird automatisch ein Rückschlag ausgelöst. */
  drainBuffer(amount: number): boolean {
    if (amount <= 0 || this.buffer <= 0) return false
    this.buffer = Math.max(0, this.buffer - amount)
    this.worstBuffer = Math.min(this.worstBuffer, this.buffer)
    this.refresh()
    if (this.buffer > 0) return false
    this.setback()
    return true
  }

  fillBuffer(amount: number): void {
    if (amount <= 0) return
    this.buffer = Math.min(1, this.buffer + amount)
    this.bestBuffer = Math.max(this.bestBuffer, this.buffer)
    this.refresh()
  }

  resetBuffer(value = 1): void {
    this.buffer = Phaser.Math.Clamp(value, 0, 1)
    this.refresh()
  }

  /**
   * Güte in drei Stufen. Sie speist die Echo-Auswahl und später die Kopplung zum nächsten Level.
   * Bewusst grob: vor der Klasse soll niemand als knapp gescheitert dastehen, sondern als jemand,
   * der einen von drei möglichen Durchläufen gespielt hat.
   */
  grade(elapsedMs: number, expectedMs: number): Grade {
    if (!this.reached) return 'knapp'
    const pace = expectedMs > 0 ? elapsedMs / expectedMs : 1
    if (this.setbacks === 0 && pace <= 0.92) return 'stark'
    if (this.setbacks <= 1 && pace <= 1.15) return 'solide'
    return 'knapp'
  }

  /** Kennzahlen für die Telemetrie. Werden im Replay gebraucht. */
  metrics(elapsedMs: number, expectedMs: number): Record<string, number> {
    const grade = this.grade(elapsedMs, expectedMs)
    return {
      goalReached: this.reached ? 1 : 0,
      goalCount: this.count,
      goalTarget: this.options.target,
      setbacks: this.setbacks,
      finalBuffer: this.buffer,
      worstBuffer: this.worstBuffer,
      gradeScore: grade === 'stark' ? 2 : grade === 'solide' ? 1 : 0,
    }
  }

  /** Beschriftung wechseln, ohne den Zählerstand zu verlieren. */
  relabel(label: string, target = this.options.target): void {
    this.options.label = label
    this.options.target = target
    this.count = Math.min(this.count, target)
    this.refresh()
  }

  private refresh(): void {
    this.hud.set(this.options.label, `${this.count}/${this.options.target}`, this.count / this.options.target)
    this.hud.setBuffer(this.options.bufferLabel || null, this.options.bufferLabel ? this.buffer : null)
  }
}

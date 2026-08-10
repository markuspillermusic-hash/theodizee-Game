import type Phaser from 'phaser'
import type { GameApp } from '../game/GameApp'
import type { GameStateKey } from '../game/types'

/**
 * Prüfstrecke für Umgebungen ohne laufende Bildschleife.
 *
 * Wird eine Seite nicht zusammengesetzt, feuert `requestAnimationFrame` nicht. Dann läuft weder
 * `update` noch das Zeichnen, Szenenwechsel bleiben in der Warteschlange stehen, `delayedCall`
 * und Tweens ruhen — und ein Screenshot von außen ist unmöglich.
 *
 * Die Lösung: Phasers Schleife von Hand takten. `game.step(zeit, delta)` erledigt in einem Aufruf
 * Warteschlange, Szenen-Update, Zeitgeber, Tweens **und** das Rendern. Danach lässt sich das Bild
 * aus dem Canvas lesen und an den Dev-Server schicken, der es als PNG ablegt.
 *
 * Nur im Entwicklungsserver eingebunden.
 */

interface BotInput {
  x: number
  y: number
  active?: boolean
  press?: boolean
}

type BotFactory = (scene: Record<string, unknown>) => (x: number, y: number) => BotInput

export interface RunSpec {
  /** Abschnitt, der gestartet wird. */
  state: GameStateKey
  /** Wie viele Sekunden Spielzeit getaktet werden. */
  seconds: number
  /** Steuerung. Ohne Angabe passiert nichts — der untätige Durchlauf. */
  bot?: BotFactory
  /** Steuerung je Szene, damit sich ein Durchlauf über mehrere Abschnitte takten lässt. */
  bots?: Record<string, BotFactory>
  /** Sekunden, zu denen ein Bild abgelegt wird. */
  shots?: number[]
  /** Namenspräfix der Bilddateien. */
  label?: string
  /** Briefing automatisch schließen. Standard: ja. */
  skipBriefing?: boolean
}

export interface RunReport {
  label: string
  seconds: number
  scenes: string[]
  shots: string[]
  ui: { scene: string; instruction: string; hint: string }
  finishedIn?: string
}

const FRAME_MS = 1000 / 60

function readUi(): { scene: string; instruction: string; hint: string } {
  const text = (selector: string): string =>
    (document.querySelector(selector)?.textContent ?? '').trim()
  return {
    scene: text('[data-role="scene"]') || text('#scene-label'),
    instruction: text('[data-role="instruction"]') || text('#instruction'),
    hint: text('[data-role="hint"]') || text('#hint'),
  }
}

export class QaHarness {
  private readonly app: GameApp

  constructor(app: GameApp) {
    this.app = app
  }

  private get game(): Phaser.Game {
    return this.app.game
  }

  /**
   * Die zuletzt gestartete laufende Szene. `getScenes(true)[0]` liefert `Preload`, das nach dem
   * Start weiterläuft — damit landete der Bot auf der falschen Szene und das Briefing blieb stehen.
   */
  private activeScene(): (Phaser.Scene & Record<string, unknown>) | null {
    const running = this.game.scene.getScenes(true) as Array<Phaser.Scene & Record<string, unknown>>
    const playable = running.filter((scene) => !['Boot', 'Preload'].includes(scene.scene.key))
    return playable[playable.length - 1] ?? running[running.length - 1] ?? null
  }

  /**
   * Echtzeitbetrieb mit laufender Bildschleife. Anders als `run` wird hier nichts von Hand
   * getaktet — das Spiel läuft normal, und nur die Steuerung wird von aussen besetzt. Gedacht für
   * einen echten Browser, in dem Bewegung und Übergänge beurteilt werden sollen.
   *
   * Die Bots kommen als Quelltext herein, weil sie aus einem anderen Prozess stammen.
   */
  live(spec: { state: GameStateKey; bots?: Record<string, string> }): void {
    const factories = new Map<string, BotFactory>()
    Object.entries(spec.bots ?? {}).forEach(([key, source]) => {
      factories.set(key, new Function(`return (${source})`)() as BotFactory)
    })

    let installedOn: string | null = null
    let pressPending = false
    let botFn: ((x: number, y: number) => BotInput) | null = null

    const attach = (): void => {
      const scene = this.activeScene()
      const key = scene?.scene.key ?? null
      if (!scene || !key || installedOn === key) return
      installedOn = key
      const briefing = scene.briefing as { destroy?: () => void } | undefined
      briefing?.destroy?.()
      const manager = scene.inputManager as Record<string, unknown> | undefined
      if (!manager) return
      const factory = factories.get(key)
      if (!factory) {
        manager.getVector = () => ({ x: 0, y: 0, active: false })
        manager.justActionDown = () => false
        manager.isActionDown = () => false
        return
      }
      botFn = factory(scene as Record<string, unknown>)
      manager.getVector = (x: number, y: number) => {
        const value = botFn ? botFn(x, y) : { x: 0, y: 0 }
        pressPending = Boolean(value.press)
        return { x: value.x, y: value.y, active: value.active ?? (value.x !== 0 || value.y !== 0) }
      }
      manager.justActionDown = () => {
        const pressed = pressPending
        pressPending = false
        return pressed
      }
      manager.isActionDown = () => false
    }

    this.game.loop.wake()
    this.app.startState(spec.state)
    this.game.events.on('poststep', attach)
  }

  /** Ein Bild aus dem Canvas holen und beim Dev-Server ablegen. */
  async shot(name: string): Promise<string> {
    const canvas = this.game.canvas
    const dataUrl = canvas.toDataURL('image/png')
    const response = await fetch('/__qa/shot', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, dataUrl }),
    })
    const result = (await response.json()) as { ok: boolean; path?: string; error?: string }
    if (!result.ok) throw new Error(result.error ?? 'Aufnahme fehlgeschlagen')
    return result.path ?? name
  }

  /**
   * Einen Abschnitt von Hand durchtakten. Szenenwechsel, Zeitgeber und Rendern laufen dabei
   * genauso wie im echten Betrieb, nur eben ohne Bildschirmaktualisierung.
   */
  async run(spec: RunSpec): Promise<RunReport> {
    const label = spec.label ?? spec.state
    const shotsAt = [...(spec.shots ?? [])].sort((a, b) => a - b)
    const scenes: string[] = []
    const shots: string[] = []
    let finishedIn: string | undefined

    // Die echte Schleife darf nicht dazwischenfunken, falls sie doch läuft.
    this.game.loop.sleep()
    this.app.startState(spec.state)

    let clock = 0
    let installedOn: string | null = null
    let botFn: ((x: number, y: number) => BotInput) | null = null
    let pressPending = false
    const totalFrames = Math.ceil((spec.seconds * 1000) / FRAME_MS)

    for (let frame = 0; frame <= totalFrames; frame += 1) {
      clock += FRAME_MS
      this.game.step(clock, FRAME_MS)

      const scene = this.activeScene()
      const key = scene?.scene.key ?? null
      if (key && scenes[scenes.length - 1] !== key) {
        scenes.push(key)
        installedOn = null
      }

      if (scene && key && installedOn !== key) {
        installedOn = key
        if (spec.skipBriefing !== false) {
          const briefing = scene.briefing as { destroy?: () => void } | undefined
          briefing?.destroy?.()
        }
        const manager = scene.inputManager as Record<string, unknown> | undefined
        const factory = spec.bots?.[key] ?? (spec.bots ? undefined : spec.bot)
        if (manager && factory) {
          botFn = factory(scene as Record<string, unknown>)
          manager.getVector = (x: number, y: number) => {
            const value = botFn ? botFn(x, y) : { x: 0, y: 0 }
            pressPending = Boolean(value.press)
            const active = value.active ?? (value.x !== 0 || value.y !== 0)
            return { x: value.x, y: value.y, active }
          }
          manager.justActionDown = () => {
            const pressed = pressPending
            pressPending = false
            return pressed
          }
          manager.isActionDown = () => false
        } else if (manager) {
          manager.getVector = () => ({ x: 0, y: 0, active: false })
          manager.justActionDown = () => false
          manager.isActionDown = () => false
        }
      }

      if (!finishedIn && scene && (scene.finished as boolean | undefined)) {
        finishedIn = `${(clock / 1000).toFixed(1)}s`
      }

      while (shotsAt.length > 0 && clock >= shotsAt[0] * 1000) {
        const at = shotsAt.shift() as number
        // Im selben Arbeitsschritt lesen, direkt nach dem Zeichnen.
        shots.push(await this.shot(`${label}-${String(at).padStart(3, '0')}s`))
      }
    }

    return {
      label,
      seconds: Number((clock / 1000).toFixed(1)),
      scenes,
      shots,
      ui: readUi(),
      finishedIn,
    }
  }
}

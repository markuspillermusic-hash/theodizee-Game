import Phaser from 'phaser'
import { ObjectiveHud } from '../components/ObjectiveHud'
import { GAME_HEIGHT, GAME_WIDTH } from '../config/gameConfig'
import { levels } from '../config/levels'
import { GoalTracker } from '../systems/GoalTracker'
import type { AssistanceLevel, Direction, LevelResult } from '../types'
import { TimedLevelScene } from './TimedLevelScene'
import { dust, glow, ground, palette, self, Sparks, vignette } from '../visuals'

interface Soul {
  x: number
  y: number
  /** Wie hell, 0 bis 1. Sinkt in der Finsternis, steigt im Licht. */
  level: number
  /** Hat je die volle Helligkeit erreicht. Zählt für immer, auch wenn es später erlischt. */
  kindled: boolean
  /** Fortgenommen (Verlust) — nicht mehr im Bild. */
  gone: boolean
  /** Hinter der Grenze (Ohnmacht) — sichtbar, nicht erreichbar. */
  beyond: boolean
  /** Kann nichts annehmen (Einsamkeit). Bleibt dunkel, was immer man tut. */
  closed: boolean
}

interface Dark {
  x: number
  y: number
  radius: number
  alive: boolean
}

interface Mote {
  x: number
  y: number
  toX: number
  toY: number
  bornAt: number
  taken: boolean
}

const KINDLE_TARGET = 8
const BASE_RADIUS = 96
const RADIUS_PER_SOUL = 30
const MAX_RADIUS = 340
const BARRIER_X = 1_460
const LIGHT_X = 960
const LIGHT_Y = 540

/**
 * Lass los · „Weitergeben".
 *
 * **Wofür das Licht steht.** Nicht für Lebenskraft, sondern für weitergegebene Liebe. Die
 * unterliegt keiner Erhaltung: Sie wird nicht weniger, wenn man sie teilt. Ein früherer Entwurf
 * modellierte sie als schwindenden Vorrat — das sagte genau das Falsche.
 *
 * Knapp ist nicht das Licht, **knapp bist du**: deine Zeit, dein Körper, deine Reichweite. Du
 * kannst nicht an zwei Orten sein. Daraus kommt der ganze Widerstand.
 *
 * Und es wächst: Jeder, den du entzündest, vergrössert deinen eigenen Schein. Wer mehr gibt, kann
 * mehr erreichen. Gutes tun macht grösser.
 *
 * Gegen dich steht die Finsternis — unpersönlich, kein böser Mensch. Sie löscht, was du entzündet
 * hast, während du woanders bist, und weicht vor Licht zurück. Auch vor dem Licht derer, die du
 * entzündet hast: Sie halten mit, ohne dich.
 *
 * Die vier Gesichter des Leids brechen in die laufende Aufgabe hinein: einer wird ganz genommen
 * (Verlust), zwei Seiten brechen gleichzeitig ein (Endlichkeit), einer liegt hinter einer Grenze
 * (Ohnmacht), einer kann nichts annehmen (Einsamkeit).
 *
 * Am Ende versagt dein Körper, aber nicht dein Werk: Die Lichter halten weiter. Dann kommt das
 * grosse Licht, und alles, was je gebrannt hat, brennt wieder.
 */
export class Level06State extends TimedLevelScene {
  private graphics!: Phaser.GameObjects.Graphics
  private player = new Phaser.Math.Vector2(960, 620)
  private velocity = new Phaser.Math.Vector2()
  private souls: Soul[] = []
  private darks: Dark[] = []
  private motes: Mote[] = []
  private received = 0
  private kindledCount = 0
  private lostOnes = 0
  private relit = 0
  private phase = 0
  private phaseStartedAt = 0
  private eventIndex = 0
  private sampleClock = 0
  private sparks = new Sparks()
  private objectiveHud!: ObjectiveHud
  private goal!: GoalTracker

  constructor() {
    super('Level06')
  }

  create(): void {
    this.player.set(960, 620)
    this.velocity.set(0, 0)
    this.souls = []
    this.darks = []
    this.received = 0
    this.kindledCount = 0
    this.lostOnes = 0
    this.relit = 0
    this.phase = 0
    this.phaseStartedAt = 0
    this.eventIndex = 0
    this.sampleClock = 0
    this.sparks = new Sparks()
    this.motes = [[700, 430], [1_200, 700], [860, 800]].map(([x, y], index) => ({
      x: index % 2 === 0 ? -140 : GAME_WIDTH + 140,
      y: 240 + index * 220,
      toX: x,
      toY: y,
      bornAt: 900 * index * this.timeScale(),
      taken: false,
    }))
    this.graphics = this.add.graphics()
    this.objectiveHud = new ObjectiveHud(this)
    this.goal = new GoalTracker(this.objectiveHud, {
      label: 'Empfangen', target: 3, bufferLabel: 'Dein Licht',
    })
    this.goal.resetBuffer(0)
    this.cameras.main.setBackgroundColor(0x070709)
    this.beginTimedLevel('Level06', levels.level06, 'AUSSCHNITT · 06', 'Nimm auf, was zu dir kommt.', 'release', {
      goal: 'Dein Licht wird nicht weniger, wenn du es weitergibst — es wächst. Aber du kannst nicht überall sein.',
      controls: 'WASD / Pfeiltasten · Maus oder Berührung',
    })
  }

  update(time: number, delta: number): void {
    if (this.finished) return
    const progress = this.advanceLevel(delta)
    if (this.finished || progress < 0) return
    this.goal.advance(delta)
    this.updatePhase()
    this.updateControl(delta)
    if (this.phase === 0) this.updateMotes()
    else if (this.phase < 4) {
      this.updateDarks(delta)
      this.updateSouls(delta)
    } else this.updateFinalLight()
    this.goal.resetBuffer(Phaser.Math.Clamp((this.radius() - BASE_RADIUS) / (MAX_RADIUS - BASE_RADIUS), 0, 1))
    this.drawWorld(time)
  }

  protected applyHint(level: AssistanceLevel): void {
    this.services.setAssistance(level)
    if (level === 1) this.services.ui.setHint('Jeder, den du entzündest, vergrössert dein Licht.')
    if (level === 2) this.services.ui.setHint('Wer brennt, hält die Finsternis selbst ein Stück zurück.')
    if (level === 3) this.services.ui.setHint('Dein Licht reicht weiter.')
  }

  protected collectResult(): LevelResult {
    // Ein einziger, eindeutiger Selektor für den Film: viele Lichter oder wenige.
    const many = this.kindledCount >= Math.ceil(KINDLE_TARGET * 0.7)
    return {
      choices: {
        light: many ? 'viele' : 'wenige',
        released: this.phase >= 4,
      },
      metrics: {
        kindled: this.kindledCount,
        kindleTarget: KINDLE_TARGET,
        stillBurning: this.souls.filter((soul) => !soul.gone && soul.level > 0.5).length,
        lostOnes: this.lostOnes,
        relit: this.relit,
        received: this.received,
        finalRadius: this.radius(),
        gradeScore: this.kindledCount >= KINDLE_TARGET ? 2 : many ? 1 : 0,
      },
    }
  }

  protected afterLevelFinished(): void {
    this.services.audio.stopAmbient(1.4)
    this.services.ui.setScene('')
    this.cameras.main.fadeOut(2_200, 255, 255, 250)
    const testMode = this.services.getStatus().testMode
    this.time.delayedCall(testMode ? 380 : 2_300, () => this.scene.start('FinaleReplay'))
  }

  private timeScale(): number {
    return this.services.getTimeScale()
  }

  /** Der eigene Schein. Er wächst mit jedem Entzündeten und schrumpft nie. */
  private radius(): number {
    if (this.phase === 0) return BASE_RADIUS * 0.45 + this.received * 22
    const assist = this.hintManager.getLevel() >= 3 ? 40 : 0
    return Math.min(MAX_RADIUS, BASE_RADIUS + this.kindledCount * RADIUS_PER_SOUL + assist)
  }

  /** Licht an einer Stelle: das eigene plus das aller, die brennen. */
  private lightAt(x: number, y: number): number {
    let value = 0
    const own = this.radius()
    const toPlayer = Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y)
    if (toPlayer < own) value += 1 - toPlayer / own
    this.souls.forEach((soul) => {
      if (soul.gone || soul.level < 0.35) return
      const reach = 70 + soul.level * 150
      const distance = Phaser.Math.Distance.Between(x, y, soul.x, soul.y)
      if (distance < reach) value += (1 - distance / reach) * soul.level * 0.7
    })
    return value
  }

  private darkAt(x: number, y: number): number {
    let value = 0
    this.darks.forEach((dark) => {
      if (!dark.alive) return
      const distance = Phaser.Math.Distance.Between(x, y, dark.x, dark.y)
      if (distance < dark.radius) value += 1 - distance / dark.radius
    })
    return value
  }

  private addSouls(entries: Array<[number, number, ('beyond' | 'closed')?]>): void {
    entries.forEach(([x, y, kind]) => {
      this.souls.push({
        x, y, level: 0, kindled: false, gone: false,
        beyond: kind === 'beyond', closed: kind === 'closed',
      })
    })
  }

  private addDark(x: number, y: number, radius: number): void {
    this.darks.push({ x, y, radius, alive: true })
  }

  private updatePhase(): void {
    const scale = this.timeScale()
    const local = this.elapsedMs - this.phaseStartedAt
    if (this.phase === 0) {
      if (this.goal.reached || this.elapsedMs >= 11_000 * scale) this.enterPhase(1)
      return
    }
    if (this.phase === 1) {
      if (local >= 17_000 * scale) this.enterPhase(2)
      return
    }
    if (this.phase === 2) {
      this.runResistances(local, scale)
      if (local >= 23_000 * scale) this.enterPhase(3)
      return
    }
    if (this.phase === 3) {
      if (local >= 14_000 * scale) this.enterPhase(4)
      return
    }
    if (this.phase === 4 && local >= 14_000 * scale) this.finishLevel()
  }

  private enterPhase(next: number): void {
    this.phase = next
    this.phaseStartedAt = this.elapsedMs
    if (next === 1) {
      this.goal.relabel('Entzündet', KINDLE_TARGET)
      this.goal.setValue(0)
      this.addSouls([[520, 380], [1_260, 640], [860, 850], [1_500, 330]])
      this.services.ui.setInstruction('Geh hin. Dein Licht tut den Rest.')
      this.services.audio.playMotif('bond', 0.18)
    } else if (next === 2) {
      this.addDark(1_700, 880, 190)
      this.addDark(240, 240, 170)
      this.services.ui.setInstruction('Es wird dunkel an den Rändern.')
      this.services.audio.playMotif('release', 0.16)
    } else if (next === 3) {
      this.services.ui.setInstruction('Du wirst langsamer.')
      this.services.audio.playMotif('release', 0.2)
    } else if (next === 4) {
      this.velocity.set(0, 0)
      this.goal.relabel('Entzündet', Math.max(KINDLE_TARGET, this.kindledCount))
      this.goal.setValue(this.kindledCount)
      this.services.ui.setInstruction('')
      this.services.ui.setHint('')
      this.services.audio.playMotif('release', 0.34)
    }
  }

  /** Die vier Gesichter des Leids, mitten in die laufende Aufgabe hinein. */
  private runResistances(local: number, scale: number): void {
    if (this.eventIndex === 0 && local >= 3_000 * scale) {
      this.eventIndex = 1
      // Verlust: einer, der schon brannte, wird ganz genommen.
      const victim = this.souls.filter((soul) => !soul.gone && soul.kindled)
        .sort((a, b) => b.level - a.level)[0]
      if (victim) {
        victim.gone = true
        this.lostOnes += 1
        this.sparks.emit(victim.x, victim.y, 0x8fd0d8, 190, 1_000)
        this.services.audio.pulse(62, 0.09)
        this.cameras.main.shake(280, 0.0045)
        this.services.ui.setInstruction('Einer ist fort.')
      }
      return
    }
    if (this.eventIndex === 1 && local >= 8_500 * scale) {
      this.eventIndex = 2
      // Endlichkeit: zwei Seiten zugleich. Du hast nur einen Körper.
      this.addSouls([[330, 780], [1_620, 400]])
      this.addDark(300, 820, 200)
      this.addDark(1_660, 360, 200)
      this.services.ui.setInstruction('Zwei Seiten zugleich.')
      this.services.audio.pulse(88, 0.05)
      return
    }
    if (this.eventIndex === 2 && local >= 14_500 * scale) {
      this.eventIndex = 3
      // Ohnmacht: sichtbar, bedürftig, jenseits der Grenze.
      this.addSouls([[1_700, 640, 'beyond']])
      this.addDark(1_760, 660, 210)
      this.services.ui.setInstruction('Du kommst nicht hinüber.')
      return
    }
    if (this.eventIndex === 3 && local >= 19_000 * scale) {
      this.eventIndex = 4
      // Einsamkeit: einer, der nichts annehmen kann.
      this.addSouls([[960, 300, 'closed']])
      this.services.ui.setInstruction('Er nimmt nichts an.')
      this.services.audio.playMotif('release', 0.16)
    }
  }

  private updateMotes(): void {
    this.motes.forEach((mote) => {
      if (mote.taken || this.elapsedMs < mote.bornAt) return
      mote.x = Phaser.Math.Linear(mote.x, mote.toX, 0.035)
      mote.y = Phaser.Math.Linear(mote.y, mote.toY, 0.035)
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, mote.x, mote.y) > 70) return
      mote.taken = true
      this.received += 1
      this.goal.add(1)
      this.sparks.emit(this.player.x, this.player.y, palette.licht, 90, 600)
      this.services.audio.pulse(206 + this.received * 22, 0.05)
    })
  }

  private updateDarks(delta: number): void {
    const step = delta / this.timeScale()
    const frameScale = Phaser.Math.Clamp(delta / 16.667, 0.4, 2.4)
    const pressure = this.phase >= 3 ? 1.5 : 1
    this.darks.forEach((dark) => {
      if (!dark.alive) return
      // Sie zieht zu dem, was brennt — und weicht, wo das Licht stark ist.
      let bestX = dark.x
      let bestY = dark.y
      let best = -1
      this.souls.forEach((soul) => {
        if (soul.gone || soul.level < 0.2) return
        const distance = Phaser.Math.Distance.Between(dark.x, dark.y, soul.x, soul.y)
        const score = soul.level - distance / 2_600
        if (score <= best) return
        best = score
        bestX = soul.x
        bestY = soul.y
      })
      if (best > -1) {
        const angle = Phaser.Math.Angle.Between(dark.x, dark.y, bestX, bestY)
        dark.x += Math.cos(angle) * 0.55 * pressure * frameScale
        dark.y += Math.sin(angle) * 0.55 * pressure * frameScale
      }
      const light = this.lightAt(dark.x, dark.y)
      const target = light > 0.45 ? 60 : 210
      dark.radius += (target - dark.radius) * Math.min(1, step * 0.0009)
      if (dark.radius < 66 && light > 0.8) dark.alive = false
    })
  }

  private updateSouls(delta: number): void {
    const step = delta / this.timeScale()
    this.souls.forEach((soul) => {
      if (soul.gone) return
      if (soul.closed) {
        soul.level = Math.max(0, soul.level - step * 0.0004)
        return
      }
      const light = soul.beyond ? this.lightAt(soul.x, soul.y) * 0.15 : this.lightAt(soul.x, soul.y)
      const dark = this.darkAt(soul.x, soul.y)
      const change = light * 0.00052 - dark * 0.00042
      soul.level = Phaser.Math.Clamp(soul.level + change * step, 0, 1)
      if (soul.level < 1 || soul.kindled) return
      soul.kindled = true
      this.kindledCount += 1
      this.goal.setValue(this.kindledCount)
      this.sparks.emit(soul.x, soul.y, palette.licht, 150, 800)
      this.services.audio.pulse(228 + (this.kindledCount % 5) * 24, 0.055)
    })
  }

  /** Zum Schluss brennt alles wieder, was je gebrannt hat, und die Finsternis weicht ganz. */
  private updateFinalLight(): void {
    const since = this.elapsedMs - this.phaseStartedAt
    const everKindled = this.souls.filter((soul) => soul.kindled)
    const shouldBe = Phaser.Math.Clamp(Math.floor(since / (1_300 * this.timeScale())), 0, everKindled.length)
    while (this.relit < shouldBe) {
      const soul = everKindled[this.relit]
      this.relit += 1
      soul.gone = false
      soul.level = 1
      this.sparks.emit(soul.x, soul.y, palette.licht, 220, 1_500)
      this.services.audio.pulse(198 + this.relit * 16, 0.05)
    }
    this.darks.forEach((dark) => {
      dark.radius = Math.max(0, dark.radius - 2.4)
      if (dark.radius < 10) dark.alive = false
    })
  }

  private updateControl(delta: number): void {
    const input = this.inputManager.getVector(this.player.x, this.player.y)
    const frameScale = Phaser.Math.Clamp(delta / 16.667, 0.4, 2.4)
    // Was nachlässt, ist der Körper — nicht das Licht.
    const frailty = this.phase >= 3
      ? Phaser.Math.Clamp((this.elapsedMs - this.phaseStartedAt) / (14_000 * this.timeScale()), 0, 1)
      : 0
    if (input.active && this.phase < 4) {
      const power = Phaser.Math.Linear(0.82, 0.24, frailty)
      this.velocity.x += input.x * power * frameScale
      this.velocity.y += input.y * power * frameScale
      const direction: Direction = input.x < -0.2 ? 'left' : input.x > 0.2 ? 'right' : 'center'
      this.services.telemetry.recordDirection(direction)
    }
    const maxSpeed = this.phase >= 4 ? 0.9 : Phaser.Math.Linear(7.6, 2.2, frailty)
    this.velocity.scale(Math.pow(input.active ? 0.93 : 0.86, frameScale)).limit(maxSpeed)
    this.player.x = Phaser.Math.Clamp(this.player.x + this.velocity.x * frameScale, 150, GAME_WIDTH - 150)
    this.player.y = Phaser.Math.Clamp(this.player.y + this.velocity.y * frameScale, 200, GAME_HEIGHT - 180)

    if (this.eventIndex >= 3 && this.phase < 4 && this.player.x > BARRIER_X) {
      this.player.x = BARRIER_X
      this.velocity.x = Math.min(0, this.velocity.x)
    }

    this.sampleClock += delta
    if (this.sampleClock >= 120) {
      this.services.telemetry.sample((this.player.x - 960) / 680, this.velocity.length() / 8, this.kindledCount > 0, this.sampleClock)
      this.sampleClock = 0
    }
  }

  private drawWorld(time: number): void {
    const g = this.graphics
    const growth = this.phase >= 4
      ? Phaser.Math.Clamp((this.elapsedMs - this.phaseStartedAt) / (14_000 * this.timeScale()), 0, 1)
      : 0
    g.clear()
    ground(
      g,
      Phaser.Display.Color.GetColor(Math.round(13 + growth * 44), Math.round(13 + growth * 40), Math.round(20 + growth * 32)),
      Phaser.Display.Color.GetColor(Math.round(20 + growth * 46), Math.round(17 + growth * 40), Math.round(22 + growth * 32)),
    )
    dust(g, time, 38, 0xd6d2e0, 0.008)

    this.darks.forEach((dark) => {
      if (!dark.alive || dark.radius < 4) return
      g.fillStyle(0x000000, 0.5)
      g.fillCircle(dark.x, dark.y, dark.radius * 0.9)
      for (let ring = 0; ring < 2; ring += 1) {
        const phase = time * (0.0005 + ring * 0.0002) + dark.x
        g.lineStyle(2.4 - ring, 0x3d3550, 0.4 - ring * 0.14)
        g.beginPath()
        g.arc(dark.x, dark.y, dark.radius * (0.72 + ring * 0.2), phase, phase + Math.PI * 1.1, false)
        g.strokePath()
      }
    })

    if (this.eventIndex >= 3 && this.phase < 4) {
      for (let index = 0; index < 24; index += 1) {
        const y = 190 + index * 36
        g.lineStyle(2, 0x6f6a86, 0.18 + Math.sin(time * 0.001 + index) * 0.05)
        g.lineBetween(BARRIER_X + 34, y, BARRIER_X + 62, y + 20)
      }
    }

    if (this.phase === 0) {
      this.motes.forEach((mote) => {
        if (mote.taken || this.elapsedMs < mote.bornAt) return
        glow(g, mote.x, mote.y, 100, palette.licht, 0.32)
        g.fillStyle(0xfff4d8, 0.95)
        g.fillCircle(mote.x, mote.y, 7)
      })
    }

    this.souls.forEach((soul) => {
      if (soul.gone) return
      const colour = soul.level > 0.9 ? palette.licht : soul.beyond ? 0xb59ad8 : soul.closed ? 0x8b8b96 : 0x8fd0d8
      glow(g, soul.x, soul.y, 70 + soul.level * 170, colour, 0.08 + soul.level * 0.32)
      g.lineStyle(6, 0x211d26, 0.6)
      g.strokeCircle(soul.x, soul.y, 44)
      g.lineStyle(6, colour, 0.9)
      g.beginPath()
      g.arc(soul.x, soul.y, 44, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * soul.level, false)
      g.strokePath()
      g.fillStyle(soul.level > 0.9 ? 0xfff6dd : 0xdff4f6, 0.3 + soul.level * 0.6)
      g.fillCircle(soul.x, soul.y, 10)
      if (soul.level < 0.3 && this.phase < 4 && !soul.closed) {
        g.lineStyle(2, colour, 0.16 + Math.sin(time * 0.006 + soul.y) * 0.1)
        g.strokeCircle(soul.x, soul.y, 68 + Math.sin(time * 0.003 + soul.y) * 9)
      }
    })

    if (this.phase >= 4) {
      const radius = 280 + growth * 1_600
      glow(g, LIGHT_X, LIGHT_Y, radius, palette.licht, 0.2 + growth * 0.34, 14)
      glow(g, LIGHT_X, LIGHT_Y, radius * 0.34, 0xfff8e4, 0.26 + growth * 0.36, 12)
      g.fillStyle(0xfffdf2, 0.8)
      g.fillCircle(LIGHT_X, LIGHT_Y, 20 + growth * 30)
    }

    this.sparks.draw(g)

    // Der eigene Schein — die sichtbare Belohnung fürs Weitergeben.
    if (this.phase < 4) {
      const own = this.radius()
      glow(g, this.player.x, this.player.y, own, palette.licht, 0.13)
      g.lineStyle(2, 0xe6d6a4, 0.26)
      g.strokeCircle(this.player.x, this.player.y, own)
    }
    self(g, this.player.x, this.player.y, time, 1, this.phase >= 4 ? 0.6 : 1)

    vignette(g, 0.36 * (1 - growth * 0.7))
    if (growth > 0.66) {
      const wash = Phaser.Math.Clamp((growth - 0.66) / 0.34, 0, 1)
      g.fillStyle(0xfffdf4, Math.pow(wash, 2.2) * 0.97)
      g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
    }
  }
}

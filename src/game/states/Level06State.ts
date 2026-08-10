import Phaser from 'phaser'
import { ObjectiveHud } from '../components/ObjectiveHud'
import { GAME_HEIGHT, GAME_WIDTH } from '../config/gameConfig'
import { levels } from '../config/levels'
import { GoalTracker } from '../systems/GoalTracker'
import type { AssistanceLevel, Direction, LevelResult } from '../types'
import { TimedLevelScene } from './TimedLevelScene'
import { dust, glow, ground, palette, self, Sparks, vignette } from '../visuals'

interface Recipient {
  x: number
  y: number
  /** Wie hell dieses Gegenüber gerade ist, 0 bis 1. */
  level: number
  /** Einmal voll — bleibt dann hell und fällt nicht zurück. */
  completed: boolean
  /** Fortgenommen: die Station „Verlust". */
  gone: boolean
  /** Hinter der Grenze: die Station „Ohnmacht". */
  beyond: boolean
  /** Ob es je Licht von dir bekommen hat. Entscheidet über das Schlussbild. */
  touched: boolean
  bornAt: number
  litAt: number
}

interface Mote {
  x: number
  y: number
  toX: number
  toY: number
  bornAt: number
  travelMs: number
  taken: boolean
}

const GIVE_TARGET = 9
const BARRIER_X = 1_430
const LIGHT_X = 960
const LIGHT_Y = 540

/**
 * Lass los · „Weitergeben".
 *
 * Der frühere Entwurf machte das Leid selbst zur Aufgabe. Das kann nicht funktionieren: Wäre das
 * Verhindern die Aufgabe, wäre jedes Leid ein Versagen der spielenden Person — genau das, was
 * dieses Spiel nicht behaupten darf. Und weil sich nichts verhindern liess, gab es am Ende gar
 * nichts zu tun.
 *
 * Deshalb ist die Aufgabe jetzt eine andere, und das Leid **stört** dabei:
 *
 * Du hast endliches Licht. Andere brauchen welches. Berühren überträgt, Geben kostet dich, der
 * Vorrat erholt sich nur langsam. Daraus entstehen echte Entscheidungen — wen, wie viel, wann, in
 * welcher Reihenfolge — und eine Fertigkeit, die man besser oder schlechter beherrschen kann.
 *
 * Die vier Gesichter des Leids brechen in diese laufende Aufgabe hinein: Verlust nimmt einen mitsamt
 * dem, was man investiert hat. Schuld lässt zwei zugleich rufen, die weit auseinanderliegen.
 * Ohnmacht zeigt einen hinter einer Grenze. Einsamkeit heisst: eine Strecke lang nimmt niemand an.
 *
 * Gezählt wird, **was du weggegeben hast** — nicht, wie viele am Ende noch brennen. Wer sich
 * verausgabt und trotzdem alle verliert, steht hoch da. Am Ende entzündet sich jedes Licht wieder,
 * das du je berührt hast, auch die erloschenen.
 */
export class Level06State extends TimedLevelScene {
  private graphics!: Phaser.GameObjects.Graphics
  private player = new Phaser.Math.Vector2(960, 620)
  private velocity = new Phaser.Math.Vector2()
  private reserve = 0
  private capacity = 1
  private recipients: Recipient[] = []
  private motes: Mote[] = []
  private phase = 0
  private phaseStartedAt = 0
  private eventIndex = 0
  private lonelyUntil = -1
  private given = 0
  private lostOnes = 0
  private spentTotal = 0
  private kindled = 0
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
    this.reserve = 0
    this.capacity = 1
    this.recipients = []
    this.motes = []
    this.phase = 0
    this.phaseStartedAt = 0
    this.eventIndex = 0
    this.lonelyUntil = -1
    this.given = 0
    this.lostOnes = 0
    this.spentTotal = 0
    this.kindled = 0
    this.sampleClock = 0
    this.sparks = new Sparks()
    this.graphics = this.add.graphics()
    this.objectiveHud = new ObjectiveHud(this)
    this.goal = new GoalTracker(this.objectiveHud, {
      label: 'Empfangen', target: 4, bufferLabel: 'Dein Licht',
    })
    this.goal.resetBuffer(0)
    this.cameras.main.setBackgroundColor(0x070709)
    this.beginTimedLevel('Level06', levels.level06, 'AUSSCHNITT · 06', 'Nimm auf, was zu dir kommt.', 'release', {
      goal: 'Du hast Licht, das dir gegeben wurde. Gib es weiter, solange du kannst.',
      controls: 'WASD / Pfeiltasten · Maus oder Berührung',
    })
    this.spawnMotes()
  }

  update(time: number, delta: number): void {
    if (this.finished) return
    const progress = this.advanceLevel(delta)
    if (this.finished || progress < 0) return
    this.goal.advance(delta)
    this.updatePhase(delta)
    this.updateControl(delta)
    if (this.phase === 0) this.updateMotes(delta)
    else if (this.phase < 4) this.updateGiving(delta)
    else this.updateKindling()
    this.goal.resetBuffer(this.reserve)
    this.drawWorld(time)
  }

  protected applyHint(level: AssistanceLevel): void {
    this.services.setAssistance(level)
    if (level === 1) this.services.ui.setHint('Berühren überträgt. Es reicht nie für alle.')
    if (level === 2) this.services.ui.setHint('Wer schon voll ist, bleibt hell. Kümmere dich um die schwachen.')
    if (level === 3) this.services.ui.setHint('Dein Licht füllt sich schneller nach.')
  }

  protected collectResult(): LevelResult {
    return {
      choices: { released: this.phase >= 4, heldOn: this.reserve > 0.4 },
      metrics: {
        given: this.given,
        giveTarget: GIVE_TARGET,
        spentTotal: this.spentTotal,
        lostOnes: this.lostOnes,
        kindled: this.kindled,
        touched: this.recipients.filter((entry) => entry.touched).length,
        gradeScore: this.given >= GIVE_TARGET ? 2 : this.given >= GIVE_TARGET * 0.55 ? 1 : 0,
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

  private reach(): number {
    const assist = this.hintManager.getLevel() >= 2 ? 16 : 0
    return (this.phase >= 3 ? Phaser.Math.Linear(92, 54, this.decay()) : 92) + assist
  }

  /** 0 bis 1, wie weit der eigene Abbau fortgeschritten ist. */
  private decay(): number {
    if (this.phase < 3) return 0
    if (this.phase >= 4) return 1
    return Phaser.Math.Clamp((this.elapsedMs - this.phaseStartedAt) / (15_000 * this.timeScale()), 0, 1)
  }

  private spawnMotes(): void {
    const targets = [[700, 430], [1_180, 700], [820, 780], [1_150, 400]]
    this.motes = targets.map(([x, y], index) => ({
      x: index % 2 === 0 ? -120 : GAME_WIDTH + 120,
      y: 200 + index * 190,
      toX: x,
      toY: y,
      bornAt: 1_200 * index * this.timeScale(),
      travelMs: 2_600 * this.timeScale(),
      taken: false,
    }))
  }

  private addRecipients(entries: Array<[number, number, boolean?]>): void {
    entries.forEach(([x, y, beyond]) => {
      this.recipients.push({
        x, y, level: 0, completed: false, gone: false, beyond: Boolean(beyond),
        touched: false, bornAt: this.elapsedMs, litAt: -1,
      })
    })
  }

  private updatePhase(delta: number): void {
    const scale = this.timeScale()
    const local = this.elapsedMs - this.phaseStartedAt

    if (this.phase === 0) {
      if (this.goal.reached || this.elapsedMs >= 13_000 * scale) this.enterPhase(1)
      return
    }
    if (this.phase === 1) {
      if (local >= 19_000 * scale) this.enterPhase(2)
      return
    }
    if (this.phase === 2) {
      this.runResistances(local, scale)
      if (local >= 31_000 * scale) this.enterPhase(3)
      return
    }
    if (this.phase === 3) {
      this.capacity = Phaser.Math.Linear(1, 0.4, this.decay())
      this.reserve = Math.min(this.reserve, this.capacity)
      if (local >= 15_000 * scale) this.enterPhase(4)
      return
    }
    if (this.phase === 4 && local >= 16_000 * scale) this.finishLevel()
    void delta
  }

  /** Die vier Gesichter des Leids, mitten in die laufende Aufgabe hinein. */
  private runResistances(local: number, scale: number): void {
    if (this.eventIndex === 0 && local >= 2_500 * scale) {
      // Verlust: einer, in den man schon investiert hat, wird fortgenommen.
      this.eventIndex = 1
      const victim = [...this.recipients]
        .filter((entry) => !entry.gone && !entry.completed && entry.touched)
        .sort((a, b) => b.level - a.level)[0] ?? this.recipients.find((entry) => !entry.gone)
      if (victim) {
        victim.gone = true
        this.lostOnes += 1
        this.sparks.emit(victim.x, victim.y, 0x8fd0d8, 160, 900)
        this.services.audio.pulse(64, 0.08)
        this.cameras.main.shake(260, 0.004)
      }
      this.services.ui.setInstruction('Er ist fort.')
      return
    }
    if (this.eventIndex === 1 && local >= 10_000 * scale) {
      // Schuld: zwei zugleich, weit auseinander. Einer bleibt liegen.
      this.eventIndex = 2
      this.addRecipients([[320, 340], [1_600, 800]])
      this.services.ui.setInstruction('Zwei zugleich.')
      this.services.audio.playMotif('care', 0.16)
      return
    }
    if (this.eventIndex === 2 && local >= 18_000 * scale) {
      // Ohnmacht: sichtbar, bedürftig, unerreichbar.
      this.eventIndex = 3
      this.addRecipients([[1_690, 420, true]])
      this.services.ui.setInstruction('Du kommst nicht hinüber.')
      this.services.audio.pulse(88, 0.05)
      return
    }
    if (this.eventIndex === 3 && local >= 24_500 * scale) {
      // Einsamkeit: eine Strecke lang nimmt niemand etwas an.
      this.eventIndex = 4
      this.lonelyUntil = this.elapsedMs + 7_000 * scale
      this.services.ui.setInstruction('Es nimmt gerade niemand.')
      this.services.audio.playMotif('release', 0.16)
    }
  }

  private enterPhase(next: number): void {
    this.phase = next
    this.phaseStartedAt = this.elapsedMs
    const scale = this.timeScale()
    if (next === 1) {
      this.goal.relabel('Weitergegeben', GIVE_TARGET)
      this.goal.setValue(0)
      this.addRecipients([[560, 400], [1_320, 620], [880, 820]])
      this.services.ui.setInstruction('Gib weiter.')
      this.services.audio.playMotif('bond', 0.18)
    } else if (next === 2) {
      this.services.ui.setInstruction('Gib weiter.')
    } else if (next === 3) {
      this.services.ui.setInstruction('Es wird weniger.')
      this.services.audio.playMotif('release', 0.2)
    } else if (next === 4) {
      this.reserve = 0
      this.velocity.set(0, 0)
      this.goal.relabel('Weitergegeben', Math.max(GIVE_TARGET, this.given))
      this.goal.setValue(this.given)
      this.services.ui.setInstruction('')
      this.services.ui.setHint('')
      this.services.audio.playMotif('release', 0.34)
      void scale
    }
  }

  private updateMotes(delta: number): void {
    this.motes.forEach((mote) => {
      if (mote.taken || this.elapsedMs < mote.bornAt) return
      const local = Phaser.Math.Clamp((this.elapsedMs - mote.bornAt) / mote.travelMs, 0, 1)
      mote.x = Phaser.Math.Linear(mote.x, mote.toX, 0.04)
      mote.y = Phaser.Math.Linear(mote.y, mote.toY, 0.04)
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, mote.x, mote.y) > this.reach()) return
      mote.taken = true
      this.reserve = Math.min(this.capacity, this.reserve + 0.3)
      this.sparks.emit(this.player.x, this.player.y, palette.licht, 80, 560)
      this.services.audio.pulse(210 + this.goal.value * 20, 0.05)
      this.goal.add(1)
      void local
    })
    void delta
  }

  private updateGiving(delta: number): void {
    const scale = this.timeScale()
    const step = delta / scale
    const lonely = this.lonelyUntil > 0 && this.elapsedMs < this.lonelyUntil

    // Man empfängt weiter, nur langsam. Niemand lebt aus sich selbst.
    const refill = this.hintManager.getLevel() >= 3 ? 0.000075 : 0.000045
    this.reserve = Math.min(this.capacity, this.reserve + step * refill)

    this.recipients.forEach((entry) => {
      if (entry.gone) return
      if (!entry.completed) entry.level = Math.max(0, entry.level - step * 0.000042)
      if (entry.completed || entry.beyond || lonely) return
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, entry.x, entry.y)
      if (distance > this.reach() || this.reserve <= 0.002) return
      const amount = Math.min(this.reserve, step * 0.00055)
      this.reserve -= amount
      this.spentTotal += amount
      entry.level = Math.min(1, entry.level + amount * 1.45)
      entry.touched = true
      if (entry.level < 1) return
      entry.completed = true
      entry.litAt = this.elapsedMs
      this.given += 1
      this.goal.setValue(this.given)
      this.sparks.emit(entry.x, entry.y, palette.licht, 130, 700)
      this.services.audio.pulse(232 + (this.given % 5) * 22, 0.055)
    })
  }

  /** Im Schluss entzündet sich alles wieder, was je Licht von dir bekommen hat. */
  private updateKindling(): void {
    const since = this.elapsedMs - this.phaseStartedAt
    const touched = this.recipients.filter((entry) => entry.touched)
    const shouldBe = Phaser.Math.Clamp(Math.floor(since / (1_500 * this.timeScale())), 0, touched.length)
    while (this.kindled < shouldBe) {
      const entry = touched[this.kindled]
      this.kindled += 1
      entry.gone = false
      entry.level = 1
      this.sparks.emit(entry.x, entry.y, palette.licht, 200, 1_400)
      this.services.audio.pulse(200 + this.kindled * 18, 0.05)
    }
  }

  private updateControl(delta: number): void {
    const input = this.inputManager.getVector(this.player.x, this.player.y)
    const frameScale = Phaser.Math.Clamp(delta / 16.667, 0.4, 2.4)
    if (input.active) {
      this.velocity.x += input.x * Phaser.Math.Linear(0.78, 0.3, this.decay()) * frameScale
      this.velocity.y += input.y * Phaser.Math.Linear(0.78, 0.3, this.decay()) * frameScale
      const direction: Direction = input.x < -0.2 ? 'left' : input.x > 0.2 ? 'right' : 'center'
      this.services.telemetry.recordDirection(direction)
    }
    const maxSpeed = this.phase >= 4 ? 1.4 : Phaser.Math.Linear(7.4, 2.6, this.decay())
    this.velocity.scale(Math.pow(input.active ? 0.92 : 0.86, frameScale)).limit(maxSpeed)
    this.player.x = Phaser.Math.Clamp(this.player.x + this.velocity.x * frameScale, 150, GAME_WIDTH - 150)
    this.player.y = Phaser.Math.Clamp(this.player.y + this.velocity.y * frameScale, 200, GAME_HEIGHT - 180)

    // Die Grenze der Ohnmacht: sichtbar, aber nicht zu überschreiten.
    if (this.eventIndex >= 3 && this.phase < 4 && this.player.x > BARRIER_X) {
      this.player.x = BARRIER_X
      this.velocity.x = Math.min(0, this.velocity.x)
    }

    this.sampleClock += delta
    if (this.sampleClock >= 120) {
      this.services.telemetry.sample((this.player.x - 960) / 680, this.velocity.length() / 8, this.reserve > 0.3, this.sampleClock)
      this.sampleClock = 0
    }
  }

  private drawWorld(time: number): void {
    const g = this.graphics
    const growth = this.phase >= 4
      ? Phaser.Math.Clamp((this.elapsedMs - this.phaseStartedAt) / (16_000 * this.timeScale()), 0, 1)
      : 0
    g.clear()
    ground(
      g,
      Phaser.Display.Color.GetColor(Math.round(13 + growth * 44), Math.round(13 + growth * 40), Math.round(20 + growth * 32)),
      Phaser.Display.Color.GetColor(Math.round(20 + growth * 46), Math.round(17 + growth * 40), Math.round(22 + growth * 32)),
    )
    dust(g, time, 42, 0xd6d2e0, 0.008)

    if (this.eventIndex >= 3 && this.phase < 4) this.drawBarrier(g, time)
    if (this.phase === 0) this.drawMotes(g)
    this.drawRecipients(g, time)
    if (this.phase >= 4) this.drawLight(g, time, growth)
    this.sparks.draw(g)
    this.drawSelf(g, time)

    const lonely = this.lonelyUntil > 0 && this.elapsedMs < this.lonelyUntil && this.phase < 4
    if (lonely) {
      g.lineStyle(2, 0x9aa39c, 0.18 + Math.sin(time * 0.004) * 0.06)
      g.strokeCircle(this.player.x, this.player.y, this.reach() + 26)
    }

    vignette(g, 0.36 * (1 - growth * 0.7))
    if (growth > 0.66) {
      const wash = Phaser.Math.Clamp((growth - 0.66) / 0.34, 0, 1)
      g.fillStyle(0xfffdf4, Math.pow(wash, 2.2) * 0.97)
      g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
    }
  }

  private drawMotes(g: Phaser.GameObjects.Graphics): void {
    this.motes.forEach((mote) => {
      if (mote.taken || this.elapsedMs < mote.bornAt) return
      glow(g, mote.x, mote.y, 90, palette.licht, 0.3)
      g.fillStyle(0xfff4d8, 0.95)
      g.fillCircle(mote.x, mote.y, 7)
    })
  }

  private drawRecipients(g: Phaser.GameObjects.Graphics, time: number): void {
    this.recipients.forEach((entry) => {
      if (entry.gone) return
      const colour = entry.completed ? palette.licht : entry.beyond ? 0xb59ad8 : 0x8fd0d8
      const pulse = 1 + Math.sin(time * 0.003 + entry.x) * 0.1
      glow(g, entry.x, entry.y, (60 + entry.level * 130) * pulse, colour, 0.1 + entry.level * 0.3)
      g.lineStyle(6, 0x211d26, 0.6)
      g.strokeCircle(entry.x, entry.y, 46)
      g.lineStyle(6, colour, 0.9)
      g.beginPath()
      g.arc(entry.x, entry.y, 46, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * entry.level, false)
      g.strokePath()
      g.fillStyle(entry.completed ? 0xfff6dd : 0xdff4f6, 0.35 + entry.level * 0.6)
      g.fillCircle(entry.x, entry.y, 10)
      // Wer noch nichts hat und schwach wird, ruft sichtbar.
      if (!entry.completed && entry.level < 0.25 && this.phase < 4) {
        g.lineStyle(2, colour, 0.16 + Math.sin(time * 0.006 + entry.y) * 0.1)
        g.strokeCircle(entry.x, entry.y, 70 + Math.sin(time * 0.003 + entry.y) * 9)
      }
    })
  }

  private drawBarrier(g: Phaser.GameObjects.Graphics, time: number): void {
    for (let index = 0; index < 24; index += 1) {
      const y = 190 + index * 36
      g.lineStyle(2, 0x6f6a86, 0.18 + Math.sin(time * 0.001 + index) * 0.05)
      g.lineBetween(BARRIER_X + 34, y, BARRIER_X + 62, y + 20)
    }
  }

  private drawLight(g: Phaser.GameObjects.Graphics, time: number, growth: number): void {
    const radius = 260 + growth * 1_600
    glow(g, LIGHT_X, LIGHT_Y, radius, palette.licht, 0.2 + growth * 0.34, 14)
    glow(g, LIGHT_X, LIGHT_Y, radius * 0.34, 0xfff8e4, 0.26 + growth * 0.36, 12)
    g.fillStyle(0xfffdf2, 0.8)
    g.fillCircle(LIGHT_X, LIGHT_Y, 18 + Math.sin(time * 0.0015) * 3 + growth * 30)
  }

  private drawSelf(g: Phaser.GameObjects.Graphics, time: number): void {
    const strength = this.phase >= 4 ? 0.55 : 0.4 + this.reserve * 0.6
    self(g, this.player.x, this.player.y, time, 1 - this.decay() * 0.2, strength)
    // Der eigene Vorrat als Ring an der Gestalt — er ist die eigentliche Ressource.
    if (this.phase >= 1 && this.phase < 4) {
      g.lineStyle(5, palette.licht, 0.22 + this.reserve * 0.5)
      g.beginPath()
      g.arc(this.player.x, this.player.y, 26, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * this.reserve, false)
      g.strokePath()
      g.lineStyle(2, 0xd8cfa8, 0.22)
      g.strokeCircle(this.player.x, this.player.y, this.reach())
    }
  }
}

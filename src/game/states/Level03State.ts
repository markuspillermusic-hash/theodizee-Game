import Phaser from 'phaser'
import { ObjectiveHud } from '../components/ObjectiveHud'
import { GAME_HEIGHT, GAME_WIDTH } from '../config/gameConfig'
import { levels } from '../config/levels'
import { GoalTracker } from '../systems/GoalTracker'
import type { AssistanceLevel, Direction, LevelResult } from '../types'
import { TimedLevelScene } from './TimedLevelScene'
import { dust, glow, glowEllipse, ground, palette, self as drawSelf, Sparks, vignette } from '../visuals'

type Trail = 'warm' | 'cool'

interface Cub {
  x: number
  y: number
  homeX: number
  homeY: number
  need: number
  eating: number
  phase: number
}

interface Rival {
  x: number
  y: number
  /** Ab wann es zupackt. Bis dahin kann man es vertreiben. */
  grabAt: number
  /** Treffer, die es noch braucht. Einer reicht nicht — das ist der Unterschied zum Knopfdruck. */
  bite: number
  /** Millisekunden, in denen es zurückweicht und nicht zupacken kann. */
  stagger: number
  hitFlash: number
  fleeing: boolean
}

const CARGO_START = 10
const STAGE_TARGET = 10
const DEN_X = 300
const KILL_X = 1_700
const FENCE_X = 1_420
/** Schlagweite. */
const REACH = 235
/**
 * Abstand, auf den ein Gegner herangeht. Deutlich kleiner als die Schlagweite — sonst bleibt er
 * genau an deren Rand stehen, und jeder Hieb geht knapp daneben, obwohl er „heran" aussieht.
 */
const CLOSE = 126
const GRAB_MS = 1_500
const WAVE_INTERVAL_MS = 3_300
const HUNGER_RATE = 0.000015

/** Sperre nach einem Hieb. Ohne sie wäre Leertaste-Hämmern die beste Strategie. */
const SWING_LOCK_MS = 300
/** Sperre nach einem Schlag ins Leere. Länger — ein Fehlschlag bringt aus dem Tritt. */
const WHIFF_LOCK_MS = 520
const SWING_COST = 0.032
const WHIFF_COST = 0.07
const GRAB_COST = 0.11
/** Kraft kommt zwischen den Wellen etwas zurück, aber nie ganz. Es kostet sie. */
const RECOVER_RATE = 0.000045
const RECOVER_CEILING = 0.82

/**
 * Versorge · „Heimbringen".
 *
 * Drei Junge am Bau, jedes mit eigenem Hunger, der sichtbar sinkt. Man schleppt die Beute heim, sie
 * fressen davon, die Balken steigen — und sinken gleich wieder. Deshalb muss man noch einmal los.
 * Das ist der Kreislauf, den dieser Abschnitt spielt.
 *
 * Unterwegs kommen Konkurrenten. **Verteidigt wird mit der Leertaste**, nicht mit Stehenbleiben:
 * Wer nicht rechtzeitig reagiert, verliert ein Stück. Eine frühere Fassung liess sich einfach
 * durchlaufen — man konnte die Angreifer ignorieren, und die Entscheidung war keine.
 *
 * Seit dem 11.08. ist die Abwehr ein **Kampf** und kein Knopfdruck: Jeder Gegner braucht zwei bis
 * drei Treffer, nach jedem Hieb ist man kurz gesperrt, und ein Schlag ins Leere kostet Kraft und
 * bringt aus dem Tritt. Kraft macht schneller, weitreichender und gibt mehr Zeit zum Reagieren —
 * wer sie im Leerlauf verschleudert, kämpft den Rest des Weges schlechter. Hämmern nützt deshalb
 * nichts, Zuschlagen im richtigen Moment schon.
 *
 * Der zweite Gang führt über einen Zaun. Dahinter liegt das Nächste, und man fragt nicht, was es
 * ist. Dort kommen zum ersten Mal Menschen im Spiel vor.
 */
export class Level03State extends TimedLevelScene {
  private graphics!: Phaser.GameObjects.Graphics
  private player = new Phaser.Math.Vector2(KILL_X, 560)
  private velocity = new Phaser.Math.Vector2()
  private cargo = CARGO_START
  private droppedAt: Array<{ x: number; y: number }> = []
  private cubs: Cub[] = []
  private rivals: Rival[] = []
  private waveAt = 4_200
  private waveIndex = 0
  private trail: Trail | null = null
  private delivered = 0
  private fedAtDelivery = 0
  private repelled = 0
  private strength = 1
  private swingUntil = 0
  private whiffUntil = 0
  private swingAngle = 0
  private swings = 0
  private whiffs = 0
  private colourAt = 18_000
  private crossedFence = false
  private feedQueue = 0
  private nextFeedAt = 0
  private phase = 0
  private phaseStartedAt = 0
  private sampleClock = 0
  private safetyNetApplied = false
  private sparks = new Sparks()
  private objectiveHud!: ObjectiveHud
  private goal!: GoalTracker

  constructor() {
    super('Level03')
  }

  create(): void {
    this.player.set(KILL_X, 560)
    this.velocity.set(0, 0)
    this.cargo = CARGO_START
    this.droppedAt = []
    this.cubs = [
      { x: 250, y: 470, homeX: 250, homeY: 470, need: 0.44, eating: 0, phase: 0.4 },
      { x: 330, y: 585, homeX: 330, homeY: 585, need: 0.32, eating: 0, phase: 2.1 },
      { x: 245, y: 700, homeX: 245, homeY: 700, need: 0.52, eating: 0, phase: 4.0 },
    ]
    this.rivals = []
    this.waveAt = 2_400
    this.waveIndex = 0
    this.trail = null
    this.delivered = 0
    this.fedAtDelivery = 0
    this.repelled = 0
    this.strength = 1
    this.swingUntil = 0
    this.whiffUntil = 0
    this.swingAngle = 0
    this.swings = 0
    this.whiffs = 0
    this.colourAt = 18_000
    this.crossedFence = false
    this.feedQueue = 0
    this.nextFeedAt = 0
    this.phase = 0
    this.phaseStartedAt = 0
    this.sampleClock = 0
    this.safetyNetApplied = false
    this.sparks = new Sparks()
    this.graphics = this.add.graphics()
    this.objectiveHud = new ObjectiveHud(this)
    this.goal = new GoalTracker(this.objectiveHud, {
      label: 'Heimweg', target: STAGE_TARGET, bufferLabel: 'Last',
    })
    this.objectiveHud.setSecondary('Sie', this.averageNeed())
    this.cameras.main.setBackgroundColor(0x0b0a08)
    this.beginTimedLevel('Level03', levels.level03, 'AUSSCHNITT · 03', 'Zieh sie nach Hause.', 'care', {
      goal: 'Drei warten und werden schwächer. Zieh die Beute heim — und schlag die Konkurrenten mit der '
        + 'Leertaste zurück. Einer braucht mehrere Treffer, und jeder Schlag ins Leere kostet Kraft.',
      controls: 'WASD / Pfeiltasten · Leertaste: zuschlagen',
    })
  }

  update(time: number, delta: number): void {
    if (this.finished) return
    const progress = this.advanceLevel(delta)
    if (this.finished || progress < 0) return
    this.goal.advance(delta)
    this.applySafetyNet()
    this.updateCubs(delta, time)
    this.updatePhase(delta)
    this.updatePlayer(delta)
    if (this.phase === 0) {
      this.updateRivals(delta)
      this.updateProgress()
    }
    this.objectiveHud.setSecondary('Sie', this.averageNeed())
    this.applyColour()
    this.sample(delta)
    this.drawWorld(time)
  }

  /**
   * Erschöpfung hört man: Je weniger Kraft, desto dumpfer die ganze Szene. Am Bau geht sie wieder
   * auf. Das kostet nichts und trägt mehr als jede Anzeige.
   */
  private applyColour(): void {
    const target = this.phase === 0 ? Math.round(Phaser.Math.Linear(1_900, 18_000, this.strength)) : 18_000
    if (Math.abs(target - this.colourAt) < 600) return
    this.colourAt = target
    this.services.audio.setColour(target, 1.2)
  }

  protected applyHint(level: AssistanceLevel): void {
    this.services.setAssistance(level)
    if (level === 1) this.services.ui.setHint('Leertaste, sobald einer heran ist. Nicht ins Leere schlagen.')
    if (level === 2) this.services.ui.setHint('Du hast mehr Zeit zum Reagieren.')
    if (level === 3) this.services.ui.setHint('Sie kommen seltener, und einer reicht wieder.')
  }

  /** Die Dämpfung darf nicht ins Echo mitlaufen. */
  protected afterLevelFinished(): void {
    this.services.audio.setColour(18_000, 0.8)
    super.afterLevelFinished()
  }

  protected collectResult(): LevelResult {
    const trail = this.trail ?? (this.player.y < 560 ? 'warm' : 'cool')
    return {
      choices: {
        trail,
        approach: trail === 'warm' ? 'upper' : 'lower',
        grade: this.homeGrade(),
      },
      metrics: {
        ...this.goal.metrics(this.elapsedMs, this.levelConfig.expectedDurationMs),
        delivered: this.delivered,
        cargoStart: CARGO_START,
        lostPieces: CARGO_START - this.delivered,
        repelled: this.repelled,
        swings: this.swings,
        whiffs: this.whiffs,
        strengthLeft: Math.round(this.strength * 100) / 100,
        cubNeed: this.fedAtDelivery,
        crossedFence: this.crossedFence ? 1 : 0,
      },
    }
  }

  /** Bewertet wird, was ankommt — und wie satt sie danach sind. */
  private homeGrade(): 'knapp' | 'solide' | 'stark' {
    const score = this.delivered / CARGO_START * 0.6 + this.fedAtDelivery * 0.4
    if (score >= 0.82) return 'stark'
    if (score >= 0.58) return 'solide'
    return 'knapp'
  }

  private timeScale(): number {
    return this.services.getTimeScale()
  }

  private averageNeed(): number {
    return this.cubs.reduce((sum, cub) => sum + cub.need, 0) / Math.max(1, this.cubs.length)
  }

  private applySafetyNet(): void {
    if (this.safetyNetApplied || this.phase !== 0) return
    if (this.elapsedMs < this.maximumDurationMs * 0.76) return
    this.safetyNetApplied = true
    while (this.hintManager.getLevel() < 3) this.hintManager.forceNext()
  }

  /** Die Jungen bewegen sich, werden hungriger — und fressen sichtbar, wenn etwas ankommt. */
  private updateCubs(delta: number, time: number): void {
    const step = delta / this.timeScale()
    this.cubs.forEach((cub, index) => {
      const restless = 1 - cub.need
      cub.x = cub.homeX + Math.sin(time * 0.0009 + cub.phase) * (14 + restless * 26)
      cub.y = cub.homeY + Math.cos(time * 0.0011 + cub.phase * 1.6) * (10 + restless * 20)
      cub.eating = Math.max(0, cub.eating - delta)
      if (this.phase >= 3) return
      cub.need = Phaser.Math.Clamp(cub.need - step * HUNGER_RATE * (1 + index * 0.12), 0, 1)
    })

    // Die Übergabe läuft Stück für Stück, damit man sieht, dass sie fressen.
    if (this.feedQueue <= 0 || this.elapsedMs < this.nextFeedAt) return
    const hungriest = [...this.cubs].sort((a, b) => a.need - b.need)[0]
    hungriest.need = Phaser.Math.Clamp(hungriest.need + 0.13, 0, 1)
    hungriest.eating = 520 * this.timeScale()
    this.feedQueue -= 1
    this.nextFeedAt = this.elapsedMs + 340 * this.timeScale()
    this.sparks.emit(hungriest.x, hungriest.y, palette.licht, 90, 520)
    this.services.audio.pulse(206 + (this.feedQueue % 4) * 22, 0.04)
  }

  private updatePhase(delta: number): void {
    const scale = this.timeScale()
    if (this.phase === 0) {
      if (this.player.x <= DEN_X + 90) {
        this.phase = 1
        this.phaseStartedAt = this.elapsedMs
        this.delivered = this.cargo
        this.feedQueue = this.cargo
        this.nextFeedAt = this.elapsedMs + 300 * scale
        this.cargo = 0
        this.goal.setValue(STAGE_TARGET)
        this.goal.resetBuffer(0)
        this.services.ui.setInstruction('Sie fressen.')
        this.services.audio.playMotif('group', 0.2)
      }
      return
    }
    if (this.phase === 1) {
      if (this.feedQueue <= 0 && this.fedAtDelivery === 0) this.fedAtDelivery = this.averageNeed()
      if (this.feedQueue <= 0 && this.elapsedMs - this.phaseStartedAt >= 4_200 * scale) {
        this.phase = 2
        this.phaseStartedAt = this.elapsedMs
        this.goal.relabel('Nochmal', 1)
        this.goal.setValue(0)
        this.services.ui.setInstruction('Sie werden schon wieder schwächer. Geh noch einmal.')
        this.services.ui.setHint('Draußen rechts bewegt sich etwas.')
        this.services.audio.playMotif('care', 0.16)
      }
      return
    }
    if (this.phase === 2) {
      if (this.player.x >= FENCE_X + 40) {
        this.crossedFence = true
        this.phase = 3
        this.phaseStartedAt = this.elapsedMs
        this.goal.setValue(1)
        this.services.ui.setInstruction('')
        this.services.ui.setHint('')
        this.services.audio.pulse(58, 0.09)
      } else if (this.elapsedMs - this.phaseStartedAt >= 18_000 * scale) {
        this.phase = 3
        this.phaseStartedAt = this.elapsedMs
        this.services.ui.setInstruction('')
        this.services.ui.setHint('')
      }
      return
    }
    if (this.phase === 3 && this.elapsedMs - this.phaseStartedAt >= 7_000 * scale) this.finishLevel()
    void delta
  }

  private updatePlayer(delta: number): void {
    if (this.phase === 1 || this.phase >= 3) {
      this.velocity.scale(0.9)
      return
    }
    const input = this.inputManager.getVector(this.player.x, this.player.y)
    const frameScale = Phaser.Math.Clamp(delta / 16.667, 0.4, 2.4)
    const load = this.phase === 2 ? 0 : this.cargo / CARGO_START
    // Nach einem Schlag ins Leere steht man kurz. Das ist der eigentliche Preis des Hämmerns.
    const stumbling = this.elapsedMs < this.whiffUntil
    const power = Phaser.Math.Linear(0.6, 0.2, load) * (stumbling ? 0 : 1)
    if (input.active && !stumbling) {
      this.velocity.x += input.x * power * frameScale
      this.velocity.y += input.y * power * frameScale
      const direction: Direction = input.x < -0.2 ? 'left' : input.x > 0.2 ? 'right' : 'center'
      this.services.telemetry.recordDirection(direction)
    }
    const maxSpeed = Phaser.Math.Linear(4.2, 1.1, load) * Phaser.Math.Linear(0.66, 1, this.strength)
    this.velocity.scale(Math.pow(stumbling ? 0.72 : 0.89, frameScale)).limit(maxSpeed)
    const limitRight = this.phase === 2 ? FENCE_X + 60 : KILL_X
    this.player.x = Phaser.Math.Clamp(this.player.x + this.velocity.x * frameScale, DEN_X - 40, limitRight)
    this.player.y = Phaser.Math.Clamp(this.player.y + this.velocity.y * frameScale, 250, 880)
    if (!this.trail && this.player.x < 1_320) this.trail = this.player.y < 560 ? 'warm' : 'cool'
  }

  /** Kraft verkürzt oder verlängert die Zeit, die zum Reagieren bleibt. */
  private grabWindow(): number {
    const assist = this.hintManager.getLevel()
    const worn = Phaser.Math.Linear(0.62, 1, this.strength)
    return (GRAB_MS * worn + (assist >= 2 ? 700 : 0)) * this.timeScale()
  }

  /** Wer schwächer wird, kommt weniger weit. */
  private reach(): number {
    return REACH * Phaser.Math.Linear(0.74, 1, this.strength)
  }

  /** Panoramaposition eines Punktes, damit man hört, von welcher Seite es kommt. */
  private panAt(x: number): number {
    return Phaser.Math.Clamp((x - GAME_WIDTH / 2) / (GAME_WIDTH / 2), -1, 1) * 0.8
  }

  private updateRivals(delta: number): void {
    const scale = this.timeScale()
    this.waveAt -= delta / scale
    if (this.waveAt <= 0) {
      this.spawnWave()
      this.waveAt = WAVE_INTERVAL_MS * (this.hintManager.getLevel() >= 3 ? 1.5 : 1)
    }

    const frameScale = Phaser.Math.Clamp(delta / 16.667, 0.4, 2.4)
    const reach = this.reach()
    this.resolveSwing(reach)

    this.rivals.forEach((rival) => {
      rival.hitFlash = Math.max(0, rival.hitFlash - delta)
      if (rival.fleeing) {
        const away = new Phaser.Math.Vector2(rival.x - this.player.x, rival.y - this.player.y).normalize()
        rival.x += away.x * 5.2 * frameScale
        rival.y += away.y * 5.2 * frameScale
        return
      }
      // Zurückgeschlagen: Es weicht, sammelt sich und kommt wieder. Der Ring beginnt von vorn.
      if (rival.stagger > 0) {
        rival.stagger -= delta / scale
        rival.grabAt = 0
        const away = new Phaser.Math.Vector2(rival.x - this.player.x, rival.y - this.player.y).normalize()
        rival.x += away.x * 3.4 * frameScale
        rival.y += away.y * 3.4 * frameScale
        return
      }
      const toPlayer = new Phaser.Math.Vector2(this.player.x - rival.x, this.player.y - rival.y)
      const distance = toPlayer.length()
      // Wer einmal heran ist, bleibt dran und hält Schritt. Vorher setzte der Zeitring zurück,
      // sobald man weiterging — man konnte den Angreifer schlicht weglaufen lassen, und Ignorieren
      // kostete fast nichts.
      const engaged = rival.grabAt > 0 && distance < CLOSE * 3.4
      if (distance > CLOSE) {
        if (!engaged) rival.grabAt = 0
        toPlayer.normalize()
        const speed = engaged ? 4.6 : 3.9
        rival.x += toPlayer.x * speed * frameScale
        rival.y += toPlayer.y * speed * frameScale
        if (!engaged) return
      }
      if (rival.grabAt === 0) {
        rival.grabAt = this.elapsedMs + this.grabWindow()
        this.services.audio.noise({
          durationMs: 420, centreHz: 240, sweepToHz: 150, q: 3.4, intensity: 0.055,
          pan: this.panAt(rival.x), space: 0.45,
        })
      }
      if (this.elapsedMs < rival.grabAt) return
      rival.fleeing = true
      this.strength = Math.max(0.3, this.strength - GRAB_COST)
      if (this.cargo > 0) {
        this.cargo -= 1
        this.droppedAt.push({ x: this.player.x, y: this.player.y })
        this.sparks.emit(this.player.x, this.player.y, palette.gefahr, 120, 620)
        this.services.audio.thump(58, 0.17, this.panAt(this.player.x))
        this.cameras.main.shake(260, 0.006)
      }
    })

    this.rivals = this.rivals.filter(
      (rival) => rival.x > -300 && rival.x < GAME_WIDTH + 300 && rival.y > -300 && rival.y < GAME_HEIGHT + 300,
    )

    // Zwischen den Wellen kommt Kraft zurück — nie bis nach oben.
    const pressed = this.rivals.some((rival) => !rival.fleeing && rival.stagger <= 0
      && Phaser.Math.Distance.Between(rival.x, rival.y, this.player.x, this.player.y) <= CLOSE * 1.6)
    if (!pressed && this.strength < RECOVER_CEILING) {
      this.strength = Math.min(RECOVER_CEILING, this.strength + (delta / scale) * RECOVER_RATE)
    }
  }

  /**
   * Ein Hieb. Trifft er, weicht der Gegner und braucht noch einen. Trifft er ins Leere, kostet das
   * Kraft und einen Moment Halt. Während der Sperre bewirkt Drücken gar nichts — deshalb bringt
   * Hämmern nichts, sondern nur Fehlschläge.
   */
  private resolveSwing(reach: number): void {
    if (!this.inputManager.justActionDown()) return
    if (this.elapsedMs < this.swingUntil || this.elapsedMs < this.whiffUntil) return

    let target: Rival | null = null
    let best = Number.POSITIVE_INFINITY
    this.rivals.forEach((rival) => {
      if (rival.fleeing) return
      const distance = Phaser.Math.Distance.Between(rival.x, rival.y, this.player.x, this.player.y)
      if (distance > reach || distance >= best) return
      best = distance
      target = rival
    })

    if (!target) {
      this.whiffs += 1
      this.whiffUntil = this.elapsedMs + WHIFF_LOCK_MS * this.timeScale()
      this.strength = Math.max(0.3, this.strength - WHIFF_COST)
      this.velocity.scale(0.25)
      this.swingAngle = this.velocity.length() > 0.3 ? this.velocity.angle() : 0
      this.services.audio.noise({
        durationMs: 300, centreHz: 620, sweepToHz: 190, q: 0.7, intensity: 0.07,
        pan: this.panAt(this.player.x), space: 0.55,
      })
      return
    }

    const hit = target as Rival
    this.swings += 1
    this.swingUntil = this.elapsedMs + SWING_LOCK_MS * this.timeScale()
    this.strength = Math.max(0.3, this.strength - SWING_COST)
    this.swingAngle = Math.atan2(hit.y - this.player.y, hit.x - this.player.x)
    hit.bite -= 1
    hit.hitFlash = 260
    hit.stagger = 620 * this.timeScale()
    hit.grabAt = 0
    const away = new Phaser.Math.Vector2(hit.x - this.player.x, hit.y - this.player.y).normalize()
    hit.x += away.x * 54
    hit.y += away.y * 54
    this.sparks.emit(hit.x, hit.y, palette.licht, hit.bite > 0 ? 90 : 150, 520)
    const pan = this.panAt(hit.x)
    this.services.audio.thump(hit.bite > 0 ? 132 : 96, 0.11, pan)
    this.services.audio.noise({
      durationMs: 180, centreHz: 1_500, sweepToHz: 420, q: 1.1, intensity: 0.075, pan, space: 0.35,
    })
    this.cameras.main.shake(110, 0.0022)
    if (hit.bite > 0) return
    hit.fleeing = true
    this.repelled += 1
    this.services.audio.noise({
      durationMs: 560, centreHz: 380, sweepToHz: 1_400, q: 2.2, intensity: 0.06, pan, space: 0.6,
    })
  }

  private spawnWave(): void {
    // Höchstens drei gleichzeitig. Fünf, die sich alle festbeissen, sind kein Kampf mehr,
    // sondern ein Gedränge, in dem man nichts mehr unterscheidet.
    const pressing = this.rivals.filter((rival) => !rival.fleeing).length
    if (pressing >= 3) return
    this.waveIndex += 1
    const count = this.waveIndex < 3 || pressing >= 2 ? 1 : 2
    for (let index = 0; index < count; index += 1) {
      const fromTop = (this.waveIndex + index) % 2 === 0
      // Innerhalb des Bildes einsetzen: Wer ausserhalb startet, wird im selben Bild wieder
      // aussortiert - so kam die halbe Welle nie an.
      const spawnX = Phaser.Math.Clamp(this.player.x + (index % 2 === 0 ? -430 : 470), 60, GAME_WIDTH - 60)
      this.rivals.push({
        x: spawnX,
        y: fromTop ? -120 : GAME_HEIGHT + 120,
        grabAt: 0,
        bite: this.hintManager.getLevel() >= 3 ? 1 : this.waveIndex <= 2 ? 2 : 3,
        stagger: 0,
        hitFlash: 0,
        fleeing: false,
      })
    }
    this.services.audio.noise({
      durationMs: 700, centreHz: 190, sweepToHz: 120, q: 2.6, intensity: 0.045, space: 0.5,
    })
    if (this.waveIndex === 1) this.services.ui.setInstruction('Leertaste, wenn einer heran ist. Einer reicht nicht.')
    else if (this.waveIndex === 2) this.services.ui.setInstruction('Zieh weiter nach links.')
  }

  private updateProgress(): void {
    const covered = Phaser.Math.Clamp((KILL_X - this.player.x) / (KILL_X - DEN_X), 0, 1)
    const stage = Math.floor(covered * STAGE_TARGET)
    if (stage > this.goal.value) {
      this.goal.setValue(stage)
      this.services.audio.pulse(176 + stage * 9, 0.03)
    }
    this.goal.resetBuffer(this.cargo / CARGO_START)
  }

  private sample(delta: number): void {
    this.sampleClock += delta
    if (this.sampleClock < 110) return
    this.services.telemetry.sample(
      (this.player.x - 960) / 810, this.velocity.length() / 8, this.averageNeed() > 0.5, this.sampleClock,
    )
    this.sampleClock = 0
  }

  private drawWorld(time: number): void {
    const g = this.graphics
    g.clear()
    ground(g, 0x0b0a08, this.trail === 'cool' ? 0x121a1c : 0x1e1710)
    dust(g, time, 44, 0xe0d3b6, 0.014)

    g.lineStyle(2, 0xd8a86a, this.trail === 'warm' ? 0.14 : 0.06)
    g.lineBetween(DEN_X, 430, KILL_X, 400)
    g.lineStyle(2, 0x82b3bd, this.trail === 'cool' ? 0.14 : 0.06)
    g.lineBetween(DEN_X, 720, KILL_X, 760)

    this.drawCubs(g, time)
    this.droppedAt.forEach((piece) => {
      glow(g, piece.x, piece.y, 48, palette.gefahr, 0.12)
      g.fillStyle(0x7a4a30, 0.6)
      g.fillEllipse(piece.x, piece.y, 26, 14)
    })

    if (this.phase >= 2) this.drawFence(g)
    if (this.phase === 2) this.drawNextPrey(g, time)
    if (this.phase === 0) this.drawRivals(g)

    if (this.cargo > 0 && this.phase === 0) {
      const size = 30 + (this.cargo / CARGO_START) * 42
      g.fillStyle(0x2a1b12, 0.92)
      g.fillEllipse(this.player.x + 48, this.player.y + 18, size * 1.7, size)
      g.lineStyle(2.4, 0x9a7550, 0.7)
      g.strokeEllipse(this.player.x + 48, this.player.y + 18, size * 1.7, size)
    }
    drawSelf(g, this.player.x, this.player.y, time, this.phase === 0 ? 1 : 0.85)
    if (this.phase === 0) this.drawStrength(g)
    this.sparks.draw(g)
    vignette(g, 0.42)
  }

  /** Drei Junge, jedes mit eigenem Balken: leer, satt, wieder leer. Das ist die Aufgabe. */
  private drawCubs(g: Phaser.GameObjects.Graphics, time: number): void {
    glowEllipse(g, DEN_X - 20, 585, 520, 460, palette.licht, 0.06 + this.averageNeed() * 0.1)
    this.cubs.forEach((cub, index) => {
      const hungry = cub.need < 0.35
      const colour = hungry ? 0xd98b5c : 0xefca88
      const pulse = 1 + Math.sin(time * (hungry ? 0.006 : 0.0028) + index * 1.7) * 0.14
      glow(g, cub.x, cub.y, 92 + cub.eating * 0.08, colour, 0.1 + cub.need * 0.2)
      // Lebensbalken als Ring: fällt sichtbar, steigt beim Fressen.
      g.lineStyle(7, 0x241c14, 0.7)
      g.strokeCircle(cub.x, cub.y, 30)
      g.lineStyle(7, colour, 0.92)
      g.beginPath()
      g.arc(cub.x, cub.y, 30, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * cub.need, false)
      g.strokePath()
      g.fillStyle(cub.eating > 0 ? 0xfff2d2 : 0xf0d49a, 0.85)
      g.fillCircle(cub.x, cub.y, 8 * pulse)
      if (cub.eating > 0) {
        g.lineStyle(3, palette.licht, Phaser.Math.Clamp(cub.eating / 400, 0, 1) * 0.7)
        g.strokeCircle(cub.x, cub.y, 44)
      }
      if (hungry && this.phase < 3) {
        g.lineStyle(2, colour, 0.2 + Math.sin(time * 0.007 + index) * 0.12)
        g.strokeCircle(cub.x, cub.y, 52 * pulse)
      }
    })
  }

  private drawRivals(g: Phaser.GameObjects.Graphics): void {
    this.rivals.forEach((rival) => {
      const waiting = !rival.fleeing && rival.stagger <= 0 && rival.grabAt > 0
      const left = waiting ? Phaser.Math.Clamp((rival.grabAt - this.elapsedMs) / this.grabWindow(), 0, 1) : 1
      const flash = Phaser.Math.Clamp(rival.hitFlash / 260, 0, 1)
      const colour = rival.fleeing ? 0x8d6a52 : palette.gefahr
      const facing = this.player.x >= rival.x ? 1 : -1
      glow(g, rival.x, rival.y, 112, flash > 0 ? 0xffe9c0 : colour, rival.fleeing ? 0.06 : 0.15 + flash * 0.3)
      this.drawScavenger(g, rival, facing, colour, flash)
      // Die Anmarschlinie erst zeigen, wenn er wirklich unterwegs ist. Über die halbe Karte
      // gezogen sah sie aus wie ein Riss im Bild.
      const away = Phaser.Math.Distance.Between(rival.x, rival.y, this.player.x, this.player.y)
      if (!rival.fleeing && rival.grabAt === 0 && rival.stagger <= 0 && away < 460) {
        g.lineStyle(2, colour, 0.26 * (1 - away / 460))
        g.lineBetween(rival.x, rival.y, this.player.x, this.player.y)
      }
      // Wie oft es noch getroffen werden muss: ein Strich je verbleibendem Treffer.
      if (!rival.fleeing && rival.bite > 0) {
        for (let index = 0; index < rival.bite; index += 1) {
          g.lineStyle(3, 0xf3d9a8, 0.75)
          g.lineBetween(rival.x - 14 + index * 14, rival.y - 50, rival.x - 14 + index * 14, rival.y - 38)
        }
      }
      // Der zulaufende Ring ist die Zeit, die zum Verteidigen bleibt.
      if (!waiting) return
      g.lineStyle(5, 0xf3d9a8, 0.85)
      g.strokeCircle(rival.x, rival.y, 40 + left * 62)
      g.lineStyle(2, 0xf3d9a8, 0.3)
      g.strokeCircle(rival.x, rival.y, 40)
    })
  }

  /**
   * Abfallender Rücken, hohe Schulter, tiefer Kopf. Das ist die Silhouette eines Aasjägers und
   * damit im Replay wiedererkennbar — ohne dass das Spiel je „Hyäne" sagt. Benennen würde die
   * Auflösung vorwegnehmen; dieselbe Regel gilt für den Schatten in Abschnitt 1.
   */
  private drawScavenger(
    g: Phaser.GameObjects.Graphics, rival: Rival, facing: number, colour: number, flash: number,
  ): void {
    const x = rival.x
    const y = rival.y
    const f = facing
    const at = (dx: number, dy: number): [number, number] => [x + dx * f, y + dy]

    // Beine zuerst, damit der Körper darüber liegt.
    g.lineStyle(3, flash > 0 ? 0x5c3a24 : 0x1c1310, 0.9)
    // Vorderbeine lang, Hinterbeine kurz — daher der abfallende Rücken.
    for (const [hip, spread, drop] of [[26, 6, 34], [33, -3, 34], [-30, 5, 26], [-38, -4, 26]] as const) {
      const [lx, ly] = at(hip, 8)
      g.lineBetween(lx, ly, lx + spread * f, y + drop)
    }

    g.fillStyle(flash > 0 ? 0x3a2418 : 0x140d0b, 0.94)
    g.beginPath()
    const body: Array<[number, number]> = [
      [40, -14], [26, -27], [0, -19], [-30, -8], [-50, -1], [-44, 11], [-8, 15], [24, 9],
    ]
    body.forEach(([dx, dy], index) => {
      const [px, py] = at(dx, dy)
      if (index === 0) g.moveTo(px, py)
      else g.lineTo(px, py)
    })
    g.closePath()
    g.fillPath()

    // Der tief getragene Kopf.
    g.beginPath()
    const head: Array<[number, number]> = [[38, -13], [67, 5], [61, 15], [33, 5]]
    head.forEach(([dx, dy], index) => {
      const [px, py] = at(dx, dy)
      if (index === 0) g.moveTo(px, py)
      else g.lineTo(px, py)
    })
    g.closePath()
    g.fillPath()

    // Der abfallende Rücken ist die Linie, an der man den Aasjäger erkennt.
    g.lineStyle(2.8, colour, 0.85 + flash * 0.15)
    g.beginPath()
    const spine: Array<[number, number]> = [[63, 9], [40, -14], [26, -27], [0, -19], [-30, -8], [-50, -1]]
    spine.forEach(([dx, dy], index) => {
      const [px, py] = at(dx, dy)
      if (index === 0) g.moveTo(px, py)
      else g.lineTo(px, py)
    })
    g.strokePath()

    const [tx, ty] = at(-50, -1)
    g.lineStyle(2.4, colour, 0.5)
    g.lineBetween(tx, ty, tx - 15 * f, y + 9)
  }

  /** Kraft als Bogen um die eigene Figur — dieselbe Bildsprache wie die Balken der Jungen. */
  private drawStrength(g: Phaser.GameObjects.Graphics): void {
    const swinging = this.elapsedMs < this.swingUntil
    const stumbling = this.elapsedMs < this.whiffUntil
    g.lineStyle(5, 0x241c14, 0.55)
    g.strokeCircle(this.player.x, this.player.y, 50)
    g.lineStyle(5, stumbling ? palette.gefahr : 0xd9c08a, 0.8)
    g.beginPath()
    g.arc(this.player.x, this.player.y, 50, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * this.strength, false)
    g.strokePath()
    if (!swinging && !stumbling) return
    // Der Hieb wird gezeigt: ein Bogen in die Richtung, in die geschlagen wurde.
    const local = stumbling
      ? Phaser.Math.Clamp((this.whiffUntil - this.elapsedMs) / (WHIFF_LOCK_MS * this.timeScale()), 0, 1)
      : Phaser.Math.Clamp((this.swingUntil - this.elapsedMs) / (SWING_LOCK_MS * this.timeScale()), 0, 1)
    g.lineStyle(7, stumbling ? 0x8d6a52 : 0xfff0cd, local * 0.85)
    g.beginPath()
    g.arc(this.player.x, this.player.y, 74 + (1 - local) * 30, this.swingAngle - 0.7, this.swingAngle + 0.7, false)
    g.strokePath()
  }

  /** Das Nächste liegt draußen und bewegt sich — damit klar ist, dass es Beute ist. */
  private drawNextPrey(g: Phaser.GameObjects.Graphics, time: number): void {
    const x = FENCE_X + 190 + Math.sin(time * 0.0011) * 60
    const y = 540 + Math.cos(time * 0.0014) * 90
    glowEllipse(g, x, y, 260, 200, palette.licht, 0.22)
    g.fillStyle(0xf6dda0, 0.9)
    g.fillEllipse(x, y, 46, 24)
    g.lineStyle(2, palette.licht, 0.3)
    g.lineBetween(this.player.x, this.player.y, x, y)
  }

  private drawFence(g: Phaser.GameObjects.Graphics): void {
    const lit = this.phase >= 3
      ? Phaser.Math.Clamp((this.elapsedMs - this.phaseStartedAt) / (7_000 * this.timeScale()), 0, 1)
      : 0
    for (let y = 150; y < GAME_HEIGHT - 60; y += 46) {
      g.lineStyle(3, 0xb8c1bd, 0.18 + lit * 0.42)
      g.lineBetween(FENCE_X, y, FENCE_X + 26, y + 26)
    }
    g.lineStyle(4, 0xb8c1bd, 0.26 + lit * 0.5)
    g.lineBetween(FENCE_X, 150, FENCE_X, GAME_HEIGHT - 60)
    if (lit <= 0) return
    glowEllipse(g, 1_700, 520, 1_100 * lit, 820 * lit, 0xe9f2ff, 0.34 * lit)
    g.fillStyle(0xf4f8ff, 0.5 + lit * 0.45)
    g.fillCircle(1_700, 520, 16 + lit * 24)
    g.fillStyle(0x000000, Math.max(0, lit - 0.68) * 3.1)
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
  }
}

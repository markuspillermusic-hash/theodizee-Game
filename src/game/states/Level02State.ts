import Phaser from 'phaser'
import { ObjectiveHud } from '../components/ObjectiveHud'
import { GAME_HEIGHT, GAME_WIDTH } from '../config/gameConfig'
import { levels } from '../config/levels'
import type { AssistanceLevel, Direction, LevelResult } from '../types'
import { TimedLevelScene } from './TimedLevelScene'

interface ResourceSignal {
  x: number
  y: number
  active: boolean
  respawnMs: number
  pulse: number
  lean: number
}

interface MovingSignal {
  position: Phaser.Math.Vector2
  velocity: Phaser.Math.Vector2
  energy: number
  target: number
  phase: number
  turnBias: number
  captured: boolean
  carried: boolean
  score: number
}

const RESOURCE_POINTS = [
  [230, 285], [355, 680], [480, 430], [595, 790], [700, 265], [815, 560],
  [925, 750], [1035, 335], [1145, 590], [1260, 795], [1375, 405], [1490, 665],
  [1605, 300], [1745, 535], [285, 515], [520, 245], [740, 665], [970, 480],
  [1205, 285], [1435, 755], [1665, 745], [1800, 355], [420, 825], [880, 245],
  [1090, 835], [1330, 540], [1565, 470], [1820, 705],
] as const

export class Level02State extends TimedLevelScene {
  private graphics!: Phaser.GameObjects.Graphics
  private player = new Phaser.Math.Vector2(330, 545)
  private velocity = new Phaser.Math.Vector2()
  private resources: ResourceSignal[] = []
  private others: MovingSignal[] = []
  private predator = new Phaser.Math.Vector2(2_080, 520)
  private predatorVelocity = new Phaser.Math.Vector2()
  private energy = 0.68
  private foodCollected = 0
  private foodLostToOthers = 0
  private nearOthersMs = 0
  private sampleClock = 0
  private phase = -1
  private phaseStartedAt = 0
  private chasedIndex = 2
  private competitorCaptured = false
  private playerCaught = false
  private chaseStartX = 0
  private escapeBias = 0
  private chaseTurns = 0
  private lastEscapeDirection: Direction = 'center'
  private closestChaseDistance = GAME_WIDTH
  private resourceSerial = 0
  private objectiveHud!: ObjectiveHud
  private capturedCompetitors = 0

  constructor() {
    super('Level02')
  }

  create(): void {
    this.player.set(330, 545)
    this.velocity.set(0, 0)
    this.resources = RESOURCE_POINTS.map(([x, y], index) => ({
      x,
      y,
      active: true,
      respawnMs: 0,
      pulse: index * 0.67,
      lean: ((index % 5) - 2) * 0.12,
    }))
    this.others = [
      this.makeMovingSignal(560, 350, 0.62, 0.4, -0.32, 1),
      this.makeMovingSignal(660, 700, 0.78, 2.1, 0.26, 7),
      this.makeMovingSignal(910, 470, 0.57, 4.2, -0.2, 13),
      this.makeMovingSignal(430, 820, 0.7, 5.6, 0.38, 19),
    ]
    this.predator.set(2_080, 520)
    this.predatorVelocity.set(0, 0)
    this.energy = 0.68
    this.foodCollected = 0
    this.foodLostToOthers = 0
    this.nearOthersMs = 0
    this.sampleClock = 0
    this.phase = -1
    this.phaseStartedAt = 0
    this.competitorCaptured = false
    this.playerCaught = false
    this.chaseStartX = 0
    this.escapeBias = 0
    this.chaseTurns = 0
    this.lastEscapeDirection = 'center'
    this.closestChaseDistance = GAME_WIDTH
    this.resourceSerial = 0
    this.capturedCompetitors = 0
    this.cameras.main.setBackgroundColor(0x070907)
    this.graphics = this.add.graphics()
    this.objectiveHud = new ObjectiveHud(this)
    this.objectiveHud.set('Gras sammeln', '0', 0)
    this.beginTimedLevel('Level02', levels.level02, 'AUSSCHNITT · 02', 'Sammle mehr als die anderen.', 'motion', {
      goal: 'Sammle 15 Grasfelder. Bleibe vor den anderen und weiche der Gefahr aus.',
      controls: 'WASD / Pfeiltasten · Maus oder Berührung · Leertaste: kurzer Sprint',
    })
  }

  update(time: number, delta: number): void {
    if (this.finished) return
    const progress = this.advanceLevel(delta)
    if (this.finished || progress < 0) return
    this.updatePhase()
    this.updateResources(delta)
    this.updateOthers(delta)
    this.updatePlayer(delta)
    this.updatePredator(delta)
    this.updateObjectiveHud()
    this.sample(delta)
    this.drawWorld(time)
  }

  protected applyHint(level: AssistanceLevel): void {
    this.services.setAssistance(level)
    if (level === 1) this.services.ui.setHint('Freie Grasfelder werden deutlicher markiert.')
    if (level === 2) this.services.ui.setHint('Eine Linie weist zum nächsten freien Grasfeld.')
    if (level === 3) this.services.ui.setHint('Freie Grasfelder und Fluchtrichtung werden maximal deutlich.')
  }

  protected collectResult(): LevelResult {
    const firstEscapeDirection: Direction = this.escapeBias < -80 ? 'left' : this.escapeBias > 80 ? 'right' : 'center'
    return {
      choices: {
        groupPosition: this.nearOthersMs / Math.max(1, this.elapsedMs) > 0.46 ? 'center' : 'edge',
        firstEscapeDirection,
      },
      metrics: {
        groupNearRatio: this.nearOthersMs / Math.max(1, this.elapsedMs),
        foodCollected: this.foodCollected,
        foodLostToOthers: this.foodLostToOthers,
        finalEnergy: this.energy,
        competitorCaptured: Number(this.competitorCaptured),
        capturedCompetitors: this.capturedCompetitors,
        chaseTurns: this.chaseTurns,
        escapeBias: this.escapeBias,
        escapeDistance: Math.abs(this.player.x - this.chaseStartX),
        closestChaseDistance: this.closestChaseDistance,
      },
    }
  }

  private makeMovingSignal(
    x: number,
    y: number,
    energy: number,
    phase: number,
    turnBias: number,
    target: number,
  ): MovingSignal {
    return {
      position: new Phaser.Math.Vector2(x, y),
      velocity: new Phaser.Math.Vector2(Math.cos(phase) * 1.6, Math.sin(phase) * 1.2),
      energy,
      target,
      phase,
      turnBias,
      captured: false,
      carried: false,
      score: Math.max(0, Math.floor((target % 4) / 2)),
    }
  }

  private updatePhase(): void {
    if (this.phase < 0) {
      this.enterPhase(0)
      this.services.ui.setInstruction('Sammle mehr als die anderen.')
      this.services.ui.setCaption('')
      this.services.audio.playMotif('group')
      return
    }
    const phaseElapsed = this.elapsedMs - this.phaseStartedAt
    const scale = this.services.getTimeScale()
    if (this.phase === 0 && (this.foodCollected >= 5 || this.elapsedMs >= 18_000 * scale)) this.startCompetitorHunt(1, 2)
    else if (this.phase === 1 && phaseElapsed >= 8_000 * scale) {
      this.others[this.chasedIndex].carried = false
      this.enterPhase(2)
      this.services.ui.setInstruction('Sammle 10 Grasfelder.')
    } else if (this.phase === 2 && (this.foodCollected >= 10 || this.elapsedMs >= 42_000 * scale)) this.startCompetitorHunt(3, 1)
    else if (this.phase === 3 && phaseElapsed >= 8_000 * scale) {
      this.others[this.chasedIndex].carried = false
      this.enterPhase(4)
      this.services.ui.setInstruction('Erreiche 15 Grasfelder.')
    } else if (this.phase === 4 && (this.foodCollected >= 15 || this.elapsedMs >= this.storyDurationMs * 0.78)) {
      this.enterPhase(5)
      this.chaseStartX = this.player.x
      this.predator.set(-520, Phaser.Math.Clamp(this.player.y + 135, 275, 810))
      this.predatorVelocity.set(0, 0)
      this.services.ui.setInstruction('Flieh.')
      this.services.ui.setCaption('')
      this.services.audio.playSwiftMotif()
    } else if (this.phase === 5 && this.playerCaught) {
      this.enterPhase(6)
      this.services.ui.setInstruction('')
      this.services.ui.setCaption('[Runde beendet.]')
    } else if (this.phase === 6 && phaseElapsed >= 2_600 * scale) this.finishLevel()
  }

  private startCompetitorHunt(phase: 1 | 3, index: number): void {
      this.enterPhase(phase)
      this.chasedIndex = index
      this.predator.set(2_080, this.others[this.chasedIndex].position.y - 90)
      this.predatorVelocity.set(0, 0)
      this.services.ui.setInstruction('Sammle weiter.')
      this.services.ui.setCaption('')
      this.services.audio.playSwiftMotif()
  }

  private enterPhase(phase: number): void {
    this.phase = phase
    this.phaseStartedAt = this.elapsedMs
  }

  private updateResources(delta: number): void {
    const lateChase = this.phase >= 5
    this.resources.forEach((resource, index) => {
      if (resource.active) return
      resource.respawnMs -= delta
      if (resource.respawnMs > 0 || lateChase) return
      const shift = (index * 193 + this.resourceSerial * 97) % 1_480
      resource.x = 220 + shift
      resource.y = 255 + ((index * 227 + this.resourceSerial * 71) % 585)
      resource.active = true
    })
  }

  private updatePlayer(delta: number): void {
    const input = this.inputManager.getVector(this.player.x, this.player.y)
    const frameScale = Phaser.Math.Clamp(delta / 16.667, 0.35, 2.5)
    const chaseLocal = this.phase === 5
      ? Phaser.Math.Clamp((this.elapsedMs - this.phaseStartedAt) / (12_000 * this.services.getTimeScale()), 0, 1)
      : 0

    this.energy = Phaser.Math.Clamp(this.energy - delta * (this.phase < 5 ? 0.00001 : 0.000018 + chaseLocal * 0.00003), 0.06, 1)
    if (input.active && !this.playerCaught) {
      this.velocity.x += input.x * 0.69 * frameScale
      this.velocity.y += input.y * 0.69 * frameScale
      const direction: Direction = input.x < -0.22 ? 'left' : input.x > 0.22 ? 'right' : 'center'
      this.services.telemetry.recordDirection(direction)
      if (this.phase >= 4) {
        this.escapeBias += input.x * delta
        if (direction !== 'center' && this.lastEscapeDirection !== 'center' && direction !== this.lastEscapeDirection) this.chaseTurns += 1
        if (direction !== 'center') this.lastEscapeDirection = direction
      }
    }
    if (!this.playerCaught && this.inputManager.justActionDown() && this.energy > 0.14) {
      const sprint = input.active
        ? new Phaser.Math.Vector2(input.x, input.y)
        : this.velocity.lengthSq() > 0.02 ? this.velocity.clone().normalize() : new Phaser.Math.Vector2(1, 0)
      this.velocity.add(sprint.scale(3.4))
      this.energy = Math.max(0.08, this.energy - 0.09)
      this.services.audio.pulse(238, 0.025)
    }

    this.others.forEach((signal) => {
      if (signal.captured) return
      const away = this.player.clone().subtract(signal.position)
      const distance = away.length()
      if (distance > 0 && distance < 125) this.velocity.add(away.normalize().scale((125 - distance) * 0.006 * frameScale))
    })

    const energySpeed = Phaser.Math.Linear(3.2, 8.9, this.energy)
    const chaseCeiling = Phaser.Math.Linear(8.2, 2.5, chaseLocal)
    const maxSpeed = this.phase >= 5 ? Math.min(energySpeed, chaseCeiling) : energySpeed
    this.velocity.scale(Math.pow(0.9, frameScale)).limit(maxSpeed)
    if (!this.playerCaught) {
      this.player.x = Phaser.Math.Clamp(this.player.x + this.velocity.x * frameScale, 95, GAME_WIDTH - 95)
      this.player.y = Phaser.Math.Clamp(this.player.y + this.velocity.y * frameScale, 210, GAME_HEIGHT - 135)
    }

    this.resources.forEach((resource) => {
      if (!resource.active || Phaser.Math.Distance.Between(this.player.x, this.player.y, resource.x, resource.y) > 48) return
      this.consumeResource(resource, true)
    })
  }

  private updateOthers(delta: number): void {
    const frameScale = Phaser.Math.Clamp(delta / 16.667, 0.35, 2.5)
    this.others.forEach((signal, index) => {
      if (signal.carried) {
        signal.position.copy(this.predator).add(new Phaser.Math.Vector2(-94, 42))
        return
      }
      if (signal.captured) return

      signal.energy = Phaser.Math.Clamp(signal.energy - delta * 0.000008, 0.14, 1)
      if (signal.target < 0 || !this.resources[signal.target]?.active) signal.target = this.chooseResourceIndex(signal.position, index)
      const target = signal.target >= 0 ? this.resources[signal.target] : undefined
      if (target) {
        const desired = new Phaser.Math.Vector2(target.x - signal.position.x, target.y - signal.position.y)
        if (desired.lengthSq() > 0) {
          desired.normalize()
          const perpendicular = new Phaser.Math.Vector2(-desired.y, desired.x)
          const weave = Math.sin(this.elapsedMs * (0.0009 + index * 0.00014) + signal.phase) * signal.turnBias
          signal.velocity.add(desired.scale((0.3 + index * 0.025) * frameScale))
          signal.velocity.add(perpendicular.scale(weave * frameScale))
        }
      }

      this.applySeparation(signal, index, frameScale)
      if (this.phase === 1 || this.phase === 3) {
        const flee = signal.position.clone().subtract(this.predator)
        const distance = flee.length()
        const threatened = index === this.chasedIndex ? 520 : 340
        if (distance > 0 && distance < threatened) {
          const strength = index === this.chasedIndex ? 0.94 : 0.48
          signal.velocity.add(flee.normalize().scale(strength * frameScale))
        }
      }

      const personalSpeed = 0.9 + index * 0.055
      signal.velocity.scale(Math.pow(0.915, frameScale)).limit(Phaser.Math.Linear(3, 6.2, signal.energy) * personalSpeed)
      signal.position.x = Phaser.Math.Clamp(signal.position.x + signal.velocity.x * frameScale, 110, GAME_WIDTH - 110)
      signal.position.y = Phaser.Math.Clamp(signal.position.y + signal.velocity.y * frameScale, 220, GAME_HEIGHT - 145)

      if (target && Phaser.Math.Distance.BetweenPoints(signal.position, target) < 44) {
        this.consumeResource(target, false, index)
        signal.energy = Math.min(1, signal.energy + 0.11)
        signal.target = -1
      }
    })
  }

  private applySeparation(signal: MovingSignal, index: number, frameScale: number): void {
    this.others.forEach((other, otherIndex) => {
      if (otherIndex === index || other.captured) return
      const away = signal.position.clone().subtract(other.position)
      const distance = away.length()
      if (distance <= 0 || distance >= 150) return
      signal.velocity.add(away.normalize().scale((150 - distance) * 0.008 * frameScale))
    })
    const fromPlayer = signal.position.clone().subtract(this.player)
    const playerDistance = fromPlayer.length()
    if (playerDistance > 0 && playerDistance < 135) {
      signal.velocity.add(fromPlayer.normalize().scale((135 - playerDistance) * 0.007 * frameScale))
    }
  }

  private updatePredator(delta: number): void {
    const frameScale = Phaser.Math.Clamp(delta / 16.667, 0.35, 2.5)
    if (this.phase === 0 || this.phase === 2 || this.phase === 4) return
    if (this.phase === 1 || this.phase === 3) {
      const local = Phaser.Math.Clamp((this.elapsedMs - this.phaseStartedAt) / (8_000 * this.services.getTimeScale()), 0, 1)
      const prey = this.others[this.chasedIndex]
      if (!prey.captured) {
        const direction = prey.position.clone().subtract(this.predator).normalize()
        this.predatorVelocity.add(direction.scale((0.7 + local * 0.86) * frameScale))
        this.predatorVelocity.scale(Math.pow(0.945, frameScale)).limit(12.8)
        this.predator.add(this.predatorVelocity.clone().scale(frameScale))
        if (Phaser.Math.Distance.BetweenPoints(this.predator, prey.position) < 88 || local > 0.56) {
          this.competitorCaptured = true
          this.capturedCompetitors += 1
          prey.captured = true
          prey.carried = true
          this.services.audio.pulse(68, 0.11)
          this.cameras.main.shake(240 * this.services.getTimeScale() + 90, 0.0035)
          this.services.ui.setCaption('')
        }
      } else {
        this.predator.x += 11.5 * frameScale
        this.predator.y -= 0.7 * frameScale
      }
      return
    }

    if (this.phase === 6) {
      this.predator.x += 14 * frameScale
      this.predator.y -= 2.2 * frameScale
      this.player.set(this.predator.x - 112, this.predator.y + 48)
      this.energy = Math.max(0.04, this.energy - delta * 0.00035)
      return
    }

    const local = Phaser.Math.Clamp((this.elapsedMs - this.phaseStartedAt) / (12_000 * this.services.getTimeScale()), 0, 1)
    const distance = Phaser.Math.Distance.BetweenPoints(this.predator, this.player)
    this.closestChaseDistance = Math.min(this.closestChaseDistance, distance)
    if (!this.playerCaught) {
      const direction = this.player.clone().subtract(this.predator).normalize()
      const pursuitSpeed = Phaser.Math.Linear(2.1, 11.5, local)
      this.predatorVelocity.add(direction.scale((0.24 + local * 0.72) * frameScale))
      this.predatorVelocity.scale(Math.pow(0.95, frameScale)).limit(pursuitSpeed)
      this.predator.add(this.predatorVelocity.clone().scale(frameScale))
      if (local < 0.22) {
        const protectedGap = Phaser.Math.Distance.BetweenPoints(this.predator, this.player)
        if (protectedGap < 165) this.predator.subtract(direction.clone().scale(165 - protectedGap))
      }
      if (local > 0.68) this.predator.lerp(this.player, 0.03 * frameScale)
      if ((local > 0.22 && distance < 76) || local > 0.88) {
        this.playerCaught = true
        this.velocity.set(0, 0)
        this.services.audio.pulse(54, 0.14)
        this.services.ui.setInstruction('')
        this.services.ui.setCaption('')
      }
    } else {
      this.predator.x += 8 * frameScale
      this.player.lerp(this.predator.clone().add(new Phaser.Math.Vector2(-105, 45)), 0.12 * frameScale)
      this.energy = Math.max(0.04, this.energy - delta * 0.0002)
    }
  }

  private consumeResource(resource: ResourceSignal, byPlayer: boolean, collectorIndex = -1): void {
    resource.active = false
    resource.respawnMs = Phaser.Math.Between(2_300, 4_400) * this.services.getTimeScale()
    this.resourceSerial += 1
    if (byPlayer) {
      this.foodCollected += 1
      this.energy = Math.min(1, this.energy + 0.13)
      this.services.audio.pulse(188 + (this.foodCollected % 4) * 24, 0.034)
    } else {
      this.foodLostToOthers += 1
      if (collectorIndex >= 0) this.others[collectorIndex].score += 1
    }
  }

  private updateObjectiveHud(): void {
    if (this.phase === 5) {
      const local = Phaser.Math.Clamp((this.elapsedMs - this.phaseStartedAt) / (12_000 * this.services.getTimeScale()), 0, 1)
      this.objectiveHud.set('Flucht', `${Math.max(0, Math.ceil((1 - local) * 12))} s`, local)
      return
    }
    if (this.phase >= 6) {
      this.objectiveHud.set('Runde', 'BEENDET', 1)
      return
    }
    const activeScores = [this.foodCollected, ...this.others.filter((signal) => !signal.captured).map((signal) => signal.score)]
    const rank = 1 + activeScores.filter((score, index) => index > 0 && score > this.foodCollected).length
    this.objectiveHud.set('Gras · Platz', `${this.foodCollected} · ${rank}/${activeScores.length}`, Math.min(1, this.foodCollected / 12))
  }

  private sample(delta: number): void {
    const nearestOther = this.others.reduce((best, signal) => signal.captured
      ? best
      : Math.min(best, Phaser.Math.Distance.BetweenPoints(this.player, signal.position)), 9_999)
    if (nearestOther < 300) this.nearOthersMs += delta
    this.sampleClock += delta
    if (this.sampleClock < 110) return
    this.services.telemetry.sample((this.player.y - GAME_HEIGHT / 2) / 360, this.velocity.length() / 9, nearestOther < 300, this.sampleClock)
    if (this.phase >= 4) this.services.telemetry.recordDirection(this.lastEscapeDirection)
    this.sampleClock = 0
  }

  private nearestResource(position: Phaser.Math.Vector2): ResourceSignal | undefined {
    const index = this.nearestResourceIndex(position)
    return index >= 0 ? this.resources[index] : undefined
  }

  private nearestResourceIndex(position: Phaser.Math.Vector2): number {
    let bestIndex = -1
    let bestDistance = Number.POSITIVE_INFINITY
    this.resources.forEach((resource, index) => {
      if (!resource.active) return
      const distance = Phaser.Math.Distance.Squared(position.x, position.y, resource.x, resource.y)
      if (distance >= bestDistance) return
      bestDistance = distance
      bestIndex = index
    })
    return bestIndex
  }

  private chooseResourceIndex(position: Phaser.Math.Vector2, agentIndex: number): number {
    let bestIndex = -1
    let bestScore = Number.POSITIVE_INFINITY
    this.resources.forEach((resource, index) => {
      if (!resource.active) return
      const reserved = this.others.some((other, otherIndex) => otherIndex !== agentIndex && other.target === index)
      const variation = 0.9 + ((index + agentIndex * 3) % 7) * 0.035
      const score = Phaser.Math.Distance.Squared(position.x, position.y, resource.x, resource.y) * variation + (reserved ? 240_000 : 0)
      if (score >= bestScore) return
      bestScore = score
      bestIndex = index
    })
    return bestIndex
  }

  private drawWorld(time: number): void {
    const g = this.graphics
    g.clear()
    this.drawBackdrop(g, 0x050806, 0x17120c)

    for (let band = 0; band < 10; band += 1) {
      const y = 245 + band * 67 + Math.sin(time * 0.00036 + band * 0.8) * 11
      g.lineStyle(2, 0xb0a271, 0.035 + (band % 2) * 0.015)
      g.lineBetween(0, y, GAME_WIDTH, y + Math.sin(band) * 14)
    }

    const assistance = this.hintManager.getLevel()
    this.resources.forEach((resource, index) => {
      if (!resource.active) return
      this.drawResource(g, resource, index, time, assistance >= 1 ? 0.86 : 0.58)
    })

    this.others.forEach((signal, index) => {
      if (signal.captured && !signal.carried) return
      this.drawBody(g, signal.position, signal.velocity, signal.energy, index, time + signal.phase * 400, signal.carried ? 0.4 : 0.76, false)
    })
    this.drawBody(g, this.player, this.velocity, this.energy, 4, time, this.playerCaught ? 0.3 : 1, true)

    if (assistance >= 2 && this.phase < 5) {
      const target = this.nearestResource(this.player)
      if (target) {
        g.lineStyle(2, 0xdde4aa, assistance === 3 ? 0.2 : 0.09)
        g.lineBetween(this.player.x, this.player.y, target.x, target.y)
      }
    }

    if (this.phase === 1 || this.phase === 3 || this.phase >= 5) this.drawThreat(g, time)
    if (this.phase === 6) {
      const local = Phaser.Math.Clamp((this.elapsedMs - this.phaseStartedAt) / (2_600 * this.services.getTimeScale()), 0, 1)
      g.fillStyle(0x050302, local * 0.82)
      g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
    }
  }

  private drawResource(g: Phaser.GameObjects.Graphics, resource: ResourceSignal, index: number, time: number, alpha: number): void {
    const pulse = 1 + Math.sin(time * 0.0034 + resource.pulse) * 0.14
    const height = (18 + (index % 3) * 5) * pulse
    g.fillStyle(index % 2 ? 0xb8c889 : 0xd2bd72, alpha * 0.1)
    g.fillEllipse(resource.x, resource.y + 7, 55, 32)
    for (let stem = -1; stem <= 1; stem += 1) {
      const offset = stem * 8
      g.lineStyle(stem === 0 ? 3 : 2, stem === 0 ? 0xd9cf8a : 0x9eb77f, alpha * (stem === 0 ? 0.82 : 0.55))
      g.lineBetween(
        resource.x + offset,
        resource.y + height * 0.55,
        resource.x + offset + resource.lean * height + stem * 2,
        resource.y - height * 0.55,
      )
    }
    g.fillStyle(0xe6ddaa, alpha * 0.8)
    g.fillCircle(resource.x + resource.lean * height, resource.y - height * 0.55, 3.5)
  }

  private drawBody(
    g: Phaser.GameObjects.Graphics,
    position: Phaser.Math.Vector2,
    velocity: Phaser.Math.Vector2,
    energy: number,
    variant: number,
    time: number,
    alpha: number,
    player: boolean,
  ): void {
    const size = 0.78 + energy * 0.5
    const width = 58 * size
    const height = 35 * size
    const color = player ? 0xead69a : [0xa8b8a8, 0xbcb18f, 0x91aaa7, 0xc2a986][variant % 4]
    const angle = velocity.lengthSq() > 0.04 ? velocity.angle() : variant * 0.7
    const forward = new Phaser.Math.Vector2(Math.cos(angle), Math.sin(angle))
    const side = new Phaser.Math.Vector2(-forward.y, forward.x)
    const points = [
      position.clone().add(forward.clone().scale(width * 0.5)),
      position.clone().add(forward.clone().scale(width * 0.25)).add(side.clone().scale(height * 0.46)),
      position.clone().add(forward.clone().scale(-width * 0.28)).add(side.clone().scale(height * 0.5)),
      position.clone().add(forward.clone().scale(-width * 0.5)),
      position.clone().add(forward.clone().scale(-width * 0.28)).add(side.clone().scale(-height * 0.5)),
      position.clone().add(forward.clone().scale(width * 0.25)).add(side.clone().scale(-height * 0.46)),
    ].map((point) => new Phaser.Geom.Point(point.x, point.y))

    g.fillStyle(0x0b0c0a, alpha * 0.9)
    g.fillPoints(points, true)
    g.lineStyle(player ? 4 : 3, color, alpha * 0.86)
    g.strokePoints(points, true)
    for (let stripe = -2; stripe <= 2; stripe += 1) {
      const center = position.clone().add(forward.clone().scale(stripe * width * 0.135))
      const stripeHalf = height * (0.26 + (2 - Math.abs(stripe)) * 0.045)
      g.lineStyle(stripe === 0 ? 4 : 2.5, color, alpha * (stripe % 2 === 0 ? 0.72 : 0.4))
      g.lineBetween(
        center.x - side.x * stripeHalf,
        center.y - side.y * stripeHalf,
        center.x + side.x * stripeHalf,
        center.y + side.y * stripeHalf,
      )
    }

    const pulse = 1 + Math.sin(time * (0.0026 + variant * 0.00016)) * 0.08
    g.lineStyle(player ? 3 : 2, color, alpha * (player ? 0.32 : 0.18))
    g.strokeEllipse(position.x, position.y, width * 1.55 * pulse, height * 1.75 * pulse)
    const satellites = Math.max(1, Math.floor(energy * 4))
    for (let index = 0; index < satellites; index += 1) {
      const orbit = time * (0.00055 + variant * 0.00004) + index * (Math.PI * 2 / satellites) + variant
      g.fillStyle(color, alpha * 0.52)
      g.fillCircle(position.x + Math.cos(orbit) * width * 0.92, position.y + Math.sin(orbit) * height * 1.05, 2.5)
    }
  }

  private drawThreat(g: Phaser.GameObjects.Graphics, time: number): void {
    const pulse = 1 + Math.sin(time * 0.006) * 0.055
    const radius = 104 * pulse
    g.fillStyle(0x010202, 0.88)
    g.fillCircle(this.predator.x, this.predator.y, radius)
    for (let ring = 0; ring < 3; ring += 1) {
      const rotation = time * (0.00075 + ring * 0.00018) + ring * 1.9
      g.lineStyle(5 - ring, ring === 0 ? 0xc98552 : 0x8d5c43, 0.42 - ring * 0.08)
      g.beginPath()
      g.arc(this.predator.x, this.predator.y, radius + ring * 25, rotation, rotation + Math.PI * (0.72 + ring * 0.1), false)
      g.strokePath()
    }
    const motion = this.predatorVelocity.lengthSq() > 0.1 ? this.predatorVelocity.clone().normalize() : new Phaser.Math.Vector2(-1, 0)
    for (let streak = 1; streak <= 3; streak += 1) {
      const side = new Phaser.Math.Vector2(-motion.y, motion.x).scale((streak - 2) * 28)
      const start = this.predator.clone().subtract(motion.clone().scale(95 + streak * 20)).add(side)
      const end = start.clone().subtract(motion.clone().scale(100 + streak * 35))
      g.lineStyle(4 - streak * 0.6, 0xb8794f, 0.3 - streak * 0.05)
      g.lineBetween(start.x, start.y, end.x, end.y)
    }
    if (this.phase >= 5) {
      g.lineStyle(2, 0xb66c4c, 0.11)
      g.lineBetween(this.predator.x, this.predator.y, this.player.x, this.player.y)
    }
  }
}

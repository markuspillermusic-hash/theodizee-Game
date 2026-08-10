import Phaser from 'phaser'
import { GAME_HEIGHT, GAME_WIDTH } from './config/gameConfig'

/**
 * Gemeinsames Bildsystem.
 *
 * Vorher zeichnete jeder Abschnitt eigene dünne Umrisse mit sehr niedriger Deckkraft auf fast
 * schwarzem Grund. Das ergab wenig Kontrast, keine Tiefe und sechs Abschnitte, die aussahen wie
 * sechs verschiedene Programme.
 *
 * Hier stehen die geteilten Mittel: eine Palette, ein weiches Leuchten mit echter Abnahme, die
 * immer gleiche Lichtgestalt für die spielende Figur, Gefahrenfelder, Staub und Vignette.
 *
 * Phaser-Grafiken können keinen Radialverlauf. Weiches Licht entsteht deshalb aus vielen
 * konzentrischen Kreisen mit quadratisch abnehmender Deckkraft.
 */

export const palette = {
  /** Der Grund. Nie reines Schwarz — sonst hat nichts, worauf es liegen kann. */
  groundTop: 0x0a0c10,
  groundBottom: 0x14110e,
  /** Das Licht, das gibt: Level 1 und das Ende. */
  licht: 0xf0c878,
  /** Wachstum, Nahrung, Pflanzliches. */
  halm: 0xa8c489,
  /** Das vertraute Gegenüber, Schutz, Wasser. */
  signal: 0x8fd0d8,
  /** Gefahr, Glut, Raubtier. */
  gefahr: 0xd97a4a,
  /** Die spielende Figur — in allen sechs Abschnitten dieselbe. */
  ich: 0xfdf3dc,
  ichWarm: 0xe9c789,
} as const

/** Ein weiches Licht mit glaubhafter Abnahme. `intensity` ist die Deckkraft im Kern. */
export function glow(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  radius: number,
  color: number,
  intensity = 0.5,
  layers = 0,
): void {
  // Zu wenige Schichten ergeben sichtbare Ringe. Die Zahl richtet sich deshalb nach dem Radius.
  const steps = layers > 0 ? layers : Math.round(Phaser.Math.Clamp(radius / 24, 12, 22))
  for (let index = steps; index >= 1; index -= 1) {
    const t = index / steps
    // Quadratische Abnahme nach aussen; innen dicht, aussen fast nichts.
    const alpha = intensity * Math.pow(1 - t, 2.1) * 0.9
    if (alpha <= 0.002) continue
    g.fillStyle(color, alpha)
    g.fillCircle(x, y, radius * t)
  }
}

/** Dasselbe, aber elliptisch — für Lichtbahnen und liegende Formen. */
export function glowEllipse(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  color: number,
  intensity = 0.5,
  layers = 0,
): void {
  const steps = layers > 0 ? layers : Math.round(Phaser.Math.Clamp(Math.max(width, height) / 24, 12, 22))
  for (let index = steps; index >= 1; index -= 1) {
    const t = index / steps
    const alpha = intensity * Math.pow(1 - t, 2.1) * 0.9
    if (alpha <= 0.002) continue
    g.fillStyle(color, alpha)
    g.fillEllipse(x, y, width * t, height * t)
  }
}

/**
 * Die spielende Figur. Sie sieht in jedem Abschnitt gleich aus — dasselbe Licht, das durch alle
 * sechs Gestalten geht. Das ist der Kreislauf, sichtbar in einer einzigen Form.
 */
export function self(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  time: number,
  scale = 1,
  strength = 1,
): void {
  const breath = 1 + Math.sin(time * 0.0022) * 0.06
  glow(g, x, y, 78 * scale * breath, palette.ichWarm, 0.22 * strength)
  g.lineStyle(2, palette.ichWarm, 0.34 * strength)
  g.strokeCircle(x, y, 24 * scale * breath)
  g.fillStyle(palette.ich, 0.96 * strength)
  g.fillCircle(x, y, 8.5 * scale)
  g.fillStyle(0xffffff, 0.9 * strength)
  g.fillCircle(x - 1.5 * scale, y - 1.5 * scale, 3.4 * scale)
}

/** Ein Gefahrenfeld: innen dunkler als der Grund, aussen glimmend. Kein leerer Ring. */
export function hazard(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  radius: number,
  time: number,
  strength = 1,
  seed = 0,
): void {
  g.fillStyle(0x000000, 0.42 * strength)
  g.fillCircle(x, y, radius * 0.92)
  glow(g, x, y, radius * 1.35, palette.gefahr, 0.16 * strength, 10)
  for (let ring = 0; ring < 3; ring += 1) {
    const phase = time * (0.0006 + ring * 0.00022) + seed + ring * 2.1
    g.lineStyle(2.4 - ring * 0.6, palette.gefahr, (0.3 - ring * 0.07) * strength)
    g.beginPath()
    g.arc(x, y, radius * (0.62 + ring * 0.17), phase, phase + Math.PI * (0.8 + ring * 0.22), false)
    g.strokePath()
  }
}

/** Grund mit leichtem Verlauf. Reines Schwarz nimmt allem die Tiefe. */
export function ground(g: Phaser.GameObjects.Graphics, top: number = palette.groundTop, bottom: number = palette.groundBottom): void {
  g.fillGradientStyle(top, top, bottom, bottom, 1)
  g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
}

/** Treibender Staub. Gibt dem Raum Grösse und dem Bild Textur. */
export function dust(g: Phaser.GameObjects.Graphics, time: number, count = 60, color = 0xd8e0d4, drift = 0.012): void {
  for (let index = 0; index < count; index += 1) {
    const seed = index * 137.5
    const x = (seed * 7.3 + time * drift * (0.4 + (index % 5) * 0.2)) % (GAME_WIDTH + 240) - 120
    const y = (seed * 3.1) % (GAME_HEIGHT - 120) + 60 + Math.sin(time * 0.0004 + index) * 26
    const size = 0.9 + (index % 4) * 0.7
    g.fillStyle(color, 0.04 + (index % 3) * 0.025)
    g.fillCircle(x, y, size)
  }
}

/** Vignette: hält den Blick in der Mitte und rahmt den Ausschnitt. */
export function vignette(g: Phaser.GameObjects.Graphics, strength = 0.5): void {
  const steps = 12
  for (let index = 0; index < steps; index += 1) {
    const t = index / steps
    const inset = t * 190
    g.fillStyle(0x000000, (strength / steps) * (1 - t * 0.35))
    g.fillRect(0, 0, GAME_WIDTH, 130 - inset * 0.4)
    g.fillRect(0, GAME_HEIGHT - (130 - inset * 0.4), GAME_WIDTH, 130 - inset * 0.4)
    g.fillRect(0, 0, 150 - inset * 0.5, GAME_HEIGHT)
    g.fillRect(GAME_WIDTH - (150 - inset * 0.5), 0, 150 - inset * 0.5, GAME_HEIGHT)
  }
}

interface Spark {
  x: number
  y: number
  color: number
  bornAt: number
  life: number
  radius: number
}

/**
 * Kurze Lichtringe als Rückmeldung. Jeder Fortschritt soll sichtbar quittiert werden — ohne das
 * fühlt sich ein Zähler nach Buchhaltung an und nicht nach Gelingen.
 */
export class Sparks {
  private items: Spark[] = []

  emit(x: number, y: number, color: number, radius = 90, life = 620): void {
    this.items.push({ x, y, color, bornAt: 0, life, radius })
    this.items[this.items.length - 1].bornAt = performance.now()
  }

  draw(g: Phaser.GameObjects.Graphics): void {
    const now = performance.now()
    this.items = this.items.filter((spark) => now - spark.bornAt < spark.life)
    this.items.forEach((spark) => {
      const t = (now - spark.bornAt) / spark.life
      const eased = Phaser.Math.Easing.Cubic.Out(t)
      g.lineStyle(4 * (1 - t) + 1, spark.color, (1 - t) * 0.75)
      g.strokeCircle(spark.x, spark.y, 14 + eased * spark.radius)
      glow(g, spark.x, spark.y, (14 + eased * spark.radius) * 0.7, spark.color, (1 - t) * 0.18, 8)
    })
  }
}

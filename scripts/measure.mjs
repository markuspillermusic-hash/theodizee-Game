// Zeitmessung bei festem 60-Hz-Takt.
//
// `qa.mjs` lässt das Spiel mit der echten Bildschleife laufen und ist damit richtig für Optik,
// Übergänge und Einblendungen. Für **Zeiten** taugt es nicht: Headless rendert Chromium in
// Software und schafft nur 12 bis 16 Bilder je Sekunde. Die Szenen begrenzen `frameScale` aus
// gutem Grund auf 2,4 — sonst springen Figuren bei einem Ruckler durch Wände —, und genau diese
// Begrenzung greift dort dauernd. Ergebnis: Alles bewegt sich mit etwa 60 Prozent der wahren
// Geschwindigkeit, jede gemessene Strecke dauert rund das Anderthalbfache. Wer daraufhin
// nachjustiert, verschlimmbessert.
//
// Diese Datei benutzt stattdessen `window.__qa.run()`, das Phaser mit festen 16,67 ms von Hand
// taktet. Die Zahlen entsprechen dann dem, was am Beamer passiert. Preis: Es läuft ungefähr in
// Echtzeit, weil jedes Bild trotzdem gerendert wird — 60 Sekunden Spielzeit kosten etwa
// 60 Sekunden Wartezeit.
//
//   node scripts/measure.mjs --state Level03 --seconds 55 --style fair
//   node scripts/measure.mjs --state Level03 --seconds 50 --style spam
//
// `--style` gilt nur für Level 3 und vergleicht drei Spielweisen: gezielt schlagen, hämmern,
// ignorieren. Voraussetzung: der Entwicklungsserver läuft (npm run dev).

import { chromium } from 'playwright'

const args = new Map()
for (let index = 2; index < process.argv.length; index += 1) {
  const token = process.argv[index]
  if (!token.startsWith('--')) continue
  const next = process.argv[index + 1]
  if (!next || next.startsWith('--')) args.set(token.slice(2), true)
  else {
    args.set(token.slice(2), next)
    index += 1
  }
}

const url = String(args.get('url') ?? 'http://127.0.0.1:5173/dev.html')
const state = String(args.get('state') ?? 'Level03')
const seconds = Number(args.get('seconds') ?? 55)
const style = String(args.get('style') ?? 'fair')

/** Wovon je Abschnitt am Ende berichtet wird. */
const TAILS = {
  Level03: `({ phase: s.phase, cargo: s.cargo, delivered: s.delivered, repelled: s.repelled,
    swings: s.swings, whiffs: s.whiffs, strength: Math.round(s.strength * 100) / 100,
    crossedFence: s.crossedFence, seconds: Math.round(s.elapsedMs / 1000) })`,
  Level04: `({ phase: s.phase, throughHits: s.throughHits, blocked: s.blocked,
    seconds: Math.round(s.elapsedMs / 1000) })`,
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
const problems = []
page.on('pageerror', (error) => problems.push(String(error.message)))
page.on('console', (message) => {
  if (message.type() === 'error') problems.push(`console: ${message.text()}`)
})

await page.goto(url, { waitUntil: 'load' })
await page.waitForFunction(() => Boolean(window.__qa), null, { timeout: 20_000 })

const result = await page.evaluate(async ({ state, seconds, style, tailSource }) => {
  const heim = `if (s.phase === 2) { const dx = 1500 - px, dy = 540 - py, d = Math.hypot(dx, dy) || 1
      return { x: dx / d, y: dy / d, active: true } }
    if (s.phase !== 0) return { x: 0, y: 0, active: false }
    const dx = 300 - px, dy = 720 - py, d = Math.hypot(dx, dy) || 1;`
  const presses = {
    fair: `const inReach = s.rivals.some((r) => !r.fleeing && Math.hypot(r.x - px, r.y - py) <= 180)
      const ready = s.elapsedMs >= s.swingUntil && s.elapsedMs >= s.whiffUntil
      const p = inReach && ready;`,
    spam: 'const p = true;',
    ignore: 'const p = false;',
  }
  const bots = {}
  if (state === 'Level03') {
    bots.Level03 = new Function(
      `return (s) => (px, py) => { ${heim} ${presses[style] ?? presses.fair}
        return { x: dx / d, y: dy / d, active: true, press: p } }`,
    )()
  }
  const report = await window.__qa.run({ state, seconds, bots })
  const scene = window.__ausschnitt.game.scene.getScene(state)
  const tail = tailSource && scene
    ? new Function('s', `return ${tailSource}`)(scene)
    : null
  return { report, tail }
}, { state, seconds, style, tailSource: TAILS[state] ?? null })

await browser.close()
console.log(JSON.stringify({ state, style, ...result, problems }, null, 2))

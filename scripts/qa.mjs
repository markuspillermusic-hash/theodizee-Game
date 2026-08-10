// Bildkontrolle in einem echten Browser mit laufender Bildschleife.
//
// Die eingebaute Prüfstrecke (`window.__qa.run`) taktet Phaser von Hand. Das reicht für Logik und
// Standbilder, aber nicht für Bewegung: Übergänge, Einblendungen und Timing lassen sich so nicht
// beurteilen. Dieses Skript startet Chromium, lässt das Spiel normal laufen, besetzt nur die
// Steuerung und nimmt ganze Bildschirme auf — samt der Oberfläche ausserhalb des Canvas.
//
//   node scripts/qa.mjs --state Level04 --seconds 70 --shots 26,50,54,58,62
//   node scripts/qa.mjs --state Level06 --every 3 --seconds 45 --video
//
// Voraussetzung: der Entwicklungsserver läuft (npm run dev).

import { mkdirSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

const args = new Map()
for (let index = 2; index < process.argv.length; index += 1) {
  const token = process.argv[index]
  if (!token.startsWith('--')) continue
  const key = token.slice(2)
  const next = process.argv[index + 1]
  if (!next || next.startsWith('--')) args.set(key, true)
  else {
    args.set(key, next)
    index += 1
  }
}

const url = String(args.get('url') ?? 'http://127.0.0.1:5173/dev.html')
const state = String(args.get('state') ?? 'Level04')
const seconds = Number(args.get('seconds') ?? 40)
const label = String(args.get('label') ?? state.toLowerCase())
const outDir = resolve(process.cwd(), String(args.get('out') ?? 'docs/qa'))
const wantsVideo = Boolean(args.get('video'))

const shots = args.has('shots')
  ? String(args.get('shots')).split(',').map((value) => Number(value.trim())).filter((value) => value > 0)
  : []
if (args.has('every')) {
  const step = Number(args.get('every'))
  for (let at = step; at <= seconds; at += step) shots.push(at)
}
if (shots.length === 0) shots.push(Math.round(seconds / 2), seconds)
shots.sort((a, b) => a - b)

/**
 * Steuerung je Abschnitt. Der Quelltext wird in der Seite ausgewertet und bekommt dort die Szene
 * mit ihrem vollständigen Zustand — nur so kann ein Bot auf Glut oder Rufe reagieren.
 */
const BOTS = {
  Level04: `(s) => (px, py) => {
    const p = s.embers.filter(e => !e.resolved && e.spawnedAt <= s.elapsedMs)
      .sort((a, b) => a.impactAt - b.impactAt)[0]
    let tx = s.ward.x + 70, ty = s.ward.y
    if (p) { tx = p.shieldX; ty = p.shieldY }
    const dx = tx - px, dy = ty - py, d = Math.hypot(dx, dy) || 1
    const a = d < 8 ? 0 : 1
    return { x: dx / d * a, y: dy / d * a, active: a === 1 }
  }`,
  Level05: `(s) => () => {
    let press = false
    if (s.call && !s.call.resolved && s.call.from !== 'player') {
      const age = s.elapsedMs - s.call.startedAt
      press = Math.abs(age - s.call.travelMs) <= 60
    }
    return { x: 0, y: 0, active: false, press }
  }`,
  Level06: `(s) => (px, py) => {
    if (s.lightAt >= 0) {
      const a = Math.atan2(470 - py, 1780 - px)
      return { x: Math.cos(a), y: Math.sin(a), active: true }
    }
    let best = -1, bd = 1e9
    s.memories.forEach((m, i) => {
      if (s.visited.has(i)) return
      const d = Math.hypot(m.x - px, m.y - py)
      if (d < bd) { bd = d; best = i }
    })
    if (best < 0) return { x: 0, y: 0, active: false }
    const m = s.memories[best]
    const dx = m.x - px, dy = m.y - py, d = Math.hypot(dx, dy) || 1
    return { x: d < 20 ? 0 : dx / d, y: d < 20 ? 0 : dy / d, active: d >= 20 }
  }`,
}

mkdirSync(outDir, { recursive: true })
const videoDir = resolve(outDir, 'video')
if (wantsVideo) {
  rmSync(videoDir, { recursive: true, force: true })
  mkdirSync(videoDir, { recursive: true })
}

const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
  ...(wantsVideo ? { recordVideo: { dir: videoDir, size: { width: 1280, height: 720 } } } : {}),
})
const page = await context.newPage()

const problems = []
page.on('console', (message) => {
  if (message.type() === 'error') problems.push(`console: ${message.text()}`)
})
page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`))

await page.goto(url, { waitUntil: 'load' })
await page.waitForFunction(() => Boolean(window.__qa), null, { timeout: 20_000 })

await page.evaluate(({ state, bots }) => {
  window.__qa.live({ state, bots })
}, { state, bots: BOTS })

const written = []
const startedAt = Date.now()
for (const at of shots) {
  const waitFor = at * 1000 - (Date.now() - startedAt)
  if (waitFor > 0) await page.waitForTimeout(waitFor)
  const name = `${label}-${String(at).padStart(3, '0')}s.png`
  await page.screenshot({ path: resolve(outDir, name) })
  written.push(name)
}
const remaining = seconds * 1000 - (Date.now() - startedAt)
if (remaining > 0) await page.waitForTimeout(remaining)

const summary = await page.evaluate(() => {
  const game = window.__ausschnitt.game
  const running = game.scene.getScenes(true)
    .filter((scene) => !['Boot', 'Preload'].includes(scene.scene.key))
  const scene = running[running.length - 1]
  const text = (selector) => (document.querySelector(selector)?.textContent ?? '').trim()
  return {
    scene: scene ? scene.scene.key : null,
    fps: Math.round(game.loop.actualFps),
    ui: { instruction: text('[data-role="instruction"]'), hint: text('[data-role="hint"]') },
  }
})

await context.close()
await browser.close()

console.log(JSON.stringify({ state, seconds, summary, shots: written, problems }, null, 2))

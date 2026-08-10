import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'

/**
 * Nimmt im Entwicklungsserver Bildschirmaufnahmen aus der Seite entgegen und legt sie als PNG ab.
 *
 * Hintergrund: In manchen Prüfumgebungen wird die Seite nicht zusammengesetzt. Dann läuft keine
 * Bildschleife, es wird nichts gezeichnet, und ein Screenshot von außen ist nicht möglich. Die
 * Seite selbst kann aber rendern und das Ergebnis hierher schicken. Nur im Dev-Server aktiv.
 */
function qaScreenshotPlugin(): Plugin {
  return {
    name: 'ausschnitt-qa-screenshot',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__qa/shot', (request, response) => {
        if (request.method !== 'POST') {
          response.statusCode = 405
          response.end('POST erwartet')
          return
        }
        const chunks: Buffer[] = []
        request.on('data', (chunk: Buffer) => chunks.push(chunk))
        request.on('end', () => {
          try {
            const payload = JSON.parse(Buffer.concat(chunks).toString('utf8')) as {
              name?: string
              dataUrl?: string
            }
            const raw = String(payload.name ?? 'shot')
            const safe = raw.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 80) || 'shot'
            const base64 = String(payload.dataUrl ?? '').split(',')[1] ?? ''
            if (!base64) throw new Error('kein Bildinhalt')
            const target = resolve(server.config.root, 'docs/qa', `${safe}.png`)
            mkdirSync(dirname(target), { recursive: true })
            writeFileSync(target, Buffer.from(base64, 'base64'))
            response.setHeader('content-type', 'application/json')
            response.end(JSON.stringify({ ok: true, path: `docs/qa/${safe}.png` }))
          } catch (error) {
            response.statusCode = 400
            response.end(JSON.stringify({ ok: false, error: String(error) }))
          }
        })
      })
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [qaScreenshotPlugin()],
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      input: 'dev.html',
    },
  },
})

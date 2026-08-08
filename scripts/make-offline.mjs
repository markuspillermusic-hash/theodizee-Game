import { readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(scriptDirectory, '..')
const distributionDirectory = resolve(projectRoot, 'dist')
const builtEntry = resolve(distributionDirectory, 'dev.html')
const distributionEntry = resolve(distributionDirectory, 'index.html')
const rootEntry = resolve(projectRoot, 'index.html')

const builtHtml = await readFile(builtEntry, 'utf8')
const scriptMatch = builtHtml.match(/<script\b[^>]*\bsrc="([^"]+\.js)"[^>]*><\/script>/i)
const styleTagMatch = builtHtml.match(/<link\b[^>]*\brel="stylesheet"[^>]*>/i)
const styleHrefMatch = styleTagMatch?.[0].match(/\bhref="([^"]+\.css)"/i)

if (!scriptMatch || !styleTagMatch || !styleHrefMatch) {
  throw new Error('Vite-Ausgabe enthält nicht die erwarteten JavaScript- und CSS-Verweise.')
}

const resolveBuildAsset = (reference) => resolve(distributionDirectory, reference.replace(/^\.\//, ''))
const rawJavaScript = await readFile(resolveBuildAsset(scriptMatch[1]), 'utf8')
const css = await readFile(resolveBuildAsset(styleHrefMatch[1]), 'utf8')
const javaScript = rawJavaScript
  .replace(/^\/\/# sourceMappingURL=.*$/gm, '')
  .replace(/<\/script/gi, '<\\/script')

const marker = '<!-- Generierte Offline-Fassung: npm.cmd run build -->'
const inlineHtml = builtHtml
  .replace('<head>', `<head>\n    ${marker}`)
  .replace(styleTagMatch[0], `<style>\n${css}\n</style>`)
  .replace(scriptMatch[0], '')
  .replace('</body>', `<script>\n${javaScript}\n</script>\n  </body>`)

const rootHtml = inlineHtml.replace(
  '<meta name="ausschnitt-asset-base" content="assets/" />',
  '<meta name="ausschnitt-asset-base" content="public/assets/" />',
)

await writeFile(distributionEntry, inlineHtml, 'utf8')
await writeFile(rootEntry, rootHtml, 'utf8')
await rename(builtEntry, resolve(distributionDirectory, 'dev-source.html'))

console.log('Offline-Dateien erzeugt:')
console.log(`- ${rootEntry}`)
console.log(`- ${distributionEntry}`)

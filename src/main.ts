import './style.css'
import { GameApp } from './game/GameApp'

const app = new GameApp()

// Nur im Entwicklungsserver: Zugriff für Prüfskripte und Bildschirmaufnahmen.
// Im Produktions- und Offline-Build ist `import.meta.env.DEV` falsch, der Zweig entfällt.
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__ausschnitt = app
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => app.destroy())
}

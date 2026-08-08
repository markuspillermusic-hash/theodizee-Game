import './style.css'
import { GameApp } from './game/GameApp'

const app = new GameApp()

if (import.meta.hot) {
  import.meta.hot.dispose(() => app.destroy())
}

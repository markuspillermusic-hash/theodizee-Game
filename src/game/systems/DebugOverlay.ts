import type { GameServices } from './GameServices'

export class DebugOverlay {
  private readonly element: HTMLElement
  private readonly services: GameServices
  private intervalId: number | null = null

  constructor(services: GameServices) {
    this.services = services
    const element = document.getElementById('debug-overlay')
    if (!element) throw new Error('Missing debug overlay')
    this.element = element
    if (import.meta.env.DEV) document.addEventListener('keydown', this.onShortcut)
  }

  private readonly onShortcut = (event: KeyboardEvent): void => {
    if (!(event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'd')) return
    event.preventDefault()
    this.toggle()
  }

  private toggle(): void {
    const show = this.element.hidden
    this.element.hidden = !show
    if (show) {
      this.render()
      this.intervalId = window.setInterval(() => this.render(), 250)
    } else if (this.intervalId !== null) {
      window.clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  private render(): void {
    const snapshot = this.services.getDebugSnapshot()
    this.element.textContent = JSON.stringify(snapshot, null, 2)
  }
}

import type { GameStateKey, RuntimeStatus } from '../types'
import type { GameServices } from './GameServices'

export interface TeacherControlApi {
  togglePause(): void
  requestHint(): void
  completeCurrent(): void
  restartCurrent(): void
  resetSession(): void
  startState(state: GameStateKey): void
  toggleFullscreen(): Promise<void>
}

export class TeacherControls {
  private readonly dialog = this.required<HTMLDialogElement>('teacher-dialog')
  private readonly handle = this.required<HTMLButtonElement>('teacher-handle')
  private readonly pauseButton = this.required<HTMLButtonElement>('teacher-pause')
  private readonly stateOutput = this.required<HTMLOutputElement>('teacher-state')
  private readonly timeOutput = this.required<HTMLOutputElement>('teacher-time')
  private readonly hintOutput = this.required<HTMLOutputElement>('teacher-hint')
  private lastStatus: RuntimeStatus

  constructor(
    api: TeacherControlApi,
    services: GameServices,
  ) {
    this.lastStatus = services.getStatus()
    this.handle.addEventListener('click', () => this.open())
    document.addEventListener('keydown', this.onShortcut)
    this.required<HTMLButtonElement>('teacher-hint-button').addEventListener('click', () => api.requestHint())
    this.required<HTMLButtonElement>('teacher-complete').addEventListener('click', () => api.completeCurrent())
    this.required<HTMLButtonElement>('teacher-restart').addEventListener('click', () => api.restartCurrent())
    this.required<HTMLButtonElement>('teacher-reset').addEventListener('click', () => {
      if (!window.confirm('Gespeicherte Telemetrie löschen und einen neuen Durchlauf beginnen?')) return
      api.resetSession()
      this.dialog.close()
    })
    this.pauseButton.addEventListener('click', () => api.togglePause())
    this.required<HTMLButtonElement>('fullscreen-button').addEventListener('click', () => void api.toggleFullscreen())

    this.dialog.querySelectorAll<HTMLButtonElement>('[data-start-state]').forEach((button) => {
      button.addEventListener('click', () => {
        api.startState(button.dataset.startState as GameStateKey)
        this.dialog.close()
      })
    })

    this.required<HTMLInputElement>('music-volume').addEventListener('input', (event) => {
      services.audio.setMusicVolume(Number((event.target as HTMLInputElement).value))
    })
    this.required<HTMLInputElement>('effects-volume').addEventListener('input', (event) => {
      services.audio.setEffectsVolume(Number((event.target as HTMLInputElement).value))
    })
    this.required<HTMLInputElement>('captions-toggle').addEventListener('change', (event) => {
      services.ui.setCaptionsEnabled((event.target as HTMLInputElement).checked)
    })
    this.required<HTMLInputElement>('test-mode-toggle').addEventListener('change', (event) => {
      services.setTestMode((event.target as HTMLInputElement).checked)
    })

    services.events.on<RuntimeStatus>('runtime-status', (status) => this.render(status))
    this.render(this.lastStatus)
  }

  private open(): void {
    if (!this.dialog.open) this.dialog.showModal()
  }

  private readonly onShortcut = (event: KeyboardEvent): void => {
    if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'l') {
      event.preventDefault()
      if (this.dialog.open) this.dialog.close()
      else this.open()
    }
  }

  private render(status: RuntimeStatus): void {
    this.lastStatus = status
    this.stateOutput.value = status.state
    this.hintOutput.value = String(status.assistanceLevel)
    this.timeOutput.value = status.remainingMs === null ? '–' : this.formatTime(status.remainingMs)
    this.pauseButton.textContent = status.paused ? 'Fortsetzen' : 'Pause'
    this.required<HTMLInputElement>('test-mode-toggle').checked = status.testMode
  }

  private formatTime(milliseconds: number): string {
    const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1_000))
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = String(totalSeconds % 60).padStart(2, '0')
    return `${minutes}:${seconds}`
  }

  private required<T extends HTMLElement>(id: string): T {
    const element = document.getElementById(id)
    if (!element) throw new Error(`Missing teacher control #${id}`)
    return element as T
  }
}

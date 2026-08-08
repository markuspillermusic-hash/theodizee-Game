export class StageUi {
  private readonly sceneLabel = this.required<HTMLElement>('scene-label')
  private readonly instruction = this.required<HTMLElement>('instruction')
  private readonly hint = this.required<HTMLElement>('interaction-hint')
  private readonly caption = this.required<HTMLElement>('subtitles')
  private readonly action = this.required<HTMLButtonElement>('primary-action')
  private actionHandler: (() => void) | null = null
  private captionsEnabled = true
  private captionText = ''

  constructor() {
    this.action.addEventListener('click', () => this.actionHandler?.())
  }

  setScene(label: string, instruction = ''): void {
    this.sceneLabel.textContent = label
    this.instruction.textContent = instruction
  }

  setInstruction(text: string): void {
    this.instruction.textContent = text
  }

  setHint(text: string): void {
    this.hint.textContent = text
  }

  setCaption(text: string): void {
    this.captionText = text
    this.caption.textContent = this.captionsEnabled ? this.captionText : ''
  }

  setCaptionsEnabled(enabled: boolean): void {
    this.captionsEnabled = enabled
    this.caption.textContent = enabled ? this.captionText : ''
  }

  showAction(label: string, handler: () => void): void {
    this.actionHandler = handler
    this.action.textContent = label
    this.action.hidden = false
  }

  hideAction(): void {
    this.action.hidden = true
    this.actionHandler = null
  }

  clear(): void {
    this.setScene('')
    this.setHint('')
    this.setCaption('')
    this.hideAction()
  }

  private required<T extends HTMLElement>(id: string): T {
    const element = document.getElementById(id)
    if (!element) throw new Error(`Missing UI element #${id}`)
    return element as T
  }
}

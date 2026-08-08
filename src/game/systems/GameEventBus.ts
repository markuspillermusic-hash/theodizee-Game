export class GameEventBus {
  private readonly target = new EventTarget()

  emit<T>(name: string, detail: T): void {
    this.target.dispatchEvent(new CustomEvent<T>(name, { detail }))
  }

  on<T>(name: string, listener: (detail: T) => void): () => void {
    const handler = (event: Event) => listener((event as CustomEvent<T>).detail)
    this.target.addEventListener(name, handler)
    return () => this.target.removeEventListener(name, handler)
  }
}

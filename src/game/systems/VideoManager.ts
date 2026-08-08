import type { ReplayClipVariant } from '../types'

export interface VideoPlaybackResult {
  played: boolean
  reason: 'ended' | 'skipped' | 'missing' | 'blocked'
}

export class VideoManager {
  private readonly element: HTMLVideoElement
  private resolvePlayback: ((result: VideoPlaybackResult) => void) | null = null
  private status = 'bereit'

  constructor(element: HTMLVideoElement) {
    this.element = element
  }

  async preload(variant: ReplayClipVariant): Promise<boolean> {
    return new Promise((resolve) => {
      const probe = document.createElement('video')
      const timeout = window.setTimeout(() => resolve(false), 2_500)
      const finish = (loaded: boolean) => {
        window.clearTimeout(timeout)
        probe.removeAttribute('src')
        probe.load()
        resolve(loaded)
      }
      probe.preload = 'metadata'
      probe.muted = true
      probe.addEventListener('loadedmetadata', () => finish(true), { once: true })
      probe.addEventListener('error', () => finish(false), { once: true })
      probe.src = this.resolveUrl(variant.srcMp4)
      probe.load()
    })
  }

  async play(variant: ReplayClipVariant): Promise<VideoPlaybackResult> {
    this.skip('skipped')
    this.status = `lädt ${variant.id}`
    this.element.src = this.resolveUrl(variant.srcMp4)
    this.element.playbackRate = variant.playbackRate
    this.element.classList.add('is-visible')
    this.element.load()

    return new Promise((resolve) => {
      let settled = false
      const settle = (result: VideoPlaybackResult) => {
        if (settled) return
        settled = true
        this.cleanup()
        this.status = result.reason
        resolve(result)
      }
      this.resolvePlayback = settle
      this.element.onended = () => settle({ played: true, reason: 'ended' })
      this.element.onerror = () => settle({ played: false, reason: 'missing' })

      void this.element.play().then(() => {
        this.status = `spielt ${variant.id}`
      }).catch(() => settle({ played: false, reason: 'blocked' }))
    })
  }

  pause(): void {
    this.element.pause()
  }

  resume(): void {
    if (this.element.src) void this.element.play().catch(() => undefined)
  }

  skip(reason: VideoPlaybackResult['reason'] = 'skipped'): void {
    if (this.resolvePlayback) this.resolvePlayback({ played: reason !== 'missing', reason })
    else this.cleanup()
  }

  getStatus(): string {
    if (this.element.readyState > 0 && this.element.duration > 0) {
      const buffered = this.element.buffered.length
        ? this.element.buffered.end(this.element.buffered.length - 1) / this.element.duration
        : 0
      return `${this.status} · Puffer ${Math.round(buffered * 100)} %`
    }
    return this.status
  }

  private cleanup(): void {
    this.resolvePlayback = null
    this.element.onended = null
    this.element.onerror = null
    this.element.pause()
    this.element.classList.remove('is-visible')
  }

  private resolveUrl(path: string): string {
    const configuredBase = document
      .querySelector<HTMLMetaElement>('meta[name="ausschnitt-asset-base"]')
      ?.content ?? 'assets/'
    const assetPath = path.replace(/^assets\//, '')
    return new URL(`${configuredBase}${assetPath}`, document.baseURI).href
  }
}

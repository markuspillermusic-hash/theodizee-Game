import type { SessionSnapshot } from '../types'

const STORAGE_KEY = 'ausschnitt.session.v1'

export class SaveManager {
  load(): SessionSnapshot | null {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (!raw) return null
      const parsed = JSON.parse(raw) as SessionSnapshot
      return parsed.version === 1 ? parsed : null
    } catch {
      return null
    }
  }

  save(snapshot: SessionSnapshot): boolean {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
      return true
    } catch {
      return false
    }
  }

  clear(): void {
    try {
      window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      // The in-memory session remains usable when storage is unavailable.
    }
  }
}

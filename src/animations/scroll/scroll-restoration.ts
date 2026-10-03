interface Position { top: number; left: number }
interface StoredPositions { version: 1; timestamp: number; positions: [string, Position][] }
const STORAGE_KEY = 'moc:scroll:v1'
const MAX_AGE = 24 * 60 * 60 * 1000
/** Entry ID + region ID, never URL. Storage contains coordinates only. */
export class ScrollRestorationManager {
  private positions = new Map<string, Position>()
  private regions = new Map<string, HTMLElement>()
  private cleanup = new Map<string, () => void>()
  constructor(private storage?: Storage) {
    try {
      const saved = JSON.parse(storage?.getItem(STORAGE_KEY) || 'null') as StoredPositions | null
      if (saved?.version === 1 && Date.now() - saved.timestamp < MAX_AGE) {
        saved.positions.slice(-100).forEach(([key, pos]) => {
          if (typeof key === 'string' && Number.isFinite(pos.top) && Number.isFinite(pos.left)) this.positions.set(key, pos)
        })
      } else storage?.removeItem(STORAGE_KEY)
    } catch { try { storage?.removeItem(STORAGE_KEY) } catch { /* Restricted storage is optional. */ } }
  }
  private key(entryId: string, region: string) { return entryId + ':' + region }
  register(entryId: string, region: string, element: HTMLElement) {
    const key = this.key(entryId, region)
    if (this.regions.get(key) === element) return
    this.cleanup.get(key)?.()
    this.regions.set(key, element)
    const listener = () => this.capture(entryId)
    element.addEventListener('scroll', listener, { passive: true })
    this.cleanup.set(key, () => element.removeEventListener('scroll', listener))
  }
  unregister(entryId: string, region: string) {
    const key = this.key(entryId, region)
    this.capture(entryId); this.cleanup.get(key)?.(); this.cleanup.delete(key); this.regions.delete(key)
  }
  capture(entryId: string) {
    for (const [key, element] of this.regions) {
      if (key.startsWith(entryId + ':')) this.positions.set(key, { top: element.scrollTop, left: element.scrollLeft })
    }
  }
  restore(entryId: string) {
    for (const [key, element] of this.regions) {
      if (!key.startsWith(entryId + ':')) continue
      const position = this.positions.get(key)
      if (position) { element.scrollTop = position.top; element.scrollLeft = position.left }
    }
  }
  /** A screen can call restore again after async content has reached its final height. */
  retain(entryIds: string[]) {
    for (const key of this.regions.keys()) {
      if (!entryIds.some(id => key.startsWith(id + ':'))) {
        this.cleanup.get(key)?.(); this.cleanup.delete(key); this.regions.delete(key); this.positions.delete(key)
      }
    }
  }
  persist() {
    try { this.storage?.setItem(STORAGE_KEY, JSON.stringify({ version: 1, timestamp: Date.now(), positions: [...this.positions].slice(-100) })) }
    catch { /* Storage restrictions do not interrupt navigation. */ }
  }
  dispose() { this.cleanup.forEach(fn => fn()); this.cleanup.clear(); this.regions.clear() }
}



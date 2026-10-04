interface Position { top: number; left: number }
interface StoredPositions { version: 1; timestamp: number; positions: [string, Position][] }
const STORAGE_KEY = 'moc:scroll:v1'
const MAX_AGE = 24 * 60 * 60 * 1000
/** Caller-supplied screen/page ID + region ID. Storage contains coordinates only. */
export class ScrollRestorationManager {
  private positions = new Map<string, Position>()
  private regions = new Map<string, HTMLElement>()
  private cleanup = new Map<string, () => void>()
  private frozen = new Set<string>()
  private pending = new Set<string>()
  constructor(private storage?: Storage, private storageKey = STORAGE_KEY) {
    try {
      const saved = JSON.parse(storage?.getItem(storageKey) || 'null') as StoredPositions | null
      if (saved?.version === 1 && Date.now() - saved.timestamp < MAX_AGE) {
        saved.positions.slice(-100).forEach(([key, pos]) => {
          if (typeof key === 'string' && Number.isFinite(pos.top) && Number.isFinite(pos.left)) this.positions.set(key, pos)
        })
      } else storage?.removeItem(storageKey)
    } catch { try { storage?.removeItem(storageKey) } catch { /* Restricted storage is optional. */ } }
  }
  private key(entryId: string, region: string) { return entryId + ':' + region }
  register(entryId: string, region: string, element: HTMLElement) {
    const key = this.key(entryId, region)
    if (this.regions.get(key) === element) return
    this.cleanup.get(key)?.()
    this.regions.set(key, element)
    if (this.positions.has(key)) this.pending.add(key)
    else { element.scrollTop = 0; element.scrollLeft = 0 }
    const listener = () => this.capture(entryId)
    const interrupt = () => { this.pending.delete(key); this.capture(entryId) }
    element.addEventListener('scroll', listener, { passive: true })
    for (const event of ['wheel', 'touchstart', 'pointerdown', 'keydown']) element.addEventListener(event, interrupt, { passive: true })
    this.cleanup.set(key, () => {
      element.removeEventListener('scroll', listener)
      for (const event of ['wheel', 'touchstart', 'pointerdown', 'keydown']) element.removeEventListener(event, interrupt)
    })
  }
  unregister(entryId: string, region: string, element?: HTMLElement) {
    const key = this.key(entryId, region)
    if (element && this.regions.get(key) !== element) return
    this.capture(entryId); this.cleanup.get(key)?.(); this.cleanup.delete(key); this.regions.delete(key)
    this.pending.delete(key)
  }
  freeze(entryId: string) { this.frozen.add(entryId) }
  thaw(entryId: string) { this.frozen.delete(entryId) }
  capture(entryId: string) {
    if (this.frozen.has(entryId)) return
    for (const [key, element] of this.regions) {
      if (this.pending.has(key)) continue
      if (key.startsWith(entryId + ':')) this.positions.set(key, { top: element.scrollTop, left: element.scrollLeft })
    }
  }
  restore(entryId: string) {
    if (this.frozen.has(entryId)) return
    for (const [key, element] of this.regions) {
      if (!key.startsWith(entryId + ':')) continue
      const position = this.positions.get(key)
      if (position) {
        element.scrollTop = position.top; element.scrollLeft = position.left
        if (Math.abs(element.scrollTop - position.top) < 1 && Math.abs(element.scrollLeft - position.left) < 1) this.pending.delete(key)
      }
    }
  }
  restorePending(entryId: string) {
    if ([...this.pending].some(key => key.startsWith(entryId + ':'))) this.restore(entryId)
  }
  /** A screen can call restore again after async content has reached its final height. */
  retain(entryIds: string[]) {
    for (const key of this.regions.keys()) {
      if (!entryIds.some(id => key.startsWith(id + ':'))) {
        this.cleanup.get(key)?.(); this.cleanup.delete(key); this.regions.delete(key); this.positions.delete(key)
        this.pending.delete(key)
      }
    }
  }
  persist() {
    try { this.storage?.setItem(this.storageKey, JSON.stringify({ version: 1, timestamp: Date.now(), positions: [...this.positions].slice(-100) })) }
    catch { /* Storage restrictions do not interrupt navigation. */ }
  }
  dispose() { this.cleanup.forEach(fn => fn()); this.cleanup.clear(); this.regions.clear(); this.pending.clear(); this.frozen.clear() }
}



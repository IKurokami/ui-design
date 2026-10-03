export interface ScreenEntry { id: string; path: string }
export interface StackSnapshot { chain: ScreenEntry[]; virtualRoot: boolean }
export const HISTORY_KEY = 'mocStack'
export const newEntry = (path: string): ScreenEntry => ({ id: crypto.randomUUID(), path })
export function readSnapshot(value: unknown): StackSnapshot | undefined {
  if (!value || typeof value !== 'object') return
  const data = value as Partial<StackSnapshot>
  if (!Array.isArray(data.chain) || !data.chain.length || data.chain.length > 30) return
  if (!data.chain.every(entry => entry && typeof entry.id === 'string' && typeof entry.path === 'string' && entry.path.startsWith('/'))) return
  if (new Set(data.chain.map(entry => entry.id)).size !== data.chain.length) return
  return { chain: data.chain, virtualRoot: data.virtualRoot === true }
}
export function initialSnapshot(path: string, rootPath: string, saved?: unknown): StackSnapshot {
  const restored = readSnapshot(saved)
  if (restored?.chain.at(-1)?.path === path) return restored
  const root = newEntry(rootPath)
  return { chain: path === rootPath ? [root] : [root, newEntry(path)], virtualRoot: path !== rootPath }
}
export function nextSnapshot(current: StackSnapshot, path: string, rootPath: string): StackSnapshot {
  return { chain: path === rootPath ? [current.chain[0]!] : [...current.chain, newEntry(path)], virtualRoot: current.virtualRoot }
}
export function transitionDirection(current: ScreenEntry[], next: ScreenEntry[]): 'push' | 'pop' {
  return current.some(entry => entry.id === next.at(-1)?.id) ? 'pop' : 'push'
}


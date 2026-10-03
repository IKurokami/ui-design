import { beforeEach, describe, expect, it } from 'vitest'
import { ScrollRestorationManager } from '../src/animations/scroll/scroll-restoration'
beforeEach(() => sessionStorage.clear())
describe('per-entry scroll restoration', () => {
  it('restores two independent regions without URL collisions', () => {
    const manager = new ScrollRestorationManager()
    const first = document.createElement('div')
    const second = document.createElement('div')
    manager.register('entry-1', 'main', first)
    manager.register('entry-1', 'sidebar', second)
    first.scrollTop = 180; second.scrollTop = 70
    manager.capture('entry-1')
    first.scrollTop = 0; second.scrollTop = 0
    manager.restore('entry-1')
    expect(first.scrollTop).toBe(180); expect(second.scrollTop).toBe(70)
    manager.dispose()
  })
  it('restores after refresh with no credentials in storage', () => {
    const element = document.createElement('div')
    const original = new ScrollRestorationManager(sessionStorage)
    original.register('entry', 'main', element)
    element.scrollTop = 240; original.capture('entry'); original.persist(); original.dispose()
    const refreshed = new ScrollRestorationManager(sessionStorage)
    element.scrollTop = 0; refreshed.register('entry', 'main', element); refreshed.restore('entry')
    expect(element.scrollTop).toBe(240)
    expect(sessionStorage.getItem('moc:scroll:v1')).not.toContain('password')
    refreshed.dispose()
  })
  it('drops removed screens and expires stale session data', () => {
    sessionStorage.setItem('moc:scroll:v1', JSON.stringify({ version: 1, timestamp: 0, positions: [] }))
    const manager = new ScrollRestorationManager(sessionStorage)
    expect(sessionStorage.getItem('moc:scroll:v1')).toBeNull()
    const element = document.createElement('div')
    manager.register('popped', 'main', element); element.scrollTop = 100; manager.capture('popped')
    manager.retain([]); manager.persist()
    expect(JSON.parse(sessionStorage.getItem('moc:scroll:v1')!).positions).toEqual([])
    manager.dispose()
  })
})


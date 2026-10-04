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

  it('protects a departing page from scroll resets caused by unloading content', () => {
    const manager = new ScrollRestorationManager()
    const outgoing = document.createElement('div')
    manager.register('page', 'main', outgoing)
    outgoing.scrollTop = 550; manager.capture('page'); manager.freeze('page')
    outgoing.scrollTop = 0; outgoing.dispatchEvent(new Event('scroll'))
    manager.unregister('page', 'main', outgoing)
    const incoming = document.createElement('div')
    manager.thaw('page'); manager.register('page', 'main', incoming); manager.restore('page')
    expect(incoming.scrollTop).toBe(550)
    manager.dispose()
  })

  it('retains a clamped restoration until content grows, without fighting manual scrolling', () => {
    const manager = new ScrollRestorationManager()
    const original = document.createElement('div')
    manager.register('page', 'main', original)
    original.scrollTop = 600; manager.unregister('page', 'main', original)
    const incoming = document.createElement('div')
    let maximum = 0
    let top = 0
    Object.defineProperty(incoming, 'scrollTop', { get: () => top, set: value => { top = Math.min(value, maximum) } })
    manager.register('page', 'main', incoming); manager.restore('page')
    incoming.dispatchEvent(new Event('scroll'))
    maximum = 1000; manager.restorePending('page')
    expect(incoming.scrollTop).toBe(600)
    incoming.dispatchEvent(new Event('wheel')); incoming.scrollTop = 120; incoming.dispatchEvent(new Event('scroll'))
    manager.restorePending('page')
    expect(incoming.scrollTop).toBe(120)
    manager.dispose()
  })
})


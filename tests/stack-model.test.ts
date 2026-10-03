import { describe, expect, it } from 'vitest'
import { initialSnapshot, nextSnapshot, readSnapshot, transitionDirection } from '../src/components/navigation/stack-model'
describe('navigation entry identity and history', () => {
  it('bootstraps login as the root', () => {
    const state = initialSnapshot('/login', '/login')
    expect(state.chain.map(entry => entry.path)).toEqual(['/login'])
    expect(state.virtualRoot).toBe(false)
  })
  it('provides a login screen underneath a direct registration URL', () => {
    const state = initialSnapshot('/register', '/login')
    expect(state.chain.map(entry => entry.path)).toEqual(['/login', '/register'])
    expect(state.virtualRoot).toBe(true)
  })
  it('preserves entry identity on refresh', () => {
    const state = nextSnapshot(initialSnapshot('/login', '/login'), '/register', '/login')
    expect(initialSnapshot('/register', '/login', state)).toEqual(state)
  })
  it('assigns distinct IDs to repeated instances of the same URL', () => {
    const root = initialSnapshot('/login', '/login')
    const once = nextSnapshot(root, '/register', '/login')
    const twice = nextSnapshot(once, '/register', '/login')
    expect(twice.chain[1]!.id).not.toEqual(twice.chain[2]!.id)
    expect(root.chain).toHaveLength(1)
  })
  it('uses inverse animation for back and forward', () => {
    const root = initialSnapshot('/login', '/login')
    const pushed = nextSnapshot(root, '/register', '/login')
    expect(transitionDirection(root.chain, pushed.chain)).toBe('push')
    expect(transitionDirection(pushed.chain, root.chain)).toBe('pop')
  })
  it('rejects corrupt history and duplicate screen IDs', () => {
    expect(readSnapshot({ chain: [] })).toBeUndefined()
    expect(readSnapshot({ chain: [{ id: 1, path: '/login' }] })).toBeUndefined()
    expect(readSnapshot({ chain: [{ id: 'x', path: '/login' }, { id: 'x', path: '/register' }] })).toBeUndefined()
  })
})


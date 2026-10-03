import { afterEach, describe, expect, it, vi } from 'vitest'
import { Flip } from 'gsap/Flip'
import { AnimationManager } from '../src/animations/core/animation-manager'
import { animateMotion, captureMotion } from '../src/animations/auto/motion'

const managers: AnimationManager[] = []
function screens() {
  const outgoing = document.createElement('article')
  const incoming = document.createElement('article')
  outgoing.style.backgroundColor = 'rgb(246, 245, 239)'
  incoming.style.backgroundColor = 'rgb(246, 245, 239)'
  for (const [screen, top] of [[outgoing, 180], [incoming, 60]] as const) {
    screen.innerHTML = '<h1 data-motion-key="auth-title">Title</h1><div data-motion>Extra field</div>'
    const title = screen.querySelector<HTMLElement>('h1')!
    Object.defineProperties(title, {
      offsetWidth: { value: 300 }, offsetHeight: { value: 50 },
      getBoundingClientRect: { value: () => new DOMRect(100, top, 300, 50) },
    })
    title.style.width = '300px'; title.style.height = '50px'
    document.body.appendChild(screen)
  }
  const manager = new AnimationManager()
  managers.push(manager)
  const state = captureMotion(outgoing)
  return { outgoing, incoming, manager, state }
}
afterEach(() => { managers.splice(0).forEach(manager => manager.dispose()); vi.restoreAllMocks(); document.body.innerHTML = '' })
describe('auth Flip lifecycle', () => {
  it('uses real Flip and cleans transformed fields when interrupted to completion', async () => {
    const { outgoing, incoming, manager, state } = screens()
    const flip = vi.spyOn(Flip, 'from')
    const animation = animateMotion(manager, state, incoming, { direction: 'push' })
    expect(flip).toHaveBeenCalledOnce()
    manager.finish()
    await animation
    expect(incoming.querySelector<HTMLElement>('h1')!.style.transform).toBe('')
    expect(incoming.querySelector<HTMLElement>('[data-motion]')!.style.opacity).toBe('')
    expect(incoming.style.visibility).not.toBe('hidden')
    expect(outgoing.style.visibility).toBe('hidden')
    expect(incoming.style.backgroundColor).toBe('rgb(246, 245, 239)')
    expect(incoming.querySelector('.is-motion-flipping')).toBeNull()
  })
  it.each(['push', 'pop'] as const)('shows new content while %s Flip is still moving', async direction => {
    const { incoming, manager, state } = screens()
    const play = manager.play.bind(manager)
    let master: Parameters<Parameters<typeof manager.play>[0]>[0] | undefined
    vi.spyOn(manager, 'play').mockImplementation((build, reduced, cleanup) => play(timeline => {
      master = timeline
      build(timeline)
    }, reduced, cleanup))
    const animation = animateMotion(manager, state, incoming, { direction })
    master!.pause().time(0.2)
    expect(Number(incoming.querySelector<HTMLElement>('[data-motion]')!.style.opacity)).toBe(0)
    master!.time(0.5)
    expect(Number(incoming.querySelector<HTMLElement>('[data-motion]')!.style.opacity)).toBeGreaterThan(0.5)
    expect(incoming.style.visibility).toBe('inherit')
    expect(master!.progress()).toBeLessThan(1)
    expect(incoming.querySelector<HTMLElement>('h1')!.classList.contains('is-motion-flipping')).toBe(true)
    manager.finish()
    await animation
  })
  it('skips Flip entirely for reduced motion', async () => {
    const { outgoing, incoming, manager, state } = screens()
    const flip = vi.spyOn(Flip, 'from')
    await animateMotion(manager, state, incoming, { direction: 'pop', reduced: true })
    expect(flip).not.toHaveBeenCalled()
    expect(incoming.style.visibility).not.toBe('hidden')
    expect(outgoing.style.visibility).toBe('hidden')
  })
  it('resolves and cleans inline styles when the screen unmounts mid-animation', async () => {
    const { incoming, manager, state } = screens()
    const animation = animateMotion(manager, state, incoming, { direction: 'pop' })
    manager.dispose()
    await animation
    expect(incoming.querySelector<HTMLElement>('h1')!.style.transform).toBe('')
    expect(incoming.style.backgroundColor).toBe('rgb(246, 245, 239)')
    expect(incoming.querySelector('.is-motion-flipping')).toBeNull()
  })
  it('reports animation setup errors instead of leaving navigation waiting', async () => {
    const manager = new AnimationManager()
    const cleanup = vi.fn()
    await expect(manager.play(() => { throw new Error('setup failed') }, false, cleanup)).rejects.toThrow('setup failed')
    expect(cleanup).toHaveBeenCalledOnce()
  })
})


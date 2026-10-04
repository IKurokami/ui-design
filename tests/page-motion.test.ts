import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { computed, defineComponent, h, ref } from 'vue'
import gsap from 'gsap'
import { Flip } from 'gsap/Flip'
import { usePageMotion } from '../src/animations/composables/usePageMotion'
import PrismaticBackdrop from '../src/features/home/components/PrismaticBackdrop.vue'
import { createPrismaticSurface } from '../src/features/home/prismatic-surface'
vi.mock('../src/features/home/prismatic-surface', () => ({
  createPrismaticSurface: vi.fn(() => ({ phase: 0, render: vi.fn(), resize: vi.fn(), dispose: vi.fn() })),
}))
const cleanups: (() => void)[] = []
afterEach(() => { cleanups.splice(0).forEach(cleanup => cleanup()); document.body.innerHTML = ''; vi.restoreAllMocks(); vi.unstubAllGlobals() })
function controller() {
  const auth = ref(false)
  let pages: ReturnType<typeof usePageMotion>
  const Host = defineComponent({
    setup() {
      const brand = ref<HTMLElement>()
      pages = usePageMotion(brand, computed(() => auth.value))
      return () => h('a', { ref: brand, style: { position: 'absolute', left: auth.value ? '64px' : '56px', color: auth.value ? '#435a41' : '#f0eee6' } }, 'mộc.')
    },
  })
  const wrapper = mount(Host, { attachTo: document.body })
  cleanups.push(() => wrapper.unmount())
  return { pages: pages!, wrapper, auth }
}
describe('page and brand motion', () => {
  it('preserves the existing always-animated navigation when the system requests reduced motion', async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })))
    const { wrapper, auth } = controller()
    const brand = wrapper.get('a').element
    const flip = vi.spyOn(Flip, 'from')
    auth.value = true
    await flushPromises()
    expect(flip).toHaveBeenCalledOnce()
    expect(flip.mock.calls[0]![1]!.targets).toBe(brand)
    expect((flip.mock.results[0]!.value as gsap.core.Timeline).duration()).toBeCloseTo(0.62)
  })

  it('uses Flip on the same brand in both directions and cleans up rapid route changes', async () => {
    const { wrapper, auth } = controller()
    const brand = wrapper.get('a').element
    const flip = vi.spyOn(Flip, 'from')
    auth.value = true; await flushPromises()
    expect(flip).toHaveBeenCalledOnce()
    expect(flip.mock.calls[0]![1]!.targets).toBe(brand)
    auth.value = false; await flushPromises()
    expect(flip).toHaveBeenCalledTimes(2)
    expect(wrapper.get('a').element).toBe(brand)
    wrapper.unmount(); cleanups.pop()
    expect(gsap.getTweensOf(brand)).toHaveLength(0)
  })

  it('does not force a partially played logo Flip to its endpoint on reversal', async () => {
    const { auth, wrapper } = controller()
    const brand = wrapper.get('a').element as HTMLElement
    vi.spyOn(brand, 'getBoundingClientRect').mockImplementation(() => ({
      left: Number.parseFloat(brand.style.left), top: 0, width: 100, height: 35,
      right: Number.parseFloat(brand.style.left) + 100, bottom: 35, x: Number.parseFloat(brand.style.left), y: 0, toJSON() {},
    }))
    const flip = vi.spyOn(Flip, 'from')
    auth.value = true
    await flushPromises()
    const previous = flip.mock.results[0]!.value as gsap.core.Timeline
    const completed = vi.fn()
    previous.eventCallback('onComplete', completed)
    previous.progress(0.35)
    auth.value = false
    await flushPromises()
    expect(completed).not.toHaveBeenCalled()
    expect(flip).toHaveBeenCalledTimes(2)
  })
  it.each([true, false])('keeps both pages visible and layers the sliding auth above the zooming home (push=%s)', push => {
    const { pages, auth } = controller()
    auth.value = push
    const outgoing = document.createElement('div')
    const incoming = document.createElement('div')
    document.body.append(outgoing, incoming)
    const left = vi.fn()
    const entered = vi.fn()
    pages.leave(outgoing, left)
    pages.enter(incoming, entered)
    const home = push ? outgoing : incoming
    const authPage = push ? incoming : outgoing
    expect(authPage.style.zIndex).toBe('2')
    expect(home.style.zIndex).toBe('1')
    const leaving = gsap.getTweensOf(outgoing)[0]!
    const entering = gsap.getTweensOf(incoming)[0]!
    leaving.pause().progress(0.5)
    entering.pause().progress(0.5)
    expect(Number(gsap.getProperty(home, 'scaleX'))).toBeGreaterThan(0.9)
    expect(Number(gsap.getProperty(home, 'scaleX'))).toBeLessThan(1)
    expect(Number(gsap.getProperty(authPage, 'xPercent'))).toBeGreaterThan(0)
    expect(Number(gsap.getProperty(authPage, 'xPercent'))).toBeLessThan(100)
    for (const page of [outgoing, incoming]) {
      expect(page.style.opacity).toBe('1')
      expect(page.style.visibility).not.toBe('hidden')
      expect(page.style.pointerEvents).toBe('none')
    }
    expect(left).not.toHaveBeenCalled()
    expect(entered).not.toHaveBeenCalled()
    leaving.progress(1)
    entering.progress(1)
    expect(left).toHaveBeenCalledOnce()
    expect(entered).toHaveBeenCalledOnce()
  })
  it.each(['landing-page', 'app-shell'])('animates incoming %s and restores interaction at completion', className => {
    const { pages, auth } = controller()
    auth.value = className === 'app-shell'
    const element = document.createElement('div')
    element.className = className
    document.body.append(element)
    const done = vi.fn()
    pages.enter(element, done)
    expect(element.style.opacity).toBe('1')
    expect(element.style.pointerEvents).toBe('none')
    expect(done).not.toHaveBeenCalled()
    gsap.getTweensOf(element)[0]!.progress(1)
    expect(done).toHaveBeenCalledOnce()
    expect(element.style.transform).toBe('')
    expect(element.style.opacity).toBe('')
    expect(element.style.pointerEvents).toBe('')
    expect(element.style.zIndex).toBe('')
    expect(element.style.willChange).toBe('')
    expect(element.style.boxShadow).toBe('')
  })
  it.each(['reader-layout', 'studio-layout'])('uses coordinated enter and leave transitions for %s in both directions', className => {
    const { pages, auth } = controller()
    const library = document.createElement('main'), destination = document.createElement('main')
    library.innerHTML = '<div class="library-layout"></div>'; destination.innerHTML = '<div class="' + className + '"></div>'
    document.body.append(library, destination)
    for (const push of [true, false]) {
      auth.value = push
      const outgoing = push ? library : destination, incoming = push ? destination : library
      const entered = vi.fn(), left = vi.fn()
      pages.leave(outgoing, left); pages.enter(incoming, entered)
      expect(incoming.style.zIndex).toBe(push ? '2' : '1')
      expect(outgoing.style.zIndex).toBe(push ? '1' : '2')
      const leaving = gsap.getTweensOf(outgoing)[0]!, entering = gsap.getTweensOf(incoming)[0]!
      expect(leaving).toBeDefined(); expect(entering).toBeDefined()
      leaving.progress(.5); entering.progress(.5)
      expect(entered).not.toHaveBeenCalled(); expect(left).not.toHaveBeenCalled()
      leaving.progress(1); entering.progress(1)
      expect(entered).toHaveBeenCalledOnce(); expect(left).toHaveBeenCalledOnce()
      for (const element of [incoming, outgoing]) {
        expect(element.style.transform).toBe(''); expect(element.style.pointerEvents).toBe('')
        expect(element.style.zIndex).toBe(''); expect(gsap.getTweensOf(element)).toHaveLength(0)
      }
    }
  })
  it('cleans up interrupted page motion so a rapid reversal can animate the same node', () => {
    const { pages, auth } = controller()
    const element = document.createElement('div')
    document.body.append(element)
    auth.value = true
    const cancelled = vi.fn()
    pages.enter(element, cancelled)
    gsap.getTweensOf(element)[0]!.pause().progress(0.3)
    pages.cancel(element)
    expect(gsap.getTweensOf(element)).toHaveLength(0)
    expect(element.style.transform).toBe('')
    expect(element.style.pointerEvents).toBe('')
    expect(element.style.zIndex).toBe('')
    expect(cancelled).not.toHaveBeenCalled()
    auth.value = false
    const left = vi.fn()
    pages.leave(element, left)
    gsap.getTweensOf(element)[0]!.progress(1)
    expect(left).toHaveBeenCalledOnce()
    expect(gsap.getTweensOf(element)).toHaveLength(0)
  })
})
describe('landing background motion', () => {
  it('shows the image if the GPU context is lost and restarts the seam after restoration', async () => {
    const wrapper = mount(PrismaticBackdrop, { attachTo: document.body })
    cleanups.push(() => wrapper.unmount())
    Object.defineProperty(wrapper.get('img').element, 'naturalWidth', { value: 1672 })
    await wrapper.get('img').trigger('load')
    const first = vi.mocked(createPrismaticSurface).mock.results.at(-1)!.value!
    await wrapper.get('canvas').trigger('webglcontextlost')
    expect(wrapper.get('canvas').classes()).not.toContain('is-ready')
    expect(wrapper.find('img').exists()).toBe(true)
    expect(first.dispose).toHaveBeenCalledOnce()
    expect(gsap.getTweensOf(first)).toHaveLength(0)
    await wrapper.get('canvas').trigger('webglcontextrestored')
    const restored = vi.mocked(createPrismaticSurface).mock.results.at(-1)!.value!
    expect(restored).not.toBe(first)
    expect(wrapper.get('canvas').classes()).toContain('is-ready')
    expect(gsap.getTweensOf(restored)).toHaveLength(1)
  })
  it('resumes the seam when the page becomes visible again', async () => {
    let notifyIntersection: IntersectionObserverCallback
    const disconnect = vi.fn()
    vi.stubGlobal('IntersectionObserver', class {
      constructor(callback: IntersectionObserverCallback) { notifyIntersection = callback }
      observe() {}
      disconnect = disconnect
    })
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
    const wrapper = mount(PrismaticBackdrop, { attachTo: document.body })
    cleanups.push(() => wrapper.unmount())
    Object.defineProperty(wrapper.get('img').element, 'naturalWidth', { value: 1672 })
    await wrapper.get('img').trigger('load')
    const surface = vi.mocked(createPrismaticSurface).mock.results.at(-1)!.value!
    const targets = [surface]
    const tweens = gsap.getTweensOf(targets)
    expect(tweens).toHaveLength(1)
    const intersection = (isIntersecting: boolean) => notifyIntersection!([{ isIntersecting } as IntersectionObserverEntry], {} as IntersectionObserver)
    const expectPaused = (paused: boolean) => tweens.forEach(tween => expect(tween.paused()).toBe(paused))
    expectPaused(false)
    intersection(false); expectPaused(true)
    intersection(true); expectPaused(false)
    hidden.mockReturnValue(true)
    document.dispatchEvent(new Event('visibilitychange')); expectPaused(true)
    intersection(true); expectPaused(true)
    hidden.mockReturnValue(false)
    document.dispatchEvent(new Event('visibilitychange')); expectPaused(false)
    wrapper.unmount(); cleanups.pop()
    await flushPromises()
    expect(disconnect).toHaveBeenCalledOnce()
    expect(gsap.getTweensOf(targets)).toHaveLength(0)
    expect(surface.dispose).toHaveBeenCalledOnce()
  })
  it('keeps the image fixed, redraws the moving seam, and releases all tweens when leaving', async () => {
    const wrapper = mount(PrismaticBackdrop, { attachTo: document.body })
    cleanups.push(() => wrapper.unmount())
    const image = wrapper.get('img').element
    Object.defineProperty(image, 'naturalWidth', { value: 1672 })
    await wrapper.get('img').trigger('load')
    const surface = vi.mocked(createPrismaticSurface).mock.results.at(-1)!.value!
    expect(wrapper.get('canvas').classes()).toContain('is-ready')
    const seam = gsap.getTweensOf(surface)[0]!
    expect(seam.repeat()).toBe(-1)
    seam.pause().totalTime(1)
    const phase = surface.phase
    seam.totalTime(4)
    expect(surface.phase).not.toBe(phase)
    expect(surface.render).toHaveBeenCalled()
    expect(gsap.getTweensOf(image)).toHaveLength(0)
    wrapper.unmount(); cleanups.pop()
    await flushPromises()
    expect(gsap.getTweensOf(surface)).toHaveLength(0)
    expect(surface.dispose).toHaveBeenCalledOnce()
  })
})

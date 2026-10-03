import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createWebHistory, createRouter } from 'vue-router'
import { createPinia } from 'pinia'
import gsap from 'gsap'
import { Flip } from 'gsap/Flip'
import App from '../src/app/App.vue'
import { useAuthStore } from '../src/stores/auth.store'
import { router as productionRouter } from '../src/app/router'
import { createPrismaticSurface } from '../src/features/home/prismatic-surface'
vi.mock('../src/features/home/prismatic-surface', () => ({
  createPrismaticSurface: vi.fn(() => ({ phase: 0, render: vi.fn(), resize: vi.fn(), dispose: vi.fn() })),
}))
vi.mock('../src/animations/navigation/transitions', () => ({ animateStack: vi.fn(async () => {}), captureMotion: vi.fn(), settleScreens: vi.fn() }))
let unmount: (() => void) | undefined
beforeEach(() => {
  window.history.replaceState(null, '', '/')
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: { configurable: true, value(this: HTMLDialogElement) { this.setAttribute('open', '') } },
    close: { configurable: true, value(this: HTMLDialogElement) { this.removeAttribute('open') } },
  })
})
afterEach(() => { unmount?.(); unmount = undefined; document.body.innerHTML = ''; vi.restoreAllMocks() })
async function home(realTransition = false) {
  const router = createRouter({ history: createWebHistory(), routes: productionRouter.options.routes })
  await router.push('/'); await router.isReady()
  const pinia = createPinia()
  const wrapper = mount(App, { attachTo: document.body, global: { plugins: [router, pinia], stubs: realTransition ? { transition: false } : {} } })
  unmount = () => { wrapper.unmount(); router.options.history.destroy() }
  await flushPromises()
  await vi.waitFor(() => expect(wrapper.find('.landing-page').exists()).toBe(true))
  return { wrapper, router, pinia }
}
describe('guest landing and auth routing', () => {
  it('moves the same logo between Home, Auth and the Library sidebar, including rapid reversals', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    const { wrapper, router, pinia } = await home(true)
    const brand = wrapper.get('.app-brand').element
    const flip = vi.spyOn(Flip, 'from')
    const auth = useAuthStore(pinia)
    await router.push('/login'); await flushPromises()
    expect(wrapper.get('.app-brand').element).toBe(brand)
    auth.setSession({ user: { id: '1', displayName: 'Reader', email: 'reader@example.com' } })
    await router.push('/library'); await flushPromises()
    await vi.waitFor(() => expect(wrapper.find('.library-sidebar').exists()).toBe(true))
    await flushPromises()
    expect(wrapper.get('.app-brand-library').element).toBe(brand)
    expect(wrapper.findAll('.app-brand')).toHaveLength(1)
    expect(wrapper.find('.library-sidebar .brand').exists()).toBe(false)
    const logoFlips = () => flip.mock.calls.filter(call => call[1]?.targets === brand
      || Array.isArray(call[1]?.targets) && (call[1]!.targets as Element[]).includes(brand))
    expect(logoFlips()).toHaveLength(2)
    expect(logoFlips()[1]![1]!.targets).toEqual([brand, ...brand.querySelectorAll('.brand-icon, .brand-name, .brand-name > span')])

    auth.clearSession()
    await router.push('/login'); await flushPromises()
    expect(wrapper.get('.app-brand').element).toBe(brand)
    expect(wrapper.get('.app-brand').classes()).not.toContain('app-brand-library')
    await router.push('/'); await flushPromises()
    expect(wrapper.get('.app-brand-home').element).toBe(brand)
    expect(logoFlips()).toHaveLength(4)
    wrapper.findAll('.page-screen').forEach(page => gsap.getTweensOf(page.element).forEach(tween => tween.progress(1)))
    await flushPromises()
    expect(wrapper.findAll('.page-screen')).toHaveLength(1)
    unmount?.(); unmount = undefined
    expect(gsap.getTweensOf(brand)).toHaveLength(0)
  })

  it.each(['push', 'replace'] as const)('reveals Library beneath the sliding Auth page after login via %s', async method => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    const { wrapper, router, pinia } = await home(true)
    await router.push('/login'); await flushPromises()
    wrapper.findAll('.page-screen').forEach(page => gsap.getTweensOf(page.element).forEach(tween => tween.progress(1)))
    await flushPromises()
    const outgoing = wrapper.get('[data-page="auth"]').element as HTMLElement
    useAuthStore(pinia).setSession({ user: { id: '1', displayName: 'Reader', email: 'reader@example.com' } })
    await router[method]('/library'); await flushPromises()
    await vi.waitFor(() => expect(wrapper.find('[data-page="library"]').exists()).toBe(true))
    const incoming = wrapper.get('[data-page="library"]').element as HTMLElement
    expect(outgoing.style.zIndex).toBe('2')
    expect(incoming.style.zIndex).toBe('1')
    const leaving = gsap.getTweensOf(outgoing)[0]!
    const entering = gsap.getTweensOf(incoming)[0]!
    leaving.pause().progress(0.5)
    entering.pause().progress(0.5)
    expect(Number(gsap.getProperty(outgoing, 'xPercent'))).toBeGreaterThan(0)
    expect(Number(gsap.getProperty(outgoing, 'xPercent'))).toBeLessThan(100)
    expect(Number(gsap.getProperty(incoming, 'xPercent'))).toBeGreaterThan(-4)
    expect(Number(gsap.getProperty(incoming, 'xPercent'))).toBeLessThan(0)
    expect(Number(gsap.getProperty(incoming, 'scaleX'))).toBeGreaterThan(0.95)
    expect(Number(gsap.getProperty(incoming, 'scaleX'))).toBeLessThan(1)
    expect(outgoing.isConnected).toBe(true)
    leaving.progress(1); entering.progress(1)
    await flushPromises()
    expect(outgoing.isConnected).toBe(false)
    expect(incoming.style.transform).toBe('')
  })

  it('keeps the animated background running at its current phase until the outgoing Home is removed', async () => {
    const { wrapper, router } = await home(true)
    const homeScreen = wrapper.get('[data-page="home"]').element
    Object.defineProperty(wrapper.get('.landing-orb').element, 'naturalWidth', { value: 1672 })
    await wrapper.get('.landing-orb').trigger('load')
    const surface = vi.mocked(createPrismaticSurface).mock.results.at(-1)!.value!
    const seam = gsap.getTweensOf(surface)[0]!
    seam.pause().totalTime(8)
    const phase = surface.phase
    const frameCount = vi.mocked(surface.render).mock.calls.length
    await router.push('/login'); await flushPromises()
    const leaving = gsap.getTweensOf(homeScreen)[0]!
    leaving.pause().progress(0.4)
    expect(homeScreen.isConnected).toBe(true)
    expect(surface.phase).toBeCloseTo(phase)
    expect(surface.dispose).not.toHaveBeenCalled()
    expect(gsap.getTweensOf(surface)).toContain(seam)
    seam.totalTime(8.2)
    expect(surface.phase).toBeGreaterThan(phase)
    expect(vi.mocked(surface.render).mock.calls.length).toBeGreaterThan(frameCount)
    leaving.progress(1); await flushPromises()
    expect(homeScreen.isConnected).toBe(false)
    expect(surface.dispose).toHaveBeenCalledOnce()
    expect(gsap.getTweensOf(surface)).toHaveLength(0)
  })
  it.each(['/login', '/register'])('shows the landing after leaving %s with the real Vue transition', async path => {
    const { wrapper, router } = await home(true)
    const homeScreen = wrapper.get('[data-page="home"]').element
    await router.push(path)
    await vi.waitFor(() => expect(wrapper.find('.app-shell').exists()).toBe(true))
    const auth = wrapper.get('.app-shell').element
    expect(homeScreen.isConnected).toBe(true)
    expect(wrapper.findAll('.page-screen')).toHaveLength(2)
    wrapper.findAll('.page-screen').forEach(page => gsap.getTweensOf(page.element).forEach(tween => tween.progress(1)))
    expect(homeScreen.isConnected).toBe(false)
    await wrapper.get('.app-brand').trigger('click')
    await flushPromises()
    await vi.waitFor(() => expect(wrapper.find('.landing-page').exists()).toBe(true))
    const landing = wrapper.get('.landing-page').element as HTMLElement
    expect(auth.isConnected).toBe(true)
    expect(wrapper.findAll('.page-screen')).toHaveLength(2)
    wrapper.findAll('.page-screen').forEach(page => gsap.getTweensOf(page.element).forEach(tween => tween.progress(1)))
    expect(wrapper.get('#landing-title').text()).toContain('Một trang sách.')
    expect(landing.style.opacity).not.toBe('0')
    expect(landing.style.visibility).not.toBe('hidden')
    expect(auth.isConnected).toBe(false)
    Object.defineProperty(wrapper.get('.landing-orb').element, 'naturalWidth', { value: 1672 })
    await wrapper.get('.landing-orb').trigger('load')
    const surface = vi.mocked(createPrismaticSurface).mock.results.at(-1)!.value!
    const phase = surface.phase
    expect(gsap.getTweensOf(surface)[0]!.paused()).toBe(false)
    expect(gsap.getTweensOf(surface)[0]!.repeat()).toBe(-1)
    // Let the real ticker advance: a recreated Home must restart its background.
    await vi.waitFor(() => {
      expect(surface.phase).not.toBe(phase)
      expect(surface.render).toHaveBeenCalled()
    })
  })
  it('serves / as a guest landing with working registration and login destinations', async () => {
    const { wrapper, router } = await home()
    expect(router.currentRoute.value.path).toBe('/')
    expect(wrapper.get('.landing-login').attributes('href')).toBe('/login')
    expect(wrapper.get('.landing-start').attributes('href')).toBe('/register')
    await wrapper.get('.landing-start').trigger('click'); await flushPromises()
    expect(router.currentRoute.value.path).toBe('/register')
    expect(wrapper.find('.register-page').exists()).toBe(true)
  })
  it('finishes on the correct page when reversing navigation halfway through the slide', async () => {
    const { wrapper, router } = await home(true)
    Object.defineProperty(wrapper.get('.landing-orb').element, 'naturalWidth', { value: 1672 })
    await wrapper.get('.landing-orb').trigger('load')
    const outgoingSurface = vi.mocked(createPrismaticSurface).mock.results.at(-1)!.value!
    gsap.getTweensOf(outgoingSurface)[0]!.pause().totalTime(8)
    await router.push('/login'); await flushPromises()
    wrapper.findAll('.page-screen').forEach(page => gsap.getTweensOf(page.element).forEach(tween => tween.pause().progress(0.4)))
    await wrapper.get('.app-brand').trigger('click'); await flushPromises()
    expect(router.currentRoute.value.path).toBe('/')
    wrapper.findAll('.page-screen').forEach(page => gsap.getTweensOf(page.element).forEach(tween => tween.progress(1)))
    await flushPromises()
    expect(wrapper.findAll('.page-screen')).toHaveLength(1)
    const screen = wrapper.get('[data-page="home"]').element as HTMLElement
    expect(screen.style.transform).toBe('')
    expect(screen.style.pointerEvents).toBe('')
    expect(screen.style.zIndex).toBe('')
    expect(gsap.getTweensOf(screen)).toHaveLength(0)
    expect(wrapper.find('.app-shell').exists()).toBe(false)
    expect(outgoingSurface.phase).toBeGreaterThan(0)
    expect(outgoingSurface.dispose).toHaveBeenCalledOnce()
    expect(gsap.getTweensOf(outgoingSurface)).toHaveLength(0)
    Object.defineProperty(wrapper.get('.landing-orb').element, 'naturalWidth', { value: 1672 })
    await wrapper.get('.landing-orb').trigger('load')
    const incomingSurface = vi.mocked(createPrismaticSurface).mock.results.at(-1)!.value!
    expect(incomingSurface).not.toBe(outgoingSurface)
    expect(incomingSurface.dispose).not.toHaveBeenCalled()
    expect(gsap.getTweensOf(incomingSurface)).toHaveLength(1)
  })
  it('preserves the brand node and form navigation, removing auth panels immediately on return to /', async () => {
    const { wrapper, router } = await home()
    const brand = wrapper.get('.app-brand').element
    await wrapper.get('.landing-login').trigger('click'); await flushPromises()
    const authPanel = wrapper.get('.app-shell').element
    expect(wrapper.get('.app-brand').element).toBe(brand)
    await wrapper.get('.switch-page button').trigger('click'); await flushPromises()
    expect(router.currentRoute.value.path).toBe('/register')
    await wrapper.get('.register-page .back-link').trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/login'))
    await flushPromises()
    await wrapper.get('.app-brand').trigger('click'); await flushPromises()
    expect(router.currentRoute.value.path).toBe('/')
    expect(authPanel.isConnected).toBe(false)
    expect(wrapper.find('.auth-layout').exists()).toBe(false)
    expect(wrapper.find('.landing-page').exists()).toBe(true)
    expect(wrapper.get('.app-brand').element).toBe(brand)
  })
  it('opens and closes legal information from the landing', async () => {
    const { wrapper } = await home()
    await wrapper.get('.landing-footer button').trigger('click')
    expect(wrapper.get('dialog[aria-labelledby="info-title"]').attributes()).toHaveProperty('open')
    expect(wrapper.get('#info-title').text()).toBe('Điều khoản sử dụng')
    await wrapper.get('.dialog-close').trigger('click')
    expect(wrapper.get('dialog[aria-labelledby="info-title"]').attributes()).not.toHaveProperty('open')
  })
})

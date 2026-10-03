import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, ref, type Component } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { createPinia } from 'pinia'
import App from '../src/app/App.vue'
import { animateStack } from '../src/animations/navigation/transitions'
import NavigationStack from '../src/components/navigation/NavigationStack.vue'
import { useStackNavigation } from '../src/components/navigation/context'
vi.mock('../src/animations/navigation/transitions', () => ({
  animateStack: vi.fn(async () => {}),
  captureMotion: vi.fn(),
  settleScreens: vi.fn(),
}))
const Login = defineComponent({
  setup() { return { navigation: useStackNavigation(), text: ref('') } },
  template: '<div><h1 data-screen-title tabindex="-1">Login</h1><input aria-label="identity" v-model="text" /><button @click="navigation.push(\'/register\')">Register</button></div>',
})
const Register = defineComponent({
  setup() { return { navigation: useStackNavigation() } },
  template: '<div><h1 data-screen-title tabindex="-1">Register</h1><button @click="navigation.back()">Back</button></div>',
})
let cleanup: (() => void) | undefined
async function setup(path = '/login', root: Component = NavigationStack) {
  window.history.replaceState(null, '', path)
  const router = createRouter({ history: createWebHistory(), routes: [{ path: '/login', component: Login }, { path: '/register', component: Register }] })
  await router.push(path); await router.isReady()
  const wrapper = mount(root, { attachTo: document.body, global: { plugins: [router, createPinia()] } })
  cleanup = () => { wrapper.unmount(); router.options.history.destroy() }
  await flushPromises()
  return { wrapper, router }
}
afterEach(() => { cleanup?.(); cleanup = undefined; document.body.innerHTML = ''; localStorage.clear(); vi.unstubAllGlobals(); vi.clearAllMocks() })
describe('mounted navigation stack', () => {
  it('always animates with no motion toggle despite system and stored reduced settings', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    localStorage.setItem('moc:motion:v1', 'reduced')
    const { wrapper } = await setup('/login', App)
    expect(wrapper.find('header button').exists()).toBe(false)
    await wrapper.find('article button').trigger('click')
    await flushPromises()
    expect(animateStack).toHaveBeenCalled()
    expect(vi.mocked(animateStack).mock.lastCall![4]).toBe(false)
  })
  it('keeps login mounted and preserves its form when returning', async () => {
    const { wrapper, router } = await setup()
    const input = wrapper.find('input')
    await input.setValue('reader@example.com')
    const originalElement = input.element
    await wrapper.find('button').trigger('click'); await flushPromises(); await nextTick()
    expect(router.currentRoute.value.path).toBe('/register')
    expect(wrapper.findAll('article')).toHaveLength(2)
    expect(wrapper.findAll('article')[0]!.attributes()).toHaveProperty('inert')
    expect(wrapper.find('input').element).toBe(originalElement)
    expect((wrapper.find('input').element as HTMLInputElement).value).toBe('reader@example.com')
    router.back()
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/login'))
    await flushPromises()
    expect(wrapper.findAll('article')).toHaveLength(1)
    expect(wrapper.find('input').element).toBe(originalElement)
    expect((wrapper.find('input').element as HTMLInputElement).value).toBe('reader@example.com')
  })
  it('returns to login from a directly opened registration URL', async () => {
    const { wrapper, router } = await setup('/register')
    expect(wrapper.findAll('article')).toHaveLength(2)
    await wrapper.findAll('button')[1]!.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/login')
    expect(wrapper.findAll('article')).toHaveLength(1)
  })
  it('commits the next route and unlocks the screen if the animation fails', async () => {
    const report = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(animateStack).mockRejectedValueOnce(new Error('animation failed'))
    const { wrapper, router } = await setup()
    await wrapper.find('button').trigger('click'); await flushPromises()
    expect(router.currentRoute.value.path).toBe('/register')
    expect(wrapper.get('section').attributes('aria-busy')).toBe('false')
    expect(wrapper.findAll('article').at(-1)!.attributes('aria-hidden')).toBe('false')
    expect(report).toHaveBeenCalledOnce()
    report.mockRestore()
  })
  it('prevents repeated pushes and synchronizes browser Forward', async () => {
    const { wrapper, router } = await setup()
    await Promise.all([wrapper.find('button').trigger('click'), wrapper.find('button').trigger('click')])
    await flushPromises()
    expect(wrapper.findAll('article')).toHaveLength(2)
    router.back()
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/login'))
    await flushPromises()
    router.forward()
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/register'))
    await flushPromises()
    expect(wrapper.findAll('article')).toHaveLength(2)
  })
})



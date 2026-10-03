import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, ref, Transition, type Ref } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createWebHistory, RouterView } from 'vue-router'
import gsap from 'gsap'
import { useRouteDirection } from '../src/animations/composables/useRouteDirection'
import { usePageMotion } from '../src/animations/composables/usePageMotion'

const cleanups: (() => void)[] = []
afterEach(() => { cleanups.splice(0).forEach(cleanup => cleanup()); vi.restoreAllMocks() })
async function setup(realTransition = false) {
  window.history.replaceState(null, '', '/a')
  const Page = defineComponent({ render: () => h('div') })
  const router = createRouter({ history: createWebHistory(), routes: [
    ...['a', 'b', 'c', 'd'].map(name => ({ path: '/' + name, component: Page, meta: { layout: 'dashboard' } })),
    { path: '/', component: Page, meta: { layout: 'home' } },
    { path: '/login', component: Page, meta: { layout: 'auth' } },
    { path: '/register', component: Page, meta: { layout: 'auth' } },
  ] })
  await router.push('/a'); await router.isReady()
  let direction!: Ref<'push' | 'pop'>
  const Tracker = defineComponent({
    components: { RouterView, Transition },
    setup() {
      direction = useRouteDirection()
      const pages = usePageMotion(ref<HTMLElement>(), computed(() => true), direction)
      return { pages, realTransition }
    },
    template: `<RouterView v-if="realTransition" v-slot="{ Component, route }">
      <Transition :css="false" @enter="pages.enter" @leave="pages.leave"
        @enter-cancelled="pages.cancel" @leave-cancelled="pages.cancel">
        <div :key="route.path" :data-page="route.path"><component :is="Component" /></div>
      </Transition>
    </RouterView><div v-else />`,
  })
  const tracking = ref(true)
  const Host = defineComponent({ setup() { return () => tracking.value ? h(Tracker) : h('div') } })
  const wrapper = mount(Host, { global: { plugins: [router], stubs: { transition: !realTransition } } })
  cleanups.push(() => { wrapper.unmount(); router.options.history.destroy() })
  async function travel(delta: number, path: string) {
    router.go(delta)
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe(path))
    await flushPromises()
  }
  return { router, direction, travel, tracking, wrapper }
}

describe('page transition direction', () => {
  it('pops when returning to an open page through a link that calls router.push', async () => {
    const { router, direction } = await setup()
    await router.push('/b')
    expect(direction.value).toBe('push')
    const position = Number(router.options.history.state.position)
    await router.push('/a')
    expect(Number(router.options.history.state.position)).toBeGreaterThan(position)
    expect(direction.value).toBe('pop')
    await router.push('/b')
    expect(direction.value).toBe('push')
  })

  it('runs the real return animation with the outgoing page sliding above the incoming page', async () => {
    const { router, wrapper } = await setup(true)
    await router.push('/b'); await flushPromises()
    wrapper.findAll('[data-page]').forEach(page => gsap.getTweensOf(page.element).forEach(tween => tween.progress(1)))
    await flushPromises()
    const outgoing = wrapper.get('[data-page="/b"]').element as HTMLElement
    await router.push('/a'); await flushPromises()
    const incoming = wrapper.get('[data-page="/a"]').element as HTMLElement
    expect(outgoing.style.zIndex).toBe('2')
    expect(incoming.style.zIndex).toBe('1')
    const leaving = gsap.getTweensOf(outgoing)[0]!
    const entering = gsap.getTweensOf(incoming)[0]!
    leaving.pause().progress(.5); entering.pause().progress(.5)
    expect(Number(gsap.getProperty(outgoing, 'xPercent'))).toBeGreaterThan(0)
    expect(Number(gsap.getProperty(incoming, 'xPercent'))).toBeLessThan(0)
    expect(Number(gsap.getProperty(incoming, 'scaleX'))).toBeLessThan(1)
    leaving.progress(1); entering.progress(1)
    await flushPromises()
    expect(wrapper.findAll('[data-page]')).toHaveLength(1)
    expect(incoming.style.transform).toBe('')
  })

  it('pops to an earlier page and removes pages above it from the active chain', async () => {
    const { router, direction } = await setup()
    await router.push('/b'); await router.push('/c')
    await router.push('/a')
    expect(direction.value).toBe('pop')
    await router.push('/c')
    expect(direction.value).toBe('push')
  })

  it('uses Back/Forward direction even when link navigation has revisited a page', async () => {
    const { router, direction, travel } = await setup()
    await router.push('/b'); await router.push('/a')
    expect(direction.value).toBe('pop')
    await travel(-1, '/b')
    expect(direction.value).toBe('pop')
    await travel(1, '/a')
    expect(direction.value).toBe('push')
  })

  it('restores the active chain on browser history traversal before following another link', async () => {
    const { router, direction, travel } = await setup()
    await router.push('/b'); await router.push('/c'); await router.push('/a')
    await travel(-1, '/c')
    await router.push('/b')
    expect(direction.value).toBe('pop')
    await router.push('/c')
    expect(direction.value).toBe('push')
  })

  it('does not add aborted or duplicate navigation to the chain', async () => {
    const { router, direction } = await setup()
    const remove = router.beforeEach(to => to.path === '/b' ? false : undefined)
    await router.push('/b')
    await router.push('/c')
    expect(direction.value).toBe('push')
    await router.push('/c')
    expect(direction.value).toBe('push')
    remove()
    await router.push('/b')
    expect(direction.value).toBe('push')
    await router.push('/a')
    expect(direction.value).toBe('pop')
  })

  it('keeps query updates on the same page out of the page stack', async () => {
    const { router, direction } = await setup()
    await router.push('/a?filter=recent'); await router.push('/b')
    await router.push('/a?filter=favorites')
    expect(direction.value).toBe('pop')
    await router.push('/b')
    expect(direction.value).toBe('push')
  })

  it('uses pop for a return through replace and push for a new destination', async () => {
    const { router, direction } = await setup()
    await router.push('/b'); await router.replace('/a')
    expect(direction.value).toBe('pop')
    await router.replace('/d')
    expect(direction.value).toBe('push')
  })

  it('preserves Auth above base pages with push or replace', async () => {
    const { router, direction } = await setup()
    await router.push('/login'); await router.push('/register')
    await router.replace('/b')
    expect(direction.value).toBe('pop')
    await router.push('/login')
    expect(direction.value).toBe('push')
  })

  it('unregisters both router hooks and history listeners when unmounted', async () => {
    const { router, direction, travel, tracking } = await setup()
    await router.push('/b')
    tracking.value = false
    await flushPromises()
    const previous = direction.value
    await travel(-1, '/a')
    await router.push('/c')
    expect(direction.value).toBe(previous)
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createPinia } from 'pinia'
import { Flip } from 'gsap/Flip'
import LibrarySidebar from '../src/features/library/components/LibrarySidebar.vue'
import { useAuthStore } from '../src/stores/auth.store'

const request = vi.fn()
vi.mock('../src/services/api-client', () => ({ createApiClient: () => ({ request }) }))

enableAutoUnmount(afterEach)

describe('LibrarySidebar Auto Motion', () => {
  beforeEach(() => {
    request.mockReset().mockResolvedValue({})
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('moves the active icon identity between sidebar destinations', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/library', component: { template: '<div />' } },
        { path: '/library/bookshelf', component: { template: '<div />' } },
      ],
    })
    await router.push('/library')
    const pinia = createPinia()
    useAuthStore(pinia).setSession({ user: { id: 'user-1', displayName: 'Reader', email: 'reader@example.com' } })
    const flip = vi.spyOn(Flip, 'from')
    const wrapper = mount(LibrarySidebar, { attachTo: document.body, global: { plugins: [router, pinia] } })
    await flushPromises()

    expect(wrapper.get('[title="Tổng quan"] .nav-icon').attributes('data-motion-key')).toBe('sidebar:active-icon')
    await wrapper.get('[title="Tủ sách"]').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/library/bookshelf')
    expect(wrapper.get('[title="Tủ sách"] .nav-icon').attributes('data-motion-key')).toBe('sidebar:active-icon')
    expect(wrapper.get('[title="Tổng quan"] .nav-icon').attributes('data-motion-key')).toBeUndefined()
    expect(flip).toHaveBeenCalled()
  })
})

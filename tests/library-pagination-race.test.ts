import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import LibraryPage from '../src/features/library/pages/LibraryPage.vue'
import { libraryStories } from './fixtures/library-stories'

const request = vi.fn()
vi.mock('../src/services/api-client', () => ({
  createApiClient: () => ({ request: (...args: unknown[]) => request(...args) }),
}))
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('library stale pagination response guard', () => {
  it('does not append an old page after the reader changes their search', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    let runObserver!: () => void
    class StubObserver {
      constructor(cb: IntersectionObserverCallback) {
        runObserver = () => cb([{ isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver)
      }
      observe() {}
      disconnect() {}
    }
    vi.stubGlobal('IntersectionObserver', StubObserver)
    let resolveOldPage!: (value: {items: typeof libraryStories; hasMore: boolean; nextPage: number}) => void
    const oldPage = new Promise<{items: typeof libraryStories; hasMore: boolean; nextPage: number}>(resolve => {
      resolveOldPage = resolve
    })
    request.mockImplementation(async (path: string) => {
      if (path === '/api/favorites/ids') return { ids: [] }
      if (path.includes('page=2')) return oldPage
      if (path.includes('&q=')) return { items: [], hasMore: false, nextPage: 0 }
      if (path.includes('paginated=true')) return { items: libraryStories, hasMore: true, nextPage: 2 }
      throw Error('Unexpected request: ' + path)
    })
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/library', component: LibraryPage }],
    })
    await router.push('/library')
    await router.isReady()
    const wrapper = mount(LibraryPage, {
      attachTo: document.body,
      global: { plugins: [createPinia(), router] },
    })
    try {
      await flushPromises()
      expect(wrapper.findAll('.deck-title').length).toBe(libraryStories.length)
      runObserver()
      await flushPromises()
      expect(request.mock.calls.some(call => String(call[0]).includes('page=2'))).toBe(true)

      await wrapper.get('input[type="search"]').setValue('unmatched-needle')
      await new Promise(resolve => setTimeout(resolve, 360))
      await flushPromises()
      expect(wrapper.find('.empty-state').exists()).toBe(true)

      // Resolve the older response only after the new search has completed.
      resolveOldPage({ items: libraryStories, hasMore: false, nextPage: 0 })
      await flushPromises()
      expect(wrapper.findAll('.deck-title')).toHaveLength(0)
      expect(wrapper.find('.empty-state').exists()).toBe(true)
    } finally {
      wrapper.unmount()
    }
  })
})

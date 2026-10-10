import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import LibraryPage from '../src/features/library/pages/LibraryPage.vue'

enableAutoUnmount(afterEach)
const api = vi.fn()
const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } })
const first = { id: 'first', userId: 'author', title: 'Truyện đầu tiên', status: 'published', chapterCount: 2, coverUrl: '/a.jpg' }
const later = { id: 'later', userId: 'author', title: 'Truyện ở trang sau', status: 'published', chapterCount: 2, coverUrl: '/b.jpg' }
let favorites: string[]

beforeEach(() => {
  favorites = []
  api.mockReset()
  vi.stubGlobal('fetch', api)
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  api.mockImplementation((path: string, options?: RequestInit) => {
    if (path === '/api/favorites/ids') return Promise.resolve(json({ ids: favorites }))
    if (path.startsWith('/api/favorites/') && options?.method === 'POST') {
      favorites.push(decodeURIComponent(path.split('/').at(-1)!))
      return Promise.resolve(new Response(null, { status: 204 }))
    }
    if (path.startsWith('/api/favorites/') && options?.method === 'DELETE') {
      favorites = favorites.filter(id => id !== decodeURIComponent(path.split('/').at(-1)!))
      return Promise.resolve(new Response(null, { status: 204 }))
    }
    if (path.startsWith('/api/favorites?')) return Promise.resolve(json({ items: favorites.includes(first.id) ? [first] : [], hasMore: false }))
    if (path.startsWith('/api/stories?')) {
      const query = new URL(path, 'https://test.invalid').searchParams.get('q')
      return Promise.resolve(json({ items: query ? (query === 'trang sau' ? [later] : []) : [first], hasMore: false }))
    }
    return Promise.resolve(json(first))
  })
})
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

async function setup() {
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/library', component: LibraryPage },
    { path: '/library/stories/:id', component: { template: '<div />' } },
  ] })
  await router.push('/library')
  const wrapper = mount(LibraryPage, { global: { plugins: [createPinia(), router], stubs: { AmbientBackdrop: true, LibrarySidebar: false } } })
  await flushPromises()
  return { wrapper, router }
}

describe('catalog search and saved stories', () => {
  it('queries the server for a story outside the first loaded page', async () => {
    const { wrapper } = await setup()
    expect(wrapper.text()).toContain('Truyện đầu tiên')
    await wrapper.get('input[aria-label="Tìm kiếm tên truyện hoặc thẻ"]').setValue('trang sau')
    await new Promise(resolve => setTimeout(resolve, 370))
    await flushPromises()
    expect(api).toHaveBeenCalledWith(expect.stringContaining('q=trang%20sau'), expect.anything())
    expect(wrapper.text()).toContain('Truyện ở trang sau')
    expect(wrapper.text()).not.toContain('Truyện đầu tiên')
  })

  it('saves, lists and removes a story for the authenticated account', async () => {
    const { wrapper, router } = await setup()
    await wrapper.get('.save-deck').trigger('click')
    await flushPromises()
    expect(favorites).toEqual(['first'])
    expect(wrapper.get('.save-deck').attributes('aria-pressed')).toBe('true')
    await router.push('/library?tab=saved')
    await flushPromises()
    expect(wrapper.text()).toContain('Truyện đầu tiên')
    await wrapper.get('.save-deck').trigger('click')
    await flushPromises()
    expect(favorites).toEqual([])
    expect(wrapper.find('.deck-card').exists()).toBe(false)
  })
})

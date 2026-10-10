import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import NotificationsPage from '../src/features/library/pages/NotificationsPage.vue'

const request = vi.fn()
vi.mock('../src/services/api-client', () => ({
  createApiClient: () => ({ request: (...args: unknown[]) => request(...args) }),
}))
vi.mock('../src/features/library/components/LibrarySidebar.vue', () => ({
  default: { template: '<aside>Thư viện</aside>' },
}))
beforeEach(() => {
  request.mockReset()
  request.mockImplementation(async (path: string, options?: RequestInit) => {
    if (path === '/api/notifications/muted') return { ids: [] }
    if (path === '/api/notifications') return {
      items: [{
        chapterId: 'new-chapter', storyId: 'auto-story', storyTitle: 'Truyện đang đọc',
        chapterTitle: 'Chương mới nhất', read: false, createdAt: new Date().toISOString(),
      }],
    }
    if (path === '/api/notifications/mute/auto-story' && options?.method === 'POST') return undefined
    if (path === '/api/notifications/mute/auto-story' && options?.method === 'DELETE') return undefined
    if (path === '/api/notifications/new-chapter/read' && options?.method === 'PUT') return undefined
    throw Error('Unexpected request ' + path)
  })
})
afterEach(() => vi.restoreAllMocks())

async function setup() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/library/notifications', component: NotificationsPage },
      { path: '/library/stories/:id', component: { template: '<div />' } },
    ],
  })
  await router.push('/library/notifications')
  await router.isReady()
  const wrapper = mount(NotificationsPage, { global: { plugins: [router] } })
  await flushPromises()
  return { wrapper, router }
}

describe('smart chapter notifications', () => {
  it('shows automatically detected chapter alerts even without following', async () => {
    const { wrapper } = await setup()
    expect(wrapper.text()).toContain('đang đọc gần đây')
    expect(wrapper.text()).toContain('Chương mới nhất')
    expect(wrapper.text()).toContain('Truyện đang đọc')
    expect(request).toHaveBeenCalledWith('/api/notifications')
  })
  it('allows muting and unmuting a story from the notification inbox', async () => {
    const { wrapper } = await setup()
    await wrapper.get('button[aria-label="Tắt thông báo truyện Truyện đang đọc"]').trigger('click')
    await flushPromises()
    expect(request).toHaveBeenCalledWith('/api/notifications/mute/auto-story', { method: 'POST' })
    await wrapper.get('button[aria-label="Bật lại thông báo truyện Truyện đang đọc"]').trigger('click')
    await flushPromises()
    expect(request).toHaveBeenCalledWith('/api/notifications/mute/auto-story', { method: 'DELETE' })
  })
  it('marks an alert read and opens its chapter', async () => {
    const { wrapper, router } = await setup()
    await wrapper.get('.notification').trigger('click')
    await flushPromises()
    expect(request).toHaveBeenCalledWith('/api/notifications/new-chapter/read', { method: 'PUT' })
    expect(router.currentRoute.value.path).toBe('/library/stories/auto-story')
    expect(router.currentRoute.value.query.chapter).toBe('new-chapter')
  })
})

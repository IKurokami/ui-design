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

let inbox: { chapterId: string; storyId: string; storyTitle: string; chapterTitle: string; read: boolean; createdAt: string }[]
let muted: { storyId: string; storyTitle: string }[]
beforeEach(() => {
  inbox = [{
    chapterId: 'new-chapter', storyId: 'auto-story', storyTitle: 'Truyện đang đọc',
    chapterTitle: 'Chương mới nhất', read: false, createdAt: new Date().toISOString(),
  }]
  muted = []
  request.mockReset()
  request.mockImplementation(async (path: string, options?: RequestInit) => {
    if (path === '/api/notifications/muted/stories') return { items: [...muted] }
    if (path === '/api/notifications' && options?.method === 'DELETE') { inbox = []; return undefined }
    if (path === '/api/notifications') return { items: [...inbox] }
    if (path === '/api/notifications/mute/auto-story' && options?.method === 'POST') {
      muted = [{ storyId: 'auto-story', storyTitle: 'Truyện đang đọc' }]
      inbox = inbox.filter(entry => entry.storyId !== 'auto-story')
      return undefined
    }
    if (path === '/api/notifications/mute/auto-story' && options?.method === 'DELETE') {
      muted = []; return undefined
    }
    if (path === '/api/notifications/new-chapter/read' && options?.method === 'PUT') return undefined
    if (path === '/api/notifications/new-chapter' && options?.method === 'DELETE') {
      inbox = []; return undefined
    }
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

describe('manual notification management', () => {
  it('shows smart notifications even without following a story', async () => {
    const { wrapper } = await setup()
    expect(wrapper.text()).toContain('đang đọc gần đây')
    expect(wrapper.text()).toContain('Chương mới nhất')
    expect(wrapper.text()).toContain('Truyện đang đọc')
    expect(request).toHaveBeenCalledWith('/api/notifications')
  })
  it('cancels all alerts from a chosen story and allows the reader to re-enable it', async () => {
    const { wrapper } = await setup()
    await wrapper.get('button[aria-label="Hủy nhận thông báo từ truyện Truyện đang đọc"]').trigger('click')
    await flushPromises()
    expect(request).toHaveBeenCalledWith('/api/notifications/mute/auto-story', { method: 'POST' })
    expect(wrapper.find('.notification').exists()).toBe(false)
    expect(wrapper.text()).toContain('Truyện đã hủy nhận thông báo')
    expect(wrapper.text()).toContain('Các chương mới cũng sẽ không gửi thông báo')
    await wrapper.get('button[aria-label="Bật lại thông báo truyện Truyện đang đọc"]').trigger('click')
    await flushPromises()
    expect(request).toHaveBeenCalledWith('/api/notifications/mute/auto-story', { method: 'DELETE' })
    expect(wrapper.find('.muted-list').exists()).toBe(false)
  })
  it('lets a reader dismiss one message without cancelling future notifications', async () => {
    const { wrapper } = await setup()
    await wrapper.get('button[aria-label="Xóa thông báo Chương mới nhất của truyện Truyện đang đọc"]').trigger('click')
    await flushPromises()
    expect(request).toHaveBeenCalledWith('/api/notifications/new-chapter', { method: 'DELETE' })
    expect(request).not.toHaveBeenCalledWith('/api/notifications/mute/auto-story', expect.anything())
    expect(wrapper.text()).toContain('Các chương mới vẫn có thể được gửi')
    expect(wrapper.find('.notification').exists()).toBe(false)
  })
  it('clears the inbox after user confirmation without disabling notifications', async () => {
    const { wrapper } = await setup()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    await wrapper.get('button').trigger('mouseenter')
    await wrapper.get('.inbox-actions button').trigger('click')
    await flushPromises()
    expect(confirm).toHaveBeenCalledOnce()
    expect(request).toHaveBeenCalledWith('/api/notifications', { method: 'DELETE' })
    expect(request).not.toHaveBeenCalledWith('/api/notifications/mute/auto-story', expect.anything())
    expect(wrapper.find('.notification').exists()).toBe(false)
  })
  it('opens a chapter and marks it read', async () => {
    const { wrapper, router } = await setup()
    await wrapper.get('.notification').trigger('click')
    await flushPromises()
    expect(request).toHaveBeenCalledWith('/api/notifications/new-chapter/read', { method: 'PUT' })
    expect(router.currentRoute.value.path).toBe('/library/stories/auto-story')
    expect(router.currentRoute.value.query.chapter).toBe('new-chapter')
  })
  it('preserves cancelled stories across inbox reloads', async () => {
    muted = [{ storyId: 'auto-story', storyTitle: 'Truyện đang đọc' }]
    inbox = []
    const { wrapper } = await setup()
    expect(wrapper.text()).toContain('Truyện đã hủy nhận thông báo')
    expect(wrapper.find('button[aria-label="Bật lại thông báo truyện Truyện đang đọc"]').exists()).toBe(true)
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createPinia } from 'pinia'
import NotificationsPopover from '../src/features/library/components/NotificationsPopover.vue'
import LibrarySidebar from '../src/features/library/components/LibrarySidebar.vue'
import { useAuthStore } from '../src/stores/auth.store'

const request = vi.fn()
vi.mock('../src/services/api-client', () => ({
  createApiClient: () => ({ request: (...args: unknown[]) => request(...args) }),
}))

interface InboxItem {
  storyId: string
  storyTitle: string
  chapterId: string
  chapterTitle: string
  createdAt: string
  read: boolean
}
interface MutedItem { storyId: string; storyTitle: string }
const mounted: { unmount: () => void }[] = []
let inbox: InboxItem[]
let blocked: MutedItem[]

beforeEach(() => {
  inbox = [
    { storyId: 'story-one', chapterId: 'new-one', storyTitle: 'Truyện đang đọc',
      chapterTitle: 'Chương mới nhất', createdAt: new Date().toISOString(), read: false },
    { storyId: 'story-two', chapterId: 'older-two', storyTitle: 'Truyện khác',
      chapterTitle: 'Chương đã đọc', createdAt: new Date().toISOString(), read: true },
  ]
  blocked = []
  vi.stubGlobal('matchMedia', () => ({
    matches: true, addEventListener() {}, removeEventListener() {},
  }))
  request.mockReset()
  request.mockImplementation(async (path: string, options?: RequestInit) => {
    if (path === '/api/profile/me') return {}
    if (path === '/api/notifications/muted/stories') return { items: [...blocked] }
    if (path === '/api/notifications' && options?.method === 'DELETE') { inbox = []; return undefined }
    if (path === '/api/notifications') return { items: [...inbox] }
    if (path.startsWith('/api/notifications/mute/') && options?.method === 'POST') {
      const storyId = decodeURIComponent(path.split('/').pop() ?? '')
      const story = inbox.find(item => item.storyId === storyId)
      if (story) blocked.push({ storyId, storyTitle: story.storyTitle })
      inbox = inbox.filter(item => item.storyId !== storyId)
      return undefined
    }
    if (path.startsWith('/api/notifications/mute/') && options?.method === 'DELETE') {
      blocked = blocked.filter(item => item.storyId !== path.split('/').pop())
      return undefined
    }
    if (path.endsWith('/read') && options?.method === 'PUT') {
      const id = path.split('/')[3]
      inbox = inbox.map(item => item.chapterId === id ? { ...item, read: true } : item)
      return undefined
    }
    if (path.startsWith('/api/notifications/') && options?.method === 'DELETE') {
      inbox = inbox.filter(item => item.chapterId !== path.split('/').pop())
      return undefined
    }
    throw Error('Unexpected API request ' + path)
  })
})
afterEach(() => {
  mounted.splice(0).forEach(wrapper => wrapper.unmount())
  document.body.innerHTML = ''
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function button(label: string) {
  const found = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(el => el.getAttribute('aria-label') === label)
  if (!found) throw Error('Missing button: ' + label)
  return found
}
function labeledText(text: string) {
  const found = Array.from(document.querySelectorAll<HTMLButtonElement>('.popover-tabs button')).find(el => el.textContent?.includes(text))
  if (!found) throw Error('Missing tab: ' + text)
  return found
}
async function setup() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/library', component: { template: '<div />' } },
      { path: '/library/stories/:id', component: { template: '<div />' } },
    ],
  })
  await router.push('/library')
  await router.isReady()
  const wrapper = mount(NotificationsPopover, { attachTo: document.body, global: { plugins: [router] } })
  mounted.push(wrapper)
  await flushPromises()
  return { wrapper, router }
}

describe('sidebar notification popover', () => {
  it('renders a compact dialog, unread count and filters without opening another page', async () => {
    const { router } = await setup()
    expect(document.querySelector('.notification-popover')?.getAttribute('role')).toBe('dialog')
    expect(document.querySelector('.unread-pill')?.textContent).toBe('1')
    expect(document.querySelector('.notification-items')?.textContent).toContain('Truyện đang đọc')
    expect(document.querySelector('.notification-items')?.textContent).toContain('Truyện khác')
    labeledText('Chưa đọc').click()
    await flushPromises()
    expect(document.querySelectorAll('.notification-items li').length).toBe(1)
    expect(router.currentRoute.value.path).toBe('/library')
  })

  it('marks a notification read and goes directly to the corresponding chapter', async () => {
    const { wrapper, router } = await setup()
    button('Đọc Chương mới nhất của Truyện đang đọc').click()
    await flushPromises()
    expect(request).toHaveBeenCalledWith('/api/notifications/new-one/read', { method: 'PUT' })
    expect(wrapper.emitted('close')?.length).toBe(1)
    expect(wrapper.emitted('unreadChange')?.at(-1)).toEqual([0])
    expect(router.currentRoute.value.path).toBe('/library/stories/story-one')
    expect(router.currentRoute.value.query.chapter).toBe('new-one')
  })

  it('lets readers block a selected story and later enable it again', async () => {
    await setup()
    button('Tùy chọn thông báo Chương mới nhất').click()
    await flushPromises()
    button('Hủy nhận thông báo từ truyện Truyện đang đọc').click()
    await flushPromises()
    expect(request).toHaveBeenCalledWith('/api/notifications/mute/story-one', { method: 'POST' })
    expect(document.querySelector('.notification-items')?.textContent).not.toContain('Truyện đang đọc')
    labeledText('Đã chặn').click()
    await flushPromises()
    expect(document.querySelector('.muted-stories')?.textContent).toContain('Truyện đang đọc')
    button('Bật lại thông báo truyện Truyện đang đọc').click()
    await flushPromises()
    expect(request).toHaveBeenCalledWith('/api/notifications/mute/story-one', { method: 'DELETE' })
    expect(document.querySelector('.muted-stories')).toBeNull()
  })

  it('deletes one message separately from stopping future messages', async () => {
    await setup()
    button('Tùy chọn thông báo Chương mới nhất').click()
    await flushPromises()
    button('Xóa thông báo Chương mới nhất').click()
    await flushPromises()
    expect(request).toHaveBeenCalledWith('/api/notifications/new-one', { method: 'DELETE' })
    expect(document.querySelector('.notification-items')?.textContent).toContain('Truyện khác')
    expect(document.querySelector('.notification-items')?.textContent).not.toContain('Truyện đang đọc')
    expect(request).not.toHaveBeenCalledWith('/api/notifications/mute/story-one', expect.anything())
  })

  it('requires confirmation before clearing all inbox messages', async () => {
    await setup()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    button('Đóng thông báo') // close control is available
    const clear = Array.from(document.querySelectorAll<HTMLButtonElement>('.list-caption button')).find(el => el.textContent?.includes('Xóa tất cả'))
    expect(clear).toBeDefined()
    clear?.click()
    await flushPromises()
    expect(request).not.toHaveBeenCalledWith('/api/notifications', { method: 'DELETE' })
    confirm.mockReturnValue(true)
    clear?.click()
    await flushPromises()
    expect(request).toHaveBeenCalledWith('/api/notifications', { method: 'DELETE' })
    expect(document.querySelector('.notification-items')).toBeNull()
  })

  it('closes when clicking outside or pressing Escape', async () => {
    const { wrapper } = await setup()
    document.querySelector<HTMLElement>('.notification-outside')?.click()
    expect(wrapper.emitted('close')?.length).toBe(1)
    document.querySelector<HTMLElement>('.notification-popover')?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    )
    await flushPromises()
    expect(wrapper.emitted('close')?.length).toBe(2)
  })

  it('shows previously blocked stories even with an empty inbox', async () => {
    blocked = [{ storyId: 'story-one', storyTitle: 'Truyện đang đọc' }]
    inbox = []
    await setup()
    labeledText('Đã chặn').click()
    await flushPromises()
    expect(document.querySelector('.muted-stories')?.textContent).toContain('Truyện đang đọc')
    button('Bật lại thông báo truyện Truyện đang đọc').click()
    await flushPromises()
    expect(request).toHaveBeenCalledWith('/api/notifications/mute/story-one', { method: 'DELETE' })
  })

  it('opens from the sidebar bell with an unread badge instead of navigating', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/library', component: { template: '<div />' } }],
    })
    await router.push('/library')
    await router.isReady()
    const pinia = createPinia()
    useAuthStore(pinia).setSession({ user: { id: 'reader', displayName: 'Reader', email: 'reader@example.com' } })
    const wrapper = mount(LibrarySidebar, { attachTo: document.body, global: { plugins: [router, pinia] } })
    mounted.push(wrapper)
    await flushPromises()
    expect(wrapper.find('.notification-badge').text()).toBe('1')
    await wrapper.get('button[aria-label="Thông báo"]').trigger('click')
    await flushPromises()
    expect(document.querySelector('.notification-popover')).not.toBeNull()
    expect(router.currentRoute.value.path).toBe('/library')
    document.querySelector<HTMLElement>('.notification-outside')?.click()
    await flushPromises()
    expect(document.querySelector('.notification-popover')).toBeNull()
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import LibraryPage from '../src/features/library/pages/LibraryPage.vue'
import { libraryStories } from './fixtures/library-stories'

const request = vi.fn()
enableAutoUnmount(afterEach)
beforeEach(() => {
  request.mockReset()
  vi.stubGlobal('fetch', (path: string, options?: RequestInit) => path === '/api/favorites/ids' ? Promise.resolve(response({ ids: [] })) : request(path, options))
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json' },
})
async function library() {
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/library', component: LibraryPage },
    { path: '/library/stories/:id', component: { template: '<div />' } },
  ] })
  await router.push('/library')
  const wrapper = mount(LibraryPage, { global: { plugins: [createPinia(), router] } })
  return { wrapper, router }
}

describe('Library backend integration', () => {
  it('uses the real transport and derives counts and categories from the API response', async () => {
    request.mockResolvedValueOnce(response(libraryStories))
    const { wrapper, router } = await library()
    await flushPromises()
    expect(request).toHaveBeenCalledWith('/api/stories?paginated=true&page=1&pageSize=24', expect.objectContaining({ credentials: 'include' }))
    expect(wrapper.findAll('.deck-card')).toHaveLength(3)
    const images = wrapper.findAll('.deck-card').find(card => card.text().includes('An'))!.findAll('img').map(image => image.attributes('src'))
    expect(new Set(images)).toEqual(new Set(['/uploads/a.jpg', '/uploads/a-scene-1.jpg', '/uploads/a-scene-2.jpg']))
    expect(wrapper.get('.header-stats').text()).toBe('3 bộ truyện')
    expect(wrapper.get('[data-category="category:Kỳ Ảo"]').text()).toBe('Kỳ Ảo')
    expect(wrapper.text()).not.toContain('minh họa')
    await wrapper.get('[data-category="category:Đời Thường"]').trigger('click')
    expect(wrapper.get('.header-stats').text()).toBe('1 bộ truyện')
    expect(wrapper.get('.deck-stats').text()).toBe('0 chương')
    await wrapper.get('.deck-card').trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/library/stories/story-c')
  })

  it('keeps an empty database empty and displays a cover placeholder when no cover is stored', async () => {
    request.mockResolvedValueOnce(response([]))
    const { wrapper } = await library()
    await flushPromises()
    expect(wrapper.findAll('.deck-card')).toHaveLength(0)
    expect(wrapper.get('.empty-state').text()).toContain('Không tìm thấy truyện')
    expect(request).toHaveBeenCalledTimes(1)
    wrapper.unmount()
    request.mockResolvedValueOnce(response([{ id: 'empty', userId: 'author', title: 'Chưa có bìa', chapterCount: 0 }]))
    const { wrapper: second } = await library()
    await flushPromises()
    expect(second.find('.cover-placeholder').exists()).toBe(true)
    expect(second.find('.deck-stack img').exists()).toBe(false)
    expect(second.get('.deck-stats').text()).toBe('0 chương')
  })

  it('distinguishes loading and failure from an empty library and lets the user retry', async () => {
    let finish!: (value: Response) => void
    request.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const { wrapper } = await library()
    expect(wrapper.find('[aria-label="Đang tải thư viện"]').exists()).toBe(true)
    expect(wrapper.find('.empty-state').exists()).toBe(false)
    finish(response({ message: 'Không thể tải' }, 500))
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('Hệ thống đang bận')
    expect(wrapper.find('.empty-state').exists()).toBe(false)
    request.mockResolvedValueOnce(response(libraryStories))
    await wrapper.get('[role="alert"] button').trigger('click')
    await flushPromises()
    expect(wrapper.findAll('.deck-card')).toHaveLength(3)
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })

  it('loads the current account reading history when the reading tab is opened', async () => {
    request.mockResolvedValueOnce(response(libraryStories))
    const { wrapper, router } = await library()
    await flushPromises()
    request.mockResolvedValueOnce(response([{ ...libraryStories[0], readingProgress: { chapterId: 'c1', chapterNumber: 1, chapterTitle: 'Chương đầu', updatedAt: '2026-10-04T08:20:00Z' } }]))
    await router.push('/library?tab=reading')
    await flushPromises()
    expect(request).toHaveBeenLastCalledWith('/api/stories?reading=true&paginated=true&page=1&pageSize=24', expect.objectContaining({ credentials: 'include' }))
    expect(wrapper.findAll('.reading-entry')).toHaveLength(1)
    expect(wrapper.find('.deck-card').exists()).toBe(false)
    expect(wrapper.find('.library-sticky-header').exists()).toBe(false)
    expect(wrapper.get('.reading-chapter').text()).toContain('Chương đầu')
    expect(wrapper.text()).toContain('Đang đọc')
  })

  it('gets distinct images from real detail responses when the running list API has no preview field', async () => {
    request.mockResolvedValueOnce(response([{ id: 'legacy', userId: 'author', title: 'Truyện nhiều ảnh', coverUrl: '/uploads/cover.jpg', chapterCount: 3 }]))
    request.mockResolvedValueOnce(response({ id: 'legacy', userId: 'author', title: 'Truyện nhiều ảnh', coverUrl: '/uploads/cover.jpg', chapters: [
      { id: 'c1', storyId: 'legacy', chapterNumber: 1, title: 'Một', illustrations: '["/uploads/cover.jpg", "/uploads/scene-1.jpg"]', content: '<p><img src="/uploads/scene-2.jpg"></p>' },
    ] }))
    const { wrapper } = await library()
    await flushPromises()
    expect(request).toHaveBeenCalledWith('/api/stories/legacy', expect.objectContaining({ credentials: 'include' }))
    const images = wrapper.findAll('.deck-card img').map(image => image.attributes('src'))
    expect(images).toHaveLength(3)
    expect(new Set(images)).toEqual(new Set(['/uploads/cover.jpg', '/uploads/scene-1.jpg', '/uploads/scene-2.jpg']))
  })

  it('keeps three cover layers if additional images cannot be loaded', async () => {
    request.mockResolvedValueOnce(response([{ id: 'single', userId: 'author', title: 'Một ảnh', coverUrl: '/uploads/only.jpg', chapterCount: 2 }]))
    request.mockResolvedValueOnce(response({ message: 'Không thể tải' }, 500))
    const { wrapper } = await library()
    await flushPromises()
    expect(wrapper.findAll('.deck-card img').map(image => image.attributes('src'))).toEqual(['/uploads/only.jpg', '/uploads/only.jpg', '/uploads/only.jpg'])
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })
})

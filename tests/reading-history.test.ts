import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import LibraryPage from '../src/features/library/pages/LibraryPage.vue'
import type { Story } from '../src/features/library/types'

enableAutoUnmount(afterEach)
const request = vi.fn()
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
const date = (day: number, hour: number) => new Date(2026, 9, day, hour, 30).toISOString()
const stories: Story[] = [
  { id: 'old', userId: 'author', title: 'Truyện đọc hôm qua', authorName: 'Tác giả A', createdAt: date(4, 18), coverUrl: '/uploads/old.jpg', readingProgress: { chapterId: 'old-3', chapterNumber: 3, chapterTitle: 'Khu rừng', updatedAt: date(3, 20) } },
  { id: 'earlier', userId: 'author', title: 'Truyện đọc buổi sáng', coverUrl: '/uploads/morning.jpg', readingProgress: { chapterId: 'earlier-1', chapterNumber: 1, chapterTitle: 'Khởi đầu', updatedAt: date(4, 8) } },
  { id: 'latest', userId: 'author', title: 'Truyện vừa đọc', authorName: 'Tác giả B', createdAt: date(1, 8), coverUrl: '/uploads/latest.jpg', readingProgress: { chapterId: 'latest-2', chapterNumber: 2, chapterTitle: 'Chuyến đi', updatedAt: date(4, 15) } },
]
beforeEach(() => { request.mockReset(); vi.stubGlobal('fetch', request) })
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })
async function readingPage() {
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/library', component: LibraryPage },
    { path: '/library/stories/:id', component: { template: '<div />' } },
  ] })
  await router.push('/library?tab=reading')
  const wrapper = mount(LibraryPage, { global: { plugins: [router], stubs: { LibrarySidebar: true, AmbientBackdrop: true } } })
  await flushPromises()
  return { wrapper, router }
}

describe('Reading history', () => {
  it('groups real reading dates and sorts by last read, regardless of story creation date', async () => {
    request.mockResolvedValue(json(stories))
    const { wrapper, router } = await readingPage()
    expect(request).toHaveBeenCalledTimes(1)
    expect(request).toHaveBeenCalledWith('/api/stories?reading=true', expect.objectContaining({ credentials: 'include' }))
    expect(wrapper.find('.deck-grid').exists()).toBe(false)
    expect(wrapper.findAll('.reading-entry').map(entry => entry.attributes('data-story-id'))).toEqual(['latest', 'earlier', 'old'])
    expect(wrapper.findAll('.reading-date time').map(time => time.text())).toEqual(['04/10/2026', '03/10/2026'])
    expect(wrapper.findAll('.reading-time').map(time => time.text())).toEqual(['15:30', '08:30', '20:30'])
    expect(wrapper.get('.most-recent .reading-chapter').text()).toBe('Chương 2 · Chuyến đi')
    expect(wrapper.get('.most-recent .reading-time').attributes('datetime')).toBe(stories[2]!.readingProgress!.updatedAt)
    expect(wrapper.get('.most-recent').attributes('href')).toBe('/library/stories/latest?chapter=latest-2')
    expect(wrapper.findAll('.reading-entry img')).toHaveLength(3)
    await wrapper.get('.most-recent').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/library/stories/latest')
    expect(router.currentRoute.value.query.chapter).toBe('latest-2')
  })

  it('searches titles, authors and the saved chapter while preserving date order', async () => {
    request.mockResolvedValue(json(stories))
    const { wrapper } = await readingPage()
    const search = wrapper.get('input[type="search"]')
    await search.setValue('tác giả')
    expect(wrapper.findAll('.reading-entry').map(entry => entry.attributes('data-story-id'))).toEqual(['latest', 'old'])
    await search.setValue('khu rừng')
    expect(wrapper.findAll('.reading-entry')).toHaveLength(1)
    expect(wrapper.get('.reading-entry').text()).toContain('Truyện đọc hôm qua')
    await search.setValue('không có')
    expect(wrapper.text()).toContain('Không tìm thấy truyện phù hợp.')
    await wrapper.get('.reading-state button').trigger('click')
    expect(wrapper.findAll('.reading-entry')).toHaveLength(3)
  })

  it('keeps an empty account empty and offers a link to choose a story', async () => {
    request.mockResolvedValue(json([]))
    const { wrapper, router } = await readingPage()
    expect(wrapper.text()).toContain('Bạn chưa đọc truyện nào.')
    expect(wrapper.find('.reading-entry').exists()).toBe(false)
    expect(wrapper.find('input[type="search"]').exists()).toBe(false)
    await wrapper.get('.reading-empty a').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe('/library')
  })

  it('distinguishes a failed load from empty history and retries the backend', async () => {
    request.mockResolvedValueOnce(json({ message: 'Lỗi' }, 500))
    const { wrapper } = await readingPage()
    expect(wrapper.find('.reading-empty').exists()).toBe(false)
    expect(wrapper.findAll('[role="alert"]')).toHaveLength(1)
    request.mockResolvedValueOnce(json(stories))
    await wrapper.get('[role="alert"] button').trigger('click')
    await flushPromises()
    expect(wrapper.findAll('.reading-entry')).toHaveLength(3)
  })

  it('reads persisted progress from older servers that omit metadata from story summaries', async () => {
    request.mockImplementation((path: string) => Promise.resolve(json(
      path === '/api/stories?reading=true' ? [{ id: 'legacy', userId: 'author', title: 'Truyện cũ' }]
        : path.endsWith('/reading-progress') ? { chapterId: 'legacy-2', updatedAt: date(4, 11) }
          : { id: 'legacy', chapters: [{ id: 'legacy-2', chapterNumber: 2, title: 'Nội dung được lưu' }] },
    )))
    const { wrapper } = await readingPage()
    expect(request).toHaveBeenCalledTimes(3)
    expect(wrapper.get('.reading-date time').text()).toBe('04/10/2026')
    expect(wrapper.get('.reading-time').text()).toBe('11:30')
    expect(wrapper.get('.reading-chapter').text()).toBe('Chương 2 · Nội dung được lưu')
    expect(wrapper.get('.reading-entry').attributes('href')).toBe('/library/stories/legacy?chapter=legacy-2')
  })
})

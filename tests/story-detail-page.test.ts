import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import StoryDetailPage from '../src/features/library/pages/StoryDetailPage.vue'
import { normalizeReadingSettings, readingDefaults } from '../src/features/library/reading-settings'
import type { Story } from '../src/features/library/types'

enableAutoUnmount(afterEach)
const fetchRequest = vi.fn()
let mobile = false
const story: Story = { id: 'story', userId: 'author', title: 'Một câu chuyện', authorName: 'Tác giả', description: 'Giới thiệu thực tế', chapters: [
  { id: 'c2', storyId: 'story', chapterNumber: 2, title: 'Chương hai', content: '<p>Nội dung thứ hai.</p>' },
  { id: 'c1', storyId: 'story', chapterNumber: 1, title: 'Chương một', content: '<p>Nội dung đầu tiên.</p>' },
  { id: 'c3', storyId: 'story', chapterNumber: 3, title: 'Chương ba', content: '<p>Nội dung thứ ba.</p>' },
] }
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
function serve(detail = story, progress = '') {
  fetchRequest.mockImplementation((path: string, options: RequestInit) => {
    if (options.method === 'PUT') return Promise.resolve(new Response(null, { status: 204 }))
    return Promise.resolve(json(path.endsWith('/reading-progress') ? { chapterId: progress } : detail))
  })
}
beforeEach(() => {
  mobile = false
  localStorage.clear()
  fetchRequest.mockReset()
  vi.stubGlobal('fetch', fetchRequest)
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: mobile, addEventListener: vi.fn(), removeEventListener: vi.fn() })))
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: vi.fn(function (this: HTMLDialogElement) { this.open = true }) })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: vi.fn(function (this: HTMLDialogElement) { this.open = false; this.dispatchEvent(new Event('close')) }) })
})
beforeEach(() => { Object.defineProperty(Range.prototype, 'getClientRects', { configurable: true, value: () => [] }) })
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal'); Reflect.deleteProperty(HTMLDialogElement.prototype, 'close') })
async function reader(path = '/library/stories/story') {
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/library/stories/:id', component: StoryDetailPage },
    { path: '/library', component: { template: '<div />' } },
  ] })
  await router.push(path)
  const wrapper = mount(StoryDetailPage, { global: { plugins: [router], stubs: { LibrarySidebar: true } } })
  await flushPromises()
  return { wrapper, router }
}
const writes = () => fetchRequest.mock.calls.filter(([, options]) => options.method === 'PUT')

describe('Story reader', () => {
  it('always opens the single-chapter reader even with old saved presentation preferences', async () => {
    localStorage.setItem('moc:reading-settings', JSON.stringify({ mode: 'book', fontSize: 24 }))
    serve()
    const { wrapper } = await reader()
    expect(wrapper.findAll('.chapter-content')).toHaveLength(1)
    expect(wrapper.get('.chapter-content').text()).toBe('Nội dung đầu tiên.')
    expect(wrapper.find('.next-chapter').exists()).toBe(true)
    await wrapper.get('.toolbar-actions button[aria-controls="reader-right-panel"]:last-child').trigger('click')
    expect(wrapper.find('.reader-settings').exists()).toBe(true)
    expect(wrapper.findAll('.reader-settings legend').map(item => item.text())).not.toContain('Chế độ đọc')
    expect(JSON.parse(writes().at(-1)![1].body)).toEqual({ chapterId: 'c1' })
  })

  it('opens the most recently read chapter from the backend and orders chapter navigation', async () => {
    serve(story, 'c2')
    const { wrapper, router } = await reader()
    expect(wrapper.get('.chapter-heading').text()).toBe('Chương hai')
    expect(wrapper.get('.chapter-content').text()).toBe('Nội dung thứ hai.')
    expect(wrapper.findAll('.chapter-list button').map(button => button.text())).toEqual(['01Chương một', '02Chương hai', '03Chương ba'])
    expect(wrapper.get('[aria-current="true"]').text()).toContain('Chương hai')
    expect(router.currentRoute.value.query.chapter).toBe('c2')
    expect(writes()[0]).toEqual(['/api/stories/story/reading-progress', expect.objectContaining({ credentials: 'include', body: '{"chapterId":"c2"}' })])
    await wrapper.get('.previous-chapter').trigger('click')
    await flushPromises()
    expect(wrapper.get('.chapter-heading').text()).toBe('Chương một')
    expect(wrapper.find('.previous-chapter').exists()).toBe(false)
    expect(writes().at(-1)?.[1].body).toBe('{"chapterId":"c1"}')
    router.back()
    await flushPromises()
    expect(wrapper.get('.chapter-heading').text()).toBe('Chương hai')
  })

  it('defaults to chapter 1 with no history or a deleted chapter and supports direct chapter links', async () => {
    serve(story, 'deleted')
    const first = await reader()
    expect(first.wrapper.get('.chapter-heading').text()).toBe('Chương một')
    first.wrapper.unmount()
    serve(story, 'c2')
    const linked = await reader('/library/stories/story?chapter=c3')
    expect(linked.wrapper.get('.chapter-heading').text()).toBe('Chương ba')
    expect(linked.wrapper.find('.next-chapter').exists()).toBe(false)
  })

  it('sanitizes HTML and prevents author styling from overriding reading settings', async () => {
    serve({ ...story, chapters: [{ ...story.chapters![1]!, content: '<script>alert(1)</script><p style="border:1px solid;box-shadow:0 0 5px" class="fake" onclick="alert(1)">Văn bản <strong>đậm</strong></p><img src="/uploads/scene.jpg" onerror="alert(1)"><a href="javascript:alert(1)">Link</a>' }] })
    const { wrapper } = await reader()
    const html = wrapper.get('.chapter-content').html()
    expect(html).not.toMatch(/script|onclick|onerror|style=|class="fake"|javascript:/)
    expect(wrapper.get('.chapter-content strong').text()).toBe('đậm')
    expect(wrapper.get('.chapter-content img').attributes('src')).toBe('/uploads/scene.jpg')
  })

  it('applies and remembers reading controls without native selects, then resets them', async () => {
    serve()
    const { wrapper } = await reader()
    await wrapper.get('.toolbar-actions button:last-child').trigger('click')
    const buttons = wrapper.findAll('.reader-settings button')
    await buttons.find(button => button.text() === 'Georgia')!.trigger('click')
    await wrapper.get('[aria-label="Tăng cỡ chữ"]').trigger('click')
    await buttons.find(button => button.text() === 'Tối')!.trigger('click')
    const root = wrapper.get('.reader-layout')
    expect(root.attributes('data-theme')).toBe('dark')
    expect(root.attributes('style')).toContain('--reading-font: Georgia, serif')
    expect(root.attributes('style')).toContain('--reading-size: 21px')
    expect(wrapper.find('select').exists()).toBe(false)
    expect(JSON.parse(localStorage.getItem('moc:reading-settings')!)).toMatchObject({ theme: 'dark', font: 'georgia', fontSize: 21 })
    await wrapper.get('.reset-settings').trigger('click')
    expect(root.attributes('data-theme')).toBe('light')
    expect(JSON.parse(localStorage.getItem('moc:reading-settings')!)).toEqual(readingDefaults)
  })

  it('does not overwrite history when loading progress fails and offers retry', async () => {
    fetchRequest.mockImplementation((path: string) => Promise.resolve(path.endsWith('/reading-progress') ? json({ message: 'Lỗi' }, 500) : json(story)))
    const { wrapper } = await reader()
    expect(wrapper.get('.chapter-heading').text()).toBe('Chương một')
    expect(wrapper.get('.progress-error').text()).toContain('Không tải được chương đọc gần nhất')
    expect(writes()).toHaveLength(0)
    serve(story, 'c2')
    await wrapper.get('.progress-error button').trigger('click')
    await flushPromises()
    expect(wrapper.get('.chapter-heading').text()).toBe('Chương hai')
    expect(wrapper.find('.progress-error').exists()).toBe(false)
  })

  it('serializes progress updates when chapters are switched quickly', async () => {
    let finish!: () => void
    serve()
    fetchRequest.mockImplementation((path: string, options: RequestInit) => {
      if (options.method === 'PUT' && JSON.parse(String(options.body)).chapterId === 'c1') return new Promise(resolve => { finish = () => resolve(new Response(null, { status: 204 })) })
      if (options.method === 'PUT') return Promise.resolve(new Response(null, { status: 204 }))
      return Promise.resolve(json(path.endsWith('/reading-progress') ? { chapterId: '' } : story))
    })
    const { wrapper } = await reader()
    await wrapper.findAll('.chapter-list button')[1]!.trigger('click')
    await flushPromises()
    await wrapper.findAll('.chapter-list button')[2]!.trigger('click')
    await flushPromises()
    expect(wrapper.get('.chapter-heading').text()).toBe('Chương ba')
    expect(writes()).toHaveLength(1)
    finish()
    await flushPromises()
    expect(writes().map(([, options]) => JSON.parse(options.body).chapterId)).toEqual(['c1', 'c2', 'c3'])
  })

  it('tracks clicking the active chapter again as a new reading visit', async () => {
    serve(story, 'c2')
    const { wrapper } = await reader()
    expect(writes()).toHaveLength(1)
    await wrapper.get('.chapter-list [aria-current="true"]').trigger('click')
    await flushPromises()
    expect(writes()).toHaveLength(2)
    expect(writes().at(-1)?.[1].body).toBe('{"chapterId":"c2"}')
  })

  it('tracks a deliberately opened chapter even if the previous progress could not be fetched', async () => {
    fetchRequest.mockImplementation((path: string, options: RequestInit) => Promise.resolve(
      options.method === 'PUT' ? new Response(null, { status: 204 })
        : path.endsWith('/reading-progress') ? json({ message: 'Lỗi' }, 500) : json(story),
    ))
    const { wrapper } = await reader('/library/stories/story?chapter=c3')
    expect(wrapper.get('.chapter-heading').text()).toBe('Chương ba')
    expect(writes().at(-1)?.[1].body).toBe('{"chapterId":"c3"}')
    expect(wrapper.find('.progress-error').exists()).toBe(false)
  })

  it('handles empty stories and blank rich text without inventing content or storing empty progress', async () => {
    serve({ ...story, chapters: [] })
    const empty = await reader()
    expect(empty.wrapper.text()).toContain('Truyện chưa có chương.')
    expect(writes()).toHaveLength(0)
    empty.wrapper.unmount()
    serve({ ...story, chapters: [{ ...story.chapters![1]!, content: '<p><br>&nbsp;</p>' }] })
    const blank = await reader()
    expect(blank.wrapper.text()).toContain('Chương này chưa có nội dung.')
    expect(blank.wrapper.find('.chapter-content').exists()).toBe(false)
    expect(writes()).toHaveLength(0)
  })

  it('opens chapter controls in a modal on small screens and closes on chapter selection', async () => {
    mobile = true
    serve()
    const { wrapper } = await reader()
    expect(wrapper.find('.reader-panel').exists()).toBe(false)
    await wrapper.get('.toolbar-actions button:first-child').trigger('click')
    await flushPromises()
    expect(wrapper.get('dialog').element.open).toBe(true)
    await wrapper.findAll('dialog .chapter-list button')[1]!.trigger('click')
    await flushPromises()
    expect(wrapper.get('dialog').element.open).toBe(false)
    expect(wrapper.get('.chapter-heading').text()).toBe('Chương hai')
  })

  it('keeps failed story loads distinct from empty stories and retries', async () => {
    fetchRequest.mockResolvedValue(json({ message: 'Không tìm thấy truyện' }, 404))
    const { wrapper } = await reader()
    expect(wrapper.get('[role="alert"]').text()).toContain('Không tìm thấy truyện')
    expect(wrapper.find('.chapter-content').exists()).toBe(false)
    serve()
    await wrapper.get('[role="alert"] button').trigger('click')
    await flushPromises()
    expect(wrapper.get('.chapter-heading').text()).toBe('Chương một')
  })
})

describe('Reading preferences', () => {
  it('bounds values and ignores malformed or unsupported stored settings', () => {
    expect(normalizeReadingSettings({ font: 'unknown', theme: 'red', width: 1, fontSize: 999, lineHeight: NaN, paragraphSpacing: -5 })).toEqual({ ...readingDefaults, fontSize: 30, paragraphSpacing: 0.5 })
    expect(normalizeReadingSettings(null)).toEqual(readingDefaults)
  })
})

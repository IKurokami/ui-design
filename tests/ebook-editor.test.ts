import { flushPromises, mount } from '@vue/test-utils'
import { reactive } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import EbookEditorPage from '../src/features/ebook/pages/EbookEditorPage.vue'

const route = reactive({ params: {} as Record<string, string>, query: { story: 'story-1' } as Record<string, string> })
const router = { push: vi.fn(), replace: vi.fn() }
vi.mock('vue-router', () => ({ useRoute: () => route, useRouter: () => router }))

describe('EbookEditorPage', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/api/stories/story-1')) {
        return new Response(JSON.stringify({ id: 'story-1', title: 'Truyện mẫu', description: 'Mô tả', authorName: 'Tác giả', chapters: [{ id: 'chapter-1', chapterNumber: 1, title: 'Mở đầu', content: '<p>Nội dung chương.</p>', illustrations: '[]' }] }), { status: 200 })
      }
      if (url.endsWith('/api/ebooks') && init?.method === 'POST') {
        return new Response(JSON.stringify({ id: 'ebook-1', title: 'Truyện mẫu', revision: 1 }), { status: 201 })
      }
      return new Response(JSON.stringify({ id: 'ebook-1', title: 'Truyện mẫu', revision: 1, design: {} }), { status: 200 })
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('builds pages from a story, adds a page and saves the independent design', async () => {
    const wrapper = mount(EbookEditorPage, { attachTo: document.body })
    await flushPromises()

    expect(wrapper.findAll('.ebook-page-item')).toHaveLength(2)
    expect(wrapper.text()).toContain('Truyện mẫu')

    await wrapper.get('.ebook-page-summary button[title="Thêm trang"]').trigger('click')
    expect(wrapper.findAll('.ebook-page-item')).toHaveLength(3)

    await wrapper.get('.ebook-primary-btn').trigger('click')
    await flushPromises()
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/ebooks', expect.objectContaining({ method: 'POST' }))
    expect(router.replace).toHaveBeenCalledWith(expect.objectContaining({ path: '/library/ebook-editor/ebook-1' }))
    wrapper.unmount()
  })

  it('keeps a device draft and shows a retry state when the save API rejects the design', async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/api/stories/story-1')) {
        return new Response(JSON.stringify({ id: 'story-1', title: 'Truyện lỗi lưu', chapters: [] }), { status: 200 })
      }
      if (url.endsWith('/api/ebooks') && init?.method === 'POST') {
        return new Response(JSON.stringify({ error: 'Bad Request', message: 'Thiết kế ebook không hợp lệ.' }), { status: 400 })
      }
      return new Response(JSON.stringify([]), { status: 200 })
    })
    const wrapper = mount(EbookEditorPage, { attachTo: document.body })
    await flushPromises()
    await wrapper.get('.ebook-primary-btn').trigger('click')
    await flushPromises()
    expect(wrapper.find('.ebook-save-error').exists()).toBe(true)
    expect(wrapper.find('.ebook-save-error').text()).toContain('Thiết kế ebook không hợp lệ.')
    expect(wrapper.find('.ebook-save-state').text()).toContain('Đã lưu trên thiết bị')
    expect(localStorage.length).toBeGreaterThan(0)
    wrapper.unmount()
  })

  it('opens an in-editor book preview and starts a page turn from the cover', async () => {
    const wrapper = mount(EbookEditorPage, { attachTo: document.body })
    await flushPromises()
    await wrapper.get('button[title="Xem trước"]').trigger('click')
    expect(document.querySelector('.ebook-preview-shell')).toBeTruthy()
    expect(document.querySelector('.ebook-preview-title')?.textContent).toContain('Truyện mẫu')
    document.querySelector<HTMLButtonElement>('.ebook-preview-nav.next')?.click()
    await flushPromises()
    expect(document.querySelector('.ebook-preview-book')?.classList.contains('turning')).toBe(true)
    expect(document.querySelector('.ebook-preview-page-sheet')).toBeTruthy()
    document.querySelector<HTMLButtonElement>('.ebook-preview-close')?.click()
    await flushPromises()
    expect(document.querySelector('.ebook-preview-shell')).toBeNull()
    wrapper.unmount()
  })

})

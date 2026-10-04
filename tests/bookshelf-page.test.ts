import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import BookshelfPage from '../src/features/library/pages/BookshelfPage.vue'

// Mock router
const mockPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useRoute: () => ({ path: '/library/bookshelf', query: {} }),
}))

// Mock api client
const mockRequest = vi.fn()
vi.mock('../src/services/api-client', () => ({
  createApiClient: () => ({
    request: mockRequest,
  }),
}))

enableAutoUnmount(afterEach)
afterEach(() => vi.restoreAllMocks())

describe('BookshelfPage - Tủ sách của tôi (Tác phẩm đã đăng)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    mockPush.mockReset()
    mockRequest.mockReset()
  })

  it('uses the custom sort menu and keeps the selected order across grid and list views', async () => {
    mockRequest.mockResolvedValueOnce([
      { id: 'b', title: 'Bộ B', chapterCount: 2, createdAt: '2026-10-02', updatedAt: '2026-10-03' },
      { id: 'a', title: 'Bộ A', chapterCount: 12, createdAt: '2026-10-03', updatedAt: '2026-10-02' },
    ])
    const wrapper = mount(BookshelfPage, {
      attachTo: document.body,
      global: { stubs: { AmbientBackdrop: true } },
    })
    try {
      await flushPromises()
      expect(wrapper.find('select').exists()).toBe(false)
      expect(wrapper.findAll('.card-title').map(item => item.text())).toEqual(['Bộ B', 'Bộ A'])
      const trigger = wrapper.get('.sort-trigger')
      await trigger.trigger('keydown', { key: 'ArrowDown' })
      await flushPromises()
      const menu = document.querySelector<HTMLElement>('[role="menu"]')!
      expect(menu.parentElement).toBe(document.body)
      expect(document.activeElement?.textContent).toContain('Mới cập nhật')
      expect([...menu.querySelectorAll('[role="menuitemradio"]')].map(item => item.textContent?.trim()))
        .toEqual(['Mới cập nhật', 'Mới tạo', 'Nhiều chương', 'Tên A–Z'])

      menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }))
      expect(document.activeElement?.textContent).toContain('Tên A–Z')
      ;(document.activeElement as HTMLButtonElement).click()
      await flushPromises()
      expect(document.querySelector('[role="menu"]')).toBeNull()
      expect(document.activeElement).toBe(trigger.element)
      expect(trigger.attributes('aria-label')).toBe('Sắp xếp: Tên A–Z')
      expect(wrapper.findAll('.card-title').map(item => item.text())).toEqual(['Bộ A', 'Bộ B'])

      await wrapper.get('[aria-label="Dạng danh sách"]').trigger('click')
      expect(wrapper.findAll('.table-story-title').map(item => item.text())).toEqual(['Bộ A', 'Bộ B'])
      for (const label of ['Mới tạo', 'Nhiều chương', 'Mới cập nhật']) {
        await trigger.trigger('click')
        const option = [...document.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]')]
          .find(item => item.textContent?.trim() === label)!
        option.click()
        await flushPromises()
        expect(wrapper.findAll('.table-story-title').map(item => item.text()))
          .toEqual(label === 'Mới cập nhật' ? ['Bộ B', 'Bộ A'] : ['Bộ A', 'Bộ B'])
      }
    } finally {
      wrapper.unmount()
    }
  })

  it('renders header, stats cards, and fetches user stories from /api/stories/mine', async () => {
    mockRequest.mockResolvedValueOnce([
      {
        id: 'story-1',
        title: 'Vạn Cổ Đệ Nhất Thần',
        description: 'Truyện tiên hiệp cực phẩm',
        coverUrl: '/uploads/van-co.jpg',
        category: 'Tiên Hiệp',
        tags: 'Tu chân, Nhiệt huyết',
        status: 'published',
        chapterCount: 15,
        createdAt: '2026-10-01T10:00:00Z',
      },
      {
        id: 'story-2',
        title: 'Bản Nháp Huyền Ảo',
        description: 'Đang lên cốt truyện',
        coverUrl: '',
        category: 'Huyền Huyễn',
        tags: 'Kỳ ảo',
        status: 'draft',
        chapterCount: 3,
        createdAt: '2026-10-02T12:00:00Z',
      },
    ])

    const wrapper = mount(BookshelfPage)

    // Verify loading or initial render
    expect(mockRequest).toHaveBeenCalledWith('/api/stories/mine')

    // Wait for promise resolution
    await vi.waitFor(() => {
      expect(wrapper.findAll('.book-story-card').length).toBe(2)
    })

    // Header & stories
    expect(wrapper.text()).toContain('Tủ sách của tôi')
    expect(wrapper.text()).toContain('Vạn Cổ Đệ Nhất Thần')
    expect(wrapper.text()).toContain('Bản Nháp Huyền Ảo')

    // Filter pills with counts
    expect(wrapper.text()).toContain('Tất cả (2)')
    expect(wrapper.text()).toContain('Đang ra (1)')
    expect(wrapper.text()).toContain('Bản nháp (1)')
  })

  it('shows an empty bookshelf when the backend has no stories', async () => {
    mockRequest.mockResolvedValueOnce([])
    const wrapper = mount(BookshelfPage)
    await flushPromises()
    expect(wrapper.findAll('.book-story-card')).toHaveLength(0)
    expect(wrapper.text()).toContain('Chưa có tác phẩm')
    expect(mockRequest).toHaveBeenCalledTimes(1)
  })

  it('shows a load error and retries without substituting sample stories', async () => {
    mockRequest.mockRejectedValueOnce(new Error('offline'))
    const wrapper = mount(BookshelfPage)
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('Không thể kết nối')
    expect(wrapper.findAll('.book-story-card')).toHaveLength(0)
    mockRequest.mockResolvedValueOnce([{ id: 'retry', title: 'Truyện từ server' }])
    await wrapper.get('.btn-reset-filters').trigger('click')
    await flushPromises()
    expect(wrapper.get('.card-title').text()).toBe('Truyện từ server')
  })

  it('retains a story and its confirmation when the backend rejects deletion', async () => {
    mockRequest.mockResolvedValueOnce([{ id: 'keep', title: 'Giữ truyện', chapterCount: 0 }])
    const wrapper = mount(BookshelfPage)
    await flushPromises()
    await wrapper.get('.btn-card-delete').trigger('click')
    mockRequest.mockRejectedValueOnce(new Error('offline'))
    await wrapper.get('.btn-modal-delete').trigger('click')
    await flushPromises()
    expect(wrapper.find('.delete-modal-box').exists()).toBe(true)
    expect(wrapper.get('.card-title').text()).toBe('Giữ truyện')
    expect(wrapper.get('.toast-error').text()).toContain('Không thể kết nối')
    expect(wrapper.get('.card-meta-line').text()).toContain('0 chương')
  })

  it('filters stories by status (All, Published, Draft)', async () => {
    mockRequest.mockResolvedValueOnce([
      {
        id: 's-1',
        title: 'Truyện Đã Xuất Bản',
        status: 'published',
        chapterCount: 10,
      },
      {
        id: 's-2',
        title: 'Truyện Bản Nháp',
        status: 'draft',
        chapterCount: 2,
      },
    ])

    const wrapper = mount(BookshelfPage)

    await vi.waitFor(() => {
      expect(wrapper.findAll('.book-story-card').length).toBe(2)
    })

    // Click Draft filter pill
    const filterPills = wrapper.findAll('.status-pill-btn')
    const draftPill = filterPills.find(p => p.text().includes('Bản nháp'))
    expect(draftPill).toBeDefined()
    await draftPill?.trigger('click')

    // Only 1 draft story should remain
    expect(wrapper.findAll('.book-story-card').length).toBe(1)
    expect(wrapper.text()).toContain('Truyện Bản Nháp')
    expect(wrapper.text()).not.toContain('Truyện Đã Xuất Bản')
  })

  it('searches stories by keyword', async () => {
    mockRequest.mockResolvedValueOnce([
      {
        id: 's-1',
        title: 'Đấu Phá Khung Thương',
        category: 'Huyền Huyễn',
        status: 'published',
      },
      {
        id: 's-2',
        title: 'Phàm Nhân Tu Tiên',
        category: 'Tiên Hiệp',
        status: 'published',
      },
    ])

    const wrapper = mount(BookshelfPage)

    await vi.waitFor(() => {
      expect(wrapper.findAll('.book-story-card').length).toBe(2)
    })

    // Type keyword in search
    const searchInput = wrapper.find('.bookshelf-search-input')
    await searchInput.setValue('Đấu Phá')

    expect(wrapper.findAll('.book-story-card').length).toBe(1)
    expect(wrapper.text()).toContain('Đấu Phá Khung Thương')
    expect(wrapper.text()).not.toContain('Phàm Nhân Tu Tiên')
  })

  it('switches between Grid view and Table list view', async () => {
    mockRequest.mockResolvedValueOnce([
      {
        id: 's-1',
        title: 'Kiếm Đạo Độc Tôn',
        category: 'Kiếm Hiệp',
        status: 'published',
        chapterCount: 50,
      },
    ])

    const wrapper = mount(BookshelfPage)

    await vi.waitFor(() => {
      expect(wrapper.find('.books-grid-layout').exists()).toBe(true)
    })

    // Switch to Table view
    const tableBtn = wrapper.findAll('.btn-view-toggle')[1]
    await tableBtn.trigger('click')

    expect(wrapper.find('.books-table-card').exists()).toBe(true)
    expect(wrapper.find('.bookshelf-table').exists()).toBe(true)
  })

  it('opens confirmation modal and deletes story with DELETE /api/stories/:id', async () => {
    mockRequest.mockResolvedValueOnce([
      {
        id: 'story-to-delete',
        title: 'Truyện Cũ Sắp Xóa',
        status: 'draft',
      },
    ])

    const wrapper = mount(BookshelfPage)

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Truyện Cũ Sắp Xóa')
    })

    // Click delete button on card
    await wrapper.find('.btn-card-delete').trigger('click')

    // Modal appears
    expect(wrapper.find('.delete-modal-box').exists()).toBe(true)
    expect(wrapper.find('.highlight-story-title').text()).toContain('Truyện Cũ Sắp Xóa')

    // Mock delete request
    mockRequest.mockResolvedValueOnce({ success: true })

    // Confirm delete
    await wrapper.find('.btn-modal-delete').trigger('click')

    expect(mockRequest).toHaveBeenCalledWith('/api/stories/story-to-delete', {
      method: 'DELETE',
    })

    // Story removed, empty state shown
    await vi.waitFor(() => {
      expect(wrapper.find('.bookshelf-empty-card').exists()).toBe(true)
    })
  })

  it('navigates to story editor when clicking create button or edit button', async () => {
    mockRequest.mockResolvedValueOnce([
      {
        id: 'story-editable',
        title: 'Truyện Đang Viết Dở',
        status: 'published',
      },
    ])

    const wrapper = mount(BookshelfPage)

    // Click header create button
    await wrapper.find('.btn-create-story').trigger('click')
    expect(mockPush).toHaveBeenCalledWith('/library/editor')

    await vi.waitFor(() => {
      expect(wrapper.find('.btn-card-edit').exists()).toBe(true)
    })

    // Click card edit button
    await wrapper.find('.btn-card-edit').trigger('click')
    expect(mockPush).toHaveBeenCalledWith('/library/editor/story-editable')
  })
})

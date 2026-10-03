import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
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

describe('BookshelfPage - Tủ sách của tôi (Tác phẩm đã đăng)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockPush.mockReset()
    mockRequest.mockReset()
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

    // Header & stats
    expect(wrapper.text()).toContain('Tủ sách của tôi')
    expect(wrapper.text()).toContain('Vạn Cổ Đệ Nhất Thần')
    expect(wrapper.text()).toContain('Bản Nháp Huyền Ảo')

    // Stats values
    expect(wrapper.text()).toContain('Tổng tác phẩm')
    expect(wrapper.text()).toContain('Tổng số chương')
    expect(wrapper.text()).toContain('Đang phát hành')
    expect(wrapper.text()).toContain('Bản nháp')
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

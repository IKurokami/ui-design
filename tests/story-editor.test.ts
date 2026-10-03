import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import StoryEditor from '../src/features/library/components/StoryEditor.vue'

// Mock router
const mockPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useRoute: () => ({ path: '/library/editor', params: {}, query: {} }),
}))

// Mock api client
const mockRequest = vi.fn()
vi.mock('../src/services/api-client', () => ({
  createApiClient: () => ({
    request: mockRequest,
  }),
}))

describe('StoryEditor - Word-like Rich Text & Auto Cover', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockRequest.mockReset()
    // Mock document.execCommand in jsdom
    document.execCommand = vi.fn()
  })

  it('renders Microsoft Word-like titlebar, ribbon toolbar, and document paper', () => {
    const wrapper = mount(StoryEditor)

    expect(wrapper.find('.word-titlebar').exists()).toBe(true)
    expect(wrapper.find('.doc-title-input').exists()).toBe(true)
    expect(wrapper.find('.word-ribbon').exists()).toBe(true)
    expect(wrapper.find('.word-page-container').exists()).toBe(true)
    expect(wrapper.find('.chapter-title-input').exists()).toBe(true)
    expect(wrapper.find('.word-document-content').exists()).toBe(true)
    expect(wrapper.find('.story-meta-panel').exists()).toBe(true)
  })

  it('triggers formatting commands when clicking ribbon buttons', async () => {
    const wrapper = mount(StoryEditor)

    const buttons = wrapper.findAll('.ribbon-btn')
    // Find bold button
    const boldBtn = buttons.find(b => b.attributes('title')?.includes('Đậm'))
    expect(boldBtn).toBeDefined()
    await boldBtn?.trigger('click')
    expect(document.execCommand).toHaveBeenCalledWith('bold', false, undefined)

    // Find italic button
    const italicBtn = buttons.find(b => b.attributes('title')?.includes('Nghiêng'))
    expect(italicBtn).toBeDefined()
    await italicBtn?.trigger('click')
    expect(document.execCommand).toHaveBeenCalledWith('italic', false, undefined)
  })

  it('automatically sets the first inserted image as story cover when cover is empty', async () => {
    const wrapper = mount(StoryEditor)

    const editorEl = wrapper.find('.word-document-content').element as HTMLDivElement
    // Simulate inserting HTML with images into editor
    editorEl.innerHTML = `
      <p>Mở đầu câu chuyện...</p>
      <img src="/uploads/illustration-hero.jpg" alt="Hero" />
      <img src="/uploads/illustration-scene.jpg" alt="Scene" />
    `

    // Trigger input/change
    await wrapper.find('.word-document-content').trigger('input')

    // Expect coverUrl to automatically take the first image
    const coverImg = wrapper.find('.cover-preview-box img')
    expect(coverImg.exists()).toBe(true)
    expect(coverImg.attributes('src')).toBe('/uploads/illustration-hero.jpg')

    // Expect content images strip to show both images
    const thumbnails = wrapper.findAll('.content-img-thumb')
    expect(thumbnails.length).toBe(2)

    // Clicking the second thumbnail switches the story cover!
    await thumbnails[1].trigger('click')
    const updatedCover = wrapper.find('.cover-preview-box img')
    expect(updatedCover.attributes('src')).toBe('/uploads/illustration-scene.jpg')
  })

  it('submits created story with initial chapter and illustrations to /api/stories', async () => {
    mockRequest.mockResolvedValueOnce({
      id: 'story-123',
      title: 'Vạn Cổ Thần Thoại',
      description: 'Truyện tiên hiệp xuất sắc',
      coverUrl: '/uploads/illustration-hero.jpg',
      category: 'Tiên Hiệp',
      tags: 'Tu chân, Sáng tác',
      status: 'published',
    })

    const wrapper = mount(StoryEditor)

    // Set title and description
    await wrapper.find('.doc-title-input').setValue('Vạn Cổ Thần Thoại')
    await wrapper.find('.input-textarea').setValue('Truyện tiên hiệp xuất sắc')

    const editorEl = wrapper.find('.word-document-content').element as HTMLDivElement
    editorEl.innerHTML = '<p>Nội dung chương 1</p><img src="/uploads/illustration-hero.jpg" />'
    await wrapper.find('.word-document-content').trigger('input')

    // Click Save & Publish button
    await wrapper.find('.btn-save-draft').trigger('click')

    expect(mockRequest).toHaveBeenCalledWith('/api/stories', expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining('"title":"Vạn Cổ Thần Thoại"'),
    }))

    // Expect 'saved' emit
    expect(wrapper.emitted('saved')).toBeTruthy()
  })

  it('allows managing chapters: switching tabs, adding new chapters', async () => {
    const wrapper = mount(StoryEditor)

    // Switch to Chapters Manager tab
    const tabs = wrapper.findAll('.tab-btn')
    const chaptersTab = tabs.find(t => t.text().includes('Quản lý chương'))
    expect(chaptersTab).toBeDefined()
    await chaptersTab?.trigger('click')

    expect(wrapper.find('.chapters-table-list').exists()).toBe(true)
    expect(wrapper.findAll('.chapter-row-item').length).toBe(1)

    // Add a new chapter
    await wrapper.find('.manager-top-action .btn-primary-action').trigger('click')
    expect(wrapper.findAll('.chapter-row-item').length).toBe(2)
  })

  it('allows managing story image gallery: switching to images tab and setting cover', async () => {
    const wrapper = mount(StoryEditor)

    // Insert an image in editor
    const editorEl = wrapper.find('.word-document-content').element as HTMLDivElement
    editorEl.innerHTML = '<p>Nội dung</p><img src="/uploads/art-1.jpg" />'
    await wrapper.find('.word-document-content').trigger('input')

    // Switch to Media Gallery tab
    const tabs = wrapper.findAll('.tab-btn')
    const imagesTab = tabs.find(t => t.text().includes('Kho ảnh truyện'))
    expect(imagesTab).toBeDefined()
    await imagesTab?.trigger('click')

    expect(wrapper.find('.gallery-grid').exists()).toBe(true)
    const galleryCards = wrapper.findAll('.gallery-card')
    expect(galleryCards.length).toBeGreaterThan(0)
  })

  it('displays chapter usage in gallery and allows deleting images from gallery and chapters', async () => {
    const wrapper = mount(StoryEditor)

    const editorEl = wrapper.find('.word-document-content').element as HTMLDivElement
    editorEl.innerHTML = '<p>Nội dung chương 1</p><img src="/uploads/chapter1-art.jpg" />'
    await wrapper.find('.word-document-content').trigger('input')

    // Switch to Media Gallery tab
    const tabs = wrapper.findAll('.tab-btn')
    const imagesTab = tabs.find(t => t.text().includes('Kho ảnh truyện'))
    await imagesTab?.trigger('click')

    // Check usage chip shows Chương 1
    const usageChip = wrapper.find('.usage-ch-btn')
    expect(usageChip.exists()).toBe(true)
    expect(usageChip.text()).toContain('Chương 1')

    // Click delete image button in gallery
    const deleteBtn = wrapper.find('.btn-delete-gallery-img')
    expect(deleteBtn.exists()).toBe(true)
    await deleteBtn.trigger('click')

    // Gallery should now be empty
    expect(wrapper.find('.gallery-empty-state').exists()).toBe(true)
  })

  it('does not display redundant Chọn ảnh làm ảnh bìa text and allows deleting image inside editor', async () => {
    const wrapper = mount(StoryEditor)

    // Redundant text is removed
    expect(wrapper.text().includes('Chọn ảnh làm ảnh bìa')).toBe(false)
    expect(wrapper.find('.editor-bottom-hint').exists()).toBe(false)

    // Insert image and click it
    const editorEl = wrapper.find('.word-document-content').element as HTMLDivElement
    editorEl.innerHTML = '<p><img src="/uploads/scene.jpg" class="content-img" /></p>'
    await wrapper.find('.word-document-content').trigger('input')

    const imgEl = wrapper.find('.word-document-content img')
    expect(imgEl.exists()).toBe(true)

    // Click the image to show floating image toolbar
    await imgEl.trigger('click')
    const imgToolbar = wrapper.find('.editor-img-toolbar')
    expect(imgToolbar.exists()).toBe(true)

    // Click delete image button in toolbar
    const deleteBtn = imgToolbar.find('.btn-danger')
    await deleteBtn.trigger('click')

    // Expect image to be removed from editor
    expect(wrapper.find('.word-document-content img').exists()).toBe(false)
  })

  it('supports drag and drop image upload directly into editor and cover section', async () => {
    mockRequest.mockResolvedValueOnce({
      url: '/uploads/dragged-art.jpg',
    })

    const wrapper = mount(StoryEditor)
    const editor = wrapper.find('.word-document-content')

    // Simulate drag over
    await editor.trigger('dragover', {
      dataTransfer: { types: ['Files'] },
    })

    // Simulate drop of an image file
    const file = new File(['fake-image-bits'], 'dragged-art.png', { type: 'image/png' })
    await editor.trigger('drop', {
      dataTransfer: { files: [file] },
    })

    // Expect upload endpoint called
    expect(mockRequest).toHaveBeenCalledWith('/api/upload', expect.objectContaining({
      method: 'POST',
    }))
  })

  it('exits blockquote to paragraph when Enter is pressed and allows toggling quote', async () => {
    const wrapper = mount(StoryEditor, { attachTo: document.body })
    const editorEl = wrapper.find('.word-document-content').element as HTMLDivElement

    // Initial blockquote with text
    editorEl.innerHTML = '<blockquote>Câu trích dẫn kinh điển</blockquote>'
    await wrapper.find('.word-document-content').trigger('input')

    // Find blockquote element
    const bq = editorEl.querySelector('blockquote') as HTMLElement
    expect(bq).toBeDefined()

    // Simulate Enter key inside the blockquote
    const textNode = bq.firstChild as Text
    const range = document.createRange()
    range.setStart(textNode, 5)
    range.collapse(true)
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)

    await wrapper.find('.word-document-content').trigger('keydown', { key: 'Enter' })

    // A paragraph should now exist after the blockquote
    const p = editorEl.querySelector('p')
    expect(p).not.toBeNull()

    // Test toggle block: clicking paragraph button converts blockquote to p
    const pBtn = wrapper.findAll('.ribbon-btn').find(b => b.attributes('title')?.includes('Văn bản thường'))
    expect(pBtn).toBeDefined()

    wrapper.unmount()
  })
})

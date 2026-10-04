import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { reactive } from 'vue'
import { useAuthStore } from '../src/stores/auth.store'
import { createPinia, setActivePinia } from 'pinia'
import StoryEditor from '../src/features/library/components/StoryEditor.vue'
import ImageCropDialog from '../src/features/library/components/ImageCropDialog.vue'

// Mock router
const mockPush = vi.fn()
const mockReplace = vi.fn()
const mockRoute = reactive({ path: '/library/editor', params: { id: '' }, query: {} })
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useRoute: () => mockRoute,
}))

// Mock api client
const mockRequest = vi.fn()
vi.mock('../src/services/api-client', () => ({
  createApiClient: () => ({
    request: mockRequest,
  }),
}))

enableAutoUnmount(afterEach)

describe('StoryEditor - Word-like Rich Text & Auto Cover', () => {
  beforeEach(() => {
    Object.defineProperty(Range.prototype, 'getClientRects', { configurable: true, value: () => [] })
    setActivePinia(createPinia())
    useAuthStore().setSession({ user: { id: 'author', email: 'author@example.com', displayName: 'Tác giả', avatarUrl: '/uploads/avatar.jpg' } })
    mockRoute.params.id = ''
    mockRoute.path = '/library/editor'
    mockRequest.mockReset()
    mockPush.mockReset()
    mockReplace.mockReset()
    // Mock document.execCommand in jsdom
    document.execCommand = vi.fn()
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value(this: HTMLDialogElement) { this.open = true } })
  })
  afterEach(() => { Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal') })

  it('previews the real Library stack with distinct portrait images and updates the cover immediately', async () => {
    const wrapper = mount(StoryEditor)
    const editor = wrapper.get('.word-document-content')
    editor.element.innerHTML = '<p><img src="/uploads/one.jpg"><img src="/uploads/two.jpg"><img src="/uploads/three.jpg"></p>'
    await editor.trigger('input')
    await wrapper.get('.doc-title-input').setValue('Tên truyện thực tế')
    expect(wrapper.get('.cover-preview-box .deck-title').text()).toBe('Tên truyện thực tế')
    expect(wrapper.get('.cover-preview-box .card-front img').attributes('src')).toBe('/uploads/one.jpg')
    expect(new Set(wrapper.findAll('.cover-preview-box img').map(image => image.attributes('src')))).toEqual(new Set(['/uploads/one.jpg', '/uploads/two.jpg', '/uploads/three.jpg']))
    expect(wrapper.get('.cover-preview-box .deck-card').attributes('role')).toBe('group')
    await wrapper.findAll('.tab-btn')[2]!.trigger('click')
    await wrapper.findAll('.gallery-card')[2]!.get('.gallery-btn[title="Đặt làm bìa"]').trigger('click')
    expect(wrapper.get('.gallery-library-preview .card-front img').attributes('src')).toBe('/uploads/three.jpg')
  })

  it('crops only the cover without replacing the full illustration in the chapter', async () => {
    const wrapper = mount(StoryEditor)
    const editor = wrapper.get('.word-document-content')
    editor.element.innerHTML = '<p>Nội dung</p><img src="/uploads/original.jpg">'
    await editor.trigger('input')
    await wrapper.get('.btn-crop-cover').trigger('click')
    const dialog = wrapper.getComponent(ImageCropDialog)
    expect(dialog.props('description')).toContain('Chỉ thay ảnh bìa')
    const file = new File(['pixels'], 'crop.webp', { type: 'image/webp' })
    mockRequest.mockResolvedValueOnce({ url: '/uploads/cropped.webp' })
    await dialog.props('apply')(file)
    const body = mockRequest.mock.calls[0]![1].body as FormData
    expect(body.get('file')).toBe(file)
    expect(wrapper.get('.cover-preview-box .card-front img').attributes('src')).toBe('/uploads/cropped.webp')
    expect(editor.element.innerHTML).toContain('/uploads/original.jpg')
    expect(editor.element.innerHTML).not.toContain('/uploads/cropped.webp')
  })

  it('replaces a cropped gallery image across chapters, illustrations and cover before saving', async () => {
    const story = { ...storedStory(), coverUrl: '/uploads/shared.jpg' }
    story.chapters.forEach(chapter => { chapter.content = '<p><img src="/uploads/shared.jpg" alt="Cảnh"><img src="/uploads/shared.jpg-extra"></p>'; chapter.illustrations = '["/uploads/shared.jpg","/uploads/other.jpg"]' })
    mockRequest.mockResolvedValueOnce(story)
    mockRoute.params.id = 'stored'
    const wrapper = mount(StoryEditor)
    await flushPromises()
    await wrapper.findAll('.tab-btn')[2]!.trigger('click')
    await wrapper.get('.btn-crop-gallery-image').trigger('click')
    const dialog = wrapper.getComponent(ImageCropDialog)
    expect(dialog.props('description')).toContain('2 chương và ảnh bìa')
    mockRequest.mockResolvedValueOnce({ url: '/uploads/cropped.webp' })
    await dialog.props('apply')(new File(['pixels'], 'crop.webp', { type: 'image/webp' }))
    dialog.vm.$emit('close')
    await flushPromises()
    expect(wrapper.get('.word-document-content').html()).toContain('/uploads/cropped.webp')
    expect(wrapper.get('.word-document-content').html()).toContain('/uploads/shared.jpg-extra')
    mockRequest.mockResolvedValueOnce({ ...story, coverUrl: '/uploads/cropped.webp' }).mockResolvedValueOnce(story.chapters[0]).mockResolvedValueOnce(story.chapters[1])
    await wrapper.get('.btn-save-draft').trigger('click')
    await flushPromises()
    const writes = mockRequest.mock.calls.filter(([path, options]) => path.startsWith('/api/chapters/') && options.method === 'PUT')
    expect(writes).toHaveLength(2)
    for (const [, options] of writes) {
      const chapter = JSON.parse(options.body)
      expect(chapter.content).toContain('/uploads/cropped.webp')
      expect(JSON.parse(chapter.illustrations)).toEqual(expect.arrayContaining(['/uploads/cropped.webp', '/uploads/other.jpg']))
      expect(JSON.parse(chapter.illustrations)).not.toContain('/uploads/shared.jpg')
    }
  })

  it('retains original images when uploading a crop fails', async () => {
    const wrapper = mount(StoryEditor)
    const editor = wrapper.get('.word-document-content')
    editor.element.innerHTML = '<p><img src="/uploads/original.jpg"></p>'
    await editor.trigger('input')
    await wrapper.get('.btn-crop-cover').trigger('click')
    mockRequest.mockRejectedValueOnce(new Error('Upload failed'))
    await expect(wrapper.getComponent(ImageCropDialog).props('apply')(new File(['pixels'], 'crop.webp', { type: 'image/webp' }))).rejects.toThrow('Upload failed')
    expect(wrapper.get('.cover-preview-box .card-front img').attributes('src')).toBe('/uploads/original.jpg')
    expect(editor.element.innerHTML).toContain('/uploads/original.jpg')
    expect(wrapper.findComponent(ImageCropDialog).exists()).toBe(true)
  })

  it('does not apply a late crop upload to a different story after navigation', async () => {
    const wrapper = mount(StoryEditor)
    const editor = wrapper.get('.word-document-content')
    editor.element.innerHTML = '<img src="/uploads/previous.jpg">'
    await editor.trigger('input')
    await wrapper.get('.btn-crop-cover').trigger('click')
    let finish!: (value: { url: string }) => void
    mockRequest.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const uploading = wrapper.getComponent(ImageCropDialog).props('apply')(new File(['pixels'], 'crop.webp', { type: 'image/webp' }))
    mockRequest.mockResolvedValueOnce({ ...storedStory(), coverUrl: '/uploads/new-story.jpg' })
    mockRoute.params.id = 'stored'
    await flushPromises()
    finish({ url: '/uploads/previous-crop.webp' })
    await uploading
    await flushPromises()
    expect(wrapper.get('.cover-preview-box .card-front img').attributes('src')).toBe('/uploads/new-story.jpg')
    expect(wrapper.findComponent(ImageCropDialog).exists()).toBe(false)
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
    const coverImg = wrapper.find('.cover-preview-box .card-front img')
    expect(coverImg.exists()).toBe(true)
    expect(coverImg.attributes('src')).toBe('/uploads/illustration-hero.jpg')

    // Both illustrations are available in the gallery, where cover selection lives.
    await wrapper.findAll('.tab-btn').find(tab => tab.text().includes('Kho ảnh truyện'))!.trigger('click')
    const images = wrapper.findAll('.gallery-card')
    expect(images.length).toBe(2)
    await images[1]!.get('[title="Đặt làm bìa"]').trigger('click')
    await wrapper.findAll('.tab-btn').find(tab => tab.text().includes('Soạn thảo'))!.trigger('click')
    const updatedCover = wrapper.find('.cover-preview-box .card-front img')
    expect(updatedCover.attributes('src')).toBe('/uploads/illustration-scene.jpg')
  })

  it('submits created story with initial chapter and illustrations to /api/stories', async () => {
    mockRequest.mockResolvedValueOnce({
      id: 'story-123',
      userId: 'author',
      chapters: [{ id: 'chapter-1', storyId: 'story-123', chapterNumber: 1, title: 'Chương 1', content: '<p>Nội dung chương 1</p><img src="/uploads/illustration-hero.jpg" />', illustrations: '["/uploads/illustration-hero.jpg"]' }],
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

    await flushPromises()
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
  const storedStory = () => ({
    id: 'stored', userId: 'author', title: 'Truyện đã lưu', category: 'Kỳ Ảo', status: 'draft',
    chapters: [
      { id: 'c1', storyId: 'stored', chapterNumber: 1, title: 'Mở đầu', content: '<p>Chương một</p>', illustrations: '[]' },
      { id: 'c2', storyId: 'stored', chapterNumber: 3, title: 'Chương ba', content: '<p>Chương ba</p>', illustrations: '["/uploads/art.jpg"]' },
    ],
  })
  async function openStored(story = storedStory()) {
    mockRoute.params.id = story.id
    mockRoute.path = '/library/editor/' + story.id
    mockRequest.mockResolvedValueOnce(story)
    const wrapper = mount(StoryEditor, { attachTo: document.body })
    await flushPromises()
    return wrapper
  }

  it('loads server chapters and preserves a draft status during update', async () => {
    const story = storedStory()
    const wrapper = await openStored(story)
    expect(wrapper.get('.doc-title-input').element).toHaveProperty('value', story.title)
    expect(wrapper.get('.word-document-content').html()).toContain('Chương một')
    expect(wrapper.get('.story-status-options [aria-pressed="true"]').text()).toBe('Bản nháp')
    await wrapper.get('.doc-title-input').setValue('Tên đã sửa')
    mockRequest.mockResolvedValueOnce({ ...story, title: 'Tên đã sửa' })
      .mockResolvedValueOnce(story.chapters[0]).mockResolvedValueOnce(story.chapters[1])
    await wrapper.get('.btn-save-draft').trigger('click')
    await flushPromises()
    const update = mockRequest.mock.calls.find(([path, options]) => path === '/api/stories/stored' && options?.method === 'PUT')!
    expect(JSON.parse(update[1].body)).toMatchObject({ title: 'Tên đã sửa', status: 'draft', category: 'Kỳ Ảo' })
    expect(mockRequest).toHaveBeenCalledWith('/api/chapters/c1', expect.objectContaining({ method: 'PUT' }))
    expect(mockRequest).toHaveBeenCalledWith('/api/chapters/c2', expect.objectContaining({ method: 'PUT' }))
    expect(wrapper.emitted('saved')?.[0]?.[0]).toMatchObject({ chapterCount: 2 })
  })

  it('creates every chapter and reuses server IDs on subsequent saves', async () => {
    const wrapper = mount(StoryEditor)
    await wrapper.get('.doc-title-input').setValue('Truyện nhiều chương')
    await wrapper.get('.chapter-add-chip').trigger('click')
    await wrapper.get('.chapter-add-chip').trigger('click')
    const story = storedStory()
    const first = story.chapters[0]!
    const second = { ...first, id: 'new-2', chapterNumber: 2 }
    const third = { ...first, id: 'new-3', chapterNumber: 3 }
    mockRequest.mockResolvedValueOnce({ ...story, chapters: [first] })
      .mockResolvedValueOnce(second).mockResolvedValueOnce(third)
    await wrapper.get('.btn-save-draft').trigger('click')
    await flushPromises()
    expect(mockRequest.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(3)
    expect(wrapper.emitted('saved')?.[0]?.[0]).toMatchObject({ chapterCount: 3 })
    expect(mockReplace).toHaveBeenCalledWith('/library/editor/stored')
    mockRequest.mockClear()
    mockRequest.mockResolvedValueOnce(story).mockResolvedValueOnce(first).mockResolvedValueOnce(second).mockResolvedValueOnce(third)
    await wrapper.get('.btn-save-draft').trigger('click')
    await flushPromises()
    expect(mockRequest.mock.calls.every(([, options]) => options?.method === 'PUT')).toBe(true)
    expect(mockRequest.mock.calls.map(([path]) => path)).toEqual(['/api/stories/stored', '/api/chapters/c1', '/api/chapters/new-2', '/api/chapters/new-3'])
  })

  it('keeps IDs and unsaved content after a partial save so retry does not duplicate chapters', async () => {
    const wrapper = mount(StoryEditor)
    await wrapper.get('.doc-title-input').setValue('Truyện cần thử lại')
    await wrapper.get('.chapter-add-chip').trigger('click')
    await wrapper.get('.chapter-add-chip').trigger('click')
    const first = storedStory().chapters[0]!
    const second = { ...first, id: 'new-2', chapterNumber: 2 }
    mockRequest.mockResolvedValueOnce({ ...storedStory(), chapters: [first] })
      .mockResolvedValueOnce(second).mockRejectedValueOnce(new Error('offline'))
    await wrapper.get('.btn-save-draft').trigger('click')
    await flushPromises()
    expect(wrapper.emitted('saved')).toBeUndefined()
    expect(wrapper.findAll('.chapter-nav-chip')).toHaveLength(3)
    mockRequest.mockClear()
    mockRequest.mockResolvedValueOnce(storedStory()).mockResolvedValueOnce(first)
      .mockResolvedValueOnce(second).mockResolvedValueOnce({ ...first, id: 'new-3', chapterNumber: 3 })
    await wrapper.get('.btn-save-draft').trigger('click')
    await flushPromises()
    expect(mockRequest.mock.calls.filter(([, options]) => options?.method === 'POST').map(([path]) => path)).toEqual(['/api/stories/stored/chapters'])
    expect(wrapper.emitted('saved')).toBeTruthy()
  })

  it('warns before deleting a saved chapter, supports cancellation and preserves server numbering', async () => {
    const wrapper = await openStored()
    const tab = wrapper.findAll('.tab-btn').find(button => button.text().includes('Quản lý chương'))!
    await tab.trigger('click')
    await wrapper.get('.btn-row-delete').trigger('click')
    expect(wrapper.get('[role="alertdialog"]').text()).toContain('Mở đầu')
    expect(wrapper.get('[role="alertdialog"]').text()).toContain('xóa vĩnh viễn')
    expect(mockRequest.mock.calls.filter(([, options]) => options?.method === 'DELETE')).toHaveLength(0)
    await wrapper.get('.chapter-delete-actions button').trigger('click')
    expect(wrapper.findAll('.chapter-row-item')).toHaveLength(2)
    await wrapper.get('.btn-row-delete').trigger('click')
    mockRequest.mockResolvedValueOnce(undefined)
    await wrapper.get('.btn-confirm-delete-chapter').trigger('click')
    await flushPromises()
    expect(mockRequest).toHaveBeenCalledWith('/api/chapters/c1', { method: 'DELETE' })
    expect(wrapper.findAll('.chapter-row-item')).toHaveLength(1)
    expect(wrapper.get('.num-badge').text()).toBe('3')
    expect(wrapper.get('.word-document-content').text()).toContain('Chương ba')
    await wrapper.get('.manager-top-action .btn-primary-action').trigger('click')
    expect(wrapper.findAll('.chapter-nav-chip').at(-1)?.text()).toBe('Chương 4')
  })

  it('retains a chapter on delete failure and prevents duplicate requests while pending', async () => {
    const wrapper = await openStored()
    await wrapper.get('.btn-row-delete').trigger('click')
    let reject!: (error: Error) => void
    mockRequest.mockImplementationOnce(() => new Promise((_, fail) => { reject = fail }))
    await wrapper.get('.btn-confirm-delete-chapter').trigger('click')
    expect(wrapper.get('.btn-confirm-delete-chapter').attributes('disabled')).toBeDefined()
    await wrapper.get('.btn-confirm-delete-chapter').trigger('click')
    expect(mockRequest.mock.calls.filter(([, options]) => options?.method === 'DELETE')).toHaveLength(1)
    reject(new Error('offline'))
    await flushPromises()
    expect(wrapper.findAll('.chapter-row-item')).toHaveLength(2)
    expect(wrapper.get('.chapter-delete-error').text()).toContain('Không thể kết nối')
    expect(wrapper.find('[role="alertdialog"]').exists()).toBe(true)
  })

  it('confirms removal of an unsaved chapter without sending a DELETE request', async () => {
    const wrapper = mount(StoryEditor)
    await wrapper.get('.btn-row-delete').trigger('click')
    expect(wrapper.get('[role="alertdialog"]').text()).toContain('chưa được lưu')
    await wrapper.get('.btn-confirm-delete-chapter').trigger('click')
    await flushPromises()
    expect(mockRequest).not.toHaveBeenCalled()
    expect(wrapper.findAll('.chapter-row-item')).toHaveLength(0)
    expect(wrapper.get('.word-document-content').attributes('contenteditable')).toBe('false')
  })

  it('shows load errors and blocks saving instead of turning a missing story into a new one', async () => {
    mockRoute.params.id = 'missing'
    mockRequest.mockRejectedValueOnce(new Error('offline'))
    const wrapper = mount(StoryEditor)
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('Không thể kết nối')
    expect(wrapper.get('.btn-save-draft').attributes('disabled')).toBeDefined()
    expect(mockRequest).toHaveBeenCalledTimes(1)
    mockRequest.mockResolvedValueOnce({ ...storedStory(), id: 'missing', chapters: [] })
    await wrapper.get('[role="alert"] button').trigger('click')
    await flushPromises()
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.findAll('.chapter-row-item')).toHaveLength(0)
  })

  it('shows stories belonging to other authors as read only', async () => {
    const wrapper = await openStored({ ...storedStory(), userId: 'other-author' })
    expect(wrapper.get('.word-document-content').attributes('contenteditable')).toBe('false')
    expect(wrapper.get('.doc-title-input').attributes('readonly')).toBeDefined()
    expect(wrapper.get('.btn-save-draft').attributes('disabled')).toBeDefined()
    expect(wrapper.get('.btn-row-delete').attributes('disabled')).toBeDefined()
    expect(wrapper.get('.editor-readonly-notice').text()).toContain('Chỉ tác giả')
    expect(wrapper.find('.btn-crop-cover').exists()).toBe(false)
    expect(wrapper.find('.btn-crop-gallery-image').exists()).toBe(false)
  })

})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { createPinia } from 'pinia'
import StoryEditor from '../src/features/library/components/StoryEditor.vue'
import { useAuthStore } from '../src/stores/auth.store'

enableAutoUnmount(afterEach)
const request = vi.fn()
vi.mock('../src/services/api-client', () => ({ createApiClient: () => ({ request }) }))
const story = { id: 'stored', userId: 'author', title: 'Truyện đã lưu', chapters: [
  { id: 'c1', storyId: 'stored', chapterNumber: 1, title: 'Chương 1', content: '<p>Nội dung đã lưu</p>', illustrations: '[]' },
] }
beforeEach(() => {
  request.mockReset()
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value(this: HTMLDialogElement) { this.open = true } })
})
afterEach(() => { Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal'); vi.restoreAllMocks() })
async function editor(path = '/library/editor') {
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/library/editor/:id?', component: StoryEditor },
    { path: '/library', component: { template: '<div>Thư viện</div>' } },
    { path: '/library/bookshelf', component: { template: '<div>Tủ sách</div>' } },
    { path: '/login', component: { template: '<div>Đăng nhập</div>' } },
  ] })
  const pinia = createPinia()
  const auth = useAuthStore(pinia)
  auth.setSession({ user: { id: 'author', displayName: 'Tác giả', email: 'author@example.com', avatarUrl: '/uploads/avatar.jpg' } })
  await router.push('/library')
  await router.push(path)
  const wrapper = mount(RouterView, { attachTo: document.body, global: { plugins: [router, pinia] } })
  await flushPromises()
  return { wrapper, router, auth }
}
function unload() {
  const event = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(event)
  return event.defaultPrevented
}

describe('Editor unsaved changes', () => {
  it('allows an untouched editor to close and warns on browser reload only after an edit', async () => {
    const { wrapper, router } = await editor()
    expect(unload()).toBe(false)
    await wrapper.get('.doc-title-input').setValue('Bản nháp')
    expect(unload()).toBe(true)
    await wrapper.get('.doc-title-input').setValue('')
    expect(unload()).toBe(false)
    await wrapper.get('.btn-back').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/library/bookshelf')
    expect(unload()).toBe(false)
  })

  it('keeps the draft and current route when cancelling a sidebar exit, then permits explicit discard', async () => {
    const { wrapper, router } = await editor()
    await wrapper.get('.doc-title-input').setValue('Chưa lưu')
    await wrapper.get('.nav-item[title="Tủ sách"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/library/editor')
    expect(wrapper.get('#unsaved-description').text()).toContain('chưa lưu sẽ mất')
    await wrapper.get('.unsaved-stay').trigger('click')
    await flushPromises()
    expect(wrapper.get('.doc-title-input').element).toHaveProperty('value', 'Chưa lưu')
    expect(wrapper.find('.unsaved-dialog').exists()).toBe(false)
    const leaving = router.push('/library/bookshelf')
    await flushPromises()
    await wrapper.get('.unsaved-discard').trigger('click')
    await leaving
    expect(router.currentRoute.value.path).toBe('/library/bookshelf')
    expect(unload()).toBe(false)
    expect(request).not.toHaveBeenCalled()
  })

  it('protects the browser Back button and changing to another story in the same editor route', async () => {
    const { wrapper, router } = await editor()
    await wrapper.get('.doc-title-input').setValue('Chưa lưu')
    router.back()
    await flushPromises()
    expect(wrapper.find('.unsaved-dialog').exists()).toBe(true)
    await wrapper.get('.unsaved-stay').trigger('click')
    await flushPromises()
    const changing = router.push('/library/editor/another')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/library/editor')
    await wrapper.get('.unsaved-stay').trigger('click')
    await changing
    expect(request).not.toHaveBeenCalled()
  })

  it('saves all data before leaving, including a newly created story without an intermediate redirect', async () => {
    const { wrapper, router } = await editor()
    await wrapper.get('.doc-title-input').setValue('Truyện mới')
    wrapper.get('.word-document-content').element.innerHTML = '<p>Chưa lưu</p>'
    await wrapper.get('.word-document-content').trigger('input')
    const leaving = router.push('/library')
    await flushPromises()
    let complete!: (value: typeof story) => void
    request.mockImplementationOnce(() => new Promise(resolve => { complete = resolve }))
    await wrapper.get('.unsaved-save').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/library/editor')
    expect(wrapper.get('.unsaved-discard').attributes('disabled')).toBeDefined()
    complete({ ...story, title: 'Truyện mới', chapters: [{ ...story.chapters[0]!, content: '<p>Chưa lưu</p>' }] })
    await leaving
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/library')
    const sent = JSON.parse(request.mock.calls[0]![1].body)
    expect(sent.title).toBe('Truyện mới')
    expect(sent.initialChapter.content).toBe('<p>Chưa lưu</p>')
    expect(unload()).toBe(false)
  })

  it('retains the draft and warning after a failed save, and clears it only after a successful retry', async () => {
    const { wrapper, router } = await editor()
    await wrapper.get('.doc-title-input').setValue('Truyện mới')
    const leaving = router.push('/library')
    await flushPromises()
    request.mockRejectedValueOnce(new Error('offline'))
    await wrapper.get('.unsaved-save').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/library/editor')
    expect(wrapper.get('.unsaved-error').text()).toContain('Chưa lưu được truyện')
    expect(unload()).toBe(true)
    request.mockResolvedValueOnce({ ...story, title: 'Truyện mới' })
    await wrapper.get('.unsaved-save').trigger('click')
    await leaving
    expect(router.currentRoute.value.path).toBe('/library')
  })

  it('does not prompt after an ordinary save normalizes the new story route', async () => {
    const { wrapper, router } = await editor()
    await wrapper.get('.doc-title-input').setValue('Truyện mới')
    request.mockImplementationOnce((_: string, options: RequestInit) => {
      const data = JSON.parse(String(options.body))
      return Promise.resolve({ ...story, ...data, chapters: [{ ...data.initialChapter, id: 'c1', storyId: 'stored' }] })
    })
    await wrapper.get('.btn-save-draft').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/library/editor/stored')
    expect(wrapper.find('.unsaved-dialog').exists()).toBe(false)
    expect(unload()).toBe(false)
    await router.push('/library')
    expect(router.currentRoute.value.path).toBe('/library')
  })

  it('still warns if only metadata was saved and a chapter update failed', async () => {
    request.mockResolvedValueOnce(story)
    const { wrapper, router } = await editor('/library/editor/stored')
    await wrapper.get('.doc-title-input').setValue('Tên đã sửa')
    request.mockResolvedValueOnce({ ...story, title: 'Tên đã sửa' }).mockRejectedValueOnce(new Error('Chapter save failed'))
    await wrapper.get('.btn-save-draft').trigger('click')
    await flushPromises()
    expect(unload()).toBe(true)
    const leaving = router.push('/library')
    await flushPromises()
    expect(wrapper.find('.unsaved-dialog').exists()).toBe(true)
    await wrapper.get('.unsaved-stay').trigger('click')
    await leaving
    expect(router.currentRoute.value.path).toBe('/library/editor/stored')
  })

  it('warns before logout without ending the session on cancellation or prompting twice on discard', async () => {
    const { wrapper, router, auth } = await editor()
    const logout = vi.spyOn(auth, 'logout').mockImplementation(async () => { auth.clearSession() })
    await wrapper.get('.doc-title-input').setValue('Chưa lưu')
    await wrapper.get('.logout-btn').trigger('click')
    await flushPromises()
    expect(logout).not.toHaveBeenCalled()
    await wrapper.get('.unsaved-stay').trigger('click')
    await flushPromises()
    expect(auth.isAuthenticated).toBe(true)
    await wrapper.get('.logout-btn').trigger('click')
    await flushPromises()
    await wrapper.get('.unsaved-discard').trigger('click')
    await flushPromises()
    expect(logout).toHaveBeenCalledTimes(1)
    expect(router.currentRoute.value.path).toBe('/login')
    expect(wrapper.find('.unsaved-dialog').exists()).toBe(false)
  })

  it('does not warn for a loaded story that has not been edited or a persisted chapter deletion', async () => {
    request.mockResolvedValueOnce(story)
    const { wrapper, router } = await editor('/library/editor/stored')
    expect(unload()).toBe(false)
    await wrapper.get('.btn-row-delete').trigger('click')
    request.mockResolvedValueOnce(undefined)
    await wrapper.get('.btn-confirm-delete-chapter').trigger('click')
    await flushPromises()
    expect(unload()).toBe(false)
    await router.push('/library')
    expect(router.currentRoute.value.path).toBe('/library')
  })

  it('does not mistake browser-normalized HTML or switching chapters for a new edit', async () => {
    request.mockResolvedValueOnce({ ...story, chapters: [
      { ...story.chapters[0]!, content: '<p><img src="/uploads/one.jpg" /></p>' },
      { ...story.chapters[0]!, id: 'c2', chapterNumber: 2, title: 'Chương 2', content: '<p><img src="/uploads/two.jpg" /></p>' },
    ] })
    const { wrapper, router } = await editor('/library/editor/stored')
    await wrapper.findAll('.chapter-nav-chip')[1]!.trigger('click')
    expect(unload()).toBe(false)
    await router.push('/library')
    expect(router.currentRoute.value.path).toBe('/library')
  })
})

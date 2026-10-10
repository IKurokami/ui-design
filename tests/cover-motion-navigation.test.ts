import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createPinia } from 'pinia'
import App from '../src/app/App.vue'
import BookshelfPage from '../src/features/library/pages/BookshelfPage.vue'
import StoryEditor from '../src/features/library/components/StoryEditor.vue'
import { useAuthStore } from '../src/stores/auth.store'
import { captureMotion } from '../src/animations/auto/motion'

enableAutoUnmount(afterEach)

const story = {
  id: 'story', userId: 'author', title: 'Truyện có bìa', coverUrl: '/uploads/story.jpg',
  status: 'published', chapters: [{ id: 'chapter', storyId: 'story', chapterNumber: 1, title: 'Chương 1', content: '<p>Nội dung</p>' }],
}

describe('cover shared motion between bookshelf and editor', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }))
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const data = url.startsWith('/api/stories/mine?') ? [story] : story
      return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }))
  })
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); document.body.innerHTML = '' })

  it('keeps the clicked cover as a shared target when entering the editor', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes: [
      { path: '/library/bookshelf', name: 'bookshelf', component: BookshelfPage, meta: { layout: 'dashboard' } },
      { path: '/library/editor/:id', name: 'editor', component: StoryEditor, meta: { layout: 'dashboard' } },
    ] })
    const pinia = createPinia()
    useAuthStore(pinia).setSession({ user: { id: 'author', displayName: 'Tác giả', email: 'author@example.com' } })
    await router.push('/library/bookshelf')
    const rect = (left: number) => ({ left, top: 100, width: 170, height: 220, right: left + 170, bottom: 320, x: left, y: 100, toJSON() {} })
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.getAttribute('data-motion-key') === 'cover:story') {
        const page = this.closest('.page-screen')?.getAttribute('data-page')
        return rect(page === 'editor' ? 300 : 40) as DOMRect
      }
      return rect(0) as DOMRect
    })
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    const wrapper = mount(App, { attachTo: document.body, global: { plugins: [router, pinia], stubs: { transition: false } } })
    await flushPromises()
    expect(wrapper.get('[data-motion-key="cover:story"]')).toBeTruthy()
    const snapshot = captureMotion(wrapper.get('.page-screen').element as HTMLElement, { ghosts: true })
    await wrapper.get('.book-open').trigger('click')
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(router.currentRoute.value.path).toBe('/library/editor/story')
    snapshot.release()
    expect(document.querySelector('[data-motion-overlay]')).toBeTruthy()
    await new Promise(resolve => setTimeout(resolve, 760))
    await wrapper.get('.btn-back').trigger('click')
    await new Promise(resolve => setTimeout(resolve, 24))
    expect(router.currentRoute.value.path).toBe('/library/bookshelf')
    expect(document.querySelector('[data-motion-overlay]')).toBeTruthy()
  })
})

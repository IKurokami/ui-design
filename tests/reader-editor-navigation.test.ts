import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createPinia } from 'pinia'
import gsap from 'gsap'
import App from '../src/app/App.vue'
import LibraryPage from '../src/features/library/pages/LibraryPage.vue'
import StoryDetailPage from '../src/features/library/pages/StoryDetailPage.vue'
import StoryEditor from '../src/features/library/components/StoryEditor.vue'
import { useAuthStore } from '../src/stores/auth.store'

enableAutoUnmount(afterEach)
const story = { id: 'story', userId: 'author', title: 'Truyện', status: 'published', chapters: [
  { id: 'one', storyId: 'story', chapterNumber: 1, title: 'Chương một', content: '<p>Nội dung một</p>' },
  { id: 'two', storyId: 'story', chapterNumber: 2, title: 'Chương hai', content: '<p>Nội dung hai</p>' },
] }
beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }))
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  vi.stubGlobal('fetch', vi.fn(async (url: string, options: RequestInit) => {
    if (options?.method === 'PUT') return new Response(null, { status: 204 })
    const data = url.endsWith('/reading-progress') ? { chapterId: 'one' } : url.endsWith('/api/stories/story') ? story : [story]
    return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }))
})
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('Actual route transitions into reading and publishing', () => {
  it.each([
    ['story-detail', '/library/stories/story', '.reader-layout'],
    ['story-editor', '/library/editor', '.studio-layout'],
  ])('coordinates both screens entering and returning from %s', async (name, path, selector) => {
    const router = createRouter({ history: createMemoryHistory(), routes: [
      { path: '/library', name: 'library', component: LibraryPage, meta: { layout: 'dashboard' } },
      { path: '/library/stories/:id', name: 'story-detail', component: StoryDetailPage, meta: { layout: 'dashboard' } },
      { path: '/library/editor', name: 'story-editor', component: StoryEditor, meta: { layout: 'dashboard' } },
    ] })
    const pinia = createPinia()
    useAuthStore(pinia).setSession({ user: { id: 'author', displayName: 'Tác giả', email: 'author@example.com' } })
    await router.push('/library')
    const wrapper = mount(App, { attachTo: document.body, global: { plugins: [router, pinia], stubs: { transition: false } } })
    await flushPromises()
    const library = wrapper.get('[data-page="library"]').element as HTMLElement
    await router.push(path); await flushPromises()
    expect(wrapper.find(selector).exists()).toBe(true)
    const incoming = wrapper.get(`[data-page="${name}"]`).element as HTMLElement
    expect(wrapper.findAll('.page-screen')).toHaveLength(2)
    const leaving = gsap.getTweensOf(library)[0]!, entering = gsap.getTweensOf(incoming)[0]!
    expect(leaving).toBeDefined(); expect(entering).toBeDefined()
    leaving.progress(.5); entering.progress(.5)
    expect(library.isConnected).toBe(true); expect(incoming.isConnected).toBe(true)
    expect(library.style.zIndex).toBe('1'); expect(incoming.style.zIndex).toBe('2')
    leaving.progress(1); entering.progress(1); await flushPromises()
    expect(wrapper.findAll('.page-screen')).toHaveLength(1)
    expect(incoming.style.transform).toBe(''); expect(incoming.style.pointerEvents).toBe('')
    router.back(); await flushPromises()
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/library'))
    await flushPromises()
    const returned = wrapper.get('[data-page="library"]').element as HTMLElement
    expect(incoming.style.zIndex).toBe('2'); expect(returned.style.zIndex).toBe('1')
    const backOut = gsap.getTweensOf(incoming)[0]!, backIn = gsap.getTweensOf(returned)[0]!
    expect(backOut).toBeDefined(); expect(backIn).toBeDefined()
    backOut.progress(1); backIn.progress(1); await flushPromises()
    expect(wrapper.findAll('.page-screen')).toHaveLength(1)
    expect(incoming.isConnected).toBe(false)
    expect(returned.style.transform).toBe(''); expect(returned.style.pointerEvents).toBe('')
    expect(wrapper.findAll('.app-brand')).toHaveLength(1)
  })
})

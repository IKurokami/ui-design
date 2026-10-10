import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { providePageScrollRestoration } from '../src/animations/composables/usePageScrollRestoration'
import LibraryPage from '../src/features/library/pages/LibraryPage.vue'
import BookshelfPage from '../src/features/library/pages/BookshelfPage.vue'
import StoryDetailPage from '../src/features/library/pages/StoryDetailPage.vue'
import { libraryStories } from './fixtures/library-stories'

enableAutoUnmount(afterEach)
const request = vi.fn()
const json = (data: unknown) => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } })
const Host = defineComponent({
  setup() {
    providePageScrollRestoration()
    return () => h(RouterView, {}, { default: ({ Component, route }: any) => Component ? h(Component, { key: route.path }) : null })
  },
})
beforeEach(() => {
  sessionStorage.clear()
  request.mockReset()
  vi.stubGlobal('fetch', request)
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: vi.fn() })
})
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); Reflect.deleteProperty(HTMLDialogElement.prototype, 'close') })
async function pages(path = '/library') {
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/library', component: LibraryPage },
    { path: '/library/bookshelf', component: BookshelfPage },
    { path: '/library/stories/:id', component: StoryDetailPage },
    { path: '/other', component: { template: '<div />' } },
  ] })
  await router.push(path)
  const wrapper = mount(Host, { global: { plugins: [router], stubs: { LibrarySidebar: true, AmbientBackdrop: true } } })
  await flushPromises()
  return { router, wrapper }
}
function scroll(element: Element, top: number) {
  element.scrollTop = top
  element.dispatchEvent(new Event('scroll'))
}

describe('Dashboard page scroll', () => {
  it('restores Library after returning through a link or browser history', async () => {
    request.mockImplementation(() => Promise.resolve(json(libraryStories)))
    const { router, wrapper } = await pages()
    scroll(wrapper.get('.library-scroll-area').element, 650)
    await router.push('/library/bookshelf'); await flushPromises()
    scroll(wrapper.get('.bookshelf-scroll-area').element, 210)
    await router.push('/library'); await flushPromises()
    expect(wrapper.get('.library-scroll-area').element.scrollTop).toBe(650)
    router.back(); await flushPromises()
    expect(wrapper.get('.bookshelf-scroll-area').element.scrollTop).toBe(210)
    router.back(); await flushPromises()
    expect(wrapper.get('.library-scroll-area').element.scrollTop).toBe(650)
  })

  it('does not lose the saved position while a returning page is waiting for its API data', async () => {
    request.mockResolvedValueOnce(json(libraryStories))
    const { router, wrapper } = await pages()
    scroll(wrapper.get('.library-scroll-area').element, 650)
    await router.push('/other'); await flushPromises()
    let finish!: (response: Response) => void
    request.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    router.back(); await flushPromises()
    const returning = wrapper.get('.library-scroll-area').element
    let maximum = 0
    let top = 0
    Object.defineProperty(returning, 'scrollTop', { configurable: true, get: () => top, set: value => { top = Math.min(Number(value), maximum) } })
    returning.dispatchEvent(new Event('scroll'))
    maximum = 2000
    finish(json(libraryStories)); await flushPromises()
    expect(returning.scrollTop).toBe(650)
    // Once restored, the user can freely move to a different position.
    scroll(returning, 320)
    await router.push('/other'); await flushPromises()
    request.mockResolvedValueOnce(json(libraryStories))
    router.back(); await flushPromises()
    expect(wrapper.get('.library-scroll-area').element.scrollTop).toBe(320)
  })

  it('remembers separate positions for the Library and reading-history tab in the same component', async () => {
    request.mockImplementation(() => Promise.resolve(json(libraryStories)))
    const { router, wrapper } = await pages()
    scroll(wrapper.get('.library-scroll-area').element, 600)
    await router.push('/library?tab=reading'); await flushPromises()
    expect(wrapper.get('.library-scroll-area').element.scrollTop).toBe(0)
    scroll(wrapper.get('.library-scroll-area').element, 220)
    await router.push('/library'); await flushPromises()
    expect(wrapper.get('.library-scroll-area').element.scrollTop).toBe(600)
    router.back(); await flushPromises()
    expect(wrapper.get('.library-scroll-area').element.scrollTop).toBe(220)
  })

  it('starts a new chapter at the top and restores each chapter when revisiting it', async () => {
    let recent = 'c1'
    const story = { id: 'story', userId: 'author', title: 'Truyện', chapters: [
      { id: 'c1', storyId: 'story', chapterNumber: 1, title: 'Một', content: '<p>Nội dung một</p>' },
      { id: 'c2', storyId: 'story', chapterNumber: 2, title: 'Hai', content: '<p>Nội dung hai</p>' },
    ] }
    request.mockImplementation((path: string, options: RequestInit) => {
      if (options.method === 'PUT') { recent = JSON.parse(String(options.body)).chapterId; return Promise.resolve(new Response(null, { status: 204 })) }
      return Promise.resolve(json(path.endsWith('reading-progress') ? { chapterId: recent } : path.startsWith('/api/stories?') ? libraryStories : story))
    })
    const { router, wrapper } = await pages('/library/stories/story')
    scroll(wrapper.get('.reading-scroll').element, 480)
    await wrapper.get('.next-chapter').trigger('click'); await flushPromises()
    expect(wrapper.get('.reading-scroll').element.scrollTop).toBe(0)
    scroll(wrapper.get('.reading-scroll').element, 250)
    router.back(); await flushPromises()
    expect(wrapper.get('.reading-scroll').element.scrollTop).toBe(480)
    await router.push('/library'); await flushPromises()
    await router.push('/library/stories/story'); await flushPromises()
    expect(wrapper.get('.chapter-heading').text()).toBe('Một')
    expect(wrapper.get('.reading-scroll').element.scrollTop).toBe(480)
  })
})

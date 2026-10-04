import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import LibrarySortMenu from '../src/features/library/components/LibrarySortMenu.vue'
import LibraryPage from '../src/features/library/pages/LibraryPage.vue'
import { sortCollections } from '../src/features/library/sorting'
import { libraryStories } from './fixtures/library-stories'
import { storyToDeck } from '../src/features/library/story-mapping'
vi.mock('../src/services/api-client', () => ({ createApiClient: () => ({ request: vi.fn(async () => libraryStories) }) }))
import type { CollectionDeck } from '../src/features/library/types'

const cleanups: (() => void)[] = []
afterEach(() => {
  cleanups.splice(0).forEach(cleanup => cleanup())
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

const deck = (id: string, title: string, createdAt?: string): CollectionDeck => ({
  id, title, createdAt, category: 'fantasy', itemCount: 1,
  covers: ['', '', ''], tags: [],
})
const books = [
  deck('b', 'Bộ 10', '2026-09-01'),
  deck('a', 'Bộ 2', '2026-09-03'),
  deck('c', 'An', '2026-09-02'),
]
const ids = (items: CollectionDeck[]) => items.map(item => item.id)

describe('Library sorting', () => {
  it('sorts titles naturally and dates chronologically without mutating source data', () => {
    expect(ids(sortCollections(books, 'title-asc'))).toEqual(['c', 'a', 'b'])
    expect(ids(sortCollections(books, 'title-desc'))).toEqual(['b', 'a', 'c'])
    expect(ids(sortCollections(books, 'newest'))).toEqual(['a', 'c', 'b'])
    expect(ids(sortCollections(books, 'oldest'))).toEqual(['b', 'c', 'a'])
    expect(ids(books)).toEqual(['b', 'a', 'c'])
  })

  it('keeps unknown dates last and uses titles to resolve ties', () => {
    const items = [...books, deck('unknown', 'A', 'invalid'), deck('tied', 'Z', undefined)]
    expect(ids(sortCollections(items, 'oldest'))).toEqual(['b', 'c', 'a', 'unknown', 'tied'])
    expect(ids(sortCollections(items, 'newest'))).toEqual(['a', 'c', 'b', 'unknown', 'tied'])
  })

  it('portals the menu outside clipping parents and supports keyboard selection with focus restoration', async () => {
    const container = document.createElement('div')
    container.style.overflow = 'hidden'
    document.body.append(container)
    const wrapper = mount(LibrarySortMenu, { attachTo: container })
    cleanups.push(() => wrapper.unmount())
    const trigger = wrapper.get('button')
    await trigger.trigger('click')
    await flushPromises()
    const menu = document.querySelector<HTMLElement>('[role="menu"]')!
    expect(menu.parentElement).toBe(document.body)
    expect(document.activeElement?.textContent).toContain('Ngày tạo mới nhất')
    menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }))
    expect(document.activeElement?.textContent).toContain('Ngày tạo cũ nhất')
    ;(document.activeElement as HTMLButtonElement).click()
    await flushPromises()
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['oldest'])
    expect(document.querySelector('[role="menu"]')).toBeNull()
    expect(document.activeElement).toBe(trigger.element)
  })

  it('keeps the popup inside a narrow viewport and closes on Escape, outside click, scroll and collapse', async () => {
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(320)
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(400)
    const wrapper = mount(LibrarySortMenu, { attachTo: document.body })
    cleanups.push(() => wrapper.unmount())
    const trigger = wrapper.get('button')
    vi.spyOn(trigger.element, 'getBoundingClientRect').mockReturnValue({ left: 280, right: 318, top: 350, bottom: 392, width: 38, height: 42, x: 280, y: 350, toJSON() {} })
    await trigger.trigger('click')
    const popup = document.querySelector<HTMLElement>('[role="menu"]')!
    expect(parseFloat(popup.style.left) + parseFloat(popup.style.width)).toBeLessThanOrEqual(312)
    expect(parseFloat(popup.style.top) + parseFloat(popup.style.maxHeight)).toBeLessThan(350)
    popup.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()
    expect(document.querySelector('[role="menu"]')).toBeNull()
    await trigger.trigger('click')
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await flushPromises()
    expect(document.querySelector('[role="menu"]')).toBeNull()
    await trigger.trigger('click')
    document.dispatchEvent(new Event('scroll'))
    await flushPromises()
    expect(document.querySelector('[role="menu"]')).toBeNull()
    await trigger.trigger('click')
    await wrapper.setProps({ compact: true })
    expect(document.querySelector('[role="menu"]')).toBeNull()
  })

  it('applies sorting to filtered results and keeps that order when switching views', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/library', component: LibraryPage }] })
    await router.push('/library')
    const wrapper = mount(LibraryPage, { attachTo: document.body, global: { plugins: [createPinia(), router] } })
    cleanups.push(() => wrapper.unmount())
    await flushPromises()
    await wrapper.get('[data-category="category:Kỳ Ảo"]').trigger('click')
    await wrapper.get('.sort-trigger').trigger('click')
    const favorites = [...document.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]')].find(button => button.textContent?.includes('Tên Z'))!
    favorites.click()
    await flushPromises()
    const expected = sortCollections(libraryStories.filter(item => item.category === 'Kỳ Ảo').map(storyToDeck), 'title-desc').map(item => item.title)
    expect(wrapper.findAll('.deck-title').map(item => item.text())).toEqual(expected)
    expect(wrapper.get('.header-stats').text()).toBe(`${expected.length} bộ truyện`)
    await wrapper.get('[aria-label="Dạng danh sách"]').trigger('click')
    expect(wrapper.findAll('.list-copy strong').map(item => item.text())).toEqual(expected)
    await wrapper.get('input[type="search"]').setValue('no-such-book')
    expect(wrapper.get('.header-stats').text()).toBe('0 bộ truyện')
    expect(wrapper.find('.empty-state').exists()).toBe(true)
  })
})

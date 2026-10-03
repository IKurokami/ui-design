import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import gsap from 'gsap'
import { Flip } from 'gsap/Flip'
import LibraryStickyHeader from '../src/features/library/components/LibraryStickyHeader.vue'
import type { ViewMode } from '../src/features/library/types'

const cleanups: (() => void)[] = []
afterEach(() => {
  cleanups.splice(0).forEach(cleanup => cleanup())
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

async function header() {
  const scroll = document.createElement('div')
  scroll.style.paddingTop = '30px'
  document.body.append(scroll)
  const Host = defineComponent({
    setup() {
      const category = ref('all')
      const mode = ref<ViewMode>('deck')
      const query = ref('')
      return () => h(LibraryStickyHeader, {
        scrollElement: scroll, title: 'Tổng hợp', totalItems: 276, totalCollections: 14,
        categories: [{ id: 'all', label: 'Tất cả tác phẩm' }, { id: 'isekai', label: 'Isekai', count: 14820 }, { id: 'fantasy', label: 'Fantasy', count: 12450 }],
        activeCategory: category.value, viewMode: mode.value, searchQuery: query.value,
        'onUpdate:activeCategory': (value: string) => { category.value = value },
        'onUpdate:viewMode': (value: ViewMode) => { mode.value = value },
        'onUpdate:searchQuery': (value: string) => { query.value = value },
      })
    },
  })
  const wrapper = mount(Host, { attachTo: scroll })
  cleanups.push(() => wrapper.unmount())
  const toolbar = wrapper.get('.library-sticky-header').element as HTMLElement
  vi.spyOn(toolbar, 'getBoundingClientRect').mockImplementation(() => ({
    left: 76, top: 0, width: 900, height: toolbar.classList.contains('is-compact') ? 64 : 264,
    right: 976, bottom: toolbar.classList.contains('is-compact') ? 64 : 264, x: 76, y: 0, toJSON() {},
  }))
  await flushPromises()
  async function scrollTo(top: number) {
    scroll.scrollTop = top
    scroll.dispatchEvent(new Event('scroll'))
    await flushPromises()
  }
  const compact = () => wrapper.get('.library-sticky-header').classes().includes('is-compact')
  return { wrapper, scroll, scrollTo, compact }
}

describe('sticky Library header driven by the existing auto motion engine', () => {
  it('collapses to essential filters, retaining real controls, values and list space', async () => {
    const { wrapper, scrollTo, compact } = await header()
    const flip = vi.spyOn(Flip, 'from')
    const input = wrapper.get('input').element as HTMLInputElement
    await wrapper.get('input').setValue('Overlord')
    await wrapper.findAll('.category-pill')[1]!.trigger('click')
    const selected = wrapper.get('.category-pill.active').element
    const allGenres = wrapper.get('[data-motion-key="category:all"]').element
    await wrapper.findAll('.mode-btn')[1]!.trigger('click')
    ;(selected as HTMLElement).focus()
    await scrollTo(60)
    expect(compact()).toBe(false)
    await scrollTo(240)
    expect(compact()).toBe(true)
    expect(wrapper.find('.header-title').exists()).toBe(false)
    expect(wrapper.findAll('.category-pill')).toHaveLength(1)
    expect(wrapper.get('.category-pill').element).toBe(allGenres)
    expect(wrapper.get('.category-pill').text()).toBe('Tất cả thể loại')
    expect(wrapper.get('.category-pill').attributes('aria-label')).toContain('Isekai')
    expect(wrapper.get('input').element).toBe(input)
    expect(input.value).toBe('Overlord')
    expect(wrapper.findAll('.mode-btn')[1]!.attributes('aria-checked')).toBe('true')
    expect((wrapper.get('.library-header-spacer').element as HTMLElement).style.height).toBe('200px')
    expect(flip).toHaveBeenCalledOnce()
    const options = flip.mock.calls[0]![1]!
    expect(options.ease).toBe('sine.inOut')
    expect(options.duration).toBe(0.52)
    expect(options.scale).toBe(false)
    expect((options.targets as Element[])).toContain(wrapper.get('.search-input-wrapper').element)
    await wrapper.get('.category-pill').trigger('click')
    await flushPromises()
    expect(wrapper.get('.category-pill.active').text()).toContain('Isekai')
  })

  it('opens on click or at the top, without oscillating near the collapse threshold', async () => {
    const { wrapper, scrollTo, compact } = await header()
    await scrollTo(240)
    expect(compact()).toBe(true)
    // Native pointer clicks focus a button before delivering the click.
    ;(wrapper.get('.header-expand-btn').element as HTMLElement).focus()
    await flushPromises()
    expect(compact()).toBe(true)
    await wrapper.get('.header-expand-btn').trigger('click')
    await flushPromises()
    expect(compact()).toBe(false)
    expect(wrapper.findAll('.category-pill')).toHaveLength(3)
    await scrollTo(241)
    expect(compact()).toBe(false)
    await scrollTo(320)
    expect(compact()).toBe(true)
    await scrollTo(60)
    expect(compact()).toBe(true)
    await scrollTo(3)
    expect(compact()).toBe(false)
    expect(wrapper.get('.header-expand-btn').attributes('aria-expanded')).toBe('true')
    await scrollTo(240)
    await wrapper.get('.library-sticky-header').trigger('click')
    await flushPromises()
    expect(compact()).toBe(false)
  })

  it('keeps a focused search stable and opens the full header on keyboard focus', async () => {
    const { wrapper, scrollTo, compact } = await header()
    const input = wrapper.get('input').element as HTMLInputElement
    input.focus()
    await scrollTo(240)
    expect(compact()).toBe(false)
    input.blur()
    await scrollTo(260)
    expect(compact()).toBe(true)
    input.focus()
    await flushPromises()
    expect(compact()).toBe(false)
    expect(wrapper.get('input').element).toBe(input)
    expect(document.activeElement === input).toBe(true)
    await scrollTo(360)
    expect(compact()).toBe(false)
    input.blur()
    await scrollTo(380)
    expect(compact()).toBe(true)
  })

  it('releases Flip styles and scroll listeners when unmounted during motion', async () => {
    const { wrapper, scroll, scrollTo } = await header()
    const search = wrapper.get('.search-input-wrapper').element as HTMLElement
    const flip = vi.spyOn(Flip, 'from')
    await scrollTo(240)
    expect(flip).toHaveBeenCalledOnce()
    wrapper.unmount()
    cleanups.pop()
    expect(gsap.getTweensOf(search)).toHaveLength(0)
    expect(search.hasAttribute('data-flip-id')).toBe(false)
    expect(search.classList.contains('is-motion-flipping')).toBe(false)
    expect(document.querySelector('[data-motion-overlay]')).toBeNull()
    scroll.scrollTop = 0
    scroll.dispatchEvent(new Event('scroll'))
    await flushPromises()
    expect(flip).toHaveBeenCalledOnce()
  })
})

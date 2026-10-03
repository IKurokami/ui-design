import { afterEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
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
const rect = (left: number, top: number, width: number, height: number) => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON() {} })
const ui = () => new DOMWrapper(document.querySelector<HTMLElement>('.library-sticky-header')!)
async function finishMotion() {
  await flushPromises()
  gsap.globalTimeline.getChildren(false, false, true).forEach(animation => animation.totalProgress(1))
  await flushPromises()
}
async function header(initialScroll = 0) {
  const scroll = document.createElement('div')
  scroll.style.cssText = 'padding:30px 38px;overflow:hidden;--library-accent:#435a41;'
  scroll.scrollTop = initialScroll
  document.body.append(scroll)
  const contentBounds = vi.spyOn(scroll, 'getBoundingClientRect').mockReturnValue(rect(80, 20, 900, 700))
  const Host = defineComponent({
    setup() {
      const category = ref('all')
      const mode = ref<ViewMode>('deck')
      const query = ref('')
      return () => h(LibraryStickyHeader, {
        scrollElement: scroll, title: 'Thư viện', totalCollections: 14,
        categories: [{ id: 'all', label: 'Tất cả tác phẩm' }, { id: 'isekai', label: 'Isekai' }, { id: 'fantasy', label: 'Fantasy' }],
        activeCategory: category.value, viewMode: mode.value, searchQuery: query.value,
        'onUpdate:activeCategory': (value: string) => { category.value = value },
        'onUpdate:viewMode': (value: ViewMode) => { mode.value = value },
        'onUpdate:searchQuery': (value: string) => { query.value = value },
      })
    },
  })
  const wrapper = mount(Host, { attachTo: scroll })
  cleanups.push(() => wrapper.unmount())
  const body = ui().get('.toolbar-body').element as HTMLElement
  const toolbar = ui().element as HTMLElement
  const slot = wrapper.get('.library-header-slot').element as HTMLElement
  vi.spyOn(body, 'getBoundingClientRect').mockImplementation(() => rect(118, 20, 824, toolbar.classList.contains('is-compact') ? 64 : 264))
  vi.spyOn(slot, 'getBoundingClientRect').mockImplementation(() => rect(118, 20, 824, parseFloat(slot.style.height) || (slot.classList.contains('has-compact-height') ? 64 : 264)))
  await finishMotion()
  async function scrollTo(top: number) {
    scroll.scrollTop = top
    scroll.dispatchEvent(new Event('scroll'))
    await flushPromises()
  }
  const compact = () => ui().attributes('data-header-mode') === 'compact'
  return { wrapper, scroll, scrollTo, compact, slot, contentBounds }
}

describe('Library header state and panel animation', () => {
  it('collapses on the first pixel, removes the old Flip animation and retains real controls', async () => {
    const { scrollTo, compact } = await header()
    const flip = vi.spyOn(Flip, 'from')
    const input = ui().get('input').element as HTMLInputElement
    await ui().get('input').setValue('Overlord')
    await ui().get('[data-category="isekai"]').trigger('click')
    await ui().get('[aria-label="Dạng danh sách"]').trigger('click')
    input.focus()
    await scrollTo(1)
    expect(compact()).toBe(true)
    expect(ui().find('.header-title').exists()).toBe(false)
    expect(ui().findAll('.category-pill')).toHaveLength(1)
    expect(ui().get('.category-pill').text()).toBe('Isekai')
    expect(ui().get('input').element).toBe(input)
    expect(input.value).toBe('Overlord')
    expect(document.activeElement).toBe(input)
    expect(flip).not.toHaveBeenCalled()
    expect(document.querySelector('[data-motion-overlay]')).toBeNull()
    await finishMotion()
  })

  it('never expands from scroll corrections, focus or clicks while manually collapsed at the top', async () => {
    const { scrollTo, compact } = await header()
    await ui().get('.header-expand-btn').trigger('click')
    await finishMotion()
    for (const top of [0, 1, 0, 2, 3, 25, 0]) {
      await scrollTo(top)
      expect(compact()).toBe(true)
    }
    ;(ui().get('input').element as HTMLInputElement).focus()
    await ui().get('input').trigger('click')
    await ui().get('[aria-label="Dạng danh sách"]').trigger('click')
    expect(compact()).toBe(true)
    await ui().get('.header-expand-btn').trigger('click')
    await finishMotion()
    expect(ui().attributes('data-header-mode')).toBe('inline')
    expect(ui().classes()).not.toContain('is-floating')
  })

  it('opens full content width outside clipping ancestors and animates the white surface in both directions', async () => {
    const { scrollTo, scroll, slot } = await header()
    await scrollTo(100)
    await finishMotion()
    const timelineSpy = vi.spyOn(gsap, 'timeline')
    const input = ui().get('input').element
    await ui().get('.header-expand-btn').trigger('click')
    await flushPromises()
    const panel = ui().element as HTMLElement
    const background = ui().get('.library-panel-backdrop').element as HTMLElement
    expect(panel.parentElement).toBe(document.body)
    expect(panel.style.left).toBe('80px')
    expect(panel.style.top).toBe('20px')
    expect(panel.style.width).toBe('900px')
    expect(panel.style.getPropertyValue('--panel-padding-left')).toBe('38px')
    expect(ui().get('input').element).toBe(input)
    expect(slot.classList.contains('has-compact-height')).toBe(true)
    expect(scroll.scrollTop).toBe(100)
    const opening = timelineSpy.mock.results.at(-1)!.value as gsap.core.Timeline
    opening.progress(.5)
    expect(Number(gsap.getProperty(background, 'scaleY'))).toBeGreaterThan(0)
    expect(Number(gsap.getProperty(background, 'scaleY'))).toBeLessThan(1)
    await finishMotion()
    await ui().get('.header-expand-btn').trigger('click')
    await flushPromises()
    expect(panel.parentElement).toBe(document.body)
    const closing = timelineSpy.mock.results.at(-1)!.value as gsap.core.Timeline
    closing.progress(.5)
    expect(Number(gsap.getProperty(background, 'scaleY'))).toBeGreaterThan(0)
    expect(Number(gsap.getProperty(background, 'scaleY'))).toBeLessThan(1)
    await finishMotion()
    expect(panel.parentElement).toBe(slot)
    expect(ui().classes()).not.toContain('is-floating')
    expect(background.style.display).toBe('none')
    expect(scroll.scrollTop).toBe(100)
  })

  it('keeps an explicitly opened panel open during scrolling and retains filters through portal moves', async () => {
    const { scrollTo } = await header()
    await ui().get('input').setValue('Overlord')
    await ui().get('[data-category="isekai"]').trigger('click')
    await scrollTo(5)
    await finishMotion()
    await ui().get('.category-pill').trigger('click')
    await finishMotion()
    await scrollTo(6)
    await scrollTo(0)
    expect(ui().attributes('data-header-mode')).toBe('overlay')
    await ui().get('.reset-filters').trigger('click')
    expect((ui().get('input').element as HTMLInputElement).value).toBe('')
    expect(ui().get('.category-pill.active').text()).toBe('Tất cả')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await finishMotion()
    expect(ui().attributes('data-header-mode')).toBe('compact')
    expect(document.activeElement).toBe(ui().get('.header-expand-btn').element)
  })

  it('survives rapid open/close reversals without duplicate controls or stranded portals', async () => {
    const { scrollTo, compact } = await header()
    const input = ui().get('input').element
    await scrollTo(10)
    for (let index = 0; index < 6; index++) {
      await ui().get('.header-expand-btn').trigger('click')
      await flushPromises()
    }
    await finishMotion()
    expect(compact()).toBe(true)
    expect(document.querySelectorAll('.library-sticky-header')).toHaveLength(1)
    expect(document.querySelectorAll('input')).toHaveLength(1)
    expect(ui().get('input').element).toBe(input)
    expect(ui().classes()).not.toContain('is-floating')
    expect((ui().get('.toolbar-body').element as HTMLElement).style.transform).toBe('')
  })

  it('updates portal bounds on resize and closes on outside pointer input', async () => {
    const { scrollTo, contentBounds } = await header()
    await scrollTo(50)
    await finishMotion()
    await ui().get('.header-expand-btn').trigger('click')
    await finishMotion()
    contentBounds.mockReturnValue(rect(60, 10, 300, 600))
    window.dispatchEvent(new Event('resize'))
    await flushPromises()
    expect((ui().element as HTMLElement).style.width).toBe('300px')
    expect((ui().element as HTMLElement).style.left).toBe('60px')
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await finishMotion()
    expect(ui().attributes('data-header-mode')).toBe('compact')
  })

  it('restores an already-scrolled page in compact mode', async () => {
    const { compact } = await header(80)
    expect(compact()).toBe(true)
  })

  it('respects reduced motion for both the controls and white background', async () => {
    const original = window.matchMedia
    window.matchMedia = vi.fn().mockReturnValue({ matches: true })
    try {
      const { scrollTo } = await header()
      const timelineSpy = vi.spyOn(gsap, 'timeline')
      await scrollTo(1)
      await ui().get('.header-expand-btn').trigger('click')
      await flushPromises()
      expect(ui().classes()).toContain('is-floating')
      expect(timelineSpy).not.toHaveBeenCalled()
      await ui().get('.header-expand-btn').trigger('click')
      await flushPromises()
      expect(ui().classes()).not.toContain('is-floating')
    } finally { window.matchMedia = original }
  })

  it('removes active animation, listeners and portal nodes when unmounted during opening', async () => {
    const { wrapper, scrollTo, scroll } = await header()
    await scrollTo(1)
    await finishMotion()
    await ui().get('.header-expand-btn').trigger('click')
    await flushPromises()
    const background = ui().get('.library-panel-backdrop').element
    wrapper.unmount()
    cleanups.pop()
    expect(gsap.getTweensOf(background)).toHaveLength(0)
    expect(document.querySelector('.library-sticky-header')).toBeNull()
    scroll.scrollTop = 50
    scroll.dispatchEvent(new Event('scroll'))
    await flushPromises()
    expect(document.querySelector('.library-sticky-header')).toBeNull()
  })
})

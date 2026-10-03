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
const headerTimeline = () => gsap.getById('library-header-transition') as gsap.core.Timeline
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
  for (const element of toolbar.querySelectorAll<HTMLElement>('[data-library-flip]')) {
    const bounds = () => {
      const compact = toolbar.classList.contains('is-compact')
      switch (element.dataset.libraryFlip) {
        // jsdom has no layout engine. Supply viewport positions with fixed
        // dimensions so Flip's translation path can be tested independently.
        case 'search': return rect(118, compact ? 30 : 110, 560, 48)
        case 'sort': return rect(compact ? 730 : 694, compact ? 30 : 110, 136, 48)
        case 'view:deck': return rect(compact ? 780 : 844, compact ? 30 : 110, 56, 38)
        case 'view:list': return rect(compact ? 839 : 903, compact ? 30 : 110, 56, 38)
        case 'category': return rect(compact ? 582 : 118, compact ? 30 : 176, 84, 34)
        default: return rect(928, compact ? 30 : 48, 36, 36)
      }
    }
    vi.spyOn(element, 'getBoundingClientRect').mockImplementation(bounds)
    Object.defineProperties(element, {
      offsetWidth: { configurable: true, get: () => bounds().width },
      offsetHeight: { configurable: true, get: () => bounds().height },
    })
  }
  for (const part of toolbar.querySelectorAll<HTMLElement>('[data-library-part]')) {
    const bounds = () => {
      if (getComputedStyle(part).display === 'none') return rect(0, 0, 0, 0)
      const parent = part.closest<HTMLElement>('[data-library-flip]')!
      const frame = parent.getBoundingClientRect()
      const icon = part.dataset.libraryPart === 'icon'
      const compact = toolbar.classList.contains('is-compact')
      const width = icon ? 17 : part.dataset.libraryPart === 'chevron' ? 13 : 56
      const inset = icon ? compact ? 10 : 14 : 39
      return rect(frame.left + inset, frame.top + (frame.height - 17) / 2, width, 17)
    }
    vi.spyOn(part, 'getBoundingClientRect').mockImplementation(bounds)
    Object.defineProperties(part, {
      offsetWidth: { configurable: true, get: () => bounds().width },
      offsetHeight: { configurable: true, get: () => bounds().height },
    })
  }
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
  it('collapses on the first pixel with real Flip position tweens and retains real controls', async () => {
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
    expect(flip).toHaveBeenCalledOnce()
    expect(flip.mock.calls[0]![1]).toMatchObject({ duration: .6, scale: false })
    const search = ui().get('.search-input-wrapper').element
    const movingItems = flip.mock.calls[0]![1]!.targets as Element[]
    expect(movingItems).toContain(search)
    expect(movingItems).toContain(ui().get('.sort-trigger').element)
    expect(movingItems).toContain(ui().get('[data-library-flip="view:deck"]').element)
    expect(movingItems).toContain(ui().get('[data-library-flip="view:list"]').element)
    expect(movingItems).toContain(ui().get('.category-pill').element)
    const motion = headerTimeline()
    motion.pause().time(.12)
    const earlyY = Number(gsap.getProperty(search, 'y'))
    motion.time(.3)
    const middleY = Number(gsap.getProperty(search, 'y'))
    expect(Math.abs(earlyY)).toBeGreaterThan(10)
    expect(Math.abs(middleY)).toBeLessThan(Math.abs(earlyY))
    expect(document.querySelector('[data-motion-overlay]')).toBeNull()
    await finishMotion()
    expect((search as HTMLElement).style.transform).toBe('')
    expect(search.hasAttribute('data-flip-id')).toBe(false)
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

  it('moves nested icons and buttons in absolute space, then reveals text after the layout settles', async () => {
    const { scrollTo } = await header()
    await scrollTo(20)
    await finishMotion()
    const flip = vi.spyOn(Flip, 'from')
    const sortIcon = ui().get('.sort-icon').element as HTMLElement
    const sortLabel = ui().get('.sort-label').element as HTMLElement
    const input = ui().get('input').element
    await ui().get('.header-expand-btn').trigger('click')
    await flushPromises()
    expect(flip.mock.calls[0]![1]).toMatchObject({ nested: true, absolute: true, scale: false })
    expect(flip.mock.calls[0]![1]!.targets).toContain(sortIcon)
    const animation = headerTimeline().pause().time(.3)
    expect((ui().get('.sort-trigger').element as HTMLElement).style.position).toBe('absolute')
    expect(sortIcon.style.position).toBe('absolute')
    expect(Number(gsap.getProperty(sortIcon, 'scaleX'))).toBe(1)
    expect(Number(gsap.getProperty(sortIcon, 'scaleY'))).toBe(1)
    const searchSlot = ui().get('.search-input-wrapper').element.nextElementSibling as HTMLElement
    expect(searchSlot.hasAttribute('data-library-flow-slot')).toBe(true)
    expect(searchSlot.style.width).toBe('560px')
    expect(searchSlot.style.visibility).toBe('hidden')
    expect(Number(gsap.getProperty(sortLabel, 'opacity'))).toBe(0)
    animation.time(.61)
    expect(Number(gsap.getProperty(ui().get('.library-panel-backdrop').element, 'scaleY'))).toBe(1)
    expect(document.querySelector('[data-library-flow-slot]')).toBeNull()
    expect(sortIcon.style.position).toBe('')
    expect(sortIcon.style.transform).toBe('')
    expect(Number(gsap.getProperty(sortLabel, 'opacity'))).toBe(0)
    animation.time(.72)
    expect(Number(gsap.getProperty(sortLabel, 'opacity'))).toBeGreaterThan(0)
    expect(Number(gsap.getProperty(sortLabel, 'opacity'))).toBeLessThan(1)
    await finishMotion()
    expect(ui().get('input').element).toBe(input)
    expect(ui().get('.sort-icon').element).toBe(sortIcon)
    expect(ui().get('.sort-label').element).toBe(sortLabel)
    expect(sortIcon.hasAttribute('data-flip-id')).toBe(false)
    expect(sortLabel.style.visibility).toBe('')
  })

  it('opens full content width outside clipping ancestors and animates the white surface in both directions', async () => {
    const { scrollTo, scroll, slot } = await header()
    await scrollTo(100)
    await finishMotion()
    const flip = vi.spyOn(Flip, 'from')
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
    const opening = headerTimeline()
    opening.progress(.5)
    expect(flip).toHaveBeenCalledOnce()
    expect(Math.abs(Number(gsap.getProperty(ui().get('.search-input-wrapper').element, 'y')))).toBeGreaterThan(1)
    expect(Number(gsap.getProperty(background, 'scaleY'))).toBeGreaterThan(0)
    expect(Number(gsap.getProperty(background, 'scaleY'))).toBeLessThan(1)
    await finishMotion()
    await ui().get('.header-expand-btn').trigger('click')
    await flushPromises()
    expect(panel.parentElement).toBe(document.body)
    const closing = headerTimeline()
    closing.progress(.5)
    expect(flip).toHaveBeenCalledTimes(2)
    expect(Math.abs(Number(gsap.getProperty(ui().get('.search-input-wrapper').element, 'y')))).toBeGreaterThan(1)
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
    expect(document.querySelector('[data-library-flow-slot]')).toBeNull()
    expect(ui().findAll('[data-library-part]')).toSatisfy((parts: DOMWrapper<Element>[]) => parts.every(part => !(part.element as HTMLElement).style.position))
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

  it('keeps the requested header animation enabled with system reduced-motion settings', async () => {
    const original = window.matchMedia
    window.matchMedia = vi.fn().mockReturnValue({ matches: true })
    try {
      const { scrollTo } = await header()
      const flipSpy = vi.spyOn(Flip, 'from')
      await scrollTo(1)
      await ui().get('.header-expand-btn').trigger('click')
      await flushPromises()
      expect(ui().classes()).toContain('is-floating')
      expect(flipSpy).toHaveBeenCalledTimes(2)
      const animation = headerTimeline()
      expect(animation.duration()).toBeGreaterThanOrEqual(.6)
      animation.pause().time(.3)
      const background = ui().get('.library-panel-backdrop').element
      expect(Number(gsap.getProperty(background, 'scaleY'))).toBeGreaterThan(0)
      expect(Number(gsap.getProperty(background, 'scaleY'))).toBeLessThan(1)
      await ui().get('.header-expand-btn').trigger('click')
      await finishMotion()
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

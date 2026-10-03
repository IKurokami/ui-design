import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import gsap from 'gsap'
import { Flip } from 'gsap/Flip'
import { AnimationManager } from '../src/animations/core/animation-manager'
import { discoverMotion } from '../src/animations/auto/elements'
import { animateMotion, captureMotion, matchMotion, type MotionPlan } from '../src/animations/auto/motion'
import { createMotionGhost } from '../src/animations/auto/ghosts'
import { useAutoMotion } from '../src/animations/composables/useAutoMotion'
import AutoMotionList from '../src/examples/AutoMotionList.vue'
import { animateStack, settleScreens } from '../src/animations/navigation/transitions'

const cleanups: (() => void)[] = []
afterEach(() => { cleanups.splice(0).reverse().forEach(cleanup => cleanup()); document.body.innerHTML = ''; vi.restoreAllMocks(); vi.unstubAllGlobals() })
function root(html: string, scope?: string) {
  const element = document.createElement('section')
  element.innerHTML = html
  if (scope) element.dataset.motionScope = scope
  document.body.append(element)
  return element
}
function manager() {
  const instance = new AnimationManager()
  cleanups.push(() => instance.dispose())
  return instance
}
function bounds(element: HTMLElement, top = 0, left = 0, width = 300, height = 50) {
  element.style.width = `${width}px`; element.style.height = `${height}px`
  Object.defineProperties(element, {
    offsetWidth: { configurable: true, value: width }, offsetHeight: { configurable: true, value: height },
    getBoundingClientRect: { configurable: true, value: () => new DOMRect(left, top, width, height) },
  })
}

describe('automatic discovery and matching', () => {
  it('discovers headings, names, links and images from a scope without per-element markers', () => {
    const before = root('<h1>Trước</h1><input name="email" /><a href="/books/one">Đọc</a><img src="/cover.jpg" />', 'reader')
    const after = root('<img src="/cover.jpg" /><a href="/books/one">Tiếp tục</a><input name="email" /><h1>Sau</h1>', 'reader')
    const snapshot = captureMotion(before)
    cleanups.push(snapshot.release)
    const plan = matchMotion(snapshot, after)
    expect(plan.shared).toHaveLength(4)
    expect(plan.shared.find(pair => pair.before.element.tagName === 'H1')!.after.element.textContent).toBe('Sau')
    expect(plan.entering).toHaveLength(0)
    expect(plan.leaving).toHaveLength(0)
    expect(discoverMotion(root('<h1>Không opt in</h1>')).targets).toHaveLength(0)
  })
  it('uses domain IDs for reorder/add/remove even when labels repeat and indexes change', () => {
    const before = root('<article data-motion-key="a">Giống nhau</article><article data-motion-key="b">Giống nhau</article><article data-motion-key="c">Giống nhau</article>', 'books')
    const snapshot = captureMotion(before)
    cleanups.push(snapshot.release)
    const after = root('<article data-motion-key="c">Mới</article><article data-motion-key="a">Mới</article><article data-motion-key="d">Giống nhau</article>', 'books')
    const plan = matchMotion(snapshot, after)
    expect(plan.shared.map(pair => pair.before.element.dataset.motionKey)).toEqual(['c', 'a'])
    expect(plan.entering.map(target => target.element.dataset.motionKey)).toEqual(['d'])
    expect(plan.leaving.map(target => target.element.dataset.motionKey)).toEqual(['b'])
  })
  it('isolates scopes, ignores hidden cached screens and avoids duplicate parent/child motion', () => {
    const element = root('<div data-motion-scope="left"><h1>Left</h1></div><div data-motion-scope="right"><h1>Right</h1></div><div inert><h1 data-motion-key="cached">Cached</h1></div><div aria-hidden="true"><h1 data-motion-key="hidden">Hidden</h1></div><div data-motion-ignore><h1 data-motion-key="ignored">Ignored</h1></div><article data-motion-key="card"><h1 data-motion-key="nested">Nested</h1></article>', 'page')
    const targets = discoverMotion(element).targets
    expect(targets.map(target => target.element.textContent)).toEqual(['Left', 'Right', 'Nested'])
    expect(new Set(targets.map(target => target.key)).size).toBe(3)
    expect(targets.at(-1)!.element.tagName).toBe('ARTICLE')
    element.inert = true
    expect(discoverMotion(element).targets).toHaveLength(3)
  })
  it('does not guess a match when either page has duplicate IDs', () => {
    const before = root('<div data-motion-key="same">Original</div>')
    const snapshot = captureMotion(before)
    cleanups.push(snapshot.release)
    const after = root('<div data-motion-key="same">First</div><div data-motion-key="same">Second</div>')
    const plan = matchMotion(snapshot, after)
    expect(plan.shared).toHaveLength(0)
    expect(plan.entering).toHaveLength(2)
    expect(plan.leaving).toHaveLength(1)
    expect(plan.diagnostics[0]!.type).toBe('duplicate-key')
    expect(plan.diagnostics[0]!.elements).toHaveLength(2)
  })
  it('makes release idempotent so an old snapshot cannot remove the next transition IDs', () => {
    const element = root('<h1 data-motion-key="title">Title</h1>')
    const first = captureMotion(element)
    first.release()
    const next = captureMotion(element)
    cleanups.push(next.release)
    const assigned = element.querySelector('h1')!.dataset.flipId
    first.release()
    expect(element.querySelector('h1')!.dataset.flipId).toBe(assigned)
    next.release()
    expect(element.querySelector('h1')!.hasAttribute('data-flip-id')).toBe(false)
  })
})

describe('generic animation lifecycle', () => {
  it('discovers shared elements on a hidden retained screen when popping the real stack transition', async () => {
    const login = root('<h1 data-motion-key="title">Login</h1>')
    const register = root('<h1 data-motion-key="title">Register</h1>')
    bounds(login.querySelector('h1')!, 100)
    bounds(register.querySelector('h1')!, 30)
    settleScreens([login, register])
    expect(login.style.visibility).toBe('hidden')
    const snapshot = captureMotion(register)
    const flip = vi.spyOn(Flip, 'from')
    const instance = manager()
    const animation = animateStack(instance, register, login, 'pop', false, snapshot)
    expect(flip).toHaveBeenCalledOnce()
    expect(flip.mock.calls[0]![1]!.targets).toContain(login.querySelector('h1'))
    instance.finish(); await animation
    expect(login.style.visibility).not.toBe('hidden')
    expect(Number(gsap.getProperty(login, 'scaleX'))).toBe(1)
    expect(register.style.visibility).toBe('hidden')
    expect(login.querySelector('h1')!.hasAttribute('data-flip-id')).toBe(false)
  })
  it('animates page content through the generic stack path and restores preexisting styles and IDs', async () => {
    const before = root('<h1 data-motion-key="title" data-flip-id="existing">First</h1>')
    const after = root('<h1 data-motion-key="title" style="opacity:0.8;transform:translateX(2px)">Second</h1><p data-motion>New</p>')
    bounds(before.querySelector('h1')!, 100)
    bounds(after.querySelector('h1')!, 20)
    const original = after.querySelector('h1')!.style.transform
    const snapshot = captureMotion(before)
    const instance = manager()
    const flip = vi.spyOn(Flip, 'from')
    const animation = animateMotion(instance, snapshot, after)
    expect(flip).toHaveBeenCalledOnce()
    expect(after.querySelector('p')!.style.opacity).toBe('0')
    instance.finish(); await animation
    expect(after.querySelector('h1')!.style.transform).toBe(original)
    expect(after.querySelector('h1')!.style.opacity).toBe('0.8')
    expect(before.querySelector('h1')!.dataset.flipId).toBe('existing')
    expect(after.querySelector('h1')!.hasAttribute('data-flip-id')).toBe(false)
    expect(after.querySelector('.is-motion-flipping')).toBeNull()
  })
  it('uses ghosts for detached list items and removes them on interruption', async () => {
    const element = root('<article data-motion-key="gone">Goodbye</article>', 'books')
    bounds(element.querySelector('article')!, 60)
    const snapshot = captureMotion(element, { ghosts: true })
    element.replaceChildren()
    const instance = manager()
    const animation = animateMotion(instance, snapshot, element, { mode: 'list' })
    expect(document.querySelector('[data-motion-overlay]')!.textContent).toBe('Goodbye')
    expect(document.querySelector('[data-motion-overlay]')!.getAttribute('aria-hidden')).toBe('true')
    instance.dispose(); await animation
    expect(document.querySelector('[data-motion-overlay]')).toBeNull()
    expect(snapshot.targets[0]!.element.hasAttribute('data-flip-id')).toBe(false)
  })
  it('keeps exiting visuals inside a native dialog top layer', async () => {
    const dialog = document.createElement('dialog')
    dialog.setAttribute('open', '')
    document.body.append(dialog)
    const element = root('<article data-motion-key="gone">Goodbye</article>')
    dialog.append(element)
    bounds(element.querySelector('article')!, 60)
    const snapshot = captureMotion(element, { ghosts: true })
    element.replaceChildren()
    const instance = manager()
    const animation = animateMotion(instance, snapshot, element, { mode: 'list' })
    expect(dialog.querySelector('[data-motion-overlay]')?.parentElement).toBe(dialog)
    instance.finish(); await animation
    expect(dialog.querySelector('[data-motion-overlay]')).toBeNull()
  })
  it('animates shared elements over sliding pages without transforming their live DOM', async () => {
    const before = root('<article data-motion-key="book">Old book</article>', 'books')
    const after = root('<article data-motion-key="book">New book</article>', 'books')
    bounds(before.querySelector('article')!, 100, 20, 100, 60)
    bounds(after.querySelector('article')!, 30, 200, 200, 120)
    const instance = manager()
    const animation = animateMotion(instance, captureMotion(before, { ghosts: true }), after, { mode: 'overlay' })
    const target = after.querySelector('article')!
    expect(document.querySelector('[data-motion-overlay]')).not.toBeNull()
    expect(target.style.visibility).toBe('hidden')
    expect(target.style.transform).toBe('')
    const ghosts = [...document.querySelectorAll<HTMLElement>('[data-motion-overlay] > *')]
    expect(ghosts).toHaveLength(2)
    ghosts.forEach(ghost => gsap.getTweensOf(ghost).forEach(tween => tween.pause().progress(0.5)))
    expect(Number(gsap.getProperty(ghosts[0]!, 'x'))).toBeGreaterThan(0)
    instance.finish(); await animation
    expect(target.style.visibility).toBe('')
    expect(document.querySelector('[data-motion-overlay]')).toBeNull()
  })
  it('does not copy input values, interactive IDs or handlers into visual ghosts', () => {
    const element = root('<article id="live" data-motion-key="book" onclick="alert(1)"><input id="private" name="secret" value="password" /><textarea>private text</textarea></article>').querySelector('article')!
    const ghost = createMotionGhost(element)
    expect(ghost.querySelector('input')!.value).toBe('')
    expect(ghost.querySelector('input')!.getAttribute('value')).toBeNull()
    expect(ghost.querySelector('textarea')!.value).toBe('')
    expect(ghost.hasAttribute('id')).toBe(false)
    expect(ghost.hasAttribute('onclick')).toBe(false)
    expect(ghost.querySelector('[id]')).toBeNull()
    expect(ghost.inert).toBe(true)
  })
  it('resolves empty and reduced plans without creating animation or hiding content', async () => {
    const element = root('<p>No candidates</p>')
    const instance = manager()
    await animateMotion(instance, captureMotion(element), element, { mode: 'list' })
    const flip = vi.spyOn(Flip, 'from')
    element.innerHTML = '<div data-motion-key="a">First</div>'
    const snapshot = captureMotion(element)
    element.innerHTML = '<div data-motion-key="b">Second</div>'
    await animateMotion(instance, snapshot, element, { mode: 'list', reduced: true })
    expect(flip).not.toHaveBeenCalled()
    expect(element.querySelector('div')!.style.opacity).toBe('')
    expect(document.querySelector('[data-motion-overlay]')).toBeNull()
  })
  it('restores targets and temporary IDs when setup throws', async () => {
    const before = root('<h1 data-motion-key="title">Old</h1>')
    const after = root('<h1 data-motion-key="title">New</h1>')
    vi.spyOn(Flip, 'from').mockImplementation(() => { throw new Error('setup failed') })
    await expect(animateMotion(manager(), captureMotion(before), after)).rejects.toThrow('setup failed')
    expect(after.querySelector('h1')!.hasAttribute('data-flip-id')).toBe(false)
    expect(before.querySelector('h1')!.hasAttribute('data-flip-id')).toBe(false)
    expect(after.querySelector('h1')!.style.visibility).toBe('')
    expect(after.style.visibility).not.toBe('hidden')
    expect(before.style.visibility).toBe('hidden')
  })
})

describe('compact toolbar folding', () => {
  const foldOptions = {
    mode: 'list' as const, duration: 0.48, unclip: true, nested: true,
    collapseTo: { title: 'search', stats: 'search', 'view-label:deck': 'view-icon:deck', 'view-label:list': 'view-icon:list', 'category:': 'category:all' },
    foldGroup: 'category:', foldStagger: 0.025,
  }
  function position(element: HTMLElement, key: string, top: number, left: number, width: number, height = 30) {
    bounds(element.querySelector<HTMLElement>(`[data-motion-key="${key}"]`)!, top, left, width, height)
  }
  it('folds labels into their own controls and badges sequentially before layout completes', async () => {
    const before = root('<h1 data-motion-key="title">Title</h1><p data-motion-key="stats">Counts</p><div data-motion-key="search">Search</div><span data-motion-key="view-icon:deck">Deck icon</span><span data-motion-key="view-label:deck">Deck label</span><span data-motion-key="view-icon:list">List icon</span><span data-motion-key="view-label:list">List label</span><button data-motion-key="category:all">All</button><button data-motion-key="category:a">Genre A</button><button data-motion-key="category:b">Genre B</button>')
    const after = root('<div data-motion-key="search">Search</div><span data-motion-key="view-icon:deck">Deck icon</span><span data-motion-key="view-icon:list">List icon</span><button data-motion-key="category:all">All</button>')
    position(before, 'title', 0, 20, 200)
    position(before, 'stats', 40, 20, 250)
    position(before, 'search', 100, 20, 300)
    position(before, 'view-icon:deck', 100, 550, 16)
    position(before, 'view-label:deck', 100, 580, 70)
    position(before, 'view-icon:list', 100, 670, 16)
    position(before, 'view-label:list', 100, 700, 80)
    position(before, 'category:all', 160, 20, 140)
    position(before, 'category:a', 160, 170, 100)
    position(before, 'category:b', 160, 280, 100)
    position(after, 'search', 10, 20, 300)
    position(after, 'view-icon:deck', 10, 550, 16)
    position(after, 'view-icon:list', 10, 590, 16)
    position(after, 'category:all', 10, 360, 140)
    const to = vi.spyOn(gsap.core.Timeline.prototype, 'to')
    const instance = manager()
    const animation = animateMotion(instance, captureMotion(before, { ghosts: true }), after, foldOptions)
    function fold(label: string) {
      // GSAP exposes a legacy overload; these calls use the vars/position API.
      const calls = to.mock.calls as unknown as [unknown, gsap.TweenVars, number][]
      return calls.find(call => call[0] instanceof HTMLElement && call[0].textContent === label && 'x' in call[1])!
    }
    expect(fold('Title')[1].x).toBe(50)
    expect(fold('Counts')[1].x).toBe(25)
    expect(fold('Deck label')[1].x).toBe(-57)
    expect(fold('List label')[1].x).toBe(-142)
    expect(fold('Genre A')[1].x).toBe(210)
    expect(fold('Genre A')[2]).toBe(0)
    expect(fold('Genre B')[2]).toBe(0.025)
    expect(Number(fold('Genre B')[2]) + Number(fold('Genre B')[1].duration)).toBeLessThan(0.48)
    instance.finish(); await animation
    expect(document.querySelector('[data-motion-overlay]')).toBeNull()
  })
  it('keeps a long badge strip clipped and only flies badges fully inside the destination viewport', async () => {
    const before = root('<div data-motion-clip><button data-motion-key="category:all" data-motion-overlay-target>All</button></div>')
    bounds(before.firstElementChild as HTMLElement, 10, 300, 200, 40)
    position(before, 'category:all', 15, 300, 80)
    const snapshot = captureMotion(before, { ghosts: true })
    const after = root(`<div data-motion-clip style="overflow:hidden !important"><div data-motion-clip style="overflow-x:auto;overflow-y:hidden"><button data-motion-key="category:all" data-motion-overlay-target>All</button>${Array.from({ length: 15 }, (_, i) => `<button data-motion-key="category:${i}" data-motion-overlay-target>Genre ${i}</button>`).join('')}</div></div>`)
    after.style.overflow = 'hidden'
    const wrapper = after.firstElementChild as HTMLElement
    const strip = wrapper.firstElementChild as HTMLElement
    bounds(wrapper, 100, 300, 200, 40)
    bounds(strip, 100, 300, 200, 40)
    position(after, 'category:all', 105, 300, 80)
    for (let i = 0; i < 15; i++) position(after, `category:${i}`, 105, 390 + i * 90, 80)
    const instance = manager()
    const animation = animateMotion(instance, snapshot, after, foldOptions)
    expect(wrapper.style.getPropertyValue('overflow')).toBe('hidden')
    expect(wrapper.style.getPropertyPriority('overflow')).toBe('important')
    expect(strip.style.overflowX).toBe('auto')
    expect(strip.style.overflowY).toBe('hidden')
    expect(after.style.overflow).toBe('visible')
    expect(after.classList.contains('is-motion-layout-active')).toBe(true)
    const overlay = document.querySelector('[data-motion-overlay]')!
    expect(overlay.textContent).toContain('Genre 0')
    expect(overlay.textContent).not.toContain('Genre 1') // Only 20px visible: fade under the viewport clip.
    expect(overlay.textContent).not.toContain('Genre 2') // Completely outside: no ghost.
    expect(after.querySelector<HTMLElement>('[data-motion-key="category:0"]')!.style.visibility).toBe('hidden')
    expect(after.querySelector<HTMLElement>('[data-motion-key="category:1"]')!.style.opacity).toBe('0')
    expect(after.querySelector<HTMLElement>('[data-motion-key="category:2"]')!.style.opacity).toBe('')
    instance.dispose(); await animation
    expect(after.style.overflow).toBe('hidden')
    expect(after.classList.contains('is-motion-layout-active')).toBe(false)
    expect(after.querySelector<HTMLElement>('[data-motion-key="category:0"]')!.style.visibility).toBe('')
    expect(after.querySelector<HTMLElement>('[data-motion-key="category:1"]')!.style.opacity).toBe('')
    expect(after.querySelector('[data-flip-id]')).toBeNull()
    expect(document.querySelector('[data-motion-overlay]')).toBeNull()
  })
  it('folds only the visible portions when collapsing a horizontally scrolled badge strip', async () => {
    const before = root('<div data-motion-clip><button data-motion-key="category:all" data-motion-overlay-target>All</button><button data-motion-key="category:a" data-motion-overlay-target>Partial</button><button data-motion-key="category:b" data-motion-overlay-target>Visible</button><button data-motion-key="category:c" data-motion-overlay-target>Offscreen</button></div>')
    bounds(before.firstElementChild as HTMLElement, 100, 300, 200, 40)
    position(before, 'category:all', 105, 100, 80)
    position(before, 'category:a', 105, 250, 80)
    position(before, 'category:b', 105, 350, 80)
    position(before, 'category:c', 105, 550, 80)
    const after = root('<button data-motion-key="category:all" data-motion-overlay-target>All</button>')
    position(after, 'category:all', 10, 360, 140)
    const instance = manager()
    const animation = animateMotion(instance, captureMotion(before, { ghosts: true }), after, foldOptions)
    const ghosts = [...document.querySelectorAll<HTMLElement>('[data-motion-overlay] > *')]
    expect(ghosts.map(ghost => ghost.textContent)).toEqual(['Partial', 'Visible'])
    expect(ghosts[0]!.style.clipPath).toBe('inset(0px 0px 0px 50px)')
    instance.finish(); await animation
    expect(document.querySelector('[data-motion-overlay]')).toBeNull()
  })
})

describe('Vue list integration', () => {
  it('automatically captures pre-patch order and animates a mounted example without animation calls in handlers', async () => {
    const flip = vi.spyOn(Flip, 'from')
    const enter = vi.spyOn(gsap.core.Timeline.prototype, 'fromTo')
    const wrapper = mount(AutoMotionList, { attachTo: document.body })
    cleanups.push(() => wrapper.unmount())
    const first = wrapper.get('[data-motion-key="forest"]').element
    await wrapper.get('.example-actions button').trigger('click'); await flushPromises()
    expect(wrapper.findAll('li').map(item => item.attributes('data-motion-key'))).toEqual(['summer', 'river', 'forest'])
    expect(wrapper.get('[data-motion-key="forest"]').element).toBe(first)
    expect(flip).toHaveBeenCalledOnce()
    await wrapper.findAll('.example-actions button')[1]!.trigger('click'); await flushPromises()
    expect(wrapper.findAll('li')).toHaveLength(4)
    const added = wrapper.get('[data-motion-key="new-1"]').element
    expect(enter.mock.calls.some(call => Array.isArray(call[0]) && call[0].includes(added))).toBe(true)
    await wrapper.get('[data-motion-key="new-1"] button').trigger('click'); await flushPromises()
    expect(wrapper.findAll('li')).toHaveLength(3)
    wrapper.unmount(); cleanups.pop()
    expect(document.querySelector('[data-motion-overlay]')).toBeNull()
    expect(gsap.getTweensOf(first)).toHaveLength(0)
  })
  it('coalesces changes, finishes prior motion on updates and releases pending captures on unmount', async () => {
    const items = ref(['a', 'b'])
    const plans: MotionPlan[] = []
    let finish: () => void
    const Host = defineComponent({ setup() {
      const list = ref<HTMLElement>()
      finish = useAutoMotion(list, () => items.value, { reduced: false, onPlan: plan => plans.push(plan) }).finish
      return () => h('ul', { ref: list, 'data-motion-scope': 'list' }, items.value.map(id => h('li', { key: id, 'data-motion-key': id }, id)))
    } })
    const wrapper = mount(Host, { attachTo: document.body })
    cleanups.push(() => wrapper.unmount())
    items.value = ['b', 'c']; items.value = ['c', 'b', 'd']
    await flushPromises()
    expect(plans).toHaveLength(1)
    expect(plans[0]!.shared.map(pair => pair.before.element.textContent)).toEqual(['b'])
    expect(plans[0]!.entering.map(target => target.element.textContent)).toEqual(['c', 'd'])
    finish!()
    expect(wrapper.get('[data-motion-key="c"]').element.hasAttribute('data-flip-id')).toBe(false)
    items.value = ['d', 'c']
    await flushPromises()
    expect(plans).toHaveLength(2)
    items.value = []
    await nextTick()
    wrapper.unmount(); cleanups.pop()
    await flushPromises()
    expect(document.querySelector('[data-motion-overlay]')).toBeNull()
  })
})

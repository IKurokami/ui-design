import gsap from 'gsap'
import { onBeforeUnmount, ref, type Ref } from 'vue'
import { useEventListener } from '@vueuse/core'

const panelProps = 'transform,transformOrigin,opacity,pointerEvents,willChange'
type DialogMotionOptions = {
  reduced?: boolean | (() => boolean)
  background?: () => HTMLElement | undefined
  content?: () => HTMLElement | undefined
}
export function useDialogMotion(dialog: Ref<HTMLDialogElement | undefined>, panel: Ref<HTMLElement | undefined>, backdrop: Ref<HTMLElement | undefined>, options: DialogMotionOptions = {}) {
  const phase = ref<'closed' | 'opening' | 'open' | 'closing'>('closed')
  let animation: gsap.core.Timeline | undefined
  let opener: HTMLElement | undefined
  let lastFocus: HTMLElement | undefined
  let scrollTop = 0
  let outsidePointer = false
  let sourceRect: DOMRect | undefined
  let background: HTMLElement | undefined
  let backgroundStyles: { name: string; value: string; priority: string }[] = []
  // Page navigation in this app always animates; dialogs follow that same default.
  const reduced = () => typeof options.reduced === 'function' ? options.reduced() : options.reduced ?? false

  function cleanStyles() {
    if (panel.value) gsap.set(panel.value, { clearProps: panelProps })
    if (backdrop.value) gsap.set(backdrop.value, { clearProps: 'opacity,willChange' })
    const content = options.content?.()
    if (content) gsap.set(content, { clearProps: 'opacity' })
  }
  function restoreBackground() {
    if (!background) return
    gsap.set(background, { clearProps: 'transform,transformOrigin,willChange' })
    for (const { name, value, priority } of backgroundStyles) {
      if (value) background.style.setProperty(name, value, priority)
    }
    background = undefined
    backgroundStyles = []
  }
  function prepareBackground() {
    background = options.background?.()
    if (!background) return
    backgroundStyles = ['transform', 'transform-origin', 'will-change'].map(name => ({
      name, value: background!.style.getPropertyValue(name), priority: background!.style.getPropertyPriority(name),
    }))
    const rect = background.getBoundingClientRect()
    // Anchor the zoom to the visible viewport, including a scrolled/long page.
    gsap.set(background, { transformOrigin: `${window.innerWidth / 2 - rect.left}px ${window.innerHeight / 2 - rect.top}px`, willChange: 'transform' })
  }
  function measureSource() {
    if (!opener || !visible(opener)) return undefined
    // The page returns to full size on exit. Measure the trigger in that state,
    // synchronously, so its shrunken position never becomes the closing target.
    const scaleX = background ? Number(gsap.getProperty(background, 'scaleX')) : 1
    const scaleY = background ? Number(gsap.getProperty(background, 'scaleY')) : 1
    if (background) gsap.set(background, { scale: 1 })
    const rect = opener.getBoundingClientRect()
    if (background) gsap.set(background, { scaleX, scaleY })
    return rect.width > 0 && rect.height > 0 ? rect : undefined
  }
  function sourceTransform() {
    const element = panel.value!
    // Measure the destination without disturbing an interrupted frame.
    const current = { x: gsap.getProperty(element, 'x'), y: gsap.getProperty(element, 'y'), scaleX: gsap.getProperty(element, 'scaleX'), scaleY: gsap.getProperty(element, 'scaleY') }
    gsap.set(element, { x: 0, y: 0, scale: 1 })
    const rect = element.getBoundingClientRect()
    gsap.set(element, current)
    const source = sourceRect
    if (source && rect.width > 0 && rect.height > 0) {
      return { x: source.left - rect.left, y: source.top - rect.top, scaleX: source.width / rect.width, scaleY: source.height / rect.height }
    }
    // Programmatic opening without a visible trigger still expands in place.
    return { x: rect.width * 0.44, y: rect.height * 0.44, scaleX: 0.12, scaleY: 0.12 }
  }
  function visible(element: HTMLElement) {
    if (!element.isConnected || element.matches(':disabled')) return false
    for (let current: HTMLElement | null = element; current; current = current.parentElement) {
      const style = getComputedStyle(current)
      if (current.hidden || style.display === 'none' || style.visibility === 'hidden') return false
      if (current === panel.value) break
    }
    return true
  }
  function focusContent() {
    const target = lastFocus && visible(lastFocus) ? lastFocus : panel.value?.querySelector<HTMLElement>('[data-dialog-focus]')
    target?.focus({ preventScroll: true })
    if (panel.value) panel.value.scrollTop = scrollTop
  }
  function open(source?: HTMLElement) {
    if (!dialog.value || !panel.value || !backdrop.value || phase.value === 'open' || phase.value === 'opening') return
    animation?.kill()
    const alreadyOpen = dialog.value.open
    if (!alreadyOpen) {
      opener = source ?? (document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : undefined)
      sourceRect = measureSource()
      prepareBackground()
      gsap.set(panel.value, { opacity: 0, transformOrigin: '0 0' })
      const content = options.content?.()
      if (content) gsap.set(content, { opacity: 0 })
      gsap.set(backdrop.value, { opacity: 0 })
      dialog.value.showModal()
      gsap.set(panel.value, sourceTransform())
    }
    phase.value = 'opening'
    gsap.set(panel.value, { pointerEvents: 'auto', willChange: 'transform,opacity' })
    gsap.set(backdrop.value, { willChange: 'opacity' })
    focusContent()
    const complete = () => {
      if (animation !== timeline) return
      animation = undefined
      timeline.kill()
      phase.value = 'open'
      cleanStyles()
    }
    const timeline = gsap.timeline({ paused: true, onComplete: complete })
    animation = timeline
    timeline.to(backdrop.value, { opacity: 1, duration: reduced() ? 0 : 0.28, ease: 'power2.out' }, 0)
      .to(panel.value, { opacity: 1, x: 0, y: 0, scaleX: 1, scaleY: 1, duration: reduced() ? 0 : 0.42, ease: 'power3.inOut' }, 0)
    if (background) timeline.to(background, { scale: 0.96, duration: reduced() ? 0 : 0.42, ease: 'power3.inOut' }, 0)
    const content = options.content?.()
    if (content) timeline.to(content, { opacity: 1, duration: reduced() ? 0 : 0.18, ease: 'power1.out' }, reduced() ? 0 : 0.12)
    // Build the complete opening timeline before playback so native showModal
    // and the first frame cannot race an incomplete/zero-duration timeline.
    timeline.play()
    if (timeline.totalDuration() === 0) { timeline.totalProgress(1); complete() }
  }
  function close() {
    if (!dialog.value?.open || !panel.value || !backdrop.value || phase.value === 'closing') return
    animation?.kill()
    if (document.activeElement instanceof HTMLElement && panel.value.contains(document.activeElement)) lastFocus = document.activeElement
    scrollTop = panel.value.scrollTop
    sourceRect = measureSource()
    const destination = sourceTransform()
    // A completed opening clears transforms. Reapply the same origin before
    // shrinking, while reversals keep their current top-left-based transform.
    gsap.set(panel.value, { transformOrigin: '0 0' })
    phase.value = 'closing'
    gsap.set(panel.value, { pointerEvents: 'none', willChange: 'transform,opacity' })
    const complete = () => {
      if (animation !== timeline) return
      timeline.kill()
      dialog.value?.close()
      phase.value = 'closed'
      cleanStyles()
      restoreBackground()
      animation = undefined
      if (opener?.isConnected) opener.focus({ preventScroll: true })
    }
    const timeline = gsap.timeline({ paused: true, onComplete: complete })
    animation = timeline
    timeline.to(panel.value, { ...destination, opacity: 0, duration: reduced() ? 0 : 0.3, ease: 'power3.inOut' }, 0)
      .to(backdrop.value, { opacity: 0, duration: reduced() ? 0 : 0.3, ease: 'power1.in' }, 0)
    if (background) timeline.to(background, { scale: 1, duration: reduced() ? 0 : 0.3, ease: 'power3.inOut' }, 0)
    const content = options.content?.()
    if (content) timeline.to(content, { opacity: 0, duration: reduced() ? 0 : 0.12, ease: 'power1.in' }, 0)
    timeline.play()
    if (timeline.totalDuration() === 0) { timeline.totalProgress(1); complete() }
  }
  function onNativeClose() {
    // A queued close event from a previous opening must not close a reopened modal.
    if (dialog.value?.open) return
    animation?.kill()
    animation = undefined
    phase.value = 'closed'
    cleanStyles()
    restoreBackground()
  }
  function outside(event: MouseEvent | PointerEvent) {
    if (!panel.value || !(event.target instanceof Node) || panel.value.contains(event.target)) return false
    const rect = panel.value.getBoundingClientRect()
    return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom
  }
  function onPointerDown(event: PointerEvent) { outsidePointer = event.button === 0 && outside(event) }
  function onBackdropClick(event: MouseEvent) {
    const shouldClose = outsidePointer && outside(event)
    outsidePointer = false
    if (shouldClose) close()
  }
  useEventListener(window, 'resize', () => animation?.totalProgress(1))
  onBeforeUnmount(() => { animation?.kill(); if (dialog.value?.open) dialog.value.close(); cleanStyles(); restoreBackground() })
  return { phase, open, close, reduced, onNativeClose, onPointerDown, onBackdropClick }
}

import { nextTick, onBeforeUnmount, onMounted, watch, type Ref } from 'vue'
import gsap from 'gsap'

const entrance = { duration: 0.7, ease: 'power3.out', stagger: 0.05, maxStagger: 0.5 }
// Several targets own CSS `transition: all`; it must be off while GSAP drives them.
const entranceProps = 'transform,opacity,visibility,transition,willChange'
// Intentionally ignores prefers-reduced-motion: the entrance always plays.

/**
 * Page-load choreography for /library: chrome (sidebar + header) on mount,
 * then the content items each time a request finishes rendering.
 * Only items inside the scroll viewport animate, so a restored scroll position
 * still reveals what the reader actually sees, without long invisible staggers.
 */
export function useLibraryEntrance(root: Ref<HTMLElement | undefined>, scrollArea: Ref<HTMLElement | undefined>, ready: Ref<boolean>) {
  const context = gsap.context(() => {})
  let revision = 0
  let disposed = false

  function query(selector: string) {
    return [...(root.value?.querySelectorAll<HTMLElement>(selector) ?? [])]
  }

  function visible(elements: HTMLElement[]) {
    const viewport = scrollArea.value?.getBoundingClientRect()
    if (!viewport || !viewport.height) return elements
    return elements.filter(element => {
      const bounds = element.getBoundingClientRect()
      return bounds.bottom > viewport.top && bounds.top < viewport.bottom
    })
  }

  function playChrome() {
    if (disposed || !root.value) return
    const nav = query('.library-sidebar .nav-item, .library-sidebar .action-btn')
    const header = query('.library-header-slot, .reading-header')
    context.add(() => {
      const timeline = gsap.timeline({ defaults: { duration: entrance.duration, ease: entrance.ease } })
      if (nav.length) timeline.fromTo(nav, { autoAlpha: 0, x: -14 }, {
        autoAlpha: 1, x: 0, stagger: 0.06, transition: 'none', willChange: 'transform,opacity',
        clearProps: entranceProps,
      }, 0.08)
      if (header.length) timeline.fromTo(header, { autoAlpha: 0, y: 18 }, {
        autoAlpha: 1, y: 0, transition: 'none', willChange: 'transform,opacity',
        clearProps: entranceProps,
      }, 0.12)
    })
  }

  async function playContent() {
    const token = ++revision
    // Wait for the rendered list and the page's scroll restoration (post flush + tick).
    await nextTick()
    await nextTick()
    if (disposed || token !== revision || !ready.value) return
    const items = visible(query('.deck-card, .deck-list-item, .reading-day, .empty-state, .library-request-state, .reading-state'))
    if (!items.length) return
    context.add(() => {
      gsap.fromTo(items, { autoAlpha: 0, y: 28, scale: 0.97 }, {
        autoAlpha: 1, y: 0, scale: 1,
        duration: entrance.duration, ease: entrance.ease,
        stagger: Math.min(entrance.stagger, entrance.maxStagger / Math.max(1, items.length - 1)),
        transition: 'none', willChange: 'transform,opacity',
        clearProps: entranceProps,
      })
    })
  }

  onMounted(playChrome)
  watch(ready, value => { if (value) void playContent(); else revision++ }, { immediate: true, flush: 'post' })
  onBeforeUnmount(() => { disposed = true; revision++; context.revert() })
}

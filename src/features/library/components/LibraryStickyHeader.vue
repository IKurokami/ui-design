<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useEventListener } from '@vueuse/core'
import gsap from 'gsap'
import { Flip } from 'gsap/Flip'
import { ChevronDown } from '@lucide/vue'
import LibraryHeader from './LibraryHeader.vue'
import LibraryFilterBar from './LibraryFilterBar.vue'
import { reserveLibraryControlFlow } from './library-flip-flow'
import type { CategoryFilter, SortMode, ViewMode } from '../types'

gsap.registerPlugin(Flip)

const props = defineProps<{
  scrollElement?: HTMLElement
  title: string
  totalCollections: number
  resultCount?: number
  categories: CategoryFilter[]
  activeCategory: string
  viewMode: ViewMode
  searchQuery: string
  sortMode?: SortMode
}>()
const emit = defineEmits<{
  'update:activeCategory': [id: string]
  'update:viewMode': [mode: ViewMode]
  'update:searchQuery': [query: string]
  'update:sortMode': [mode: SortMode]
  'openCreate': []
}>()

type HeaderMode = 'inline' | 'compact' | 'overlay'
const mode = ref<HeaderMode>('inline')
const compact = computed(() => mode.value === 'compact')
const portalActive = ref(false)
const slot = ref<HTMLElement>()
const toolbar = ref<HTMLElement>()
const body = ref<HTMLElement>()
const backdrop = ref<HTMLElement>()
const toggleButton = ref<HTMLButtonElement>()
const portalStyle = ref<Record<string, string>>({})
const compactHeight = 64
let timeline: gsap.core.Timeline | undefined
let flow: ReturnType<typeof reserveLibraryControlFlow> | undefined
const itemStyles = new Map<HTMLElement, { style: string | null; flipId: string | null }>()
let observer: ResizeObserver | undefined
let revision = 0
let disposed = false
let lastScrollTop = 0

function flipItems() {
  return [...(toolbar.value?.querySelectorAll<HTMLElement>('[data-library-flip], [data-library-part]') ?? [])]
    .filter(element => {
      // Hidden compact/mobile controls must not be made absolute or reappear.
      for (let node: HTMLElement | null = element; node && node !== toolbar.value; node = node.parentElement) {
        if (getComputedStyle(node).display === 'none') return false
      }
      return true
    })
}

function restoreItemStyles(releaseIdentity = true) {
  for (const [element, original] of itemStyles) {
    if (original.style === null) element.removeAttribute('style')
    else element.setAttribute('style', original.style)
    if (releaseIdentity) {
      if (original.flipId === null) element.removeAttribute('data-flip-id')
      else element.setAttribute('data-flip-id', original.flipId)
    }
  }
  if (releaseIdentity) itemStyles.clear()
}

function syncGeometry() {
  const content = props.scrollElement
  if (!content || !slot.value) return
  const bounds = content.getBoundingClientRect()
  const theme = getComputedStyle(content)
  const top = Math.max(0, bounds.top)
  portalStyle.value = {
    left: bounds.left + window.scrollX + 'px',
    top: top + window.scrollY + 'px',
    width: bounds.width + 'px',
    '--panel-padding-left': theme.paddingLeft || '0px',
    '--panel-padding-right': theme.paddingRight || '0px',
    '--panel-max-height': Math.max(64, Math.min(bounds.bottom, window.innerHeight) - top - 8) + 'px',
  }
  for (const name of ['surface', 'accent', 'ink', 'muted', 'control-ink']) {
    const value = theme.getPropertyValue('--library-' + name).trim()
    if (value) portalStyle.value['--library-' + name] = value
  }
}

function clearMotionStyles() {
  flow?.release()
  flow = undefined
  restoreItemStyles()
  const details = toolbar.value?.querySelectorAll<HTMLElement>('.header-summary, .category-pill:not([data-category="all"]), .reset-filters')
  if (details?.length) gsap.set(details, { clearProps: 'transform,opacity,visibility' })
  const labels = toolbar.value?.querySelectorAll<HTMLElement>('[data-library-part="label"]')
  if (labels?.length) gsap.set(labels, { clearProps: 'opacity,visibility' })
  if (body.value) gsap.set(body.value, { clearProps: 'transform,opacity,visibility' })
  if (toolbar.value) gsap.set(toolbar.value, { clearProps: 'transform' })
  if (backdrop.value) gsap.set(backdrop.value, { clearProps: 'transform,opacity,visibility,height' })
  if (slot.value) gsap.set(slot.value, { clearProps: 'height' })
}

function restoreFocus(focused: Element | null) {
  if (!(focused instanceof HTMLElement)) return
  // Teleport moves the SAME controls; browsers may drop focus during that move.
  if (focused.isConnected && document.activeElement === document.body) focused.focus({ preventScroll: true })
  else if (!focused.isConnected && document.activeElement === document.body) toggleButton.value?.focus({ preventScroll: true })
}

async function settle(token: number, focusFallback: Element | null = null) {
  if (disposed || token !== revision) return
  const focused = toolbar.value?.contains(document.activeElement) ? document.activeElement : focusFallback
  timeline = undefined
  portalActive.value = mode.value === 'overlay'
  clearMotionStyles()
  await nextTick()
  if (!disposed && token === revision) restoreFocus(focused)
}

async function transitionTo(next: HeaderMode) {
  if (disposed || next === mode.value) return
  const token = ++revision
  // Pause before killing so Flip captures the visible position on reversal.
  timeline?.pause().kill()
  timeline = undefined
  const items = flipItems()
  for (const element of items) {
    if (!itemStyles.has(element)) itemStyles.set(element, {
      style: element.getAttribute('style'), flipId: element.getAttribute('data-flip-id'),
    })
  }
  const captureOptions = { kill: false, simple: true }
  const itemState = Flip.getState(items, captureOptions)
  const previousSlotHeight = slot.value?.getBoundingClientRect().height ?? compactHeight
  const previousBodyHeight = body.value?.getBoundingClientRect().height ?? compactHeight
  const wasFloating = portalActive.value
  const previousBackdropScale = wasFloating && backdrop.value ? Number(gsap.getProperty(backdrop.value, 'scaleY')) : 0
  const focused = toolbar.value?.contains(document.activeElement) ? document.activeElement : null
  // Remove interrupted Flip transforms only AFTER taking its visible snapshot.
  flow?.release()
  flow = undefined
  restoreItemStyles(false)

  mode.value = next
  if (next === 'overlay') {
    syncGeometry()
    portalActive.value = true
  }
  // Keep the portal mounted throughout closing, including the white surface.
  await nextTick()
  if (disposed || token !== revision || !body.value || !slot.value || !toolbar.value || !backdrop.value) return
  restoreFocus(focused)
  const destinationHeight = body.value.getBoundingClientRect().height || compactHeight
  const animationFocus = toolbar.value.contains(document.activeElement) ? document.activeElement : null
  const targets = flipItems()
  for (const element of targets) {
    if (!itemStyles.has(element)) itemStyles.set(element, {
      style: element.getAttribute('style'), flipId: element.getAttribute('data-flip-id'),
    })
  }
  // Keep the portal through closing, but measure controls at the sticky row's
  // final viewport position. Flip owns their movement, not a parent slide.
  const landingOffset = wasFloating && next !== 'overlay'
    ? slot.value.getBoundingClientRect().top - (parseFloat(portalStyle.value.top ?? '0') - window.scrollY)
    : 0
  gsap.set(toolbar.value, { y: landingOffset })
  timeline = gsap.timeline({ id: 'library-header-transition', paused: true,
    defaults: { ease: 'power3.inOut' }, onComplete: () => { void settle(token, animationFocus) } })
  const labels = [...toolbar.value.querySelectorAll<HTMLElement>('[data-library-part="label"]')]
  // Keep labels in the measured layout, but reveal them only after every
  // position/size and white-surface tween has finished. No squeezed text.
  gsap.set(labels, { autoAlpha: 0 })
  flow = reserveLibraryControlFlow(targets.filter(element => element.hasAttribute('data-library-flip')))
  const itemMotion = Flip.from(itemState, {
    targets, paused: true, duration: .6, ease: 'power3.inOut',
    scale: false, simple: true, nested: true, prune: true,
    absolute: true, clearProps: false,
  })
  flow.activate()
  timeline.add(itemMotion, 0)
  itemMotion.paused(false)
  // Restore normal flow and remove reservations in the same synchronous turn.
  // This happens before the text reveal, not at the end of the entire timeline.
  timeline.call(() => {
    flow?.release()
    flow = undefined
    restoreItemStyles(false)
    gsap.set(labels, { autoAlpha: 0 })
  }, [], .6)
  timeline.to(labels, { autoAlpha: 1, duration: .2, ease: 'power2.out' }, .62)
  // Animate flow only at the top. A floating expansion always reserves exactly
  // one compact row, so opening the panel never pushes the books or scrollTop.
  timeline.fromTo(slot.value, { height: previousSlotHeight }, {
    height: next === 'inline' ? destinationHeight : compactHeight, duration: .6,
  }, 0)
  const details = [...toolbar.value.querySelectorAll<HTMLElement>('.header-summary, .category-pill:not([data-category="all"]), .reset-filters')]
  if (next !== 'compact' && details.length) {
    timeline.fromTo(details, { y: -14, autoAlpha: 0 }, {
      y: 0, autoAlpha: 1, duration: .32, stagger: { amount: .1 }, clearProps: 'transform,opacity,visibility',
    }, .16)
  }

  if (next === 'overlay') {
    timeline.fromTo(backdrop.value, {
      y: 0, height: destinationHeight, scaleY: wasFloating ? previousBackdropScale : 0, opacity: wasFloating ? 1 : 0,
    }, { scaleY: 1, opacity: 1, duration: .6 }, 0)
  } else if (wasFloating) {
    timeline.fromTo(backdrop.value, { y: -landingOffset, height: previousBodyHeight, scaleY: previousBackdropScale, opacity: 1 }, {
      scaleY: 0, opacity: 0, duration: .6,
    }, 0)
  }
  timeline.play(0)
  restoreFocus(animationFocus)
}

function expand() {
  if (!compact.value) return
  void transitionTo((props.scrollElement?.scrollTop ?? 0) > 0 ? 'overlay' : 'inline')
}
function toggle() {
  if (compact.value) expand()
  else void transitionTo('compact')
}
function onScroll() {
  const top = Math.max(0, props.scrollElement?.scrollTop ?? 0)
  const movedDown = top > lastScrollTop
  lastScrollTop = top
  // No scroll-driven expansion. This also ignores scrollTop corrections caused
  // by shrinking the header or filtering down to a short list.
  if (movedDown && top > 0 && mode.value === 'inline') void transitionTo('compact')
}
function closeOverlay() {
  if (mode.value === 'overlay') void transitionTo('compact')
}
function onResize() {
  if (disposed) return
  if (portalActive.value) syncGeometry()
  if (timeline) {
    const token = ++revision
    timeline.kill()
    timeline = undefined
    void settle(token)
  }
}

useEventListener(() => props.scrollElement, 'scroll', onScroll, { passive: true })
useEventListener(window, 'resize', onResize)
useEventListener(window, 'scroll', () => { if (portalActive.value) syncGeometry() }, { passive: true })
useEventListener(document, 'pointerdown', event => {
  const target = event.target as HTMLElement
  if (!toolbar.value?.contains(target) && !target.closest('.library-sort-menu')) closeOverlay()
})
useEventListener(document, 'keydown', event => {
  if (event.key === 'Escape' && mode.value === 'overlay' && !document.querySelector('.library-sort-menu')) {
    event.preventDefault()
    closeOverlay()
    toggleButton.value?.focus({ preventScroll: true })
  }
})
watch(() => props.scrollElement, (element, previous) => {
  if (previous) observer?.unobserve(previous)
  if (element) observer?.observe(element)
  lastScrollTop = element?.scrollTop ?? 0
  if (lastScrollTop > 0 && mode.value === 'inline') void transitionTo('compact')
  if (portalActive.value) syncGeometry()
})
onMounted(() => {
  lastScrollTop = props.scrollElement?.scrollTop ?? 0
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(onResize)
    if (props.scrollElement) observer.observe(props.scrollElement)
  }
  if (lastScrollTop > 0) void transitionTo('compact')
})
onBeforeUnmount(() => {
  disposed = true
  revision++
  timeline?.kill()
  timeline = undefined
  observer?.disconnect()
  clearMotionStyles()
})
</script>

<template>
  <div ref="slot" class="library-header-slot" :class="{ 'has-compact-height': compact || portalActive }">
    <Teleport to="body" :disabled="!portalActive">
      <section ref="toolbar" class="library-sticky-header" :class="{ 'is-compact': compact, 'is-floating': portalActive }"
        :style="portalActive ? portalStyle : undefined" :data-header-mode="mode" aria-label="Tiêu đề và bộ lọc thư viện">
        <div v-show="portalActive" ref="backdrop" class="library-panel-backdrop" aria-hidden="true" />
        <div ref="body" class="toolbar-body">
          <div v-if="!compact" id="library-expanded-header" class="header-summary">
            <LibraryHeader :title="title" :total-collections="totalCollections" :result-count="resultCount" />
          </div>
          <LibraryFilterBar :compact="compact" :categories="categories" :active-category="activeCategory"
            :view-mode="viewMode" :search-query="searchQuery" :sort-mode="sortMode" @expand="expand"
            @update:sort-mode="emit('update:sortMode', $event)"
            @update:active-category="emit('update:activeCategory', $event)"
            @update:view-mode="emit('update:viewMode', $event)"
            @update:search-query="emit('update:searchQuery', $event)" />
          <button ref="toggleButton" type="button" class="header-expand-btn" data-library-flip="toggle" :aria-expanded="!compact"
            aria-controls="library-category-filters" :aria-label="compact ? 'Mở đầy đủ bộ lọc' : 'Thu gọn bộ lọc'"
            :title="compact ? 'Mở đầy đủ bộ lọc' : 'Thu gọn bộ lọc'" @click="toggle">
            <ChevronDown :size="18" :class="{ 'points-up': !compact }" aria-hidden="true" />
          </button>
        </div>
      </section>
    </Teleport>
  </div>
</template>

<style scoped>
.library-header-slot { position: sticky; top: 0; z-index: 5; margin-bottom: 24px; overflow: visible; overflow-anchor: none; }
.library-header-slot.has-compact-height { height: 64px; }
.library-sticky-header { position: relative; background: transparent; overflow: visible; }
.toolbar-body { position: relative; padding: 10px 0 24px; }
.header-summary { padding-right: 52px; }
.is-compact .toolbar-body { display: flex; align-items: center; gap: 8px; height: 64px; padding-block: 10px; }
.is-compact :deep(.filter-bar) { flex: 1; min-width: 0; }
.library-sticky-header.is-floating {
  --library-surface: #fff;
  --library-accent: #435a41;
  --library-ink: #18241c;
  --library-muted: #586459;
  --library-control-ink: #18241c;
  position: absolute;
  z-index: 100;
  isolation: isolate;
  color: var(--library-ink);
}
.is-floating .toolbar-body {
  max-width: calc(1400px + var(--panel-padding-left) + var(--panel-padding-right));
  max-height: var(--panel-max-height);
  margin-inline: auto;
  padding-left: var(--panel-padding-left);
  padding-right: var(--panel-padding-right);
  overflow-y: auto;
  overscroll-behavior: contain;
}
.library-panel-backdrop { position: absolute; inset: 0; z-index: -1; background: #fff; border-radius: 0; transform-origin: center top; pointer-events: none; }
.header-expand-btn { position: absolute; right: 0; top: 28px; display: grid; place-items: center; width: 36px; height: 36px; padding: 0; border: 0; border-radius: 11px; color: var(--library-control-ink); background: color-mix(in oklab, var(--library-muted) 7%, transparent); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); cursor: pointer; }
.is-floating .header-expand-btn { right: var(--panel-padding-right); }
.is-compact .header-expand-btn { position: static; flex-shrink: 0; height: 42px; }
.header-expand-btn:hover { background: color-mix(in oklab, var(--library-muted) 11%, transparent); }
.header-expand-btn:focus-visible { outline: none; background: color-mix(in oklab, var(--library-accent) 22%, transparent); color: var(--library-ink); }
.points-up { transform: rotate(180deg); }
@media (max-width: 560px) {
  .is-compact .toolbar-body { gap: 5px; }
  .header-expand-btn { top: 20px; width: 32px; }
}
</style>

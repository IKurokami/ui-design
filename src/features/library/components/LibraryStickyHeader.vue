<script setup lang="ts">
import { nextTick, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { useEventListener } from '@vueuse/core'
import { ChevronDown, ChevronUp } from '@lucide/vue'
import { useAutoMotion } from '../../../animations/composables/useAutoMotion'
import LibraryHeader from './LibraryHeader.vue'
import LibraryFilterBar from './LibraryFilterBar.vue'
import type { CategoryFilter, ViewMode } from '../types'

const props = defineProps<{
  scrollElement?: HTMLElement
  title: string
  totalItems: number
  totalCollections: number
  categories: CategoryFilter[]
  activeCategory: string
  viewMode: ViewMode
  searchQuery: string
}>()
const emit = defineEmits<{
  'update:activeCategory': [id: string]
  'update:viewMode': [mode: ViewMode]
  'update:searchQuery': [query: string]
}>()

const toolbar = ref<HTMLElement>()
const compact = ref(false)
const expandedHeight = ref(0)
const compactHeight = 64
let lastScrollTop = 0
let openedAt: number | undefined
let resizeObserver: ResizeObserver | undefined
let disposed = false
let focusRevision = 0
let restoringFocus = false

watch(compact, async () => {
  const revision = ++focusRevision
  const focused = document.activeElement
  if (!(focused instanceof HTMLElement) || !toolbar.value?.contains(focused)) return
  // Reordering retained controls can blur them in the browser. Restore only if
  // focus fell back to body, never if the user has chosen another control.
  await nextTick()
  await nextTick()
  if (!disposed && revision === focusRevision && focused.isConnected && document.activeElement === document.body) {
    restoringFocus = true
    try { focused.focus({ preventScroll: true }) }
    finally { restoringFocus = false }
  }
}, { flush: 'pre' })

// Use the existing discovery, identity, ghost and cleanup engine for this layout.
useAutoMotion(toolbar, () => compact.value, {
  duration: 0.52, ease: 'sine.inOut', stagger: 0, reduced: false, scale: false,
  collapseTo: {
    title: 'search', stats: 'search', 'quick-jump': 'search',
    'view-label:deck': 'view-icon:deck', 'view-label:list': 'view-icon:list',
    'category:': 'category:all', 'scroll-left': 'category:all',
    'scroll-right': 'category:all', 'all-works': 'category:all',
  },
  foldGroup: 'category:', foldStagger: 0.025, unclip: true, nested: true,
})

function measureExpanded() {
  if (!compact.value && toolbar.value) expandedHeight.value = toolbar.value.getBoundingClientRect().height
}
function onScroll() {
  const top = Math.max(0, props.scrollElement?.scrollTop ?? 0)
  const inset = props.scrollElement ? Number.parseFloat(getComputedStyle(props.scrollElement).paddingTop) || 0 : 0
  // The reserved space is already above the viewport when controls fold. This
  // avoids both a blank gap below the compact row and a jump in the book grid.
  const collapseAt = Math.max(96, expandedHeight.value - compactHeight + inset)
  if (top <= 4) {
    compact.value = false
    openedAt = undefined
  } else if (top > lastScrollTop && top >= collapseAt && (openedAt === undefined || top - openedAt >= 64)) {
    // A focused search field must not shrink underneath the keyboard/caret.
    if (!(toolbar.value?.contains(document.activeElement) && document.activeElement?.matches('input, textarea, [contenteditable="true"]'))) {
      measureExpanded()
      compact.value = true
      openedAt = undefined
    }
  }
  lastScrollTop = top
}
function expand() {
  if (!compact.value) return
  openedAt = props.scrollElement?.scrollTop ?? 0
  compact.value = false
}
function toggle() {
  if (compact.value) expand()
  else {
    measureExpanded()
    compact.value = true
    openedAt = undefined
  }
}
function onFocusIn(event: FocusEvent) {
  if (restoringFocus) return
  if (event.target instanceof HTMLElement && !event.target.closest('.header-expand-btn')) expand()
}

useEventListener(() => props.scrollElement, 'scroll', onScroll, { passive: true })
watch(() => props.scrollElement, element => { lastScrollTop = element?.scrollTop ?? 0 })
onMounted(async () => {
  await nextTick()
  if (disposed) return
  measureExpanded()
  if (typeof ResizeObserver !== 'undefined' && toolbar.value) {
    resizeObserver = new ResizeObserver(measureExpanded)
    resizeObserver.observe(toolbar.value)
  }
})
onBeforeUnmount(() => { disposed = true; resizeObserver?.disconnect() })
</script>

<template>
  <section ref="toolbar" class="library-sticky-header" :class="{ 'is-compact': compact }"
    data-motion-scope="library-toolbar" aria-label="Tiêu đề và bộ lọc thư viện" @click="expand" @focusin="onFocusIn">
    <div v-if="!compact" id="library-expanded-header" class="header-summary">
      <LibraryHeader :title="title" :total-items="totalItems" :total-collections="totalCollections" />
    </div>
    <LibraryFilterBar :compact="compact" :categories="categories" :active-category="activeCategory"
      :view-mode="viewMode" :search-query="searchQuery" :total-count="totalCollections"
      @update:active-category="emit('update:activeCategory', $event)"
      @update:view-mode="emit('update:viewMode', $event)"
      @update:search-query="emit('update:searchQuery', $event)" />
    <button type="button" class="header-expand-btn" data-motion-key="expand"
      :aria-expanded="!compact" aria-controls="library-expanded-header library-category-filters"
      :aria-label="compact ? 'Mở đầy đủ bộ lọc' : 'Thu gọn bộ lọc'"
      :title="compact ? 'Mở đầy đủ bộ lọc' : 'Thu gọn bộ lọc'" @click.stop="toggle">
      <ChevronDown v-if="compact" :size="18" aria-hidden="true" />
      <ChevronUp v-else :size="18" aria-hidden="true" />
    </button>
  </section>
  <!-- Preserve list position while the sticky controls change height. -->
  <div class="library-header-spacer" aria-hidden="true"
    :style="{ height: compact ? Math.max(0, expandedHeight - compactHeight) + 'px' : '0px' }" />
</template>

<style scoped>
.library-sticky-header {
  position: sticky;
  top: 0;
  z-index: 5;
  padding: 10px 0 12px;
  margin-bottom: 20px;
  overflow-anchor: none;
}
.header-summary { padding-right: 44px; }
.library-sticky-header :deep(.filter-bar) { margin-bottom: 0; }
.library-sticky-header.is-compact {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 64px;
}
.is-compact :deep(.filter-bar) { flex: 1; min-width: 0; }
.header-expand-btn {
  position: absolute;
  right: 0;
  top: 20px;
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  color: var(--library-control-ink);
  background: color-mix(in oklab, var(--library-muted) 7%, transparent);
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
  cursor: pointer;
}
.is-compact .header-expand-btn { position: static; flex-shrink: 0; }
.header-expand-btn:hover { background: color-mix(in oklab, var(--library-muted) 11%, transparent); }
.library-header-spacer { pointer-events: none; overflow-anchor: none; }
</style>

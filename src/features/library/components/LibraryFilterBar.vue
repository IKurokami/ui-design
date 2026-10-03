<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { Search, BookMarked, List, Tags, ChevronDown, ChevronLeft, ChevronRight } from '@lucide/vue'
import type { CategoryFilter, ViewMode } from '../types'

const props = defineProps<{
  compact?: boolean
  categories: CategoryFilter[]
  activeCategory: string
  viewMode: ViewMode
  searchQuery: string
  totalCount: number
}>()
const visibleCategories = computed(() => props.compact
  ? props.categories.filter(cat => cat.id === 'all')
  : props.categories)
const activeCategoryLabel = computed(() => props.categories.find(cat => cat.id === props.activeCategory)?.label ?? 'Tất cả thể loại')

const emit = defineEmits<{
  'update:activeCategory': [id: string]
  'update:viewMode': [mode: ViewMode]
  'update:searchQuery': [query: string]
}>()

const inputFocused = ref(false)
const scrollContainer = ref<HTMLElement>()
const canScrollLeft = ref(false)
const canScrollRight = ref(false)
const isDragging = ref(false)

let startX = 0
let scrollLeftStart = 0
let hasDragged = false

function updateScrollState() {
  const el = scrollContainer.value
  if (!el) return
  canScrollLeft.value = el.scrollLeft > 4
  canScrollRight.value = el.scrollLeft < el.scrollWidth - el.clientWidth - 4
}

function onWheel(e: WheelEvent) {
  const el = scrollContainer.value
  if (!el) return

  // Translate vertical wheel scroll to horizontal scrolling
  if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
    const maxScroll = el.scrollWidth - el.clientWidth
    if (maxScroll > 0) {
      const atStart = el.scrollLeft <= 0 && e.deltaY < 0
      const atEnd = el.scrollLeft >= maxScroll - 1 && e.deltaY > 0
      if (!atStart && !atEnd) {
        e.preventDefault()
        el.scrollLeft += e.deltaY * 0.9
        updateScrollState()
      }
    }
  }
}

function onMouseDown(e: MouseEvent) {
  const el = scrollContainer.value
  if (!el) return
  isDragging.value = true
  hasDragged = false
  startX = e.pageX - el.offsetLeft
  scrollLeftStart = el.scrollLeft
}

function onMouseMove(e: MouseEvent) {
  if (!isDragging.value) return
  const el = scrollContainer.value
  if (!el) return
  const x = e.pageX - el.offsetLeft
  const walk = x - startX
  if (Math.abs(walk) > 4) {
    hasDragged = true
    el.scrollLeft = scrollLeftStart - walk
    updateScrollState()
  }
}

function onMouseUp() {
  isDragging.value = false
}

function selectCategory(id: string) {
  if (hasDragged) {
    hasDragged = false
    return
  }
  emit('update:activeCategory', id)
}

function scrollByDirection(delta: number) {
  const el = scrollContainer.value
  if (!el) return
  el.scrollBy({ left: delta, behavior: 'smooth' })
  setTimeout(updateScrollState, 300)
}

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  nextTick(() => {
    updateScrollState()
    if (typeof ResizeObserver !== 'undefined' && scrollContainer.value) {
      resizeObserver = new ResizeObserver(updateScrollState)
      resizeObserver.observe(scrollContainer.value)
    } else if (typeof window !== 'undefined') {
      window.addEventListener('resize', updateScrollState, { passive: true })
    }
  })
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', updateScrollState)
  }
})
</script>

<template>
  <div class="filter-bar" :class="{ 'is-compact': compact }">
    <!-- Top Row: Search Input + View Mode Switcher -->
    <div class="search-mode-row">
      <div class="search-input-wrapper" data-motion-key="search" :class="{ focused: inputFocused }">
        <Search :size="16" class="search-icon" aria-hidden="true" />
        <input
          :value="searchQuery"
          type="text"
          aria-label="Tìm kiếm tác phẩm, nhân vật, tác giả"
          placeholder="Tìm kiếm tác phẩm Light Novel, nhân vật, tác giả..."
          @input="emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
          @focus="inputFocused = true"
          @blur="inputFocused = false"
        />
      </div>

      <!-- Mode Switcher -->
      <div class="mode-switcher" data-motion-key="view-mode" role="radiogroup" aria-label="Kiểu hiển thị">
        <button
          type="button"
          class="mode-btn"
          :class="{ active: viewMode === 'deck' }"
          title="Dạng bộ sưu tập xếp tầng"
          aria-label="Dạng thẻ xếp"
          role="radio" :aria-checked="viewMode === 'deck'"
          @click="emit('update:viewMode', 'deck')"
        >
          <span class="mode-icon" data-motion-key="view-icon:deck" data-motion-nested data-motion-overlay-target><BookMarked :size="16" /></span>
          <span v-if="!compact" class="mode-label" data-motion-key="view-label:deck" data-motion-nested>Thẻ xếp</span>
        </button>
        <button
          type="button"
          class="mode-btn"
          :class="{ active: viewMode === 'list' }"
          title="Dạng danh sách"
          aria-label="Dạng danh sách"
          role="radio" :aria-checked="viewMode === 'list'"
          @click="emit('update:viewMode', 'list')"
        >
          <span class="mode-icon" data-motion-key="view-icon:list" data-motion-nested data-motion-overlay-target><List :size="16" /></span>
          <span v-if="!compact" class="mode-label" data-motion-key="view-label:list" data-motion-nested>Danh sách</span>
        </button>
      </div>
    </div>

    <!-- Category Tabs Row with Smooth Scrolling -->
    <div id="library-category-filters" class="category-tabs-row">
      <div class="category-scroll-wrapper" data-motion-clip :class="{ 'has-left-fade': canScrollLeft, 'has-right-fade': canScrollRight }">
        <!-- Scroll Left Button -->
        <button
          v-show="!compact && canScrollLeft"
          type="button"
          class="scroll-nav-btn scroll-left"
          data-motion-key="scroll-left"
          title="Cuộn sang trái"
          aria-label="Cuộn sang trái"
          @click="scrollByDirection(-260)"
        >
          <ChevronLeft :size="15" />
        </button>

        <!-- Scrollable Badge Container -->
        <div
          ref="scrollContainer"
          class="category-scroll"
          data-motion-clip
          :class="{ 'is-dragging': isDragging }"
          @wheel="onWheel"
          @mousedown="onMouseDown"
          @mousemove="onMouseMove"
          @mouseup="onMouseUp"
          @mouseleave="onMouseUp"
          @scroll="updateScrollState"
        >
          <button
            v-for="cat in visibleCategories"
            :key="cat.id"
            type="button"
            class="category-pill"
            :data-motion-key="'category:' + cat.id"
            data-motion-overlay-target
            :aria-pressed="compact ? undefined : activeCategory === cat.id"
            :aria-label="compact ? 'Mở các thể loại. Đang chọn: ' + activeCategoryLabel : undefined"
            :class="{ active: compact || activeCategory === cat.id }"
            @click="!compact && selectCategory(cat.id)"
          >
            <Tags v-if="cat.id === 'all'" :size="16" aria-hidden="true" />
            <img v-if="cat.avatar" :src="cat.avatar" :alt="cat.label" class="pill-avatar" />
            <span class="pill-label">{{ cat.id === 'all' ? 'Tất cả thể loại' : cat.label }}</span>
            <span v-if="cat.count !== undefined" class="pill-count">{{ cat.count.toLocaleString('vi-VN') }}</span>
          </button>
        </div>

        <!-- Scroll Right Button -->
        <button
          v-show="!compact && canScrollRight"
          type="button"
          class="scroll-nav-btn scroll-right"
          data-motion-key="scroll-right"
          title="Cuộn sang phải"
          aria-label="Cuộn sang phải"
          @click="scrollByDirection(260)"
        >
          <ChevronRight :size="15" />
        </button>
      </div>

      <!-- Dropdown button on the right -->
      <button v-if="!compact" type="button" class="all-works-btn" data-motion-key="all-works">
        <span>Tất cả tác phẩm ({{ totalCount }})</span>
        <ChevronDown :size="14" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.filter-bar {
  --filter-surface: color-mix(in oklab, var(--library-muted) 7%, transparent);
  --filter-hover: color-mix(in oklab, var(--library-muted) 11%, transparent);
  --filter-active: color-mix(in oklab, var(--library-accent) 12%, transparent);
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 28px;
}

/* Tint only the control surface so labels stay fully opaque. */
.search-input-wrapper,
.mode-switcher,
.category-pill,
.all-works-btn,
.scroll-nav-btn {
  background-color: var(--filter-surface);
  -webkit-backdrop-filter: blur(12px) saturate(110%);
  backdrop-filter: blur(12px) saturate(110%);
}

/* Search + Mode Row */
.search-mode-row {
  display: flex;
  align-items: center;
  gap: 16px;
  width: 100%;
}

.search-input-wrapper {
  position: relative;
  flex: 1;
  min-width: 0;
  max-width: 580px;
  height: 42px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 16px;
  border-radius: 9999px;
  border-bottom: 1px solid var(--library-border);
  transition: border-color 0.2s ease, background-color 0.2s ease;
}

.search-input-wrapper.focused {
  border-bottom-color: var(--library-accent);
  background-color: var(--filter-hover);
}

.search-icon {
  color: var(--library-muted);
  flex-shrink: 0;
}

.search-input-wrapper input {
  flex: 1;
  min-width: 0;
  height: 100%;
  border: 0;
  outline: 0;
  background: transparent;
  font-size: 13px;
  color: var(--library-ink);
}

.search-input-wrapper input::placeholder {
  color: var(--library-muted);
}

/* Mode Switcher */
.mode-switcher {
  display: inline-flex;
  align-items: center;
  padding: 3px;
  border-radius: 9999px;
  margin-left: auto;
}

.mode-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border: 0;
  border-radius: 9999px;
  background: transparent;
  color: var(--library-muted);
  font-size: 12px;
  font-weight: 550;
  cursor: pointer;
  transition: all 0.2s ease;
}

.mode-btn.active {
  background-color: var(--filter-active);
  color: var(--library-accent);
  text-decoration: underline;
  text-underline-offset: 6px;
}
.mode-icon { display: inline-flex; flex-shrink: 0; }

/* Category Tabs Row with proper Flex constraint */
.category-tabs-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  width: 100%;
  min-width: 0;
}

.category-scroll-wrapper {
  position: relative;
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  overflow: hidden;
}

.category-scroll {
  flex: 1;
  min-width: 0;
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  overflow-x: auto;
  overflow-y: hidden;
  overscroll-behavior-x: contain;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  padding: 4px 6px;
  cursor: grab;
  scroll-behavior: smooth;
}

.category-scroll.is-dragging {
  cursor: grabbing;
  user-select: none;
}

.category-scroll::-webkit-scrollbar {
  display: none;
}

/* Scroll Arrows */
.scroll-nav-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 4;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 0;
  color: var(--library-control-ink);
  display: grid;
  place-items: center;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  transition: all 0.2s ease;
}

.scroll-nav-btn:hover {
  background-color: var(--filter-hover);
  color: var(--library-ink);
  transform: translateY(-50%) scale(1.08);
}

.scroll-left {
  left: 2px;
}

.scroll-right {
  right: 2px;
}

/* Category Pill */
.category-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  border: 0;
  border-radius: 9999px;
  color: var(--library-control-ink);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: all 0.2s ease;
}

.category-pill:hover {
  background-color: var(--filter-hover);
  color: var(--library-ink);
}

.category-pill.active {
  background-color: var(--filter-active);
  color: var(--library-accent);
  text-decoration: underline;
  text-underline-offset: 6px;
}

.pill-avatar {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.pill-count {
  font-size: 11px;
  opacity: 0.8;
}

.category-pill.active .pill-count {
  opacity: 0.9;
}

/* Dropdown */
.all-works-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 7px 14px;
  border: 0;
  border-radius: 9999px;
  color: var(--library-control-ink);
  font-size: 12px;
  font-weight: 550;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: background-color 0.2s ease;
}

.all-works-btn:hover {
  background-color: var(--filter-hover);
}

/* The very same controls move into a single row; no duplicate search input. */
.filter-bar.is-compact {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 8px;
  height: 42px;
}
.is-compact .search-mode-row { display: contents; }
.is-compact .search-input-wrapper { grid-column: 1; grid-row: 1; max-width: none; }
.is-compact .mode-switcher { grid-column: 3; grid-row: 1; margin-left: 0; }
.is-compact .mode-btn { padding: 8px; }
.is-compact .category-tabs-row { grid-column: 2; grid-row: 1; width: auto; max-width: 220px; }
.is-compact .category-scroll { padding: 0; overflow: visible; cursor: pointer; }
.is-compact .category-pill { max-width: 220px; height: 36px; }
.is-compact .pill-label { overflow: hidden; text-overflow: ellipsis; }
.is-compact .pill-avatar, .is-compact .pill-count { display: none; }
@media (max-width: 680px) {
  .mode-btn { padding: 8px; }
  .mode-label { display: none; }
  .search-mode-row { gap: 8px; }
  .category-tabs-row { flex-direction: column; align-items: stretch; gap: 8px; }
  .all-works-btn { align-self: flex-end; }
}
@media (max-width: 540px) {
  .is-compact .category-tabs-row { max-width: 36px; }
  .is-compact .category-pill { width: 36px; padding: 0; justify-content: center; }
  .is-compact .pill-label { display: none; }
  .is-compact .search-input-wrapper { padding-inline: 8px; gap: 6px; }
  .search-input-wrapper { padding-inline: 12px; gap: 8px; }
}
</style>

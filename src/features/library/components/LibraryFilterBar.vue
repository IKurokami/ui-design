<script setup lang="ts">
import { computed, ref } from 'vue'
import { Search, Layers, List, SlidersHorizontal, ChevronDown, X, Check } from '@lucide/vue'
import type { CategoryFilter, SortMode, ViewMode } from '../types'
import LibrarySortMenu from './LibrarySortMenu.vue'

const props = defineProps<{
  compact?: boolean
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
  expand: []
}>()
const searchInput = ref<HTMLInputElement>()
const visibleCategories = computed(() => props.compact ? props.categories.filter(cat => cat.id === 'all') : props.categories)
const activeCategoryLabel = computed(() => props.categories.find(cat => cat.id === props.activeCategory)?.label ?? 'Tất cả tác phẩm')
const hasFilters = computed(() => props.activeCategory !== 'all' || props.searchQuery.length > 0)
function clearSearch() {
  emit('update:searchQuery', '')
  searchInput.value?.focus({ preventScroll: true })
}
function resetFilters() {
  emit('update:activeCategory', 'all')
  emit('update:searchQuery', '')
}
</script>

<template>
  <div class="filter-bar" :class="{ 'is-compact': compact }">
    <div class="search-mode-row">
      <div class="search-input-wrapper">
        <Search :size="18" class="search-icon" aria-hidden="true" />
        <input ref="searchInput" :value="searchQuery" type="search" aria-label="Tìm kiếm tên truyện hoặc thẻ"
          placeholder="Tìm truyện…"
          @input="emit('update:searchQuery', ($event.target as HTMLInputElement).value)" @keydown.esc="clearSearch" />
        <button v-if="searchQuery" class="clear-search" type="button" aria-label="Xóa tìm kiếm" @click="clearSearch"><X :size="15" /></button>
      </div>
      <LibrarySortMenu class="filter-sort" :compact="compact" :model-value="sortMode"
        @update:model-value="emit('update:sortMode', $event)" />
      <div class="mode-switcher" role="group" aria-label="Kiểu hiển thị">
        <button v-for="mode in (['deck', 'list'] as const)" :key="mode" type="button" class="mode-btn" :class="{ active: viewMode === mode }"
          :aria-label="mode === 'deck' ? 'Dạng thẻ xếp' : 'Dạng danh sách'" :aria-pressed="viewMode === mode"
          :title="mode === 'deck' ? 'Dạng thẻ xếp' : 'Dạng danh sách'" @click="emit('update:viewMode', mode)">
          <span class="mode-icon">
            <Layers v-if="mode === 'deck'" :size="17" /><List v-else :size="17" />
          </span>
          <span v-if="!compact" class="mode-label">{{ mode === 'deck' ? 'Thẻ xếp' : 'Danh sách' }}</span>
        </button>
      </div>
    </div>
    <div id="library-category-filters" class="category-tabs-row">
      <div class="category-options" role="group" aria-label="Thể loại truyện">
        <button v-for="cat in visibleCategories" :key="cat.id" :data-category="cat.id" type="button" class="category-pill"
          :aria-pressed="compact ? undefined : activeCategory === cat.id"
          :aria-label="compact ? 'Mở các thể loại. Đang chọn: ' + activeCategoryLabel : undefined"
          :aria-expanded="compact ? false : undefined" :class="{ active: compact || activeCategory === cat.id }"
          @click="compact ? emit('expand') : emit('update:activeCategory', cat.id)">
          <SlidersHorizontal v-if="cat.id === 'all'" :size="14" aria-hidden="true" />
          <Check v-else-if="activeCategory === cat.id" :size="13" aria-hidden="true" />
          <span class="pill-label">{{ compact ? (activeCategory === 'all' ? 'Thể loại' : activeCategoryLabel) : (cat.id === 'all' ? 'Tất cả' : cat.label) }}</span>
          <ChevronDown v-if="compact" class="pill-chevron" :size="13" aria-hidden="true" />
        </button>
        <button v-if="!compact && hasFilters" type="button" class="reset-filters" @click="resetFilters"><X :size="13" /> Xóa bộ lọc</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.filter-bar { --control-surface: color-mix(in oklab, var(--library-accent) 6%, transparent); display: flex; flex-direction: column; gap: 18px; min-width: 0; background: transparent; overflow: visible; }
.search-input-wrapper, .mode-btn, .category-pill, .clear-search, .reset-filters { backdrop-filter: blur(12px) saturate(110%); -webkit-backdrop-filter: blur(12px) saturate(110%); }
.search-mode-row { display: flex; align-items: center; gap: 14px; }
.search-input-wrapper { display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0; height: 48px; padding: 0 16px; border-radius: 14px; background: var(--control-surface); transition: background-color .18s; }
.search-input-wrapper:focus-within { background: color-mix(in oklab, var(--library-accent) 12%, transparent); }
.search-icon { color: var(--library-accent); flex-shrink: 0; }
.search-input-wrapper input { width: 100%; min-width: 0; flex: 1; height: 100%; padding: 0; border: 0; outline: 0; background: transparent; color: var(--library-ink); font: inherit; font-size: 13px; }
.search-input-wrapper input::placeholder { color: var(--library-muted); }
.search-input-wrapper input::-webkit-search-cancel-button { display: none; }
.clear-search { display: grid; place-items: center; flex-shrink: 0; width: 28px; height: 28px; border: 0; border-radius: 8px; background: var(--control-surface); color: var(--library-muted); cursor: pointer; }
.mode-switcher { display: flex; flex-shrink: 0; align-items: center; gap: 3px; padding: 5px 0; border-radius: 14px; background: transparent; }
.mode-btn { display: flex; align-items: center; justify-content: center; gap: 8px; height: 38px; padding: 0 13px; border: 0; border-radius: 10px; background: transparent; color: var(--library-muted); font-size: 12px; cursor: pointer; transition: background-color .18s, color .18s; }
.mode-btn.active { background: color-mix(in oklab, var(--library-accent) 16%, transparent); color: var(--library-accent); font-weight: 650; }
.mode-btn:not(.active):hover { color: var(--library-ink); }
.mode-icon { display: inline-flex; flex-shrink: 0; }
.category-options { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.category-pill { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-width: 0; min-height: 34px; padding: 7px 12px; border: 0; border-radius: 10px; background: var(--control-surface); color: var(--library-muted); font: inherit; font-size: 11px; line-height: 18px; cursor: pointer; transition: background-color .18s, color .18s; }
.category-pill > svg { flex-shrink: 0; }
.category-pill:hover { color: var(--library-accent); background: color-mix(in oklab, var(--library-accent) 12%, transparent); }
.category-pill.active { background: color-mix(in oklab, var(--library-accent) 16%, transparent); color: var(--library-accent); font-weight: 650; }
.reset-filters { display: inline-flex; align-items: center; gap: 5px; min-height: 34px; padding: 6px 8px; border: 0; background: transparent; color: var(--library-muted); font-size: 11px; cursor: pointer; }
.reset-filters:hover { color: var(--library-accent); text-decoration: underline; }
button:focus-visible { outline: none; background: color-mix(in oklab, var(--library-accent) 25%, transparent); color: var(--library-ink); text-decoration: underline; text-underline-offset: 3px; }
.filter-bar.is-compact { display: grid; grid-template-columns: minmax(0, 1fr) auto auto auto; align-items: center; gap: 8px; height: 42px; }
.is-compact .search-mode-row { display: contents; }
.is-compact .search-input-wrapper { grid-column: 1; grid-row: 1; height: 42px; border-radius: 11px; }
.is-compact .category-tabs-row { grid-column: 2; grid-row: 1; min-width: 0; max-width: 220px; }
.is-compact .category-options { flex-wrap: nowrap; }
.is-compact .category-pill { width: 100%; height: 42px; padding-inline: 12px; border-radius: 11px; }
.is-compact .pill-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.is-compact .filter-sort { grid-column: 3; grid-row: 1; }
.is-compact .mode-switcher { grid-column: 4; grid-row: 1; border: 0; border-radius: 11px; padding: 3px 0; }
.is-compact .mode-btn { width: 34px; height: 36px; padding: 0; border-radius: 8px; }
@media (max-width: 760px) {
  .mode-label { display: none; }
  .mode-btn { padding-inline: 10px; }
  .search-mode-row { gap: 8px; }
  .category-pill { font-size: 10px; padding-inline: 9px; }
}
@media (max-width: 560px) {
  .search-mode-row { flex-wrap: wrap; }
  .search-input-wrapper { flex-basis: 100%; }
  .mode-switcher { margin-left: auto; }
  .filter-bar.is-compact { gap: 5px; grid-template-columns: minmax(0, 1fr) auto auto; }
  .is-compact .category-tabs-row { max-width: 38px; }
  .is-compact .category-pill { padding: 0; }
  .is-compact .pill-label, .is-compact .pill-chevron { display: none; }
  .is-compact .search-input-wrapper { padding-inline: 10px; gap: 7px; }
  .is-compact .mode-switcher { display: none; }
  .category-options { gap: 6px; }
}
@media (prefers-reduced-motion: reduce) { .search-input-wrapper, .mode-btn, .category-pill { transition: none; } }
</style>

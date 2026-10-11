<script setup lang="ts">
import { computed, ref, onBeforeUnmount, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import LibrarySidebar from '../components/LibrarySidebar.vue'
import LibraryStickyHeader from '../components/LibraryStickyHeader.vue'
import CollectionDeckGrid from '../components/CollectionDeckGrid.vue'
import ReadingHistory from '../components/ReadingHistory.vue'
import AmbientBackdrop from '../components/AmbientBackdrop.vue'
import { Loader2 } from '@lucide/vue'
import { storyToDeck, storyCategories, storyImageSources } from '../story-mapping'
import { friendlyError } from '../../../services/error-handler'
import type { CollectionDeck, ReadingProgress, SortMode, Story, ViewMode } from '../types'
import { sortCollections } from '../sorting'
import type { AmbientColors } from '../ambient-surface'
import { extractAmbientPalette } from '../ambient-palette'
import { createApiClient } from '../../../services/api-client'
import { usePageScrollRestoration } from '../../../animations/composables/usePageScrollRestoration'
import { useLibraryEntrance } from '../../../animations/composables/useLibraryEntrance'
import '../library-theme.css'

const activeCategory = ref('all')
const viewMode = ref<ViewMode>('deck')
const searchQuery = ref('')
const sortMode = ref<SortMode>('newest')
const scrollArea = ref<HTMLElement>()

const ambient = ref<InstanceType<typeof AmbientBackdrop>>()
const paletteCache = new WeakMap<HTMLElement, AmbientColors>()
let disposed = false
onBeforeUnmount(() => { disposed = true })

async function onDeckHover(deck: CollectionDeck, element: HTMLElement) {
  const bounds = element.getBoundingClientRect()
  const origin = { x: bounds.left + bounds.width / 2 }
  let colors = paletteCache.get(element)
  if (!colors) {
    const images = [...element.querySelectorAll('img')]
    await Promise.all(images.map(image => image.complete && image.naturalWidth
      ? Promise.resolve() : image.decode?.().catch(() => {})))
    if (disposed) return
    colors = extractAmbientPalette(images)
    if (colors) paletteCache.set(element, colors)
  }
  // A particle keeps these sampled colors until it leaves the viewport.
  if (!disposed) ambient.value?.spawn(colors ?? deck.ambientColors ?? ['#79a5a0', '#b4a0d0', '#e1b486'], origin)
}

const route = useRoute()
const router = useRouter()
const client = createApiClient()
const stories = ref<Story[]>([])
const hasMore = ref(true)
const nextPage = ref(1)
const loadingMore = ref(false)
const loadSentinel = ref<HTMLElement>()
const isLoading = ref(true)
const loadError = ref('')
const contentReady = computed(() => !isLoading.value && !loadError.value)
usePageScrollRestoration('main', scrollArea, contentReady)
const layout = ref<HTMLElement>()
useLibraryEntrance(layout, scrollArea, computed(() => !isLoading.value))
const isReading = computed(() => route.query.tab === 'reading')
const isSaved = computed(() => route.query.tab === 'saved')
const savedIds = ref<string[]>([])
const saveBusy = ref<string[]>([])
const saveError = ref('')
let searchTimer: ReturnType<typeof setTimeout> | undefined
async function loadSavedIds() {
  try {
    const response = await client.request<{ids: string[]}>('/api/favorites/ids')
    if (!disposed) savedIds.value = response.ids ?? []
  } catch { /* Keep the library usable during a favorites API error. */ }
}
async function toggleSaved(id: string) {
  if (saveBusy.value.includes(id)) return
  saveBusy.value = [...saveBusy.value, id]
  saveError.value = ''
  const wasSaved = savedIds.value.includes(id)
  try {
    await client.request('/api/favorites/' + encodeURIComponent(id), { method: wasSaved ? 'DELETE' : 'POST' })
    savedIds.value = wasSaved ? savedIds.value.filter(item => item !== id) : [...savedIds.value, id]
    if (wasSaved && isSaved.value) stories.value = stories.value.filter(story => story.id !== id)
  } catch (error) { saveError.value = friendlyError(error) }
  finally { saveBusy.value = saveBusy.value.filter(item => item !== id) }
}
function listPath(page: number): string {
  if (isSaved.value) return `/api/favorites?page=${page}&pageSize=24`
  if (isReading.value) return `/api/stories?reading=true&paginated=true&page=${page}&pageSize=24`
  const q = searchQuery.value.trim()
  return `/api/stories?paginated=true&page=${page}&pageSize=24` + (q ? '&q=' + encodeURIComponent(q) : '')
}
watch(searchQuery, () => {
  if (isReading.value || isSaved.value) return
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { activeCategory.value = 'all'; void loadStories() }, 300)
})
onBeforeUnmount(() => clearTimeout(searchTimer))
let requestVersion = 0
let loadObserver: IntersectionObserver | undefined
async function loadMissingPreviews(data: Story[], version: number) {
  // The current server may not include previewImages in summaries yet.
  // Read real story details only when needed, with at most four requests in flight.
  const missing = data.filter(story => !Array.isArray(story.previewImages) && !story.chapters)
  let next = 0
  async function worker() {
    while (!disposed && version === requestVersion) {
      const summary = missing[next++]
      if (!summary) return
      try {
        const detail = await client.request<Story>('/api/stories/' + encodeURIComponent(summary.id))
        if (disposed || version !== requestVersion) return
        const previewImages = storyImageSources(detail)
        stories.value = stories.value.map(story => story.id === summary.id ? { ...story, previewImages } : story)
      } catch { /* Keep the real cover if a detail request fails. */ }
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, missing.length) }, () => worker()))
}
async function loadStories() {
  const version = ++requestVersion
  nextPage.value = 1; hasMore.value = true
  // A search or tab switch invalidates any prior infinite-scroll response.
  loadingMore.value = false
  isLoading.value = true
  loadError.value = ''
  try {
    const reading = isReading.value
    const path = listPath(1)
    const response = await client.request<{items:Story[];hasMore?:boolean;nextPage?:number} | Story[]>(path)
    const data = Array.isArray(response) ? response : response.items
    if (!Array.isArray(response)) { hasMore.value = Boolean(response.hasMore); nextPage.value = response.nextPage || 2 } else { hasMore.value = data.length >= 24; nextPage.value = 2 }
    // Older running servers omit progress in summaries; still use persisted API data.
    if (reading) {
      const missing = data.filter(story => !story.readingProgress)
      let next = 0
      async function worker() {
        while (!disposed && version === requestVersion) {
          const summary = missing[next++]
          if (!summary) return
          const path = '/api/stories/' + encodeURIComponent(summary.id)
          const progress = await client.request<ReadingProgress>(path + '/reading-progress')
          if (disposed || version !== requestVersion) return
          if (progress.chapterId && !progress.chapterNumber) {
            const detail = await client.request<Story>(path)
            const chapter = detail.chapters?.find(chapter => chapter.id === progress.chapterId)
            if (chapter) { progress.chapterNumber = chapter.chapterNumber; progress.chapterTitle = chapter.title }
          }
          summary.readingProgress = progress
        }
      }
      await Promise.all(Array.from({ length: Math.min(4, missing.length) }, () => worker()))
    }
    if (!disposed && version === requestVersion) {
      stories.value = data
      if (!reading) void loadMissingPreviews(data, version)
    }
  } catch (error) {
    if (!disposed && version === requestVersion) loadError.value = friendlyError(error)
  } finally {
    if (!disposed && version === requestVersion) isLoading.value = false
  }
}
async function loadMore() {
  if (!hasMore.value || loadingMore.value || isLoading.value || disposed) return
  const version = requestVersion
  const page = nextPage.value
  const path = listPath(page)
  loadingMore.value = true
  try {
    const response = await client.request<{items:Story[];hasMore?:boolean;nextPage?:number} | Story[]>(path)
    if (disposed || version !== requestVersion || isLoading.value) return
    const incoming = Array.isArray(response) ? response : response.items
    const known = new Set(stories.value.map(story => story.id))
    stories.value = [...stories.value, ...incoming.filter(story => !known.has(story.id))]
    hasMore.value = Array.isArray(response) ? incoming.length === 24 : Boolean(response.hasMore)
    nextPage.value = Array.isArray(response) ? page + 1 : (response.nextPage || page + 1)
  } catch (cause) {
    if (!disposed && version === requestVersion) loadError.value = friendlyError(cause)
  } finally {
    if (!disposed && version === requestVersion) loadingMore.value = false
  }
}
watch(() => route.query.tab, () => { activeCategory.value = 'all'; searchQuery.value = ''; void loadStories(); void loadSavedIds() })
onMounted(() => {
  loadStories()
  void loadSavedIds()
  if (typeof IntersectionObserver !== 'undefined') { loadObserver = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) void loadMore() }, { root: scrollArea.value ?? null, rootMargin: '500px' }); if (loadSentinel.value) loadObserver.observe(loadSentinel.value) }
  if (route.query.create === 'true' || route.query.create === '1') router.push('/library/editor')
})
onBeforeUnmount(() => loadObserver?.disconnect())
const allCollections = computed(() => stories.value.map(storyToDeck))
const categories = computed(() => storyCategories(stories.value))
const filteredDecks = computed(() => allCollections.value.filter(deck => {
  if (activeCategory.value !== 'all' && deck.category !== activeCategory.value) return false
  // Catalog search already ran in SQL (including author and genre).
  // Only personal saved lists use in-browser filtering.
  const query = isSaved.value ? searchQuery.value.toLowerCase().trim() : ''
  return !query || deck.title.toLowerCase().includes(query) || deck.tags.some(tag => tag.toLowerCase().includes(query))
}))
const sortedDecks = computed(() => sortCollections(filteredDecks.value, sortMode.value))

function onSelectDeck(deck: CollectionDeck) {
  router.push('/library/stories/' + encodeURIComponent(deck.id))
}
</script>

<template>
  <div ref="layout" class="library-layout" :class="{ 'reading-library-layout': isReading }">
    <LibrarySidebar />

    <main class="library-main-wrapper">
      <!-- Keep ambient inside content, clipped away from the sidebar. -->
      <AmbientBackdrop v-if="!isReading" ref="ambient" />

      <!-- Scrollable Content Viewport -->
      <div ref="scrollArea" class="library-scroll-area" data-motion-clip>
        <div class="library-container">
          <ReadingHistory v-if="isReading" :stories="stories" :loading="isLoading" :error="loadError" @retry="loadStories" />
          <template v-else>
            <LibraryStickyHeader
              :scroll-element="scrollArea"
               :title="isSaved ? 'Đã lưu' : 'Thư viện'"
              :total-collections="allCollections.length"
              :result-count="filteredDecks.length"
              :categories="categories"
              v-model:activeCategory="activeCategory"
              v-model:viewMode="viewMode"
              v-model:searchQuery="searchQuery"
              v-model:sortMode="sortMode"
            />
            <!-- Personal saved stories are separate from reading history. -->
            <p v-if="isSaved" class="saved-intro">Những truyện bạn lưu để đọc sau. Danh sách được đồng bộ với tài khoản.</p>
            <p v-if="saveError" role="alert" class="saved-error">{{ saveError }}</p>
            <!-- Deck Grid View Component -->
            <div v-if="isLoading" class="library-request-state" role="status" aria-label="Đang tải thư viện"><Loader2 :size="28" class="spin" /></div>
            <div v-else-if="loadError" class="library-request-state" role="alert"><p>{{ loadError }}</p><button type="button" @click="loadStories">Thử lại</button></div>
            <CollectionDeckGrid v-else
              :decks="sortedDecks"
              :view-mode="viewMode"
              :saved-ids="savedIds"
              @toggle-save="toggleSaved"
              @select="onSelectDeck"
              @hover="onDeckHover"
            />
          </template>
          <div ref="loadSentinel" class="library-load-sentinel" aria-live="polite"><Loader2 v-if="loadingMore" :size="20" class="spin" /><span v-else-if="!hasMore">Đã hiển thị hết truyện</span></div>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.saved-intro { margin: 12px 0 24px; color:var(--library-muted); font-size:12px; }
.saved-error { color:#b14b53; font-size:12px; padding:12px; }
.reading-library-layout :deep(.user-avatar-wrap), .reading-library-layout :deep(.avatar-btn) { box-shadow: none; }
.library-request-state { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; min-height: 300px; color: var(--library-muted); font-size: 13px; text-align: center; }
.library-load-sentinel { display:flex; justify-content:center; align-items:center; min-height:52px; color:var(--library-muted); font-size:11px; }
.library-request-state button { border: 0; border-radius: 10px; padding: 10px 16px; background: color-mix(in oklab, var(--library-accent) 10%, transparent); color: var(--library-accent); font: inherit; cursor: pointer; }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .spin { animation: none; } }

.library-layout {
  position: relative;
  isolation: isolate;
  display: flex;
  height: 100dvh;
  width: 100%;
  background-color: var(--library-surface);
  color: var(--library-ink);
  overflow: hidden;
}

/* Content stays transparent so the page's ambient layer remains visible. */
.library-main-wrapper {
  --ambient-bottom-offset: 10px;
  position: relative;
  flex: 1;
  min-width: 0;
  height: calc(100dvh - 20px);
  margin: 10px 12px 10px 0;
  border-radius: 28px;
  background-color: transparent;
  overflow: hidden;
  isolation: isolate;
}

/* Khung cuộn nội dung lướt trên nền WebGL */
.library-scroll-area {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  overflow-y: auto;
  padding: 30px 38px 48px;
}

.library-container {
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
}

@media (max-width: 768px) {
  .library-main-wrapper {
    --ambient-bottom-offset: 8px;
    height: calc(100dvh - 16px);
    margin: 8px 8px 8px 0;
    border-radius: 20px;
  }
  .library-scroll-area {
    padding: 20px 16px;
  }
}
</style>

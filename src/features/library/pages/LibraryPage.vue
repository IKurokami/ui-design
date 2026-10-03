<script setup lang="ts">
import { computed, ref, onBeforeUnmount } from 'vue'
import LibrarySidebar from '../components/LibrarySidebar.vue'
import LibraryStickyHeader from '../components/LibraryStickyHeader.vue'
import CollectionDeckGrid from '../components/CollectionDeckGrid.vue'
import AmbientBackdrop from '../components/AmbientBackdrop.vue'
import { mockCategories, mockCollections } from '../data/mock-collections'
import type { CollectionDeck, SortMode, ViewMode } from '../types'
import { sortCollections } from '../sorting'
import type { AmbientColors } from '../ambient-surface'
import { extractAmbientPalette } from '../ambient-palette'
import '../library-theme.css'

const activeCategory = ref('all')
const viewMode = ref<ViewMode>('deck')
const searchQuery = ref('')
const sortMode = ref<SortMode>('newest')
const selectedDeck = ref<CollectionDeck | null>(null)
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

const filteredDecks = computed(() => {
  return mockCollections.filter(deck => {
    // Filter by Category
    if (activeCategory.value !== 'all') {
      if (activeCategory.value === 'recent') {
        if (!deck.newCount || deck.newCount === 0) return false
      } else {
        const matchesCategory = deck.category === activeCategory.value
        const matchesTag = deck.tags.some(t => {
          const lower = t.toLowerCase()
          if (activeCategory.value === 'action') return lower.includes('hành động') || lower.includes('kiếm thuật') || lower.includes('chiến')
          if (activeCategory.value === 'dark') return lower.includes('dark') || lower.includes('bá đạo') || lower.includes('phản diện')
          if (activeCategory.value === 'psychological') return lower.includes('tâm lý') || lower.includes('vòng lặp') || lower.includes('bi kịch')
          if (activeCategory.value === 'sliceoflife') return lower.includes('đời thường') || lower.includes('cảm xúc') || lower.includes('hài')
          if (activeCategory.value === 'harem') return lower.includes('harem') || lower.includes('đấu trí')
          if (activeCategory.value === 'game') return lower.includes('ảo') || lower.includes('kiếm thuật')
          return false
        })
        if (!matchesCategory && !matchesTag) return false
      }
    }

    // Filter by Search Query
    if (searchQuery.value.trim() !== '') {
      const q = searchQuery.value.toLowerCase().trim()
      const matchTitle = deck.title.toLowerCase().includes(q)
      const matchTags = deck.tags.some(t => t.toLowerCase().includes(q))
      if (!matchTitle && !matchTags) return false
    }

    return true
  })
})
const sortedDecks = computed(() => sortCollections(filteredDecks.value, sortMode.value))

function onSelectDeck(deck: CollectionDeck) {
  selectedDeck.value = deck
}
</script>

<template>
  <div class="library-layout">
    <LibrarySidebar />

    <main class="library-main-wrapper">
      <!-- Keep ambient inside content, clipped away from the sidebar. -->
      <AmbientBackdrop ref="ambient" />

      <!-- Scrollable Content Viewport -->
      <div ref="scrollArea" class="library-scroll-area">
        <div class="library-container">
          <LibraryStickyHeader
            :scroll-element="scrollArea"
            title="Thư viện"
            :total-collections="mockCollections.length"
            :result-count="filteredDecks.length"
            :categories="mockCategories"
            v-model:activeCategory="activeCategory"
            v-model:viewMode="viewMode"
            v-model:searchQuery="searchQuery"
            v-model:sortMode="sortMode"
          />

          <!-- Deck Grid View Component -->
          <CollectionDeckGrid
            :decks="sortedDecks"
            :view-mode="viewMode"
            @select="onSelectDeck"
            @hover="onDeckHover"
          />
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
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

<script setup lang="ts">
import { ref } from 'vue'
import type { CollectionDeck, ViewMode } from '../types'
import CollectionDeckCard from './CollectionDeckCard.vue'
import { BookOpen, FolderSearch } from '@lucide/vue'
import { useAutoMotion } from '../../../animations/composables/useAutoMotion'

const props = defineProps<{
  decks: CollectionDeck[]
  viewMode?: ViewMode
}>()

const emit = defineEmits<{
  select: [deck: CollectionDeck]
  hover: [deck: CollectionDeck, element: HTMLElement]
}>()

// Filter/search/sort: kept items FLIP, removed ones exit, new ones enter.
// View mode is part of each key, so switching grid ↔ list crossfades instead of
// stretching a tall card into a wide row. Value-compared string: preview image
// updates on the same decks must not retrigger a layout animation.
const container = ref<HTMLElement>()
useAutoMotion(container, () => (props.viewMode ?? 'deck') + '|' + props.decks.map(deck => deck.id).join('\u0000'), {
  deep: false, reduced: false, stagger: 0.025,
})
</script>

<template>
  <!-- Ignored by route-level page motion (it would ghost every card on navigation);
       list motion captures from the inner root, so this ancestor marker is skipped. -->
  <div class="deck-grid-container" data-motion-ignore>
  <div ref="container" data-motion-scope="library-decks">
    <div v-if="decks.length > 0 && viewMode === 'list'" class="deck-list" aria-label="Danh sách bộ truyện">
      <button v-for="deck in decks" :key="deck.id" :data-motion-key="'list:' + deck.id" class="deck-list-item" type="button"
        @click="emit('select', deck)"
        @mouseenter="emit('hover', deck, $event.currentTarget as HTMLElement)"
        @focus="emit('hover', deck, $event.currentTarget as HTMLElement)">
        <img v-if="deck.covers[0]" :src="deck.covers[0]" alt="" crossorigin="anonymous" loading="lazy" />
        <span v-if="!deck.covers[0]" class="list-cover-placeholder"><BookOpen :size="20" /></span>
        <span class="list-copy"><strong>{{ deck.title }}</strong><span>{{ deck.tags.join(' · ') }}</span></span>
        <span class="list-count">{{ deck.itemCount.toLocaleString('vi-VN') }} chương</span>
      </button>
    </div>
    <div v-else-if="decks.length > 0" class="deck-grid">
      <CollectionDeckCard
        v-for="deck in decks"
        :key="deck.id"
        :data-motion-key="'deck:' + deck.id"
        :deck="deck"
        @click="emit('select', deck)"
        @hover="(deck, element) => emit('hover', deck, element)"
      />
    </div>

    <!-- Empty State -->
    <div v-else class="empty-state" data-motion-key="empty">
      <div class="empty-icon">
        <FolderSearch :size="36" :stroke-width="1.5" />
      </div>
      <h3 class="empty-title">Không tìm thấy truyện</h3>
      <p class="empty-desc">Thử tìm kiếm với từ khóa khác hoặc chuyển sang danh mục tổng quan.</p>
    </div>
  </div>
  </div>
</template>

<style scoped>
.list-cover-placeholder { display: grid; place-items: center; color: var(--library-accent); background: color-mix(in oklab, var(--library-accent) 6%, transparent); }
.deck-grid-container {
  width: 100%;
}
.deck-list { display: grid; gap: 4px; padding-bottom: 60px; }
.deck-list-item { display: flex; align-items: center; gap: 18px; width: 100%; padding: 14px 12px; border: 0; border-radius: 12px; background: transparent; color: var(--library-ink); text-align: left; cursor: pointer; font: inherit; }
.deck-list-item:hover { background: color-mix(in oklab, var(--library-accent) 5%, transparent); }
.deck-list-item:focus-visible { outline: none; background: color-mix(in oklab, var(--library-accent) 14%, transparent); }
.deck-list-item > img, .list-cover-placeholder { width: 44px; height: 62px; border-radius: 5px; object-fit: cover; flex-shrink: 0; }
.list-copy { display: flex; flex: 1; flex-direction: column; gap: 7px; min-width: 0; }
.list-copy strong { font-size: 14px; font-weight: 600; }
.list-copy > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; color: var(--library-muted); }
.list-count { font-size: 12px; color: var(--library-muted); white-space: nowrap; }

.deck-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  column-gap: 28px;
  row-gap: 36px;
  justify-items: center;
  padding-bottom: 60px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  text-align: center;
  color: var(--library-muted);
}

.empty-icon {
  width: 64px;
  height: 64px;
  border-radius: 20px;
  background-color: transparent;
  display: grid;
  place-items: center;
  color: var(--library-accent);
  margin-bottom: 16px;
}

.empty-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--library-ink);
  margin: 0 0 6px;
}

.empty-desc {
  font-size: 13px;
  max-width: 360px;
  margin: 0;
  line-height: 1.6;
}
</style>

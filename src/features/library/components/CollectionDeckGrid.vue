<script setup lang="ts">
import type { CollectionDeck, ViewMode } from '../types'
import CollectionDeckCard from './CollectionDeckCard.vue'
import { FolderSearch } from '@lucide/vue'

defineProps<{
  decks: CollectionDeck[]
  viewMode?: ViewMode
}>()

const emit = defineEmits<{
  select: [deck: CollectionDeck]
  hover: [deck: CollectionDeck, element: HTMLElement]
}>()
</script>

<template>
  <div class="deck-grid-container">
    <div v-if="decks.length > 0 && viewMode === 'list'" class="deck-list" aria-label="Danh sách bộ truyện">
      <button v-for="deck in decks" :key="deck.id" class="deck-list-item" type="button"
        @click="emit('select', deck)"
        @mouseenter="emit('hover', deck, $event.currentTarget as HTMLElement)"
        @focus="emit('hover', deck, $event.currentTarget as HTMLElement)">
        <img :src="deck.covers[1]" alt="" crossorigin="anonymous" loading="lazy" />
        <span class="list-copy"><strong>{{ deck.title }}</strong><span>{{ deck.tags.join(' · ') }}</span></span>
        <span class="list-count">{{ deck.itemCount }} tập</span>
      </button>
    </div>
    <div v-else-if="decks.length > 0" class="deck-grid">
      <CollectionDeckCard
        v-for="deck in decks"
        :key="deck.id"
        :deck="deck"
        @click="emit('select', deck)"
        @hover="(deck, element) => emit('hover', deck, element)"
      />
    </div>

    <!-- Empty State -->
    <div v-else class="empty-state">
      <div class="empty-icon">
        <FolderSearch :size="36" :stroke-width="1.5" />
      </div>
      <h3 class="empty-title">Không tìm thấy bộ sưu tập</h3>
      <p class="empty-desc">Thử tìm kiếm với từ khóa khác hoặc chuyển sang danh mục tổng quan.</p>
    </div>
  </div>
</template>

<style scoped>
.deck-grid-container {
  width: 100%;
}
.deck-list { display: grid; gap: 4px; padding-bottom: 60px; }
.deck-list-item { display: flex; align-items: center; gap: 18px; width: 100%; padding: 14px 12px; border: 0; border-radius: 12px; background: transparent; color: var(--library-ink); text-align: left; cursor: pointer; font: inherit; }
.deck-list-item:hover { background: color-mix(in oklab, var(--library-accent) 5%, transparent); }
.deck-list-item:focus-visible { outline: none; background: color-mix(in oklab, var(--library-accent) 14%, transparent); }
.deck-list-item > img { width: 44px; height: 62px; border-radius: 5px; object-fit: cover; flex-shrink: 0; }
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

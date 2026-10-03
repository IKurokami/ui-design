<script setup lang="ts">
import type { CollectionDeck } from '../types'
import CollectionDeckCard from './CollectionDeckCard.vue'
import { FolderSearch } from '@lucide/vue'

defineProps<{
  decks: CollectionDeck[]
}>()

const emit = defineEmits<{
  select: [deck: CollectionDeck]
  hover: [deck: CollectionDeck, element: HTMLElement]
}>()
</script>

<template>
  <div class="deck-grid-container">
    <div v-if="decks.length > 0" class="deck-grid">
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

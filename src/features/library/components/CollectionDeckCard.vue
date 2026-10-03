<script setup lang="ts">
import { ref } from 'vue'
import type { CollectionDeck } from '../types'

const props = defineProps<{
  deck: CollectionDeck
}>()

const emit = defineEmits<{
  click: [deck: CollectionDeck]
  hover: [deck: CollectionDeck, element: HTMLElement]
}>()
const root = ref<HTMLElement>()
let hovered = false
let focused = false
function enter(source: 'pointer' | 'focus') {
  const shouldSpawn = source === 'pointer' ? !hovered : !focused && !hovered
  if (source === 'pointer') hovered = true
  else focused = true
  if (shouldSpawn && root.value) emit('hover', props.deck, root.value)
}
function leave(source: 'pointer' | 'focus') {
  if (source === 'pointer') hovered = false
  else focused = false
}

function handleImgError(e: Event, fallbackUrl: string) {
  const target = e.target as HTMLImageElement
  if (target && target.src !== fallbackUrl) {
    target.src = fallbackUrl
  }
}
</script>

<template>
  <div
    ref="root"
    class="deck-card"
    role="button"
    tabindex="0"
    @click="emit('click', deck)"
    @mouseenter="enter('pointer')"
    @mouseleave="leave('pointer')"
    @focus="enter('focus')"
    @blur="leave('focus')"
  >
    <div class="deck-stack">
      <!-- Back Card Left -->
      <div class="card-layer card-back-left">
        <img
          crossorigin="anonymous"
          :src="deck.covers[0]"
          :alt="`${deck.title} bìa 1`"
          loading="lazy"
          @error="handleImgError($event, deck.covers[1])"
        />
      </div>

      <!-- Back Card Right -->
      <div class="card-layer card-back-right">
        <img
          crossorigin="anonymous"
          :src="deck.covers[2]"
          :alt="`${deck.title} bìa 3`"
          loading="lazy"
          @error="handleImgError($event, deck.covers[1])"
        />
      </div>

      <!-- Front Center Card -->
      <div class="card-layer card-front">
        <img
          crossorigin="anonymous"
          :src="deck.covers[1]"
          :alt="`${deck.title} bìa chính`"
          loading="lazy"
        />
      </div>
    </div>

    <!-- Info Section -->
    <div class="deck-info">
      <h3 class="deck-title">{{ deck.title }}</h3>
      <div class="deck-stats">
        <span>{{ deck.itemCount }} tập</span>
        <span class="stat-dot">·</span>
        <span>{{ deck.totalFiles.toLocaleString('vi-VN') }} minh họa</span>
        <span v-if="deck.newCount" class="stat-badge">+{{ deck.newCount }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.deck-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  outline: none;
  padding: 12px 10px 18px;
  border-radius: 20px;
  background-color: transparent;
  transition: transform 0.25s ease;
  user-select: none;
}

.deck-card:hover {
  background-color: transparent;
}

.deck-card:focus-visible {
  outline: 2px solid var(--library-accent);
}

/* Stack Container */
.deck-stack {
  position: relative;
  width: 170px;
  height: 220px;
  margin-bottom: 14px;
  perspective: 1000px;
}

/* Shared Card Layer */
.card-layer {
  position: absolute;
  inset: 0;
  border-radius: 16px;
  overflow: hidden;
  background-color: transparent;
  transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.card-layer img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

/* Back Card Left */
.card-back-left {
  transform: rotate(-7deg) translate3d(-14px, 4px, -10px) scale(0.92);
  opacity: 0.85;
}

/* Back Card Right */
.card-back-right {
  transform: rotate(7deg) translate3d(14px, 4px, -10px) scale(0.92);
  opacity: 0.85;
}

/* Front Card */
.card-front {
  transform: translate3d(0, 0, 10px);
  z-index: 2;
}

/* Hover Fanning Effect */
.deck-card:hover .card-back-left {
  transform: rotate(-12deg) translate3d(-22px, 2px, -10px) scale(0.92);
  opacity: 0.95;
}

.deck-card:hover .card-back-right {
  transform: rotate(12deg) translate3d(22px, 2px, -10px) scale(0.92);
  opacity: 0.95;
}

.deck-card:hover .card-front {
  transform: translate3d(0, -6px, 15px);
}

/* Info Section */
.deck-info {
  text-align: center;
  max-width: 190px;
}

.deck-title {
  margin: 0 0 4px;
  font-size: 14px;
  font-weight: 650;
  color: var(--library-ink);
  letter-spacing: -0.2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.deck-stats {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  font-size: 12px;
  color: var(--library-muted);
  font-weight: 500;
}

.stat-dot {
  opacity: 0.6;
}

.stat-badge {
  display: inline-flex;
  align-items: center;
  padding: 0 2px;
  background-color: transparent;
  color: var(--library-badge-ink);
  font-size: 11px;
  font-weight: 600;
  margin-left: 2px;
}
</style>

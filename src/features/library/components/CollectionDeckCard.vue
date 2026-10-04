<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { BookOpen } from '@lucide/vue'
import type { CollectionDeck } from '../types'

const props = defineProps<{
  deck: CollectionDeck
  preview?: boolean
}>()

const emit = defineEmits<{
  click: [deck: CollectionDeck]
  hover: [deck: CollectionDeck, element: HTMLElement]
}>()
const root = ref<HTMLElement>()
const failedCovers = ref<string[]>([])
const covers = computed(() => {
  const images = [...new Set(props.deck.covers)].filter(url => url && !failedCovers.value.includes(url)).slice(0, 3)
  return images.length ? Array.from({ length: 3 }, (_, index) => images[index % images.length]) : []
})
watch(() => props.deck.covers, () => { failedCovers.value = [] }, { deep: true })
function imageFailed(event: Event) {
  const url = (event.currentTarget as HTMLImageElement).getAttribute('src')
  if (url) failedCovers.value.push(url)
}
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

</script>

<template>
  <div
    ref="root"
    class="deck-card"
    :role="preview ? 'group' : 'button'"
    :tabindex="preview ? undefined : 0"
    :class="{ 'deck-preview': preview }"
    @click="!preview && emit('click', deck)"
    @keydown.enter.prevent="!preview && emit('click', deck)"
    @keydown.space.prevent="!preview && emit('click', deck)"
    @mouseenter="enter('pointer')"
    @mouseleave="leave('pointer')"
    @focus="enter('focus')"
    @blur="leave('focus')"
  >
    <div class="deck-stack">
      <div v-if="!covers.length" class="cover-placeholder"><BookOpen :size="38" :stroke-width="1.2" aria-hidden="true" /></div>
      <!-- Back Card Left -->
      <div v-if="covers[1]" :key="'left:' + covers[1]" class="card-layer card-back-left">
        <img
          crossorigin="anonymous"
          :src="covers[1]"
          alt=""
          loading="lazy"
          @error="imageFailed"
        />
      </div>

      <!-- Back Card Right -->
      <div v-if="covers[2]" :key="'right:' + covers[2]" class="card-layer card-back-right">
        <img
          crossorigin="anonymous"
          :src="covers[2]"
          alt=""
          loading="lazy"
          @error="imageFailed"
        />
      </div>

      <!-- Front Center Card -->
      <div v-if="covers[0]" :key="'front:' + covers[0]" class="card-layer card-front">
        <img
          crossorigin="anonymous"
          @error="imageFailed"
          :src="covers[0]"
          :alt="`${deck.title} bìa chính`"
          loading="lazy"
        />
      </div>
    </div>

    <!-- Info Section -->
    <div class="deck-info">
      <h3 v-if="deck.title" class="deck-title">{{ deck.title }}</h3>
      <div class="deck-stats">
        <span>{{ deck.itemCount.toLocaleString('vi-VN') }} chương</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cover-placeholder { display: grid; place-items: center; width: 100%; height: 100%; border-radius: 16px; background: color-mix(in oklab, var(--library-accent) 6%, transparent); color: var(--library-accent); }
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
.deck-preview { cursor: default; }

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

</style>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { ChevronLeft, ChevronRight, X } from '@lucide/vue'
import { PAGE_ASPECT_RATIO } from '../types'

const props = withDefaults(defineProps<{
  title: string
  pageCount: number
  aspectRatio?: number
  coverColor?: string
}>(), { aspectRatio: PAGE_ASPECT_RATIO, coverColor: '#435a41' })
const emit = defineEmits<{ close: [] }>()

type Turn = { kind: 'cover' | 'page'; index: number }
const coverOpen = ref(false)
const turnedSheets = ref(0)
const activeTurn = ref<Turn | null>(null)
const closeButton = ref<HTMLButtonElement | null>(null)
let turnTimer: ReturnType<typeof setTimeout> | undefined
let previousFocus: HTMLElement | null = null

const sheets = computed(() => Array.from({ length: Math.ceil(Math.max(0, props.pageCount - 1) / 2) }, (_, index) => ({
  index,
  front: 1 + index * 2,
  back: 2 + index * 2 < props.pageCount ? 2 + index * 2 : null,
})))
const canNext = computed(() => !activeTurn.value && props.pageCount > 0 && (!coverOpen.value || turnedSheets.value < sheets.value.length))
const canPrevious = computed(() => !activeTurn.value && coverOpen.value)
const pageLabel = computed(() => {
  if (!coverOpen.value) return 'Bìa'
  const left = turnedSheets.value * 2
  const right = left + 1
  if (left > 0 && right < props.pageCount) return `Trang ${left}–${right}`
  if (left > 0 && left < props.pageCount) return `Trang ${left}`
  if (right < props.pageCount) return `Trang ${right}`
  return 'Cuối sách'
})

function sheetLayer(index: number) {
  const count = sheets.value.length
  // These are the same two stacks used by the reference stylesheet: the
  // first leaf starts on top, then the remaining leaves descend toward the
  // back cover. A turned leaf moves into the left-hand stack in page order.
  if (index < turnedSheets.value) return index === count - 1 ? count + 4 : index + 3
  if (index === 0) return count + 3
  return Math.max(2, count + 1 - index)
}

function finishTurn() {
  if (turnTimer !== undefined) clearTimeout(turnTimer)
  turnTimer = undefined
  activeTurn.value = null
}

function waitForTurn(turn: Turn, duration: number) {
  activeTurn.value = turn
  // transitionend is authoritative; the timer also releases controls if the
  // browser suppresses that event (for example when the window is hidden).
  turnTimer = setTimeout(finishTurn, duration + 100)
}

function turnCover(open: boolean) {
  if (activeTurn.value || turnedSheets.value > 0 || coverOpen.value === open) return
  waitForTurn({ kind: 'cover', index: -1 }, open ? 1500 : 1000)
  coverOpen.value = open
}

function turnPage(index: number, forwards: boolean) {
  if (activeTurn.value || !coverOpen.value) return
  if (index !== (forwards ? turnedSheets.value : turnedSheets.value - 1)) return
  if (index < 0 || index >= sheets.value.length) return
  waitForTurn({ kind: 'page', index }, 500)
  turnedSheets.value += forwards ? 1 : -1
}

function next() {
  if (!canNext.value) return
  if (!coverOpen.value) turnCover(true)
  else turnPage(turnedSheets.value, true)
}

function previous() {
  if (!canPrevious.value) return
  if (turnedSheets.value === 0) turnCover(false)
  else turnPage(turnedSheets.value - 1, false)
}

function finishTransition(event: TransitionEvent, kind: Turn['kind'], index: number) {
  if (event.target !== event.currentTarget || event.propertyName !== 'transform') return
  if (activeTurn.value?.kind === kind && activeTurn.value.index === index) finishTurn()
}

function handleKeydown(event: KeyboardEvent) {
  if (event.ctrlKey || event.metaKey || event.altKey) return
  if (event.key === 'Escape') { event.preventDefault(); emit('close') }
  if (event.key === 'ArrowRight') { event.preventDefault(); next() }
  if (event.key === 'ArrowLeft') { event.preventDefault(); previous() }
  if (event.key === ' ' && !(event.target instanceof HTMLButtonElement)) { event.preventDefault(); next() }
}

onMounted(() => {
  previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  window.addEventListener('keydown', handleKeydown)
  void nextTick(() => closeButton.value?.focus())
})

onBeforeUnmount(() => {
  finishTurn()
  window.removeEventListener('keydown', handleKeydown)
  if (previousFocus?.isConnected) previousFocus.focus()
})
</script>

<template>
  <Teleport to="body">
    <div class="ebook-preview-shell" role="dialog" aria-modal="true" aria-label="Xem trước ebook" :style="{ '--book-ratio': aspectRatio, '--book-cover-color': coverColor }">
      <header class="ebook-preview-header">
        <strong class="ebook-preview-title">{{ title }}</strong>
        <button ref="closeButton" type="button" class="ebook-preview-close" title="Đóng xem trước" @click="emit('close')"><X :size="20" /></button>
      </header>

      <main class="ebook-preview-stage">
        <!-- Geometry and timing follow fchavonet/creative_coding-flip_book:
             a single-page book, 2000px perspective, whole-book translation,
             an oversized cover and persistent two-sided leaves. -->
        <div class="ebook-preview-book" :class="{ open: coverOpen, turning: activeTurn }" :data-turned-sheets="turnedSheets">
          <div class="ebook-preview-back-cover" aria-hidden="true" />

          <div v-for="sheet in sheets" :key="sheet.index" class="ebook-preview-page-sheet" :class="{ flipped: sheet.index < turnedSheets, turning: activeTurn?.kind === 'page' && activeTurn.index === sheet.index }" :style="{ zIndex: sheetLayer(sheet.index) }" :data-sheet="sheet.index" @transitionend="finishTransition($event, 'page', sheet.index)">
            <div class="ebook-preview-sheet-face front">
              <slot :page-index="sheet.front" />
              <button type="button" class="ebook-preview-page-hit" :aria-label="`Lật trang ${sheet.front}`" :disabled="!!activeTurn || !coverOpen || sheet.index !== turnedSheets" @click="turnPage(sheet.index, true)" />
            </div>
            <div class="ebook-preview-sheet-face back">
              <slot v-if="sheet.back !== null" :page-index="sheet.back" />
              <button type="button" class="ebook-preview-page-hit" :aria-label="`Lật về trang ${sheet.front}`" :disabled="!!activeTurn || !coverOpen || sheet.index !== turnedSheets - 1" @click="turnPage(sheet.index, false)" />
            </div>
          </div>

          <div class="ebook-preview-cover-sheet" :class="{ flipped: coverOpen, turning: activeTurn?.kind === 'cover' }" @transitionend="finishTransition($event, 'cover', -1)">
            <div class="ebook-preview-sheet-face front">
              <slot v-if="pageCount" :page-index="0" />
              <button type="button" class="ebook-preview-page-hit" aria-label="Mở sách" :disabled="!!activeTurn || coverOpen || !pageCount" @click="turnCover(true)" />
            </div>
            <div class="ebook-preview-sheet-face back cover-inside">
              <button type="button" class="ebook-preview-page-hit" aria-label="Đóng sách" :disabled="!!activeTurn || !coverOpen || turnedSheets > 0" @click="turnCover(false)" />
            </div>
          </div>
        </div>
      </main>

      <nav class="ebook-preview-controls" aria-label="Lật sách">
        <button type="button" class="ebook-preview-nav previous" title="Trang trước" :disabled="!canPrevious" @click="previous"><ChevronLeft :size="20" /></button>
        <span class="ebook-preview-page-label" aria-live="polite">{{ pageLabel }}</span>
        <button type="button" class="ebook-preview-nav next" title="Trang sau" :disabled="!canNext" @click="next"><ChevronRight :size="20" /></button>
      </nav>
    </div>
  </Teleport>
</template>

<style scoped>
.ebook-preview-shell { position: fixed; inset: 0; z-index: 200; display: grid; grid-template-rows: 48px minmax(0, 1fr) 52px; color: #18241c; background: #f6f5ef; }
.ebook-preview-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 0 24px; }
.ebook-preview-title { overflow: hidden; font-size: 12px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.ebook-preview-close, .ebook-preview-nav { display: grid; place-items: center; width: 36px; height: 36px; flex-shrink: 0; padding: 0; border: 0; border-radius: 50%; color: inherit; background: transparent; cursor: pointer; }
.ebook-preview-close:hover, .ebook-preview-nav:hover { background: #18241c0a; }
.ebook-preview-nav:disabled { opacity: .25; cursor: default; }
.ebook-preview-stage { display: grid; place-items: center; min-width: 0; min-height: 0; padding: 8px 24px; }
/* Fit the two-page spread to the available screen, without a thumbnail cap. */
.ebook-preview-book { position: relative; width: min(calc((100vw - 64px) / 2), calc((100dvh - 116px) * var(--book-ratio))); aspect-ratio: var(--book-ratio); perspective: 2000px; transform: translateX(0); transition: transform 1s ease; }
.ebook-preview-book.open { transform: translateX(50%); }
.ebook-preview-cover-sheet, .ebook-preview-back-cover { position: absolute; inset: 0; border-radius: 2.5px 5px 5px 2.5px; background: var(--book-cover-color); }
.ebook-preview-back-cover { z-index: -1; }
.ebook-preview-cover-sheet { z-index: 99; transform-origin: center left; transform-style: preserve-3d; transform: rotateY(0deg); transition: transform .5s ease; }
.ebook-preview-cover-sheet.flipped { z-index: 1; transform: rotateY(-180deg); transition: transform 1.5s ease, z-index .5s .5s; }
/* The page and cover hinges never move relative to one another. The paper
   remains mounted under the cover even while the book is closed. */
.ebook-preview-page-sheet { position: absolute; inset: 0; transform-origin: left center; transform-style: preserve-3d; transform: rotateY(0deg); transition: transform .5s ease; }
.ebook-preview-page-sheet.flipped { transform: rotateY(-180deg); }
.ebook-preview-sheet-face { position: absolute; inset: 0; overflow: hidden; backface-visibility: hidden; -webkit-backface-visibility: hidden; border-radius: 0 5px 5px 0; background: #fff; }
.ebook-preview-sheet-face.front { transform: rotateY(0deg); }
.ebook-preview-sheet-face.back { transform: rotateY(180deg); border-radius: 5px 0 0 5px; }
.ebook-preview-cover-sheet > .ebook-preview-sheet-face { border-radius: inherit; }
.ebook-preview-sheet-face.cover-inside { background: var(--book-cover-color); }
.ebook-preview-page-hit { position: absolute; inset: 0; z-index: 2147483647; width: 100%; height: 100%; margin: 0; padding: 0; border: 0; outline-offset: -4px; background: transparent; cursor: pointer; }
.ebook-preview-page-hit:disabled { cursor: default; }
.ebook-preview-controls { display: flex; justify-content: center; align-items: center; gap: 16px; padding-bottom: 8px; }
.ebook-preview-page-label { min-width: 95px; text-align: center; color: #687265; font-size: 11px; font-variant-numeric: tabular-nums; }
@media (prefers-reduced-motion: reduce) {
  .ebook-preview-book, .ebook-preview-cover-sheet, .ebook-preview-page-sheet { transition-duration: .001s; }
}
@media print { .ebook-preview-shell { display: none; } }
</style>


<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import DOMPurify from 'dompurify'
import { PAGE_ASPECT_RATIO, PAGE_HEIGHT, PAGE_WIDTH, type EbookElement, type EbookPage } from '../types'

const props = withDefaults(defineProps<{
  page: EbookPage
  readOnly?: boolean
  selectedPage?: boolean
  selectedElementId?: string
  editingElementId?: string
}>(), { readOnly: false, selectedPage: false, selectedElementId: '', editingElementId: '' })

const emit = defineEmits<{
  pageClick: [event: MouseEvent]
  pageContextmenu: [event: MouseEvent]
  pageDrop: [event: DragEvent]
  interactionStart: [payload: { event: PointerEvent, element: EbookElement, mode: 'move' | 'resize' }]
  selectElement: [element: EbookElement]
  contextmenuElement: [payload: { event: MouseEvent, element: EbookElement }]
  editElement: [element: EbookElement]
  elementInput: [payload: { event: Event, element: EbookElement }]
  elementKeydown: [event: KeyboardEvent]
}>()

const viewport = ref<HTMLElement | null>(null)
const scale = ref(1)
let resizeObserver: ResizeObserver | undefined
const elements = computed(() => [...props.page.elements].sort((a, b) => a.zIndex - b.zIndex))
const selectedElement = computed(() => props.readOnly ? null : props.page.elements.find(element => element.id === props.selectedElementId) ?? null)

function updateScale(width: number) {
  if (width > 0) scale.value = width / PAGE_WIDTH
}

function elementStyle(element: EbookElement) {
  // The page is laid out once in design coordinates. Scale the whole surface,
  // including inline HTML styles, so changing view size never reflows a page.
  return {
    left: `${element.x}px`, top: `${element.y}px`, width: `${element.width}px`, height: `${element.height}px`,
    zIndex: element.zIndex, opacity: element.opacity, transform: `rotate(${element.rotation}deg)`,
    borderRadius: `${element.cornerRadius}px`,
    '--element-font-size': `${element.fontSize}px`, '--element-line-height': String(element.lineHeight),
    '--element-color': element.color, '--element-font-family': element.fontFamily, '--element-align': element.align,
    '--element-justify': element.verticalAlign === 'middle' ? 'center' : element.verticalAlign === 'bottom' ? 'flex-end' : 'flex-start',
    '--element-letter-spacing': `${element.letterSpacing}px`, '--element-padding': `${element.padding}px`,
    '--element-background': element.backgroundColor, fontWeight: element.fontWeight, fontStyle: element.fontStyle,
    textDecoration: element.textDecoration, textTransform: element.textTransform,
  }
}

function selectionStyle(element: EbookElement) {
  return {
    left: `${element.x / PAGE_WIDTH * 100}%`, top: `${element.y / PAGE_HEIGHT * 100}%`,
    width: `${element.width / PAGE_WIDTH * 100}%`, height: `${element.height / PAGE_HEIGHT * 100}%`,
    transform: `rotate(${element.rotation}deg)`,
  }
}

function elementHtml(element: EbookElement) {
  return DOMPurify.sanitize(element.html || '', { USE_PROFILES: { html: true }, ALLOW_DATA_ATTR: false })
}

onMounted(() => {
  if (!viewport.value) return
  updateScale(viewport.value.clientWidth)
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(entries => {
      const entry = entries[0]
      if (entry) updateScale(entry.contentRect.width)
    })
    resizeObserver.observe(viewport.value)
  }
})
onBeforeUnmount(() => resizeObserver?.disconnect())
</script>

<template>
  <div ref="viewport" class="ebook-page" :class="{ 'read-only': readOnly, selected: selectedPage }" :data-page-id="page.id" :style="{ background: page.background, aspectRatio: PAGE_ASPECT_RATIO }" @click="emit('pageClick', $event)" @contextmenu.prevent.stop="emit('pageContextmenu', $event)" @dragover.prevent @drop.prevent="emit('pageDrop', $event)">
    <div class="ebook-page-surface" :style="{ width: `${PAGE_WIDTH}px`, height: `${PAGE_HEIGHT}px`, transform: `scale(${scale})` }">
      <img v-if="page.coverUrl" class="ebook-cover-image" :src="page.coverUrl" alt="" draggable="false" />
      <div v-for="element in elements" :key="element.id" class="ebook-element" :class="{ selected: !readOnly && selectedElementId === element.id, locked: element.locked }" :data-element-id="element.id" :style="elementStyle(element)"
        @pointerdown.stop="!readOnly && emit('interactionStart', { event: $event, element, mode: 'move' })"
        @click.stop="!readOnly && emit('selectElement', element)"
        @contextmenu.prevent.stop="!readOnly && emit('contextmenuElement', { event: $event, element })"
        @dblclick.stop="!readOnly && element.kind === 'text' && emit('editElement', element)">
        <img v-if="element.kind === 'image'" class="ebook-element-image" :src="element.src" alt="" draggable="false" />
        <div v-else :data-editor-element="readOnly ? undefined : element.id" class="ebook-element-text" :contenteditable="!readOnly && selectedElementId === element.id && editingElementId === element.id && !page.locked && !element.locked" spellcheck="false"
          @input="emit('elementInput', { event: $event, element })" @keydown="emit('elementKeydown', $event)" v-html="elementHtml(element)" />
      </div>
    </div>
    <div v-if="selectedElement" class="ebook-selection-overlay" :style="selectionStyle(selectedElement)">
      <span class="element-drag-strip" title="Kéo ô" @pointerdown.stop="emit('interactionStart', { event: $event, element: selectedElement, mode: 'move' })" />
      <button type="button" class="element-handle element-handle-move" title="Kéo" @pointerdown.stop="emit('interactionStart', { event: $event, element: selectedElement, mode: 'move' })" />
      <button type="button" class="element-handle element-handle-resize" title="Đổi kích thước" @pointerdown.stop="emit('interactionStart', { event: $event, element: selectedElement, mode: 'resize' })" />
    </div>
  </div>
</template>

<style scoped>
.ebook-page { position: relative; width: 100%; overflow: hidden; container-type: inline-size; cursor: default; }
.ebook-page.selected { background: color-mix(in oklab, var(--library-accent) 2%, var(--library-surface)); }
.ebook-page.read-only { position: absolute; inset: 0; height: 100%; }
.ebook-page-surface { position: absolute; top: 0; left: 0; transform-origin: top left; }
.ebook-cover-image { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; pointer-events: none; }
.ebook-element { position: absolute; transform-origin: center center; user-select: none; cursor: grab; }
.ebook-element:active { cursor: grabbing; }
.ebook-element.selected { background: color-mix(in oklab, var(--library-accent) 8%, transparent); }
.ebook-element.locked, .read-only .ebook-element { cursor: default; }
.ebook-element-image { display: block; width: 100%; height: 100%; object-fit: cover; border-radius: inherit; pointer-events: none; }
.ebook-element-text { display: flex; flex-direction: column; justify-content: var(--element-justify); width: 100%; height: 100%; box-sizing: border-box; overflow: hidden; padding: var(--element-padding); outline: 0; color: var(--element-color); background: var(--element-background); font-family: var(--element-font-family); font-size: var(--element-font-size); font-style: inherit; font-weight: inherit; line-height: var(--element-line-height); letter-spacing: var(--element-letter-spacing); text-align: var(--element-align); text-decoration: inherit; text-transform: inherit; word-break: break-word; user-select: none; border-radius: inherit; }
.ebook-element-text[contenteditable='true'] { cursor: text; user-select: text; }
.ebook-page:not(.read-only) .ebook-element-text:empty::before { content: 'Nhập văn bản'; color: color-mix(in oklab, var(--element-color) 38%, transparent); font-style: italic; }
.ebook-element-text :deep(p) { margin: 0 0 .7em; }
.ebook-element-text :deep(h1), .ebook-element-text :deep(h2), .ebook-element-text :deep(h3) { margin: 0 0 .5em; line-height: 1.1; }
.ebook-element-text :deep(blockquote) { margin: 0; padding-left: 1em; font-style: italic; }
.ebook-element-text :deep(img) { display: block; max-width: 100%; max-height: 100%; object-fit: contain; }
.ebook-selection-overlay { position: absolute; z-index: 2147483647; transform-origin: center center; pointer-events: none; }
.element-drag-strip { position: absolute; top: -2px; left: 0; right: 0; height: 16px; border-radius: 8px 8px 0 0; background: color-mix(in oklab, var(--library-accent) 22%, transparent); cursor: grab; pointer-events: auto; }
.element-handle { position: absolute; width: 9px; height: 9px; padding: 0; border: 0; border-radius: 50%; background: var(--library-accent); cursor: pointer; pointer-events: auto; }
.element-handle-move { top: -4px; left: -4px; cursor: grab; }
.element-handle-resize { right: -6px; bottom: -6px; width: 14px; height: 14px; cursor: nwse-resize; }
@media print { .ebook-element.selected { background: transparent; } .ebook-selection-overlay { display: none; } }
</style>

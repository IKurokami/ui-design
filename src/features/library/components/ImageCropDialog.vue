<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, onUnmounted, ref } from 'vue'
import { Loader2, RotateCcw, X } from '@lucide/vue'
import { cropRectangle, libraryCoverRatio, renderCroppedImage } from '../image-crop'

const props = defineProps<{ src: string; description: string; apply: (file: File) => Promise<void> }>()
const emit = defineEmits<{ close: [] }>()
const dialog = ref<HTMLDialogElement>()
const image = ref<HTMLImageElement>()
const frame = ref<HTMLElement>()
const loaded = ref(false)
const error = ref('')
const saving = ref(false)
const dimensions = ref({ width: 1, height: 1 })
const ratioMode = ref<'library' | 'square' | 'original'>('library')
const zoom = ref(1)
const horizontal = ref(50)
const vertical = ref(50)
let disposed = false
let returnFocus: HTMLElement | undefined
let returnRegion: HTMLElement | undefined
let drag: { x: number; y: number; horizontal: number; vertical: number; width: number; height: number } | undefined
const ratio = computed(() => ratioMode.value === 'library' ? libraryCoverRatio : ratioMode.value === 'square' ? 1 : dimensions.value.width / dimensions.value.height)
const crop = computed(() => cropRectangle(dimensions.value.width, dimensions.value.height, ratio.value, zoom.value, horizontal.value, vertical.value))
const imageStyle = computed(() => ({ width: `${dimensions.value.width / crop.value.width * 100}%`, height: `${dimensions.value.height / crop.value.height * 100}%`, left: `${-crop.value.x / crop.value.width * 100}%`, top: `${-crop.value.y / crop.value.height * 100}%` }))

onMounted(() => {
  returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : undefined
  returnRegion = returnFocus?.closest<HTMLElement>('.gallery-container, .cover-controls, .editor-scroll-area') ?? undefined
  dialog.value?.showModal()
})
onBeforeUnmount(() => { disposed = true })
onUnmounted(() => { void nextTick(() => {
  const target = returnFocus?.isConnected ? returnFocus : returnRegion?.isConnected ? returnRegion.querySelector<HTMLElement>('button:not([disabled]), input') : undefined
  target?.focus({ preventScroll: true })
}) })
function onLoad() {
  if (!image.value?.naturalWidth || !image.value.naturalHeight) return
  dimensions.value = { width: image.value.naturalWidth, height: image.value.naturalHeight }
  loaded.value = true
  error.value = ''
}
function reset() { zoom.value = 1; horizontal.value = 50; vertical.value = 50 }
function close() { if (!saving.value) emit('close') }
function startDrag(event: PointerEvent) {
  if (!loaded.value || saving.value || !frame.value) return
  const bounds = frame.value.getBoundingClientRect()
  drag = { x: event.clientX, y: event.clientY, horizontal: horizontal.value, vertical: vertical.value, width: bounds.width, height: bounds.height }
  frame.value.setPointerCapture(event.pointerId)
}
function moveDrag(event: PointerEvent) {
  if (!drag) return
  const remainingX = dimensions.value.width - crop.value.width
  const remainingY = dimensions.value.height - crop.value.height
  const clamp = (value: number) => Math.max(0, Math.min(100, value))
  if (remainingX > 0 && drag.width > 0) horizontal.value = clamp(drag.horizontal - (event.clientX - drag.x) / drag.width * crop.value.width / remainingX * 100)
  if (remainingY > 0 && drag.height > 0) vertical.value = clamp(drag.vertical - (event.clientY - drag.y) / drag.height * crop.value.height / remainingY * 100)
}
function endDrag() { drag = undefined }
async function applyCrop() {
  if (!loaded.value || !image.value || saving.value) return
  saving.value = true
  error.value = ''
  try {
    await props.apply(await renderCroppedImage(image.value, crop.value))
    if (!disposed) { saving.value = false; emit('close') }
  } catch (cause) {
    if (!disposed) error.value = cause instanceof Error ? cause.message : 'Không lưu được ảnh đã cắt. Vui lòng thử lại.'
  } finally { if (!disposed) saving.value = false }
}
async function changeRatio(mode: typeof ratioMode.value) { ratioMode.value = mode; reset(); await nextTick() }
</script>

<template>
  <dialog ref="dialog" class="crop-dialog" aria-labelledby="crop-title" aria-describedby="crop-description" @cancel.prevent="close" @click="($event.target === dialog) && close()">
    <div class="crop-content">
      <header class="crop-heading"><h2 id="crop-title">Cắt ảnh</h2><button type="button" aria-label="Đóng cắt ảnh" :disabled="saving" @click="close"><X :size="18" /></button></header>
      <p id="crop-description">{{ description }}</p>
      <div class="crop-workspace">
        <div class="crop-stage">
          <div ref="frame" class="crop-frame" :style="{ '--crop-ratio': String(ratio) }" @pointerdown="startDrag" @pointermove="moveDrag" @pointerup="endDrag" @pointercancel="endDrag" @lostpointercapture="endDrag">
            <img ref="image" :src="src" crossorigin="anonymous" alt="Vùng ảnh sẽ được giữ lại" :style="imageStyle" draggable="false" @load="onLoad" @error="error = 'Không tải được ảnh. Kiểm tra ảnh rồi thử lại.'" />
            <Loader2 v-if="!loaded && !error" class="crop-spinner" :size="24" aria-label="Đang tải ảnh" />
          </div>
        </div>
        <div class="crop-controls">
          <fieldset :disabled="saving || !loaded"><legend>Tỉ lệ</legend><div class="crop-ratios">
            <button type="button" :aria-pressed="ratioMode === 'library'" @click="changeRatio('library')">Thư viện</button>
            <button type="button" :aria-pressed="ratioMode === 'square'" @click="changeRatio('square')">Vuông</button>
            <button type="button" :aria-pressed="ratioMode === 'original'" @click="changeRatio('original')">Ảnh gốc</button>
          </div></fieldset>
          <label>Phóng to <output>{{ Number(zoom).toFixed(1) }}×</output><input v-model.number="zoom" aria-label="Phóng to ảnh" type="range" min="1" max="4" step="0.05" :disabled="saving || !loaded" /></label>
          <label>Vị trí ngang<input v-model.number="horizontal" aria-label="Vị trí ảnh theo chiều ngang" type="range" min="0" max="100" step="0.5" :disabled="saving || !loaded || crop.width >= dimensions.width" /></label>
          <label>Vị trí dọc<input v-model.number="vertical" aria-label="Vị trí ảnh theo chiều dọc" type="range" min="0" max="100" step="0.5" :disabled="saving || !loaded || crop.height >= dimensions.height" /></label>
          <button type="button" class="crop-reset" :disabled="saving || !loaded" @click="reset"><RotateCcw :size="14" />Đặt lại vị trí</button>
        </div>
      </div>
      <p v-if="error" class="crop-error" role="alert">{{ error }}</p>
      <footer><button type="button" :disabled="saving" @click="close">Hủy</button><button type="button" class="crop-apply" :disabled="saving || !loaded" @click="applyCrop"><Loader2 v-if="saving" :size="15" class="crop-spinner" />{{ saving ? 'Đang lưu ảnh…' : 'Áp dụng' }}</button></footer>
    </div>
  </dialog>
</template>

<style scoped>
.crop-dialog { position: fixed; inset: 0; margin: auto; width: min(760px, calc(100vw - 32px)); max-height: calc(100dvh - 32px); padding: 0; border: 0; box-shadow: none; border-radius: 24px; background: #fff; color: #18241c; overflow-y: auto; }
.crop-dialog::backdrop { background: rgba(18, 30, 20, .45); }
.crop-content { padding: 28px; }
.crop-heading { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.crop-heading h2 { font-size: 20px; font-weight: 550; margin: 0; }
.crop-content p { font-size: 12px; line-height: 1.7; color: #62705e; margin: 0 0 22px; }
.crop-dialog button { display: inline-flex; align-items: center; justify-content: center; gap: 7px; border: 0; box-shadow: none; background: #f0f3eb; color: #435a41; padding: 10px 13px; border-radius: 10px; font: inherit; font-size: 12px; cursor: pointer; }
.crop-dialog button:disabled { opacity: .5; cursor: not-allowed; }
.crop-heading button { background: transparent; padding: 8px; }
.crop-workspace { display: grid; grid-template-columns: minmax(0, 1fr) 210px; gap: 28px; align-items: center; }
.crop-stage { min-width: 0; min-height: 280px; padding: 16px; display: grid; place-items: center; background: #eef1e9; border-radius: 18px; }
.crop-frame { position: relative; width: min(100%, 280px, calc(380px * var(--crop-ratio))); aspect-ratio: var(--crop-ratio); overflow: hidden; background: #dfe6d7; border-radius: 12px; touch-action: none; cursor: grab; }
.crop-frame:active { cursor: grabbing; }
.crop-frame img { position: absolute; max-width: none; object-fit: fill; user-select: none; pointer-events: none; }
.crop-frame > svg { position: absolute; inset: 0; margin: auto; }
.crop-controls { display: flex; flex-direction: column; gap: 22px; }
.crop-controls fieldset { border: 0; margin: 0; padding: 0; min-width: 0; }
.crop-controls legend, .crop-controls label { font-size: 12px; }
.crop-controls legend { margin-bottom: 10px; }
.crop-ratios { display: flex; flex-wrap: wrap; gap: 6px; }
.crop-ratios button { padding: 8px 10px; font-size: 11px; }
.crop-ratios button[aria-pressed='true'] { background: #435a41; color: #fff; }
.crop-controls label output { float: right; font-variant-numeric: tabular-nums; color: #62705e; }
.crop-controls input { appearance: none; display: block; width: 100%; height: 4px; margin: 14px 0 4px; border: 0; box-shadow: none; border-radius: 99px; background: #dce4d2; cursor: pointer; }
.crop-controls input::-webkit-slider-thumb { appearance: none; width: 14px; height: 14px; border: 0; box-shadow: none; border-radius: 50%; background: #435a41; }
.crop-controls input::-moz-range-thumb { width: 14px; height: 14px; border: 0; box-shadow: none; border-radius: 50%; background: #435a41; }
.crop-controls input:disabled { opacity: .4; cursor: not-allowed; }
.crop-controls .crop-reset { align-self: flex-start; background: transparent; padding: 0; }
.crop-content .crop-error { color: #a34336; margin: 18px 0 0; }
.crop-content footer { display: flex; justify-content: flex-end; gap: 10px; margin-top: 26px; }
.crop-dialog .crop-apply { background: #435a41; color: #fff; }
.crop-spinner { animation: crop-spin 1s linear infinite; } @keyframes crop-spin { to { transform: rotate(360deg); } }
@media (max-width: 600px) { .crop-content { padding: 20px; }.crop-workspace { grid-template-columns: minmax(0, 1fr); gap: 20px; }.crop-frame { width: min(100%, 210px, calc(275px * var(--crop-ratio))); }.crop-controls { gap: 16px; } }
@media (prefers-reduced-motion: reduce) { .crop-spinner { animation: none; } }
</style>

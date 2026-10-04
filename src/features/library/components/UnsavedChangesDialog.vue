<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from 'vue'
import { AlertTriangle, Loader2 } from '@lucide/vue'

defineProps<{ saving: boolean; error: string }>()
const emit = defineEmits<{ stay: []; discard: []; save: [] }>()
const dialog = ref<HTMLDialogElement>()
const stay = ref<HTMLButtonElement>()
let returnFocus: HTMLElement | undefined
onMounted(() => {
  returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : undefined
  dialog.value?.showModal()
  stay.value?.focus()
})
onUnmounted(() => { void nextTick(() => { if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true }) }) })
</script>

<template>
  <dialog ref="dialog" class="unsaved-dialog" aria-labelledby="unsaved-title" aria-describedby="unsaved-description" @cancel.prevent="!saving && emit('stay')">
    <AlertTriangle :size="26" aria-hidden="true" />
    <h2 id="unsaved-title">Truyện chưa được lưu</h2>
    <p id="unsaved-description">Các thay đổi về truyện, chương và ảnh chưa lưu sẽ mất nếu bạn thoát.</p>
    <p v-if="error" class="unsaved-error" role="alert">{{ error }}</p>
    <div class="unsaved-actions">
      <button ref="stay" type="button" class="unsaved-stay" :disabled="saving" @click="emit('stay')">Tiếp tục chỉnh sửa</button>
      <button type="button" class="unsaved-discard" :disabled="saving" @click="emit('discard')">Thoát không lưu</button>
      <button type="button" class="unsaved-save" :disabled="saving" @click="emit('save')"><Loader2 v-if="saving" :size="15" class="spin" />{{ saving ? 'Đang lưu…' : 'Lưu rồi thoát' }}</button>
    </div>
  </dialog>
</template>

<style scoped>
.unsaved-dialog { position: fixed; inset: 0; margin: auto; width: min(470px, calc(100vw - 32px)); max-height: calc(100dvh - 32px); overflow-y: auto; padding: 28px; border: 0; box-shadow: none; border-radius: 24px; background: #fff; color: #18241c; }
.unsaved-dialog::backdrop { background: #18241c60; }
.unsaved-dialog > svg { color: #a16b29; }
.unsaved-dialog h2 { margin: 18px 0 12px; font-size: 22px; font-weight: 550; }
.unsaved-dialog p { margin: 0; font-size: 13px; line-height: 1.8; color: #5e6b5d; }
.unsaved-dialog .unsaved-error { margin-top: 14px; color: #aa4b3f; }
.unsaved-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 24px; }
.unsaved-actions button { display: inline-flex; align-items: center; justify-content: center; gap: 7px; padding: 10px 12px; font: inherit; font-size: 12px; border: 0; box-shadow: none; border-radius: 10px; background: #eef2e8; color: #435a41; cursor: pointer; }
.unsaved-actions .unsaved-discard { background: #f8eeea; color: #aa4b3f; }
.unsaved-actions .unsaved-save { background: #435a41; color: #fff; }
.unsaved-actions button:disabled { opacity: .5; cursor: not-allowed; }
.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .spin { animation: none; } }
</style>

<script setup lang="ts" generic="Mode extends string = SortMode">
import { computed, nextTick, ref, useId, watch } from 'vue'
import { useEventListener } from '@vueuse/core'
import { ArrowDownUp, Check, ChevronDown } from '@lucide/vue'
import { librarySortOptions } from '../sorting'
import type { SortMode } from '../types'

const props = defineProps<{
  modelValue?: Mode
  compact?: boolean
  options?: readonly { value: Mode; label: string }[]
}>()
const emit = defineEmits<{ 'update:modelValue': [value: Mode] }>()
const selectedMode = computed(() => props.modelValue ?? 'newest')
// Library callers use the default modes; other pages provide their own typed options.
const options = computed(() => props.options ?? (librarySortOptions as unknown as readonly { value: Mode; label: string }[]))
const trigger = ref<HTMLButtonElement>()
const menu = ref<HTMLElement>()
const open = ref(false)
const position = ref<Record<string, string>>({})
const menuId = useId()
const label = computed(() => options.value.find(option => option.value === selectedMode.value)?.label)

function close(restoreFocus = false) {
  open.value = false
  if (restoreFocus) trigger.value?.focus({ preventScroll: true })
}
async function show() {
  if (!trigger.value) return
  const rect = trigger.value.getBoundingClientRect()
  const width = Math.min(232, window.innerWidth - 16)
  const height = Math.min(216, window.innerHeight - 16)
  const top = rect.bottom + 8 + height <= window.innerHeight ? rect.bottom + 8 : rect.top - height - 8
  const theme = getComputedStyle(trigger.value)
  position.value = {
    left: Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8)) + 'px',
    top: Math.max(8, Math.min(top, window.innerHeight - height - 8)) + 'px',
    width: width + 'px', maxHeight: height + 'px',
    '--library-accent': theme.getPropertyValue('--library-accent').trim() || '#435a41',
    '--library-ink': theme.getPropertyValue('--library-ink').trim() || '#18241c',
    '--library-surface': theme.getPropertyValue('--library-surface').trim() || '#fff',
  }
  open.value = true
  await nextTick()
  const selected = menu.value?.querySelector<HTMLElement>('[aria-checked="true"]')
    ?? menu.value?.querySelector<HTMLElement>('[role="menuitemradio"]')
  selected?.focus({ preventScroll: true })
}
function choose(value: Mode) {
  emit('update:modelValue', value)
  close(true)
}
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); return }
  if (event.key === 'Tab') { close(true); return }
  const items = [...(menu.value?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? [])]
  const current = items.indexOf(document.activeElement as HTMLButtonElement)
  let next: number
  if (event.key === 'ArrowDown') next = (current + 1) % items.length
  else if (event.key === 'ArrowUp') next = (current - 1 + items.length) % items.length
  else if (event.key === 'Home') next = 0
  else if (event.key === 'End') next = items.length - 1
  else return
  event.preventDefault()
  items[next]?.focus({ preventScroll: true })
}
useEventListener(document, 'pointerdown', event => {
  if (open.value && !menu.value?.contains(event.target as Node) && !trigger.value?.contains(event.target as Node)) close()
})
useEventListener(document, 'scroll', event => {
  if (open.value && !menu.value?.contains(event.target as Node)) close()
}, { capture: true, passive: true })
useEventListener(window, 'resize', () => close())
watch(() => props.compact, () => close())
</script>

<template>
  <div class="sort-control" :class="{ 'is-compact': compact }" @click.stop @focusin.stop>
    <button ref="trigger" type="button" class="sort-trigger" data-library-flip="sort" :aria-label="'Sắp xếp: ' + label" :title="'Sắp xếp: ' + label"
      aria-haspopup="menu" :aria-expanded="open" :aria-controls="open ? menuId : undefined"
      @click="open ? close() : show()" @keydown.down.prevent="show()" @keydown.up.prevent="show()">
      <span class="sort-icon" data-library-part="icon"><ArrowDownUp :size="17" aria-hidden="true" /></span>
      <span class="sort-label" data-library-part="label">{{ label }}</span>
      <span class="sort-chevron" data-library-part="chevron"><ChevronDown :size="13" aria-hidden="true" /></span>
    </button>
    <Teleport to="body">
      <div v-if="open" :id="menuId" ref="menu" class="library-sort-menu" :style="position" role="menu" aria-label="Sắp xếp truyện" @keydown="onKeydown" @click.stop>
        <button v-for="option in options" :key="option.value" type="button" role="menuitemradio"
          :aria-checked="selectedMode === option.value" @click="choose(option.value)">
          <span>{{ option.label }}</span><Check v-if="selectedMode === option.value" :size="15" aria-hidden="true" />
        </button>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.sort-control { flex-shrink: 0; }
.sort-icon, .sort-chevron { display: inline-flex; flex-shrink: 0; }
.sort-trigger { position: relative; }
.sort-label { white-space: nowrap; }
.is-compact .sort-label, .is-compact .sort-chevron { display: none; }
.sort-trigger { display: flex; align-items: center; justify-content: center; gap: 9px; height: 48px; padding: 0 14px; border: 0; border-radius: 14px; background: color-mix(in oklab, var(--library-accent) 6%, transparent); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); color: var(--library-control-ink); font: inherit; font-size: 12px; cursor: pointer; }
.sort-trigger:hover, .sort-trigger:focus-visible, .sort-trigger[aria-expanded="true"] { outline: none; background: color-mix(in oklab, var(--library-accent) 17%, transparent); }
.is-compact .sort-trigger { width: 38px; height: 42px; padding: 0; border-radius: 11px; }
.library-sort-menu { position: fixed; z-index: 1000; display: grid; gap: 3px; padding: 2px; margin: 0; overflow-y: auto; border-radius: 12px; background: transparent; color: var(--library-ink); }
.library-sort-menu button { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 40px; padding: 10px 12px; border: 0; border-radius: 9px; background: color-mix(in oklab, var(--library-surface) 18%, transparent); backdrop-filter: blur(24px) saturate(110%); -webkit-backdrop-filter: blur(24px) saturate(110%); color: inherit; font: inherit; font-size: 12px; text-align: left; cursor: pointer; }
.library-sort-menu button:hover, .library-sort-menu button:focus-visible { outline: none; background: color-mix(in oklab, var(--library-accent) 14%, transparent); }
.library-sort-menu button[aria-checked="true"] { color: var(--library-accent); font-weight: 650; }
@media (max-width: 1000px) { .sort-label, .sort-chevron { display: none; } .sort-trigger { width: 42px; padding: 0; } }
@media (max-width: 560px) { .is-compact .sort-trigger { width: 32px; } }
</style>

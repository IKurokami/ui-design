<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import { Search } from '@lucide/vue'
import type { Chapter } from '../types'
const props = defineProps<{ chapters: Chapter[]; activeId: string }>()
const emit = defineEmits<{ select: [id: string] }>()
const query = ref('')
const list = ref<HTMLElement>()
const filtered = computed(() => props.chapters.filter(ch => `${ch.chapterNumber} ${ch.title}`.toLocaleLowerCase('vi').includes(query.value.trim().toLocaleLowerCase('vi'))))
watch(() => props.activeId, async () => {
  await nextTick()
  list.value?.querySelector('[aria-current="true"]')?.scrollIntoView?.({ block: 'nearest' })
}, { immediate: true })
</script>

<template>
  <div class="reader-chapters">
    <label v-if="chapters.length > 8" class="chapter-search"><Search :size="15" /><input v-model="query" type="search" aria-label="Tìm chương" placeholder="Tìm chương"></label>
    <nav ref="list" class="chapter-list" aria-label="Danh sách chương">
      <button v-for="chapter in filtered" :key="chapter.id" type="button" :aria-current="chapter.id === activeId ? 'true' : undefined"
        @click="emit('select', chapter.id)"><span class="chapter-number">{{ chapter.chapterNumber.toString().padStart(2, '0') }}</span><span>{{ chapter.title }}</span></button>
      <p v-if="query && !filtered.length">Không tìm thấy chương.</p>
    </nav>
  </div>
</template>

<style scoped>
.reader-chapters { display: flex; flex-direction: column; min-height: 0; height: 100%; gap: 16px; }
.chapter-search { display: flex; align-items: center; gap: 10px; background: var(--reader-tint); padding: 10px 12px; border-radius: 10px; color: var(--reader-muted); }
input { min-width: 0; width: 100%; border: 0; background: transparent; color: var(--reader-ink); font: inherit; font-size: 12px; }
input::placeholder { color: var(--reader-muted); } input:focus { outline: none; }
.chapter-search:focus-within { background: var(--reader-active); }
.chapter-list { overflow-y: auto; min-height: 0; display: flex; flex-direction: column; gap: 4px; }
button { flex-shrink: 0; display: grid; grid-template-columns: 24px 1fr; gap: 12px; text-align: left; align-items: baseline; width: 100%; border: 0; box-shadow: none; border-radius: 12px; padding: 13px 14px; color: var(--reader-muted); background: transparent; font: inherit; font-size: 12px; line-height: 1.6; cursor: pointer; overflow-wrap: anywhere; }
button:hover, button:focus-visible { color: var(--reader-ink); background: var(--reader-tint); outline: none; }
button:focus-visible { text-decoration: underline; text-underline-offset: 4px; }
button[aria-current="true"] { color: var(--reader-accent); background: var(--reader-active); font-weight: 600; }
.chapter-number { font-size: 10px; opacity: .7; font-variant-numeric: tabular-nums; }
p { font-size: 12px; padding: 12px; color: var(--reader-muted); }
</style>

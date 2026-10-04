<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowRight, BookOpen, Loader2, Search, X } from '@lucide/vue'
import type { Story } from '../types'

const props = defineProps<{ stories: Story[]; loading: boolean; error: string }>()
defineEmits<{ retry: [] }>()
const query = ref('')
const failedCovers = ref(new Set<string>())
const dateFormat = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
const weekdayFormat = new Intl.DateTimeFormat('vi-VN', { weekday: 'long' })
const timeFormat = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })

function readDate(story: Story) {
  const date = new Date(story.readingProgress?.updatedAt ?? '')
  return Number.isFinite(date.getTime()) ? date : undefined
}
const ordered = computed(() => [...props.stories].sort((a, b) =>
  (readDate(b)?.getTime() ?? 0) - (readDate(a)?.getTime() ?? 0) || a.id.localeCompare(b.id),
))
const filtered = computed(() => {
  const search = query.value.trim().toLocaleLowerCase('vi-VN')
  return ordered.value.filter(story => !search || [story.title, story.authorName, story.readingProgress?.chapterTitle]
    .some(value => value?.toLocaleLowerCase('vi-VN').includes(search)))
})
const groups = computed(() => {
  const result: { key: string; date?: Date; stories: Story[] }[] = []
  for (const story of filtered.value) {
    const date = readDate(story)
    const key = date ? dateFormat.format(date) : 'unknown'
    const last = result.at(-1)
    if (last?.key === key) last.stories.push(story)
    else result.push({ key, date, stories: [story] })
  }
  return result
})
function chapterLabel(story: Story) {
  const progress = story.readingProgress
  const number = progress?.chapterNumber ? `Chương ${progress.chapterNumber}` : ''
  const titledNumber = progress?.chapterTitle?.match(/^chương\s+(\d+)(?:\s|$|[.:—–-])/i)?.[1]
  if (titledNumber && Number(titledNumber) === progress?.chapterNumber) return progress.chapterTitle
  return [number, progress?.chapterTitle].filter(Boolean).join(' · ')
}
function destination(story: Story) {
  return { path: '/library/stories/' + encodeURIComponent(story.id), query: story.readingProgress?.chapterId ? { chapter: story.readingProgress.chapterId } : {} }
}
function coverFailed(id: string) {
  failedCovers.value = new Set([...failedCovers.value, id])
}
</script>

<template>
  <section class="reading-history" aria-labelledby="reading-title">
    <header class="reading-header">
      <div class="reading-heading">
        <h1 id="reading-title">Đang đọc</h1>
        <span v-if="!loading && !error && stories.length" class="reading-count">{{ stories.length }} truyện</span>
      </div>
      <div v-if="stories.length && !loading && !error" class="reading-search">
        <Search :size="17" aria-hidden="true" />
        <input v-model="query" type="search" placeholder="Tìm truyện, tác giả hoặc chương" aria-label="Tìm trong truyện đang đọc" />
        <button v-if="query" type="button" aria-label="Xóa tìm kiếm" @click="query = ''"><X :size="15" /></button>
      </div>
    </header>

    <div v-if="loading" class="reading-state" role="status" aria-label="Đang tải lịch sử đọc"><Loader2 :size="26" class="spin" /></div>
    <div v-else-if="error" class="reading-state" role="alert"><p>{{ error }}</p><button type="button" @click="$emit('retry')">Thử lại</button></div>
    <div v-else-if="!stories.length" class="reading-state reading-empty">
      <BookOpen :size="30" :stroke-width="1.3" aria-hidden="true" />
      <p>Bạn chưa đọc truyện nào.</p>
      <RouterLink to="/library">Chọn truyện trong thư viện<ArrowRight :size="15" /></RouterLink>
    </div>
    <div v-else-if="!filtered.length" class="reading-state"><p>Không tìm thấy truyện phù hợp.</p><button type="button" @click="query = ''">Xóa tìm kiếm</button></div>
    <div v-else class="reading-days">
      <section v-for="group in groups" :key="group.key" class="reading-day" :aria-label="group.date ? dateFormat.format(group.date) : 'Chưa có thời gian đọc'">
        <h2 class="reading-date">
          <template v-if="group.date"><span>{{ weekdayFormat.format(group.date) }}</span><time :datetime="group.date.toISOString()">{{ dateFormat.format(group.date) }}</time></template>
          <span v-else>Chưa có thời gian đọc</span>
        </h2>
        <div class="reading-entries">
          <RouterLink v-for="story in group.stories" :key="story.id" :to="destination(story)" class="reading-entry" :class="{ 'most-recent': story.id === ordered[0]?.id }" :data-story-id="story.id">
            <div class="reading-cover">
              <img v-if="story.coverUrl && !failedCovers.has(story.id)" :src="story.coverUrl" alt="" loading="lazy" @error="coverFailed(story.id)" />
              <BookOpen v-else :size="24" :stroke-width="1.2" aria-hidden="true" />
            </div>
            <div class="reading-story">
              <time v-if="readDate(story)" class="reading-time" :datetime="story.readingProgress!.updatedAt" :title="dateFormat.format(readDate(story)!)">{{ timeFormat.format(readDate(story)!) }}</time>
              <h3>{{ story.title }}</h3>
              <p v-if="story.authorName" class="reading-author">{{ story.authorName }}</p>
              <p v-if="chapterLabel(story)" class="reading-chapter">{{ chapterLabel(story) }}</p>
            </div>
            <span class="reading-continue">Đọc tiếp<ArrowRight :size="17" aria-hidden="true" /></span>
          </RouterLink>
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped>
.reading-history { max-width: 1080px; margin: 0 auto; padding: 18px 8px 28px; }
.reading-history :where(input, button, a) { border: 0; box-shadow: none; font: inherit; }
.reading-history :where(input, button, a):focus-visible { outline: 2px solid var(--library-accent); outline-offset: 5px; }
.reading-header { display: flex; align-items: center; justify-content: space-between; gap: 24px; margin-bottom: 56px; }
.reading-heading { display: flex; align-items: baseline; gap: 16px; }
.reading-heading h1 { font-family: 'Lora', Georgia, serif; font-size: clamp(30px, 3vw, 40px); font-weight: 500; letter-spacing: -.9px; }
.reading-count { color: var(--library-muted); font-size: 12px; white-space: nowrap; }
.reading-search { display: flex; align-items: center; gap: 10px; width: min(340px, 45%); padding: 12px 14px; background: #f2f4ef; border-radius: 14px; color: var(--library-muted); }
.reading-search input { background: transparent; padding: 0; width: 100%; min-width: 0; font-size: 12px; color: var(--library-ink); outline: none; }
.reading-search input::placeholder { color: var(--library-muted); }
.reading-search:focus-within { outline: 2px solid var(--library-accent); outline-offset: 3px; }
.reading-search input::-webkit-search-cancel-button { display: none; }
.reading-search button { display: grid; place-items: center; cursor: pointer; background: transparent; color: inherit; padding: 2px; }
.reading-days { display: flex; flex-direction: column; gap: 44px; }
.reading-day { display: grid; grid-template-columns: 156px minmax(0, 1fr); gap: 28px; }
.reading-date { display: flex; flex-direction: column; align-items: flex-start; gap: 7px; padding-top: 20px; font-size: 14px; font-weight: 500; font-variant-numeric: tabular-nums; }
.reading-date span { color: var(--library-muted); font-size: 11px; font-weight: 400; text-transform: capitalize; }
.reading-entries { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.reading-entry { display: flex; align-items: center; gap: 24px; padding: 18px 24px; border-radius: 20px; text-decoration: none; color: var(--library-ink); transition: background-color .18s ease; }
.reading-entry.most-recent { background: #f0f3eb; }
.reading-entry:hover { background: #e9eee4; }
.reading-cover { display: grid; place-items: center; flex: 0 0 76px; aspect-ratio: 2 / 3; overflow: hidden; border-radius: 8px; background: #e4e9de; color: var(--library-accent); }
.reading-cover img { width: 100%; height: 100%; object-fit: cover; }
.reading-story { min-width: 0; flex: 1; }
.reading-time { display: block; font-size: 11px; color: var(--library-muted); font-variant-numeric: tabular-nums; margin-bottom: 8px; }
.reading-story h3 { margin: 0; font-family: 'Lora', Georgia, serif; font-size: 21px; line-height: 1.4; font-weight: 500; overflow-wrap: anywhere; }
.reading-author { color: var(--library-muted); font-size: 11px; margin-top: 5px; }
.reading-chapter { font-size: 12px; line-height: 1.6; margin-top: 13px; color: var(--library-accent); overflow-wrap: anywhere; }
.reading-continue { display: flex; align-items: center; gap: 10px; flex-shrink: 0; font-size: 11px; color: var(--library-accent); }
.reading-state { min-height: 320px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px; text-align: center; font-size: 13px; color: var(--library-muted); }
.reading-state button, .reading-state a { display: inline-flex; align-items: center; gap: 10px; padding: 10px 16px; border-radius: 12px; background: #f0f3eb; color: var(--library-accent); text-decoration: none; cursor: pointer; }
.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }
@media (max-width: 1100px) {
  .reading-day { grid-template-columns: 124px minmax(0, 1fr); gap: 16px; }
  .reading-entry { gap: 18px; padding: 18px; }
  .reading-continue { font-size: 0; gap: 0; }
}
@media (max-width: 700px) {
  .reading-history { padding: 8px 0 24px; }
  .reading-header { flex-direction: column; align-items: stretch; gap: 22px; margin-bottom: 32px; }
  .reading-search { width: 100%; }
  .reading-days { gap: 28px; }
  .reading-day { grid-template-columns: minmax(0, 1fr); gap: 14px; }
  .reading-date { flex-direction: row; align-items: baseline; gap: 12px; padding: 0 6px; }
  .reading-entry { gap: 14px; padding: 16px 12px; border-radius: 16px; }
  .reading-cover { flex-basis: 60px; }
  .reading-story h3 { font-size: 18px; }
  .reading-chapter { margin-top: 9px; font-size: 11px; }
}
@media (prefers-reduced-motion: reduce) { .reading-entry { transition: none; }.spin { animation: none; } }
</style>

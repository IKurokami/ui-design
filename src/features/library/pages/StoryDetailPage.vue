<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMediaQuery } from '@vueuse/core'
import { ArrowLeft, ArrowRight, List, Loader2, Maximize2, Minimize2, SlidersHorizontal, X } from '@lucide/vue'
import { readerHTML, readableHTML } from '../reader-content'
import LibrarySidebar from '../components/LibrarySidebar.vue'
import ReaderChapters from '../components/ReaderChapters.vue'
import ReaderSettings from '../components/ReaderSettings.vue'
import { loadReadingSettings, normalizeReadingSettings, readingDefaults, readingFonts, saveReadingSettings, type ReadingSettings } from '../reading-settings'
import { createApiClient } from '../../../services/api-client'
import { friendlyError } from '../../../services/error-handler'
import { usePageScrollRestoration } from '../../../animations/composables/usePageScrollRestoration'
import type { ReadingProgress, Story } from '../types'
const client = createApiClient()
const route = useRoute()
const router = useRouter()
const story = ref<Story>()
const loading = ref(true)
const loadError = ref('')
const progressError = ref('')
const activeId = ref('')
const settings = ref(loadReadingSettings())
const panel = ref<'chapters' | 'settings'>('chapters')
const focused = ref(false)
const isMobile = useMediaQuery('(max-width: 1080px)')
const dialog = ref<HTMLDialogElement>()
const dialogOpen = ref(false)
const scrollArea = ref<HTMLElement>()
usePageScrollRestoration('reading', scrollArea, computed(() => !loading.value && !!activeId.value))
const chapterHeading = ref<HTMLElement>()
const chapters = computed(() => [...(story.value?.chapters ?? [])].sort((a, b) => a.chapterNumber - b.chapterNumber))
const chapterIndex = computed(() => chapters.value.findIndex(ch => ch.id === activeId.value))
const chapter = computed(() => chapters.value[chapterIndex.value])
const previous = computed(() => chapters.value[chapterIndex.value - 1])
const following = computed(() => chapters.value[chapterIndex.value + 1])
const content = computed(() => readerHTML(chapter.value?.content ?? ''))
const hasContent = computed(() => {
  const template = document.createElement('template')
  template.innerHTML = content.value
  return Boolean(template.content.textContent?.replace(/[\s\u200b-\u200f\ufeff]/g, '') || template.content.querySelector('img[src]'))
})
const readingStyle = computed(() => ({
  '--reading-font': readingFonts[settings.value.font],
  '--reading-size': `${settings.value.fontSize}px`,
  '--reading-height': String(settings.value.lineHeight),
  '--reading-width': `${settings.value.width}px`,
  '--reading-gap': `${settings.value.paragraphSpacing}em`,
  '--reading-align': settings.value.alignment,
}))
watch(settings, saveReadingSettings, { deep: true })
function changeSettings(change: Partial<ReadingSettings>) {
  settings.value = normalizeReadingSettings({ ...settings.value, ...change })
}
function resetSettings() { changeSettings({ ...readingDefaults }) }

let disposed = false
let loadVersion = 0
let controller: AbortController | undefined
let canSaveProgress = false
let saveQueue = Promise.resolve()
let saveVersion = 0
let returnFocus: HTMLElement | undefined
onBeforeUnmount(() => { disposed = true; controller?.abort() })

async function loadStory() {
  const version = ++loadVersion
  controller?.abort()
  controller = new AbortController()
  const signal = controller.signal
  const id = encodeURIComponent(String(route.params.id))
  loading.value = true
  loadError.value = ''
  progressError.value = ''
  canSaveProgress = false
  story.value = undefined
  activeId.value = ''
  const [detail, progress] = await Promise.allSettled([
    client.request<Story>(`/api/stories/${id}`, { signal }),
    client.request<ReadingProgress>(`/api/stories/${id}/reading-progress`, { signal }),
  ])
  if (disposed || version !== loadVersion) return
  loading.value = false
  if (detail.status === 'rejected') { loadError.value = friendlyError(detail.reason); return }
  story.value = detail.value
  if (progress.status === 'rejected') progressError.value = 'Không tải được chương đọc gần nhất. ' + friendlyError(progress.reason)
  else canSaveProgress = true
  const requested = typeof route.query.chapter === 'string' ? route.query.chapter : ''
  const recent = progress.status === 'fulfilled' ? progress.value.chapterId : ''
  const selected = chapters.value.find(ch => ch.id === requested)
    ?? chapters.value.find(ch => ch.id === recent)
    ?? chapters.value.find(ch => ch.chapterNumber === 1)
    ?? chapters.value[0]
  if (selected) {
    activeId.value = selected.id
    if (canSaveProgress || selected.id === requested) {
      await router.replace({ query: { ...route.query, chapter: selected.id } })
      if (disposed || version !== loadVersion) return
      saveProgress()
    }
  }
}
watch(() => route.params.id, loadStory, { immediate: true })

function saveProgress() {
  if (!story.value || !chapter.value || !readableHTML(chapter.value.content)) return
  const storyId = story.value.id
  const chapterId = chapter.value.id
  const version = ++saveVersion
  const payload = { chapterId }
  // Serialize updates so quickly switching chapters cannot persist an older chapter last.
  saveQueue = saveQueue.then(async () => {
    try {
      await client.request(`/api/stories/${encodeURIComponent(storyId)}/reading-progress`, {
        method: 'PUT', body: JSON.stringify(payload), keepalive: true,
      })
      if (!disposed && story.value?.id === storyId && version === saveVersion) {
        canSaveProgress = true
        progressError.value = ''
      }
    } catch (error) {
      if (!disposed && story.value?.id === storyId && version === saveVersion) {
        progressError.value = 'Chưa lưu được chương đọc gần nhất. ' + friendlyError(error)
      }
    }
  })
}
watch(() => route.query.chapter, async value => {
  if (loading.value || !story.value || typeof value !== 'string' || value === activeId.value) return
  const selected = chapters.value.find(ch => ch.id === value)
  if (!selected) return
  activeId.value = selected.id
  saveProgress()
  await nextTick()
})
async function selectChapter(id: string) {
  closeDialog()
  if (id === activeId.value) { saveProgress(); return }
  await router.push({ query: { ...route.query, chapter: id } })
  await nextTick()
  chapterHeading.value?.focus({ preventScroll: true })
}
async function openPanel(mode: 'chapters' | 'settings', event: Event) {
  panel.value = mode
  focused.value = false
  if (isMobile.value) {
    returnFocus = event.currentTarget as HTMLElement
    await nextTick()
    dialog.value?.showModal()
    dialogOpen.value = Boolean(dialog.value?.open)
  }
}
function closeDialog() { dialog.value?.close() }
function onDialogClose() { dialogOpen.value = false; returnFocus?.focus(); returnFocus = undefined }
watch(isMobile, () => closeDialog())
function retryProgress() {
  if (canSaveProgress) saveProgress()
  else loadStory()
}
</script>

<template>
  <div class="reader-layout" :data-theme="settings.theme" :style="readingStyle">
    <LibrarySidebar />
    <main class="reader-main">
      <header class="reader-toolbar">
        <div class="story-context">
          <RouterLink to="/library" class="back-link"><ArrowLeft :size="15" />Thư viện</RouterLink>
          <h1 v-if="story">{{ story.title }}</h1>
          <p v-if="story?.authorName" class="story-author">{{ story.authorName }}</p>
        </div>
        <div v-if="story" class="toolbar-actions">
          <button v-if="!isMobile" type="button" :aria-pressed="focused" @click="focused = !focused">
            <Minimize2 v-if="focused" :size="16" /><Maximize2 v-else :size="16" /><span>Tập trung</span>
          </button>
          <button type="button" :aria-pressed="isMobile ? undefined : !focused && panel === 'chapters'" :aria-expanded="isMobile ? dialogOpen && panel === 'chapters' : undefined"
            :aria-controls="isMobile ? 'reader-mobile-controls' : 'reader-right-panel'" @click="openPanel('chapters', $event)"><List :size="17" /><span>Chương</span></button>
          <button type="button" :aria-pressed="isMobile ? undefined : !focused && panel === 'settings'" :aria-expanded="isMobile ? dialogOpen && panel === 'settings' : undefined"
            :aria-controls="isMobile ? 'reader-mobile-controls' : 'reader-right-panel'" @click="openPanel('settings', $event)"><SlidersHorizontal :size="16" /><span>Cài đặt đọc</span></button>
        </div>
      </header>

      <div v-if="loading" class="reader-state" role="status" aria-label="Đang tải truyện"><Loader2 :size="28" class="spin" /></div>
      <div v-else-if="loadError" class="reader-state" role="alert"><p>{{ loadError }}</p><button type="button" @click="loadStory">Thử lại</button></div>
      <div v-else-if="story" class="reader-workspace" :class="{ 'is-focused': focused }">
        <div ref="scrollArea" class="reading-scroll">
          <article class="reading-article">
            <div v-if="progressError" class="progress-error" role="alert"><p>{{ progressError }}</p><button type="button" @click="retryProgress">Thử lại</button></div>
            <details v-if="story.description" class="story-description"><summary>Thông tin truyện<span v-if="story.category">{{ story.category }}</span></summary><p>{{ story.description }}</p></details>
            <template v-if="chapter">
              <h2 ref="chapterHeading" class="chapter-heading" tabindex="-1">{{ chapter.title }}</h2>
              <div v-if="hasContent" class="chapter-content" v-html="content" />
              <p v-else class="reader-empty">Chương này chưa có nội dung.</p>
              <nav class="chapter-pagination" aria-label="Chuyển chương">
                <button v-if="previous" type="button" class="previous-chapter" @click="selectChapter(previous.id)"><ArrowLeft :size="16" />Chương trước</button>
                <span>{{ chapterIndex + 1 }} / {{ chapters.length }}</span>
                <button v-if="following" type="button" class="next-chapter" @click="selectChapter(following.id)">Chương sau<ArrowRight :size="16" /></button>
              </nav>
            </template>
            <p v-else class="reader-empty">Truyện chưa có chương.</p>
          </article>
        </div>

        <aside v-if="!isMobile && !focused" id="reader-right-panel" class="reader-panel" :aria-label="panel === 'chapters' ? 'Chương' : 'Cài đặt đọc'">
          <header class="panel-heading"><h2>{{ panel === 'chapters' ? 'Chương' : 'Cài đặt đọc' }}<span v-if="panel === 'chapters'">{{ chapters.length }}</span></h2>
            <button v-if="panel === 'settings'" type="button" aria-label="Đóng cài đặt đọc" @click="panel = 'chapters'"><X :size="17" /></button>
          </header>
          <ReaderChapters v-if="panel === 'chapters'" :chapters="chapters" :active-id="activeId" @select="selectChapter" />
          <div v-else class="settings-scroll"><ReaderSettings :settings="settings" @change="changeSettings" @reset="resetSettings" /></div>
        </aside>
      </div>
    </main>

    <dialog id="reader-mobile-controls" ref="dialog" class="reader-dialog" aria-labelledby="reader-dialog-title" @close="onDialogClose" @click="event => { if (event.target === dialog) closeDialog() }">
      <section class="dialog-content">
        <header class="panel-heading"><h2 id="reader-dialog-title">{{ panel === 'chapters' ? 'Chương' : 'Cài đặt đọc' }}<span v-if="panel === 'chapters'">{{ chapters.length }}</span></h2>
          <button type="button" aria-label="Đóng bảng đọc" autofocus @click="closeDialog"><X :size="18" /></button>
        </header>
        <template v-if="isMobile">
          <ReaderChapters v-if="panel === 'chapters'" :chapters="chapters" :active-id="activeId" @select="selectChapter" />
          <div v-else class="settings-scroll"><ReaderSettings :settings="settings" @change="changeSettings" @reset="resetSettings" /></div>
        </template>
      </section>
    </dialog>
  </div>
</template>

<style scoped>
.reader-layout {
  --reader-surface: #fff; --reader-ink: #263328; --reader-muted: #7b827a; --reader-accent: #435a41;
  --reader-tint: color-mix(in oklab, var(--reader-accent) 5%, var(--reader-surface));
  --reader-active: color-mix(in oklab, var(--reader-accent) 12%, var(--reader-surface));
  --muted: var(--reader-muted); --green: var(--reader-accent); --sidebar-ink: var(--reader-ink);
  display: flex; height: 100dvh; overflow: hidden; background: var(--reader-surface); color: var(--reader-ink);
}
.reader-layout[data-theme="paper"] { --reader-surface: #f6f2e9; --reader-ink: #383c31; --reader-muted: #837e70; --reader-accent: #596446; }
.reader-layout[data-theme="dark"] { --reader-surface: #171d1a; --reader-ink: #d5ddd6; --reader-muted: #94a097; --reader-accent: #adc2a1; color-scheme: dark; }
.reader-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.reader-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 28px; padding: 30px 38px 22px; flex-shrink: 0; }
.story-context { min-width: 0; }
.back-link { display: inline-flex; align-items: center; gap: 8px; color: var(--reader-muted); font-size: 11px; text-decoration: none; margin-bottom: 12px; }
.back-link:hover { color: var(--reader-accent); }
h1 { font-family: var(--serif); font-size: clamp(18px, 2vw, 24px); font-weight: 500; line-height: 1.4; overflow-wrap: anywhere; }
.story-author { margin-top: 5px; font-size: 11px; color: var(--reader-muted); }
.toolbar-actions { display: flex; gap: 6px; flex-shrink: 0; }
button { border: 0; box-shadow: none; display: inline-flex; align-items: center; justify-content: center; gap: 8px; border-radius: 10px; padding: 10px 12px; background: transparent; color: var(--reader-muted); font: inherit; font-size: 12px; cursor: pointer; }
button:hover, button[aria-pressed="true"] { color: var(--reader-accent); background: var(--reader-tint); }
button:focus-visible, a:focus-visible, summary:focus-visible { outline: none; color: var(--reader-accent); background: var(--reader-active); text-decoration: underline; text-underline-offset: 4px; }
.reader-workspace { flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(0, 1fr) 278px; gap: 24px; padding-right: 24px; }
.reader-workspace.is-focused { grid-template-columns: minmax(0, 1fr); }
.reading-scroll { overflow-y: auto; min-width: 0; min-height: 0; overscroll-behavior: contain; }
.reading-article { max-width: calc(var(--reading-width) + 96px); margin: 0 auto; padding: 28px 48px 72px; }
.story-description { margin-bottom: 32px; color: var(--reader-muted); font-size: 12px; line-height: 1.8; }
.story-description summary { cursor: pointer; width: fit-content; border-radius: 4px; }
.story-description summary span { margin-left: 16px; }
.story-description p { white-space: pre-line; margin-top: 12px; }
.chapter-heading { font-family: var(--reading-font); font-weight: 500; font-size: clamp(24px, 2.3vw, 32px); line-height: 1.5; margin-bottom: 36px; outline: none; overflow-wrap: anywhere; }
.chapter-content { font-family: var(--reading-font); font-size: var(--reading-size); line-height: var(--reading-height); text-align: var(--reading-align); overflow-wrap: anywhere; }
.chapter-content :deep(*) { border: 0; box-shadow: none; text-shadow: none; max-width: 100%; }
.chapter-content :deep(p), .chapter-content :deep(ul), .chapter-content :deep(ol), .chapter-content :deep(blockquote) { margin: 0 0 var(--reading-gap); }
.chapter-content :deep(h1), .chapter-content :deep(h2), .chapter-content :deep(h3), .chapter-content :deep(h4) { font-family: inherit; color: inherit; line-height: 1.5; font-weight: 600; margin: 1.6em 0 .8em; }
.chapter-content :deep(img) { display: block; height: auto; margin: 1.5em auto; border-radius: 10px; }
.chapter-content :deep(a) { color: var(--reader-accent); text-decoration: underline; text-underline-offset: 4px; }
.chapter-content :deep(blockquote) { padding: 1em; background: var(--reader-tint); border-radius: 12px; }
.chapter-content :deep(pre) { white-space: pre-wrap; font-size: .85em; background: var(--reader-tint); padding: 1em; border-radius: 10px; }
.chapter-content :deep(table) { display: block; overflow-x: auto; border-collapse: collapse; }
.chapter-content :deep(td), .chapter-content :deep(th) { padding: .5em; }
.chapter-content :deep(hr) { display: none; }
.chapter-pagination { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 12px; margin-top: 56px; }
.chapter-pagination span { grid-column: 2; color: var(--reader-muted); font-size: 11px; font-variant-numeric: tabular-nums; }
.previous-chapter { grid-column: 1; justify-self: start; }.next-chapter { grid-column: 3; justify-self: end; }
.reader-panel { padding: 24px 0 32px; min-height: 0; display: flex; flex-direction: column; }
.panel-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 24px; min-height: 36px; flex-shrink: 0; padding: 0 14px; }
.panel-heading h2 { font-size: 13px; font-weight: 600; }
.panel-heading h2 span { color: var(--reader-muted); margin-left: 12px; font-size: 11px; font-weight: 400; }
.panel-heading button { padding: 8px; }
.settings-scroll { overflow-y: auto; padding: 0 14px 20px; }
.reader-state { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; padding: 32px; text-align: center; color: var(--reader-muted); }
.reader-state button, .progress-error button { background: var(--reader-tint); color: var(--reader-accent); }
.progress-error { font-size: 12px; line-height: 1.7; padding: 16px; border-radius: 12px; background: var(--reader-tint); margin-bottom: 28px; }
.progress-error button { margin-top: 8px; padding: 4px 0; text-decoration: underline; }
.reader-empty { font-size: 14px; color: var(--reader-muted); padding: 40px 0; }
.reader-dialog { position: fixed; inset: 0 0 0 auto; margin: 0; width: min(350px, calc(100% - 24px)); height: 100dvh; max-height: 100dvh; padding: 0; border: 0; box-shadow: none; background: var(--reader-surface); color: var(--reader-ink); border-radius: 20px 0 0 20px; }
.reader-dialog::backdrop { background: rgba(15, 23, 17, .3); }
.dialog-content { height: 100%; padding: 24px 12px; display: flex; flex-direction: column; }
.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }
@media (max-width: 1080px) { .reader-workspace { grid-template-columns: minmax(0, 1fr); padding-right: 0; } .reader-toolbar { padding: 24px 24px 18px; gap: 16px; } }
@media (max-width: 700px) {
  .reader-toolbar { flex-wrap: wrap; padding: 20px 18px 12px; gap: 12px; }
  .toolbar-actions { width: 100%; gap: 8px; }.toolbar-actions button { padding: 8px 10px; }
  .reading-article { padding: 24px 18px 48px; }.chapter-heading { font-size: 24px; margin-bottom: 28px; }
  .chapter-pagination { gap: 4px; }.chapter-pagination button { font-size: 11px; gap: 5px; padding: 10px 4px; }
}
@media (prefers-reduced-motion: reduce) { .spin { animation: none; } }
</style>

<style>
.page-stage-dashboard:has(.reader-layout[data-theme="dark"]) .app-brand { color: #adc2a1; }
</style>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { BookOpen, ChevronRight, LayoutTemplate, Loader2, Plus, RefreshCw } from '@lucide/vue'
import LibrarySidebar from '../../library/components/LibrarySidebar.vue'
import { createApiClient } from '../../../services/api-client'
import { friendlyError } from '../../../services/error-handler'
import type { Story } from '../../library/types'

interface EbookSummary {
  id: string
  title: string
  coverUrl?: string
  pageCount: number
  revision: number
  updatedAt?: string
}

const router = useRouter()
const client = createApiClient()
const ebooks = ref<EbookSummary[]>([])
const stories = ref<Story[]>([])
const isLoading = ref(true)
const error = ref('')

onMounted(() => { void load() })

async function load() {
  isLoading.value = true
  error.value = ''
  try {
    const [ebookResult, storyResult] = await Promise.allSettled([
      client.request<EbookSummary[]>('/api/ebooks'),
      client.request<Story[]>('/api/stories/mine'),
    ])
    if (ebookResult.status === 'fulfilled') ebooks.value = ebookResult.value
    else error.value = friendlyError(ebookResult.reason)
    if (storyResult.status === 'fulfilled') stories.value = storyResult.value
  } catch (reason) {
    error.value = friendlyError(reason)
  } finally {
    isLoading.value = false
  }
}

function createFromStory(storyId?: string) {
  router.push(storyId ? { path: '/library/ebook-editor', query: { story: storyId } } : '/library/ebook-editor')
}

function openEbook(id: string) {
  router.push('/library/ebook-editor/' + encodeURIComponent(id))
}

function formatDate(value?: string) {
  if (!value) return 'Chưa lưu'
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value))
}
</script>

<template>
  <div class="ebook-library-shell">
    <LibrarySidebar />
    <main class="ebook-library-main">
      <div class="ebook-library-actions">
        <button type="button" class="ebook-library-create" @click="createFromStory()"><Plus :size="17" />Tạo ebook</button>
      </div>

      <section class="ebook-library-section">
        <div class="ebook-library-section-title"><h2>Đã lưu</h2><button type="button" class="ebook-library-refresh" title="Tải lại" @click="load"><RefreshCw :size="16" /></button></div>
        <div v-if="isLoading" class="ebook-library-state"><Loader2 :size="26" class="spin" />Đang tải ebook…</div>
        <div v-else-if="error" class="ebook-library-state ebook-library-error"><p>{{ error }}</p><button type="button" @click="load">Thử lại</button></div>
        <div v-else-if="ebooks.length" class="ebook-design-grid">
          <button v-for="ebook in ebooks" :key="ebook.id" type="button" class="ebook-design-card" @click="openEbook(ebook.id)"><div class="ebook-design-cover"><img v-if="ebook.coverUrl" :src="ebook.coverUrl" alt="" /><div v-else class="ebook-design-cover-placeholder"><LayoutTemplate :size="34" /></div><span>{{ ebook.pageCount }} trang</span></div><strong>{{ ebook.title || 'Thiết kế không tên' }}</strong><small>Cập nhật {{ formatDate(ebook.updatedAt) }}</small></button>
        </div>
        <div v-else class="ebook-library-empty"><LayoutTemplate :size="30" /><button type="button" @click="createFromStory()"><Plus :size="16" />Tạo ebook</button></div>
      </section>

      <section class="ebook-library-section story-source-section">
        <div class="ebook-library-section-title"><h2>Truyện</h2></div>
        <div v-if="stories.length" class="ebook-source-list"><button v-for="story in stories" :key="story.id" type="button" class="ebook-source-row" @click="createFromStory(story.id)"><span class="ebook-source-cover"><img v-if="story.coverUrl" :src="story.coverUrl" alt="" /><BookOpen v-else :size="22" /></span><span class="ebook-source-copy"><strong>{{ story.title }}</strong><small>{{ story.chapterCount ?? story.chapters?.length ?? 0 }} chương{{ story.category ? ` · ${story.category}` : '' }}</small></span><ChevronRight :size="17" /></button></div>
        <div v-else class="ebook-library-empty compact"><BookOpen :size="25" /><span>Chưa có truyện</span></div>
      </section>
    </main>
  </div>
</template>

<style scoped>
.ebook-library-shell { display: flex; width: 100%; height: 100dvh; overflow: hidden; background: var(--library-surface, #fff); color: var(--library-ink, #18241c); }
.ebook-library-main { flex: 1; min-width: 0; padding: 28px clamp(20px, 5vw, 76px) 70px; overflow-y: auto; }
.ebook-library-actions { display: flex; justify-content: flex-end; max-width: 1180px; margin: 0 auto 34px; }
.ebook-library-section-title { display: flex; align-items: center; justify-content: space-between; gap: 18px; }
.ebook-library-refresh { display: grid; place-items: center; width: 34px; height: 34px; border: 0; border-radius: 10px; color: var(--library-muted, #687265); background: color-mix(in oklab, var(--library-ink) 5%, transparent); cursor: pointer; }
.ebook-library-refresh:hover { background: color-mix(in oklab, var(--library-ink) 10%, transparent); }
.ebook-library-create { display: inline-flex; align-items: center; gap: 7px; padding: 10px 15px; border: 0; border-radius: 9999px; color: var(--library-surface, #fff); background: var(--library-ink, #18241c); font-size: 12px; font-weight: 650; cursor: pointer; }
.ebook-library-create:hover { opacity: .82; }
.ebook-library-section { max-width: 1180px; margin: 0 auto 42px; }
.ebook-library-section-title { margin-bottom: 18px; }
.ebook-library-section-title h2 { margin: 0; color: var(--library-ink, #18241c); font-size: 17px; font-weight: 700; }
.ebook-design-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 22px; }
.ebook-design-card { display: flex; flex-direction: column; align-items: flex-start; min-width: 0; padding: 0; border: 0; color: #28332a; background: transparent; text-align: left; cursor: pointer; }
.ebook-design-card:hover .ebook-design-cover { transform: translateY(-3px); }
.ebook-design-cover { position: relative; display: grid; place-items: center; width: 100%; aspect-ratio: 1410 / 2250; overflow: hidden; margin-bottom: 12px; border-radius: 12px; color: #657c61; background: linear-gradient(145deg, #eef3eb, #dae7d7); transition: transform .2s ease; }
.ebook-design-cover img { width: 100%; height: 100%; object-fit: cover; }
.ebook-design-cover span { position: absolute; right: 7px; bottom: 7px; padding: 4px 6px; border-radius: 5px; color: #fff; background: #233422c7; font-size: 9px; }
.ebook-design-card strong { max-width: 100%; overflow: hidden; font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
.ebook-design-card small { margin-top: 4px; color: #798378; font-size: 10px; }
.ebook-library-state { display: flex; align-items: center; justify-content: center; gap: 9px; min-height: 220px; color: #678064; font-size: 13px; }
.ebook-library-error { flex-direction: column; color: #97443c; }
.ebook-library-error p { margin: 0; }
.ebook-library-error button, .ebook-library-empty button { display: inline-flex; align-items: center; gap: 6px; padding: 9px 13px; border: 0; border-radius: 9px; color: #fff; background: #435a41; cursor: pointer; }
.ebook-library-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; min-height: 190px; color: #7a8877; text-align: center; background: color-mix(in oklab, var(--library-ink) 3%, transparent); border-radius: 14px; }
.ebook-library-empty.compact { min-height: 90px; flex-direction: row; justify-content: flex-start; padding: 0 18px; font-size: 12px; }
.ebook-source-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 8px; }
.ebook-source-row { display: flex; align-items: center; gap: 11px; min-width: 0; padding: 9px 11px; border: 0; border-radius: 10px; color: #354335; background: color-mix(in oklab, var(--library-ink) 3%, transparent); text-align: left; cursor: pointer; }
.ebook-source-row:hover { background: color-mix(in oklab, var(--library-accent) 10%, transparent); }
.ebook-source-cover { display: grid; place-items: center; width: 35px; height: 48px; flex-shrink: 0; overflow: hidden; border-radius: 5px; color: #698266; background: #e9f0e6; }
.ebook-source-cover img { width: 100%; height: 100%; object-fit: cover; }
.ebook-source-copy { display: flex; flex: 1; flex-direction: column; gap: 3px; min-width: 0; }
.ebook-source-copy strong { overflow: hidden; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.ebook-source-copy small { color: #819080; font-size: 10px; }
.ebook-source-row > svg { color: #9aa598; }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
@media (max-width: 620px) { .ebook-library-main { padding: 24px 16px 50px; }.ebook-library-actions { margin-bottom: 28px; }.ebook-library-create { width: 100%; justify-content: center; }.ebook-design-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; } }
</style>

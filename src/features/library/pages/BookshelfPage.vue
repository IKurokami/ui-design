<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  Plus,
  Search,
  PenTool,
  Trash2,
  LayoutGrid,
  List as ListIcon,
  AlertTriangle,
  Loader2,
  X,
  CheckCircle2,
  BookOpen,
} from '@lucide/vue'
import LibrarySidebar from '../components/LibrarySidebar.vue'
import LibraryHeader from '../components/LibraryHeader.vue'
import LibrarySortMenu from '../components/LibrarySortMenu.vue'
import AmbientBackdrop from '../components/AmbientBackdrop.vue'
import { extractAmbientPalette } from '../ambient-palette'
import type { AmbientColors } from '../ambient-surface'
import { createApiClient } from '../../../services/api-client'
import { usePageScrollRestoration } from '../../../animations/composables/usePageScrollRestoration'
import { friendlyError } from '../../../services/error-handler'
import { pageMotionSettledKey } from '../../../animations/composables/page-motion-settled'
import { getBookshelfState, type BookshelfSortMode } from '../bookshelf-state'
import type { Story } from '../types'
import '../library-theme.css'

const router = useRouter()
const client = createApiClient()
const shelfState = getBookshelfState(router)
const waitForPageMotion = inject(pageMotionSettledKey, async () => {})

// State
const stories = ref<Story[]>(shelfState.stories ?? [])
const isLoading = ref(!shelfState.stories)
const loadError = ref('')
const scrollArea = ref<HTMLElement>()
usePageScrollRestoration('main', scrollArea, computed(() => !isLoading.value && !loadError.value))
const searchQuery = ref(shelfState.searchQuery)
const statusFilter = ref(shelfState.statusFilter)
const sortBy = ref<BookshelfSortMode>(shelfState.sortBy)
const sortOptions: { value: BookshelfSortMode; label: string }[] = [
  { value: 'updated', label: 'Mới cập nhật' },
  { value: 'created', label: 'Mới tạo' },
  { value: 'chapters', label: 'Nhiều chương' },
  { value: 'title', label: 'Tên A–Z' },
]
const viewMode = ref(shelfState.viewMode)
watch([stories, searchQuery, statusFilter, sortBy, viewMode], () => {
  Object.assign(shelfState, { stories: stories.value, searchQuery: searchQuery.value,
    statusFilter: statusFilter.value, sortBy: sortBy.value, viewMode: viewMode.value })
}, { flush: 'sync' })

// Modal xóa truyện
const deleteModal = reactive({
  isOpen: false,
  story: null as Story | null,
  isDeleting: false,
})

// Toast notification
const toast = reactive({
  show: false,
  message: '',
  type: 'success' as 'success' | 'error',
  timer: null as ReturnType<typeof setTimeout> | null,
})

function showToast(message: string, type: 'success' | 'error' = 'success') {
  if (toast.timer) clearTimeout(toast.timer)
  toast.message = message
  toast.type = type
  toast.show = true
  toast.timer = setTimeout(() => {
    toast.show = false
  }, 3200)
}

async function fetchMyStories() {
  const refreshing = !!shelfState.stories
  isLoading.value = !refreshing
  loadError.value = ''
  try {
    const fetched = await client.request<Story[]>('/api/stories/mine')
    if (refreshing) await waitForPageMotion(scrollArea.value)
    if (disposed) return
    stories.value = fetched
    shelfState.stories = fetched
  } catch (error) {
    if (disposed) return
    if (refreshing) showToast(friendlyError(error), 'error')
    else loadError.value = friendlyError(error)
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  fetchMyStories()
})

const publishedStoriesCount = computed(() => {
  return stories.value.filter(s => s.status === 'published' || !s.status).length
})
const draftStoriesCount = computed(() => {
  return stories.value.filter(s => s.status === 'draft').length
})

// Lọc & Tìm kiếm
const filteredStories = computed(() => {
  let list = [...stories.value]

  if (statusFilter.value !== 'all') {
    list = list.filter(s => {
      const status = s.status || 'published'
      return status === statusFilter.value
    })
  }

  const q = searchQuery.value.toLowerCase().trim()
  if (q) {
    list = list.filter(s => {
      const titleMatch = s.title.toLowerCase().includes(q)
      const catMatch = (s.category || '').toLowerCase().includes(q)
      const tagsMatch = (s.tags || '').toLowerCase().includes(q)
      const descMatch = (s.description || '').toLowerCase().includes(q)
      return titleMatch || catMatch || tagsMatch || descMatch
    })
  }

  list.sort((a, b) => {
    if (sortBy.value === 'updated') {
      const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime()
      const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime()
      return timeB - timeA
    }
    if (sortBy.value === 'created') {
      const timeA = new Date(a.createdAt || 0).getTime()
      const timeB = new Date(b.createdAt || 0).getTime()
      return timeB - timeA
    }
    if (sortBy.value === 'chapters') {
      const chA = chapterCount(a)
      const chB = chapterCount(b)
      return chB - chA
    }
    if (sortBy.value === 'title') {
      return a.title.localeCompare(b.title, 'vi')
    }
    return 0
  })

  return list
})

const completedStoriesCount = computed(() => stories.value.filter(story => story.status === 'completed').length)
const statusOptions = computed(() => [
  { value: 'all' as const, label: 'Tất cả', count: stories.value.length },
  { value: 'published' as const, label: 'Đang ra', count: publishedStoriesCount.value },
  { value: 'draft' as const, label: 'Bản nháp', count: draftStoriesCount.value },
  { value: 'completed' as const, label: 'Hoàn thành', count: completedStoriesCount.value },
])
function statusLabel(story: Story) {
  return story.status === 'draft' ? 'Bản nháp' : story.status === 'completed' ? 'Hoàn thành' : 'Đang ra'
}
function chapterCount(story: Story) {
  return story.chapterCount ?? story.chapters?.length ?? 0
}
const ambient = ref<InstanceType<typeof AmbientBackdrop>>()
const paletteCache = new WeakMap<HTMLElement, AmbientColors>()
let disposed = false
onBeforeUnmount(() => {
  disposed = true
  if (toast.timer) clearTimeout(toast.timer)
})
async function onStoryHover(event: Event) {
  const element = event.currentTarget as HTMLElement
  const bounds = element.getBoundingClientRect()
  let colors = paletteCache.get(element)
  if (!colors) {
    const images = [...element.querySelectorAll('img')]
    await Promise.all(images.map(image => image.complete && image.naturalWidth
      ? Promise.resolve() : image.decode?.().catch(() => {})))
    if (disposed) return
    colors = extractAmbientPalette(images)
    if (colors) paletteCache.set(element, colors)
  }
  if (!disposed) ambient.value?.spawn(colors ?? ['#79a5a0', '#b4a0d0', '#e1b486'], { x: bounds.left + bounds.width / 2 })
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat('vi-VN').format(num)
}

// Điều hướng
function goToCreateStory() {
  router.push('/library/editor')
}

function goToEditStory(storyId: string) {
  const selected = stories.value.find(story => story.id === storyId)
  if (selected) {
    try {
      sessionStorage.setItem('moc:editor-motion', JSON.stringify({
        id: selected.id, userId: selected.userId, title: selected.title,
        coverUrl: selected.coverUrl || '', category: selected.category || '',
        tags: selected.tags || '', status: selected.status || 'published',
      }))
    } catch { /* sessionStorage is optional */ }
  }
  router.push(`/library/editor/${storyId}`)
}

// Xử lý Xóa truyện
function openDeleteModal(story: Story) {
  deleteModal.story = story
  deleteModal.isOpen = true
}

function closeDeleteModal() {
  if (deleteModal.isDeleting) return
  deleteModal.isOpen = false
  deleteModal.story = null
  deleteModal.isDeleting = false
}

async function confirmDeleteStory() {
  if (!deleteModal.story || deleteModal.isDeleting) return

  deleteModal.isDeleting = true
  const storyId = deleteModal.story.id
  const storyTitle = deleteModal.story.title

  try {
    await client.request(`/api/stories/${storyId}`, {
      method: 'DELETE',
    })

    stories.value = stories.value.filter(s => s.id !== storyId)
    showToast(`Đã xóa "${storyTitle}"`)
    deleteModal.isDeleting = false
    closeDeleteModal()
  } catch (error) {
    showToast(friendlyError(error), 'error')
  } finally {
    deleteModal.isDeleting = false
  }
}
</script>

<template>
  <div class="library-layout bookshelf-layout" data-motion-scope="stories">
    <LibrarySidebar />
    <main class="bookshelf-main">
      <AmbientBackdrop ref="ambient" />
      <div ref="scrollArea" class="bookshelf-scroll-area">
        <div class="bookshelf-container">
          <header class="bookshelf-header">
            <LibraryHeader title="Tủ sách của tôi" :result-count="filteredStories.length" />
            <button type="button" class="btn-primary-action btn-create-story" @click="goToCreateStory">
              <Plus :size="16" aria-hidden="true" /> Đăng truyện
            </button>
          </header>
          <div class="bookshelf-toolbar">
            <div class="search-mode-row">
              <div class="search-box-wrap">
                <Search :size="18" class="search-icon" aria-hidden="true" />
                <input v-model="searchQuery" type="search" class="bookshelf-search-input" aria-label="Tìm tác phẩm" placeholder="Tìm truyện…" @keydown.esc="searchQuery = ''" />
                <button v-if="searchQuery" type="button" class="btn-clear-search" aria-label="Xóa tìm kiếm" @click="searchQuery = ''"><X :size="15" /></button>
              </div>
              <LibrarySortMenu v-model="sortBy" :options="sortOptions" />
              <div class="view-mode-toggle" role="group" aria-label="Kiểu hiển thị">
                <button type="button" class="btn-view-toggle" :class="{ active: viewMode === 'grid' }" :aria-pressed="viewMode === 'grid'" aria-label="Dạng bìa" title="Dạng bìa" @click="viewMode = 'grid'"><LayoutGrid :size="17" /><span>Bìa sách</span></button>
                <button type="button" class="btn-view-toggle" :class="{ active: viewMode === 'table' }" :aria-pressed="viewMode === 'table'" aria-label="Dạng danh sách" title="Dạng danh sách" @click="viewMode = 'table'"><ListIcon :size="17" /><span>Danh sách</span></button>
              </div>
            </div>
            <div class="status-pills-list" role="group" aria-label="Trạng thái tác phẩm">
              <button v-for="option in statusOptions" :key="option.value" type="button" class="status-pill-btn" :class="{ active: statusFilter === option.value }" :aria-pressed="statusFilter === option.value" @click="statusFilter = option.value">{{ option.label }} ({{ option.count }})</button>
            </div>
          </div>
          <div v-if="isLoading" class="bookshelf-loading-wrap" role="status" aria-label="Đang tải tác phẩm"><Loader2 :size="28" class="spin" /></div>
          <div v-else-if="loadError" class="bookshelf-empty-card" role="alert"><p>{{ loadError }}</p><button type="button" class="btn-reset-filters" @click="fetchMyStories">Thử lại</button></div>
          <div v-else-if="filteredStories.length === 0" class="bookshelf-empty-card">
            <BookOpen :size="32" :stroke-width="1.5" aria-hidden="true" />
            <h2>{{ searchQuery || statusFilter !== 'all' ? 'Không tìm thấy tác phẩm' : 'Chưa có tác phẩm' }}</h2>
            <button v-if="!searchQuery && statusFilter === 'all'" type="button" class="btn-primary-action" @click="goToCreateStory"><Plus :size="16" /> Đăng truyện</button>
            <button v-else type="button" class="btn-reset-filters" @click="searchQuery = ''; statusFilter = 'all'">Đặt lại bộ lọc</button>
          </div>
          <div v-else-if="viewMode === 'grid'" class="books-grid-layout">
            <article v-for="story in filteredStories" :key="story.id" class="book-story-card">
              <button type="button" class="book-open" :aria-label="'Soạn thảo ' + story.title" @click="goToEditStory(story.id)" @mouseenter="onStoryHover" @focus="onStoryHover">
                <div class="book-cover" v-if="story.coverUrl" :data-motion-key="'cover:' + story.id"><img :src="story.coverUrl" alt="" loading="lazy" /></div><div v-else class="book-cover"><BookOpen :size="38" :stroke-width="1.2" aria-hidden="true" /></div>
                <h2 class="card-title">{{ story.title }}</h2>
                <div class="card-meta-line"><span v-if="story.category">{{ story.category }}</span><span v-if="story.category" aria-hidden="true">·</span><span>{{ formatNumber(chapterCount(story)) }} chương</span></div>
              </button>
              <div class="card-footer">
                <span class="story-status-tag" :class="'status-' + (story.status || 'published')">{{ statusLabel(story) }}</span>
                <div class="card-actions">
                  <button type="button" class="btn-card-edit" :aria-label="'Soạn thảo ' + story.title" title="Soạn thảo" @click="goToEditStory(story.id)"><PenTool :size="14" /></button>
                  <button type="button" class="btn-card-delete" :aria-label="'Xóa ' + story.title" title="Xóa truyện" @click="openDeleteModal(story)"><Trash2 :size="14" /></button>
                </div>
              </div>
            </article>
          </div>
          <div v-else class="books-table-card">
            <table class="bookshelf-table" aria-label="Danh sách tác phẩm">
              <thead><tr><th scope="col">Tác phẩm</th><th scope="col" class="col-category">Thể loại</th><th scope="col">Trạng thái</th><th scope="col" class="col-chapters">Chương</th><th scope="col" class="col-actions"><span class="sr-only">Thao tác</span></th></tr></thead>
              <tbody>
                <tr v-for="story in filteredStories" :key="story.id">
                  <td><button type="button" class="table-story-link" @click="goToEditStory(story.id)" @mouseenter="onStoryHover" @focus="onStoryHover"><span v-if="story.coverUrl" class="table-cover-motion" :data-motion-key="'cover:' + story.id"><img :src="story.coverUrl" alt="" loading="lazy" /></span><span v-else class="table-cover-placeholder"><BookOpen :size="20" aria-hidden="true" /></span><span class="table-story-title">{{ story.title }}</span></button></td>
                  <td class="col-category">{{ story.category || '—' }}</td>
                  <td><span class="story-status-tag" :class="'status-' + (story.status || 'published')">{{ statusLabel(story) }}</span></td>
                  <td class="col-chapters">{{ formatNumber(chapterCount(story)) }}</td>
                  <td class="col-actions"><div class="card-actions"><button type="button" class="btn-card-edit" :aria-label="'Soạn thảo ' + story.title" title="Soạn thảo" @click="goToEditStory(story.id)"><PenTool :size="14" /></button><button type="button" class="btn-card-delete" :aria-label="'Xóa ' + story.title" title="Xóa truyện" @click="openDeleteModal(story)"><Trash2 :size="14" /></button></div></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
    <div v-if="deleteModal.isOpen && deleteModal.story" class="delete-modal-overlay" @click.self="closeDeleteModal" @keydown.esc="closeDeleteModal">
      <div class="delete-modal-box" role="dialog" aria-modal="true" aria-labelledby="delete-story-title">
        <div class="modal-icon-header"><AlertTriangle :size="24" aria-hidden="true" /><button type="button" class="btn-modal-close" aria-label="Đóng" @click="closeDeleteModal"><X :size="18" /></button></div>
        <h2 id="delete-story-title">Xóa tác phẩm?</h2>
        <p><strong class="highlight-story-title">{{ deleteModal.story.title }}</strong> cùng toàn bộ chương sẽ bị xóa vĩnh viễn.</p>
        <div class="modal-actions-footer">
          <button type="button" class="btn-modal-cancel" :disabled="deleteModal.isDeleting" @click="closeDeleteModal">Hủy</button>
          <button type="button" class="btn-modal-delete" :disabled="deleteModal.isDeleting" @click="confirmDeleteStory"><Loader2 v-if="deleteModal.isDeleting" :size="15" class="spin" /><Trash2 v-else :size="15" /> {{ deleteModal.isDeleting ? 'Đang xóa…' : 'Xóa tác phẩm' }}</button>
        </div>
      </div>
    </div>
    <div v-if="toast.show" class="toast-notification" :class="'toast-' + toast.type" role="status"><CheckCircle2 v-if="toast.type === 'success'" :size="16" /><AlertTriangle v-else :size="16" />{{ toast.message }}</div>
  </div>
</template>

<style scoped>
.bookshelf-layout { --control-surface: color-mix(in oklab, var(--library-accent) 6%, transparent); position: relative; isolation: isolate; display: flex; width: 100%; height: 100dvh; overflow: hidden; background: var(--library-surface); color: var(--library-ink); }
.bookshelf-main { --ambient-bottom-offset: 10px; position: relative; isolation: isolate; flex: 1; min-width: 0; height: calc(100dvh - 20px); margin: 10px 12px 10px 0; border-radius: 28px; overflow: hidden; }
.bookshelf-scroll-area { position: relative; z-index: 1; height: 100%; overflow-y: auto; padding: 30px 38px 48px; }
.bookshelf-container { width: 100%; max-width: 1400px; margin: 0 auto; }
.bookshelf-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.bookshelf-header :deep(.library-header) { min-width: 0; }
.bookshelf-toolbar { display: flex; flex-direction: column; gap: 18px; margin-bottom: 30px; }
.search-mode-row { display: flex; align-items: center; gap: 14px; }
button, input { font: inherit; border: 0; box-shadow: none; }
button { cursor: pointer; }
button:focus-visible { outline: none; background: color-mix(in oklab, var(--library-accent) 25%, transparent); color: var(--library-ink); }
.search-box-wrap { display: flex; align-items: center; flex: 1; min-width: 0; gap: 12px; height: 48px; padding: 0 16px; border-radius: 14px; background: var(--control-surface); }
.search-box-wrap:focus-within { background: color-mix(in oklab, var(--library-accent) 12%, transparent); }
.search-icon { color: var(--library-accent); flex-shrink: 0; }
.bookshelf-search-input { flex: 1; width: 100%; min-width: 0; height: 100%; padding: 0; outline: none; background: transparent; color: var(--library-ink); font-size: 13px; }
.bookshelf-search-input::placeholder { color: var(--library-muted); }
.bookshelf-search-input::-webkit-search-cancel-button { display: none; }
.btn-clear-search, .btn-modal-close { display: grid; place-items: center; flex-shrink: 0; width: 28px; height: 28px; padding: 0; border-radius: 8px; background: transparent; color: var(--library-muted); }
.view-mode-toggle { display: flex; flex-shrink: 0; gap: 3px; }
.btn-view-toggle { display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 38px; padding: 0 13px; border-radius: 10px; background: transparent; color: var(--library-muted); font-size: 12px; }
.btn-view-toggle.active, .status-pill-btn.active { background: color-mix(in oklab, var(--library-accent) 16%, transparent); color: var(--library-accent); font-weight: 650; }
.status-pills-list { display: flex; flex-wrap: wrap; gap: 8px; }
.status-pill-btn { min-height: 34px; padding: 7px 12px; border-radius: 10px; background: var(--control-surface); color: var(--library-muted); font-size: 11px; line-height: 18px; }
.status-pill-btn:hover { background: color-mix(in oklab, var(--library-accent) 12%, transparent); color: var(--library-accent); }
.btn-primary-action { display: inline-flex; flex-shrink: 0; align-items: center; justify-content: center; gap: 8px; min-height: 40px; padding: 10px 15px; border-radius: 12px; background: var(--library-accent); color: #fff; font-size: 12px; font-weight: 600; }
.btn-primary-action:hover { background: color-mix(in oklab, var(--library-accent) 90%, #18241c); }
.books-grid-layout { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); column-gap: 28px; row-gap: 36px; padding-bottom: 60px; }
.book-story-card { display: flex; flex-direction: column; align-items: center; min-width: 0; padding: 12px 10px 18px; background: transparent; }
.book-open { display: flex; flex-direction: column; align-items: center; width: 100%; min-width: 0; padding: 0; border-radius: 16px; background: transparent; color: inherit; }
.book-cover { display: grid; place-items: center; width: 170px; max-width: 100%; aspect-ratio: 17 / 22; overflow: hidden; border-radius: 16px; margin-bottom: 23px; background: var(--control-surface); color: var(--library-accent); transition: transform .25s ease; }
.book-cover img { display: block; width: 100%; height: 100%; object-fit: cover; }
.book-open:hover .book-cover, .book-open:focus-visible .book-cover { transform: translateY(-5px); }
.card-title { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; margin: 0 0 7px; font-size: 14px; font-weight: 600; line-height: 1.5; text-align: center; }
.card-meta-line { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 6px; color: var(--library-muted); font-size: 11px; line-height: 1.6; }
.card-footer { display: flex; align-items: center; justify-content: center; gap: 12px; margin-top: 9px; }
.story-status-tag { font-size: 11px; line-height: 1.5; color: var(--library-accent); white-space: nowrap; }
.status-draft { color: var(--library-muted); }
.card-actions { display: flex; align-items: center; gap: 2px; }
.btn-card-edit, .btn-card-delete { display: grid; place-items: center; width: 30px; height: 30px; padding: 0; border-radius: 8px; background: transparent; color: var(--library-muted); }
.btn-card-edit:hover { background: var(--control-surface); color: var(--library-accent); }
.btn-card-delete:hover { background: #aa4b3f12; color: #aa4b3f; }
.books-table-card { width: 100%; padding-bottom: 60px; }
.bookshelf-table { width: 100%; border-collapse: collapse; text-align: left; }
.bookshelf-table th { padding: 8px 12px 16px; font-size: 11px; font-weight: 500; color: var(--library-muted); }
.bookshelf-table td { padding: 14px 12px; font-size: 12px; color: var(--library-muted); }
.bookshelf-table tbody tr:hover { background: var(--control-surface); }
.table-story-link { display: flex; align-items: center; gap: 18px; width: 100%; padding: 0; border-radius: 8px; background: transparent; color: var(--library-ink); text-align: left; }
.table-cover-motion, .table-cover-placeholder { display: grid; place-items: center; width: 44px; height: 62px; flex-shrink: 0; overflow: hidden; border-radius: 6px; background: var(--control-surface); }
.table-cover-motion img { display: block; width: 100%; height: 100%; object-fit: cover; }
.table-story-title { font-size: 14px; font-weight: 600; line-height: 1.5; }
.col-chapters { text-align: right; font-variant-numeric: tabular-nums; }
.col-actions .card-actions { justify-content: flex-end; }
.bookshelf-loading-wrap, .bookshelf-empty-card { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px; min-height: 320px; text-align: center; color: var(--library-accent); }
.bookshelf-empty-card h2 { margin: 0; font-size: 16px; font-weight: 600; color: var(--library-ink); }
.btn-reset-filters { padding: 10px 14px; border-radius: 10px; background: var(--control-surface); color: var(--library-accent); font-size: 12px; }
.delete-modal-overlay { position: fixed; inset: 0; z-index: 100; display: grid; place-items: center; padding: 24px; background: #18241c40; backdrop-filter: blur(8px); }
.delete-modal-box { width: 100%; max-width: 400px; padding: 28px; border-radius: 24px; background: var(--library-surface); }
.modal-icon-header { display: flex; justify-content: space-between; align-items: center; color: #aa4b3f; }
.delete-modal-box h2 { margin: 20px 0 10px; font-size: 22px; font-weight: 600; letter-spacing: -.5px; }
.delete-modal-box p { margin: 0; font-size: 13px; line-height: 1.7; color: var(--library-muted); }
.highlight-story-title { font-weight: 600; color: var(--library-ink); }
.modal-actions-footer { display: flex; justify-content: flex-end; gap: 8px; margin-top: 24px; }
.btn-modal-cancel, .btn-modal-delete { display: inline-flex; align-items: center; gap: 8px; min-height: 40px; padding: 10px 14px; border-radius: 10px; font-size: 12px; }
.btn-modal-cancel { background: var(--control-surface); color: var(--library-ink); }
.btn-modal-delete { background: #aa4b3f; color: #fff; }
button:disabled { opacity: .55; cursor: wait; }
.toast-notification { position: fixed; bottom: 28px; left: 50%; z-index: 110; display: flex; align-items: center; gap: 10px; max-width: calc(100% - 32px); padding: 14px 18px; border-radius: 12px; background: var(--library-accent); color: #fff; font-size: 13px; transform: translateX(-50%); }
.toast-error { background: #aa4b3f; }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
@media (max-width: 1000px) { .btn-view-toggle span { display: none; } .btn-view-toggle { padding-inline: 10px; } .search-mode-row { gap: 8px; } }
@media (max-width: 768px) {
  .bookshelf-main { --ambient-bottom-offset: 8px; height: calc(100dvh - 16px); margin: 8px 8px 8px 0; border-radius: 20px; }
  .bookshelf-scroll-area { padding: 20px 16px; }
  .books-grid-layout { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 24px 16px; }
  .col-category { display: none; }
}
@media (max-width: 560px) {
  .bookshelf-header { flex-wrap: wrap; gap: 0; padding-bottom: 22px; }
  .bookshelf-header :deep(.library-header) { width: 100%; padding-bottom: 14px; }
  .search-mode-row { flex-wrap: wrap; }
  .search-box-wrap { flex-basis: 100%; }
  .view-mode-toggle { margin-left: auto; }
  .status-pills-list { gap: 6px; }
  .status-pill-btn { padding-inline: 9px; font-size: 10px; }
  .books-grid-layout { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 22px 12px; }
  .book-story-card { padding: 8px 0 12px; }
  .book-cover { width: 100%; border-radius: 12px; margin-bottom: 14px; }
  .card-title { font-size: 13px; }
  .card-meta-line { font-size: 10px; gap: 4px; }
  .card-footer { flex-wrap: wrap; gap: 3px 8px; }
  .bookshelf-table th, .bookshelf-table td { padding-inline: 5px; }
  .table-story-link { gap: 9px; }
  .table-story-link img, .table-cover-placeholder { width: 32px; height: 46px; }
  .table-story-title { font-size: 12px; }
  .col-chapters { display: none; }
  .bookshelf-table .story-status-tag { font-size: 10px; white-space: normal; }
}
@media (prefers-reduced-motion: reduce) { .book-cover { transition: none; } .book-open:hover .book-cover, .book-open:focus-visible .book-cover { transform: none; } .spin { animation: none; } }
</style>

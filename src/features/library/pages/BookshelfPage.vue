<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  BookOpen,
  Plus,
  Search,
  PenTool,
  Trash2,
  Layers,
  Sparkles,
  LayoutGrid,
  List as ListIcon,
  AlertTriangle,
  Loader2,
  X,
  FileText,
  Clock,
  CheckCircle2,
} from '@lucide/vue'
import LibrarySidebar from '../components/LibrarySidebar.vue'
import { createApiClient } from '../../../services/api-client'
import type { Story } from '../types'
import '../library-theme.css'

const router = useRouter()
const client = createApiClient()

// State
const stories = ref<Story[]>([])
const isLoading = ref(true)
const searchQuery = ref('')
const statusFilter = ref<'all' | 'published' | 'draft' | 'completed'>('all')
const sortBy = ref<'updated' | 'created' | 'chapters' | 'title'>('updated')
const viewMode = ref<'grid' | 'table'>('grid')

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
  timer: null as any,
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

// Lấy danh sách truyện từ Backend API (Tủ sách của tôi)
async function fetchMyStories() {
  isLoading.value = true
  try {
    const res = await client.request<Story[]>('/api/stories/mine')
    if (Array.isArray(res)) {
      stories.value = res
    } else {
      // Fallback nếu gọi /api/stories?mine=true
      const fallback = await client.request<Story[]>('/api/stories?mine=true')
      stories.value = Array.isArray(fallback) ? fallback : []
    }
  } catch (err: any) {
    // Nếu chưa đăng nhập hoặc lỗi, thử gọi /api/stories
    try {
      const fallback = await client.request<Story[]>('/api/stories?mine=true')
      stories.value = Array.isArray(fallback) ? fallback : []
    } catch {
      stories.value = []
    }
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  fetchMyStories()
})

// Thống kê nhanh
const totalStories = computed(() => stories.value.length)
const totalChapters = computed(() => {
  return stories.value.reduce((acc, s) => {
    return acc + (s.chapterCount || s.chapters?.length || 0)
  }, 0)
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

  // Lọc theo trạng thái
  if (statusFilter.value !== 'all') {
    list = list.filter(s => {
      const status = s.status || 'published'
      return status === statusFilter.value
    })
  }

  // Lọc theo tìm kiếm
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

  // Sắp xếp
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
      const chA = a.chapterCount || a.chapters?.length || 0
      const chB = b.chapterCount || b.chapters?.length || 0
      return chB - chA
    }
    if (sortBy.value === 'title') {
      return a.title.localeCompare(b.title, 'vi')
    }
    return 0
  })

  return list
})

// Điều hướng
function goToCreateStory() {
  router.push('/library/editor')
}

function goToEditStory(storyId: string) {
  router.push(`/library/editor/${storyId}`)
}

// Xử lý Xóa truyện
function openDeleteModal(story: Story) {
  deleteModal.story = story
  deleteModal.isOpen = true
}

function closeDeleteModal() {
  deleteModal.isOpen = false
  deleteModal.story = null
  deleteModal.isDeleting = false
}

async function confirmDeleteStory() {
  if (!deleteModal.story) return

  deleteModal.isDeleting = true
  const storyId = deleteModal.story.id
  const storyTitle = deleteModal.story.title

  try {
    await client.request(`/api/stories/${storyId}`, {
      method: 'DELETE',
    })

    // Xóa khỏi danh sách trên UI
    stories.value = stories.value.filter(s => s.id !== storyId)
    showToast(`Đã xóa bộ truyện "${storyTitle}" thành công!`)
    closeDeleteModal()
  } catch (err: any) {
    showToast(err.message || 'Lỗi khi xóa bộ truyện', 'error')
  } finally {
    deleteModal.isDeleting = false
  }
}

// Format ngày tháng thân thiện
function formatDate(dateStr?: string) {
  if (!dateStr) return 'Vừa xong'
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return dateStr

  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMinutes < 1) return 'Vừa xong'
  if (diffMinutes < 60) return `${diffMinutes} phút trước`
  if (diffHours < 24) return `${diffHours} giờ trước`
  if (diffDays < 7) return `${diffDays} ngày trước`

  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}
</script>

<template>
  <div class="library-layout bookshelf-layout">
    <!-- Sidebar ứng dụng -->
    <LibrarySidebar />

    <!-- Main Content Area -->
    <main class="bookshelf-main">
      <div class="bookshelf-scroll-area">
        <div class="bookshelf-container">
          <!-- Top Header: Title & Action -->
          <header class="bookshelf-header">
            <div class="header-text-group">
              <div class="header-badge">
                <BookOpen :size="14" />
                <span>Tủ sách tác giả</span>
              </div>
              <h1 class="bookshelf-title">Tủ sách của tôi</h1>
              <p class="bookshelf-subtitle">
                Quản lý toàn bộ các tác phẩm và chương truyện bạn đã sáng tác trên nền tảng Mộc.
              </p>
            </div>

            <div class="header-action-group">
              <button
                type="button"
                class="btn-primary-action btn-create-story"
                @click="goToCreateStory"
              >
                <Plus :size="16" />
                <span>Đăng truyện mới</span>
              </button>
            </div>
          </header>

          <!-- Quick Stats Counter Cards -->
          <div class="stats-overview-grid">
            <div class="stat-card">
              <div class="stat-icon-box stat-primary">
                <BookOpen :size="20" />
              </div>
              <div class="stat-info">
                <span class="stat-label">Tổng tác phẩm</span>
                <span class="stat-value">{{ totalStories }}</span>
              </div>
            </div>

            <div class="stat-card">
              <div class="stat-icon-box stat-chapters">
                <Layers :size="20" />
              </div>
              <div class="stat-info">
                <span class="stat-label">Tổng số chương</span>
                <span class="stat-value">{{ totalChapters }}</span>
              </div>
            </div>

            <div class="stat-card">
              <div class="stat-icon-box stat-published">
                <Sparkles :size="20" />
              </div>
              <div class="stat-info">
                <span class="stat-label">Đang phát hành</span>
                <span class="stat-value">{{ publishedStoriesCount }}</span>
              </div>
            </div>

            <div class="stat-card">
              <div class="stat-icon-box stat-draft">
                <FileText :size="20" />
              </div>
              <div class="stat-info">
                <span class="stat-label">Bản nháp</span>
                <span class="stat-value">{{ draftStoriesCount }}</span>
              </div>
            </div>
          </div>

          <!-- Filter & Search Toolbar -->
          <div class="bookshelf-toolbar">
            <div class="search-box-wrap">
              <Search :size="16" class="search-icon" />
              <input
                v-model="searchQuery"
                type="text"
                class="bookshelf-search-input"
                placeholder="Tìm kiếm tác phẩm theo tên, thể loại, tag..."
              />
              <button
                v-if="searchQuery"
                type="button"
                class="btn-clear-search"
                title="Xóa tìm kiếm"
                @click="searchQuery = ''"
              >
                <X :size="14" />
              </button>
            </div>

            <div class="filter-controls-wrap">
              <!-- Filter by status -->
              <div class="status-pills-list">
                <button
                  type="button"
                  class="status-pill-btn"
                  :class="{ active: statusFilter === 'all' }"
                  @click="statusFilter = 'all'"
                >
                  Tất cả ({{ stories.length }})
                </button>
                <button
                  type="button"
                  class="status-pill-btn"
                  :class="{ active: statusFilter === 'published' }"
                  @click="statusFilter = 'published'"
                >
                  Đang ra ({{ publishedStoriesCount }})
                </button>
                <button
                  type="button"
                  class="status-pill-btn"
                  :class="{ active: statusFilter === 'draft' }"
                  @click="statusFilter = 'draft'"
                >
                  Bản nháp ({{ draftStoriesCount }})
                </button>
              </div>

              <!-- Sắp xếp & Chế độ xem -->
              <div class="toolbar-right-actions">
                <select v-model="sortBy" class="bookshelf-select-sort">
                  <option value="updated">Mới cập nhật</option>
                  <option value="created">Mới tạo nhất</option>
                  <option value="chapters">Nhiều chương nhất</option>
                  <option value="title">Tên truyện A - Z</option>
                </select>

                <div class="view-mode-toggle">
                  <button
                    type="button"
                    class="btn-view-toggle"
                    :class="{ active: viewMode === 'grid' }"
                    title="Dạng lưới thẻ"
                    @click="viewMode = 'grid'"
                  >
                    <LayoutGrid :size="16" />
                  </button>
                  <button
                    type="button"
                    class="btn-view-toggle"
                    :class="{ active: viewMode === 'table' }"
                    title="Dạng danh sách"
                    @click="viewMode = 'table'"
                  >
                    <ListIcon :size="16" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Loading State -->
          <div v-if="isLoading" class="bookshelf-loading-wrap">
            <Loader2 :size="32" class="spin" />
            <span>Đang tải danh sách tác phẩm từ tủ sách...</span>
          </div>

          <!-- Empty State: Chưa có truyện nào hoặc không tìm thấy kết quả -->
          <div
            v-else-if="filteredStories.length === 0"
            class="bookshelf-empty-card"
          >
            <div class="empty-icon-wrap">
              <BookOpen :size="48" :stroke-width="1.2" />
            </div>
            <h3 class="empty-title">
              {{ searchQuery || statusFilter !== 'all' ? 'Không tìm thấy tác phẩm phù hợp' : 'Tủ sách của bạn còn trống' }}
            </h3>
            <p class="empty-desc">
              {{ searchQuery || statusFilter !== 'all'
                ? 'Hãy thử điều chỉnh từ khóa tìm kiếm hoặc chọn bộ lọc trạng thái khác.'
                : 'Mỗi cuốn sách tuyệt vời đều khởi đầu từ một dòng chữ. Hãy sáng tác bộ truyện đầu tiên của bạn ngay hôm nay!'
              }}
            </p>
            <button
              v-if="!searchQuery && statusFilter === 'all'"
              type="button"
              class="btn-primary-action btn-empty-cta"
              @click="goToCreateStory"
            >
              <Plus :size="16" />
              <span>Bắt đầu viết tác phẩm đầu tiên</span>
            </button>
            <button
              v-else
              type="button"
              class="btn-outline-clear"
              @click="searchQuery = ''; statusFilter = 'all'"
            >
              Đặt lại bộ lọc
            </button>
          </div>

          <!-- GRID VIEW: Danh sách dạng thẻ sách 3D -->
          <div
            v-else-if="viewMode === 'grid'"
            class="books-grid-layout"
          >
            <article
              v-for="story in filteredStories"
              :key="story.id"
              class="book-story-card"
            >
              <!-- Bìa truyện kiểu cuốn sách -->
              <div
                class="book-cover-wrapper"
                role="button"
                tabindex="0"
                title="Nhấp để soạn thảo tác phẩm"
                @click="goToEditStory(story.id)"
              >
                <div class="book-spine-effect" />
                <img
                  v-if="story.coverUrl"
                  :src="story.coverUrl"
                  :alt="story.title"
                  class="book-cover-img"
                  loading="lazy"
                />
                <div v-else class="book-cover-fallback">
                  <span class="cover-letter">{{ story.title.charAt(0).toUpperCase() }}</span>
                  <span class="cover-subtext">{{ story.category || 'Mộc' }}</span>
                </div>

                <!-- Status Badge -->
                <span
                  class="story-status-tag"
                  :class="`status-${story.status || 'published'}`"
                >
                  {{ (story.status === 'draft') ? 'Bản nháp' : (story.status === 'completed') ? 'Hoàn thành' : 'Đang ra' }}
                </span>
              </div>

              <!-- Nội dung & Thông tin truyện -->
              <div class="book-card-body">
                <div class="book-meta-top">
                  <span class="category-chip">{{ story.category || 'Tiên Hiệp' }}</span>
                  <span class="chapter-count-chip">
                    <Layers :size="12" />
                    <span>{{ story.chapterCount || story.chapters?.length || 1 }} chương</span>
                  </span>
                </div>

                <h2
                  class="book-title"
                  role="button"
                  tabindex="0"
                  title="Soạn thảo truyện"
                  @click="goToEditStory(story.id)"
                >
                  {{ story.title }}
                </h2>

                <p class="book-synopsis">
                  {{ story.description || 'Chưa có tóm tắt giới thiệu cho bộ truyện này.' }}
                </p>

                <!-- Footer thông tin ngày cập nhật & nút thao tác -->
                <div class="book-card-footer">
                  <div class="update-time" title="Thời gian cập nhật gần nhất">
                    <Clock :size="12" />
                    <span>{{ formatDate(story.updatedAt || story.createdAt) }}</span>
                  </div>

                  <div class="card-action-buttons">
                    <button
                      type="button"
                      class="btn-card-edit"
                      title="Soạn thảo & Viết tiếp"
                      @click="goToEditStory(story.id)"
                    >
                      <PenTool :size="13" />
                      <span>Soạn thảo</span>
                    </button>
                    <button
                      type="button"
                      class="btn-card-delete"
                      title="Xóa bộ truyện này"
                      @click="openDeleteModal(story)"
                    >
                      <Trash2 :size="14" />
                    </button>
                  </div>
                </div>
              </div>
            </article>
          </div>

          <!-- TABLE VIEW: Danh sách hàng ngang chi tiết -->
          <div
            v-else-if="viewMode === 'table'"
            class="books-table-card"
          >
            <table class="bookshelf-table">
              <thead>
                <tr>
                  <th class="col-cover">Bìa</th>
                  <th class="col-title">Tên tác phẩm</th>
                  <th class="col-category">Thể loại</th>
                  <th class="col-status">Trạng thái</th>
                  <th class="col-chapters">Số chương</th>
                  <th class="col-updated">Cập nhật</th>
                  <th class="col-actions">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="story in filteredStories"
                  :key="story.id"
                  class="table-row-item"
                >
                  <td class="col-cover">
                    <div
                      class="table-thumb"
                      role="button"
                      tabindex="0"
                      @click="goToEditStory(story.id)"
                    >
                      <img
                        v-if="story.coverUrl"
                        :src="story.coverUrl"
                        :alt="story.title"
                      />
                      <div v-else class="thumb-placeholder">
                        {{ story.title.charAt(0).toUpperCase() }}
                      </div>
                    </div>
                  </td>
                  <td class="col-title">
                    <div
                      class="table-title-group"
                      role="button"
                      tabindex="0"
                      @click="goToEditStory(story.id)"
                    >
                      <span class="table-story-title">{{ story.title }}</span>
                      <span v-if="story.tags" class="table-story-tags">{{ story.tags }}</span>
                    </div>
                  </td>
                  <td class="col-category">
                    <span class="category-chip">{{ story.category || 'Tiên Hiệp' }}</span>
                  </td>
                  <td class="col-status">
                    <span
                      class="story-status-tag"
                      :class="`status-${story.status || 'published'}`"
                    >
                      {{ (story.status === 'draft') ? 'Bản nháp' : (story.status === 'completed') ? 'Hoàn thành' : 'Đang ra' }}
                    </span>
                  </td>
                  <td class="col-chapters">
                    <span class="table-ch-count">{{ story.chapterCount || story.chapters?.length || 1 }}</span>
                  </td>
                  <td class="col-updated">
                    <span class="table-date">{{ formatDate(story.updatedAt || story.createdAt) }}</span>
                  </td>
                  <td class="col-actions">
                    <div class="table-action-group">
                      <button
                        type="button"
                        class="btn-row-action btn-edit"
                        title="Soạn thảo & Thêm chương"
                        @click="goToEditStory(story.id)"
                      >
                        <PenTool :size="13" />
                        <span>Sửa</span>
                      </button>
                      <button
                        type="button"
                        class="btn-row-action btn-delete"
                        title="Xóa truyện"
                        @click="openDeleteModal(story)"
                      >
                        <Trash2 :size="14" />
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>

    <!-- Modal Xác nhận Xóa Truyện an toàn -->
    <div
      v-if="deleteModal.isOpen && deleteModal.story"
      class="delete-modal-overlay"
      @click.self="closeDeleteModal"
    >
      <div class="delete-modal-box">
        <div class="modal-icon-header">
          <div class="alert-icon-circle">
            <AlertTriangle :size="24" />
          </div>
          <button
            type="button"
            class="btn-modal-close"
            title="Đóng"
            @click="closeDeleteModal"
          >
            <X :size="16" />
          </button>
        </div>

        <h3 class="modal-title">Xác nhận xóa bộ truyện?</h3>
        <p class="modal-desc">
          Bạn sắp xóa vĩnh viễn bộ truyện
          <strong class="highlight-story-title">"{{ deleteModal.story.title }}"</strong>.
          Toàn bộ nội dung chương, ảnh minh họa và dữ liệu liên quan sẽ bị gỡ bỏ khỏi hệ thống.
        </p>

        <div class="modal-actions-footer">
          <button
            type="button"
            class="btn-modal-cancel"
            :disabled="deleteModal.isDeleting"
            @click="closeDeleteModal"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            class="btn-modal-delete"
            :disabled="deleteModal.isDeleting"
            @click="confirmDeleteStory"
          >
            <Loader2 v-if="deleteModal.isDeleting" :size="15" class="spin" />
            <Trash2 v-else :size="15" />
            <span>{{ deleteModal.isDeleting ? 'Đang xóa...' : 'Xác nhận xóa' }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Toast Thông báo -->
    <div
      v-if="toast.show"
      class="toast-notification"
      :class="`toast-${toast.type}`"
    >
      <CheckCircle2 v-if="toast.type === 'success'" :size="16" />
      <AlertTriangle v-else :size="16" />
      <span>{{ toast.message }}</span>
    </div>
  </div>
</template>

<style scoped>
.bookshelf-layout {
  display: flex;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background-color: var(--library-bg, #f6f5ef);
  color: var(--library-ink, #18241c);
  font-family: var(--sans, 'Be Vietnam Pro', sans-serif);
}

.bookshelf-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  position: relative;
}

.bookshelf-scroll-area {
  flex: 1;
  overflow-y: auto;
  padding: 32px 40px 96px;
}

.bookshelf-container {
  max-width: 1140px;
  margin: 0 auto;
  width: 100%;
}

/* Header */
.bookshelf-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 28px;
}

.header-text-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.header-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  font-weight: 600;
  color: #3b7c38;
  background-color: rgba(59, 124, 56, 0.08);
  padding: 4px 10px;
  border-radius: 9999px;
  width: fit-content;
}

.bookshelf-title {
  font-size: clamp(26px, 3vw, 34px);
  font-weight: 700;
  color: var(--library-ink);
  letter-spacing: -0.6px;
  margin: 0;
  line-height: 1.25;
}

.bookshelf-subtitle {
  font-size: 14.5px;
  color: var(--library-muted, #5f6c5e);
  margin: 0;
  line-height: 1.5;
}

.btn-primary-action {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border-radius: 9999px;
  background-color: var(--library-ink, #18241c);
  color: var(--library-surface, #ffffff);
  border: 0;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(24, 36, 28, 0.16);
  transition: all 0.18s ease;
  white-space: nowrap;
}

.btn-primary-action:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 18px rgba(24, 36, 28, 0.22);
  opacity: 0.95;
}

/* Stats Overview Grid */
.stats-overview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 32px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 20px;
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(24, 36, 28, 0.08);
  border-radius: 16px;
  transition: all 0.2s ease;
}

.stat-card:hover {
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.04);
  transform: translateY(-1px);
}

.stat-icon-box {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stat-primary {
  background-color: rgba(59, 124, 56, 0.12);
  color: #2e7d32;
}

.stat-chapters {
  background-color: rgba(43, 91, 143, 0.12);
  color: #1e5c99;
}

.stat-published {
  background-color: rgba(133, 73, 186, 0.12);
  color: #7b32bf;
}

.stat-draft {
  background-color: rgba(199, 119, 14, 0.12);
  color: #b36400;
}

.stat-info {
  display: flex;
  flex-direction: column;
}

.stat-label {
  font-size: 12.5px;
  color: var(--library-muted);
  font-weight: 500;
}

.stat-value {
  font-size: 22px;
  font-weight: 700;
  color: var(--library-ink);
  line-height: 1.2;
}

/* Toolbar */
.bookshelf-toolbar {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-bottom: 24px;
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(24, 36, 28, 0.07);
  padding: 14px 18px;
  border-radius: 16px;
}

.search-box-wrap {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
}

.search-icon {
  position: absolute;
  left: 14px;
  color: var(--library-muted);
  pointer-events: none;
}

.bookshelf-search-input {
  width: 100%;
  padding: 10px 38px 10px 40px;
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(24, 36, 28, 0.1);
  border-radius: 9999px;
  font-size: 13.5px;
  color: var(--library-ink);
  outline: none;
  transition: all 0.15s ease;
}

.bookshelf-search-input:focus {
  border-color: #3b7c38;
  background: #ffffff;
  box-shadow: 0 0 0 3px rgba(59, 124, 56, 0.12);
}

.btn-clear-search {
  position: absolute;
  right: 12px;
  background: transparent;
  border: 0;
  color: var(--library-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.filter-controls-wrap {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.status-pills-list {
  display: flex;
  align-items: center;
  gap: 6px;
  overflow-x: auto;
}

.status-pill-btn {
  padding: 6px 14px;
  border-radius: 9999px;
  font-size: 12.5px;
  font-weight: 500;
  border: 1px solid rgba(24, 36, 28, 0.1);
  background: transparent;
  color: var(--library-muted);
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.status-pill-btn:hover {
  background: rgba(24, 36, 28, 0.05);
  color: var(--library-ink);
}

.status-pill-btn.active {
  background-color: var(--library-ink);
  color: #ffffff;
  border-color: var(--library-ink);
  font-weight: 600;
}

.toolbar-right-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.bookshelf-select-sort {
  padding: 6px 14px;
  border-radius: 9999px;
  border: 1px solid rgba(24, 36, 28, 0.12);
  background-color: rgba(255, 255, 255, 0.9);
  color: var(--library-ink);
  font-size: 12.5px;
  font-weight: 500;
  outline: none;
  cursor: pointer;
}

.view-mode-toggle {
  display: flex;
  align-items: center;
  background: rgba(24, 36, 28, 0.06);
  border-radius: 8px;
  padding: 3px;
  gap: 2px;
}

.btn-view-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 0;
  background: transparent;
  color: var(--library-muted);
  cursor: pointer;
  transition: all 0.15s;
}

.btn-view-toggle.active {
  background: #ffffff;
  color: var(--library-ink);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

/* Loading State */
.bookshelf-loading-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  gap: 16px;
  color: var(--library-muted);
  font-size: 14px;
}

/* Empty State */
.bookshelf-empty-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 32px;
  text-align: center;
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(12px);
  border: 1px dashed rgba(24, 36, 28, 0.18);
  border-radius: 20px;
  margin-top: 10px;
}

.empty-icon-wrap {
  color: #3b7c38;
  margin-bottom: 16px;
  opacity: 0.85;
}

.empty-title {
  font-size: 19px;
  font-weight: 700;
  color: var(--library-ink);
  margin: 0 0 8px 0;
}

.empty-desc {
  font-size: 14px;
  color: var(--library-muted);
  max-width: 440px;
  margin: 0 0 24px 0;
  line-height: 1.6;
}

.btn-empty-cta {
  padding: 11px 24px;
  font-size: 14.5px;
}

.btn-outline-clear {
  padding: 8px 18px;
  border-radius: 9999px;
  border: 1px solid rgba(24, 36, 28, 0.2);
  background: transparent;
  color: var(--library-ink);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}

/* GRID VIEW */
.books-grid-layout {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 24px;
}

.book-story-card {
  display: flex;
  flex-direction: column;
  background: #ffffff;
  border: 1px solid rgba(24, 36, 28, 0.08);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
  transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}

.book-story-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.08);
  border-color: rgba(59, 124, 56, 0.25);
}

.book-cover-wrapper {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 10;
  background: #e9ece6;
  overflow: hidden;
  cursor: pointer;
}

.book-spine-effect {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  width: 8px;
  background: linear-gradient(to right, rgba(0, 0, 0, 0.25), transparent);
  z-index: 2;
  pointer-events: none;
}

.book-cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.book-cover-wrapper:hover .book-cover-img {
  transform: scale(1.04);
}

.book-cover-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #274726 0%, #152414 100%);
  color: #ffffff;
  gap: 4px;
}

.cover-letter {
  font-size: 42px;
  font-weight: 800;
  letter-spacing: -1px;
}

.cover-subtext {
  font-size: 11px;
  letter-spacing: 2px;
  text-transform: uppercase;
  opacity: 0.75;
}

.story-status-tag {
  position: absolute;
  top: 10px;
  right: 10px;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 9999px;
  backdrop-filter: blur(8px);
  z-index: 3;
}

.status-published {
  background-color: rgba(46, 125, 50, 0.88);
  color: #ffffff;
}

.status-draft {
  background-color: rgba(217, 119, 6, 0.88);
  color: #ffffff;
}

.status-completed {
  background-color: rgba(124, 58, 237, 0.88);
  color: #ffffff;
}

.book-card-body {
  padding: 16px;
  display: flex;
  flex-direction: column;
  flex: 1;
}

.book-meta-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.category-chip {
  font-size: 11.5px;
  font-weight: 600;
  color: #2e7d32;
  background: rgba(46, 125, 50, 0.08);
  padding: 2px 8px;
  border-radius: 4px;
}

.chapter-count-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--library-muted);
}

.book-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--library-ink);
  line-height: 1.35;
  margin: 0 0 6px 0;
  cursor: pointer;
  transition: color 0.15s;
}

.book-title:hover {
  color: #2e7d32;
}

.book-synopsis {
  font-size: 13px;
  color: var(--library-muted);
  line-height: 1.5;
  margin: 0 0 16px 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  flex: 1;
}

.book-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid rgba(24, 36, 28, 0.06);
}

.update-time {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11.5px;
  color: var(--library-muted);
}

.card-action-buttons {
  display: flex;
  align-items: center;
  gap: 6px;
}

.btn-card-edit {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  border-radius: 6px;
  background: rgba(46, 125, 50, 0.1);
  color: #2e7d32;
  border: 0;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-card-edit:hover {
  background: rgba(46, 125, 50, 0.18);
}

.btn-card-delete {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: transparent;
  color: #a33838;
  border: 0;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-card-delete:hover {
  background: rgba(163, 56, 56, 0.1);
}

/* TABLE VIEW */
.books-table-card {
  background: #ffffff;
  border: 1px solid rgba(24, 36, 28, 0.08);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.03);
}

.bookshelf-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

.bookshelf-table th {
  padding: 12px 16px;
  font-size: 12px;
  font-weight: 600;
  color: var(--library-muted);
  border-bottom: 1px solid rgba(24, 36, 28, 0.08);
  background: rgba(24, 36, 28, 0.02);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.bookshelf-table td {
  padding: 14px 16px;
  font-size: 13.5px;
  border-bottom: 1px solid rgba(24, 36, 28, 0.05);
  vertical-align: middle;
}

.table-row-item:hover {
  background-color: rgba(24, 36, 28, 0.02);
}

.col-cover {
  width: 60px;
}

.table-thumb {
  width: 44px;
  height: 58px;
  border-radius: 6px;
  overflow: hidden;
  background: #e3e7e0;
  cursor: pointer;
}

.table-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.thumb-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #274726;
  color: #fff;
  font-weight: 700;
}

.col-title {
  max-width: 320px;
}

.table-title-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
  cursor: pointer;
}

.table-story-title {
  font-weight: 600;
  color: var(--library-ink);
  transition: color 0.15s;
}

.table-story-title:hover {
  color: #2e7d32;
}

.table-story-tags {
  font-size: 11.5px;
  color: var(--library-muted);
}

.table-ch-count {
  font-weight: 600;
  color: var(--library-ink);
}

.table-date {
  color: var(--library-muted);
  font-size: 12.5px;
}

.table-action-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.btn-row-action {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12.5px;
  font-weight: 500;
  border: 0;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-row-action.btn-edit {
  background: rgba(46, 125, 50, 0.08);
  color: #2e7d32;
}

.btn-row-action.btn-edit:hover {
  background: rgba(46, 125, 50, 0.16);
}

.btn-row-action.btn-delete {
  background: transparent;
  color: #a33838;
  padding: 6px;
}

.btn-row-action.btn-delete:hover {
  background: rgba(163, 56, 56, 0.1);
}

/* Modal Xóa */
.delete-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(4px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.delete-modal-box {
  background: #ffffff;
  border-radius: 20px;
  max-width: 440px;
  width: 100%;
  padding: 24px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
  animation: modalPop 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes modalPop {
  from { transform: scale(0.95); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.modal-icon-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.alert-icon-circle {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: rgba(199, 43, 43, 0.1);
  color: #c72b2b;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-modal-close {
  background: transparent;
  border: 0;
  color: var(--library-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 50%;
}

.modal-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--library-ink);
  margin: 0 0 8px 0;
}

.modal-desc {
  font-size: 14px;
  color: var(--library-muted);
  line-height: 1.55;
  margin: 0 0 24px 0;
}

.highlight-story-title {
  color: var(--library-ink);
}

.modal-actions-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}

.btn-modal-cancel {
  padding: 9px 18px;
  border-radius: 9999px;
  border: 1px solid rgba(24, 36, 28, 0.15);
  background: transparent;
  color: var(--library-ink);
  font-size: 13.5px;
  font-weight: 500;
  cursor: pointer;
}

.btn-modal-delete {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 20px;
  border-radius: 9999px;
  border: 0;
  background: #c72b2b;
  color: #ffffff;
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
}

.btn-modal-delete:disabled,
.btn-modal-cancel:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Toast Notification */
.toast-notification {
  position: fixed;
  bottom: 28px;
  right: 28px;
  z-index: 1100;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 18px;
  border-radius: 12px;
  font-size: 13.5px;
  font-weight: 500;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.16);
  animation: toastSlide 0.25s ease;
}

@keyframes toastSlide {
  from { transform: translateY(16px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

.toast-success {
  background: #18241c;
  color: #ffffff;
}

.toast-error {
  background: #c72b2b;
  color: #ffffff;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Responsive */
@media (max-width: 768px) {
  .bookshelf-scroll-area {
    padding: 20px 16px 80px;
  }
  .bookshelf-header {
    flex-direction: column;
  }
  .stats-overview-grid {
    grid-template-columns: 1fr 1fr;
  }
}
</style>

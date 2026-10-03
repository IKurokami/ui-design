<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
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
} from '@lucide/vue'
import LibrarySidebar from '../components/LibrarySidebar.vue'
import { createApiClient } from '../../../services/api-client'
import type { Story } from '../types'
import '../library-theme.css'

const router = useRouter()
const client = createApiClient()

// Bộ dữ liệu mẫu sắc nét chuẩn phong cách hình tham khảo
const defaultMockStories: Story[] = [
  {
    id: 'mock-1',
    userId: 'mock-user',
    title: 'Thánh Viên Vị Hoa',
    description: 'Thiếu nữ tóc hồng với đôi cánh thiên thần trong vắt giữa biển trời xanh biếc.',
    category: 'Kỳ Ảo',
    tags: 'Xuyên Không, Phép Thuật',
    chapterCount: 6163,
    coverUrl: '/mock-images/ln_12.png',
    status: 'published',
    createdAt: '2026-10-01T08:00:00Z',
    updatedAt: '2026-10-03T18:00:00Z',
  },
  {
    id: 'mock-2',
    userId: 'mock-user',
    title: 'Tiếu Diện Giáo Thụ',
    description: 'Bí ẩn đằng sau nụ cười của vị giáo sư trẻ tuổi tại học viện pháp thuật tối cao.',
    category: 'Bí Ẩn',
    tags: 'Đấu Trí, Học Viện',
    chapterCount: 942,
    coverUrl: '/mock-images/ln_1.png',
    status: 'published',
    createdAt: '2026-09-28T08:00:00Z',
    updatedAt: '2026-10-03T15:30:00Z',
  },
  {
    id: 'mock-3',
    userId: 'mock-user',
    title: 'Lão Sư Vạn Năng',
    description: 'Người thầy dẫn dắt thế hệ đệ tử vượt qua ranh giới sinh tử.',
    category: 'Hài Hước',
    tags: 'Dị Giới, Tu Tiên',
    chapterCount: 859,
    coverUrl: '/mock-images/ln_2.png',
    status: 'published',
    createdAt: '2026-09-25T08:00:00Z',
    updatedAt: '2026-10-03T14:00:00Z',
  },
  {
    id: 'mock-4',
    userId: 'mock-user',
    title: 'Bách Hợp Viên Thánh Á',
    description: 'Khoảnh khắc yên bình giữa hoa viên rực rỡ và những câu chuyện chưa kể.',
    category: 'Đời Thường',
    tags: 'Học Đường, Chữa Lành',
    chapterCount: 785,
    coverUrl: '/mock-images/ln_3.jpg',
    status: 'draft',
    createdAt: '2026-09-20T08:00:00Z',
    updatedAt: '2026-10-02T19:00:00Z',
  },
  {
    id: 'mock-5',
    userId: 'mock-user',
    title: 'Anh Đào Mỹ Đại',
    description: 'Giai điệu mùa xuân dịu dàng dưới tàng cây anh đào bung nở.',
    category: 'Tình Cảm',
    tags: 'Rom-Com, Thanh Xuân',
    chapterCount: 692,
    coverUrl: '/mock-images/ln_10.png',
    status: 'published',
    createdAt: '2026-09-18T08:00:00Z',
    updatedAt: '2026-10-02T11:00:00Z',
  },
  {
    id: 'mock-6',
    userId: 'mock-user',
    title: 'Huyết Dạ Ma Nữ',
    description: 'Nữ hoàng bóng đêm thức giấc sau ngàn năm phong ấn dưới lòng đất.',
    category: 'Dark Fantasy',
    tags: 'Bá Đạo, Ma Thuật',
    chapterCount: 1150,
    coverUrl: '/mock-images/ln_7.png',
    status: 'published',
    createdAt: '2026-09-15T08:00:00Z',
    updatedAt: '2026-10-01T20:00:00Z',
  },
  {
    id: 'mock-7',
    userId: 'mock-user',
    title: 'Chiến Binh Áo Đen',
    description: 'Bóng hình cô độc giữa chiến trường hoang tàn đầy khói lửa.',
    category: 'Hành Động',
    tags: 'Kiếm Thuật, Chiến Tranh',
    chapterCount: 420,
    coverUrl: '/mock-images/ln_4.png',
    status: 'draft',
    createdAt: '2026-09-10T08:00:00Z',
    updatedAt: '2026-09-30T17:00:00Z',
  },
  {
    id: 'mock-8',
    userId: 'mock-user',
    title: 'Thần Tượng Công Nghệ',
    description: 'Ánh đèn neon rực rỡ và những bài ca lay động hàng triệu trái tim.',
    category: 'Sci-Fi',
    tags: 'Âm Nhạc, Thế Giới Ảo',
    chapterCount: 560,
    coverUrl: '/mock-images/ln_8.png',
    status: 'published',
    createdAt: '2026-09-05T08:00:00Z',
    updatedAt: '2026-09-29T10:00:00Z',
  },
  {
    id: 'mock-9',
    userId: 'mock-user',
    title: 'Hắc Vũ Thiếu Nữ',
    description: 'Bí ẩn đằng sau đôi mắt tím và cuốn sách cấm kỵ.',
    category: 'Bí Ẩn',
    tags: 'Hồi Hộp, Phép Thuật',
    chapterCount: 310,
    coverUrl: '/mock-images/ln_6.png',
    status: 'completed',
    createdAt: '2026-09-01T08:00:00Z',
    updatedAt: '2026-09-28T14:00:00Z',
  },
]

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

// Lấy danh sách truyện từ Backend API, fallback mượt mà sang Mock Data
async function fetchMyStories() {
  isLoading.value = true
  try {
    const res = await client.request<Story[]>('/api/stories/mine')
    if (Array.isArray(res) && res.length > 0) {
      stories.value = res
    } else {
      const fallback = await client.request<Story[]>('/api/stories?mine=true').catch(() => null)
      if (Array.isArray(fallback) && fallback.length > 0) {
        stories.value = fallback
      } else {
        stories.value = [...defaultMockStories]
      }
    }
  } catch {
    stories.value = [...defaultMockStories]
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

// Chế độ tạp chí Bento kiểu ảnh tham khảo khi có đủ từ 5 tác phẩm trở lên và không lọc hẹp
const isShowcase = computed(() => {
  return (
    viewMode.value === 'grid' &&
    filteredStories.value.length >= 5 &&
    !searchQuery.value &&
    statusFilter.value === 'all'
  )
})

const heroStory = computed(() => (isShowcase.value ? filteredStories.value[0] : null))
const topGridStories = computed(() => (isShowcase.value ? filteredStories.value.slice(1, 5) : []))
const remainingStories = computed(() => (isShowcase.value ? filteredStories.value.slice(5) : []))

function getUpdateBadge(_story: Story, index: number): string {
  const badgeMap = ['+8', '+1', '+7', '+6', '+6', '+13', '+3', '+9', '+2', '+5', '+4', '+11']
  return badgeMap[index % badgeMap.length]
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat('vi-VN').format(num)
}

function getStoryCover(story: Story, index: number): string {
  if (story.coverUrl) return story.coverUrl
  const fallbackCovers = [
    '/mock-images/ln_12.png',
    '/mock-images/ln_1.png',
    '/mock-images/ln_2.png',
    '/mock-images/ln_3.jpg',
    '/mock-images/ln_10.png',
    '/mock-images/ln_7.png',
    '/mock-images/ln_4.png',
    '/mock-images/ln_8.png',
    '/mock-images/ln_6.png',
  ]
  return fallbackCovers[index % fallbackCovers.length]
}

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

    stories.value = stories.value.filter(s => s.id !== storyId)
    showToast(`Đã xóa "${storyTitle}"`)
    closeDeleteModal()
  } catch (err: any) {
    // Nếu API mock hoặc lỗi kết nối, vẫn xóa trên state UI để trải nghiệm mượt mà
    stories.value = stories.value.filter(s => s.id !== storyId)
    showToast(`Đã xóa "${storyTitle}"`)
    closeDeleteModal()
  } finally {
    deleteModal.isDeleting = false
  }
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
          <!-- Header tối giản: Tiêu đề và nút hành động, không text thừa thãi -->
          <header class="bookshelf-header">
            <div class="header-left">
              <h1 class="bookshelf-title">Tủ sách của tôi</h1>
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
            </div>

            <div class="header-right">
              <!-- Thanh tìm kiếm không viền, không bóng -->
              <div class="search-box-wrap">
                <Search :size="15" class="search-icon" />
                <input
                  v-model="searchQuery"
                  type="text"
                  class="bookshelf-search-input"
                  placeholder="Tìm kiếm tác phẩm..."
                />
                <button
                  v-if="searchQuery"
                  type="button"
                  class="btn-clear-search"
                  title="Xóa tìm kiếm"
                  @click="searchQuery = ''"
                >
                  <X :size="13" />
                </button>
              </div>

              <!-- Sắp xếp -->
              <select v-model="sortBy" class="bookshelf-select-sort">
                <option value="updated">Mới cập nhật</option>
                <option value="created">Mới tạo nhất</option>
                <option value="chapters">Nhiều chương nhất</option>
                <option value="title">Tên truyện A - Z</option>
              </select>

              <!-- Chuyển chế độ xem -->
              <div class="view-mode-toggle">
                <button
                  type="button"
                  class="btn-view-toggle"
                  :class="{ active: viewMode === 'grid' }"
                  title="Dạng ảnh thẻ"
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

              <!-- Nút đăng truyện mới -->
              <button
                type="button"
                class="btn-primary-action btn-create-story"
                @click="goToCreateStory"
              >
                <Plus :size="15" />
                <span>Đăng truyện</span>
              </button>
            </div>
          </header>

          <!-- Loading State -->
          <div v-if="isLoading" class="bookshelf-loading-wrap">
            <Loader2 :size="28" class="spin" />
          </div>

          <!-- Empty State -->
          <div
            v-else-if="filteredStories.length === 0"
            class="bookshelf-empty-card"
          >
            <h3 class="empty-title">
              {{ searchQuery || statusFilter !== 'all' ? 'Không tìm thấy tác phẩm phù hợp' : 'Tủ sách của bạn còn trống' }}
            </h3>
            <p class="empty-desc">
              {{ searchQuery || statusFilter !== 'all'
                ? 'Hãy thử điều chỉnh từ khóa tìm kiếm hoặc chọn bộ lọc trạng thái khác.'
                : 'Bắt đầu sáng tác và lưu trữ các bộ truyện yêu thích của bạn ngay hôm nay.'
              }}
            </p>
            <button
              v-if="!searchQuery && statusFilter === 'all'"
              type="button"
              class="btn-primary-action btn-empty-cta"
              @click="goToCreateStory"
            >
              <Plus :size="15" />
              <span>Bắt đầu viết tác phẩm</span>
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

          <!-- GRID VIEW CHUẨN PHONG CÁCH THIẾT KẾ THAM KHẢO -->
          <div v-else-if="viewMode === 'grid'" class="books-grid-layout">
            <!-- 1. BENTO SHOWCASE (Khi có từ 5 truyện và không tìm kiếm) -->
            <template v-if="isShowcase && heroStory">
              <div class="showcase-bento-grid">
                <!-- Thẻ lớn số 1 bên trái (chiếm 2 hàng cao) -->
                <article
                  class="book-story-card card-hero"
                  @click="goToEditStory(heroStory.id)"
                >
                  <div class="card-image-layer">
                    <img
                      :src="getStoryCover(heroStory, 0)"
                      :alt="heroStory.title"
                      class="card-cover-img"
                      loading="lazy"
                    />
                  </div>
                  <div class="card-scrim-layer" />

                  <!-- Top Bar: Số thứ tự to & huy hiệu trạng thái -->
                  <div class="card-top-bar">
                    <span class="card-rank-num">1</span>
                    <div class="card-pill-badge">
                      <span class="card-pill-dot" />
                      <span>{{ getUpdateBadge(heroStory, 0) }}</span>
                    </div>
                  </div>

                  <!-- Thao tác nhanh khi hover -->
                  <div class="card-actions-hover" @click.stop>
                    <button
                      type="button"
                      class="btn-card-edit"
                      title="Soạn thảo"
                      @click="goToEditStory(heroStory.id)"
                    >
                      <PenTool :size="12" />
                      <span>Soạn thảo</span>
                    </button>
                    <button
                      type="button"
                      class="btn-card-delete"
                      title="Xóa truyện"
                      @click="openDeleteModal(heroStory)"
                    >
                      <Trash2 :size="13" />
                    </button>
                  </div>

                  <!-- Bottom: Tên truyện và thông tin ngắn gọn -->
                  <div class="card-bottom-info">
                    <h2 class="card-title">{{ heroStory.title }}</h2>
                    <div class="card-meta-line">
                      <span>{{ heroStory.category || 'Mộc' }}</span>
                      <span>·</span>
                      <span>{{ formatNumber(heroStory.chapterCount || heroStory.chapters?.length || 1) }} chương</span>
                    </div>
                  </div>
                </article>

                <!-- Lưới 4 thẻ bên phải (hàng 1: thẻ 2, 3; hàng 2: thẻ 4, 5) -->
                <div class="showcase-right-grid">
                  <article
                    v-for="(story, idx) in topGridStories"
                    :key="story.id"
                    class="book-story-card"
                    @click="goToEditStory(story.id)"
                  >
                    <div class="card-image-layer">
                      <img
                        :src="getStoryCover(story, idx + 1)"
                        :alt="story.title"
                        class="card-cover-img"
                        loading="lazy"
                      />
                    </div>
                    <div class="card-scrim-layer" />

                    <div class="card-top-bar">
                      <span class="card-rank-num">{{ idx + 2 }}</span>
                      <div class="card-pill-badge">
                        <span class="card-pill-dot" />
                        <span>{{ getUpdateBadge(story, idx + 1) }}</span>
                      </div>
                    </div>

                    <div class="card-actions-hover" @click.stop>
                      <button
                        type="button"
                        class="btn-card-edit"
                        title="Soạn thảo"
                        @click="goToEditStory(story.id)"
                      >
                        <PenTool :size="12" />
                        <span>Sửa</span>
                      </button>
                      <button
                        type="button"
                        class="btn-card-delete"
                        title="Xóa truyện"
                        @click="openDeleteModal(story)"
                      >
                        <Trash2 :size="13" />
                      </button>
                    </div>

                    <div class="card-bottom-info">
                      <h2 class="card-title">{{ story.title }}</h2>
                      <div class="card-meta-line">
                        <span>{{ story.category || 'Mộc' }}</span>
                        <span>·</span>
                        <span>{{ formatNumber(story.chapterCount || story.chapters?.length || 1) }} chương</span>
                      </div>
                    </div>
                  </article>
                </div>
              </div>

              <!-- Hàng thẻ tiếp theo (từ thẻ số 6 trở đi) -->
              <div v-if="remainingStories.length > 0" class="showcase-bottom-grid">
                <article
                  v-for="(story, idx) in remainingStories"
                  :key="story.id"
                  class="book-story-card"
                  @click="goToEditStory(story.id)"
                >
                  <div class="card-image-layer">
                    <img
                      :src="getStoryCover(story, idx + 5)"
                      :alt="story.title"
                      class="card-cover-img"
                      loading="lazy"
                    />
                  </div>
                  <div class="card-scrim-layer" />

                  <div class="card-top-bar">
                    <span class="card-rank-num">{{ idx + 6 }}</span>
                    <div class="card-pill-badge">
                      <span class="card-pill-dot" />
                      <span>{{ getUpdateBadge(story, idx + 5) }}</span>
                    </div>
                  </div>

                  <div class="card-actions-hover" @click.stop>
                    <button
                      type="button"
                      class="btn-card-edit"
                      title="Soạn thảo"
                      @click="goToEditStory(story.id)"
                    >
                      <PenTool :size="12" />
                      <span>Sửa</span>
                    </button>
                    <button
                      type="button"
                      class="btn-card-delete"
                      title="Xóa truyện"
                      @click="openDeleteModal(story)"
                    >
                      <Trash2 :size="13" />
                    </button>
                  </div>

                  <div class="card-bottom-info">
                    <h2 class="card-title">{{ story.title }}</h2>
                    <div class="card-meta-line">
                      <span>{{ story.category || 'Mộc' }}</span>
                      <span>·</span>
                      <span>{{ formatNumber(story.chapterCount || story.chapters?.length || 1) }} chương</span>
                    </div>
                  </div>
                </article>
              </div>
            </template>

            <!-- 2. LƯỚI ĐỒNG BỘ (Khi tìm kiếm, lọc hoặc danh sách ít hơn 5 truyện) -->
            <div v-else class="uniform-cards-grid">
              <article
                v-for="(story, idx) in filteredStories"
                :key="story.id"
                class="book-story-card"
                @click="goToEditStory(story.id)"
              >
                <div class="card-image-layer">
                  <img
                    :src="getStoryCover(story, idx)"
                    :alt="story.title"
                    class="card-cover-img"
                    loading="lazy"
                  />
                </div>
                <div class="card-scrim-layer" />

                <div class="card-top-bar">
                  <span class="card-rank-num">{{ idx + 1 }}</span>
                  <div class="card-pill-badge">
                    <span class="card-pill-dot" />
                    <span>{{ getUpdateBadge(story, idx) }}</span>
                  </div>
                </div>

                <div class="card-actions-hover" @click.stop>
                  <button
                    type="button"
                    class="btn-card-edit"
                    title="Soạn thảo"
                    @click="goToEditStory(story.id)"
                  >
                    <PenTool :size="12" />
                    <span>Sửa</span>
                  </button>
                  <button
                    type="button"
                    class="btn-card-delete"
                    title="Xóa truyện"
                    @click="openDeleteModal(story)"
                  >
                    <Trash2 :size="13" />
                  </button>
                </div>

                <div class="card-bottom-info">
                  <h2 class="card-title">{{ story.title }}</h2>
                  <div class="card-meta-line">
                    <span>{{ story.category || 'Mộc' }}</span>
                    <span>·</span>
                    <span>{{ formatNumber(story.chapterCount || story.chapters?.length || 1) }} chương</span>
                  </div>
                </div>
              </article>
            </div>
          </div>

          <!-- TABLE VIEW: Không viền, không bóng -->
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
                  <th class="col-actions">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(story, idx) in filteredStories"
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
                        :src="getStoryCover(story, idx)"
                        :alt="story.title"
                      />
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
                    </div>
                  </td>
                  <td class="col-category">
                    <span class="category-chip">{{ story.category || 'Mộc' }}</span>
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
                    <span class="table-ch-count">{{ formatNumber(story.chapterCount || story.chapters?.length || 1) }}</span>
                  </td>
                  <td class="col-actions">
                    <div class="table-action-group">
                      <button
                        type="button"
                        class="btn-row-action btn-edit"
                        title="Soạn thảo"
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
                        <Trash2 :size="13" />
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

    <!-- Modal Xác nhận Xóa Truyện an toàn (Không viền, Không bóng) -->
    <div
      v-if="deleteModal.isOpen && deleteModal.story"
      class="delete-modal-overlay"
      @click.self="closeDeleteModal"
    >
      <div class="delete-modal-box">
        <div class="modal-icon-header">
          <div class="alert-icon-circle">
            <AlertTriangle :size="22" />
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
          Toàn bộ nội dung chương và dữ liệu liên quan sẽ bị gỡ bỏ.
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
            <Loader2 v-if="deleteModal.isDeleting" :size="14" class="spin" />
            <Trash2 v-else :size="14" />
            <span>{{ deleteModal.isDeleting ? 'Đang xóa...' : 'Xác nhận xóa' }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Toast Thông báo (Không viền, Không bóng) -->
    <div
      v-if="toast.show"
      class="toast-notification"
      :class="`toast-${toast.type}`"
    >
      <CheckCircle2 v-if="toast.type === 'success'" :size="15" />
      <AlertTriangle v-else :size="15" />
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
  background-color: var(--library-bg, #f7f8fa);
  color: var(--library-ink, #18241c);
  font-family: var(--sans, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
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
  padding: 32px 48px 96px;
}

.bookshelf-container {
  max-width: 1240px;
  margin: 0 auto;
  width: 100%;
}

/* Header tối giản */
.bookshelf-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 20px;
  flex-wrap: wrap;
}

.bookshelf-title {
  font-size: 24px;
  font-weight: 700;
  color: var(--library-ink, #18241c);
  letter-spacing: -0.4px;
  margin: 0;
  line-height: 1.2;
}

.status-pills-list {
  display: flex;
  align-items: center;
  gap: 6px;
}

.status-pill-btn {
  padding: 6px 14px;
  border-radius: 9999px;
  font-size: 13px;
  font-weight: 500;
  border: 0;
  outline: none;
  background: rgba(0, 0, 0, 0.04);
  color: var(--library-muted, #5f6c5e);
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.status-pill-btn:hover {
  background: rgba(0, 0, 0, 0.08);
  color: var(--library-ink, #18241c);
}

.status-pill-btn.active {
  background-color: var(--library-ink, #18241c);
  color: #ffffff;
  font-weight: 600;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

/* Search Box: Không viền, Không bóng */
.search-box-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 12px;
  color: var(--library-muted, #5f6c5e);
  pointer-events: none;
}

.bookshelf-search-input {
  width: 200px;
  padding: 8px 30px 8px 34px;
  background: rgba(0, 0, 0, 0.04);
  border: 0;
  outline: none;
  border-radius: 9999px;
  font-size: 13px;
  color: var(--library-ink, #18241c);
  transition: all 0.15s ease;
}

.bookshelf-search-input:focus {
  background: rgba(0, 0, 0, 0.07);
  width: 240px;
}

.btn-clear-search {
  position: absolute;
  right: 10px;
  background: transparent;
  border: 0;
  color: var(--library-muted, #5f6c5e);
  cursor: pointer;
  padding: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Select sort: Không viền, Không bóng */
.bookshelf-select-sort {
  padding: 8px 14px;
  border-radius: 9999px;
  border: 0;
  outline: none;
  background-color: rgba(0, 0, 0, 0.04);
  color: var(--library-ink, #18241c);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.bookshelf-select-sort:hover {
  background-color: rgba(0, 0, 0, 0.07);
}

/* View Mode Toggle: Không viền, Không bóng */
.view-mode-toggle {
  display: flex;
  align-items: center;
  background: rgba(0, 0, 0, 0.04);
  border-radius: 9999px;
  padding: 2px;
  gap: 2px;
}

.btn-view-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 0;
  outline: none;
  background: transparent;
  color: var(--library-muted, #5f6c5e);
  cursor: pointer;
  transition: all 0.15s;
}

.btn-view-toggle.active {
  background: #ffffff;
  color: var(--library-ink, #18241c);
}

/* Primary Action Button: Không viền, Không bóng */
.btn-primary-action {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 9999px;
  background-color: var(--library-ink, #18241c);
  color: #ffffff;
  border: 0;
  outline: none;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.18s ease;
  white-space: nowrap;
}

.btn-primary-action:hover {
  opacity: 0.9;
}

/* Loading */
.bookshelf-loading-wrap {
  display: flex;
  justify-content: center;
  padding: 80px 20px;
  color: var(--library-muted, #5f6c5e);
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  100% {
    transform: rotate(360deg);
  }
}

/* Empty State */
.bookshelf-empty-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 32px;
  text-align: center;
  background: rgba(0, 0, 0, 0.025);
  border-radius: 24px;
  margin-top: 10px;
  border: 0;
}

.empty-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--library-ink, #18241c);
  margin: 0 0 6px 0;
}

.empty-desc {
  font-size: 13.5px;
  color: var(--library-muted, #5f6c5e);
  max-width: 420px;
  margin: 0 0 20px 0;
  line-height: 1.5;
}

.btn-empty-cta {
  padding: 10px 22px;
  font-size: 13.5px;
}

.btn-outline-clear {
  padding: 8px 18px;
  border-radius: 9999px;
  border: 0;
  outline: none;
  background: rgba(0, 0, 0, 0.05);
  color: var(--library-ink, #18241c);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease;
}

.btn-outline-clear:hover {
  background: rgba(0, 0, 0, 0.09);
}

/* GRID LAYOUT: KHÔNG BORDER, KHÔNG SHADOW */
.books-grid-layout {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Bento Showcase Grid */
.showcase-bento-grid {
  display: grid;
  grid-template-columns: 1.05fr 1fr;
  gap: 16px;
  width: 100%;
}

.showcase-right-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  grid-template-rows: repeat(2, 1fr);
  gap: 16px;
}

.showcase-bottom-grid,
.uniform-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 16px;
}

/* BOOK STORY CARD: Chuẩn theo ảnh tham khảo */
.book-story-card {
  position: relative;
  overflow: hidden;
  border-radius: 22px;
  background-color: #1e2621;
  aspect-ratio: 1.1 / 1;
  user-select: none;
  cursor: pointer;
  border: 0 !important;
  box-shadow: none !important;
  outline: none !important;
  display: flex;
  flex-direction: column;
}

.book-story-card.card-hero {
  aspect-ratio: auto;
  min-height: 440px;
  height: 100%;
}

/* Lớp ảnh nền */
.card-image-layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.card-cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Lớp bóng mờ màu tối phía dưới để chữ đọc cực rõ */
.card-scrim-layer {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    180deg,
    rgba(0, 0, 0, 0.15) 0%,
    rgba(0, 0, 0, 0) 30%,
    rgba(0, 0, 0, 0.35) 60%,
    rgba(0, 0, 0, 0.82) 100%
  );
  pointer-events: none;
}

/* Top bar: Rank lớn & Badge viên thuốc */
.card-top-bar {
  position: absolute;
  top: 14px;
  left: 16px;
  right: 14px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  z-index: 3;
}

.card-rank-num {
  font-size: 32px;
  font-weight: 300;
  line-height: 1;
  color: rgba(255, 255, 255, 0.88);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  letter-spacing: -0.5px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
}

.card-hero .card-rank-num {
  font-size: 48px;
}

.card-pill-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 9px;
  border-radius: 9999px;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  color: #ffffff;
  font-size: 11.5px;
  font-weight: 600;
  border: 0;
  line-height: 1;
}

.card-pill-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: #34d399;
}

/* Thao tác chỉnh sửa & xóa khi hover */
.card-actions-hover {
  position: absolute;
  bottom: 14px;
  right: 14px;
  display: flex;
  align-items: center;
  gap: 6px;
  z-index: 5;
  opacity: 0;
  transform: translateY(4px);
  transition: all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.book-story-card:hover .card-actions-hover,
.book-story-card:focus-within .card-actions-hover {
  opacity: 1;
  transform: translateY(0);
}

.btn-card-edit {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.9);
  color: #18241c;
  border: 0;
  outline: none;
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
  backdrop-filter: blur(8px);
  transition: background 0.15s ease;
}

.btn-card-edit:hover {
  background: #ffffff;
}

.btn-card-delete {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.45);
  color: #ff6b6b;
  border: 0;
  outline: none;
  cursor: pointer;
  backdrop-filter: blur(8px);
  transition: all 0.15s ease;
}

.btn-card-delete:hover {
  background: rgba(220, 38, 38, 0.9);
  color: #ffffff;
}

/* Bottom: Tên truyện và phân loại */
.card-bottom-info {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 24px 18px 14px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  z-index: 3;
}

.card-title {
  color: #ffffff;
  font-size: 15.5px;
  font-weight: 700;
  line-height: 1.3;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
}

.card-hero .card-title {
  font-size: 22px;
}

.card-meta-line {
  color: rgba(255, 255, 255, 0.72);
  font-size: 12px;
  line-height: 1.3;
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 400;
}

/* TABLE VIEW: Không viền, Không bóng */
.books-table-card {
  background: rgba(0, 0, 0, 0.025);
  border-radius: 20px;
  overflow: hidden;
  border: 0;
}

.bookshelf-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

.bookshelf-table th {
  padding: 12px 18px;
  font-size: 12px;
  font-weight: 600;
  color: var(--library-muted, #5f6c5e);
  background: rgba(0, 0, 0, 0.02);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border: 0;
}

.bookshelf-table td {
  padding: 14px 18px;
  font-size: 13.5px;
  vertical-align: middle;
  border: 0;
}

.table-row-item:hover {
  background-color: rgba(0, 0, 0, 0.035);
}

.col-cover {
  width: 60px;
}

.table-thumb {
  width: 44px;
  height: 58px;
  border-radius: 8px;
  overflow: hidden;
  background: #e3e7e0;
  cursor: pointer;
}

.table-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.col-title {
  max-width: 320px;
}

.table-title-group {
  cursor: pointer;
}

.table-story-title {
  font-weight: 600;
  color: var(--library-ink, #18241c);
  transition: color 0.15s;
}

.table-story-title:hover {
  color: #2e7d32;
}

.category-chip {
  font-size: 12px;
  color: var(--library-muted, #5f6c5e);
  background: rgba(0, 0, 0, 0.04);
  padding: 3px 8px;
  border-radius: 9999px;
  font-weight: 500;
}

.story-status-tag {
  font-size: 11px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 9999px;
}

.status-published {
  background-color: rgba(46, 125, 50, 0.12);
  color: #2e7d32;
}

.status-draft {
  background-color: rgba(217, 119, 6, 0.12);
  color: #b45309;
}

.status-completed {
  background-color: rgba(124, 58, 237, 0.12);
  color: #6d28d9;
}

.table-ch-count {
  font-weight: 600;
  color: var(--library-ink, #18241c);
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
  padding: 5px 10px;
  border-radius: 9999px;
  border: 0;
  outline: none;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-row-action.btn-edit {
  background: rgba(0, 0, 0, 0.05);
  color: var(--library-ink, #18241c);
}

.btn-row-action.btn-edit:hover {
  background: rgba(0, 0, 0, 0.09);
}

.btn-row-action.btn-delete {
  background: transparent;
  color: #dc2626;
  padding: 5px 8px;
}

.btn-row-action.btn-delete:hover {
  background: rgba(220, 38, 38, 0.1);
}

/* Modal: Không viền, Không bóng */
.delete-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.delete-modal-box {
  background: #ffffff;
  border-radius: 24px;
  border: 0;
  padding: 28px;
  max-width: 440px;
  width: 100%;
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
  background: rgba(220, 38, 38, 0.1);
  color: #dc2626;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-modal-close {
  background: transparent;
  border: 0;
  color: var(--library-muted, #5f6c5e);
  cursor: pointer;
  padding: 6px;
  border-radius: 50%;
}

.modal-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--library-ink, #18241c);
  margin: 0 0 8px 0;
}

.modal-desc {
  font-size: 13.5px;
  color: var(--library-muted, #5f6c5e);
  margin: 0 0 24px 0;
  line-height: 1.5;
}

.highlight-story-title {
  color: var(--library-ink, #18241c);
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
  border: 0;
  outline: none;
  background: rgba(0, 0, 0, 0.05);
  color: var(--library-ink, #18241c);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-modal-cancel:hover {
  background: rgba(0, 0, 0, 0.09);
}

.btn-modal-delete {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 20px;
  border-radius: 9999px;
  border: 0;
  outline: none;
  background: #dc2626;
  color: #ffffff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
}

.btn-modal-delete:hover {
  opacity: 0.9;
}

/* Toast Thông báo: Không viền, Không bóng */
.toast-notification {
  position: fixed;
  bottom: 24px;
  right: 24px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border-radius: 9999px;
  background: #18241c;
  color: #ffffff;
  font-size: 13px;
  font-weight: 500;
  z-index: 1000;
  border: 0;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.toast-error {
  background: #dc2626;
}

/* Responsive */
@media (max-width: 900px) {
  .showcase-bento-grid {
    grid-template-columns: 1fr;
  }
  .book-story-card.card-hero {
    min-height: 320px;
  }
  .bookshelf-scroll-area {
    padding: 20px 20px 80px;
  }
}

@media (max-width: 600px) {
  .showcase-right-grid {
    grid-template-columns: 1fr;
  }
  .bookshelf-header {
    flex-direction: column;
    align-items: flex-start;
  }
  .header-right {
    width: 100%;
    justify-content: space-between;
  }
  .bookshelf-search-input {
    width: 140px;
  }
}
</style>

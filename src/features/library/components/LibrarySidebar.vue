<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  Home,
  BookOpen,
  Bookmark,
  LogOut,
  PenTool,
} from '@lucide/vue'
import { useAuthStore } from '../../../stores/auth.store'
import { createApiClient } from '../../../services/api-client'
import UserAvatar from '../../../components/ui/UserAvatar.vue'
import { useAutoMotion } from '../../../animations/composables/useAutoMotion'

const props = defineProps<{ beforeLogout?: () => Promise<boolean> }>()

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

// Mặc định ở trang Library là tab Tổng quan
const activeTab = ref<'home' | 'library' | 'reading'>('home')
const isProfileActive = computed(() => route?.path === '/profile')
const isEditorActive = computed(() => route?.path?.startsWith('/library/editor'))
const isBookshelfActive = computed(() => route?.path === '/library/bookshelf' || route?.path === '/bookshelf')
const isLibraryHomeActive = computed(() => route?.path === '/library' && !route?.query?.tab && !isEditorActive.value && !isProfileActive.value && !isBookshelfActive.value)
const isReadingActive = computed(() => route?.path?.startsWith('/library/stories/') || (route?.path === '/library' && route?.query?.tab === 'reading'))
const sidebarNav = ref<HTMLElement>()
const activeNavKey = computed(() => {
  if (isLibraryHomeActive.value) return 'home'
  if (isBookshelfActive.value) return 'library'
  if (isReadingActive.value) return 'reading'
  if (isEditorActive.value) return 'editor'
  return 'none'
})

// Only the active icon receives a stable key. Auto Motion can then carry that
// icon between sidebar slots when the route changes without animating every item.
useAutoMotion(sidebarNav, activeNavKey, {
  deep: false,
  // Sidebar navigation is an explicit product interaction; keep the icon
  // transition even when the operating system requests reduced motion.
  reduced: false,
  nested: true,
  stagger: 0,
})

const user = computed(() => authStore.user)
const userDisplayName = computed(() => user.value?.displayName || '')
const userSeed = computed(() => user.value?.email || user.value?.displayName || user.value?.id || 'moc-user')
const userAvatar = ref<string | null>(null)

async function fetchUserProfile() {
  if (user.value?.avatarUrl) {
    userAvatar.value = user.value.avatarUrl
    return
  }
  if (user.value?.avatar) {
    userAvatar.value = user.value.avatar
    return
  }
  if (authStore.isAuthenticated) {
    try {
      const client = createApiClient()
      const profile = await client.request<{ avatarUrl?: string }>('/api/profile/me')
      if (profile?.avatarUrl) {
        userAvatar.value = profile.avatarUrl
      }
    } catch {
      // Giữ null để fallback sang Identicon phong cách GitHub
    }
  }
}

watch(
  user,
  () => {
    fetchUserProfile()
  },
  { immediate: true },
)

onMounted(() => {
  fetchUserProfile()
})

function handleNav(tab: 'home' | 'library' | 'reading') {
  activeTab.value = tab
  if (tab === 'library') {
    if (route.path !== '/library/bookshelf') {
      router.push('/library/bookshelf')
    }
    return
  }
  if (tab === 'home') {
    if (route.path !== '/library' || route.query.tab) {
      router.push('/library')
    }
    return
  }
  if (tab === 'reading') {
    if (route.path !== '/library' || route.query.tab !== 'reading') {
      router.push({ path: '/library', query: { tab: 'reading' } })
    }
    return
  }
}

function goToProfile() {
  if (route.path !== '/profile') {
    router.push('/profile')
  }
}

function goToEditor() {
  if (route.path !== '/library/editor') {
    router.push('/library/editor')
  }
}

async function handleLogout() {
  if (props.beforeLogout && !await props.beforeLogout()) return
  await authStore.logout()
  router.push('/login')
}
</script>

<template>
  <aside class="library-sidebar">
    <!-- The persistent app logo occupies this slot across route transitions. -->
    <div class="sidebar-top">
      <span class="sidebar-brand-space" aria-hidden="true" />
    </div>

    <!-- Main Navigation Icons phù hợp hệ thống truyện / Light Novel -->
    <nav ref="sidebarNav" class="sidebar-nav" data-motion-scope="sidebar">
      <!-- 1. Tổng quan (Trang chính của Library) -->
      <button
        type="button"
        class="nav-item"
        :class="{ active: isLibraryHomeActive }"
        title="Tổng quan"
        @click="handleNav('home')"
      >
        <span class="nav-icon" :data-motion-key="isLibraryHomeActive ? 'sidebar:active-icon' : undefined">
          <Home
            :size="20"
            :stroke-width="1.6"
            :fill="isLibraryHomeActive ? 'currentColor' : 'none'"
          />
        </span>
        <span v-if="!isLibraryHomeActive" class="nav-label">Tổng quan</span>
      </button>

      <!-- 2. Tủ sách cá nhân -->
      <button
        type="button"
        class="nav-item"
        :class="{ active: isBookshelfActive }"
        title="Tủ sách"
        @click="handleNav('library')"
      >
        <span class="nav-icon" :data-motion-key="isBookshelfActive ? 'sidebar:active-icon' : undefined">
          <BookOpen
            :size="20"
            :stroke-width="1.6"
            :fill="isBookshelfActive ? 'currentColor' : 'none'"
          />
        </span>
        <span v-if="!isBookshelfActive" class="nav-label">Tủ sách</span>
      </button>

      <!-- 3. Đang đọc / Dấu trang -->
      <button
        type="button"
        class="nav-item"
        :class="{ active: isReadingActive }"
        title="Đang đọc"
        @click="handleNav('reading')"
      >
        <span class="nav-icon" :data-motion-key="isReadingActive ? 'sidebar:active-icon' : undefined">
          <Bookmark
            :size="20"
            :stroke-width="1.6"
            :fill="isReadingActive ? 'currentColor' : 'none'"
          />
        </span>
        <span v-if="!isReadingActive" class="nav-label">Đang đọc</span>
      </button>

      <!-- 4. Đăng truyện / Soạn thảo -->
      <button
        type="button"
        class="nav-item nav-item-create"
        :class="{ active: isEditorActive }"
        title="Đăng truyện mới"
        @click="goToEditor"
      >
        <span class="nav-icon" :data-motion-key="isEditorActive ? 'sidebar:active-icon' : undefined">
          <PenTool
            :size="20"
            :stroke-width="1.6"
            :fill="isEditorActive ? 'currentColor' : 'none'"
          />
        </span>
        <span v-if="!isEditorActive" class="nav-label">Đăng truyện</span>
      </button>
    </nav>

    <!-- Bottom Settings & Actions -->
    <div class="sidebar-bottom">
      <button
        type="button"
        class="action-btn avatar-btn"
        :class="{ active: isProfileActive }"
        :title="userDisplayName ? `Tài khoản: ${userDisplayName} — Xem hồ sơ` : 'Hồ sơ cá nhân'"
        :aria-label="userDisplayName ? `Tài khoản: ${userDisplayName} — Xem hồ sơ` : 'Hồ sơ cá nhân'"
        @click="goToProfile"
      >
        <UserAvatar
          :src="userAvatar"
          :seed="userSeed"
          :name="userDisplayName"
          :size="34"
        />
      </button>

      <button type="button" class="action-btn logout-btn" title="Đăng xuất" @click="handleLogout">
        <LogOut :size="18" />
      </button>
    </div>
  </aside>
</template>

<style scoped>
.library-sidebar {
  width: 76px;
  height: 100dvh;
  position: sticky;
  top: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 0 18px;
  background-color: transparent;
  color: var(--sidebar-ink, #303b2f);
  user-select: none;
  flex-shrink: 0;
  z-index: 10;
}

/* Brand Mộc slot */
.sidebar-top {
  margin-bottom: 24px;
  width: 100%;
  display: flex;
  justify-content: center;
}

.sidebar-brand-space { display: block; width: 76px; height: 18px; }

/* Nav */
.sidebar-nav {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.nav-item {
  position: relative;
  width: 54px;
  min-height: 48px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border: 0;
  border-radius: 14px;
  background: transparent;
  color: var(--muted, #7b8073);
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
  padding: 6px 0;
}

.nav-item:hover {
  background-color: rgba(67, 90, 65, 0.06);
  color: var(--sidebar-ink, #303b2f);
}

.nav-icon {
  display: grid;
  place-items: center;
  line-height: 1;
}

/* Khi tab đang hoạt động: icon fill, ẩn chữ bên dưới */
.nav-item.active {
  background-color: rgba(67, 90, 65, 0.1);
  color: var(--green, #435a41);
  min-height: 46px;
  height: 46px;
}

.nav-item.active :deep(svg),
.nav-item.active svg {
  fill: currentColor;
}

.nav-item.active :deep(svg path),
.nav-item.active :deep(svg rect),
.nav-item.active :deep(svg circle),
.nav-item.active :deep(svg polygon) {
  fill: currentColor;
}

.nav-item.active .nav-label {
  display: none !important;
}

.nav-label {
  font-size: 10px;
  font-weight: 550;
  letter-spacing: -0.1px;
  line-height: 1;
}

/* Bottom */
.sidebar-bottom {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.action-btn {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: 0;
  background-color: transparent;
  color: var(--muted, #7b8073);
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: all 0.15s ease;
}

.action-btn:hover {
  background-color: rgba(67, 90, 65, 0.08);
  color: var(--sidebar-ink, #303b2f);
}

.avatar-btn {
  padding: 0;
  overflow: visible;
  border-radius: 50%;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.avatar-btn:hover {
  background-color: transparent;
  transform: scale(1.05);
}

.avatar-btn.active {
  box-shadow: 0 0 0 2.5px var(--green, #435a41);
}

.logout-btn:hover {
  background-color: rgba(170, 75, 63, 0.08);
  color: var(--danger, #aa4b3f);
}
</style>

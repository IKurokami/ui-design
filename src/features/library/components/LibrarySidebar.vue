<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  Home,
  BookOpen,
  Bookmark,
  Heart,
  Clock,
  CheckCircle2,
  Settings,
  LogOut,
  Moon,
  Sun,
} from '@lucide/vue'
import { useAuthStore } from '../../../stores/auth.store'

const router = useRouter()
const authStore = useAuthStore()

// Mặc định ở trang Library là tab Tổng quan
const activeTab = ref<'home' | 'library' | 'reading'>('home')
const isDark = ref(false)

function toggleTheme() {
  isDark.value = !isDark.value
}

async function handleLogout() {
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
    <nav class="sidebar-nav">
      <!-- 1. Tổng quan (Trang chính của Library) -->
      <button
        type="button"
        class="nav-item"
        :class="{ active: activeTab === 'home' }"
        title="Tổng quan"
        @click="activeTab = 'home'"
      >
        <Home
          :size="20"
          :stroke-width="1.6"
          :fill="activeTab === 'home' ? 'currentColor' : 'none'"
        />
        <span v-if="activeTab !== 'home'" class="nav-label">Tổng quan</span>
      </button>

      <!-- 2. Tủ sách cá nhân -->
      <button
        type="button"
        class="nav-item"
        :class="{ active: activeTab === 'library' }"
        title="Tủ sách"
        @click="activeTab = 'library'"
      >
        <BookOpen
          :size="20"
          :stroke-width="1.6"
          :fill="activeTab === 'library' ? 'currentColor' : 'none'"
        />
        <span v-if="activeTab !== 'library'" class="nav-label">Tủ sách</span>
      </button>

      <!-- 3. Đang đọc / Dấu trang -->
      <button
        type="button"
        class="nav-item"
        :class="{ active: activeTab === 'reading' }"
        title="Đang đọc"
        @click="activeTab = 'reading'"
      >
        <Bookmark
          :size="20"
          :stroke-width="1.6"
          :fill="activeTab === 'reading' ? 'currentColor' : 'none'"
        />
        <span v-if="activeTab !== 'reading'" class="nav-label">Đang đọc</span>
      </button>
    </nav>

    <!-- Sub Section / Thống kê & Phân loại truyện -->
    <div class="sidebar-counters">
      <!-- Yêu thích -->
      <button type="button" class="counter-item" title="Truyện yêu thích">
        <div class="counter-icon-wrap">
          <Heart :size="18" :stroke-width="1.5" />
          <span class="counter-num">48</span>
        </div>
        <span class="counter-text">Yêu thích</span>
      </button>

      <!-- Lịch sử đọc -->
      <button type="button" class="counter-item" title="Lịch sử đọc gần đây">
        <div class="counter-icon-wrap">
          <Clock :size="18" :stroke-width="1.5" />
          <span class="counter-num">12</span>
        </div>
        <span class="counter-text">Lịch sử</span>
      </button>

      <!-- Đã hoàn thành -->
      <button type="button" class="counter-item" title="Truyện đã đọc xong">
        <div class="counter-icon-wrap">
          <CheckCircle2 :size="18" :stroke-width="1.5" />
          <span class="counter-num">26</span>
        </div>
        <span class="counter-text">Đã xong</span>
      </button>
    </div>

    <!-- Bottom Settings & Actions -->
    <div class="sidebar-bottom">
      <button type="button" class="action-btn" title="Chế độ đọc sáng/tối" @click="toggleTheme">
        <Sun v-if="isDark" :size="18" />
        <Moon v-else :size="18" />
      </button>

      <button type="button" class="action-btn" title="Cài đặt đọc truyện">
        <Settings :size="18" />
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

/* Counters */
.sidebar-counters {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  margin-top: 28px;
  width: 100%;
}

.counter-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  background: none;
  border: 0;
  color: var(--muted, #7b8073);
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 10px;
  transition: all 0.15s ease;
  width: 58px;
}

.counter-item:hover {
  color: var(--sidebar-ink, #303b2f);
  background-color: rgba(67, 90, 65, 0.05);
}

.counter-icon-wrap {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.counter-num {
  position: absolute;
  top: -4px;
  left: calc(100% - 2px);
  font-size: 9px;
  font-weight: 600;
  color: var(--muted, #7b8073);
  white-space: nowrap;
  line-height: 1;
}

.counter-text {
  font-size: 9px;
  color: var(--muted, #7b8073);
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

.logout-btn:hover {
  background-color: rgba(170, 75, 63, 0.08);
  color: var(--danger, #aa4b3f);
}
</style>

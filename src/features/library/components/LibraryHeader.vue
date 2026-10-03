<script setup lang="ts">
import { ArrowLeftRight, RotateCcw, HelpCircle } from '@lucide/vue'

defineProps<{
  title?: string
  totalItems?: number
  totalCollections?: number
}>()
</script>

<template>
  <header class="library-header">
    <!-- Title & Stats -->
    <div class="header-left">
      <h1 class="header-title" data-motion-key="title">{{ title || 'Nhân Vật & Tác Phẩm' }}</h1>
      <div class="header-stats" data-motion-key="stats">
        <span>{{ (totalItems || 265).toLocaleString('vi-VN') }} tập</span>
        <span class="dot">·</span>
        <span>{{ totalCollections || 14 }} bộ Light Novel</span>
      </div>
    </div>

    <!-- Quick Jump & Action Icons -->
    <div class="header-right">
      <!-- Quick Jump Button with shortcut -->
      <button type="button" class="quick-jump-btn" data-motion-key="quick-jump">
        <span>Chuyển nhanh...</span>
        <kbd class="kbd-badge">⌘K</kbd>
      </button>

      <!-- Action Icon Buttons -->
      <div class="header-actions">
        <button type="button" class="icon-btn" title="Đảo chiều sắp xếp" data-motion-key="sort">
          <ArrowLeftRight :size="16" />
        </button>
        <button type="button" class="icon-btn" title="Làm mới dữ liệu" data-motion-key="refresh">
          <RotateCcw :size="16" />
        </button>
        <button type="button" class="icon-btn" title="Trợ giúp" data-motion-key="help">
          <HelpCircle :size="16" />
        </button>
      </div>
    </div>
  </header>
</template>

<style scoped>
.library-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding-bottom: 24px;
}

.header-left {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.header-title {
  margin: 0;
  font-size: 26px;
  font-weight: 750;
  color: var(--library-ink);
  letter-spacing: -0.6px;
}

.header-stats {
  font-size: 13px;
  color: var(--library-muted);
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 6px;
}

.dot {
  opacity: 0.6;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 14px;
}

.quick-jump-btn {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  padding: 8px 14px;
  background-color: transparent;
  border: 0;
  border-radius: 9999px;
  color: var(--library-muted);
  font-size: 12px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.quick-jump-btn:hover {
  background-color: transparent;
}

.kbd-badge {
  padding: 2px 6px;
  background-color: transparent;
  border-radius: 6px;
  font-family: inherit;
  font-size: 10px;
  font-weight: 600;
  color: var(--library-control-ink);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.icon-btn {
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background-color: transparent;
  color: var(--library-control-ink);
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.icon-btn:hover {
  background-color: transparent;
  color: var(--library-ink);
}
@media (max-width: 680px) {
  .library-header { flex-direction: column; align-items: flex-start; gap: 12px; }
  .header-right { flex-wrap: wrap; gap: 8px; }
  .header-stats { flex-wrap: wrap; font-size: 12px; }
}
</style>

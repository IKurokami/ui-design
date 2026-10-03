<script setup lang="ts">
defineProps<{ title?: string; totalCollections?: number; resultCount?: number }>()
</script>

<template>
  <header class="library-header">
    <h1 class="header-title">{{ title ?? 'Thư viện' }}</h1>
    <span class="header-stats" role="status">{{ (resultCount ?? totalCollections ?? 0).toLocaleString('vi-VN') }} bộ truyện</span>
  </header>
</template>

<style scoped>
.library-header { display: flex; flex-wrap: wrap; align-items: baseline; gap: 14px; padding: 18px 0 28px; }
.header-title { margin: 0; color: var(--library-ink); font-size: clamp(28px, 3.5vw, 40px); line-height: 1.2; font-weight: 600; letter-spacing: -1.5px; }
.header-stats { color: var(--library-muted); font-size: 12px; font-variant-numeric: tabular-nums; }
@media (max-width: 560px) {
  .library-header { gap: 8px 12px; padding: 12px 0 22px; }
  .header-stats { font-size: 11px; }
}
</style>

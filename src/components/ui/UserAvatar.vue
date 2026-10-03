<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    src?: string | null
    seed?: string | null
    name?: string | null
    size?: number
    title?: string
  }>(),
  {
    src: null,
    seed: '',
    name: 'Người dùng',
    size: 36,
    title: '',
  },
)

const hasImgError = ref(false)

watch(
  () => props.src,
  () => {
    hasImgError.value = false
  },
)

const showImage = computed(() => !!props.src && !hasImgError.value)

function handleImgError() {
  hasImgError.value = true
}

/**
 * Thuật toán sinh Identicon 5x5 đối xứng trục dọc chuẩn phong cách GitHub:
 * - Lưới 5x5 đối xứng qua cột giữa (cột 0 khớp cột 4, cột 1 khớp cột 3).
 * - Viền đệm 1 ô xung quanh (tổng kích thước 7x7).
 * - Màu foreground tính từ chuỗi băm (hash) seed/tên người dùng.
 * - Nền màu sáng nhạt trung tính #f0f3f6.
 */
const identicon = computed(() => {
  const rawSeed = (props.seed || props.name || 'moc-user').trim().toLowerCase()

  // 1. Sinh mã băm 32-bit FNV-1a từ seed
  let h = 2166136261
  for (let i = 0; i < rawSeed.length; i++) {
    h ^= rawSeed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }

  // 2. Linear Congruential Generator tạo chuỗi ngẫu nhiên có tính tất định
  let state = h >>> 0
  function nextByte(): number {
    state = (Math.imul(state, 1103515245) + 12345) >>> 0
    return (state >> 16) & 0xff
  }

  // 3. Quyết định 15 ô (5 hàng x 3 cột đầu) và lật gương sang 2 cột sau
  const cells: boolean[][] = []
  let filledCount = 0

  for (let r = 0; r < 5; r++) {
    const row: boolean[] = []
    for (let c = 0; c < 3; c++) {
      const b = nextByte()
      const filled = b % 2 === 0
      row.push(filled)
      if (filled) filledCount++
    }
    // Đối xứng sang cột 3 và 4
    row.push(row[1])
    row.push(row[0])
    cells.push(row)
  }

  // Đảm bảo không bị trống toàn bộ
  if (filledCount === 0) {
    cells[1][2] = true
    cells[2][2] = true
    cells[3][2] = true
  }

  // 4. Chọn màu sắc hài hòa, độ tương phản rõ ràng trên nền #f0f3f6
  const hue = nextByte() % 360
  const sat = 50 + (nextByte() % 30) // 50% - 80%
  const light = 36 + (nextByte() % 22) // 36% - 58%
  const foreground = `hsl(${hue}, ${sat}%, ${light}%)`
  const background = '#f0f3f6'

  return { cells, foreground, background }
})
</script>

<template>
  <div
    class="user-avatar-wrap"
    :style="{ width: `${size}px`, height: `${size}px` }"
    :title="title || name || 'Tài khoản'"
    :aria-label="title || name || 'Tài khoản'"
  >
    <img
      v-if="showImage"
      :src="src!"
      :alt="name || 'Avatar'"
      class="avatar-img"
      @error="handleImgError"
    />
    <svg
      v-else
      class="identicon-svg"
      viewBox="0 0 7 7"
      xmlns="http://www.w3.org/2000/svg"
      shape-rendering="crispEdges"
      aria-hidden="true"
    >
      <rect width="7" height="7" :fill="identicon.background" />
      <template v-for="(row, r) in identicon.cells" :key="r">
        <template v-for="(filled, c) in row" :key="c">
          <rect
            v-if="filled"
            :x="c + 1"
            :y="r + 1"
            width="1"
            height="1"
            :fill="identicon.foreground"
          />
        </template>
      </template>
    </svg>
  </div>
</template>

<style scoped>
.user-avatar-wrap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  user-select: none;
  background-color: #f0f3f6;
  box-shadow: 0 0 0 1.5px rgba(67, 90, 65, 0.16);
  transition: transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.2s ease;
}

.user-avatar-wrap:hover {
  box-shadow: 0 0 0 2px var(--green, #435a41);
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.identicon-svg {
  width: 100%;
  height: 100%;
  display: block;
}
</style>

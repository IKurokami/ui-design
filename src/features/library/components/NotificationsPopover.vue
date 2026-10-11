<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Bell, BellOff, Check, ChevronLeft, Loader2, MoreHorizontal, RotateCcw, Trash2, X } from '@lucide/vue'
import { createApiClient } from '../../../services/api-client'
import { friendlyError } from '../../../services/error-handler'

interface Notification {
  storyId: string
  chapterId: string
  storyTitle: string
  chapterTitle: string
  createdAt: string
  read: boolean
}
interface MutedStory { storyId: string; storyTitle: string }

const props = defineProps<{ anchor?: HTMLElement | null }>()
const emit = defineEmits<{
  close: []
  unreadChange: [count: number]
}>()
const router = useRouter()
const api = createApiClient()
const panel = ref<HTMLElement>()
const top = ref(12)
const left = ref(85)
const width = ref(365)
let reloadVersion = 0
let disposed = false
const items = ref<Notification[]>([])
const muted = ref<MutedStory[]>([])
const filter = ref<'all' | 'unread' | 'muted'>('all')
const loading = ref(true)
const busy = ref('')
const menuId = ref('')
const error = ref('')
const message = ref('')
const unreadCount = computed(() => items.value.filter(item => !item.read).length)
const visible = computed(() => filter.value === 'unread' ? items.value.filter(item => !item.read) : items.value)

function updateCount() { emit('unreadChange', unreadCount.value) }
function placePanel() {
  const rect = props.anchor?.getBoundingClientRect()
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  // Keep the flyout entirely inside the viewport even if the sidebar moves.
  left.value = Math.max(8, Math.min((rect?.right ?? 76) + 9, viewportWidth - 192))
  width.value = Math.max(160, Math.min(365, viewportWidth - left.value - 8))
  top.value = Math.max(12, Math.min((rect?.top ?? 90) - 68, viewportHeight - Math.min(560, viewportHeight - 24) - 12))
}
async function reload() {
  const version = ++reloadVersion
  loading.value = true
  error.value = ''
  try {
    const [notifications, blocked] = await Promise.all([
      api.request<{ items: Notification[] }>('/api/notifications'),
      api.request<{ items: MutedStory[] }>('/api/notifications/muted/stories'),
    ])
    if (disposed || version !== reloadVersion) return
    items.value = notifications.items ?? []
    muted.value = blocked.items ?? []
    updateCount()
  } catch (cause) {
    if (!disposed && version === reloadVersion) error.value = friendlyError(cause)
  } finally {
    if (!disposed && version === reloadVersion) loading.value = false
  }
}
onMounted(async () => {
  placePanel()
  window.addEventListener('resize', placePanel)
  await nextTick()
  if (disposed) return
  panel.value?.focus()
  await reload()
})
onBeforeUnmount(() => {
  disposed = true
  ++reloadVersion
  window.removeEventListener('resize', placePanel)
})
function close() { emit('close') }
function relativeDate(date: string) {
  const time = new Date(date).getTime()
  if (!Number.isFinite(time)) return ''
  const delta = Math.max(0, Date.now() - time)
  const minute = Math.floor(delta / 60000)
  if (minute < 1) return 'Vừa xong'
  if (minute < 60) return minute + ' phút'
  const hour = Math.floor(minute / 60)
  if (hour < 24) return hour + ' giờ'
  const day = Math.floor(hour / 24)
  if (day < 7) return day + ' ngày'
  return new Intl.DateTimeFormat('vi-VN', { day: 'numeric', month: 'short' }).format(new Date(time))
}
async function open(item: Notification) {
  if (busy.value) return
  busy.value = item.chapterId
  error.value = ''
  try {
    await api.request('/api/notifications/' + encodeURIComponent(item.chapterId) + '/read', { method: 'PUT' })
    item.read = true
    updateCount()
    close()
    await router.push({ path: '/library/stories/' + encodeURIComponent(item.storyId), query: { chapter: item.chapterId } })
  } catch (cause) { error.value = friendlyError(cause) }
  finally { busy.value = '' }
}
async function dismiss(item: Notification) {
  if (busy.value) return
  busy.value = item.chapterId
  error.value = ''; message.value = ''
  try {
    await api.request('/api/notifications/' + encodeURIComponent(item.chapterId), { method: 'DELETE' })
    items.value = items.value.filter(entry => entry.chapterId !== item.chapterId)
    menuId.value = ''
    message.value = 'Đã xóa thông báo. Bạn vẫn nhận chương mới.'
    updateCount()
  } catch (cause) { error.value = friendlyError(cause) }
  finally { busy.value = '' }
}
async function cancelStory(item: Notification) {
  if (busy.value) return
  busy.value = item.storyId
  error.value = ''; message.value = ''
  try {
    await api.request('/api/notifications/mute/' + encodeURIComponent(item.storyId), { method: 'POST' })
    items.value = items.value.filter(entry => entry.storyId !== item.storyId)
    if (!muted.value.some(entry => entry.storyId === item.storyId)) {
      muted.value = [...muted.value, { storyId: item.storyId, storyTitle: item.storyTitle }]
    }
    menuId.value = ''
    message.value = 'Đã hủy thông báo từ “' + item.storyTitle + '”.'
    updateCount()
  } catch (cause) { error.value = friendlyError(cause) }
  finally { busy.value = '' }
}
async function restore(story: MutedStory) {
  if (busy.value) return
  busy.value = story.storyId
  error.value = ''; message.value = ''
  try {
    await api.request('/api/notifications/mute/' + encodeURIComponent(story.storyId), { method: 'DELETE' })
    muted.value = muted.value.filter(entry => entry.storyId !== story.storyId)
    message.value = 'Đã bật lại thông báo từ “' + story.storyTitle + '”.'
  } catch (cause) { error.value = friendlyError(cause) }
  finally { busy.value = '' }
}
async function clearAll() {
  if (busy.value || !items.value.length) return
  if (!window.confirm('Xóa tất cả thông báo? Bạn vẫn sẽ nhận thông báo chương mới.')) return
  busy.value = 'all'
  error.value = ''; message.value = ''
  try {
    await api.request('/api/notifications', { method: 'DELETE' })
    items.value = []
    menuId.value = ''
    message.value = 'Đã xóa hộp thư. Thông báo mới vẫn được gửi.'
    updateCount()
  } catch (cause) { error.value = friendlyError(cause) }
  finally { busy.value = '' }
}
</script>

<template>
  <Teleport to="body">
    <div class="notification-outside" aria-hidden="true" @click="close" />
    <section
      ref="panel"
      id="sidebar-notification-popover"
      class="notification-popover"
      role="dialog"
      aria-label="Thông báo"
      aria-modal="false"
      tabindex="-1"
      :style="{ top: top + 'px', left: left + 'px', width: width + 'px' }"
      @keydown.esc.stop.prevent="close"
    >
      <header class="popover-heading">
        <div class="heading-title">
          <Bell :size="19" />
          <h2>Thông báo</h2>
          <span v-if="unreadCount" class="unread-pill">{{ unreadCount > 99 ? '99+' : unreadCount }}</span>
        </div>
        <button type="button" class="circle-btn" aria-label="Đóng thông báo" title="Đóng" @click="close"><X :size="18" /></button>
      </header>

      <div class="popover-tabs" aria-label="Lọc thông báo">
        <button type="button" :class="{ selected: filter === 'all' }" :aria-pressed="filter === 'all'" @click="filter = 'all'; menuId = ''">Tất cả</button>
        <button type="button" :class="{ selected: filter === 'unread' }" :aria-pressed="filter === 'unread'" @click="filter = 'unread'; menuId = ''">Chưa đọc</button>
        <button type="button" :class="{ selected: filter === 'muted' }" :aria-pressed="filter === 'muted'" @click="filter = 'muted'; menuId = ''">Đã chặn<span v-if="muted.length"> ({{ muted.length }})</span></button>
      </div>

      <p v-if="error" class="popover-error" role="alert">{{ error }} <button type="button" @click="reload">Thử lại</button></p>
      <p v-if="message" class="popover-message" role="status">{{ message }}</p>

      <div class="popover-scroll">
        <div v-if="loading" class="popover-empty" role="status"><Loader2 :size="21" class="spin" /> Đang tải…</div>
        <template v-else-if="filter === 'muted'">
          <p class="section-caption">Các truyện này sẽ không gửi thông báo mới, dù bạn có đọc, lưu hay theo dõi.</p>
          <div v-if="!muted.length" class="popover-empty"><Check :size="23" /> Chưa chặn thông báo truyện nào.</div>
          <ul v-else class="muted-stories">
            <li v-for="story in muted" :key="story.storyId">
              <span class="muted-name">{{ story.storyTitle }}</span>
              <button type="button" :disabled="!!busy" :aria-label="'Bật lại thông báo truyện ' + story.storyTitle" @click="restore(story)">
                <RotateCcw :size="14" /> Bật lại
              </button>
            </li>
          </ul>
        </template>
        <template v-else>
          <div v-if="visible.length" class="list-caption">
            <strong>{{ filter === 'unread' ? 'Chưa đọc' : 'Gần đây' }}</strong>
            <button v-if="filter === 'all'" type="button" :disabled="!!busy" @click="clearAll"><Trash2 :size="13" /> Xóa tất cả</button>
          </div>
          <div v-if="!visible.length" class="popover-empty">
            <Bell :size="26" />
            {{ filter === 'unread' ? 'Bạn đã xem hết thông báo.' : 'Chưa có thông báo chương mới.' }}
          </div>
          <ul v-else class="notification-items">
            <li v-for="item in visible" :key="item.chapterId" :class="{ 'is-unread': !item.read }">
              <button type="button" class="notification-open" :disabled="!!busy" :aria-label="'Đọc ' + item.chapterTitle + ' của ' + item.storyTitle" @click="open(item)">
                <span class="story-mark"><Bell :size="17" /></span>
                <span class="item-copy">
                  <strong>{{ item.storyTitle }}</strong>
                  <span class="chapter-title">{{ item.chapterTitle }}</span>
                  <time :datetime="item.createdAt">{{ relativeDate(item.createdAt) }}</time>
                </span>
                <span v-if="!item.read" class="new-dot" aria-label="Chưa đọc" />
              </button>
              <button type="button" class="more-btn" :aria-label="'Tùy chọn thông báo ' + item.chapterTitle" :aria-expanded="menuId === item.chapterId" :disabled="!!busy" @click="menuId = menuId === item.chapterId ? '' : item.chapterId">
                <MoreHorizontal :size="19" />
              </button>
              <div v-if="menuId === item.chapterId" class="item-menu">
                <button type="button" :disabled="!!busy" :aria-label="'Hủy nhận thông báo từ truyện ' + item.storyTitle" @click="cancelStory(item)"><BellOff :size="15" /> Hủy nhận từ truyện</button>
                <button type="button" :disabled="!!busy" :aria-label="'Xóa thông báo ' + item.chapterTitle" @click="dismiss(item)"><Trash2 :size="15" /> Xóa thông báo này</button>
              </div>
            </li>
          </ul>
        </template>
      </div>
      <footer class="popover-footer">
        <span><ChevronLeft :size="13" /> Thông báo dành riêng cho bạn</span>
        <button type="button" :disabled="loading || !!busy" @click="reload">Làm mới</button>
      </footer>
    </section>
  </Teleport>
</template>

<style scoped>
.notification-outside{position:fixed;inset:0;z-index:1190;background:transparent}
.notification-popover{position:fixed;left:85px;z-index:1191;width:min(365px,calc(100vw - 96px));max-height:min(560px,calc(100dvh - 24px));display:flex;flex-direction:column;overflow:hidden;border-radius:17px;background:var(--library-surface,#faf9f5);color:var(--library-ink,#29382c);box-shadow:0 10px 45px rgba(15,30,19,.18),0 1px 5px rgba(15,30,19,.1);border:1px solid rgba(60,85,65,.1);font:inherit;outline:none}
.popover-heading{display:flex;align-items:center;justify-content:space-between;padding:18px 18px 8px;gap:10px}
.heading-title{display:flex;align-items:center;gap:9px}
.heading-title h2{font-size:19px;font-weight:700;line-height:1.2;margin:0}
.unread-pill{background:#bb4b45;color:white;border-radius:30px;font-size:10px;font-weight:700;line-height:1;padding:5px 7px}
.circle-btn{display:grid;place-items:center;width:29px;height:29px;background:rgba(70,85,75,.07);color:inherit;border:0;border-radius:50%;cursor:pointer}
.popover-tabs{display:flex;align-items:center;gap:5px;padding:7px 15px 10px;border-bottom:1px solid rgba(60,80,60,.1)}
.popover-tabs button{padding:7px 10px;border:0;border-radius:18px;background:transparent;color:var(--library-muted,#68786c);font-size:11px;font-weight:650;cursor:pointer}
.popover-tabs button.selected{background:rgba(67,90,65,.12);color:var(--library-accent,#435a41)}
.popover-scroll{overflow-y:auto;overflow-x:hidden;min-height:100px;overscroll-behavior:contain;flex:1}
.list-caption{display:flex;justify-content:space-between;align-items:center;padding:12px 16px 5px;font-size:12px}
.list-caption button{display:flex;align-items:center;gap:5px;font-size:10px;border:0;background:transparent;color:var(--library-muted,#68786c);cursor:pointer}
.notification-items,.muted-stories{list-style:none;margin:0;padding:0 7px 8px}
.notification-items li{position:relative;display:flex;align-items:center;border-radius:11px;min-height:72px}
.notification-items li:hover,.notification-items li:focus-within{background:rgba(67,90,65,.065)}
.notification-items li.is-unread{background:rgba(67,90,65,.045)}
.notification-open{display:flex;align-items:center;gap:10px;flex:1;min-width:0;text-align:left;border:0;background:transparent;color:inherit;padding:10px 4px 10px 9px;cursor:pointer}
.story-mark{width:37px;height:37px;display:grid;place-items:center;flex:0 0 37px;border-radius:50%;background:rgba(67,90,65,.11);color:var(--library-accent,#435a41)}
.item-copy{display:flex;flex-direction:column;gap:3px;min-width:0;flex:1}
.item-copy strong{font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.chapter-title{font-size:11px;line-height:1.35;color:var(--library-muted,#68786c);display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden}
.item-copy time{font-size:10px;color:var(--library-accent,#435a41)}
.new-dot{width:7px;height:7px;flex:0 0 7px;border-radius:50%;background:#3685c5}
.more-btn{flex:0 0 28px;width:28px;height:30px;display:grid;place-items:center;margin-right:5px;border:0;border-radius:50%;background:transparent;color:var(--library-muted,#68786c);cursor:pointer}
.more-btn:hover,.more-btn[aria-expanded="true"]{background:rgba(67,90,65,.12)}
.item-menu{position:absolute;right:9px;top:57px;z-index:5;min-width:210px;background:var(--library-surface,#faf9f5);border:1px solid rgba(60,85,65,.12);border-radius:12px;padding:5px;box-shadow:0 5px 22px rgba(20,30,20,.15)}
.item-menu button{display:flex;align-items:center;gap:10px;width:100%;text-align:left;background:transparent;color:inherit;border:0;padding:11px 9px;border-radius:8px;font-size:11px;cursor:pointer}
.item-menu button:hover{background:rgba(67,90,65,.09)}
.popover-error,.popover-message{font-size:11px;line-height:1.5;margin:0;padding:9px 16px}
.popover-error{color:#aa4b3f}.popover-message{color:var(--library-accent,#435a41)}
.popover-error button{border:0;background:transparent;text-decoration:underline;color:inherit;cursor:pointer}
.popover-empty{padding:31px 20px;min-height:115px;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:9px;text-align:center;font-size:12px;color:var(--library-muted,#68786c)}
.section-caption{padding:10px 16px 3px;margin:0;font-size:11px;line-height:1.5;color:var(--library-muted,#68786c)}
.muted-stories li{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:12px 8px;border-radius:9px;font-size:12px}
.muted-stories li:hover{background:rgba(67,90,65,.05)}
.muted-name{min-width:0;overflow-wrap:anywhere}
.muted-stories button{display:flex;align-items:center;gap:4px;white-space:nowrap;background:transparent;border:0;color:var(--library-accent,#435a41);font-size:11px;cursor:pointer}
.popover-footer{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 16px;border-top:1px solid rgba(60,80,60,.1)}
.popover-footer span{display:flex;align-items:center;font-size:10px;color:var(--library-muted,#68786c);gap:2px}
.popover-footer button{border:0;background:transparent;font-size:11px;color:var(--library-accent,#435a41);font-weight:650;cursor:pointer}
button:disabled{opacity:.55;cursor:default}
.spin{animation:notification-spin 1s linear infinite}
@keyframes notification-spin{to{transform:rotate(360deg)}}
@media(max-width:520px){.notification-popover{left:70px;width:calc(100vw - 79px);border-radius:14px}.popover-heading{padding:13px 12px 5px}.popover-tabs{padding-left:8px;padding-right:8px;gap:1px}.popover-tabs button{padding:7px 7px;font-size:10px}.item-menu{right:4px;min-width:185px}}
@media(prefers-reduced-motion:reduce){.spin{animation:none}}
</style>

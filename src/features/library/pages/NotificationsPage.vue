<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Bell, BellRing, BellOff, Loader2, RefreshCw } from '@lucide/vue'
import LibrarySidebar from '../components/LibrarySidebar.vue'
import { createApiClient } from '../../../services/api-client'
import { friendlyError } from '../../../services/error-handler'

interface Notification {
  storyId: string; chapterId: string; storyTitle: string; chapterTitle: string
  createdAt: string; read: boolean
}
const router = useRouter()
const api = createApiClient()
const items = ref<Notification[]>([])
const mutedStoryIds = ref<string[]>([])
const muting = ref('')
const loading = ref(true)
const busy = ref('')
const error = ref('')
async function reload() {
  loading.value = true; error.value = ''
  try {
    const [result, muteData] = await Promise.all([
      api.request<{items: Notification[]}>('/api/notifications'),
      api.request<{ids: string[]}>('/api/notifications/muted'),
    ])
    items.value = result.items ?? []
    mutedStoryIds.value = muteData.ids ?? []
  } catch (cause) { error.value = friendlyError(cause) }
  finally { loading.value = false }
}
onMounted(reload)
async function openNotification(item: Notification) {
  if (busy.value) return
  busy.value = item.chapterId; error.value = ''
  try {
    await api.request('/api/notifications/' + encodeURIComponent(item.chapterId) + '/read', {method:'PUT'})
    item.read = true
    await router.push({path:'/library/stories/'+encodeURIComponent(item.storyId),query:{chapter:item.chapterId}})
  } catch (cause) { error.value = friendlyError(cause) }
  finally { busy.value = '' }
}
async function toggleMute(storyId: string) {
  if (muting.value || busy.value) return
  muting.value = storyId
  error.value = ''
  const alreadyMuted = mutedStoryIds.value.includes(storyId)
  try {
    await api.request('/api/notifications/mute/' + encodeURIComponent(storyId), {method: alreadyMuted ? 'DELETE' : 'POST'})
    mutedStoryIds.value = alreadyMuted
      ? mutedStoryIds.value.filter(id => id !== storyId)
      : [...mutedStoryIds.value, storyId]
  } catch (cause) { error.value = friendlyError(cause) }
  finally { muting.value = '' }
}
function date(s: string) {
  return new Intl.DateTimeFormat('vi-VN',{dateStyle:'medium',timeStyle:'short'}).format(new Date(s))
}
</script>
<template>
  <div class="notifications-layout">
    <LibrarySidebar />
    <main class="notifications-main">
      <header class="notifications-head">
        <div><p class="eyebrow">Dành riêng cho bạn</p><h1>Thông báo chương mới</h1>
          <p>Tự phát hiện chương mới từ truyện bạn đã lưu, đang đọc gần đây hoặc đang theo dõi. Bạn có thể tắt thông báo cho từng truyện.</p></div>
        <button type="button" aria-label="Làm mới thông báo" :disabled="loading" @click="reload"><RefreshCw :size="18" /></button>
      </header>
      <p v-if="error" role="alert" class="error">{{ error }}</p>
      <div v-if="loading" role="status" class="state"><Loader2 :size="24" /> Đang tải thông báo…</div>
      <div v-else-if="!items.length" class="state"><Bell :size="26" /> Chưa có chương mới từ những truyện bạn đã đọc, lưu hoặc theo dõi.</div>
      <ul v-else class="notification-list">
        <li v-for="item in items" :key="item.chapterId">
          <div class="notification-row"><button type="button" class="notification" :class="{ unread: !item.read }" :disabled="!!busy || !!muting" @click="openNotification(item)">
            <span class="notification-icon"><BellRing v-if="!item.read" :size="19" /><Bell v-else :size="19" /></span>
            <span class="notification-copy"><strong>{{ item.storyTitle }}</strong><span>{{ item.chapterTitle }}</span>
              <small>{{ date(item.createdAt) }}</small></span>
            <span v-if="!item.read" class="unread-dot" aria-label="Chưa đọc" />
          </button>
          <button type="button" class="mute-action" :disabled="!!muting || !!busy"
            :aria-label="(mutedStoryIds.includes(item.storyId) ? 'Bật lại' : 'Tắt') + ' thông báo truyện ' + item.storyTitle"
            :title="mutedStoryIds.includes(item.storyId) ? 'Bật lại thông báo truyện' : 'Tắt thông báo truyện'"
            @click="toggleMute(item.storyId)">
            <BellOff v-if="!mutedStoryIds.includes(item.storyId)" :size="17" />
            <Bell v-else :size="17" />
          </button></div>
        </li>
      </ul>
    </main>
  </div>
</template>
<style scoped>
.notifications-layout{height:100dvh;display:flex;background:var(--library-surface,#f6f5ef);color:var(--library-ink,#283b2c);overflow:hidden}
.notifications-main{flex:1;min-width:0;overflow:auto;padding:56px clamp(20px,6vw,90px)}
.notifications-head{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin-bottom:40px}
.notifications-head h1{font:400 clamp(28px,3vw,40px)/1.2 var(--serif,Georgia,serif);margin:10px 0}
.notifications-head p{font-size:12px;color:var(--library-muted,#68786c);line-height:1.7}
.eyebrow{letter-spacing:.14em;text-transform:uppercase;font-size:10px!important}
.notifications-head button{padding:12px;background:transparent;color:inherit;border:0;cursor:pointer}
.notification-list{list-style:none;display:grid;gap:3px;max-width:850px;margin:0;padding:0}
.notification-row{display:flex;align-items:center;gap:4px}.mute-action{display:grid;place-items:center;flex:0 0 42px;width:42px;height:42px;border:0;border-radius:50%;background:transparent;color:var(--library-muted,#68786c);cursor:pointer}.mute-action:hover{background:color-mix(in oklab,var(--library-accent,#435a41) 9%,transparent)}.mute-action:disabled{opacity:.4}.notification{display:flex;align-items:center;gap:16px;text-align:left;width:100%;padding:19px 16px;border:0;border-radius:12px;background:transparent;color:inherit;cursor:pointer}
.notification:hover,.notification:focus-visible{background:color-mix(in oklab,var(--library-accent,#435a41) 9%,transparent)}
.notification.unread{background:color-mix(in oklab,var(--library-accent,#435a41) 5%,transparent)}
.notification-icon{display:grid;place-items:center;width:43px;height:43px;color:var(--library-accent,#435a41)}
.notification-copy{display:grid;gap:5px;flex:1;min-width:0}
.notification-copy strong{font-size:14px}.notification-copy span{font-size:12px}.notification-copy small{font-size:10px;color:var(--library-muted,#68786c)}
.unread-dot{width:7px;height:7px;border-radius:50%;background:var(--library-accent,#435a41)}
.state{display:flex;align-items:center;gap:12px;padding:40px 8px;font-size:13px;color:var(--library-muted,#68786c)}
.error{color:#a34b4b;font-size:12px}
@media(max-width:700px){.notifications-main{padding:30px 18px}}
</style>

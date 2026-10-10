<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Bell, BellRing, BellOff, Loader2, RefreshCw, Trash2, RotateCcw } from '@lucide/vue'
import LibrarySidebar from '../components/LibrarySidebar.vue'
import { createApiClient } from '../../../services/api-client'
import { friendlyError } from '../../../services/error-handler'

interface MutedStory { storyId: string; storyTitle: string }
interface Notification {
  storyId: string; chapterId: string; storyTitle: string; chapterTitle: string
  createdAt: string; read: boolean
}
const router = useRouter()
const api = createApiClient()
const items = ref<Notification[]>([])
const mutedStories = ref<MutedStory[]>([])
const actionBusy = ref('')
const notice = ref('')
const loading = ref(true)
const busy = ref('')
const error = ref('')
async function reload() {
  loading.value = true; error.value = ''
  try {
    const [result, muteData] = await Promise.all([
      api.request<{items: Notification[]}>('/api/notifications'),
      api.request<{items: MutedStory[]}>('/api/notifications/muted/stories'),
    ])
    items.value = result.items ?? []
    mutedStories.value = muteData.items ?? []
  } catch (cause) { error.value = friendlyError(cause) }
  finally { loading.value = false }
}
onMounted(reload)
async function openNotification(item: Notification) {
  if (busy.value || actionBusy.value) return
  busy.value = item.chapterId; error.value = ''
  try {
    await api.request('/api/notifications/' + encodeURIComponent(item.chapterId) + '/read', {method:'PUT'})
    item.read = true
    await router.push({path:'/library/stories/'+encodeURIComponent(item.storyId),query:{chapter:item.chapterId}})
  } catch (cause) { error.value = friendlyError(cause) }
  finally { busy.value = '' }
}
async function cancelStory(item: Notification) {
  if (actionBusy.value || busy.value) return
  actionBusy.value = item.storyId
  notice.value = ''; error.value = ''
  try {
    await api.request('/api/notifications/mute/' + encodeURIComponent(item.storyId), {method: 'POST'})
    items.value = items.value.filter(notification => notification.storyId !== item.storyId)
    if (!mutedStories.value.some(story => story.storyId === item.storyId)) {
      mutedStories.value = [...mutedStories.value, {storyId: item.storyId, storyTitle: item.storyTitle}]
    }
    notice.value = 'Đã hủy thông báo từ “' + item.storyTitle + '”. Các chương mới cũng sẽ không gửi thông báo cho đến khi bạn bật lại.'
  } catch (cause) { error.value = friendlyError(cause) }
  finally { actionBusy.value = '' }
}
async function restoreStory(story: MutedStory) {
  if (actionBusy.value || busy.value) return
  actionBusy.value = story.storyId
  error.value = ''; notice.value = ''
  try {
    await api.request('/api/notifications/mute/' + encodeURIComponent(story.storyId), {method: 'DELETE'})
    mutedStories.value = mutedStories.value.filter(item => item.storyId !== story.storyId)
    notice.value = 'Đã bật lại thông báo chương mới từ “' + story.storyTitle + '”.'
  } catch (cause) { error.value = friendlyError(cause) }
  finally { actionBusy.value = '' }
}
async function dismissNotification(item: Notification) {
  if (actionBusy.value || busy.value) return
  actionBusy.value = item.chapterId
  error.value = ''; notice.value = ''
  try {
    await api.request('/api/notifications/' + encodeURIComponent(item.chapterId), {method: 'DELETE'})
    items.value = items.value.filter(entry => entry.chapterId !== item.chapterId)
    notice.value = 'Đã xóa thông báo này. Các chương mới vẫn có thể được gửi.'
  } catch (cause) { error.value = friendlyError(cause) }
  finally { actionBusy.value = '' }
}
async function clearAll() {
  if (actionBusy.value || busy.value || !items.value.length) return
  if (!window.confirm('Xóa tất cả thông báo đã nhận? Thao tác này không chặn thông báo chương mới.')) return
  actionBusy.value = 'all'
  error.value = ''; notice.value = ''
  try {
    await api.request('/api/notifications', {method: 'DELETE'})
    items.value = []
    notice.value = 'Đã xóa tất cả thông báo đã nhận.'
  } catch (cause) { error.value = friendlyError(cause) }
  finally { actionBusy.value = '' }
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
          <p>Tự phát hiện chương mới từ truyện bạn đã lưu, đang đọc gần đây hoặc đang theo dõi. Bạn có thể hủy nhận từ một truyện bất kỳ hoặc chỉ xóa một thông báo riêng lẻ.</p></div>
        <button type="button" aria-label="Làm mới thông báo" :disabled="loading" @click="reload"><RefreshCw :size="18" /></button>
      </header>
      <p v-if="error" role="alert" class="error">{{ error }}</p>
      <p v-if="notice" role="status" class="notice">{{ notice }}</p>
      <div v-if="items.length" class="inbox-actions">
        <span>{{ items.length }} thông báo gần nhất</span>
        <button type="button" :disabled="!!actionBusy || !!busy || loading" @click="clearAll">
          <Trash2 :size="15" /> Xóa tất cả
        </button>
      </div>
      <div v-if="loading" role="status" class="state"><Loader2 :size="24" /> Đang tải thông báo…</div>
      <div v-else-if="!items.length" class="state"><Bell :size="26" /> Chưa có chương mới từ những truyện bạn đã đọc, lưu hoặc theo dõi.</div>
      <ul v-else class="notification-list">
        <li v-for="item in items" :key="item.chapterId">
          <div class="notification-row"><button type="button" class="notification" :class="{ unread: !item.read }" :disabled="!!busy || !!actionBusy" @click="openNotification(item)">
            <span class="notification-icon"><BellRing v-if="!item.read" :size="19" /><Bell v-else :size="19" /></span>
            <span class="notification-copy"><strong>{{ item.storyTitle }}</strong><span>{{ item.chapterTitle }}</span>
              <small>{{ date(item.createdAt) }}</small></span>
            <span v-if="!item.read" class="unread-dot" aria-label="Chưa đọc" />
          </button>
          <div class="item-actions">
            <button type="button" class="mute-action mute-story-action" :disabled="!!actionBusy || !!busy"
              :aria-label="'Hủy nhận thông báo từ truyện ' + item.storyTitle"
              title="Hủy và chặn mọi thông báo chương mới từ truyện này"
              @click="cancelStory(item)">
              <BellOff :size="17" /><span>Hủy nhận</span>
            </button>
            <button type="button" class="mute-action" :disabled="!!actionBusy || !!busy"
              :aria-label="'Xóa thông báo ' + item.chapterTitle + ' của truyện ' + item.storyTitle"
              title="Xóa thông báo này (không chặn chương mới)"
              @click="dismissNotification(item)">
              <Trash2 :size="16" />
            </button>
          </div></div>
        </li>
      </ul>
      <section v-if="mutedStories.length" class="muted-section" aria-labelledby="muted-heading">
        <h2 id="muted-heading"><BellOff :size="18" /> Truyện đã hủy nhận thông báo</h2>
        <p>Những truyện này sẽ không tạo thêm thông báo, dù bạn đã lưu, đang đọc hay vẫn theo dõi. Có thể bật lại bất cứ lúc nào.</p>
        <ul class="muted-list">
          <li v-for="story in mutedStories" :key="story.storyId">
            <span>{{ story.storyTitle }}</span>
            <button type="button" :disabled="!!actionBusy || !!busy"
              :aria-label="'Bật lại thông báo truyện ' + story.storyTitle"
              @click="restoreStory(story)">
              <RotateCcw :size="15" /> Bật lại
            </button>
          </li>
        </ul>
      </section>
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
.inbox-actions{display:flex;justify-content:space-between;align-items:center;gap:14px;max-width:850px;margin:10px 0 15px;font-size:11px;color:var(--library-muted,#68786c)}
.inbox-actions button{display:flex;align-items:center;gap:7px;border:0;padding:10px 13px;background:transparent;color:inherit;cursor:pointer}
.inbox-actions button:hover{color:#9b4c4c}.inbox-actions button:disabled{opacity:.4}
.notice{font-size:12px;line-height:1.6;color:var(--library-accent,#435a41);margin-bottom:15px}
.item-actions{display:flex;align-items:center;gap:3px}
.mute-story-action{display:flex!important;gap:7px;align-items:center;justify-content:center;width:auto!important;flex:0 0 auto!important;padding:0 10px!important;font-size:11px;white-space:nowrap}
@media(max-width:600px){.mute-story-action{font-size:0;gap:0}.mute-story-action span{display:none}}
.muted-section{max-width:850px;margin-top:60px;padding-top:28px;border-top:1px solid color-mix(in oklab,var(--library-muted,#68786c) 22%,transparent)}
.muted-section h2{display:flex;gap:10px;align-items:center;font:500 17px var(--serif,Georgia,serif)}
.muted-section>p{font-size:12px;line-height:1.7;color:var(--library-muted,#68786c)}
.muted-list{list-style:none;margin:20px 0;padding:0;display:grid;gap:8px}
.muted-list li{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:13px 16px;background:color-mix(in oklab,var(--library-accent,#435a41) 6%,transparent);border-radius:9px;font-size:13px}
.muted-list button{display:flex;align-items:center;gap:8px;white-space:nowrap;background:transparent;border:0;color:var(--library-accent,#435a41);font-size:12px;cursor:pointer}
.muted-list button:disabled{opacity:.4}
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

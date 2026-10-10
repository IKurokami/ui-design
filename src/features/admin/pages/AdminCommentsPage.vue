<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Check, X, RefreshCw, MessageSquare, ArrowLeft } from '@lucide/vue'
import { createApiClient } from '../../../services/api-client'
import { friendlyError } from '../../../services/error-handler'

interface PendingComment {
  id: string; storyId: string; userId: string
  authorName: string; body: string; createdAt: string
}
const api = createApiClient()
const router = useRouter()
const comments = ref<PendingComment[]>([])
const loading = ref(true)
const pending = ref('')
const error = ref('')
const notice = ref('')
async function reload() {
  loading.value = true; error.value = ''
  try {
    const response = await api.request<{items: PendingComment[]}>('/api/admin/comments')
    comments.value = response.items ?? []
  } catch (cause) { error.value = friendlyError(cause) }
  finally { loading.value = false }
}
onMounted(reload)
async function moderate(comment: PendingComment, status: 'approved' | 'rejected') {
  if (pending.value) return
  pending.value = comment.id
  error.value = ''; notice.value = ''
  try {
    await api.request('/api/admin/comments/' + encodeURIComponent(comment.id), {
      method:'PUT',body:JSON.stringify({status}),
    })
    comments.value = comments.value.filter(item => item.id !== comment.id)
    notice.value = status === 'approved' ? 'Đã duyệt bình luận.' : 'Đã từ chối bình luận.'
  } catch (cause) { error.value = friendlyError(cause) }
  finally { pending.value = '' }
}
</script>
<template>
  <div class="moderation-shell">
    <nav class="moderation-nav">
      <button type="button" @click="router.push('/admin')"><ArrowLeft :size="17" /> Quản trị</button>
    </nav>
    <main class="moderation-main">
      <header class="moderation-head">
        <div><p class="eyebrow">Kiểm duyệt nội dung</p><h1>Bình luận chờ duyệt</h1>
        <p>Bình luận chỉ xuất hiện với các độc giả khác sau khi admin hoặc moderator phê duyệt.</p></div>
        <button type="button" aria-label="Làm mới danh sách" @click="reload"><RefreshCw :size="19" /></button>
      </header>
      <p v-if="error" role="alert" class="error">{{ error }}</p>
      <p v-if="notice" role="status" class="notice">{{ notice }}</p>
      <div v-if="loading" class="empty">Đang tải danh sách…</div>
      <div v-else-if="!comments.length" class="empty"><MessageSquare :size="25" /> Không có bình luận chờ duyệt.</div>
      <ul v-else class="moderation-list">
        <li v-for="comment in comments" :key="comment.id">
          <div class="meta"><strong>{{ comment.authorName }}</strong><time :datetime="comment.createdAt">{{ new Date(comment.createdAt).toLocaleString('vi-VN') }}</time></div>
          <p>{{ comment.body }}</p>
          <div class="actions">
            <button type="button" :disabled="!!pending" @click="moderate(comment,'approved')"><Check :size="16" /> Duyệt</button>
            <button type="button" class="reject" :disabled="!!pending" @click="moderate(comment,'rejected')"><X :size="16" /> Từ chối</button>
          </div>
        </li>
      </ul>
    </main>
  </div>
</template>
<style scoped>
.moderation-shell{height:100dvh;display:flex;background:#f6f7f2;color:#253628;overflow:hidden}
.moderation-nav{flex:0 0 190px;padding:36px 16px;background:#e8eee5}
.moderation-nav button{display:flex;align-items:center;gap:9px;background:transparent;border:0;padding:12px;color:#435a41;cursor:pointer}
.moderation-main{flex:1;overflow:auto;padding:56px clamp(18px,6vw,90px)}
.moderation-head{display:flex;justify-content:space-between;gap:20px;margin-bottom:32px}
.moderation-head h1{font:400 36px/1.2 var(--serif,Georgia,serif);margin:10px 0}
.moderation-head p{font-size:12px;color:#758273}.moderation-head .eyebrow{letter-spacing:.13em;text-transform:uppercase;font-size:10px}
.moderation-head button{background:none;border:0;color:#435a41;cursor:pointer;align-self:flex-start;padding:8px}
.moderation-list{padding:0;margin:0;list-style:none;display:grid;max-width:850px;gap:16px}
.moderation-list li{padding:23px 25px;border-radius:10px;background:#fff}
.meta{display:flex;gap:18px;align-items:center}.meta strong{font-size:13px}.meta time{font-size:11px;color:#7f8c7c}
.moderation-list li>p{white-space:pre-wrap;overflow-wrap:anywhere;font-size:14px;line-height:1.7;margin:17px 0}
.actions{display:flex;gap:10px;flex-wrap:wrap}.actions button{display:flex;align-items:center;gap:8px;border:0;border-radius:6px;background:#456748;color:#fff;font-size:12px;padding:9px 14px;cursor:pointer}
.actions button.reject{color:#8d4741;background:#f3e8e6}.actions button:disabled{opacity:.4;cursor:not-allowed}
.empty{display:flex;align-items:center;gap:10px;padding:50px 0;font-size:13px;color:#81907d}.error{color:#a44747;font-size:12px}.notice{color:#456748;font-size:12px}
@media(max-width:700px){.moderation-nav{flex-basis:62px}.moderation-nav button{font-size:0}.moderation-main{padding:30px 16px}}
</style>

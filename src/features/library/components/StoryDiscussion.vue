<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { MessageCircle, Send, Trash2 } from '@lucide/vue'
import { createApiClient } from '../../../services/api-client'
import { friendlyError } from '../../../services/error-handler'
import { useAuthStore } from '../../../stores/auth.store'

interface Comment {
  id: string; userId: string; authorName: string; body: string
  status: 'pending' | 'approved' | 'rejected'; createdAt: string
}
const props = defineProps<{ storyId: string }>()
const api = createApiClient()
const auth = useAuthStore()
const entries = ref<Comment[]>([])
const input = ref('')
const busy = ref(false)
const loading = ref(true)
const error = ref('')
const notice = ref('')
let requestId = 0
async function load() {
  const id = ++requestId
  loading.value = true
  error.value = ''
  try {
    const response = await api.request<{ items: Comment[] }>('/api/stories/' + encodeURIComponent(props.storyId) + '/comments')
    if (id === requestId) entries.value = response.items ?? []
  } catch (cause) { if (id === requestId) error.value = friendlyError(cause) }
  finally { if (id === requestId) loading.value = false }
}
onMounted(load)
watch(() => props.storyId, () => { input.value = ''; void load() })
async function post() {
  const body = input.value.trim()
  if (body.length < 3 || body.length > 2000 || busy.value) return
  busy.value = true; error.value = ''; notice.value = ''
  try {
    await api.request('/api/stories/' + encodeURIComponent(props.storyId) + '/comments', {
      method: 'POST', body: JSON.stringify({ body }),
    })
    input.value = ''
    notice.value = 'Đã gửi bình luận. Bình luận sẽ hiển thị công khai sau khi được duyệt.'
    await load()
  } catch (cause) { error.value = friendlyError(cause) }
  finally { busy.value = false }
}
async function remove(id: string) {
  if (busy.value) return
  busy.value = true
  try {
    await api.request('/api/comments/' + encodeURIComponent(id), { method: 'DELETE' })
    entries.value = entries.value.filter(comment => comment.id !== id)
  } catch (cause) { error.value = friendlyError(cause) }
  finally { busy.value = false }
}
</script>

<template>
  <section class="discussion" aria-labelledby="story-discussion-title">
    <h3 id="story-discussion-title"><MessageCircle :size="19" /> Thảo luận</h3>
    <p class="discussion-hint">Bình luận được kiểm duyệt trước khi hiển thị công khai. Hãy trao đổi lịch sự.</p>
    <form class="comment-form" @submit.prevent="post">
      <label for="reader-comment">Ý kiến của bạn</label>
      <textarea id="reader-comment" v-model="input" maxlength="2000" rows="3" placeholder="Chia sẻ cảm nhận về câu chuyện…" />
      <div class="comment-actions"><span>{{ input.trim().length }} / 2000</span>
        <button type="submit" :disabled="busy || input.trim().length < 3"><Send :size="15" /> Gửi bình luận</button>
      </div>
    </form>
    <p v-if="notice" role="status" class="comment-notice">{{ notice }}</p>
    <p v-if="error" role="alert" class="comment-error">{{ error }}</p>
    <p v-if="loading" class="comment-muted">Đang tải thảo luận…</p>
    <p v-else-if="!entries.length" class="comment-muted">Chưa có bình luận. Hãy là người đầu tiên chia sẻ.</p>
    <ol v-else class="comment-list">
      <li v-for="entry in entries" :key="entry.id">
        <div class="comment-header"><strong>{{ entry.authorName }}</strong>
          <span v-if="entry.status === 'pending'" class="pending">Chờ duyệt</span>
          <button v-if="entry.userId === auth.user?.id" type="button" :disabled="busy" :aria-label="'Xóa bình luận của '+entry.authorName" @click="remove(entry.id)"><Trash2 :size="14" /></button>
        </div>
        <p>{{ entry.body }}</p>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.discussion{margin-top:60px;padding-top:26px;border-top:1px solid color-mix(in oklab,var(--reader-muted) 25%,transparent);font:inherit}
.discussion h3{display:flex;align-items:center;gap:10px;font-size:17px;font-weight:600}
.discussion-hint,.comment-muted{font-size:12px;line-height:1.7;color:var(--reader-muted);margin:8px 0 22px}
.comment-form{display:grid;gap:9px}.comment-form label{font-size:12px;color:var(--reader-muted)}
.comment-form textarea{width:100%;padding:15px;border:1px solid color-mix(in oklab,var(--reader-muted) 25%,transparent);border-radius:9px;background:var(--reader-tint);color:var(--reader-ink);font:inherit;font-size:13px;line-height:1.7;resize:vertical}
.comment-actions,.comment-header{display:flex;align-items:center;justify-content:space-between;gap:14px}
.comment-actions span{font-size:11px;color:var(--reader-muted)}
.comment-actions button{display:inline-flex;align-items:center;gap:8px;padding:10px 14px;border:0;border-radius:9px;background:var(--reader-accent);color:var(--reader-surface);cursor:pointer}
.comment-actions button:disabled{opacity:.45;cursor:not-allowed}
.comment-error{color:#c65757;font-size:12px}.comment-notice{color:var(--reader-accent);font-size:12px}
.comment-list{list-style:none;margin:26px 0 0;padding:0;display:grid;gap:12px}.comment-list li{padding:16px 0;border-bottom:1px solid color-mix(in oklab,var(--reader-muted) 15%,transparent)}
.comment-header strong{font-size:12px}.comment-header button{margin-left:auto;padding:4px}.comment-list li p{white-space:pre-wrap;overflow-wrap:anywhere;margin:8px 0 0;font-size:13px;line-height:1.7}
.pending{font-size:10px;color:var(--reader-muted);background:var(--reader-tint);padding:4px 9px;border-radius:20px}
</style>

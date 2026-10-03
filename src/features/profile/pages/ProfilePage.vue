<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import {
  Camera,
  Check,
  Loader2,
  Pencil,
  X,
} from '@lucide/vue'
import LibrarySidebar from '../../library/components/LibrarySidebar.vue'
import UserAvatar from '../../../components/ui/UserAvatar.vue'
import { useAuthStore } from '../../../stores/auth.store'
import { createApiClient } from '../../../services/api-client'

interface ProfileData {
  id: string
  userId: string
  displayName: string
  email: string
  avatarUrl: string | null
  bannerUrl: string | null
  bio: string | null
}

const authStore = useAuthStore()
const client = createApiClient()

const saving = ref(false)
const uploadingAvatar = ref(false)
const uploadingBanner = ref(false)

const toast = reactive({
  show: false,
  message: '',
  type: 'success' as 'success' | 'error',
  timeoutId: 0 as any,
})

function showToast(message: string, type: 'success' | 'error' = 'success') {
  clearTimeout(toast.timeoutId)
  toast.message = message
  toast.type = type
  toast.show = true
  toast.timeoutId = setTimeout(() => {
    toast.show = false
  }, 2500)
}

const profile = ref<ProfileData>({
  id: '',
  userId: '',
  displayName: authStore.user?.displayName || 'Người dùng',
  email: authStore.user?.email || '',
  avatarUrl: null,
  bannerUrl: null,
  bio: null,
})

const editingField = ref<'displayName' | 'bio' | null>(null)
const tempValues = reactive({
  displayName: '',
  bio: '',
})

const nameInputRef = ref<HTMLInputElement>()
const bioInputRef = ref<HTMLTextAreaElement>()
const avatarInputRef = ref<HTMLInputElement>()
const bannerInputRef = ref<HTMLInputElement>()

const userSeed = computed(() => profile.value.email || profile.value.displayName || profile.value.userId || 'moc-user')

async function loadProfile() {
  try {
    const data = await client.request<ProfileData>('/api/profile/me')
    if (data) {
      profile.value = {
        ...data,
      }
    }
  } catch (err: any) {
    showToast(err.message || 'Không thể tải thông tin', 'error')
  }
}

onMounted(() => {
  loadProfile()
})

function startEdit(field: 'displayName' | 'bio') {
  editingField.value = field
  tempValues[field] = profile.value[field] || ''

  nextTick(() => {
    if (field === 'displayName') nameInputRef.value?.focus()
    else if (field === 'bio') bioInputRef.value?.focus()
  })
}

function cancelEdit() {
  editingField.value = null
}

async function saveField(field: 'displayName' | 'bio') {
  saving.value = true
  const value = tempValues[field].trim()
  const payload: Record<string, string> = { [field]: value }

  try {
    const updated = await client.request<ProfileData>('/api/profile/me', {
      method: 'PUT',
      body: JSON.stringify(payload),
    })

    if (updated) {
      profile.value = {
        ...profile.value,
        ...updated,
      }
    } else {
      profile.value[field] = value
    }

    if (field === 'displayName' && authStore.user) {
      authStore.user.displayName = value
    }

    editingField.value = null
    showToast('Đã lưu!')
  } catch (err: any) {
    showToast(err.message || 'Lỗi khi lưu', 'error')
  } finally {
    saving.value = false
  }
}

function triggerAvatarUpload() {
  if (!uploadingAvatar.value) {
    avatarInputRef.value?.click()
  }
}

function triggerBannerUpload() {
  if (!uploadingBanner.value) {
    bannerInputRef.value?.click()
  }
}

async function uploadFile(file: File): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)

  const res = await client.request<{ url: string }>('/api/upload', {
    method: 'POST',
    body: formData,
  })
  return res.url
}

async function handleAvatarChange(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  uploadingAvatar.value = true
  try {
    const url = await uploadFile(file)
    profile.value.avatarUrl = url
    await client.request('/api/profile/me', {
      method: 'PUT',
      body: JSON.stringify({ avatarUrl: url }),
    })
    showToast('Đã đổi avatar!')
  } catch (err: any) {
    showToast(err.message || 'Lỗi tải ảnh', 'error')
  } finally {
    uploadingAvatar.value = false
    target.value = ''
  }
}

async function handleBannerChange(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  uploadingBanner.value = true
  try {
    const url = await uploadFile(file)
    profile.value.bannerUrl = url
    await client.request('/api/profile/me', {
      method: 'PUT',
      body: JSON.stringify({ bannerUrl: url }),
    })
    showToast('Đã đổi banner!')
  } catch (err: any) {
    showToast(err.message || 'Lỗi tải ảnh', 'error')
  } finally {
    uploadingBanner.value = false
    target.value = ''
  }
}
</script>

<template>
  <div class="profile-layout">
    <LibrarySidebar />

    <main class="profile-main">
      <Transition name="toast">
        <div v-if="toast.show" class="profile-toast" :class="toast.type">
          <Check v-if="toast.type === 'success'" :size="14" />
          <X v-else :size="14" />
          <span>{{ toast.message }}</span>
        </div>
      </Transition>

      <input
        ref="avatarInputRef"
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        class="hidden-input"
        @change="handleAvatarChange"
      />
      <input
        ref="bannerInputRef"
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        class="hidden-input"
        @change="handleBannerChange"
      />

      <div class="profile-content">
        <!-- 1. Banner (Không viền, không bóng, nhấp để đổi) -->
        <div
          class="profile-banner-wrap"
          role="button"
          tabindex="0"
          title="Nhấp để đổi ảnh bìa"
          @click="triggerBannerUpload"
        >
          <img
            v-if="profile.bannerUrl"
            :src="profile.bannerUrl"
            alt="Ảnh bìa"
            class="banner-img"
          />
          <div v-else class="banner-default" />

          <div class="banner-hover-hint">
            <Loader2 v-if="uploadingBanner" :size="18" class="spin" />
            <Camera v-else :size="18" />
            <span>{{ uploadingBanner ? 'Đang tải lên...' : 'Đổi ảnh bìa' }}</span>
          </div>
        </div>

        <!-- 2. Avatar & Identity & Bio -->
        <div class="profile-meta-wrap">
          <!-- Avatar (Nhấp để đổi) -->
          <div
            class="profile-avatar-wrap"
            role="button"
            tabindex="0"
            title="Nhấp để đổi ảnh đại diện"
            @click="triggerAvatarUpload"
          >
            <UserAvatar
              :src="profile.avatarUrl"
              :seed="userSeed"
              :name="profile.displayName"
              :size="96"
            />
            <div class="avatar-hover-hint">
              <Loader2 v-if="uploadingAvatar" :size="20" class="spin" />
              <Camera v-else :size="20" />
            </div>
          </div>

          <!-- Thông tin người dùng -->
          <div class="identity-section">
            <!-- Tên (Nhấp vào để sửa) -->
            <div
              v-if="editingField !== 'displayName'"
              class="name-display"
              role="button"
              tabindex="0"
              title="Nhấp để sửa tên"
              @click="startEdit('displayName')"
            >
              <h2>{{ profile.displayName }}</h2>
              <Pencil :size="14" class="edit-icon" />
            </div>

            <div v-else class="name-edit-box">
              <input
                ref="nameInputRef"
                v-model="tempValues.displayName"
                type="text"
                class="name-input"
                placeholder="Tên người dùng..."
                maxlength="60"
                @keydown.enter="saveField('displayName')"
                @keydown.esc="cancelEdit"
              />
              <button type="button" class="btn-action btn-confirm" title="Lưu" :disabled="saving" @click="saveField('displayName')">
                <Check :size="15" />
              </button>
              <button type="button" class="btn-action btn-cancel" title="Hủy" @click="cancelEdit">
                <X :size="15" />
              </button>
            </div>

            <p class="user-email">{{ profile.email }}</p>

            <!-- Bio: Hiển thị bio hoặc No bio, nhấp vào biến thành text field để edit -->
            <div class="bio-wrap">
              <p
                v-if="editingField !== 'bio'"
                class="bio-content-text"
                :class="{ 'is-empty': !profile.bio }"
                role="button"
                tabindex="0"
                title="Nhấp để sửa bio"
                @click="startEdit('bio')"
              >
                {{ profile.bio || 'No bio' }}
              </p>

              <div v-else class="bio-edit-box">
                <textarea
                  ref="bioInputRef"
                  v-model="tempValues.bio"
                  rows="3"
                  class="bio-textarea"
                  placeholder="No bio"
                  maxlength="500"
                  @keydown.ctrl.enter="saveField('bio')"
                  @keydown.esc="cancelEdit"
                />
                <div class="bio-edit-actions">
                  <button type="button" class="btn-text btn-cancel" @click="cancelEdit">
                    Hủy
                  </button>
                  <button type="button" class="btn-text btn-save" :disabled="saving" @click="saveField('bio')">
                    <Loader2 v-if="saving" :size="13" class="spin" />
                    <Check v-else :size="13" />
                    <span>Lưu</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.profile-layout {
  position: relative;
  display: flex;
  height: 100dvh;
  width: 100%;
  background-color: var(--library-surface, #fbfaf7);
  color: var(--library-ink, #303b2f);
  overflow: hidden;
}

.profile-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 24px 36px 60px;
}

.profile-content {
  max-width: 680px;
  margin: 0 auto;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Toast */
.profile-toast {
  position: fixed;
  top: 24px;
  right: 28px;
  z-index: 100;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: 6px;
  font-size: 13px;
  pointer-events: none;
}

.profile-toast.success {
  background-color: #2e4a2c;
  color: #f7faf7;
}

.profile-toast.error {
  background-color: #8c2e26;
  color: #fff5f5;
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.2s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

/* 1. Banner (Không viền, không bóng) */
.profile-banner-wrap {
  position: relative;
  width: 100%;
  height: 180px;
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  background-color: #e6eae4;
  border: 0;
  box-shadow: none;
}

.banner-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.banner-default {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #445942 0%, #293828 100%);
}

.banner-hover-hint {
  position: absolute;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.3);
  opacity: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #ffffff;
  font-size: 13px;
  font-weight: 500;
  transition: opacity 0.2s ease;
}

.profile-banner-wrap:hover .banner-hover-hint {
  opacity: 1;
}

/* 2. Avatar & Meta */
.profile-meta-wrap {
  display: flex;
  align-items: flex-start;
  gap: 20px;
  margin-top: -36px;
  padding: 0 4px;
}

.profile-avatar-wrap {
  position: relative;
  width: 96px;
  height: 96px;
  border-radius: 50%;
  cursor: pointer;
  flex-shrink: 0;
  border: 0;
  box-shadow: none;
  background: transparent;
}

.profile-avatar-wrap :deep(.user-avatar-wrap) {
  width: 100% !important;
  height: 100% !important;
  box-shadow: none !important;
}

.avatar-hover-hint {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background-color: rgba(0, 0, 0, 0.4);
  color: #ffffff;
  display: grid;
  place-items: center;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.profile-avatar-wrap:hover .avatar-hover-hint {
  opacity: 1;
}

.identity-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 42px;
  flex: 1;
}

/* Tên */
.name-display {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 2px 4px;
  margin-left: -4px;
  border-radius: 4px;
  transition: background-color 0.15s ease;
}

.name-display:hover {
  background-color: rgba(67, 90, 65, 0.08);
}

.name-display h2 {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: var(--sidebar-ink, #303b2f);
  letter-spacing: -0.3px;
}

.edit-icon {
  opacity: 0;
  color: var(--muted, #7b8073);
  transition: opacity 0.15s ease;
}

.name-display:hover .edit-icon {
  opacity: 1;
}

.name-edit-box {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.name-input {
  font-size: 20px;
  font-weight: 700;
  padding: 2px 0;
  background: transparent;
  border: 0;
  border-bottom: 2px solid var(--green, #435a41);
  color: var(--sidebar-ink, #303b2f);
  outline: none;
  border-radius: 0;
  box-shadow: none;
}

.btn-action {
  width: 26px;
  height: 26px;
  border-radius: 4px;
  border: 0;
  display: grid;
  place-items: center;
  cursor: pointer;
  background: transparent;
  color: var(--muted, #7b8073);
}

.btn-confirm {
  color: var(--green, #435a41);
}

.btn-confirm:hover {
  background-color: rgba(67, 90, 65, 0.1);
}

.btn-cancel:hover {
  background-color: rgba(0, 0, 0, 0.06);
}

.user-email {
  margin: 0;
  font-size: 13px;
  color: var(--muted, #7b8073);
}

/* 3. Bio */
.bio-wrap {
  margin-top: 8px;
}

.bio-content-text {
  margin: 0;
  font-size: 14.5px;
  line-height: 1.6;
  color: var(--sidebar-ink, #303b2f);
  white-space: pre-wrap;
  cursor: pointer;
  display: inline-block;
  padding: 2px 4px;
  margin-left: -4px;
  border-radius: 4px;
  transition: background-color 0.15s ease;
}

.bio-content-text:hover {
  background-color: rgba(67, 90, 65, 0.06);
}

.bio-content-text.is-empty {
  color: var(--muted, #7b8073);
  font-style: italic;
}

.bio-edit-box {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-width: 500px;
}

.bio-textarea {
  width: 100%;
  padding: 4px 0;
  font-family: inherit;
  font-size: 14.5px;
  line-height: 1.6;
  border: 0;
  border-bottom: 2px solid var(--green, #435a41);
  background: transparent;
  color: var(--sidebar-ink, #303b2f);
  resize: vertical;
  outline: none;
  box-shadow: none;
  border-radius: 0;
}

.bio-edit-actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}

.btn-text {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 12.5px;
  font-weight: 500;
  border: 0;
  cursor: pointer;
  background: transparent;
}

.btn-text.btn-cancel {
  color: var(--muted, #7b8073);
}

.btn-text.btn-cancel:hover {
  background-color: rgba(0, 0, 0, 0.06);
}

.btn-text.btn-save {
  background-color: var(--green, #435a41);
  color: #ffffff;
}

.btn-text.btn-save:hover {
  background-color: #354734;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.hidden-input {
  display: none;
}

@media (max-width: 640px) {
  .profile-main {
    padding: 16px 16px 40px;
  }
}
</style>

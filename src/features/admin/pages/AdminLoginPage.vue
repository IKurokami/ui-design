<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowRight, LoaderCircle } from '@lucide/vue'
import { useRouter } from 'vue-router'
import { authService } from '../../auth/services/auth.service'
import { useAuthStore } from '../../../stores/auth.store'
import { friendlyError } from '../../../services/error-handler'

const router = useRouter()
const authStore = useAuthStore()
const identity = ref('')
const password = ref('')
const remember = ref(true)
const loading = ref(false)
const error = ref('')
const canSubmit = computed(() => identity.value.trim() !== '' && password.value !== '' && !loading.value)

async function submit() {
  if (!canSubmit.value || !authService.adminLogin) return
  loading.value = true
  error.value = ''
  try {
    const session = await authService.adminLogin({ identity: identity.value.trim(), password: password.value, remember: remember.value })
    authStore.setSession(session)
    await router.replace('/admin')
  } catch (cause) {
    error.value = friendlyError(cause)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="admin-login-page">
    <section class="admin-login-card" aria-labelledby="admin-login-title">
      <form class="admin-form" novalidate @submit.prevent="submit">
        <label class="admin-field"><span>Email</span><input v-model="identity" type="email" autocomplete="username" placeholder="admin@example.com" required :disabled="loading" /></label>
        <label class="admin-field"><span>Mật khẩu</span><input v-model="password" type="password" autocomplete="current-password" placeholder="Nhập mật khẩu" required :disabled="loading" /></label>
        <label class="admin-check"><input v-model="remember" type="checkbox" :disabled="loading" /><span>Ghi nhớ phiên này</span></label>
        <p v-if="error" class="admin-error" role="alert">{{ error }}</p>
        <button class="admin-primary" type="submit" :disabled="!canSubmit"><LoaderCircle v-if="loading" class="admin-spin" :size="17" /><span>{{ loading ? 'Đang xác thực' : 'Đăng nhập' }}</span><ArrowRight v-if="!loading" :size="17" /></button>
      </form>
    </section>
  </main>
</template>

<style>
.page-stage-admin { background: #eef0e8; }
.admin-login-page { min-height: 100dvh; display: grid; place-items: center; padding: 32px; color: #263527; background: #eef0e8; }
.admin-login-card { width: min(440px, 100%); padding: clamp(30px, 5vw, 54px); background: #fbfcf7; border-radius: 28px; }
.admin-login-mark { display: grid; place-items: center; width: 48px; height: 48px; border-radius: 15px; color: #f7faf3; background: #435a41; }
.admin-kicker { margin: 26px 0 10px; color: #72806d; font-size: 11px; letter-spacing: .06em; text-transform: uppercase; }
.admin-login-card h1 { margin: 0; font: 400 clamp(31px, 5vw, 42px)/1.18 var(--serif); letter-spacing: -.04em; }
.admin-login-copy { margin: 14px 0 30px; color: #677365; font-size: 13px; line-height: 1.7; }
.admin-form { display: grid; gap: 17px; }
.admin-field { display: grid; gap: 8px; color: #344534; font-size: 12px; font-weight: 600; }
.admin-field input { width: 100%; min-height: 48px; padding: 0 14px; border: 0; border-radius: 12px; color: #263527; background: #edf1e8; outline: 0; }
.admin-field input:focus { background: #e2eadc; outline: 2px solid #92a68b; outline-offset: 2px; }
.admin-check { display: flex; align-items: center; gap: 8px; color: #687466; font-size: 11px; }
.admin-check input { accent-color: #435a41; }
.admin-error { margin: -2px 0 0; padding: 11px 13px; border-radius: 10px; color: #8b3d35; background: #f5e6df; font-size: 12px; line-height: 1.6; }
.admin-primary { display: inline-flex; align-items: center; justify-content: center; gap: 10px; min-height: 50px; margin-top: 5px; border: 0; border-radius: 12px; color: #f7faf3; background: #435a41; font: 600 13px var(--sans); cursor: pointer; }
.admin-primary:hover:not(:disabled) { background: #344832; }
.admin-primary:disabled { cursor: not-allowed; opacity: .55; }
.admin-spin { animation: admin-spin 1s linear infinite; }
@keyframes admin-spin { to { transform: rotate(360deg); } }
@media (max-width: 520px) { .admin-login-page { padding: 18px; } .admin-login-card { padding: 30px 24px; } }
</style>

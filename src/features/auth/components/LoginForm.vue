<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import AppInput from '../../../components/ui/AppInput.vue'
import AppButton from '../../../components/ui/AppButton.vue'
import { usePasswordResetDialog } from './password-reset-dialog'
import { useAuthForm } from '../composables/useAuthForm'
import { validateLogin } from '../validation'
import { authService } from '../services/auth.service'
import { useAuthStore } from '../../../stores/auth.store'

const router = useRouter()
const store = useAuthStore()
const openPasswordReset = usePasswordResetDialog()
const success = ref('')

const { values, errors, loading, message, submit, updateField } = useAuthForm(
  { identity: '', password: '', remember: true },
  validateLogin,
  async (values, signal) => {
    success.value = ''
    const session = await authService.login({ ...values, identity: values.identity.trim() }, signal)
    store.setSession(session)
    message.value = ''
    success.value = 'Đăng nhập thành công. Chào ' + session.user.displayName + '!'
    setTimeout(() => {
      if (router?.push && router.currentRoute?.value?.path === '/login') {
        router.push('/library')
      }
    }, 1200)
  },
)

function onFieldInput(field: 'identity' | 'password') {
  success.value = ''
  updateField(field)
}

function onSubmit(event?: Event) {
  success.value = ''
  submit(event)
}
</script>
<template>
  <form class="auth-form login-form" novalidate @submit.prevent="onSubmit">
    <AppInput data-motion-key="auth-identity" id="login-identity" v-model="values.identity" label="Email hoặc tên đăng nhập" autocomplete="username" placeholder="Nhập email hoặc tên đăng nhập" icon="mail" :error="errors.identity" :disabled="loading" @input="onFieldInput('identity')" />
    <AppInput data-motion-key="auth-password" id="login-password" v-model="values.password" label="Mật khẩu" type="password" autocomplete="current-password" placeholder="Nhập mật khẩu của bạn" icon="lock" :error="errors.password" :disabled="loading" @input="onFieldInput('password')" />
    <div class="form-options" data-motion>
      <label class="checkbox-label"><input v-model="values.remember" type="checkbox" :disabled="loading" /> <span>Ghi nhớ đăng nhập</span></label>
      <button type="button" class="text-link" :disabled="loading" @click="openPasswordReset($event.currentTarget as HTMLElement)">Quên mật khẩu?</button>
    </div>
    <p v-if="message && !success" class="form-message" data-motion role="alert">{{ message }}</p>
    <p v-if="success" class="success-message" data-motion role="status">{{ success }}</p>
    <AppButton data-motion-key="auth-submit" type="submit" :loading="loading">{{ loading ? 'Đang đăng nhập…' : 'Đăng nhập' }}</AppButton>
  </form>
</template>

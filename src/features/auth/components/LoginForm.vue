<script setup lang="ts">
import { ref } from 'vue'
import AppInput from '../../../components/ui/AppInput.vue'
import AppButton from '../../../components/ui/AppButton.vue'
import PasswordResetDialog from './PasswordResetDialog.vue'
import { useAuthForm } from '../composables/useAuthForm'
import { validateLogin } from '../validation'
import { authService } from '../services/auth.service'
import { useAuthStore } from '../../../stores/auth.store'
const store = useAuthStore()
const resetDialog = ref<InstanceType<typeof PasswordResetDialog>>()
const success = ref('')
const { values, errors, loading, message, submit, updateField } = useAuthForm(
  { identity: '', password: '', remember: true }, validateLogin,
  async (values, signal) => {
    const session = await authService.login({ ...values, identity: values.identity.trim() }, signal)
    store.setSession(session); success.value = 'Đăng nhập thành công. Chào ' + session.user.displayName + '!'
  },
)
</script>
<template>
  <form class="auth-form login-form" novalidate @submit.prevent="submit">
    <AppInput data-auth-flip data-flip-id="auth-identity" id="login-identity" v-model="values.identity" label="Email hoặc tên đăng nhập" autocomplete="username" placeholder="Nhập email hoặc tên đăng nhập" icon="mail" :error="errors.identity" :disabled="loading" @input="updateField('identity')" />
    <AppInput data-auth-flip data-flip-id="auth-password" id="login-password" v-model="values.password" label="Mật khẩu" type="password" autocomplete="current-password" placeholder="Nhập mật khẩu của bạn" icon="lock" :error="errors.password" :disabled="loading" @input="updateField('password')" />
    <div class="form-options" data-auth-enter>
      <label class="checkbox-label"><input v-model="values.remember" type="checkbox" :disabled="loading" /> <span>Ghi nhớ đăng nhập</span></label>
      <button type="button" class="text-link" :disabled="loading" @click="resetDialog?.open()">Quên mật khẩu?</button>
    </div>
    <p v-if="message" class="form-message" data-auth-enter role="alert">{{ message }}</p>
    <p v-if="success" class="success-message" data-auth-enter role="status">{{ success }}</p>
    <AppButton data-auth-flip data-flip-id="auth-submit" type="submit" :loading="loading">{{ loading ? 'Đang đăng nhập…' : 'Đăng nhập' }}</AppButton>
  </form>
  <PasswordResetDialog ref="resetDialog" />
</template>





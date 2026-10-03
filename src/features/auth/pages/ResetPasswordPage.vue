<script setup lang="ts">
import { inject } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft } from '@lucide/vue'
import ResetPasswordForm from '../components/ResetPasswordForm.vue'
import { navigationKey } from '../../../components/navigation/context'

const router = useRouter()
const navigation = inject(navigationKey, undefined)

function goLogin() {
  if (navigation?.push) {
    navigation.push('/login')
  } else {
    router.push('/login')
  }
}
</script>
<template>
  <div class="auth-page reset-password-page">
    <div class="form-inner">
      <h1 data-screen-title data-motion-text="title" data-motion-key="auth-title" tabindex="-1">Đặt lại mật khẩu</h1>
      <ResetPasswordForm />
      <p class="switch-page" data-motion>
        <button type="button" class="text-link" :disabled="navigation?.busy?.value" @click="goLogin">
          <ArrowLeft :size="15" /> Quay lại đăng nhập
        </button>
      </p>
    </div>
  </div>
</template>

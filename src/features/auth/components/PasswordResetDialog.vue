<script setup lang="ts">
import { ref } from 'vue'
import { ArrowLeft, Mail } from '@lucide/vue'
import AppInput from '../../../components/ui/AppInput.vue'
import AppButton from '../../../components/ui/AppButton.vue'
import { useAuthForm } from '../composables/useAuthForm'
import { isEmail } from '../validation'
import { authService } from '../services/auth.service'
const dialog = ref<HTMLDialogElement>()
const success = ref(false)
const { values, errors, loading, message, submit, updateField } = useAuthForm(
  { email: '' },
  values => isEmail(values.email) ? {} : { email: 'Vui lòng nhập một địa chỉ email hợp lệ.' },
  async (values, signal) => { await authService.requestPasswordReset(values.email.trim(), signal); success.value = true },
)
defineExpose({ open() { dialog.value?.showModal() } })
</script>
<template>
  <dialog ref="dialog" class="info-dialog reset-dialog" aria-labelledby="reset-title">
    <button class="back-link" :disabled="loading" @click="dialog?.close()"><ArrowLeft :size="16" /> Đăng nhập</button>
    <div class="dialog-symbol"><Mail :size="25" :stroke-width="1.5" /></div>
    <h2 id="reset-title">Quên mật khẩu</h2>
    <p>Nhập email của bạn để yêu cầu hướng dẫn đặt lại mật khẩu.</p>
    <form v-if="!success" class="auth-form" novalidate @submit.prevent="submit">
      <AppInput id="reset-email" v-model="values.email" label="Địa chỉ email" type="email" autocomplete="email" placeholder="ban@example.com" icon="mail" :error="errors.email" :disabled="loading" @input="updateField('email')" />
      <p v-if="message" class="form-message" role="alert">{{ message }}</p>
      <AppButton type="submit" :loading="loading">Gửi yêu cầu</AppButton>
    </form>
    <p v-else class="success-message" role="status">Nếu email này đã có tài khoản, hệ thống sẽ gửi hướng dẫn khôi phục. Bạn hãy kiểm tra hộp thư nhé.</p>
  </dialog>
</template>




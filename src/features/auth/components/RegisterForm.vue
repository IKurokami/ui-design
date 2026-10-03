<script setup lang="ts">
import { computed, ref } from 'vue'
import { Check, Circle } from '@lucide/vue'
import AppInput from '../../../components/ui/AppInput.vue'
import AppButton from '../../../components/ui/AppButton.vue'
import { useAuthForm } from '../composables/useAuthForm'
import { passwordRules, validateRegister } from '../validation'
import { authService } from '../services/auth.service'
import { useAuthStore } from '../../../stores/auth.store'
import { useInfoDialog } from '../../../components/ui/info-dialog'
const store = useAuthStore()
const openInfo = useInfoDialog()
const success = ref('')
const { values, errors, loading, message, submit, updateField } = useAuthForm(
  { displayName: '', email: '', password: '', confirmPassword: '', acceptedTerms: false }, validateRegister,
  async (values, signal) => {
    const session = await authService.register({ ...values, displayName: values.displayName.trim(), email: values.email.trim() }, signal)
    store.setSession(session); success.value = 'Tài khoản đã được tạo. Chào mừng bạn đến với Mộc!'
  },
)
const rules = computed(() => passwordRules(values.password))
const score = computed(() => rules.value.filter(rule => rule.valid).length)
</script>
<template>
  <form class="auth-form register-form" novalidate @submit.prevent="submit">
    <AppInput data-auth-enter id="register-name" v-model="values.displayName" label="Tên hiển thị" autocomplete="nickname" placeholder="Tên của bạn" icon="user" :error="errors.displayName" :disabled="loading" @input="updateField('displayName')" />
    <AppInput data-auth-flip data-flip-id="auth-identity" id="register-email" v-model="values.email" label="Địa chỉ email" type="email" autocomplete="email" placeholder="ban@example.com" icon="mail" :error="errors.email" :disabled="loading" @input="updateField('email')" />
    <AppInput data-auth-flip data-flip-id="auth-password" id="register-password" v-model="values.password" label="Mật khẩu" type="password" autocomplete="new-password" placeholder="Tạo một mật khẩu an toàn" icon="lock" :error="errors.password" :disabled="loading" @input="updateField('password', 'confirmPassword')" />
    <div class="password-strength" data-auth-enter aria-label="Yêu cầu mật khẩu">
      <div class="strength-bars" aria-hidden="true"><span v-for="n in 3" :key="n" :class="{ filled: n <= score }" /></div>
      <ul><li v-for="rule in rules" :key="rule.label" :class="{ valid: rule.valid }"><Check v-if="rule.valid" :size="12" /><Circle v-else :size="8" />{{ rule.label }}</li></ul>
    </div>
    <AppInput data-auth-enter id="register-confirm" v-model="values.confirmPassword" label="Xác nhận mật khẩu" type="password" autocomplete="new-password" placeholder="Nhập lại mật khẩu" icon="lock" :error="errors.confirmPassword" :disabled="loading" @input="updateField('confirmPassword')" />
    <div data-auth-enter>
      <label class="checkbox-label terms-checkbox"><input v-model="values.acceptedTerms" type="checkbox" :disabled="loading" :aria-invalid="!!errors.acceptedTerms" :aria-describedby="errors.acceptedTerms ? 'terms-error' : undefined" @change="updateField('acceptedTerms')" /><span>Mình đồng ý với <button class="text-link" type="button" @click.prevent="openInfo('terms')">Điều khoản sử dụng</button> và <button class="text-link" type="button" @click.prevent="openInfo('privacy')">Chính sách bảo mật</button>.</span></label>
      <p v-if="errors.acceptedTerms" id="terms-error" class="field-error" role="alert">{{ errors.acceptedTerms }}</p>
    </div>
    <p v-if="message" class="form-message" data-auth-enter role="alert">{{ message }}</p>
    <p v-if="success" class="success-message" data-auth-enter role="status">{{ success }}</p>
    <AppButton data-auth-flip data-flip-id="auth-submit" type="submit" :loading="loading">{{ loading ? 'Đang tạo tài khoản…' : 'Tạo tài khoản' }}</AppButton>
  </form>
</template>





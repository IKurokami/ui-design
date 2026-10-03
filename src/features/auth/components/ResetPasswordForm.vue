<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount, inject } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Check, Circle } from '@lucide/vue'
import AppInput from '../../../components/ui/AppInput.vue'
import AppButton from '../../../components/ui/AppButton.vue'
import { useAuthForm } from '../composables/useAuthForm'
import { passwordRules, validateResetPassword } from '../validation'
import { authService } from '../services/auth.service'
import { navigationKey } from '../../../components/navigation/context'
import { ApiError, friendlyError, IntegrationUnavailableError } from '../../../services/error-handler'

const route = useRoute()
const router = useRouter()
const navigation = inject(navigationKey, undefined)

const token = computed(() => {
  const q = route.query.token
  return typeof q === 'string' ? q.trim() : ''
})
const missingToken = computed(() => !token.value)
const tokenStatus = ref<'checking' | 'valid' | 'invalid' | 'error'>('checking')
const tokenMessage = ref('')
const success = ref('')
let validationRequest: AbortController | undefined
let redirectTimer: ReturnType<typeof setTimeout> | undefined

function invalidTokenError(error: unknown) {
  return error instanceof ApiError && error.status === 400
}

async function checkToken() {
  validationRequest?.abort()
  validationRequest = undefined
  if (redirectTimer) clearTimeout(redirectTimer)
  success.value = ''
  values.password = ''
  values.confirmPassword = ''
  errors.value = {}
  message.value = ''
  tokenMessage.value = ''
  tokenStatus.value = 'checking'
  if (!token.value) return
  const request = new AbortController()
  validationRequest = request
  try {
    if (!authService.validatePasswordReset) throw new IntegrationUnavailableError()
    await authService.validatePasswordReset(token.value, request.signal)
    if (!request.signal.aborted) tokenStatus.value = 'valid'
  } catch (error) {
    if (request.signal.aborted) return
    tokenStatus.value = invalidTokenError(error) ? 'invalid' : 'error'
    tokenMessage.value = friendlyError(error)
  }
}

const { values, errors, loading, message, submit, updateField } = useAuthForm(
  { password: '', confirmPassword: '' },
  validateResetPassword,
  async (formValues, signal) => {
    if (!token.value || tokenStatus.value !== 'valid' || success.value) return
    const submittedToken = token.value
    const currentValidation = validationRequest
    try {
      if (!authService.confirmPasswordReset) throw new IntegrationUnavailableError()
      await authService.confirmPasswordReset(submittedToken, formValues.password, signal)
    } catch (error) {
      if (signal.aborted || currentValidation !== validationRequest) return
      if (invalidTokenError(error)) {
        tokenStatus.value = 'invalid'
        tokenMessage.value = friendlyError(error)
        values.password = ''
        values.confirmPassword = ''
        return
      }
      throw error
    }
    if (signal.aborted || currentValidation !== validationRequest) return
    values.password = ''
    values.confirmPassword = ''
    success.value = 'Mật khẩu đã được cập nhật thành công! Đang chuyển hướng về trang đăng nhập…'
    redirectTimer = setTimeout(() => {
      if (navigation?.push) {
        navigation.push('/login')
      } else {
        router.push('/login')
      }
    }, 1800)
  },
)

const rules = computed(() => passwordRules(values.password))
const score = computed(() => rules.value.filter(rule => rule.valid).length)
watch(token, () => { void checkToken() }, { immediate: true })
onBeforeUnmount(() => {
  validationRequest?.abort()
  if (redirectTimer) clearTimeout(redirectTimer)
})
</script>
<template>
  <div v-if="missingToken" class="auth-form" data-motion>
    <p class="form-message" role="alert">
      Liên kết đặt lại mật khẩu không hợp lệ hoặc thiếu mã xác thực. Vui lòng kiểm tra lại liên kết trong email của bạn.
    </p>
    <AppButton @click="router.push('/login')">Về trang đăng nhập</AppButton>
  </div>
  <div v-else-if="tokenStatus === 'checking'" class="auth-form" aria-busy="true">
    <p role="status">Đang kiểm tra liên kết đặt lại mật khẩu…</p>
  </div>
  <div v-else-if="tokenStatus === 'invalid' || tokenStatus === 'error'" class="auth-form" data-motion>
    <p class="form-message" role="alert">{{ tokenMessage }}</p>
    <AppButton v-if="tokenStatus === 'error'" @click="checkToken">Thử lại</AppButton>
    <AppButton v-else @click="router.push('/login')">Về trang đăng nhập</AppButton>
  </div>
  <div v-else-if="success" class="auth-form" data-motion>
    <p class="success-message" role="status">{{ success }}</p>
  </div>
  <form v-else class="auth-form reset-password-form" novalidate @submit.prevent="submit">
    <AppInput
      data-motion-key="auth-password"
      id="reset-new-password"
      v-model="values.password"
      label="Mật khẩu mới"
      type="password"
      autocomplete="new-password"
      placeholder="Nhập mật khẩu mới"
      icon="lock"
      :error="errors.password"
      :disabled="loading"
      @input="updateField('password', 'confirmPassword')"
    />

    <div class="password-strength" data-motion aria-label="Yêu cầu mật khẩu">
      <div class="strength-bars" aria-hidden="true">
        <span v-for="n in 3" :key="n" :class="{ filled: n <= score }" />
      </div>
      <ul>
        <li v-for="rule in rules" :key="rule.label" :class="{ valid: rule.valid }">
          <Check v-if="rule.valid" :size="12" />
          <Circle v-else :size="8" />
          {{ rule.label }}
        </li>
      </ul>
    </div>

    <AppInput
      data-motion
      id="reset-confirm-password"
      v-model="values.confirmPassword"
      label="Xác nhận mật khẩu mới"
      type="password"
      autocomplete="new-password"
      placeholder="Nhập lại mật khẩu mới"
      icon="lock"
      :error="errors.confirmPassword"
      :disabled="loading"
      @input="updateField('confirmPassword')"
    />

    <p v-if="message" class="form-message" data-motion role="alert">{{ message }}</p>

    <AppButton
      data-motion-key="auth-submit"
      type="submit"
      :loading="loading"
    >
      {{ loading ? 'Đang cập nhật…' : 'Cập nhật mật khẩu' }}
    </AppButton>
  </form>
</template>

import { defineStore } from 'pinia'
import { onScopeDispose, ref } from 'vue'
import { authService } from '../features/auth/services/auth.service'
import { isEmail } from '../features/auth/validation'
import { friendlyError } from '../services/error-handler'

/** Application-memory flow. Dialog visibility never changes this state. */
export const usePasswordResetStore = defineStore('password-reset', () => {
  const step = ref<'email' | 'sent'>('email')
  const email = ref('')
  const submittedEmail = ref('')
  const emailError = ref('')
  const message = ref('')
  const loading = ref(false)
  const sendCount = ref(0)
  let hasSubmitted = false
  let request: AbortController | undefined

  function updateEmail(value: string) {
    if (loading.value) return
    email.value = value
    message.value = ''
    if (hasSubmitted) emailError.value = isEmail(value) ? '' : 'Vui lòng nhập một địa chỉ email hợp lệ.'
  }
  async function send(address: string) {
    if (loading.value) return
    loading.value = true
    message.value = ''
    const controller = new AbortController()
    request = controller
    try {
      await authService.requestPasswordReset(address, controller.signal)
      if (controller.signal.aborted) return
      sendCount.value = submittedEmail.value === address ? sendCount.value + 1 : 1
      submittedEmail.value = address
      email.value = address
      step.value = 'sent'
    } catch (error) {
      if (!controller.signal.aborted) message.value = friendlyError(error)
    } finally {
      if (request === controller) { loading.value = false; request = undefined }
    }
  }
  async function submit() {
    if (loading.value || step.value !== 'email') return
    hasSubmitted = true
    emailError.value = isEmail(email.value) ? '' : 'Vui lòng nhập một địa chỉ email hợp lệ.'
    message.value = ''
    if (emailError.value) return
    await send(email.value.trim())
  }
  async function resend() {
    if (loading.value || step.value !== 'sent' || !submittedEmail.value) return
    await send(submittedEmail.value)
  }
  function editEmail() {
    if (loading.value || step.value !== 'sent') return
    email.value = submittedEmail.value
    emailError.value = ''
    message.value = ''
    step.value = 'email'
  }
  // A hidden/unmounted dialog does not abort its request; disposing the app does.
  onScopeDispose(() => request?.abort())
  return { step, email, submittedEmail, emailError, message, loading, sendCount, updateEmail, submit, resend, editEmail }
})

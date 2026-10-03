import { onBeforeUnmount, reactive, ref } from 'vue'
import { friendlyError } from '../../../services/error-handler'
import type { FieldErrors } from '../validation'

export function useAuthForm<T extends object>(initial: T, validate: (values: T) => FieldErrors<T>, action: (values: T, signal: AbortSignal) => Promise<void>) {
  const values = reactive(initial) as T
  const errors = ref<FieldErrors<T>>({})
  const loading = ref(false)
  const message = ref('')
  let hasSubmitted = false
  let request: AbortController | undefined

  /** Focus/blur are not validation events. Revalidate edits only after a submit. */
  function updateField(...fields: (keyof T)[]) {
    message.value = ''
    if (!hasSubmitted) return
    const nextErrors = validate(values)
    const updated = { ...errors.value }
    for (const field of fields) {
      if (nextErrors[field]) updated[field] = nextErrors[field]
      else delete updated[field]
    }
    errors.value = updated
  }
  async function submit(event?: Event) {
    if (loading.value) return
    hasSubmitted = true
    errors.value = validate(values)
    message.value = ''
    if (Object.values(errors.value).some(Boolean)) {
      const form = event?.target as HTMLFormElement | undefined
      requestAnimationFrame(() => form?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
      return
    }
    loading.value = true
    request = new AbortController()
    try { await action({ ...values }, request.signal) }
    catch (error) { if (!request.signal.aborted) message.value = friendlyError(error) }
    finally { loading.value = false }
  }
  onBeforeUnmount(() => request?.abort())
  return { values, errors, loading, message, submit, updateField }
}


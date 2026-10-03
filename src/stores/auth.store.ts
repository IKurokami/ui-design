import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { AuthSession } from '../features/auth/types'

export const useAuthStore = defineStore('auth', () => {
  const session = ref<AuthSession | null>(null)
  const isAuthenticated = computed(() => session.value !== null)
  function setSession(value: AuthSession) { session.value = value }
  function clearSession() { session.value = null }
  return { session, isAuthenticated, setSession, clearSession }
})

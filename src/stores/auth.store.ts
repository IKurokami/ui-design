import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { AuthSession, AuthUser } from '../features/auth/types'
import { authService } from '../features/auth/services/auth.service'

export type AuthStatus = 'idle' | 'checking' | 'authenticated' | 'unauthenticated'

export const useAuthStore = defineStore('auth', () => {
  const session = ref<AuthSession | null>(null)
  const status = ref<AuthStatus>('idle')
  let pendingCheck: Promise<AuthSession | null> | undefined
  let sessionVersion = 0

  const user = computed<AuthUser | null>(() => session.value?.user ?? null)
  const isAuthenticated = computed(() => session.value !== null)
  const isChecking = computed(() => status.value === 'checking')
  const isInitialized = computed(() => status.value !== 'idle' && status.value !== 'checking')

  function setSession(value: AuthSession) {
    sessionVersion++
    session.value = value
    status.value = 'authenticated'
  }

  function clearSession() {
    sessionVersion++
    session.value = null
    status.value = 'unauthenticated'
  }

  function checkAuth(signal?: AbortSignal): Promise<AuthSession | null> {
    if (pendingCheck) return pendingCheck
    status.value = 'checking'
    const version = sessionVersion
    // Every caller waits for the same cookie-backed request, including route guards.
    const request = Promise.resolve()
      .then(() => authService.getMe?.(signal))
      .then(data => {
        if (version !== sessionVersion) return session.value
        if (data?.user) {
          setSession(data)
          return data
        }
        clearSession()
        return null
      })
      .catch(() => {
        if (version !== sessionVersion) return session.value
        clearSession()
        return null
      })
      .finally(() => {
        if (pendingCheck === request) pendingCheck = undefined
      })
    pendingCheck = request
    return request
  }

  async function logout(signal?: AbortSignal): Promise<void> {
    clearSession()
    try {
      await authService.logout?.(signal)
    } finally {
      clearSession()
    }
  }

  return {
    session,
    status,
    user,
    isAuthenticated,
    isChecking,
    isInitialized,
    setSession,
    clearSession,
    checkAuth,
    logout,
  }
})

import { createApiClient } from '../../../services/api-client'
import type { AuthAdapter, AuthSession, LoginValues, RegisterValues } from '../types'

/** HTTP adapter connecting to the Go Auth Backend via cookie-based credentials */
export function createHttpAuthAdapter(baseUrl = ''): AuthAdapter {
  const client = createApiClient(baseUrl)
  return {
    async login(values: LoginValues, signal?: AbortSignal): Promise<AuthSession> {
      return client.request<AuthSession>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(values),
        signal,
      })
    },
    async register(values: RegisterValues, signal?: AbortSignal): Promise<AuthSession> {
      return client.request<AuthSession>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(values),
        signal,
      })
    },
    async requestPasswordReset(email: string, signal?: AbortSignal): Promise<void> {
      return client.request<void>('/api/auth/password-reset', {
        method: 'POST',
        body: JSON.stringify({ email }),
        signal,
      })
    },
    async getMe(signal?: AbortSignal): Promise<AuthSession> {
      return client.request<AuthSession>('/api/auth/me', {
        method: 'GET',
        signal,
      })
    },
    async logout(signal?: AbortSignal): Promise<void> {
      return client.request<void>('/api/auth/logout', {
        method: 'POST',
        signal,
      })
    },
    async validatePasswordReset(token: string, signal?: AbortSignal): Promise<void> {
      return client.request<void>('/api/auth/password-reset/validate', {
        method: 'POST',
        body: JSON.stringify({ token }),
        signal,
        cache: 'no-store',
      })
    },
    async confirmPasswordReset(token: string, newPassword: string, signal?: AbortSignal): Promise<void> {
      return client.request<void>('/api/auth/password-reset/confirm', {
        method: 'POST',
        body: JSON.stringify({ token, newPassword }),
        signal,
      })
    },
  }
}

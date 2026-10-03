import { ApiError } from './error-handler'

/** Transport only. Endpoints and DTO mapping belong in the backend-specific adapter. */
export function createApiClient(baseUrl = '') {
  return {
    async request<T>(path: string, options: RequestInit = {}): Promise<T> {
      const headers = new Headers(options.headers)
      headers.set('Accept', 'application/json')
      if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json')
      
      const targetUrl = baseUrl ? new URL(path, baseUrl).toString() : path
      const response = await fetch(targetUrl, { ...options, headers, credentials: 'include' })
      
      if (!response.ok) {
        let msg = 'Không thể hoàn tất yêu cầu. Vui lòng kiểm tra thông tin và thử lại.'
        try {
          const data = await response.json()
          if (data && typeof data === 'object' && 'message' in data && typeof data.message === 'string') {
            msg = data.message
          }
        } catch {
          // Keep default friendly message on non-JSON error
        }
        throw new ApiError(msg, response.status)
      }
      
      if (response.status === 204) return undefined as T
      return response.json() as Promise<T>
    },
  }
}

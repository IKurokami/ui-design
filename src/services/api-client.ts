import { ApiError } from './error-handler'

/** Transport only. Endpoints and DTO mapping belong in the backend-specific adapter. */
export function createApiClient(baseUrl: string) {
  return {
    async request<T>(path: string, options: RequestInit = {}): Promise<T> {
      const headers = new Headers(options.headers)
      headers.set('Accept', 'application/json')
      if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json')
      const response = await fetch(new URL(path, baseUrl), { ...options, headers, credentials: 'include' })
      if (!response.ok) throw new ApiError('Không thể hoàn tất yêu cầu. Vui lòng kiểm tra thông tin và thử lại.', response.status)
      if (response.status === 204) return undefined as T
      return response.json() as Promise<T>
    },
  }
}

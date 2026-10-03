export class IntegrationUnavailableError extends Error {
  constructor() { super('Dịch vụ tài khoản chưa được kết nối. Vui lòng thử lại khi Mộc hoàn tất kết nối hệ thống.'); this.name = 'IntegrationUnavailableError' }
}
export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); this.name = 'ApiError' }
}
export function friendlyError(error: unknown): string {
  if (error instanceof IntegrationUnavailableError) return error.message
  if (error instanceof ApiError) {
    if (error.status === 429) return 'Bạn đã thử quá nhiều lần. Hãy đợi một chút rồi thử lại nhé.'
    if (error.status >= 500) return 'Hệ thống đang bận. Vui lòng thử lại sau ít phút.'
    return error.message
  }
  return 'Không thể kết nối với hệ thống. Vui lòng kiểm tra mạng và thử lại.'
}

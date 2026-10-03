export interface LoginValues { identity: string; password: string; remember: boolean }
export interface RegisterValues { displayName: string; email: string; password: string; confirmPassword: string; acceptedTerms: boolean }
export interface AuthUser { id: string; displayName: string; email: string; avatarUrl?: string; avatar?: string }
export interface AuthSession { user: AuthUser }
export interface AuthAdapter {
  login(values: LoginValues, signal?: AbortSignal): Promise<AuthSession>
  register(values: RegisterValues, signal?: AbortSignal): Promise<AuthSession>
  requestPasswordReset(email: string, signal?: AbortSignal): Promise<void>
  getMe?(signal?: AbortSignal): Promise<AuthSession>
  logout?(signal?: AbortSignal): Promise<void>
  validatePasswordReset?(token: string, signal?: AbortSignal): Promise<void>
  confirmPasswordReset?(token: string, newPassword: string, signal?: AbortSignal): Promise<void>
}

export interface LoginValues { identity: string; password: string; remember: boolean }
export interface RegisterValues { displayName: string; email: string; password: string; confirmPassword: string; acceptedTerms: boolean }
export interface AuthSession { user: { id: string; displayName: string; email: string } }
export interface AuthAdapter {
  login(values: LoginValues, signal?: AbortSignal): Promise<AuthSession>
  register(values: RegisterValues, signal?: AbortSignal): Promise<AuthSession>
  requestPasswordReset(email: string, signal?: AbortSignal): Promise<void>
}

import type { AuthAdapter } from '../types'
import { IntegrationUnavailableError } from '../../../services/error-handler'

let adapter: AuthAdapter | undefined
/** Install an adapter once the actual API contract is available. No assumed endpoints. */
export function configureAuthAdapter(value: AuthAdapter) { adapter = value }
export function isAuthAdapterConfigured(): boolean { return adapter !== undefined }

export const authService: AuthAdapter = {
  async login(values, signal) { if (!adapter) throw new IntegrationUnavailableError(); return adapter.login(values, signal) },
  async register(values, signal) { if (!adapter) throw new IntegrationUnavailableError(); return adapter.register(values, signal) },
  async requestPasswordReset(email, signal) { if (!adapter) throw new IntegrationUnavailableError(); return adapter.requestPasswordReset(email, signal) },
  async getMe(signal) { if (!adapter?.getMe) throw new IntegrationUnavailableError(); return adapter.getMe(signal) },
  async logout(signal) { if (!adapter?.logout) throw new IntegrationUnavailableError(); return adapter.logout(signal) },
  async validatePasswordReset(token, signal) {
    if (!adapter?.validatePasswordReset) throw new IntegrationUnavailableError()
    return adapter.validatePasswordReset(token, signal)
  },
  async confirmPasswordReset(token, newPassword, signal) {
    if (!adapter?.confirmPasswordReset) throw new IntegrationUnavailableError()
    return adapter.confirmPasswordReset(token, newPassword, signal)
  },
}

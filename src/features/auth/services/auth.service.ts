import type { AuthAdapter } from '../types'
import { IntegrationUnavailableError } from '../../../services/error-handler'

let adapter: AuthAdapter | undefined
/** Install an adapter once the actual API contract is available. No assumed endpoints. */
export function configureAuthAdapter(value: AuthAdapter) { adapter = value }
export const authService: AuthAdapter = {
  async login(values, signal) { if (!adapter) throw new IntegrationUnavailableError(); return adapter.login(values, signal) },
  async register(values, signal) { if (!adapter) throw new IntegrationUnavailableError(); return adapter.register(values, signal) },
  async requestPasswordReset(email, signal) { if (!adapter) throw new IntegrationUnavailableError(); return adapter.requestPasswordReset(email, signal) },
}

import { inject, type InjectionKey } from 'vue'
export const passwordResetDialogKey: InjectionKey<(source?: HTMLElement) => void> = Symbol('password-reset-dialog')
export function usePasswordResetDialog() { return inject(passwordResetDialogKey, () => {}) }

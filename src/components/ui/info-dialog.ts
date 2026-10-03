import { inject, type InjectionKey } from 'vue'
export type InfoPage = 'terms' | 'privacy'
export const infoDialogKey: InjectionKey<(page: InfoPage) => void> = Symbol('info-dialog')
export function useInfoDialog() { return inject(infoDialogKey, () => {}) }


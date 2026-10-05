import type { InjectionKey } from 'vue'

/** Wait for the containing page and its shared elements to finish entering. */
export const pageMotionSettledKey: InjectionKey<(element?: HTMLElement) => Promise<void>> = Symbol('page-motion-settled')

import { inject, nextTick, onBeforeUnmount, watch, type InjectionKey, type Ref } from 'vue'
import { useResizeObserver } from '@vueuse/core'
import type { ScrollRestorationManager } from '../scroll/scroll-restoration'
export const scrollRestorationKey: InjectionKey<ScrollRestorationManager> = Symbol('scroll-restoration')
/** Register an independent scroll region; restore() can be awaited after async content loads. */
export function useScrollRestoration(entryId: string, region: string, element: Ref<HTMLElement | undefined>) {
  const manager = inject(scrollRestorationKey)
  async function restore() { await nextTick(); manager?.restore(entryId) }
  watch(element, value => { if (value) { manager?.register(entryId, region, value); void restore() } }, { flush: 'post', immediate: true })
  useResizeObserver(element, () => { void restore() })
  onBeforeUnmount(() => manager?.unregister(entryId, region))
  return { restore, capture: () => manager?.capture(entryId) }
}


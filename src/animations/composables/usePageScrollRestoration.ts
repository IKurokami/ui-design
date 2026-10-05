import { computed, inject, nextTick, onBeforeUnmount, provide, watch, type Ref } from 'vue'
import { useRoute, useRouter, type RouteLocationNormalized } from 'vue-router'
import { useEventListener, useMutationObserver, useResizeObserver } from '@vueuse/core'
import { ScrollRestorationManager } from '../scroll/scroll-restoration'
import { scrollRestorationKey } from './useScrollRestoration'

const pageKey = (route: Pick<RouteLocationNormalized, 'fullPath' | 'path'>) => 'page:' + (route.fullPath ?? route.path)

export function providePageScrollRestoration() {
  const router = useRouter()
  let storage: Storage | undefined
  try { storage = sessionStorage } catch { /* Storage is optional. */ }
  const manager = new ScrollRestorationManager(storage, 'moc:page-scroll:v1')
  provide(scrollRestorationKey, manager)
  const removeBefore = router.beforeEach((_to, from) => {
    const key = pageKey(from)
    manager.capture(key)
    manager.freeze(key)
    manager.persist()
  })
  const removeAfter = router.afterEach((to, from, failure) => manager.thaw(pageKey(failure ? from : to)))
  useEventListener(window, 'pagehide', () => { manager.capture(pageKey(router.currentRoute.value)); manager.persist() })
  onBeforeUnmount(() => {
    removeBefore(); removeAfter()
    manager.capture(pageKey(router.currentRoute.value)); manager.persist(); manager.dispose()
  })
}

/** Separate positions for each page/query and each native scroll container. */
export function usePageScrollRestoration(region: string, element: Ref<HTMLElement | undefined>, ready: Ref<boolean> = computed(() => true)) {
  const manager = inject(scrollRestorationKey, undefined)
  const route = useRoute()
  const ownPath = route.path
  let bound: { key: string; element: HTMLElement } | undefined
  let disposed = false
  function release() {
    if (bound) manager?.unregister(bound.key, region, bound.element)
    bound = undefined
  }
  async function bind() {
    if (disposed || route.path !== ownPath) return
    const node = element.value
    const key = pageKey(route)
    if (bound && (bound.key !== key || bound.element !== node)) release()
    if (!node) return
    if (!bound) { bound = { key, element: node }; manager?.register(key, region, node) }
    // Cached page content already has its full height. Restore before the
    // Transition enter hook measures shared-element destination rectangles.
    if (ready.value) manager?.restorePending(key)
    await nextTick()
    if (!disposed && bound?.key === key && ready.value) manager?.restorePending(key)
  }
  watch([element, ready, () => route.fullPath], bind, { immediate: true, flush: 'post' })
  const content = computed(() => element.value?.firstElementChild as HTMLElement | undefined)
  function restoreAfterLayout() {
    if (!disposed && ready.value && bound && route.path === ownPath) manager?.restorePending(bound.key)
  }
  useResizeObserver(content, restoreAfterLayout)
  useMutationObserver(element, restoreAfterLayout, { childList: true, subtree: true })
  useEventListener(element, 'load', restoreAfterLayout, { capture: true })
  void document.fonts?.ready.then(restoreAfterLayout)
  onBeforeUnmount(() => { disposed = true; release() })
}

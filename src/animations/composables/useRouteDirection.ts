import { onBeforeUnmount, ref } from 'vue'
import { useRouter, type RouteLocationNormalized } from 'vue-router'

// Match App's page-screen keys. Auth routes share one outer page transition.
const pageKey = (route: RouteLocationNormalized) => route.meta.layout === 'auth' ? '@auth' : route.path

/** Links back to an open page pop its chain; browser Back/Forward keep their own direction. */
export function useRouteDirection() {
  const router = useRouter()
  const history = router.options.history
  const direction = ref<'push' | 'pop'>('push')
  const position = () => typeof history.state.position === 'number' ? history.state.position : undefined
  let previous = position()
  let chain = router.currentRoute.value.matched.length ? [pageKey(router.currentRoute.value)] : []
  const entries = new Map<number, string[]>()
  if (previous !== undefined) entries.set(previous, [...chain])
  let traversal: { fullPath: string; direction: 'push' | 'pop' } | undefined
  const removeHistory = history.listen((to, _from, info) => {
    traversal = info.delta ? {
      fullPath: router.resolve(to).fullPath,
      direction: info.delta < 0 ? 'pop' : 'push',
    } : undefined
  })
  const remove = router.afterEach((to, from, failure) => {
    const travel = traversal?.fullPath === to.fullPath ? traversal : undefined
    if (failure) {
      if (travel) traversal = undefined
      return
    }
    traversal = undefined
    const current = position()
    const key = pageKey(to)
    const index = chain.lastIndexOf(key)
    const returning = index >= 0 && index < chain.length - 1
    const historyDirection = travel?.direction
      ?? (current !== undefined && previous !== undefined && current < previous ? 'pop' : undefined)
    const fromBase = from.meta.layout === 'home' || from.meta.layout === 'dashboard'
    const toBase = to.meta.layout === 'home' || to.meta.layout === 'dashboard'
    direction.value = from.meta.layout === 'auth' && toBase ? 'pop'
      : fromBase && to.meta.layout === 'auth' ? 'push'
      : historyDirection ?? (to.path === '/' || returning ? 'pop' : 'push')

    // Each browser entry retains its own page chain. Back may restore a chain
    // that was removed by a link-based return; Forward must still animate push.
    const restored = travel && current !== undefined ? entries.get(current) : undefined
    if (restored?.at(-1) === key) chain = [...restored]
    else {
      if (from.meta.layout === 'auth' && toBase && chain.at(-1) === '@auth') chain.pop()
      const existing = chain.lastIndexOf(key)
      chain = to.path === '/' ? [key]
        : existing >= 0 ? chain.slice(0, existing + 1) : [...chain, key]
    }
    // A new push after Back replaces the browser's Forward branch too.
    if (!travel && current !== undefined && previous !== undefined && current > previous) {
      for (const entry of entries.keys()) if (entry >= current) entries.delete(entry)
    }
    if (current !== undefined) entries.set(current, [...chain])
    previous = current
  })
  onBeforeUnmount(() => { remove(); removeHistory(); entries.clear() })
  return direction
}

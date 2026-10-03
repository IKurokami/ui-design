import { onBeforeUnmount, ref } from 'vue'
import { useRouter } from 'vue-router'

/** Auth sits above Home and Library; other transitions follow browser history. */
export function useRouteDirection() {
  const router = useRouter()
  const direction = ref<'push' | 'pop'>('push')
  let previous = Number(router.options.history.state.position ?? 0)
  const remove = router.afterEach((to, from, failure) => {
    if (failure) return
    const position = Number(router.options.history.state.position ?? previous)
    const fromBase = from.meta.layout === 'home' || from.meta.layout === 'dashboard'
    const toBase = to.meta.layout === 'home' || to.meta.layout === 'dashboard'
    direction.value = from.meta.layout === 'auth' && toBase ? 'pop'
      : fromBase && to.meta.layout === 'auth' ? 'push'
      : to.path === '/' || position < previous ? 'pop' : 'push'
    previous = position
  })
  onBeforeUnmount(remove)
  return direction
}

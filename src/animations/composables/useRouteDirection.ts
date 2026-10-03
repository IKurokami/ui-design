import { onBeforeUnmount, ref } from 'vue'
import { useRouter } from 'vue-router'

/** Browser Back/Forward follows history position; links to / reveal the root. */
export function useRouteDirection() {
  const router = useRouter()
  const direction = ref<'push' | 'pop'>('push')
  let previous = Number(router.options.history.state.position ?? 0)
  const remove = router.afterEach((to, _from, failure) => {
    if (failure) return
    const position = Number(router.options.history.state.position ?? previous)
    direction.value = to.path === '/' || position < previous ? 'pop' : 'push'
    previous = position
  })
  onBeforeUnmount(remove)
  return direction
}

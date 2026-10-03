<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, provide, ref, shallowRef } from 'vue'
import { useRouter } from 'vue-router'
import { useEventListener, useResizeObserver } from '@vueuse/core'
import { AnimationManager } from '../../animations/core/animation-manager'
import { animateStack, captureMotion, settleScreens } from '../../animations/navigation/transitions'
import { ScrollRestorationManager } from '../../animations/scroll/scroll-restoration'
import { HISTORY_KEY, initialSnapshot, nextSnapshot, readSnapshot, transitionDirection, type StackSnapshot, type ScreenEntry } from './stack-model'
import { navigationKey } from './context'
import { scrollRestorationKey } from '../../animations/composables/useScrollRestoration'
const router = useRouter()
const rootPath = '/login'
const stackLayout = router.currentRoute.value.meta.layout
let current = initialSnapshot(router.currentRoute.value.fullPath, rootPath, window.history.state?.[HISTORY_KEY])
window.history.replaceState({ ...window.history.state, [HISTORY_KEY]: current }, '')
const rendered = shallowRef<ScreenEntry[]>(current.chain)
const activeId = ref(current.chain.at(-1)!.id)
const busy = ref(false)
const elements = new Map<string, HTMLElement>()
const focusMemory = new Map<string, HTMLElement>()
const manager = new AnimationManager()
let storage: Storage | undefined
try { storage = window.sessionStorage } catch { /* Private-mode storage may be unavailable. */ }
const scroll = new ScrollRestorationManager(storage)
provide(scrollRestorationKey, scroll)
const container = ref<HTMLElement>()
let pending: StackSnapshot | undefined
let disposed = false
let navigationRequested = false
const currentTitle = computed(() => router.currentRoute.value.path === '/register' ? 'Tạo tài khoản' : 'Đăng nhập')

function bindScreen(id: string, element: unknown) {
  if (element instanceof HTMLElement) {
    elements.set(id, element)
    scroll.register(id, 'main', element)
    element.querySelectorAll<HTMLElement>('[data-scroll-region]').forEach(region => scroll.register(id, region.dataset.scrollRegion!, region))
  } else elements.delete(id)
}
function componentFor(path: string) {
  return router.resolve(path).matched.at(-1)?.components?.default
}
async function reconcile(target: StackSnapshot) {
  pending = target
  manager.finish()
  if (busy.value) return
  busy.value = true
  try {
    while (pending && !disposed) {
      const next = pending
      pending = undefined
      const previous = current.chain
      const oldId = previous.at(-1)!.id
      const newId = next.chain.at(-1)!.id
      if (oldId === newId) { current = next; continue }
      scroll.capture(oldId)
      const oldScreen = elements.get(oldId)
      const flipState = oldScreen ? captureMotion(oldScreen) : undefined
      const focused = document.activeElement
      if (focused instanceof HTMLElement && elements.get(oldId)?.contains(focused)) {
        focusMemory.set(oldId, focused); focused.blur()
      }
      const direction = transitionDirection(previous, next.chain)
      const merged = direction === 'push' ? [...previous, ...next.chain.filter(entry => !previous.some(old => old.id === entry.id))] : [...next.chain, ...previous.filter(entry => !next.chain.some(item => item.id === entry.id))]
      rendered.value = merged
      activeId.value = newId
      await nextTick()
      scroll.restore(newId)
      const outgoing = elements.get(oldId)
      const incoming = elements.get(newId)
      try {
        if (outgoing && incoming) await animateStack(manager, outgoing, incoming, direction, false, flipState)
      } catch (error) {
        // A visual effect must not strand the route or keep the form locked.
        console.error('[motion] Screen animation failed', error)
      } finally { flipState?.release() }
      if (disposed) break
      current = next
      rendered.value = next.chain
      await nextTick()
      settleScreens(next.chain.map(entry => elements.get(entry.id)!).filter(Boolean))
      scroll.retain(next.chain.map(entry => entry.id))
      scroll.persist()
      for (const id of focusMemory.keys()) if (!next.chain.some(entry => entry.id === id)) focusMemory.delete(id)
      if (!pending) {
        const remembered = focusMemory.get(newId)
        if (remembered?.isConnected) remembered.focus({ preventScroll: true })
        else incoming?.querySelector<HTMLElement>('[data-screen-title]')?.focus({ preventScroll: true })
      }
    }
  } finally { busy.value = false; navigationRequested = false }
}
const removeHook = router.afterEach((to, _from, failure) => {
  if (failure) { navigationRequested = false; return }
  if (to.meta.layout !== stackLayout) { manager.finish(); navigationRequested = false; return }
  let target = readSnapshot(window.history.state?.[HISTORY_KEY])
  if (!target || target.chain.at(-1)?.path !== to.fullPath) {
    target = nextSnapshot(current, to.fullPath, rootPath)
    window.history.replaceState({ ...window.history.state, [HISTORY_KEY]: target }, '')
  }
  void reconcile(target)
})
provide(navigationKey, {
  busy,
  async push(path) {
    if (busy.value || navigationRequested) return
    navigationRequested = true
    try { await router.push({ path, force: true, state: { [HISTORY_KEY]: nextSnapshot(current, path, rootPath) as never } }) }
    finally { if (!busy.value) navigationRequested = false }
  },
  async back() {
    if (busy.value || navigationRequested) return
    if (current.chain.length <= 1) return
    navigationRequested = true
    if (!current.virtualRoot || current.chain.length > 2) router.back()
    else {
      const target = { chain: current.chain.slice(0, -1), virtualRoot: false }
      await router.replace({ path: target.chain.at(-1)!.path, state: { [HISTORY_KEY]: target as never } })
    }
  },
})
useResizeObserver(container, () => { if (busy.value) manager.finish(); else scroll.restore(activeId.value) })
useEventListener(window, 'pagehide', () => { scroll.capture(activeId.value); scroll.persist() })
nextTick(() => { settleScreens(current.chain.map(entry => elements.get(entry.id)!).filter(Boolean)); scroll.restore(activeId.value) })
onBeforeUnmount(() => { disposed = true; removeHook(); manager.dispose(); scroll.capture(activeId.value); scroll.persist(); scroll.dispose() })
</script>
<template>
  <section ref="container" class="navigation-stack" :aria-busy="busy" aria-label="Tài khoản Mộc">
    <p class="sr-only" aria-live="polite">{{ currentTitle }}</p>
    <article v-for="(entry, index) in rendered" :key="entry.id" :ref="element => bindScreen(entry.id, element)" class="navigation-screen" :style="{ zIndex: index + 1 }" :inert="entry.id !== activeId || busy" :aria-hidden="entry.id !== activeId" :data-entry-id="entry.id">
      <component :is="componentFor(entry.path)" :entry-id="entry.id" />
    </article>
  </section>
</template>







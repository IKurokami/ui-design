import { nextTick, onBeforeUnmount, watch, type Ref, type WatchSource } from 'vue'
import { useEventListener } from '@vueuse/core'
import { AnimationManager } from '../core/animation-manager'
import { animateMotion, captureMotion, type MotionOptions, type MotionSnapshot } from '../auto/motion'

export interface AutoMotionOptions extends Omit<MotionOptions, 'mode' | 'reduced'> {
  reduced?: boolean | (() => boolean)
  deep?: boolean
  onError?: (error: unknown) => void
}

/** Capture before Vue patches; discover/classify/animate after its DOM commit. */
export function useAutoMotion<T>(root: Ref<HTMLElement | undefined | null>, source: WatchSource<T>, options: AutoMotionOptions = {}) {
  const manager = new AnimationManager()
  let pending: MotionSnapshot | undefined
  let revision = 0
  let disposed = false
  const reduced = () => typeof options.reduced === 'function' ? options.reduced() : options.reduced ?? window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  const stop = watch(source, async () => {
    const current = ++revision
    manager.finish()
    // Multiple changes in one render batch must retain the FIRST pre-patch state.
    if (!pending && root.value) pending = captureMotion(root.value, { ghosts: !reduced() })
    await nextTick()
    if (disposed || current !== revision) return
    const captured = pending
    pending = undefined
    if (!captured) return
    if (!root.value) { captured.release(); return }
    try { await animateMotion(manager, captured, root.value, { ...options, mode: 'list', reduced: reduced() }) }
    catch (error) { captured.release(); if (options.onError) options.onError(error); else console.error('[motion] Animation failed', error) }
  }, { flush: 'pre', deep: options.deep ?? true })
  useEventListener(window, 'resize', () => manager.finish())
  function finish() { manager.finish() }
  onBeforeUnmount(() => { disposed = true; revision++; stop(); manager.dispose(); pending?.release(); pending = undefined })
  return { finish }
}

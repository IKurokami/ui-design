import { nextTick, onBeforeUnmount, watch, type ComputedRef, type Ref } from 'vue'
import gsap from 'gsap'
import { Flip } from 'gsap/Flip'
import { AnimationManager } from '../core/animation-manager'
import { animateMotion, captureMotion, type MotionSnapshot } from '../auto/motion'
gsap.registerPlugin(Flip)
const pageMotion = { duration: 0.62, ease: 'power3.inOut', depthX: -4, depthScale: 0.95 }
const pageProps = 'transform,transformOrigin,opacity,visibility,pointerEvents,zIndex,willChange,borderRadius,boxShadow'
export function usePageMotion(brand: Ref<HTMLElement | undefined>, isInnerPage: ComputedRef<boolean>, direction?: Ref<'push' | 'pop'>) {
  const tweens = new Map<Element, gsap.core.Tween>()
  const sharedManager = new AnimationManager()
  let pending: MotionSnapshot | undefined
  let logo: gsap.core.Timeline | undefined
  let revision = 0
  watch(isInnerPage, async () => {
    if (!brand.value) return
    logo?.kill()
    const state = Flip.getState(brand.value)
    const color = getComputedStyle(brand.value).color
    const current = ++revision
    await nextTick()
    if (current !== revision || !brand.value) return
    gsap.set(brand.value, { clearProps: 'transform,color' })
    const targetColor = getComputedStyle(brand.value).color
    logo = gsap.timeline({ onComplete: () => { if (brand.value) gsap.set(brand.value, { clearProps: 'transform,color' }) } })
    logo.add(Flip.from(state, { targets: brand.value, scale: true, duration: pageMotion.duration, ease: pageMotion.ease }), 0)
    logo.fromTo(brand.value, { color }, { color: targetColor, duration: 0.22, ease: 'power1.out' }, 0)
  })
  function reset(element: Element) {
    tweens.get(element)?.kill()
    tweens.delete(element)
    gsap.set(element, { clearProps: pageProps })
  }
  function cancel(element: Element) {
    sharedManager.dispose()
    pending?.release()
    pending = undefined
    reset(element)
  }
  function enter(element: Element, done: () => void) {
    reset(element)
    // Measure destination children at rest BEFORE transforming the page root.
    const captured = pending
    pending = undefined
    if (captured && element instanceof HTMLElement) {
      void animateMotion(sharedManager, captured, element, { mode: 'overlay', duration: pageMotion.duration, ease: pageMotion.ease })
        .catch(error => console.error('[motion] Shared page animation failed', error))
    } else captured?.release()
    const push = direction ? direction.value === 'push' : isInnerPage.value
    gsap.set(element, { zIndex: push ? 2 : 1, transformOrigin: '50% 50%', willChange: 'transform', boxShadow: push ? '-24px 0 64px rgba(0,0,0,0.18)' : 'none' })
    tweens.set(element, gsap.fromTo(element,
      { autoAlpha: 1, xPercent: push ? 100 : pageMotion.depthX, scale: push ? 1 : pageMotion.depthScale, borderRadius: push ? 0 : 20, pointerEvents: 'none' },
      { xPercent: 0, scale: 1, borderRadius: 0, duration: pageMotion.duration, ease: pageMotion.ease, onComplete: () => {
        tweens.delete(element)
        gsap.set(element, { clearProps: pageProps })
        done()
      } },
    ))
  }
  function leave(element: Element, done: () => void) {
    cancel(element)
    if (element instanceof HTMLElement) pending = captureMotion(element, { ghosts: true })
    const push = direction ? direction.value === 'push' : isInnerPage.value
    gsap.set(element, { autoAlpha: 1, zIndex: push ? 1 : 2, pointerEvents: 'none', transformOrigin: '50% 50%', willChange: 'transform', boxShadow: push ? 'none' : '-24px 0 64px rgba(0,0,0,0.18)' })
    tweens.set(element, gsap.to(element, {
      xPercent: push ? pageMotion.depthX : 100,
      scale: push ? pageMotion.depthScale : 1,
      borderRadius: push ? 20 : 0,
      duration: pageMotion.duration,
      ease: pageMotion.ease,
      onComplete: () => {
        tweens.delete(element)
        if (pending?.root === element) { pending.release(); pending = undefined }
        done()
        gsap.set(element, { clearProps: pageProps })
      },
    }))
  }
  onBeforeUnmount(() => { revision++; logo?.kill(); sharedManager.dispose(); pending?.release(); tweens.forEach(tween => tween.kill()); tweens.clear() })
  return { enter, leave, cancel }
}

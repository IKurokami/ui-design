import { nextTick, onBeforeUnmount, watch, type ComputedRef, type Ref } from 'vue'
import gsap from 'gsap'
import { Flip } from 'gsap/Flip'
import { AnimationManager } from '../core/animation-manager'
import { animateMotion, captureMotion, type MotionSnapshot } from '../auto/motion'
gsap.registerPlugin(Flip)
const pageMotion = { duration: 0.62, ease: 'power3.inOut', depthX: -4, depthScale: 0.95 }
const pageProps = 'transform,transformOrigin,opacity,visibility,pointerEvents,zIndex,willChange,borderRadius,boxShadow'
export function usePageMotion(brand: Ref<HTMLElement | undefined>, isInnerPage: ComputedRef<boolean>, direction?: Ref<'push' | 'pop'>, brandLayout?: ComputedRef<string>) {
  const tweens = new Map<Element, gsap.core.Tween>()
  const sharedManager = new AnimationManager()
  let pending: MotionSnapshot | undefined
  let logo: gsap.core.Timeline | undefined
  let logoTargets: Element[] = []
  let revision = 0
  watch(() => brandLayout?.value ?? isInnerPage.value, async () => {
    if (!brand.value) return
    // Pause before killing: Flip keeps a reference to its timeline on targets.
    // A killed but unpaused timeline can still be forced to completion by getState.
    logo?.pause().kill()
    logoTargets = [brand.value, ...brand.value.querySelectorAll('.brand-icon, .brand-name, .brand-name > span')]
    // getState completes existing Flips by default. Stop them without seeking to
    // their end so a reversal starts from the logo's current visible position.
    const targets = logoTargets.length === 1 ? brand.value : logoTargets
    const state = Flip.getState(targets, { props: 'color' })
    const current = ++revision
    await nextTick()
    if (current !== revision || !brand.value) return
    gsap.set(targets, { clearProps: 'transform,color' })
    // Nested FLIP compensates for parent scaling, preserving each glyph and icon
    // at the starting frame even when gap, alignment and font size change.
    logo = Flip.from(state, {
      targets, nested: true, scale: true, props: 'color',
      duration: pageMotion.duration, ease: pageMotion.ease,
      onComplete: () => {
        if (current === revision) gsap.set(targets, { clearProps: 'transform,color' })
      },
    })
  }, { flush: 'pre' })
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
  onBeforeUnmount(() => { revision++; logo?.pause().kill(); sharedManager.dispose(); pending?.release(); tweens.forEach(tween => tween.kill()); tweens.clear() })
  return { enter, leave, cancel }
}

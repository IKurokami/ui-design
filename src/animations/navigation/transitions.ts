import gsap from 'gsap'
import { AnimationManager, motion } from '../core/animation-manager'
import { animateMotion, captureMotion, matchMotion, type MotionSnapshot } from '../auto/motion'
export { captureMotion }

export function animateStack(manager: AnimationManager, outgoing: HTMLElement, incoming: HTMLElement, direction: 'push' | 'pop', reduced: boolean, captured?: MotionSnapshot) {
  const snapshot = captured ?? captureMotion(outgoing)
  // Retained screens are hidden/scaled at rest. Measure the destination layout at
  // its final position before discovering targets or choosing the transition.
  gsap.set(incoming, { autoAlpha: 1, xPercent: 0, scale: 1 })
  if (matchMotion(snapshot, incoming).shared.length) {
    return animateMotion(manager, snapshot, incoming, { mode: 'page', direction, reduced })
  }
  // Other future screens retain the native-style push/pop transition.
  gsap.set([outgoing, incoming], { autoAlpha: 1 })
  if (direction === 'push') gsap.set(incoming, { xPercent: 100, scale: 1 })
  return manager.play(timeline => {
    if (direction === 'push') {
      timeline.to(outgoing, { xPercent: motion.depthX, scale: motion.depthScale }, 0)
      timeline.to(incoming, { xPercent: 0, scale: 1 }, 0)
    } else {
      timeline.to(outgoing, { xPercent: 100, scale: 1 }, 0)
      timeline.to(incoming, { xPercent: 0, scale: 1 }, 0)
    }
  }, reduced, snapshot.release)
}
export function settleScreens(screens: HTMLElement[]) {
  screens.forEach((element, index) => gsap.set(element, {
    xPercent: index === screens.length - 1 ? 0 : motion.depthX,
    scale: index === screens.length - 1 ? 1 : motion.depthScale,
    autoAlpha: index === screens.length - 1 ? 1 : 0,
  }))
}


import gsap from 'gsap'
import { AnimationManager, motion } from '../core/animation-manager'
import { animateAuthFlip, captureAuthFlip, type AuthFlipState } from './auth-flip'
export { captureAuthFlip }

export function animateStack(manager: AnimationManager, outgoing: HTMLElement, incoming: HTMLElement, direction: 'push' | 'pop', reduced: boolean, captured?: AuthFlipState) {
  if (captured && incoming.querySelector('[data-auth-flip]')) {
    return animateAuthFlip(manager, captured, outgoing, incoming, direction, reduced)
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
  }, reduced)
}
export function settleScreens(screens: HTMLElement[]) {
  screens.forEach((element, index) => gsap.set(element, {
    xPercent: index === screens.length - 1 ? 0 : motion.depthX,
    scale: index === screens.length - 1 ? 1 : motion.depthScale,
    autoAlpha: index === screens.length - 1 ? 1 : 0,
  }))
}


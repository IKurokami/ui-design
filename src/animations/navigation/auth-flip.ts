import gsap from 'gsap'
import { Flip } from 'gsap/Flip'
import { AnimationManager, motion } from '../core/animation-manager'
import { captureFlipText, prepareFlipText, type FlipTextState } from './text-flip'

gsap.registerPlugin(Flip)
const sharedSelector = '[data-auth-flip]'
const enteringSelector = '[data-auth-enter]'
export interface AuthFlipState { layout: ReturnType<typeof Flip.getState>; text: FlipTextState }

/** Capture the visible entry only, before Vue mounts/reorders the next screen. */
export function captureAuthFlip(screen: HTMLElement | undefined): AuthFlipState | undefined {
  const targets = screen?.querySelectorAll<HTMLElement>(sharedSelector)
  return targets?.length ? { layout: Flip.getState(targets), text: captureFlipText([...targets]) } : undefined
}
export function animateAuthFlip(
  manager: AnimationManager,
  state: AuthFlipState,
  outgoing: HTMLElement,
  incoming: HTMLElement,
  direction: 'push' | 'pop',
  reduced: boolean,
) {
  const shared = [...incoming.querySelectorAll<HTMLElement>(sharedSelector)]
  const entering = [...incoming.querySelectorAll<HTMLElement>(enteringSelector)]
  const leaving = [...outgoing.querySelectorAll<HTMLElement>(enteringSelector)]
  const offset = direction === 'push' ? 14 : -14
  // Parent transforms stay fixed while Flip owns child transforms.
  gsap.set([outgoing, incoming], { xPercent: 0, scale: 1 })
  gsap.set(incoming, { autoAlpha: 0 })
  // Both layers must be transparent while exchanging shared elements, including pop.
  const backgrounds = [outgoing.style.backgroundColor, incoming.style.backgroundColor]
  gsap.set([outgoing, incoming], { backgroundColor: 'transparent' })
  let text: ReturnType<typeof prepareFlipText> | undefined
  const cleanup = () => {
    text?.cleanup()
    shared.forEach(element => element.classList.remove('is-auth-flipping'))
    gsap.set([...shared, ...entering, ...leaving], { clearProps: 'transform,opacity,visibility' })
    outgoing.style.backgroundColor = backgrounds[0]!
    incoming.style.backgroundColor = backgrounds[1]!
  }
  return manager.play(timeline => {
    if (reduced) {
      timeline.set(outgoing, { autoAlpha: 0 }, 0).set(incoming, { autoAlpha: 1 }, 0)
      return
    }
    text = prepareFlipText(state.text, shared)
    const swapAt = 0.1
    if (leaving.length) timeline.to(leaving, { autoAlpha: 0, y: -offset, duration: swapAt, ease: 'power1.in' }, 0)
    timeline.set(outgoing, { autoAlpha: 0 }, swapAt)
    timeline.set(incoming, { autoAlpha: 1 }, swapAt)
    timeline.add(Flip.from(state.layout, {
      targets: shared,
      scale: true,
      duration: motion.duration,
      ease: motion.ease,
      prune: true,
      toggleClass: 'is-auth-flipping',
    }), swapAt)
    text.animate(timeline, swapAt + 0.06)
    if (entering.length) timeline.fromTo(entering,
      { autoAlpha: 0, y: offset },
      { autoAlpha: 1, y: 0, duration: 0.3, stagger: { amount: 0.08 }, ease: 'power1.in', immediateRender: true },
      swapAt + 0.16,
    )
  }, reduced, cleanup)
}

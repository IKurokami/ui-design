import gsap from 'gsap'
import { Flip } from 'gsap/Flip'
import { AnimationManager, motion } from '../core/animation-manager'
import { captureFlipText, prepareFlipText, type FlipTextState } from '../navigation/text-flip'
import { assignFlipIds, discoverMotion, type MotionDiagnostic, type MotionTarget } from './elements'
import { createMotionGhost, createMotionOverlay, placeGhost } from './ghosts'

gsap.registerPlugin(Flip)
export interface CapturedTarget extends MotionTarget { rect: DOMRect; ghost?: HTMLElement }
export interface MotionSnapshot {
  root: HTMLElement
  targets: CapturedTarget[]
  layout: ReturnType<typeof Flip.getState>
  text: FlipTextState
  diagnostics: MotionDiagnostic[]
  release: () => void
}
export interface MotionPlan {
  shared: { before: CapturedTarget; after: MotionTarget }[]
  entering: MotionTarget[]
  leaving: CapturedTarget[]
  diagnostics: MotionDiagnostic[]
}
export interface MotionOptions {
  mode?: 'page' | 'list' | 'overlay'
  direction?: 'push' | 'pop'
  reduced?: boolean
  duration?: number
  ease?: string
  stagger?: number
  onPlan?: (plan: MotionPlan) => void
}

export function captureMotion(root: HTMLElement, options: { ghosts?: boolean } = {}): MotionSnapshot {
  const discovery = discoverMotion(root)
  const releaseIds = assignFlipIds(discovery.targets)
  try {
    const targets = discovery.targets.map(target => ({ ...target, rect: target.element.getBoundingClientRect(), ghost: options.ghosts ? createMotionGhost(target.element) : undefined }))
    return {
      root, targets, diagnostics: discovery.diagnostics,
      layout: Flip.getState(targets.filter(target => target.key).map(target => target.element)),
      text: captureFlipText(targets.filter(target => target.key).map(target => target.element)),
      release: () => { releaseIds(); targets.forEach(target => { target.ghost = undefined }) },
    }
  } catch (error) { releaseIds(); throw error }
}

/** Pure classification, without selectors specific to any page or feature. */
export function matchMotion(before: MotionSnapshot, incoming: HTMLElement): MotionPlan {
  const after = discoverMotion(incoming)
  const oldByKey = new Map(before.targets.filter(target => target.key).map(target => [target.key!, target]))
  const shared: MotionPlan['shared'] = []
  const entering: MotionTarget[] = []
  for (const target of after.targets) {
    const previous = target.key ? oldByKey.get(target.key) : undefined
    if (previous) { shared.push({ before: previous, after: target }); oldByKey.delete(target.key!) }
    else entering.push(target)
  }
  const matched = new Set(shared.map(pair => pair.before))
  return { shared, entering, leaving: before.targets.filter(target => !matched.has(target)), diagnostics: [...before.diagnostics, ...after.diagnostics] }
}

const animatedProperties = ['transform', 'transform-origin', 'translate', 'scale', 'rotate', 'opacity', 'visibility', 'position', 'top', 'left', 'right', 'bottom', 'width', 'height', 'max-width', 'max-height', 'min-width', 'min-height', 'z-index', 'will-change']
function saveStyles(elements: HTMLElement[]) {
  const saved = [...new Set(elements)].map(element => ({ element, props: animatedProperties.map(property => ({ property, value: element.style.getPropertyValue(property), priority: element.style.getPropertyPriority(property) })) }))
  return () => saved.forEach(({ element, props }) => {
    gsap.set(element, { clearProps: 'transform' })
    props.forEach(({ property, value, priority }) => value ? element.style.setProperty(property, value, priority) : element.style.removeProperty(property))
  })
}

/** Restore exact inline state even on setup errors, interruption, or unmount. */
export function animateMotion(manager: AnimationManager, before: MotionSnapshot, incoming: HTMLElement, options: MotionOptions = {}) {
  manager.finish()
  const mode = options.mode ?? 'page'
  const duration = options.duration ?? motion.duration
  const ease = options.ease ?? motion.ease
  const offset = options.direction === 'pop' ? -14 : 14
  if (mode === 'page') gsap.set(incoming, { autoAlpha: 1, xPercent: 0, scale: 1 })
  const plan = matchMotion(before, incoming)
  const afterTargets = [...plan.shared.map(pair => pair.after), ...plan.entering]
  const restoreIds = assignFlipIds(afterTargets)
  const restoreStyles = saveStyles([...before.targets.map(target => target.element), ...afterTargets.map(target => target.element)])
  const backgrounds = [before.root.style.backgroundColor, incoming.style.backgroundColor]
  let overlay: HTMLElement | undefined
  let text: ReturnType<typeof prepareFlipText> | undefined
  const cleanup = () => {
    text?.cleanup()
    overlay?.remove()
    afterTargets.forEach(target => target.element.classList.remove('is-motion-flipping'))
    restoreStyles()
    if (mode === 'page') {
      gsap.set(before.root, { autoAlpha: 0, xPercent: 0, scale: 1 })
      gsap.set(incoming, { autoAlpha: 1, xPercent: 0, scale: 1 })
      before.root.style.backgroundColor = backgrounds[0]!
      incoming.style.backgroundColor = backgrounds[1]!
    }
    restoreIds()
    before.release()
  }
  return manager.play(timeline => {
    options.onPlan?.(plan)
    if (options.reduced) {
      if (mode === 'page') timeline.set(before.root, { autoAlpha: 0, xPercent: 0, scale: 1 }, 0).set(incoming, { autoAlpha: 1, xPercent: 0, scale: 1 }, 0)
      return
    }
    const stagger = options.stagger ?? 0.035
    if (mode === 'overlay') {
      // An independent visual layer avoids compounding a parent page's slide/scale.
      for (const pair of plan.shared) {
        const ghost = pair.before.ghost
        const from = pair.before.rect
        const to = pair.after.element.getBoundingClientRect()
        if (!ghost || !from.width || !from.height || !to.width || !to.height || pair.after.element.matches('input, textarea, select, canvas, video') || pair.after.element.querySelector('input, textarea, select, canvas, video')) continue
        overlay ??= createMotionOverlay()
        placeGhost(overlay, ghost, from)
        const nextGhost = createMotionGhost(pair.after.element)
        gsap.set([pair.before.element, pair.after.element], { visibility: 'hidden' })
        timeline.to(ghost, { x: to.left - from.left, y: to.top - from.top, scaleX: to.width / from.width, scaleY: to.height / from.height, duration, ease }, 0)
        // Crossfade into the destination's real content and styling, including images.
        placeGhost(overlay, nextGhost, from)
        gsap.set(nextGhost, { visibility: 'visible', autoAlpha: 0, scaleX: from.width / to.width, scaleY: from.height / to.height, width: to.width, height: to.height })
        timeline.to(nextGhost, { x: to.left - from.left, y: to.top - from.top, scaleX: 1, scaleY: 1, autoAlpha: 1, duration, ease }, 0)
        timeline.to(ghost, { autoAlpha: 0, duration, ease }, 0)
      }
      return
    }
    const shared = plan.shared.map(pair => pair.after.element)
    const swapAt = mode === 'page' ? 0.1 : 0
    if (mode === 'page') {
      gsap.set([before.root, incoming], { xPercent: 0, scale: 1, backgroundColor: 'transparent' })
      gsap.set(incoming, { autoAlpha: 0 })
      if (plan.leaving.length) timeline.to(plan.leaving.map(target => target.element), { autoAlpha: 0, y: -offset, duration: swapAt, ease: 'power1.in' }, 0)
      timeline.set(before.root, { autoAlpha: 0 }, swapAt).set(incoming, { autoAlpha: 1 }, swapAt)
    } else {
      // Vue has already removed departing list nodes. Their captured visuals can leave
      // without putting detached controls back into the live DOM/layout.
      for (const target of plan.leaving) {
        if (!target.ghost || !target.rect.width || !target.rect.height) continue
        overlay ??= createMotionOverlay()
        placeGhost(overlay, target.ghost, target.rect)
        timeline.to(target.ghost, { autoAlpha: 0, y: -offset, scale: 0.96, duration: Math.min(duration, 0.25), ease: 'power1.in' }, 0)
      }
    }
    if (shared.length) {
      text = prepareFlipText(before.text, shared)
      timeline.add(Flip.from(before.layout, { targets: shared, scale: true, duration, ease, prune: true, toggleClass: 'is-motion-flipping' }), swapAt)
      text.animate(timeline, swapAt + 0.06)
    }
    if (plan.entering.length) timeline.fromTo(plan.entering.map(target => target.element),
      { autoAlpha: 0, y: offset },
      { autoAlpha: 1, y: 0, duration: Math.min(duration, 0.3), stagger, ease: 'power2.out', immediateRender: true },
      mode === 'page' ? swapAt + 0.16 : 0,
    )
  }, options.reduced ?? false, cleanup)
}

import gsap from 'gsap'
import { Flip } from 'gsap/Flip'
import { AnimationManager, motion } from '../core/animation-manager'
import { captureFlipText, prepareFlipText, type FlipTextState } from '../navigation/text-flip'
import { assignFlipIds, discoverMotion, type MotionDiagnostic, type MotionTarget } from './elements'
import { createMotionGhost, createMotionOverlay, placeGhost } from './ghosts'

gsap.registerPlugin(Flip)
export interface CapturedTarget extends MotionTarget { rect: DOMRect; visibleRect: DOMRect; ghost?: HTMLElement }
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
  /** Exact keys or key prefixes mapped to their nearest retained control. */
  collapseTo?: string | Record<string, string>
  /** Sequential folds in this key group, bounded to finish before the layout. */
  foldGroup?: string
  foldStagger?: number
  /** Let targets cross clipping ancestors within this root during a layout Flip. */
  unclip?: boolean
  /** Compensate parent transforms for explicitly opted-in nested targets. */
  nested?: boolean
  /** False animates actual dimensions and reveals content without stretching it. */
  scale?: boolean
}

/** Preserve scroll viewports; only the portion already on screen may fly out.
 * Marked clips outside the capture root count too: a list component may sit
 * inside a page-owned scroll viewport it cannot be the root of. */
function visibleRect(element: HTMLElement, rect: DOMRect, _root: HTMLElement): DOMRect {
  let left = rect.left, top = rect.top, right = rect.right, bottom = rect.bottom
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    if (parent.hasAttribute('data-motion-clip')) {
      const clip = parent.getBoundingClientRect()
      if (clip.width && clip.height) {
        left = Math.max(left, clip.left); top = Math.max(top, clip.top)
        right = Math.min(right, clip.right); bottom = Math.min(bottom, clip.bottom)
      }
    }
  }
  return new DOMRect(left, top, Math.max(0, right - left), Math.max(0, bottom - top))
}
function fullyVisible(rect: DOMRect, visible: DOMRect) {
  return visible.width > 0 && visible.height > 0 && Math.abs(rect.width - visible.width) < 1 && Math.abs(rect.height - visible.height) < 1
}
function clipGhost(ghost: HTMLElement, rect: DOMRect, visible: DOMRect) {
  ghost.style.clipPath = `inset(${Math.max(0, visible.top - rect.top)}px ${Math.max(0, rect.right - visible.right)}px ${Math.max(0, rect.bottom - visible.bottom)}px ${Math.max(0, visible.left - rect.left)}px)`
}
function foldedClip(rect: DOMRect, visible = rect) {
  const centerX = visible.left + visible.width / 2 - rect.left
  const centerY = visible.top + visible.height / 2 - rect.top
  return `inset(${Math.max(0, centerY - 2)}px ${Math.max(0, rect.width - centerX - 4)}px ${Math.max(0, rect.height - centerY - 2)}px ${Math.max(0, centerX - 4)}px round 4px)`
}

export function captureMotion(root: HTMLElement, options: { ghosts?: boolean } = {}): MotionSnapshot {
  const discovery = discoverMotion(root)
  const releaseIds = assignFlipIds(discovery.targets)
  try {
    const targets = discovery.targets.map(target => {
      const rect = target.element.getBoundingClientRect()
      const visible = visibleRect(target.element, rect, root)
      const outsideStrip = target.element.hasAttribute('data-motion-overlay-target') && (!visible.width || !visible.height)
      return { ...target, rect, visibleRect: visible, ghost: options.ghosts && !outsideStrip ? createMotionGhost(target.element) : undefined }
    })
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
  const useScale = options.scale ?? true
  const offset = options.direction === 'pop' ? -14 : 14
  if (mode === 'page') gsap.set(incoming, { autoAlpha: 1, xPercent: 0, scale: 1 })
  const plan = matchMotion(before, incoming)
  const afterTargets = [...plan.shared.map(pair => pair.after), ...plan.entering]
  const restoreIds = assignFlipIds(afterTargets)
  const restoreStyles = saveStyles([...before.targets.map(target => target.element), ...afterTargets.map(target => target.element)])
  const backgrounds = [before.root.style.backgroundColor, incoming.style.backgroundColor]
  // Measure final geometry before Flip applies inverse transforms.
  const afterRects = new Map(afterTargets.map(target => [target.element, target.element.getBoundingClientRect()]))
  const afterVisible = new Map(afterTargets.map(target => [target.element, visibleRect(target.element, afterRects.get(target.element)!, incoming)]))
  const anchors = [...incoming.querySelectorAll<HTMLElement>('[data-motion-key]')].map(element => ({
    key: element.dataset.motionKey!, rect: element.getBoundingClientRect(),
  })).filter(anchor => anchor.rect.width && anchor.rect.height)
  function anchorFor(target: MotionTarget, rect: DOMRect) {
    const mapping = options.collapseTo
    if (!mapping) return undefined
    const key = target.element.dataset.motionKey ?? ''
    const mapped = typeof mapping === 'string' ? mapping : Object.keys(mapping)
      .sort((a, b) => b.length - a.length).find(prefix => key === prefix || (prefix.endsWith(':') && key.startsWith(prefix)))
    const anchorKey = typeof mapping === 'string' ? mapped : mapped ? mapping[mapped] : undefined
    if (anchorKey) return anchors.find(anchor => anchor.key === anchorKey)?.rect
    const candidates = anchors.filter(anchor => Object.values(mapping).includes(anchor.key))
    const distance = (anchor: typeof anchors[number]) => Math.hypot(anchor.rect.left + anchor.rect.width / 2 - rect.left - rect.width / 2, anchor.rect.top + anchor.rect.height / 2 - rect.top - rect.height / 2)
    return candidates.sort((a, b) => distance(a) - distance(b))[0]?.rect
  }
  const unclipped = new Map<HTMLElement, { props: { property: string; value: string; priority: string }[]; scrollLeft: number; scrollTop: number }>()
  if (options.unclip) {
    for (const target of afterTargets) {
      for (let parent = target.element.parentElement; parent; parent = parent.parentElement) {
        const style = getComputedStyle(parent)
        if (!parent.hasAttribute('data-motion-clip') && !unclipped.has(parent) && /hidden|clip|auto|scroll/.test(style.overflow + style.overflowX + style.overflowY)) {
          const props = ['overflow', 'overflow-x', 'overflow-y'].map(property => ({
            property, value: parent.style.getPropertyValue(property), priority: parent.style.getPropertyPriority(property),
          }))
          unclipped.set(parent, { props, scrollLeft: parent.scrollLeft, scrollTop: parent.scrollTop })
          props.forEach(({ property }) => parent.style.setProperty(property, 'visible', 'important'))
        }
        if (parent === incoming) break
      }
    }
  }
  let overlay: HTMLElement | undefined
  let text: ReturnType<typeof prepareFlipText> | undefined
  const hadLayoutClass = incoming.classList.contains('is-motion-layout-active')
  const cleanup = () => {
    text?.cleanup()
    overlay?.remove()
    afterTargets.forEach(target => target.element.classList.remove('is-motion-flipping'))
    if (!hadLayoutClass) incoming.classList.remove('is-motion-layout-active')
    restoreStyles()
    unclipped.forEach((saved, element) => {
      saved.props.forEach(({ property }) => element.style.removeProperty(property))
      saved.props.forEach(({ property, value, priority }) => { if (value) element.style.setProperty(property, value, priority) })
      element.scrollLeft = saved.scrollLeft
      element.scrollTop = saved.scrollTop
    })
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
    if (mode === 'list' && options.unclip) incoming.classList.add('is-motion-layout-active')
    if (mode === 'overlay') {
      // An independent visual layer avoids compounding a parent page's slide/scale.
      for (const pair of plan.shared) {
        const ghost = pair.before.ghost
        const from = pair.before.rect
        const to = pair.after.element.getBoundingClientRect()
        if (!ghost || !from.width || !from.height || !to.width || !to.height || pair.after.element.matches('input, textarea, select, canvas, video') || pair.after.element.querySelector('input, textarea, select, canvas, video')) continue
        overlay ??= createMotionOverlay(incoming)
        placeGhost(overlay, ghost, from)
        const nextGhost = createMotionGhost(pair.after.element)
        // Ghost descendants keep their computed px layout sizes, while rects
        // include ancestor transforms (perspective + translateZ, page scale…).
        // Lay each ghost out at its source's untransformed box and express the
        // on-screen rect purely through scale, so children fill the ghost and
        // the final frame matches the real node exactly.
        //
        // const fromBox = layoutBox(pair.before.size, from)
        // const toBox = layoutBox(layoutSize(pair.after.element), to)
        //

        const imageSources = (element: HTMLElement) => {
          const images: HTMLImageElement[] = element.matches('img')
            ? [element as HTMLImageElement]
            : [...element.querySelectorAll<HTMLImageElement>('img')]
          return images
          .map(image => image.getAttribute('src') || image.currentSrc)
        }
        const sameImageVisual = imageSources(pair.before.element).length === 1
          && imageSources(pair.after.element).length === 1
          && imageSources(pair.before.element)[0] === imageSources(pair.after.element)[0]
        gsap.set([pair.before.element, pair.after.element], { visibility: 'hidden' })
        // Crossfade into the destination's real content and styling, including images.
        placeGhost(overlay, nextGhost, from)

        gsap.set(nextGhost, { visibility: 'visible', autoAlpha: 0, ...(useScale
                  ? { scaleX: from.width / to.width, scaleY: from.height / to.height, width: to.width, height: to.height }
                  : { width: from.width, height: from.height }) })

        // if (useScale) {
        //   gsap.set(ghost, { width: fromBox.width, height: fromBox.height })
        //   gsap.set(nextGhost, { width: toBox.width, height: toBox.height })
        // }
        // gsap.set(nextGhost, { visibility: 'visible', autoAlpha: 0, ...(useScale ? {} : { width: from.width, height: from.height }) })
        //
        //
        // A cover is the same visual on both pages. Crossfading two nested
        // image clones makes the child repaint one frame after its wrapper.
        // Keep one opaque ghost and reveal the real node only after it settles.
        if (sameImageVisual) nextGhost.remove()
        // The page transition can still change the destination rect while the
        // shared element is flying. Resolve the destination on every frame so
        // the final ghost frame and the real node share exactly the same box.
        const position = (progress: number) => {
          const current = progress < 0.001 ? to : pair.after.element.getBoundingClientRect()
          const destination = current.width && current.height ? current : to
          const x = (destination.left - from.left) * progress
          const y = (destination.top - from.top) * progress
          if (useScale) {
            gsap.set(ghost, {
              x, y,
              scaleX: 1 + (destination.width / from.width - 1) * progress,
              scaleY: 1 + (destination.height / from.height - 1) * progress,
            })
            gsap.set(nextGhost, {
              x, y,
              width: destination.width,
              height: destination.height,
              scaleX: progress ? 1 + (from.width / destination.width - 1) * (1 - progress) : from.width / destination.width,
              scaleY: progress ? 1 + (from.height / destination.height - 1) * (1 - progress) : from.height / destination.height,
            })
          } else {
            gsap.set(ghost, { x, y, width: from.width + (destination.width - from.width) * progress, height: from.height + (destination.height - from.height) * progress })
            gsap.set(nextGhost, { x, y, width: from.width + (destination.width - from.width) * progress, height: from.height + (destination.height - from.height) * progress })
          }
        }
        position(0)
        const size = useScale ? { scaleX: to.width / from.width, scaleY: to.height / from.height } : { width: to.width, height: to.height }
        if (sameImageVisual) {
          timeline.to(ghost, {
            x: to.left - from.left, y: to.top - from.top, ...size, duration, ease,
            onUpdate(this: gsap.core.Tween) { position(this.progress()) },
          }, 0)
          continue
        }
        timeline.to(ghost, {
          x: to.left - from.left, y: to.top - from.top, ...size, duration, ease,
          onUpdate(this: gsap.core.Tween) { position(this.progress()) },
        }, 0)
        timeline.to(nextGhost, {
          x: to.left - from.left, y: to.top - from.top,
          ...(useScale ? { scaleX: 1, scaleY: 1 } : size),
          autoAlpha: 1, duration, ease,
          onUpdate(this: gsap.core.Tween) { position(this.progress()) },
        }, 0)
        timeline.to(ghost, { autoAlpha: 0, duration, ease }, 0)
      }
      return
    }
    const overlayPairs = mode === 'list' ? plan.shared.filter(pair => pair.after.element.hasAttribute('data-motion-overlay-target')) : []
    const shared = plan.shared.filter(pair => !overlayPairs.includes(pair)).map(pair => pair.after.element)
    const swapAt = mode === 'page' ? 0.1 : 0
    if (mode === 'page') {
      gsap.set([before.root, incoming], { xPercent: 0, scale: 1, backgroundColor: 'transparent' })
      gsap.set(incoming, { autoAlpha: 0 })
      if (plan.leaving.length) timeline.to(plan.leaving.map(target => target.element), { autoAlpha: 0, y: -offset, duration: swapAt, ease: 'power1.in' }, 0)
      timeline.set(before.root, { autoAlpha: 0 }, swapAt).set(incoming, { autoAlpha: 1 }, swapAt)
    } else {
      // Vue has already removed departing list nodes. Their captured visuals can leave
      // without putting detached controls back into the live DOM/layout.
      const folds = plan.leaving.filter(target => target.element.dataset.motionKey?.startsWith(options.foldGroup ?? '\0') && target.visibleRect.width && target.visibleRect.height)
      const step = Math.min(options.foldStagger ?? 0, duration * (useScale ? 0.24 : 0.18) / Math.max(1, folds.length - 1))
      for (const target of plan.leaving) {
        if (!target.ghost || !target.rect.width || !target.rect.height || !target.visibleRect.width || !target.visibleRect.height) continue
        overlay ??= createMotionOverlay(incoming)
        placeGhost(overlay, target.ghost, target.rect)
        clipGhost(target.ghost, target.rect, target.visibleRect)
        const anchorRect = anchorFor(target, target.rect)
        const start = Math.max(0, folds.indexOf(target)) * step
        if (anchorRect?.width && anchorRect.height) {
          const foldDuration = duration * (useScale ? 0.65 : 0.78)
          gsap.set(target.ghost, { willChange: 'transform, opacity', ...(useScale ? { transformOrigin: '50% 50%' } : {}) })
          timeline.to(target.ghost, {
            x: anchorRect.left + anchorRect.width / 2 - target.rect.left - target.rect.width / 2,
            y: anchorRect.top + anchorRect.height / 2 - target.rect.top - target.rect.height / 2,
            ...(useScale
              ? { scale: Math.min(anchorRect.width / target.rect.width, anchorRect.height / target.rect.height, 0.5) * 0.6 }
              : { clipPath: foldedClip(target.rect, target.visibleRect) }),
            duration: foldDuration, ease: useScale ? 'power2.inOut' : ease,
          }, start)
          const fadeAt = useScale ? 0.7 : 0.3
          timeline.to(target.ghost, { autoAlpha: 0, duration: foldDuration * (1 - fadeAt), ease: useScale ? 'power1.in' : ease }, start + foldDuration * fadeAt)
        } else {
          timeline.to(target.ghost, { autoAlpha: 0, y: -offset, ...(useScale ? { scale: 0.96 } : {}), duration: Math.min(duration, 0.25), ease: 'power1.in' }, 0)
        }
      }
      // Retained badges move above the clipped scroll strip, while the strip
      // itself keeps its final width and overflow throughout the transition.
      for (const pair of overlayPairs) {
        const from = pair.before.rect
        const to = afterRects.get(pair.after.element)!
        const destination = afterVisible.get(pair.after.element)!
        if (!fullyVisible(from, pair.before.visibleRect) || !fullyVisible(to, destination) || !pair.before.ghost) {
          if (destination.width && destination.height) timeline.fromTo(pair.after.element, { autoAlpha: 0 }, { autoAlpha: 1, duration: duration * 0.8, ease: 'power2.out' }, 0)
          continue
        }
        overlay ??= createMotionOverlay(incoming)
        const ghost = pair.before.ghost
        const nextGhost = createMotionGhost(pair.after.element)
        placeGhost(overlay, ghost, from)
        placeGhost(overlay, nextGhost, from)
        gsap.set(pair.after.element, { visibility: 'hidden' })
        gsap.set([ghost, nextGhost], { willChange: 'transform, opacity' })
        gsap.set(nextGhost, { autoAlpha: 0, ...(useScale
          ? { width: to.width, height: to.height, scaleX: from.width / to.width, scaleY: from.height / to.height }
          : { width: from.width, height: from.height }) })
        const size = useScale ? { scaleX: to.width / from.width, scaleY: to.height / from.height } : { width: to.width, height: to.height }
        timeline.to(ghost, { x: to.left - from.left, y: to.top - from.top, ...size, autoAlpha: 0, duration, ease }, 0)
        timeline.to(nextGhost, { x: to.left - from.left, y: to.top - from.top, ...(useScale ? { scaleX: 1, scaleY: 1 } : size), autoAlpha: 1, duration, ease }, 0)
      }
    }
    if (shared.length) {
      text = prepareFlipText(before.text, shared)
      timeline.add(Flip.from(before.layout, { targets: shared, scale: useScale, nested: options.nested ?? false, duration, ease, prune: true, toggleClass: 'is-motion-flipping' }), swapAt)
      text.animate(timeline, swapAt + 0.06)
    }
    if (plan.entering.length) {
      if (mode === 'list' && options.collapseTo) {
        const unfolds = plan.entering.filter(target => target.element.dataset.motionKey?.startsWith(options.foldGroup ?? '\0') && fullyVisible(afterRects.get(target.element)!, afterVisible.get(target.element)!))
        const step = Math.min(options.foldStagger ?? 0, duration * 0.15 / Math.max(1, unfolds.length - 1))
        for (const target of plan.entering) {
          const rect = afterRects.get(target.element)!
          const anchorRect = anchorFor(target, rect)
          const visible = afterVisible.get(target.element)!
          if (!visible.width || !visible.height) continue
          if (!anchorRect || (target.element.hasAttribute('data-motion-overlay-target') && !fullyVisible(rect, visible))) {
            // Boundary badges fade inside their viewport. Hidden badges never
            // create floating copies outside the scroll strip.
            timeline.fromTo(target.element, { autoAlpha: 0 }, { autoAlpha: 1, duration: duration * 0.8, ease: 'power2.out' }, 0)
            continue
          }
          let visual = target.element
          if (target.element.hasAttribute('data-motion-overlay-target') || !useScale) {
            overlay ??= createMotionOverlay(incoming)
            visual = createMotionGhost(target.element)
            placeGhost(overlay, visual, rect)
            gsap.set(target.element, { visibility: 'hidden' })
            gsap.set(visual, { willChange: 'transform, opacity' })
          }
          timeline.fromTo(visual, {
            autoAlpha: 0, ...(useScale ? { scale: 0.3, transformOrigin: '50% 50%' } : { clipPath: foldedClip(rect) }),
            x: anchorRect.left + anchorRect.width / 2 - rect.left - rect.width / 2,
            y: anchorRect.top + anchorRect.height / 2 - rect.top - rect.height / 2,
          }, { autoAlpha: 1, x: 0, y: 0, ...(useScale ? { scale: 1 } : { clipPath: 'inset(0px 0px 0px 0px round 4px)' }), duration: duration * (useScale ? 0.8 : 0.82), ease: useScale ? 'power2.out' : ease, immediateRender: true }, Math.max(0, unfolds.indexOf(target)) * step)
        }
      } else timeline.fromTo(plan.entering.map(target => target.element),
        { autoAlpha: 0, y: offset },
        { autoAlpha: 1, y: 0, duration: Math.min(duration, 0.3), stagger, ease: 'power2.out', immediateRender: true },
        mode === 'page' ? swapAt + 0.16 : 0,
      )
    }
  }, options.reduced ?? false, cleanup)
}

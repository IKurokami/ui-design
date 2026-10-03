import gsap from 'gsap'
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin'

gsap.registerPlugin(ScrambleTextPlugin)

interface TextSnapshot { text: string; visible: boolean }
export type FlipTextState = Map<string, TextSnapshot>
interface TextLayer { element: HTMLSpanElement; text: string }
const textSelector = '[data-motion-text], [data-flip-text]'
function markers(target: HTMLElement) {
  return [...(target.matches(textSelector) ? [target] : []), ...target.querySelectorAll<HTMLElement>(textSelector)]
}
function key(target: HTMLElement, marker: HTMLElement) {
  return JSON.stringify([target.dataset.flipId, marker.dataset.motionText ?? marker.dataset.flipText])
}
/** Store labels/placeholder strings only. Never capture an input's value. */
export function captureFlipText(targets: HTMLElement[]): FlipTextState {
  const state: FlipTextState = new Map()
  targets.forEach(target => markers(target).forEach(marker => {
    const input = marker instanceof HTMLInputElement
    state.set(key(target, marker), {
      text: input ? marker.placeholder : marker.textContent ?? '',
      visible: !input || marker.value.length === 0,
    })
  }))
  return state
}
export function prepareFlipText(state: FlipTextState, targets: HTMLElement[]) {
  const layers: TextLayer[] = []
  const cleanups: (() => void)[] = []
  targets.forEach(target => markers(target).forEach(marker => {
    const previous = state.get(key(target, marker))
    const input = marker instanceof HTMLInputElement
    const nextText = input ? marker.placeholder : marker.textContent ?? ''
    if (!previous || previous.text === nextText || !previous.visible || (input && marker.value.length > 0)) return
    const host = input ? marker.parentElement! : marker
    const style = getComputedStyle(marker)
    const color = style.color
    const position = host.style.position
    const rect = marker.getBoundingClientRect()
    const hostRect = host.getBoundingClientRect()
    const className = input ? 'is-text-flipping-placeholder' : 'is-text-flipping'
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative'
    marker.classList.add(className)
    const clip = document.createElement('span')
    clip.className = 'flip-text-clip'
    clip.setAttribute('aria-hidden', 'true')
    const element = document.createElement('span')
    element.className = 'flip-text-layer'
    element.textContent = previous.text
    if (input) {
      const leftPadding = parseFloat(style.paddingLeft) || 0
      const rightPadding = parseFloat(style.paddingRight) || 0
      Object.assign(clip.style, {
        left: rect.left - hostRect.left + leftPadding + 'px',
        top: rect.top - hostRect.top + 'px',
        width: Math.max(0, rect.width - leftPadding - rightPadding) + 'px',
        height: rect.height + 'px',
        color: 'var(--placeholder)',
        font: style.font,
      })
      element.classList.add('flip-placeholder-layer')
    } else {
      Object.assign(clip.style, { inset: '0', color })
    }
    clip.append(element)
    host.appendChild(clip)
    layers.push({ element, text: nextText })
    cleanups.push(() => { clip.remove(); marker.classList.remove(className); host.style.position = position })
  }))
  return {
    count: layers.length,
    animate(timeline: gsap.core.Timeline, at: number) {
      // One visible layer stays in place while entropy resolves into complete words.
      layers.forEach(({ element, text }) => timeline.to(element, {
        duration: 0.56,
        ease: 'none',
        scrambleText: {
          text,
          chars: 'abcdefghijklmnopqrstuvwxyz0123456789',
          delimiter: ' ',
          revealDelay: 0.08,
          speed: 1,
          tweenLength: true,
          oldClass: 'flip-text-entropy',
        },
      }, at))
    },
    cleanup() { cleanups.forEach(cleanup => cleanup()) },
  }
}




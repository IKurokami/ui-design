/** A visual copy only: no input values, IDs, focus targets, or event handlers. */
export function createMotionGhost(source: HTMLElement) {
  const clone = source.cloneNode(true) as HTMLElement
  const sources = [source, ...source.querySelectorAll<HTMLElement>('*')]
  const clones = [clone, ...clone.querySelectorAll<HTMLElement>('*')]
  sources.forEach((element, index) => {
    const copy = clones[index]!
    const computed = getComputedStyle(element)
    for (let n = 0; n < computed.length; n++) {
      const property = computed.item(n)
      copy.style.setProperty(property, computed.getPropertyValue(property))
    }
    for (const attribute of [...copy.attributes]) {
      if (attribute.name === 'id' || attribute.name === 'name' || attribute.name.startsWith('on') || attribute.name.startsWith('data-motion') || attribute.name.startsWith('data-flip')) copy.removeAttribute(attribute.name)
    }
    copy.style.setProperty('animation', 'none')
    copy.style.setProperty('transition', 'none')
    if (copy instanceof HTMLInputElement) { copy.value = ''; copy.removeAttribute('value'); copy.checked = false; copy.removeAttribute('checked') }
    if (copy instanceof HTMLTextAreaElement) { copy.value = ''; copy.textContent = '' }
    if (copy instanceof HTMLSelectElement) { copy.selectedIndex = -1; copy.querySelectorAll('[selected]').forEach(option => option.removeAttribute('selected')) }
    if (copy.matches('script, iframe, object, embed')) copy.remove()
  })
  clone.inert = true
  clone.setAttribute('aria-hidden', 'true')
  Object.assign(clone.style, { margin: '0', transform: 'none', transformOrigin: '0 0', pointerEvents: 'none' })
  return clone
}

export function createMotionOverlay(root?: HTMLElement) {
  const overlay = document.createElement('div')
  overlay.setAttribute('data-motion-overlay', '')
  overlay.setAttribute('aria-hidden', 'true')
  overlay.inert = true
  Object.assign(overlay.style, { position: 'fixed', inset: '0', zIndex: '40', pointerEvents: 'none', overflow: 'hidden' })
  // A native modal is above every normal z-index. Keep its visual copies in the
  // same top layer rather than underneath the modal backdrop.
  const host = root?.closest('dialog[open]') ?? document.body
  host.append(overlay)
  return overlay
}

export function placeGhost(overlay: HTMLElement, ghost: HTMLElement, rect: DOMRect) {
  Object.assign(ghost.style, { position: 'absolute', left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px`, maxWidth: 'none', maxHeight: 'none' })
  overlay.append(ghost)
}

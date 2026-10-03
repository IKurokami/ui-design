/** Vue unmounts a component before a parent leave transition removes its DOM.
 * Keep visual resources alive through that transition, then release them once.
 */
export function disposeAfterRemoval(element: HTMLElement | undefined, dispose: () => void) {
  if (!element?.isConnected) { dispose(); return }
  const observer = new MutationObserver(() => {
    if (element.isConnected) return
    observer.disconnect()
    dispose()
  })
  observer.observe(element.ownerDocument.documentElement, { childList: true, subtree: true })
}

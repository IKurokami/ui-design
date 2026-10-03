export interface MotionTarget { element: HTMLElement; key?: string }
export interface MotionDiagnostic { type: 'duplicate-key'; key: string; elements: HTMLElement[] }
export interface MotionDiscovery { targets: MotionTarget[]; diagnostics: MotionDiagnostic[] }

const explicitSelector = '[data-motion], [data-motion-key]'
const automaticSelector = 'h1, h2, h3, img, a[href], input[name], select[name], textarea[name], button[type="submit"], [data-motion-role]'

function eligible(element: HTMLElement, root: HTMLElement) {
  for (let current: HTMLElement | null = element; current; current = current.parentElement) {
    if (current.hasAttribute('data-motion-ignore') || current.hasAttribute('data-motion-overlay') || current.hidden || current.matches('script, iframe, object, embed')) return false
    // The root itself may be inert while a navigation controller locks interaction.
    if (current !== root && (current.hasAttribute('inert') || current.getAttribute('aria-hidden') === 'true')) return false
    const style = getComputedStyle(current)
    if (style.display === 'none' || style.visibility === 'hidden') return false
    if (current === root) break
  }
  return true
}

function identity(element: HTMLElement) {
  if (element.hasAttribute('data-motion-key')) return element.dataset.motionKey || undefined
  if (element.id) return element.id
  if (element.dataset.motionRole) return `role:${element.dataset.motionRole}`
  const name = element.getAttribute('name')
  if (name) return `name:${element.tagName.toLowerCase()}:${name}`
  if (element.matches('a[href]')) return `link:${element.getAttribute('href')}`
  if (element.matches('img[src]')) return `image:${element.getAttribute('src')}`
  if (element.matches('h1, h2, h3')) return `heading:${element.tagName.toLowerCase()}`
  if (element.matches('button[type="submit"]')) return 'button:submit'
  // Anonymous markers still get enter/leave effects, but never an arbitrary match.
  return undefined
}

function scopedKey(element: HTMLElement, root: HTMLElement) {
  const key = identity(element)
  if (!key) return undefined
  const scopes: string[] = []
  for (let current: HTMLElement | null = element; current; current = current.parentElement) {
    if (current.hasAttribute('data-motion-scope')) scopes.unshift(current.dataset.motionScope || '')
    if (current === root) break
  }
  // JSON encoding avoids collisions between IDs/scopes containing separators.
  return JSON.stringify([...scopes, key])
}

/** Opt in once per scope; explicit markers also work without a scope. */
export function discoverMotion(root: HTMLElement): MotionDiscovery {
  const explicit = [...root.querySelectorAll<HTMLElement>(explicitSelector)]
  const scopes = [...(root.hasAttribute('data-motion-scope') ? [root] : []), ...root.querySelectorAll<HTMLElement>('[data-motion-scope]')]
  const automatic = scopes.flatMap(scope => [...scope.querySelectorAll<HTMLElement>(automaticSelector)])
  const explicitSet = new Set(explicit)
  const candidates = [...new Set([...explicit, ...automatic])].filter(element => eligible(element, root))
  const candidateSet = new Set(candidates)
  const explicitAncestors = new Set<HTMLElement>()
  for (const element of explicit) {
    if (!candidateSet.has(element)) continue
    for (let parent = element.parentElement; parent && parent !== root; parent = parent.parentElement) explicitAncestors.add(parent)
  }
  const selected = candidates.filter(element => {
    // A marked card owns its subtree. Do not animate a card and its title twice.
    for (let parent = element.parentElement; parent && parent !== root; parent = parent.parentElement) {
      if (candidateSet.has(parent) && explicitSet.has(parent)) return false
      if (!explicitSet.has(element) && candidateSet.has(parent) && !explicitAncestors.has(parent)) return false
    }
    return explicitSet.has(element) || !explicitAncestors.has(element)
  })
  selected.sort((a, b) => a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_PRECEDING ? 1 : -1)
  const targets = selected.map(element => ({ element, key: scopedKey(element, root) }))
  const groups = new Map<string, MotionTarget[]>()
  for (const target of targets) {
    if (target.key) {
      const group = groups.get(target.key) ?? []
      group.push(target)
      groups.set(target.key, group)
    }
  }
  const diagnostics: MotionDiagnostic[] = []
  for (const [key, group] of groups) {
    if (group.length < 2) continue
    diagnostics.push({ type: 'duplicate-key', key, elements: group.map(target => target.element) })
    // Duplicate identities are ambiguous, so all of them become enter/leave targets.
    group.forEach(target => { target.key = undefined })
  }
  return { targets, diagnostics }
}

export function assignFlipIds(targets: MotionTarget[]) {
  const previous = targets.filter(target => target.key).map(target => {
    const before = target.element.getAttribute('data-flip-id')
    const assigned = `motion:${target.key}`
    target.element.setAttribute('data-flip-id', assigned)
    return { element: target.element, before, assigned }
  })
  let released = false
  return () => {
    if (released) return
    released = true
    previous.forEach(({ element, before, assigned }) => {
      if (element.getAttribute('data-flip-id') !== assigned) return
      if (before === null) element.removeAttribute('data-flip-id')
      else element.setAttribute('data-flip-id', before)
    })
  }
}

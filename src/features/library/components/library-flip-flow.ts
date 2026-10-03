// Hold the destination flex/grid slots while Flip moves the real controls in
// absolute space. Removing controls must not change their measured endpoint.
export function reserveLibraryControlFlow(controls: HTMLElement[]) {
  const reservations: { element: HTMLElement; display: string }[] = []
  for (const control of controls) {
    const style = getComputedStyle(control)
    if (style.position === 'absolute' || style.position === 'fixed') continue
    const bounds = control.getBoundingClientRect()
    const reservation = document.createElement('div')
    reservation.setAttribute('data-library-flow-slot', '')
    reservation.setAttribute('aria-hidden', 'true')
    reservation.inert = true
    for (const property of [
      'display', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
      'align-self', 'justify-self', 'order', 'grid-column-start', 'grid-column-end',
      'grid-row-start', 'grid-row-end',
    ]) reservation.style.setProperty(property, style.getPropertyValue(property))
    Object.assign(reservation.style, {
      width: `${bounds.width}px`, height: `${bounds.height}px`,
      minWidth: '0', flex: `0 0 ${bounds.width}px`, boxSizing: 'border-box',
      visibility: 'hidden', pointerEvents: 'none',
    })
    // Keep it out of flow until Flip has taken the control out of flow too.
    const display = reservation.style.display
    reservation.style.display = 'none'
    control.after(reservation)
    reservations.push({ element: reservation, display })
  }
  return {
    activate() { reservations.forEach(({ element, display }) => { element.style.display = display }) },
    release() { reservations.forEach(({ element }) => element.remove()) },
  }
}

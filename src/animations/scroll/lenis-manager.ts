import Lenis from 'lenis'
import gsap from 'gsap'
/** Opt-in per long-reading region. Auth pages deliberately use native scrolling. */
export class LenisManager {
  private instances = new Map<HTMLElement, { lenis: Lenis; tick: (seconds: number) => void }>()
  attach(wrapper: HTMLElement, content: HTMLElement): Lenis | undefined {
    const existing = this.instances.get(wrapper)
    if (existing) return existing.lenis
    const lenis = new Lenis({ wrapper, content, autoRaf: false, syncTouch: false, anchors: false })
    const tick = (seconds: number) => lenis.raf(seconds * 1000)
    gsap.ticker.add(tick)
    this.instances.set(wrapper, { lenis, tick })
    return lenis
  }
  restore(wrapper: HTMLElement, top: number) {
    this.instances.get(wrapper)?.lenis.scrollTo(top, { immediate: true, force: true })
  }
  detach(wrapper: HTMLElement) {
    const instance = this.instances.get(wrapper)
    if (!instance) return
    gsap.ticker.remove(instance.tick); instance.lenis.destroy(); this.instances.delete(wrapper)
  }
  dispose() { for (const wrapper of this.instances.keys()) this.detach(wrapper) }
}


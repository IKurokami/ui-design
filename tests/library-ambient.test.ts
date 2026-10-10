import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import LibraryPage from '../src/features/library/pages/LibraryPage.vue'
import { libraryStories } from './fixtures/library-stories'
import AmbientBackdrop from '../src/features/library/components/AmbientBackdrop.vue'
import { extractAmbientPalette } from '../src/features/library/ambient-palette'

vi.mock('../src/services/api-client', () => ({ createApiClient: () => ({ request: vi.fn(async (path: string) => path.includes('&q=') ? [] : libraryStories) }) }))

vi.mock('../src/features/library/ambient-palette', () => ({ extractAmbientPalette: vi.fn() }))
const blue = ['#3b82f6', '#60a5fa', '#8b5cf6'] as [string, string, string]
const warm = ['#ef4444', '#f97316', '#84cc16'] as [string, string, string]

async function mountLibrary() {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/library', component: LibraryPage }] })
  await router.push('/library')
  const wrapper = mount(LibraryPage, { global: { plugins: [createPinia(), router] } })
  await flushPromises()
  return wrapper
}

describe('Library hover creates persistent multi-color particles', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    vi.mocked(extractAmbientPalette).mockReset()
    vi.mocked(extractAmbientPalette).mockReturnValue(blue)
  })
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

  it('starts with a clear background and generates one particle per hover entry', async () => {
    const wrapper = await mountLibrary()
    expect(wrapper.findAll('.lava-particle')).toHaveLength(0)
    expect(wrapper.find('.library-main-wrapper > .ambient-backdrop-container').exists()).toBe(true)
    expect(wrapper.find('.library-sidebar .ambient-backdrop-container').exists()).toBe(false)
    const card = wrapper.findAll('.deck-card')[0]!
    await card.trigger('mouseenter')
    await flushPromises()
    expect(wrapper.findAll('.lava-particle')).toHaveLength(1)
    expect(vi.mocked(extractAmbientPalette).mock.calls[0]![0]).toHaveLength(3)
    expect(card.findAll('img').every(image => image.attributes('crossorigin') === 'anonymous')).toBe(true)
    await card.trigger('focus')
    await flushPromises()
    expect(wrapper.findAll('.lava-particle')).toHaveLength(1)
    await card.trigger('mouseleave')
    await card.trigger('mouseenter')
    await flushPromises()
    expect(wrapper.findAll('.lava-particle')).toHaveLength(2)
    await card.trigger('mouseleave')
    await card.trigger('blur')
    expect(wrapper.findAll('.lava-particle')).toHaveLength(2)
    await card.trigger('mouseenter')
    await flushPromises()
    expect(wrapper.findAll('.lava-particle')).toHaveLength(3)
    // The sampled palette is cached, but every hover still gets its own particle.
    expect(extractAmbientPalette).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('retains the first particle and its colors when another item is hovered', async () => {
    vi.mocked(extractAmbientPalette).mockReturnValueOnce(blue).mockReturnValue(warm)
    const wrapper = await mountLibrary()
    const cards = wrapper.findAll('.deck-card')
    await cards[0]!.trigger('mouseenter')
    await flushPromises()
    const firstStyle = wrapper.get('.lava-particle').attributes('style')
    await cards[0]!.trigger('mouseleave')
    await cards[1]!.trigger('mouseenter')
    await flushPromises()
    const particles = wrapper.findAll('.lava-particle')
    expect(particles).toHaveLength(2)
    expect(particles[0]!.attributes('style')).toBe(firstStyle)
    for (const color of blue) expect(firstStyle).toContain(color)
    for (const color of warm) expect(particles[1]!.attributes('style')).toContain(color)
    wrapper.unmount()
  })

  it('starts every light at the bottom even when the hovered item is at the top', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 0, width: 1000, height: 800, bottom: 800, right: 1000, x: 0, y: 0, toJSON() {},
    })
    vi.spyOn(performance, 'now').mockReturnValue(0)
    const wrapper = await mountLibrary()
    const card = wrapper.findAll('.deck-card')[0]!
    vi.spyOn(card.element, 'getBoundingClientRect').mockReturnValue({
      left: 100, top: 10, width: 200, height: 260, bottom: 270, right: 300, x: 100, y: 10, toJSON() {},
    })
    await card.trigger('mouseenter')
    await flushPromises()
    const style = (wrapper.get('.lava-particle').element as HTMLElement).style
    expect(style.top).toBe('100%')
    expect(style.left).toBe('20%')
    wrapper.unmount()
  })

  it('keeps a particle when its source card disappears after filtering', async () => {
    const wrapper = await mountLibrary()
    await wrapper.findAll('.deck-card')[0]!.trigger('mouseenter')
    await flushPromises()
    await wrapper.get('.search-input-wrapper input').setValue('no matching collection')
    await vi.advanceTimersByTimeAsync(350)
    await flushPromises()
    expect(wrapper.findAll('.deck-card')).toHaveLength(0)
    expect(wrapper.findAll('.lava-particle')).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(60000)
    expect(wrapper.findAll('.lava-particle')).toHaveLength(0)
    wrapper.unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('retains live particle data across WebGL context loss', async () => {
    const wrapper = await mountLibrary()
    await wrapper.findAll('.deck-card')[0]!.trigger('mouseenter')
    await flushPromises()
    const backdrop = wrapper.findComponent(AmbientBackdrop)
    const original = backdrop.get('.lava-particle').attributes('style')
    await backdrop.get('canvas').trigger('webglcontextlost')
    expect(backdrop.findAll('.lava-particle')).toHaveLength(1)
    expect(backdrop.get('.lava-particle').attributes('style')).toBe(original)
    await backdrop.get('canvas').trigger('webglcontextrestored')
    expect(backdrop.findAll('.lava-particle')).toHaveLength(1)
    wrapper.unmount()
  })
})

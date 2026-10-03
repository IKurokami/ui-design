import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createAmbientSurface, createAmbientParticle, particlePosition, pruneAmbientParticles, brightenAmbientColor,
  type AmbientColors, type AmbientParticle,
} from '../src/features/library/ambient-surface'

const palette: AmbientColors = ['#3b82f6', '#60a5fa', '#8b5cf6']
const otherPalette: AmbientColors = ['#ef4444', '#f97316', '#84cc16']

function fixture(options: { compile?: boolean; link?: boolean; width?: number; height?: number } = {}) {
  const gl = {
    VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4,
    ARRAY_BUFFER: 5, STATIC_DRAW: 6, FLOAT: 7, BLEND: 8, COLOR_BUFFER_BIT: 9, TRIANGLES: 10,
    ONE: 11, ONE_MINUS_SRC_ALPHA: 12, SCISSOR_TEST: 13, ONE_MINUS_SRC_COLOR: 14,
    createShader: vi.fn(() => ({})), createProgram: vi.fn(() => ({})), createBuffer: vi.fn(() => ({})),
    shaderSource: vi.fn(), compileShader: vi.fn(), getShaderParameter: vi.fn(() => options.compile ?? true),
    attachShader: vi.fn(), linkProgram: vi.fn(), getProgramParameter: vi.fn(() => options.link ?? true),
    getAttribLocation: vi.fn(() => 0), getUniformLocation: vi.fn((_program, name: string) => ({ name })),
    useProgram: vi.fn(), bindBuffer: vi.fn(), bufferData: vi.fn(), enableVertexAttribArray: vi.fn(), vertexAttribPointer: vi.fn(),
    enable: vi.fn(), disable: vi.fn(), blendFuncSeparate: vi.fn(), scissor: vi.fn(), clearColor: vi.fn(), clear: vi.fn(), uniform1f: vi.fn(), uniform2f: vi.fn(), uniform3f: vi.fn(),
    viewport: vi.fn(), drawArrays: vi.fn(), deleteShader: vi.fn(), deleteProgram: vi.fn(), deleteBuffer: vi.fn(),
  }
  const canvas = document.createElement('canvas')
  Object.defineProperties(canvas, {
    clientWidth: { configurable: true, value: options.width ?? 1200 },
    clientHeight: { configurable: true, value: options.height ?? 800 },
  })
  vi.spyOn(canvas, 'getContext').mockReturnValue(gl as unknown as WebGLRenderingContext)
  const frames = new Map<number, FrameRequestCallback>()
  let nextFrame = 0
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
    const id = nextFrame++
    frames.set(id, callback)
    return id
  }))
  const cancel = vi.fn((id: number) => { frames.delete(id) })
  vi.stubGlobal('cancelAnimationFrame', cancel)
  function step(time: number) {
    const callbacks = [...frames.values()]
    frames.clear()
    callbacks.forEach(callback => callback(time))
  }

  return { gl, canvas, frames, step, cancel }
}



describe('independent multi-color lava particles', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

  it('captures an immutable palette for each new particle', () => {
    const input: AmbientColors = [...palette]
    const first = createAmbientParticle(input, [0.4, 0.8], 0)
    const second = createAmbientParticle(otherPalette, [0.7, 0.7], 500)
    input[0] = '#ffffff'
    expect(first.colors).toEqual(palette)
    expect(second.colors).toEqual(otherPalette)
    expect(first.id).not.toBe(second.id)
  })

  it('lifts dark tones to readable ambient light while preserving hue and bright colors', () => {
    const luminance = (hex: string) => {
      const channels = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255)
        .map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
      return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722
    }
    const input: AmbientColors = ['#080812', '#220c05', '#000000']
    const particle = createAmbientParticle(input, [0.5, 1], 0)
    for (const color of particle.colors) expect(luminance(color)).toBeGreaterThanOrEqual(0.178)
    const blue = particle.colors[0]!
    expect(parseInt(blue.slice(5, 7), 16)).toBeGreaterThan(parseInt(blue.slice(1, 3), 16))
    const warm = particle.colors[1]!
    expect(parseInt(warm.slice(1, 3), 16)).toBeGreaterThan(parseInt(warm.slice(5, 7), 16))
    expect(input).toEqual(['#080812', '#220c05', '#000000'])
    expect(brightenAmbientColor('#fbbf24')).toBe('#fbbf24')
    expect(brightenAmbientColor('#fff')).toBe('#ffffff')
  })

  it('keeps drifting and only removes particles fully above the viewport', () => {
    const particle = createAmbientParticle(palette, [0.5, 0.8], 0)
    const particles = [particle]
    expect(particlePosition(particle, 2000).y).toBeLessThan(particlePosition(particle, 1000).y)
    const boundaryTime = (particle.origin[1] + particle.radius * 2.1) / particle.speed * 1000
    pruneAmbientParticles(particles, boundaryTime - 10)
    expect(particles).toHaveLength(1)
    pruneAmbientParticles(particles, boundaryTime + 10)
    expect(particles).toHaveLength(0)
  })

  it('draws independent multi-color fields without recoloring older particles', () => {
    const f = fixture()
    const first = createAmbientParticle(palette, [0.35, 0.7], 0)
    const particles = [first]
    const surface = createAmbientSurface(f.canvas, particles)!
    f.step(1000)
    const firstColors = f.gl.uniform3f.mock.calls.map(call => call.slice(1))
    f.gl.uniform3f.mockClear()
    particles.push(createAmbientParticle(otherPalette, [0.7, 0.8], 1000))
    surface.render()
    f.step(2000)
    expect(f.gl.uniform3f.mock.calls.slice(0, 3).map(call => call.slice(1))).toEqual(firstColors)
    expect(f.gl.uniform3f.mock.calls.slice(3, 6).map(call => call.slice(1))).not.toEqual(firstColors)
    expect(first.colors).toEqual(palette)
    expect(f.gl.blendFuncSeparate).toHaveBeenCalledWith(f.gl.ONE, f.gl.ONE_MINUS_SRC_COLOR, f.gl.ONE, f.gl.ONE_MINUS_SRC_ALPHA)
    expect(f.gl.drawArrays).toHaveBeenCalledTimes(3)
    surface.dispose()
  })

  it('uses elapsed time instead of frame counts for motion', () => {
    const particle = createAmbientParticle(palette, [0.5, 0.8], 0)
    const f = fixture()
    const surface = createAmbientSurface(f.canvas, [particle])!
    for (let frame = 0; frame <= 120; frame++) f.step(frame * 1000 / 120)
    expect(f.gl.uniform2f.mock.calls.at(-1)![2]).toBeCloseTo(particlePosition(particle, 1000).y)
    surface.dispose()
  })

  it('sleeps after particles exit, then wakes when a new particle is added', () => {
    const f = fixture()
    const particles = [createAmbientParticle(palette, [0.5, 0.8], 0)]
    const surface = createAmbientSurface(f.canvas, particles)!
    f.step(1000)
    f.step(60000)
    expect(particles).toHaveLength(0)
    expect(f.frames.size).toBe(0)
    particles.push(createAmbientParticle(otherPalette, [0.5, 0.8], 60000))
    surface.render()
    expect(f.frames.size).toBe(1)
    f.step(61000)
    expect(f.gl.drawArrays).toHaveBeenCalledTimes(2)
    surface.dispose()
  })

  it('pauses GPU work while hidden without resetting the palette', () => {
    const f = fixture()
    const particles = [createAmbientParticle(palette, [0.5, 0.8], 0)]
    const surface = createAmbientSurface(f.canvas, particles)!
    f.step(1000)
    surface.setVisible(false)
    expect(f.frames.size).toBe(0)
    surface.render()
    expect(f.frames.size).toBe(0)
    surface.setVisible(true)
    f.step(2000)
    expect(particles[0]!.colors).toEqual(palette)
    expect(f.gl.drawArrays).toHaveBeenCalledTimes(2)
    surface.dispose()
  })

  it('preserves live particle age and colors across context recreation', () => {
    const f = fixture()
    const particles = [createAmbientParticle(palette, [0.5, 0.8], 0)]
    const first = createAmbientSurface(f.canvas, particles)!
    f.step(1000)
    first.dispose()
    expect(particles).toHaveLength(1)
    const restored = createAmbientSurface(f.canvas, particles)!
    f.step(2000)
    expect(particles[0]!.bornAt).toBe(0)
    expect(particles[0]!.colors).toEqual(palette)
    expect(f.gl.uniform1f).toHaveBeenCalledWith({ name: 'uAge' }, 2)
    restored.dispose()
  })

  it('limits shading to particle bounds and caps high-DPI work', () => {
    const f = fixture({ width: 3840, height: 2160 })
    const surface = createAmbientSurface(f.canvas, [createAmbientParticle(palette, [0.5, 0.8], 0)])!
    expect(f.canvas.width).toBeLessThanOrEqual(1440)
    expect(f.canvas.height).toBeLessThanOrEqual(900)
    f.step(1000)
    const rect = f.gl.scissor.mock.calls[0]!
    expect(rect[2] * rect[3]).toBeLessThan(f.canvas.width * f.canvas.height)
    surface.dispose()
  })

  it.each([{ compile: false }, { link: false }])('releases allocations on setup failure: %o', options => {
    const f = fixture(options)
    expect(createAmbientSurface(f.canvas)).toBeUndefined()
    expect(f.gl.deleteShader).toHaveBeenCalledTimes(2)
    expect(f.gl.deleteProgram).toHaveBeenCalledTimes(1)
    expect(f.gl.deleteBuffer).toHaveBeenCalledTimes(1)
    expect(f.frames.size).toBe(0)
  })

  it('cancels frame zero, disposes once and never restarts after disposal', () => {
    const f = fixture()
    const particles: AmbientParticle[] = []
    const surface = createAmbientSurface(f.canvas, particles)!
    surface.dispose()
    surface.dispose()
    surface.render()
    surface.resize()
    surface.setVisible(true)
    expect(f.cancel).toHaveBeenCalledWith(0)
    expect(f.gl.deleteProgram).toHaveBeenCalledTimes(1)
    expect(f.frames.size).toBe(0)
  })

  it('returns gracefully when WebGL is unavailable', () => {
    const canvas = document.createElement('canvas')
    vi.spyOn(canvas, 'getContext').mockReturnValue(null)
    expect(createAmbientSurface(canvas)).toBeUndefined()
  })
})

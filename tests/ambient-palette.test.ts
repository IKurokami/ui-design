import { afterEach, describe, expect, it, vi } from 'vitest'
import { extractAmbientPalette } from '../src/features/library/ambient-palette'

function image() {
  const result = document.createElement('img')
  Object.defineProperties(result, { complete: { value: true }, naturalWidth: { value: 32 } })
  return result
}

function pixels(colors: number[][]) {
  return new Uint8ClampedArray(colors.flat())
}

describe('ambient colors from actual cover pixels', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('extracts distinct colors from all three covers', () => {
    const context = {
      drawImage: vi.fn(), getImageData: vi.fn()
        .mockReturnValueOnce({ data: pixels([[210, 55, 70, 255], [210, 55, 70, 255]]) })
        .mockReturnValueOnce({ data: pixels([[45, 160, 110, 255]]) })
        .mockReturnValueOnce({ data: pixels([[70, 100, 225, 255]]) }),
    }
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D)
    const images = [image(), image(), image()]
    const palette = extractAmbientPalette(images)!
    expect(new Set(palette)).toEqual(new Set(['#d23746', '#2da06e', '#4664e1']))
    expect(context.drawImage).toHaveBeenCalledTimes(3)
  })

  it('ignores black/white margins and transparent pixels', () => {
    const context = { drawImage: vi.fn(), getImageData: vi.fn().mockReturnValue({
      data: pixels([[0, 0, 0, 255], [255, 255, 255, 255], [255, 0, 0, 0], [80, 120, 210, 255]]),
    }) }
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D)
    expect(extractAmbientPalette([image()])).toEqual(['#5078d2', '#5078d2', '#5078d2'])
  })

  it('continues sampling the other covers when one lacks CORS permission', () => {
    const context = { drawImage: vi.fn(), getImageData: vi.fn()
      .mockImplementationOnce(() => { throw new DOMException('tainted canvas', 'SecurityError') })
      .mockReturnValue({ data: pixels([[180, 85, 150, 255]]) }),
    }
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D)
    expect(extractAmbientPalette([image(), image()])).toEqual(['#b45596', '#b45596', '#b45596'])
    expect(context.drawImage).toHaveBeenCalledTimes(2)
  })

  it('returns no sampled palette when images have not loaded', () => {
    const context = { drawImage: vi.fn() }
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D)
    expect(extractAmbientPalette([document.createElement('img')])).toBeUndefined()
    expect(context.drawImage).not.toHaveBeenCalled()
  })
})

import { describe, expect, it } from 'vitest'
import { coverRegion } from '../src/features/home/prismatic-surface'

describe('seam texture alignment', () => {
  it('uses the full image at its original aspect ratio', () => {
    expect(coverRegion(1672, 941, 1672, 941, false)).toEqual([0, 0, 1, 1])
  })
  it('matches the image cover crop and object-position on a narrow screen', () => {
    const [x, y, width, height] = coverRegion(390, 844, 1672, 941, true)
    expect(height).toBe(1)
    expect(y).toBe(0)
    expect(x).toBeCloseTo((1 - width!) * 0.7)
    expect(x! + width!).toBeLessThanOrEqual(1)
  })
  it('matches the vertical crop on a wide screen', () => {
    const [x, y, width, height] = coverRegion(1920, 800, 1672, 941, false)
    expect(width).toBe(1)
    expect(x).toBe(0)
    expect(y).toBeCloseTo((1 - height!) * 0.45)
    expect(y! + height!).toBeLessThanOrEqual(1)
  })
})

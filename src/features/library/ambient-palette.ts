import type { AmbientColors } from './ambient-surface'

type ColorSample = { rgb: [number, number, number]; weight: number }

function distance(a: number[], b: number[]) {
  return Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!)
}

/** Sample actual cover pixels once per hover; no ongoing canvas readback. */
export function extractAmbientPalette(images: HTMLImageElement[]): AmbientColors | undefined {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 32
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return
  const candidates: ColorSample[] = []
  for (const image of images) {
    if (!image.complete || !image.naturalWidth) continue
    try {
      // Reset the origin-clean flag if a previous cover tainted this canvas.
      canvas.width = 32
      context.drawImage(image, 0, 0, 32, 32)
      const pixels = context.getImageData(0, 0, 32, 32).data
      const buckets = new Map<number, { total: number[]; count: number; weight: number }>()
      for (let pixel = 0; pixel < pixels.length; pixel += 4) {
        if (pixels[pixel + 3]! < 128) continue
        const rgb = [pixels[pixel]!, pixels[pixel + 1]!, pixels[pixel + 2]!]
        const highest = Math.max(...rgb), lowest = Math.min(...rgb)
        // Ignore nearly black/white margins while retaining neutral image colors.
        if (highest < 25 || lowest > 235) continue
        const saturation = (highest - lowest) / Math.max(highest, 1)
        const weight = 0.25 + saturation * saturation
        const key = ((rgb[0]! >> 4) << 8) | ((rgb[1]! >> 4) << 4) | (rgb[2]! >> 4)
        const bucket = buckets.get(key) ?? { total: [0, 0, 0], count: 0, weight: 0 }
        rgb.forEach((channel, index) => { bucket.total[index] = bucket.total[index]! + channel })
        bucket.count++
        bucket.weight += weight
        buckets.set(key, bucket)
      }
      const ranked = [...buckets.values()].sort((a, b) => b.weight - a.weight).slice(0, 8)
      for (const bucket of ranked) candidates.push({
        rgb: bucket.total.map(channel => Math.round(channel / bucket.count)) as [number, number, number],
        weight: bucket.weight,
      })
    } catch {
      // A cover without CORS permission must not break hover or the other covers.
      continue
    }
  }
  if (!candidates.length) return
  candidates.sort((a, b) => b.weight - a.weight)
  const chosen = [candidates[0]!]
  while (chosen.length < 3) {
    const remaining = candidates.filter(candidate => !chosen.includes(candidate))
    if (!remaining.length) { chosen.push(chosen.at(-1)!); continue }
    // Keep distinct colors instead of three neighboring shades from the largest image area.
    remaining.sort((a, b) => {
      const score = (sample: ColorSample) => Math.min(...chosen.map(color => distance(color.rgb, sample.rgb))) * Math.sqrt(sample.weight)
      return score(b) - score(a)
    })
    chosen.push(remaining[0]!)
  }
  return chosen.map(color => '#' + color.rgb.map(channel => channel.toString(16).padStart(2, '0')).join('')) as AmbientColors
}

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import ImageCropDialog from '../src/features/library/components/ImageCropDialog.vue'
import { cropRectangle, libraryCoverRatio, renderCroppedImage } from '../src/features/library/image-crop'

enableAutoUnmount(afterEach)
beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value(this: HTMLDialogElement) { this.open = true } })
})
afterEach(() => { vi.restoreAllMocks(); Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal') })

describe('Image crop geometry', () => {
  it('uses the Library card ratio and keeps zoomed crops inside portrait and landscape images', () => {
    for (const [width, height] of [[1600, 900], [800, 2400]]) {
      for (const zoom of [1, 2, 4]) {
        for (const position of [-10, 0, 50, 100, 120]) {
          const crop = cropRectangle(width!, height!, libraryCoverRatio, zoom, position, position)
          expect(crop.width / crop.height).toBeCloseTo(170 / 220)
          expect(crop.x).toBeGreaterThanOrEqual(0)
          expect(crop.y).toBeGreaterThanOrEqual(0)
          expect(crop.x + crop.width).toBeLessThanOrEqual(width!)
          expect(crop.y + crop.height).toBeLessThanOrEqual(height!)
        }
      }
    }
    expect(cropRectangle(1600, 900, 1, 1, 0, 50)).toEqual({ x: 0, y: 0, width: 900, height: 900 })
    expect(cropRectangle(1600, 900, 1, 1, 100, 50)).toEqual({ x: 700, y: 0, width: 900, height: 900 })
  })

  it('renders exactly the chosen source rectangle and creates a backend-uploadable file', async () => {
    const drawImage = vi.fn()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage } as unknown as CanvasRenderingContext2D)
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (this: HTMLCanvasElement, callback) {
      expect(this.width).toBe(2560)
      expect(this.height).toBe(1280)
      callback(new Blob(['cropped pixels'], { type: 'image/webp' }))
    })
    const image = document.createElement('img')
    const file = await renderCroppedImage(image, { x: 200, y: 300, width: 4000, height: 2000 })
    expect(drawImage).toHaveBeenCalledWith(image, 200, 300, 4000, 2000, 0, 0, 2560, 1280)
    expect(file).toBeInstanceOf(File)
    expect(file.type).toBe('image/webp')
    expect(file.size).toBeGreaterThan(0)
  })
})

async function loadImage(wrapper: ReturnType<typeof mount>) {
  Object.defineProperties(wrapper.get('.crop-frame img').element, { naturalWidth: { value: 1600 }, naturalHeight: { value: 900 } })
  await wrapper.get('.crop-frame img').trigger('load')
}

describe('Image crop dialog', () => {
  it('changes crop ratio, zoom and position, then resets without modifying the source', async () => {
    const apply = vi.fn()
    const wrapper = mount(ImageCropDialog, { props: { src: '/uploads/original.jpg', description: 'Chỉ thay ảnh bìa.', apply } })
    expect(wrapper.get('dialog').element.open).toBe(true)
    expect(wrapper.get('.crop-apply').attributes('disabled')).toBeDefined()
    await loadImage(wrapper)
    const library = wrapper.get('.crop-frame').attributes('style')
    await wrapper.findAll('.crop-ratios button')[1]!.trigger('click')
    expect(wrapper.get('.crop-frame').attributes('style')).not.toBe(library)
    await wrapper.get('[aria-label="Phóng to ảnh"]').setValue('2')
    await wrapper.get('[aria-label="Vị trí ảnh theo chiều ngang"]').setValue('0')
    expect(wrapper.get('.crop-frame img').attributes('style')).toContain('left: 0%')
    await wrapper.get('.crop-reset').trigger('click')
    expect(wrapper.get('output').text()).toBe('1.0×')
    expect(apply).not.toHaveBeenCalled()
    await wrapper.get('[aria-label="Đóng cắt ảnh"]').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('blocks duplicate apply and dismissal during upload, then preserves the crop after failure for retry', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D)
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(callback => callback(new Blob(['pixels'], { type: 'image/webp' })))
    let fail!: (error: Error) => void
    const apply = vi.fn(() => new Promise<void>((_, reject) => { fail = reject }))
    const wrapper = mount(ImageCropDialog, { props: { src: '/uploads/original.jpg', description: 'Thay ảnh bìa.', apply } })
    await loadImage(wrapper)
    await wrapper.get('.crop-apply').trigger('click')
    await wrapper.get('.crop-apply').trigger('click')
    await flushPromises()
    expect(apply).toHaveBeenCalledTimes(1)
    await wrapper.get('dialog').trigger('cancel')
    expect(wrapper.emitted('close')).toBeUndefined()
    fail(new Error('Tải ảnh thất bại'))
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toBe('Tải ảnh thất bại')
    expect(wrapper.get('.crop-apply').attributes('disabled')).toBeUndefined()
    apply.mockResolvedValueOnce()
    await wrapper.get('.crop-apply').trigger('click')
    await flushPromises()
    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})

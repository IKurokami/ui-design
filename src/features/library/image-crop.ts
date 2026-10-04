export const libraryCoverRatio = 17 / 22

export function cropRectangle(width: number, height: number, ratio: number, zoom = 1, horizontal = 50, vertical = 50) {
  const safeRatio = Number.isFinite(ratio) && ratio > 0 ? ratio : width / height
  const scale = Math.max(1, Math.min(4, zoom))
  const cropWidth = Math.min(width, height * safeRatio) / scale
  const cropHeight = cropWidth / safeRatio
  const clamp = (value: number) => Math.max(0, Math.min(100, value)) / 100
  return { x: (width - cropWidth) * clamp(horizontal), y: (height - cropHeight) * clamp(vertical), width: cropWidth, height: cropHeight }
}

export async function renderCroppedImage(image: HTMLImageElement, crop: ReturnType<typeof cropRectangle>): Promise<File> {
  const canvas = document.createElement('canvas')
  const scale = Math.min(1, 2560 / Math.max(crop.width, crop.height))
  canvas.width = Math.max(1, Math.round(crop.width * scale))
  canvas.height = Math.max(1, Math.round(crop.height * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Trình duyệt không thể cắt ảnh này.')
  context.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Không tạo được ảnh đã cắt.')), 'image/webp', .92))
  const extension = blob.type === 'image/webp' ? 'webp' : 'png'
  return new File([blob], `cropped-${Date.now()}.${extension}`, { type: blob.type })
}

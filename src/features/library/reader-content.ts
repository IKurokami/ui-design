import DOMPurify from 'dompurify'

export function readerHTML(content: string): string {
  const html = DOMPurify.sanitize(content, {
    USE_PROFILES: { html: true },
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['style', 'font', 'form', 'input', 'button', 'select', 'textarea', 'iframe', 'video', 'audio'],
    FORBID_ATTR: ['style', 'class', 'id', 'border', 'width', 'height', 'align', 'face', 'color', 'size', 'contenteditable', 'tabindex', 'autofocus'],
  })
  const template = document.createElement('template')
  template.innerHTML = html
  for (const image of template.content.querySelectorAll<HTMLImageElement>('img')) {
    image.loading = 'lazy'
    image.decoding = 'async'
  }
  // Keep plain-text chapters in paragraphs like rich-text chapters.
  for (const node of [...template.content.childNodes]) {
    if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
      const paragraph = document.createElement('p')
      node.replaceWith(paragraph); paragraph.append(node)
    }
  }
  return template.innerHTML
}
export function readableHTML(content: string): boolean {
  const template = document.createElement('template')
  template.innerHTML = readerHTML(content)
  return Boolean(template.content.textContent?.replace(/[\s\u200b-\u200f\ufeff]/g, '') || template.content.querySelector('img[src]'))
}

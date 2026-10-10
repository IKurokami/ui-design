import type { EbookDraft, EbookPage, EbookElement } from './types'

// EPUB 3 must be a ZIP whose first uncompressed member is 'mimetype'.
// The archive is stored without deflate to avoid adding a new runtime dependency.
type Entry = { name: string; bytes: Uint8Array }
const encoder = new TextEncoder()
const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;')

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}
function packZip(entries: Entry[]): Blob {
  const parts: BlobPart[] = []
  const central: (ArrayBuffer | Uint8Array<ArrayBuffer>)[] = []
  let offset = 0
  function header(length: number): DataView { return new DataView(new ArrayBuffer(length)) }
  for (const entry of entries) {
    const name = encoder.encode(entry.name)
    const crc = crc32(entry.bytes)
    const local = header(30)
    local.setUint32(0, 0x04034b50, true)
    local.setUint16(4, 20, true)
    local.setUint16(8, 0, true)
    local.setUint32(14, crc, true)
    local.setUint32(18, entry.bytes.length, true)
    local.setUint32(22, entry.bytes.length, true)
    local.setUint16(26, name.length, true)
    parts.push(local.buffer as ArrayBuffer, Uint8Array.from(name), Uint8Array.from(entry.bytes))
    const cd = header(46)
    cd.setUint32(0, 0x02014b50, true)
    cd.setUint16(4, 20, true)
    cd.setUint16(6, 20, true)
    cd.setUint32(16, crc, true)
    cd.setUint32(20, entry.bytes.length, true)
    cd.setUint32(24, entry.bytes.length, true)
    cd.setUint16(28, name.length, true)
    cd.setUint32(42, offset, true)
    central.push(cd.buffer as ArrayBuffer, Uint8Array.from(name))
    offset += 30 + name.length + entry.bytes.length
  }
  const centralLength = central.reduce((sum, part) => sum + part.byteLength, 0)
  const end = header(22)
  end.setUint32(0, 0x06054b50, true)
  end.setUint16(8, entries.length, true)
  end.setUint16(10, entries.length, true)
  end.setUint32(12, centralLength, true)
  end.setUint32(16, offset, true)
  return new Blob([...parts, ...central, end.buffer as ArrayBuffer], { type: 'application/epub+zip' })
}

function plainText(html: string): string {
  const template = document.createElement('template')
  template.innerHTML = html
  return (template.content.textContent ?? '').trim()
}
function textElement(el: EbookElement): string {
  const value = plainText(el.html)
  if (!value) return ''
  const paragraphs = value.split(/\n{2,}/).filter(Boolean)
  const tag = el.fontSize >= 44 || el.fontWeight >= 700 ? 'h2' : 'p'
  return paragraphs.map(part => '<' + tag + '>' + xml(part) + '</' + tag + '>').join('\n')
}
function mimeType(src: string, response: Response): string | null {
  const type = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase()
  const known = ['image/png', 'image/jpeg', 'image/gif']
  if (type && known.includes(type)) return type
  const extension = new URL(src, window.location.href).pathname.split('.').at(-1)?.toLowerCase()
  return extension === 'png' ? 'image/png' : extension === 'jpg' || extension === 'jpeg' ? 'image/jpeg'
    : extension === 'gif' ? 'image/gif' : null
}

// EPUB is reflowable. Absolute canvas positions do not map to EPUB layout;
// elements retain their page/order, heading hierarchy and image content.
export async function buildEpub(draft: EbookDraft): Promise<Blob> {
  const pages = draft.pages.filter(p => !p.hidden)
  if (!pages.length) throw new Error('Không có trang nào để xuất EPUB.')
  const entries: Entry[] = [
    { name: 'mimetype', bytes: encoder.encode('application/epub+zip') },
    { name: 'META-INF/container.xml', bytes: encoder.encode('<?xml version="1.0" encoding="UTF-8"?>'
      + '<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">'
      + '<rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>') },
  ]
  const manifest: string[] = ['<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>']
  const spine: string[] = []
  const toc: string[] = []
  const imageCache = new Map<string, string>()
  let imageIndex = 0
  async function imageTag(src: string): Promise<string> {
    const cached = imageCache.get(src)
    if (cached) return '<p><img alt="" src="' + xml(cached) + '"/></p>'
    const url = new URL(src, window.location.href)
    // Never download untrusted external URLs with the user's session.
    if (url.origin !== window.location.origin || !url.pathname.startsWith('/uploads/')) return ''
    const response = await fetch(url.href, { credentials: 'include' })
    if (!response.ok) throw new Error('Không tải được ảnh để đưa vào EPUB.')
    const mime = mimeType(src, response)
    if (!mime) return ''
    const bytes = new Uint8Array(await response.arrayBuffer())
    if (bytes.length > 8 * 1024 * 1024) throw new Error('Ảnh vượt quá giới hạn 8 MB cho EPUB.')
    const extension = mime === 'image/jpeg' ? 'jpg' : mime.split('/')[1]
    const name = 'images/asset-' + ++imageIndex + '.' + extension
    imageCache.set(src, name)
    entries.push({ name: 'OEBPS/' + name, bytes })
    manifest.push('<item id="asset-' + imageIndex + '" href="' + name + '" media-type="' + mime + '"/>')
    return '<p><img alt="" src="' + xml(name) + '"/></p>'
  }
  for (let i = 0; i < pages.length; i++) {
    const page: EbookPage = pages[i]!
    const title = page.kind === 'cover' ? (draft.title || page.title) : page.title || 'Trang ' + (i + 1)
    let body = ''
    if (page.kind === 'cover') {
      body = '<h1>' + xml(draft.title || 'Tác phẩm') + '</h1>'
        + (draft.subtitle ? '<p>' + xml(draft.subtitle) + '</p>' : '')
        + (draft.author ? '<p>' + xml(draft.author) + '</p>' : '')
    } else {
      body = '<h1>' + xml(title) + '</h1>'
      const ordered = [...page.elements].sort((a, b) => a.y - b.y || a.x - b.x)
      for (const el of ordered) {
        if (el.kind === 'text') body += textElement(el)
        else if (el.kind === 'image' && el.src) body += await imageTag(el.src)
      }
      if (!ordered.some(el => el.kind === 'text') && page.content) body += textElement({
        html: page.content, fontSize: 20, fontWeight: 400,
      } as EbookElement)
    }
    const xhtml = '<?xml version="1.0" encoding="UTF-8"?>'
      + '<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" xml:lang="vi">'
      + '<head><title>' + xml(title) + '</title><meta charset="utf-8"/>'
      + '<style>body{font-family:serif;line-height:1.65;margin:5%;}h1,h2{line-height:1.3;}'
      + 'p{margin:0 0 1em;}img{display:block;max-width:100%;height:auto;margin:1em auto;}</style>'
      + '</head><body>' + body + '</body></html>'
    const pageName = 'pages/page-' + (i + 1) + '.xhtml'
    entries.push({ name: 'OEBPS/' + pageName, bytes: encoder.encode(xhtml) })
    manifest.push('<item id="page-' + (i + 1) + '" href="' + pageName + '" media-type="application/xhtml+xml"/>')
    spine.push('<itemref idref="page-' + (i + 1) + '"/>')
    toc.push('<li><a href="' + pageName + '">' + xml(title) + '</a></li>')
  }
  const nav = '<?xml version="1.0" encoding="UTF-8"?>'
    + '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="vi">'
    + '<head><title>Mục lục</title></head><body><nav epub:type="toc" id="toc"><h1>Mục lục</h1>'
    + '<ol>' + toc.join('') + '</ol></nav></body></html>'
  entries.push({ name: 'OEBPS/nav.xhtml', bytes: encoder.encode(nav) })
  const id = 'urn:uuid:' + (typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : 'moc-' + Date.now())
  const opf = '<?xml version="1.0" encoding="UTF-8"?>'
    + '<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">'
    + '<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">'
    + '<dc:identifier id="bookid">' + xml(id) + '</dc:identifier>'
    + '<dc:title>' + xml(draft.title || 'Tác phẩm') + '</dc:title>'
    + '<dc:language>vi</dc:language><dc:creator>' + xml(draft.author || 'Tác giả') + '</dc:creator>'
    + '<meta property="dcterms:modified">' + new Date().toISOString().replace(/\.\d{3}Z$/, 'Z') + '</meta>'
    + '</metadata><manifest>' + manifest.join('') + '</manifest><spine>' + spine.join('') + '</spine></package>'
  entries.push({ name: 'OEBPS/content.opf', bytes: encoder.encode(opf) })
  return packZip(entries)
}

export function safeEpubFilename(name: string): string {
  return (name.trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/[\s.]+$/g, '').slice(0, 90) || 'moc-ebook') + '.epub'
}

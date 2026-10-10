import { describe, expect, it } from 'vitest'
import { buildEpub, safeEpubFilename } from '../src/features/ebook/epub-export'
import type { EbookDraft } from '../src/features/ebook/types'

describe('EPUB3 export', () => {
  const draft = {
    version: 2,
    title: 'Bí mật & Mộc',
    author: 'Tác giả Việt',
    subtitle: '',
    description: '',
    pages: [
      { id: 'cover', kind: 'cover', title: 'Bìa', hidden: false, elements: [] },
      { id: 'ch1', kind: 'chapter', title: 'Chương 1: Khởi đầu', hidden: false, content: '<p>Nội dung</p>',
        elements: [{ id: 't1', kind: 'text', html: '<p>Chào <strong>thế giới</strong> &amp; bạn</p>', y: 1, x: 1, fontSize: 24, fontWeight: 400 }] },
      { id: 'hidden', kind: 'chapter', title: 'Không xuất', hidden: true, elements: [] },
    ],
  } as EbookDraft
  it('builds an actual uncompressed EPUB3 ZIP with spine, TOC, and escaped Vietnamese text', async () => {
    const blob = await buildEpub(draft)
    expect(blob.type).toBe('application/epub+zip')
    const bytes = new Uint8Array(await blob.arrayBuffer())
    const view = new DataView(bytes.buffer)
    expect(view.getUint32(0, true)).toBe(0x04034b50)
    const nameLen = view.getUint16(26, true)
    expect(new TextDecoder().decode(bytes.slice(30, 30 + nameLen))).toBe('mimetype')
    const contents = new TextDecoder().decode(bytes)
    expect(contents).toContain('application/epub+zip')
    expect(contents).toContain('OEBPS/content.opf')
    expect(contents).toContain('OEBPS/nav.xhtml')
    expect(contents).toContain('pages/page-2.xhtml')
    expect(contents).toContain('Chào thế giới &amp; bạn')
    expect(contents).toContain('Bí mật &amp; Mộc')
    expect(contents).not.toContain('Không xuất')
  })
  it('normalizes unsafe filenames', () => {
    expect(safeEpubFilename('Sách: Chương / Cuối')).toBe('Sách- Chương - Cuối.epub')
  })
})

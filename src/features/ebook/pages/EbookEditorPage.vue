<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch, type ComponentPublicInstance } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import DOMPurify from 'dompurify'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  Eye,
  EyeOff,
  Heading1,
  ImagePlus,
  Italic,
  Layers,
  Lock,
  Minus,
  Plus,
  Redo2,
  Settings2,
  Trash2,
  Type,
  Undo2,
  Unlock,
  Upload,
  ZoomIn,
  ZoomOut,
} from '@lucide/vue'
import { createApiClient } from '../../../services/api-client'
import { friendlyError } from '../../../services/error-handler'
import type { Chapter, Story } from '../../library/types'
import EbookPageCanvas from '../components/EbookPageCanvas.vue'
import { buildEpub, safeEpubFilename } from '../epub-export'
import EbookFlipBookPreview from '../components/EbookFlipBookPreview.vue'
import { PAGE_ASPECT_RATIO, PAGE_HEIGHT, PAGE_WIDTH, type EbookDraft, type EbookElement, type EbookPage, type ElementKind, type PageKind, type TextAlign, type TextDecoration, type TextTransform, type VerticalAlign } from '../types'
import '../../library/library-theme.css'

type ToolId = 'text' | 'elements' | 'uploads' | 'pages' | 'settings'

const GRID_SIZE = 20
const DEFAULT_FONT = 'Georgia, Cambria, serif'

interface EbookRecord {
  id: string
  title: string
  coverUrl?: string
  revision: number
  design: unknown
}

interface ElementOptions {
  html?: string
  src?: string
  x?: number
  y?: number
  width?: number
  height?: number
  zIndex?: number
  locked?: boolean
  fontFamily?: string
  fontSize?: number
  fontWeight?: number
  fontStyle?: 'normal' | 'italic'
  textDecoration?: TextDecoration
  textTransform?: TextTransform
  color?: string
  backgroundColor?: string
  align?: TextAlign
  verticalAlign?: VerticalAlign
  letterSpacing?: number
  lineHeight?: number
  padding?: number
  cornerRadius?: number
  rotation?: number
  opacity?: number
  role?: EbookElement['role']
}

interface Interaction {
  mode: 'move' | 'resize'
  pageIndex: number
  elementId: string
  pointerId: number
  startX: number
  startY: number
  startElementX: number
  startElementY: number
  startWidth: number
  startHeight: number
  scaleX: number
  scaleY: number
}

const route = useRoute()
const router = useRouter()
const client = createApiClient()
const story = ref<Story | null>(null)
const draft = ref<EbookDraft>(emptyDraft())
const isLoading = ref(true)
const loadError = ref('')
const activePageIndex = ref(0)
const selectedElementId = ref('')
const activeTool = ref<ToolId>('text')
const panelOpen = ref(true)
const zoom = ref(.68)
const uploadInput = ref<HTMLInputElement | null>(null)
const uploadedImages = ref<string[]>([])
const isUploading = ref(false)
const isSaving = ref(false)
const saveError = ref('')
const hasLocalBackup = ref(false)
const isPreviewOpen = ref(false)
const savedSnapshot = ref('')
const ebookId = ref('')
const ebookRevision = ref(0)
const pageRefs = new Map<number, HTMLElement>()
const interaction = ref<Interaction | null>(null)
const editingElementId = ref('')
const contextMenu = reactive({ open: false, x: 0, y: 0, pageIndex: 0, elementId: '' })
const toast = reactive({ show: false, message: '', type: 'success' as 'success' | 'error', timer: undefined as ReturnType<typeof setTimeout> | undefined })

const toolItems: { id: ToolId; label: string; icon: typeof Type }[] = [
  { id: 'text', label: 'Văn bản', icon: Type },
  { id: 'elements', label: 'Ảnh', icon: ImagePlus },
  { id: 'uploads', label: 'Tải lên', icon: Upload },
  { id: 'pages', label: 'Trang', icon: Layers },
  { id: 'settings', label: 'Thiết lập', icon: Settings2 },
]
const textColors = ['#18241c', '#435a41', '#7a3e32', '#254c68', '#684b7c', '#9a6a1f', '#ffffff']
const fillColors = ['transparent', '#f8f2e8', '#e9f0e5', '#e5edf4', '#f4e5e2', '#efe8f5', '#18241c']
const fontWeights = [300, 400, 500, 600, 700, 800, 900]
const activePage = computed(() => draft.value.pages[activePageIndex.value] ?? null)
const pageCount = computed(() => draft.value.pages.length)
const previewPages = computed(() => draft.value.pages.filter(page => !page.hidden))
const selectedElement = computed(() => activePage.value?.elements.find(element => element.id === selectedElementId.value) ?? null)
const selectedTextElement = computed(() => selectedElement.value?.kind === 'text' ? selectedElement.value : null)
const gallery = computed(() => {
  const cover = draft.value.pages.find(page => page.kind === 'cover')?.coverUrl || ''
  return [...new Set([...collectImages(story.value), ...uploadedImages.value, cover].filter(Boolean))]
})
const isDirty = computed(() => !isLoading.value && savedSnapshot.value !== serializeDraft())
const saveState = computed(() => {
  if (isSaving.value) return 'Đang lưu'
  if (saveError.value) return hasLocalBackup.value ? 'Đã lưu trên thiết bị' : 'Lưu thất bại'
  if (!ebookId.value) return 'Bản nháp'
  return isDirty.value ? 'Chưa lưu' : 'Đã lưu'
})
const canvasStyle = computed(() => ({ '--ebook-zoom': String(zoom.value) }))

function makeId(prefix: string) { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }
function clamp(value: number, min: number, max: number) { return Math.min(max, Math.max(min, value)) }
function cleanHtml(value: string) { return DOMPurify.sanitize(value || '', { USE_PROFILES: { html: true }, ALLOW_DATA_ATTR: false }) }
function safeColor(value: unknown, fallback: string) { return typeof value === 'string' && /^#[\da-fA-F]{3,8}$/.test(value) ? value : fallback }
function safeFill(value: unknown, fallback = 'transparent') { return value === 'transparent' || (typeof value === 'string' && /^#[\da-fA-F]{3,8}$/.test(value)) ? String(value) : fallback }
function escapeHtml(value: string) { return value.replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character] ?? character)) }

function makeTextElement(id: string, options: ElementOptions = {}): EbookElement {
  const element: EbookElement = {
    id, kind: 'text', html: '', src: '', x: 120, y: 260, width: 1170, height: 220, zIndex: 1, locked: false,
    fontFamily: DEFAULT_FONT, fontSize: 30, fontWeight: 400, fontStyle: 'normal', textDecoration: 'none', textTransform: 'none', color: '#18241c', backgroundColor: 'transparent', align: 'left', verticalAlign: 'top', letterSpacing: 0, lineHeight: 1.45, padding: 0, cornerRadius: 0, rotation: 0, opacity: 1, ...options,
  }
  element.html = cleanHtml(element.html)
  return element
}

function makeImageElement(id: string, src: string, options: ElementOptions = {}): EbookElement {
  return { ...makeTextElement(id, { ...options, html: '' }), kind: 'image', src, x: options.x ?? 150, y: options.y ?? 500, width: options.width ?? 1110, height: options.height ?? 650 }
}

function coverElements(title: string, subtitle: string, author: string, accent: string) {
  const elements: EbookElement[] = [makeTextElement(makeId('title'), { html: title, x: 130, y: 1300, width: 1150, height: 260, fontSize: 88, fontWeight: 700, color: '#ffffff', lineHeight: 1.05, role: 'cover-title' })]
  if (subtitle) elements.push(makeTextElement(makeId('subtitle'), { html: subtitle, x: 130, y: 1590, width: 1080, height: 130, fontSize: 29, color: '#ffffff', lineHeight: 1.35, role: 'cover-subtitle' }))
  if (author) elements.push(makeTextElement(makeId('author'), { html: author, x: 130, y: 1840, width: 1050, height: 70, fontSize: 22, fontWeight: 650, color: '#ffffff', role: 'cover-author' }))
  return elements.map(element => ({ ...element, color: element.color || accent }))
}

function elementsFromContent(content: string, accent: string) {
  const result: EbookElement[] = []
  const template = document.createElement('template')
  template.innerHTML = cleanHtml(content)
  const children = Array.from(template.content.children)
  let y = 240
  let index = 0
  for (const child of children) {
    const tag = child.tagName.toLowerCase()
    const images = Array.from(child.querySelectorAll<HTMLImageElement>('img[src]'))
    if (images.length && !child.textContent?.trim()) {
      for (const image of images) {
        result.push(makeImageElement(makeId(`image-${index++}`), image.getAttribute('src') || '', { x: 160, y, width: 1090, height: 540, zIndex: index }))
        y += 580
      }
      continue
    }
    const isHeading = tag === 'h1' || tag === 'h2' || tag === 'h3'
    const isQuote = tag === 'blockquote'
    const height = isHeading ? 150 : isQuote ? 230 : 250
    result.push(makeTextElement(makeId(`text-${index++}`), { html: child.outerHTML, x: 120, y, width: 1170, height, fontSize: isHeading ? 54 : isQuote ? 28 : 31, fontWeight: isHeading ? 700 : 400, fontStyle: isQuote ? 'italic' : 'normal', color: isHeading ? accent : '#18241c', lineHeight: isHeading ? 1.15 : 1.55 }))
    y += height + 28
  }
  if (!result.length) result.push(makeTextElement(makeId('text'), { html: '', x: 120, y: 260, width: 1170, height: 300, color: '#18241c' }))
  return result
}

function makePage(id: string, kind: PageKind, title: string, background: string, accent: string, content = ''): EbookPage {
  return { id, kind, title, content: cleanHtml(content), coverUrl: '', background, accent, locked: false, hidden: false, elements: kind === 'cover' ? coverElements('', '', '', accent) : elementsFromContent(content, accent) }
}

function emptyDraft(): EbookDraft {
  const background = '#f8f2e8'
  const accent = '#435a41'
  return { version: 2, title: '', subtitle: '', author: '', description: '', fontFamily: DEFAULT_FONT, pageBackground: background, accent, pages: [makePage('cover', 'cover', 'Bìa', background, accent), makePage('page-1', 'blank', 'Trang mới', background, accent)] }
}

function chapterContent(chapter: Chapter) {
  return chapter.content?.trim() || `<h2>${escapeHtml(chapter.title || `Chương ${chapter.chapterNumber}`)}</h2><p></p>`
}

function buildDraft(source: Story | null): EbookDraft {
  if (!source) return emptyDraft()
  const background = '#f8f2e8'
  const accent = '#435a41'
  const cover = makePage('cover', 'cover', 'Bìa', background, accent)
  cover.coverUrl = source.coverUrl || collectImages(source)[0] || ''
  cover.elements = coverElements(source.title || '', source.description || '', source.authorName || '', accent)
  const pages: EbookPage[] = [cover]
  for (const chapter of source.chapters ?? []) pages.push({ ...makePage(`chapter-${chapter.id || chapter.chapterNumber}`, 'chapter', chapter.title || `Chương ${chapter.chapterNumber}`, background, accent, chapterContent(chapter)), chapterId: chapter.id })
  if (pages.length === 1) pages.push(makePage('page-1', 'blank', 'Trang mới', background, accent))
  return { version: 2, title: source.title, subtitle: source.description || '', author: source.authorName || '', description: source.description || '', fontFamily: DEFAULT_FONT, pageBackground: background, accent, pages }
}

function normalizeElement(value: unknown, index: number): EbookElement | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  const kind: ElementKind = raw.kind === 'image' ? 'image' : 'text'
  const element = kind === 'image' ? makeImageElement(typeof raw.id === 'string' ? raw.id : makeId(`image-${index}`), typeof raw.src === 'string' ? raw.src : '') : makeTextElement(typeof raw.id === 'string' ? raw.id : makeId(`text-${index}`))
  element.kind = kind
  element.html = kind === 'text' && typeof raw.html === 'string' ? cleanHtml(raw.html) : ''
  element.src = typeof raw.src === 'string' ? raw.src : ''
  element.x = clamp(Number(raw.x) || 0, 0, PAGE_WIDTH - 80)
  element.y = clamp(Number(raw.y) || 0, 0, PAGE_HEIGHT - 60)
  element.width = clamp(Number(raw.width) || 180, 80, PAGE_WIDTH)
  element.height = clamp(Number(raw.height) || 100, 50, PAGE_HEIGHT)
  element.zIndex = Math.max(1, Number(raw.zIndex) || index + 1)
  element.locked = raw.locked === true
  element.fontFamily = typeof raw.fontFamily === 'string' ? raw.fontFamily : DEFAULT_FONT
  element.fontSize = clamp(Number(raw.fontSize) || 30, 10, 180)
  element.fontWeight = clamp(Number(raw.fontWeight) || 400, 300, 900)
  element.fontStyle = raw.fontStyle === 'italic' ? 'italic' : 'normal'
  element.textDecoration = raw.textDecoration === 'underline' || raw.textDecoration === 'line-through' ? raw.textDecoration : 'none'
  element.textTransform = raw.textTransform === 'uppercase' || raw.textTransform === 'lowercase' || raw.textTransform === 'capitalize' ? raw.textTransform : 'none'
  element.color = safeColor(raw.color, '#18241c')
  element.backgroundColor = safeFill(raw.backgroundColor)
  element.align = raw.align === 'center' || raw.align === 'right' || raw.align === 'justify' ? raw.align : 'left'
  element.verticalAlign = raw.verticalAlign === 'middle' || raw.verticalAlign === 'bottom' ? raw.verticalAlign : 'top'
  element.letterSpacing = clamp(Number(raw.letterSpacing) || 0, -4, 24)
  element.lineHeight = clamp(Number(raw.lineHeight) || 1.45, 1, 2.5)
  element.padding = clamp(Number(raw.padding) || 0, 0, 120)
  element.cornerRadius = clamp(Number(raw.cornerRadius) || 0, 0, 120)
  element.rotation = clamp(Number(raw.rotation) || 0, -180, 180)
  element.opacity = clamp(typeof raw.opacity === 'number' ? raw.opacity : 1, .1, 1)
  if (raw.role === 'cover-title' || raw.role === 'cover-subtitle' || raw.role === 'cover-author') element.role = raw.role
  return element
}

function normalizeDraft(value: unknown, source: Story | null): EbookDraft | null {
  if (!value || typeof value !== 'object') return null
  const saved = value as Record<string, unknown>
  if (!Array.isArray(saved.pages) || typeof saved.title !== 'string') return null
  const base = buildDraft(source)
  const pages = saved.pages.map((value, index) => {
    const raw = value as Record<string, unknown>
    const fallback = base.pages[index] || makePage(makeId('page'), 'blank', 'Trang mới', base.pageBackground, base.accent)
    const kind: PageKind = raw.kind === 'cover' || raw.kind === 'chapter' ? raw.kind : 'blank'
    const elements = Array.isArray(raw.elements) ? raw.elements.map((element, elementIndex) => normalizeElement(element, elementIndex)).filter((element): element is EbookElement => Boolean(element)) : elementsFromContent(typeof raw.content === 'string' ? raw.content : '', safeColor(raw.accent, base.accent))
    return { ...fallback, id: typeof raw.id === 'string' ? raw.id : fallback.id, kind, title: typeof raw.title === 'string' ? raw.title : fallback.title, content: typeof raw.content === 'string' ? cleanHtml(raw.content) : '', coverUrl: typeof raw.coverUrl === 'string' ? raw.coverUrl : '', background: safeColor(raw.background, base.pageBackground), accent: safeColor(raw.accent, base.accent), locked: raw.locked === true, hidden: raw.hidden === true, chapterId: typeof raw.chapterId === 'string' ? raw.chapterId : undefined, elements }
  })
  if (!pages.length) return null
  return { ...base, ...saved, version: 2, title: typeof saved.title === 'string' ? saved.title : base.title, subtitle: typeof saved.subtitle === 'string' ? saved.subtitle : base.subtitle, author: typeof saved.author === 'string' ? saved.author : base.author, description: typeof saved.description === 'string' ? saved.description : base.description, fontFamily: typeof saved.fontFamily === 'string' ? saved.fontFamily : base.fontFamily, pageBackground: safeColor(saved.pageBackground, base.pageBackground), accent: safeColor(saved.accent, base.accent), pages }
}

function collectImages(source: Story | null): string[] {
  if (!source) return []
  const images = new Set<string>()
  if (source.coverUrl) images.add(source.coverUrl)
  for (const chapter of source.chapters ?? []) {
    try {
      const values: unknown = JSON.parse(chapter.illustrations || '[]')
      if (Array.isArray(values)) values.forEach(value => { if (typeof value === 'string' && value) images.add(value) })
    } catch { /* Ignore malformed illustration metadata. */ }
    const template = document.createElement('template')
    template.innerHTML = chapter.content || ''
    template.content.querySelectorAll<HTMLImageElement>('img[src]').forEach(image => { const url = image.getAttribute('src'); if (url) images.add(url) })
  }
  return [...images]
}

function storageKey(id = ebookId.value || String(route.params.id || route.query.story || 'new')) { return `moc:ebook-design:${id}` }
function syncPageContent(page: EbookPage) { page.content = [...page.elements].sort((a, b) => a.y - b.y || a.zIndex - b.zIndex).map(element => element.kind === 'text' ? element.html : `<p><img src="${element.src.replace(/"/g, '&quot;')}" alt="" /></p>`).join('') }
function syncAllPages() { draft.value.pages.forEach(syncPageContent) }
function serializeDraft() { return JSON.stringify(draft.value) }

function readSavedDraft(source: Story | null, key: string) {
  try {
    const value = localStorage.getItem(key)
    if (!value) return null
    const parsed = JSON.parse(value)
    const design = normalizeDraft(parsed?.design ?? parsed, source)
    if (!design) return null
    return { design, revision: typeof parsed?.revision === 'number' ? parsed.revision : undefined, pending: parsed?.pending === true }
  } catch { return null }
}

function cacheDraft(snapshot: string, pending: boolean) {
  try {
    localStorage.setItem(storageKey(), JSON.stringify({ design: JSON.parse(snapshot), revision: ebookRevision.value, pending }))
    hasLocalBackup.value = true
    return true
  } catch {
    hasLocalBackup.value = false
    return false
  }
}

async function loadEbook() {
  // `/new` is a convenient explicit create URL; it must never be fetched as
  // an ebook id because the API correctly returns 404 for that sentinel.
  const routeId = String(route.params.id || '')
  const remoteId = routeId === 'new' ? '' : routeId
  const sourceId = String(route.query.story || '')
  const key = storageKey(remoteId || sourceId || 'new')
  isLoading.value = true
  loadError.value = ''
  saveError.value = ''
  try {
    const source = !remoteId && sourceId ? await client.request<Story>('/api/stories/' + encodeURIComponent(sourceId)) : null
    const remote = remoteId ? await client.request<EbookRecord>('/api/ebooks/' + encodeURIComponent(remoteId)) : null
    const remoteDesign = remote?.design ? normalizeDraft(remote.design, source) : null
    const cached = readSavedDraft(source, key)
    story.value = source
    ebookId.value = remote?.id || ''
    ebookRevision.value = cached?.pending && cached.revision ? cached.revision : remote?.revision || 0
    uploadedImages.value = []
    draft.value = cached && (!remote || cached.pending) ? cached.design : remoteDesign ?? cached?.design ?? buildDraft(source)
    syncAllPages()
    activePageIndex.value = 0
    selectedElementId.value = ''
    editingElementId.value = ''
    if (remoteDesign) { remoteDesign.pages.forEach(syncPageContent); savedSnapshot.value = JSON.stringify(remoteDesign) }
    else if (cached && !cached.pending) { savedSnapshot.value = serializeDraft() }
    else savedSnapshot.value = ''
    hasLocalBackup.value = Boolean(cached)
    if (cached?.pending) saveError.value = 'Bản nháp chưa được lưu lên hệ thống. Bấm Lưu để thử lại.'
    await nextTick()
  } catch (error) {
    const cached = readSavedDraft(null, key)
    if (cached) {
      story.value = null
      ebookId.value = remoteId
      ebookRevision.value = cached.revision || 0
      draft.value = cached.design
      syncAllPages()
      savedSnapshot.value = ''
      hasLocalBackup.value = true
      activePageIndex.value = 0
      selectedElementId.value = ''
      editingElementId.value = ''
      saveError.value = `${friendlyError(error)} Bản nháp trên thiết bị đã được khôi phục.`
    } else loadError.value = friendlyError(error)
  }
  finally { isLoading.value = false }
}

function showToast(message: string, type: 'success' | 'error' = 'success') {
  if (toast.timer) clearTimeout(toast.timer)
  toast.message = message
  toast.type = type
  toast.show = true
  toast.timer = setTimeout(() => { toast.show = false }, 2400)
}

function previewPage(index: number) {
  return previewPages.value[index] ?? null
}

function openPreview() {
  syncAllPages()
  isPreviewOpen.value = true
}

function closePreview() {
  isPreviewOpen.value = false
}

function closeContextMenu() { contextMenu.open = false }
function selectPage(index: number) { syncAllPages(); activePageIndex.value = clamp(index, 0, draft.value.pages.length - 1); selectedElementId.value = ''; editingElementId.value = ''; closeContextMenu() }
function selectElement(element: EbookElement, pageIndex = activePageIndex.value) {
  const changed = activePageIndex.value !== pageIndex || selectedElementId.value !== element.id
  activePageIndex.value = pageIndex
  selectedElementId.value = element.id
  if (changed) editingElementId.value = ''
  closeContextMenu()
}
function setPageRef(element: Element | ComponentPublicInstance | null, index: number) {
  const node = element instanceof HTMLElement ? element : element && '$el' in element ? element.$el : null
  if (node instanceof HTMLElement) pageRefs.set(index, node)
  else pageRefs.delete(index)
}

function nextZIndex(page: EbookPage) { return Math.max(0, ...page.elements.map(element => element.zIndex)) + 1 }
function plainText(value: string) { const template = document.createElement('template'); template.innerHTML = value; return template.content.textContent?.trim() || '' }

function addTextElement(preset: 'heading' | 'body' | 'quote' = 'body') {
  const page = activePage.value
  if (!page || page.locked) return
  const count = page.elements.length
  const element = makeTextElement(makeId('text'), { x: 120 + (count % 3) * 35, y: 250 + (count % 5) * 80, width: 1170, height: preset === 'heading' ? 180 : 240, fontSize: preset === 'heading' ? 56 : preset === 'quote' ? 30 : 31, fontWeight: preset === 'heading' ? 700 : 400, fontStyle: preset === 'quote' ? 'italic' : 'normal', color: preset === 'heading' ? page.accent : '#18241c', zIndex: nextZIndex(page) })
  page.elements.push(element)
  selectedElementId.value = element.id
  activeTool.value = 'text'
  syncPageContent(page)
  void nextTick(() => focusElement(element.id))
}

function addImageElement(url: string, x?: number, y?: number) {
  const page = activePage.value
  if (!page || page.locked || !url) return
  editingElementId.value = ''
  const width = 380
  const imageX = clamp(x ?? (PAGE_WIDTH - width) / 2, 40, PAGE_WIDTH - width - 40)
  const imageY = clamp(y ?? 560, 100, PAGE_HEIGHT - 560)
  const selectedText = selectedTextElement.value && !selectedTextElement.value.role ? selectedTextElement.value : null
  const target = selectedText || (x !== undefined && y !== undefined ? findTextAt(page, x, y) : null)
  const split = target ? splitTextAroundImage(page, target, imageX, imageY, width) : null
  if (split) {
    const splitImage = makeImageElement(makeId('image'), url, { x: split.x, y: split.y, width: split.width, height: 480, zIndex: nextZIndex(page) })
    page.elements.push(splitImage)
    selectedElementId.value = splitImage.id
    activeTool.value = 'elements'
    syncPageContent(page)
    showToast('Đã tách chữ sang hai bên ảnh')
    return
  }
  const element = makeImageElement(makeId('image'), url, { x: imageX, y: imageY, width, height: 480, zIndex: nextZIndex(page) })
  page.elements.push(element)
  selectedElementId.value = element.id
  activeTool.value = 'elements'
  syncPageContent(page)
}

function findTextAt(page: EbookPage, x: number, y: number) {
  return [...page.elements]
    .filter(element => element.kind === 'text' && !element.role && element.html.trim() && x >= element.x && x <= element.x + element.width && y >= element.y && y <= element.y + element.height)
    .sort((a, b) => b.zIndex - a.zIndex)[0] || null
}

function splitTextAroundImage(page: EbookPage, target: EbookElement, imageX: number, imageY: number, imageWidth: number) {
  const gap = 34
  const minimumColumn = 220
  const width = Math.min(imageWidth, target.width - (minimumColumn * 2) - (gap * 2))
  if (width < 180) return null
  const x = clamp(imageX, target.x + minimumColumn + gap, target.x + target.width - minimumColumn - gap - width)
  const leftWidth = x - target.x - gap
  const rightX = x + width + gap
  const rightWidth = target.x + target.width - rightX
  if (leftWidth < minimumColumn || rightWidth < minimumColumn) return null
  const template = document.createElement('template')
  template.innerHTML = cleanHtml(target.html)
  let blocks = Array.from(template.content.children).map(child => child.outerHTML)
  if (!blocks.length && target.html.trim()) blocks = [`<p>${escapeHtml(plainText(target.html))}</p>`]
  if (blocks.length === 1) {
    const words = plainText(blocks[0]).split(/\s+/).filter(Boolean)
    if (words.length < 2) return null
    const middle = Math.ceil(words.length / 2)
    blocks = [`<p>${escapeHtml(words.slice(0, middle).join(' '))}</p>`, `<p>${escapeHtml(words.slice(middle).join(' '))}</p>`]
  }
  const middle = Math.ceil(blocks.length / 2)
  const leftHtml = blocks.slice(0, middle).join('')
  const rightHtml = blocks.slice(middle).join('')
  target.y = Math.min(target.y, imageY)
  target.width = leftWidth
  target.height = Math.max(target.height, 560)
  target.html = cleanHtml(leftHtml)
  const right = makeTextElement(makeId('text'), {
    html: rightHtml,
    x: rightX,
    y: target.y,
    width: rightWidth,
    height: target.height,
    zIndex: target.zIndex,
    locked: false,
    fontFamily: target.fontFamily,
    fontSize: target.fontSize,
    fontWeight: target.fontWeight,
    fontStyle: target.fontStyle,
    textDecoration: target.textDecoration,
    textTransform: target.textTransform,
    color: target.color,
    backgroundColor: target.backgroundColor,
    align: target.align,
    verticalAlign: target.verticalAlign,
    letterSpacing: target.letterSpacing,
    lineHeight: target.lineHeight,
    padding: target.padding,
    cornerRadius: target.cornerRadius,
    rotation: target.rotation,
  })
  page.elements.push(right)
  return { x, y: imageY, width }
}

function duplicateSelectedElement() {
  const page = activePage.value
  const element = selectedElement.value
  if (!page || !element || page.locked) return
  const copy = { ...element, id: makeId(element.kind), x: clamp(element.x + 32, 0, PAGE_WIDTH - element.width), y: clamp(element.y + 32, 0, PAGE_HEIGHT - element.height), zIndex: nextZIndex(page), locked: false }
  page.elements.push(copy)
  selectedElementId.value = copy.id
  syncPageContent(page)
}

function deleteSelectedElement() {
  const page = activePage.value
  if (!page || !selectedElement.value || page.locked) return
  page.elements = page.elements.filter(element => element.id !== selectedElementId.value)
  selectedElementId.value = ''
  editingElementId.value = ''
  syncPageContent(page)
}

function toggleElementLock() { if (selectedElement.value) selectedElement.value.locked = !selectedElement.value.locked }
function setLayerOrder(direction: 'front' | 'back') {
  const page = activePage.value
  const element = selectedElement.value
  if (!page || !element) return
  const ordered = [...page.elements].sort((a, b) => a.zIndex - b.zIndex)
  const currentIndex = ordered.findIndex(item => item.id === element.id)
  if (currentIndex < 0) return
  ordered.splice(currentIndex, 1)
  if (direction === 'front') ordered.push(element)
  else ordered.unshift(element)
  ordered.forEach((item, index) => { item.zIndex = index + 1 })
}
function bringForward() { setLayerOrder('front') }
function sendBackward() { setLayerOrder('back') }

function handleElementInput(event: Event, element: EbookElement) {
  element.html = cleanHtml((event.currentTarget as HTMLElement).innerHTML)
  const value = plainText(element.html)
  if (element.role === 'cover-title') draft.value.title = value
  if (element.role === 'cover-subtitle') draft.value.subtitle = value
  if (element.role === 'cover-author') draft.value.author = value
  if (activePage.value) syncPageContent(activePage.value)
}

function focusElement(id: string) {
  const element = activePage.value?.elements.find(item => item.id === id)
  if (!element || element.locked || activePage.value?.locked) return
  selectedElementId.value = id
  editingElementId.value = id
  void nextTick(() => {
    const target = document.querySelector<HTMLElement>(`[data-editor-element="${id}"]`)
    if (!target) return
    target.focus()
    const selection = window.getSelection()
    const range = document.createRange()
    range.selectNodeContents(target)
    range.collapse(false)
    selection?.removeAllRanges()
    selection?.addRange(range)
  })
}

function toggleBold() { if (selectedTextElement.value) selectedTextElement.value.fontWeight = selectedTextElement.value.fontWeight >= 700 ? 400 : 700 }
function toggleItalic() { if (selectedTextElement.value) selectedTextElement.value.fontStyle = selectedTextElement.value.fontStyle === 'italic' ? 'normal' : 'italic' }

function snapValue(value: number, candidates: number[]) {
  const closest = candidates.reduce<{ value: number; distance: number } | null>((best, candidate) => { const distance = Math.abs(value - candidate); return !best || distance < best.distance ? { value: candidate, distance } : best }, null)
  return closest && closest.distance <= 14 ? closest.value : Math.round(value / GRID_SIZE) * GRID_SIZE
}

function snapPosition(page: EbookPage, element: EbookElement, x: number, y: number) {
  const xCandidates = [0, PAGE_WIDTH - element.width, (PAGE_WIDTH - element.width) / 2]
  const yCandidates = [0, PAGE_HEIGHT - element.height, (PAGE_HEIGHT - element.height) / 2]
  for (const other of page.elements) {
    if (other.id === element.id) continue
    xCandidates.push(other.x, other.x + other.width, other.x + other.width / 2 - element.width / 2, other.x + other.width - element.width)
    yCandidates.push(other.y, other.y + other.height, other.y + other.height / 2 - element.height / 2, other.y + other.height - element.height)
  }
  return { x: clamp(snapValue(x, xCandidates), 0, PAGE_WIDTH - element.width), y: clamp(snapValue(y, yCandidates), 0, PAGE_HEIGHT - element.height) }
}

function beginInteraction(event: PointerEvent, element: EbookElement, pageIndex: number, mode: Interaction['mode']) {
  const page = draft.value.pages[pageIndex]
  const pageNode = pageRefs.get(pageIndex)
  if (!page || !pageNode || page.locked || element.locked || event.button !== 0) return
  const editor = (event.target as HTMLElement).closest<HTMLElement>('[data-editor-element]')
  if (editingElementId.value === element.id && editor?.dataset.editorElement === element.id) return
  selectElement(element, pageIndex)
  editingElementId.value = ''
  event.preventDefault()
  const rect = pageNode.getBoundingClientRect()
  interaction.value = { mode, pageIndex, elementId: element.id, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, startElementX: element.x, startElementY: element.y, startWidth: element.width, startHeight: element.height, scaleX: rect.width / PAGE_WIDTH, scaleY: rect.height / PAGE_HEIGHT }
  window.addEventListener('pointermove', handlePointerMove)
  window.addEventListener('pointerup', finishInteraction)
}

function handlePointerMove(event: PointerEvent) {
  const state = interaction.value
  if (!state || event.pointerId !== state.pointerId) return
  const page = draft.value.pages[state.pageIndex]
  const element = page?.elements.find(item => item.id === state.elementId)
  if (!page || !element) return
  const dx = (event.clientX - state.startX) / state.scaleX
  const dy = (event.clientY - state.startY) / state.scaleY
  if (state.mode === 'move') { const position = snapPosition(page, element, state.startElementX + dx, state.startElementY + dy); element.x = position.x; element.y = position.y }
  else { element.width = clamp(Math.round(state.startWidth + dx), 100, PAGE_WIDTH - element.x); element.height = clamp(Math.round(state.startHeight + dy), 60, PAGE_HEIGHT - element.y) }
}

function finishInteraction() {
  if (!interaction.value) return
  window.removeEventListener('pointermove', handlePointerMove)
  window.removeEventListener('pointerup', finishInteraction)
  interaction.value = null
  syncAllPages()
}

function addPage(kind: PageKind = 'blank', afterIndex = activePageIndex.value) {
  syncAllPages()
  const index = Math.max(-1, Math.min(afterIndex, draft.value.pages.length - 1)) + 1
  const page = makePage(makeId('page'), kind, kind === 'chapter' ? 'Chương mới' : 'Trang mới', draft.value.pageBackground, draft.value.accent, '')
  if (kind === 'chapter') page.elements = [makeTextElement(makeId('text'), { html: '', fontSize: 56, fontWeight: 700, color: page.accent, width: 1170, height: 180 })]
  draft.value.pages.splice(index, 0, page)
  activePageIndex.value = index
  selectedElementId.value = page.elements[0]?.id || ''
  void nextTick(() => selectedElement.value && focusElement(selectedElement.value.id))
}

function duplicatePage(index: number) {
  const original = draft.value.pages[index]
  if (!original) return
  const clone: EbookPage = { ...original, id: makeId('page'), title: `${original.title} (bản sao)`, locked: false, hidden: false, elements: original.elements.map(element => ({ ...element, id: makeId(element.kind), locked: false })) }
  draft.value.pages.splice(index + 1, 0, clone)
  selectPage(index + 1)
}

function deletePage(index: number) {
  if (draft.value.pages.length <= 1 || draft.value.pages[index]?.kind === 'cover') { showToast('Không thể xóa trang bìa', 'error'); return }
  draft.value.pages.splice(index, 1)
  activePageIndex.value = clamp(activePageIndex.value, 0, draft.value.pages.length - 1)
  selectedElementId.value = ''
}

function movePage(index: number, direction: -1 | 1) {
  const target = index + direction
  if (target < 0 || target >= draft.value.pages.length) return
  const [page] = draft.value.pages.splice(index, 1)
  draft.value.pages.splice(target, 0, page)
  activePageIndex.value = target
}

function togglePageHidden(page: EbookPage) { page.hidden = !page.hidden }
function togglePageLocked(page: EbookPage) { page.locked = !page.locked }
function applyTemplate(background: string, accent: string, fontFamily: string) { draft.value.pageBackground = background; draft.value.accent = accent; draft.value.fontFamily = fontFamily; draft.value.pages.forEach(page => { page.background = background; page.accent = accent; page.elements.forEach(element => { if (element.kind === 'text') element.fontFamily = fontFamily }) }) }
function setCoverImage(url: string) { const cover = draft.value.pages.find(page => page.kind === 'cover'); if (cover) cover.coverUrl = url }
function useGalleryImage(url: string) { if (activePage.value?.kind === 'cover' && !selectedElement.value) setCoverImage(url); else addImageElement(url) }

function openContextMenu(event: MouseEvent, element: EbookElement, pageIndex: number) {
  editingElementId.value = ''
  selectElement(element, pageIndex)
  contextMenu.elementId = element.id
  contextMenu.pageIndex = pageIndex
  contextMenu.x = clamp(event.clientX, 8, window.innerWidth - 204)
  contextMenu.y = clamp(event.clientY, 8, window.innerHeight - 220)
  contextMenu.open = true
}

function openPageContextMenu(event: MouseEvent, pageIndex: number) {
  selectPage(pageIndex)
  contextMenu.elementId = ''
  contextMenu.pageIndex = pageIndex
  contextMenu.x = clamp(event.clientX, 8, window.innerWidth - 204)
  contextMenu.y = clamp(event.clientY, 8, window.innerHeight - 120)
  contextMenu.open = true
}

function runContextAction(action: 'front' | 'back' | 'duplicate' | 'lock' | 'delete' | 'add-text') {
  const page = draft.value.pages[contextMenu.pageIndex]
  const element = page?.elements.find(item => item.id === contextMenu.elementId)
  activePageIndex.value = contextMenu.pageIndex
  if (element) selectedElementId.value = element.id
  if (action === 'front') bringForward()
  if (action === 'back') sendBackward()
  if (action === 'duplicate') duplicateSelectedElement()
  if (action === 'lock') toggleElementLock()
  if (action === 'delete') deleteSelectedElement()
  if (action === 'add-text') addTextElement('body')
  closeContextMenu()
}

async function uploadFile(file: File) { const form = new FormData(); form.append('file', file); const response = await client.request<{ url: string }>('/api/upload', { method: 'POST', body: form }); return response.url }

async function handleUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  isUploading.value = true
  try { const url = await uploadFile(file); if (!uploadedImages.value.includes(url)) uploadedImages.value.push(url); if (activePage.value?.kind === 'cover' && !selectedElement.value) setCoverImage(url); else addImageElement(url) }
  catch (error) { showToast(friendlyError(error), 'error') }
  finally { isUploading.value = false; input.value = '' }
}

async function handleCanvasDrop(event: DragEvent, pageIndex: number) {
  const file = event.dataTransfer?.files?.[0]
  if (!file || !file.type.startsWith('image/')) return
  selectPage(pageIndex)
  const pageNode = pageRefs.get(pageIndex)
  if (!pageNode) return
  try {
    const url = await uploadFile(file)
    if (!uploadedImages.value.includes(url)) uploadedImages.value.push(url)
    const rect = pageNode.getBoundingClientRect()
    addImageElement(url, clamp(((event.clientX - rect.left) / rect.width) * PAGE_WIDTH - 280, 0, PAGE_WIDTH - 560), clamp(((event.clientY - rect.top) / rect.height) * PAGE_HEIGHT - 180, 0, PAGE_HEIGHT - 360))
  } catch (error) { showToast(friendlyError(error), 'error') }
}

function changeZoom(delta: number) { zoom.value = clamp(Number((zoom.value + delta).toFixed(2)), .45, 1) }
function undo() { document.execCommand('undo') }
function redo() { document.execCommand('redo') }
function handleEditorKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    editingElementId.value = ''
    ;(event.currentTarget as HTMLElement).blur()
    return
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); void saveDraft() }
}
function exportDesign() { syncAllPages(); window.print() }
const exportingEpub = ref(false)
async function exportEpub() {
  if (exportingEpub.value || isLoading.value || loadError.value) return
  exportingEpub.value = true
  try {
    syncAllPages()
    const blob = await buildEpub(draft.value)
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = safeEpubFilename(draft.value.title)
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 3000)
    showToast('Đã tạo file EPUB để tải về.')
  } catch (error) {
    showToast(error instanceof Error ? error.message : 'Không thể xuất EPUB.', 'error')
  } finally {
    exportingEpub.value = false
  }
}

async function saveDraft() {
  if (isSaving.value || isLoading.value || loadError.value) return
  isSaving.value = true
  saveError.value = ''
  draft.value.title = draft.value.title.trim() || 'Ebook chưa đặt tên'
  await nextTick()
  syncAllPages()
  const submittedSnapshot = serializeDraft()
  const previousKey = storageKey()
  cacheDraft(submittedSnapshot, true)
  try {
    const design = JSON.parse(submittedSnapshot) as EbookDraft
    const coverPage = design.pages.find(page => page.kind === 'cover')
    const payload = { title: design.title, coverUrl: coverPage?.coverUrl || '', design, expectedRevision: ebookRevision.value }
    const saved = await client.request<EbookRecord>(ebookId.value ? '/api/ebooks/' + encodeURIComponent(ebookId.value) : '/api/ebooks', { method: ebookId.value ? 'PUT' : 'POST', body: JSON.stringify(payload) })
    ebookId.value = saved.id
    ebookRevision.value = saved.revision
    savedSnapshot.value = submittedSnapshot
    const currentSnapshot = serializeDraft()
    const cached = cacheDraft(currentSnapshot, currentSnapshot !== submittedSnapshot)
    if (cached && previousKey !== storageKey()) {
      try { localStorage.removeItem(previousKey) } catch { /* The server save remains successful. */ }
    }
  } catch (error) {
    cacheDraft(serializeDraft(), true)
    saveError.value = friendlyError(error)
    showToast(hasLocalBackup.value ? 'Chưa lưu lên hệ thống. Đã giữ bản nháp trên thiết bị.' : saveError.value, 'error')
    isSaving.value = false
    return
  }
  // Updating the URL and caching are separate from the successful API save.
  // A failure in either step must not report that the ebook failed to save.
  if (String(route.params.id || '') !== ebookId.value) {
    try {
      await router.replace({
        path: '/library/ebook-editor/' + encodeURIComponent(ebookId.value),
        query: route.query.story ? { story: String(route.query.story) } : undefined,
      })
    } catch { /* Keep the saved ebook open. */ }
  }
  showToast(isDirty.value ? 'Đã lưu. Có thay đổi mới chưa lưu.' : 'Đã lưu lên hệ thống')
  isSaving.value = false
}

function beforeUnload(event: BeforeUnloadEvent) { if (!isDirty.value) return; event.preventDefault(); event.returnValue = '' }
watch(isDirty, dirty => { if (dirty) window.addEventListener('beforeunload', beforeUnload); else window.removeEventListener('beforeunload', beforeUnload) }, { immediate: true })
watch(() => [draft.value.title, draft.value.subtitle, draft.value.author], values => {
  const cover = draft.value.pages.find(page => page.kind === 'cover')
  if (!cover) return
  const fields: Record<string, string> = { 'cover-title': String(values[0] || ''), 'cover-subtitle': String(values[1] || ''), 'cover-author': String(values[2] || '') }
  cover.elements.forEach(element => { if (element.role && fields[element.role] !== undefined) element.html = cleanHtml(fields[element.role]) })
}, { flush: 'post' })
watch(() => [String(route.params.id || ''), String(route.query.story || '')], ([id]) => {
  if (isSaving.value && id && id === ebookId.value) return
  void loadEbook()
}, { immediate: true })
onBeforeUnmount(() => { finishInteraction(); closePreview(); if (toast.timer) clearTimeout(toast.timer); window.removeEventListener('beforeunload', beforeUnload) })
</script>

<template>
  <div class="ebook-studio-layout" :style="canvasStyle" @pointerdown="closeContextMenu">
    <main class="ebook-studio-main">
      <header class="ebook-header">
        <label class="ebook-name-input"><span class="sr-only">Tên ebook</span><input v-model="draft.title" placeholder="Tên ebook" /></label>
        <div class="ebook-header-actions"><span class="ebook-save-state" :class="{ error: saveError }"><Check v-if="!isDirty && !saveError && ebookId" :size="14" />{{ saveState }}</span><button type="button" class="ebook-icon-button" title="Hoàn tác" @click="undo"><Undo2 :size="16" /></button><button type="button" class="ebook-icon-button" title="Làm lại" @click="redo"><Redo2 :size="16" /></button><button type="button" class="ebook-action-button" title="Xem trước" @click="openPreview"><Eye :size="15" />Xem trước</button><button type="button" class="ebook-action-button" title="Mở hộp thoại in và lưu thành PDF" @click="exportDesign"><Download :size="15" />PDF</button><button type="button" class="ebook-action-button" :disabled="exportingEpub" title="Tải sách EPUB có mục lục và ảnh" @click="exportEpub"><Download :size="15" />{{ exportingEpub ? 'Đang xuất…' : 'EPUB' }}</button><button type="button" class="ebook-save-button ebook-primary-btn" :disabled="isSaving || isLoading || !!loadError" @click="saveDraft">{{ isSaving ? 'Đang lưu' : 'Lưu' }}</button></div>
      </header>
      <div v-if="saveError && !isLoading && !loadError" class="ebook-save-error" role="alert"><span>{{ saveError }}</span><button type="button" :disabled="isSaving" @click="saveDraft">Thử lưu lại</button></div>

      <div v-if="isLoading" class="ebook-request-state">Đang tải</div>
      <div v-else-if="loadError" class="ebook-request-state error"><span>{{ loadError }}</span><button type="button" @click="loadEbook">Thử lại</button></div>

      <div v-else class="ebook-workspace">
        <nav class="ebook-tool-rail" aria-label="Công cụ ebook">
          <button v-for="item in toolItems" :key="item.id" type="button" class="ebook-tool-button" :class="{ active: panelOpen && activeTool === item.id }" :title="item.label" @click="panelOpen = activeTool === item.id ? !panelOpen : true; activeTool = item.id"><component :is="item.icon" :size="19" :stroke-width="1.7" /><span>{{ item.label }}</span></button>
        </nav>

        <aside v-if="panelOpen" class="ebook-inspector">
          <template v-if="activeTool === 'text'">
            <h2>Văn bản</h2>
            <div class="ebook-tool-grid"><button type="button" @click="addTextElement('heading')"><Heading1 :size="18" /><span>Tiêu đề</span></button><button type="button" @click="addTextElement('body')"><Type :size="18" /><span>Văn bản</span></button><button type="button" @click="addTextElement('quote')"><Italic :size="18" /><span>Trích dẫn</span></button></div>
            <div v-if="selectedTextElement" class="ebook-properties">
              <div class="ebook-property-row ebook-format-row">
                <button type="button" :class="{ active: selectedTextElement.fontWeight >= 700 }" title="Đậm" @click="toggleBold"><Bold :size="16" /></button>
                <button type="button" :class="{ active: selectedTextElement.fontStyle === 'italic' }" title="Nghiêng" @click="toggleItalic"><Italic :size="16" /></button>
                <button type="button" :class="{ active: selectedTextElement.textDecoration === 'underline' }" title="Gạch chân" @click="selectedTextElement.textDecoration = selectedTextElement.textDecoration === 'underline' ? 'none' : 'underline'"><span class="format-letter underline">U</span></button>
                <button type="button" :class="{ active: selectedTextElement.textDecoration === 'line-through' }" title="Gạch ngang" @click="selectedTextElement.textDecoration = selectedTextElement.textDecoration === 'line-through' ? 'none' : 'line-through'"><span class="format-letter strike">S</span></button>
                <button type="button" :class="{ active: selectedTextElement.align === 'left' }" title="Căn trái" @click="selectedTextElement.align = 'left'"><AlignLeft :size="16" /></button>
                <button type="button" :class="{ active: selectedTextElement.align === 'center' }" title="Căn giữa" @click="selectedTextElement.align = 'center'"><AlignCenter :size="16" /></button>
                <button type="button" :class="{ active: selectedTextElement.align === 'right' }" title="Căn phải" @click="selectedTextElement.align = 'right'"><AlignRight :size="16" /></button>
                <button type="button" :class="{ active: selectedTextElement.align === 'justify' }" title="Căn đều" @click="selectedTextElement.align = 'justify'">≡</button>
              </div>
              <div class="ebook-property-grid">
                <label class="property-field"><span>Cỡ chữ</span><input v-model.number="selectedTextElement.fontSize" type="number" min="10" max="180" /></label>
                <label class="property-field"><span>Độ đậm</span><select v-model.number="selectedTextElement.fontWeight"> <option v-for="weight in fontWeights" :key="weight" :value="weight">{{ weight }}</option></select></label>
                <label class="property-field"><span>Kiểu chữ</span><select v-model="selectedTextElement.fontFamily"><option :value="DEFAULT_FONT">Georgia / Serif</option><option value="Arial, sans-serif">Arial / Sans</option><option value="'Trebuchet MS', sans-serif">Trebuchet</option><option value="'Times New Roman', serif">Times New Roman</option><option value="Georgia, serif">Georgia</option><option value="'Courier New', monospace">Courier</option></select></label>
                <label class="property-field"><span>Biến đổi</span><select v-model="selectedTextElement.textTransform"><option value="none">Bình thường</option><option value="uppercase">IN HOA</option><option value="lowercase">in thường</option><option value="capitalize">Viết Hoa Từ</option></select></label>
                <label class="property-field"><span>Căn dọc</span><select v-model="selectedTextElement.verticalAlign"><option value="top">Trên</option><option value="middle">Giữa</option><option value="bottom">Dưới</option></select></label>
                <label class="property-field"><span>Gạch chữ</span><select v-model="selectedTextElement.textDecoration"><option value="none">Không</option><option value="underline">Gạch chân</option><option value="line-through">Gạch ngang</option></select></label>
              </div>
              <div class="ebook-color-control"><span>Màu chữ</span><div class="ebook-swatches"><button v-for="color in textColors" :key="color" type="button" class="ebook-swatch" :class="{ active: selectedTextElement.color === color }" :style="{ background: color }" :title="color" @click="selectedTextElement.color = color" /></div><input v-model="selectedTextElement.color" type="color" title="Màu tùy chỉnh" /></div>
              <div class="ebook-color-control"><span>Nền ô chữ</span><div class="ebook-swatches"><button v-for="color in fillColors" :key="color" type="button" class="ebook-swatch" :class="{ active: selectedTextElement.backgroundColor === color, transparent: color === 'transparent' }" :style="color === 'transparent' ? {} : { background: color }" :title="color === 'transparent' ? 'Trong suốt' : color" @click="selectedTextElement.backgroundColor = color"><span v-if="color === 'transparent'">×</span></button></div><input :value="selectedTextElement.backgroundColor === 'transparent' ? '#ffffff' : selectedTextElement.backgroundColor" type="color" title="Màu nền tùy chỉnh" @input="selectedTextElement.backgroundColor = ($event.target as HTMLInputElement).value" /></div>
              <label class="property-range"><span>Giãn dòng <b>{{ selectedTextElement.lineHeight.toFixed(2) }}</b></span><input v-model.number="selectedTextElement.lineHeight" type="range" min="1" max="2.5" step="0.05" /></label>
              <label class="property-range"><span>Khoảng chữ <b>{{ selectedTextElement.letterSpacing }}px</b></span><input v-model.number="selectedTextElement.letterSpacing" type="range" min="-4" max="24" step="1" /></label>
              <label class="property-range"><span>Đệm ô <b>{{ selectedTextElement.padding }}px</b></span><input v-model.number="selectedTextElement.padding" type="range" min="0" max="120" step="2" /></label>
              <label class="property-range"><span>Bo góc <b>{{ selectedTextElement.cornerRadius }}px</b></span><input v-model.number="selectedTextElement.cornerRadius" type="range" min="0" max="120" step="2" /></label>
              <label class="property-range"><span>Độ trong suốt <b>{{ Math.round(selectedTextElement.opacity * 100) }}%</b></span><input v-model.number="selectedTextElement.opacity" type="range" min="0.1" max="1" step="0.05" /></label>
              <label class="property-field"><span>Xoay</span><input v-model.number="selectedTextElement.rotation" type="number" min="-180" max="180" step="1" /></label>
            </div>
          </template>

          <template v-else-if="activeTool === 'elements'"><h2>Ảnh</h2><button type="button" class="ebook-wide-button" @click="uploadInput?.click()"><Upload :size="17" />Tải ảnh</button><button v-for="url in gallery" :key="url" type="button" class="ebook-gallery-item" @click="useGalleryImage(url)"><img :src="url" alt="" /></button></template>
          <template v-else-if="activeTool === 'uploads'"><h2>Tải lên</h2><button type="button" class="ebook-upload-button" :disabled="isUploading" @click="uploadInput?.click()"><Upload :size="19" />{{ isUploading ? 'Đang tải' : 'Chọn ảnh' }}</button><div class="ebook-upload-grid"><button v-for="url in gallery" :key="url" type="button" @click="useGalleryImage(url)"><img :src="url" alt="" /></button></div></template>
          <template v-else-if="activeTool === 'pages'"><h2>Trang</h2><button type="button" class="ebook-wide-button" @click="addPage()"><Plus :size="17" />Thêm trang</button><div class="ebook-page-list-mini"><button v-for="(page, index) in draft.pages" :key="page.id" type="button" :class="{ active: activePageIndex === index, hidden: page.hidden }" @click="selectPage(index)"><span>{{ index + 1 }}</span><strong>{{ page.title }}</strong><EyeOff v-if="page.hidden" :size="13" /></button></div></template>
          <template v-else>
            <h2>Thiết lập</h2>
            <div class="ebook-settings-stack">
              <section class="ebook-settings-group">
                <span class="ebook-settings-label">Thông tin</span>
                <label class="property-field"><span>Tên ebook</span><input v-model="draft.title" placeholder="Tên ebook" /></label>
                <label class="property-field"><span>Tác giả</span><input v-model="draft.author" placeholder="Tác giả" /></label>
                <label class="property-field"><span>Mô tả</span><textarea v-model="draft.subtitle" rows="3" /></label>
              </section>
              <section class="ebook-settings-group">
                <span class="ebook-settings-label">Màu trang</span>
                <label class="property-field"><span>Nền trang</span><span class="ebook-color-picker"><input v-model="draft.pageBackground" type="color" /><code>{{ draft.pageBackground }}</code></span></label>
                <label class="property-field"><span>Màu nhấn</span><span class="ebook-color-picker"><input v-model="draft.accent" type="color" /><code>{{ draft.accent }}</code></span></label>
              </section>
              <section class="ebook-settings-group">
                <span class="ebook-settings-label">Mẫu nhanh</span>
                <div class="ebook-template-row">
                  <button type="button" title="Kem" @click="applyTemplate('#f8f2e8', '#435a41', DEFAULT_FONT)"><span class="template-swatch swatch-cream" /><strong>Kem</strong></button>
                  <button type="button" title="Xám xanh" @click="applyTemplate('#dce5e0', '#263d63', DEFAULT_FONT)"><span class="template-swatch swatch-slate" /><strong>Xám xanh</strong></button>
                  <button type="button" title="Trắng" @click="applyTemplate('#ffffff', '#18241c', 'Arial, sans-serif')"><span class="template-swatch swatch-white" /><strong>Trắng</strong></button>
                </div>
              </section>
            </div>
          </template>
        </aside>

        <section class="ebook-canvas-area">
          <div class="ebook-canvas-toolbar ebook-page-summary"><span>Trang {{ activePageIndex + 1 }} / {{ pageCount }}</span><div><button type="button" class="ebook-icon-button" title="Ẩn công cụ" @click="panelOpen = !panelOpen"><Minus :size="16" /></button><button type="button" class="ebook-icon-button" title="Thêm trang" @click="addPage()"><Plus :size="16" /></button></div></div>
          <div class="ebook-stage-scroll" @click.self="selectedElementId = ''; editingElementId = ''; closeContextMenu()">
            <div class="ebook-stage" :style="{ transform: `scale(${zoom})` }">
              <div class="ebook-page-list">
                <article v-for="(page, index) in draft.pages" :key="page.id" class="ebook-page-item" :class="{ active: activePageIndex === index, hidden: page.hidden }">
                  <div class="ebook-page-label"><span>Trang {{ index + 1 }} · {{ page.title }}</span><div class="ebook-page-actions"><button type="button" title="Đưa lên" :disabled="index === 0" @click="movePage(index, -1)"><ChevronUp :size="14" /></button><button type="button" title="Đưa xuống" :disabled="index === draft.pages.length - 1" @click="movePage(index, 1)"><ChevronDown :size="14" /></button><button type="button" title="Ẩn trang" @click="togglePageHidden(page)"><EyeOff v-if="page.hidden" :size="14" /><Eye v-else :size="14" /></button><button type="button" title="Khóa trang" @click="togglePageLocked(page)"><Lock v-if="page.locked" :size="14" /><Unlock v-else :size="14" /></button><button type="button" title="Nhân bản" @click="duplicatePage(index)"><Copy :size="14" /></button><button type="button" title="Xóa trang" @click="deletePage(index)"><Trash2 :size="14" /></button></div></div>
                  <EbookPageCanvas
                    :ref="element => setPageRef(element, index)"
                    :page="page"
                    :selected-page="activePageIndex === index"
                    :selected-element-id="activePageIndex === index ? selectedElementId : ''"
                    :editing-element-id="activePageIndex === index ? editingElementId : ''"
                    @page-click="selectPage(index)"
                    @page-contextmenu="openPageContextMenu($event, index)"
                    @page-drop="handleCanvasDrop($event, index)"
                    @interaction-start="beginInteraction($event.event, $event.element, index, $event.mode)"
                    @select-element="selectElement($event, index)"
                    @contextmenu-element="openContextMenu($event.event, $event.element, index)"
                    @edit-element="focusElement($event.id)"
                    @element-input="handleElementInput($event.event, $event.element)"
                    @element-keydown="handleEditorKeydown($event)"
                  />
                </article>
              </div>
            </div>
          </div>
          <footer class="ebook-canvas-footer"><div><button type="button" class="ebook-icon-button" title="Thu nhỏ" @click="changeZoom(-.1)"><ZoomOut :size="16" /></button><span>{{ Math.round(zoom * 100) }}%</span><button type="button" class="ebook-icon-button" title="Phóng to" @click="changeZoom(.1)"><ZoomIn :size="16" /></button></div><div v-if="selectedElement" class="ebook-selection-actions"><button type="button" title="Đưa lên trên" @click="bringForward"><ChevronUp :size="15" /></button><button type="button" title="Đưa xuống dưới" @click="sendBackward"><ChevronDown :size="15" /></button><button type="button" title="Khóa ô" @click="toggleElementLock"><Lock v-if="selectedElement.locked" :size="15" /><Unlock v-else :size="15" /></button><button type="button" title="Nhân bản" @click="duplicateSelectedElement"><Copy :size="15" /></button><button type="button" title="Xóa ô" @click="deleteSelectedElement"><Trash2 :size="15" /></button></div></footer>
        </section>
      </div>
    </main>
    <EbookFlipBookPreview v-if="isPreviewOpen" :title="draft.title || 'Xem trước'" :page-count="previewPages.length" :aspect-ratio="PAGE_ASPECT_RATIO" :cover-color="draft.accent" @close="closePreview">
      <template #default="{ pageIndex }">
        <EbookPageCanvas v-if="previewPage(pageIndex)" :page="previewPage(pageIndex)!" read-only />
      </template>
    </EbookFlipBookPreview>
    <div v-if="contextMenu.open" class="ebook-context-menu" :style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }" @pointerdown.stop @click.stop>
      <template v-if="contextMenu.elementId">
        <button type="button" @click="runContextAction('front')">Đưa lên trên</button>
        <button type="button" @click="runContextAction('back')">Đưa xuống dưới</button>
        <button type="button" @click="runContextAction('duplicate')">Nhân bản ô</button>
        <button type="button" @click="runContextAction('lock')">{{ selectedElement?.locked ? 'Mở khóa ô' : 'Khóa ô' }}</button>
        <button type="button" class="danger" @click="runContextAction('delete')">Xóa ô</button>
      </template>
      <template v-else><button type="button" @click="runContextAction('add-text')">Thêm ô chữ</button></template>
    </div>
    <input ref="uploadInput" type="file" accept="image/png,image/jpeg,image/webp,image/gif" class="ebook-hidden-input" @change="handleUpload" />
    <Transition name="ebook-toast"><div v-if="toast.show" class="ebook-toast" :class="toast.type" role="status">{{ toast.message }}</div></Transition>
  </div>
</template>

<style scoped>
.ebook-studio-layout { --library-surface: #fff; --library-ink: #18241c; --library-muted: #687265; --library-accent: #435a41; display: flex; width: 100%; height: 100dvh; overflow: hidden; color: var(--library-ink); background: var(--library-surface); }
.ebook-studio-main { display: flex; flex: 1; min-width: 0; min-height: 0; flex-direction: column; }
.ebook-header { display: flex; align-items: center; justify-content: space-between; gap: 18px; min-height: 60px; padding: 10px 28px; background: color-mix(in oklab, var(--library-ink) 3%, var(--library-surface)); }
.ebook-name-input { flex: 1; min-width: 160px; max-width: 390px; }
.ebook-name-input input { width: 100%; padding: 8px 0; border: 0; outline: 0; color: var(--library-ink); background: transparent; font-size: 15px; font-weight: 650; }
.ebook-name-input input::placeholder { color: color-mix(in oklab, var(--library-ink) 45%, transparent); }
.ebook-header-actions, .ebook-canvas-toolbar > div, .ebook-canvas-footer > div, .ebook-selection-actions, .ebook-property-row { display: flex; align-items: center; gap: 6px; }
.ebook-header-actions { flex-wrap: wrap; justify-content: flex-end; }
.ebook-save-state { display: inline-flex; align-items: center; gap: 5px; margin-right: 8px; color: var(--library-muted); font-size: 11px; }
.ebook-save-state.error { color: #9a4d3f; }
.ebook-save-error { display: flex; align-items: center; justify-content: center; gap: 12px; min-height: 34px; padding: 5px 16px; color: #8e493c; background: color-mix(in oklab, #c96e54 10%, var(--library-surface)); font-size: 11px; }
.ebook-save-error span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ebook-save-error button { flex: 0 0 auto; padding: 6px 10px; border: 0; border-radius: 9999px; color: var(--library-surface); background: var(--library-ink); font: inherit; font-size: 10px; cursor: pointer; }
.ebook-save-error button:disabled { opacity: .55; cursor: wait; }
.ebook-icon-button, .ebook-selection-actions button, .ebook-property-row button { display: grid; place-items: center; width: 30px; height: 30px; padding: 0; border: 0; border-radius: 50%; color: var(--library-ink); background: transparent; cursor: pointer; }
.ebook-icon-button:hover, .ebook-selection-actions button:hover, .ebook-property-row button:hover, .ebook-property-row button.active { color: var(--library-accent); background: color-mix(in oklab, var(--library-accent) 12%, transparent); }
.ebook-action-button, .ebook-save-button { display: inline-flex; align-items: center; gap: 6px; min-height: 34px; padding: 0 14px; border: 0; border-radius: 9999px; font-size: 12px; font-weight: 650; cursor: pointer; }
.ebook-action-button { color: var(--library-ink); background: color-mix(in oklab, var(--library-ink) 7%, transparent); }
.ebook-save-button { color: var(--library-surface); background: var(--library-ink); }
.ebook-save-button:disabled { opacity: .55; cursor: wait; }
.ebook-workspace { display: flex; flex: 1; min-height: 0; }
.ebook-tool-rail { display: flex; flex: 0 0 72px; flex-direction: column; align-items: center; gap: 6px; padding: 16px 7px; background: color-mix(in oklab, var(--library-ink) 3%, var(--library-surface)); }
.ebook-tool-button { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px; width: 58px; min-height: 52px; padding: 6px 2px; border: 0; border-radius: 14px; color: var(--library-muted); background: transparent; font-size: 10px; cursor: pointer; }
.ebook-tool-button:hover, .ebook-tool-button.active { color: var(--library-accent); background: color-mix(in oklab, var(--library-accent) 11%, transparent); }
.ebook-inspector { flex: 0 0 250px; min-width: 0; overflow-y: auto; padding: 24px 18px; background: color-mix(in oklab, var(--library-ink) 2%, var(--library-surface)); }
.ebook-inspector h2 { margin: 0 0 18px; color: var(--library-ink); font-size: 17px; font-weight: 700; }
.ebook-settings-stack { display: flex; flex-direction: column; gap: 26px; }
.ebook-settings-group { display: flex; flex-direction: column; gap: 13px; min-width: 0; }
.ebook-settings-label { color: var(--library-accent); font-size: 10px; font-weight: 750; letter-spacing: .08em; text-transform: uppercase; }
.ebook-settings-group .property-field { display: flex; align-items: stretch; flex-direction: column; gap: 6px; }
.ebook-settings-group .property-field > span:first-child { color: var(--library-muted); }
.ebook-settings-group .property-field input:not([type='color']), .ebook-settings-group .property-field textarea { width: 100%; box-sizing: border-box; min-height: 35px; flex: none; }
.ebook-settings-group .property-field textarea { min-height: 82px; }
.ebook-color-picker { display: flex; align-items: center; gap: 9px; width: 100%; }
.ebook-color-picker input[type='color'] { flex: 0 0 38px; width: 38px; height: 32px; padding: 2px; border: 0; cursor: pointer; }
.ebook-color-picker code { color: var(--library-muted); font-size: 10px; letter-spacing: .04em; }
.ebook-tool-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
.ebook-tool-grid button, .ebook-wide-button { display: flex; align-items: center; gap: 8px; min-height: 42px; padding: 9px 10px; border: 0; border-radius: 10px; color: var(--library-ink); background: color-mix(in oklab, var(--library-ink) 5%, transparent); font-size: 11px; cursor: pointer; }
.ebook-tool-grid button:hover, .ebook-wide-button:hover { color: var(--library-accent); background: color-mix(in oklab, var(--library-accent) 12%, transparent); }
.ebook-wide-button { width: 100%; justify-content: center; margin-bottom: 12px; }
.ebook-properties { display: flex; flex-direction: column; gap: 14px; margin-top: 24px; }
.ebook-format-row { flex-wrap: wrap; }
.ebook-format-row button { font-size: 15px; font-weight: 650; }
.format-letter { display: inline-block; line-height: 1; }
.format-letter.underline { text-decoration: underline; }
.format-letter.strike { text-decoration: line-through; }
.ebook-property-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 8px; }
.ebook-property-grid .property-field { display: block; }
.ebook-property-grid .property-field span { display: block; margin-bottom: 5px; }
.ebook-property-grid .property-field input, .ebook-property-grid .property-field select { width: 100%; }
.ebook-color-control { display: flex; align-items: center; gap: 8px; color: var(--library-muted); font-size: 11px; }
.ebook-color-control > span { flex: 0 0 58px; }
.ebook-swatches { display: flex; flex: 1; flex-wrap: wrap; gap: 5px; }
.ebook-swatch { position: relative; display: grid; place-items: center; width: 20px; height: 20px; padding: 0; border: 0; border-radius: 50%; background: var(--library-surface); color: var(--library-ink); font-size: 13px; line-height: 1; cursor: pointer; }
.ebook-swatch.active { outline: 2px solid var(--library-accent); outline-offset: 2px; }
.ebook-swatch.transparent { background: color-mix(in oklab, var(--library-ink) 7%, transparent); }
.ebook-color-control input[type='color'] { flex: 0 0 26px; width: 26px; height: 24px; padding: 1px; border: 0; cursor: pointer; }
.property-range { display: flex; flex-direction: column; gap: 6px; color: var(--library-muted); font-size: 11px; }
.property-range span { display: flex; justify-content: space-between; gap: 8px; }
.property-range b { color: var(--library-ink); font-weight: 600; }
.property-range input[type='range'] { width: 100%; accent-color: var(--library-accent); cursor: pointer; }
.ebook-property-row { flex-wrap: wrap; }
.property-field { display: flex; align-items: center; justify-content: space-between; gap: 10px; color: var(--library-muted); font-size: 11px; }
.property-field input, .property-field select, .property-field textarea { min-width: 0; flex: 1; padding: 7px 8px; border: 0; border-radius: 8px; outline: 0; color: var(--library-ink); background: color-mix(in oklab, var(--library-ink) 6%, transparent); font: inherit; }
.property-field input[type='color'] { flex: 0 0 32px; width: 32px; height: 25px; padding: 2px; cursor: pointer; }
.property-field textarea { resize: vertical; line-height: 1.4; }
.ebook-gallery-item { display: inline-flex; width: calc(50% - 4px); aspect-ratio: 1; margin: 0 6px 8px 0; padding: 0; overflow: hidden; border: 0; border-radius: 8px; background: color-mix(in oklab, var(--library-ink) 6%, transparent); cursor: pointer; vertical-align: top; }
.ebook-gallery-item:nth-child(2n) { margin-right: 0; }
.ebook-gallery-item img, .ebook-upload-grid img { width: 100%; height: 100%; object-fit: cover; }
.ebook-upload-button { display: flex; align-items: center; justify-content: center; gap: 7px; width: 100%; min-height: 44px; margin-bottom: 14px; border: 0; border-radius: 10px; color: var(--library-ink); background: color-mix(in oklab, var(--library-accent) 12%, transparent); font-size: 11px; cursor: pointer; }
.ebook-upload-button:disabled { opacity: .55; cursor: wait; }
.ebook-upload-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.ebook-upload-grid button { aspect-ratio: 1; padding: 0; overflow: hidden; border: 0; border-radius: 7px; background: transparent; cursor: pointer; }
.ebook-page-list-mini { display: flex; flex-direction: column; gap: 4px; }
.ebook-page-list-mini button { display: flex; align-items: center; gap: 7px; min-width: 0; padding: 8px 7px; border: 0; border-radius: 9px; color: var(--library-ink); background: transparent; text-align: left; cursor: pointer; }
.ebook-page-list-mini button:hover, .ebook-page-list-mini button.active { background: color-mix(in oklab, var(--library-accent) 11%, transparent); }
.ebook-page-list-mini button > span { display: grid; place-items: center; flex: 0 0 22px; width: 22px; height: 22px; border-radius: 50%; color: var(--library-accent); background: color-mix(in oklab, var(--library-accent) 12%, transparent); font-size: 10px; }
.ebook-page-list-mini strong { flex: 1; overflow: hidden; font-size: 11px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.ebook-page-list-mini .hidden { opacity: .45; }
.ebook-template-row { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-top: 0; }
.ebook-template-row button { display: flex; min-width: 0; min-height: 60px; align-items: stretch; flex-direction: column; justify-content: space-between; gap: 7px; padding: 7px; border: 0; border-radius: 10px; color: var(--library-ink); background: color-mix(in oklab, var(--library-ink) 5%, transparent); cursor: pointer; }
.ebook-template-row button:hover { background: color-mix(in oklab, var(--library-accent) 12%, transparent); }
.ebook-template-row strong { overflow: hidden; font-size: 10px; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
.template-swatch { display: block; width: 100%; height: 24px; border-radius: 7px; }
.swatch-cream { background: #f8f2e8; }
.swatch-slate { background: #dce5e0; }
.swatch-white { background: #fff; }
.ebook-canvas-area { display: flex; flex: 1; min-width: 0; min-height: 0; flex-direction: column; background: color-mix(in oklab, var(--library-ink) 4%, var(--library-surface)); }
.ebook-canvas-toolbar { display: flex; align-items: center; justify-content: space-between; min-height: 48px; padding: 0 20px; color: var(--library-muted); font-size: 11px; }
.ebook-stage-scroll { flex: 1; min-height: 0; overflow: auto; padding: 18px 24px 78px; background: color-mix(in oklab, var(--library-ink) 3%, var(--library-surface)); }
.ebook-stage { width: min(100%, 760px); margin: 0 auto; transform-origin: top center; }
.ebook-page-list { display: flex; flex-direction: column; align-items: center; gap: 24px; }
.ebook-page-item { position: relative; width: min(100%, 650px); }
.ebook-page-item.hidden { opacity: .45; }
.ebook-page-label { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 27px; margin-bottom: 6px; color: var(--library-muted); font-size: 10px; }
.ebook-page-label > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ebook-page-actions { display: flex; gap: 2px; opacity: .45; }
.ebook-page-item:hover .ebook-page-actions, .ebook-page-item.active .ebook-page-actions { opacity: 1; }
.ebook-page-actions button { display: grid; place-items: center; width: 25px; height: 25px; padding: 0; border: 0; border-radius: 50%; color: var(--library-ink); background: transparent; cursor: pointer; }
.ebook-page-actions button:hover { color: var(--library-accent); background: color-mix(in oklab, var(--library-accent) 12%, transparent); }
.ebook-page-actions button:disabled { opacity: .3; cursor: default; }
.ebook-context-menu { position: fixed; z-index: 80; display: flex; min-width: 180px; flex-direction: column; gap: 2px; padding: 7px; border-radius: 12px; background: var(--library-surface); color: var(--library-ink); }
.ebook-context-menu button { width: 100%; padding: 8px 10px; border: 0; border-radius: 8px; color: inherit; background: transparent; font: inherit; font-size: 11px; text-align: left; cursor: pointer; }
.ebook-context-menu button:hover { background: color-mix(in oklab, var(--library-accent) 12%, transparent); }
.ebook-context-menu button.danger { color: #8e3d35; }
.ebook-canvas-footer { display: flex; align-items: center; justify-content: space-between; min-height: 48px; padding: 0 18px; color: var(--library-muted); font-size: 11px; background: var(--library-surface); }
.ebook-canvas-footer > div:first-child { gap: 4px; }
.ebook-request-state { display: flex; flex: 1; align-items: center; justify-content: center; color: var(--library-muted); font-size: 13px; }
.ebook-request-state.error { flex-direction: column; gap: 12px; }
.ebook-request-state.error button { padding: 8px 13px; border: 0; border-radius: 9999px; color: var(--library-surface); background: var(--library-ink); cursor: pointer; }
.ebook-hidden-input { display: none; }
.ebook-toast { position: fixed; right: 22px; bottom: 22px; z-index: 40; max-width: min(360px, calc(100vw - 32px)); padding: 10px 14px; border-radius: 10px; color: #fff; background: var(--library-ink); font-size: 12px; }
.ebook-toast.error { background: #7b3631; }
.ebook-toast-enter-active, .ebook-toast-leave-active { transition: opacity .18s ease, transform .18s ease; }
.ebook-toast-enter-from, .ebook-toast-leave-to { opacity: 0; transform: translateY(7px); }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
@media (max-width: 900px) { .ebook-inspector { flex-basis: 220px; }.ebook-header { padding-inline: 18px; } }
@media (max-width: 700px) { .ebook-tool-rail { flex-basis: 58px; padding-inline: 4px; }.ebook-tool-button { width: 50px; min-height: 48px; }.ebook-tool-button span { font-size: 9px; }.ebook-inspector { position: absolute; top: 60px; bottom: 0; left: 58px; z-index: 10; width: 245px; }.ebook-header-actions .ebook-action-button { display: none; }.ebook-name-input { max-width: 190px; }.ebook-stage-scroll { padding-inline: 12px; } }
@media print { .ebook-studio-layout { display: block; height: auto; overflow: visible; background: #fff; }.ebook-header, .ebook-tool-rail, .ebook-inspector, .ebook-canvas-toolbar, .ebook-canvas-footer, .ebook-page-label, .ebook-context-menu, .ebook-toast, .ebook-preview-shell { display: none !important; }.ebook-studio-main, .ebook-workspace, .ebook-canvas-area, .ebook-stage-scroll { display: block; height: auto; overflow: visible; padding: 0; background: #fff; }.ebook-stage { width: 100%; transform: none !important; }.ebook-page-list { gap: 0; }.ebook-page-item { width: 100%; break-after: page; }.ebook-page { aspect-ratio: 1410 / 2250; break-inside: avoid; }.ebook-element.selected { background: transparent; }.element-handle, .element-drag-strip { display: none; } }
</style>

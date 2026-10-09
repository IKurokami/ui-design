<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  ArrowLeft,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Heading1,
  Heading2,
  Quote,
  List,
  ListOrdered,
  Image as ImageIcon,
  Check,
  Undo,
  Redo,
  Upload,
  Star,
  Loader2,
  X,
  Plus,
  Trash2,
  PenTool,
  Layers,
  Search,
  Minus,
  Pilcrow,
  AlertTriangle,
  Crop,
} from '@lucide/vue'
import LibrarySidebar from './LibrarySidebar.vue'
import CollectionDeckCard from './CollectionDeckCard.vue'
import ImageCropDialog from './ImageCropDialog.vue'
import UnsavedChangesDialog from './UnsavedChangesDialog.vue'
import { storyToDeck } from '../story-mapping'
import { createApiClient } from '../../../services/api-client'
import { friendlyError } from '../../../services/error-handler'
import { usePageScrollRestoration } from '../../../animations/composables/usePageScrollRestoration'
import { useAuthStore } from '../../../stores/auth.store'
import { updateBookshelfStory } from '../bookshelf-state'
import type { Chapter, Story } from '../types'
import '../library-theme.css'

const props = defineProps<{
  initialStory?: Story | null
}>()

const emit = defineEmits<{
  close: []
  saved: [story: Story]
}>()

const router = useRouter()
const route = useRoute()
const client = createApiClient()
const authStore = useAuthStore()
type EditMotionSeed = { id: string; userId?: string; title?: string; coverUrl?: string; category?: string; tags?: string; status?: string }
const editMotionSeed = (() => {
  if (!route.params.id) return undefined
  try {
    const raw = sessionStorage.getItem('moc:editor-motion')
    sessionStorage.removeItem('moc:editor-motion')
    if (!raw) return undefined
    const seed = JSON.parse(raw) as EditMotionSeed
    return seed.id === String(route.params.id) ? seed : undefined
  } catch { return undefined }
})()
const isLoading = ref(false)
const loadError = ref('')
const scrollArea = ref<HTMLElement>()
usePageScrollRestoration('writing', scrollArea, computed(() => !isLoading.value && !loadError.value))
const storyOwnerId = ref(props.initialStory?.userId || editMotionSeed?.userId || '')
const canEdit = computed(() => !storyData.id || storyOwnerId.value === authStore.user?.id || authStore.user?.role === 'admin' || authStore.user?.role === 'moderator')
const chapterToDelete = ref<Chapter | null>(null)
const isDeletingChapter = ref(false)
const deleteError = ref('')
const deleteCancel = ref<HTMLButtonElement>()
let deleteTrigger: HTMLElement | null = null
let loadRevision = 0
let hasLoadedStory = false
const canMutate = computed(() => canEdit.value && !isLoading.value && !loadError.value && !isSaving.value && !isDeletingChapter.value && !isApplyingCrop.value)
const statusOptions = [
  { value: 'draft', label: 'Bản nháp' },
  { value: 'published', label: 'Đang ra' },
  { value: 'completed', label: 'Hoàn thành' },
]

// Active Workspace Tab: 'editor' (Soạn thảo) | 'chapters' (Quản lý chương) | 'images' (Kho ảnh truyện)
const activeTab = ref<'editor' | 'chapters' | 'images'>('editor')

// Form state
const storyData = reactive({
  id: props.initialStory?.id || editMotionSeed?.id || '',
  title: props.initialStory?.title || editMotionSeed?.title || '',
  description: props.initialStory?.description || '',
  coverUrl: props.initialStory?.coverUrl || editMotionSeed?.coverUrl || '',
  category: props.initialStory?.category || editMotionSeed?.category || '',
  tags: props.initialStory?.tags || editMotionSeed?.tags || '',
  status: props.initialStory?.status || editMotionSeed?.status || 'published',
})

// Chapters list
function newChapter(chapterNumber: number): Chapter {
  return { id: '', storyId: storyData.id, chapterNumber, title: 'Chương ' + chapterNumber, content: '', illustrations: '[]' }
}
const chapters = ref<Chapter[]>(props.initialStory ? (props.initialStory.chapters || []).map(chapter => ({ ...chapter })) : [newChapter(1)])
const activeChapterIndex = ref(0)

const activeChapter = computed(() => {
  if (chapters.value.length === 0) return null
  return chapters.value[activeChapterIndex.value] || chapters.value[0]
})

// Media Gallery: contains all images found in story chapters + uploaded
const storyGallery = ref<string[]>([])

const editorRef = ref<HTMLDivElement>()
const imageInputRef = ref<HTMLInputElement>()
const coverInputRef = ref<HTMLInputElement>()
const galleryInputRef = ref<HTMLInputElement>()

const isSaving = ref(false)
const isUploadingImage = ref(false)
const isUploadingCover = ref(false)
const isUploadingGallery = ref(false)
const savedRange = ref<Range | null>(null)

// Selected image in editor for floating action toolbar (xóa ảnh, đặt làm bìa)
const selectedImage = ref<{ el: HTMLImageElement; src: string; top: number; left: number } | null>(null)
const cropTarget = ref<{ src: string; scope: 'cover' | 'all' }>()
const isApplyingCrop = ref(false)
const savedSnapshot = ref('')
const contentSnapshotCache = new WeakMap<Chapter, { source: string; html: string; images: string[] }>()
function snapshot() {
  return JSON.stringify({
    metadata: { title: storyData.title, description: storyData.description, coverUrl: storyData.coverUrl, category: storyData.category, tags: storyData.tags, status: storyData.status },
    chapters: chapters.value.map(chapter => {
      // Browser HTML normalization alone is not an unsaved edit.
      let content = contentSnapshotCache.get(chapter)
      if (!content || content.source !== chapter.content) {
        const template = document.createElement('template')
        template.innerHTML = chapter.content
        content = { source: chapter.content, html: template.innerHTML, images: [...template.content.querySelectorAll('img[src]')].map(image => image.getAttribute('src')!).filter(Boolean) }
        contentSnapshotCache.set(chapter, content)
      }
      return { id: chapter.id, chapterNumber: chapter.chapterNumber, title: chapter.title, content: content.html, illustrations: [...new Set([...illustrationUrls(chapter), ...content.images])] }
    }),
  })
}
const hasUnsavedChanges = computed(() => !!savedSnapshot.value && snapshot() !== savedSnapshot.value)
const hasPendingWrite = computed(() => isSaving.value || isDeletingChapter.value || isApplyingCrop.value || isUploadingImage.value || isUploadingCover.value || isUploadingGallery.value)
const showUnsavedDialog = ref(false)
const leaveError = ref('')
let pendingLeave: Promise<boolean> | undefined
let resolveLeave: ((leave: boolean) => void) | undefined
let approvedLeaveSnapshot = ''
function finishLeave(leave: boolean) {
  if (leave) approvedLeaveSnapshot = snapshot()
  showUnsavedDialog.value = false
  leaveError.value = ''
  resolveLeave?.(leave)
  resolveLeave = undefined
  pendingLeave = undefined
}
async function requestLeave(): Promise<boolean> {
  if (pendingLeave) return pendingLeave
  if (hasPendingWrite.value) { showToast('Đang lưu hoặc tải ảnh. Vui lòng đợi hoàn tất trước khi thoát.', 'error'); return false }
  cropTarget.value = undefined
  chapterToDelete.value = null
  if (canEdit.value && !isLoading.value && !loadError.value && editorRef.value && activeChapter.value) {
    const content = document.createElement('template')
    content.innerHTML = activeChapter.value.content
    if (content.innerHTML !== editorRef.value.innerHTML) syncCurrentChapterContent()
  }
  if (approvedLeaveSnapshot === snapshot()) return true
  if (!hasUnsavedChanges.value) return true
  leaveError.value = ''
  showUnsavedDialog.value = true
  pendingLeave = new Promise(resolve => { resolveLeave = resolve })
  return pendingLeave
}
async function saveAndLeave() {
  if (isSaving.value) return
  if (await handleSaveStory(false)) finishLeave(true)
  else leaveError.value = 'Chưa lưu được truyện. ' + toast.message + ' Các thay đổi vẫn còn trong editor.'
}
function beforeUnload(event: BeforeUnloadEvent) {
  if (!hasUnsavedChanges.value && !hasPendingWrite.value) return
  event.preventDefault()
  event.returnValue = ''
}
watch([hasUnsavedChanges, hasPendingWrite], ([dirty, pending]) => {
  if (dirty || pending) window.addEventListener('beforeunload', beforeUnload)
  else window.removeEventListener('beforeunload', beforeUnload)
}, { immediate: true, flush: 'sync' })
const removeLeaveGuard = router.beforeEach?.((to, from) => {
  if (!/^\/library\/editor(?:\/|$)/.test(from.path) || to.path === from.path) return true
  return requestLeave()
})
const removeLeaveAfter = router.afterEach?.(() => { approvedLeaveSnapshot = '' })
const libraryPreview = computed(() => storyToDeck({ ...storyData, userId: storyOwnerId.value, chapters: [...chapters.value].sort((a, b) => a.chapterNumber - b.chapterNumber) }))
const cropDescription = computed(() => {
  if (cropTarget.value?.scope === 'cover') return 'Chỉ thay ảnh bìa. Ảnh trong các chương được giữ nguyên. Lưu truyện để lưu thay đổi.'
  const count = getImageChapters(cropTarget.value?.src ?? '').length
  const places = [count ? `${count} chương` : '', storyData.coverUrl === cropTarget.value?.src ? 'ảnh bìa' : ''].filter(Boolean)
  return places.length ? `Ảnh đã cắt sẽ thay ảnh này trong ${places.join(' và ')}. Lưu truyện để lưu thay đổi.` : 'Lưu truyện để lưu ảnh đã cắt.'
})
function openCrop(src: string, scope: 'cover' | 'all') {
  if (!canMutate.value || !src) return
  syncCurrentChapterContent()
  cropTarget.value = { src, scope }
  selectedImage.value = null
}
async function applyCroppedImage(file: File) {
  const target = cropTarget.value
  if (!target || !canMutate.value) throw new Error('Chưa thể chỉnh sửa ảnh lúc này.')
  const revision = loadRevision
  isApplyingCrop.value = true
  try {
    const url = await uploadFile(file)
    if (revision !== loadRevision || cropTarget.value !== target) return
    if (target.scope === 'cover') {
      storyData.coverUrl = url
      if (!storyGallery.value.includes(url)) storyGallery.value.unshift(url)
    } else {
      for (const chapter of chapters.value) {
        const content = document.createElement('template')
        content.innerHTML = chapter.content
        content.content.querySelectorAll('img').forEach(image => {
          if (image.getAttribute('src') === target.src) image.setAttribute('src', url)
        })
        chapter.content = content.innerHTML
        chapter.illustrations = JSON.stringify(illustrationUrls(chapter).map(source => source === target.src ? url : source))
      }
      storyGallery.value = [...new Set(storyGallery.value.map(source => source === target.src ? url : source))]
      if (storyData.coverUrl === target.src) storyData.coverUrl = url
      if (editorRef.value) editorRef.value.innerHTML = activeChapter.value?.content ?? ''
      savedRange.value = null
    }
    showToast('Đã cắt ảnh. Lưu truyện để lưu thay đổi.')
  } finally { isApplyingCrop.value = false }
}

// Notion Slash Command Menu
const slashMenu = reactive({
  isOpen: false,
  query: '',
  selectedIndex: 0,
  top: 0,
  left: 0,
})

// Quick Image Search & Insert Picker Modal
const showImagePickerModal = ref(false)
const imagePickerSearch = ref('')

// Toast notification
const toast = reactive({
  show: false,
  message: '',
  type: 'success' as 'success' | 'error',
  timeoutId: undefined as ReturnType<typeof setTimeout> | undefined,
})

function showToast(message: string, type: 'success' | 'error' = 'success') {
  clearTimeout(toast.timeoutId)
  toast.message = message
  toast.type = type
  toast.show = true
  toast.timeoutId = setTimeout(() => {
    toast.show = false
  }, 2500)
}

onBeforeUnmount(() => {
  loadRevision++
  clearTimeout(toast.timeoutId)
  window.removeEventListener('beforeunload', beforeUnload)
  removeLeaveGuard?.()
  removeLeaveAfter?.()
  finishLeave(false)
})
function illustrationUrls(chapter: Chapter): string[] {
  try {
    const urls: unknown = JSON.parse(chapter.illustrations || '[]')
    return Array.isArray(urls) ? urls.filter((url): url is string => typeof url === 'string' && !!url) : []
  } catch { return [] }
}
function rebuildGallery() {
  const urls = new Set<string>([storyData.coverUrl].filter(Boolean))
  for (const chapter of chapters.value) {
    illustrationUrls(chapter).forEach(url => urls.add(url))
    const content = document.createElement('div')
    content.innerHTML = chapter.content
    content.querySelectorAll('img').forEach(image => { const url = image.getAttribute('src'); if (url) urls.add(url) })
  }
  storyGallery.value = [...urls]
}

// Lưu vùng chọn con trỏ trước khi mở popup tải ảnh
function saveSelection() {
  const sel = window.getSelection()
  if (sel && sel.rangeCount > 0) {
    savedRange.value = sel.getRangeAt(0)
  }
}

function restoreSelection() {
  const sel = window.getSelection()
  if (sel && savedRange.value) {
    sel.removeAllRanges()
    sel.addRange(savedRange.value)
  }
}

// Block State & Formatting
const activeBlockTag = ref<string>('p')
const activeFormats = reactive({
  bold: false,
  italic: false,
  underline: false,
  strikeThrough: false,
})

function getCurrentBlockElement(): HTMLElement | null {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0 || !editorRef.value) return null
  let node: Node | null = sel.getRangeAt(0).startContainer
  while (node && node !== editorRef.value) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement
      const tag = el.tagName.toLowerCase()
      if (['blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'pre', 'div'].includes(tag)) {
        return el
      }
    }
    node = node.parentNode
  }
  return null
}

function setCursorToEnd(el: HTMLElement) {
  try {
    const range = document.createRange()
    const sel = window.getSelection()
    range.selectNodeContents(el)
    range.collapse(false)
    sel?.removeAllRanges()
    sel?.addRange(range)
    el.focus()
    saveSelection()
  } catch {}
}

function updateActiveFormats() {
  if (!editorRef.value) return
  const currentBlock = getCurrentBlockElement()
  activeBlockTag.value = currentBlock ? currentBlock.tagName.toLowerCase() : 'p'
  try {
    activeFormats.bold = document.queryCommandState('bold')
    activeFormats.italic = document.queryCommandState('italic')
    activeFormats.underline = document.queryCommandState('underline')
    activeFormats.strikeThrough = document.queryCommandState('strikeThrough')
  } catch {}
}

// Format Commands
function exec(command: string, value: string | undefined = undefined) {
  if (!canMutate.value) return
  editorRef.value?.focus()
  document.execCommand(command, false, value)
  syncCurrentChapterContent()
  updateActiveFormats()
}

function setBlock(tag: string) {
  if (!canMutate.value) return
  editorRef.value?.focus()
  const cleanTag = tag.replace(/[<>]/g, '').toLowerCase()
  const currentBlock = getCurrentBlockElement()

  // 1. Nhấp lại vào khối hiện tại -> HỦY ĐỊNH DẠNG (Toggle) chuyển về đoạn văn <p>
  if (currentBlock && currentBlock.tagName.toLowerCase() === cleanTag) {
    if (cleanTag === 'blockquote') {
      const p = document.createElement('p')
      p.innerHTML = currentBlock.innerHTML.trim() || '<br>'
      currentBlock.parentNode?.replaceChild(p, currentBlock)
      setCursorToEnd(p)
      syncCurrentChapterContent()
      updateActiveFormats()
      return
    } else {
      document.execCommand('formatBlock', false, '<p>')
      syncCurrentChapterContent()
      updateActiveFormats()
      return
    }
  }

  // 2. Chuyển rõ ràng về văn bản thường <p>
  if (cleanTag === 'p') {
    if (currentBlock && currentBlock.tagName.toLowerCase() === 'blockquote') {
      const p = document.createElement('p')
      p.innerHTML = currentBlock.innerHTML.trim() || '<br>'
      currentBlock.parentNode?.replaceChild(p, currentBlock)
      setCursorToEnd(p)
    } else {
      document.execCommand('formatBlock', false, '<p>')
    }
    syncCurrentChapterContent()
    updateActiveFormats()
    return
  }

  // 3. Chuyển sang thẻ mới
  if (cleanTag === 'blockquote') {
    document.execCommand('formatBlock', false, '<blockquote>')
  } else {
    document.execCommand('formatBlock', false, tag)
  }
  syncCurrentChapterContent()
  updateActiveFormats()
}

// Quét toàn bộ ảnh trong nội dung chương hiện tại và cập nhật kho ảnh
function scanImages(autoCover = true) {
  if (!editorRef.value) return
  const imgs = editorRef.value.querySelectorAll('img')
  const chapterImages: string[] = []
  imgs.forEach(img => {
    const src = img.getAttribute('src')
    if (src && !chapterImages.includes(src)) {
      chapterImages.push(src)
    }
  })

  // Thêm vào storyGallery nếu chưa có
  chapterImages.forEach(url => {
    if (!storyGallery.value.includes(url)) {
      storyGallery.value.push(url)
    }
  })

  // Tự động: Nếu truyện chưa có ảnh bìa và có ảnh trong bài viết, tự động gán ảnh đầu tiên làm ảnh bìa truyện!
  if (autoCover && !storyData.coverUrl && chapterImages.length > 0) {
    storyData.coverUrl = chapterImages[0]
  }

  if (activeChapter.value) {
    activeChapter.value.illustrations = JSON.stringify([...new Set([...illustrationUrls(activeChapter.value), ...chapterImages])])
  }
}

function syncCurrentChapterContent(autoCover = true) {
  if (activeChapter.value && editorRef.value) {
    activeChapter.value.content = editorRef.value.innerHTML
  }
  scanImages(autoCover)
}

// Chuyển đổi chương đang soạn thảo
function switchChapter(index: number) {
  syncCurrentChapterContent(false)
  activeChapterIndex.value = index
  if (editorRef.value && activeChapter.value) {
    editorRef.value.innerHTML = activeChapter.value.content || ''
    scanImages(false)
  }
  activeTab.value = 'editor'
}

// Thêm chương mới
function addNewChapter() {
  if (!canMutate.value) return
  syncCurrentChapterContent()
  const newNum = Math.max(0, ...chapters.value.map(chapter => chapter.chapterNumber)) + 1
  const newCh = newChapter(newNum)
  chapters.value.push(newCh)
  activeChapterIndex.value = chapters.value.length - 1
  if (editorRef.value) {
    editorRef.value.innerHTML = newCh.content
  }
  showToast(`Đã tạo Chương ${newNum}!`)
  activeTab.value = 'editor'
}

async function deleteChapter(index: number) {
  if (!canMutate.value) return
  syncCurrentChapterContent()
  deleteTrigger = document.activeElement as HTMLElement | null
  chapterToDelete.value = chapters.value[index] ?? null
  deleteError.value = ''
  await nextTick()
  deleteCancel.value?.focus()
}
function closeDeleteChapter() {
  if (isDeletingChapter.value) return
  chapterToDelete.value = null
  deleteError.value = ''
  deleteTrigger?.focus()
}
function onDeleteKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') { event.preventDefault(); closeDeleteChapter() }
  if (event.key === 'Tab') {
    const buttons = [...(event.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>('button:not(:disabled)')]
    const first = buttons[0], last = buttons.at(-1)
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
  }
}
async function confirmDeleteChapter() {
  const chapter = chapterToDelete.value
  if (!chapter || isDeletingChapter.value || isSaving.value) return
  isDeletingChapter.value = true
  deleteError.value = ''
  try {
    if (chapter.id) await client.request('/api/chapters/' + encodeURIComponent(chapter.id), { method: 'DELETE' })
    if (chapter.id && savedSnapshot.value) {
      const baseline = JSON.parse(savedSnapshot.value)
      baseline.chapters = baseline.chapters.filter((saved: { id: string }) => saved.id !== chapter.id)
      savedSnapshot.value = JSON.stringify(baseline)
    }
    const index = chapters.value.indexOf(chapter)
    if (index !== -1) {
      const selected = activeChapter.value
      chapters.value.splice(index, 1)
      const selectedIndex = selected ? chapters.value.indexOf(selected) : -1
      activeChapterIndex.value = selectedIndex >= 0 ? selectedIndex : Math.max(0, Math.min(index, chapters.value.length - 1))
    }
    rebuildGallery()
    chapterToDelete.value = null
    await nextTick()
    if (editorRef.value) { editorRef.value.innerHTML = activeChapter.value?.content || '' }
    showToast('Đã xóa ' + chapter.title)
    if (deleteTrigger?.isConnected) deleteTrigger.focus()
    else document.querySelector<HTMLButtonElement>('.chapter-add-chip')?.focus()
  } catch (error) {
    deleteError.value = friendlyError(error)
  } finally {
    isDeletingChapter.value = false
  }
}

// Đặt ảnh bất kỳ làm ảnh bìa truyện
function setAsCover(url: string) {
  if (!canMutate.value) return
  storyData.coverUrl = url
  showToast('Đã chọn làm ảnh bìa truyện!')
}

function removeCover() {
  if (!canMutate.value) return
  storyData.coverUrl = ''
}

// Chèn ảnh từ Kho ảnh vào vị trí con trỏ trong văn bản
function insertImageFromGallery(url: string) {
  if (!canMutate.value) return
  if (!activeChapter.value) addNewChapter()
  activeTab.value = 'editor'
  setTimeout(() => {
    insertImageAtCursor(url)
    showToast('Đã chèn ảnh vào chương!')
  }, 50)
}

// Kích hoạt upload ảnh chèn vào văn bản
function triggerInsertImage() {
  if (!canMutate.value) return
  if (!activeChapter.value) addNewChapter()
  saveSelection()
  imageInputRef.value?.click()
}

// Upload file trực tiếp lên backend
async function uploadFile(file: File): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await client.request<{ url: string }>('/api/upload', {
    method: 'POST',
    body: formData,
  })
  return res.url
}

// Xử lý khi chọn ảnh để chèn vào văn bản
async function handleImageSelected(e: Event) {
  if (!canMutate.value) return
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  isUploadingImage.value = true
  try {
    const url = await uploadFile(file)
    if (!storyGallery.value.includes(url)) {
      storyGallery.value.push(url)
    }
    insertImageAtCursor(url)
    showToast('Đã chèn ảnh vào văn bản!')
  } catch (err: any) {
    showToast(err.message || 'Lỗi tải ảnh', 'error')
  } finally {
    isUploadingImage.value = false
    target.value = ''
  }
}

// Chèn node ảnh vào vị trí con trỏ
function insertImageAtCursor(url: string) {
  editorRef.value?.focus()
  restoreSelection()

  const imgHtml = `<p><img src="${url}" alt="Minh họa truyện" class="content-img" /></p><p><br></p>`
  document.execCommand('insertHTML', false, imgHtml)
  syncCurrentChapterContent()
}

// Upload ảnh bìa trực tiếp
async function handleCoverSelected(e: Event) {
  if (!canMutate.value) return
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  isUploadingCover.value = true
  try {
    const url = await uploadFile(file)
    storyData.coverUrl = url
    if (!storyGallery.value.includes(url)) {
      storyGallery.value.push(url)
    }
    showToast('Đã cập nhật ảnh bìa truyện!')
  } catch (err: any) {
    showToast(err.message || 'Lỗi tải ảnh bìa', 'error')
  } finally {
    isUploadingCover.value = false
    target.value = ''
  }
}

// Upload ảnh vào kho ảnh (Gallery)
async function handleGallerySelected(e: Event) {
  if (!canMutate.value) return
  if (!activeChapter.value) addNewChapter()
  const target = e.target as HTMLInputElement
  const files = target.files
  if (!files || files.length === 0) return

  isUploadingGallery.value = true
  try {
    for (let i = 0; i < files.length; i++) {
      const url = await uploadFile(files[i])
      if (!storyGallery.value.includes(url)) {
        storyGallery.value.push(url)
      }
      if (activeChapter.value) activeChapter.value.illustrations = JSON.stringify([...new Set([...illustrationUrls(activeChapter.value), url])])
      if (!storyData.coverUrl) {
        storyData.coverUrl = url
      }
    }
    showToast(`Đã thêm ${files.length} ảnh vào kho!`)
  } catch (err: any) {
    showToast(err.message || 'Lỗi tải ảnh vào kho', 'error')
  } finally {
    isUploadingGallery.value = false
    target.value = ''
  }
}

// Paste ảnh trực tiếp từ clipboard
async function handlePaste(e: ClipboardEvent) {
  if (!canMutate.value) return
  const items = e.clipboardData?.items
  if (!items) return

  for (let i = 0; i < items.length; i++) {
    if (items[i].type.indexOf('image') !== -1) {
      e.preventDefault()
      const file = items[i].getAsFile()
      if (file) {
        isUploadingImage.value = true
        try {
          const url = await uploadFile(file)
          if (!storyGallery.value.includes(url)) {
            storyGallery.value.push(url)
          }
          insertImageAtCursor(url)
          showToast('Đã dán ảnh từ clipboard!')
        } catch {
          showToast('Không thể dán ảnh', 'error')
        } finally {
          isUploadingImage.value = false
        }
      }
      break
    }
  }
}

// Xử lý kéo thả ảnh (Drag & Drop) vào trình soạn thảo & ảnh bìa
const isDraggingOver = ref(false)

function handleEditorDragOver(e: DragEvent) {
  e.preventDefault()
  if (e.dataTransfer && e.dataTransfer.types.includes('Files')) {
    isDraggingOver.value = true
  }
}

function handleEditorDragLeave(e: DragEvent) {
  const rect = editorRef.value?.getBoundingClientRect()
  if (rect) {
    if (
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom
    ) {
      isDraggingOver.value = false
    }
  } else {
    isDraggingOver.value = false
  }
}

async function handleEditorDrop(e: DragEvent) {
  if (!canMutate.value) return
  e.preventDefault()
  isDraggingOver.value = false

  const files = e.dataTransfer?.files
  if (!files || files.length === 0) return

  const imageFiles: File[] = []
  for (let i = 0; i < files.length; i++) {
    if (files[i].type.startsWith('image/')) {
      imageFiles.push(files[i])
    }
  }

  if (imageFiles.length === 0) return

  // Định vị con trỏ tại vị trí thả ảnh nếu trình duyệt hỗ trợ
  try {
    if (document.caretRangeFromPoint) {
      const range = document.caretRangeFromPoint(e.clientX, e.clientY)
      if (range) {
        const sel = window.getSelection()
        sel?.removeAllRanges()
        sel?.addRange(range)
        saveSelection()
      }
    } else if ((document as any).caretPositionFromPoint) {
      const pos = (document as any).caretPositionFromPoint(e.clientX, e.clientY)
      if (pos) {
        const range = document.createRange()
        range.setStart(pos.offsetNode, pos.offset)
        range.collapse(true)
        const sel = window.getSelection()
        sel?.removeAllRanges()
        sel?.addRange(range)
        saveSelection()
      }
    }
  } catch {}

  isUploadingImage.value = true
  try {
    for (const file of imageFiles) {
      const url = await uploadFile(file)
      if (!storyGallery.value.includes(url)) {
        storyGallery.value.push(url)
      }
      insertImageAtCursor(url)
    }
    showToast(`Đã thêm ${imageFiles.length} ảnh kéo thả vào chương!`)
  } catch (err: any) {
    showToast(err.message || 'Lỗi tải ảnh kéo thả', 'error')
  } finally {
    isUploadingImage.value = false
  }
}

async function handleCoverDrop(e: DragEvent) {
  if (!canMutate.value) return
  e.preventDefault()
  const files = e.dataTransfer?.files
  if (!files || files.length === 0) return
  const file = files[0]
  if (!file.type.startsWith('image/')) return

  isUploadingCover.value = true
  try {
    const url = await uploadFile(file)
    storyData.coverUrl = url
    if (!storyGallery.value.includes(url)) {
      storyGallery.value.push(url)
    }
    showToast('Đã cập nhật ảnh bìa bằng kéo thả!')
  } catch (err: any) {
    showToast(err.message || 'Lỗi tải ảnh bìa', 'error')
  } finally {
    isUploadingCover.value = false
  }
}

// Tra cứu danh sách các chương đang dùng ảnh này
function getImageChapters(url: string) {
  const result: { index: number; chapterNumber: number; title: string }[] = []
  chapters.value.forEach((ch, idx) => {
    const inContent = ch.content && ch.content.includes(url)
    const inIllustrations = ch.illustrations && ch.illustrations.includes(url)
    if (inContent || inIllustrations) {
      result.push({
        index: idx,
        chapterNumber: ch.chapterNumber,
        title: ch.title || `Chương ${ch.chapterNumber}`,
      })
    }
  })
  return result
}

// Xóa ảnh khỏi kho ảnh và gỡ bỏ khỏi toàn bộ các chương
function deleteImageFromGallery(url: string) {
  if (!canMutate.value) return
  storyGallery.value = storyGallery.value.filter(u => u !== url)

  chapters.value.forEach(ch => {
    if (ch.content && ch.content.includes(url)) {
      const temp = document.createElement('div')
      temp.innerHTML = ch.content
      const imgs = temp.querySelectorAll(`img[src="${url}"]`)
      imgs.forEach(img => {
        const p = img.parentElement
        if (p && p.tagName === 'P' && p.children.length === 1 && !p.textContent?.trim()) {
          p.remove()
        } else {
          img.remove()
        }
      })
      ch.content = temp.innerHTML
    }
    if (ch.illustrations && ch.illustrations.includes(url)) {
      try {
        const list = JSON.parse(ch.illustrations)
        if (Array.isArray(list)) {
          ch.illustrations = JSON.stringify(list.filter((u: string) => u !== url))
        }
      } catch {}
    }
  })

  if (editorRef.value && activeChapter.value) {
    editorRef.value.innerHTML = activeChapter.value.content || ''
  }

  if (storyData.coverUrl === url) {
    storyData.coverUrl = storyGallery.value[0] || ''
  }

  showToast('Đã xóa ảnh khỏi kho và các chương!')
}

// Nhấp vào ảnh bất kỳ trong văn bản để hiển thị toolbar hành động (xóa ảnh, đặt làm bìa)
function handleEditorClick(e: MouseEvent) {
  updateActiveFormats()
  const target = e.target as HTMLElement
  if (target.tagName === 'IMG') {
    const img = target as HTMLImageElement
    const rect = img.getBoundingClientRect()
    selectedImage.value = {
      el: img,
      src: img.getAttribute('src') || img.src,
      top: Math.max(10, rect.top - 46),
      left: Math.max(10, Math.min(rect.left, window.innerWidth - 360)),
    }
    closeSlashMenu()
    return
  }
  selectedImage.value = null
  closeSlashMenu()
}

// Xóa ảnh đang chọn khỏi chương hiện tại
function deleteSelectedImage() {
  if (!canMutate.value) return
  if (!selectedImage.value) return
  const url = selectedImage.value.src
  if (activeChapter.value) activeChapter.value.illustrations = JSON.stringify(illustrationUrls(activeChapter.value).filter(image => image !== url))
  const imgEl = selectedImage.value.el
  const parent = imgEl.parentElement
  if (parent && parent.tagName === 'P' && parent.children.length === 1 && !parent.textContent?.trim()) {
    parent.remove()
  } else {
    imgEl.remove()
  }
  selectedImage.value = null
  syncCurrentChapterContent()
  showToast('Đã xóa ảnh khỏi chương!')
}

// Đặt ảnh đang chọn trong bài làm ảnh bìa truyện
function setAsCoverFromEditor() {
  if (!canMutate.value) return
  if (!selectedImage.value) return
  storyData.coverUrl = selectedImage.value.src
  showToast('Đã chọn làm ảnh bìa truyện!')
}

// Notion-style Slash Commands
interface SlashCommand {
  id: string
  title: string
  subtitle: string
  keywords: string[]
  icon: any
  action: () => void
}

const slashCommands: SlashCommand[] = [
  {
    id: 'paragraph',
    title: 'Văn bản thường',
    subtitle: 'Đoạn văn tiêu chuẩn, thoát khỏi trích dẫn hoặc tiêu đề',
    keywords: ['p', 'paragraph', 'vanban', 'thuong', 'text', 'normal'],
    icon: Pilcrow,
    action: () => setBlock('<p>'),
  },
  {
    id: 'image-gallery',
    title: 'Tìm & chèn ảnh từ kho',
    subtitle: 'Xem toàn bộ ảnh đã upload và chèn nhanh vào chương',
    keywords: ['anh', 'image', 'gallery', 'kho', 'hinh', 'photo'],
    icon: ImageIcon,
    action: () => {
      saveSelection()
      showImagePickerModal.value = true
    },
  },
  {
    id: 'upload-image',
    title: 'Tải ảnh mới từ máy tính',
    subtitle: 'Upload ảnh từ thiết bị và chèn vào vị trí con trỏ',
    keywords: ['upload', 'tai', 'file', 'anh', 'new'],
    icon: Upload,
    action: () => {
      triggerInsertImage()
    },
  },
  {
    id: 'heading-1',
    title: 'Tiêu đề lớn (H1)',
    subtitle: 'Tiêu đề phân đoạn chính trong chương',
    keywords: ['h1', 'tieude', 'heading', 'large'],
    icon: Heading1,
    action: () => setBlock('<h2>'),
  },
  {
    id: 'heading-2',
    title: 'Tiêu đề vừa (H2)',
    subtitle: 'Tiêu đề tiểu mục, hồi, cảnh truyện',
    keywords: ['h2', 'tieude', 'heading', 'medium'],
    icon: Heading2,
    action: () => setBlock('<h3>'),
  },
  {
    id: 'quote',
    title: 'Trích dẫn',
    subtitle: 'Khối trích dẫn lời thoại hoặc câu nói nổi bật (Nhấp lại để tắt)',
    keywords: ['quote', 'trichdan', 'thoai', 'loi'],
    icon: Quote,
    action: () => setBlock('<blockquote>'),
  },
  {
    id: 'bullet-list',
    title: 'Danh sách chấm',
    subtitle: 'Liệt kê các điểm gạch đầu dòng',
    keywords: ['bullet', 'list', 'danhsach', 'cham'],
    icon: List,
    action: () => exec('insertUnorderedList'),
  },
  {
    id: 'numbered-list',
    title: 'Danh sách số',
    subtitle: 'Danh sách đánh số thứ tự liên tiếp',
    keywords: ['num', 'number', 'sothutu', 'order'],
    icon: ListOrdered,
    action: () => exec('insertOrderedList'),
  },
  {
    id: 'divider',
    title: 'Đường phân cách',
    subtitle: 'Đoạn ngắt quãng cảnh truyện',
    keywords: ['divider', 'hr', 'phancach', 'line', 'ke'],
    icon: Minus,
    action: () => exec('insertHorizontalRule'),
  },
  {
    id: 'new-chapter',
    title: 'Tạo chương mới',
    subtitle: 'Tạo và chuyển sang chương tiếp theo ngay',
    keywords: ['chuong', 'chapter', 'new', 'them'],
    icon: Plus,
    action: () => addNewChapter(),
  },
  {
    id: 'cover-set',
    title: 'Đặt ảnh bìa',
    subtitle: 'Chọn ảnh bìa đại diện cho tác phẩm',
    keywords: ['bia', 'cover', 'anhbia'],
    icon: Star,
    action: () => coverInputRef.value?.click(),
  },
]

const filteredSlashCommands = computed(() => {
  const q = slashMenu.query.toLowerCase().trim()
  if (!q) return slashCommands
  return slashCommands.filter(cmd =>
    cmd.title.toLowerCase().includes(q) ||
    cmd.subtitle.toLowerCase().includes(q) ||
    cmd.keywords.some(k => k.includes(q))
  )
})

function checkMarkdownShortcuts(e: KeyboardEvent) {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return
  const range = sel.getRangeAt(0)
  const node = range.startContainer
  if (node.nodeType !== Node.TEXT_NODE) return
  const text = node.textContent || ''
  const offset = range.startOffset
  const prefix = text.slice(0, offset).trim()

  if (prefix === '>') {
    e.preventDefault()
    node.textContent = text.slice(offset)
    setBlock('<blockquote>')
  } else if (prefix === '#') {
    e.preventDefault()
    node.textContent = text.slice(offset)
    setBlock('<h2>')
  } else if (prefix === '##') {
    e.preventDefault()
    node.textContent = text.slice(offset)
    setBlock('<h3>')
  } else if (prefix === '-' || prefix === '*') {
    e.preventDefault()
    node.textContent = text.slice(offset)
    exec('insertUnorderedList')
  } else if (prefix === '1.') {
    e.preventDefault()
    node.textContent = text.slice(offset)
    exec('insertOrderedList')
  }
}

function handleEditorKeyDown(e: KeyboardEvent) {
  if (slashMenu.isOpen) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (filteredSlashCommands.value.length > 0) {
        slashMenu.selectedIndex = (slashMenu.selectedIndex + 1) % filteredSlashCommands.value.length
      }
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (filteredSlashCommands.value.length > 0) {
        slashMenu.selectedIndex = (slashMenu.selectedIndex - 1 + filteredSlashCommands.value.length) % filteredSlashCommands.value.length
      }
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const selected = filteredSlashCommands.value[slashMenu.selectedIndex]
      if (selected) {
        applySlashCommand(selected)
      }
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      closeSlashMenu()
      return
    }
  }

  // Phím Backspace / Delete khi đang chọn ảnh trong bài
  if ((e.key === 'Backspace' || e.key === 'Delete') && selectedImage.value) {
    e.preventDefault()
    deleteSelectedImage()
    return
  }

  // 1. Phím Enter: Thoát khỏi Trích dẫn (blockquote) hoặc Tiêu đề (h1, h2, h3) về văn bản thường <p>
  if (e.key === 'Enter' && !e.shiftKey) {
    const currentBlock = getCurrentBlockElement()
    if (currentBlock) {
      const tag = currentBlock.tagName.toLowerCase()
      if (tag === 'blockquote') {
        e.preventDefault()
        const text = currentBlock.textContent || ''
        if (!text.trim()) {
          // Trích dẫn rỗng -> Hoàn nguyên thành đoạn văn thường <p>
          const p = document.createElement('p')
          p.innerHTML = '<br>'
          currentBlock.parentNode?.replaceChild(p, currentBlock)
          setCursorToEnd(p)
        } else {
          // Trích dẫn đã có nội dung -> Tạo dòng văn bản thường mới ngay bên dưới
          const p = document.createElement('p')
          p.innerHTML = '<br>'
          currentBlock.parentNode?.insertBefore(p, currentBlock.nextSibling)
          setCursorToEnd(p)
        }
        syncCurrentChapterContent()
        updateActiveFormats()
        return
      }

      if (['h1', 'h2', 'h3', 'h4'].includes(tag)) {
        e.preventDefault()
        const text = currentBlock.textContent || ''
        if (!text.trim()) {
          const p = document.createElement('p')
          p.innerHTML = '<br>'
          currentBlock.parentNode?.replaceChild(p, currentBlock)
          setCursorToEnd(p)
        } else {
          // Sau tiêu đề -> Tự động chuyển về dòng văn bản thường <p>
          const p = document.createElement('p')
          p.innerHTML = '<br>'
          currentBlock.parentNode?.insertBefore(p, currentBlock.nextSibling)
          setCursorToEnd(p)
        }
        syncCurrentChapterContent()
        updateActiveFormats()
        return
      }
    }
  }

  // 2. Phím Backspace khi khối rỗng -> Trở về đoạn văn thường <p>
  if (e.key === 'Backspace') {
    const currentBlock = getCurrentBlockElement()
    if (currentBlock) {
      const tag = currentBlock.tagName.toLowerCase()
      if (['blockquote', 'h1', 'h2', 'h3', 'h4'].includes(tag)) {
        if (!currentBlock.textContent?.trim()) {
          e.preventDefault()
          const p = document.createElement('p')
          p.innerHTML = '<br>'
          currentBlock.parentNode?.replaceChild(p, currentBlock)
          setCursorToEnd(p)
          syncCurrentChapterContent()
          updateActiveFormats()
          return
        }
      }
    }
  }

  // 3. Phím Space: Kích hoạt Markdown shortcut (#, ##, >, -, 1.)
  if (e.key === ' ') {
    checkMarkdownShortcuts(e)
  }

  if (e.key === '/') {
    setTimeout(() => {
      checkSlashTrigger()
    }, 10)
  }
}

function checkSlashTrigger() {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return
  const range = sel.getRangeAt(0)
  const node = range.startContainer
  if (node && node.nodeType === Node.TEXT_NODE && node.textContent) {
    const textBefore = node.textContent.slice(0, range.startOffset)
    const match = textBefore.match(/\/([a-zA-Z0-9_]*)$/)
    if (match) {
      slashMenu.query = match[1] || ''
      slashMenu.selectedIndex = 0
      const rects = range.getClientRects()
      const rect = rects.length > 0 ? rects[0] : range.getBoundingClientRect()
      slashMenu.top = Math.max(20, rect.bottom + 6)
      slashMenu.left = Math.min(Math.max(10, rect.left), window.innerWidth - 330)
      slashMenu.isOpen = true
      return
    }
  }
  closeSlashMenu()
}

function handleEditorInput() {
  syncCurrentChapterContent()
  if (slashMenu.isOpen) {
    checkSlashTrigger()
  }
}

function closeSlashMenu() {
  slashMenu.isOpen = false
  slashMenu.query = ''
  slashMenu.selectedIndex = 0
}

function applySlashCommand(cmd: SlashCommand) {
  const sel = window.getSelection()
  if (sel && sel.rangeCount > 0) {
    const range = sel.getRangeAt(0)
    const node = range.startContainer
    if (node && node.nodeType === Node.TEXT_NODE && node.textContent) {
      const text = node.textContent
      const lastSlash = text.lastIndexOf('/', range.startOffset)
      if (lastSlash !== -1) {
        node.textContent = text.slice(0, lastSlash) + text.slice(range.startOffset)
        const newRange = document.createRange()
        newRange.setStart(node, lastSlash)
        newRange.collapse(true)
        sel.removeAllRanges()
        sel.addRange(newRange)
      }
    }
  }
  closeSlashMenu()
  cmd.action()
}


const filteredGalleryImages = computed(() => {
  const q = imagePickerSearch.value.toLowerCase().trim()
  return storyGallery.value.map(url => {
    const chs = getImageChapters(url)
    const isCover = storyData.coverUrl === url
    return {
      url,
      chapters: chs,
      isCover,
    }
  }).filter(item => {
    if (!q) return true
    if (item.isCover && ('ảnh bìa'.includes(q) || 'cover'.includes(q))) return true
    return item.chapters.some(ch => `chương ${ch.chapterNumber}`.includes(q) || ch.title.toLowerCase().includes(q))
  })
})

function pickAndInsertImage(url: string) {
  showImagePickerModal.value = false
  insertImageAtCursor(url)
  showToast('Đã chèn ảnh vào chương!')
}

function triggerUploadFromPicker() {
  showImagePickerModal.value = false
  triggerInsertImage()
}

function chapterPayload(chapter: Chapter) {
  return {
    chapterNumber: chapter.chapterNumber,
    title: chapter.title.trim() || 'Chương ' + chapter.chapterNumber,
    content: chapter.content,
    illustrations: chapter.illustrations || '[]',
  }
}
async function handleSaveStory(navigate = true): Promise<boolean> {
  if (!canMutate.value || chapterToDelete.value || cropTarget.value || isUploadingImage.value || isUploadingCover.value || isUploadingGallery.value) return false
  if (!storyData.title.trim()) {
    showToast('Vui lòng nhập tên bộ truyện', 'error')
    return false
  }
  syncCurrentChapterContent()
  isSaving.value = true
  try {
    const metadata = {
      title: storyData.title.trim(), description: storyData.description.trim(),
      coverUrl: storyData.coverUrl, category: storyData.category.trim(), tags: storyData.tags.trim(), status: storyData.status,
    }
    const creating = !storyData.id
    const first = chapters.value[0]
    const saved = await client.request<Story>(creating ? '/api/stories' : '/api/stories/' + encodeURIComponent(storyData.id), {
      method: creating ? 'POST' : 'PUT',
      body: JSON.stringify({ ...metadata, ...(creating && first ? { initialChapter: chapterPayload(first) } : {}) }),
    })
    storyData.id = saved.id
    storyOwnerId.value = saved.userId
    if (creating && first) {
      const created = saved.chapters?.[0]
      if (!created?.id) throw new Error('Máy chủ chưa trả về chương vừa tạo.')
      Object.assign(first, created)
    }
    for (const [index, chapter] of chapters.value.entries()) {
      if (creating && index === 0) continue
      const { chapterNumber, ...update } = chapterPayload(chapter)
      const persisted = await client.request<Chapter>(chapter.id
        ? '/api/chapters/' + encodeURIComponent(chapter.id)
        : '/api/stories/' + encodeURIComponent(storyData.id) + '/chapters', {
        method: chapter.id ? 'PUT' : 'POST',
        body: JSON.stringify(chapter.id ? update : { chapterNumber, ...update }),
      })
      Object.assign(chapter, persisted)
    }
    hasLoadedStory = true
    savedSnapshot.value = snapshot()
    isSaving.value = false
    showToast('Đã lưu truyện thành công')
    const savedStory = { ...saved, chapters: chapters.value.map(chapter => ({ ...chapter })), chapterCount: chapters.value.length }
    updateBookshelfStory(router, savedStory)
    emit('saved', savedStory)
    if (navigate && route.path.includes('/library/editor') && route.params.id !== storyData.id) {
      await router.replace('/library/editor/' + encodeURIComponent(storyData.id))
    }
    return true
  } catch (error) {
    showToast(friendlyError(error), 'error')
    return false
  } finally {
    isSaving.value = false
  }
}
async function loadStoryDetails(storyId: string) {
  const revision = ++loadRevision
  isLoading.value = true
  savedSnapshot.value = ''
  loadError.value = ''
  try {
    const story = await client.request<Story>('/api/stories/' + encodeURIComponent(storyId))
    if (revision !== loadRevision) return
    Object.assign(storyData, {
      id: story.id, title: story.title, description: story.description || '', coverUrl: story.coverUrl || '',
      category: story.category || '', tags: story.tags || '', status: story.status || 'published',
    })
    storyOwnerId.value = story.userId
    chapters.value = (story.chapters || []).map(chapter => ({ ...chapter }))
    activeChapterIndex.value = 0
    rebuildGallery()
    hasLoadedStory = true
    await nextTick()
    if (editorRef.value) editorRef.value.innerHTML = activeChapter.value?.content || ''
    savedSnapshot.value = snapshot()
  } catch (error) {
    if (revision === loadRevision) loadError.value = friendlyError(error)
  } finally {
    if (revision === loadRevision) isLoading.value = false
  }
}
watch(() => String(route.params.id || props.initialStory?.id || ''), async id => {
  if (id && id === storyData.id && hasLoadedStory) return
  chapterToDelete.value = null
  cropTarget.value = undefined
  activeTab.value = 'editor'
  if (id) await loadStoryDetails(id)
  else {
    loadRevision++
    isLoading.value = false
    loadError.value = ''
    hasLoadedStory = false
    Object.assign(storyData, { id: '', title: '', description: '', coverUrl: '', category: '', tags: '', status: 'published' })
    storyOwnerId.value = ''
    chapters.value = [newChapter(1)]
    activeChapterIndex.value = 0
    storyGallery.value = []
    if (editorRef.value) editorRef.value.innerHTML = ''
    savedSnapshot.value = snapshot()
  }
}, { immediate: true })

async function handleClose() {
  if (route.query.from === 'admin') {
    router.push('/admin')
    return
  }
  if (route.path.includes('/library/editor')) {
    router.push('/library/bookshelf')
  } else {
    if (await requestLeave()) emit('close')
  }
}

</script>

<template>
  <div class="studio-layout" data-motion-scope="stories">
    <!-- 1. Persistent Sidebar containing Brand Logo 'mộc.' at the top -->
    <LibrarySidebar :before-logout="requestLeave" />

    <!-- 2. Main Studio Workspace -->
    <div class="studio-main">
      <!-- Toast notification -->
      <Transition name="toast">
        <div v-if="toast.show" class="editor-toast" :class="toast.type" :role="toast.type === 'error' ? 'alert' : 'status'" aria-atomic="true">
          <Check v-if="toast.type === 'success'" :size="15" />
          <X v-else :size="15" />
          <span>{{ toast.message }}</span>
        </div>
      </Transition>

      <!-- Hidden file inputs -->
      <input
        ref="imageInputRef"
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        class="hidden-input"
        @change="handleImageSelected"
      />
      <input
        ref="coverInputRef"
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        class="hidden-input"
        @change="handleCoverSelected"
      />
      <input
        ref="galleryInputRef"
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp,image/gif"
        class="hidden-input"
        @change="handleGallerySelected"
      />

      <!-- Studio Header with Logo Breadcrumb, Tabs, & Publish Button -->
      <header class="word-titlebar studio-header">
        <div class="header-left">
          <button
            type="button"
            class="btn-back"
            title="Quay lại Tủ sách"
            @click="handleClose"
          >
            <ArrowLeft :size="17" />
          </button>

          <div class="header-breadcrumb">
            <span class="breadcrumb-root">Tủ sách</span>
            <span class="breadcrumb-slash">/</span>
            <span class="breadcrumb-current">{{ storyData.title || 'Sáng tác truyện mới' }}</span>
          </div>
        </div>

        <!-- 3 Workspace Tabs: Soạn thảo, Quản lý chương, Kho ảnh -->
        <nav class="studio-tabs" aria-label="Khu vực làm việc">
          <button
            type="button"
            class="tab-btn"
            :class="{ active: activeTab === 'editor' }"
            @click="activeTab = 'editor'"
          >
            <PenTool :size="15" />
            <span>Soạn thảo</span>
          </button>
          <button
            type="button"
            class="tab-btn"
            :class="{ active: activeTab === 'chapters' }"
            @click="activeTab = 'chapters'"
          >
            <Layers :size="15" />
            <span>Quản lý chương ({{ chapters.length }})</span>
          </button>
          <button
            type="button"
            class="tab-btn"
            :class="{ active: activeTab === 'images' }"
            @click="activeTab = 'images'"
          >
            <ImageIcon :size="15" />
            <span>Kho ảnh truyện ({{ storyGallery.length }})</span>
          </button>
        </nav>

        <div class="header-actions">
          <button
            type="button"
            class="btn-save-draft btn-publish"
            :disabled="!canMutate || !!chapterToDelete || !!cropTarget || isUploadingImage || isUploadingCover || isUploadingGallery"
            @click="handleSaveStory()"
          >
            <Loader2 v-if="isSaving" :size="14" class="spin" />
            <Check v-else :size="14" />
            <span>{{ isSaving ? 'Đang lưu...' : 'Lưu truyện' }}</span>
          </button>
        </div>
      </header>

      <!-- Overlay, not in flow: shifting the content while loading would move the
           shared cover's destination mid-flight (bookshelf → editor motion). -->
      <div v-if="isLoading" class="editor-request-state editor-loading-overlay" role="status"><Loader2 :size="24" class="spin" /> Đang tải truyện…</div>
      <div v-else-if="loadError" class="editor-request-state" role="alert"><p>{{ loadError }}</p><button type="button" class="btn-primary-action" @click="loadStoryDetails(String(route.params.id || props.initialStory?.id || ''))">Thử lại</button></div>
      <p v-else-if="!canEdit" class="editor-readonly-notice">Bạn đang xem truyện của tác giả khác. Chỉ tác giả có thể chỉnh sửa.</p>
      <!-- TAB 1: SOẠN THẢO TRUYỆN CHỮ (Word-like Canvas, Floating Ribbon, Auto-cover) -->
      <div v-show="activeTab === 'editor'" class="studio-tab-content" :class="{ 'is-loading': isLoading }" :inert="isLoading || !!loadError || isSaving || !!chapterToDelete">
        <main ref="scrollArea" class="editor-scroll-area">
          <div class="word-page-container writing-sheet">
            <section class="story-cover-section" aria-label="Xem trước trong thư viện" @dragover.prevent @drop.prevent="handleCoverDrop">
              <div class="cover-preview-box">
                <CollectionDeckCard :deck="libraryPreview" :motion-key="storyData.id || undefined" preview />
              </div>
              <div class="cover-controls">
                <h2>Hiển thị trong thư viện</h2>
                <div v-if="canEdit" class="cover-edit-actions">
                  <button v-if="storyData.coverUrl" type="button" :disabled="!canMutate" class="btn-crop-cover" @click="openCrop(storyData.coverUrl, 'cover')"><Crop :size="15" />Cắt ảnh bìa</button>
                  <button type="button" :disabled="!canMutate || isUploadingCover" @click="coverInputRef?.click()"><Upload :size="15" />{{ isUploadingCover ? 'Đang tải…' : storyData.coverUrl ? 'Đổi ảnh bìa' : 'Thêm ảnh bìa' }}</button>
                  <button v-if="storyData.coverUrl" type="button" :disabled="!canMutate" class="btn-remove-cover" @click="removeCover"><X :size="15" />Gỡ bìa</button>
                </div>
              </div>
            </section>

            <!-- Tiêu đề truyện lớn, không viền, không card -->
            <div class="story-title-wrap">
              <input
                v-model="storyData.title"
                class="doc-title-input title-hero-input"
                :readonly="!canEdit"
                placeholder="Tiêu đề truyện..."
                maxlength="200"
              />
            </div>

            <!-- Thể loại, tags, tóm tắt tinh gọn -->
            <div class="story-meta-panel meta-inline-box">
              <div class="meta-row">
                <input v-model="storyData.category" class="chip-input category-input" placeholder="Thể loại" aria-label="Thể loại truyện" :readonly="!canEdit" />

                <input
                  v-model="storyData.tags"
                  class="chip-input"
                  :readonly="!canEdit"
                  placeholder="Thêm từ khóa / tags (cách nhau bởi dấu phẩy)..."
                />
              </div>

              <textarea
                v-model="storyData.description"
                rows="2"
                class="input-textarea synopsis-textarea"
                :readonly="!canEdit"
                placeholder="Tóm tắt giới thiệu ngắn về tác phẩm..."
              />
            </div>

            <div class="story-status-options" role="group" aria-label="Trạng thái truyện">
              <button v-for="option in statusOptions" :key="option.value" type="button" :aria-pressed="storyData.status === option.value" :disabled="!canEdit" @click="storyData.status = option.value">{{ option.label }}</button>
            </div>
            <div class="section-divider" />

            <!-- Bộ chuyển chương nhanh & Thêm chương -->
            <div class="chapter-navigation-bar">
              <div class="chapter-pill-list">
                <button
                  v-for="(ch, idx) in chapters"
                  :key="idx"
                  type="button"
                  class="chapter-nav-chip"
                  :class="{ active: activeChapterIndex === idx }"
                  @click="switchChapter(idx)"
                >
                  <span>Chương {{ ch.chapterNumber }}</span>
                </button>
                <button
                  type="button"
                  class="chapter-add-chip"
                  :disabled="!canMutate"
                  title="Thêm chương mới"
                  @click="addNewChapter"
                >
                  <Plus :size="13" />
                  <span>Thêm chương</span>
                </button>
              </div>
            </div>

            <!-- Tiêu đề chương đang chọn -->
            <div v-if="activeChapter" class="chapter-title-wrap">
              <input
                v-model="activeChapter.title"
                class="chapter-title-input"
                :readonly="!canEdit"
                placeholder="Tiêu đề chương (Ví dụ: Chương 1: Khởi đầu)..."
                maxlength="200"
                @input="syncCurrentChapterContent()"
              />
            </div>

            <!-- Floating Minimal Ribbon Toolbar -->
            <div v-if="canEdit && activeChapter" class="word-ribbon floating-toolbar">
              <button type="button" class="ribbon-btn" title="Hoàn tác (Ctrl+Z)" @click="exec('undo')">
                <Undo :size="15" />
              </button>
              <button type="button" class="ribbon-btn" title="Làm lại (Ctrl+Y)" @click="exec('redo')">
                <Redo :size="15" />
              </button>

              <span class="bar-separator" />

              <button
                type="button"
                class="ribbon-btn"
                :class="{ active: activeFormats.bold }"
                title="Đậm (Ctrl+B)"
                @click="exec('bold')"
              >
                <Bold :size="15" />
              </button>
              <button
                type="button"
                class="ribbon-btn"
                :class="{ active: activeFormats.italic }"
                title="Nghiêng (Ctrl+I)"
                @click="exec('italic')"
              >
                <Italic :size="15" />
              </button>
              <button
                type="button"
                class="ribbon-btn"
                :class="{ active: activeFormats.underline }"
                title="Gạch chân (Ctrl+U)"
                @click="exec('underline')"
              >
                <Underline :size="15" />
              </button>
              <button
                type="button"
                class="ribbon-btn"
                :class="{ active: activeFormats.strikeThrough }"
                title="Gạch ngang"
                @click="exec('strikeThrough')"
              >
                <Strikethrough :size="15" />
              </button>

              <span class="bar-separator" />

              <button
                type="button"
                class="ribbon-btn"
                :class="{ active: activeBlockTag === 'p' }"
                title="Văn bản thường (Paragraph)"
                @click="setBlock('<p>')"
              >
                <Pilcrow :size="15" />
              </button>
              <button
                type="button"
                class="ribbon-btn"
                :class="{ active: activeBlockTag === 'h2' }"
                title="Tiêu đề lớn"
                @click="setBlock('<h2>')"
              >
                <Heading1 :size="15" />
              </button>
              <button
                type="button"
                class="ribbon-btn"
                :class="{ active: activeBlockTag === 'h3' }"
                title="Tiêu đề vừa"
                @click="setBlock('<h3>')"
              >
                <Heading2 :size="15" />
              </button>
              <button
                type="button"
                class="ribbon-btn"
                :class="{ active: activeBlockTag === 'blockquote' }"
                title="Trích dẫn (Nhấp lại để tắt)"
                @click="setBlock('<blockquote>')"
              >
                <Quote :size="15" />
              </button>

              <span class="bar-separator" />

              <button type="button" class="ribbon-btn" title="Danh sách chấm" @click="exec('insertUnorderedList')">
                <List :size="15" />
              </button>
              <button type="button" class="ribbon-btn" title="Danh sách số" @click="exec('insertOrderedList')">
                <ListOrdered :size="15" />
              </button>

              <span class="bar-separator" />

              <!-- Nút Chèn ảnh -->
              <button
                type="button"
                class="ribbon-btn btn-insert-image"
                title="Chèn ảnh vào vị trí con trỏ"
                :disabled="isUploadingImage"
                @click="triggerInsertImage"
              >
                <Loader2 v-if="isUploadingImage" :size="15" class="spin" />
                <ImageIcon v-else :size="15" />
                <span>{{ isUploadingImage ? 'Đang tải...' : 'Chèn ảnh' }}</span>
              </button>

              <!-- Nút Kho ảnh & Tìm kiếm ảnh nhanh kiểu Notion -->
              <button
                type="button"
                class="ribbon-btn btn-gallery-picker"
                title="Kho ảnh truyện & Tìm kiếm ảnh nhanh"
                @click="showImagePickerModal = true"
              >
                <Search :size="14" />
                <span>Kho ảnh</span>
              </button>
            </div>

            <!-- Contenteditable Writing Area -->
            <div
              ref="editorRef"
              class="word-document-content fluid-content-editor"
              :class="{ 'is-drop-target': isDraggingOver }"
              :contenteditable="canEdit && !!activeChapter && !isLoading && !loadError"
              spellcheck="false"
              @input="handleEditorInput"
              @keydown="handleEditorKeyDown"
              @keyup="updateActiveFormats"
              @paste="handlePaste"
              @dragover="handleEditorDragOver"
              @dragleave="handleEditorDragLeave"
              @drop="handleEditorDrop"
              @click="handleEditorClick"
            />

            <!-- Drop overlay khi người dùng kéo ảnh vào bài -->
            <div v-if="isDraggingOver" class="editor-drop-zone-overlay">
              <Upload :size="36" />
              <span>Thả ảnh vào đây để chèn ngay vào chương...</span>
            </div>

            <!-- Floating Image Action Toolbar in Editor (Xóa ảnh, Đặt làm bìa) -->
            <div
              v-if="selectedImage && canEdit" class="editor-img-toolbar"
              :style="{ top: `${selectedImage.top}px`, left: `${selectedImage.left}px` }"
            >
              <button type="button" class="img-tool-btn btn-crop-editor-image" @click="selectedImage && openCrop(selectedImage.src, 'all')"><Crop :size="13" />Cắt ảnh</button>
              <button
                type="button"
                class="img-tool-btn"
                title="Đặt ảnh này làm ảnh bìa tác phẩm"
                @click="setAsCoverFromEditor"
              >
                <Star :size="13" />
                <span>Đặt làm bìa</span>
              </button>
              <button
                type="button"
                class="img-tool-btn btn-danger"
                title="Xóa ảnh này khỏi chương hiện tại"
                @click="deleteSelectedImage"
              >
                <Trash2 :size="13" />
                <span>Xóa ảnh</span>
              </button>
              <button
                type="button"
                class="img-tool-btn btn-close"
                title="Đóng"
                @click="selectedImage = null"
              >
                <X :size="13" />
              </button>
            </div>

            <!-- Notion-like Slash Command Menu -->
            <div
              v-if="slashMenu.isOpen && filteredSlashCommands.length > 0"
              class="notion-slash-menu"
              :style="{ top: `${slashMenu.top}px`, left: `${slashMenu.left}px` }"
            >
              <div class="slash-menu-list">
                <button
                  v-for="(cmd, idx) in filteredSlashCommands"
                  :key="cmd.id"
                  type="button"
                  class="slash-menu-item"
                  :class="{ active: slashMenu.selectedIndex === idx }"
                  @mouseenter="slashMenu.selectedIndex = idx"
                  @click="applySlashCommand(cmd)"
                >
                  <div class="cmd-icon-box">
                    <component :is="cmd.icon" :size="16" />
                  </div>
                  <div class="cmd-text-box">
                    <span class="cmd-title">{{ cmd.title }}</span>
                    <span class="cmd-sub">{{ cmd.subtitle }}</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>

      <!-- TAB 2: QUẢN LÝ CHƯƠNG (Chapters Manager) -->
      <div v-show="activeTab === 'chapters'" class="studio-tab-content" :inert="isLoading || !!loadError || isSaving || !!chapterToDelete">
        <div class="manager-container">
          <div class="manager-top-action">
            <div class="manager-stats">
              <span class="stats-strong">{{ chapters.length }} chương</span>
              <span class="stats-sub">Tổng số chương của bộ truyện</span>
            </div>
            <button type="button" class="btn-primary-action" :disabled="!canMutate" @click="addNewChapter">
              <Plus :size="16" />
              <span>Thêm chương mới</span>
            </button>
          </div>

          <div class="chapters-table-list">
            <div
              v-for="(ch, idx) in chapters"
              :key="idx"
              class="chapter-row-item"
              :class="{ 'is-current': activeChapterIndex === idx }"
            >
              <div class="chapter-number-col">
                <span class="num-badge">{{ ch.chapterNumber }}</span>
              </div>

              <div class="chapter-info-col">
                <input
                  v-model="ch.title"
                  class="chapter-inline-title-input"
                :readonly="!canEdit"
                  placeholder="Nhập tiêu đề chương..."
                    @input="syncCurrentChapterContent()"
                />
                <div class="chapter-meta-line">
                  <span>{{ (ch.content || '').replace(/<[^>]*>/g, '').length }} ký tự</span>
                </div>
              </div>

              <div class="chapter-actions-col">
                <button
                  type="button"
                  class="btn-row-action"
                  title="Soạn thảo chương này"
                  @click="switchChapter(idx)"
                >
                  <PenTool :size="14" />
                  <span>Soạn thảo</span>
                </button>
                <button
                  type="button"
                  class="btn-row-delete"
                  :disabled="!canMutate"
                  title="Xóa chương này"
                  @click="deleteChapter(idx)"
                >
                  <Trash2 :size="14" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- TAB 3: KHO ẢNH TRUYỆN -->
      <div v-show="activeTab === 'images'" class="studio-tab-content gallery-tab-view" :inert="isLoading || !!loadError || isSaving || !!chapterToDelete">
        <div class="gallery-container">
          <header class="gallery-header">
            <div class="gallery-title-row">
              <h2 class="gallery-title">Kho ảnh</h2>
              <span class="gallery-badge">{{ storyGallery.length }}</span>
            </div>
            <button
              type="button"
              class="btn-primary-action"
              :disabled="isUploadingGallery || !canMutate"
              @click="galleryInputRef?.click()"
            >
              <Loader2 v-if="isUploadingGallery" :size="15" class="spin" />
              <Upload v-else :size="15" />
              <span>{{ isUploadingGallery ? 'Đang tải…' : 'Tải ảnh' }}</span>
            </button>
          </header>

          <section class="gallery-library-preview" aria-label="Xem trước trong thư viện"><h3>Hiển thị trong thư viện</h3><CollectionDeckCard :deck="libraryPreview" :motion-key="storyData.id || undefined" preview /></section>
          <div v-if="storyGallery.length > 0" class="gallery-grid">
            <article
              v-for="imgUrl in storyGallery"
              :key="imgUrl"
              class="gallery-card"
              :class="{ 'is-cover': storyData.coverUrl === imgUrl }"
            >
              <div class="gallery-thumb">
                <img :src="imgUrl" alt="" loading="lazy" />
                <span v-if="storyData.coverUrl === imgUrl" class="cover-badge">
                  <Star :size="11" fill="currentColor" /> Bìa
                </span>
              </div>

              <div class="gallery-meta">
                <div v-if="getImageChapters(imgUrl).length > 0" class="usage-chips-wrap">
                  <button
                    v-for="ch in getImageChapters(imgUrl)"
                    :key="ch.index"
                    type="button"
                    class="usage-ch-btn"
                    title="Chuyển đến chương"
                    @click="switchChapter(ch.index)"
                  >
                    Chương {{ ch.chapterNumber }}
                  </button>
                </div>

                <div v-if="canEdit" class="gallery-card-actions">
                  <button type="button" class="gallery-btn btn-crop-gallery-image" :disabled="!canMutate" @click="openCrop(imgUrl, 'all')"><Crop :size="13" /><span>Cắt ảnh</span></button>
                  <button
                    type="button"
                    class="gallery-btn"
                    :class="{ active: storyData.coverUrl === imgUrl }"
                    title="Đặt làm bìa"
                    @click="setAsCover(imgUrl)"
                  >
                    <Star :size="13" :fill="storyData.coverUrl === imgUrl ? 'currentColor' : 'none'" />
                    <span>{{ storyData.coverUrl === imgUrl ? 'Đang là bìa' : 'Làm bìa' }}</span>
                  </button>
                  <button
                    type="button"
                    class="gallery-btn btn-insert-to-doc"
                    title="Chèn vào chương"
                    @click="insertImageFromGallery(imgUrl)"
                  >
                    <Plus :size="13" />
                    <span>Chèn</span>
                  </button>
                  <button
                    type="button"
                    class="gallery-btn btn-delete-gallery-img"
                    title="Xóa ảnh"
                    @click="deleteImageFromGallery(imgUrl)"
                  >
                    <Trash2 :size="13" />
                  </button>
                </div>
              </div>
            </article>
          </div>

          <div v-else class="gallery-empty-state">
            <ImageIcon :size="36" :stroke-width="1.3" />
            <p>Chưa có ảnh</p>
            <button
              type="button"
              class="btn-primary-action"
              @click="galleryInputRef?.click()"
            >
              <Upload :size="15" />
              <span>Tải ảnh</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <ImageCropDialog v-if="cropTarget" :src="cropTarget.src" :description="cropDescription" :apply="applyCroppedImage" @close="cropTarget = undefined" />
    <UnsavedChangesDialog v-if="showUnsavedDialog" :saving="isSaving" :error="leaveError" @stay="finishLeave(false)" @discard="finishLeave(true)" @save="saveAndLeave" />
    <div v-if="chapterToDelete" class="chapter-delete-overlay" @click.self="closeDeleteChapter" @keydown="onDeleteKeydown">
      <div class="chapter-delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="chapter-delete-title" aria-describedby="chapter-delete-description">
        <AlertTriangle :size="26" aria-hidden="true" />
        <h2 id="chapter-delete-title">Xóa chương {{ chapterToDelete.chapterNumber }}?</h2>
        <p id="chapter-delete-description"><strong>{{ chapterToDelete.title }}</strong><br />{{ chapterToDelete.id ? 'Chương này đã được lưu. Toàn bộ nội dung và danh sách minh họa của chương sẽ bị xóa vĩnh viễn khỏi truyện ngay khi bạn xác nhận. Không thể hoàn tác.' : 'Chương này chưa được lưu. Xác nhận sẽ bỏ toàn bộ nội dung và minh họa trong bản nháp của chương. Không thể hoàn tác.' }}</p>
        <p v-if="deleteError" class="chapter-delete-error" role="alert">{{ deleteError }}</p>
        <div class="chapter-delete-actions">
          <button ref="deleteCancel" type="button" :disabled="isDeletingChapter" @click="closeDeleteChapter">Giữ chương</button>
          <button type="button" class="btn-confirm-delete-chapter" :disabled="isDeletingChapter" @click="confirmDeleteChapter"><Loader2 v-if="isDeletingChapter" :size="15" class="spin" />{{ isDeletingChapter ? 'Đang xóa…' : 'Xóa vĩnh viễn' }}</button>
        </div>
      </div>
    </div>

    <!-- Modal Tìm kiếm & Chèn ảnh siêu tốc kiểu Notion -->
    <div
      v-if="showImagePickerModal"
      class="image-picker-overlay"
      @click.self="showImagePickerModal = false"
    >
      <div class="image-picker-modal">
        <div class="picker-filter-bar">
          <div class="picker-search-wrap">
            <Search :size="15" />
            <input
              v-model="imagePickerSearch"
              placeholder="Tìm kiếm theo chương (vd: Chương 1) hoặc ảnh bìa..."
              class="picker-search-input"
            />
          </div>
          <button type="button" class="btn-picker-upload" @click="triggerUploadFromPicker">
            <Upload :size="14" />
            <span>Tải ảnh mới</span>
          </button>
        </div>

        <div v-if="filteredGalleryImages.length > 0" class="picker-grid">
          <div
            v-for="img in filteredGalleryImages"
            :key="img.url"
            class="picker-card"
            @click="pickAndInsertImage(img.url)"
          >
            <div class="picker-thumb">
              <img :src="img.url" alt="Minh họa" />
              <div v-if="img.isCover" class="picker-badge-cover">
                <Star :size="10" fill="currentColor" />
                <span>Bìa</span>
              </div>
            </div>
            <div class="picker-details">
              <div class="picker-chips">
                <span
                  v-for="ch in img.chapters"
                  :key="ch.index"
                  class="picker-chip"
                >
                  Chương {{ ch.chapterNumber }}
                </span>
                <span v-if="img.chapters.length === 0 && !img.isCover" class="picker-chip unused">
                  Chưa dùng
                </span>
              </div>
              <button type="button" class="btn-quick-insert">
                <Plus :size="13" />
                <span>Chèn</span>
              </button>
            </div>
          </div>
        </div>

        <div v-else class="picker-empty-state">
          <p>Không tìm thấy ảnh phù hợp.</p>
          <button type="button" class="btn-picker-upload-small" @click="triggerUploadFromPicker">
            <Upload :size="14" />
            <span>Tải ảnh từ máy tính</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.editor-request-state { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; padding: 28px; color: var(--library-muted); font-size: 13px; }
.editor-loading-overlay { position: absolute; top: 72px; left: 50%; z-index: 5; flex-direction: row; gap: 10px; padding: 10px 16px; border-radius: 12px; background: var(--library-surface); transform: translateX(-50%); pointer-events: none; }
.editor-readonly-notice { margin: 0; padding: 12px 24px; color: var(--library-muted); font-size: 12px; }
.studio-tab-content[inert]:not(.is-loading) { opacity: .5; }
.story-status-options { display: flex; flex-wrap: wrap; gap: 8px; margin-block: 12px; }
.story-status-options button { border: 0; border-radius: 10px; padding: 8px 12px; font: inherit; font-size: 11px; background: color-mix(in oklab, var(--library-accent) 6%, transparent); color: var(--library-muted); cursor: pointer; }
.story-status-options button[aria-pressed="true"] { background: color-mix(in oklab, var(--library-accent) 16%, transparent); color: var(--library-accent); }
.category-input { max-width: 180px; }
.chapter-delete-overlay { position: fixed; inset: 0; z-index: 3500; display: grid; place-items: center; padding: 24px; background: #18241c40; backdrop-filter: blur(8px); }
.chapter-delete-dialog { width: min(420px, 100%); padding: 28px; border-radius: 24px; background: var(--library-surface); color: var(--library-ink); }
.chapter-delete-dialog > svg, .chapter-delete-error { color: #aa4b3f; }
.chapter-delete-dialog h2 { font-size: 22px; font-weight: 600; margin: 18px 0 12px; }
.chapter-delete-dialog p { font-size: 13px; line-height: 1.7; color: var(--library-muted); overflow-wrap: anywhere; }
.chapter-delete-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 24px; }
.chapter-delete-actions button { display: inline-flex; align-items: center; justify-content: center; gap: 8px; border: 0; border-radius: 10px; padding: 11px 14px; font: inherit; font-size: 12px; background: color-mix(in oklab, var(--library-accent) 8%, transparent); color: var(--library-ink); cursor: pointer; }
.chapter-delete-actions .btn-confirm-delete-chapter { background: #aa4b3f; color: #fff; }
.chapter-delete-actions button:focus-visible { outline: none; text-decoration: underline; text-underline-offset: 4px; }
button:disabled { cursor: not-allowed; opacity: .5; }

/* Toàn bộ bố cục Studio: Sidebar Mộc ở bên trái (chứa Logo), nội dung ở bên phải */
.studio-layout {
  --library-surface: #ffffff;
  --library-accent: #435a41;
  --library-ink: #18241c;
  --library-muted: #5e6b5d;
  display: flex;
  height: 100dvh;
  width: 100%;
  background-color: var(--library-surface, #ffffff);
  color: var(--library-ink, #18241c);
  overflow: hidden;
  position: relative;
  font-family: var(--sans, 'Be Vietnam Pro', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, sans-serif);
}

.studio-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 0;
  overflow: hidden;
  position: relative;
}

.hidden-input {
  display: none !important;
}

/* Toast */
.editor-toast {
  position: absolute;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  max-width: calc(100% - 32px);
  z-index: 3000;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 18px;
  border-radius: 9999px;
  font-size: 13.5px;
  font-weight: 500;
  pointer-events: none;
}
.editor-toast.success {
  background-color: #273b26;
  color: #f7faf7;
}
.editor-toast.error {
  background-color: #8c251f;
  color: #fff5f5;
}
.toast-enter-active,
.toast-leave-active {
  transition: all 0.2s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, 8px);
}

/* Studio Header */
.studio-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  flex-shrink: 0;
  background-color: var(--library-surface, #ffffff);
  gap: 16px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.btn-back {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 9999px;
  background: color-mix(in oklab, var(--library-ink) 6%, transparent);
  color: var(--library-ink);
  border: 0;
  cursor: pointer;
  transition: background 0.15s;
  flex-shrink: 0;
}
.btn-back:hover {
  background: color-mix(in oklab, var(--library-ink) 12%, transparent);
}

.header-breadcrumb {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13.5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.breadcrumb-root {
  color: var(--library-muted, #727a70);
}
.breadcrumb-slash {
  color: color-mix(in oklab, var(--library-ink) 20%, transparent);
}
.breadcrumb-current {
  font-weight: 600;
  color: var(--library-ink);
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 3 Studio Tabs */
.studio-tabs {
  display: flex;
  align-items: center;
  gap: 4px;
  background: color-mix(in oklab, var(--library-ink) 4%, transparent);
  padding: 4px;
  border-radius: 9999px;
}

.tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 6px 14px;
  border-radius: 9999px;
  border: 0;
  background: transparent;
  color: var(--library-muted, #687265);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}
.tab-btn:hover {
  color: var(--library-ink);
}
.tab-btn.active {
  background-color: color-mix(in oklab, var(--library-accent) 10%, var(--library-surface));
  color: var(--library-ink);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.btn-publish {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 18px;
  border-radius: 9999px;
  background-color: var(--library-ink, #18241c);
  color: var(--library-surface, #ffffff);
  border: 0;
  font-size: 13.5px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.15s, transform 0.15s;
}
.btn-publish:hover:not(:disabled) {
  opacity: 0.9;
  transform: translateY(-1px);
}
.btn-publish:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Tab Contents Area */
.studio-tab-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: calc(100% - 60px);
  overflow: hidden;
}

/* --- TAB 1: Soạn thảo --- */
.editor-scroll-area {
  flex: 1;
  overflow-y: auto;
  padding: 24px 32px 80px;
}

.writing-sheet {
  position: relative;
  max-width: 740px;
  margin: 0 auto;
  width: 100%;
  display: flex;
  flex-direction: column;
}

.story-cover-section { display: grid; grid-template-columns: 240px minmax(0, 1fr); align-items: center; gap: 24px; margin-bottom: 28px; padding: 18px 0; }
.cover-controls h2 { margin: 0 0 16px; font-size: 13px; font-weight: 550; }
.cover-edit-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.cover-edit-actions button { display: inline-flex; align-items: center; gap: 7px; border: 0; box-shadow: none; border-radius: 10px; padding: 10px 12px; background: #eef2e8; color: var(--library-accent); font: inherit; font-size: 12px; cursor: pointer; }
.gallery-library-preview { display: flex; align-items: center; gap: 32px; margin-bottom: 28px; }
.gallery-library-preview h3 { margin: 0; font-size: 13px; font-weight: 550; }
.studio-layout :deep(.user-avatar-wrap), .studio-layout :deep(.avatar-btn) { box-shadow: none; }
@media (max-width: 600px) { .story-cover-section { grid-template-columns: minmax(0, 1fr); gap: 12px; }.cover-controls { text-align: center; }.cover-edit-actions { justify-content: center; }.gallery-library-preview { flex-direction: column; gap: 12px; } }

/* Tiêu đề truyện */
.story-title-wrap {
  margin-bottom: 10px;
}
.title-hero-input {
  width: 100%;
  border: 0;
  outline: none;
  background: transparent;
  color: var(--library-ink);
  font-size: clamp(30px, 4vw, 42px);
  font-weight: 700;
  line-height: 1.25;
  letter-spacing: -0.8px;
  padding: 0;
}
.title-hero-input::placeholder {
  color: color-mix(in oklab, var(--library-ink) 25%, transparent);
}

/* Meta inline */
.meta-inline-box {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 16px;
}
.meta-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.chip-input {
  border: 0;
  outline: none;
  background: color-mix(in oklab, var(--library-ink) 4%, transparent);
  color: var(--library-ink);
  font-size: 12.5px;
  padding: 5px 12px;
  border-radius: 9999px;
  font-weight: 500;
}
.chip-input {
  flex: 1;
  max-width: 320px;
}
.chip-input::placeholder {
  color: var(--library-muted);
}
.synopsis-textarea {
  width: 100%;
  border: 0;
  outline: none;
  background: transparent;
  color: var(--library-muted, #687265);
  font-size: 14.5px;
  line-height: 1.6;
  resize: none;
  padding: 0;
}
.synopsis-textarea::placeholder {
  color: color-mix(in oklab, var(--library-ink) 30%, transparent);
}

.section-divider {
  height: 0;
  margin: 10px 0 18px;
}

/* Chapter Navigation Bar */
.chapter-navigation-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}
.chapter-pill-list {
  display: flex;
  align-items: center;
  gap: 6px;
  overflow-x: auto;
  padding-bottom: 4px;
}
.chapter-nav-chip {
  padding: 6px 14px;
  border-radius: 9999px;
  border: 0;
  background-color: rgba(24, 36, 28, 0.04);
  color: #4a5649;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
}
.chapter-nav-chip:hover {
  background-color: rgba(24, 36, 28, 0.08);
  color: #18241c;
}
.chapter-nav-chip.active {
  background-color: color-mix(in oklab, var(--library-accent) 12%, var(--library-surface));
  color: var(--library-accent);
  font-weight: 600;
}

.chapter-add-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 12px;
  border-radius: 9999px;
  border: 0;
  background: transparent;
  color: var(--library-ink);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
}
.chapter-add-chip:hover {
  background: color-mix(in oklab, var(--library-ink) 5%, transparent);
}

.btn-manage-chapters-link {
  font-size: 12.5px;
  color: #3b7c38;
  background: transparent;
  border: 0;
  cursor: pointer;
  white-space: nowrap;
}

/* Tiêu đề chương */
.chapter-title-wrap {
  margin-bottom: 12px;
}
.chapter-title-input {
  width: 100%;
  border: 0;
  outline: none;
  background: transparent;
  color: var(--library-ink, #18241c);
  font-size: 20px;
  font-weight: 600;
  padding: 0;
  font-family: var(--sans, 'Be Vietnam Pro', sans-serif);
}
.chapter-title-input::placeholder {
  color: rgba(24, 36, 28, 0.4);
}

/* Floating Toolbar */
.floating-toolbar {
  position: sticky;
  top: 10px;
  z-index: 100;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  margin-bottom: 24px;
  background: color-mix(in oklab, var(--library-ink) 4%, var(--library-surface));
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  border-radius: 9999px;
  width: fit-content;
}
.ribbon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  width: 32px;
  height: 32px;
  border-radius: 9999px;
  border: 0;
  background: transparent;
  color: var(--library-ink);
  cursor: pointer;
  transition: all 0.15s;
}
.ribbon-btn:hover {
  background: color-mix(in oklab, var(--library-ink) 8%, transparent);
}
.ribbon-btn.active {
  background: color-mix(in oklab, var(--library-ink) 14%, transparent);
  color: #2e7d32;
  font-weight: 600;
}
.bar-separator {
  width: 4px;
  height: 18px;
  flex-shrink: 0;
  margin: 0 2px;
}
.btn-insert-image {
  width: auto;
  padding: 0 10px;
  font-size: 12.5px;
  font-weight: 500;
  color: #274726;
  background: color-mix(in oklab, #274726 8%, transparent);
}
.btn-insert-image:hover {
  background: color-mix(in oklab, #274726 15%, transparent);
}

/* Content Writing Area */
.fluid-content-editor {
  flex: 1;
  outline: none;
  font-size: 18px;
  line-height: 1.9;
  color: var(--library-ink);
  font-family: var(--font-reading, var(--serif, 'Lora', 'Merriweather', serif));
  min-height: 480px;
  word-break: break-word;
}
.fluid-content-editor.is-drop-target {
  outline: 2px dashed #2e7d32 !important;
  outline-offset: 6px;
  background-color: rgba(46, 125, 50, 0.04);
  border-radius: 8px;
}
.editor-drop-zone-overlay {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(6px);
  border: 0;
  border-radius: 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #2e7d32;
  font-weight: 600;
  font-size: 16px;
  z-index: 50;
  pointer-events: none;
}
.fluid-content-editor:empty::before {
  content: 'Viết nội dung chương truyện tại đây... (Nhấp Chèn ảnh hoặc dán ảnh vào bất cứ đâu)';
  color: color-mix(in oklab, var(--library-ink) 30%, transparent);
  font-style: italic;
}
.fluid-content-editor :deep(p) {
  margin: 0 0 18px 0;
  text-indent: 28px;
}
.fluid-content-editor :deep(h2) {
  font-size: 22px;
  font-weight: 700;
  margin: 28px 0 14px 0;
  color: var(--library-ink);
}
.fluid-content-editor :deep(h3) {
  font-size: 19px;
  font-weight: 600;
  margin: 22px 0 12px 0;
  color: var(--library-ink);
}
.fluid-content-editor :deep(blockquote) {
  margin: 20px 0;
  padding: 10px 20px;
  border: 0;
  font-style: italic;
  color: var(--library-muted);
}
.fluid-content-editor :deep(img.content-img),
.fluid-content-editor :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 12px;
  display: block;
  margin: 24px auto;
  cursor: pointer;
  transition: transform 0.15s, outline 0.15s;
}
.fluid-content-editor :deep(img:hover) {
  outline: 3px solid #2e7d32;
  transform: scale(1.008);
}
.editor-bottom-hint {
  margin-top: 36px;
  padding-top: 14px;
  border: 0;
  font-size: 12px;
  color: var(--library-muted);
  text-align: center;
}

/* --- TAB 2 & 3: Manager Container Layout --- */
.manager-container {
  max-width: 900px;
  margin: 0 auto;
  width: 100%;
  padding: 32px 24px 80px;
  overflow-y: auto;
  flex: 1;
}

.manager-top-action {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}
.manager-stats {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.stats-strong {
  font-size: 20px;
  font-weight: 700;
  color: var(--library-ink);
}
.stats-sub {
  font-size: 13px;
  color: var(--library-muted);
}
.btn-primary-action {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 8px 18px;
  border-radius: 9999px;
  background-color: var(--library-ink);
  color: var(--library-surface, #ffffff);
  border: 0;
  font-size: 13.5px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.15s;
}
.btn-primary-action:hover:not(:disabled) {
  opacity: 0.9;
}
.btn-primary-action:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Chapters Table List */
.chapters-table-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.chapter-row-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 18px;
  border-radius: 12px;
  background: color-mix(in oklab, var(--library-ink) 3%, transparent);
  transition: background 0.15s;
}
.chapter-row-item:hover {
  background: color-mix(in oklab, var(--library-ink) 6%, transparent);
}
.chapter-row-item.is-current {
  background: rgba(59, 124, 56, 0.08);
}

.chapter-row-item.is-current .num-badge {
  background: #243526;
  color: #ffffff;
}

.chapter-number-col .num-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(24, 36, 28, 0.08);
  font-size: 13.5px;
  font-weight: 600;
  color: var(--library-ink, #18241c);
}

.chapter-info-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.chapter-inline-title-input {
  border: 0;
  outline: none;
  background: transparent;
  font-size: 15px;
  font-weight: 600;
  color: var(--library-ink, #18241c);
  width: 100%;
}
.chapter-meta-line {
  font-size: 12px;
  color: var(--library-muted);
}

.chapter-actions-col {
  display: flex;
  align-items: center;
  gap: 8px;
}
.btn-row-action {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 14px;
  border-radius: 9999px;
  border: 0;
  background: color-mix(in oklab, var(--library-ink) 8%, transparent);
  color: var(--library-ink);
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}
.btn-row-action:hover {
  background: color-mix(in oklab, var(--library-ink) 14%, transparent);
}
.btn-row-delete {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 9999px;
  border: 0;
  background: transparent;
  color: var(--library-muted);
  cursor: pointer;
  transition: color 0.15s, background 0.15s;
}
.btn-row-delete:hover {
  color: #992822;
  background: color-mix(in oklab, #992822 10%, transparent);
}

/* ============================================================
   KHO ẢNH TRUYỆN (STORY MEDIA GALLERY)
   ============================================================ */
.gallery-tab-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.gallery-container {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  width: 100%;
  max-width: 1120px;
  margin: 0 auto;
  padding: 32px 28px 80px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.gallery-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-shrink: 0;
}

.gallery-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.gallery-title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: var(--library-ink);
  letter-spacing: -0.02em;
}

.gallery-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 7px;
  border-radius: 9999px;
  background: color-mix(in oklab, var(--library-ink) 7%, transparent);
  color: var(--library-muted);
  font-size: 12px;
  font-weight: 600;
}

.gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 18px;
}

.gallery-card {
  position: relative;
  display: flex;
  flex-direction: column;
  border-radius: 14px;
  background: color-mix(in oklab, var(--library-ink) 3.5%, transparent);
  border: 0;
  box-shadow: none;
  overflow: hidden;
  transition: background 0.15s ease, transform 0.15s ease;
}

.gallery-card:hover {
  background: color-mix(in oklab, var(--library-ink) 6.5%, transparent);
}

.gallery-card.is-cover {
  background: color-mix(in oklab, var(--library-accent) 8%, transparent);
}

.gallery-thumb {
  position: relative;
  width: 100%;
  aspect-ratio: 17 / 22;
  overflow: hidden;
  background: color-mix(in oklab, var(--library-ink) 6%, transparent);
}

.gallery-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.cover-badge {
  position: absolute;
  top: 8px;
  left: 8px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 9999px;
  background: rgba(24, 36, 28, 0.72);
  backdrop-filter: blur(8px);
  color: #ffffff;
  font-size: 11px;
  font-weight: 600;
  border: 0;
  box-shadow: none;
  pointer-events: none;
}

.gallery-meta {
  padding: 10px 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.usage-chips-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  min-height: 22px;
}

.usage-ch-btn {
  display: inline-flex;
  align-items: center;
  padding: 2px 7px;
  border-radius: 6px;
  background: color-mix(in oklab, var(--library-ink) 6%, transparent);
  color: var(--library-muted);
  font-size: 11px;
  font-weight: 500;
  border: 0;
  box-shadow: none;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.usage-ch-btn:hover {
  background: color-mix(in oklab, var(--library-accent) 15%, transparent);
  color: var(--library-accent);
}

.gallery-card-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}

.gallery-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 5px 8px;
  border-radius: 7px;
  background: color-mix(in oklab, var(--library-ink) 5%, transparent);
  color: var(--library-ink);
  font-size: 11.5px;
  font-weight: 500;
  border: 0;
  box-shadow: none;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.gallery-btn:hover {
  background: color-mix(in oklab, var(--library-ink) 10%, transparent);
}

.gallery-btn.active {
  background: color-mix(in oklab, var(--library-accent) 15%, transparent);
  color: var(--library-accent);
  font-weight: 600;
}

.gallery-btn.btn-delete-gallery-img {
  margin-left: auto;
  padding: 5px 7px;
  color: var(--library-muted);
}

.gallery-btn.btn-delete-gallery-img:hover {
  background: color-mix(in oklab, #992822 12%, transparent);
  color: #992822;
}

.gallery-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 20px;
  min-height: 340px;
  text-align: center;
  gap: 14px;
  color: var(--library-muted);
}

.gallery-empty-state p {
  margin: 0;
  font-size: 14px;
  color: var(--library-muted);
}

@media (max-width: 640px) {
  .gallery-grid {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 12px;
  }
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@media (max-width: 800px) {
  .studio-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }
  .studio-tabs {
    width: 100%;
    overflow-x: auto;
  }
  .editor-scroll-area {
    padding: 16px 16px 60px;
  }
}

/* Floating Image Action Toolbar in Editor */
.editor-img-toolbar {
  position: fixed;
  z-index: 1000;
  display: inline-flex;
  flex-wrap: wrap;
  max-width: calc(100vw - 20px);
  align-items: center;
  gap: 4px;
  padding: 4px 6px;
  background: #ffffff;
  color: #18241c;
  border-radius: 9999px;
  box-shadow: none;
  animation: fadeIn 0.15s ease-out;
}

.img-tool-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  border-radius: 9999px;
  border: 0;
  background: transparent;
  color: #243526;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.12s ease;
}

.img-tool-btn:hover {
  background: rgba(24, 36, 28, 0.08);
}

.img-tool-btn.btn-danger {
  color: #aa4b3f;
}

.img-tool-btn.btn-danger:hover {
  background: rgba(170, 75, 63, 0.1);
}

.img-tool-btn.btn-close {
  padding: 5px 7px;
  color: #727a70;
}

.img-tool-sep {
  width: 1px;
  height: 14px;
  background: rgba(24, 36, 28, 0.12);
  margin: 0 2px;
}

/* Notion-like Slash Command Menu */
.notion-slash-menu {
  position: fixed;
  z-index: 2000;
  width: 290px;
  max-height: 340px;
  background: #ffffff;
  border-radius: 14px;
  box-shadow: none;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  animation: popIn 0.12s cubic-bezier(0.16, 1, 0.3, 1);
}

.slash-menu-header {
  padding: 8px 14px 6px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #727a70;
  border: 0;
}

.slash-menu-list {
  padding: 4px;
  overflow-y: auto;
  max-height: 300px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.slash-menu-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 10px;
  border-radius: 10px;
  border: 0;
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: all 0.1s ease;
  width: 100%;
}

.slash-menu-item:hover,
.slash-menu-item.active {
  background: rgba(43, 85, 40, 0.08);
}

.cmd-icon-box {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: rgba(24, 36, 28, 0.05);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #243526;
  flex-shrink: 0;
}

.slash-menu-item.active .cmd-icon-box {
  background: #243526;
  color: #ffffff;
}

.cmd-text-box {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.cmd-title {
  font-size: 13px;
  font-weight: 550;
  color: #18241c;
  line-height: 1.2;
}

.cmd-sub {
  font-size: 11px;
  color: #727a70;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Gallery Card Chapter Usage */
.gallery-usage-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px 2px;
  flex-wrap: wrap;
}

.usage-label {
  font-size: 11px;
  color: #727a70;
}

.usage-chips-wrap {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.usage-ch-btn {
  display: inline-flex;
  align-items: center;
  padding: 2px 7px;
  border-radius: 6px;
  border: 0;
  background: rgba(43, 85, 40, 0.06);
  color: #2b5528;
  font-size: 11px;
  font-weight: 550;
  cursor: pointer;
  transition: all 0.12s ease;
}

.usage-ch-btn:hover {
  background: #2b5528;
  color: #ffffff;
}

.usage-ch-none {
  font-size: 11px;
  color: #929a8f;
  font-style: italic;
}

.btn-delete-gallery-img {
  color: #aa4b3f;
}

.btn-delete-gallery-img:hover {
  background: rgba(170, 75, 63, 0.08) !important;
  color: #aa4b3f !important;
}

/* Quick Image Picker Modal */
.image-picker-overlay {
  position: fixed;
  inset: 0;
  z-index: 2500;
  background: rgba(10, 16, 12, 0.45);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.image-picker-modal {
  width: 100%;
  max-width: 620px;
  max-height: 82vh;
  background: #ffffff;
  border-radius: 20px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: popIn 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

.picker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 22px 14px;
  border: 0;
}

.picker-title-area {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #243526;
}

.picker-title-area h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #18241c;
}

.picker-title-area p {
  margin: 2px 0 0;
  font-size: 12px;
  color: #727a70;
}

.btn-picker-close {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 0;
  background: transparent;
  color: #727a70;
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-picker-close:hover {
  background: rgba(24, 36, 28, 0.08);
  color: #18241c;
}

.picker-filter-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 22px;
  background: rgba(24, 36, 28, 0.02);
}

.picker-search-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 12px;
  border-radius: 10px;
  background: #eef2ed;
  color: #727a70;
}

.picker-search-input {
  border: 0;
  outline: none;
  background: transparent;
  font-size: 13px;
  color: #18241c;
  width: 100%;
}

.btn-picker-upload {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border-radius: 10px;
  border: 0;
  background: #243526;
  color: #ffffff;
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
}

.btn-picker-upload:hover {
  background: #324734;
}

.picker-grid {
  padding: 18px 22px;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 14px;
}

.picker-card {
  border-radius: 12px;
  background: #f7faf7;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.15s ease;
  display: flex;
  flex-direction: column;
}

.picker-card:hover {
  background: #eef2ed;
}

.picker-thumb {
  position: relative;
  width: 100%;
  aspect-ratio: 17 / 22;
  overflow: hidden;
  background: #eef2ed;
}

.picker-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.picker-badge-cover {
  position: absolute;
  top: 4px;
  left: 4px;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 5px;
  border-radius: 4px;
  background: rgba(18, 28, 20, 0.85);
  color: #ffd055;
  font-size: 9.5px;
  font-weight: 600;
}

.picker-details {
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.picker-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
}

.picker-chip {
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(43, 85, 40, 0.08);
  color: #2b5528;
  font-weight: 550;
}

.picker-chip.unused {
  color: #8c9489;
  background: rgba(24, 36, 28, 0.05);
}

.btn-quick-insert {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 6px;
  border: 0;
  background: #f7faf7;
  color: #243526;
  font-size: 11px;
  font-weight: 550;
  cursor: pointer;
  transition: all 0.12s ease;
  width: 100%;
}

.picker-card:hover .btn-quick-insert {
  background: #243526;
  color: #ffffff;
}

.picker-empty-state {
  padding: 40px 20px;
  text-align: center;
  color: #727a70;
  font-size: 13.5px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.btn-picker-upload-small {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 8px;
  border: 0;
  background: #243526;
  color: #ffffff;
  font-size: 12px;
  cursor: pointer;
}

@keyframes popIn {
  from {
    opacity: 0;
    transform: scale(0.96) translateY(-4px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-3px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>

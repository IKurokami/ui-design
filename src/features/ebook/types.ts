export const PAGE_WIDTH = 1410
export const PAGE_HEIGHT = 2250
export const PAGE_ASPECT_RATIO = PAGE_WIDTH / PAGE_HEIGHT

export type PageKind = 'cover' | 'chapter' | 'blank'
export type ElementKind = 'text' | 'image'
export type TextAlign = 'left' | 'center' | 'right' | 'justify'
export type TextDecoration = 'none' | 'underline' | 'line-through'
export type TextTransform = 'none' | 'uppercase' | 'lowercase' | 'capitalize'
export type VerticalAlign = 'top' | 'middle' | 'bottom'

export interface EbookElement {
  id: string
  kind: ElementKind
  html: string
  src: string
  x: number
  y: number
  width: number
  height: number
  zIndex: number
  locked: boolean
  fontFamily: string
  fontSize: number
  fontWeight: number
  fontStyle: 'normal' | 'italic'
  textDecoration: TextDecoration
  textTransform: TextTransform
  color: string
  backgroundColor: string
  align: TextAlign
  verticalAlign: VerticalAlign
  letterSpacing: number
  lineHeight: number
  padding: number
  cornerRadius: number
  rotation: number
  opacity: number
  role?: 'cover-title' | 'cover-subtitle' | 'cover-author'
}

export interface EbookPage {
  id: string
  kind: PageKind
  title: string
  content: string
  coverUrl: string
  background: string
  accent: string
  locked: boolean
  hidden: boolean
  chapterId?: string
  elements: EbookElement[]
}

export interface EbookDraft {
  version: 2
  title: string
  subtitle: string
  author: string
  description: string
  fontFamily: string
  pageBackground: string
  accent: string
  pages: EbookPage[]
}

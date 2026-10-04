export interface DeckCover {
  id: string
  url: string
  title: string
}

export interface CollectionDeck {
  id: string
  title: string
  category: string
  itemCount: number
  createdAt?: string
  covers: string[] // Up to three distinct story images, primary cover first.
  tags: string[]
  ambientColors?: [string, string, string]
}

export interface CategoryFilter {
  id: string
  label: string
  count?: number
  avatar?: string
}

export type ViewMode = 'deck' | 'list'
export type SortMode = 'title-asc' | 'title-desc' | 'newest' | 'oldest'

export interface Chapter {
  id: string
  storyId: string
  chapterNumber: number
  title: string
  content: string
  illustrations?: string
  createdAt?: string
  updatedAt?: string
}

export interface Story {
  id: string
  userId: string
  authorName?: string
  title: string
  description?: string
  coverUrl?: string
  previewImages?: string[]
  category?: string
  tags?: string
  status?: string
  createdAt?: string
  updatedAt?: string
  chapters?: Chapter[]
  chapterCount?: number
  readingProgress?: ReadingProgress
}

export interface ReadingProgress {
  chapterId: string
  chapterNumber?: number
  chapterTitle?: string
  updatedAt?: string
}

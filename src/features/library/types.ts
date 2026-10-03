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
  totalFiles: number
  newCount?: number
  createdAt?: string
  favoriteCount?: number
  covers: [string, string, string] // 3 covers for the layered stack effect
  illustrations?: string[]
  tags: string[]
  ambientColors?: [string, string, string]
  isUserCreated?: boolean
}

export interface CategoryFilter {
  id: string
  label: string
  count?: number
  avatar?: string
}

export type ViewMode = 'deck' | 'list'
export type SortMode = 'title-asc' | 'title-desc' | 'newest' | 'oldest' | 'favorites'

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
  category?: string
  tags?: string
  status?: string
  createdAt?: string
  updatedAt?: string
  chapters?: Chapter[]
}

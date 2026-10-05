import type { Router } from 'vue-router'
import type { Story } from './types'

export type BookshelfSortMode = 'updated' | 'created' | 'chapters' | 'title'
export interface BookshelfState {
  stories?: Story[]
  searchQuery: string
  statusFilter: 'all' | 'published' | 'draft' | 'completed'
  sortBy: BookshelfSortMode
  viewMode: 'grid' | 'table'
}

// Only backend responses live here. Router + auth session isolate each app and
// account; changing sessions makes the old snapshot unreachable.
const snapshots = new WeakMap<Router, BookshelfState>()
export function getBookshelfState(router: Router): BookshelfState {
  let state = snapshots.get(router)
  if (!state) { state = { searchQuery: '', statusFilter: 'all', sortBy: 'updated', viewMode: 'grid' }; snapshots.set(router, state) }
  return state
}

/** Keep the return cover in sync with a successfully saved backend story. */
export function updateBookshelfStory(router: Router, story: Story) {
  const state = getBookshelfState(router)
  if (!state.stories) return
  const previous = state.stories.find(item => item.id === story.id)
  state.stories = previous
    ? state.stories.map(item => item.id === story.id ? { ...item, ...story } : item)
    : [...state.stories, story]
}

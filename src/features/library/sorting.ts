import type { CollectionDeck, SortMode } from './types'

export const librarySortOptions: { value: SortMode; label: string }[] = [
  { value: 'title-asc', label: 'Tên A → Z' },
  { value: 'title-desc', label: 'Tên Z → A' },
  { value: 'newest', label: 'Ngày tạo mới nhất' },
  { value: 'oldest', label: 'Ngày tạo cũ nhất' },
]

const collator = new Intl.Collator('vi', { numeric: true, sensitivity: 'base' })
const timestamp = (deck: CollectionDeck) => Date.parse(deck.createdAt ?? '') || 0

export function sortCollections(decks: readonly CollectionDeck[], mode: SortMode): CollectionDeck[] {
  return [...decks].sort((a, b) => {
    const title = collator.compare(a.title, b.title)
    if (mode === 'title-asc') return title
    if (mode === 'title-desc') return -title
    // Collections without a known creation date stay last in either direction.
    const aTime = timestamp(a), bTime = timestamp(b)
    if (!aTime || !bTime) return aTime ? -1 : bTime ? 1 : title
    return (mode === 'oldest' ? aTime - bTime : bTime - aTime) || title
  })
}

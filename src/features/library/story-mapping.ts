import type { CategoryFilter, CollectionDeck, Story } from './types'

export function storyImageSources(story: Story): string[] {
  const images = new Set<string>()
  function add(url: string) { if (url.trim()) images.add(url.trim()) }
  add(story.coverUrl ?? '')
  story.previewImages?.forEach(add)
  for (const chapter of story.chapters ?? []) {
    if (images.size >= 3) break
    try {
      const urls: unknown = JSON.parse(chapter.illustrations ?? '[]')
      if (Array.isArray(urls)) urls.forEach(url => { if (typeof url === 'string') add(url) })
    } catch { /* Images embedded in chapter HTML are still available below. */ }
    if (images.size >= 3) break
    const content = document.createElement('template')
    content.innerHTML = chapter.content
    content.content.querySelectorAll('img[src]').forEach(image => add(image.getAttribute('src') ?? ''))
  }
  return [...images].slice(0, 3)
}

export function storyToDeck(story: Story): CollectionDeck {
  const covers = storyImageSources(story)
  return {
    id: story.id,
    title: story.title,
    category: story.category ? `category:${story.category}` : '',
    itemCount: story.chapterCount ?? story.chapters?.length ?? 0,
    createdAt: story.createdAt,
    covers,
    tags: (story.tags || '').split(',').map(tag => tag.trim()).filter(Boolean),
  }
}

export function storyCategories(stories: readonly Story[]): CategoryFilter[] {
  const counts = new Map<string, number>()
  for (const story of stories) {
    if (story.category) counts.set(story.category, (counts.get(story.category) ?? 0) + 1)
  }
  return [
    { id: 'all', label: 'Tất cả', count: stories.length },
    ...[...counts].sort(([a], [b]) => a.localeCompare(b, 'vi')).map(([label, count]) => ({
      id: `category:${label}`, label, count,
    })),
  ]
}

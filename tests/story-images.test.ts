import { afterEach, describe, expect, it } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import CollectionDeckCard from '../src/features/library/components/CollectionDeckCard.vue'
import CollectionDeckGrid from '../src/features/library/components/CollectionDeckGrid.vue'
import { storyToDeck, storyImageSources } from '../src/features/library/story-mapping'
import type { Story } from '../src/features/library/types'

enableAutoUnmount(afterEach)
const story: Story = { id: 'story', userId: 'author', title: 'Truyện', coverUrl: '/uploads/cover.jpg' }
const images = (urls: string[]) => storyToDeck({ ...story, previewImages: urls })

describe('Story preview images', () => {
  it('keeps the primary cover first, removes duplicates and caps the stack at three real images', () => {
    const deck = images(['/uploads/cover.jpg', ' /uploads/chapter-1.jpg ', '/uploads/chapter-1.jpg', '/uploads/chapter-2.jpg', '/uploads/chapter-3.jpg', ''])
    expect(deck.covers).toEqual(['/uploads/cover.jpg', '/uploads/chapter-1.jpg', '/uploads/chapter-2.jpg'])
    const wrapper = mount(CollectionDeckCard, { props: { deck } })
    expect(wrapper.get('.card-front img').attributes('src')).toBe('/uploads/cover.jpg')
    expect(wrapper.get('.card-back-left img').attributes('src')).toBe('/uploads/chapter-1.jpg')
    expect(wrapper.get('.card-back-right img').attributes('src')).toBe('/uploads/chapter-2.jpg')
  })

  it('always renders three layers, repeating images only when fewer than three are available', () => {
    const single = mount(CollectionDeckCard, { props: { deck: images(['/uploads/cover.jpg']) } })
    expect(single.findAll('.card-layer')).toHaveLength(3)
    expect(single.findAll('img').every(image => image.attributes('src') === '/uploads/cover.jpg')).toBe(true)
    const pair = mount(CollectionDeckCard, { props: { deck: images(['/uploads/cover.jpg', '/uploads/scene.jpg']) } })
    expect(pair.findAll('.card-layer')).toHaveLength(3)
    expect(pair.get('.card-front img').attributes('src')).toBe('/uploads/cover.jpg')
    expect(pair.get('.card-back-left img').attributes('src')).toBe('/uploads/scene.jpg')
    expect(pair.get('.card-back-right img').attributes('src')).toBe('/uploads/cover.jpg')
  })

  it('uses illustration previews without a cover and keeps an imageless story as a placeholder', () => {
    const deck = storyToDeck({ ...story, coverUrl: '', previewImages: ['/uploads/scene.jpg'] })
    const wrapper = mount(CollectionDeckCard, { props: { deck } })
    expect(wrapper.get('.card-front img').attributes('src')).toBe('/uploads/scene.jpg')
    expect(storyToDeck({ ...story, coverUrl: '' }).covers).toEqual([])
    const empty = mount(CollectionDeckCard, { props: { deck: storyToDeck({ ...story, coverUrl: '' }) } })
    expect(empty.findAll('img')).toHaveLength(0)
    expect(empty.find('.cover-placeholder').exists()).toBe(true)
  })

  it('removes only a failed image and promotes a remaining image if the front image fails', async () => {
    const wrapper = mount(CollectionDeckCard, { props: { deck: images(['/uploads/scene-1.jpg', '/uploads/scene-2.jpg']) } })
    await wrapper.get('.card-back-right img').trigger('error')
    expect(wrapper.findAll('img')).toHaveLength(3)
    expect(wrapper.findAll('img').every(image => image.attributes('src') !== '/uploads/scene-2.jpg')).toBe(true)
    expect(wrapper.get('.card-front img').attributes('src')).toBe('/uploads/cover.jpg')
    await wrapper.get('.card-front img').trigger('error')
    expect(wrapper.findAll('img')).toHaveLength(3)
    expect(wrapper.get('.card-front img').attributes('src')).toBe('/uploads/scene-1.jpg')
    await wrapper.get('.card-front img').trigger('error')
    expect(wrapper.find('.cover-placeholder').exists()).toBe(true)
  })

  it('keeps the actual primary cover when switching to list view', () => {
    const wrapper = mount(CollectionDeckGrid, { props: { decks: [images(['/uploads/scene-1.jpg', '/uploads/scene-2.jpg'])], viewMode: 'list' } })
    expect(wrapper.get('.deck-list-item img').attributes('src')).toBe('/uploads/cover.jpg')
  })

  it('extracts distinct illustration and embedded image sources from real chapter details', () => {
    expect(storyImageSources({ ...story, chapters: [
      { id: 'c1', storyId: story.id, chapterNumber: 1, title: 'Một', illustrations: '["/uploads/cover.jpg", "/uploads/scene.jpg"]', content: '<p><img src="/uploads/scene.jpg"><img src="/uploads/third.jpg"></p>' },
    ] })).toEqual(['/uploads/cover.jpg', '/uploads/scene.jpg', '/uploads/third.jpg'])
  })
})

import type { Story } from '../../src/features/library/types'

// API responses used only by tests; never bundled with the client.
export const libraryStories: Story[] = [
  { id: 'story-a', userId: 'author', title: 'An', category: 'Kỳ Ảo', tags: 'Phép thuật', chapterCount: 2, coverUrl: '/uploads/a.jpg', previewImages: ['/uploads/a.jpg', '/uploads/a-scene-1.jpg', '/uploads/a-scene-2.jpg'], createdAt: '2026-09-03' },
  { id: 'story-b', userId: 'author', title: 'Bộ 2', category: 'Kỳ Ảo', tags: 'Phiêu lưu', chapterCount: 1, coverUrl: '/uploads/b.jpg', previewImages: ['/uploads/b.jpg'], createdAt: '2026-09-01' },
  { id: 'story-c', userId: 'author', title: 'Bộ 10', category: 'Đời Thường', tags: '', chapterCount: 0, coverUrl: '/uploads/c.jpg', previewImages: ['/uploads/c.jpg'], createdAt: '2026-09-02' },
]

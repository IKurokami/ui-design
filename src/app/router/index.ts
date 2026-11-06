import { createRouter, createWebHistory } from 'vue-router'
import LoginPage from '../../features/auth/pages/LoginPage.vue'
import RegisterPage from '../../features/auth/pages/RegisterPage.vue'
import ResetPasswordPage from '../../features/auth/pages/ResetPasswordPage.vue'

import { authGuard } from './auth-guard'

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: () => import('../../features/home/pages/HomePage.vue'), meta: { title: 'Khám phá', layout: 'home' } },
    {
      path: '/library',
      name: 'library',
      component: () => import('../../features/library/pages/LibraryPage.vue'),
      meta: { title: 'Thư viện', layout: 'dashboard', requiresAuth: true },
    },
    {
      path: '/library/bookshelf',
      name: 'bookshelf',
      component: () => import('../../features/library/pages/BookshelfPage.vue'),
      meta: { title: 'Tủ sách của tôi', layout: 'dashboard', requiresAuth: true },
    },
    {
      path: '/library/stories/:id',
      name: 'story-detail',
      component: () => import('../../features/library/pages/StoryDetailPage.vue'),
      meta: { title: 'Đọc truyện', layout: 'dashboard', requiresAuth: true },
    },
    // Older bookmarks now open the compact sidebar popover, not a separate page.
    {
      path: '/library/notifications',
      redirect: { path: '/library', query: { notifications: '1' } },
      meta: { requiresAuth: true },
    },
    { path: '/bookshelf', redirect: '/library/bookshelf' },
    {
      path: '/profile',
      name: 'profile',
      component: () => import('../../features/profile/pages/ProfilePage.vue'),
      meta: { title: 'Hồ sơ cá nhân', layout: 'dashboard', requiresAuth: true },
    },
    {
      path: '/library/editor/:id?',
      name: 'story-editor',
      component: () => import('../../features/library/components/StoryEditor.vue'),
      meta: { title: 'Đăng & Soạn thảo truyện', layout: 'dashboard', requiresAuth: true },
    },
    {
      path: '/library/ebooks',
      name: 'ebooks',
      component: () => import('../../features/ebook/pages/EbookLibraryPage.vue'),
      meta: { title: 'Ebook của tôi', layout: 'dashboard', requiresAuth: true },
    },
    {
      path: '/library/ebook-editor/:id?',
      name: 'ebook-editor',
      component: () => import('../../features/ebook/pages/EbookEditorPage.vue'),
      meta: { title: 'Thiết kế ebook', layout: 'dashboard', requiresAuth: true },
    },
    { path: '/dashboard', redirect: '/library' },
    { path: '/login', name: 'login', component: LoginPage, meta: { title: 'Đăng nhập', layout: 'auth' } },
    { path: '/admin/login', name: 'admin-login', component: () => import('../../features/admin/pages/AdminLoginPage.vue'), meta: { title: 'Đăng nhập quản trị', layout: 'admin', adminArea: true } },
    { path: '/admin', name: 'admin', component: () => import('../../features/admin/pages/AdminPage.vue'), meta: { title: 'Quản trị', layout: 'admin', adminArea: true } },
    { path: '/admin/comments', name: 'admin-comments', component: () => import('../../features/admin/pages/AdminCommentsPage.vue'), meta: { title: 'Duyệt bình luận', layout: 'admin', adminArea: true } },
    { path: '/admin/users', name: 'admin-users', component: () => import('../../features/admin/pages/AdminPage.vue'), meta: { title: 'Người dùng', layout: 'admin', adminArea: true, adminOnly: true } },
    { path: '/register', name: 'register', component: RegisterPage, meta: { title: 'Tạo tài khoản', layout: 'auth' } },
    { path: '/auth/reset-password', name: 'reset-password', component: ResetPasswordPage, meta: { title: 'Đặt lại mật khẩu', layout: 'auth' } },
    { path: '/reset-password', redirect: to => ({ path: '/auth/reset-password', query: to.query }) },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior(to, _from, savedPosition) {
    if (to.name === 'home') return savedPosition ?? (to.hash ? { el: to.hash } : { left: 0, top: 0 })
    return { left: 0, top: 0 }
  },
})

router.beforeEach(authGuard)

router.afterEach(to => {
  document.title = (to.name === 'library' && to.query.tab === 'reading' ? 'Đang đọc' : String(to.meta.title ?? 'Đọc sách')) + ' — Mộc'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', to.name === 'home' ? '#090c09' : '#f6f5ef')
})

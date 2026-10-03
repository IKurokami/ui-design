import { createRouter, createWebHistory } from 'vue-router'
import LoginPage from '../../features/auth/pages/LoginPage.vue'
import RegisterPage from '../../features/auth/pages/RegisterPage.vue'
import ResetPasswordPage from '../../features/auth/pages/ResetPasswordPage.vue'

import { authGuard } from './auth-guard'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: () => import('../../features/home/pages/HomePage.vue'), meta: { title: 'Khám phá', layout: 'home' } },
    {
      path: '/library',
      name: 'library',
      component: () => import('../../features/library/pages/LibraryPage.vue'),
      meta: { title: 'Tủ sách cá nhân', layout: 'dashboard', requiresAuth: true },
    },
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
    { path: '/dashboard', redirect: '/library' },
    { path: '/login', name: 'login', component: LoginPage, meta: { title: 'Đăng nhập', layout: 'auth' } },
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
  document.title = String(to.meta.title ?? 'Đọc sách') + ' — Mộc'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', to.name === 'home' ? '#090c09' : '#f6f5ef')
})

import { createRouter, createWebHistory } from 'vue-router'
import LoginPage from '../../features/auth/pages/LoginPage.vue'
import RegisterPage from '../../features/auth/pages/RegisterPage.vue'
export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: () => import('../../features/home/pages/HomePage.vue'), meta: { title: 'Khám phá', layout: 'home' } },
    { path: '/login', name: 'login', component: LoginPage, meta: { title: 'Đăng nhập' } },
    { path: '/register', name: 'register', component: RegisterPage, meta: { title: 'Tạo tài khoản' } },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior(to, _from, savedPosition) {
    // Auth scroll stays inside each retained stack entry; home uses document scroll.
    if (to.name === 'home') return savedPosition ?? (to.hash ? { el: to.hash } : { left: 0, top: 0 })
    return { left: 0, top: 0 }
  },
})
router.afterEach(to => {
  document.title = String(to.meta.title ?? 'Đọc sách') + ' — Mộc'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', to.name === 'home' ? '#090c09' : '#f6f5ef')
})

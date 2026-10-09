import type { NavigationGuard } from 'vue-router'
import { useAuthStore } from '../../stores/auth.store'

export const authGuard: NavigationGuard = async to => {
  const authStore = useAuthStore()
  if (!authStore.isInitialized) await authStore.checkAuth()

  const isStaff = authStore.user?.role === 'admin' || authStore.user?.role === 'moderator'
  if (to.meta.adminArea) {
    if (to.name === 'admin-login') return isStaff ? { path: '/admin', replace: true } : true
    if (!authStore.isAuthenticated || !isStaff) return { path: '/admin/login', replace: true }
    if (to.meta.adminOnly && authStore.user?.role !== 'admin') return { path: '/admin', replace: true }
    return true
  }

  if (authStore.isAuthenticated && ['/', '/login', '/register'].includes(to.path)) {
    return { path: '/library', replace: true }
  }
  if (!authStore.isAuthenticated && to.matched.some(route => route.meta.requiresAuth)) {
    return { path: '/login', replace: true }
  }
  return true
}

import type { NavigationGuard } from 'vue-router'
import { useAuthStore } from '../../stores/auth.store'

export const authGuard: NavigationGuard = async to => {
  const authStore = useAuthStore()
  if (!authStore.isInitialized) await authStore.checkAuth()

  if (authStore.isAuthenticated && ['/', '/login', '/register'].includes(to.path)) {
    return { path: '/library', replace: true }
  }
  if (!authStore.isAuthenticated && to.matched.some(route => route.meta.requiresAuth)) {
    return { path: '/login', replace: true }
  }
  return true
}

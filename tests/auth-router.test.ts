import { describe, expect, it, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { authGuard } from '../src/app/router/auth-guard'
import { configureAuthAdapter } from '../src/features/auth/services/auth.service'
import { useAuthStore } from '../src/stores/auth.store'

function createTestRouter() {
  const component = { template: '<div />' }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component }, { path: '/login', component },
      { path: '/register', component }, { path: '/auth/reset-password', component },
      { path: '/library', component, meta: { requiresAuth: true } },
      { path: '/dashboard', redirect: '/library' },
    ],
  })
  router.beforeEach(authGuard)
  return router
}

describe('session restoration before routing', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('retains /library on reload while a cookie session request is pending', async () => {
    const session = { user: { id: 'reader', displayName: 'Reader', email: 'reader@example.com' } }
    let resolve!: (value: typeof session) => void
    const getMe = vi.fn(() => new Promise<typeof session>(done => { resolve = done }))
    configureAuthAdapter({ login: vi.fn(), register: vi.fn(), requestPasswordReset: vi.fn(), getMe })
    const startupCheck = useAuthStore().checkAuth()
    await Promise.resolve()
    const router = createTestRouter()
    const navigated: string[] = []
    router.afterEach(to => { navigated.push(to.path) })
    const navigation = router.push('/library')
    // Let the guard join the pending request before the API resolves.
    for (let n = 0; n < 8; n++) await Promise.resolve()
    expect(navigated).toEqual([])
    resolve(session)
    await Promise.all([startupCheck, navigation])
    expect(getMe).toHaveBeenCalledTimes(1)
    expect(router.currentRoute.value.path).toBe('/library')
    expect(navigated).toEqual(['/library'])
  })

  it.each(['/', '/login', '/register', '/dashboard'])('restores an authenticated user opening %s to Library', async path => {
    configureAuthAdapter({
      login: vi.fn(), register: vi.fn(), requestPasswordReset: vi.fn(),
      getMe: vi.fn().mockResolvedValue({ user: { id: 'reader', displayName: 'Reader', email: 'reader@example.com' } }),
    })
    const router = createTestRouter()
    await router.push(path)
    expect(router.currentRoute.value.path).toBe('/library')
  })

  it('redirects to login when the backend confirms that the session is invalid', async () => {
    configureAuthAdapter({
      login: vi.fn(), register: vi.fn(), requestPasswordReset: vi.fn(), getMe: vi.fn().mockRejectedValue(new Error('unauthorized')),
    })
    const router = createTestRouter()
    await router.push('/library')
    expect(router.currentRoute.value.path).toBe('/login')
  })
})

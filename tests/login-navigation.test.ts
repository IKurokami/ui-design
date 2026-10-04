import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import LoginForm from '../src/features/auth/components/LoginForm.vue'
import { authService } from '../src/features/auth/services/auth.service'
import { authGuard } from '../src/app/router/auth-guard'
import { useAuthStore } from '../src/stores/auth.store'

const session = { user: { id: 'reader', displayName: 'Reader', email: 'reader@example.com' } }
let unmount: (() => void) | undefined

afterEach(() => {
  unmount?.()
  unmount = undefined
  vi.useRealTimers()
  vi.restoreAllMocks()
})

async function loginForm() {
  const component = { template: '<div />' }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/login', component },
      { path: '/library', component, meta: { requiresAuth: true } },
    ],
  })
  const pinia = createPinia()
  const store = useAuthStore(pinia)
  store.clearSession()
  router.beforeEach(authGuard)
  await router.push('/login')
  const wrapper = mount(LoginForm, { global: { plugins: [pinia, router] } })
  unmount = () => wrapper.unmount()
  await wrapper.get('#login-identity').setValue('reader@example.com')
  await wrapper.get('#login-password').setValue('Reading123')
  return { wrapper, router, store }
}

describe('login navigation', () => {
  it('enters Library as soon as authentication resolves without advancing any timeout', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] })
    let resolve!: (value: typeof session) => void
    const login = vi.spyOn(authService, 'login').mockImplementation(() => new Promise(done => { resolve = done }))
    const getMe = vi.spyOn(authService, 'getMe')
    const { wrapper, router, store } = await loginForm()
    await wrapper.get('form').trigger('submit')
    await wrapper.get('form').trigger('submit')
    expect(login).toHaveBeenCalledTimes(1)
    expect(router.currentRoute.value.path).toBe('/login')
    expect(store.isAuthenticated).toBe(false)

    resolve(session)
    await flushPromises()
    expect(store.isAuthenticated).toBe(true)
    expect(router.currentRoute.value.path).toBe('/library')
    expect(getMe).not.toHaveBeenCalled()
  })

  it('keeps the user on Login and displays an error when authentication fails', async () => {
    vi.spyOn(authService, 'login').mockRejectedValue(new Error('Login failed'))
    const { wrapper, router, store } = await loginForm()
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/login')
    expect(store.isAuthenticated).toBe(false)
    expect(wrapper.get('[role="alert"]').text()).not.toBe('')
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeUndefined()
  })

  it('ignores a late response after the login form is closed', async () => {
    let resolve!: (value: typeof session) => void
    const login = vi.spyOn(authService, 'login').mockImplementation(() => new Promise(done => { resolve = done }))
    const { wrapper, router, store } = await loginForm()
    const navigate = vi.spyOn(router, 'push')
    await wrapper.get('form').trigger('submit')
    unmount?.()
    unmount = undefined
    expect(login.mock.calls[0]![1]!.aborted).toBe(true)
    resolve(session)
    await flushPromises()
    expect(store.isAuthenticated).toBe(false)
    expect(navigate).not.toHaveBeenCalled()
  })
})

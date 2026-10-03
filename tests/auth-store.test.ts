import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '../src/stores/auth.store'
import { configureAuthAdapter } from '../src/features/auth/services/auth.service'

describe('useAuthStore explicit state management', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('initializes in idle state with no authenticated user', () => {
    const store = useAuthStore()
    expect(store.session).toBeNull()
    expect(store.user).toBeNull()
    expect(store.status).toBe('idle')
    expect(store.isAuthenticated).toBe(false)
    expect(store.isChecking).toBe(false)
    expect(store.isInitialized).toBe(false)
  })

  it('transitions to authenticated state when session is set', () => {
    const store = useAuthStore()
    const mockSession = { user: { id: 'u1', displayName: 'Nguyen Van A', email: 'a@example.com' } }

    store.setSession(mockSession)

    expect(store.session).toEqual(mockSession)
    expect(store.user).toEqual(mockSession.user)
    expect(store.status).toBe('authenticated')
    expect(store.isAuthenticated).toBe(true)
    expect(store.isInitialized).toBe(true)
  })

  it('transitions to unauthenticated state when session is cleared', () => {
    const store = useAuthStore()
    store.setSession({ user: { id: 'u1', displayName: 'Nguyen Van A', email: 'a@example.com' } })

    store.clearSession()

    expect(store.session).toBeNull()
    expect(store.user).toBeNull()
    expect(store.status).toBe('unauthenticated')
    expect(store.isAuthenticated).toBe(false)
  })

  it('restores authenticated session via checkAuth when backend returns user', async () => {
    const store = useAuthStore()
    const mockSession = { user: { id: 'u2', displayName: 'Tran Thi B', email: 'b@example.com' } }

    configureAuthAdapter({
      login: vi.fn(),
      register: vi.fn(),
      requestPasswordReset: vi.fn(),
      getMe: vi.fn().mockResolvedValue(mockSession),
      logout: vi.fn(),
    })

    const result = await store.checkAuth()

    expect(result).toEqual(mockSession)
    expect(store.isAuthenticated).toBe(true)
    expect(store.status).toBe('authenticated')
    expect(store.user?.displayName).toBe('Tran Thi B')
  })

  it('sets unauthenticated status when checkAuth returns 401/fails', async () => {
    const store = useAuthStore()

    configureAuthAdapter({
      login: vi.fn(),
      register: vi.fn(),
      requestPasswordReset: vi.fn(),
      getMe: vi.fn().mockRejectedValue(new Error('Unauthorized')),
      logout: vi.fn(),
    })

    const result = await store.checkAuth()

    expect(result).toBeNull()
    expect(store.isAuthenticated).toBe(false)
    expect(store.status).toBe('unauthenticated')
    expect(store.session).toBeNull()
  })

  it('performs logout and clears state cleanly', async () => {
    const store = useAuthStore()
    const mockLogout = vi.fn().mockResolvedValue(undefined)

    configureAuthAdapter({
      login: vi.fn(),
      register: vi.fn(),
      requestPasswordReset: vi.fn(),
      logout: mockLogout,
    })

    store.setSession({ user: { id: 'u3', displayName: 'User C', email: 'c@example.com' } })
    await store.logout()

    expect(mockLogout).toHaveBeenCalled()
    expect(store.isAuthenticated).toBe(false)
    expect(store.status).toBe('unauthenticated')
    expect(store.session).toBeNull()
  })

  it('waits for the same pending session request for concurrent callers', async () => {
    const store = useAuthStore()
    const restored = { user: { id: 'restored', displayName: 'Reader', email: 'reader@example.com' } }
    let resolve!: (value: typeof restored) => void
    const getMe = vi.fn(() => new Promise<typeof restored>(done => { resolve = done }))
    configureAuthAdapter({ login: vi.fn(), register: vi.fn(), requestPasswordReset: vi.fn(), getMe })
    const first = store.checkAuth()
    const second = store.checkAuth()
    expect(store.isChecking).toBe(true)
    let settled = false
    void second.then(() => { settled = true })
    await Promise.resolve()
    expect(getMe).toHaveBeenCalledTimes(1)
    expect(settled).toBe(false)
    resolve(restored)
    expect(await first).toEqual(restored)
    expect(await second).toEqual(restored)
    expect(store.isAuthenticated).toBe(true)
  })

  it('does not overwrite a newer login with a stale session response', async () => {
    const store = useAuthStore()
    let reject!: (error: Error) => void
    configureAuthAdapter({
      login: vi.fn(), register: vi.fn(), requestPasswordReset: vi.fn(),
      getMe: vi.fn(() => new Promise<never>((_resolve, fail) => { reject = fail })),
    })
    const check = store.checkAuth()
    await Promise.resolve()
    const loggedIn = { user: { id: 'new', displayName: 'New Reader', email: 'new@example.com' } }
    store.setSession(loggedIn)
    reject(new Error('stale unauthorized response'))
    expect(await check).toEqual(loggedIn)
    expect(store.user?.id).toBe('new')
  })

  it('does not restore a session from an in-flight check after logout', async () => {
    const store = useAuthStore()
    const restored = { user: { id: 'old', displayName: 'Reader', email: 'reader@example.com' } }
    let resolve!: (value: typeof restored) => void
    configureAuthAdapter({
      login: vi.fn(), register: vi.fn(), requestPasswordReset: vi.fn(), logout: vi.fn().mockResolvedValue(undefined),
      getMe: vi.fn(() => new Promise<typeof restored>(done => { resolve = done })),
    })
    const check = store.checkAuth()
    await Promise.resolve()
    await store.logout()
    resolve(restored)
    expect(await check).toBeNull()
    expect(store.isAuthenticated).toBe(false)
  })
})

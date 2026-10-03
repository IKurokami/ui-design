import { describe, it, expect, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import ResetPasswordPage from '../src/features/auth/pages/ResetPasswordPage.vue'
import { configureAuthAdapter } from '../src/features/auth/services/auth.service'
import { createHttpAuthAdapter } from '../src/features/auth/services/http-auth.adapter'
import { ApiError } from '../src/services/error-handler'

const invalidLink = 'Liên kết đặt lại mật khẩu không hợp lệ, đã được sử dụng hoặc đã hết hạn.'

async function mountResetPage(token = 'test-valid-token-123') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/auth/reset-password', component: ResetPasswordPage },
      { path: '/login', component: { template: '<div>Login</div>' } },
    ],
  })
  await router.push({ path: '/auth/reset-password', query: token ? { token } : {} })
  const wrapper = mount(ResetPasswordPage, { global: { plugins: [router] } })
  return { wrapper, router }
}

function installAdapter(validate = vi.fn().mockResolvedValue(undefined), confirm = vi.fn().mockResolvedValue(undefined)) {
  configureAuthAdapter({
    login: vi.fn(), register: vi.fn(), requestPasswordReset: vi.fn(),
    validatePasswordReset: validate, confirmPasswordReset: confirm,
  })
  return { validate, confirm }
}

async function submitPassword(wrapper: Awaited<ReturnType<typeof mountResetPage>>['wrapper']) {
  await wrapper.get('#reset-new-password').setValue('NewPassword123')
  await wrapper.get('#reset-confirm-password').setValue('NewPassword123')
  await wrapper.get('form').trigger('submit')
  await flushPromises()
}

describe('Reset password token validation', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  it('does not expose the form while validating the token', async () => {
    let resolve!: () => void
    installAdapter(vi.fn().mockImplementation(() => new Promise<void>(done => { resolve = done })))
    const { wrapper } = await mountResetPage()
    expect(wrapper.find('form').exists()).toBe(false)
    expect(wrapper.text()).toContain('Đang kiểm tra liên kết')
    resolve()
    await flushPromises()
    expect(wrapper.find('form').exists()).toBe(true)
    wrapper.unmount()
  })

  it.each(['đã được sử dụng', 'đã hết hạn', 'không hợp lệ'])('hides the form for a link that is %s', async reason => {
    const { confirm } = installAdapter(vi.fn().mockRejectedValue(new ApiError(`Liên kết ${reason}.`, 400)))
    const { wrapper } = await mountResetPage()
    await flushPromises()
    expect(wrapper.find('form').exists()).toBe(false)
    expect(wrapper.get('[role="alert"]').text()).toContain(reason)
    expect(confirm).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('reopening the same link after success revalidates and rejects it', async () => {
    const validate = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValue(new ApiError(invalidLink, 400))
    installAdapter(validate)
    const first = await mountResetPage()
    await flushPromises()
    await submitPassword(first.wrapper)
    first.wrapper.unmount()
    const second = await mountResetPage()
    await flushPromises()
    expect(validate).toHaveBeenCalledTimes(2)
    expect(second.wrapper.find('form').exists()).toBe(false)
    expect(second.wrapper.text()).toContain('đã được sử dụng')
    second.wrapper.unmount()
  })

  it('hides an already open form if another tab consumes the token', async () => {
    installAdapter(undefined, vi.fn().mockRejectedValue(new ApiError(invalidLink, 400)))
    const { wrapper } = await mountResetPage()
    await flushPromises()
    await submitPassword(wrapper)
    expect(wrapper.find('form').exists()).toBe(false)
    expect(wrapper.text()).toContain('đã được sử dụng')
    wrapper.unmount()
  })

  it('allows retrying validation after a network failure', async () => {
    const validate = vi.fn().mockRejectedValueOnce(new TypeError('network failure')).mockResolvedValue(undefined)
    installAdapter(validate)
    const { wrapper } = await mountResetPage()
    await flushPromises()
    expect(wrapper.find('form').exists()).toBe(false)
    const retry = wrapper.findAll('button').find(button => button.text() === 'Thử lại')!
    await retry.trigger('click')
    await flushPromises()
    expect(validate).toHaveBeenCalledTimes(2)
    expect(wrapper.find('form').exists()).toBe(true)
    wrapper.unmount()
  })

  it('ignores validation results for a previous token when the URL changes', async () => {
    let resolveOld!: () => void
    const validate = vi.fn()
      .mockImplementationOnce(() => new Promise<void>(done => { resolveOld = done }))
      .mockRejectedValue(new ApiError(invalidLink, 400))
    installAdapter(validate)
    const { wrapper, router } = await mountResetPage('old-token')
    await router.push('/auth/reset-password?token=used-token')
    await flushPromises()
    resolveOld()
    await flushPromises()
    expect(wrapper.find('form').exists()).toBe(false)
    expect(wrapper.text()).toContain('đã được sử dụng')
    expect(validate.mock.calls[0]![1].aborted).toBe(true)
    wrapper.unmount()
  })

  it('cancels validation when the page unmounts', async () => {
    const { validate } = installAdapter(vi.fn().mockImplementation(() => new Promise(() => {})))
    const { wrapper } = await mountResetPage()
    wrapper.unmount()
    expect(validate.mock.calls[0]![1].aborted).toBe(true)
  })

  it('keeps the form hidden when token validation is unavailable', async () => {
    configureAuthAdapter({ login: vi.fn(), register: vi.fn(), requestPasswordReset: vi.fn() })
    const { wrapper } = await mountResetPage()
    await flushPromises()
    expect(wrapper.find('form').exists()).toBe(false)
    expect(wrapper.text()).toContain('Dịch vụ tài khoản chưa được kết nối')
    wrapper.unmount()
  })

  it('ignores confirmation after navigating away from the token', async () => {
    let resolve!: () => void
    installAdapter(undefined, vi.fn().mockImplementation(() => new Promise<void>(done => { resolve = done })))
    const { wrapper, router } = await mountResetPage()
    await flushPromises()
    await wrapper.get('#reset-new-password').setValue('NewPassword123')
    await wrapper.get('#reset-confirm-password').setValue('NewPassword123')
    await wrapper.get('form').trigger('submit')
    await router.push('/auth/reset-password')
    resolve()
    await flushPromises()
    expect(wrapper.text()).not.toContain('Mật khẩu đã được cập nhật thành công')
    expect(wrapper.text()).toContain('thiếu mã xác thực')
    wrapper.unmount()
  })

  it('sends validation through the HTTP adapter without caching', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchSpy)
    const adapter = createHttpAuthAdapter('http://localhost:8080')
    const controller = new AbortController()
    await adapter.validatePasswordReset!('test-token', controller.signal)
    expect(fetchSpy).toHaveBeenCalledWith('http://localhost:8080/api/auth/password-reset/validate', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ token: 'test-token' }), cache: 'no-store', signal: controller.signal,
    }))
  })
})

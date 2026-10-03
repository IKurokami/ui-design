import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import ResetPasswordPage from '../src/features/auth/pages/ResetPasswordPage.vue'
import { configureAuthAdapter } from '../src/features/auth/services/auth.service'

describe('ResetPasswordPage integration', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('displays warning when opened without token in query', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/auth/reset-password', component: ResetPasswordPage }],
    })
    await router.push('/auth/reset-password')
    await router.isReady()

    const wrapper = mount(ResetPasswordPage, {
      global: { plugins: [router] },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('Liên kết đặt lại mật khẩu không hợp lệ hoặc thiếu mã xác thực')
  })

  it('renders form and allows submitting new password when token is present', async () => {
    const confirmSpy = vi.fn().mockResolvedValue(undefined)
    configureAuthAdapter({
      login: vi.fn(),
      register: vi.fn(),
      requestPasswordReset: vi.fn(),
      validatePasswordReset: vi.fn().mockResolvedValue(undefined),
      confirmPasswordReset: confirmSpy,
    })

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/auth/reset-password', component: ResetPasswordPage },
        { path: '/login', component: { template: '<div>Login</div>' } },
      ],
    })
    await router.push('/auth/reset-password?token=test-valid-token-123')
    await router.isReady()

    const wrapper = mount(ResetPasswordPage, {
      global: { plugins: [router] },
    })
    await flushPromises()

    const inputs = wrapper.findAll('input')
    expect(inputs.length).toBe(2)

    await inputs[0]!.setValue('NewPassword123')
    await inputs[1]!.setValue('NewPassword123')

    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(confirmSpy).toHaveBeenCalledWith('test-valid-token-123', 'NewPassword123', expect.anything())
    expect(wrapper.text()).toContain('Mật khẩu đã được cập nhật thành công')
    expect(wrapper.find('form').exists()).toBe(false)
    wrapper.unmount()
  })
})

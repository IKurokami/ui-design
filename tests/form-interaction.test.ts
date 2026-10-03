import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import LoginForm from '../src/features/auth/components/LoginForm.vue'
import RegisterForm from '../src/features/auth/components/RegisterForm.vue'
const wrappers: ReturnType<typeof mount>[] = []
function render(component: typeof LoginForm | typeof RegisterForm) {
  const wrapper = mount(component, { global: { plugins: [createPinia()] } })
  wrappers.push(wrapper)
  return wrapper
}
afterEach(() => { wrappers.splice(0).forEach(wrapper => wrapper.unmount()) })
describe('form validation timing', () => {
  it('does not display required errors just from focusing and leaving login fields', async () => {
    const wrapper = render(LoginForm)
    for (const input of wrapper.findAll('input:not([type="checkbox"])')) {
      await input.trigger('focus'); await input.trigger('blur')
    }
    expect(wrapper.findAll('[role="alert"]')).toHaveLength(0)
    expect(wrapper.findAll('[aria-invalid="true"]')).toHaveLength(0)
  })
  it('validates login on submit, then clears each error as it is corrected', async () => {
    const wrapper = render(LoginForm)
    await wrapper.find('form').trigger('submit'); await flushPromises()
    expect(wrapper.findAll('[aria-invalid="true"]')).toHaveLength(2)
    await wrapper.find('#login-identity').setValue('reader@example.com')
    expect(wrapper.find('#login-identity').attributes('aria-invalid')).toBe('false')
    expect(wrapper.find('#login-password').attributes('aria-invalid')).toBe('true')
    await wrapper.find('#login-password').setValue('Reading123')
    expect(wrapper.findAll('[role="alert"]')).toHaveLength(0)
  })
  it('does not show registration errors while typing before the first submit', async () => {
    const wrapper = render(RegisterForm)
    await wrapper.find('#register-email').setValue('incomplete@')
    await wrapper.find('#register-email').trigger('blur')
    await wrapper.find('#register-password').setValue('short')
    await wrapper.find('#register-password').trigger('blur')
    expect(wrapper.findAll('[role="alert"]')).toHaveLength(0)
    await wrapper.find('form').trigger('submit'); await flushPromises()
    expect(wrapper.find('#register-email').attributes('aria-invalid')).toBe('true')
    expect(wrapper.find('#register-password').attributes('aria-invalid')).toBe('true')
  })
  it('updates password confirmation when the password changes after a submit', async () => {
    const wrapper = render(RegisterForm)
    await wrapper.find('#register-name').setValue('Reader')
    await wrapper.find('#register-email').setValue('reader@example.com')
    await wrapper.find('#register-password').setValue('Reading123')
    await wrapper.find('#register-confirm').setValue('Reading124')
    await wrapper.find('form').trigger('submit'); await flushPromises()
    expect(wrapper.find('#register-confirm').attributes('aria-invalid')).toBe('true')
    await wrapper.find('#register-password').setValue('Reading124')
    expect(wrapper.find('#register-confirm').attributes('aria-invalid')).toBe('false')
  })
})


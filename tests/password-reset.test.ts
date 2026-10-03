import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, disposePinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import gsap from 'gsap'
import PasswordResetDialog from '../src/features/auth/components/PasswordResetDialog.vue'
import { usePasswordResetStore } from '../src/stores/password-reset.store'
import { authService } from '../src/features/auth/services/auth.service'
import { ApiError } from '../src/services/error-handler'
import App from '../src/app/App.vue'
import { router as productionRouter } from '../src/app/router'

const cleanups: (() => void)[] = []
beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({ matches: false }))
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: { configurable: true, value: function(this: HTMLDialogElement) { this.setAttribute('open', '') } },
    close: { configurable: true, value: function(this: HTMLDialogElement) {
      if (!this.open) return
      this.removeAttribute('open')
      queueMicrotask(() => this.dispatchEvent(new Event('close')))
    } },
  })
})
afterEach(() => { cleanups.splice(0).reverse().forEach(cleanup => cleanup()); vi.restoreAllMocks(); vi.unstubAllGlobals(); document.body.innerHTML = '' })
function setup(pinia = createPinia(), background?: HTMLElement) {
  const wrapper = mount(PasswordResetDialog, { attachTo: document.body, props: { background }, global: { plugins: [pinia] } })
  const flow = usePasswordResetStore(pinia)
  cleanups.push(() => { wrapper.unmount(); disposePinia(pinia) })
  const panel = wrapper.get('.reset-dialog').element as HTMLElement
  vi.spyOn(panel, 'getBoundingClientRect').mockImplementation(() => new DOMRect(100, 100, 480, 520))
  return { wrapper, flow, panel, pinia, dialog: wrapper.get('dialog').element as HTMLDialogElement }
}
function modalTimeline(panel: HTMLElement) {
  return gsap.getTweensOf(panel).find(tween => tween.duration() > 0 && tween.parent !== gsap.globalTimeline)?.parent as gsap.core.Timeline | undefined
}
function finishModal(panel: HTMLElement) { modalTimeline(panel)?.totalProgress(1) }
function deferred() {
  let resolve!: () => void
  let reject!: (error: unknown) => void
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

describe('password reset dialog motion and retained state', () => {
  it('animates the panel and backdrop, closes only after exit and restores focus', async () => {
    const opener = document.createElement('button')
    document.body.append(opener); opener.focus()
    const { wrapper, panel, dialog } = setup()
    wrapper.vm.open()
    const entering = modalTimeline(panel)!
    entering.pause().progress(0.5)
    expect(dialog.open).toBe(true)
    expect(Number(panel.style.opacity)).toBeGreaterThan(0)
    expect(Number(panel.style.opacity)).toBeLessThan(1)
    expect(Number(gsap.getProperty(panel, 'scaleX'))).toBeGreaterThan(0.12)
    expect(Number(gsap.getProperty(panel, 'scaleX'))).toBeLessThan(1)
    entering.progress(1)
    expect(panel.style.transform).toBe('')
    expect(document.activeElement?.id).toBe('reset-title')
    await wrapper.get('.reset-close').trigger('click')
    const leaving = modalTimeline(panel)!
    leaving.pause().progress(0.5)
    expect(dialog.open).toBe(true)
    leaving.progress(1); await flushPromises()
    expect(dialog.open).toBe(false)
    expect(panel.style.transform).toBe('')
    expect(document.activeElement).toBe(opener)
  })
  it('expands from the explicit clicked button, zooms the page and shrinks to its restored position', async () => {
    const background = document.createElement('div')
    background.style.willChange = 'opacity'
    const opener = document.createElement('button')
    background.append(opener); document.body.append(background)
    vi.spyOn(background, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 1000, 800))
    let source = new DOMRect(700, 430, 100, 20)
    // Model the changed button bounds as the page recedes.
    vi.spyOn(opener, 'getBoundingClientRect').mockImplementation(() => {
      const scale = Number(gsap.getProperty(background, 'scaleX'))
      return new DOMRect(500 + (source.left - 500) * scale, 400 + (source.top - 400) * scale, source.width * scale, source.height * scale)
    })
    const { wrapper, panel, dialog } = setup(createPinia(), background)
    // Pointer clicks need not focus buttons on every browser. The explicit
    // event currentTarget is the source even when another element has focus.
    wrapper.vm.open(opener)
    const entering = modalTimeline(panel)!
    entering.pause().progress(0)
    expect(Number(gsap.getProperty(panel, 'x'))).toBeCloseTo(600)
    expect(Number(gsap.getProperty(panel, 'y'))).toBeCloseTo(330)
    expect(Number(gsap.getProperty(panel, 'scaleX'))).toBeCloseTo(100 / 480)
    expect(Number(gsap.getProperty(panel, 'scaleY'))).toBeCloseTo(20 / 520)
    expect(panel.style.transformOrigin).toBe('0 0')
    expect(wrapper.get('.reset-body').element.getAttribute('style')).toContain('opacity: 0')
    entering.progress(0.5)
    expect(Number(gsap.getProperty(background, 'scaleX'))).toBeGreaterThan(0.96)
    expect(Number(gsap.getProperty(background, 'scaleX'))).toBeLessThan(1)
    entering.progress(1)
    expect(Number(gsap.getProperty(background, 'scaleX'))).toBeCloseTo(0.96)
    expect((wrapper.get('.reset-body').element as HTMLElement).style.opacity).toBe('')
    source = new DOMRect(720, 450, 100, 20)
    wrapper.vm.close()
    const leaving = modalTimeline(panel)!
    const panelTween = leaving.getChildren().find(tween => (tween as gsap.core.Tween).targets().includes(panel)) as gsap.core.Tween
    expect(panelTween.vars.x).toBeCloseTo(620)
    expect(panelTween.vars.y).toBeCloseTo(350)
    leaving.pause().progress(0.5)
    expect(dialog.open).toBe(true)
    expect(Number(gsap.getProperty(background, 'scaleX'))).toBeGreaterThan(0.96)
    leaving.progress(1); await flushPromises()
    expect(background.style.transform).toBe('')
    expect(background.style.transformOrigin).toBe('')
    expect(background.style.willChange).toBe('opacity')
    expect(document.activeElement).toBe(opener)
  })
  it('reverses the source expansion smoothly and restores page styles on native close and unmount', async () => {
    const background = document.createElement('div')
    document.body.append(background)
    const { wrapper, panel, dialog } = setup(createPinia(), background)
    wrapper.vm.open()
    modalTimeline(panel)!.pause().progress(0.3)
    const scale = Number(gsap.getProperty(panel, 'scaleX'))
    const pageScale = Number(gsap.getProperty(background, 'scaleX'))
    wrapper.vm.close()
    expect(Number(gsap.getProperty(panel, 'scaleX'))).toBeCloseTo(scale)
    expect(Number(gsap.getProperty(background, 'scaleX'))).toBeCloseTo(pageScale)
    modalTimeline(panel)!.pause().progress(0.3)
    const returningScale = Number(gsap.getProperty(panel, 'scaleX'))
    wrapper.vm.open()
    expect(Number(gsap.getProperty(panel, 'scaleX'))).toBeCloseTo(returningScale)
    finishModal(panel)
    dialog.close(); await flushPromises()
    expect(background.style.transform).toBe('')
    expect(gsap.getTweensOf(background)).toHaveLength(0)
    wrapper.vm.open()
    modalTimeline(panel)!.pause().progress(0.5)
    wrapper.unmount()
    expect(background.style.transform).toBe('')
    expect(gsap.getTweensOf(background)).toHaveLength(0)
  })
  it('keeps the same input, draft, validation error, focus and scroll after an outside click', async () => {
    const { wrapper, flow, panel, dialog } = setup()
    wrapper.vm.open(); finishModal(panel)
    const input = wrapper.get('#reset-email').element as HTMLInputElement
    await wrapper.get('#reset-email').setValue('unfinished@')
    await wrapper.get('form').trigger('submit'); await flushPromises()
    const error = flow.emailError
    expect(error).not.toBe('')
    input.focus(); panel.scrollTop = 24
    await wrapper.get('.reset-backdrop').trigger('pointerdown', { button: 0, clientX: 0, clientY: 0 })
    await wrapper.get('.reset-backdrop').trigger('click', { clientX: 0, clientY: 0 })
    expect(wrapper.get('dialog').attributes('data-state')).toBe('closing')
    finishModal(panel); await flushPromises()
    expect(dialog.open).toBe(false)
    expect(flow.email).toBe('unfinished@')
    expect(flow.emailError).toBe(error)
    wrapper.vm.open(); finishModal(panel)
    expect(wrapper.get('#reset-email').element).toBe(input)
    expect(input.value).toBe('unfinished@')
    expect(document.activeElement).toBe(input)
    expect(panel.scrollTop).toBe(24)
    expect(flow.step).toBe('email')
  })
  it('preserves state on Escape, ignores panel padding and ignores drags that started inside', async () => {
    const { wrapper, panel, dialog } = setup()
    wrapper.vm.open(); finishModal(panel)
    await wrapper.get('#reset-email').setValue('reader@example.com')
    await wrapper.get('.reset-dialog').trigger('pointerdown', { button: 0, clientX: 110, clientY: 110 })
    await wrapper.get('.reset-dialog').trigger('click', { clientX: 110, clientY: 110 })
    expect(wrapper.get('dialog').attributes('data-state')).toBe('open')
    await wrapper.get('#reset-email').trigger('pointerdown', { button: 0, clientX: 200, clientY: 250 })
    await wrapper.get('.reset-backdrop').trigger('click', { clientX: 0, clientY: 0 })
    expect(wrapper.get('dialog').attributes('data-state')).toBe('open')
    const cancel = new Event('cancel', { cancelable: true })
    dialog.dispatchEvent(cancel)
    expect(cancel.defaultPrevented).toBe(true)
    finishModal(panel); await flushPromises()
    wrapper.vm.open(); finishModal(panel)
    expect((wrapper.get('#reset-email').element as HTMLInputElement).value).toBe('reader@example.com')
  })
  it('reverses a closing animation and ignores a stale native close event after reopening', async () => {
    const { wrapper, panel, dialog } = setup()
    wrapper.vm.open(); finishModal(panel)
    await wrapper.get('#reset-email').setValue('keep@example.com')
    wrapper.vm.close()
    modalTimeline(panel)!.pause().progress(0.4)
    wrapper.vm.open(); finishModal(panel)
    expect(dialog.open).toBe(true)
    expect(wrapper.get('dialog').attributes('data-state')).toBe('open')
    wrapper.vm.close(); finishModal(panel)
    wrapper.vm.open(); finishModal(panel)
    await flushPromises()
    expect(dialog.open).toBe(true)
    expect(wrapper.get('dialog').attributes('data-state')).toBe('open')
    expect((wrapper.get('#reset-email').element as HTMLInputElement).value).toBe('keep@example.com')
  })
  it('keeps a pending request running when closed, blocks duplicate submits and reopens at the acknowledged step', async () => {
    const response = deferred()
    const send = vi.spyOn(authService, 'requestPasswordReset').mockReturnValue(response.promise)
    const { wrapper, flow, panel, dialog } = setup()
    wrapper.vm.open(); finishModal(panel)
    await wrapper.get('#reset-email').setValue(' reader@example.com ')
    await wrapper.get('form').trigger('submit')
    await wrapper.get('form').trigger('submit')
    expect(send).toHaveBeenCalledOnce()
    expect(send.mock.calls[0]![0]).toBe('reader@example.com')
    expect(flow.step).toBe('email')
    expect(flow.loading).toBe(true)
    expect(wrapper.get('.reset-close').attributes('disabled')).toBeUndefined()
    wrapper.vm.close(); finishModal(panel); await flushPromises()
    expect(dialog.open).toBe(false)
    expect(send.mock.calls[0]![1]!.aborted).toBe(false)
    wrapper.vm.open(); finishModal(panel)
    expect(wrapper.get('dialog').attributes('aria-busy')).toBe('true')
    response.resolve(); await flushPromises()
    expect(flow.step).toBe('sent')
    expect(flow.submittedEmail).toBe('reader@example.com')
    expect(flow.sendCount).toBe(1)
    wrapper.vm.close(); finishModal(panel); await flushPromises()
    wrapper.vm.open(); finishModal(panel)
    expect(wrapper.get('dialog').attributes('data-step')).toBe('sent')
    expect(wrapper.get('.reset-email-card strong').text()).toBe('reader@example.com')
    expect(wrapper.get('.reset-progress [aria-current="step"]').text()).toContain('Kiểm tra email')
  })
  it('retains a failure received while hidden and retries from the same email step', async () => {
    const response = deferred()
    const send = vi.spyOn(authService, 'requestPasswordReset').mockReturnValueOnce(response.promise).mockResolvedValue(undefined)
    const { wrapper, flow, panel } = setup()
    wrapper.vm.open(); finishModal(panel)
    await wrapper.get('#reset-email').setValue('reader@example.com')
    await wrapper.get('form').trigger('submit')
    wrapper.vm.close(); finishModal(panel); await flushPromises()
    response.reject(new ApiError('Busy', 503)); await flushPromises()
    expect(flow.step).toBe('email')
    expect(flow.loading).toBe(false)
    expect(flow.message).toContain('Hệ thống đang bận')
    wrapper.vm.open(); finishModal(panel)
    expect(wrapper.get('.reset-form [role="alert"]').text()).toBe(flow.message)
    await wrapper.get('form').trigger('submit'); await flushPromises()
    expect(send).toHaveBeenCalledTimes(2)
    expect(flow.step).toBe('sent')
  })
  it('retains the acknowledged step on resend errors, sends to the confirmed email and allows explicit editing', async () => {
    const send = vi.spyOn(authService, 'requestPasswordReset').mockResolvedValueOnce(undefined).mockRejectedValueOnce(new ApiError('Slow down', 429)).mockResolvedValue(undefined)
    const { wrapper, flow, panel } = setup()
    wrapper.vm.open(); finishModal(panel)
    await wrapper.get('#reset-email').setValue('first@example.com')
    await wrapper.get('form').trigger('submit'); await flushPromises()
    await wrapper.get('.reset-sent-actions button').trigger('click'); await flushPromises()
    expect(flow.step).toBe('sent')
    expect(flow.sendCount).toBe(1)
    expect(flow.submittedEmail).toBe('first@example.com')
    expect(flow.message).toContain('Bạn đã thử quá nhiều lần')
    expect(send.mock.calls[1]![0]).toBe('first@example.com')
    wrapper.vm.close(); finishModal(panel); await flushPromises()
    wrapper.vm.open(); finishModal(panel)
    expect(flow.message).not.toBe('')
    await wrapper.get('.reset-edit').trigger('click')
    expect(flow.step).toBe('email')
    expect(flow.email).toBe('first@example.com')
    await wrapper.get('#reset-email').setValue('second@example.com')
    await wrapper.get('form').trigger('submit'); await flushPromises()
    expect(flow.submittedEmail).toBe('second@example.com')
    expect(flow.sendCount).toBe(1)
  })
  it('keeps state through dialog remount and does not abort when its visual owner unmounts', async () => {
    const response = deferred()
    const send = vi.spyOn(authService, 'requestPasswordReset').mockReturnValue(response.promise)
    const { wrapper, flow, pinia } = setup()
    flow.updateEmail('reader@example.com')
    const request = flow.submit()
    wrapper.unmount()
    expect(send.mock.calls[0]![1]!.aborted).toBe(false)
    response.resolve(); await request
    const reopened = mount(PasswordResetDialog, { attachTo: document.body, global: { plugins: [pinia] } })
    cleanups.push(() => reopened.unmount())
    reopened.vm.open()
    expect(reopened.get('dialog').attributes('data-step')).toBe('sent')
    expect(reopened.get('.reset-email-card strong').text()).toBe('reader@example.com')
  })
  it('animates by default like page navigation and cleans all tweens on unmount', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    const { wrapper, panel, dialog } = setup()
    wrapper.vm.open()
    expect(modalTimeline(panel)!.duration()).toBeGreaterThan(0)
    finishModal(panel); await flushPromises()
    expect(dialog.open).toBe(true)
    expect(panel.style.transform).toBe('')
    wrapper.vm.close(); finishModal(panel); await flushPromises()
    expect(dialog.open).toBe(false)
    wrapper.vm.open()
    wrapper.unmount()
    expect(gsap.getTweensOf(panel)).toHaveLength(0)
  })
})

describe('password reset routing integration', () => {
  it('opens from LoginForm and preserves one dialog and its draft across Home/Auth navigation', async () => {
    window.history.replaceState(null, '', '/login')
    const router = createRouter({ history: createWebHistory(), routes: productionRouter.options.routes })
    const pinia = createPinia()
    await router.push('/login'); await router.isReady()
    const wrapper = mount(App, { attachTo: document.body, global: { plugins: [router, pinia] } })
    cleanups.push(() => { wrapper.unmount(); router.options.history.destroy(); disposePinia(pinia) })
    await flushPromises()
    await wrapper.get('.login-form .form-options .text-link').trigger('click')
    const dialog = wrapper.get('.reset-dialog-shell').element as HTMLDialogElement
    const panel = wrapper.get('.reset-dialog').element as HTMLElement
    finishModal(panel)
    await wrapper.get('#reset-email').setValue('saved@example.com')
    await wrapper.get('.reset-close').trigger('click'); finishModal(panel); await flushPromises()
    await router.push('/'); await flushPromises()
    await router.push('/login'); await flushPromises()
    await wrapper.get('.login-form .form-options .text-link').trigger('click'); finishModal(panel)
    expect(wrapper.get('.reset-dialog-shell').element).toBe(dialog)
    expect(wrapper.findAll('.reset-dialog-shell')).toHaveLength(1)
    expect((wrapper.get('#reset-email').element as HTMLInputElement).value).toBe('saved@example.com')
  })
})

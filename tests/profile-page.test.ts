import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ProfilePage from '../src/features/profile/pages/ProfilePage.vue'

// Mock router
const mockPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useRoute: () => ({ path: '/profile' }),
}))

// Mock api client
const mockRequest = vi.fn()
vi.mock('../src/services/api-client', () => ({
  createApiClient: () => ({
    request: mockRequest,
  }),
}))

describe('ProfilePage - Presentation & Inline Edit', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockPush.mockReset()
    mockRequest.mockReset()

    // Default mock response for GET /api/profile/me
    mockRequest.mockImplementation(async (path: string) => {
      if (path === '/api/profile/me') {
        return {
          id: 'prof-1',
          userId: 'user-1',
          displayName: 'Nguyễn Văn Mộc',
          email: 'moc@example.com',
          avatarUrl: null,
          bannerUrl: null,
          bio: 'Yêu thích đọc sách và thiết kế giao diện.',
        }
      }
      return {}
    })
  })

  it('renders profile in display mode by default without active inputs', async () => {
    const wrapper = mount(ProfilePage)
    // Wait for onMounted fetch
    await new Promise(resolve => setTimeout(resolve, 50))
    await wrapper.vm.$nextTick()

    // Display Name should be rendered as heading, not input
    expect(wrapper.find('.name-display h2').text()).toBe('Nguyễn Văn Mộc')
    expect(wrapper.find('.name-input').exists()).toBe(false)

    // Email should be displayed
    expect(wrapper.find('.user-email').text()).toBe('moc@example.com')

    // Bio should be rendered as beautiful card text, not textarea
    expect(wrapper.find('.bio-content-text').text()).toBe('Yêu thích đọc sách và thiết kế giao diện.')
    expect(wrapper.find('.bio-textarea').exists()).toBe(false)

    // Banner and avatar should be present
    expect(wrapper.find('.profile-banner-wrap').exists()).toBe(true)
    expect(wrapper.find('.profile-avatar-wrap').exists()).toBe(true)
  })

  it('transforms bio into a textarea only when clicked', async () => {
    const wrapper = mount(ProfilePage)
    await new Promise(resolve => setTimeout(resolve, 50))
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.bio-textarea').exists()).toBe(false)

    // Click on bio text
    await wrapper.find('.bio-content-text').trigger('click')

    // Now textarea must be visible!
    const textarea = wrapper.find('.bio-textarea')
    expect(textarea.exists()).toBe(true)
    expect((textarea.element as HTMLTextAreaElement).value).toBe('Yêu thích đọc sách và thiết kế giao diện.')

    // Clicking cancel reverts back to display mode
    await wrapper.find('.btn-text.btn-cancel').trigger('click')
    expect(wrapper.find('.bio-textarea').exists()).toBe(false)
    expect(wrapper.find('.bio-content-text').exists()).toBe(true)
  })

  it('transforms displayName into an input field only when clicked', async () => {
    const wrapper = mount(ProfilePage)
    await new Promise(resolve => setTimeout(resolve, 50))
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.name-input').exists()).toBe(false)

    // Click on display name
    await wrapper.find('.name-display').trigger('click')

    // Now input is visible
    const input = wrapper.find('.name-input')
    expect(input.exists()).toBe(true)
    expect((input.element as HTMLInputElement).value).toBe('Nguyễn Văn Mộc')

    // Clicking cancel reverts
    await wrapper.find('.name-edit-box .btn-cancel').trigger('click')
    expect(wrapper.find('.name-input').exists()).toBe(false)
    expect(wrapper.find('.name-display').exists()).toBe(true)
  })

  it('triggers file input when clicking on avatar or banner', async () => {
    const wrapper = mount(ProfilePage)
    await new Promise(resolve => setTimeout(resolve, 50))
    await wrapper.vm.$nextTick()

    const avatarInput = wrapper.findAll('input[type="file"]')[0]
    const bannerInput = wrapper.findAll('input[type="file"]')[1]

    const avatarClickSpy = vi.spyOn(avatarInput.element as HTMLInputElement, 'click')
    const bannerClickSpy = vi.spyOn(bannerInput.element as HTMLInputElement, 'click')

    await wrapper.find('.profile-avatar-wrap').trigger('click')
    expect(avatarClickSpy).toHaveBeenCalled()

    await wrapper.find('.profile-banner-wrap').trigger('click')
    expect(bannerClickSpy).toHaveBeenCalled()
  })
})

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import UserAvatar from '../src/components/ui/UserAvatar.vue'

describe('UserAvatar with GitHub Identicon fallback', () => {
  it('renders GitHub-style Identicon SVG when no image src is provided', () => {
    const wrapper = mount(UserAvatar, {
      props: {
        seed: 'testuser@example.com',
        name: 'Test User',
        size: 36,
      },
    })

    expect(wrapper.find('img').exists()).toBe(false)
    const svg = wrapper.find('svg.identicon-svg')
    expect(svg.exists()).toBe(true)
    expect(svg.attributes('viewBox')).toBe('0 0 7 7')
    expect(svg.attributes('shape-rendering')).toBe('crispEdges')

    // Has background rect and filled grid rects
    const rects = svg.findAll('rect')
    expect(rects.length).toBeGreaterThan(1)
  })

  it('generates identical identicon for the same seed (deterministic)', () => {
    const wrapper1 = mount(UserAvatar, {
      props: { seed: 'same-user-id' },
    })
    const wrapper2 = mount(UserAvatar, {
      props: { seed: 'same-user-id' },
    })

    expect(wrapper1.find('svg').html()).toBe(wrapper2.find('svg').html())
  })

  it('generates different identicons for different seeds', () => {
    const wrapper1 = mount(UserAvatar, {
      props: { seed: 'alice' },
    })
    const wrapper2 = mount(UserAvatar, {
      props: { seed: 'bob' },
    })

    expect(wrapper1.find('svg').html()).not.toBe(wrapper2.find('svg').html())
  })

  it('renders img when valid src is provided', () => {
    const wrapper = mount(UserAvatar, {
      props: {
        src: 'https://example.com/avatar.png',
        name: 'Avatar Test',
      },
    })

    const img = wrapper.find('img.avatar-img')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe('https://example.com/avatar.png')
    expect(wrapper.find('svg.identicon-svg').exists()).toBe(false)
  })

  it('falls back to GitHub Identicon SVG when img encounters an error', async () => {
    const wrapper = mount(UserAvatar, {
      props: {
        src: 'https://broken-image.local/error.png',
        seed: 'fallback-user',
      },
    })

    expect(wrapper.find('img').exists()).toBe(true)

    // Trigger error on image
    await wrapper.find('img').trigger('error')

    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.find('svg.identicon-svg').exists()).toBe(true)
  })
})

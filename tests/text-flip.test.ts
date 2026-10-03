import { afterEach, describe, expect, it } from 'vitest'
import { AnimationManager } from '../src/animations/core/animation-manager'
import { captureFlipText, prepareFlipText } from '../src/animations/navigation/text-flip'
const managers: AnimationManager[] = []
function pair() {
  const before = document.createElement('div')
  const after = document.createElement('div')
  before.dataset.flipId = after.dataset.flipId = 'identity'
  before.innerHTML = '<label data-flip-text="label">Email hoặc tên đăng nhập</label><div><input data-flip-text="placeholder" placeholder="Nhập email hoặc tên đăng nhập" /></div>'
  after.innerHTML = '<label data-flip-text="label">Địa chỉ email</label><div><input data-flip-text="placeholder" placeholder="ban@example.com" /></div>'
  document.body.append(before, after)
  return { before, after }
}
afterEach(() => { managers.splice(0).forEach(manager => manager.dispose()); document.body.innerHTML = '' })
describe('text changes during Flip', () => {
  it('animates changed labels and placeholders without replacing the original controls', async () => {
    const { before, after } = pair()
    const input = after.querySelector('input')!
    const text = prepareFlipText(captureFlipText([before]), [after])
    expect(text.count).toBe(2)
    expect(after.querySelectorAll('.flip-text-clip[aria-hidden="true"]')).toHaveLength(2)
    expect(after.querySelector('.flip-text-layer')!.textContent).toBe('Email hoặc tên đăng nhập')
    const manager = new AnimationManager(); managers.push(manager)
    const animation = manager.play(timeline => text.animate(timeline, 0), false, text.cleanup)
    manager.finish(); await animation
    expect(after.querySelector('input')).toBe(input)
    expect(input.placeholder).toBe('ban@example.com')
    expect(after.querySelector('label')!.textContent).toBe('Địa chỉ email')
    expect(after.querySelector('.flip-text-clip')).toBeNull()
  })
  it('keeps text visible as entropy resolves word by word into accented Vietnamese', async () => {
    const { before, after } = pair()
    const text = prepareFlipText(captureFlipText([before]), [after])
    const layer = after.querySelector<HTMLElement>('.flip-text-layer')!
    const manager = new AnimationManager(); managers.push(manager)
    let master: Parameters<Parameters<typeof manager.play>[0]>[0] | undefined
    const animation = manager.play(timeline => {
      master = timeline
      text.animate(timeline, 0)
    }, false)
    master!.pause().time(0.04)
    expect(layer.textContent!.trim()).not.toBe('Email hoặc tên đăng nhập')
    expect(layer.textContent!.trim()).not.toBe('Địa chỉ email')
    expect(layer.querySelector('.flip-text-entropy')).not.toBeNull()
    expect(layer.style.opacity).not.toBe('0')
    master!.time(0.3)
    expect(layer.textContent!.trim()).toMatch(/^Địa /)
    master!.time(0.4)
    expect(layer.textContent!.trim()).toMatch(/^Địa chỉ /)
    master!.time(0.56)
    expect(layer.textContent!.trim()).toBe('Địa chỉ email')
    await animation
    text.cleanup()
  })
  it('does not animate unchanged text or read user input into animation layers', () => {
    const { before, after } = pair()
    before.querySelector('label')!.textContent = 'Địa chỉ email'
    before.querySelector('input')!.value = 'private@example.com'
    const state = captureFlipText([before])
    expect([...state.values()].some(snapshot => snapshot.text.includes('private'))).toBe(false)
    const text = prepareFlipText(state, [after])
    expect(text.count).toBe(0)
    text.cleanup()
  })
  it('restores text visibility and removes overlays when interrupted', async () => {
    const { before, after } = pair()
    const text = prepareFlipText(captureFlipText([before]), [after])
    const manager = new AnimationManager(); managers.push(manager)
    const animation = manager.play(timeline => text.animate(timeline, 0), false, text.cleanup)
    manager.dispose(); await animation
    expect(after.querySelector('.flip-text-clip')).toBeNull()
    expect(after.querySelector('.is-text-flipping')).toBeNull()
    expect(after.querySelector('.is-text-flipping-placeholder')).toBeNull()
    expect(after.querySelector('label')!.textContent).toBe('Địa chỉ email')
  })
})

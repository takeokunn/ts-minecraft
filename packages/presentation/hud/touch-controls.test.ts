import { describe, expect, it, vi } from 'vitest'
import { bindHeldInput, bindPulseInput, createExclusiveMountOwner } from './touch-controls'

class TestButton extends EventTarget {
  readonly attributes = new Map<string, string>()

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value)
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null
  }

  setPointerCapture(_pointerId: number): void {}
}

const pointerEvent = (type: 'pointerdown' | 'pointerup', pointerId: number): Event => {
  const event = new Event(type, { cancelable: true })
  Object.defineProperty(event, 'pointerId', { value: pointerId })
  return event
}

const asButton = (button: TestButton): HTMLButtonElement => button as unknown as HTMLButtonElement

const keyboardEvent = (type: 'keydown' | 'keyup', key: string, repeat = false): Event => {
  const event = new Event(type, { cancelable: true })
  Object.defineProperties(event, {
    key: { value: key },
    repeat: { value: repeat },
  })
  return event
}

describe('touch control input bindings', () => {
  it('holds an action for Space or Enter and exposes its pressed state', () => {
    const button = new TestButton()
    button.setAttribute('aria-pressed', 'false')
    const onChange = vi.fn<(pressed: boolean) => void>()
    const resets: Array<() => void> = []
    const cleanup = bindHeldInput(asButton(button), onChange, resets)

    const down = keyboardEvent('keydown', ' ')
    button.dispatchEvent(down)
    expect(down.defaultPrevented).toBe(true)
    expect(button.getAttribute('aria-pressed')).toBe('true')
    expect(onChange).toHaveBeenLastCalledWith(true)

    button.dispatchEvent(keyboardEvent('keyup', ' '))
    expect(button.getAttribute('aria-pressed')).toBe('false')
    expect(onChange).toHaveBeenLastCalledWith(false)

    button.dispatchEvent(keyboardEvent('keydown', 'Enter'))
    expect(button.getAttribute('aria-pressed')).toBe('true')
    expect(onChange).toHaveBeenLastCalledWith(true)

    resets[0]?.()
    expect(button.getAttribute('aria-pressed')).toBe('false')
    cleanup()
  })

  it('ignores unrelated and repeated keydown events and removes listeners on cleanup', () => {
    const button = new TestButton()
    const onChange = vi.fn<(pressed: boolean) => void>()
    const cleanup = bindHeldInput(asButton(button), onChange, [])

    button.dispatchEvent(keyboardEvent('keydown', 'a'))
    button.dispatchEvent(keyboardEvent('keydown', 'Enter', true))
    expect(onChange).not.toHaveBeenCalled()

    cleanup()
    button.dispatchEvent(keyboardEvent('keydown', 'Enter'))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('stays held until every pointer and keyboard source is released', () => {
    const button = new TestButton()
    const onChange = vi.fn<(pressed: boolean) => void>()
    const cleanup = bindHeldInput(asButton(button), onChange, [])

    button.dispatchEvent(pointerEvent('pointerdown', 7))
    button.dispatchEvent(keyboardEvent('keydown', ' '))
    button.dispatchEvent(keyboardEvent('keydown', 'Enter'))
    button.dispatchEvent(pointerEvent('pointerup', 7))
    expect(button.getAttribute('aria-pressed')).toBe('true')
    expect(onChange).toHaveBeenLastCalledWith(true)

    button.dispatchEvent(keyboardEvent('keyup', ' '))
    expect(button.getAttribute('aria-pressed')).toBe('true')
    expect(onChange).toHaveBeenLastCalledWith(true)

    button.dispatchEvent(keyboardEvent('keyup', 'Enter'))
    expect(button.getAttribute('aria-pressed')).toBe('false')
    expect(onChange).toHaveBeenLastCalledWith(false)
    cleanup()
  })

  it('pulses exactly once per native click without toggle semantics', () => {
    const button = new TestButton()
    const pulse = vi.fn<() => void>()
    const cleanup = bindPulseInput(asButton(button), pulse)

    const click = new Event('click', { cancelable: true })
    button.dispatchEvent(click)
    expect(click.defaultPrevented).toBe(true)
    expect(pulse).toHaveBeenCalledTimes(1)
    expect(button.getAttribute('aria-pressed')).toBeNull()

    cleanup()
    button.dispatchEvent(new Event('click'))
    expect(pulse).toHaveBeenCalledTimes(1)
  })
})

describe('exclusive touch controls mount ownership', () => {
  it('releases the previous mount before owning the replacement', () => {
    const owner = createExclusiveMountOwner()
    const firstCleanup = vi.fn<() => void>()
    const secondCleanup = vi.fn<() => void>()
    const disposeFirst = owner.claim(firstCleanup)

    const disposeSecond = owner.claim(secondCleanup)
    expect(firstCleanup).toHaveBeenCalledTimes(1)

    disposeFirst()
    expect(firstCleanup).toHaveBeenCalledTimes(1)
    expect(secondCleanup).not.toHaveBeenCalled()

    disposeSecond()
    disposeSecond()
    expect(secondCleanup).toHaveBeenCalledTimes(1)
  })
})

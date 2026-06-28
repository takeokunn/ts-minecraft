import { Option } from 'effect'
import { describe, expect, it, vi } from 'vitest'
import { trapPauseMenuFocus, visiblePauseMenuControls } from './pause-menu-focus'

type MockStyle = Pick<CSSStyleDeclaration, 'display' | 'visibility'>

type MockControlOverrides = {
  readonly disabled?: boolean
  readonly style?: MockStyle
}

const makeControl = (overrides: MockControlOverrides = {}): HTMLElement =>
  ({
    disabled: overrides.disabled ?? false,
    focus: vi.fn(),
    style: {
      display: overrides.style?.display ?? '',
      visibility: overrides.style?.visibility ?? '',
    },
  }) as unknown as HTMLElement

const makeTabEvent = (shiftKey = false): KeyboardEvent =>
  ({
    shiftKey,
    preventDefault: vi.fn(),
  }) as unknown as KeyboardEvent

describe('pause-menu-focus', () => {
  it('filters absent, hidden, and disabled controls', () => {
    const visible = makeControl()
    const hidden = makeControl({ style: { display: 'none', visibility: '' } })
    const disabled = makeControl({ disabled: true })

    expect(visiblePauseMenuControls([
      Option.some(visible),
      Option.none(),
      Option.some(hidden),
      Option.some(disabled),
    ])).toEqual([visible])
  })

  it('wraps Tab from the last control to the first', () => {
    const first = makeControl()
    const last = makeControl()
    const event = makeTabEvent()

    trapPauseMenuFocus(event, [first, last], last)

    expect(event.preventDefault).toHaveBeenCalledOnce()
    expect(first.focus).toHaveBeenCalledOnce()
  })

  it('wraps Shift+Tab from the first control to the last', () => {
    const first = makeControl()
    const last = makeControl()
    const event = makeTabEvent(true)

    trapPauseMenuFocus(event, [first, last], first)

    expect(event.preventDefault).toHaveBeenCalledOnce()
    expect(last.focus).toHaveBeenCalledOnce()
  })

  it('moves focus to the first control when active focus is outside the menu', () => {
    const first = makeControl()
    const second = makeControl()
    const outside = makeControl()
    const event = makeTabEvent()

    trapPauseMenuFocus(event, [first, second], outside)

    expect(event.preventDefault).toHaveBeenCalledOnce()
    expect(first.focus).toHaveBeenCalledOnce()
  })

  it('keeps native tab behavior for controls inside the menu boundaries', () => {
    const first = makeControl()
    const second = makeControl()
    const last = makeControl()
    const event = makeTabEvent()

    trapPauseMenuFocus(event, [first, second, last], second)

    expect(event.preventDefault).not.toHaveBeenCalled()
    expect(first.focus).not.toHaveBeenCalled()
    expect(last.focus).not.toHaveBeenCalled()
  })
})

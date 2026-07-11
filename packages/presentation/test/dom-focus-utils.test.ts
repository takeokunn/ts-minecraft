import { describe, expect, it, vi } from 'vitest'
import {
  asFocusableElement,
  getActiveDocument,
  currentActiveElement,
  restoreFocusIfConnected,
  trapDialogFocus,
  visibleFocusableElements,
} from '@ts-minecraft/presentation/dom-focus-utils'
import { isKeyBindingNavigationKey } from '@ts-minecraft/presentation/settings/key-binding-navigation'

// ─── asFocusableElement ───────────────────────────────────────────────────────
describe('asFocusableElement', () => {
  it('returns null for null input', () => {
    expect(asFocusableElement(null)).toBeNull()
  })

  it('returns null for undefined input', () => {
    expect(asFocusableElement(undefined)).toBeNull()
  })

  it('returns null for an element-like object that has no focus method', () => {
    const noFocus = {} as Element
    expect(asFocusableElement(noFocus)).toBeNull()
  })

  it('returns null when focus is a non-function property', () => {
    const notFn = { focus: 42 } as unknown as Element
    expect(asFocusableElement(notFn)).toBeNull()
  })

  it('returns the element when focus is a function', () => {
    const focusable = { focus: () => {} } as unknown as Element
    expect(asFocusableElement(focusable)).toBe(focusable)
  })

  it('returns the same reference (no copy)', () => {
    const focusable = { focus: () => {} } as unknown as Element
    expect(asFocusableElement(focusable)).toBe(focusable)
  })
})

// ─── getActiveDocument ────────────────────────────────────────────────────────
describe('getActiveDocument', () => {
  it('returns null in a Node.js / non-browser environment (document is undefined)', () => {
    // In vitest with environment:node, `typeof document === 'undefined'` is true
    expect(getActiveDocument()).toBeNull()
  })
})

// ─── currentActiveElement ────────────────────────────────────────────────────
describe('currentActiveElement', () => {
  it('returns null when document is unavailable (Node.js environment)', () => {
    // getActiveDocument() → null → null?.activeElement → undefined → asFocusableElement(undefined) → null
    expect(currentActiveElement()).toBeNull()
  })
})

describe('visibleFocusableElements', () => {
  it('keeps only enabled and visible focusable controls', () => {
    const visible = { focus: vi.fn(), style: {} }
    const disabled = { focus: vi.fn(), style: {}, disabled: true }
    const hidden = { focus: vi.fn(), style: { display: 'none' } }

    expect(
      visibleFocusableElements([
        visible as unknown as Element,
        disabled as unknown as Element,
        hidden as unknown as Element,
        null,
      ]),
    ).toEqual([visible])
  })
})

describe('restoreFocusIfConnected', () => {
  it('restores connected focus targets and ignores detached targets', () => {
    const connected = { focus: vi.fn(), isConnected: true }
    const detached = { focus: vi.fn(), isConnected: false }

    restoreFocusIfConnected(connected as unknown as Element)
    restoreFocusIfConnected(detached as unknown as Element)

    expect(connected.focus).toHaveBeenCalledOnce()
    expect(detached.focus).not.toHaveBeenCalled()
  })
})

describe('trapDialogFocus', () => {
  it('wraps both boundaries and reclaims focus from outside the dialog', () => {
    const first = { focus: vi.fn(), style: {} } as unknown as HTMLElement
    const last = { focus: vi.fn(), style: {} } as unknown as HTMLElement
    const controls = [first, last]

    trapDialogFocus({ shiftKey: false, preventDefault: vi.fn() }, controls, last)
    expect(first.focus).toHaveBeenCalledTimes(1)

    trapDialogFocus({ shiftKey: true, preventDefault: vi.fn() }, controls, first)
    expect(last.focus).toHaveBeenCalledTimes(1)

    trapDialogFocus({ shiftKey: false, preventDefault: vi.fn() }, controls, null)
    expect(first.focus).toHaveBeenCalledTimes(2)
  })
})

describe('isKeyBindingNavigationKey', () => {
  it('reserves Tab for dialog navigation', () => {
    expect(isKeyBindingNavigationKey('Tab')).toBe(true)
    expect(isKeyBindingNavigationKey('KeyW')).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import {
  asFocusableElement,
  getActiveDocument,
  currentActiveElement,
} from '@ts-minecraft/presentation/dom-focus-utils'

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

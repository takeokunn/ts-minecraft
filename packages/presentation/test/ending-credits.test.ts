import { describe, expect, it } from 'vitest'
import { ENDING_CREDITS_TEXT, buildEndingCreditsOverlay } from '../ending-credits'

type TestElement = {
  id: string
  textContent: string | null
  style: { cssText: string }
  readonly children: TestElement[]
  appendChild: (child: TestElement) => TestElement
  setAttribute: (name: string, value: string) => void
}

const makeElement = (): TestElement => {
  const attributes = new Map<string, string>()
  const element: TestElement = {
    id: '',
    textContent: null,
    style: { cssText: '' },
    children: [],
    appendChild: (child) => {
      element.children.push(child)
      return child
    },
    setAttribute: (name, value) => {
      attributes.set(name, value)
    },
  }
  return element
}

const makeDocument = (): Document => ({
  createElement: () => makeElement(),
} as unknown as Document)

describe('presentation/ending-credits', () => {
  it('builds a dismissible ending credits overlay DOM tree', () => {
    const overlay = buildEndingCreditsOverlay(makeDocument()) as unknown as TestElement

    expect(overlay.id).toBe('ending-credits-overlay')
    expect(overlay.style.cssText).toContain('transition:opacity')
    expect(overlay.children).toHaveLength(2)
    expect(overlay.children[0]?.id).toBe('ending-credits-scroll')
    expect(overlay.children[0]?.textContent).toBe(ENDING_CREDITS_TEXT)
    expect(overlay.children[1]?.textContent).toContain('ESC / click')
  })
})

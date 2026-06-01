import { describe, it } from '@effect/vitest'
import { expect, vi } from 'vitest'
import { Option } from 'effect'
import { DomOperationsService } from '../hud/crosshair'
import { buildOverlayDom, createSlotEl } from './inventory-renderer-dom'

type TestElement = HTMLElement & {
  readonly childrenList: TestElement[]
}

const asTestElement = (element: HTMLElement): TestElement => element as TestElement

const makeElement = <K extends keyof HTMLElementTagNameMap>(_tagName: K): HTMLElementTagNameMap[K] => {
  const childrenList: TestElement[] = []
  const element = {
    id: '',
    style: { cssText: '', display: '', background: '', border: '' },
    dataset: {},
    textContent: '',
    title: '',
    childrenList,
  }
  return element as unknown as HTMLElementTagNameMap[K]
}

const makeDom = () => {
  const appended: HTMLElement[] = []
  const appendChildTo = vi.fn((parent: HTMLElement, child: HTMLElement) => {
    asTestElement(parent).childrenList.push(asTestElement(child))
  })
  const dom = DomOperationsService.of({
    _tag: '@minecraft/presentation/DomOperations' as const,
    createElement: makeElement,
    appendChild: vi.fn((element: HTMLElement) => {
      appended.push(element)
    }),
    appendChildTo,
    removeChild: vi.fn(),
    getParentNode: () => Option.none(),
    setInnerHTML: vi.fn(),
    querySelector: () => Option.none(),
  })
  return { dom, appended, appendChildTo }
}

describe('presentation/inventory/inventory-renderer-dom', () => {
  it('creates slot elements with dataset index and base styles', () => {
    const { dom } = makeDom()

    const slot = createSlotEl(dom, 7)

    expect(slot.dataset['slot']).toBe('7')
    expect(slot.style.cssText).toContain('width:48px')
    expect(slot.style.cssText).toContain('height:48px')
    expect(slot.style.cssText).toContain('background:#333333')
  })

  it('builds overlay DOM with inventory slots, crafting list, status text, and append behavior', () => {
    const { dom, appended } = makeDom()
    Reflect.set(globalThis as object, 'document', {})

    try {
      const overlay = buildOverlayDom(dom)

      expect(Option.isSome(overlay.overlayEl)).toBe(true)
      expect(overlay.slotEls).toHaveLength(36)
      expect(overlay.slotEls[0]?.dataset['slot']).toBe('0')
      expect(overlay.slotEls[35]?.dataset['slot']).toBe('35')
      expect(Option.getOrUndefined(overlay.statusEl)?.textContent).toBe('Click a recipe to craft it.')
      expect(Option.isSome(overlay.craftingListEl)).toBe(true)
      expect(appended).toHaveLength(1)
      expect(appended[0]?.id).toBe('inventory-overlay')
    } finally {
      Reflect.deleteProperty(globalThis as object, 'document')
    }
  })
})

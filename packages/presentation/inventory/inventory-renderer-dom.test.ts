import { describe, it } from '@effect/vitest'
import { expect, vi } from 'vitest'
import { Option } from 'effect'
import { DomOperationsService } from '../hud/crosshair'
import { buildOverlayDom, createSlotEl } from './inventory-renderer-dom'

type TestElement = HTMLElement & {
  readonly childrenList: TestElement[]
  readonly attributeMap: Record<string, string>
}

const asTestElement = (element: HTMLElement): TestElement => element as TestElement

const makeElement = <K extends keyof HTMLElementTagNameMap>(_tagName: K): HTMLElementTagNameMap[K] => {
  const childrenList: TestElement[] = []
  const attributeMap: Record<string, string> = {}
  const element = {
    id: '',
    tabIndex: 0,
    disabled: false,
    draggable: false,
    placeholder: '',
    type: '',
    value: '',
    style: {
      cssText: '',
      display: '',
      visibility: '',
      background: '',
      backgroundImage: '',
      backgroundSize: '',
      border: '',
      transform: '',
    },
    dataset: {},
    textContent: '',
    title: '',
    childrenList,
    attributeMap,
    focus: vi.fn(),
    setAttribute: vi.fn((name: string, value: string) => {
      attributeMap[name] = String(value)
    }),
    getAttribute: vi.fn((name: string) => attributeMap[name] ?? null),
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
    expect(slot.draggable).toBe(true)
    expect(slot.style.cssText).toContain('width:48px')
    expect(slot.style.cssText).toContain('height:48px')
    expect(slot.style.cssText).toContain('background:#333333')
  })

  it('builds overlay DOM with inventory slots, crafting list, status text, and append behavior', () => {
    const { dom, appended } = makeDom()
    Reflect.set(globalThis as object, 'document', {})

    try {
      const overlay = buildOverlayDom(dom)
      const overlayEl = Option.getOrUndefined(overlay.overlayEl)

      expect(Option.isSome(overlay.overlayEl)).toBe(true)
      expect(overlayEl).toBeDefined()
      if (overlayEl === undefined) return
      expect(overlayEl?.getAttribute('role')).toBe('dialog')
      expect(overlayEl?.getAttribute('aria-modal')).toBe('true')
      expect(overlayEl?.getAttribute('aria-labelledby')).toBe('inventory-overlay-title')
      expect(overlayEl?.getAttribute('aria-describedby')).toContain('inventory-overlay-description')
      expect(overlayEl?.getAttribute('aria-describedby')).toContain('inventory-overlay-status')
      expect(overlayEl?.tabIndex).toBe(-1)
      expect(asTestElement(overlayEl).childrenList[0]?.id).toBe('inventory-overlay-title')
      expect(asTestElement(overlayEl).childrenList[1]?.id).toBe('inventory-overlay-description')
      expect(overlay.slotEls).toHaveLength(36)
      expect(overlay.slotEls[0]?.dataset['slot']).toBe('0')
      expect(overlay.slotEls[35]?.dataset['slot']).toBe('35')
      expect(overlay.chestSlotEls[0]?.draggable).toBe(true)
      const status = Option.getOrUndefined(overlay.statusEl)
      expect(status?.id).toBe('inventory-overlay-status')
      expect(status?.getAttribute('role')).toBe('status')
      expect(status?.getAttribute('aria-live')).toBe('polite')
      expect(status?.textContent).toBe('Click a recipe to craft it.')
      const sortButton = Option.getOrUndefined(overlay.sortButtonEl)
      expect(sortButton?.textContent).toBe('Sort Inventory (R)')
      expect(sortButton?.getAttribute('aria-label')).toBe('Sort inventory slots')
      expect(sortButton?.dataset['inventoryAction']).toBe('sort')
      expect(Option.isSome(overlay.recipeBookEl)).toBe(true)
      const search = Option.getOrUndefined(overlay.recipeBookSearchEl)
      expect(search?.id).toBe('inventory-recipe-search')
      expect(search?.getAttribute('aria-labelledby')).toBe('inventory-recipe-search-label')
      expect(search?.placeholder).toContain('Search by name')
      expect(Option.isSome(overlay.craftingPreviewEl)).toBe(true)
      expect(Option.isSome(overlay.craftingListEl)).toBe(true)
      const cursor = Option.getOrUndefined(overlay.cursorEl)
      expect(cursor?.dataset['inventoryCursor']).toBe('held')
      expect(cursor?.style.cssText).toContain('pointer-events:none')
      expect(cursor?.style.cssText).toContain('display:none')
      expect(Option.isSome(overlay.sortButtonEl)).toBe(true)
      expect(appended).toHaveLength(1)
      expect(appended[0]?.id).toBe('inventory-overlay')
    } finally {
      Reflect.deleteProperty(globalThis as object, 'document')
    }
  })
})

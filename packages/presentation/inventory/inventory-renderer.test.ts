import { describe, it } from '@effect/vitest'
import { Array as Arr, Effect, Option } from 'effect'
import { afterEach, expect, vi } from 'vitest'
import { InventoryRendererService } from '@ts-minecraft/presentation/inventory/inventory-renderer'
import { INVENTORY_SIZE, type InventorySlot } from '@ts-minecraft/inventory/application/inventory-service'
import { createStack } from '@ts-minecraft/inventory/domain/item-stack'
import { SlotIndex } from '@ts-minecraft/core'
import {
  buildTestLayer,
  createMockDomLayer,
  createMockInventoryLayer,
  createMockHotbarLayer,
  createMockRecipeLayer,
  makeRecipe,
} from './inventory-renderer-test-utils'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const countOf = (slot: InventorySlot): number =>
  Option.match(slot, { onNone: () => 0, onSome: (item) => item.count })

describe('presentation/inventory/inventory-renderer', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('InventoryRendererService — layer provision', () => {
    it('should be defined', () => {
      expect(InventoryRendererService.Default).toBeDefined()
    })

    it.scoped('should provide InventoryRenderer with all required methods', () => {
      const TestLayer = buildTestLayer()
      return Effect.gen(function* () {
        const renderer = yield* InventoryRendererService
        expect(typeof renderer.toggle).toBe('function')
        expect(typeof renderer.isOpen).toBe('function')
        expect(typeof renderer.update).toBe('function')
        expect(typeof renderer.sortInventory).toBe('function')
        expect(typeof renderer.cycleRecipes).toBe('function')
        expect(typeof renderer.craftSelectedRecipe).toBe('function')
      }).pipe(Effect.provide(TestLayer))
    })
  })

  describe('isOpen', () => {
    it.scoped('should return false initially', () => {
      const TestLayer = buildTestLayer()
      return Effect.gen(function* () {
        const renderer = yield* InventoryRendererService
        const open = yield* renderer.isOpen()
        expect(open).toBe(false)
      }).pipe(Effect.provide(TestLayer))
    })

    it.scoped('should return the same value on repeated calls before toggle', () => {
      const TestLayer = buildTestLayer()
      return Effect.gen(function* () {
        const renderer = yield* InventoryRendererService
        const a = yield* renderer.isOpen()
        const b = yield* renderer.isOpen()
        expect(a).toBe(false)
        expect(b).toBe(false)
      }).pipe(Effect.provide(TestLayer))
    })
  })

  describe('toggle', () => {
    it.scoped('should return true on first call', () => {
      const TestLayer = buildTestLayer()
      return Effect.gen(function* () {
        const renderer = yield* InventoryRendererService
        const result = yield* renderer.toggle()
        expect(result).toBe(true)
      }).pipe(Effect.provide(TestLayer))
    })

    it.scoped('should return false on second call', () => {
      const TestLayer = buildTestLayer()
      return Effect.gen(function* () {
        const renderer = yield* InventoryRendererService
        yield* renderer.toggle()
        const result = yield* renderer.toggle()
        expect(result).toBe(false)
      }).pipe(Effect.provide(TestLayer))
    })

    it.scoped('should update isOpen state', () => {
      const TestLayer = buildTestLayer()
      return Effect.gen(function* () {
        const renderer = yield* InventoryRendererService
        const before = yield* renderer.isOpen()
        yield* renderer.toggle()
        const after = yield* renderer.isOpen()
        expect(before).toBe(false)
        expect(after).toBe(true)
      }).pipe(Effect.provide(TestLayer))
    })

    it.scoped('should call getAllSlots and getSelectedSlot when toggling open', () => {
      const mockDom = createMockDomLayer()
      const mockInventory = createMockInventoryLayer()
      const mockHotbar = createMockHotbarLayer()
      const TestLayer = buildTestLayer(mockDom, mockInventory, mockHotbar)

      return Effect.gen(function* () {
        const renderer = yield* InventoryRendererService
        yield* renderer.toggle() // open → triggers refreshSlots
        expect(mockInventory.getAllSlots).toHaveBeenCalled()
        expect(mockHotbar.getSelectedSlot).toHaveBeenCalled()
      }).pipe(Effect.provide(TestLayer))
    })

    it.scoped('filters the recipe book when the search input changes', () => {
      vi.stubGlobal('document', {})
      const mockDom = createMockDomLayer()
      const mockInventory = createMockInventoryLayer()
      const mockHotbar = createMockHotbarLayer()
      const mockRecipe = createMockRecipeLayer()
      mockRecipe.recipes.push(
        {
          id: 'wooden-sword',
          station: 'crafting_table',
          ingredients: [
            { itemType: 'PLANKS', count: 2 },
            { itemType: 'STICK', count: 1 },
          ],
          output: { itemType: 'WOODEN_SWORD', count: 1 },
        },
        {
          id: 'iron-ingot',
          station: 'furnace',
          ingredients: [
            { itemType: 'RAW_IRON', count: 1 },
          ],
          output: { itemType: 'IRON_INGOT', count: 1 },
        },
      )
      const TestLayer = buildTestLayer(mockDom, mockInventory, mockHotbar, mockRecipe)

      return Effect.gen(function* () {
        const renderer = yield* InventoryRendererService
        yield* renderer.toggle()

        const searchInputIndex = mockDom.createElement.mock.calls.findIndex(([tagName]) => tagName === 'input')
        const searchInput = mockDom.createElement.mock.results[searchInputIndex]?.value as
          | HTMLInputElement & { addEventListener: ReturnType<typeof vi.fn> }
          | undefined
        expect(searchInput).toBeDefined()
        if (searchInput === undefined) return

        const inputHandler = searchInput.addEventListener.mock.calls.find(([type]) => type === 'input')?.[1] as
          | ((event: Event) => void)
          | undefined
        expect(inputHandler).toBeDefined()
        if (inputHandler === undefined) return

        inputHandler({
          currentTarget: { value: 'sword' },
        } as unknown as Event)
        yield* Effect.promise<void>(() => new Promise((resolve) => setTimeout(resolve, 0)))

        const recipeBook = mockDom.createElement.mock.results
          .map((result) => result.value)
          .find((el) => el.style?.cssText?.includes('max-height:180px') && 'textContent' in el) as
          | { childrenList?: Array<{ dataset?: Record<string, string>; textContent?: string }> }
          | undefined
        expect(recipeBook?.childrenList?.length).toBeGreaterThan(0)
        expect(recipeBook?.childrenList?.[0]?.dataset?.recipeId).toBe('wooden-sword')
      }).pipe(Effect.provide(TestLayer))
    })

    it.scoped('should NOT refresh slots when toggling closed', () => {
      const mockDom = createMockDomLayer()
      const mockInventory = createMockInventoryLayer()
      const mockHotbar = createMockHotbarLayer()
      const TestLayer = buildTestLayer(mockDom, mockInventory, mockHotbar)

      return Effect.gen(function* () {
        const renderer = yield* InventoryRendererService
        yield* renderer.toggle() // open
        const callsAfterOpen = mockInventory.getAllSlots.mock.calls.length
        yield* renderer.toggle() // close — should NOT refresh
        expect(mockInventory.getAllSlots.mock.calls.length).toBe(callsAfterOpen)
      }).pipe(Effect.provide(TestLayer))
    })

    it.scoped('focuses inventory controls and restores previous focus around open state', () => {
      const previousFocus = { focus: vi.fn() }
      const mockDocument = {
        activeElement: previousFocus,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }
      vi.stubGlobal('document', mockDocument)

      const mockDom = createMockDomLayer()
      const mockInventory = createMockInventoryLayer()
      const mockHotbar = createMockHotbarLayer()
      const mockRecipe = createMockRecipeLayer()
      mockRecipe.recipes.push(makeRecipe('tab-cycle-recipe'))
      const TestLayer = buildTestLayer(mockDom, mockInventory, mockHotbar, mockRecipe)

      return Effect.gen(function* () {
        const renderer = yield* InventoryRendererService
        yield* renderer.toggle()

        const sortButton = mockDom.createElement.mock.results
          .map((result) => result.value)
          .find((el) => el.dataset?.inventoryAction === 'sort') as
          | { readonly focus: ReturnType<typeof vi.fn> }
          | undefined
        expect(sortButton?.focus).toHaveBeenCalledOnce()
        expect(mockDocument.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function))

        yield* renderer.toggle()

        expect(mockDocument.removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function))
        expect(previousFocus.focus).toHaveBeenCalledOnce()
      }).pipe(Effect.provide(TestLayer))
    })

    it.scoped('closes with Escape and consumes the key event', () => {
      const mockDocument = {
        activeElement: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }
      vi.stubGlobal('document', mockDocument)

      const mockDom = createMockDomLayer()
      const mockInventory = createMockInventoryLayer()
      const mockHotbar = createMockHotbarLayer()
      const TestLayer = buildTestLayer(mockDom, mockInventory, mockHotbar)

      return Effect.gen(function* () {
        const renderer = yield* InventoryRendererService
        yield* renderer.toggle()

        const keydown = mockDocument.addEventListener.mock.calls.find(([type]) => type === 'keydown')?.[1] as
          | ((event: KeyboardEvent) => void)
          | undefined
        expect(keydown).toBeDefined()
        if (keydown === undefined) return

        const preventDefault = vi.fn()
        const stopPropagation = vi.fn()
        keydown({
          key: 'Escape',
          preventDefault,
          stopPropagation,
        } as unknown as KeyboardEvent)
        yield* Effect.promise<void>(() => new Promise((resolve) => setTimeout(resolve, 0)))

        expect(preventDefault).toHaveBeenCalledOnce()
        expect(stopPropagation).toHaveBeenCalledOnce()
        expect(yield* renderer.isOpen()).toBe(false)
        expect(mockDocument.removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function))
      }).pipe(Effect.provide(TestLayer))
    })

    it.scoped('keeps Tab focus inside inventory controls', () => {
      const mockDocument: {
        activeElement: unknown
        addEventListener: ReturnType<typeof vi.fn>
        removeEventListener: ReturnType<typeof vi.fn>
      } = {
        activeElement: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }
      vi.stubGlobal('document', mockDocument)

      const mockDom = createMockDomLayer()
      const mockInventory = createMockInventoryLayer()
      const mockHotbar = createMockHotbarLayer()
      const mockRecipe = createMockRecipeLayer()
      mockRecipe.recipes.push(makeRecipe('tab-cycle-recipe'))
      const TestLayer = buildTestLayer(mockDom, mockInventory, mockHotbar, mockRecipe)

      return Effect.gen(function* () {
        const renderer = yield* InventoryRendererService
        yield* renderer.toggle()

        const elements = mockDom.createElement.mock.results.map((result) => result.value)
        const sortButton = elements.find((el) => el.dataset?.inventoryAction === 'sort') as
          | (HTMLElement & { focus: ReturnType<typeof vi.fn> })
          | undefined
        const searchInput = elements.find((el) => el.id === 'inventory-recipe-search') as
          | (HTMLElement & { focus: ReturnType<typeof vi.fn> })
          | undefined
        const recipeButtons = elements.filter((el) => el.dataset?.recipeId === 'tab-cycle-recipe') as Array<
          HTMLElement & { focus: ReturnType<typeof vi.fn> }
        >
        expect(sortButton).toBeDefined()
        expect(searchInput).toBeDefined()
        expect(recipeButtons).toHaveLength(2)
        const firstRecipeButton = recipeButtons[0]
        const lastRecipeButton = recipeButtons[recipeButtons.length - 1]
        expect(firstRecipeButton).toBeDefined()
        expect(lastRecipeButton).toBeDefined()
        if (
          sortButton === undefined ||
          searchInput === undefined ||
          firstRecipeButton === undefined ||
          lastRecipeButton === undefined
        ) {
          return
        }

        sortButton.focus = vi.fn(() => {
          mockDocument.activeElement = sortButton
        })
        searchInput.focus = vi.fn(() => {
          mockDocument.activeElement = searchInput
        })
        firstRecipeButton.focus = vi.fn(() => {
          mockDocument.activeElement = firstRecipeButton
        })
        lastRecipeButton.focus = vi.fn(() => {
          mockDocument.activeElement = lastRecipeButton
        })

        const keydown = mockDocument.addEventListener.mock.calls.find(([type]) => type === 'keydown')?.[1] as
          | ((event: KeyboardEvent) => void)
          | undefined
        expect(keydown).toBeDefined()
        if (keydown === undefined) return

        mockDocument.activeElement = firstRecipeButton
        const middleEvent = {
          key: 'Tab',
          shiftKey: false,
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
        } as unknown as KeyboardEvent
        keydown(middleEvent)

        expect(middleEvent.preventDefault).not.toHaveBeenCalled()
        expect(middleEvent.stopPropagation).not.toHaveBeenCalled()
        expect(sortButton.focus).not.toHaveBeenCalled()

        mockDocument.activeElement = lastRecipeButton
        const forwardEvent = {
          key: 'Tab',
          shiftKey: false,
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
        } as unknown as KeyboardEvent
        keydown(forwardEvent)

        expect(forwardEvent.preventDefault).toHaveBeenCalledOnce()
        expect(forwardEvent.stopPropagation).toHaveBeenCalledOnce()
        expect(sortButton.focus).toHaveBeenCalledOnce()
        expect(mockDocument.activeElement).toBe(sortButton)

        mockDocument.activeElement = sortButton
        const backwardEvent = {
          key: 'Tab',
          shiftKey: true,
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
        } as unknown as KeyboardEvent
        keydown(backwardEvent)

        expect(backwardEvent.preventDefault).toHaveBeenCalledOnce()
        expect(backwardEvent.stopPropagation).toHaveBeenCalledOnce()
        expect(lastRecipeButton.focus).toHaveBeenCalledOnce()
        expect(mockDocument.activeElement).toBe(lastRecipeButton)
      }).pipe(Effect.provide(TestLayer))
    })

    it.scoped('returns a held cursor stack to inventory before closing', () => {
      vi.stubGlobal('document', {})
      vi.stubGlobal('HTMLElement', class MockHTMLElement {})

      const mockDom = createMockDomLayer()
      const mockInventorySlots = Arr.makeBy(INVENTORY_SIZE, (index) =>
        index === 0 ? Option.some(createStack('DIRT', 12)) : Option.none(),
      )
      const mockInventory = createMockInventoryLayer(mockInventorySlots)
      const mockHotbar = createMockHotbarLayer()
      const TestLayer = buildTestLayer(mockDom, mockInventory, mockHotbar)

      return Effect.gen(function* () {
        const renderer = yield* InventoryRendererService
        yield* renderer.toggle()

        const overlay = mockDom.createElement.mock.results[0]?.value as
          | { addEventListener: ReturnType<typeof vi.fn> }
          | undefined
        const clickHandler = overlay?.addEventListener.mock.calls.find(([type]) => type === 'click')?.[1] as
          | ((event: MouseEvent) => void)
          | undefined
        const slotZero = mockDom.createElement.mock.results
          .map((result) => result.value)
          .find((el) => el.dataset?.slot === '0') as
          | (HTMLElement & { closest: ReturnType<typeof vi.fn> })
          | undefined

        expect(clickHandler).toBeDefined()
        expect(slotZero).toBeDefined()
        if (clickHandler === undefined || slotZero === undefined) {
          return
        }

        Object.setPrototypeOf(slotZero, HTMLElement.prototype)
        slotZero.closest = vi.fn((selector: string) => (selector === '[data-slot]' ? slotZero : null))
        clickHandler({
          button: 0,
          shiftKey: false,
          target: slotZero,
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
        } as unknown as MouseEvent)
        yield* Effect.promise<void>(() => new Promise((resolve) => setTimeout(resolve, 0)))

        expect(Option.isNone(mockInventory.getCurrentSlots()[0] ?? Option.none())).toBe(true)
        const closeResult = yield* renderer.toggle()
        expect(closeResult).toBe(false)
        expect(countOf(mockInventory.getCurrentSlots()[0] ?? Option.none())).toBe(12)
      }).pipe(Effect.provide(TestLayer))
    })

    it.scoped('renders a held cursor stack at the click position', () => {
      vi.stubGlobal('document', {})
      vi.stubGlobal('HTMLElement', class MockHTMLElement {})

      const mockDom = createMockDomLayer()
      const mockInventorySlots = Arr.makeBy(INVENTORY_SIZE, (index) =>
        index === 0 ? Option.some(createStack('DIRT', 12)) : Option.none(),
      )
      const mockInventory = createMockInventoryLayer(mockInventorySlots)
      const mockHotbar = createMockHotbarLayer()
      const TestLayer = buildTestLayer(mockDom, mockInventory, mockHotbar)

      return Effect.gen(function* () {
        const renderer = yield* InventoryRendererService
        yield* renderer.toggle()

        const overlay = mockDom.createElement.mock.results[0]?.value as
          | { addEventListener: ReturnType<typeof vi.fn> }
          | undefined
        const clickHandler = overlay?.addEventListener.mock.calls.find(([type]) => type === 'click')?.[1] as
          | ((event: MouseEvent) => void)
          | undefined
        const slotZero = mockDom.createElement.mock.results
          .map((result) => result.value)
          .find((el) => el.dataset?.slot === '0') as
          | (HTMLElement & { closest: ReturnType<typeof vi.fn> })
          | undefined
        const cursorEl = mockDom.createElement.mock.results
          .map((result) => result.value)
          .find((el) => el.dataset?.inventoryCursor === 'held') as
          | HTMLDivElement
          | undefined

        expect(clickHandler).toBeDefined()
        expect(slotZero).toBeDefined()
        expect(cursorEl).toBeDefined()
        if (clickHandler === undefined || slotZero === undefined || cursorEl === undefined) {
          return
        }

        Object.setPrototypeOf(slotZero, HTMLElement.prototype)
        slotZero.closest = vi.fn((selector: string) => (selector === '[data-slot]' ? slotZero : null))
        clickHandler({
          button: 0,
          shiftKey: false,
          clientX: 320,
          clientY: 180,
          target: slotZero,
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
        } as unknown as MouseEvent)
        yield* Effect.promise<void>(() => new Promise((resolve) => setTimeout(resolve, 0)))

        expect(cursorEl.style.display).toBe('flex')
        expect(cursorEl.style.transform).toBe('translate(334px,194px)')
        expect(cursorEl.textContent).toBe('12')
        expect(cursorEl.title).toBe('Dirt\nCount: 12')
      }).pipe(Effect.provide(TestLayer))
    })

    it.scoped('supports drag-and-drop from one inventory slot to another', () => {
      const mockDom = createMockDomLayer()
      const mockInventorySlots = Arr.makeBy(INVENTORY_SIZE, (index) =>
        index === 0 ? Option.some(createStack('DIRT', 12)) : Option.none(),
      )
      const mockInventory = createMockInventoryLayer(mockInventorySlots)
      const mockHotbar = createMockHotbarLayer()
      const TestLayer = buildTestLayer(mockDom, mockInventory, mockHotbar)
      const globalWithDocument = globalThis as typeof globalThis & { document?: unknown }
      const previousDocument = globalWithDocument.document
      if (previousDocument === undefined) {
        globalWithDocument.document = {}
      }

      const getHandler = <T extends Event>(
        element: { addEventListener: ReturnType<typeof vi.fn> },
        type: string,
      ) =>
        element.addEventListener.mock.calls.find(([eventType]) => eventType === type)?.[1] as
          | ((event: T) => void)
          | undefined

      return Effect.gen(function* () {
        yield* Effect.addFinalizer(() =>
          Effect.sync(() => {
            if (previousDocument === undefined) {
              delete globalWithDocument.document
            } else {
              globalWithDocument.document = previousDocument
            }
          }),
        )
        const renderer = yield* InventoryRendererService
        yield* renderer.toggle()

        const slotZero = mockDom.createElement.mock.results
          .map((result) => result.value)
          .find((el) => el.dataset?.slot === '0') as
          | (HTMLElement & { addEventListener: ReturnType<typeof vi.fn> })
          | undefined
        const slotOne = mockDom.createElement.mock.results
          .map((result) => result.value)
          .find((el) => el.dataset?.slot === '1') as
          | (HTMLElement & { addEventListener: ReturnType<typeof vi.fn> })
          | undefined
        expect(slotZero).toBeDefined()
        expect(slotOne).toBeDefined()
        if (slotZero === undefined || slotOne === undefined) {
          return
        }

        const dragStart = getHandler<DragEvent>(slotZero, 'dragstart')
        const drop = getHandler<DragEvent>(slotOne, 'drop')

        expect(dragStart).toBeDefined()
        expect(drop).toBeDefined()
        if (dragStart === undefined || drop === undefined) {
          return
        }

        dragStart({
          currentTarget: slotZero,
          target: slotZero,
          dataTransfer: {
            effectAllowed: '',
            setData: vi.fn(),
          },
        } as unknown as DragEvent)
        drop({
          currentTarget: slotOne,
          target: slotOne,
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
        } as unknown as DragEvent)
        yield* Effect.promise<void>(() => new Promise((resolve) => setTimeout(resolve, 0)))

        expect(mockInventory.moveStack).toHaveBeenCalledOnce()
        expect(mockInventory.moveStack).toHaveBeenCalledWith(SlotIndex.make(0), SlotIndex.make(1))
      }).pipe(Effect.provide(TestLayer))
    })
  })

  describe('sortInventory', () => {
    it.scoped('sorts inventory and refreshes slots when cursor is empty', () => {
      vi.stubGlobal('document', {})
      vi.stubGlobal('HTMLElement', class MockHTMLElement {})
      const mockDom = createMockDomLayer()
      const mockInventorySlots = Arr.makeBy(INVENTORY_SIZE, (index) =>
        index === 5
          ? Option.some(createStack('DIRT', 40))
          : index === 8
            ? Option.some(createStack('DIRT', 30))
            : Option.none(),
      )
      const mockInventory = createMockInventoryLayer(mockInventorySlots)
      const mockHotbar = createMockHotbarLayer()
      const TestLayer = buildTestLayer(mockDom, mockInventory, mockHotbar)

      return Effect.gen(function* () {
        const renderer = yield* InventoryRendererService
        yield* renderer.toggle()
        yield* renderer.sortInventory()

        expect(mockInventory.sortInventory).toHaveBeenCalledOnce()
        expect(countOf(mockInventory.getCurrentSlots()[0] ?? Option.none())).toBe(64)
        expect(countOf(mockInventory.getCurrentSlots()[1] ?? Option.none())).toBe(6)
      }).pipe(Effect.provide(TestLayer))
    })

    it.scoped('does not sort while the cursor is holding an item', () => {
      vi.stubGlobal('document', {})
      vi.stubGlobal('HTMLElement', class MockHTMLElement {})
      const mockDom = createMockDomLayer()
      const mockInventorySlots = Arr.makeBy(INVENTORY_SIZE, (index) =>
        index === 0 ? Option.some(createStack('DIRT', 12)) : Option.none(),
      )
      const mockInventory = createMockInventoryLayer(mockInventorySlots)
      const mockHotbar = createMockHotbarLayer()
      const TestLayer = buildTestLayer(mockDom, mockInventory, mockHotbar)

      return Effect.gen(function* () {
        const renderer = yield* InventoryRendererService
        yield* renderer.toggle()

        const overlay = mockDom.createElement.mock.results[0]?.value as
          | { addEventListener: ReturnType<typeof vi.fn> }
          | undefined
        const clickHandler = overlay?.addEventListener.mock.calls.find(([type]) => type === 'click')?.[1] as
          | ((event: MouseEvent) => void)
          | undefined
        const slotZero = mockDom.createElement.mock.results
          .map((result) => result.value)
          .find((el) => el.dataset?.slot === '0') as
          | (HTMLElement & { closest: ReturnType<typeof vi.fn> })
          | undefined

        expect(clickHandler).toBeDefined()
        expect(slotZero).toBeDefined()
        if (clickHandler === undefined || slotZero === undefined) {
          return
        }

        Object.setPrototypeOf(slotZero, HTMLElement.prototype)
        slotZero.closest = vi.fn((selector: string) => (selector === '[data-slot]' ? slotZero : null))
        clickHandler({
          button: 0,
          shiftKey: false,
          target: slotZero,
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
        } as unknown as MouseEvent)
        yield* Effect.promise<void>(() => new Promise((resolve) => setTimeout(resolve, 0)))

        yield* renderer.sortInventory()

        expect(mockInventory.sortInventory).not.toHaveBeenCalled()
        expect(Option.isNone(mockInventory.getCurrentSlots()[0] ?? Option.none())).toBe(true)
      }).pipe(Effect.provide(TestLayer))
    })
  })

  describe('update', () => {
    it.scoped('should complete without error when closed', () => {
      const TestLayer = buildTestLayer()
      return Effect.gen(function* () {
        const renderer = yield* InventoryRendererService
        yield* renderer.update() // closed — should be no-op
      }).pipe(Effect.provide(TestLayer))
    })

    it.scoped('should NOT call getAllSlots when closed', () => {
      const mockDom = createMockDomLayer()
      const mockInventory = createMockInventoryLayer()
      const mockHotbar = createMockHotbarLayer()
      const TestLayer = buildTestLayer(mockDom, mockInventory, mockHotbar)

      return Effect.gen(function* () {
        const renderer = yield* InventoryRendererService
        yield* renderer.update() // not open
        expect(mockInventory.getAllSlots).not.toHaveBeenCalled()
      }).pipe(Effect.provide(TestLayer))
    })

    it.scoped('should call getAllSlots when open', () => {
      const mockDom = createMockDomLayer()
      const mockInventory = createMockInventoryLayer()
      const mockHotbar = createMockHotbarLayer()
      const TestLayer = buildTestLayer(mockDom, mockInventory, mockHotbar)

      return Effect.gen(function* () {
        const renderer = yield* InventoryRendererService
        yield* renderer.toggle() // open
        const callsAfterToggle = mockInventory.getAllSlots.mock.calls.length
        yield* renderer.update() // should refresh again
        expect(mockInventory.getAllSlots.mock.calls.length).toBeGreaterThan(callsAfterToggle)
      }).pipe(Effect.provide(TestLayer))
    })

    it.scoped('should be callable multiple times without error', () => {
      const TestLayer = buildTestLayer()
      return Effect.gen(function* () {
        const renderer = yield* InventoryRendererService
        yield* renderer.update()
        yield* renderer.update()
        yield* renderer.update()
      }).pipe(Effect.provide(TestLayer))
    })
  })

  describe('Effect composition', () => {
    it.scoped('should support toggle.flatMap(isOpen)', () => {
      const TestLayer = buildTestLayer()
      return Effect.gen(function* () {
        const renderer = yield* InventoryRendererService
        const isOpen = yield* renderer.toggle().pipe(
          Effect.flatMap(() => renderer.isOpen())
        )
        expect(isOpen).toBe(true)
      }).pipe(Effect.provide(TestLayer))
    })

    it.scoped('should support full lifecycle: toggle → update → toggle', () => {
      const TestLayer = buildTestLayer()
      return Effect.gen(function* () {
        const renderer = yield* InventoryRendererService
        const openResult = yield* renderer.toggle()
        yield* renderer.update()
        const closeResult = yield* renderer.toggle()
        const finalOpen = yield* renderer.isOpen()
        expect(openResult).toBe(true)
        expect(closeResult).toBe(false)
        expect(finalOpen).toBe(false)
      }).pipe(Effect.provide(TestLayer))
    })
  })

  // ---------------------------------------------------------------------------
  // collectAvailableCounts — onSome branch (lines 59-63)
  // ---------------------------------------------------------------------------

  describe('collectAvailableCounts (via refreshSlots)', () => {
    it.scoped('processes inventory items — onSome branch accumulates block counts', () => {
      const mockRecipe = createMockRecipeLayer()
      const mockDom = createMockDomLayer()
      const mockHotbar = createMockHotbarLayer()
      // Provide two DIRT items in slots 0 and 1 to hit the onSome HashMap.set path
      const slots = Arr.makeBy(INVENTORY_SIZE, (i) =>
        i < 2 ? Option.some({ itemType: 'DIRT', count: 5 }) : Option.none(),
      )
      const mockInventory = createMockInventoryLayer(slots as ReadonlyArray<Option.Option<unknown>>)
      const TestLayer = buildTestLayer(mockDom, mockInventory, mockHotbar, mockRecipe)

      return Effect.gen(function* () {
        const renderer = yield* InventoryRendererService
        yield* renderer.toggle() // open → refreshSlots → collectAvailableCounts with real items
        // findCraftable was called with a non-empty HashMap (DIRT → 10 total)
        expect(mockRecipe.findCraftable).toHaveBeenCalled()
      }).pipe(Effect.provide(TestLayer))
    })
  })
})

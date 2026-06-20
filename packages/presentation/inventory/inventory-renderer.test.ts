import { describe, it } from '@effect/vitest'
import { Array as Arr, Effect, Option } from 'effect'
import { expect } from 'vitest'
import { InventoryRendererService } from '@ts-minecraft/presentation/inventory/inventory-renderer'
import { INVENTORY_SIZE } from '@ts-minecraft/inventory/application/inventory-service'
import {
  buildTestLayer,
  createMockDomLayer,
  createMockInventoryLayer,
  createMockHotbarLayer,
  createMockRecipeLayer,
} from './inventory-renderer-test-utils'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('presentation/inventory/inventory-renderer', () => {
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

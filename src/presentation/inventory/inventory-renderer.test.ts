import { describe, it } from '@effect/vitest'
import { Array as Arr, Effect, Layer, Option } from 'effect'
import { expect, vi } from 'vitest'
import { InventoryRendererService, InventoryRendererLive } from './inventory-renderer'
import { InventoryService, INVENTORY_SIZE, HOTBAR_START } from '@/application/inventory/inventory-service'
import { HotbarService } from '@/application/hotbar/hotbar-service'
import { DomOperationsService } from '@/presentation/hud/crosshair'
import type { SlotIndex } from '@/shared/kernel'

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

const createMockDomLayer = () => {
  const createElement = vi.fn((_tagName: string) => {
    const el = {
      id: '',
      style: {
        cssText: '',
        display: 'none',
        background: '#333',
        border: '2px solid #666',
      },
      textContent: null as string | null,
      title: '',
      dataset: {} as Record<string, string>,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      remove: vi.fn(),
    } as unknown as HTMLElement
    return el
  })

  const MockDomLayer = Layer.succeed(DomOperationsService, {
    createElement,
    appendChild: vi.fn(),
    appendChildTo: vi.fn(),
    removeChild: vi.fn(),
    getParentNode: vi.fn(() => Option.none()),
    setInnerHTML: vi.fn(),
    querySelector: vi.fn(() => Option.none()),
  } as unknown as DomOperationsService)

  return { MockDomLayer, createElement }
}

const createMockInventoryLayer = (overrideSlots?: ReadonlyArray<Option.Option<unknown>>) => {
  const slots = Option.getOrElse(Option.fromNullable(overrideSlots), () => Arr.makeBy(INVENTORY_SIZE, () => Option.none()))
  const getAllSlots = vi.fn(() => Effect.succeed(slots))
  const getSlot = vi.fn((_: SlotIndex) => Effect.succeed(Option.none()))
  const setSlot = vi.fn((_: SlotIndex, __: unknown) => Effect.void)
  const moveStack = vi.fn((_from: SlotIndex, _to: SlotIndex) => Effect.void)
  const addBlock = vi.fn((_bt: unknown, _count: number) => Effect.succeed(true))
  const removeBlock = vi.fn((_bt: unknown, _count: number) => Effect.succeed(true))
  const getHotbarSlots = vi.fn(() => Effect.succeed(Arr.drop(slots, HOTBAR_START)))
  const serialize = vi.fn(() => Effect.succeed({ slots: [] }))
  const deserialize = vi.fn((_: unknown) => Effect.void)

  const MockInventoryLayer = Layer.succeed(InventoryService, {
    getAllSlots,
    getSlot,
    setSlot,
    moveStack,
    addBlock,
    removeBlock,
    getHotbarSlots,
    serialize,
    deserialize,
  } as unknown as InventoryService)

  return { MockInventoryLayer, getAllSlots, moveStack }
}

const createMockHotbarLayer = (selectedSlot = 0) => {
  const getSelectedSlot = vi.fn(() => Effect.succeed(selectedSlot))
  const MockHotbarLayer = Layer.succeed(HotbarService, {
    getSelectedSlot,
    setSelectedSlot: (_: SlotIndex) => Effect.void,
    getSelectedBlockType: () => Effect.succeed(Option.none()),
    getSlots: () => Effect.succeed([]),
    update: () => Effect.void,
  } as unknown as HotbarService)
  return { MockHotbarLayer, getSelectedSlot }
}

const buildTestLayer = (
  mockDom = createMockDomLayer(),
  mockInventory = createMockInventoryLayer(),
  mockHotbar = createMockHotbarLayer()
) =>
  InventoryRendererLive.pipe(
    Layer.provide(mockDom.MockDomLayer),
    Layer.provide(mockInventory.MockInventoryLayer),
    Layer.provide(mockHotbar.MockHotbarLayer)
  )

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('presentation/inventory/inventory-renderer', () => {
  describe('InventoryRendererLive — layer provision', () => {
    it('should be defined', () => {
      expect(InventoryRendererLive).toBeDefined()
    })

    it.scoped('should provide InventoryRenderer with all required methods', () => {
      const TestLayer = buildTestLayer()
      return Effect.gen(function* () {
        const renderer = yield* InventoryRendererService
        expect(typeof renderer.toggle).toBe('function')
        expect(typeof renderer.isOpen).toBe('function')
        expect(typeof renderer.update).toBe('function')
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
})

import { describe, it, expect, vi } from 'vitest'
import { Effect, Layer, Option } from 'effect'
import { InventoryRenderer, InventoryRendererLive } from './inventory-renderer'
import { InventoryService, INVENTORY_SIZE, HOTBAR_START } from '@/application/inventory/inventory-service'
import { HotbarService } from '@/application/hotbar/hotbar-service'
import { DomOperations } from '@/presentation/hud/crosshair'
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

  const MockDomLayer = Layer.succeed(DomOperations, {
    createElement,
    appendChild: vi.fn(),
    appendChildTo: vi.fn(),
    removeChild: vi.fn(),
    getParentNode: vi.fn(() => null),
    setInnerHTML: vi.fn(),
    querySelector: vi.fn(() => null),
  } as unknown as DomOperations)

  return { MockDomLayer, createElement }
}

const createMockInventoryLayer = (overrideSlots?: ReadonlyArray<Option.Option<unknown>>) => {
  const slots = overrideSlots ?? Array.from({ length: INVENTORY_SIZE }, () => Option.none())
  const getAllSlots = vi.fn(() => Effect.succeed(slots))
  const getSlot = vi.fn((_: SlotIndex) => Effect.succeed(Option.none()))
  const setSlot = vi.fn((_: SlotIndex, __: unknown) => Effect.void)
  const moveStack = vi.fn((_from: SlotIndex, _to: SlotIndex) => Effect.void)
  const addBlock = vi.fn((_bt: unknown, _count: number) => Effect.succeed(true))
  const removeBlock = vi.fn((_bt: unknown, _count: number) => Effect.succeed(true))
  const getHotbarSlots = vi.fn(() => Effect.succeed(slots.slice(HOTBAR_START)))
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

const runScoped = <A>(effect: Effect.Effect<A, never, never>) =>
  Effect.runSync(effect.pipe(Effect.scoped))

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('presentation/inventory/inventory-renderer', () => {
  describe('InventoryRendererLive — layer provision', () => {
    it('should be defined', () => {
      expect(InventoryRendererLive).toBeDefined()
    })

    it('should provide InventoryRenderer with all required methods', () => {
      const TestLayer = buildTestLayer()
      const program = Effect.gen(function* () {
        const renderer = yield* InventoryRenderer
        expect(typeof renderer.initialize).toBe('function')
        expect(typeof renderer.toggle).toBe('function')
        expect(typeof renderer.isOpen).toBe('function')
        expect(typeof renderer.update).toBe('function')
        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = runScoped(program)
      expect(result.success).toBe(true)
    })
  })

  describe('initialize', () => {
    it('should complete without error', () => {
      const TestLayer = buildTestLayer()
      const program = Effect.gen(function* () {
        const renderer = yield* InventoryRenderer
        yield* renderer.initialize()
        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = runScoped(program)
      expect(result.success).toBe(true)
    })

    it('should be callable multiple times without error', () => {
      const TestLayer = buildTestLayer()
      const program = Effect.gen(function* () {
        const renderer = yield* InventoryRenderer
        yield* renderer.initialize()
        yield* renderer.initialize()
        yield* renderer.initialize()
        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = runScoped(program)
      expect(result.success).toBe(true)
    })
  })

  describe('isOpen', () => {
    it('should return false initially', () => {
      const TestLayer = buildTestLayer()
      const program = Effect.gen(function* () {
        const renderer = yield* InventoryRenderer
        return { open: yield* renderer.isOpen() }
      }).pipe(Effect.provide(TestLayer))

      const { open } = runScoped(program)
      expect(open).toBe(false)
    })

    it('should return the same value on repeated calls before toggle', () => {
      const TestLayer = buildTestLayer()
      const program = Effect.gen(function* () {
        const renderer = yield* InventoryRenderer
        const a = yield* renderer.isOpen()
        const b = yield* renderer.isOpen()
        return { a, b }
      }).pipe(Effect.provide(TestLayer))

      const { a, b } = runScoped(program)
      expect(a).toBe(false)
      expect(b).toBe(false)
    })
  })

  describe('toggle', () => {
    it('should return true on first call', () => {
      const TestLayer = buildTestLayer()
      const program = Effect.gen(function* () {
        const renderer = yield* InventoryRenderer
        return { result: yield* renderer.toggle() }
      }).pipe(Effect.provide(TestLayer))

      const { result } = runScoped(program)
      expect(result).toBe(true)
    })

    it('should return false on second call', () => {
      const TestLayer = buildTestLayer()
      const program = Effect.gen(function* () {
        const renderer = yield* InventoryRenderer
        yield* renderer.toggle()
        return { result: yield* renderer.toggle() }
      }).pipe(Effect.provide(TestLayer))

      const { result } = runScoped(program)
      expect(result).toBe(false)
    })

    it('should update isOpen state', () => {
      const TestLayer = buildTestLayer()
      const program = Effect.gen(function* () {
        const renderer = yield* InventoryRenderer
        const before = yield* renderer.isOpen()
        yield* renderer.toggle()
        const after = yield* renderer.isOpen()
        return { before, after }
      }).pipe(Effect.provide(TestLayer))

      const { before, after } = runScoped(program)
      expect(before).toBe(false)
      expect(after).toBe(true)
    })

    it('should call getAllSlots and getSelectedSlot when toggling open', () => {
      const mockDom = createMockDomLayer()
      const mockInventory = createMockInventoryLayer()
      const mockHotbar = createMockHotbarLayer()
      const TestLayer = buildTestLayer(mockDom, mockInventory, mockHotbar)

      const program = Effect.gen(function* () {
        const renderer = yield* InventoryRenderer
        yield* renderer.toggle() // open → triggers refreshSlots
        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      runScoped(program)
      expect(mockInventory.getAllSlots).toHaveBeenCalled()
      expect(mockHotbar.getSelectedSlot).toHaveBeenCalled()
    })

    it('should NOT refresh slots when toggling closed', () => {
      const mockDom = createMockDomLayer()
      const mockInventory = createMockInventoryLayer()
      const mockHotbar = createMockHotbarLayer()
      const TestLayer = buildTestLayer(mockDom, mockInventory, mockHotbar)

      const program = Effect.gen(function* () {
        const renderer = yield* InventoryRenderer
        yield* renderer.toggle() // open
        const callsAfterOpen = mockInventory.getAllSlots.mock.calls.length
        yield* renderer.toggle() // close — should NOT refresh
        return { callsAfterOpen }
      }).pipe(Effect.provide(TestLayer))

      const { callsAfterOpen } = runScoped(program)
      expect(mockInventory.getAllSlots.mock.calls.length).toBe(callsAfterOpen)
    })
  })

  describe('update', () => {
    it('should complete without error when closed', () => {
      const TestLayer = buildTestLayer()
      const program = Effect.gen(function* () {
        const renderer = yield* InventoryRenderer
        yield* renderer.update() // closed — should be no-op
        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = runScoped(program)
      expect(result.success).toBe(true)
    })

    it('should NOT call getAllSlots when closed', () => {
      const mockDom = createMockDomLayer()
      const mockInventory = createMockInventoryLayer()
      const mockHotbar = createMockHotbarLayer()
      const TestLayer = buildTestLayer(mockDom, mockInventory, mockHotbar)

      const program = Effect.gen(function* () {
        const renderer = yield* InventoryRenderer
        yield* renderer.update() // not open
        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      runScoped(program)
      expect(mockInventory.getAllSlots).not.toHaveBeenCalled()
    })

    it('should call getAllSlots when open', () => {
      const mockDom = createMockDomLayer()
      const mockInventory = createMockInventoryLayer()
      const mockHotbar = createMockHotbarLayer()
      const TestLayer = buildTestLayer(mockDom, mockInventory, mockHotbar)

      const program = Effect.gen(function* () {
        const renderer = yield* InventoryRenderer
        yield* renderer.toggle() // open
        const callsAfterToggle = mockInventory.getAllSlots.mock.calls.length
        yield* renderer.update() // should refresh again
        return { callsAfterToggle }
      }).pipe(Effect.provide(TestLayer))

      const { callsAfterToggle } = runScoped(program)
      expect(mockInventory.getAllSlots.mock.calls.length).toBeGreaterThan(callsAfterToggle)
    })

    it('should be callable multiple times without error', () => {
      const TestLayer = buildTestLayer()
      const program = Effect.gen(function* () {
        const renderer = yield* InventoryRenderer
        yield* renderer.update()
        yield* renderer.update()
        yield* renderer.update()
        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = runScoped(program)
      expect(result.success).toBe(true)
    })
  })

  describe('Effect composition', () => {
    it('should support toggle.flatMap(isOpen)', () => {
      const TestLayer = buildTestLayer()
      const program = Effect.gen(function* () {
        const renderer = yield* InventoryRenderer
        const isOpen = yield* renderer.toggle().pipe(
          Effect.flatMap(() => renderer.isOpen())
        )
        return { isOpen }
      }).pipe(Effect.provide(TestLayer))

      const { isOpen } = runScoped(program)
      expect(isOpen).toBe(true)
    })

    it('should support full lifecycle: initialize → toggle → update → toggle', () => {
      const TestLayer = buildTestLayer()
      const program = Effect.gen(function* () {
        const renderer = yield* InventoryRenderer
        yield* renderer.initialize()
        const openResult = yield* renderer.toggle()
        yield* renderer.update()
        const closeResult = yield* renderer.toggle()
        const finalOpen = yield* renderer.isOpen()
        return { openResult, closeResult, finalOpen }
      }).pipe(Effect.provide(TestLayer))

      const result = runScoped(program)
      expect(result.openResult).toBe(true)
      expect(result.closeResult).toBe(false)
      expect(result.finalOpen).toBe(false)
    })
  })
})

import { describe, it } from '@effect/vitest'
import { Effect, Layer, Option } from 'effect'
import { expect, vi } from 'vitest'
import { InventoryRenderer, InventoryRendererLive } from './inventory-renderer'
import { InventoryService, INVENTORY_SIZE } from '@/application/inventory/inventory-service'
import { HotbarService } from '@/application/hotbar/hotbar-service'
import { DomOperations } from '@/presentation/hud/crosshair'
import type { InventorySlot } from '@/application/inventory/inventory-service'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const createEmptySlots = (): InventorySlot[] =>
  Array.from({ length: INVENTORY_SIZE }, () => Option.none<never>())

const createMockInventoryService = (
  slots: InventorySlot[] = createEmptySlots()
) =>
  ({
    getAllSlots: vi.fn(() => Effect.succeed(slots)),
    getSlot: vi.fn((i: number) => Effect.succeed(slots[i] ?? Option.none())),
    setSlot: vi.fn(() => Effect.void),
    moveStack: vi.fn(() => Effect.void),
    addBlock: vi.fn(() => Effect.succeed(true)),
    removeBlock: vi.fn(() => Effect.succeed(true)),
    getHotbarSlots: vi.fn(() => Effect.succeed(slots.slice(27, 36))),
    serialize: vi.fn(() => Effect.succeed({ slots: [] })),
    deserialize: vi.fn(() => Effect.void),
  }) as unknown as InventoryService

const createMockHotbarService = (selectedSlot = 0) =>
  ({
    getSelectedSlot: vi.fn(() => Effect.succeed(selectedSlot)),
    setSelectedSlot: vi.fn(() => Effect.void),
    getSelectedBlockType: vi.fn(() => Effect.succeed(Option.none())),
    getSlots: vi.fn(() => Effect.succeed([])),
    update: vi.fn(() => Effect.void),
  }) as unknown as HotbarService

const createMockDomOperations = () => {
  const elements: Array<{
    id: string
    style: { cssText: string; display: string; border: string; background: string }
    dataset: Record<string, string>
    textContent: string
    title: string
    children: unknown[]
    parentNode: unknown | null
    addEventListener: ReturnType<typeof vi.fn>
    removeEventListener: ReturnType<typeof vi.fn>
    remove: ReturnType<typeof vi.fn>
    querySelector: ReturnType<typeof vi.fn>
  }> = []

  const makeEl = () => {
    const el = {
      id: '',
      style: { cssText: '', display: '', border: '', background: '' },
      dataset: {} as Record<string, string>,
      textContent: '',
      title: '',
      children: [] as unknown[],
      parentNode: null as unknown | null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      remove: vi.fn(() => { el.parentNode = null }),
      querySelector: vi.fn((_selector: string) => null),
    }
    elements.push(el)
    return el
  }

  const dom = {
    createElement: vi.fn((_tag: string) => makeEl()),
    appendChild: vi.fn((el: unknown) => {
      ;(el as { parentNode: unknown }).parentNode = 'body'
    }),
    appendChildTo: vi.fn(),
    removeChild: vi.fn((el: unknown) => {
      ;(el as { parentNode: unknown | null }).parentNode = null
    }),
    getParentNode: vi.fn((el: unknown) => (el as { parentNode: unknown }).parentNode),
    setInnerHTML: vi.fn(),
    querySelector: vi.fn((_el: unknown, _selector: string) => null),
  } as unknown as DomOperations

  return { dom, elements }
}

const buildTestLayer = (
  inventoryService: InventoryService = createMockInventoryService(),
  hotbarService: HotbarService = createMockHotbarService(),
  dom: DomOperations = createMockDomOperations().dom
) => {
  const MockInventoryLayer = Layer.succeed(InventoryService, inventoryService)
  const MockHotbarLayer = Layer.succeed(HotbarService, hotbarService)
  const MockDomLayer = Layer.succeed(DomOperations, dom)
  return InventoryRendererLive.pipe(
    Layer.provide(Layer.merge(Layer.merge(MockInventoryLayer, MockHotbarLayer), MockDomLayer))
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('InventoryRenderer', () => {
  describe('isOpen', () => {
    it('should return false initially', () => {
      const TestLayer = buildTestLayer()

      const program = Effect.gen(function* () {
        const renderer = yield* InventoryRenderer
        const result = yield* renderer.isOpen()
        expect(result).toBe(false)
      })

      Effect.runSync(program.pipe(Effect.provide(TestLayer), Effect.scoped))
    })
  })

  describe('toggle', () => {
    it('should return true after first toggle (open)', () => {
      const TestLayer = buildTestLayer()

      const program = Effect.gen(function* () {
        const renderer = yield* InventoryRenderer
        const result = yield* renderer.toggle()
        expect(result).toBe(true)
      })

      Effect.runSync(program.pipe(Effect.provide(TestLayer), Effect.scoped))
    })

    it('should make isOpen return true after toggle', () => {
      const TestLayer = buildTestLayer()

      const program = Effect.gen(function* () {
        const renderer = yield* InventoryRenderer
        yield* renderer.toggle()
        const result = yield* renderer.isOpen()
        expect(result).toBe(true)
      })

      Effect.runSync(program.pipe(Effect.provide(TestLayer), Effect.scoped))
    })

    it('should return false after second toggle (close)', () => {
      const TestLayer = buildTestLayer()

      const program = Effect.gen(function* () {
        const renderer = yield* InventoryRenderer
        yield* renderer.toggle()
        const result = yield* renderer.toggle()
        expect(result).toBe(false)
      })

      Effect.runSync(program.pipe(Effect.provide(TestLayer), Effect.scoped))
    })

    it('should make isOpen return false after two toggles', () => {
      const TestLayer = buildTestLayer()

      const program = Effect.gen(function* () {
        const renderer = yield* InventoryRenderer
        yield* renderer.toggle()
        yield* renderer.toggle()
        const result = yield* renderer.isOpen()
        expect(result).toBe(false)
      })

      Effect.runSync(program.pipe(Effect.provide(TestLayer), Effect.scoped))
    })

    it('should alternate visibility through multiple toggles', () => {
      const TestLayer = buildTestLayer()

      const program = Effect.gen(function* () {
        const renderer = yield* InventoryRenderer
        const states: boolean[] = []

        states.push(yield* renderer.isOpen())    // false initially

        yield* renderer.toggle()
        states.push(yield* renderer.isOpen())    // true

        yield* renderer.toggle()
        states.push(yield* renderer.isOpen())    // false

        yield* renderer.toggle()
        states.push(yield* renderer.isOpen())    // true

        expect(states).toEqual([false, true, false, true])
      })

      Effect.runSync(program.pipe(Effect.provide(TestLayer), Effect.scoped))
    })

    it('should call getAllSlots and getSelectedSlot when toggled open', () => {
      const mockInventory = createMockInventoryService()
      const mockHotbar = createMockHotbarService()
      const TestLayer = buildTestLayer(mockInventory, mockHotbar)

      const program = Effect.gen(function* () {
        const renderer = yield* InventoryRenderer
        yield* renderer.toggle()  // open
      })

      Effect.runSync(program.pipe(Effect.provide(TestLayer), Effect.scoped))

      expect(mockInventory.getAllSlots).toHaveBeenCalled()
      expect(mockHotbar.getSelectedSlot).toHaveBeenCalled()
    })

    it('should NOT call getAllSlots when toggled closed', () => {
      const mockInventory = createMockInventoryService()
      const TestLayer = buildTestLayer(mockInventory)

      const program = Effect.gen(function* () {
        const renderer = yield* InventoryRenderer
        yield* renderer.toggle()  // open  – calls getAllSlots
        vi.clearAllMocks()
        yield* renderer.toggle()  // close – should NOT call getAllSlots
      })

      Effect.runSync(program.pipe(Effect.provide(TestLayer), Effect.scoped))

      expect(mockInventory.getAllSlots).not.toHaveBeenCalled()
    })
  })

  describe('initialize', () => {
    it('should complete without error', () => {
      const TestLayer = buildTestLayer()

      const program = Effect.gen(function* () {
        const renderer = yield* InventoryRenderer
        yield* renderer.initialize()
      })

      expect(() =>
        Effect.runSync(program.pipe(Effect.provide(TestLayer), Effect.scoped))
      ).not.toThrow()
    })
  })

  describe('update', () => {
    it('should not call getAllSlots when inventory is closed', () => {
      const mockInventory = createMockInventoryService()
      const TestLayer = buildTestLayer(mockInventory)

      const program = Effect.gen(function* () {
        const renderer = yield* InventoryRenderer
        // inventory is closed (default), update should be a no-op
        yield* renderer.update()
      })

      Effect.runSync(program.pipe(Effect.provide(TestLayer), Effect.scoped))

      // getAllSlots is only called during toggle-open, not during update when closed
      expect(mockInventory.getAllSlots).not.toHaveBeenCalled()
    })

    it('should call getAllSlots on update when inventory is open', () => {
      const mockInventory = createMockInventoryService()
      const mockHotbar = createMockHotbarService()
      const TestLayer = buildTestLayer(mockInventory, mockHotbar)

      const program = Effect.gen(function* () {
        const renderer = yield* InventoryRenderer
        yield* renderer.toggle()  // open
        vi.clearAllMocks()
        yield* renderer.update()  // should refresh slots
      })

      Effect.runSync(program.pipe(Effect.provide(TestLayer), Effect.scoped))

      expect(mockInventory.getAllSlots).toHaveBeenCalled()
    })

    it('should not throw even when called multiple times', () => {
      const TestLayer = buildTestLayer()

      const program = Effect.gen(function* () {
        const renderer = yield* InventoryRenderer
        yield* renderer.update()
        yield* renderer.update()
        yield* renderer.update()
      })

      expect(() =>
        Effect.runSync(program.pipe(Effect.provide(TestLayer), Effect.scoped))
      ).not.toThrow()
    })
  })

  describe('integration', () => {
    it('should handle open → close → open cycle', () => {
      const TestLayer = buildTestLayer()

      const program = Effect.gen(function* () {
        const renderer = yield* InventoryRenderer

        // Open
        expect(yield* renderer.toggle()).toBe(true)
        expect(yield* renderer.isOpen()).toBe(true)

        // Close
        expect(yield* renderer.toggle()).toBe(false)
        expect(yield* renderer.isOpen()).toBe(false)

        // Open again
        expect(yield* renderer.toggle()).toBe(true)
        expect(yield* renderer.isOpen()).toBe(true)
      })

      Effect.runSync(program.pipe(Effect.provide(TestLayer), Effect.scoped))
    })

    it('should refresh slots on update when open, no-op when closed', () => {
      const mockInventory = createMockInventoryService()
      const mockHotbar = createMockHotbarService()
      const TestLayer = buildTestLayer(mockInventory, mockHotbar)

      const program = Effect.gen(function* () {
        const renderer = yield* InventoryRenderer

        // update while closed — no getAllSlots
        yield* renderer.update()
        const callsWhenClosed = (mockInventory.getAllSlots as ReturnType<typeof vi.fn>).mock.calls.length

        // toggle open — getAllSlots called (refresh on open)
        yield* renderer.toggle()
        const callsAfterOpen = (mockInventory.getAllSlots as ReturnType<typeof vi.fn>).mock.calls.length

        // update while open — getAllSlots called again
        yield* renderer.update()
        const callsAfterUpdate = (mockInventory.getAllSlots as ReturnType<typeof vi.fn>).mock.calls.length

        return { callsWhenClosed, callsAfterOpen, callsAfterUpdate }
      })

      const result = Effect.runSync(program.pipe(Effect.provide(TestLayer), Effect.scoped))

      expect(result.callsWhenClosed).toBe(0)
      expect(result.callsAfterOpen).toBe(1)
      expect(result.callsAfterUpdate).toBe(2)
    })
  })
})

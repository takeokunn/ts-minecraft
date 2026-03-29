import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr, Effect, Layer, Option } from 'effect'
import * as fc from 'effect/FastCheck'
import type { Block, BlockType } from '@/domain/block'
import { BlockRegistry } from '@/domain/block-registry'
import { PlayerInputService } from '@/application/input/player-input-service'
import { InventoryServiceLive } from '@/application/inventory/inventory-service'
import { HotbarService, HotbarServiceLive, HOTBAR_SIZE } from './hotbar-service'
import type { SlotIndex } from '@/shared/kernel'

// ---------------------------------------------------------------------------
// Shared test infrastructure (mirrors hotbar-service.test.ts)
// ---------------------------------------------------------------------------

const asSlotIndex = (n: number): SlotIndex => n as unknown as SlotIndex

const createTestInputService = (wheelDelta: number = 0) => {
  let pendingWheelDelta = wheelDelta

  return {
    isKeyPressed: (_key: string) => Effect.sync(() => false),
    consumeKeyPress: (_key: string) => Effect.sync(() => false),
    getMouseDelta: () => Effect.sync(() => ({ x: 0, y: 0 })),
    isMouseDown: (_button: number) => Effect.sync(() => false),
    requestPointerLock: () => Effect.sync(() => {}),
    exitPointerLock: () => Effect.sync(() => {}),
    isPointerLocked: () => Effect.sync(() => false),
    consumeMouseClick: (_button: number) => Effect.sync(() => false),
    consumeWheelDelta: () =>
      Effect.sync(() => {
        const delta = pendingWheelDelta
        pendingWheelDelta = 0
        return delta
      }),
    setWheelDelta: (d: number) => { pendingWheelDelta = d },
  }
}

const createTestLayer = (inputService: ReturnType<typeof createTestInputService>) => {
  const inputLayer = Layer.succeed(PlayerInputService, inputService as unknown as PlayerInputService)
  const blockRegistryLayer = Layer.succeed(BlockRegistry, {
    register: (_block: Block) => Effect.void,
    get: (_blockType: BlockType) => Effect.succeed(Option.none<Block>()),
    getAll: () => Effect.succeed([] as Block[]),
    dispose: () => Effect.void,
  } as unknown as BlockRegistry)
  const inventoryLayer = InventoryServiceLive.pipe(Layer.provide(blockRegistryLayer))

  return HotbarServiceLive.pipe(
    Layer.provide(inputLayer),
    Layer.provide(inventoryLayer),
  )
}

// ---------------------------------------------------------------------------
// Property tests
// ---------------------------------------------------------------------------

describe('application/hotbar/hotbar-service (property-based)', () => {
  // -------------------------------------------------------------------------
  // Wheel scroll modular arithmetic:
  //   newSlot = ((current + direction) % HOTBAR_SIZE + HOTBAR_SIZE) % HOTBAR_SIZE
  // where direction = Math.sign(wheelDelta).
  //
  // Invariant: the resulting slot is always in [0, HOTBAR_SIZE - 1].
  // -------------------------------------------------------------------------
  describe('wheel scroll wrap invariants', () => {
    it.effect.prop(
      'slot stays within [0, HOTBAR_SIZE-1] after any wheel scroll from any starting slot',
      {
        startSlot: fc.integer({ min: 0, max: HOTBAR_SIZE - 1 }),
        wheelDelta: fc.oneof(
          fc.integer({ min: 1, max: 10_000 }),
          fc.integer({ min: -10_000, max: -1 }),
        ),
      },
      ({ startSlot, wheelDelta }) => {
        const inputService = createTestInputService()
        const TestLayer = createTestLayer(inputService)

        return Effect.gen(function* () {
          const service = yield* HotbarService
          yield* service.setSelectedSlot(asSlotIndex(startSlot))
          inputService.setWheelDelta(wheelDelta)
          yield* service.update()
          const slot = yield* service.getSelectedSlot()
          expect(slot >= 0 && slot < HOTBAR_SIZE).toBe(true)
        }).pipe(Effect.provide(TestLayer))
      }
    )

    it.effect.prop(
      'scrolling forward from any slot lands at (current + 1) % HOTBAR_SIZE',
      { startSlot: fc.integer({ min: 0, max: HOTBAR_SIZE - 1 }) },
      ({ startSlot }) => {
        const inputService = createTestInputService()
        const TestLayer = createTestLayer(inputService)

        return Effect.gen(function* () {
          const service = yield* HotbarService
          yield* service.setSelectedSlot(asSlotIndex(startSlot))
          inputService.setWheelDelta(100) // positive → direction +1
          yield* service.update()
          const slot = yield* service.getSelectedSlot()
          const expected = (startSlot + 1) % HOTBAR_SIZE
          expect(slot).toBe(expected)
        }).pipe(Effect.provide(TestLayer))
      }
    )

    it.effect.prop(
      'scrolling backward from any slot lands at (current - 1 + HOTBAR_SIZE) % HOTBAR_SIZE',
      { startSlot: fc.integer({ min: 0, max: HOTBAR_SIZE - 1 }) },
      ({ startSlot }) => {
        const inputService = createTestInputService()
        const TestLayer = createTestLayer(inputService)

        return Effect.gen(function* () {
          const service = yield* HotbarService
          yield* service.setSelectedSlot(asSlotIndex(startSlot))
          inputService.setWheelDelta(-100) // negative → direction -1
          yield* service.update()
          const slot = yield* service.getSelectedSlot()
          const expected = ((startSlot - 1) + HOTBAR_SIZE) % HOTBAR_SIZE
          expect(slot).toBe(expected)
        }).pipe(Effect.provide(TestLayer))
      }
    )

    it.effect.prop(
      'scrolling forward HOTBAR_SIZE times returns to the starting slot',
      { startSlot: fc.integer({ min: 0, max: HOTBAR_SIZE - 1 }) },
      ({ startSlot }) => {
        const inputService = createTestInputService()
        const TestLayer = createTestLayer(inputService)

        return Effect.gen(function* () {
          const service = yield* HotbarService
          yield* service.setSelectedSlot(asSlotIndex(startSlot))

          yield* Effect.forEach(Arr.makeBy(HOTBAR_SIZE, () => undefined), () => Effect.gen(function* () {
            inputService.setWheelDelta(100)
            yield* service.update()
          }), { concurrency: 1 })

          const finalSlot = yield* service.getSelectedSlot()
          expect(finalSlot).toBe(startSlot)
        }).pipe(Effect.provide(TestLayer))
      }
    )

    it.effect.prop(
      'scrolling backward HOTBAR_SIZE times returns to the starting slot',
      { startSlot: fc.integer({ min: 0, max: HOTBAR_SIZE - 1 }) },
      ({ startSlot }) => {
        const inputService = createTestInputService()
        const TestLayer = createTestLayer(inputService)

        return Effect.gen(function* () {
          const service = yield* HotbarService
          yield* service.setSelectedSlot(asSlotIndex(startSlot))

          yield* Effect.forEach(Arr.makeBy(HOTBAR_SIZE, () => undefined), () => Effect.gen(function* () {
            inputService.setWheelDelta(-100)
            yield* service.update()
          }), { concurrency: 1 })

          const finalSlot = yield* service.getSelectedSlot()
          expect(finalSlot).toBe(startSlot)
        }).pipe(Effect.provide(TestLayer))
      }
    )

    it.effect.prop(
      'delta magnitude does not affect step size (always moves by exactly 1)',
      {
        startSlot: fc.integer({ min: 0, max: HOTBAR_SIZE - 1 }),
        magnitude: fc.integer({ min: 1, max: 1_000_000 }),
      },
      ({ startSlot, magnitude }) => {
        const inputService = createTestInputService()
        const TestLayer = createTestLayer(inputService)

        return Effect.gen(function* () {
          const service = yield* HotbarService
          yield* service.setSelectedSlot(asSlotIndex(startSlot))
          inputService.setWheelDelta(magnitude)
          yield* service.update()
          const slot = yield* service.getSelectedSlot()
          const expected = (startSlot + 1) % HOTBAR_SIZE
          expect(slot).toBe(expected)
        }).pipe(Effect.provide(TestLayer))
      }
    )
  })
})

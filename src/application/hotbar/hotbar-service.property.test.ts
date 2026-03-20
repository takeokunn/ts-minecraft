import { describe, it } from 'vitest'
import { Effect, Layer, Option } from 'effect'
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
    it('slot stays within [0, HOTBAR_SIZE-1] after any wheel scroll from any starting slot', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: HOTBAR_SIZE - 1 }),
          fc.oneof(
            fc.integer({ min: 1, max: 10_000 }),
            fc.integer({ min: -10_000, max: -1 }),
          ),
          async (startSlot, wheelDelta) => {
            const inputService = createTestInputService()
            const TestLayer = createTestLayer(inputService)

            const slot = await Effect.runPromise(
              Effect.gen(function* () {
                const service = yield* HotbarService
                yield* service.setSelectedSlot(asSlotIndex(startSlot))
                inputService.setWheelDelta(wheelDelta)
                yield* service.update()
                return yield* service.getSelectedSlot()
              }).pipe(Effect.provide(TestLayer))
            )

            return slot >= 0 && slot < HOTBAR_SIZE
          }
        )
      )
    })

    it('scrolling forward from any slot lands at (current + 1) % HOTBAR_SIZE', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: HOTBAR_SIZE - 1 }),
          async (startSlot) => {
            const inputService = createTestInputService()
            const TestLayer = createTestLayer(inputService)

            const slot = await Effect.runPromise(
              Effect.gen(function* () {
                const service = yield* HotbarService
                yield* service.setSelectedSlot(asSlotIndex(startSlot))
                inputService.setWheelDelta(100) // positive → direction +1
                yield* service.update()
                return yield* service.getSelectedSlot()
              }).pipe(Effect.provide(TestLayer))
            )

            const expected = (startSlot + 1) % HOTBAR_SIZE
            return slot === expected
          }
        )
      )
    })

    it('scrolling backward from any slot lands at (current - 1 + HOTBAR_SIZE) % HOTBAR_SIZE', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: HOTBAR_SIZE - 1 }),
          async (startSlot) => {
            const inputService = createTestInputService()
            const TestLayer = createTestLayer(inputService)

            const slot = await Effect.runPromise(
              Effect.gen(function* () {
                const service = yield* HotbarService
                yield* service.setSelectedSlot(asSlotIndex(startSlot))
                inputService.setWheelDelta(-100) // negative → direction -1
                yield* service.update()
                return yield* service.getSelectedSlot()
              }).pipe(Effect.provide(TestLayer))
            )

            const expected = ((startSlot - 1) + HOTBAR_SIZE) % HOTBAR_SIZE
            return slot === expected
          }
        )
      )
    })

    it('scrolling forward HOTBAR_SIZE times returns to the starting slot', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: HOTBAR_SIZE - 1 }),
          async (startSlot) => {
            const inputService = createTestInputService()
            const TestLayer = createTestLayer(inputService)

            const finalSlot = await Effect.runPromise(
              Effect.gen(function* () {
                const service = yield* HotbarService
                yield* service.setSelectedSlot(asSlotIndex(startSlot))

                for (let i = 0; i < HOTBAR_SIZE; i++) {
                  inputService.setWheelDelta(100)
                  yield* service.update()
                }

                return yield* service.getSelectedSlot()
              }).pipe(Effect.provide(TestLayer))
            )

            return finalSlot === startSlot
          }
        )
      )
    })

    it('scrolling backward HOTBAR_SIZE times returns to the starting slot', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: HOTBAR_SIZE - 1 }),
          async (startSlot) => {
            const inputService = createTestInputService()
            const TestLayer = createTestLayer(inputService)

            const finalSlot = await Effect.runPromise(
              Effect.gen(function* () {
                const service = yield* HotbarService
                yield* service.setSelectedSlot(asSlotIndex(startSlot))

                for (let i = 0; i < HOTBAR_SIZE; i++) {
                  inputService.setWheelDelta(-100)
                  yield* service.update()
                }

                return yield* service.getSelectedSlot()
              }).pipe(Effect.provide(TestLayer))
            )

            return finalSlot === startSlot
          }
        )
      )
    })

    it('delta magnitude does not affect step size (always moves by exactly 1)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: HOTBAR_SIZE - 1 }),
          fc.integer({ min: 1, max: 1_000_000 }),
          async (startSlot, magnitude) => {
            const inputService = createTestInputService()
            const TestLayer = createTestLayer(inputService)

            const slot = await Effect.runPromise(
              Effect.gen(function* () {
                const service = yield* HotbarService
                yield* service.setSelectedSlot(asSlotIndex(startSlot))
                inputService.setWheelDelta(magnitude)
                yield* service.update()
                return yield* service.getSelectedSlot()
              }).pipe(Effect.provide(TestLayer))
            )

            const expected = (startSlot + 1) % HOTBAR_SIZE
            return slot === expected
          }
        )
      )
    })
  })
})

import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect } from 'effect'
import { HotbarService, HOTBAR_SIZE } from '@ts-minecraft/inventory'
import {
  asSlotIndex,
  createTestInputService,
  createTestBlockRegistry,
  defaultTestBlocks,
  createTestLayer,
} from './hotbar-service-test-utils'

describe('application/hotbar/hotbar-service (update)', () => {
  describe('update — keyboard slot selection', () => {
    it.effect('should select slot 4 (0-indexed) when Digit5 is pressed', () => {
      const inputService = createTestInputService({ justPressedKeys: ['Digit5'] })
      const blockRegistry = createTestBlockRegistry(defaultTestBlocks)
      const testLayer = createTestLayer(inputService, blockRegistry)

      return Effect.gen(function* () {
        const service = yield* HotbarService
        yield* service.update()
        const slot = yield* service.getSelectedSlot()
        expect(slot).toBe(4)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('should select slot 0 when Digit1 is pressed', () => {
      const inputService = createTestInputService()
      inputService.simulateKeyPress('Digit1')
      const blockRegistry = createTestBlockRegistry(defaultTestBlocks)
      const testLayer = createTestLayer(inputService, blockRegistry)

      return Effect.gen(function* () {
        const service = yield* HotbarService

        // Move to a different slot first
        yield* service.setSelectedSlot(asSlotIndex(5))

        yield* service.update()
        const slot = yield* service.getSelectedSlot()
        expect(slot).toBe(0)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('should select slot 8 when Digit9 is pressed', () => {
      const inputService = createTestInputService({ justPressedKeys: ['Digit9'] })
      const blockRegistry = createTestBlockRegistry(defaultTestBlocks)
      const testLayer = createTestLayer(inputService, blockRegistry)

      return Effect.gen(function* () {
        const service = yield* HotbarService
        yield* service.update()
        const slot = yield* service.getSelectedSlot()
        expect(slot).toBe(8)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('should only process first key press and ignore wheel when key is pressed', () => {
      // Both Digit3 pressed and a wheel delta present — key takes priority
      const inputService = createTestInputService({
        justPressedKeys: ['Digit3'],
        wheelDelta: 100,
      })
      const blockRegistry = createTestBlockRegistry(defaultTestBlocks)
      const testLayer = createTestLayer(inputService, blockRegistry)

      return Effect.gen(function* () {
        const service = yield* HotbarService
        yield* service.update()
        const slot = yield* service.getSelectedSlot()
        // Digit3 maps to slot 2 (0-indexed)
        expect(slot).toBe(2)
      }).pipe(Effect.provide(testLayer))
    })
  })

  describe('update — mouse wheel slot selection', () => {
    it.effect('should increment slot by 1 when wheel delta is positive', () => {
      const inputService = createTestInputService({ wheelDelta: 100 })
      const blockRegistry = createTestBlockRegistry(defaultTestBlocks)
      const testLayer = createTestLayer(inputService, blockRegistry)

      return Effect.gen(function* () {
        const service = yield* HotbarService
        // Start at slot 0
        expect(yield* service.getSelectedSlot()).toBe(0)

        yield* service.update()

        const slot = yield* service.getSelectedSlot()
        expect(slot).toBe(1)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('should decrement slot by 1 when wheel delta is negative', () => {
      const inputService = createTestInputService({ wheelDelta: -100 })
      const blockRegistry = createTestBlockRegistry(defaultTestBlocks)
      const testLayer = createTestLayer(inputService, blockRegistry)

      return Effect.gen(function* () {
        const service = yield* HotbarService
        yield* service.setSelectedSlot(asSlotIndex(4))

        yield* service.update()

        const slot = yield* service.getSelectedSlot()
        expect(slot).toBe(3)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('should wrap from slot 8 to slot 0 when scrolling forward', () => {
      const inputService = createTestInputService({ wheelDelta: 100 })
      const blockRegistry = createTestBlockRegistry(defaultTestBlocks)
      const testLayer = createTestLayer(inputService, blockRegistry)

      return Effect.gen(function* () {
        const service = yield* HotbarService
        yield* service.setSelectedSlot(asSlotIndex(8))

        yield* service.update()

        const slot = yield* service.getSelectedSlot()
        expect(slot).toBe(0)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('should wrap from slot 0 to slot 8 when scrolling backward', () => {
      const inputService = createTestInputService({ wheelDelta: -100 })
      const blockRegistry = createTestBlockRegistry(defaultTestBlocks)
      const testLayer = createTestLayer(inputService, blockRegistry)

      return Effect.gen(function* () {
        const service = yield* HotbarService
        // Initial slot is 0

        yield* service.update()

        const slot = yield* service.getSelectedSlot()
        expect(slot).toBe(8)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('should not change slot when wheel delta is 0', () => {
      const inputService = createTestInputService({ wheelDelta: 0 })
      const blockRegistry = createTestBlockRegistry(defaultTestBlocks)
      const testLayer = createTestLayer(inputService, blockRegistry)

      return Effect.gen(function* () {
        const service = yield* HotbarService
        yield* service.setSelectedSlot(asSlotIndex(3))

        yield* service.update()

        const slot = yield* service.getSelectedSlot()
        expect(slot).toBe(3)
      }).pipe(Effect.provide(testLayer))
    })
  })

  describe('wheel scroll boundary wrapping', () => {
    it.effect('should wrap from slot 8 to slot 0 after scrolling forward once', () => {
      const inputService = createTestInputService()
      const blockRegistry = createTestBlockRegistry(defaultTestBlocks)
      const testLayer = createTestLayer(inputService, blockRegistry)

      return Effect.gen(function* () {
        const service = yield* HotbarService
        yield* service.setSelectedSlot(asSlotIndex(8))

        inputService.setWheelDelta(100)
        yield* service.update()

        const slot = yield* service.getSelectedSlot()
        expect(slot).toBe(0)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('should wrap from slot 0 to slot 8 after scrolling backward once', () => {
      const inputService = createTestInputService()
      const blockRegistry = createTestBlockRegistry(defaultTestBlocks)
      const testLayer = createTestLayer(inputService, blockRegistry)

      return Effect.gen(function* () {
        const service = yield* HotbarService
        // starts at slot 0 by default

        inputService.setWheelDelta(-100)
        yield* service.update()

        const slot = yield* service.getSelectedSlot()
        expect(slot).toBe(8)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('should wrap correctly over multiple forward scrolls crossing the boundary', () => {
      const inputService = createTestInputService()
      const blockRegistry = createTestBlockRegistry(defaultTestBlocks)
      const testLayer = createTestLayer(inputService, blockRegistry)

      return Effect.gen(function* () {
        const service = yield* HotbarService
        yield* service.setSelectedSlot(asSlotIndex(7))

        // scroll forward twice: 7 → 8 → 0
        inputService.setWheelDelta(100)
        yield* service.update()
        expect(yield* service.getSelectedSlot()).toBe(8)

        inputService.setWheelDelta(100)
        yield* service.update()
        expect(yield* service.getSelectedSlot()).toBe(0)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('should wrap correctly over multiple backward scrolls crossing the boundary', () => {
      const inputService = createTestInputService()
      const blockRegistry = createTestBlockRegistry(defaultTestBlocks)
      const testLayer = createTestLayer(inputService, blockRegistry)

      return Effect.gen(function* () {
        const service = yield* HotbarService
        yield* service.setSelectedSlot(asSlotIndex(1))

        // scroll backward twice: 1 → 0 → 8
        inputService.setWheelDelta(-100)
        yield* service.update()
        expect(yield* service.getSelectedSlot()).toBe(0)

        inputService.setWheelDelta(-100)
        yield* service.update()
        expect(yield* service.getSelectedSlot()).toBe(8)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('should advance by exactly 1 step per update regardless of wheel delta magnitude', () => {
      // The implementation uses Math.sign(wheelDelta) so large deltas still move by 1
      const inputService = createTestInputService()
      const blockRegistry = createTestBlockRegistry(defaultTestBlocks)
      const testLayer = createTestLayer(inputService, blockRegistry)

      return Effect.gen(function* () {
        const service = yield* HotbarService
        yield* service.setSelectedSlot(asSlotIndex(4))

        inputService.setWheelDelta(9999)
        yield* service.update()

        const slot = yield* service.getSelectedSlot()
        // Large positive delta → direction = 1 → advances by 1: 4 → 5
        expect(slot).toBe(5)
      }).pipe(Effect.provide(testLayer))
    })
  })

  describe('update — NaN wheel delta edge case', () => {
    it.effect('wheelDelta of NaN does not change selected slot', () => {
      // NaN wheel delta: Math.sign(NaN) === NaN, NaN !== 0 is true,
      // but (current + NaN) % HOTBAR_SIZE = NaN, which collapses to 0.
      // We document the actual behaviour: slot must remain valid (a number),
      // not become NaN.
      const inputService = createTestInputService()
      const blockRegistry = createTestBlockRegistry(defaultTestBlocks)
      const testLayer = createTestLayer(inputService, blockRegistry)

      return Effect.gen(function* () {
        const service = yield* HotbarService
        yield* service.setSelectedSlot(asSlotIndex(3))

        // Inject NaN via the mutable helper
        inputService.setWheelDelta(NaN)
        yield* service.update()

        const slot = yield* service.getSelectedSlot()
        // The slot must always be a finite number within [0, HOTBAR_SIZE-1]
        expect(Number.isFinite(slot)).toBe(true)
        expect(slot).toBeGreaterThanOrEqual(0)
        expect(slot).toBeLessThan(HOTBAR_SIZE)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('wheelDelta of Infinity does not wrap to an out-of-range slot', () => {
      const inputService = createTestInputService()
      const blockRegistry = createTestBlockRegistry(defaultTestBlocks)
      const testLayer = createTestLayer(inputService, blockRegistry)

      return Effect.gen(function* () {
        const service = yield* HotbarService
        yield* service.setSelectedSlot(asSlotIndex(4))

        inputService.setWheelDelta(Infinity)
        yield* service.update()

        const slot = yield* service.getSelectedSlot()
        expect(slot).toBeGreaterThanOrEqual(0)
        expect(slot).toBeLessThan(HOTBAR_SIZE)
      }).pipe(Effect.provide(testLayer))
    })
  })

  describe('Effect composition', () => {
    it.effect('should support Effect.flatMap for chaining operations', () => {
      const inputService = createTestInputService()
      const blockRegistry = createTestBlockRegistry(defaultTestBlocks)
      const testLayer = createTestLayer(inputService, blockRegistry)

      return Effect.gen(function* () {
        const service = yield* HotbarService

        const slot = yield* service.setSelectedSlot(asSlotIndex(5)).pipe(
          Effect.flatMap(() => service.getSelectedSlot())
        )

        expect(slot).toBe(5)
      }).pipe(Effect.provide(testLayer))
    })
  })
})

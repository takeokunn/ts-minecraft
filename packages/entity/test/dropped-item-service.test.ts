import { describe, it } from '@effect/vitest'
import { Effect } from 'effect'
import { expect } from 'vitest'
import {
  DROPPED_ITEM_MAX_MERGED_STACK,
  DROPPED_ITEM_REST_OFFSET,
  DROPPED_ITEM_VELOCITY_DAMPING,
  DroppedItemService,
} from '@ts-minecraft/entity/application/dropped-item-service';
import { DROPPED_ITEM_LIFETIME_TICKS, ITEM_PICKUP_DISTANCE } from '@ts-minecraft/entity/domain/dropped-item';

const withDroppedItemService = <A>(
  effect: (service: DroppedItemService) => Effect.Effect<A, never>,
): Effect.Effect<A, never> =>
  Effect.gen(function* () {
    const service = yield* DroppedItemService
    return yield* effect(service)
  }).pipe(Effect.provide(DroppedItemService.Default))

describe('DroppedItemService', () => {
  it.effect('spawns dropped item stacks with deterministic ids', () =>
    withDroppedItemService((service) =>
      Effect.gen(function* () {
        const item = yield* service.spawn({
          itemType: 'DIRT',
          count: 2,
          position: { x: 1, y: 64, z: 2 },
        })

        expect(item).toMatchObject({
          id: 'dropped-item-1',
          itemType: 'DIRT',
          count: 2,
          position: { x: 1, y: 64, z: 2 },
          velocity: { x: 0, y: 0, z: 0 },
          ageTicks: 0,
          pickupDelayTicks: 0,
        })
        expect(yield* service.getAll()).toEqual([item])
      }),
    ))

  it.effect('collects only nearby items that have no pickup delay', () =>
    withDroppedItemService((service) =>
      Effect.gen(function* () {
        const playerPosition = { x: 0, y: 64, z: 0 }
        const near = yield* service.spawn({
          itemType: 'DIRT',
          count: 1,
          position: playerPosition,
        })
        const far = yield* service.spawn({
          itemType: 'STONE',
          count: 1,
          position: { x: ITEM_PICKUP_DISTANCE + 1, y: 64, z: 0 },
        })

        expect(yield* service.collectWithin(playerPosition)).toEqual([near])
        expect(yield* service.getAll()).toEqual([far])
      }),
    ))

  it.effect('keeps delayed drops unavailable until ticking clears the delay', () =>
    withDroppedItemService((service) =>
      Effect.gen(function* () {
        const playerPosition = { x: 0, y: 64, z: 0 }
        const item = yield* service.spawn({
          itemType: 'DIRT',
          count: 1,
          position: playerPosition,
          pickupDelayTicks: 2,
        })

        expect(yield* service.collectWithin(playerPosition)).toEqual([])

        yield* service.tick(2)

        const [collected] = yield* service.collectWithin(playerPosition)
        expect(collected).toMatchObject({ id: item.id, pickupDelayTicks: 0, ageTicks: 2 })
      }),
    ))

  it.effect('ages, moves, and despawns expired dropped items', () =>
    withDroppedItemService((service) =>
      Effect.gen(function* () {
        yield* service.spawn({
          itemType: 'DIRT',
          count: 1,
          position: { x: 0, y: 64, z: 0 },
          velocity: { x: 1, y: 0, z: -1 },
        })

        yield* service.tick(3)

        const [moved] = yield* service.getAll()
        expect(moved).toMatchObject({ ageTicks: 3 })
        expect(moved?.position.x).toBe(3)
        expect(moved?.position.z).toBe(-3)
        // Gravity: with no floor provided the item falls.
        expect(moved?.position.y).toBeLessThan(64)
        expect(moved?.velocity.y).toBeLessThan(0)
        const expectedVelocity = Math.pow(DROPPED_ITEM_VELOCITY_DAMPING, 3)
        expect(moved?.velocity.x).toBeCloseTo(expectedVelocity)
        expect(moved?.velocity.z).toBeCloseTo(-expectedVelocity)

        yield* service.tick(DROPPED_ITEM_LIFETIME_TICKS)

        expect(yield* service.getAll()).toEqual([])
      }),
    ))

  it.effect('merges nearby matching stacks up to the item stack limit', () =>
    withDroppedItemService((service) =>
      Effect.gen(function* () {
        yield* service.spawn({
          itemType: 'DIRT',
          count: 40,
          position: { x: 0, y: 64, z: 0 },
          pickupDelayTicks: 1,
        })
        yield* service.spawn({
          itemType: 'DIRT',
          count: 30,
          position: { x: 0.25, y: 64, z: 0 },
          pickupDelayTicks: 4,
        })

        yield* service.tick(1)

        const items = yield* service.getAll()
        expect(items).toHaveLength(2)
        expect(items[0]).toMatchObject({
          id: 'dropped-item-1',
          itemType: 'DIRT',
          count: DROPPED_ITEM_MAX_MERGED_STACK,
          pickupDelayTicks: 3,
        })
        expect(items[1]).toMatchObject({
          id: 'dropped-item-2',
          itemType: 'DIRT',
          count: 6,
          pickupDelayTicks: 3,
        })
      }),
    ))

  it.effect('falls with gravity and rests on the first solid block below', () =>
    withDroppedItemService((service) =>
      Effect.gen(function* () {
        // Drop floating 3 blocks above a solid floor at y=63 (top face y=64).
        yield* service.spawn({
          itemType: 'COBBLESTONE',
          count: 1,
          position: { x: 0.5, y: 67, z: 0.5 },
        })
        const isSolidAt = (_x: number, y: number, _z: number): boolean => y <= 63

        for (let i = 0; i < 200; i++) {
          yield* service.tick(1, isSolidAt)
        }

        const [rested] = yield* service.getAll()
        expect(rested?.position.y).toBeCloseTo(64 + DROPPED_ITEM_REST_OFFSET)
        expect(rested?.velocity.y).toBe(0)
      }),
    ))

  it.effect('keeps distant or different item stacks separate', () =>
    withDroppedItemService((service) =>
      Effect.gen(function* () {
        yield* service.spawn({
          itemType: 'DIRT',
          count: 1,
          position: { x: 0, y: 64, z: 0 },
        })
        yield* service.spawn({
          itemType: 'STONE',
          count: 1,
          position: { x: 0.25, y: 64, z: 0 },
        })
        yield* service.spawn({
          itemType: 'DIRT',
          count: 1,
          position: { x: 1, y: 64, z: 0 },
        })

        yield* service.tick(1)

        expect(yield* service.getAll()).toHaveLength(3)
      }),
    ))
})

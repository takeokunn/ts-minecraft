import { describe, it } from '@effect/vitest'
import { Effect } from 'effect'
import { expect } from 'vitest'
import { DroppedItemService } from '@ts-minecraft/entity/application/dropped-item-service';
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

        expect(yield* service.collectWithin(playerPosition)).toEqual([
          { ...item, pickupDelayTicks: 0, ageTicks: 2 },
        ])
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
        expect(moved).toMatchObject({
          position: { x: 3, y: 64, z: -3 },
          ageTicks: 3,
        })

        yield* service.tick(DROPPED_ITEM_LIFETIME_TICKS)

        expect(yield* service.getAll()).toEqual([])
      }),
    ))
})

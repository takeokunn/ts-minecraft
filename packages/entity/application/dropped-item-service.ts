import { Effect, Ref } from 'effect'
import type { InventoryItem } from '@ts-minecraft/core'
import {
  DROPPED_ITEM_LIFETIME_TICKS,
  type DroppedItemEntity,
  type DroppedItemPosition,
} from '../domain/dropped-item'
import { isWithinItemPickupDistance } from '../domain/dropped-item-resolution'

const ZERO_VELOCITY: DroppedItemPosition = { x: 0, y: 0, z: 0 }

const normalizeCount = (count: number): number => Math.max(1, Math.floor(count))
const normalizeTicks = (ticks: number): number => Math.max(0, Math.floor(ticks))

export type DroppedItemSpawnInput = {
  readonly itemType: InventoryItem
  readonly count: number
  readonly position: DroppedItemPosition
  readonly velocity?: DroppedItemPosition
  readonly pickupDelayTicks?: number
}

export class DroppedItemService extends Effect.Service<DroppedItemService>()(
  '@minecraft/application/DroppedItemService',
  {
    effect: Effect.gen(function* () {
      const itemsRef = yield* Ref.make<readonly DroppedItemEntity[]>([])
      const nextIdRef = yield* Ref.make(0)

      return {
        spawn: (input: DroppedItemSpawnInput): Effect.Effect<DroppedItemEntity, never> =>
          Effect.gen(function* () {
            const nextId = yield* Ref.updateAndGet(nextIdRef, (value) => value + 1)
            const entity: DroppedItemEntity = {
              id: `dropped-item-${nextId}`,
              itemType: input.itemType,
              count: normalizeCount(input.count),
              position: input.position,
              velocity: input.velocity ?? ZERO_VELOCITY,
              ageTicks: 0,
              pickupDelayTicks: normalizeTicks(input.pickupDelayTicks ?? 0),
            }

            yield* Ref.update(itemsRef, (items) => [...items, entity])
            return entity
          }),

        getAll: (): Effect.Effect<readonly DroppedItemEntity[], never> => Ref.get(itemsRef),

        tick: (ageDeltaTicks = 1): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            const deltaTicks = normalizeTicks(ageDeltaTicks)

            yield* Ref.update(itemsRef, (items) =>
              items
                .map((item) => ({
                  ...item,
                  position: {
                    x: item.position.x + item.velocity.x * deltaTicks,
                    y: item.position.y + item.velocity.y * deltaTicks,
                    z: item.position.z + item.velocity.z * deltaTicks,
                  },
                  ageTicks: item.ageTicks + deltaTicks,
                  pickupDelayTicks: Math.max(0, item.pickupDelayTicks - deltaTicks),
                }))
                .filter((item) => item.ageTicks < DROPPED_ITEM_LIFETIME_TICKS),
            )
          }),

        collectWithin: (
          playerPosition: DroppedItemPosition,
        ): Effect.Effect<readonly DroppedItemEntity[], never> =>
          Ref.modify(itemsRef, (items) => {
            const collected: DroppedItemEntity[] = []
            const remaining: DroppedItemEntity[] = []

            for (const item of items) {
              if (
                item.pickupDelayTicks <= 0 &&
                isWithinItemPickupDistance(playerPosition, item.position)
              ) {
                collected.push(item)
              } else {
                remaining.push(item)
              }
            }

            return [collected, remaining]
          }),

        reset: (): Effect.Effect<void, never> =>
          Effect.all([Ref.set(itemsRef, []), Ref.set(nextIdRef, 0)]).pipe(Effect.asVoid),
      }
    }),
  },
) {}

import { Effect, Ref } from 'effect'
import type { InventoryItem } from '@ts-minecraft/core'
import {
  DROPPED_ITEM_LIFETIME_TICKS,
  type DroppedItemEntity,
  type DroppedItemPosition,
} from '../domain/dropped-item'
import { isWithinItemPickupDistance } from '../domain/dropped-item-resolution'

const ZERO_VELOCITY: DroppedItemPosition = { x: 0, y: 0, z: 0 }

export const DROPPED_ITEM_VELOCITY_DAMPING = 0.92
export const DROPPED_ITEM_STOP_SPEED = 0.001
export const DROPPED_ITEM_MERGE_DISTANCE = 0.75
export const DROPPED_ITEM_MERGE_DISTANCE_SQUARED =
  DROPPED_ITEM_MERGE_DISTANCE * DROPPED_ITEM_MERGE_DISTANCE
export const DROPPED_ITEM_MAX_MERGED_STACK = 64

const normalizeCount = (count: number): number => Math.max(1, Math.floor(count))
const normalizeTicks = (ticks: number): number => Math.max(0, Math.floor(ticks))

const distanceSquared = (
  a: DroppedItemPosition,
  b: DroppedItemPosition,
): number => {
  const dx = a.x - b.x
  const dy = a.y - b.y
  const dz = a.z - b.z
  return dx * dx + dy * dy + dz * dz
}

const clampSmallVelocity = (value: number): number =>
  Math.abs(value) < DROPPED_ITEM_STOP_SPEED ? 0 : value

const dampVelocity = (
  velocity: DroppedItemPosition,
  deltaTicks: number,
): DroppedItemPosition => {
  const damping = Math.pow(DROPPED_ITEM_VELOCITY_DAMPING, deltaTicks)
  return {
    x: clampSmallVelocity(velocity.x * damping),
    y: clampSmallVelocity(velocity.y * damping),
    z: clampSmallVelocity(velocity.z * damping),
  }
}

const canMergeDroppedItems = (
  target: DroppedItemEntity,
  candidate: DroppedItemEntity,
): boolean =>
  target.itemType === candidate.itemType &&
  target.count < DROPPED_ITEM_MAX_MERGED_STACK &&
  distanceSquared(target.position, candidate.position) <= DROPPED_ITEM_MERGE_DISTANCE_SQUARED

const absorbDroppedItemCount = (
  target: DroppedItemEntity,
  candidate: DroppedItemEntity,
  absorbedCount: number,
): DroppedItemEntity => {
  const combinedCount = target.count + absorbedCount
  const targetWeight = target.count / combinedCount
  const candidateWeight = absorbedCount / combinedCount

  return {
    ...target,
    count: combinedCount,
    position: {
      x: target.position.x * targetWeight + candidate.position.x * candidateWeight,
      y: target.position.y * targetWeight + candidate.position.y * candidateWeight,
      z: target.position.z * targetWeight + candidate.position.z * candidateWeight,
    },
    velocity: {
      x: target.velocity.x * targetWeight + candidate.velocity.x * candidateWeight,
      y: target.velocity.y * targetWeight + candidate.velocity.y * candidateWeight,
      z: target.velocity.z * targetWeight + candidate.velocity.z * candidateWeight,
    },
    ageTicks: Math.min(target.ageTicks, candidate.ageTicks),
    pickupDelayTicks: Math.max(target.pickupDelayTicks, candidate.pickupDelayTicks),
  }
}

const mergeNearbyDroppedItems = (
  items: readonly DroppedItemEntity[],
): readonly DroppedItemEntity[] => {
  const merged: DroppedItemEntity[] = []

  for (const item of items) {
    let remainingCount = item.count
    let carriedItem = item

    for (let index = 0; index < merged.length && remainingCount > 0; index++) {
      const target = merged[index]
      if (target === undefined) continue
      if (!canMergeDroppedItems(target, carriedItem)) continue

      const capacity = DROPPED_ITEM_MAX_MERGED_STACK - target.count
      const absorbedCount = Math.min(capacity, remainingCount)
      merged[index] = absorbDroppedItemCount(target, carriedItem, absorbedCount)
      remainingCount -= absorbedCount
      carriedItem = { ...carriedItem, count: remainingCount }
    }

    if (remainingCount > 0) {
      merged.push({ ...carriedItem, count: remainingCount })
    }
  }

  return merged
}

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
              mergeNearbyDroppedItems(
                items
                  .map((item) => ({
                    ...item,
                    position: {
                      x: item.position.x + item.velocity.x * deltaTicks,
                      y: item.position.y + item.velocity.y * deltaTicks,
                      z: item.position.z + item.velocity.z * deltaTicks,
                    },
                    velocity: dampVelocity(item.velocity, deltaTicks),
                    ageTicks: item.ageTicks + deltaTicks,
                    pickupDelayTicks: Math.max(0, item.pickupDelayTicks - deltaTicks),
                  }))
                  .filter((item) => item.ageTicks < DROPPED_ITEM_LIFETIME_TICKS),
              ),
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

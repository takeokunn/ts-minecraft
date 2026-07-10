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
// Vanilla item-entity gravity: 0.04 blocks/tick², capped so a long fall can't
// tunnel through a block in one tick.
export const DROPPED_ITEM_GRAVITY_PER_TICK = 0.04
export const DROPPED_ITEM_TERMINAL_VELOCITY = 0.9
// Visual rest height of an item above the supporting block's top face.
export const DROPPED_ITEM_REST_OFFSET = 0.25
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
  target.noMerge !== true &&
  candidate.noMerge !== true &&
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
  // Explicit id + merge opt-out for multiplayer mirror items; local spawns
  // omit both and get a generated id.
  readonly id?: string
  readonly noMerge?: boolean
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
              id: input.id ?? `dropped-item-${nextId}`,
              itemType: input.itemType,
              count: normalizeCount(input.count),
              position: input.position,
              velocity: input.velocity ?? ZERO_VELOCITY,
              ageTicks: 0,
              pickupDelayTicks: normalizeTicks(input.pickupDelayTicks ?? 0),
              ...(input.noMerge === true ? { noMerge: true } : {}),
            }

            // Explicit-id spawns are upserts: re-spawning an existing mirror id
            // replaces it (the owner's count/position update) instead of duping.
            yield* Ref.update(itemsRef, (items) =>
              input.id === undefined ? [...items, entity] : [...items.filter((item) => item.id !== entity.id), entity],
            )
            return entity
          }),

        getAll: (): Effect.Effect<readonly DroppedItemEntity[], never> => Ref.get(itemsRef),

        // Remove a single item by id (multiplayer removal sync). Returns
        // whether the id existed — callers treat a miss as an idempotent no-op.
        removeById: (id: string): Effect.Effect<boolean, never> =>
          Ref.modify(itemsRef, (items) => {
            const remaining = items.filter((item) => item.id !== id)
            return [remaining.length !== items.length, remaining]
          }),

        // isSolidAt (optional): world solidity probe used to land falling items.
        // Without it, gravity still applies but items have no floor to rest on
        // (only exercised by unit tests / callers without terrain access).
        tick: (
          ageDeltaTicks = 1,
          isSolidAt?: (x: number, y: number, z: number) => boolean,
        ): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            const deltaTicks = normalizeTicks(ageDeltaTicks)

            yield* Ref.update(itemsRef, (items) =>
              mergeNearbyDroppedItems(
                items
                  .map((item) => {
                    // Vanilla: dropped items fall. Without gravity a drop from a
                    // block mined at eye level floats midair forever, out of the
                    // 1.5-block pickup radius.
                    const fallVy = Math.max(
                      item.velocity.y - DROPPED_ITEM_GRAVITY_PER_TICK * deltaTicks,
                      -DROPPED_ITEM_TERMINAL_VELOCITY,
                    )
                    const nextX = item.position.x + item.velocity.x * deltaTicks
                    const nextZ = item.position.z + item.velocity.z * deltaTicks
                    let nextY = item.position.y + fallVy * deltaTicks
                    let restVy = fallVy
                    if (isSolidAt !== undefined && fallVy < 0) {
                      const supportY = Math.floor(nextY - DROPPED_ITEM_REST_OFFSET)
                      if (isSolidAt(Math.floor(nextX), supportY, Math.floor(nextZ))) {
                        nextY = supportY + 1 + DROPPED_ITEM_REST_OFFSET
                        restVy = 0
                      }
                    }
                    const damped = dampVelocity({ x: item.velocity.x, y: restVy, z: item.velocity.z }, deltaTicks)
                    return {
                      ...item,
                      position: { x: nextX, y: nextY, z: nextZ },
                      // Resting items keep vy exactly 0; falling items keep the
                      // undamped fall speed so gravity accelerates realistically.
                      velocity: { x: damped.x, y: restVy === 0 ? 0 : restVy, z: damped.z },
                      ageTicks: item.ageTicks + deltaTicks,
                      pickupDelayTicks: Math.max(0, item.pickupDelayTicks - deltaTicks),
                    }
                  })
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

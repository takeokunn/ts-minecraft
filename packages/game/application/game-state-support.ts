import { Effect, Ref } from 'effect'
import { PhysicsBodyId } from '@ts-minecraft/core'
import { ChunkManagerService } from '@ts-minecraft/world/application/chunk-manager-service'
import { PhysicsService } from './physics-service'
import { OFFSETS_3x3 } from '../domain/block-collision-predicates'

export type ChunkCacheSlot = { blocks: Uint8Array } | null
export type ChunkCache = Array<ChunkCacheSlot>

export const GRAVITY_Y = -9.82
export const PLAYER_MASS = 70
export const ZERO_VEC3 = Object.freeze({ x: 0, y: 0, z: 0 })
export const SWIM_UP_SPEED = 3
export const WATER_SINK_SPEED = -1.2

export const createChunkCache = (): ChunkCache => [null, null, null, null, null, null, null, null, null]

export const refreshChunkCache = (
  chunkManagerService: Pick<ChunkManagerService, 'getChunk'>,
  playerCx: number,
  playerCz: number,
  chunkCacheRef: Ref.Ref<ChunkCache>,
  lastChunkCoordRef: Ref.Ref<{ cx: number; cz: number }>,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const cache = yield* Ref.get(chunkCacheRef)
    cache.fill(null)
    for (const [dx, dz] of OFFSETS_3x3) {
      yield* Effect.gen(function* () {
        const chunk = yield* chunkManagerService.getChunk({ x: playerCx + dx, z: playerCz + dz })
        cache[(dx + 1) * 3 + (dz + 1)] = chunk
      }).pipe(Effect.ignore)
    }
    yield* Ref.set(lastChunkCoordRef, { cx: playerCx, cz: playerCz })
  })

export const applyWaterDrag = (
  physicsService: Pick<PhysicsService, 'setVelocity'>,
  playerBodyId: PhysicsBodyId,
  resolvedVel: { x: number; y: number; z: number },
  swimUp: boolean,
  sneaking: boolean,
  horizontalDrag: number,
): Effect.Effect<void, never> =>
  physicsService.setVelocity(playerBodyId, {
    x: resolvedVel.x * horizontalDrag,
    // Vanilla feel: JUMP swims up; SNEAK dives faster; otherwise a gentle constant sink so the
    // player descends into the water (and can always rise again with JUMP).
    y: swimUp ? SWIM_UP_SPEED
      : sneaking ? Math.max(resolvedVel.y * 0.4, -2.5)
      : WATER_SINK_SPEED,
    z: resolvedVel.z * horizontalDrag,
  }).pipe(Effect.catchTag('PhysicsServiceError', () => Effect.void))

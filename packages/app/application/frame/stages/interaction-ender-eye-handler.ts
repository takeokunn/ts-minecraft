import { Effect, HashMap, MutableRef, Option } from 'effect'
import { blockTypeToIndex, type Position } from '@ts-minecraft/core'
import { detectCompletedEndPortal, nearestStrongholdSite, type Chunk } from '@ts-minecraft/world'
import { worldToChunkCoord } from '@ts-minecraft/world/domain/chunk-coord-utils'
import { getParticleUvOffset } from '@ts-minecraft/rendering'
import type { ChunkCoord } from '@ts-minecraft/core'
import type { FrameStageRefs } from '@ts-minecraft/app/application/frame/types/stage-refs'
import type { FrameEnderEyeInteractionServices } from '@ts-minecraft/app/frame/frame-interaction-service-types/ender-eye'
import type { TargetRayHit } from '@ts-minecraft/app/frame/stages/interaction-types'
import { buildBlockAtFromCache, readBlockTypeAt } from './interaction-block-access'
import { selectedHotbarSlotIndex } from './selected-hotbar-slot'

// Eye-locator trail: emerald-green flecks streaming toward the nearest
// stronghold (the vanilla thrown-eye cue, minus the physical entity). UV is
// precomputed once at module load (perf policy — no per-use alloc).
const EYE_PARTICLE_BLOCK_ID = blockTypeToIndex('EMERALD_BLOCK')
const EYE_PARTICLE_UV = getParticleUvOffset(EYE_PARTICLE_BLOCK_ID)
const LOCATOR_TRAIL_STEPS = 5
const LOCATOR_TRAIL_SPACING = 1.4

const buildChunkNeighborhood = (center: ChunkCoord): ReadonlyArray<ChunkCoord> => {
  const coords: Array<ChunkCoord> = []
  for (let dx = -1; dx <= 1; dx += 1) {
    for (let dz = -1; dz <= 1; dz += 1) {
      coords.push({ x: center.x + dx, z: center.z + dz })
    }
  }
  return coords
}

const consumeHeldEye = (services: FrameEnderEyeInteractionServices): Effect.Effect<void, never> =>
  services.hotbarService.getSelectedSlot().pipe(
    Effect.flatMap((selectedSlot) =>
      services.inventoryService.removeBlock('ENDER_EYE', 1, selectedHotbarSlotIndex(selectedSlot)),
    ),
    Effect.catchAllCause(() => Effect.void),
  )

// Fill the targeted frame with the held eye; when that completes the 12-frame
// ring, flood the 3×3 interior with END_PORTAL blocks (mirrors the flint &
// steel nether-portal ignition flow).
const fillFrameAndMaybeOpenPortal = (
  services: FrameEnderEyeInteractionServices,
  refs: Pick<FrameStageRefs, 'dirtyChunksRef'>,
  framePos: Position,
): Effect.Effect<boolean> =>
  Effect.gen(function* () {
    yield* services.blockService.forceSetBlock(framePos, 'END_PORTAL_FRAME_FILLED').pipe(
      Effect.catchAll(() => Effect.void),
    )
    yield* consumeHeldEye(services)
    yield* services.soundManager.playEffect('blockPlace', { position: framePos })

    const chunkCoords = buildChunkNeighborhood(worldToChunkCoord(framePos))
    const chunkCache = new Map<string, Chunk>()
    for (const coord of chunkCoords) {
      const chunk = yield* services.chunkManagerService.getChunk(coord).pipe(Effect.catchAll(() => Effect.succeed(null)))
      if (chunk === null) return true
      chunkCache.set(`${coord.x},${coord.z}`, chunk)
    }
    const blockAt = yield* buildBlockAtFromCache(chunkCache, chunkCoords).pipe(
      Effect.catchAll(() => Effect.succeed(null)),
    )
    if (blockAt === null) return true

    const completed = Option.getOrNull(detectCompletedEndPortal(blockAt, framePos))
    if (completed === null) return true

    const affectedCoords = new Map<string, ChunkCoord>()
    for (const pos of completed.interior) {
      yield* services.blockService.forceSetBlock(pos, 'END_PORTAL').pipe(Effect.catchAll(() => Effect.void))
      const coord = worldToChunkCoord(pos)
      affectedCoords.set(`${coord.x},${coord.z}`, coord)
    }

    let updatedDirtyChunks = MutableRef.get(refs.dirtyChunksRef)
    for (const [coordKey] of affectedCoords) {
      const chunk = chunkCache.get(coordKey)
      if (chunk) updatedDirtyChunks = HashMap.set(updatedDirtyChunks, coordKey, { chunk, dirtyAABB: Option.none() })
    }
    MutableRef.set(refs.dirtyChunksRef, updatedDirtyChunks)
    yield* services.soundManager.playEffect('blockPlace', { position: framePos })
    return true
  })

// Locator: stream a particle trail from the player toward the nearest
// stronghold site. The eye is not consumed on a locator use — search can take
// many throws and ender pearls are hard-won.
const emitLocatorTrail = (
  services: FrameEnderEyeInteractionServices,
  playerPosition: Position,
): Effect.Effect<boolean> =>
  Effect.gen(function* () {
    const site = Option.getOrNull(nearestStrongholdSite(playerPosition.x, playerPosition.z))
    if (site === null) return false

    const dx = site.x - playerPosition.x
    const dz = site.z - playerPosition.z
    const dist = Math.hypot(dx, dz)
    // Standing over the room: burst straight down instead of a trail.
    const overSite = dist < 8
    const dirX = overSite ? 0 : dx / dist
    const dirZ = overSite ? 0 : dz / dist

    for (let step = 1; step <= LOCATOR_TRAIL_STEPS; step++) {
      const reach = step * LOCATOR_TRAIL_SPACING
      yield* services.particleSystem.spawnBurst(
        playerPosition.x + dirX * reach,
        playerPosition.y + (overSite ? -step * 0.5 : 0.2),
        playerPosition.z + dirZ * reach,
        EYE_PARTICLE_UV.u,
        EYE_PARTICLE_UV.v,
        4,
      )
    }
    yield* services.soundManager.playEffect('blockPlace', { position: playerPosition })
    return true
  })

export const handleEnderEyeUse = (
  services: FrameEnderEyeInteractionServices,
  refs: Pick<FrameStageRefs, 'dirtyChunksRef'>,
  context: {
    readonly targetHit: Option.Option<TargetRayHit>
    readonly playerPosition: Position
  },
): Effect.Effect<boolean> =>
  Effect.gen(function* () {
    const hit = Option.getOrNull(context.targetHit)
    if (hit !== null) {
      const framePos = { x: hit.blockX, y: hit.blockY, z: hit.blockZ }
      const blockType = yield* readBlockTypeAt(services.chunkManagerService, framePos).pipe(
        Effect.catchAll(() => Effect.succeed(null)),
      )
      if (blockType === 'END_PORTAL_FRAME') {
        return yield* fillFrameAndMaybeOpenPortal(services, refs, framePos)
      }
    }
    return yield* emitLocatorTrail(services, context.playerPosition)
  })

import { Effect, HashMap, MutableRef, Option } from 'effect'
import { detectNetherPortal, type Chunk } from '@ts-minecraft/world'
import type { ChunkCoord, Position } from '@ts-minecraft/core'
import { worldToChunkCoord } from '@ts-minecraft/world/domain/chunk-coord-utils'
import type { FrameStageRefs } from '@ts-minecraft/app/frame/types'
import type { FrameFlintAndSteelInteractionServices } from '@ts-minecraft/app/frame/frame-interaction-service-types'
import type { TargetRayHit } from '@ts-minecraft/app/frame/stages/interaction-types'
import { adjacentToHit } from './placement-geometry'
import { buildBlockAtFromCache } from './interaction-block-access'

const buildChunkNeighborhood = (center: ChunkCoord): ReadonlyArray<ChunkCoord> => {
  const coords: Array<ChunkCoord> = []
  for (let dx = -1; dx <= 1; dx += 1) {
    for (let dz = -1; dz <= 1; dz += 1) {
      coords.push({ x: center.x + dx, z: center.z + dz })
    }
  }
  return coords
}

export const buildPortalIgnitionChunkCoords = (ignitionPos: Position): ReadonlyArray<ChunkCoord> =>
  buildChunkNeighborhood(worldToChunkCoord(ignitionPos))

export const collectAffectedPortalChunkCoords = (positions: Iterable<Position>): Map<string, ChunkCoord> => {
  const affectedCoords = new Map<string, ChunkCoord>()
  for (const pos of positions) {
    const coord = worldToChunkCoord(pos)
    affectedCoords.set(`${coord.x},${coord.z}`, coord)
  }
  return affectedCoords
}

export const handlePortalIgnition = (
  services: Pick<FrameFlintAndSteelInteractionServices, 'blockService' | 'chunkManagerService' | 'netherService' | 'soundManager'>,
  refs: Pick<FrameStageRefs, 'dirtyChunksRef'>,
  hit: TargetRayHit,
): Effect.Effect<boolean> =>
  Effect.gen(function* () {
    const ignitionPos = adjacentToHit(hit)
    const chunkCoords = buildPortalIgnitionChunkCoords(ignitionPos)

    const chunkCache = new Map<string, Chunk>()
    for (const coord of chunkCoords) {
      const chunk = yield* services.chunkManagerService.getChunk(coord).pipe(Effect.catchAll(() => Effect.succeed(null)))
      if (chunk === null) return false
      chunkCache.set(`${coord.x},${coord.z}`, chunk)
    }

    const blockAt = yield* buildBlockAtFromCache(chunkCache, chunkCoords).pipe(
      Effect.catchAll(() => Effect.succeed(null)),
    )
    if (blockAt === null) return false
    const portalFrame = Option.getOrNull(detectNetherPortal(blockAt, ignitionPos))
    if (portalFrame === null) return false

    const affectedCoords = collectAffectedPortalChunkCoords(portalFrame.interior)
    for (const pos of portalFrame.interior) {
      yield* services.blockService.forceSetBlock(pos, 'NETHER_PORTAL').pipe(Effect.catchAll(() => Effect.void))
    }

    let updatedDirtyChunks = MutableRef.get(refs.dirtyChunksRef)
    for (const [coordKey] of affectedCoords) {
      const chunk = chunkCache.get(coordKey)
      if (chunk) updatedDirtyChunks = HashMap.set(updatedDirtyChunks, coordKey, { chunk, dirtyAABB: Option.none() })
    }
    MutableRef.set(refs.dirtyChunksRef, updatedDirtyChunks)
    yield* services.netherService.registerPortal(ignitionPos, 'overworld')
    yield* services.soundManager.playEffect('blockPlace', { position: ignitionPos })
    return true
  })

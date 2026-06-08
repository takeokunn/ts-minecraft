import { Effect, HashMap, Option, Ref, Schema } from 'effect'
import { CHUNK_SIZE, CHUNK_HEIGHT, indexToBlockType, SlotIndex, ItemTypeSchema } from '@ts-minecraft/core'
import { HOTBAR_START } from '@ts-minecraft/inventory'
import type { FrameHandlerServices, FrameStageRefs } from '@ts-minecraft/app/frame/types'
import type { TargetRayHit } from '@ts-minecraft/app/frame/stages/interaction-block-handler'

const HOE_TYPES = new Set(['WOODEN_HOE', 'STONE_HOE', 'IRON_HOE', 'DIAMOND_HOE'])
const TILLABLE_BLOCKS = new Set(['DIRT', 'GRASS'])

/**
 * Handles farming interactions: hoe-tilling (DIRT/GRASS → FARMLAND) and seed
 * planting (WHEAT_SEEDS on FARMLAND → WHEAT_CROP above). Returns true when an
 * interaction was consumed so the caller can skip normal block placement.
 */
export const handleFarmingInteraction = (
  services: Pick<
    FrameHandlerServices,
    'hotbarService' | 'blockService' | 'chunkManagerService' | 'soundManager' | 'inventoryService'
  >,
  refs: Pick<FrameStageRefs, 'dirtyChunksRef'>,
  context: { readonly targetHit: Option.Option<TargetRayHit> },
): Effect.Effect<boolean, never> =>
  Option.match(context.targetHit, {
    onNone: () => Effect.succeed(false),
    onSome: (hit) =>
      Effect.all(
        [services.hotbarService.getSelectedBlockType(), services.hotbarService.getSelectedSlot()],
        { concurrency: 'unbounded' },
      ).pipe(
        Effect.flatMap(([selected, selectedSlot]) =>
          Option.match(selected, {
            onNone: () => Effect.succeed(false),
            onSome: (item) => {
              if (!Schema.is(ItemTypeSchema)(item)) return Effect.succeed(false)

              const targetChunkCoord = {
                x: Math.floor(hit.blockX / CHUNK_SIZE),
                z: Math.floor(hit.blockZ / CHUNK_SIZE),
              }
              const coordKey = `${targetChunkCoord.x},${targetChunkCoord.z}`
              const lx = ((hit.blockX % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
              const lz = ((hit.blockZ % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE

              if (HOE_TYPES.has(item)) {
                return services.chunkManagerService.getChunk(targetChunkCoord).pipe(
                  Effect.flatMap((chunk) => {
                    const idx = hit.blockY + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE
                    /* c8 ignore next -- TypedArray never returns undefined for in-bounds idx */
                    const blockType = indexToBlockType(chunk.blocks[idx] ?? 0)
                    if (!TILLABLE_BLOCKS.has(blockType)) return Effect.succeed(false)
                    const targetPos = { x: hit.blockX, y: hit.blockY, z: hit.blockZ }
                    return services.blockService.forceSetBlock(targetPos, 'FARMLAND').pipe(
                      Effect.flatMap(() => services.chunkManagerService.getChunk(targetChunkCoord)),
                      Effect.flatMap((updated) =>
                        Ref.update(refs.dirtyChunksRef, (map) =>
                          HashMap.set(map, coordKey, { chunk: updated, dirtyAABB: Option.none() }),
                        ),
                      ),
                      Effect.andThen(services.soundManager.playEffect('blockPlace', { position: targetPos })),
                      Effect.as(true),
                      Effect.catchAll(() => Effect.succeed(false)),
                    )
                  }),
                  Effect.catchAll(() => Effect.succeed(false)),
                )
              }

              if (item === 'WHEAT_SEEDS') {
                return services.chunkManagerService.getChunk(targetChunkCoord).pipe(
                  Effect.flatMap((chunk) => {
                    const idx = hit.blockY + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE
                    /* c8 ignore next -- TypedArray never returns undefined for in-bounds idx */
                    const blockType = indexToBlockType(chunk.blocks[idx] ?? 0)
                    if (blockType !== 'FARMLAND') return Effect.succeed(false)
                    const cropPos = { x: hit.blockX, y: hit.blockY + 1, z: hit.blockZ }
                    const cropCoord = {
                      x: Math.floor(cropPos.x / CHUNK_SIZE),
                      z: Math.floor(cropPos.z / CHUNK_SIZE),
                    }
                    const cropCoordKey = `${cropCoord.x},${cropCoord.z}`
                    return services.inventoryService
                      .removeBlock('WHEAT_SEEDS', 1, SlotIndex.make(HOTBAR_START + selectedSlot))
                      .pipe(
                        Effect.flatMap(() => services.blockService.forceSetBlock(cropPos, 'WHEAT_CROP')),
                        Effect.flatMap(() => services.chunkManagerService.getChunk(cropCoord)),
                        Effect.flatMap((updated) =>
                          Ref.update(refs.dirtyChunksRef, (map) =>
                            HashMap.set(map, cropCoordKey, { chunk: updated, dirtyAABB: Option.none() }),
                          ),
                        ),
                        Effect.andThen(services.soundManager.playEffect('blockPlace', { position: cropPos })),
                        Effect.as(true),
                        Effect.catchAll(() => Effect.succeed(false)),
                      )
                  }),
                  Effect.catchAll(() => Effect.succeed(false)),
                )
              }

              return Effect.succeed(false)
            },
          }),
        ),
      ),
  })

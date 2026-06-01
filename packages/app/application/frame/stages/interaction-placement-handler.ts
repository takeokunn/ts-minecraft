import { Effect, HashMap, Option, Ref, Schema } from 'effect'
import { aabbFromVoxel } from '@ts-minecraft/world'
import { CHUNK_HEIGHT, CHUNK_SIZE, indexToBlockType, BlockTypeSchema, SlotIndex } from '@ts-minecraft/core'
import { HOTBAR_START } from '@ts-minecraft/inventory'
import type { FrameHandlerServices, FrameStageRefs } from '@ts-minecraft/app/frame/types'
import type { TargetRayHit } from '@ts-minecraft/app/frame/stages/interaction-block-handler'

export const handleRightClick = (
  services: Pick<
    FrameHandlerServices,
    'blockService' | 'chunkManagerService' | 'soundManager' | 'hotbarService' | 'furnaceService'
  >,
  refs: Pick<FrameStageRefs, 'dirtyChunksRef'>,
  context: { readonly targetHit: Option.Option<TargetRayHit> },
) =>
  Option.match(context.targetHit, {
    onNone: () => Effect.void,
    onSome: (hit) => {
      const targetPos = { x: hit.blockX, y: hit.blockY, z: hit.blockZ }
      const targetChunkCoord = {
        x: Math.floor(targetPos.x / CHUNK_SIZE),
        z: Math.floor(targetPos.z / CHUNK_SIZE),
      }
      return services.chunkManagerService.getChunk(targetChunkCoord).pipe(
        Effect.flatMap((targetChunk) => {
          const targetLx = ((targetPos.x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
          const targetLz = ((targetPos.z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
          const targetIdx = targetPos.y + targetLz * CHUNK_HEIGHT + targetLx * CHUNK_HEIGHT * CHUNK_SIZE
          const targetBlockType = indexToBlockType(targetChunk.blocks[targetIdx] ?? 0)
          /* c8 ignore next 3 */
          if (targetBlockType === 'FURNACE') return services.furnaceService.setSelectedFurnace(targetPos)

          const adjacentPos = {
            x: hit.blockX + Math.round(hit.normal.x),
            y: hit.blockY + Math.round(hit.normal.y),
            z: hit.blockZ + Math.round(hit.normal.z),
          }
          return Effect.all(
            [services.hotbarService.getSelectedBlockType(), services.hotbarService.getSelectedSlot()],
            { concurrency: 'unbounded' },
          ).pipe(
            Effect.flatMap(([selectedBlock, selectedSlot]) =>
              Option.match(selectedBlock, {
                onNone: () => Effect.void,
                onSome: (item) => {
                  /* c8 ignore next -- non-BlockType item in hotbar during right-click; tools/food handled before reaching here */
                  if (!Schema.is(BlockTypeSchema)(item)) return Effect.void
                  const chunkCoord = {
                    x: Math.floor(adjacentPos.x / CHUNK_SIZE),
                    z: Math.floor(adjacentPos.z / CHUNK_SIZE),
                  }
                  const coordKey = `${chunkCoord.x},${chunkCoord.z}`
                  const adjLx = ((adjacentPos.x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
                  const adjLz = ((adjacentPos.z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
                  return services.blockService
                    .placeBlock(adjacentPos, item, SlotIndex.make(HOTBAR_START + selectedSlot))
                    .pipe(
                      Effect.flatMap(() => services.soundManager.playEffect('blockPlace', { position: adjacentPos })),
                      Effect.andThen(services.chunkManagerService.getChunk(chunkCoord)),
                      Effect.flatMap((updatedChunk) =>
                        Ref.update(refs.dirtyChunksRef, (map) =>
                          HashMap.set(map, coordKey, {
                            chunk: updatedChunk,
                            dirtyAABB: Option.some(aabbFromVoxel({ lx: adjLx, y: adjacentPos.y, lz: adjLz })),
                          }),
                        ),
                      ),
                    )
                },
              }),
            ),
          )
        }),
      )
    },
  })

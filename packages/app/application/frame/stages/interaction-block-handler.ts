import { Effect, HashMap, Option, Ref, Schema } from 'effect'
import type { FrameHandlerDeps, FrameHandlerServices, FrameStageRefs } from '@ts-minecraft/app/frame/types'
import { findAttackableEntity } from '@ts-minecraft/app/frame/stages/attack-targeting'
import { CHUNK_SIZE, CHUNK_HEIGHT, indexToBlockType, SlotIndex, BlockTypeSchema } from '@ts-minecraft/kernel'
import { HOTBAR_START } from '@ts-minecraft/inventory'
import { getParticleUvOffset } from '@ts-minecraft/rendering/particles/particle-system'
import {
  PLAYER_ATTACK_DAMAGE,
  WOODEN_SWORD_ATTACK_DAMAGE,
} from '@ts-minecraft/app/frame-handler.config'

export type TargetBlockHit = { readonly x: number; readonly y: number; readonly z: number }
export type TargetRayHit = {
  readonly blockX: number
  readonly blockY: number
  readonly blockZ: number
  readonly distance: number
  readonly normal: { readonly x: number; readonly y: number; readonly z: number }
}

export const handleLeftClick = (
  deps: Pick<FrameHandlerDeps, 'camera'>,
  services: Pick<
    FrameHandlerServices,
    | 'blockService'
    | 'chunkManagerService'
    | 'debugFeatureFlags'
    | 'soundManager'
    | 'entityManager'
    | 'inventoryService'
    | 'particleSystem'
  >,
  refs: Pick<FrameStageRefs, 'dirtyChunksRef'>,
  context: {
    readonly targetBlock: Option.Option<TargetBlockHit>
    readonly targetHit: Option.Option<TargetRayHit>
    readonly selectedHotbarItem: Option.Option<string>
  },
) =>
  Effect.gen(function* () {
    const debugFlags = yield* services.debugFeatureFlags.getFlags()
    const targetEntity = yield* services.entityManager.getEntities().pipe(
      Effect.map((entities) =>
        findAttackableEntity(entities, deps.camera, Option.map(context.targetHit, (hit) => hit.distance)),
      ),
    )

    yield* Option.match(targetEntity, {
      onNone: () =>
        Option.match(context.targetBlock, {
          onNone: () => Effect.void,
          onSome: (tb) => {
            const pos = { x: tb.x, y: tb.y, z: tb.z }
            const chunkCoord = { x: Math.floor(tb.x / CHUNK_SIZE), z: Math.floor(tb.z / CHUNK_SIZE) }
            const coordKey = `${chunkCoord.x},${chunkCoord.z}`
            // FR-1.6 — read block type BEFORE breakBlock mutates it so the
            // particle UV uses the correct atlas tile. Falls back to dirt
            // (tile 0) if the local index is out of range.
            const lx = ((tb.x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
            const lz = ((tb.z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
            const flatIdx = tb.y + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE
            return services.chunkManagerService.getChunk(chunkCoord).pipe(
              Effect.flatMap((preBreakChunk) => {
                const blockId = preBreakChunk.blocks[flatIdx] ?? 0
                const uv = getParticleUvOffset(blockId)
                return Effect.all(
                  [
                    services.blockService.breakBlock(pos),
                    services.soundManager.playEffect('blockBreak', { position: pos }),
                    debugFlags['particles.spawn']
                      ? services.particleSystem.spawnBurst(
                          tb.x + 0.5,
                          tb.y + 0.5,
                          tb.z + 0.5,
                          uv.u,
                          uv.v,
                          6,
                        )
                      : Effect.void,
                  ],
                  { concurrency: 'unbounded', discard: true },
                ).pipe(
                  Effect.andThen(services.chunkManagerService.getChunk(chunkCoord)),
                  Effect.flatMap((updatedChunk) =>
                    Ref.update(refs.dirtyChunksRef, (map) => HashMap.set(map, coordKey, updatedChunk)),
                  ),
                )
              }),
            )
          },
        }),
      onSome: (entityId) =>
        services.entityManager
          .applyDamage(
            entityId,
            Option.match(context.selectedHotbarItem, {
              onNone: () => PLAYER_ATTACK_DAMAGE,
              onSome: (item) => (item === 'WOODEN_SWORD' ? WOODEN_SWORD_ATTACK_DAMAGE : PLAYER_ATTACK_DAMAGE),
            }),
          )
          .pipe(
            Effect.flatMap((drops) =>
              Effect.forEach(
                Option.getOrElse(drops, () => []),
                (drop) => services.inventoryService.addBlock(drop.blockType, drop.count),
                { concurrency: 'unbounded', discard: true },
              ),
            ),
          ),
    })
  })

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
          if (targetBlockType === 'FURNACE') {
            return services.furnaceService.setSelectedFurnace(targetPos)
          }

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
                  if (!Schema.is(BlockTypeSchema)(item)) return Effect.void
                  const chunkCoord = {
                    x: Math.floor(adjacentPos.x / CHUNK_SIZE),
                    z: Math.floor(adjacentPos.z / CHUNK_SIZE),
                  }
                  const coordKey = `${chunkCoord.x},${chunkCoord.z}`
                  return services.blockService
                    .placeBlock(adjacentPos, item, SlotIndex.make(HOTBAR_START + selectedSlot))
                    .pipe(
                      Effect.flatMap(() =>
                        services.soundManager.playEffect('blockPlace', { position: adjacentPos }),
                      ),
                      Effect.andThen(services.chunkManagerService.getChunk(chunkCoord)),
                      Effect.flatMap((updatedChunk) =>
                        Ref.update(refs.dirtyChunksRef, (map) => HashMap.set(map, coordKey, updatedChunk)),
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

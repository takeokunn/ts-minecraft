// Frame stage: syncs the local player's position to the multiplayer server and
// applies inbound block edits from remote players to the local world.
import { Effect, HashMap, MutableRef, Option, Schema } from 'effect'
import { BlockTypeSchema, CHUNK_SIZE, type Position } from '@ts-minecraft/core'
import { aabbFromVoxel } from '@ts-minecraft/world'
import type { MultiplayerService } from '@ts-minecraft/app/application/multiplayer/multiplayer-service'
import type { FrameHandlerServices, FrameStageRefs } from '@ts-minecraft/app/frame/types'

export const multiplayerStage = (
  multiplayer: MultiplayerService,
  playerPos: { readonly x: number; readonly y: number; readonly z: number },
  playerYaw: number,
  playerPitch: number,
): Effect.Effect<void, never> =>
  multiplayer
    .sendPositionUpdate(playerPos, { yaw: playerYaw, pitch: playerPitch })
    .pipe(Effect.catchAll(() => Effect.void))

/**
 * FR-3: applies block edits received from remote players to the local world.
 * Drains the multiplayer inbound queue, force-sets each voxel (place → block,
 * break → AIR), and records the chunk in dirtyChunksRef so frame-maintenance
 * remeshes it — the same dirty-chunk path local edits use. Fully fault-isolated:
 * a bad edit is skipped, never crashing the frame.
 */
export const applyInboundBlockEdits = (
  multiplayer: MultiplayerService,
  services: Pick<FrameHandlerServices, 'blockService' | 'chunkManagerService'>,
  dirtyChunksRef: FrameStageRefs['dirtyChunksRef'],
): Effect.Effect<void, never> =>
  multiplayer.drainBlockEdits.pipe(
    Effect.flatMap((edits) =>
      Effect.gen(function* () {
        for (const edit of edits) {
          const blockType = edit.kind === 'place' ? edit.blockType : 'AIR'
          // Validate against the canonical block-type set before mutating the world.
          if (!Schema.is(BlockTypeSchema)(blockType)) continue
          const pos = { x: edit.x, y: edit.y, z: edit.z } as Position
          const chunkCoord = { x: Math.floor(edit.x / CHUNK_SIZE), z: Math.floor(edit.z / CHUNK_SIZE) }
          const coordKey = `${chunkCoord.x},${chunkCoord.z}`
          const lx = ((edit.x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
          const lz = ((edit.z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
          yield* services.blockService.forceSetBlock(pos, blockType).pipe(
            Effect.flatMap(() => services.chunkManagerService.getChunk(chunkCoord)),
            Effect.flatMap((chunk) =>
              Effect.sync(() => {
                MutableRef.set(
                  dirtyChunksRef,
                  HashMap.set(MutableRef.get(dirtyChunksRef), coordKey, {
                    chunk,
                    dirtyAABB: Option.some(aabbFromVoxel({ lx, y: edit.y, lz })),
                  }),
                )
              }),
            ),
          ).pipe(Effect.catchAll(() => Effect.void))
        }
      }),
    ),
  )

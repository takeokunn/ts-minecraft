import { Effect, HashMap, MutableRef, Option } from 'effect'
import type { Position } from '@ts-minecraft/core'
import { RedstoneComponentType, type RedstoneComponent } from '@ts-minecraft/entity/domain/redstone/redstone-model'
import { worldToChunkCoord } from '@ts-minecraft/world/domain/chunk-coord-utils'
import type { FrameHandlerServices } from '@ts-minecraft/app/application/frame/types/services'
import type { FrameStageRefs } from '@ts-minecraft/app/application/frame/types/stage-refs'

export type RedstoneLampWorldServices = Pick<
  FrameHandlerServices,
  'blockService' | 'chunkManagerService' | 'redstoneService'
>
export type RedstoneLampWorldRefs = Pick<FrameStageRefs, 'dirtyChunksRef'>

// Six axis-adjacent offsets. A lamp is a non-conductor, so the power BFS never
// writes power into the lamp's OWN position (getPowerAt(lampPos) is always 0);
// the lamp lights when any ADJACENT cell carries power, exactly like vanilla.
const NEIGHBOR_OFFSETS: ReadonlyArray<readonly [number, number, number]> = [
  [1, 0, 0], [-1, 0, 0],
  [0, 1, 0], [0, -1, 0],
  [0, 0, 1], [0, 0, -1],
]

const maxNeighborPower = (
  services: Pick<RedstoneLampWorldServices, 'redstoneService'>,
  position: Position,
): Effect.Effect<number, never> =>
  Effect.gen(function* () {
    let max = 0
    for (const [dx, dy, dz] of NEIGHBOR_OFFSETS) {
      const p = yield* services.redstoneService.getPowerAt({
        x: position.x + dx,
        y: position.y + dy,
        z: position.z + dz,
      })
      if (p > max) max = p
    }
    return max
  })

const markChunkDirty = (
  refs: RedstoneLampWorldRefs,
  services: Pick<RedstoneLampWorldServices, 'chunkManagerService'>,
  position: Position,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const coord = worldToChunkCoord(position)
    const coordKey = `${coord.x},${coord.z}`
    yield* services.chunkManagerService.getChunk(coord).pipe(
      Effect.tap((chunk) =>
        Effect.sync(() => {
          MutableRef.set(
            refs.dirtyChunksRef,
            HashMap.set(MutableRef.get(refs.dirtyChunksRef), coordKey, { chunk, dirtyAABB: Option.none() }),
          )
        }),
      ),
      Effect.catchAll(() => Effect.void),
    )
  })

/**
 * Syncs REDSTONE_LAMP world blocks to the redstone simulation's power state:
 * powered lamps become REDSTONE_LAMP_LIT (emissive 15), unpowered lamps
 * revert. Idempotent per lamp — the block is only rewritten (and the chunk
 * remeshed) when the lit state actually changed, so a steady circuit costs
 * one power read per lamp per redstone tick. Fault-isolated like the piston
 * effects: a failed read/write skips that lamp, never the frame.
 */
export const applyLampWorldEffects = (
  services: RedstoneLampWorldServices,
  refs: RedstoneLampWorldRefs,
  components: ReadonlyArray<RedstoneComponent>,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    for (const component of components) {
      if (component.type !== RedstoneComponentType.Lamp) continue
      // Vanilla: a lamp lights from an adjacent powered cell, not from power at
      // its own (non-conducting) position — which the sim always reports as 0.
      const power = yield* maxNeighborPower(services, component.position)
      const currentBlock = yield* services.blockService
        .getBlock(component.position)
        .pipe(Effect.catchAll(() => Effect.succeed(null)))
      if (currentBlock !== 'REDSTONE_LAMP' && currentBlock !== 'REDSTONE_LAMP_LIT') continue
      const desired = power > 0 ? 'REDSTONE_LAMP_LIT' : 'REDSTONE_LAMP'
      if (currentBlock === desired) continue
      const written = yield* services.blockService
        .forceSetBlock(component.position, desired)
        .pipe(Effect.as(true), Effect.catchAll(() => Effect.succeed(false)))
      if (!written) continue
      yield* markChunkDirty(refs, services, component.position)
    }
  })

import { Effect, MutableRef } from 'effect'

import type { Chunk } from '../domain/chunk'
import { collectFallingBlockMoves } from '../domain/falling-block'
import { worldToChunkCoord } from '../domain/chunk-coord-utils'
import type { BlockService } from './block-service'
import type { ChunkManagerService } from './chunk-manager-service'

// Background consistency sweep width. Falling blocks are primarily EVENT-driven
// (chunks whose blocks changed since the last tick, via the frame's dirty-chunk
// map); the sweep exists only to catch mutation paths that bypass that map
// (e.g. fluid updates). Scanning every loaded chunk every tick — the previous
// behaviour — cost ~7M+ block reads per 16-48ms maintenance tick (~40% of the
// main thread while exploring); two chunks per tick is ~0.05ms.
export const FALLING_BLOCK_SWEEP_CHUNKS_PER_TICK = 2

type FallingBlockMaintenanceServices = {
  readonly blockService: Pick<BlockService, 'forceSetBlock'>
  readonly chunkManagerService: Pick<ChunkManagerService, 'getLoadedChunks'>
}

export type FallingBlockMaintenanceState = {
  readonly sweepCursorRef: MutableRef.MutableRef<number>
  // Chunks where blocks moved last tick: a falling column settles one block per
  // tick, so the chunk must be rescanned next tick to continue the cascade even
  // though no external event re-dirties it.
  readonly pendingCoordKeysRef: MutableRef.MutableRef<ReadonlySet<string>>
}

export const makeFallingBlockMaintenanceState = (): FallingBlockMaintenanceState => ({
  sweepCursorRef: MutableRef.make(0),
  pendingCoordKeysRef: MutableRef.make<ReadonlySet<string>>(new Set()),
})

const chunkKey = (chunk: Pick<Chunk, 'coord'>): string => `${chunk.coord.x},${chunk.coord.z}`

export const runFallingBlockMaintenance = (
  services: FallingBlockMaintenanceServices,
  state: FallingBlockMaintenanceState,
  dirtyCoordKeys: ReadonlySet<string>,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const loadedChunks = yield* services.chunkManagerService
      .getLoadedChunks()
      .pipe(Effect.catchAllCause(() => Effect.succeed([])))
    if (loadedChunks.length === 0) return

    const eventKeys = new Set([...dirtyCoordKeys, ...MutableRef.get(state.pendingCoordKeysRef)])
    const scanChunks = new Map<string, Chunk>()
    for (const chunk of loadedChunks) {
      if (eventKeys.has(chunkKey(chunk))) scanChunks.set(chunkKey(chunk), chunk)
    }
    const cursor = MutableRef.get(state.sweepCursorRef)
    for (let i = 0; i < FALLING_BLOCK_SWEEP_CHUNKS_PER_TICK; i++) {
      const chunk = loadedChunks[(cursor + i) % loadedChunks.length]
      if (chunk !== undefined) scanChunks.set(chunkKey(chunk), chunk)
    }
    MutableRef.set(state.sweepCursorRef, (cursor + FALLING_BLOCK_SWEEP_CHUNKS_PER_TICK) % loadedChunks.length)

    const fallingBlockMoves = yield* collectFallingBlockMoves([...scanChunks.values()]).pipe(
      Effect.catchAllCause(() => Effect.succeed([])),
    )

    const nextPending = new Set<string>()
    for (const move of fallingBlockMoves) {
      yield* services.blockService.forceSetBlock(move.from, 'AIR').pipe(Effect.catchAllCause(() => Effect.void))
      yield* services.blockService.forceSetBlock(move.to, move.blockType).pipe(Effect.catchAllCause(() => Effect.void))
      const coord = worldToChunkCoord(move.from)
      nextPending.add(`${coord.x},${coord.z}`)
    }
    MutableRef.set(state.pendingCoordKeysRef, nextPending)
  })

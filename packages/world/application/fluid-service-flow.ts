import { Effect, HashMap, Option, Ref } from 'effect'
import {
  blockIndexFor,
  chunkCoordsForPosition,
  getBlockIndex,
  maxLevelFor,
} from '@ts-minecraft/block/domain/fluid-position-utils'
import type { FluidCell, FluidState } from '@ts-minecraft/block/domain/fluid-model'
import { ChunkCacheKey, type Position } from '@ts-minecraft/core'
import { resolveNeighborContact } from './fluid-service-contact-ops'
import { flowLaterally, tryFlowDownward, tryRenewWaterSource } from './fluid-service-spread-ops'
import { removeCell } from './fluid-state-ops'
import type { LoadedChunkCache } from './fluid-service-helpers'
import type { FluidServiceWrites } from './fluid-service-write-ports'

export const processFluidCell = (
  writes: FluidServiceWrites,
  loaded: LoadedChunkCache,
  tickStateRef: Ref.Ref<FluidState>,
  position: Position,
  cell: FluidCell,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    /* c8 ignore next */
    const currentChunk = Option.getOrNull(HashMap.get(loaded, ChunkCacheKey.make(chunkCoordsForPosition(position))))
    /* c8 ignore next */
    if (currentChunk === null) return

    const idx = getBlockIndex(position)
    if (idx < 0 || currentChunk.blocks[idx] !== blockIndexFor(cell.type)) {
      yield* Ref.update(tickStateRef, (s) => removeCell(s, position))
      return
    }

    const consumed = yield* resolveNeighborContact(writes, loaded, tickStateRef, position, cell)
    if (consumed) return

    const renewed = yield* tryRenewWaterSource(writes, loaded, tickStateRef, position, cell)
    if (renewed) return

    const maxLevel = maxLevelFor(cell.type)
    const nextLevel = cell.source ? 1 : Math.min(cell.level + 1, maxLevel)
    if (!cell.source && cell.level >= maxLevel) return

    const flowedDown = yield* tryFlowDownward(writes, loaded, tickStateRef, position, cell, nextLevel)
    if (!flowedDown) yield* flowLaterally(writes, loaded, tickStateRef, position, cell, nextLevel)
  })

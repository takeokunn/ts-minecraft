import { Effect, HashMap, Option, Ref } from 'effect'
import { NOTIFY_OFFSETS } from '@ts-minecraft/block/domain/fluid-model'
import { blockKey, enqueue } from '@ts-minecraft/block/domain/fluid-position-utils'
import type { FluidCell, FluidState, FluidType } from '@ts-minecraft/block/domain/fluid-model'
import { type Position } from '@ts-minecraft/core'
import { resolveContact } from '../domain/fluid-contact'
import { removeCell } from './fluid-state-ops'
import type { LoadedChunkCache } from './fluid-service-helpers'
import type { FluidServiceWrites } from './fluid-service-write-ports'

const _neighborScratch: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 }

export const resolveNeighborContact = (
  writes: FluidServiceWrites,
  loaded: LoadedChunkCache,
  stateRefLocal: Ref.Ref<FluidState>,
  position: Position,
  cell: FluidCell,
): Effect.Effect<boolean, never> =>
  Effect.gen(function* () {
    const state = yield* Ref.get(stateRefLocal)
    // Imperative scan over the 6 neighbour offsets reusing one scratch position.
    // Preserves NOTIFY_OFFSETS order (first opposite-type neighbour wins).
    let offset: (typeof NOTIFY_OFFSETS)[number] | null = null
    for (let i = 0; i < NOTIFY_OFFSETS.length; i++) {
      const candidate = NOTIFY_OFFSETS[i]!
      _neighborScratch.x = position.x + candidate.x
      _neighborScratch.y = position.y + candidate.y
      _neighborScratch.z = position.z + candidate.z
      const nc = Option.getOrNull(HashMap.get(state.cells, blockKey(_neighborScratch)))
      if (nc !== null && nc.type !== cell.type) {
        offset = candidate
        break
      }
    }
    if (offset === null) return false
    const neighborPos = { x: position.x + offset.x, y: position.y + offset.y, z: position.z + offset.z }
    const neighborCell = Option.getOrElse(
      HashMap.get(state.cells, blockKey(neighborPos)),
      () => ({ level: 0, source: true, type: 'water' as FluidType }),
    )
    /* c8 ignore next 3 */
    const [lavaCell, lavaPos, waterCell, waterPos] = cell.type === 'lava'
      ? [cell, position, neighborCell, neighborPos] as const
      : [neighborCell, neighborPos, cell, position] as const
    const solid = resolveContact(lavaCell, waterCell)
    /* c8 ignore next */
    const blockType = Option.getOrNull(solid)
    if (blockType === null) return false
    // COBBLESTONE replaces the flowing lava, STONE replaces the water flow around a lava source.
    /* c8 ignore next */
    const targetPos = blockType === 'COBBLESTONE' ? lavaPos : waterPos
    yield* Ref.update(stateRefLocal, (s) => {
      const withoutLava = removeCell(s, lavaPos)
      const withoutWater = removeCell(withoutLava, waterPos)
      return { ...withoutWater, frontier: enqueue(withoutWater.frontier, targetPos) }
    })
    yield* writes.writeSolid(loaded, targetPos, blockType)
    /* c8 ignore next 4 */
    const consumed = (targetPos.x === position.x && targetPos.y === position.y && targetPos.z === position.z)
      || (blockType === 'STONE' && cell.type === 'water')
      || (blockType === 'COBBLESTONE' && cell.type === 'lava')
    return consumed
  })

import { Effect, HashMap, Option, Ref } from 'effect'
import {
  FLOW_OFFSETS,
  LAVA_INDEX,
  NOTIFY_OFFSETS,
  WATER_INDEX,
  blockIndexFor,
  blockKey,
  chunkCoordsForPosition,
  enqueue,
  getBlockIndex,
  maxLevelFor,
} from '@ts-minecraft/block'
import type { FluidCell, FluidState, FluidType } from '@ts-minecraft/block'
import { ChunkCacheKey, type Position } from '@ts-minecraft/core'
import type { BlockType } from '@ts-minecraft/core'
import { resolveContact } from '../domain/fluid-contact'
import { removeCell, setCellAndEnqueueKey } from './fluid-state-ops'
import { blockAt, canFluidReplaceAt, type LoadedChunkCache } from './fluid-service-helpers'

type FluidFlowWrites = {
  readonly writeFluid: (loaded: LoadedChunkCache, position: Position, cell: FluidCell) => Effect.Effect<void, never>
  readonly writeSolid: (loaded: LoadedChunkCache, position: Position, blockType: BlockType) => Effect.Effect<void, never>
}

// Reused scratch position for the per-cell neighbour scan in resolveNeighborContact.
// The scan loop is fully synchronous (no yield* between writes and reads), so a single
// shared object is safe and avoids allocating 6 neighborPos literals per fluid cell.
const _neighborScratch: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 }

const resolveNeighborContact = (
  writes: FluidFlowWrites,
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

const tryFlowDownward = (
  writes: FluidFlowWrites,
  loaded: LoadedChunkCache,
  tickStateRef: Ref.Ref<FluidState>,
  position: Position,
  cell: FluidCell,
  nextLevel: number,
): Effect.Effect<boolean, never> =>
  Effect.gen(function* () {
    const below = { x: position.x, y: position.y - 1, z: position.z }
    if (!canFluidReplaceAt(loaded, below, cell.type)) return false
    const targetKey = blockKey(below)
    const shouldWrite = yield* Ref.modify(tickStateRef, (s) => {
      const existing = HashMap.get(s.cells, targetKey)
      /* c8 ignore next */
      const existingCell = Option.getOrNull(existing)
      if (existingCell !== null && existingCell.type === cell.type && existingCell.level <= nextLevel) return [false, s] as const
      const newCell: FluidCell = { level: nextLevel, source: false, type: cell.type }
      return [true, setCellAndEnqueueKey(s, targetKey, newCell)] as const
    })
    /* c8 ignore next */
    if (shouldWrite) yield* writes.writeFluid(loaded, below, { level: nextLevel, source: false, type: cell.type })
    return true
  })

const tryRenewWaterSource = (
  writes: FluidFlowWrites,
  loaded: LoadedChunkCache,
  tickStateRef: Ref.Ref<FluidState>,
  position: Position,
  cell: FluidCell,
): Effect.Effect<boolean, never> =>
  Effect.gen(function* () {
    if (cell.type !== 'water' || cell.source) return false
    const below = { x: position.x, y: position.y - 1, z: position.z }
    if (canFluidReplaceAt(loaded, below, 'water')) return false

    const state = yield* Ref.get(tickStateRef)
    let sourceNeighbors = 0
    for (let i = 0; i < FLOW_OFFSETS.length; i++) {
      const offset = FLOW_OFFSETS[i]!
      const neighbor = {
        x: position.x + offset.x,
        y: position.y,
        z: position.z + offset.z,
      }
      const neighborCell = HashMap.get(state.cells, blockKey(neighbor))
      const neighborValue = Option.getOrNull(neighborCell)
      if (neighborValue !== null && neighborValue.type === 'water' && neighborValue.source) {
        sourceNeighbors++
        if (sourceNeighbors >= 2) break
      }
    }
    if (sourceNeighbors < 2) return false

    const renewed: FluidCell = { level: 0, source: true, type: 'water' }
    yield* Ref.update(tickStateRef, (s) => setCellAndEnqueueKey(s, blockKey(position), renewed))
    yield* writes.writeFluid(loaded, position, renewed)
    return true
  })

const flowLaterally = (
  writes: FluidFlowWrites,
  loaded: LoadedChunkCache,
  tickStateRef: Ref.Ref<FluidState>,
  position: Position,
  cell: FluidCell,
  nextLevel: number,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    for (let i = 0; i < FLOW_OFFSETS.length; i++) {
      const offset = FLOW_OFFSETS[i]!
      const target = {
        x: position.x + offset.x,
        y: position.y + offset.y,
        z: position.z + offset.z,
      }
      if (!canFluidReplaceAt(loaded, target, cell.type)) {
        const otherIdx = blockAt(loaded, target)
        const otherIdxVal = Option.getOrNull(otherIdx)
        const isOpposite = otherIdxVal !== null &&
          /* c8 ignore next */
          (cell.type === 'lava' ? otherIdxVal === WATER_INDEX : otherIdxVal === LAVA_INDEX)
        /* c8 ignore next 3 */
        if (isOpposite) yield* resolveNeighborContact(writes, loaded, tickStateRef, position, cell)
        continue
      }
      const targetKey = blockKey(target)
      const shouldWrite = yield* Ref.modify(tickStateRef, (s) => {
        const existing = HashMap.get(s.cells, targetKey)
        /* c8 ignore next */
        const existingCell = Option.getOrNull(existing)
        if (existingCell !== null && existingCell.type === cell.type && existingCell.level <= nextLevel) return [false, s] as const
        const newCell: FluidCell = { level: nextLevel, source: false, type: cell.type }
        return [true, setCellAndEnqueueKey(s, targetKey, newCell)] as const
      })
      if (shouldWrite) yield* writes.writeFluid(loaded, target, { level: nextLevel, source: false, type: cell.type })
    }
  })

export const processFluidCell = (
  writes: FluidFlowWrites,
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

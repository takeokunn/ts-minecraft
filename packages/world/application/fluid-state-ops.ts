import { HashMap, HashSet, Option } from 'effect'
import type { Chunk } from '../domain/chunk'
import { FLUID_BYTE_LENGTH, decodeFluidByte } from '@ts-minecraft/block/domain/fluid'
import { LAVA_INDEX, WATER_INDEX } from '@ts-minecraft/block/domain/fluid-model'
import type { FluidCell, FluidKey, FluidState, FluidType } from '@ts-minecraft/block/domain/fluid-model'
import { blockKey, blockKeyFromChunkIndex, enqueueKey } from '@ts-minecraft/block/domain/fluid-position-utils'
import type { Position } from '@ts-minecraft/core'

export const setCell = (state: FluidState, position: Position, cell: FluidCell): FluidState => ({
  ...state,
  cells: HashMap.set(state.cells, blockKey(position), cell),
})

// Set a cell and enqueue its own key into the frontier in a SINGLE FluidState spread.
// The flow paths always do both for the same key; folding them avoids allocating two
// FluidState objects per fluid write (setCell's spread + the caller's frontier spread)
// and skips recomputing blockKey (the caller already has the key).
export const setCellAndEnqueueKey = (
  state: FluidState,
  key: FluidKey,
  cell: FluidCell,
): FluidState => ({
  ...state,
  cells: HashMap.set(state.cells, key, cell),
  frontier: HashSet.add(state.frontier, key),
})

export const removeCell = (state: FluidState, position: Position): FluidState => ({
  ...state,
  cells: HashMap.remove(state.cells, blockKey(position)),
})

export const hydrateChunk = (state: FluidState, chunk: Chunk): FluidState => {
  const fluid = Option.getOrNull(chunk.fluid)
  const hasFluid = fluid !== null && fluid.byteLength === FLUID_BYTE_LENGTH && fluid.some((byte) => byte !== 0)
  let cells = state.cells
  let frontier = state.frontier
  let changed = false

  if (!hasFluid) {
    for (let idx = 0; idx < chunk.blocks.length; idx++) {
      const blockIdx = chunk.blocks[idx]
      if (blockIdx !== WATER_INDEX && blockIdx !== LAVA_INDEX) continue
      const key = blockKeyFromChunkIndex(chunk.coord, idx)
      const type: FluidType = blockIdx === LAVA_INDEX ? 'lava' : 'water'
      cells = HashMap.set(cells, key, { level: 0, source: true, type })
      frontier = enqueueKey(frontier, key)
      changed = true
    }
    return changed ? { ...state, cells, frontier } : state
  }

  for (let idx = 0; idx < fluid.length; idx++) {
    const byte = fluid[idx]!
    if (byte === 0) continue
    const cell = Option.getOrThrow(decodeFluidByte(byte))
    const key = blockKeyFromChunkIndex(chunk.coord, idx)
    cells = HashMap.set(cells, key, cell)
    frontier = enqueueKey(frontier, key)
  }
  return { ...state, cells, frontier }
}

import { HashMap, HashSet, Option } from 'effect'
import type { Chunk } from '../domain/chunk'
import { FLUID_BYTE_LENGTH, LAVA_INDEX, WATER_INDEX,
blockKey, decodeFluidByte, enqueue, positionFromChunk, } from '@ts-minecraft/block'
import type { FluidCell, FluidKey, FluidState, FluidType } from '@ts-minecraft/block'
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
  const fluid = Option.getOrNull(Option.filter(
    chunk.fluid,
    (b) => b.byteLength === FLUID_BYTE_LENGTH && b.some((byte) => byte !== 0)
  ))
  if (fluid === null) {
    return chunk.blocks.reduce((acc: FluidState, blockIdx: number, idx: number): FluidState => {
      if (blockIdx !== WATER_INDEX && blockIdx !== LAVA_INDEX) return acc
      const position = positionFromChunk(chunk.coord, idx)
      const type: FluidType = blockIdx === LAVA_INDEX ? 'lava' : 'water'
      const next = setCell(acc, position, { level: 0, source: true, type })
      return { ...next, frontier: enqueue(next.frontier, position) }
    }, state)
  }
  return fluid.reduce((acc: FluidState, byte: number, idx: number): FluidState => {
    if (byte === 0) return acc
    const cell = Option.getOrNull(decodeFluidByte(byte))
    /* c8 ignore next */
    if (cell === null) return acc
    const position = positionFromChunk(chunk.coord, idx)
    const next = setCell(acc, position, cell)
    return { ...next, frontier: enqueue(next.frontier, position) }
  }, state)
}

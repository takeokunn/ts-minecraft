import { HashMap, HashSet, Option } from 'effect'
import type { Chunk } from '../domain/chunk'
import { FLUID_BYTE_LENGTH, decodeFluidByte } from '@ts-minecraft/block/domain/fluid'
import { LAVA_INDEX, WATER_INDEX } from '@ts-minecraft/block/domain/fluid-model'
import type { FluidCell, FluidKey, FluidState, FluidType } from '@ts-minecraft/block/domain/fluid-model'
import { blockKey, blockKeyFromChunkIndex, enqueueKey } from '@ts-minecraft/block/domain/fluid-position-utils'
import { CHUNK_HEIGHT, CHUNK_SIZE } from '@ts-minecraft/core'
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


// Steady-state guard for chunk hydration: an ocean-interior cell (every
// neighbor is the same fluid or solid) can never flow, so enqueueing it only
// burns tick budget on no-ops — a single ocean chunk otherwise floods the
// frontier with thousands of dead cells at world load. A cell needs a tick
// only when a reachable in-chunk neighbor is AIR (room to flow) or a
// DIFFERENT fluid (contact reaction). Cells on the chunk's x/z faces are
// enqueued conservatively — their outward neighbor is invisible here.
// Chunk block layout: idx = (x * CHUNK_SIZE + z) * CHUNK_HEIGHT + y.
const hydratedCellNeedsTick = (blocks: Uint8Array | Readonly<Uint8Array>, idx: number, fluidIdx: number): boolean => {
  const y = idx % CHUNK_HEIGHT
  const column = Math.floor(idx / CHUNK_HEIGHT)
  const z = column % CHUNK_SIZE
  const x = Math.floor(column / CHUNK_SIZE)
  if (x === 0 || x === CHUNK_SIZE - 1 || z === 0 || z === CHUNK_SIZE - 1) return true
  const otherFluid = fluidIdx === WATER_INDEX ? LAVA_INDEX : WATER_INDEX
  const flows = (neighbor: number | undefined): boolean => neighbor === 0 || neighbor === otherFluid
  return (
    (y > 0 && flows(blocks[idx - 1])) ||
    (y < CHUNK_HEIGHT - 1 && flows(blocks[idx + 1])) ||
    flows(blocks[idx - CHUNK_HEIGHT]) ||
    flows(blocks[idx + CHUNK_HEIGHT]) ||
    flows(blocks[idx - CHUNK_SIZE * CHUNK_HEIGHT]) ||
    flows(blocks[idx + CHUNK_SIZE * CHUNK_HEIGHT])
  )
}

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
      if (hydratedCellNeedsTick(chunk.blocks, idx, blockIdx)) frontier = enqueueKey(frontier, key)
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
    const fluidBlockIdx = cell.type === 'lava' ? LAVA_INDEX : WATER_INDEX
    if (!cell.source || hydratedCellNeedsTick(chunk.blocks, idx, fluidBlockIdx)) frontier = enqueueKey(frontier, key)
  }
  return { ...state, cells, frontier }
}

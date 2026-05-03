import { HashMap, Option } from 'effect'
import type { Chunk } from '../domain/chunk'
import {
  FLUID_BYTE_LENGTH, LAVA_INDEX, WATER_INDEX,
  blockKey, decodeFluidByte, enqueue, positionFromChunk,
} from '@ts-minecraft/world-state'
import type { FluidCell, FluidState, FluidType } from '@ts-minecraft/world-state'
import type { Position } from '@ts-minecraft/kernel'

export const setCell = (state: FluidState, position: Position, cell: FluidCell): FluidState => ({
  ...state,
  cells: HashMap.set(state.cells, blockKey(position), cell),
})

export const removeCell = (state: FluidState, position: Position): FluidState => ({
  ...state,
  cells: HashMap.remove(state.cells, blockKey(position)),
})

export const hydrateChunk = (state: FluidState, chunk: Chunk): FluidState =>
  Option.match(
    Option.filter(
      chunk.fluid,
      (b) => b.byteLength === FLUID_BYTE_LENGTH && b.some((byte) => byte !== 0)
    ),
    {
      onNone: () =>
        chunk.blocks.reduce((acc: FluidState, blockIdx: number, idx: number): FluidState => {
          if (blockIdx !== WATER_INDEX && blockIdx !== LAVA_INDEX) return acc
          const position = positionFromChunk(chunk.coord, idx)
          const type: FluidType = blockIdx === LAVA_INDEX ? 'lava' : 'water'
          const next = setCell(acc, position, { level: 0, source: true, type })
          return { ...next, frontier: enqueue(next.frontier, position) }
        }, state),
      onSome: (fluid) =>
        fluid.reduce((acc: FluidState, byte: number, idx: number): FluidState => {
          if (byte === 0) return acc
          return Option.match(decodeFluidByte(byte), {
            /* c8 ignore next */
            onNone: () => acc,
            onSome: (cell) => {
              const position = positionFromChunk(chunk.coord, idx)
              const next = setCell(acc, position, cell)
              return { ...next, frontier: enqueue(next.frontier, position) }
            },
          })
        }, state),
    }
  )

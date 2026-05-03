import { Effect, Option } from 'effect'
import { setBlockInChunk } from '../domain/chunk'
import type { Chunk } from '../domain/chunk'
import {
  createFluidBuffer, encodeFluidCell, FLUID_BYTE_LENGTH,
  blockTypeFor, getBlockIndex, localX, localY, localZ,
} from '@ts-minecraft/world-state'
import type { FluidCell } from '@ts-minecraft/world-state'
import type { Position } from '@ts-minecraft/kernel'
import type { BlockType } from '@ts-minecraft/kernel'
import type { ChunkManagerService } from './chunk-manager-service'

export const ensureFluidBuffer = (chunk: Chunk): Effect.Effect<Uint8Array<ArrayBufferLike>> =>
  Option.match(
    Option.filter(chunk.fluid, (b) => b.byteLength === FLUID_BYTE_LENGTH),
    {
      onNone: () =>
        Effect.sync(() => {
          const fluid = createFluidBuffer()
          ;(chunk as { fluid: Option.Option<Uint8Array<ArrayBufferLike>> }).fluid = Option.some(fluid)
          return fluid
        }),
      onSome: Effect.succeed,
    }
  )

export const setFluidBlockIfLoaded = (
  chunkOpt: Option.Option<Chunk>,
  position: Position,
  cell: FluidCell,
  chunkManagerService: ChunkManagerService,
): Effect.Effect<void, never> =>
  Option.match(chunkOpt, {
    /* c8 ignore next */
    onNone: () => Effect.void,
    onSome: (chunk) => Effect.gen(function* () {
      yield* Effect.ignore(setBlockInChunk(chunk, localX(position), localY(position), localZ(position), blockTypeFor(cell.type)))
      const fluid = yield* ensureFluidBuffer(chunk)
      const idx = getBlockIndex(position)
      if (idx >= 0) {
        fluid[idx] = encodeFluidCell(cell)
      }
      yield* chunkManagerService.markChunkDirty(chunk.coord)
    }),
  })

export const setAirBlockIfLoaded = (
  chunkOpt: Option.Option<Chunk>,
  position: Position,
  chunkManagerService: ChunkManagerService,
): Effect.Effect<void, never> =>
  Option.match(chunkOpt, {
    /* c8 ignore next */
    onNone: () => Effect.void,
    onSome: (chunk) => Effect.gen(function* () {
      yield* Effect.ignore(setBlockInChunk(chunk, localX(position), localY(position), localZ(position), 'AIR'))
      const fluid = yield* ensureFluidBuffer(chunk)
      const idx = getBlockIndex(position)
      if (idx >= 0) {
        fluid[idx] = 0
      }
      yield* chunkManagerService.markChunkDirty(chunk.coord)
    }),
  })

export const setSolidBlockIfLoaded = (
  chunkOpt: Option.Option<Chunk>,
  position: Position,
  blockType: BlockType,
  chunkManagerService: ChunkManagerService,
): Effect.Effect<void, never> =>
  Option.match(chunkOpt, {
    /* c8 ignore next */
    onNone: () => Effect.void,
    onSome: (chunk) => Effect.gen(function* () {
      yield* Effect.ignore(setBlockInChunk(chunk, localX(position), localY(position), localZ(position), blockType))
      const fluid = yield* ensureFluidBuffer(chunk)
      const idx = getBlockIndex(position)
      /* c8 ignore next */
      if (idx >= 0) {
        fluid[idx] = 0
      }
      yield* chunkManagerService.markChunkDirty(chunk.coord)
    }),
  })

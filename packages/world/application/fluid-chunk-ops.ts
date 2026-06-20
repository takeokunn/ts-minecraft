import { Effect, Option } from 'effect'
import { setBlockInChunk } from '../domain/chunk'
import type { Chunk } from '../domain/chunk'
import { createFluidBuffer, encodeFluidCell, FLUID_BYTE_LENGTH } from '@ts-minecraft/block/domain/fluid'
import { blockTypeFor, getBlockIndex, localX, localY, localZ } from '@ts-minecraft/block/domain/fluid-position-utils'
import type { FluidCell } from '@ts-minecraft/block/domain/fluid-model'
import type { Position } from '@ts-minecraft/core'
import type { BlockType } from '@ts-minecraft/core'
import type { ChunkManagerService } from './chunk-manager-service'

export const ensureFluidBuffer = (chunk: Chunk): Effect.Effect<Uint8Array<ArrayBufferLike>> => {
  const existing = Option.getOrNull(chunk.fluid)
  if (existing !== null && existing.byteLength === FLUID_BYTE_LENGTH) {
    return Effect.succeed(existing)
  }
  return Effect.sync(() => {
    const fluid = createFluidBuffer()
    ;(chunk as { fluid: Option.Option<Uint8Array<ArrayBufferLike>> }).fluid = Option.some(fluid)
    return fluid
  })
}

export const setFluidBlockIfLoaded = (
  chunkOpt: Option.Option<Chunk>,
  position: Position,
  cell: FluidCell,
  chunkManagerService: ChunkManagerService,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    /* c8 ignore next */
    const chunk = Option.getOrNull(chunkOpt)
    if (chunk === null) return
    const lx = localX(position)
    const ly = localY(position)
    const lz = localZ(position)
    yield* Effect.ignore(setBlockInChunk(chunk, lx, ly, lz, blockTypeFor(cell.type)))
    const fluid = yield* ensureFluidBuffer(chunk)
    const idx = getBlockIndex(position)
    if (idx >= 0) {
      fluid[idx] = encodeFluidCell(cell)
    }
    yield* chunkManagerService.markChunkDirty(chunk.coord, [{ lx, y: ly, lz }])
  })

export const setAirBlockIfLoaded = (
  chunkOpt: Option.Option<Chunk>,
  position: Position,
  chunkManagerService: ChunkManagerService,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    /* c8 ignore next */
    const chunk = Option.getOrNull(chunkOpt)
    if (chunk === null) return
    const lx = localX(position)
    const ly = localY(position)
    const lz = localZ(position)
    yield* Effect.ignore(setBlockInChunk(chunk, lx, ly, lz, 'AIR'))
    const fluid = yield* ensureFluidBuffer(chunk)
    const idx = getBlockIndex(position)
    if (idx >= 0) {
      fluid[idx] = 0
    }
    yield* chunkManagerService.markChunkDirty(chunk.coord, [{ lx, y: ly, lz }])
  })

export const setSolidBlockIfLoaded = (
  chunkOpt: Option.Option<Chunk>,
  position: Position,
  blockType: BlockType,
  chunkManagerService: ChunkManagerService,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    /* c8 ignore next */
    const chunk = Option.getOrNull(chunkOpt)
    if (chunk === null) return
    const lx = localX(position)
    const ly = localY(position)
    const lz = localZ(position)
    yield* Effect.ignore(setBlockInChunk(chunk, lx, ly, lz, blockType))
    const fluid = yield* ensureFluidBuffer(chunk)
    const idx = getBlockIndex(position)
    /* c8 ignore next */
    if (idx >= 0) {
      fluid[idx] = 0
    }
    yield* chunkManagerService.markChunkDirty(chunk.coord, [{ lx, y: ly, lz }])
  })

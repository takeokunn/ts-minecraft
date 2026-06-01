import { Array as Arr, HashSet, Option } from 'effect'
import { CHUNK_HEIGHT, CHUNK_SIZE, blockIndex } from '@ts-minecraft/core'
import type { ChunkCoord } from '@ts-minecraft/core'
import type { FluidType } from './fluid'
import type { BlockType } from '@ts-minecraft/core'
import type { Position } from '@ts-minecraft/core'
import {
  BIAS,
  FluidKey,
  LAVA_INDEX,
  LAVA_MAX_LEVEL,
  NOTIFY_OFFSETS,
  WATER_INDEX,
  WATER_MAX_LEVEL,
  XZ_STRIDE,
  Y_STRIDE,
  type FluidKey as FluidKeyType,
} from './fluid-model'

export const blockKey = (position: Position): FluidKeyType =>
  FluidKey((Math.floor(position.x) + BIAS) * XZ_STRIDE + Math.floor(position.y) * Y_STRIDE + (Math.floor(position.z) + BIAS))

export const parseKey = (key: FluidKeyType): Position => {
  const biasedX = Math.floor(key / XZ_STRIDE)
  const remainder = key - biasedX * XZ_STRIDE
  const y = Math.floor(remainder / Y_STRIDE)
  const biasedZ = remainder - y * Y_STRIDE
  return {
    x: biasedX - BIAS,
    y,
    z: biasedZ - BIAS,
  }
}

export const floorMod = (value: number, modulo: number): number => ((value % modulo) + modulo) % modulo

export const localX = (position: Position): number => floorMod(Math.floor(position.x), CHUNK_SIZE)
export const localY = (position: Position): number => Math.floor(position.y)
export const localZ = (position: Position): number => floorMod(Math.floor(position.z), CHUNK_SIZE)

export const enqueue = (frontier: HashSet.HashSet<FluidKeyType>, position: Position): HashSet.HashSet<FluidKeyType> =>
  Arr.reduce(
    NOTIFY_OFFSETS,
    HashSet.add(frontier, blockKey(position)),
    (acc, offset) => HashSet.add(acc, blockKey({
      x: position.x + offset.x,
      y: position.y + offset.y,
      z: position.z + offset.z,
    }))
  )

export const chunkCoordsForPosition = (position: Position): ChunkCoord => ({
  x: Math.floor(position.x / CHUNK_SIZE),
  z: Math.floor(position.z / CHUNK_SIZE),
})

export const positionFromChunk = (chunkCoord: ChunkCoord, idx: number): Position => {
  const y = idx % CHUNK_HEIGHT
  const column = Math.floor(idx / CHUNK_HEIGHT)
  const z = column % CHUNK_SIZE
  const x = Math.floor(column / CHUNK_SIZE)
  return {
    x: chunkCoord.x * CHUNK_SIZE + x,
    y,
    z: chunkCoord.z * CHUNK_SIZE + z,
  }
}

export const getBlockIndex = (position: Position): number => {
  const idxOpt = blockIndex(localX(position), localY(position), localZ(position))
  return Option.getOrElse(idxOpt, () => -1)
}

export const maxLevelFor = (type: FluidType): number => (type === 'lava' ? LAVA_MAX_LEVEL : WATER_MAX_LEVEL)

export const blockTypeFor = (type: FluidType): BlockType => (type === 'lava' ? 'LAVA' : 'WATER')

export const blockIndexFor = (type: FluidType): number => (type === 'lava' ? LAVA_INDEX : WATER_INDEX)

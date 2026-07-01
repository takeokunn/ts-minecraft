import { Data, Effect } from 'effect'
import { CHUNK_HEIGHT, CHUNK_SIZE, blockTypeToIndex, type BlockType, type Position } from '@ts-minecraft/core'

import type { Chunk } from './chunk'
import { chunkBlockIndexUnchecked } from './terrain/math'

export const FIRE_MAINTENANCE_INTERVAL_SECS = 5
export const FIRE_SPREAD_MAX_PER_TICK = 16
export const FIRE_EXTINGUISH_MAX_PER_TICK = 32

const AIR_BLOCK_IDX = blockTypeToIndex('AIR')
const FIRE_BLOCK_IDX = blockTypeToIndex('FIRE')
const LAVA_BLOCK_IDX = blockTypeToIndex('LAVA')
const NETHERRACK_BLOCK_IDX = blockTypeToIndex('NETHERRACK')
const WATER_BLOCK_IDX = blockTypeToIndex('WATER')
const EXPECTED_CHUNK_BLOCK_COUNT = CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT

const FLAMMABLE_BLOCK_TYPES = [
  'WOOD',
  'LEAVES',
  'PLANKS',
  'CRAFTING_TABLE',
  'CHEST',
  'DOOR',
  'DOOR_OPEN',
  'LADDER',
  'OAK_STAIRS',
  'BED',
  'TNT',
] as const satisfies ReadonlyArray<BlockType>

const FLAMMABLE_BLOCK_INDICES = new Set<number>(FLAMMABLE_BLOCK_TYPES.map(blockTypeToIndex))

const NEIGHBOR_OFFSETS = [
  { dx: 1, dy: 0, dz: 0 },
  { dx: -1, dy: 0, dz: 0 },
  { dx: 0, dy: 0, dz: 1 },
  { dx: 0, dy: 0, dz: -1 },
  { dx: 0, dy: 1, dz: 0 },
  { dx: 0, dy: -1, dz: 0 },
] as const

type FireLifecycleChunk = Pick<Chunk, 'coord' | 'blocks'>

export type FireMaintenanceAction = {
  readonly position: Position
  readonly blockType: Extract<BlockType, 'AIR' | 'FIRE'>
}

export class FireLifecycleChunkError extends Data.TaggedError('FireLifecycleChunkError')<{
  readonly chunkCoord: FireLifecycleChunk['coord']
  readonly expectedBlockCount: number
  readonly actualBlockCount: number
}> {
  override get message(): string {
    return `Fire lifecycle requires complete chunk block buffers at (${this.chunkCoord.x}, ${this.chunkCoord.z}): expected ${this.expectedBlockCount}, got ${this.actualBlockCount}`
  }
}

const requireCompleteFireLifecycleChunk = (chunk: FireLifecycleChunk): Effect.Effect<void, FireLifecycleChunkError> =>
  chunk.blocks.length === EXPECTED_CHUNK_BLOCK_COUNT
    ? Effect.void
    : Effect.fail(new FireLifecycleChunkError({
      chunkCoord: chunk.coord,
      expectedBlockCount: EXPECTED_CHUNK_BLOCK_COUNT,
      actualBlockCount: chunk.blocks.length,
    }))

const isInsideChunk = (localX: number, y: number, localZ: number): boolean =>
  localX >= 0 && localX < CHUNK_SIZE && y >= 0 && y < CHUNK_HEIGHT && localZ >= 0 && localZ < CHUNK_SIZE

const blockAt = (chunk: FireLifecycleChunk, localX: number, y: number, localZ: number): number =>
  chunk.blocks[chunkBlockIndexUnchecked(localX, y, localZ)] ?? AIR_BLOCK_IDX

const isFlammableIndex = (blockIndex: number): boolean => FLAMMABLE_BLOCK_INDICES.has(blockIndex)

const isFireSourceIndex = (blockIndex: number): boolean =>
  blockIndex === NETHERRACK_BLOCK_IDX || blockIndex === LAVA_BLOCK_IDX

const isFireSupportIndex = (blockIndex: number): boolean =>
  blockIndex !== AIR_BLOCK_IDX && blockIndex !== FIRE_BLOCK_IDX && blockIndex !== WATER_BLOCK_IDX

const hasAdjacentBlockMatching = (
  chunk: FireLifecycleChunk,
  localX: number,
  y: number,
  localZ: number,
  predicate: (blockIndex: number) => boolean,
): boolean => {
  for (const { dx, dy, dz } of NEIGHBOR_OFFSETS) {
    const nextX = localX + dx
    const nextY = y + dy
    const nextZ = localZ + dz
    if (!isInsideChunk(nextX, nextY, nextZ)) continue
    if (predicate(blockAt(chunk, nextX, nextY, nextZ))) return true
  }
  return false
}

const hasFireSupport = (chunk: FireLifecycleChunk, localX: number, y: number, localZ: number): boolean => {
  const hasSupportedBase = y > 0 && isFireSupportIndex(blockAt(chunk, localX, y - 1, localZ))
  if (hasSupportedBase) return true
  return hasAdjacentBlockMatching(
    chunk,
    localX,
    y,
    localZ,
    (blockIndex) => isFlammableIndex(blockIndex) || isFireSourceIndex(blockIndex),
  )
}

const hasAdjacentFlammableBlock = (chunk: FireLifecycleChunk, localX: number, y: number, localZ: number): boolean =>
  hasAdjacentBlockMatching(chunk, localX, y, localZ, isFlammableIndex)

const positionKey = (position: Position): string => `${position.x}:${position.y}:${position.z}`

export const collectFireMaintenanceActions = (
  chunks: ReadonlyArray<FireLifecycleChunk>,
): Effect.Effect<ReadonlyArray<FireMaintenanceAction>, FireLifecycleChunkError> =>
  Effect.gen(function* () {
    const actions: FireMaintenanceAction[] = []
    const spreadTargets = new Set<string>()
    let extinguishCount = 0
    let spreadCount = 0

    for (const chunk of chunks) {
      yield* requireCompleteFireLifecycleChunk(chunk)

      const worldBaseX = chunk.coord.x * CHUNK_SIZE
      const worldBaseZ = chunk.coord.z * CHUNK_SIZE

      for (let y = 0; y < CHUNK_HEIGHT; y++) {
        for (let localX = 0; localX < CHUNK_SIZE; localX++) {
          for (let localZ = 0; localZ < CHUNK_SIZE; localZ++) {
            if (blockAt(chunk, localX, y, localZ) !== FIRE_BLOCK_IDX) continue

            if (!hasFireSupport(chunk, localX, y, localZ)) {
              if (extinguishCount < FIRE_EXTINGUISH_MAX_PER_TICK) {
                actions.push({ position: { x: worldBaseX + localX, y, z: worldBaseZ + localZ }, blockType: 'AIR' })
                extinguishCount++
              }
              continue
            }

            if (spreadCount >= FIRE_SPREAD_MAX_PER_TICK) continue

            for (const { dx, dy, dz } of NEIGHBOR_OFFSETS) {
              const nextX = localX + dx
              const nextY = y + dy
              const nextZ = localZ + dz
              if (!isInsideChunk(nextX, nextY, nextZ)) continue
              if (blockAt(chunk, nextX, nextY, nextZ) !== AIR_BLOCK_IDX) continue
              if (!hasAdjacentFlammableBlock(chunk, nextX, nextY, nextZ)) continue

              const position = { x: worldBaseX + nextX, y: nextY, z: worldBaseZ + nextZ }
              const key = positionKey(position)
              if (spreadTargets.has(key)) continue

              actions.push({ position, blockType: 'FIRE' })
              spreadTargets.add(key)
              spreadCount++
              if (spreadCount >= FIRE_SPREAD_MAX_PER_TICK) break
            }
          }
        }
      }
    }

    return actions
  })

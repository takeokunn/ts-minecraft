import { Match, Option, ReadonlyArray } from 'effect'
import { pipe } from 'effect/Function'
import * as Order from 'effect/Order'
import {
  calculateChunkDistance,
  type ChunkDistance,
  ChunkDistance as ChunkDistanceBrand,
  type ChunkPosition,
  chunkToWorldPosition,
  createChunkPosition,
  createChunkPositionSync,
  getChunkHash,
  parseChunkHash,
  worldToChunkPosition,
} from './types'

export {
  calculateChunkDistance,
  chunkToWorldPosition,
  createChunkPosition,
  createChunkPositionSync,
  getChunkHash,
  parseChunkHash,
  worldToChunkPosition,
}

const makeOffsets = (radius: number): ReadonlyArray<number> =>
  ReadonlyArray.makeBy(radius * 2 + 1, (index) => index - radius)

/**
 * マンハッタン距離を計算
 */
export const calculateManhattanDistance = (pos1: ChunkPosition, pos2: ChunkPosition): ChunkDistance =>
  ChunkDistanceBrand(Math.abs(pos1.x - pos2.x) + Math.abs(pos1.z - pos2.z))

/**
 * チェビシェフ距離を計算（チェス盤距離）
 */
export const calculateChebyshevDistance = (pos1: ChunkPosition, pos2: ChunkPosition): ChunkDistance =>
  ChunkDistanceBrand(Math.max(Math.abs(pos1.x - pos2.x), Math.abs(pos1.z - pos2.z)))

/**
 * チャンク座標の近隣チャンクを取得
 */
export const getNeighborChunks = (position: ChunkPosition, radius: number = 1): ReadonlyArray<ChunkPosition> =>
  pipe(
    makeOffsets(radius),
    ReadonlyArray.flatMap((dx) =>
      pipe(
        makeOffsets(radius),
        ReadonlyArray.filterMap((dz) =>
          pipe(
            dx === 0 && dz === 0,
            Match.value,
            Match.when(true, () => Option.none()),
            Match.when(false, () => Option.some(createChunkPositionSync(position.x + dx, position.z + dz))),
            Match.exhaustive
          )
        )
      )
    )
  )

/**
 * 矩形範囲内のチャンク座標を取得
 */
export const getChunksInRectangle = (
  minX: number,
  minZ: number,
  maxX: number,
  maxZ: number
): ReadonlyArray<ChunkPosition> => {
  const normalizedMinX = Math.min(minX, maxX)
  const normalizedMaxX = Math.max(minX, maxX)
  const normalizedMinZ = Math.min(minZ, maxZ)
  const normalizedMaxZ = Math.max(minZ, maxZ)

  const xs = ReadonlyArray.makeBy(normalizedMaxX - normalizedMinX + 1, (index) => normalizedMinX + index)
  const zs = ReadonlyArray.makeBy(normalizedMaxZ - normalizedMinZ + 1, (index) => normalizedMinZ + index)

  return pipe(
    xs,
    ReadonlyArray.flatMap((x) =>
      pipe(
        zs,
        ReadonlyArray.map((z) => createChunkPositionSync(x, z))
      )
    )
  )
}

/**
 * 円形範囲内のチャンク座標を取得
 */
export const getChunksInCircle = (center: ChunkPosition, radius: ChunkDistance): ReadonlyArray<ChunkPosition> => {
  const radiusSquared = radius * radius

  const minX = Math.floor(center.x - radius)
  const maxX = Math.ceil(center.x + radius)
  const minZ = Math.floor(center.z - radius)
  const maxZ = Math.ceil(center.z + radius)

  const xs = ReadonlyArray.makeBy(maxX - minX + 1, (index) => minX + index)
  const zs = ReadonlyArray.makeBy(maxZ - minZ + 1, (index) => minZ + index)

  return pipe(
    xs,
    ReadonlyArray.flatMap((x) =>
      pipe(
        zs,
        ReadonlyArray.filterMap((z) =>
          pipe(
            calculateChunkDistance(center, createChunkPositionSync(x, z)),
            (distance) => distance * distance <= radiusSquared,
            Match.value,
            Match.when(true, () => Option.some(createChunkPositionSync(x, z))),
            Match.when(false, () => Option.none()),
            Match.exhaustive
          )
        )
      )
    )
  )
}

/**
 * チャンク座標をソート（距離順）
 */
export const sortChunksByDistance = (
  chunks: ReadonlyArray<ChunkPosition>,
  referencePoint: ChunkPosition
): ReadonlyArray<ChunkPosition> =>
  pipe(
    chunks,
    ReadonlyArray.sort(
      Order.mapInput(Order.number, (chunk: ChunkPosition) => calculateChunkDistance(chunk, referencePoint))
    )
  )

/**
 * チャンク座標の等価性チェック
 */
export const isChunkPositionEqual = (pos1: ChunkPosition, pos2: ChunkPosition): boolean =>
  pos1.x === pos2.x && pos1.z === pos2.z

/**
 * チャンク座標の境界チェック
 */
export const isWithinBounds = (
  position: ChunkPosition,
  minX: number,
  minZ: number,
  maxX: number,
  maxZ: number
): boolean => position.x >= minX && position.x <= maxX && position.z >= minZ && position.z <= maxZ

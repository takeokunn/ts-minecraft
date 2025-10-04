import { Effect, Schema } from 'effect'
import {
  type ChunkDistance,
  ChunkDistance as ChunkDistanceBrand,
  type ChunkHash,
  ChunkHash as ChunkHashBrand,
  type ChunkPosition,
  ChunkPositionError,
  ChunkPositionSchema,
} from './types'

/**
 * チャンク座標を作成（検証付き）
 */
export const createChunkPosition = (x: number, z: number): Effect.Effect<ChunkPosition, ChunkPositionError> => {
  return Effect.try({
    try: () => Schema.decodeUnknownSync(ChunkPositionSchema)({ x, z }) as ChunkPosition,
    catch: (error) =>
      new ChunkPositionError({
        message: `Invalid chunk position: ${String(error)}`,
        x,
        z,
      }),
  })
}

/**
 * チャンク座標を安全に作成（同期版）
 */
export const createChunkPositionSync = (x: number, z: number): ChunkPosition => {
  return { x: Math.floor(x), z: Math.floor(z) }
}

/**
 * ワールド座標からチャンク座標を計算
 */
export const worldToChunkPosition = (
  worldX: number,
  worldZ: number,
  chunkSize: number = 16
): Effect.Effect<ChunkPosition, ChunkPositionError> => {
  return Effect.gen(function* () {
    const chunkX = Math.floor(worldX / chunkSize)
    const chunkZ = Math.floor(worldZ / chunkSize)

    return yield* createChunkPosition(chunkX, chunkZ)
  })
}

/**
 * チャンク座標からワールド座標を計算
 */
export const chunkToWorldPosition = (
  position: ChunkPosition,
  chunkSize: number = 16
): { worldX: number; worldZ: number } => {
  return {
    worldX: position.x * chunkSize,
    worldZ: position.z * chunkSize,
  }
}

/**
 * チャンク座標の距離を計算
 */
export const calculateChunkDistance = (pos1: ChunkPosition, pos2: ChunkPosition): ChunkDistance => {
  const dx = pos1.x - pos2.x
  const dz = pos1.z - pos2.z
  const distance = Math.sqrt(dx * dx + dz * dz)
  return ChunkDistanceBrand(distance)
}

/**
 * マンハッタン距離を計算
 */
export const calculateManhattanDistance = (pos1: ChunkPosition, pos2: ChunkPosition): ChunkDistance => {
  const dx = Math.abs(pos1.x - pos2.x)
  const dz = Math.abs(pos1.z - pos2.z)
  return ChunkDistanceBrand(dx + dz)
}

/**
 * チェビシェフ距離を計算（チェス盤距離）
 */
export const calculateChebyshevDistance = (pos1: ChunkPosition, pos2: ChunkPosition): ChunkDistance => {
  const dx = Math.abs(pos1.x - pos2.x)
  const dz = Math.abs(pos1.z - pos2.z)
  return ChunkDistanceBrand(Math.max(dx, dz))
}

/**
 * チャンク座標のハッシュを生成
 */
export const getChunkHash = (position: ChunkPosition): ChunkHash => {
  return ChunkHashBrand(`${position.x},${position.z}`)
}

/**
 * ハッシュからチャンク座標を復元
 */
export const parseChunkHash = (hash: ChunkHash): Effect.Effect<ChunkPosition, ChunkPositionError> => {
  return Effect.gen(function* () {
    const parts = hash.split(',')

    if (parts.length !== 2) {
      return yield* Effect.fail(
        new ChunkPositionError({
          message: `Invalid chunk hash format: ${hash}`,
        })
      )
    }

    const x = parseInt(parts[0]!, 10)
    const z = parseInt(parts[1]!, 10)

    if (!Number.isInteger(x) || !Number.isInteger(z)) {
      return yield* Effect.fail(
        new ChunkPositionError({
          message: `Invalid chunk coordinates in hash: ${hash}`,
          x,
          z,
        })
      )
    }

    return yield* createChunkPosition(x, z)
  })
}

/**
 * チャンク座標の近隣チャンクを取得
 */
export const getNeighborChunks = (position: ChunkPosition, radius: number = 1): ChunkPosition[] => {
  // Effect-TSによる関数型実装
  const dxRange = Array.from({ length: radius * 2 + 1 }, (_, i) => i - radius)
  const dzRange = Array.from({ length: radius * 2 + 1 }, (_, i) => i - radius)

  return pipe(
    dxRange,
    Array.flatMap((dx) =>
      pipe(
        dzRange,
        Array.filterMap((dz) =>
          pipe(
            dx === 0 && dz === 0,
            Match.value,
            Match.when(true, () => Option.none()), // 自分自身は除外
            Match.when(false, () =>
              Option.some({
                x: position.x + dx,
                z: position.z + dz,
              })
            ),
            Match.exhaustive
          )
        )
      )
    )
  )
}

/**
 * 矩形範囲内のチャンク座標を取得
 */
export const getChunksInRectangle = (minX: number, minZ: number, maxX: number, maxZ: number): ChunkPosition[] => {
  // 正規化された範囲
  const normalizedMinX = Math.min(minX, maxX)
  const normalizedMaxX = Math.max(minX, maxX)
  const normalizedMinZ = Math.min(minZ, maxZ)
  const normalizedMaxZ = Math.max(minZ, maxZ)

  // Effect-TSによる関数型実装
  const xRange = Array.from({ length: normalizedMaxX - normalizedMinX + 1 }, (_, i) => normalizedMinX + i)
  const zRange = Array.from({ length: normalizedMaxZ - normalizedMinZ + 1 }, (_, i) => normalizedMinZ + i)

  return pipe(
    xRange,
    Array.flatMap((x) =>
      pipe(
        zRange,
        Array.map((z) => ({ x, z }))
      )
    )
  )
}

/**
 * 円形範囲内のチャンク座標を取得
 */
export const getChunksInCircle = (center: ChunkPosition, radius: ChunkDistance): ChunkPosition[] => {
  const radiusSquared = radius * radius

  const minX = Math.floor(center.x - radius)
  const maxX = Math.ceil(center.x + radius)
  const minZ = Math.floor(center.z - radius)
  const maxZ = Math.ceil(center.z + radius)

  // Effect-TSによる関数型実装
  const xRange = Array.from({ length: maxX - minX + 1 }, (_, i) => minX + i)
  const zRange = Array.from({ length: maxZ - minZ + 1 }, (_, i) => minZ + i)

  return pipe(
    xRange,
    Array.flatMap((x) =>
      pipe(
        zRange,
        Array.filterMap((z) => {
          const position = { x, z }
          const distance = calculateChunkDistance(center, position)

          return pipe(
            distance * distance <= radiusSquared,
            Match.value,
            Match.when(true, () => Option.some(position)),
            Match.when(false, () => Option.none()),
            Match.exhaustive
          )
        })
      )
    )
  )
}

/**
 * チャンク座標をソート（距離順）
 */
export const sortChunksByDistance = (chunks: ChunkPosition[], referencePoint: ChunkPosition): ChunkPosition[] => {
  return chunks.sort((a, b) => {
    const distanceA = calculateChunkDistance(a, referencePoint)
    const distanceB = calculateChunkDistance(b, referencePoint)
    return distanceA - distanceB
  })
}

/**
 * チャンク座標の等価性チェック
 */
export const isChunkPositionEqual = (pos1: ChunkPosition, pos2: ChunkPosition): boolean => {
  return pos1.x === pos2.x && pos1.z === pos2.z
}

/**
 * チャンク座標の境界チェック
 */
export const isWithinBounds = (
  position: ChunkPosition,
  minX: number,
  minZ: number,
  maxX: number,
  maxZ: number
): boolean => {
  return position.x >= minX && position.x <= maxX && position.z >= minZ && position.z <= maxZ
}

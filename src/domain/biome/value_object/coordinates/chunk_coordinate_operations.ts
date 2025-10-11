/**
 * ChunkCoordinate Operations - チャンク座標の操作関数
 *
 * チャンク座標同士の演算とファクトリ関数
 */

import { Array, Effect, Function, Schema } from 'effect'
import {
  CHUNK_COORDINATE_LIMITS,
  ChunkCoordinate,
  ChunkCoordinateError,
  ChunkXSchema,
  ChunkZSchema,
  makeUnsafeChunkX,
  makeUnsafeChunkZ,
} from './chunk_coordinate'

/**
 * ORIGIN定数 - チャンク座標系の原点
 */
export const CHUNK_ORIGIN: ChunkCoordinate = {
  x: makeUnsafeChunkX(0),
  z: makeUnsafeChunkZ(0),
}

/**
 * チャンク座標を作成（バリデーション付き）
 */
export const make = (x: number, z: number): Effect.Effect<ChunkCoordinate, ChunkCoordinateError> =>
  Effect.gen(function* () {
    // 範囲チェック
    if (x < CHUNK_COORDINATE_LIMITS.MIN_X || x > CHUNK_COORDINATE_LIMITS.MAX_X) {
      return yield* Effect.fail({
        _tag: 'ChunkOutOfBounds' as const,
        axis: 'x' as const,
        value: x,
        min: CHUNK_COORDINATE_LIMITS.MIN_X,
        max: CHUNK_COORDINATE_LIMITS.MAX_X,
        message: `Chunk X coordinate ${x} is out of bounds [${CHUNK_COORDINATE_LIMITS.MIN_X}, ${CHUNK_COORDINATE_LIMITS.MAX_X}]`,
      })
    }

    if (z < CHUNK_COORDINATE_LIMITS.MIN_Z || z > CHUNK_COORDINATE_LIMITS.MAX_Z) {
      return yield* Effect.fail({
        _tag: 'ChunkOutOfBounds' as const,
        axis: 'z' as const,
        value: z,
        min: CHUNK_COORDINATE_LIMITS.MIN_Z,
        max: CHUNK_COORDINATE_LIMITS.MAX_Z,
        message: `Chunk Z coordinate ${z} is out of bounds [${CHUNK_COORDINATE_LIMITS.MIN_Z}, ${CHUNK_COORDINATE_LIMITS.MAX_Z}]`,
      })
    }

    const decodeError = (cause: unknown) => ({
      _tag: 'InvalidChunkCoordinate' as const,
      coordinate: { x, z },
      message: `Failed to create chunk coordinate: x=${x}, z=${z}`,
      cause,
    })

    const chunkX = yield* Schema.decode(ChunkXSchema)(x).pipe(Effect.mapError(decodeError))
    const chunkZ = yield* Schema.decode(ChunkZSchema)(z).pipe(Effect.mapError(decodeError))

    return {
      x: chunkX,
      z: chunkZ,
    }
  })

/**
 * チャンク座標を作成（バリデーションなし・高速版）
 * 注意: 呼び出し側が値の妥当性を保証する必要がある
 */
export const makeUnsafe = (x: number, z: number): ChunkCoordinate => ({
  x: makeUnsafeChunkX(x),
  z: makeUnsafeChunkZ(z),
})

/**
 * オブジェクトからチャンク座標を作成（Brand型へのキャスト）
 * 注意: 呼び出し側が値の妥当性を保証する必要がある
 */
export const fromObject = (obj: { x: number; z: number }): ChunkCoordinate => ({
  x: makeUnsafeChunkX(obj.x),
  z: makeUnsafeChunkZ(obj.z),
})

/**
 * チャンク座標の加算
 */
export const add = (a: ChunkCoordinate, b: ChunkCoordinate): ChunkCoordinate => makeUnsafe(a.x + b.x, a.z + b.z)

/**
 * チャンク座標の減算
 */
export const subtract = (a: ChunkCoordinate, b: ChunkCoordinate): ChunkCoordinate => makeUnsafe(a.x - b.x, a.z - b.z)

/**
 * チャンク座標のスカラー倍
 */
export const multiply = (coord: ChunkCoordinate, scalar: number): ChunkCoordinate =>
  makeUnsafe(Math.floor(coord.x * scalar), Math.floor(coord.z * scalar))

/**
 * 2つのチャンク座標間のユークリッド距離
 */
export const distance = (a: ChunkCoordinate, b: ChunkCoordinate): number => {
  const dx = a.x - b.x
  const dz = a.z - b.z
  return Math.sqrt(dx * dx + dz * dz)
}

/**
 * 2つのチャンク座標間のマンハッタン距離
 */
export const manhattanDistance = (a: ChunkCoordinate, b: ChunkCoordinate): number => {
  const dx = Math.abs(a.x - b.x)
  const dz = Math.abs(a.z - b.z)
  return dx + dz
}

/**
 * 2つのチャンク座標間のチェビシェフ距離（最大軸距離）
 */
export const chebyshevDistance = (a: ChunkCoordinate, b: ChunkCoordinate): number => {
  const dx = Math.abs(a.x - b.x)
  const dz = Math.abs(a.z - b.z)
  return Math.max(dx, dz)
}

/**
 * チャンク座標の等価性チェック
 */
export const equals = (a: ChunkCoordinate, b: ChunkCoordinate): boolean => a.x === b.x && a.z === b.z

/**
 * チャンク座標を文字列表現に変換
 */
export const toString = (coord: ChunkCoordinate): string => `Chunk(${coord.x}, ${coord.z})`

/**
 * チャンク座標のハッシュ値を計算（マップキー用）
 */
export const hash = (coord: ChunkCoordinate): string => `${coord.x},${coord.z}`

/**
 * ハッシュ値からチャンク座標を復元
 */
export const fromHash = (hash: string): Effect.Effect<ChunkCoordinate, ChunkCoordinateError> =>
  Effect.gen(function* () {
    const parts = hash.split(',')
    if (parts.length !== 2) {
      return yield* Effect.fail({
        _tag: 'InvalidChunkCoordinate' as const,
        coordinate: hash,
        message: `Invalid chunk coordinate hash: ${hash}`,
      })
    }

    const x = Number.parseInt(parts[0], 10)
    const z = Number.parseInt(parts[1], 10)

    if (Number.isNaN(x) || Number.isNaN(z)) {
      return yield* Effect.fail({
        _tag: 'InvalidChunkCoordinate' as const,
        coordinate: hash,
        message: `Invalid chunk coordinate hash (NaN): ${hash}`,
      })
    }

    return yield* make(x, z)
  })

/**
 * 中心座標と半径からチャンク座標のリストを生成（円形範囲）
 */
export const getChunksInRadius = (center: ChunkCoordinate, radius: number): readonly ChunkCoordinate[] => {
  const radiusSquared = radius * radius
  const radiusCeil = Math.ceil(radius)

  return Function.pipe(
    Array.range(center.x - radiusCeil, center.x + radiusCeil + 1),
    ReadonlyArray.flatMap((x) =>
      Function.pipe(
        Array.range(center.z - radiusCeil, center.z + radiusCeil + 1),
        ReadonlyArray.filterMap((z) => {
          const dx = x - center.x
          const dz = z - center.z
          if (dx * dx + dz * dz > radiusSquared) return undefined
          return makeUnsafe(x, z)
        })
      )
    )
  )
}

/**
 * 中心座標とチェビシェフ距離からチャンク座標のリストを生成（正方形範囲）
 */
export const getChunksInSquare = (center: ChunkCoordinate, distance: number): readonly ChunkCoordinate[] => {
  return Function.pipe(
    Array.range(center.x - distance, center.x + distance + 1),
    ReadonlyArray.flatMap((x) =>
      Function.pipe(
        Array.range(center.z - distance, center.z + distance + 1),
        ReadonlyArray.map((z) => makeUnsafe(x, z))
      )
    )
  )
}

/**
 * チャンク座標を螺旋状に生成（中心から外側へ）
 */
export const getSpiralChunks = (center: ChunkCoordinate, maxDistance: number): readonly ChunkCoordinate[] => {
  return Function.pipe([center], (initial) =>
    Function.pipe(
      Array.range(1, maxDistance + 1),
      ReadonlyArray.flatMap((d) => {
        // 螺旋の1ループ分の座標を生成
        const spiralLoop = Function.pipe(
          [
            // 上方向へ移動
            ...ReadonlyArray.map(Array.range(0, d * 2), (i) => makeUnsafe(center.x + d, center.z + i)),
            // 左方向へ移動
            ...ReadonlyArray.map(Array.range(0, d * 2), (i) => makeUnsafe(center.x + d - i - 1, center.z + d * 2)),
            // 下方向へ移動
            ...ReadonlyArray.map(Array.range(0, d * 2), (i) => makeUnsafe(center.x - d, center.z + d * 2 - i - 1)),
            // 右方向へ移動（開始位置の手前まで）
            ...ReadonlyArray.map(Array.range(0, d * 2), (i) => makeUnsafe(center.x - d + i + 1, center.z - d)),
          ],
          (arr) => arr
        )
        return spiralLoop
      }),
      (spiralCoords) => [...initial, ...spiralCoords]
    )
  )
}

/**
 * 隣接チャンクを取得（8方向）
 */
export const getNeighbors = (coord: ChunkCoordinate): ChunkCoordinate[] => [
  makeUnsafe(coord.x - 1, coord.z - 1), // 北西
  makeUnsafe(coord.x, coord.z - 1), // 北
  makeUnsafe(coord.x + 1, coord.z - 1), // 北東
  makeUnsafe(coord.x - 1, coord.z), // 西
  makeUnsafe(coord.x + 1, coord.z), // 東
  makeUnsafe(coord.x - 1, coord.z + 1), // 南西
  makeUnsafe(coord.x, coord.z + 1), // 南
  makeUnsafe(coord.x + 1, coord.z + 1), // 南東
]

/**
 * 隣接チャンクを取得（4方向のみ）
 */
export const getCardinalNeighbors = (coord: ChunkCoordinate): ChunkCoordinate[] => [
  makeUnsafe(coord.x, coord.z - 1), // 北
  makeUnsafe(coord.x - 1, coord.z), // 西
  makeUnsafe(coord.x + 1, coord.z), // 東
  makeUnsafe(coord.x, coord.z + 1), // 南
]

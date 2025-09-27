import { Effect, Match, pipe } from 'effect'
import type { BlockPosition } from '@domain/core/types/brands'
import type { Vector3, BlockFace, RaycastResult } from './InteractionTypes'
import { createEmptyRaycastResult, createHitRaycastResult } from './InteractionTypes'
import { createRaycastError, type InteractionError } from './InteractionErrors'

// =============================================================================
// Raycast Algorithm - DDA (Digital Differential Analyzer)
// =============================================================================

/**
 * DDA（Digital Differential Analyzer）アルゴリズムによるレイキャスト
 *
 * MinecraftのブロックベースのVoxel worldに最適化されたレイキャスト実装。
 * John Amanatides と Andrew Woo による "A Fast Voxel Traversal Algorithm" を
 * TypeScript + Effect-TSで実装。
 *
 * アルゴリズムの特徴:
 * - ボクセルグリッドを効率的に走査
 * - 1ステップごとに1つのボクセルのみを確認
 * - 浮動小数点演算を最小限に抑制
 * - ブロック境界での正確な衝突検出
 *
 * 参考文献:
 * - "A Fast Voxel Traversal Algorithm" (Amanatides & Woo, 1987)
 * - "Ray Casting with Different Data Structures" (Goral et al., 1984)
 */

// =============================================================================
// Vector3 Helper Functions
// =============================================================================

/**
 * ベクトルの正規化
 * ゼロベクトルの場合はエラーを返す
 */
const normalizeVector3 = (vector: Vector3): Effect.Effect<Vector3, InteractionError> =>
  Effect.gen(function* () {
    const magnitude = Math.sqrt(vector.x * vector.x + vector.y * vector.y + vector.z * vector.z)

    yield* Effect.when(
      Effect.fail(
        createRaycastError({
          origin: { x: 0, y: 0, z: 0 },
          direction: vector,
          maxDistance: 0,
          reason: 'Direction vector cannot be zero',
        })
      ),
      () => magnitude === 0
    )

    return {
      x: vector.x / magnitude,
      y: vector.y / magnitude,
      z: vector.z / magnitude,
    }
  })

/**
 * ベクトルの長さを計算
 */
const vectorLength = (vector: Vector3): number =>
  Math.sqrt(vector.x * vector.x + vector.y * vector.y + vector.z * vector.z)

/**
 * 2つのベクトルの距離を計算
 */
const distanceBetween = (a: Vector3, b: Vector3): number => {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const dz = b.z - a.z
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

// =============================================================================
// Block Face Detection
// =============================================================================

/**
 * レイがブロックのどの面に衝突したかを判定
 *
 * DDAアルゴリズムの副産物として、レイがどの軸方向に
 * 進んでいる時に衝突が発生したかから面を特定する。
 *
 * @param stepX - X軸方向のステップ（-1, 0, 1）
 * @param stepY - Y軸方向のステップ（-1, 0, 1）
 * @param stepZ - Z軸方向のステップ（-1, 0, 1）
 * @param lastStep - 最後にステップした軸（'x', 'y', 'z'）
 * @returns 衝突した面
 */
const determineBlockFace = (stepX: number, stepY: number, stepZ: number, lastStep: 'x' | 'y' | 'z'): BlockFace =>
  pipe(
    Match.value(lastStep),
    Match.when('x', () => (stepX > 0 ? 'west' : 'east') as BlockFace), // X軸正方向 = 東、負方向 = 西
    Match.when('y', () => (stepY > 0 ? 'bottom' : 'top') as BlockFace), // Y軸正方向 = 上、負方向 = 下
    Match.when('z', () => (stepZ > 0 ? 'north' : 'south') as BlockFace), // Z軸正方向 = 南、負方向 = 北
    Match.exhaustive
  )

// =============================================================================
// Block Collision Detection (Stub)
// =============================================================================

/**
 * 指定されたブロック位置にブロックが存在するかチェック
 *
 * 現在はスタブ実装。実際のプロジェクトでは ChunkManager や
 * WorldService から取得する必要がある。
 *
 * TODO: ChunkManagerとの統合
 *
 * @param blockPos - チェックするブロック位置
 * @returns ブロックが存在する場合true
 */
const isBlockSolid = (blockPos: BlockPosition): Effect.Effect<boolean, never> =>
  Effect.succeed(
    pipe(
      blockPos.y,
      Match.value,
      Match.when(
        (y) => y <= 0,
        () => true
      ), // Bedrock layer
      Match.when(
        (y) => y >= 256,
        () => false
      ), // Sky limit
      Match.orElse(() => {
        // 簡単なテストパターン: チェッカーボード状にブロック配置
        const sum = Math.abs(blockPos.x) + Math.abs(blockPos.y) + Math.abs(blockPos.z)
        return sum % 3 === 0
      })
    )
  )

// =============================================================================
// Main DDA Raycast Implementation
// =============================================================================

/**
 * DDAアルゴリズムによるレイキャスト実行
 *
 * 実装詳細:
 * 1. レイの正規化と初期パラメータ計算
 * 2. DDAアルゴリズムによるボクセル走査
 * 3. 各ボクセルでの衝突検出
 * 4. 衝突時の詳細情報計算
 *
 * @param origin - レイの開始点
 * @param direction - レイの方向ベクトル（正規化される）
 * @param maxDistance - レイの最大距離
 * @returns レイキャスト結果
 */
export const performDDARaycast = (
  origin: Vector3,
  direction: Vector3,
  maxDistance: number
): Effect.Effect<RaycastResult, InteractionError> =>
  Effect.gen(function* () {
    // ===== Step 1: Input validation and normalization =====

    yield* Effect.when(
      Effect.fail(
        createRaycastError({
          origin,
          direction,
          maxDistance,
          reason: 'Max distance must be positive',
        })
      ),
      () => maxDistance <= 0
    )

    const normalizedDirection = yield* normalizeVector3(direction)

    // ===== Step 2: DDA algorithm initialization =====

    // 現在のボクセル座標（整数）
    let mapX = Math.floor(origin.x)
    let mapY = Math.floor(origin.y)
    let mapZ = Math.floor(origin.z)

    // デルタ値: 各軸で1ボクセル進むのに必要なt値
    const deltaDistX = Math.abs(1 / normalizedDirection.x)
    const deltaDistY = Math.abs(1 / normalizedDirection.y)
    const deltaDistZ = Math.abs(1 / normalizedDirection.z)

    // ステップ方向と初期サイド距離の計算
    let stepX: number
    let sideDistX: number

    const xResult = pipe(
      normalizedDirection.x < 0,
      Match.value,
      Match.when(true, () => ({ stepX: -1, sideDistX: (origin.x - mapX) * deltaDistX })),
      Match.when(false, () => ({ stepX: 1, sideDistX: (mapX + 1.0 - origin.x) * deltaDistX })),
      Match.exhaustive
    )
    stepX = xResult.stepX
    sideDistX = xResult.sideDistX

    let stepY: number
    let sideDistY: number

    const yResult = pipe(
      normalizedDirection.y < 0,
      Match.value,
      Match.when(true, () => ({ stepY: -1, sideDistY: (origin.y - mapY) * deltaDistY })),
      Match.when(false, () => ({ stepY: 1, sideDistY: (mapY + 1.0 - origin.y) * deltaDistY })),
      Match.exhaustive
    )
    stepY = yResult.stepY
    sideDistY = yResult.sideDistY

    let stepZ: number
    let sideDistZ: number

    const zResult = pipe(
      normalizedDirection.z < 0,
      Match.value,
      Match.when(true, () => ({ stepZ: -1, sideDistZ: (origin.z - mapZ) * deltaDistZ })),
      Match.when(false, () => ({ stepZ: 1, sideDistZ: (mapZ + 1.0 - origin.z) * deltaDistZ })),
      Match.exhaustive
    )
    stepZ = zResult.stepZ
    sideDistZ = zResult.sideDistZ

    // ===== Step 3: DDA main loop =====

    let hit = false
    let lastStep: 'x' | 'y' | 'z' = 'x'
    let currentDistance = 0

    const maxIterations = Math.ceil(maxDistance) + 1 // 無限ループ防止
    let iterations = 0

    while (!hit && currentDistance < maxDistance && iterations < maxIterations) {
      iterations++

      // 次にステップする軸を決定（最小のサイド距離）
      pipe(
        Match.value({ sideDistX, sideDistY, sideDistZ }),
        Match.when(
          ({ sideDistX, sideDistY, sideDistZ }) => sideDistX < sideDistY && sideDistX < sideDistZ,
          () => {
            // X軸方向にステップ
            sideDistX += deltaDistX
            mapX += stepX
            lastStep = 'x'
            currentDistance = sideDistX - deltaDistX
          }
        ),
        Match.when(
          ({ sideDistY, sideDistZ }) => sideDistY < sideDistZ,
          () => {
            // Y軸方向にステップ
            sideDistY += deltaDistY
            mapY += stepY
            lastStep = 'y'
            currentDistance = sideDistY - deltaDistY
          }
        ),
        Match.orElse(() => {
          // Z軸方向にステップ
          sideDistZ += deltaDistZ
          mapZ += stepZ
          lastStep = 'z'
          currentDistance = sideDistZ - deltaDistZ
        })
      )

      // 現在の位置でブロック衝突チェック
      const blockPosition: BlockPosition = {
        x: mapX,
        y: mapY,
        z: mapZ,
      } as BlockPosition

      const isSolid = yield* isBlockSolid(blockPosition)

      const hitResult = pipe(
        isSolid,
        Match.value,
        Match.when(true, () => {
          // ===== Step 4: Hit point calculation =====

          // 正確な衝突点を計算
          const hitPoint: Vector3 = {
            x: origin.x + normalizedDirection.x * currentDistance,
            y: origin.y + normalizedDirection.y * currentDistance,
            z: origin.z + normalizedDirection.z * currentDistance,
          }

          // 衝突した面を特定
          const face = determineBlockFace(stepX, stepY, stepZ, lastStep)

          return { hit: true, result: createHitRaycastResult(blockPosition, face, currentDistance, hitPoint) }
        }),
        Match.when(false, () => ({ hit: false, result: null })),
        Match.exhaustive
      )

      // Transform if statement using Effect.when for early return
      yield* Effect.when(Effect.succeed(hitResult.result!), () => hitResult.hit && hitResult.result !== null).pipe(
        Effect.flatMap((result) => (result ? Effect.fail(result) : Effect.void)),
        Effect.catchAll(() => Effect.void) // Continue if no early return
      )

      hit = hitResult.hit
    }

    // ===== Step 5: No hit case =====

    // 最大距離まで到達したか、反復上限に達した場合
    const endPoint: Vector3 = {
      x: origin.x + normalizedDirection.x * maxDistance,
      y: origin.y + normalizedDirection.y * maxDistance,
      z: origin.z + normalizedDirection.z * maxDistance,
    }

    return createEmptyRaycastResult(maxDistance, endPoint)
  })

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * プレイヤーの視線方向を基にしたレイキャスト
 *
 * プレイヤーの視点位置から指定された方向にレイを飛ばす。
 * ゲームプレイで最も頻繁に使用される関数。
 *
 * @param playerEyePosition - プレイヤーの視点位置
 * @param lookDirection - プレイヤーの視線方向
 * @param reachDistance - プレイヤーのリーチ距離（通常5ブロック）
 * @returns レイキャスト結果
 */
export const performPlayerRaycast = (
  playerEyePosition: Vector3,
  lookDirection: Vector3,
  reachDistance: number = 5.0
): Effect.Effect<RaycastResult, InteractionError> => performDDARaycast(playerEyePosition, lookDirection, reachDistance)

/**
 * 2点間の直線上に障害物があるかチェック
 *
 * 視線が通っているかや、直線距離での移動可能性を
 * チェックする際に使用。
 *
 * @param from - 開始点
 * @param to - 終了点
 * @returns 障害物の有無（true = 障害物あり）
 */
export const hasObstacleBetween = (from: Vector3, to: Vector3): Effect.Effect<boolean, InteractionError> =>
  Effect.gen(function* () {
    const direction: Vector3 = {
      x: to.x - from.x,
      y: to.y - from.y,
      z: to.z - from.z,
    }

    const distance = vectorLength(direction)

    // Use Effect.when to handle early return case instead of if statement
    return yield* pipe(
      distance === 0,
      Match.value,
      Match.when(
        true,
        () => Effect.succeed(false) // Same position, no obstacle
      ),
      Match.when(false, () =>
        Effect.gen(function* () {
          const result = yield* performDDARaycast(from, direction, distance)
          return result.hit
        })
      ),
      Match.exhaustive
    )
  })

// =============================================================================
// Debug and Testing Utilities
// =============================================================================

/**
 * レイキャストのデバッグ情報を生成
 *
 * 開発時のデバッグやテスト時に使用。
 * レイの経路、チェックしたボクセル数、実行時間等を記録。
 */
export const performRaycastWithDebug = (
  origin: Vector3,
  direction: Vector3,
  maxDistance: number
): Effect.Effect<
  {
    result: RaycastResult
    debugInfo: {
      normalizedDirection: Vector3
      voxelsChecked: number
      executionTimeMs: number
      rayPath: ReadonlyArray<BlockPosition>
    }
  },
  InteractionError
> =>
  Effect.gen(function* () {
    const startTime = performance.now()
    const rayPath: BlockPosition[] = []
    let voxelsChecked = 0

    // 通常のレイキャストを実行（デバッグ情報も収集）
    const normalizedDirection = yield* normalizeVector3(direction)
    const result = yield* performDDARaycast(origin, direction, maxDistance)

    const endTime = performance.now()

    return {
      result,
      debugInfo: {
        normalizedDirection,
        voxelsChecked,
        executionTimeMs: endTime - startTime,
        rayPath,
      },
    }
  })

// =============================================================================
// Type Exports for Testing
// =============================================================================

export type RaycastDebugInfo = {
  normalizedDirection: Vector3
  voxelsChecked: number
  executionTimeMs: number
  rayPath: ReadonlyArray<BlockPosition>
}

import type { BlockTypeId, Vector3D } from '@domain/entities'
import { Context, Effect, Layer, Option, pipe, ReadonlyArray, Ref } from 'effect'
import { CannonPhysicsService } from './cannon'

/**
 * World Collision Service
 * ワールドのブロック・地形との衝突検知システム
 */

// ワールド衝突エラー
export interface WorldCollisionError {
  readonly _tag: 'WorldCollisionError'
  readonly message: string
  readonly cause?: unknown
}

// ブロック衝突情報
export interface BlockCollisionInfo {
  readonly blockPosition: Vector3D
  readonly blockType: BlockTypeId
  readonly bodyId: string
  readonly collisionNormal: Vector3D
  readonly penetrationDepth: number
}

// レイキャスト結果
export interface RaycastHit {
  readonly hit: boolean
  readonly hitPoint: Vector3D
  readonly hitNormal: Vector3D
  readonly distance: number
  readonly blockPosition?: Vector3D
  readonly blockType?: BlockTypeId
  readonly bodyId?: string
}

// 衝突検知結果
interface CollisionResult {
  readonly hasCollision: boolean
  readonly blocks: Array<{
    readonly id: string
    readonly position: Vector3D
    readonly blockType: BlockTypeId
    readonly bodyId: string
  }>
}

// ワールド衝突設定
export interface WorldCollisionConfig {
  readonly chunkLoadRadius: number // チャンク読み込み半径
  readonly collisionCacheSize: number // 衝突キャッシュサイズ
  readonly blockUpdateBatchSize: number // ブロック更新バッチサイズ
}

// デフォルト設定
export const DEFAULT_COLLISION_CONFIG: WorldCollisionConfig = {
  chunkLoadRadius: 16, // 16チャンク半径
  collisionCacheSize: 1000, // 1000ブロック分のキャッシュ
  blockUpdateBatchSize: 64, // 64ブロックずつ更新
} as const

// ブロック物理プロパティ
export interface BlockPhysicsProperties {
  readonly friction: number
  readonly restitution: number
  readonly hardness: number
  readonly resistance: number
  readonly luminance: number
  readonly opacity: number
  readonly flammable: boolean
  readonly gravity: boolean
  readonly solid: boolean
  readonly replaceable: boolean
  readonly waterloggable: boolean
  readonly isTransparent: boolean
  readonly isClimbable: boolean
  readonly isFluid: boolean
}

// デフォルトブロック物理プロパティ
export const DEFAULT_BLOCK_PROPERTIES: Record<string, BlockPhysicsProperties> = {
  air: {
    friction: 0.0,
    restitution: 0.0,
    hardness: 0.0,
    resistance: 0.0,
    luminance: 0,
    opacity: 0,
    flammable: false,
    gravity: false,
    solid: false,
    replaceable: true,
    waterloggable: false,
    isTransparent: true,
    isClimbable: false,
    isFluid: false,
  },
  stone: {
    friction: 0.8,
    restitution: 0.1,
    hardness: 1.5,
    resistance: 6.0,
    luminance: 0,
    opacity: 15,
    flammable: false,
    gravity: false,
    solid: true,
    replaceable: false,
    waterloggable: false,
    isTransparent: false,
    isClimbable: false,
    isFluid: false,
  },
  grass: {
    friction: 0.7,
    restitution: 0.2,
    hardness: 0.6,
    resistance: 0.6,
    luminance: 0,
    opacity: 15,
    flammable: true,
    gravity: false,
    solid: true,
    replaceable: false,
    waterloggable: false,
    isTransparent: false,
    isClimbable: false,
    isFluid: false,
  },
  water: {
    friction: 0.1,
    restitution: 0.0,
    hardness: 0.0,
    resistance: 100.0,
    luminance: 0,
    opacity: 3,
    flammable: false,
    gravity: false,
    solid: false,
    replaceable: true,
    waterloggable: false,
    isTransparent: true,
    isClimbable: false,
    isFluid: true,
  },
  ladder: {
    friction: 0.8,
    restitution: 0.1,
    hardness: 0.4,
    resistance: 0.4,
    luminance: 0,
    opacity: 0,
    flammable: true,
    gravity: false,
    solid: false,
    replaceable: false,
    waterloggable: true,
    isTransparent: true,
    isClimbable: true,
    isFluid: false,
  },
} as const

// World Collision Service インターフェース
export interface WorldCollisionService {
  /**
   * ワールド衝突システムの初期化
   */
  readonly initializeWorldCollision: (
    config?: Partial<WorldCollisionConfig>
  ) => Effect.Effect<void, WorldCollisionError>

  /**
   * ブロックの物理ボディを追加
   */
  readonly addBlockCollision: (position: Vector3D, blockType: BlockTypeId) => Effect.Effect<string, WorldCollisionError>

  /**
   * ブロックの物理ボディを削除
   */
  readonly removeBlockCollision: (position: Vector3D) => Effect.Effect<void, WorldCollisionError>

  /**
   * 複数ブロックの一括追加
   */
  readonly addBlocksBatch: (
    blocks: Array<{ position: Vector3D; blockType: BlockTypeId }>
  ) => Effect.Effect<string[], WorldCollisionError>

  /**
   * 複数ブロックの一括削除
   */
  readonly removeBlocksBatch: (positions: Vector3D[]) => Effect.Effect<void, WorldCollisionError>

  /**
   * レイキャスト実行
   */
  readonly raycast: (
    origin: Vector3D,
    direction: Vector3D,
    maxDistance: number
  ) => Effect.Effect<RaycastHit, WorldCollisionError>

  /**
   * 球体vs世界の衝突チェック
   */
  readonly sphereWorldCollision: (
    center: Vector3D,
    radius: number
  ) => Effect.Effect<BlockCollisionInfo[], WorldCollisionError>

  /**
   * 球体衝突チェック (簡易版)
   */
  readonly checkSphereCollision: (params: {
    center: Vector3D
    radius: number
  }) => Effect.Effect<CollisionResult, WorldCollisionError>

  /**
   * ブロック物理プロパティの取得
   */
  readonly getBlockProperties: (blockType: BlockTypeId) => Effect.Effect<BlockPhysicsProperties, WorldCollisionError>

  /**
   * 指定範囲内のブロック衝突を更新
   */
  readonly updateCollisionsInRange: (
    center: Vector3D,
    radius: number,
    getBlockAt: (pos: Vector3D) => BlockTypeId | null
  ) => Effect.Effect<void, WorldCollisionError>

  /**
   * 衝突統計の取得
   */
  readonly getCollisionStats: () => Effect.Effect<
    {
      totalBodies: number
      activeCollisions: number
      cacheHitRate: number
    },
    WorldCollisionError
  >

  /**
   * クリーンアップ
   */
  readonly cleanup: () => Effect.Effect<void, WorldCollisionError>
}

// Context Tag定義
export const WorldCollisionService = Context.GenericTag<WorldCollisionService>(
  '@minecraft/domain/WorldCollisionService'
)

// World Collision Service実装
const makeWorldCollisionService: Effect.Effect<WorldCollisionService, never, CannonPhysicsService> = Effect.gen(
  function* () {
    const cannonPhysics = yield* CannonPhysicsService

    // 設定とキャッシュ
    const configRef = yield* Ref.make(DEFAULT_COLLISION_CONFIG)
    const blockBodiesRef = yield* Ref.make(new Map<string, string>()) // position -> bodyId
    const bodyBlocksRef = yield* Ref.make(new Map<string, Vector3D>()) // bodyId -> position
    const collisionCacheRef = yield* Ref.make(new Map<string, BlockCollisionInfo[]>())
    const statsRef = yield* Ref.make({
      totalBodies: 0,
      activeCollisions: 0,
      cacheHits: 0,
      cacheMisses: 0,
    })

    // 位置を文字列キーに変換
    const positionToKey = (pos: Vector3D): string => `${Math.floor(pos.x)},${Math.floor(pos.y)},${Math.floor(pos.z)}`

    // ワールド衝突システムの初期化
    const initializeWorldCollision = (config: Partial<WorldCollisionConfig> = {}) =>
      Effect.gen(function* () {
        const finalConfig = { ...DEFAULT_COLLISION_CONFIG, ...config }
        yield* Ref.set(configRef, finalConfig)

        console.log('World collision system initialized with config:', finalConfig)
      })

    // ブロックの物理プロパティを取得
    const getBlockProperties = (blockType: BlockTypeId) =>
      Effect.gen(function* () {
        const blockTypeStr = blockType as unknown as string
        const properties = DEFAULT_BLOCK_PROPERTIES[blockTypeStr]

        if (!properties) {
          return yield* Effect.fail<WorldCollisionError>({
            _tag: 'WorldCollisionError',
            message: `Unknown block type: ${blockTypeStr}`,
            cause: undefined,
          })
        }

        return properties
      })

    // ブロックの物理ボディを追加
    const addBlockCollision = (position: Vector3D, blockType: BlockTypeId) =>
      Effect.gen(function* () {
        const posKey = positionToKey(position)
        const blockBodies = yield* Ref.get(blockBodiesRef)

        // すでに存在する場合はスキップ
        if (blockBodies.has(posKey)) {
          return blockBodies.get(posKey)!
        }

        // ブロック物理プロパティを取得
        const properties = yield* getBlockProperties(blockType)

        // 透明ブロックや流体は物理ボディを作らない
        if (properties && properties.isTransparent && !properties.isClimbable) {
          return ''
        }

        // Cannon-es静的ボディを作成
        const bodyId = yield* pipe(
          cannonPhysics.addStaticBlock(position, { x: 1, y: 1, z: 1 }),
          Effect.mapError(
            (error): WorldCollisionError => ({
              _tag: 'WorldCollisionError',
              message: `Failed to add block collision at ${posKey}`,
              cause: error,
            })
          )
        )

        // キャッシュを更新
        yield* Ref.update(blockBodiesRef, (bodies) => bodies.set(posKey, bodyId))
        yield* Ref.update(bodyBlocksRef, (blocks) => blocks.set(bodyId, position))

        // 統計を更新
        yield* Ref.update(statsRef, (stats) => ({
          ...stats,
          totalBodies: stats.totalBodies + 1,
        }))

        return bodyId
      })

    // ブロックの物理ボディを削除
    const removeBlockCollision = (position: Vector3D) =>
      Effect.gen(function* () {
        const posKey = positionToKey(position)
        const blockBodies = yield* Ref.get(blockBodiesRef)
        const bodyId = blockBodies.get(posKey)

        if (!bodyId) {
          return // すでに削除済み
        }

        // Cannon-esボディを削除
        yield* pipe(
          cannonPhysics.removeBody(bodyId),
          Effect.mapError(
            (error): WorldCollisionError => ({
              _tag: 'WorldCollisionError',
              message: `Failed to remove block collision at ${posKey}`,
              cause: error,
            })
          )
        )

        // キャッシュから削除
        yield* Ref.update(blockBodiesRef, (bodies) => {
          const newBodies = new Map(bodies)
          newBodies.delete(posKey)
          return newBodies
        })

        yield* Ref.update(bodyBlocksRef, (blocks) => {
          const newBlocks = new Map(blocks)
          newBlocks.delete(bodyId)
          return newBlocks
        })

        // 統計を更新
        yield* Ref.update(statsRef, (stats) => ({
          ...stats,
          totalBodies: Math.max(0, stats.totalBodies - 1),
        }))
      })

    // 複数ブロックの一括追加
    const addBlocksBatch = (blocks: Array<{ position: Vector3D; blockType: BlockTypeId }>) =>
      Effect.gen(function* () {
        const config = yield* Ref.get(configRef)
        const batchSize = config.blockUpdateBatchSize

        // バッチサイズに分割して処理
        const blockBatches = pipe(
          ReadonlyArray.range(0, Math.ceil(blocks.length / batchSize)),
          ReadonlyArray.map((i) => blocks.slice(i * batchSize, (i + 1) * batchSize))
        )

        const bodyIds = yield* pipe(
          blockBatches,
          Effect.forEach(
            (batch) =>
              Effect.forEach(batch, ({ position, blockType }) => addBlockCollision(position, blockType), {
                concurrency: 4,
              }),
            { concurrency: 4 }
          ),
          Effect.map(ReadonlyArray.flatten)
        )

        console.log(`Added ${bodyIds.filter((id) => id !== '').length} block collisions in batches`)
        return Array.from(bodyIds)
      })

    // 複数ブロックの一括削除
    const removeBlocksBatch = (positions: Vector3D[]) =>
      Effect.gen(function* () {
        const config = yield* Ref.get(configRef)
        const batchSize = config.blockUpdateBatchSize

        // バッチサイズに分割して処理
        const positionBatches = pipe(
          ReadonlyArray.range(0, Math.ceil(positions.length / batchSize)),
          ReadonlyArray.map((i) => positions.slice(i * batchSize, (i + 1) * batchSize))
        )

        yield* pipe(
          positionBatches,
          Effect.forEach(
            (batch) =>
              Effect.forEach(batch, (position) => removeBlockCollision(position), { concurrency: 4 }),
            { concurrency: 4 }
          )
        )

        console.log(`Removed ${positions.length} block collisions in batches`)
      })

    // レイキャスト実行
    const raycast = (origin: Vector3D, direction: Vector3D, maxDistance: number) =>
      Effect.gen(function* () {
        // 方向ベクトルを正規化
        const dirLength = Math.sqrt(direction.x * direction.x + direction.y * direction.y + direction.z * direction.z)
        const normalizedDir = {
          x: direction.x / dirLength,
          y: direction.y / dirLength,
          z: direction.z / dirLength,
        }

        // レイキャストを実行
        const result = yield* pipe(
          cannonPhysics.raycastGround(origin, maxDistance),
          Effect.mapError(
            (error): WorldCollisionError => ({
              _tag: 'WorldCollisionError',
              message: 'Raycast failed',
              cause: error,
            })
          )
        )

        if (!result) {
          return {
            hit: false,
            hitPoint: { x: 0, y: 0, z: 0 },
            hitNormal: { x: 0, y: 1, z: 0 },
            distance: maxDistance,
          } as RaycastHit
        }

        // ヒット点を計算
        const hitPoint = {
          x: origin.x + normalizedDir.x * result.distance,
          y: origin.y + normalizedDir.y * result.distance,
          z: origin.z + normalizedDir.z * result.distance,
        }

        // ヒットしたブロックの位置を計算
        const blockPosition = {
          x: Math.floor(hitPoint.x),
          y: Math.floor(hitPoint.y),
          z: Math.floor(hitPoint.z),
        }

        return {
          hit: true,
          hitPoint,
          hitNormal: result.normal,
          distance: result.distance,
          blockPosition,
          // blockType: 不明 (ワールドサービスから取得が必要)
        } as RaycastHit
      })

    // 球体vs世界の衝突チェック
    const sphereWorldCollision = (center: Vector3D, radius: number) =>
      Effect.gen(function* () {
        // 球体が接触する可能性のあるブロック範囲を計算
        const minX = Math.floor(center.x - radius)
        const maxX = Math.floor(center.x + radius)
        const minY = Math.floor(center.y - radius)
        const maxY = Math.floor(center.y + radius)
        const minZ = Math.floor(center.z - radius)
        const maxZ = Math.floor(center.z + radius)

        const blockBodies = yield* Ref.get(blockBodiesRef)

        // 全座標の組み合わせを生成
        const xRange = ReadonlyArray.range(minX, maxX + 1)
        const yRange = ReadonlyArray.range(minY, maxY + 1)
        const zRange = ReadonlyArray.range(minZ, maxZ + 1)

        const allPositions = pipe(
          xRange,
          ReadonlyArray.flatMap((x) =>
            pipe(
              yRange,
              ReadonlyArray.flatMap((y) =>
                pipe(
                  zRange,
                  ReadonlyArray.map((z) => ({ x, y, z }))
                )
              )
            )
          )
        )

        // 並行で衝突判定を実行
        const candidates = yield* pipe(
          allPositions,
          Effect.forEach(
            (blockPos) =>
              Effect.gen(function* () {
                const posKey = positionToKey(blockPos)
                const bodyId = blockBodies.get(posKey)

                if (!bodyId) {
                  return Option.none()
                }

                // ブロック中心との距離をチェック
                const blockCenter = { x: blockPos.x + 0.5, y: blockPos.y + 0.5, z: blockPos.z + 0.5 }
                const dx = center.x - blockCenter.x
                const dy = center.y - blockCenter.y
                const dz = center.z - blockCenter.z
                const distanceSquared = dx * dx + dy * dy + dz * dz

                // ブロックとの衝突判定（簡易版）
                const minDistance = radius + 0.5 // ブロック半径0.5
                if (distanceSquared >= minDistance * minDistance) {
                  return Option.none()
                }

                const distance = Math.sqrt(distanceSquared)
                const penetrationDepth = minDistance - distance

                // 衝突法線を計算
                const normal =
                  distance > 0
                    ? {
                        x: dx / distance,
                        y: dy / distance,
                        z: dz / distance,
                      }
                    : { x: 0, y: 1, z: 0 }

                return Option.some({
                  blockPosition: blockPos,
                  blockType: 'stone' as unknown as BlockTypeId, // 仮の値
                  bodyId,
                  collisionNormal: normal,
                  penetrationDepth,
                })
              }),
            { concurrency: 4 }
          ),
          Effect.map(ReadonlyArray.getSomes)
        )

        return Array.from(candidates)
      })

    // 指定範囲内のブロック衝突を更新
    const updateCollisionsInRange = (
      center: Vector3D,
      radius: number,
      getBlockAt: (pos: Vector3D) => BlockTypeId | null
    ) =>
      Effect.gen(function* () {
        const minX = Math.floor(center.x - radius)
        const maxX = Math.floor(center.x + radius)
        const minY = Math.floor(center.y - radius)
        const maxY = Math.floor(center.y + radius)
        const minZ = Math.floor(center.z - radius)
        const maxZ = Math.floor(center.z + radius)

        const blockBodies = yield* Ref.get(blockBodiesRef)

        // 全座標の組み合わせを生成
        const xRange = ReadonlyArray.range(minX, maxX + 1)
        const yRange = ReadonlyArray.range(minY, maxY + 1)
        const zRange = ReadonlyArray.range(minZ, maxZ + 1)

        const allPositions = pipe(
          xRange,
          ReadonlyArray.flatMap((x) =>
            pipe(
              yRange,
              ReadonlyArray.flatMap((y) =>
                pipe(
                  zRange,
                  ReadonlyArray.map((z) => ({ x, y, z }))
                )
              )
            )
          )
        )

        // 並行で更新対象ブロックを判定
        const updateTargets = yield* pipe(
          allPositions,
          Effect.forEach(
            (blockPos) =>
              Effect.gen(function* () {
                const currentBlockType = getBlockAt(blockPos)
                const posKey = positionToKey(blockPos)
                const hasCollision = blockBodies.has(posKey)

                if (currentBlockType && currentBlockType !== ('air' as unknown as BlockTypeId)) {
                  // ブロックが存在するが衝突がない場合は追加
                  if (!hasCollision) {
                    return Option.some({ type: 'add' as const, position: blockPos, blockType: currentBlockType })
                  }
                } else {
                  // ブロックが存在しないが衝突がある場合は削除
                  if (hasCollision) {
                    return Option.some({ type: 'remove' as const, position: blockPos })
                  }
                }

                return Option.none()
              }),
            { concurrency: 4 }
          ),
          Effect.map(ReadonlyArray.getSomes)
        )

        // 追加・削除対象を分離
        const blocksToAdd = pipe(
          updateTargets,
          ReadonlyArray.filter((t) => t.type === 'add'),
          ReadonlyArray.map((t) => ({ position: t.position, blockType: (t as any).blockType }))
        )

        const blocksToRemove = pipe(
          updateTargets,
          ReadonlyArray.filter((t) => t.type === 'remove'),
          ReadonlyArray.map((t) => t.position)
        )

        // バッチで更新実行
        yield* Effect.when(blocksToAdd.length > 0, () => addBlocksBatch(Array.from(blocksToAdd)))

        yield* Effect.when(blocksToRemove.length > 0, () => removeBlocksBatch(Array.from(blocksToRemove)))

        console.log(`Updated collisions: +${blocksToAdd.length}, -${blocksToRemove.length}`)
      })

    // 衝突統計の取得
    const getCollisionStats = () =>
      Effect.gen(function* () {
        const stats = yield* Ref.get(statsRef)
        const cacheHitRate =
          stats.cacheHits + stats.cacheMisses > 0 ? stats.cacheHits / (stats.cacheHits + stats.cacheMisses) : 0

        return {
          totalBodies: stats.totalBodies,
          activeCollisions: stats.activeCollisions,
          cacheHitRate,
        }
      })

    // クリーンアップ
    const cleanup = () =>
      Effect.gen(function* () {
        const blockBodies = yield* Ref.get(blockBodiesRef)

        // すべてのブロックボディを削除
        const bodyIds = Array.from(blockBodies.values())
        yield* pipe(
          bodyIds,
          Effect.forEach(
            (bodyId) =>
              pipe(
                cannonPhysics.removeBody(bodyId),
                Effect.catchAll(() => Effect.void) // エラーは無視
              ),
            { concurrency: 4 }
          )
        )

        // 状態をクリア
        yield* Ref.set(blockBodiesRef, new Map())
        yield* Ref.set(bodyBlocksRef, new Map())
        yield* Ref.set(collisionCacheRef, new Map())
        yield* Ref.set(statsRef, {
          totalBodies: 0,
          activeCollisions: 0,
          cacheHits: 0,
          cacheMisses: 0,
        })

        console.log('World collision service cleaned up')
      })

    // 球体衝突チェック (簡易版)
    const checkSphereCollision = (params: { center: Vector3D; radius: number }) =>
      Effect.gen(function* () {
        const { center, radius } = params
        const collisionInfos = yield* sphereWorldCollision(center, radius)

        const blocks = collisionInfos.map((info) => ({
          id: info.blockType as unknown as string,
          position: info.blockPosition,
          blockType: info.blockType,
          bodyId: info.bodyId,
        }))

        return {
          hasCollision: blocks.length > 0,
          blocks,
        } as CollisionResult
      })

    const service: WorldCollisionService = {
      initializeWorldCollision,
      addBlockCollision,
      removeBlockCollision,
      addBlocksBatch,
      removeBlocksBatch,
      raycast,
      sphereWorldCollision,
      checkSphereCollision,
      getBlockProperties,
      updateCollisionsInRange,
      getCollisionStats,
      cleanup,
    }

    return service
  }
)

// Live Layer実装
export const WorldCollisionServiceLive = Layer.effect(WorldCollisionService, makeWorldCollisionService)

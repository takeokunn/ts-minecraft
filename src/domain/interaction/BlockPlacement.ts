import { Effect } from 'effect'
import type { BlockId, BlockPosition, PlayerId } from '../../shared/types/branded'
import type { Vector3, BlockFace, PlacementResult } from './InteractionTypes'
import { createSuccessfulPlacement, createFailedPlacement } from './InteractionTypes'
import { createBlockPlacementError, type InteractionError } from './InteractionErrors'

// =============================================================================
// Block Placement Rules
// =============================================================================

/**
 * ブロック設置ルール
 * 各ブロックタイプの設置に関する制約を定義
 */
type PlacementRule = {
  readonly requiresSupport: boolean // 支持ブロックが必要か
  readonly supportFaces: ReadonlyArray<BlockFace> // 支持可能な面
  readonly canReplaceBlocks: ReadonlyArray<BlockId> // 置き換え可能なブロック
  readonly restrictedBiomes: ReadonlyArray<string> // 設置制限バイオーム
  readonly maxStackHeight: number // 最大積み上げ高度
  readonly needsWater: boolean // 水が必要か
  readonly needsLight: boolean // 光が必要か
  readonly minLightLevel: number // 必要最小光レベル
}

/**
 * デフォルトの設置ルール
 */
const DEFAULT_PLACEMENT_RULE: PlacementRule = {
  requiresSupport: false,
  supportFaces: ['top', 'bottom', 'north', 'south', 'east', 'west'],
  canReplaceBlocks: ['air' as BlockId],
  restrictedBiomes: [],
  maxStackHeight: 256,
  needsWater: false,
  needsLight: false,
  minLightLevel: 0,
}

/**
 * ブロック設置ルールデータベース
 */
const PLACEMENT_RULES_DATABASE: ReadonlyMap<BlockId, PlacementRule> = new Map([
  // 空気ブロック（特別扱い）
  [
    'air' as BlockId,
    {
      ...DEFAULT_PLACEMENT_RULE,
      canReplaceBlocks: [], // 空気は何も置き換えない
    },
  ],

  // 基本ブロック（土、石等）
  ['dirt' as BlockId, DEFAULT_PLACEMENT_RULE],
  ['stone' as BlockId, DEFAULT_PLACEMENT_RULE],
  ['cobblestone' as BlockId, DEFAULT_PLACEMENT_RULE],
  ['wood' as BlockId, DEFAULT_PLACEMENT_RULE],

  // 支持が必要なブロック
  [
    'torch' as BlockId,
    {
      ...DEFAULT_PLACEMENT_RULE,
      requiresSupport: true,
      supportFaces: ['top', 'north', 'south', 'east', 'west'], // 底面以外
      canReplaceBlocks: ['air' as BlockId],
    },
  ],

  [
    'grass' as BlockId,
    {
      ...DEFAULT_PLACEMENT_RULE,
      requiresSupport: true,
      supportFaces: ['top'], // 上面のみ
      needsLight: true,
      minLightLevel: 9,
    },
  ],

  [
    'flower' as BlockId,
    {
      ...DEFAULT_PLACEMENT_RULE,
      requiresSupport: true,
      supportFaces: ['top'],
      canReplaceBlocks: ['air' as BlockId, 'grass' as BlockId],
      needsLight: true,
      minLightLevel: 8,
    },
  ],

  // 水中専用ブロック
  [
    'kelp' as BlockId,
    {
      ...DEFAULT_PLACEMENT_RULE,
      requiresSupport: true,
      supportFaces: ['top'],
      needsWater: true,
      canReplaceBlocks: ['air' as BlockId, 'water' as BlockId],
    },
  ],

  // 高度制限があるブロック
  [
    'sand' as BlockId,
    {
      ...DEFAULT_PLACEMENT_RULE,
      maxStackHeight: 255, // ベッドロック上1ブロック
    },
  ],

  // 特殊設置ルール
  [
    'glass' as BlockId,
    {
      ...DEFAULT_PLACEMENT_RULE,
      canReplaceBlocks: ['air' as BlockId],
    },
  ],

  ['wool' as BlockId, DEFAULT_PLACEMENT_RULE],
])

/**
 * ブロックの設置ルールを取得
 */
const getPlacementRule = (blockId: BlockId): PlacementRule => {
  return PLACEMENT_RULES_DATABASE.get(blockId) ?? DEFAULT_PLACEMENT_RULE
}

// =============================================================================
// World State Simulation
// =============================================================================

/**
 * 指定位置のブロックを取得
 * 実際のプロジェクトでは ChunkManager から取得
 */
const getBlockAt = (position: BlockPosition): Effect.Effect<BlockId, never> =>
  Effect.die('Not implemented: ブロック取得 - ChunkManagerとの連携が未実装です')

/**
 * 指定位置にブロックを設置
 * 実際のプロジェクトでは ChunkManager に委譲
 */
const setBlockAt = (position: BlockPosition, blockId: BlockId): Effect.Effect<void, never> =>
  Effect.die('Not implemented: ブロック設置 - ChunkManagerとの連携が未実装です')

/**
 * 指定位置の光レベルを取得
 */
const getLightLevel = (position: BlockPosition): Effect.Effect<number, never> =>
  Effect.die('Not implemented: 光レベル取得 - ライティングシステムが未実装です')

/**
 * 指定位置が水中かどうかチェック
 */
const isInWater = (position: BlockPosition): Effect.Effect<boolean, never> =>
  Effect.die('Not implemented: 水中判定 - 流体システムが未実装です')

/**
 * プレイヤーと位置の衝突チェック
 */
const wouldCollideWithPlayer = (position: BlockPosition, playerId: PlayerId): Effect.Effect<boolean, never> =>
  Effect.die('Not implemented: プレイヤー衝突判定 - PlayerServiceとの連携が未実装です')

// =============================================================================
// Face-based Position Calculation
// =============================================================================

/**
 * 隣接ブロック位置を面に基づいて計算
 *
 * 指定された面の方向に1ブロック移動した位置を計算する。
 * Minecraftの座標系に準拠。
 *
 * @param basePosition - 基準位置
 * @param face - 移動する面の方向
 * @returns 隣接位置
 */
const getAdjacentPosition = (basePosition: BlockPosition, face: BlockFace): BlockPosition => {
  switch (face) {
    case 'top':
      return { ...basePosition, y: basePosition.y + 1 } as BlockPosition
    case 'bottom':
      return { ...basePosition, y: basePosition.y - 1 } as BlockPosition
    case 'north':
      return { ...basePosition, z: basePosition.z - 1 } as BlockPosition
    case 'south':
      return { ...basePosition, z: basePosition.z + 1 } as BlockPosition
    case 'east':
      return { ...basePosition, x: basePosition.x + 1 } as BlockPosition
    case 'west':
      return { ...basePosition, x: basePosition.x - 1 } as BlockPosition
  }
}

/**
 * 面の反対方向を取得
 * 支持ブロックチェック時に使用
 */
const getOppositeFace = (face: BlockFace): BlockFace => {
  switch (face) {
    case 'top':
      return 'bottom'
    case 'bottom':
      return 'top'
    case 'north':
      return 'south'
    case 'south':
      return 'north'
    case 'east':
      return 'west'
    case 'west':
      return 'east'
  }
}

// =============================================================================
// Placement Validation
// =============================================================================

/**
 * ブロック設置位置の基本検証
 */
const validatePlacementPosition = (position: BlockPosition, blockId: BlockId): Effect.Effect<void, InteractionError> =>
  Effect.gen(function* () {
    const rule = getPlacementRule(blockId)

    // 高度制限チェック
    if (position.y < 0 || position.y >= rule.maxStackHeight) {
      return yield* Effect.fail(
        createBlockPlacementError({
          playerId: 'system' as PlayerId,
          position,
          blockId,
          face: 'top',
          reason: `Invalid height: ${position.y}. Must be between 0 and ${rule.maxStackHeight}`,
        })
      )
    }

    // ワールド境界チェック（Minecraft世界の限界）
    const WORLD_BORDER = 30000000 // Minecraft Far Lands
    if (Math.abs(position.x) > WORLD_BORDER || Math.abs(position.z) > WORLD_BORDER) {
      return yield* Effect.fail(
        createBlockPlacementError({
          playerId: 'system' as PlayerId,
          position,
          blockId,
          face: 'top',
          reason: `Position outside world border: ${position.x}, ${position.z}`,
        })
      )
    }
  })

/**
 * 既存ブロックとの置換可能性チェック
 */
const validateBlockReplacement = (position: BlockPosition, blockId: BlockId): Effect.Effect<void, InteractionError> =>
  Effect.gen(function* () {
    const existingBlock = yield* getBlockAt(position)
    const rule = getPlacementRule(blockId)

    // 置換可能ブロックリストに含まれているかチェック
    if (!rule.canReplaceBlocks.includes(existingBlock)) {
      return yield* Effect.fail(
        createBlockPlacementError({
          playerId: 'system' as PlayerId,
          position,
          blockId,
          face: 'top',
          reason: `Cannot replace block ${existingBlock} with ${blockId}`,
        })
      )
    }
  })

/**
 * 支持ブロックの検証
 */
const validateSupport = (
  position: BlockPosition,
  blockId: BlockId,
  face: BlockFace
): Effect.Effect<void, InteractionError> =>
  Effect.gen(function* () {
    const rule = getPlacementRule(blockId)

    if (!rule.requiresSupport) {
      return // 支持不要なブロック
    }

    // 設置面が支持可能かチェック
    const oppositeFace = getOppositeFace(face)
    if (!rule.supportFaces.includes(oppositeFace)) {
      return yield* Effect.fail(
        createBlockPlacementError({
          playerId: 'system' as PlayerId,
          position,
          blockId,
          face,
          reason: `Block ${blockId} cannot be placed on face ${face}`,
        })
      )
    }

    // 支持ブロックの存在確認
    const supportPosition = getAdjacentPosition(position, oppositeFace)
    const supportBlock = yield* getBlockAt(supportPosition)

    if (supportBlock === ('air' as BlockId)) {
      return yield* Effect.fail(
        createBlockPlacementError({
          playerId: 'system' as PlayerId,
          position,
          blockId,
          face,
          reason: `No support block found at ${supportPosition.x}, ${supportPosition.y}, ${supportPosition.z}`,
        })
      )
    }
  })

/**
 * 環境条件の検証（光、水等）
 */
const validateEnvironmentalConditions = (
  position: BlockPosition,
  blockId: BlockId
): Effect.Effect<void, InteractionError> =>
  Effect.gen(function* () {
    const rule = getPlacementRule(blockId)

    // 光レベルチェック
    if (rule.needsLight) {
      const lightLevel = yield* getLightLevel(position)
      if (lightLevel < rule.minLightLevel) {
        return yield* Effect.fail(
          createBlockPlacementError({
            playerId: 'system' as PlayerId,
            position,
            blockId,
            face: 'top',
            reason: `Insufficient light: ${lightLevel}. Required: ${rule.minLightLevel}`,
          })
        )
      }
    }

    // 水中条件チェック
    if (rule.needsWater) {
      const inWater = yield* isInWater(position)
      if (!inWater) {
        return yield* Effect.fail(
          createBlockPlacementError({
            playerId: 'system' as PlayerId,
            position,
            blockId,
            face: 'top',
            reason: `Block ${blockId} requires water`,
          })
        )
      }
    }
  })

/**
 * プレイヤー衝突の検証
 */
const validatePlayerCollision = (
  position: BlockPosition,
  blockId: BlockId,
  playerId: PlayerId
): Effect.Effect<void, InteractionError> =>
  Effect.gen(function* () {
    const wouldCollide = yield* wouldCollideWithPlayer(position, playerId)

    if (wouldCollide) {
      return yield* Effect.fail(
        createBlockPlacementError({
          playerId,
          position,
          blockId,
          face: 'top',
          reason: 'Block placement would collide with player',
        })
      )
    }
  })

// =============================================================================
// Main Placement Function
// =============================================================================

/**
 * ブロックの設置を実行
 *
 * 包括的なバリデーションを実行した後、ブロックを設置する。
 * 以下のチェックを順番に実行:
 *
 * 1. 基本位置検証（高度、境界等）
 * 2. 既存ブロック置換可能性
 * 3. 支持ブロック確認
 * 4. 環境条件（光、水等）
 * 5. プレイヤー衝突
 * 6. 実際の設置処理
 *
 * @param playerId - プレイヤーID
 * @param position - 設置位置
 * @param blockId - 設置するブロックID
 * @param face - 設置する面
 * @returns 設置結果
 */
export const placeBlock = (
  playerId: PlayerId,
  position: BlockPosition,
  blockId: BlockId,
  face: BlockFace
): Effect.Effect<PlacementResult, InteractionError> =>
  Effect.gen(function* () {
    // ===== Step 1: 基本位置検証 =====
    yield* validatePlacementPosition(position, blockId)

    // ===== Step 2: 既存ブロック置換可能性チェック =====
    yield* validateBlockReplacement(position, blockId)

    // ===== Step 3: 支持ブロック検証 =====
    yield* validateSupport(position, blockId, face)

    // ===== Step 4: 環境条件検証 =====
    yield* validateEnvironmentalConditions(position, blockId)

    // ===== Step 5: プレイヤー衝突検証 =====
    yield* validatePlayerCollision(position, blockId, playerId)

    // ===== Step 6: 実際の設置処理 =====
    yield* setBlockAt(position, blockId)

    return createSuccessfulPlacement(position)
  }).pipe(
    // 設置エラーをキャッチして適切なレスポンスに変換
    Effect.catchAll((error) =>
      Effect.succeed(createFailedPlacement(error instanceof Error ? error.message : 'Unknown placement error'))
    )
  )

// =============================================================================
// Batch Placement Operations
// =============================================================================

/**
 * 複数ブロックの一括設置
 * 建築時の効率化や、構造物の一括設置に使用
 */
export type BatchPlacementRequest = {
  readonly position: BlockPosition
  readonly blockId: BlockId
  readonly face: BlockFace
}

/**
 * 複数ブロックを一括で設置
 *
 * @param playerId - プレイヤーID
 * @param requests - 設置リクエストの配列
 * @returns 各設置の結果配列
 */
export const placeBatchBlocks = (
  playerId: PlayerId,
  requests: ReadonlyArray<BatchPlacementRequest>
): Effect.Effect<ReadonlyArray<PlacementResult>, never> =>
  Effect.gen(function* () {
    const results: PlacementResult[] = []

    for (const request of requests) {
      const result = yield* placeBlock(playerId, request.position, request.blockId, request.face).pipe(
        // 個別エラーは結果に含める（全体の処理は継続）
        Effect.catchAll((error) =>
          Effect.succeed(createFailedPlacement(error instanceof Error ? error.message : 'Batch placement error'))
        )
      )

      results.push(result)
    }

    return results
  })

// =============================================================================
// Advanced Placement Features
// =============================================================================

/**
 * 面から最適な設置位置を計算
 *
 * プレイヤーがブロックを右クリックした際の、
 * 最適な新ブロック設置位置を自動計算する。
 *
 * @param clickedPosition - クリックされたブロック位置
 * @param clickedFace - クリックされた面
 * @param blockId - 設置予定のブロックID
 * @returns 最適な設置位置
 */
export const calculateOptimalPlacementPosition = (
  clickedPosition: BlockPosition,
  clickedFace: BlockFace,
  blockId: BlockId
): Effect.Effect<BlockPosition, InteractionError> =>
  Effect.gen(function* () {
    // 基本的には隣接位置を返す
    const adjacentPosition = getAdjacentPosition(clickedPosition, clickedFace)

    // より高度なロジック:
    // - ブロックタイプに応じた最適化
    // - 既存構造物との整合性
    // - プレイヤーの向きを考慮した配置

    return adjacentPosition
  })

/**
 * 設置可能性の事前チェック
 *
 * 実際に設置を実行せずに、設置可能かどうかを
 * 事前にチェックする。UIでの表示等に使用。
 *
 * @param playerId - プレイヤーID
 * @param position - 設置位置
 * @param blockId - 設置するブロックID
 * @param face - 設置する面
 * @returns 設置可能性とその理由
 */
export const checkPlacementViability = (
  playerId: PlayerId,
  position: BlockPosition,
  blockId: BlockId,
  face: BlockFace
): Effect.Effect<
  {
    readonly canPlace: boolean
    readonly reason?: string
  },
  never
> =>
  Effect.gen(function* () {
    const placementResult = yield* placeBlock(playerId, position, blockId, face).pipe(
      Effect.catchAll((error) =>
        Effect.succeed(createFailedPlacement(error instanceof Error ? error.message : 'Placement check error'))
      )
    )

    return {
      canPlace: placementResult.success,
      ...(placementResult.reason && { reason: placementResult.reason }),
    }
  })

// =============================================================================
// Testing and Debug Utilities
// =============================================================================

/**
 * 設置ルールのデバッグ情報を取得
 */
export const getPlacementRuleDebugInfo = (blockId: BlockId) =>
  Effect.succeed({
    blockId,
    rule: getPlacementRule(blockId),
    isCustomRule: PLACEMENT_RULES_DATABASE.has(blockId),
  })

/**
 * 範囲内の設置可能位置をスキャン
 * デバッグ用途
 */
export const scanPlaceablePositions = (
  center: BlockPosition,
  radius: number,
  blockId: BlockId,
  playerId: PlayerId
): Effect.Effect<ReadonlyArray<BlockPosition>, never> =>
  Effect.gen(function* () {
    const placeablePositions: BlockPosition[] = []

    for (let x = center.x - radius; x <= center.x + radius; x++) {
      for (let y = center.y - radius; y <= center.y + radius; y++) {
        for (let z = center.z - radius; z <= center.z + radius; z++) {
          const position = { x, y, z } as BlockPosition

          const viability = yield* checkPlacementViability(
            playerId,
            position,
            blockId,
            'top' // 仮に上面設置として検査
          )

          if (viability.canPlace) {
            placeablePositions.push(position)
          }
        }
      }
    }

    return placeablePositions
  })

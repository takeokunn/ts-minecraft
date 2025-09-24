import { Effect, Ref, Schema, Match, pipe, Option } from 'effect'
import type { BlockId, BlockPosition, PlayerId, SessionId } from '../../shared/types/branded'
import type { Timestamp } from '../../shared/types/time-brands'
import { SessionId as SessionIdSchema, BlockPosition as BlockPositionSchema } from '../../shared/types/branded'
import { TimestampSchema } from '../../shared/types/time-brands'
import type { ToolType, BreakingSession, BreakingProgress } from './InteractionTypes'
import { createBlockBreakingError, createBreakingSessionError, type InteractionError } from './InteractionErrors'

// =============================================================================
// Block Hardness Database
// =============================================================================

/**
 * ブロック硬度データベース
 * Minecraftの公式値に準拠した硬度設定
 *
 * 硬度値の意味:
 * - 0.0: 瞬時破壊（草、花等）
 * - 0.5: 非常に柔らかい（土、砂等）
 * - 1.5: 柔らかい（木材、羊毛等）
 * - 3.0: 標準（丸石、レンガ等）
 * - 5.0: 硬い（鉄鉱石、黒曜石等）
 * - -1.0: 破壊不可能（基盤等）
 */
const BLOCK_HARDNESS_DATABASE: ReadonlyMap<BlockId, number> = new Map([
  // 破壊不可能ブロック
  ['bedrock' as BlockId, -1.0],
  ['barrier' as BlockId, -1.0],

  // 瞬時破壊
  ['air' as BlockId, 0.0],
  ['grass' as BlockId, 0.0],
  ['dandelion' as BlockId, 0.0],
  ['poppy' as BlockId, 0.0],
  ['torch' as BlockId, 0.0],

  // 非常に柔らかい (0.5)
  ['dirt' as BlockId, 0.5],
  ['sand' as BlockId, 0.5],
  ['gravel' as BlockId, 0.6],
  ['snow' as BlockId, 0.1],

  // 柔らかい (1.0-2.0)
  ['oak_log' as BlockId, 2.0],
  ['oak_planks' as BlockId, 2.0],
  ['wool' as BlockId, 0.8],
  ['glass' as BlockId, 0.3],

  // 標準 (3.0-4.0)
  ['stone' as BlockId, 1.5],
  ['cobblestone' as BlockId, 2.0],
  ['brick' as BlockId, 2.0],
  ['coal_ore' as BlockId, 3.0],
  ['iron_ore' as BlockId, 3.0],

  // 硬い (5.0+)
  ['diamond_ore' as BlockId, 3.0],
  ['obsidian' as BlockId, 50.0],

  // デフォルト値
  ['default' as BlockId, 2.0],
])

/**
 * ブロックの硬度を取得
 */
const getBlockHardness = (blockId: BlockId): number => {
  return BLOCK_HARDNESS_DATABASE.get(blockId) ?? BLOCK_HARDNESS_DATABASE.get('default' as BlockId)!
}

// =============================================================================
// Tool Efficiency Database
// =============================================================================

/**
 * ツール効率データベース
 * 各ツールの破壊効率とブロックタイプとの相性
 */
type ToolEfficiency = {
  readonly baseSpeed: number // ベース効率
  readonly effectiveBlocks: ReadonlyArray<string> // 効果的なブロックタイプ
  readonly ineffectiveBlocks: ReadonlyArray<string> // 非効率なブロックタイプ
}

const TOOL_EFFICIENCY_DATABASE: ReadonlyMap<ToolType, ToolEfficiency> = new Map([
  [
    'hand',
    {
      baseSpeed: 1.0,
      effectiveBlocks: [],
      ineffectiveBlocks: [],
    },
  ],
  [
    'pickaxe',
    {
      baseSpeed: 4.0,
      effectiveBlocks: ['stone', 'ore', 'metal', 'cobblestone'],
      ineffectiveBlocks: ['wood', 'dirt', 'sand'],
    },
  ],
  [
    'shovel',
    {
      baseSpeed: 4.0,
      effectiveBlocks: ['dirt', 'sand', 'gravel', 'clay'],
      ineffectiveBlocks: ['stone', 'wood', 'ore'],
    },
  ],
  [
    'axe',
    {
      baseSpeed: 4.0,
      effectiveBlocks: ['wood', 'log', 'planks'],
      ineffectiveBlocks: ['stone', 'dirt', 'ore'],
    },
  ],
  [
    'hoe',
    {
      baseSpeed: 1.0,
      effectiveBlocks: ['hay', 'leaves'],
      ineffectiveBlocks: ['stone', 'wood', 'ore'],
    },
  ],
  [
    'sword',
    {
      baseSpeed: 1.5,
      effectiveBlocks: ['web', 'plant'],
      ineffectiveBlocks: ['stone', 'wood', 'ore'],
    },
  ],
  [
    'shears',
    {
      baseSpeed: 1.0,
      effectiveBlocks: ['wool', 'leaves', 'vine'],
      ineffectiveBlocks: ['stone', 'wood', 'ore'],
    },
  ],
])

/**
 * ツール効率を取得
 */
const getToolEfficiency = (toolType: ToolType): ToolEfficiency => {
  return TOOL_EFFICIENCY_DATABASE.get(toolType) ?? TOOL_EFFICIENCY_DATABASE.get('hand')!
}

// =============================================================================
// Break Time Calculation
// =============================================================================

/**
 * ブロックタイプを文字列から推定
 * ブロックIDから主要なブロックタイプを抽出
 */
const inferBlockType = (blockId: BlockId): string => {
  const id = blockId.toLowerCase()

  return pipe(
    id,
    Match.value,
    Match.when(
      (id) => id.includes('stone') || id.includes('cobblestone'),
      () => 'stone'
    ),
    Match.when(
      (id) => id.includes('ore'),
      () => 'ore'
    ),
    Match.when(
      (id) => id.includes('wood') || id.includes('log') || id.includes('planks'),
      () => 'wood'
    ),
    Match.when(
      (id) => id.includes('dirt') || id.includes('soil'),
      () => 'dirt'
    ),
    Match.when(
      (id) => id.includes('sand'),
      () => 'sand'
    ),
    Match.when(
      (id) => id.includes('wool') || id.includes('carpet'),
      () => 'wool'
    ),
    Match.when(
      (id) => id.includes('glass'),
      () => 'glass'
    ),
    Match.when(
      (id) => id.includes('metal') || id.includes('iron') || id.includes('gold'),
      () => 'metal'
    ),
    Match.orElse(() => 'misc')
  )
}

/**
 * ツールとブロックの相性係数を計算
 */
const calculateToolBlockAffinity = (toolType: ToolType, blockId: BlockId): number => {
  const efficiency = getToolEfficiency(toolType)
  const blockType = inferBlockType(blockId)

  return pipe(
    blockType,
    Match.value,
    Match.when(
      (blockType) => efficiency.effectiveBlocks.some((effective) => blockType.includes(effective)),
      () => 1.0
    ), // 最高効率
    Match.when(
      (blockType) => efficiency.ineffectiveBlocks.some((ineffective) => blockType.includes(ineffective)),
      () => 0.25
    ), // 1/4の効率
    Match.orElse(() => 0.5) // 普通の相性の場合
  )
}

/**
 * ブロック破壊時間を計算
 *
 * Minecraftの破壊時間計算式に準拠:
 * breakTime = hardness × 1.5 / (toolSpeed × affinity)
 *
 * ただし、以下の調整を適用:
 * - 最小破壊時間: 0.05秒（瞬時破壊に見える）
 * - 最大破壊時間: 60秒（実用的な上限）
 * - 破壊不可能: -1の場合は Infinity を返す
 *
 * @param blockId - ブロックID
 * @param toolType - 使用ツール（null = 素手）
 * @returns 破壊時間（秒）、破壊不可能な場合は Infinity
 */
export const calculateBlockBreakTime = (
  blockId: BlockId,
  toolType: ToolType | null
): Effect.Effect<number, InteractionError> =>
  Effect.gen(function* () {
    const hardness = getBlockHardness(blockId)

    const initialBreakTime = pipe(
      hardness,
      Match.value,
      Match.when(
        (h) => h < 0,
        () => Infinity
      ), // 破壊不可能ブロック
      Match.when(0, () => 0.05), // 瞬時破壊ブロック (見た目上瞬時だが、わずかな時間は必要)
      Match.orElse(() => null)
    )

    return yield* pipe(
      initialBreakTime,
      Option.fromNullable,
      Option.match({
        onSome: (time) => Effect.succeed(time),
        onNone: () =>
          Effect.gen(function* () {
            const actualToolType = toolType ?? 'hand'
            const toolEfficiency = getToolEfficiency(actualToolType)
            const affinity = calculateToolBlockAffinity(actualToolType, blockId)

            // Minecraft式破壊時間計算
            const baseBreakTime = hardness * 1.5
            const toolSpeed = toolEfficiency.baseSpeed * affinity
            let breakTime = baseBreakTime / toolSpeed

            // 実用的な範囲に制限
            breakTime = Math.max(0.05, Math.min(60.0, breakTime))

            return breakTime
          }),
      })
    )
  })

// =============================================================================
// Breaking Session Management
// =============================================================================

/**
 * アクティブな破壊セッションを管理するマップ
 * 本来はサービスレイヤーで管理すべきだが、
 * 実装例として関数内で管理
 */
const activeBreakingSessions = new Map<SessionId, BreakingSession>()

/**
 * セッションIDを生成
 */
const generateSessionId = (): SessionId => {
  const rawId = `breaking-session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  return rawId as SessionId
}

/**
 * ブロック破壊セッションを開始
 *
 * 新しい破壊セッションを作成し、破壊時間を計算して
 * 進捗追跡を開始する。
 *
 * @param playerId - プレイヤーID
 * @param blockPos - 破壊するブロック位置
 * @param toolType - 使用するツール
 * @returns 破壊セッション情報
 */
export const startBlockBreaking = (
  playerId: PlayerId,
  blockPos: BlockPosition,
  toolType: ToolType | null
): Effect.Effect<BreakingSession, InteractionError> =>
  Effect.gen(function* () {
    // プレイヤーの既存セッションをチェック
    const existingSession = Array.from(activeBreakingSessions.values()).find((session) => session.playerId === playerId)

    yield* pipe(
      Option.fromNullable(existingSession),
      Option.match({
        onNone: () => Effect.void,
        onSome: (session) =>
          Effect.fail(
            createBlockBreakingError({
              playerId,
              blockPosition: blockPos,
              toolType,
              reason: `Player already has active breaking session: ${session.sessionId}`,
            })
          ),
      })
    )

    // TODO: ブロックが実際に存在するかチェック
    // const blockExists = yield* checkBlockExists(blockPos)

    // 破壊時間を計算（仮のブロックIDを使用）
    const blockId = 'stone' as BlockId // TODO: 実際のブロックIDを取得
    const totalBreakTime = yield* calculateBlockBreakTime(blockId, toolType)

    yield* Effect.when(
      Effect.fail(
        createBlockBreakingError({
          playerId,
          blockPosition: blockPos,
          toolType,
          reason: 'Block is unbreakable',
        })
      ),
      () => totalBreakTime === Infinity
    )

    // 新しいセッションを作成
    const sessionId = generateSessionId()
    const timestamp = Date.now() as Timestamp

    const session: BreakingSession = {
      sessionId,
      playerId,
      blockPosition: blockPos,
      toolType,
      startTime: timestamp,
      progress: 0,
      totalBreakTime,
    }

    // セッションを登録
    activeBreakingSessions.set(sessionId, session)

    return session
  })

/**
 * ブロック破壊進捗を更新
 *
 * 指定されたセッションの進捗を時間経過に基づいて更新する。
 * 破壊完了時は自動的にセッションを削除する。
 *
 * @param sessionId - セッションID
 * @param deltaTime - 経過時間（秒）
 * @returns 更新された進捗情報
 */
export const updateBlockBreaking = (
  sessionId: SessionId,
  deltaTime: number
): Effect.Effect<BreakingProgress, InteractionError> =>
  Effect.gen(function* () {
    const session = activeBreakingSessions.get(sessionId)

    yield* pipe(
      Option.fromNullable(session),
      Option.match({
        onNone: () =>
          Effect.fail(
            createBreakingSessionError({
              sessionId,
              playerId: 'unknown' as PlayerId,
              reason: `Breaking session not found: ${sessionId}`,
            })
          ),
        onSome: () => Effect.void,
      })
    )

    yield* Effect.when(
      Effect.fail(
        createBreakingSessionError({
          sessionId,
          playerId: session?.playerId ?? ('unknown' as PlayerId),
          reason: `Invalid delta time: ${deltaTime}`,
        })
      ),
      () => deltaTime < 0
    )

    // 進捗を計算 (session は既に null チェック済み)
    const validSession = session!
    const elapsedTime = (Date.now() - validSession.startTime) / 1000
    const newProgress = Math.min(1.0, elapsedTime / validSession.totalBreakTime)
    const isComplete = newProgress >= 1.0
    const remainingTime = Math.max(0, validSession.totalBreakTime - elapsedTime)

    // セッションを更新
    const updatedSession: BreakingSession = {
      ...validSession,
      progress: newProgress,
    }

    pipe(
      isComplete,
      Match.value,
      Match.when(true, () => {
        // 破壊完了 - セッションを削除
        activeBreakingSessions.delete(sessionId)
      }),
      Match.when(false, () => {
        // セッションを更新
        activeBreakingSessions.set(sessionId, updatedSession)
      }),
      Match.exhaustive
    )

    return {
      sessionId,
      progress: newProgress,
      isComplete,
      remainingTime,
    }
  })

/**
 * 破壊セッションを取得
 */
export const getBreakingSession = (sessionId: SessionId): Effect.Effect<BreakingSession | null, never> =>
  Effect.succeed(activeBreakingSessions.get(sessionId) ?? null)

/**
 * プレイヤーの破壊セッションを取得
 */
export const getPlayerBreakingSession = (playerId: PlayerId): Effect.Effect<BreakingSession | null, never> =>
  Effect.succeed(Array.from(activeBreakingSessions.values()).find((session) => session.playerId === playerId) ?? null)

/**
 * 破壊セッションをキャンセル
 */
export const cancelBreakingSession = (sessionId: SessionId): Effect.Effect<void, InteractionError> =>
  Effect.gen(function* () {
    const session = activeBreakingSessions.get(sessionId)

    yield* pipe(
      Option.fromNullable(session),
      Option.match({
        onNone: () =>
          Effect.fail(
            createBreakingSessionError({
              sessionId,
              playerId: 'unknown' as PlayerId,
              reason: `Breaking session not found: ${sessionId}`,
            })
          ),
        onSome: () =>
          Effect.sync(() => {
            activeBreakingSessions.delete(sessionId)
          }),
      })
    )
  })

/**
 * 全ての破壊セッションを取得
 */
export const getAllBreakingSessions = (): Effect.Effect<ReadonlyArray<BreakingSession>, never> =>
  Effect.succeed(Array.from(activeBreakingSessions.values()))

// =============================================================================
// Breaking Animation Support
// =============================================================================

/**
 * 破壊アニメーションステージを計算
 *
 * Minecraftの破壊アニメーションは0-9の10段階。
 * 進捗率に基づいて適切なステージを計算する。
 *
 * @param progress - 破壊進捗（0.0-1.0）
 * @returns アニメーションステージ（0-9）
 */
export const calculateBreakingAnimationStage = (progress: number): number => {
  const clampedProgress = Math.max(0, Math.min(1, progress))
  return Math.floor(clampedProgress * 10)
}

/**
 * 破壊アニメーション用のパーティクル生成パラメータ
 */
export type BreakingParticleParams = {
  readonly position: BlockPosition
  readonly progress: number
  readonly blockId: BlockId
  readonly particleCount: number
  readonly intensity: number
}

/**
 * 破壊パーティクルのパラメータを生成
 */
export const generateBreakingParticleParams = (
  session: BreakingSession,
  blockId: BlockId
): Effect.Effect<BreakingParticleParams, never> =>
  Effect.succeed({
    position: session.blockPosition,
    progress: session.progress,
    blockId,
    particleCount: Math.floor(session.progress * 20) + 5, // 5-25個のパーティクル
    intensity: Math.min(1.0, session.progress * 2), // 強度は進捗に比例
  })

// =============================================================================
// Testing and Debug Utilities
// =============================================================================

/**
 * 破壊セッション統計情報
 */
export type BreakingSessionStats = {
  readonly totalActiveSessions: number
  readonly sessionsByPlayer: ReadonlyMap<PlayerId, number>
  readonly averageProgress: number
  readonly oldestSessionAge: number // 秒
}

/**
 * 破壊セッションの統計情報を取得
 */
export const getBreakingSessionStats = (): Effect.Effect<BreakingSessionStats, never> =>
  Effect.gen(function* () {
    const sessions = Array.from(activeBreakingSessions.values())
    const currentTime = Date.now()

    const sessionsByPlayer = new Map<PlayerId, number>()
    let totalProgress = 0
    let oldestSessionAge = 0

    for (const session of sessions) {
      // プレイヤー別セッション数
      const playerCount = sessionsByPlayer.get(session.playerId) ?? 0
      sessionsByPlayer.set(session.playerId, playerCount + 1)

      // 総進捗
      totalProgress += session.progress

      // 最古セッション年齢
      const sessionAge = (currentTime - session.startTime) / 1000
      oldestSessionAge = Math.max(oldestSessionAge, sessionAge)
    }

    return {
      totalActiveSessions: sessions.length,
      sessionsByPlayer,
      averageProgress: sessions.length > 0 ? totalProgress / sessions.length : 0,
      oldestSessionAge,
    }
  })

/**
 * テスト用: 全セッションをクリア
 */
export const clearAllBreakingSessions = (): Effect.Effect<void, never> =>
  Effect.sync(() => {
    activeBreakingSessions.clear()
  })

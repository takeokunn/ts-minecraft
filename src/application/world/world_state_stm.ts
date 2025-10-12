/**
 * @fileoverview World State STM - トランザクショナルワールド状態管理
 *
 * M-1実装: STM (Software Transactional Memory) によるワールド状態の原子性保証
 *
 * 設計方針:
 * - STM.TRefによる並行安全な状態管理
 * - トランザクション境界の明示化
 * - 競合検出と自動リトライ
 * - アイテムduplication/loss防止
 * - マルチプレイヤー環境対応
 *
 * @see {@link file://FIBER_STM_QUEUE_POOL_STREAM_DESIGN.md} M-1: ワールド状態のSTM管理
 */

import type { ChunkData } from '@/domain/chunk/aggregate/chunk'
import type { ChunkId } from '@/domain/shared/entities/chunk_id'
import type { PlayerId } from '@/domain/shared/entities/player_id'
import { WorldIdSchema } from '@/domain/shared/entities/world_id/schema'
import type { WorldMetadata } from '@/domain/world/repository/world_metadata_repository/interface'
import { WorldClock } from '@/domain/world/time'
import { createWorldSeed } from '@/domain/world/types/core/world_types'
import { WorldCoordinate2DSchema } from '@/domain/world/value_object/coordinates'
import { createWorldGeneratorId } from '@/domain/world_generation/aggregate/world_generator'
import { Context, DateTime, Effect, Layer, ReadonlyArray, STM, Schema, pipe } from 'effect'

/**
 * WorldStateSTM Service定義
 *
 * STM.TRefによる並行安全なワールド状態管理。
 * 複数のクライアントからの同時更新を原子的に処理。
 */
export interface WorldStateSTM {
  /**
   * ロード済みチャンクMap（STM.TRef管理）
   *
   * ChunkIdをキーとしたチャンクデータの保持。
   * STM.TRefにより、複数スレッドからの同時更新が原子的に処理される。
   */
  readonly loadedChunks: STM.TRef<ReadonlyMap<ChunkId, ChunkData>>

  /**
   * アクティブプレイヤーSet（STM.TRef管理）
   *
   * 現在ワールドに参加しているプレイヤーIDのセット。
   * プレイヤーの参加/退出が原子的に管理される。
   */
  readonly activePlayers: STM.TRef<ReadonlySet<PlayerId>>

  /**
   * ワールドメタデータ（STM.TRef管理）
   *
   * ワールド全体の設定・統計情報。
   * 複数の操作からの更新競合を自動検出・リトライ。
   */
  readonly worldMetadata: STM.TRef<WorldMetadata>

  /**
   * チャンク追加（トランザクショナル）
   *
   * 指定されたチャンクをロード済みチャンクMapに追加。
   * 他の操作との競合時は自動的にリトライされる。
   *
   * @param chunkId - 追加するチャンクID
   * @param chunk - チャンクデータ（ChunkData）
   * @returns チャンク追加Effect（エラー時は自動リトライ）
   */
  readonly addChunk: (chunkId: ChunkId, chunk: ChunkData) => Effect.Effect<void>

  /**
   * チャンク削除（トランザクショナル）
   *
   * 指定されたチャンクをロード済みチャンクMapから削除。
   *
   * @param chunkId - 削除するチャンクID
   * @returns チャンク削除Effect
   */
  readonly removeChunk: (chunkId: ChunkId) => Effect.Effect<void>

  /**
   * チャンク取得（トランザクショナル読み取り）
   *
   * 指定されたチャンクIDのチャンクデータを取得。
   * 読み取り専用のトランザクションとして実行。
   *
   * @param chunkId - 取得するチャンクID
   * @returns チャンクデータ（存在しない場合はundefined）
   */
  readonly getChunk: (chunkId: ChunkId) => Effect.Effect<ChunkData | undefined>

  /**
   * 全ロード済みチャンク取得（トランザクショナル読み取り）
   *
   * 現在ロードされている全チャンクのMapを取得。
   *
   * @returns ロード済みチャンクMap
   */
  readonly getAllChunks: () => Effect.Effect<ReadonlyMap<ChunkId, ChunkData>>

  /**
   * プレイヤー追加（トランザクショナル）
   *
   * 新しいプレイヤーをアクティブプレイヤーSetに追加。
   *
   * @param playerId - 追加するプレイヤーID
   * @returns プレイヤー追加Effect
   */
  readonly addPlayer: (playerId: PlayerId) => Effect.Effect<void>

  /**
   * プレイヤー削除（トランザクショナル）
   *
   * プレイヤーをアクティブプレイヤーSetから削除。
   *
   * @param playerId - 削除するプレイヤーID
   * @returns プレイヤー削除Effect
   */
  readonly removePlayer: (playerId: PlayerId) => Effect.Effect<void>

  /**
   * 全アクティブプレイヤー取得（トランザクショナル読み取り）
   *
   * 現在アクティブな全プレイヤーのSetを取得。
   *
   * @returns アクティブプレイヤーSet
   */
  readonly getAllPlayers: () => Effect.Effect<ReadonlySet<PlayerId>>

  /**
   * ワールドメタデータ更新（トランザクショナル）
   *
   * ワールドメタデータの部分更新を原子的に実行。
   *
   * @param update - 更新する項目（Partial<WorldMetadata>）
   * @returns メタデータ更新Effect
   */
  readonly updateMetadata: (update: Partial<WorldMetadata>) => Effect.Effect<void>

  /**
   * ワールドメタデータ取得（トランザクショナル読み取り）
   *
   * 現在のワールドメタデータを取得。
   *
   * @returns ワールドメタデータ
   */
  readonly getMetadata: () => Effect.Effect<WorldMetadata>

  /**
   * 複合トランザクション: プレイヤー参加とチャンクロード
   *
   * プレイヤーの参加と周辺チャンクのロードを1つのトランザクションとして実行。
   * 全ての操作が成功するか、全てがロールバックされる（原子性保証）。
   *
   * 典型的な使用例:
   * - プレイヤーのワールド参加時
   * - リスポーン時
   * - テレポート後の状態復元
   *
   * @param playerId - 参加するプレイヤーID
   * @param chunks - ロードするチャンクの配列 ([ChunkId, ChunkData]のペア)
   * @returns 複合操作Effect
   */
  readonly addPlayerAndLoadChunks: (
    playerId: PlayerId,
    chunks: ReadonlyArray<readonly [ChunkId, ChunkData]>
  ) => Effect.Effect<void>

  /**
   * 複合トランザクション: プレイヤー退出とチャンクアンロード
   *
   * プレイヤーの退出と不要チャンクのアンロードを1つのトランザクションとして実行。
   *
   * @param playerId - 退出するプレイヤーID
   * @param chunkIds - アンロードするチャンクIDの配列
   * @returns 複合操作Effect
   */
  readonly removePlayerAndUnloadChunks: (playerId: PlayerId, chunkIds: ReadonlyArray<ChunkId>) => Effect.Effect<void>

  /**
   * 複合トランザクション: 統計情報更新とチャンク管理
   *
   * ワールド統計情報の更新とチャンク状態の同期を原子的に実行。
   * 統計情報とチャンク数の不整合を防ぐ。
   *
   * @param loadedChunkCount - ロード済みチャンク数
   * @param activePlayerCount - アクティブプレイヤー数
   * @returns 統計更新Effect
   */
  readonly updateStatisticsAndSync: (loadedChunkCount: number, activePlayerCount: number) => Effect.Effect<void>
}

/**
 * WorldStateSTM Context Tag
 *
 * Effectレイヤーシステムでの依存性注入に使用。
 */
export const WorldStateSTMTag = Context.GenericTag<WorldStateSTM>('@minecraft/application/world/WorldStateSTM')

/**
 * WorldStateSTM Live Layer実装
 *
 * STM.TRefの初期化とトランザクショナル操作関数の提供。
 *
 * 実装の特徴:
 * - STM.commitによる原子性保証
 * - STM.genによる複合トランザクション
 * - 競合時の自動リトライ（STMの標準機能）
 * - デッドロックフリー（STMはロックフリー）
 *
 * パフォーマンス考慮:
 * - 読み取り専用操作はSTM.TRef.getを使用（競合なし）
 * - 更新操作はSTM.commitでラップ（競合検出・リトライあり）
 * - 複合操作はSTM.genで1トランザクションにまとめる（効率化）
 *
 * @param initialMetadata - 初期ワールドメタデータ
 * @returns WorldStateSTM Layer
 */
export const makeWorldStateSTMLive = (initialMetadata: WorldMetadata) =>
  Layer.effect(
    WorldStateSTMTag,
    Effect.gen(function* () {
      // === TRef初期化 ===

      /**
       * ロード済みチャンクMap TRef
       * 初期値: 空のMap
       */
      const loadedChunks = yield* STM.TRef.make<ReadonlyMap<ChunkId, ChunkData>>(new Map<ChunkId, ChunkData>())

      /**
       * アクティブプレイヤーSet TRef
       * 初期値: 空のSet
       */
      const activePlayers = yield* STM.TRef.make<ReadonlySet<PlayerId>>(new Set())

      /**
       * ワールドメタデータ TRef
       * 初期値: 引数で渡されたinitialMetadata
       */
      const worldMetadata = yield* STM.TRef.make<WorldMetadata>(initialMetadata)

      /**
       * 時刻取得サービス
       * WorldClock経由で現在時刻を参照透明に取得する
       */
      const worldClock = yield* WorldClock

      // === 単一操作関数 ===

      /**
       * チャンク追加実装
       *
       * STM.commitでトランザクション境界を明示。
       * 既存Mapに新しいチャンクを追加した新しいMapをセット。
       */
      const addChunk = (chunkId: ChunkId, chunk: ChunkData): Effect.Effect<void> =>
        STM.commit(
          STM.gen(function* () {
            const current = yield* STM.TRef.get(loadedChunks)
            const updated = new Map(current).set(chunkId, chunk)
            yield* STM.TRef.set(loadedChunks, updated)
          })
        )

      /**
       * チャンク削除実装
       */
      const removeChunk = (chunkId: ChunkId): Effect.Effect<void> =>
        STM.commit(
          STM.gen(function* () {
            const current = yield* STM.TRef.get(loadedChunks)
            const updated = new Map(current)
            updated.delete(chunkId)
            yield* STM.TRef.set(loadedChunks, updated)
          })
        )

      /**
       * チャンク取得実装（読み取り専用）
       */
      const getChunk = (chunkId: ChunkId): Effect.Effect<ChunkData | undefined> =>
        STM.commit(
          STM.gen(function* () {
            const current = yield* STM.TRef.get(loadedChunks)
            return current.get(chunkId)
          })
        )

      /**
       * 全チャンク取得実装（読み取り専用）
       */
      const getAllChunks = (): Effect.Effect<ReadonlyMap<ChunkId, ChunkData>> => STM.commit(STM.TRef.get(loadedChunks))

      /**
       * プレイヤー追加実装
       */
      const addPlayer = (playerId: PlayerId): Effect.Effect<void> =>
        STM.commit(
          STM.gen(function* () {
            const current = yield* STM.TRef.get(activePlayers)
            const updated = new Set(current).add(playerId)
            yield* STM.TRef.set(activePlayers, updated)
          })
        )

      /**
       * プレイヤー削除実装
       */
      const removePlayer = (playerId: PlayerId): Effect.Effect<void> =>
        STM.commit(
          STM.gen(function* () {
            const current = yield* STM.TRef.get(activePlayers)
            const updated = new Set(current)
            updated.delete(playerId)
            yield* STM.TRef.set(activePlayers, updated)
          })
        )

      /**
       * 全プレイヤー取得実装（読み取り専用）
       */
      const getAllPlayers = (): Effect.Effect<ReadonlySet<PlayerId>> => STM.commit(STM.TRef.get(activePlayers))

      /**
       * メタデータ更新実装（部分更新）
       */
      const updateMetadata = (update: Partial<WorldMetadata>): Effect.Effect<void> =>
        Effect.gen(function* () {
          const now = yield* worldClock.currentDate
          yield* STM.commit(
            STM.gen(function* () {
              const current = yield* STM.TRef.get(worldMetadata)
              const updated: WorldMetadata = {
                ...current,
                ...update,
                lastModified: now, // 更新日時を自動設定
              }
              yield* STM.TRef.set(worldMetadata, updated)
            })
          )
        })

      /**
       * メタデータ取得実装（読み取り専用）
       */
      const getMetadata = (): Effect.Effect<WorldMetadata> => STM.commit(STM.TRef.get(worldMetadata))

      // === 複合トランザクション ===

      /**
       * プレイヤー参加 + チャンクロード（原子性保証）
       *
       * 1つのトランザクションで以下を実行:
       * 1. プレイヤーをactivePlayers Setに追加
       * 2. 複数チャンクをloadedChunks Mapに追加
       *
       * 全ての操作が成功するか、全てロールバック。
       * 競合時はSTMが自動リトライ。
       */
      const addPlayerAndLoadChunks = (
        playerId: PlayerId,
        chunks: ReadonlyArray<readonly [ChunkId, ChunkData]>
      ): Effect.Effect<void> =>
        STM.commit(
          STM.gen(function* () {
            // プレイヤー追加
            const currentPlayers = yield* STM.TRef.get(activePlayers)
            yield* STM.TRef.set(activePlayers, new Set(currentPlayers).add(playerId))

            // チャンク一括ロード
            const currentChunks = yield* STM.TRef.get(loadedChunks)
            const updatedChunks = pipe(
              chunks,
              ReadonlyArray.reduce(new Map(currentChunks), (acc, [chunkId, chunk]) => {
                acc.set(chunkId, chunk)
                return acc
              })
            )
            yield* STM.TRef.set(loadedChunks, updatedChunks)
          })
        )

      /**
       * プレイヤー退出 + チャンクアンロード（原子性保証）
       */
      const removePlayerAndUnloadChunks = (playerId: PlayerId, chunkIds: ReadonlyArray<ChunkId>): Effect.Effect<void> =>
        STM.commit(
          STM.gen(function* () {
            // プレイヤー削除
            const currentPlayers = yield* STM.TRef.get(activePlayers)
            const updatedPlayers = new Set(currentPlayers)
            updatedPlayers.delete(playerId)
            yield* STM.TRef.set(activePlayers, updatedPlayers)

            // チャンク一括アンロード
            const currentChunks = yield* STM.TRef.get(loadedChunks)
            const updatedChunks = pipe(
              chunkIds,
              ReadonlyArray.reduce(new Map(currentChunks), (acc, chunkId) => {
                acc.delete(chunkId)
                return acc
              })
            )
            yield* STM.TRef.set(loadedChunks, updatedChunks)
          })
        )

      /**
       * 統計情報更新 + チャンク同期（原子性保証）
       *
       * ワールド統計のチャンク数・プレイヤー数を実際の状態と同期。
       * 統計情報の不整合を防ぐ。
       */
      const updateStatisticsAndSync = (loadedChunkCount: number, activePlayerCount: number): Effect.Effect<void> =>
        Effect.gen(function* () {
          const now = yield* worldClock.currentDate
          yield* STM.commit(
            STM.gen(function* () {
              const current = yield* STM.TRef.get(worldMetadata)
              const updated: WorldMetadata = {
                ...current,
                statistics: {
                  ...current.statistics,
                  size: {
                    ...current.statistics.size,
                    loadedChunks: loadedChunkCount,
                  },
                  player: {
                    ...current.statistics.player,
                    playerCount: activePlayerCount,
                    lastPlayerActivity: now,
                  },
                  lastUpdated: now,
                },
                lastModified: now,
              }
              yield* STM.TRef.set(worldMetadata, updated)
            })
          )
        })

      // === Service返却 ===

      return WorldStateSTMTag.of({
        loadedChunks,
        activePlayers,
        worldMetadata,
        addChunk,
        removeChunk,
        getChunk,
        getAllChunks,
        addPlayer,
        removePlayer,
        getAllPlayers,
        updateMetadata,
        getMetadata,
        addPlayerAndLoadChunks,
        removePlayerAndUnloadChunks,
        updateStatisticsAndSync,
      })
    })
  )

/**
 * デフォルトWorldStateSTM Layer
 *
 * 開発環境用のデフォルトメタデータで初期化。
 * 本番環境では適切なメタデータを渡してmakeWorldStateSTMLive()を使用すること。
 */
const defaultTimestamp = DateTime.toDate(DateTime.unsafeNow())
const DEFAULT_WORLD_ID = 'default_world' satisfies WorldId
const DEFAULT_WORLD_SEED = createWorldSeed(1_234_567_890)
const DEFAULT_GENERATOR_ID = createWorldGeneratorId('wg_default_generator')
const DEFAULT_WORLD_BORDER_CENTER = { x: 0, z: 0 } satisfies WorldCoordinate2D

export const WorldStateSTMLive = makeWorldStateSTMLive({
  id: DEFAULT_WORLD_ID,
  name: 'Default World',
  description: 'Default world for development',
  seed: DEFAULT_WORLD_SEED,
  generatorId: DEFAULT_GENERATOR_ID,
  version: '1.0.0',
  gameVersion: '0.1.0',
  createdAt: defaultTimestamp,
  lastModified: defaultTimestamp,
  lastAccessed: defaultTimestamp,
  tags: [],
  properties: {},
  settings: {
    gameMode: 'survival',
    difficulty: 'normal',
    worldType: 'default',
    generateStructures: true,
    generateBonusChest: false,
    allowCheats: false,
    hardcore: false,
    pvp: true,
    spawnProtection: 16,
    worldBorder: {
      center: DEFAULT_WORLD_BORDER_CENTER,
      size: 60000000,
      warningBlocks: 5,
      warningTime: 15,
      damageAmount: 0.2,
      damageBuffer: 5,
    },
    gameRules: {},
    dataPackSettings: {
      enabled: [],
      disabled: [],
      available: [],
    },
  },
  statistics: {
    size: {
      totalChunks: 0,
      loadedChunks: 0,
      generatedChunks: 0,
      compressedSize: 0,
      uncompressedSize: 0,
    },
    performance: {
      averageGenerationTime: 0,
      averageLoadTime: 0,
      totalGenerationTime: 0,
      cacheHitRate: 0,
      compressionRatio: 0,
    },
    content: {
      biomeCount: {},
      structureCount: {},
      entityCount: {},
      tileEntityCount: {},
    },
    player: {
      playerCount: 0,
      totalPlayTime: 0,
      lastPlayerActivity: defaultTimestamp,
      spawnLocations: [],
    },
    lastUpdated: defaultTimestamp,
  },
  checksum: '',
})

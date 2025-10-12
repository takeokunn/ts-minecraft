/**
 * Camera State Repository - Live Implementation
 *
 * Camera状態永続化の具体的実装（インメモリ版）
 * ドメイン層での使用に特化した実装で、技術的実装詳細は含まない
 */

import type { CameraId } from '@domain/camera/types'
import { Array, Clock, Effect, HashMap, Layer, Match, Option, pipe, Ref, Schema } from 'effect'
import type {
  Camera,
  CameraRepositoryStatistics,
  CameraSnapshot,
  CameraStateQueryOptions,
  PlayerId,
  RepositoryError,
} from './index'
import { CameraSchema, CameraSnapshotSchema, createRepositoryError } from './index'
import { CameraStateRepository } from './service'

// ========================================
// Internal Storage Types
// ========================================

/**
 * In-Memory Storage State
 */
interface StorageState {
  readonly cameras: HashMap.HashMap<CameraId, Camera>
  readonly snapshots: HashMap.HashMap<CameraId, Array.ReadonlyArray<CameraSnapshot>>
  readonly playerCameraMapping: HashMap.HashMap<PlayerId, CameraId>
  readonly metadata: {
    readonly lastCleanupTime: number
    readonly totalOperations: number
  }
}

/**
 * Factory Functions for Domain Objects
 */
const CameraFactory = {
  /**
   * Snapshotからカメラを復元
   */
  fromSnapshot: (snapshot: CameraSnapshot): Effect.Effect<Camera, RepositoryError> =>
    pipe(
      {
        id: snapshot.cameraId,
        position: snapshot.position,
        rotation: snapshot.rotation,
        viewMode: snapshot.viewMode,
        settings: snapshot.settings,
        lastUpdateTime: snapshot.timestamp,
        isActive: true,
      },
      Schema.encode(CameraSchema),
      Effect.mapError(() => createRepositoryError.decodingFailed('Camera', 'Invalid snapshot data'))
    ),

  /**
   * CameraからSnapshotを作成
   */
  toSnapshot: (camera: Camera, version: number = 1): Effect.Effect<CameraSnapshot, RepositoryError> =>
    Effect.gen(function* () {
      const now = yield* Clock.currentTimeMillis
      return yield* pipe(
        {
          cameraId: camera.id,
          position: camera.position,
          rotation: camera.rotation,
          viewMode: camera.viewMode,
          settings: camera.settings,
          timestamp: now,
          version,
        },
        Schema.encode(CameraSnapshotSchema),
        Effect.mapError(() => createRepositoryError.encodingFailed('CameraSnapshot', 'Invalid camera data'))
      )
    }),
} as const

/**
 * Storage Operations
 */
const StorageOps = {
  /**
   * 初期状態を作成
   */
  createInitialState: (): Effect.Effect<StorageState> =>
    Effect.gen(function* () {
      const now = yield* Clock.currentTimeMillis
      return {
        cameras: HashMap.empty(),
        snapshots: HashMap.empty(),
        playerCameraMapping: HashMap.empty(),
        metadata: {
          lastCleanupTime: now,
          totalOperations: 0,
        },
      }
    }),

  /**
   * カメラをストレージに保存
   */
  storeCamera: (state: StorageState, camera: Camera): StorageState => ({
    ...state,
    cameras: HashMap.set(state.cameras, camera.id, camera),
    metadata: {
      ...state.metadata,
      totalOperations: state.metadata.totalOperations + 1,
    },
  }),

  /**
   * スナップショットをストレージに保存
   */
  storeSnapshot: (state: StorageState, cameraId: CameraId, snapshot: CameraSnapshot): StorageState => {
    const existingSnapshots = HashMap.get(state.snapshots, cameraId).pipe(
      Option.getOrElse(() => [] as Array.ReadonlyArray<CameraSnapshot>)
    )
    const updatedSnapshots = [...existingSnapshots, snapshot]

    return {
      ...state,
      snapshots: HashMap.set(state.snapshots, cameraId, updatedSnapshots),
      metadata: {
        ...state.metadata,
        totalOperations: state.metadata.totalOperations + 1,
      },
    }
  },

  /**
   * プレイヤーとカメラのマッピングを更新
   */
  updatePlayerMapping: (state: StorageState, playerId: PlayerId, cameraId: CameraId): StorageState => ({
    ...state,
    playerCameraMapping: HashMap.set(state.playerCameraMapping, playerId, cameraId),
  }),

  /**
   * 期限切れデータをクリーンアップ
   */
  cleanup: (state: StorageState, olderThan: Date): Effect.Effect<readonly [StorageState, number]> =>
    Effect.gen(function* () {
      const now = yield* Clock.currentTimeMillis
      const cutoffTime = olderThan.getTime()
      const filteredCameras = HashMap.filter(state.cameras, (camera) => camera.lastUpdateTime >= cutoffTime)
      const deletedCount = HashMap.size(state.cameras) - HashMap.size(filteredCameras)

      // 古いスナップショットを削除
      const filteredSnapshots = HashMap.map(state.snapshots, (snapshots) =>
        snapshots.filter((snapshot) => snapshot.timestamp >= cutoffTime)
      )

      const cleanedState: StorageState = {
        ...state,
        cameras: filteredCameras,
        snapshots: filteredSnapshots,
        metadata: {
          ...state.metadata,
          lastCleanupTime: now,
          totalOperations: state.metadata.totalOperations + 1,
        },
      }

      return [cleanedState, deletedCount] as const
    }),
} as const

// ========================================
// Error Handling Utilities
// ========================================

/**
 * Repository操作のエラーハンドリング
 */
const handleRepositoryOperation = <T>(operation: Effect.Effect<T, unknown>): Effect.Effect<T, RepositoryError> =>
  pipe(
    operation,
    Effect.catchTags({
      EntityNotFound: () => Effect.fail(createRepositoryError.entityNotFound('Camera', 'unknown')),
      ValidationFailed: (e: Extract<RepositoryError, { _tag: 'ValidationFailed' }>) =>
        Effect.fail(createRepositoryError.validationFailed(e.message)),
    }),
    // 未知のエラーはOperationFailedとして扱う
    Effect.catchAll((error) => Effect.fail(createRepositoryError.operationFailed('Unknown operation', String(error))))
  )

// ========================================
// Live Implementation
// ========================================

/**
 * Camera State Repository Live Implementation
 *
 * インメモリストレージを使用したドメイン層実装
 * 技術的な詳細は含まず、純粋なドメインロジックに集中
 */
export const CameraStateRepositoryLive = Layer.effect(
  CameraStateRepository,
  Effect.gen(function* () {
    // インメモリストレージの初期化
    const initialState = yield* StorageOps.createInitialState()
    const storageRef = yield* Ref.make(initialState)

    return CameraStateRepository.of({
      /**
       * Cameraエンティティを保存
       */
      save: (camera: Camera) =>
        Effect.gen(function* () {
          yield* Ref.update(storageRef, (state) => StorageOps.storeCamera(state, camera))
          yield* Effect.logDebug(`Camera saved: ${camera.id}`)
        }).pipe(handleRepositoryOperation),

      /**
       * ID によるCamera検索
       */
      findById: (cameraId: CameraId) =>
        Effect.gen(function* () {
          const state = yield* Ref.get(storageRef)
          return HashMap.get(state.cameras, cameraId)
        }).pipe(handleRepositoryOperation),

      /**
       * プレイヤーID によるCamera検索
       */
      findByPlayerId: (playerId: PlayerId) =>
        Effect.gen(function* () {
          const state = yield* Ref.get(storageRef)
          const cameraId = HashMap.get(state.playerCameraMapping, playerId)

          return yield* pipe(
            cameraId,
            Option.match({
              onNone: () => Effect.succeed(Option.none<Camera>()),
              onSome: (id) => Effect.succeed(HashMap.get(state.cameras, id)),
            })
          )
        }).pipe(handleRepositoryOperation),

      /**
       * Cameraスナップショットを保存
       */
      saveSnapshot: (cameraId: CameraId, snapshot: CameraSnapshot) =>
        Effect.gen(function* () {
          yield* Ref.update(storageRef, (state) => StorageOps.storeSnapshot(state, cameraId, snapshot))
          yield* Effect.logDebug(`Snapshot saved for camera: ${cameraId}`)
        }).pipe(handleRepositoryOperation),

      /**
       * Cameraスナップショットを読み込み
       */
      loadSnapshot: (cameraId: CameraId) =>
        Effect.gen(function* () {
          const state = yield* Ref.get(storageRef)
          const snapshots = HashMap.get(state.snapshots, cameraId).pipe(
            Option.getOrElse(() => [] as Array.ReadonlyArray<CameraSnapshot>)
          )

          // 最新のスナップショットを返す
          const latestSnapshot =
            snapshots.length > 0 ? Option.some(snapshots[snapshots.length - 1]) : Option.none<CameraSnapshot>()

          return latestSnapshot
        }).pipe(handleRepositoryOperation),

      /**
       * Camera削除
       */
      delete: (cameraId: CameraId) =>
        Effect.gen(function* () {
          yield* Ref.update(storageRef, (state) => ({
            ...state,
            cameras: HashMap.remove(state.cameras, cameraId),
            snapshots: HashMap.remove(state.snapshots, cameraId),
            metadata: {
              ...state.metadata,
              totalOperations: state.metadata.totalOperations + 1,
            },
          }))
          yield* Effect.logDebug(`Camera deleted: ${cameraId}`)
        }).pipe(handleRepositoryOperation),

      /**
       * アクティブなCamera ID一覧を取得
       */
      listActive: () =>
        Effect.gen(function* () {
          const state = yield* Ref.get(storageRef)
          return HashMap.filter(state.cameras, (camera) => camera.isActive).pipe(HashMap.keys, (keys) =>
            Array.from(keys)
          )
        }).pipe(handleRepositoryOperation),

      /**
       * 期限切れCamera のクリーンアップ
       */
      cleanup: (olderThan: Date) =>
        Effect.gen(function* () {
          const deletedCount = yield* Ref.modifyEffect(storageRef, (state) =>
            Effect.gen(function* () {
              const [cleanedState, count] = yield* StorageOps.cleanup(state, olderThan)
              return [count, cleanedState] as const
            })
          )

          yield* Effect.logInfo(`Cleanup completed: ${deletedCount} cameras removed`)
          return deletedCount
        }).pipe(handleRepositoryOperation),

      /**
       * Camera状態履歴を取得
       */
      getHistory: (cameraId: CameraId, options: CameraStateQueryOptions) =>
        Effect.gen(function* () {
          const state = yield* Ref.get(storageRef)
          const allSnapshots = HashMap.get(state.snapshots, cameraId).pipe(
            Option.getOrElse(() => [] as Array.ReadonlyArray<CameraSnapshot>)
          )

          const viewModeFiltered = pipe(
            options.filterByViewMode,
            Option.match({
              onNone: () => allSnapshots,
              onSome: ({ value }) => allSnapshots.filter((snapshot) => snapshot.viewMode === value),
            })
          )

          return pipe(
            Match.value({ snapshots: viewModeFiltered, maxItems: options.maxHistoryItems }),
            Match.when(
              ({ snapshots, maxItems }) => maxItems > 0 && snapshots.length > maxItems,
              ({ snapshots, maxItems }) => snapshots.slice(-maxItems)
            ),
            Match.orElse(({ snapshots }) => snapshots)
          )
        }).pipe(handleRepositoryOperation),

      /**
       * 複数Cameraの一括保存
       */
      saveBatch: (cameras: Array.ReadonlyArray<Camera>) =>
        Effect.gen(function* () {
          yield* Ref.update(storageRef, (state) =>
            cameras.reduce((acc, camera) => StorageOps.storeCamera(acc, camera), state)
          )
          yield* Effect.logDebug(`Batch save completed: ${cameras.length} cameras`)
        }).pipe(handleRepositoryOperation),

      /**
       * Camera統計情報を取得
       */
      getStatistics: () =>
        Effect.gen(function* () {
          const state = yield* Ref.get(storageRef)
          const cameras = HashMap.values(state.cameras)
          const allCameras = Array.from(cameras)
          const activeCameras = allCameras.filter((camera) => camera.isActive)

          const allSnapshots = HashMap.values(state.snapshots).pipe((snapshotArrays) =>
            Array.from(snapshotArrays).flat()
          )

          const timestamps = allSnapshots.map((snapshot) => snapshot.timestamp)
          const oldestTimestamp = timestamps.length > 0 ? Option.some(Math.min(...timestamps)) : Option.none()
          const newestTimestamp = timestamps.length > 0 ? Option.some(Math.max(...timestamps)) : Option.none()

          const stats: CameraRepositoryStatistics = {
            totalCameras: allCameras.length,
            activeCameras: activeCameras.length,
            inactiveCameras: allCameras.length - activeCameras.length,
            totalSnapshots: allSnapshots.length,
            averageSnapshotsPerCamera: allCameras.length > 0 ? allSnapshots.length / allCameras.length : 0,
            oldestSnapshotTimestamp: oldestTimestamp,
            newestSnapshotTimestamp: newestTimestamp,
            storageUsageBytes: JSON.stringify(state).length, // 簡易計算
          }

          return stats
        }).pipe(handleRepositoryOperation),

      /**
       * Camera存在確認
       */
      exists: (cameraId: CameraId) =>
        Effect.gen(function* () {
          const state = yield* Ref.get(storageRef)
          return HashMap.has(state.cameras, cameraId)
        }).pipe(handleRepositoryOperation),

      /**
       * Snapshot バージョン管理
       */
      getLatestSnapshotVersion: (cameraId: CameraId) =>
        Effect.gen(function* () {
          const state = yield* Ref.get(storageRef)
          const snapshots = HashMap.get(state.snapshots, cameraId).pipe(
            Option.getOrElse(() => [] as Array.ReadonlyArray<CameraSnapshot>)
          )
          return Match.value(snapshots.length)
            .pipe(
              Match.when((count) => count === 0, () => Option.none<number>()),
              Match.orElse(() => Option.some(snapshots[snapshots.length - 1].version))
            )
        }).pipe(handleRepositoryOperation),

      /**
       * 特定バージョンのSnapshot取得
       */
      getSnapshotByVersion: (cameraId: CameraId, version: number) =>
        Effect.gen(function* () {
          const state = yield* Ref.get(storageRef)
          const snapshots = HashMap.get(state.snapshots, cameraId).pipe(
            Option.getOrElse(() => [] as Array.ReadonlyArray<CameraSnapshot>)
          )

          const snapshot = snapshots.find((snap) => snap.version === version)
          return snapshot ? Option.some(snapshot) : Option.none<CameraSnapshot>()
        }).pipe(handleRepositoryOperation),
    })
  })
)

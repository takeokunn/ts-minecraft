/**
 * Camera State Repository - Live Implementation
 *
 * Camera状態永続化の具体的実装（インメモリ版）
 * ドメイン層での使用に特化した実装で、技術的実装詳細は含まない
 */

import { Array, Effect, HashMap, Layer, Match, Option, pipe, Ref, Schema } from 'effect'
import type { CameraId } from '../../types/index.js'
import type { CameraRepositoryStatistics } from './service.js'
import type { Camera, CameraSnapshot, CameraStateQueryOptions, PlayerId, RepositoryError } from './types.js'
import {
  CameraSchema,
  CameraSnapshotSchema,
  createRepositoryError,
  isEntityNotFoundError,
  isValidationError,
} from './types.js'

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
    pipe(
      {
        cameraId: camera.id,
        position: camera.position,
        rotation: camera.rotation,
        viewMode: camera.viewMode,
        settings: camera.settings,
        timestamp: Date.now(),
        version,
      },
      Schema.encode(CameraSnapshotSchema),
      Effect.mapError(() => createRepositoryError.encodingFailed('CameraSnapshot', 'Invalid camera data'))
    ),
} as const

/**
 * Storage Operations
 */
const StorageOps = {
  /**
   * 初期状態を作成
   */
  createInitialState: (): StorageState => ({
    cameras: HashMap.empty(),
    snapshots: HashMap.empty(),
    playerCameraMapping: HashMap.empty(),
    metadata: {
      lastCleanupTime: Date.now(),
      totalOperations: 0,
    },
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
  cleanup: (state: StorageState, olderThan: Date): [StorageState, number] => {
    const cutoffTime = olderThan.getTime()
    let deletedCount = 0

    // 古いカメラを削除
    const filteredCameras = HashMap.filter(state.cameras, (camera) => {
      if (camera.lastUpdateTime < cutoffTime) {
        deletedCount++
        return false
      }
      return true
    })

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
        lastCleanupTime: Date.now(),
        totalOperations: state.metadata.totalOperations + 1,
      },
    }

    return [cleanedState, deletedCount]
  },
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
    Effect.catchAll((error) =>
      pipe(
        error,
        Match.value,
        Match.when(isEntityNotFoundError, () => Effect.fail(createRepositoryError.entityNotFound('Camera', 'unknown'))),
        Match.when(isValidationError, (e) => Effect.fail(createRepositoryError.validationFailed(String(e)))),
        Match.orElse(() => Effect.fail(createRepositoryError.operationFailed('Unknown operation', String(error))))
      )
    )
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
  import('./service.js').then((m) => m.CameraStateRepository),
  Effect.gen(function* () {
    // インメモリストレージの初期化
    const storageRef = yield* Ref.make(StorageOps.createInitialState())

    return import('./service.js')
      .then((m) => m.CameraStateRepository)
      .of({
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
            const [newState, deletedCount] = yield* Ref.modify(storageRef, (state) => {
              const [cleanedState, count] = StorageOps.cleanup(state, olderThan)
              return [count, cleanedState]
            })

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

            let filteredSnapshots = allSnapshots

            // ViewModeフィルタリング
            if (Option.isSome(options.filterByViewMode)) {
              filteredSnapshots = filteredSnapshots.filter(
                (snapshot) => snapshot.viewMode === options.filterByViewMode.value
              )
            }

            // 履歴件数制限
            if (options.maxHistoryItems > 0 && filteredSnapshots.length > options.maxHistoryItems) {
              filteredSnapshots = filteredSnapshots.slice(-options.maxHistoryItems)
            }

            return filteredSnapshots
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

            if (snapshots.length === 0) {
              return Option.none<number>()
            }

            const latestSnapshot = snapshots[snapshots.length - 1]
            return Option.some(latestSnapshot.version)
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

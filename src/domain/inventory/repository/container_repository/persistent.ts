import { Clock, Effect, HashMap, Layer, Option, ReadonlyArray, Ref, Schema, pipe } from 'effect'
import { makeUnsafeContainerId } from '../../aggregate/container/types'
import type {
  Container,
  ContainerId,
  ContainerQuery,
  ContainerSnapshot,
  ContainerType,
  PlayerId,
  WorldPosition,
} from '../../types'
import { createContainerNotFoundError, createRepositoryError, createStorageError } from '../types'
import { ContainerRepository } from './index'
import { ContainerRepositoryStorageSchema } from './storage_schema'

/**
 * Persistent Storage Configuration
 */
export interface ContainerPersistentConfig {
  readonly storageKey: string
  readonly autoSaveInterval?: number
  readonly compressionEnabled?: boolean
  readonly indexedDBEnabled?: boolean
}

export const DefaultContainerPersistentConfig: ContainerPersistentConfig = {
  storageKey: 'minecraft-container-repository',
  autoSaveInterval: 60000, // 1分
  compressionEnabled: false,
  indexedDBEnabled: true,
}

/**
 * ContainerRepository Persistent Implementation
 *
 * 永続化実装。IndexedDB・LocalStorageを使用して永続化する。
 * ブラウザ環境での実運用向け。
 */
export const ContainerRepositoryPersistent = (config: ContainerPersistentConfig = DefaultContainerPersistentConfig) =>
  Layer.effect(
    ContainerRepository,
    Effect.gen(function* () {
      // インメモリキャッシュ
      const containerCache = yield* Ref.make(HashMap.empty<ContainerId, Container>())
      const positionIndex = yield* Ref.make(HashMap.empty<string, ContainerId>())
      const snapshotCache = yield* Ref.make(HashMap.empty<string, ContainerSnapshot>())
      const isDirty = yield* Ref.make(false)

      // 位置キー生成ヘルパー
      const getPositionKey = (position: WorldPosition, worldId: string): string =>
        `${worldId}:${position.x}:${position.y}:${position.z}`

      // 範囲チェックヘルパー
      const isInRange = (position: WorldPosition, minPos: WorldPosition, maxPos: WorldPosition): boolean => {
        return (
          position.x >= minPos.x &&
          position.x <= maxPos.x &&
          position.y >= minPos.y &&
          position.y <= maxPos.y &&
          position.z >= minPos.z &&
          position.z <= maxPos.z
        )
      }

      // ストレージ操作のヘルパー関数

      // Schema.decodeUnknownを使用した型安全なデータ読み込み
      const decodeFromStorage = (rawData: string) =>
        Effect.try({
          try: () => JSON.parse(rawData),
          catch: (error) => createStorageError('localStorage', 'load', `JSON parse failed: ${error}`),
        }).pipe(
          Effect.flatMap(Schema.decodeUnknown(ContainerRepositoryStorageSchema)),
          Effect.mapError((error) => createStorageError('localStorage', 'load', `Schema validation failed: ${error}`))
        )

      const loadFromStorage = Effect.gen(function* () {
        // IndexedDBチェック - Effect.whenで早期エラー返却
        yield* Effect.when(config.indexedDBEnabled && typeof window !== 'undefined' && window.indexedDB, () =>
          Effect.fail(createRepositoryError('loadFromStorage', 'IndexedDB implementation not yet available'))
        )

        // LocalStorageからのデータ読み込みと復元
        const result = yield* Effect.gen(function* () {
          const rawData = localStorage.getItem(config.storageKey)
          if (!rawData) return null

          // Schema.decodeUnknownで型安全にデータを検証
          const validated = yield* decodeFromStorage(rawData)

          // コンテナの復元
          const containerEntries = pipe(
            validated.containers ? Object.entries(validated.containers) : [],
            ReadonlyArray.map(([id, container]) => {
              const cont: Container = {
                ...container,
                id: makeUnsafeContainerId(id),
                slots: new Map(Object.entries(container.slots)),
              }
              return [makeUnsafeContainerId(id), cont] as const
            })
          )

          const positionEntries = pipe(
            containerEntries,
            ReadonlyArray.filterMap(([, cont]) =>
              cont.position && cont.worldId
                ? Option.some([getPositionKey(cont.position, cont.worldId), cont.id] as const)
                : Option.none()
            )
          )

          // スナップショットの復元
          const snapshotEntries = pipe(
            validated.snapshots ? Object.entries(validated.snapshots) : [],
            ReadonlyArray.map(([id, snapshot]) => {
              const snap: ContainerSnapshot = {
                ...snapshot,
                id,
                containerId: makeUnsafeContainerId(snapshot.containerId),
                container: {
                  ...snapshot.container,
                  id: makeUnsafeContainerId(snapshot.container.id),
                  slots: new Map(Object.entries(snapshot.container.slots)),
                },
              }
              return [id, snap] as const
            })
          )

          return { containerEntries, positionEntries, snapshotEntries }
        })

        // キャッシュへの保存
        yield* pipe(
          Option.fromNullable(result),
          Option.match({
            onNone: () => Effect.void,
            onSome: ({ containerEntries, positionEntries, snapshotEntries }) =>
              Effect.gen(function* () {
                yield* Ref.set(containerCache, HashMap.fromIterable(containerEntries))
                yield* Ref.set(positionIndex, HashMap.fromIterable(positionEntries))
                yield* Ref.set(snapshotCache, HashMap.fromIterable(snapshotEntries))
              }),
          })
        )
      })

      const saveToStorage = Effect.gen(function* () {
        // IndexedDBチェック - Effect.whenで早期エラー返却
        yield* Effect.when(config.indexedDBEnabled && typeof window !== 'undefined' && window.indexedDB, () =>
          Effect.fail(createRepositoryError('saveToStorage', 'IndexedDB implementation not yet available'))
        )

        // キャッシュデータの取得
        const containers = yield* Ref.get(containerCache)
        const snapshots = yield* Ref.get(snapshotCache)
        const currentTime = yield* Clock.currentTimeMillis

        // LocalStorageへの保存処理
        yield* Effect.try({
          try: () => {
            // Map を Object に変換してシリアライズ可能にする
            const containersObj = pipe(
              HashMap.toEntries(containers),
              ReadonlyArray.reduce({} as Record<string, unknown>, (acc, [id, container]) => ({
                ...acc,
                [id]: {
                  ...container,
                  slots: Object.fromEntries(container.slots),
                },
              }))
            )

            const snapshotsObj = pipe(
              HashMap.toEntries(snapshots),
              ReadonlyArray.reduce({} as Record<string, unknown>, (acc, [id, snapshot]) => ({
                ...acc,
                [id]: {
                  ...snapshot,
                  container: {
                    ...snapshot.container,
                    slots: Object.fromEntries(snapshot.container.slots),
                  },
                },
              }))
            )

            const data = JSON.stringify({
              containers: containersObj,
              snapshots: snapshotsObj,
              version: 1,
              lastSaved: currentTime,
            })

            localStorage.setItem(config.storageKey, data)
          },
          catch: (error) => createStorageError('localStorage', 'save', `Failed to save data: ${error}`),
        })

        yield* Ref.set(isDirty, false)
      })

      // 初期化時にデータをロード
      yield* loadFromStorage

      return ContainerRepository.of({
        save: (container: Container) =>
          Effect.gen(function* () {
            yield* Ref.update(containerCache, (cache) => HashMap.set(cache, container.id, container))

            // 位置インデックスも更新
            yield* Effect.when(container.position !== undefined && container.worldId !== undefined, () =>
              Effect.gen(function* () {
                const positionKey = getPositionKey(container.position!, container.worldId!)
                yield* Ref.update(positionIndex, (index) => HashMap.set(index, positionKey, container.id))
              })
            )

            yield* Ref.set(isDirty, true)
          }),

        findById: (id: ContainerId) =>
          Effect.gen(function* () {
            const cache = yield* Ref.get(containerCache)
            return HashMap.get(cache, id)
          }),

        findByPosition: (position: WorldPosition, worldId: string) =>
          Effect.gen(function* () {
            const index = yield* Ref.get(positionIndex)
            const positionKey = getPositionKey(position, worldId)
            const containerIdOption = HashMap.get(index, positionKey)

            return yield* pipe(
              containerIdOption,
              Option.match({
                onNone: () => Effect.succeed(Option.none()),
                onSome: (containerId) =>
                  Effect.gen(function* () {
                    const cache = yield* Ref.get(containerCache)
                    return HashMap.get(cache, containerId)
                  }),
              })
            )
          }),

        findByType: (type: ContainerType) =>
          Effect.gen(function* () {
            const cache = yield* Ref.get(containerCache)
            const containers = Array.from(HashMap.values(cache))
            return containers.filter((container) => container.type === type)
          }),

        findAccessibleByPlayer: (playerId: PlayerId) =>
          Effect.gen(function* () {
            const cache = yield* Ref.get(containerCache)
            const containers = Array.from(HashMap.values(cache))

            return pipe(
              containers,
              ReadonlyArray.filter(
                (container) =>
                  container.permissions === undefined ||
                  container.permissions.public ||
                  container.permissions.owner === playerId ||
                  (container.permissions.allowedPlayers?.includes(playerId) ?? false)
              )
            )
          }),

        findInRange: (minPosition: WorldPosition, maxPosition: WorldPosition, worldId: string) =>
          Effect.gen(function* () {
            const cache = yield* Ref.get(containerCache)
            const containers = Array.from(HashMap.values(cache))

            return pipe(
              containers,
              ReadonlyArray.filter(
                (container) =>
                  container.position !== undefined &&
                  container.worldId === worldId &&
                  isInRange(container.position, minPosition, maxPosition)
              )
            )
          }),

        findAll: () =>
          Effect.gen(function* () {
            const cache = yield* Ref.get(containerCache)
            return Array.from(HashMap.values(cache))
          }),

        delete: (id: ContainerId) =>
          Effect.gen(function* () {
            const cache = yield* Ref.get(containerCache)
            const containerOption = HashMap.get(cache, id)

            yield* Ref.update(containerCache, (cache) => HashMap.remove(cache, id))

            // 位置インデックスからも削除
            yield* pipe(
              containerOption,
              Option.match({
                onNone: () => Effect.void,
                onSome: (container) =>
                  Effect.when(container.position !== undefined && container.worldId !== undefined, () =>
                    Effect.gen(function* () {
                      const positionKey = getPositionKey(container.position!, container.worldId!)
                      yield* Ref.update(positionIndex, (index) => HashMap.remove(index, positionKey))
                    })
                  ),
              })
            )

            yield* Ref.set(isDirty, true)
          }),

        deleteByPosition: (position: WorldPosition, worldId: string) =>
          Effect.gen(function* () {
            const index = yield* Ref.get(positionIndex)
            const positionKey = getPositionKey(position, worldId)
            const containerIdOption = HashMap.get(index, positionKey)

            yield* pipe(
              containerIdOption,
              Option.match({
                onNone: () => Effect.void,
                onSome: (containerId) =>
                  Effect.gen(function* () {
                    yield* Ref.update(containerCache, (cache) => HashMap.remove(cache, containerId))
                    yield* Ref.update(positionIndex, (index) => HashMap.remove(index, positionKey))
                  }),
              })
            )

            yield* Ref.set(isDirty, true)
          }),

        exists: (id: ContainerId) =>
          Effect.gen(function* () {
            const cache = yield* Ref.get(containerCache)
            return HashMap.has(cache, id)
          }),

        count: () =>
          Effect.gen(function* () {
            const cache = yield* Ref.get(containerCache)
            return HashMap.size(cache)
          }),

        saveMany: (containers: ReadonlyArray<Container>) =>
          Effect.gen(function* () {
            yield* Ref.update(containerCache, (cache) =>
              pipe(
                containers,
                ReadonlyArray.reduce(cache, (acc, container) => HashMap.set(acc, container.id, container))
              )
            )

            // 位置インデックスも一括更新
            yield* Ref.update(positionIndex, (index) =>
              pipe(
                containers,
                ReadonlyArray.reduce(index, (acc, container) =>
                  container.position !== undefined && container.worldId !== undefined
                    ? HashMap.set(acc, getPositionKey(container.position, container.worldId), container.id)
                    : acc
                )
              )
            )

            yield* Ref.set(isDirty, true)
          }),

        findByQuery: (query: ContainerQuery) =>
          Effect.gen(function* () {
            const cache = yield* Ref.get(containerCache)
            const containers = Array.from(HashMap.values(cache))

            return pipe(
              containers,
              // タイプフィルター
              ReadonlyArray.filter((c) => !query.types || query.types.includes(c.type)),
              // 容量フィルター（最小）
              ReadonlyArray.filter((c) => query.minCapacity === undefined || c.capacity >= query.minCapacity),
              // 容量フィルター（最大）
              ReadonlyArray.filter((c) => query.maxCapacity === undefined || c.capacity <= query.maxCapacity),
              // ワールドフィルター
              ReadonlyArray.filter((c) => !query.worldId || c.worldId === query.worldId),
              // 範囲フィルター
              ReadonlyArray.filter((c) => {
                if (!query.withinRange || !c.position) return true
                const { center, radius } = query.withinRange
                const distance = Math.sqrt(
                  Math.pow(c.position.x - center.x, 2) +
                    Math.pow(c.position.y - center.y, 2) +
                    Math.pow(c.position.z - center.z, 2)
                )
                return distance <= radius
              }),
              // アクセス権フィルター
              ReadonlyArray.filter((c) => {
                if (!query.accessibleToPlayer) return true
                if (!c.permissions) return true
                return (
                  c.permissions.public ||
                  c.permissions.owner === query.accessibleToPlayer ||
                  (c.permissions.allowedPlayers?.includes(query.accessibleToPlayer) ?? false)
                )
              }),
              // 空ではないコンテナフィルター
              ReadonlyArray.filter((c) => query.notEmpty !== true || c.slots.size > 0)
            )
          }),

        createSnapshot: (containerId: ContainerId, snapshotName: string) =>
          Effect.gen(function* () {
            const cache = yield* Ref.get(containerCache)
            const containerOption = HashMap.get(cache, containerId)

            return yield* pipe(
              containerOption,
              Option.match({
                onNone: () => Effect.fail(createContainerNotFoundError(containerId)),
                onSome: (container) =>
                  Effect.gen(function* () {
                    const timestamp = yield* Clock.currentTimeMillis
                    const randomPart = Math.random().toString(36).substr(2, 9)
                    const snapshotId = `container-snapshot-${timestamp}-${randomPart}`
                    const snapshot: ContainerSnapshot = {
                      id: snapshotId,
                      name: snapshotName,
                      containerId,
                      container: structuredClone(container),
                      createdAt: timestamp,
                    }

                    yield* Ref.update(snapshotCache, (cache) => HashMap.set(cache, snapshot.id, snapshot))
                    yield* Ref.set(isDirty, true)

                    return snapshot
                  }),
              })
            )
          }),

        restoreFromSnapshot: (snapshotId: string) =>
          Effect.gen(function* () {
            const snapshots = yield* Ref.get(snapshotCache)
            const snapshotOption = HashMap.get(snapshots, snapshotId)

            yield* pipe(
              snapshotOption,
              Option.match({
                onNone: () =>
                  Effect.fail(createRepositoryError('restoreFromSnapshot', `Snapshot not found: ${snapshotId}`)),
                onSome: (snapshot) =>
                  Effect.gen(function* () {
                    const restoredContainer: Container = {
                      ...snapshot.container,
                      lastAccessed: yield* Clock.currentTimeMillis,
                      version: snapshot.container.version + 1,
                    }

                    yield* Ref.update(containerCache, (cache) =>
                      HashMap.set(cache, snapshot.containerId, restoredContainer)
                    )

                    // 位置インデックスも更新
                    yield* Effect.when(
                      restoredContainer.position !== undefined && restoredContainer.worldId !== undefined,
                      () =>
                        Effect.gen(function* () {
                          const positionKey = getPositionKey(restoredContainer.position!, restoredContainer.worldId!)
                          yield* Ref.update(positionIndex, (index) =>
                            HashMap.set(index, positionKey, restoredContainer.id)
                          )
                        })
                    )

                    yield* Ref.set(isDirty, true)
                  }),
              })
            )
          }),

        updatePermissions: (containerId: ContainerId, permissions: Container['permissions']) =>
          Effect.gen(function* () {
            const cache = yield* Ref.get(containerCache)
            const containerOption = HashMap.get(cache, containerId)

            yield* pipe(
              containerOption,
              Option.match({
                onNone: () => Effect.fail(createContainerNotFoundError(containerId)),
                onSome: (container) =>
                  Effect.gen(function* () {
                    const updatedContainer: Container = {
                      ...container,
                      permissions,
                      lastAccessed: yield* Clock.currentTimeMillis,
                      version: container.version + 1,
                    }

                    yield* Ref.update(containerCache, (cache) => HashMap.set(cache, containerId, updatedContainer))
                    yield* Ref.set(isDirty, true)
                  }),
              })
            )
          }),

        initialize: () =>
          Effect.gen(function* () {
            yield* loadFromStorage
          }),

        cleanup: () =>
          Effect.gen(function* () {
            const dirty = yield* Ref.get(isDirty)
            yield* Effect.when(dirty, () => saveToStorage)
          }),
      })
    })
  )

/**
 * デフォルト設定での永続化レイヤー
 */
export const ContainerRepositoryPersistentDefault = ContainerRepositoryPersistent(DefaultContainerPersistentConfig)

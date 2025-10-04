import { Effect, HashMap, Layer, Option, Ref } from 'effect'
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
import { ContainerRepository } from './interface'

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
      const loadFromStorage = Effect.gen(function* () {
        try {
          if (config.indexedDBEnabled && typeof window !== 'undefined' && window.indexedDB) {
            // IndexedDB実装（ブラウザ環境）
            yield* Effect.fail(createRepositoryError('loadFromStorage', 'IndexedDB implementation not yet available'))
          } else {
            // LocalStorage fallback
            const data = localStorage.getItem(config.storageKey)
            if (data) {
              const parsed = JSON.parse(data)

              if (parsed.containers) {
                const containers = new Map<ContainerId, Container>()
                const positions = new Map<string, ContainerId>()

                Object.entries(parsed.containers).forEach(([id, container]) => {
                  const cont = container as Container
                  // Map の復元
                  cont.slots = new Map(Object.entries(cont.slots || {}))
                  containers.set(id as ContainerId, cont)

                  // 位置インデックス復元
                  if (cont.position && cont.worldId) {
                    const positionKey = getPositionKey(cont.position, cont.worldId)
                    positions.set(positionKey, cont.id)
                  }
                })

                yield* Ref.set(containerCache, HashMap.fromIterable(containers))
                yield* Ref.set(positionIndex, HashMap.fromIterable(positions))
              }

              if (parsed.snapshots) {
                const snapshots = new Map<string, ContainerSnapshot>()
                Object.entries(parsed.snapshots).forEach(([id, snapshot]) => {
                  const snap = snapshot as ContainerSnapshot
                  // スナップショット内のContainerのMap復元
                  if (snap.container.slots) {
                    snap.container.slots = new Map(Object.entries(snap.container.slots))
                  }
                  snapshots.set(id, snap)
                })
                yield* Ref.set(snapshotCache, HashMap.fromIterable(snapshots))
              }
            }
          }
        } catch (error) {
          yield* Effect.fail(createStorageError('localStorage', 'load', `Failed to load data: ${error}`))
        }
      })

      const saveToStorage = Effect.gen(function* () {
        try {
          if (config.indexedDBEnabled && typeof window !== 'undefined' && window.indexedDB) {
            // IndexedDB実装（ブラウザ環境）
            yield* Effect.fail(createRepositoryError('saveToStorage', 'IndexedDB implementation not yet available'))
          } else {
            // LocalStorage fallback
            const containers = yield* Ref.get(containerCache)
            const snapshots = yield* Ref.get(snapshotCache)

            // Map を Object に変換してシリアライズ可能にする
            const containersObj: Record<string, any> = {}
            HashMap.forEach(containers, (container, id) => {
              containersObj[id] = {
                ...container,
                slots: Object.fromEntries(container.slots),
              }
            })

            const snapshotsObj: Record<string, any> = {}
            HashMap.forEach(snapshots, (snapshot, id) => {
              snapshotsObj[id] = {
                ...snapshot,
                container: {
                  ...snapshot.container,
                  slots: Object.fromEntries(snapshot.container.slots),
                },
              }
            })

            const data = JSON.stringify({
              containers: containersObj,
              snapshots: snapshotsObj,
              version: 1,
              lastSaved: Date.now(),
            })

            localStorage.setItem(config.storageKey, data)
            yield* Ref.set(isDirty, false)
          }
        } catch (error) {
          yield* Effect.fail(createStorageError('localStorage', 'save', `Failed to save data: ${error}`))
        }
      })

      // 初期化時にデータをロード
      yield* loadFromStorage

      return ContainerRepository.of({
        save: (container: Container) =>
          Effect.gen(function* () {
            yield* Ref.update(containerCache, (cache) => HashMap.set(cache, container.id, container))

            // 位置インデックスも更新
            if (container.position && container.worldId) {
              const positionKey = getPositionKey(container.position, container.worldId)
              yield* Ref.update(positionIndex, (index) => HashMap.set(index, positionKey, container.id))
            }

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

            return containers.filter((container) => {
              if (!container.permissions) return true

              if (container.permissions.public) return true
              if (container.permissions.owner === playerId) return true
              if (container.permissions.allowedPlayers?.includes(playerId)) return true

              return false
            })
          }),

        findInRange: (minPosition: WorldPosition, maxPosition: WorldPosition, worldId: string) =>
          Effect.gen(function* () {
            const cache = yield* Ref.get(containerCache)
            const containers = Array.from(HashMap.values(cache))

            return containers.filter((container) => {
              if (!container.position || container.worldId !== worldId) return false
              return isInRange(container.position, minPosition, maxPosition)
            })
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
                  Effect.gen(function* () {
                    if (container.position && container.worldId) {
                      const positionKey = getPositionKey(container.position, container.worldId)
                      yield* Ref.update(positionIndex, (index) => HashMap.remove(index, positionKey))
                    }
                  }),
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
            yield* Ref.update(containerCache, (cache) => {
              let updatedCache = cache
              containers.forEach((container) => {
                updatedCache = HashMap.set(updatedCache, container.id, container)
              })
              return updatedCache
            })

            // 位置インデックスも一括更新
            yield* Ref.update(positionIndex, (index) => {
              let updatedIndex = index
              containers.forEach((container) => {
                if (container.position && container.worldId) {
                  const positionKey = getPositionKey(container.position, container.worldId)
                  updatedIndex = HashMap.set(updatedIndex, positionKey, container.id)
                }
              })
              return updatedIndex
            })

            yield* Ref.set(isDirty, true)
          }),

        findByQuery: (query: ContainerQuery) =>
          Effect.gen(function* () {
            const cache = yield* Ref.get(containerCache)
            const containers = Array.from(HashMap.values(cache))

            return containers.filter((container) => {
              // タイプフィルター
              if (query.types && !query.types.includes(container.type)) {
                return false
              }

              // 容量フィルター
              if (query.minCapacity !== undefined && container.capacity < query.minCapacity) {
                return false
              }
              if (query.maxCapacity !== undefined && container.capacity > query.maxCapacity) {
                return false
              }

              // ワールドフィルター
              if (query.worldId && container.worldId !== query.worldId) {
                return false
              }

              // 範囲フィルター
              if (query.withinRange && container.position) {
                const { center, radius } = query.withinRange
                const distance = Math.sqrt(
                  Math.pow(container.position.x - center.x, 2) +
                    Math.pow(container.position.y - center.y, 2) +
                    Math.pow(container.position.z - center.z, 2)
                )
                if (distance > radius) return false
              }

              // アクセス権フィルター
              if (query.accessibleToPlayer) {
                if (!container.permissions) return true

                const hasAccess =
                  container.permissions.public ||
                  container.permissions.owner === query.accessibleToPlayer ||
                  container.permissions.allowedPlayers?.includes(query.accessibleToPlayer)

                if (!hasAccess) return false
              }

              // 空ではないコンテナフィルター
              if (query.notEmpty === true && container.slots.size === 0) {
                return false
              }

              return true
            })
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
                    const snapshotId = `container-snapshot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
                    const snapshot: ContainerSnapshot = {
                      id: snapshotId,
                      name: snapshotName,
                      containerId,
                      container: structuredClone(container),
                      createdAt: Date.now(),
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
                      lastAccessed: Date.now(),
                      version: snapshot.container.version + 1,
                    }

                    yield* Ref.update(containerCache, (cache) =>
                      HashMap.set(cache, snapshot.containerId, restoredContainer)
                    )

                    // 位置インデックスも更新
                    if (restoredContainer.position && restoredContainer.worldId) {
                      const positionKey = getPositionKey(restoredContainer.position, restoredContainer.worldId)
                      yield* Ref.update(positionIndex, (index) => HashMap.set(index, positionKey, restoredContainer.id))
                    }

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
                      lastAccessed: Date.now(),
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
            if (dirty) {
              yield* saveToStorage
            }
          }),
      })
    })
  )

/**
 * デフォルト設定での永続化レイヤー
 */
export const ContainerRepositoryPersistentDefault = ContainerRepositoryPersistent(DefaultContainerPersistentConfig)

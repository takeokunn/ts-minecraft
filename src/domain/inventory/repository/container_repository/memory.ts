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
import { createContainerNotFoundError, createRepositoryError } from '../types'
import { ContainerRepository } from './index'

/**
 * ContainerRepository Memory Implementation
 *
 * インメモリ実装。テスト・開発用途向け。
 * 高速だが永続化されないため、アプリケーション再起動で消失する。
 */
export const ContainerRepositoryMemory = Layer.effect(
  ContainerRepository,
  Effect.gen(function* () {
    // コンテナストア
    const containerStore = yield* Ref.make(HashMap.empty<ContainerId, Container>())

    // 位置インデックス（高速な位置検索のため）
    const positionIndex = yield* Ref.make(HashMap.empty<string, ContainerId>())

    // スナップショットストア
    const snapshotStore = yield* Ref.make(HashMap.empty<string, ContainerSnapshot>())

    // スナップショットカウンター
    const snapshotCounter = yield* Ref.make(0)

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

    return ContainerRepository.of({
      save: (container: Container) =>
        Effect.gen(function* () {
          yield* Ref.update(containerStore, (store) => HashMap.set(store, container.id, container))

          // 位置インデックスも更新
          if (container.position && container.worldId) {
            const positionKey = getPositionKey(container.position, container.worldId)
            yield* Ref.update(positionIndex, (index) => HashMap.set(index, positionKey, container.id))
          }
        }),

      findById: (id: ContainerId) =>
        Effect.gen(function* () {
          const store = yield* Ref.get(containerStore)
          return HashMap.get(store, id)
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
                  const store = yield* Ref.get(containerStore)
                  return HashMap.get(store, containerId)
                }),
            })
          )
        }),

      findByType: (type: ContainerType) =>
        Effect.gen(function* () {
          const store = yield* Ref.get(containerStore)
          const containers = Array.from(HashMap.values(store))
          return containers.filter((container) => container.type === type)
        }),

      findAccessibleByPlayer: (playerId: PlayerId) =>
        Effect.gen(function* () {
          const store = yield* Ref.get(containerStore)
          const containers = Array.from(HashMap.values(store))

          return containers.filter((container) => {
            if (!container.permissions) return true // パーミッション未設定は全員アクセス可能

            // パブリックアクセス
            if (container.permissions.public) return true

            // 所有者
            if (container.permissions.owner === playerId) return true

            // 許可されたプレイヤー
            if (container.permissions.allowedPlayers?.includes(playerId)) return true

            return false
          })
        }),

      findInRange: (minPosition: WorldPosition, maxPosition: WorldPosition, worldId: string) =>
        Effect.gen(function* () {
          const store = yield* Ref.get(containerStore)
          const containers = Array.from(HashMap.values(store))

          return containers.filter((container) => {
            if (!container.position || container.worldId !== worldId) return false
            return isInRange(container.position, minPosition, maxPosition)
          })
        }),

      findAll: () =>
        Effect.gen(function* () {
          const store = yield* Ref.get(containerStore)
          return Array.from(HashMap.values(store))
        }),

      delete: (id: ContainerId) =>
        Effect.gen(function* () {
          const store = yield* Ref.get(containerStore)
          const containerOption = HashMap.get(store, id)

          yield* Ref.update(containerStore, (store) => HashMap.remove(store, id))

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
                  yield* Ref.update(containerStore, (store) => HashMap.remove(store, containerId))
                  yield* Ref.update(positionIndex, (index) => HashMap.remove(index, positionKey))
                }),
            })
          )
        }),

      exists: (id: ContainerId) =>
        Effect.gen(function* () {
          const store = yield* Ref.get(containerStore)
          return HashMap.has(store, id)
        }),

      count: () =>
        Effect.gen(function* () {
          const store = yield* Ref.get(containerStore)
          return HashMap.size(store)
        }),

      saveMany: (containers: ReadonlyArray<Container>) =>
        Effect.gen(function* () {
          yield* Ref.update(containerStore, (store) => {
            let updatedStore = store
            containers.forEach((container) => {
              updatedStore = HashMap.set(updatedStore, container.id, container)
            })
            return updatedStore
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
        }),

      findByQuery: (query: ContainerQuery) =>
        Effect.gen(function* () {
          const store = yield* Ref.get(containerStore)
          const containers = Array.from(HashMap.values(store))

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
          const store = yield* Ref.get(containerStore)
          const containerOption = HashMap.get(store, containerId)

          return yield* pipe(
            containerOption,
            Option.match({
              onNone: () => Effect.fail(createContainerNotFoundError(containerId)),
              onSome: (container) =>
                Effect.gen(function* () {
                  const snapshotId = yield* Ref.updateAndGet(snapshotCounter, (n) => n + 1)
                  const snapshot: ContainerSnapshot = {
                    id: `container-snapshot-${snapshotId}`,
                    name: snapshotName,
                    containerId,
                    container: structuredClone(container),
                    createdAt: yield* Clock.currentTimeMillis,
                  }

                  yield* Ref.update(snapshotStore, (store) => HashMap.set(store, snapshot.id, snapshot))

                  return snapshot
                }),
            })
          )
        }),

      restoreFromSnapshot: (snapshotId: string) =>
        Effect.gen(function* () {
          const snapshots = yield* Ref.get(snapshotStore)
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

                  yield* Ref.update(containerStore, (store) =>
                    HashMap.set(store, snapshot.containerId, restoredContainer)
                  )

                  // 位置インデックスも更新
                  if (restoredContainer.position && restoredContainer.worldId) {
                    const positionKey = getPositionKey(restoredContainer.position, restoredContainer.worldId)
                    yield* Ref.update(positionIndex, (index) => HashMap.set(index, positionKey, restoredContainer.id))
                  }
                }),
            })
          )
        }),

      updatePermissions: (containerId: ContainerId, permissions: Container['permissions']) =>
        Effect.gen(function* () {
          const store = yield* Ref.get(containerStore)
          const containerOption = HashMap.get(store, containerId)

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

                  yield* Ref.update(containerStore, (store) => HashMap.set(store, containerId, updatedContainer))
                }),
            })
          )
        }),

      initialize: () => Effect.void,

      cleanup: () => Effect.void,
    })
  })
)

import { Effect, HashMap, Layer, Match, Option, ReadonlyArray, Ref, pipe } from 'effect'
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

    const hasPlayerAccess = (container: Container, playerId: PlayerId): boolean =>
      pipe(
        Option.fromNullable(container.permissions),
        Option.match({
          onNone: () => true,
          onSome: (permissions) => {
            const allowedPlayers = pipe(
              Option.fromNullable(permissions.allowedPlayers),
              Option.match({
                onNone: () => false,
                onSome: (players) => players.includes(playerId),
              })
            )

            return permissions.public || permissions.owner === playerId || allowedPlayers
          },
        })
      )

    const containerMatchesRange = (
      container: Container,
      minPosition: WorldPosition,
      maxPosition: WorldPosition,
      worldId: string
    ): boolean =>
      pipe(
        Option.fromNullable(container.position),
        Option.match({
          onNone: () => false,
          onSome: (position) =>
            pipe(
              Option.fromNullable(container.worldId),
              Option.match({
                onNone: () => false,
                onSome: (id) => id === worldId && isInRange(position, minPosition, maxPosition),
              })
            ),
        })
      )

    return ContainerRepository.of({
      save: (container: Container) =>
        Effect.gen(function* () {
          yield* Ref.update(containerStore, (store) => HashMap.set(store, container.id, container))

          // 位置インデックスも更新
          yield* Effect.when(container.position && container.worldId, () =>
            Effect.gen(function* () {
              const positionKey = getPositionKey(container.position!, container.worldId!)
              yield* Ref.update(positionIndex, (index) => HashMap.set(index, positionKey, container.id))
            })
          )
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

          return pipe(containers, ReadonlyArray.filter((container) => hasPlayerAccess(container, playerId)))
        }),

      findInRange: (minPosition: WorldPosition, maxPosition: WorldPosition, worldId: string) =>
        Effect.gen(function* () {
          const store = yield* Ref.get(containerStore)
          const containers = Array.from(HashMap.values(store))

          return pipe(
            containers,
            ReadonlyArray.filter((container) => containerMatchesRange(container, minPosition, maxPosition, worldId))
          )
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
                Effect.when(container.position && container.worldId, () =>
                  Effect.gen(function* () {
                    const positionKey = getPositionKey(container.position!, container.worldId!)
                    yield* Ref.update(positionIndex, (index) => HashMap.remove(index, positionKey))
                  })
                ),
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
          yield* Ref.update(positionIndex, (index) =>
            pipe(
              containers,
              ReadonlyArray.reduce(index, (updatedIndex, container) =>
                pipe(
                  Option.Do,
                  Option.bind('position', () => Option.fromNullable(container.position)),
                  Option.bind('worldId', () => Option.fromNullable(container.worldId)),
                  Option.map(({ position, worldId }) =>
                    HashMap.set(updatedIndex, getPositionKey(position, worldId), container.id)
                  ),
                  Option.getOrElse(() => updatedIndex)
                )
              )
            )
          )
        }),

      findByQuery: (query: ContainerQuery) =>
        Effect.gen(function* () {
          const store = yield* Ref.get(containerStore)
          const containers = Array.from(HashMap.values(store))

          return pipe(
            containers,
            ReadonlyArray.filter((container) => {
              const matchesType = pipe(
                Option.fromNullable(query.types),
                Option.match({
                  onNone: () => true,
                  onSome: (types) => types.includes(container.type),
                })
              )

              const matchesMinCapacity = pipe(
                Option.fromNullable(query.minCapacity),
                Option.match({
                  onNone: () => true,
                  onSome: (min) => container.capacity >= min,
                })
              )

              const matchesMaxCapacity = pipe(
                Option.fromNullable(query.maxCapacity),
                Option.match({
                  onNone: () => true,
                  onSome: (max) => container.capacity <= max,
                })
              )

              const matchesWorld = pipe(
                Option.fromNullable(query.worldId),
                Option.match({
                  onNone: () => true,
                  onSome: (id) => container.worldId === id,
                })
              )

              const matchesRange = pipe(
                Option.fromNullable(query.withinRange),
                Option.match({
                  onNone: () => true,
                  onSome: ({ center, radius }) =>
                    pipe(
                      Option.fromNullable(container.position),
                      Option.match({
                        onNone: () => false,
                        onSome: (position) => {
                          const distance = Math.sqrt(
                            Math.pow(position.x - center.x, 2) +
                              Math.pow(position.y - center.y, 2) +
                              Math.pow(position.z - center.z, 2)
                          )
                          return distance <= radius
                        },
                      })
                    ),
                })
              )

              const matchesAccessibility = pipe(
                Option.fromNullable(query.accessibleToPlayer),
                Option.match({
                  onNone: () => true,
                  onSome: (requestedPlayerId) => hasPlayerAccess(container, requestedPlayerId),
                })
              )

              const matchesNotEmpty = pipe(
                Match.value(query.notEmpty),
                Match.when(true, () => container.slots.size > 0),
                Match.orElse(() => true)
              )

              return (
                matchesType &&
                matchesMinCapacity &&
                matchesMaxCapacity &&
                matchesWorld &&
                matchesRange &&
                matchesAccessibility &&
                matchesNotEmpty
              )
            })
          )
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
                  yield* Effect.when(restoredContainer.position && restoredContainer.worldId, () =>
                    Effect.gen(function* () {
                      const positionKey = getPositionKey(restoredContainer.position!, restoredContainer.worldId!)
                      yield* Ref.update(positionIndex, (index) => HashMap.set(index, positionKey, restoredContainer.id))
                    })
                  )
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

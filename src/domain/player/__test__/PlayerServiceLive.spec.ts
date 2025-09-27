import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { it as effectIt } from '@effect/vitest'
import { Effect, Layer, Option, Either, pipe, TestContext, Duration, Match } from 'effect'
import { PlayerServiceLive } from '../PlayerServiceLive'
import { PlayerService } from '../PlayerService'
import { EntityManagerLayer, EntityManager } from '../../../infrastructure/ecs/EntityManager'
import { EntityPoolLayer } from '../../../infrastructure/ecs/Entity'
import { SystemRegistryServiceLive } from '../../../infrastructure/ecs/SystemRegistry'
import { BrandedTypes, type ComponentTypeName } from '../../../shared/types/branded'
import { SpatialBrands } from '../../../shared/types/spatial-brands'
import {
  createPlayerError,
  type PlayerPosition,
  type PlayerRotation,
  type PlayerState,
  DEFAULT_PLAYER_CONFIG,
} from '../PlayerService'

/**
 * PlayerService Integration Tests
 *
 * ECS統合、サービス操作、パフォーマンステストの包括的なテスト
 * - PlayerServiceLive の全操作テスト
 * - ECS EntityManager との統合テスト
 * - エラーハンドリングとリカバリテスト
 * - パフォーマンスと並行処理テスト
 * - リソース管理とメモリリークテスト
 */

describe('PlayerService Integration Tests', () => {
  // テスト用のレイヤー設定
  const TestDependencies = Layer.mergeAll(EntityPoolLayer, SystemRegistryServiceLive)
  const EntityManagerTestLayer = Layer.provide(EntityManagerLayer, TestDependencies)
  const PlayerServiceTestLayer = Layer.mergeAll(
    Layer.provide(PlayerServiceLive, EntityManagerTestLayer),
    EntityManagerTestLayer
  )

  describe('Player Creation and Destruction', () => {
    effectIt.effect(
      'should create a player with complete configuration',
      () =>
        Effect.gen(function* () {
          const playerService = yield* PlayerService

          const config = {
            playerId: 'integration-test-player-1',
            initialPosition: { x: 10.5, y: 64, z: -20.3 },
            initialRotation: { pitch: Math.PI / 6, yaw: Math.PI / 4, roll: 0 },
            health: 85,
          }

          const entityId = yield* playerService.createPlayer(config)
          expect(typeof entityId).toBe('number')
          expect(entityId).toBeGreaterThanOrEqual(0)

          // プレイヤーが存在することを確認
          const playerId = BrandedTypes.createPlayerId(config.playerId)
          const exists = yield* playerService.playerExists(playerId)
          expect(exists).toBe(true)

          // プレイヤー状態を取得して検証
          const playerState = yield* playerService.getPlayerState(playerId)
          expect(playerState.playerId).toBe(config.playerId)
          expect(playerState.entityId).toBe(entityId)
          expect(playerState.position).toEqual(config.initialPosition)
          expect(playerState.rotation).toEqual(config.initialRotation)
          expect(playerState.health).toBe(config.health)
          expect(playerState.isActive).toBe(true)
          expect(playerState.lastUpdate).toBeGreaterThan(0)
        }).pipe(Effect.provide(PlayerServiceTestLayer)) as any
    )

    effectIt.effect(
      'should create a player with minimal configuration using defaults',
      () =>
        Effect.gen(function* () {
          const playerService = yield* PlayerService

          const config = {
            playerId: 'minimal-test-player',
          }

          const entityId = yield* playerService.createPlayer(config)
          const playerId = BrandedTypes.createPlayerId(config.playerId)
          const playerState = yield* playerService.getPlayerState(playerId)

          // デフォルト値が適用されているか確認
          expect(playerState.position).toEqual(DEFAULT_PLAYER_CONFIG.initialPosition)
          expect(playerState.rotation).toEqual(DEFAULT_PLAYER_CONFIG.initialRotation)
          expect(playerState.health).toBe(DEFAULT_PLAYER_CONFIG.health)
          expect(playerState.isActive).toBe(true)
        }).pipe(Effect.provide(PlayerServiceTestLayer)) as any
    )

    effectIt.effect(
      'should destroy a player and clean up resources',
      () =>
        Effect.gen(function* () {
          const playerService = yield* PlayerService
          const entityManager = yield* EntityManager

          const config = {
            playerId: 'destroy-test-player',
            initialPosition: { x: 0, y: 64, z: 0 },
            health: 100,
          }

          // プレイヤーを作成
          const entityId = yield* playerService.createPlayer(config)
          const playerId = BrandedTypes.createPlayerId(config.playerId)

          // 作成直後の状態確認
          let exists = yield* playerService.playerExists(playerId)
          expect(exists).toBe(true)

          let isEntityAlive = yield* entityManager.isEntityAlive(entityId)
          expect(isEntityAlive).toBe(true)

          // プレイヤーを削除
          yield* playerService.destroyPlayer(playerId)

          // 削除後の状態確認
          exists = yield* playerService.playerExists(playerId)
          expect(exists).toBe(false)

          isEntityAlive = yield* entityManager.isEntityAlive(entityId)
          expect(isEntityAlive).toBe(false)

          // 削除されたプレイヤーの状態取得はエラーになる
          const result = yield* Effect.either(playerService.getPlayerState(playerId))
          expect(Either.isLeft(result)).toBe(true)
        }).pipe(Effect.provide(PlayerServiceTestLayer)) as any
    )

    effectIt.effect(
      'should prevent duplicate player creation',
      () =>
        Effect.gen(function* () {
          const playerService = yield* PlayerService

          const config = {
            playerId: 'duplicate-test-player',
            health: 50,
          }

          // 最初のプレイヤー作成は成功
          const entityId1 = yield* playerService.createPlayer(config)
          expect(typeof entityId1).toBe('number')

          // 同じプレイヤーIDでの作成は失敗
          const result = yield* Effect.either(playerService.createPlayer(config))
          expect(Either.isLeft(result)).toBe(true)
          if (Either.isLeft(result)) {
            expect(result.left.reason).toBe('PLAYER_ALREADY_EXISTS')
            // PlayerErrorの場合のみplayerIdをチェック
            if ('playerId' in result.left) {
              expect(result.left.playerId).toBe(config.playerId)
            }
          }
        }).pipe(Effect.provide(PlayerServiceTestLayer)) as any
    )
  })

  describe('Player State Management', () => {
    effectIt.effect(
      'should update player position',
      () =>
        Effect.gen(function* () {
          const playerService = yield* PlayerService
          const playerId = BrandedTypes.createPlayerId('position-update-test')

          // プレイヤーを作成
          yield* playerService.createPlayer({ playerId })

          const newPosition = { x: 100, y: 128, z: -50 }
          yield* playerService.setPlayerPosition(playerId, newPosition)

          const playerState = yield* playerService.getPlayerState(playerId)
          expect(playerState.position).toEqual(newPosition)
        }).pipe(Effect.provide(PlayerServiceTestLayer)) as any
    )

    effectIt.effect(
      'should update player rotation',
      () =>
        Effect.gen(function* () {
          const playerService = yield* PlayerService
          const playerId = BrandedTypes.createPlayerId('rotation-update-test')

          yield* playerService.createPlayer({ playerId })

          const newRotation = { pitch: Math.PI / 3, yaw: -Math.PI / 2, roll: 0 }
          yield* playerService.setPlayerRotation(playerId, newRotation)

          const playerState = yield* playerService.getPlayerState(playerId)
          expect(playerState.rotation).toEqual(newRotation)
        }).pipe(Effect.provide(PlayerServiceTestLayer)) as any
    )

    effectIt.effect(
      'should update player health',
      () =>
        Effect.gen(function* () {
          const playerService = yield* PlayerService
          const playerId = BrandedTypes.createPlayerId('health-update-test')

          yield* playerService.createPlayer({ playerId })

          const newHealth = 75
          yield* playerService.setPlayerHealth(playerId, newHealth)

          const playerState = yield* playerService.getPlayerState(playerId)
          expect(playerState.health).toBe(newHealth)
        }).pipe(Effect.provide(PlayerServiceTestLayer)) as any
    )

    effectIt.effect(
      'should update player active state',
      () =>
        Effect.gen(function* () {
          const playerService = yield* PlayerService
          const playerId = BrandedTypes.createPlayerId('active-state-test')

          yield* playerService.createPlayer({ playerId })

          // アクティブ状態をfalseに設定
          yield* playerService.setPlayerActive(playerId, false)
          let playerState = yield* playerService.getPlayerState(playerId)
          expect(playerState.isActive).toBe(false)

          // アクティブ状態をtrueに戻す
          yield* playerService.setPlayerActive(playerId, true)
          playerState = yield* playerService.getPlayerState(playerId)
          expect(playerState.isActive).toBe(true)
        }).pipe(Effect.provide(PlayerServiceTestLayer)) as any
    )

    effectIt.effect(
      'should update multiple player properties at once',
      () =>
        Effect.gen(function* () {
          const playerService = yield* PlayerService
          const playerId = BrandedTypes.createPlayerId('bulk-update-test')

          yield* playerService.createPlayer({ playerId })

          const updateData = {
            position: { x: 200, y: 256, z: 100 },
            rotation: { pitch: -Math.PI / 4, yaw: Math.PI, roll: 0 },
            health: 60,
          }

          yield* playerService.updatePlayerState(playerId, updateData)

          const playerState = yield* playerService.getPlayerState(playerId)
          expect(playerState.position).toEqual(updateData.position)
          expect(playerState.rotation).toEqual(updateData.rotation)
          expect(playerState.health).toBe(updateData.health)
        }).pipe(Effect.provide(PlayerServiceTestLayer)) as any
    )
  })

  describe('Error Handling and Validation', () => {
    effectIt.effect(
      'should handle non-existent player operations',
      () =>
        Effect.gen(function* () {
          const playerService = yield* PlayerService
          const nonExistentPlayerId = BrandedTypes.createPlayerId('non-existent-player')

          // 存在しないプレイヤーの状態取得
          const getStateResult = yield* Effect.either(playerService.getPlayerState(nonExistentPlayerId))
          expect(Either.isLeft(getStateResult)).toBe(true)
          if (Either.isLeft(getStateResult)) {
            expect(getStateResult.left.reason).toBe('PLAYER_NOT_FOUND')
          }

          // 存在しないプレイヤーの削除
          const destroyResult = yield* Effect.either(playerService.destroyPlayer(nonExistentPlayerId))
          expect(Either.isLeft(destroyResult)).toBe(true)
          if (Either.isLeft(destroyResult)) {
            expect(destroyResult.left.reason).toBe('PLAYER_NOT_FOUND')
          }

          // 存在しないプレイヤーの更新
          const updateResult = yield* Effect.either(
            playerService.updatePlayerState(nonExistentPlayerId, { health: 50 })
          )
          expect(Either.isLeft(updateResult)).toBe(true)
          if (Either.isLeft(updateResult)) {
            expect(updateResult.left.reason).toBe('PLAYER_NOT_FOUND')
          }
        }).pipe(Effect.provide(PlayerServiceTestLayer)) as any
    )

    effectIt.effect(
      'should validate input data and reject invalid values',
      () =>
        Effect.gen(function* () {
          const playerService = yield* PlayerService

          // 無効なプレイヤー設定
          const invalidConfigs = [
            { playerId: '', health: 50 }, // 空のプレイヤーID
            { playerId: 'valid', health: -10 }, // 負の体力
            { playerId: 'valid', health: 150 }, // 範囲外の体力
            { playerId: 'valid', initialPosition: { x: 'invalid', y: 0, z: 0 } }, // 無効な位置
            { playerId: 'valid', initialRotation: { pitch: Math.PI, yaw: 0, roll: 0 } }, // 範囲外の回転
          ]

          for (const config of invalidConfigs) {
            const result = yield* Effect.either(playerService.createPlayer(config))
            expect(Either.isLeft(result)).toBe(true)
          }

          // 有効なプレイヤーを作成して無効な更新をテスト
          const playerId = BrandedTypes.createPlayerId('validation-test-player')
          yield* playerService.createPlayer({ playerId })

          // 無効な位置更新
          const invalidPositionResult = yield* Effect.either(
            playerService.setPlayerPosition(playerId, { x: 'invalid', y: 0, z: 0 })
          )
          expect(Either.isLeft(invalidPositionResult)).toBe(true)

          // 無効な回転更新
          const invalidRotationResult = yield* Effect.either(
            playerService.setPlayerRotation(playerId, { pitch: Math.PI * 2, yaw: 0, roll: 0 })
          )
          expect(Either.isLeft(invalidRotationResult)).toBe(true)

          // 無効な体力更新
          const invalidHealthResult = yield* Effect.either(playerService.setPlayerHealth(playerId, -50))
          expect(Either.isLeft(invalidHealthResult)).toBe(true)
        }).pipe(Effect.provide(PlayerServiceTestLayer)) as any
    )
  })

  describe('Multi-Player Operations', () => {
    effectIt.effect(
      'should manage multiple players simultaneously',
      () =>
        Effect.gen(function* () {
          const playerService = yield* PlayerService

          // 複数のプレイヤーを作成
          const playerConfigs = Array.from({ length: 10 }, (_, i) => ({
            playerId: `multi-player-${i}`,
            initialPosition: { x: i * 10, y: 64, z: i * -5 },
            health: 80 + i,
          }))

          // 並行してプレイヤーを作成
          const entityIds = yield* Effect.all(
            playerConfigs.map((config) => playerService.createPlayer(config)),
            { concurrency: 'unbounded' }
          )

          expect(entityIds).toHaveLength(10)

          // 全プレイヤーの一覧取得
          const allPlayers = yield* playerService.getAllPlayers()
          expect(allPlayers).toHaveLength(10)

          // 各プレイヤーの状態確認
          for (let i = 0; i < 10; i++) {
            const player = allPlayers.find((p) => p.playerId === `multi-player-${i}`)
            expect(player).toBeDefined()
            if (player) {
              expect(player.position).toEqual({ x: i * 10, y: 64, z: i * -5 })
              expect(player.health).toBe(80 + i)
              expect(player.isActive).toBe(true)
            }
          }
        }).pipe(Effect.provide(PlayerServiceTestLayer)) as any
    )

    effectIt.effect(
      'should get players in range',
      () =>
        Effect.gen(function* () {
          const playerService = yield* PlayerService

          // プレイヤーを異なる位置に配置
          const playerPositions = [
            { playerId: 'center-player', position: { x: 0, y: 0, z: 0 } },
            { playerId: 'close-player-1', position: { x: 5, y: 0, z: 0 } },
            { playerId: 'close-player-2', position: { x: 0, y: 5, z: 0 } },
            { playerId: 'far-player-1', position: { x: 20, y: 0, z: 0 } },
            { playerId: 'far-player-2', position: { x: 0, y: 0, z: 25 } },
          ]

          // プレイヤーを作成
          for (const { playerId, position } of playerPositions) {
            yield* playerService.createPlayer({
              playerId,
              initialPosition: position,
            })
          }

          // 範囲検索テスト（半径10）
          const center: PlayerPosition = SpatialBrands.createVector3D(0, 0, 0)
          const playersInRange = yield* playerService.getPlayersInRange(center, 10)

          expect(playersInRange).toHaveLength(3) // center, close-1, close-2
          const playerIds = playersInRange.map((p) => p.playerId)
          expect(playerIds).toContain('center-player')
          expect(playerIds).toContain('close-player-1')
          expect(playerIds).toContain('close-player-2')
          expect(playerIds).not.toContain('far-player-1')
          expect(playerIds).not.toContain('far-player-2')
        }).pipe(Effect.provide(PlayerServiceTestLayer)) as any
    )

    effectIt.effect(
      'should get player statistics',
      () =>
        Effect.gen(function* () {
          const playerService = yield* PlayerService

          // 複数のプレイヤーを作成（一部は非アクティブ）
          const players = [
            { playerId: 'stats-player-1', health: 100, active: true },
            { playerId: 'stats-player-2', health: 80, active: true },
            { playerId: 'stats-player-3', health: 60, active: false },
            { playerId: 'stats-player-4', health: 40, active: true },
            { playerId: 'stats-player-5', health: 20, active: false },
          ]

          for (const player of players) {
            yield* playerService.createPlayer({
              playerId: player.playerId,
              health: player.health,
            })

            if (!player.active) {
              const playerId = BrandedTypes.createPlayerId(player.playerId)
              yield* playerService.setPlayerActive(playerId, false)
            }
          }

          const stats = yield* playerService.getPlayerStats()

          expect(stats.totalPlayers).toBe(5)
          expect(stats.activePlayers).toBe(3) // stats-player-1, 2, 4
          expect(stats.averageHealth).toBe(60) // (100 + 80 + 60 + 40 + 20) / 5
        }).pipe(Effect.provide(PlayerServiceTestLayer)) as any
    )
  })

  describe('Performance and Concurrency Tests', () => {
    effectIt.effect(
      'should handle high-frequency player operations efficiently',
      () =>
        Effect.gen(function* () {
          const playerService = yield* PlayerService

          // 大量のプレイヤー操作を並行実行
          const operationCount = 100
          const startTime = performance.now()

          // プレイヤー作成
          const createOperations = Array.from({ length: operationCount }, (_, i) =>
            playerService.createPlayer({
              playerId: `perf-player-${i}`,
              initialPosition: { x: i, y: 64, z: 0 },
              health: 50 + (i % 50),
            })
          )

          const entityIds = yield* Effect.all(createOperations, { concurrency: 'unbounded' })
          expect(entityIds).toHaveLength(operationCount)

          // プレイヤー更新操作
          const updateOperations = entityIds.map((_, i) => {
            const playerId = BrandedTypes.createPlayerId(`perf-player-${i}`)
            return playerService.updatePlayerState(playerId, {
              position: { x: i + 100, y: 128, z: i },
              health: 75,
            })
          })

          yield* Effect.all(updateOperations, { concurrency: 'unbounded' })

          const endTime = performance.now()
          const duration = endTime - startTime

          // パフォーマンス要件: 100操作を1.5秒以内で完了（CI環境考慮）
          expect(duration).toBeLessThan(1500)

          // 結果検証
          const allPlayers = yield* playerService.getAllPlayers()
          expect(allPlayers).toHaveLength(operationCount)

          // ランダムサンプリングで検証
          for (let i = 0; i < 10; i++) {
            const randomIndex = Math.floor(Math.random() * operationCount)
            const player = allPlayers.find((p) => p.playerId === `perf-player-${randomIndex}`)
            expect(player).toBeDefined()
            if (player) {
              expect(player.position.x).toBe(randomIndex + 100)
              expect(player.health).toBe(75)
            }
          }
        }).pipe(Effect.provide(PlayerServiceTestLayer)) as any
    )

    effectIt.effect(
      'should handle concurrent player creation and deletion',
      () =>
        Effect.gen(function* () {
          const playerService = yield* PlayerService

          const playerCount = 50

          // 同時にプレイヤーを作成
          const createOperations = Array.from({ length: playerCount }, (_, i) =>
            playerService.createPlayer({
              playerId: `concurrent-player-${i}`,
              health: 100,
            })
          )

          yield* Effect.all(createOperations, { concurrency: 'unbounded' })

          // 作成されたプレイヤー数を確認
          let allPlayers = yield* playerService.getAllPlayers()
          expect(allPlayers).toHaveLength(playerCount)

          // 半分のプレイヤーを並行削除
          const deleteOperations = Array.from({ length: playerCount / 2 }, (_, i) => {
            const playerId = BrandedTypes.createPlayerId(`concurrent-player-${i}`)
            return playerService.destroyPlayer(playerId)
          })

          yield* Effect.all(deleteOperations, { concurrency: 'unbounded' })

          // 削除後のプレイヤー数を確認
          allPlayers = yield* playerService.getAllPlayers()
          expect(allPlayers).toHaveLength(playerCount / 2)

          // 残りのプレイヤーIDが正しいかチェック
          const remainingPlayerIds = allPlayers.map((p) => p.playerId)
          for (let i = playerCount / 2; i < playerCount; i++) {
            expect(remainingPlayerIds).toContain(`concurrent-player-${i}`)
          }
        }).pipe(Effect.provide(PlayerServiceTestLayer)) as any
    )
  })

  describe('ECS Integration Tests', () => {
    effectIt.effect(
      'should properly integrate with EntityManager',
      () =>
        Effect.gen(function* () {
          const playerService = yield* PlayerService
          const entityManager = yield* EntityManager

          const config = {
            playerId: 'ecs-integration-test',
            initialPosition: { x: 42, y: 84, z: -42 },
            health: 90,
          }

          const entityId = yield* playerService.createPlayer(config)

          // EntityManager を直接使用してエンティティを確認
          const isAlive = yield* entityManager.isEntityAlive(entityId)
          expect(isAlive).toBe(true)

          // エンティティのメタデータを確認
          const metadata = yield* entityManager.getEntityMetadata(entityId)
          expect(Option.isSome(metadata)).toBe(true)
          if (Option.isSome(metadata)) {
            expect(metadata.value.name).toBe(`Player-${config.playerId}`)
            expect(metadata.value.tags).toContain('player')
            expect(metadata.value.tags).toContain('entity')
          }

          // コンポーネントの存在確認
          const hasPlayerComponent = yield* entityManager.hasComponent(entityId, 'PlayerComponent' as ComponentTypeName)
          const hasPositionComponent = yield* entityManager.hasComponent(
            entityId,
            'PositionComponent' as ComponentTypeName
          )
          const hasRotationComponent = yield* entityManager.hasComponent(
            entityId,
            'RotationComponent' as ComponentTypeName
          )

          expect(hasPlayerComponent).toBe(true)
          expect(hasPositionComponent).toBe(true)
          expect(hasRotationComponent).toBe(true)

          // コンポーネントの内容確認
          const playerComponent = yield* entityManager.getComponent(entityId, 'PlayerComponent' as ComponentTypeName)
          const positionComponent = yield* entityManager.getComponent(
            entityId,
            'PositionComponent' as ComponentTypeName
          )

          expect(Option.isSome(playerComponent)).toBe(true)
          expect(Option.isSome(positionComponent)).toBe(true)

          if (Option.isSome(positionComponent)) {
            expect(positionComponent.value).toEqual(config.initialPosition)
          }
        }).pipe(Effect.provide(PlayerServiceTestLayer)) as any
    )

    effectIt.effect(
      'should handle ECS errors gracefully',
      () =>
        Effect.gen(function* () {
          const playerService = yield* PlayerService
          const entityManager = yield* EntityManager

          const playerId = BrandedTypes.createPlayerId('ecs-error-test')

          // プレイヤーを作成
          const entityId = yield* playerService.createPlayer({ playerId })

          // EntityManager を使用してエンティティを直接削除（コンポーネントのみ残す状況をシミュレート）
          yield* entityManager.destroyEntity(entityId)

          // プレイヤーサービス側ではまだ存在すると認識している状態で操作
          const exists = yield* playerService.playerExists(playerId)
          expect(exists).toBe(true) // 内部状態では存在

          // しかし、状態取得はECSエラーで失敗する
          const result = yield* Effect.either(playerService.getPlayerState(playerId))
          expect(Either.isLeft(result)).toBe(true)
          if (Either.isLeft(result)) {
            expect(result.left.reason).toBe('COMPONENT_ERROR')
          }
        }).pipe(Effect.provide(PlayerServiceTestLayer)) as any
    )
  })

  describe('Memory Management and Resource Cleanup', () => {
    effectIt.effect(
      'should not leak memory after player deletion',
      () =>
        Effect.gen(function* () {
          const playerService = yield* PlayerService

          const initialStats = yield* playerService.getPlayerStats()
          const initialPlayerCount = initialStats.totalPlayers

          // 大量のプレイヤーを作成・削除
          const cycleCount = 100

          for (let cycle = 0; cycle < 5; cycle++) {
            // プレイヤー作成
            const createOperations = Array.from({ length: cycleCount }, (_, i) =>
              playerService.createPlayer({
                playerId: `memory-test-${cycle}-${i}`,
                health: 50,
              })
            )
            yield* Effect.all(createOperations, { concurrency: 'unbounded' })

            // 全プレイヤーを削除
            const deleteOperations = Array.from({ length: cycleCount }, (_, i) => {
              const playerId = BrandedTypes.createPlayerId(`memory-test-${cycle}-${i}`)
              return playerService.destroyPlayer(playerId)
            })
            yield* Effect.all(deleteOperations, { concurrency: 'unbounded' })
          }

          // 最終的にプレイヤー数が初期状態に戻っていることを確認
          const finalStats = yield* playerService.getPlayerStats()
          expect(finalStats.totalPlayers).toBe(initialPlayerCount)

          // 念のため全プレイヤーリストも確認
          const allPlayers = yield* playerService.getAllPlayers()
          expect(allPlayers).toHaveLength(initialPlayerCount)
        }).pipe(Effect.provide(PlayerServiceTestLayer)) as any
    )
  })

  describe('Edge Cases and Boundary Conditions', () => {
    effectIt.effect(
      'should handle rapid state changes correctly',
      () =>
        Effect.gen(function* () {
          const playerService = yield* PlayerService
          const playerId = BrandedTypes.createPlayerId('rapid-change-test')

          yield* playerService.createPlayer({ playerId })

          // 短時間で大量の状態変更
          const changeOperations = Array.from({ length: 50 }, (_, i) =>
            playerService.updatePlayerState(playerId, {
              position: { x: i, y: 64 + i, z: -i },
              health: 50 + (i % 50),
            })
          )

          yield* Effect.all(changeOperations, { concurrency: 'unbounded' })

          // 最終状態を確認
          const finalState = yield* playerService.getPlayerState(playerId)
          expect(finalState.position.x).toBeGreaterThanOrEqual(0)
          expect(finalState.position.x).toBeLessThan(50)
          expect(finalState.health).toBeGreaterThanOrEqual(50)
          expect(finalState.health).toBeLessThan(100)
        }).pipe(Effect.provide(PlayerServiceTestLayer)) as any
    )

    effectIt.effect(
      'should handle extreme coordinate values',
      () =>
        Effect.gen(function* () {
          const playerService = yield* PlayerService
          const playerId = BrandedTypes.createPlayerId('extreme-coords-test')

          yield* playerService.createPlayer({ playerId })

          const extremePositions = [
            { x: Number.MAX_SAFE_INTEGER, y: Number.MAX_SAFE_INTEGER, z: Number.MAX_SAFE_INTEGER },
            { x: Number.MIN_SAFE_INTEGER, y: Number.MIN_SAFE_INTEGER, z: Number.MIN_SAFE_INTEGER },
            { x: 0, y: 0, z: 0 },
            { x: 1e10, y: -1e10, z: 1e-10 },
          ]

          for (const position of extremePositions) {
            yield* playerService.setPlayerPosition(playerId, position)
            const playerState = yield* playerService.getPlayerState(playerId)
            expect(playerState.position).toEqual(position)
          }
        }).pipe(Effect.provide(PlayerServiceTestLayer)) as any
    )

    effectIt.effect(
      'should maintain consistency under error conditions',
      () =>
        Effect.gen(function* () {
          const playerService = yield* PlayerService

          // 正常なプレイヤーと問題のあるプレイヤーを混在させる
          const goodPlayerId = BrandedTypes.createPlayerId('good-player')
          const problemPlayerId = BrandedTypes.createPlayerId('problem-player')

          yield* playerService.createPlayer({ playerId: 'good-player' })
          yield* playerService.createPlayer({ playerId: 'problem-player' })

          // 正常なプレイヤーは問題なく操作できる
          yield* playerService.setPlayerHealth(goodPlayerId, 75)
          const goodPlayerState = yield* playerService.getPlayerState(goodPlayerId)
          expect(goodPlayerState.health).toBe(75)

          // 問題のあるプレイヤーに無効な操作を試行
          const badResult = yield* Effect.either(playerService.setPlayerHealth(problemPlayerId, -50))
          expect(Either.isLeft(badResult)).toBe(true)

          // 正常なプレイヤーは引き続き操作可能
          yield* playerService.setPlayerHealth(goodPlayerId, 90)
          const updatedGoodPlayerState = yield* playerService.getPlayerState(goodPlayerId)
          expect(updatedGoodPlayerState.health).toBe(90)

          // 全体の統計情報も正確に取得可能
          const stats = yield* playerService.getPlayerStats()
          expect(stats.totalPlayers).toBe(2)
        }).pipe(Effect.provide(PlayerServiceTestLayer)) as any
    )
  })
})

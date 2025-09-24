import { Effect, Layer, Ref, pipe, Option, HashMap, Match, Predicate } from 'effect'
import { PlayerService } from './PlayerService.js'
import { EntityManager } from '../../infrastructure/ecs/EntityManager.js'
import type { EntityId } from '../../infrastructure/ecs/Entity.js'
import type { PlayerId, ComponentTypeName } from '../../shared/types/branded.js'
import { GameBrands, TimeBrands, SpatialBrands } from '../../shared/types/index.js'
import {
  type PlayerConfig,
  type PlayerState,
  type PlayerPosition,
  type PlayerRotation,
  type PlayerUpdateData,
  type PlayerComponent,
  type PositionComponent,
  type RotationComponent,
  PlayerError,
  createPlayerError,
  validatePlayerConfig,
  validatePlayerPosition,
  validatePlayerRotation,
  validatePlayerUpdateData,
  DEFAULT_PLAYER_CONFIG,
} from './PlayerService.js'

/**
 * プレイヤーの内部状態管理
 */
interface PlayerInternalState {
  readonly playerId: PlayerId
  readonly entityId: EntityId
  readonly isActive: boolean
  readonly lastUpdate: number
}

/**
 * PlayerServiceLive - プレイヤーサービスの実装
 *
 * ECS (Entity Component System) との統合:
 * - EntityManager を使用したエンティティ管理
 * - コンポーネントベースのデータ管理
 * - Ref ベースの状態管理
 * - Schema 検証による型安全性
 */
const makePlayerServiceLive = Effect.gen(function* () {
  // Dependencies
  const entityManager = yield* EntityManager

  // Internal state
  const playersRef = yield* Ref.make<HashMap.HashMap<PlayerId, PlayerInternalState>>(HashMap.empty())

  // Component type constants
  const PLAYER_COMPONENT = 'PlayerComponent' as ComponentTypeName
  const POSITION_COMPONENT = 'PositionComponent' as ComponentTypeName
  const ROTATION_COMPONENT = 'RotationComponent' as ComponentTypeName

  // Helper: プレイヤーの内部状態を取得
  const getPlayerInternalState = (playerId: PlayerId): Effect.Effect<PlayerInternalState, PlayerError> =>
    pipe(
      Ref.get(playersRef),
      Effect.flatMap((players) =>
        pipe(
          HashMap.get(players, playerId),
          Option.match({
            onNone: () => Effect.fail(createPlayerError.playerNotFound(playerId)),
            onSome: (state) => Effect.succeed(state),
          })
        )
      )
    )

  // Helper: プレイヤーコンポーネントの作成
  const createPlayerComponent = (playerId: PlayerId, health: number): PlayerComponent => ({
    playerId,
    health: GameBrands.createHealth(health),
    lastUpdate: TimeBrands.createTimestamp(),
  })

  // Helper: 位置コンポーネントの作成
  const createPositionComponent = (position: PlayerPosition): PositionComponent =>
    SpatialBrands.createVector3D(position.x, position.y, position.z)

  // Helper: 回転コンポーネントの作成
  const createRotationComponent = (rotation: PlayerRotation): RotationComponent => ({
    pitch: rotation.pitch,
    yaw: rotation.yaw,
    roll: 0, // デフォルト値
  })

  // Helper: エンティティからプレイヤー状態を構築
  const buildPlayerState = (
    playerId: PlayerId,
    entityId: EntityId,
    isActive: boolean
  ): Effect.Effect<PlayerState, PlayerError> =>
    Effect.gen(function* () {
      // プレイヤーコンポーネントの取得
      const playerComponent = yield* pipe(
        entityManager.getComponent<PlayerComponent>(entityId, PLAYER_COMPONENT),
        Effect.flatMap(
          Option.match({
            onNone: () => Effect.fail(createPlayerError.componentError(playerId, PLAYER_COMPONENT)),
            onSome: (component) => Effect.succeed(component),
          })
        )
      )

      // 位置コンポーネントの取得
      const positionComponent = yield* pipe(
        entityManager.getComponent<PositionComponent>(entityId, POSITION_COMPONENT),
        Effect.flatMap(
          Option.match({
            onNone: () => Effect.fail(createPlayerError.componentError(playerId, POSITION_COMPONENT)),
            onSome: (component) => Effect.succeed(component),
          })
        )
      )

      // 回転コンポーネントの取得
      const rotationComponent = yield* pipe(
        entityManager.getComponent<RotationComponent>(entityId, ROTATION_COMPONENT),
        Effect.flatMap(
          Option.match({
            onNone: () => Effect.fail(createPlayerError.componentError(playerId, ROTATION_COMPONENT)),
            onSome: (component) => Effect.succeed(component),
          })
        )
      )

      return {
        playerId,
        entityId: entityId as number,
        position: SpatialBrands.createVector3D(positionComponent.x, positionComponent.y, positionComponent.z),
        rotation: {
          pitch: rotationComponent.pitch,
          yaw: rotationComponent.yaw,
          roll: rotationComponent.roll || 0, // 既存データのrollが無い場合のフォールバック
        },
        health: playerComponent.health,
        isActive,
        lastUpdate: playerComponent.lastUpdate,
      } satisfies PlayerState
    })

  // プレイヤーの作成
  const createPlayer = (config: unknown) =>
    Effect.gen(function* () {
      // 設定の検証
      const validatedConfig = yield* validatePlayerConfig(config)

      // プレイヤーが既に存在するかチェック
      const players = yield* Ref.get(playersRef)
      yield* pipe(
        HashMap.has(players, validatedConfig.playerId as PlayerId),
        Match.value,
        Match.when(true, () =>
          Effect.fail(createPlayerError.playerAlreadyExists(validatedConfig.playerId as PlayerId))
        ),
        Match.when(false, () => Effect.void),
        Match.exhaustive
      )

      // エンティティの作成
      const entityId = yield* pipe(
        entityManager.createEntity(`Player-${validatedConfig.playerId}`, ['player', 'entity']),
        Effect.mapError((error) => createPlayerError.entityCreationFailed(validatedConfig.playerId as PlayerId, error))
      )

      // デフォルト値の適用
      const position = validatedConfig.initialPosition ?? DEFAULT_PLAYER_CONFIG.initialPosition!
      const rotation = validatedConfig.initialRotation ?? DEFAULT_PLAYER_CONFIG.initialRotation!
      const health = validatedConfig.health ?? DEFAULT_PLAYER_CONFIG.health!

      // コンポーネントの追加
      yield* pipe(
        entityManager.addComponent(
          entityId,
          PLAYER_COMPONENT,
          createPlayerComponent(validatedConfig.playerId as PlayerId, health)
        ),
        Effect.mapError((error) =>
          createPlayerError.componentError(validatedConfig.playerId as PlayerId, PLAYER_COMPONENT, error)
        )
      )

      yield* pipe(
        entityManager.addComponent(entityId, POSITION_COMPONENT, createPositionComponent(position)),
        Effect.mapError((error) =>
          createPlayerError.componentError(validatedConfig.playerId as PlayerId, POSITION_COMPONENT, error)
        )
      )

      yield* pipe(
        entityManager.addComponent(entityId, ROTATION_COMPONENT, createRotationComponent(rotation)),
        Effect.mapError((error) =>
          createPlayerError.componentError(validatedConfig.playerId as PlayerId, ROTATION_COMPONENT, error)
        )
      )

      // 内部状態の更新
      const playerState: PlayerInternalState = {
        playerId: validatedConfig.playerId as PlayerId,
        entityId,
        isActive: true,
        lastUpdate: Date.now(),
      }

      yield* Ref.update(playersRef, (players) =>
        HashMap.set(players, validatedConfig.playerId as PlayerId, playerState)
      )

      yield* Effect.log(`Player created: ${validatedConfig.playerId}`, { entityId, position, rotation, health })

      return entityId
    })

  // プレイヤーの削除
  const destroyPlayer = (playerId: PlayerId) =>
    Effect.gen(function* () {
      // プレイヤーの存在確認
      const playerState = yield* getPlayerInternalState(playerId)

      // エンティティの削除
      yield* pipe(
        entityManager.destroyEntity(playerState.entityId),
        Effect.mapError((error) => createPlayerError.componentError(playerId, 'Entity', error))
      )

      // 内部状態からの削除
      yield* Ref.update(playersRef, (players) => HashMap.remove(players, playerId))

      yield* Effect.log(`Player destroyed: ${playerId}`, { entityId: playerState.entityId })
    })

  // プレイヤー状態の更新
  const updatePlayerState = (playerId: PlayerId, updateData: unknown) =>
    Effect.gen(function* () {
      // 更新データの検証
      const validatedUpdateData = yield* validatePlayerUpdateData(updateData)

      // プレイヤーの存在確認
      const playerState = yield* getPlayerInternalState(playerId)

      // 位置の更新
      yield* pipe(
        Option.fromNullable(validatedUpdateData.position),
        Option.match({
          onNone: () => Effect.void,
          onSome: (position) =>
            pipe(
              entityManager.addComponent(playerState.entityId, POSITION_COMPONENT, createPositionComponent(position)),
              Effect.mapError((error) => createPlayerError.componentError(playerId, POSITION_COMPONENT, error))
            ),
        })
      )

      // 回転の更新
      yield* pipe(
        Option.fromNullable(validatedUpdateData.rotation),
        Option.match({
          onNone: () => Effect.void,
          onSome: (rotation) =>
            pipe(
              entityManager.addComponent(playerState.entityId, ROTATION_COMPONENT, createRotationComponent(rotation)),
              Effect.mapError((error) => createPlayerError.componentError(playerId, ROTATION_COMPONENT, error))
            ),
        })
      )

      // 体力の更新
      yield* pipe(
        validatedUpdateData.health !== undefined,
        Match.value,
        Match.when(true, () =>
          Effect.gen(function* () {
            // 既存のプレイヤーコンポーネントを取得して更新
            const playerComponent = yield* pipe(
              entityManager.getComponent<PlayerComponent>(playerState.entityId, PLAYER_COMPONENT),
              Effect.flatMap(
                Option.match({
                  onNone: () => Effect.fail(createPlayerError.componentError(playerId, PLAYER_COMPONENT)),
                  onSome: (component) => Effect.succeed(component),
                })
              )
            )

            const updatedPlayerComponent = createPlayerComponent(playerId, validatedUpdateData.health!)
            yield* pipe(
              entityManager.addComponent(playerState.entityId, PLAYER_COMPONENT, updatedPlayerComponent),
              Effect.mapError((error) => createPlayerError.componentError(playerId, PLAYER_COMPONENT, error))
            )
          })
        ),
        Match.when(false, () => Effect.void),
        Match.exhaustive
      )

      // 内部状態の最終更新時刻を更新
      yield* Ref.update(playersRef, (players) =>
        HashMap.modify(players, playerId, (state) => ({
          ...state,
          lastUpdate: Date.now(),
        }))
      )

      yield* Effect.log(`Player state updated: ${playerId}`, validatedUpdateData)
    })

  // プレイヤー状態の取得
  const getPlayerState = (playerId: PlayerId) =>
    Effect.gen(function* () {
      const playerState = yield* getPlayerInternalState(playerId)
      return yield* buildPlayerState(playerId, playerState.entityId, playerState.isActive)
    })

  // プレイヤーの位置設定
  const setPlayerPosition = (playerId: PlayerId, position: unknown) =>
    Effect.gen(function* () {
      const validatedPosition = yield* validatePlayerPosition(position)
      const playerState = yield* getPlayerInternalState(playerId)

      yield* pipe(
        entityManager.addComponent(
          playerState.entityId,
          POSITION_COMPONENT,
          createPositionComponent(validatedPosition)
        ),
        Effect.mapError((error) => createPlayerError.componentError(playerId, POSITION_COMPONENT, error))
      )

      yield* Effect.log(`Player position set: ${playerId}`, validatedPosition)
    })

  // プレイヤーの回転設定
  const setPlayerRotation = (playerId: PlayerId, rotation: unknown) =>
    Effect.gen(function* () {
      const validatedRotation = yield* validatePlayerRotation(rotation)
      const playerState = yield* getPlayerInternalState(playerId)

      yield* pipe(
        entityManager.addComponent(
          playerState.entityId,
          ROTATION_COMPONENT,
          createRotationComponent(validatedRotation)
        ),
        Effect.mapError((error) => createPlayerError.componentError(playerId, ROTATION_COMPONENT, error))
      )

      yield* Effect.log(`Player rotation set: ${playerId}`, validatedRotation)
    })

  // プレイヤーの体力設定
  const setPlayerHealth = (playerId: PlayerId, health: unknown) =>
    Effect.gen(function* () {
      yield* pipe(
        Predicate.isNumber(health) && health >= 0 && health <= 100,
        Match.value,
        Match.when(false, () => Effect.fail(createPlayerError.invalidHealth(health, playerId))),
        Match.when(true, () => Effect.void),
        Match.exhaustive
      )

      const playerState = yield* getPlayerInternalState(playerId)
      const updatedPlayerComponent = createPlayerComponent(playerId, health)

      yield* pipe(
        entityManager.addComponent(playerState.entityId, PLAYER_COMPONENT, updatedPlayerComponent),
        Effect.mapError((error) => createPlayerError.componentError(playerId, PLAYER_COMPONENT, error))
      )

      yield* Effect.log(`Player health set: ${playerId}`, { health })
    })

  // プレイヤーのアクティブ状態設定
  const setPlayerActive = (playerId: PlayerId, active: boolean) =>
    Effect.gen(function* () {
      const playerState = yield* getPlayerInternalState(playerId)

      // エンティティのアクティブ状態を設定
      yield* pipe(
        entityManager.setEntityActive(playerState.entityId, active),
        Effect.mapError((error) => createPlayerError.componentError(playerId, 'EntityActive', error))
      )

      // 内部状態の更新
      yield* Ref.update(playersRef, (players) =>
        HashMap.modify(players, playerId, (state) => ({
          ...state,
          isActive: active,
          lastUpdate: Date.now(),
        }))
      )

      yield* Effect.log(`Player active state set: ${playerId}`, { active })
    })

  // 全プレイヤーの一覧取得
  const getAllPlayers = (): Effect.Effect<ReadonlyArray<PlayerState>, never> =>
    Effect.gen(function* () {
      const players = yield* Ref.get(playersRef)
      const playerStates: PlayerState[] = []

      for (const [playerId, playerInternalState] of HashMap.toEntries(players)) {
        const result = yield* Effect.either(
          buildPlayerState(playerId, playerInternalState.entityId, playerInternalState.isActive)
        )

        pipe(
          result._tag,
          Match.value,
          Match.when('Right', () => {
            playerStates.push(result.right)
          }),
          Match.when('Left', () => {
            // エラーが発生したプレイヤーはスキップ
            Effect.runSync(Effect.log(`Error building player state for ${playerId}`, { error: result.left }))
          }),
          Match.exhaustive
        )
      }

      return playerStates
    })

  // プレイヤーの存在確認
  const playerExists = (playerId: PlayerId): Effect.Effect<boolean, never> =>
    pipe(
      Ref.get(playersRef),
      Effect.map((players) => HashMap.has(players, playerId))
    )

  // 指定範囲内のプレイヤー検索
  const getPlayersInRange = (center: PlayerPosition, radius: number) =>
    Effect.gen(function* () {
      const allPlayers = yield* getAllPlayers()

      const playersInRange = allPlayers.filter((player) => {
        const dx = player.position.x - center.x
        const dy = player.position.y - center.y
        const dz = player.position.z - center.z
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)
        return distance <= radius
      })

      return playersInRange
    })

  // プレイヤー統計情報の取得
  const getPlayerStats = () =>
    Effect.gen(function* () {
      const allPlayers = yield* getAllPlayers()
      const activePlayers = allPlayers.filter((player) => player.isActive)
      const averageHealth =
        allPlayers.length > 0 ? allPlayers.reduce((sum, player) => sum + player.health, 0) / allPlayers.length : 0

      return {
        totalPlayers: allPlayers.length,
        activePlayers: activePlayers.length,
        averageHealth,
      }
    })

  return PlayerService.of({
    createPlayer,
    destroyPlayer,
    updatePlayerState,
    getPlayerState,
    setPlayerPosition,
    setPlayerRotation,
    setPlayerHealth,
    setPlayerActive,
    getAllPlayers,
    playerExists,
    getPlayersInRange,
    getPlayerStats,
  })
})

/**
 * PlayerServiceLive Layer
 */
export const PlayerServiceLive = Layer.effect(PlayerService, makePlayerServiceLive)

import { Effect, Context, Layer, pipe, Array as EffectArray, Option, Match } from 'effect'
import { Player } from '../entities/Player.js'
import { PlayerMovementService } from './PlayerMovementService.js'
import { PlayerController } from './PlayerController.js'
import type { EntityId } from '../../infrastructure/ecs/Entity.js'
import type { PlayerId, ComponentTypeName } from '../../shared/types/branded.js'
import { type Vector3D, VectorMath, type MutableVector3D } from '../../shared/schemas/spatial.js'

// ECS Component定義
export const PlayerECSComponents = {
  PLAYER: 'PlayerComponent' as ComponentTypeName,
  TRANSFORM: 'TransformComponent' as ComponentTypeName,
  PHYSICS: 'PhysicsComponent' as ComponentTypeName,
  STATS: 'StatsComponent' as ComponentTypeName,
  INPUT: 'InputComponent' as ComponentTypeName,
} as const

// Transform Component
export interface TransformComponent {
  position: Vector3D
  rotation: { pitch: number; yaw: number; roll: number }
  scale: Vector3D
}

// Physics Component
export interface PhysicsComponent {
  velocity: Vector3D
  acceleration: Vector3D
  mass: number
  friction: number
  restitution: number
  isOnGround: boolean
  isInWater: boolean
  isInLava: boolean
}

// Stats Component
export interface StatsComponent {
  health: number
  maxHealth: number
  hunger: number
  saturation: number
  experience: number
  level: number
  armor: number
  lastDamageTime: number
  lastHealTime: number
}

// Input Component
export interface InputComponent {
  forward: boolean
  backward: boolean
  left: boolean
  right: boolean
  jump: boolean
  sneak: boolean
  sprint: boolean
  mouseX: number
  mouseY: number
}

// Player Component (メタデータ)
export interface PlayerComponent {
  playerId: PlayerId
  name: string
  gameMode: 'survival' | 'creative' | 'adventure' | 'spectator'
  isActive: boolean
}

// ECS World定義
export interface PlayerWorld {
  readonly entities: Set<EntityId>
  readonly components: {
    readonly player: Map<EntityId, PlayerComponent>
    readonly transform: Map<EntityId, TransformComponent>
    readonly physics: Map<EntityId, PhysicsComponent>
    readonly stats: Map<EntityId, StatsComponent>
    readonly input: Map<EntityId, InputComponent>
  }
}

// PlayerECSSystem インターフェース
export interface PlayerECSSystem {
  /**
   * プレイヤーエンティティの作成
   */
  readonly createPlayerEntity: (world: PlayerWorld, player: Player) => Effect.Effect<EntityId, Error>

  /**
   * プレイヤーエンティティの削除
   */
  readonly destroyPlayerEntity: (world: PlayerWorld, entityId: EntityId) => Effect.Effect<void, Error>

  /**
   * 移動システムの更新
   */
  readonly updateMovementSystem: (world: PlayerWorld, deltaTime: number) => Effect.Effect<void, Error>

  /**
   * 物理システムの更新
   */
  readonly updatePhysicsSystem: (world: PlayerWorld, deltaTime: number) => Effect.Effect<void, Error>

  /**
   * 統計システムの更新
   */
  readonly updateStatsSystem: (world: PlayerWorld, deltaTime: number) => Effect.Effect<void, Error>

  /**
   * 空間クエリ（範囲内のプレイヤー検索）
   */
  readonly queryPlayersInRange: (
    world: PlayerWorld,
    center: Vector3D,
    radius: number
  ) => Effect.Effect<ReadonlyArray<EntityId>, never>

  /**
   * プレイヤー状態の同期
   */
  readonly syncPlayerState: (world: PlayerWorld, entityId: EntityId, player: Player) => Effect.Effect<void, Error>
}

// Context Tag定義
export const PlayerECSSystem = Context.GenericTag<PlayerECSSystem>('PlayerECSSystem')

// PlayerECSSystem実装
const makePlayerECSSystem: Effect.Effect<PlayerECSSystem, never, PlayerMovementService | PlayerController> = Effect.gen(
  function* () {
    const movementService = yield* PlayerMovementService
    const controller = yield* PlayerController

    // エンティティID生成
    let nextEntityId = 1
    const generateEntityId = (): EntityId => nextEntityId++ as EntityId

    // プレイヤーエンティティ作成
    const createPlayerEntity = (world: PlayerWorld, player: Player) =>
      Effect.gen(function* () {
        const entityId = generateEntityId()

        // エンティティをワールドに追加
        world.entities.add(entityId)

        // コンポーネント追加
        world.components.player.set(entityId, {
          playerId: player.id as PlayerId,
          name: player.name,
          gameMode: player.gameMode,
          isActive: true,
        })

        world.components.transform.set(entityId, {
          position: player.position,
          rotation: player.rotation,
          scale: { x: 1, y: 1, z: 1 },
        })

        world.components.physics.set(entityId, {
          velocity: player.velocity,
          acceleration: { x: 0, y: -32, z: 0 }, // 重力
          mass: 70,
          friction: 0.6,
          restitution: 0.0,
          isOnGround: player.isOnGround,
          isInWater: false,
          isInLava: false,
        })

        world.components.stats.set(entityId, {
          health: player.stats.health,
          maxHealth: player.stats.maxHealth,
          hunger: player.stats.hunger,
          saturation: player.stats.saturation,
          experience: player.stats.experience,
          level: player.stats.level,
          armor: player.stats.armor,
          lastDamageTime: 0,
          lastHealTime: 0,
        })

        world.components.input.set(entityId, {
          forward: false,
          backward: false,
          left: false,
          right: false,
          jump: false,
          sneak: false,
          sprint: false,
          mouseX: 0,
          mouseY: 0,
        })

        yield* Effect.log(`Created player entity ${entityId} for player ${player.name}`)

        return entityId
      })

    // プレイヤーエンティティ削除
    const destroyPlayerEntity = (world: PlayerWorld, entityId: EntityId) =>
      Effect.gen(function* () {
        // コンポーネント削除
        world.components.player.delete(entityId)
        world.components.transform.delete(entityId)
        world.components.physics.delete(entityId)
        world.components.stats.delete(entityId)
        world.components.input.delete(entityId)

        // エンティティ削除
        world.entities.delete(entityId)

        yield* Effect.log(`Destroyed player entity ${entityId}`)
      })

    // 移動システム更新
    const updateMovementSystem = (world: PlayerWorld, deltaTime: number) =>
      Effect.gen(function* () {
        // 全プレイヤーエンティティを処理 - Effect-TSパターン
        yield* Effect.forEach(
          Array.from(world.entities),
          (entityId) =>
            Effect.gen(function* () {
              const playerComp = world.components.player.get(entityId)
              const transformComp = world.components.transform.get(entityId)
              const physicsComp = world.components.physics.get(entityId)
              const inputComp = world.components.input.get(entityId)

              // コンポーネント存在チェック - Effect-TSパターン
              return yield* pipe(
                Option.all({
                  player: Option.fromNullable(playerComp),
                  transform: Option.fromNullable(transformComp),
                  physics: Option.fromNullable(physicsComp),
                  input: Option.fromNullable(inputComp),
                }),
                Option.match({
                  onNone: () => Effect.succeed(undefined),
                  onSome: ({ player, transform, physics, input }) =>
                    Effect.gen(function* () {
                      // スピード決定 - 条件演算子を使用
                      const speed = input.sprint ? 5.612 : 4.317

                      // 回転を考慮した移動
                      const yawRad = (transform.rotation.yaw * Math.PI) / 180
                      const cosYaw = Math.cos(yawRad)
                      const sinYaw = Math.sin(yawRad)

                      // 移動ベクトル計算 - 関数型スタイル
                      const moveVector = pipe(
                        { x: 0, y: 0, z: 0 } as MutableVector3D,
                        (vec) => ({
                          x: vec.x
                            + (input.forward ? -sinYaw * speed * deltaTime : 0)
                            + (input.backward ? sinYaw * speed * deltaTime : 0)
                            + (input.left ? -cosYaw * speed * deltaTime : 0)
                            + (input.right ? cosYaw * speed * deltaTime : 0),
                          y: vec.y,
                          z: vec.z
                            + (input.forward ? cosYaw * speed * deltaTime : 0)
                            + (input.backward ? -cosYaw * speed * deltaTime : 0)
                            + (input.left ? -sinYaw * speed * deltaTime : 0)
                            + (input.right ? sinYaw * speed * deltaTime : 0),
                        })
                      )

                      // 位置更新
                      transform.position = VectorMath.add(transform.position, moveVector)

                      // ジャンプ処理 - 条件演算子を使用
                      const shouldJump = input.jump && physics.isOnGround
                      physics.velocity = shouldJump
                        ? { ...physics.velocity, y: 8.0 }
                        : physics.velocity
                      physics.isOnGround = shouldJump ? false : physics.isOnGround
                    }),
                })
              )
            }),
          { concurrency: 'unbounded' }
        )
      })

    // 物理システム更新
    const updatePhysicsSystem = (world: PlayerWorld, deltaTime: number) =>
      Effect.gen(function* () {
        yield* Effect.forEach(
          Array.from(world.entities),
          (entityId) =>
            Effect.gen(function* () {
              const transformComp = world.components.transform.get(entityId)
              const physicsComp = world.components.physics.get(entityId)
              const playerComp = world.components.player.get(entityId)

              // コンポーネント存在チェックと物理処理 - Effect-TSパターン
              return yield* pipe(
                Option.all({
                  transform: Option.fromNullable(transformComp),
                  physics: Option.fromNullable(physicsComp),
                  player: Option.fromNullable(playerComp),
                }),
                Option.match({
                  onNone: () => Effect.succeed(undefined),
                  onSome: ({ transform, physics, player }) =>
                    pipe(
                      Match.value(player.gameMode),
                      Match.when(
                        (mode) => mode === 'creative' || mode === 'spectator',
                        () => Effect.succeed(undefined) // 物理無視
                      ),
                      Match.orElse(() =>
                        Effect.gen(function* () {
                          // 重力適用
                          const newVelY = physics.velocity.y + physics.acceleration.y * deltaTime
                          // 終端速度制限
                          const clampedVelY = Math.max(-60, newVelY)
                          // 空気抵抗
                          const newVelX = physics.velocity.x * Math.pow(0.98, deltaTime)
                          const newVelZ = physics.velocity.z * Math.pow(0.98, deltaTime)

                          physics.velocity = { x: newVelX, y: clampedVelY, z: newVelZ }

                          // 位置更新
                          const deltaPos: Vector3D = {
                            x: physics.velocity.x * deltaTime,
                            y: physics.velocity.y * deltaTime,
                            z: physics.velocity.z * deltaTime,
                          }

                          transform.position = VectorMath.add(transform.position, deltaPos)

                          // 地面判定（簡易版） - 条件演算子を使用
                          const hitGround = transform.position.y <= 64
                          transform.position = hitGround
                            ? { ...transform.position, y: 64 }
                            : transform.position
                          physics.velocity = hitGround
                            ? { ...physics.velocity, y: 0 }
                            : physics.velocity
                          physics.isOnGround = hitGround || physics.isOnGround
                        })
                      )
                    ),
                })
              )
            }),
          { concurrency: 'unbounded' }
        )
      })

    // 統計システム更新
    const updateStatsSystem = (world: PlayerWorld, deltaTime: number) =>
      Effect.gen(function* () {
        yield* Effect.forEach(
          Array.from(world.entities),
          (entityId) =>
            Effect.gen(function* () {
              const statsComp = world.components.stats.get(entityId)
              const playerComp = world.components.player.get(entityId)

              // コンポーネント存在チェック - Effect-TSパターン
              return yield* pipe(
                Option.all({
                  stats: Option.fromNullable(statsComp),
                  player: Option.fromNullable(playerComp),
                }),
                Option.match({
                  onNone: () => Effect.succeed(undefined),
                  onSome: ({ stats, player }) =>
                    pipe(
                      Match.value(player.gameMode),
                      Match.when(
                        (mode) => mode !== 'survival',
                        () => Effect.succeed(undefined) // サバイバル以外はスキップ
                      ),
                      Match.orElse(() =>
                        Effect.gen(function* () {
                          // 空腹度減少（約0.005/tick = 0.1/秒）
                          stats.hunger = Math.max(0, stats.hunger - 0.005 * deltaTime)

                          // 飽和度減少 - 条件演算子使用
                          stats.saturation = stats.hunger < 20
                            ? Math.max(0, stats.saturation - 0.01 * deltaTime)
                            : stats.saturation

                          // 自然回復（空腹度18以上）
                          const timeSinceLastHeal = Date.now() - stats.lastHealTime
                          const shouldHeal = stats.hunger >= 18 && stats.health < stats.maxHealth && timeSinceLastHeal > 500

                          stats.health = shouldHeal
                            ? Math.min(stats.maxHealth, stats.health + 1)
                            : stats.health
                          stats.lastHealTime = shouldHeal ? Date.now() : stats.lastHealTime
                          stats.saturation = shouldHeal
                            ? Math.max(0, stats.saturation - 0.6)
                            : stats.saturation

                          // 餓死ダメージ（空腹度0）
                          const timeSinceLastDamage = Date.now() - stats.lastDamageTime
                          const shouldTakeDamage = stats.hunger === 0 && timeSinceLastDamage > 4000

                          stats.health = shouldTakeDamage
                            ? Math.max(1, stats.health - 1) // ハードモード以外では1で止まる
                            : stats.health
                          stats.lastDamageTime = shouldTakeDamage ? Date.now() : stats.lastDamageTime
                        })
                      )
                    ),
                })
              )
            }),
          { concurrency: 'unbounded' }
        )
      })

    // 空間クエリ
    const queryPlayersInRange = (world: PlayerWorld, center: Vector3D, radius: number) =>
      Effect.gen(function* () {
        // Effect-TSパターンでフィルタリング
        return yield* pipe(
          Array.from(world.entities),
          Effect.forEach(
            (entityId) =>
              Effect.gen(function* () {
                const transformComp = world.components.transform.get(entityId)

                return yield* pipe(
                  Option.fromNullable(transformComp),
                  Option.match({
                    onNone: () => Effect.succeed(Option.none<EntityId>()),
                    onSome: (transform) => {
                      const distance = VectorMath.distance(transform.position, center)
                      return Effect.succeed(
                        distance <= radius ? Option.some(entityId) : Option.none<EntityId>()
                      )
                    },
                  })
                )
              }),
            { concurrency: 'unbounded' }
          ),
          Effect.map((results) => results.flatMap(Option.match({
            onNone: () => [],
            onSome: (id) => [id],
          })))
        )
      })

    // プレイヤー状態同期
    const syncPlayerState = (world: PlayerWorld, entityId: EntityId, player: Player) =>
      Effect.gen(function* () {
        const transformComp = world.components.transform.get(entityId)
        const physicsComp = world.components.physics.get(entityId)
        const statsComp = world.components.stats.get(entityId)

        if (!transformComp || !physicsComp || !statsComp) {
          return yield* Effect.fail(new Error(`Entity ${entityId} missing components`))
        }

        // プレイヤー状態をコンポーネントに反映
        transformComp.position = player.position
        transformComp.rotation = player.rotation
        physicsComp.velocity = player.velocity
        physicsComp.isOnGround = player.isOnGround
        statsComp.health = player.stats.health
        statsComp.hunger = player.stats.hunger
        statsComp.experience = player.stats.experience
        statsComp.level = player.stats.level
      })

    const system: PlayerECSSystem = {
      createPlayerEntity,
      destroyPlayerEntity,
      updateMovementSystem,
      updatePhysicsSystem,
      updateStatsSystem,
      queryPlayersInRange,
      syncPlayerState,
    }

    return system
  }
)

// Live Layer実装
export const PlayerECSSystemLive = Layer.effect(PlayerECSSystem, makePlayerECSSystem)

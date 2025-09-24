import { Effect, Context, Layer, pipe, Array as EffectArray } from 'effect'
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
  readonly createPlayerEntity: (
    world: PlayerWorld,
    player: Player
  ) => Effect.Effect<EntityId, Error>

  /**
   * プレイヤーエンティティの削除
   */
  readonly destroyPlayerEntity: (
    world: PlayerWorld,
    entityId: EntityId
  ) => Effect.Effect<void, Error>

  /**
   * 移動システムの更新
   */
  readonly updateMovementSystem: (
    world: PlayerWorld,
    deltaTime: number
  ) => Effect.Effect<void, Error>

  /**
   * 物理システムの更新
   */
  readonly updatePhysicsSystem: (
    world: PlayerWorld,
    deltaTime: number
  ) => Effect.Effect<void, Error>

  /**
   * 統計システムの更新
   */
  readonly updateStatsSystem: (
    world: PlayerWorld,
    deltaTime: number
  ) => Effect.Effect<void, Error>

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
  readonly syncPlayerState: (
    world: PlayerWorld,
    entityId: EntityId,
    player: Player
  ) => Effect.Effect<void, Error>
}

// Context Tag定義
export class PlayerECSSystem extends Context.Tag('PlayerECSSystem')<
  PlayerECSSystem,
  PlayerECSSystem
>() {}

// PlayerECSSystem実装
const makePlayerECSSystem = Effect.gen(function* () {
  const movementService = yield* PlayerMovementService
  const controller = yield* PlayerController

  // エンティティID生成
  let nextEntityId = 1
  const generateEntityId = (): EntityId => (nextEntityId++) as EntityId

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
      // 全プレイヤーエンティティを処理
      for (const entityId of world.entities) {
        const playerComp = world.components.player.get(entityId)
        const transformComp = world.components.transform.get(entityId)
        const physicsComp = world.components.physics.get(entityId)
        const inputComp = world.components.input.get(entityId)

        if (!playerComp || !transformComp || !physicsComp || !inputComp) {
          continue
        }

        // 入力から移動ベクトル計算
        const moveVector: MutableVector3D = { x: 0, y: 0, z: 0 }
        const speed = inputComp.sprint ? 5.612 : 4.317

        // 回転を考慮した移動
        const yawRad = (transformComp.rotation.yaw * Math.PI) / 180
        const cosYaw = Math.cos(yawRad)
        const sinYaw = Math.sin(yawRad)

        if (inputComp.forward) {
          moveVector.x -= sinYaw * speed * deltaTime
          moveVector.z += cosYaw * speed * deltaTime
        }
        if (inputComp.backward) {
          moveVector.x += sinYaw * speed * deltaTime
          moveVector.z -= cosYaw * speed * deltaTime
        }
        if (inputComp.left) {
          moveVector.x -= cosYaw * speed * deltaTime
          moveVector.z -= sinYaw * speed * deltaTime
        }
        if (inputComp.right) {
          moveVector.x += cosYaw * speed * deltaTime
          moveVector.z += sinYaw * speed * deltaTime
        }

        // 位置更新
        transformComp.position = VectorMath.add(transformComp.position, moveVector)

        // ジャンプ処理
        if (inputComp.jump && physicsComp.isOnGround) {
          physicsComp.velocity = { ...physicsComp.velocity, y: 8.0 }
          physicsComp.isOnGround = false
        }
      }
    })

  // 物理システム更新
  const updatePhysicsSystem = (world: PlayerWorld, deltaTime: number) =>
    Effect.gen(function* () {
      for (const entityId of world.entities) {
        const transformComp = world.components.transform.get(entityId)
        const physicsComp = world.components.physics.get(entityId)
        const playerComp = world.components.player.get(entityId)

        if (!transformComp || !physicsComp || !playerComp) {
          continue
        }

        // クリエイティブ/スペクテイターモードは物理無視
        if (playerComp.gameMode === 'creative' || playerComp.gameMode === 'spectator') {
          continue
        }

        // 重力適用
        const newVelY = physicsComp.velocity.y + physicsComp.acceleration.y * deltaTime
        // 終端速度制限
        const clampedVelY = Math.max(-60, newVelY)
        // 空気抵抗
        const newVelX = physicsComp.velocity.x * Math.pow(0.98, deltaTime)
        const newVelZ = physicsComp.velocity.z * Math.pow(0.98, deltaTime)

        physicsComp.velocity = { x: newVelX, y: clampedVelY, z: newVelZ }

        // 位置更新
        const deltaPos: Vector3D = {
          x: physicsComp.velocity.x * deltaTime,
          y: physicsComp.velocity.y * deltaTime,
          z: physicsComp.velocity.z * deltaTime,
        }

        transformComp.position = VectorMath.add(transformComp.position, deltaPos)

        // 地面判定（簡易版）
        if (transformComp.position.y <= 64) {
          transformComp.position = { ...transformComp.position, y: 64 }
          physicsComp.velocity = { ...physicsComp.velocity, y: 0 }
          physicsComp.isOnGround = true
        }
      }
    })

  // 統計システム更新
  const updateStatsSystem = (world: PlayerWorld, deltaTime: number) =>
    Effect.gen(function* () {
      for (const entityId of world.entities) {
        const statsComp = world.components.stats.get(entityId)
        const playerComp = world.components.player.get(entityId)

        if (!statsComp || !playerComp) {
          continue
        }

        // サバイバルモードのみ空腹度減少
        if (playerComp.gameMode === 'survival') {
          // 空腹度減少（約0.005/tick = 0.1/秒）
          statsComp.hunger = Math.max(0, statsComp.hunger - 0.005 * deltaTime)

          // 飽和度減少
          if (statsComp.hunger < 20) {
            statsComp.saturation = Math.max(0, statsComp.saturation - 0.01 * deltaTime)
          }

          // 自然回復（空腹度18以上）
          const timeSinceLastHeal = Date.now() - statsComp.lastHealTime
          if (statsComp.hunger >= 18 && statsComp.health < statsComp.maxHealth && timeSinceLastHeal > 500) {
            statsComp.health = Math.min(statsComp.maxHealth, statsComp.health + 1)
            statsComp.lastHealTime = Date.now()
            statsComp.saturation = Math.max(0, statsComp.saturation - 0.6)
          }

          // 餓死ダメージ（空腹度0）
          const timeSinceLastDamage = Date.now() - statsComp.lastDamageTime
          if (statsComp.hunger === 0 && timeSinceLastDamage > 4000) {
            statsComp.health = Math.max(1, statsComp.health - 1) // ハードモード以外では1で止まる
            statsComp.lastDamageTime = Date.now()
          }
        }
      }
    })

  // 空間クエリ
  const queryPlayersInRange = (world: PlayerWorld, center: Vector3D, radius: number) =>
    Effect.gen(function* () {
      const entitiesInRange: EntityId[] = []

      for (const entityId of world.entities) {
        const transformComp = world.components.transform.get(entityId)
        if (!transformComp) continue

        const distance = VectorMath.distance(transformComp.position, center)
        if (distance <= radius) {
          entitiesInRange.push(entityId)
        }
      }

      return entitiesInRange
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

  return {
    createPlayerEntity,
    destroyPlayerEntity,
    updateMovementSystem,
    updatePhysicsSystem,
    updateStatsSystem,
    queryPlayersInRange,
    syncPlayerState,
  } satisfies PlayerECSSystem
})

// Live Layer実装
export const PlayerECSSystemLive = Layer.effect(
  PlayerECSSystem,
  makePlayerECSSystem
)
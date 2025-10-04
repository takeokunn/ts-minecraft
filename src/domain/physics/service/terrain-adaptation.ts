import type { PlayerId } from '@domain/core/types/brands'
import type { Vector3D } from '@domain/core/types/spatial'
import { Context, Effect, Layer, Match, pipe, Ref } from 'effect'
import type { BlockType } from '../../block/types'
import { CannonPhysicsService } from './cannon'
import { WorldCollisionService } from './world-collision'

/**
 * Terrain Adaptation Service
 * 地形に応じた移動特性の自動適応システム
 * - 階段の自動ステップアップ
 * - 水中移動物理
 * - 地形タイプ別の移動特性
 */

// 地形移動特性定義
interface TerrainMovementProperties {
  readonly friction: number // 摩擦係数 (0.0-2.0)
  readonly speedModifier: number // 移動速度倍率 (0.1-2.0)
  readonly jumpHeightModifier: number // ジャンプ高さ倍率 (0.0-2.0)
  readonly airResistance: number // 空気/水中抵抗 (0.0-1.0)
  readonly buoyancy: number // 浮力 (0.0-2.0, 1.0が中性)
  readonly stepHeight: number // 自動ステップアップ高さ (0.0-1.0)
  readonly soundDamping: number // 音の減衰 (0.0-1.0)
}

// デフォルト地形特性
export const DEFAULT_TERRAIN_PROPERTIES: TerrainMovementProperties = {
  friction: 0.8,
  speedModifier: 1.0,
  jumpHeightModifier: 1.0,
  airResistance: 0.0,
  buoyancy: 0.0,
  stepHeight: 0.6, // Minecraftの標準ステップ高
  soundDamping: 0.0,
} as const

// 特殊地形プロパティ
export const TERRAIN_PROPERTIES: ReadonlyMap<string, TerrainMovementProperties> = new Map([
  // 水中移動
  [
    'water',
    {
      friction: 0.3,
      speedModifier: 0.3,
      jumpHeightModifier: 0.0,
      airResistance: 0.8,
      buoyancy: 1.2,
      stepHeight: 0.0,
      soundDamping: 0.7,
    },
  ],

  // 氷上移動
  [
    'ice',
    {
      friction: 0.1,
      speedModifier: 1.2,
      jumpHeightModifier: 1.0,
      airResistance: 0.0,
      buoyancy: 0.0,
      stepHeight: 0.6,
      soundDamping: 0.2,
    },
  ],

  // ソウルサンド（遅くなる）
  [
    'soul_sand',
    {
      friction: 1.5,
      speedModifier: 0.4,
      jumpHeightModifier: 0.8,
      airResistance: 0.1,
      buoyancy: 0.0,
      stepHeight: 0.3,
      soundDamping: 0.3,
    },
  ],

  // 蜂蜜ブロック（粘着性）
  [
    'honey_block',
    {
      friction: 2.0,
      speedModifier: 0.2,
      jumpHeightModifier: 0.3,
      airResistance: 0.2,
      buoyancy: 0.0,
      stepHeight: 0.1,
      soundDamping: 0.6,
    },
  ],

  // 滑りやすい表面（濡れた岩など）
  [
    'wet_stone',
    {
      friction: 0.4,
      speedModifier: 0.9,
      jumpHeightModifier: 0.9,
      airResistance: 0.0,
      buoyancy: 0.0,
      stepHeight: 0.5,
      soundDamping: 0.1,
    },
  ],
])

// 地形適応エラー
export interface TerrainAdaptationError {
  readonly _tag: 'TerrainAdaptationError'
  readonly message: string
  readonly playerId?: PlayerId
  readonly reason: 'PhysicsError' | 'InvalidTerrain' | 'CollisionError' | 'AdaptationFailed'
  readonly cause?: unknown
}

// プレイヤー地形状態
export interface PlayerTerrainState {
  readonly playerId: PlayerId
  readonly currentTerrain: TerrainMovementProperties
  readonly submersionLevel: number // 0.0-1.0 (完全に水中の場合は1.0)
  readonly isSwimming: boolean
  readonly isClimbing: boolean
  readonly lastTerrainChange: number
  readonly adaptationBuffer: TerrainMovementProperties[] // 地形変化の緩和バッファ
}

// Terrain Adaptation Service インターフェース
export interface TerrainAdaptationService {
  /**
   * プレイヤーの地形適応初期化
   */
  readonly initializePlayerTerrain: (playerId: PlayerId) => Effect.Effect<void, TerrainAdaptationError>

  /**
   * 地形タイプから移動特性を取得
   */
  readonly getTerrainProperties: (
    blockType: BlockType
  ) => Effect.Effect<TerrainMovementProperties, TerrainAdaptationError>

  /**
   * プレイヤー周辺の地形解析と適応
   */
  readonly adaptToTerrain: (
    playerId: PlayerId,
    playerPosition: Vector3D,
    deltaTime: number
  ) => Effect.Effect<PlayerTerrainState, TerrainAdaptationError>

  /**
   * 自動ステップアップ処理
   */
  readonly processStepUp: (
    playerId: PlayerId,
    playerPosition: Vector3D,
    velocity: Vector3D,
    stepHeight: number
  ) => Effect.Effect<{ position: Vector3D; velocity: Vector3D }, TerrainAdaptationError>

  /**
   * 水中物理の適用
   */
  readonly applySwimmingPhysics: (
    playerId: PlayerId,
    submersionLevel: number,
    currentVelocity: Vector3D
  ) => Effect.Effect<Vector3D, TerrainAdaptationError>

  /**
   * 地形摩擦の適用
   */
  readonly applyTerrainFriction: (
    playerId: PlayerId,
    terrainProperties: TerrainMovementProperties,
    currentVelocity: Vector3D,
    deltaTime: number
  ) => Effect.Effect<Vector3D, TerrainAdaptationError>

  /**
   * プレイヤーの地形状態取得
   */
  readonly getPlayerTerrainState: (playerId: PlayerId) => Effect.Effect<PlayerTerrainState, TerrainAdaptationError>

  /**
   * 地形適応のクリーンアップ
   */
  readonly cleanupPlayerTerrain: (playerId: PlayerId) => Effect.Effect<void, TerrainAdaptationError>
}

// Context Tag定義
export const TerrainAdaptationService = Context.GenericTag<TerrainAdaptationService>(
  '@minecraft/TerrainAdaptationService'
)

// Terrain Adaptation Service実装
const makeTerrainAdaptationService: Effect.Effect<
  TerrainAdaptationService,
  never,
  WorldCollisionService | CannonPhysicsService
> = Effect.gen(function* () {
  const worldCollision = yield* WorldCollisionService
  const cannonPhysics = yield* CannonPhysicsService

  // プレイヤー地形状態管理
  const playerTerrainStatesRef = yield* Ref.make(new Map<PlayerId, PlayerTerrainState>())

  // プレイヤーの地形適応初期化
  const initializePlayerTerrain = (playerId: PlayerId) =>
    Effect.gen(function* () {
      const initialState: PlayerTerrainState = {
        playerId,
        currentTerrain: DEFAULT_TERRAIN_PROPERTIES,
        submersionLevel: 0.0,
        isSwimming: false,
        isClimbing: false,
        lastTerrainChange: Date.now(),
        adaptationBuffer: [],
      }

      yield* Ref.update(playerTerrainStatesRef, (states) => states.set(playerId, initialState))
      console.log(`Terrain adaptation initialized for player ${playerId}`)
    })

  // 地形タイプから移動特性を取得
  const getTerrainProperties = (blockType: BlockType) =>
    Effect.gen(function* () {
      // ブロックIDに基づいて地形特性を決定
      const properties = TERRAIN_PROPERTIES.get(blockType.id) ?? DEFAULT_TERRAIN_PROPERTIES

      // ブロック物理特性も考慮
      const adjustedProperties = yield* pipe(
        Match.value({
          isLiquid: !blockType.physics.solid && blockType.physics.gravity,
          isSlippery: blockType.physics.hardness < 0.5,
          isSoft: blockType.physics.hardness < 1.0,
          isHeavy: blockType.physics.hardness > 5.0,
        }),
        Match.when(
          ({ isLiquid }) => isLiquid,
          () =>
            Effect.succeed({
              ...properties,
              airResistance: Math.max(properties.airResistance, 0.6),
              buoyancy: Math.max(properties.buoyancy, 1.0),
              speedModifier: Math.min(properties.speedModifier, 0.4),
            })
        ),
        Match.when(
          ({ isSlippery }) => isSlippery,
          () =>
            Effect.succeed({
              ...properties,
              friction: Math.min(properties.friction, 0.3),
              speedModifier: Math.max(properties.speedModifier, 1.1),
            })
        ),
        Match.when(
          ({ isSoft }) => isSoft,
          () =>
            Effect.succeed({
              ...properties,
              stepHeight: Math.max(properties.stepHeight, 0.8),
              soundDamping: Math.max(properties.soundDamping, 0.3),
            })
        ),
        Match.orElse(() => Effect.succeed(properties))
      )

      return adjustedProperties
    })

  // プレイヤー周辺の地形解析と適応
  const adaptToTerrain = (playerId: PlayerId, playerPosition: Vector3D, deltaTime: number) =>
    Effect.gen(function* () {
      const states = yield* Ref.get(playerTerrainStatesRef)
      const currentState = states.get(playerId)

      if (!currentState) {
        return yield* Effect.fail({
          _tag: 'TerrainAdaptationError',
          message: `Player terrain state not found: ${playerId}`,
          playerId,
          reason: 'InvalidTerrain',
        } as TerrainAdaptationError)
      }

      // 足元と胴体周辺のブロックを検査
      const terrainSamples = yield* Effect.gen(function* () {
        const samples = []

        // 足元 (Y-0.1)
        const footCollision = yield* worldCollision
          .checkSphereCollision({
            center: { x: playerPosition.x, y: playerPosition.y - 0.1, z: playerPosition.z },
            radius: 0.3,
          })
          .pipe(
            Effect.mapError(
              (error): TerrainAdaptationError => ({
                _tag: 'TerrainAdaptationError',
                message: 'Failed to check foot terrain',
                playerId,
                reason: 'CollisionError',
                cause: error,
              })
            )
          )
        samples.push(...footCollision.blocks)

        // 胴体レベル (Y+0.5)
        const bodyCollision = yield* worldCollision
          .checkSphereCollision({
            center: { x: playerPosition.x, y: playerPosition.y + 0.5, z: playerPosition.z },
            radius: 0.3,
          })
          .pipe(
            Effect.mapError(
              (error): TerrainAdaptationError => ({
                _tag: 'TerrainAdaptationError',
                message: 'Failed to check body terrain',
                playerId,
                reason: 'CollisionError',
                cause: error,
              })
            )
          )
        samples.push(...bodyCollision.blocks)

        // 頭部レベル (Y+1.5)
        const headCollision = yield* worldCollision
          .checkSphereCollision({
            center: { x: playerPosition.x, y: playerPosition.y + 1.5, z: playerPosition.z },
            radius: 0.3,
          })
          .pipe(
            Effect.mapError(
              (error): TerrainAdaptationError => ({
                _tag: 'TerrainAdaptationError',
                message: 'Failed to check head terrain',
                playerId,
                reason: 'CollisionError',
                cause: error,
              })
            )
          )
        samples.push(...headCollision.blocks)

        return samples
      })

      // 主要地形タイプの決定（最も影響の大きいブロック）
      const dominantTerrain = yield* Effect.gen(function* () {
        if (terrainSamples.length === 0) {
          return DEFAULT_TERRAIN_PROPERTIES
        }

        // 水中判定
        const waterBlocks = terrainSamples.filter((block) => block.id === 'water')
        const submersionLevel = Math.min(1.0, waterBlocks.length / 3) // 3サンプル中の水の割合

        // 最も特殊な地形特性を優先
        const specialBlocks = terrainSamples.find((block) => TERRAIN_PROPERTIES.has(block.id))
        if (specialBlocks) {
          // Create a BlockType-like object for getTerrainProperties
          const blockTypeLike: BlockType = {
            id: specialBlocks.id,
            name: specialBlocks.id,
            tags: [],
            category: 'natural' as const,
            texture: { top: '', bottom: '', north: '', south: '', east: '', west: '' },
            physics: {
              solid: true,
              gravity: false,
              hardness: 1.0,
              resistance: 1.0,
              luminance: 0,
              opacity: 15,
              flammable: false,
              replaceable: false,
              waterloggable: false,
            },
            tool: 'none' as const,
            minToolLevel: 0,
            drops: [],
            sound: {
              break: 'block.stone.break',
              place: 'block.stone.place',
              step: 'block.stone.step',
            },
            stackSize: 64,
          }
          const properties = yield* getTerrainProperties(blockTypeLike)
          return { ...properties, submersionLevel }
        }

        return { ...DEFAULT_TERRAIN_PROPERTIES } as TerrainMovementProperties & { submersionLevel?: number }
      })

      // 地形変化の緩和（急激な変化を防ぐ）
      const smoothedTerrain = yield* Effect.gen(function* () {
        const timeSinceChange = Date.now() - currentState.lastTerrainChange
        const adaptationSpeed = Math.min(1.0, deltaTime * 2) // 0.5秒で完全適応

        // 緩和処理
        return yield* pipe(
          Match.value(timeSinceChange > 100), // 100ms以内は緩和
          Match.when(false, () =>
            Effect.succeed({
              friction:
                currentState.currentTerrain.friction * (1 - adaptationSpeed) +
                dominantTerrain.friction * adaptationSpeed,
              speedModifier:
                currentState.currentTerrain.speedModifier * (1 - adaptationSpeed) +
                dominantTerrain.speedModifier * adaptationSpeed,
              jumpHeightModifier:
                currentState.currentTerrain.jumpHeightModifier * (1 - adaptationSpeed) +
                dominantTerrain.jumpHeightModifier * adaptationSpeed,
              airResistance:
                currentState.currentTerrain.airResistance * (1 - adaptationSpeed) +
                dominantTerrain.airResistance * adaptationSpeed,
              buoyancy:
                currentState.currentTerrain.buoyancy * (1 - adaptationSpeed) +
                dominantTerrain.buoyancy * adaptationSpeed,
              stepHeight:
                currentState.currentTerrain.stepHeight * (1 - adaptationSpeed) +
                dominantTerrain.stepHeight * adaptationSpeed,
              soundDamping:
                currentState.currentTerrain.soundDamping * (1 - adaptationSpeed) +
                dominantTerrain.soundDamping * adaptationSpeed,
            })
          ),
          Match.orElse(() => Effect.succeed(dominantTerrain))
        )
      })

      const newState: PlayerTerrainState = {
        ...currentState,
        currentTerrain: smoothedTerrain,
        submersionLevel: (dominantTerrain as any).submersionLevel || 0,
        isSwimming: ((dominantTerrain as any).submersionLevel || 0) >= 0.6,
        isClimbing: false, // TODO: 実装予定
        lastTerrainChange: Date.now(),
        adaptationBuffer: [...currentState.adaptationBuffer.slice(-4), smoothedTerrain],
      }

      yield* Ref.update(playerTerrainStatesRef, (states) => states.set(playerId, newState))

      return newState
    })

  // 自動ステップアップ処理
  const processStepUp = (playerId: PlayerId, playerPosition: Vector3D, velocity: Vector3D, stepHeight: number) =>
    Effect.gen(function* () {
      // 前方への移動がない場合はスキップ
      const horizontalSpeed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z)
      if (horizontalSpeed < 0.1) {
        return { position: playerPosition, velocity }
      }

      // 前方の衝突判定
      const forwardDistance = 0.4
      const forwardPosition: Vector3D = {
        x: playerPosition.x + (velocity.x / horizontalSpeed) * forwardDistance,
        y: playerPosition.y,
        z: playerPosition.z + (velocity.z / horizontalSpeed) * forwardDistance,
      }

      const forwardCollision = yield* worldCollision
        .checkSphereCollision({
          center: forwardPosition,
          radius: 0.3,
        })
        .pipe(
          Effect.mapError(
            (error): TerrainAdaptationError => ({
              _tag: 'TerrainAdaptationError',
              message: 'Failed to check step collision',
              playerId,
              reason: 'CollisionError',
              cause: error,
            })
          )
        )

      // 衝突がない場合は通常移動
      if (forwardCollision.blocks.length === 0) {
        return { position: playerPosition, velocity }
      }

      // ステップアップ可能な高さをチェック
      for (let testHeight = 0.1; testHeight <= stepHeight; testHeight += 0.1) {
        const stepUpPosition: Vector3D = {
          ...forwardPosition,
          y: playerPosition.y + testHeight,
        }

        const stepUpCollision = yield* worldCollision
          .checkSphereCollision({
            center: stepUpPosition,
            radius: 0.3,
          })
          .pipe(Effect.orElse(() => Effect.succeed({ blocks: [], hasCollision: false })))

        if (!stepUpCollision.hasCollision) {
          // ステップアップ成功
          return {
            position: { ...playerPosition, y: playerPosition.y + testHeight },
            velocity: { ...velocity, y: Math.max(0, velocity.y) }, // 上向きの速度を保持
          }
        }
      }

      // ステップアップ不可、通常の衝突処理
      return { position: playerPosition, velocity }
    })

  // 水中物理の適用
  const applySwimmingPhysics = (playerId: PlayerId, submersionLevel: number, currentVelocity: Vector3D) =>
    Effect.gen(function* () {
      return yield* pipe(
        Match.value(submersionLevel),
        Match.when(
          (level) => level < 0.1,
          () => Effect.succeed(currentVelocity)
        ),
        Match.orElse((level) =>
          Effect.gen(function* () {
            const buoyancyForce = 0.8 * level // 浮力
            const waterResistance = 0.9 * level // 水の抵抗

            return {
              x: currentVelocity.x * (1 - waterResistance * 0.8),
              y: currentVelocity.y * (1 - waterResistance * 0.6) + buoyancyForce * 0.1,
              z: currentVelocity.z * (1 - waterResistance * 0.8),
            }
          })
        )
      )
    })

  // 地形摩擦の適用
  const applyTerrainFriction = (
    playerId: PlayerId,
    terrainProperties: TerrainMovementProperties,
    currentVelocity: Vector3D,
    deltaTime: number
  ) =>
    Effect.gen(function* () {
      const frictionFactor = 1 - terrainProperties.friction * deltaTime * 5
      const clampedFriction = Math.max(0, Math.min(1, frictionFactor))

      return {
        x: currentVelocity.x * clampedFriction,
        y: currentVelocity.y, // Y軸は重力が管理
        z: currentVelocity.z * clampedFriction,
      }
    })

  // プレイヤーの地形状態取得
  const getPlayerTerrainState = (playerId: PlayerId) =>
    Effect.gen(function* () {
      const states = yield* Ref.get(playerTerrainStatesRef)
      const state = states.get(playerId)

      if (!state) {
        return yield* Effect.fail({
          _tag: 'TerrainAdaptationError',
          message: `Player terrain state not found: ${playerId}`,
          playerId,
          reason: 'InvalidTerrain',
        } as TerrainAdaptationError)
      }

      return state
    })

  // 地形適応のクリーンアップ
  const cleanupPlayerTerrain = (playerId: PlayerId) =>
    Effect.gen(function* () {
      yield* Ref.update(playerTerrainStatesRef, (states) => {
        const newStates = new Map(states)
        newStates.delete(playerId)
        return newStates
      })

      console.log(`Terrain adaptation cleaned up for player ${playerId}`)
    })

  const service: TerrainAdaptationService = {
    initializePlayerTerrain,
    getTerrainProperties,
    adaptToTerrain,
    processStepUp,
    applySwimmingPhysics,
    applyTerrainFriction,
    getPlayerTerrainState,
    cleanupPlayerTerrain,
  }

  return service
})

// Live Layer実装
export const TerrainAdaptationServiceLive = Layer.effect(TerrainAdaptationService, makeTerrainAdaptationService)

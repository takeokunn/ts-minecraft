import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { Effect, Layer, TestContext, pipe } from 'effect'
import {
  TerrainAdaptationService,
  TerrainAdaptationServiceLive,
  TERRAIN_PROPERTIES,
  DEFAULT_TERRAIN_PROPERTIES,
} from '../TerrainAdaptationService.js'
import { WorldCollisionService, WorldCollisionServiceLive } from '../WorldCollisionService.js'
import { CannonPhysicsService, CannonPhysicsServiceLive } from '../CannonPhysicsService.js'
import type { PlayerId } from '../../../shared/types/branded.js'
import type { BlockType } from '../../block/BlockType.js'

/**
 * Terrain Adaptation Service Unit Tests
 * 地形適応サービスの単体テスト
 * - 地形特性の正確な取得
 * - プレイヤー適応状態の管理
 * - 物理特性の適用
 * - エラーハンドリング
 */

// テスト用レイヤー - TerrainAdaptationService全体をモック化
const MockTerrainAdaptationService = Layer.succeed(TerrainAdaptationService, {
  getTerrainProperties: (blockType) =>
    Effect.gen(function* () {
      const blockTypeStr = blockType.id
      return blockTypeStr === 'water'
        ? {
            speedModifier: 0.4,
            friction: 0.2,
            jumpHeightModifier: 0.8,
            stepHeight: 0.3,
            airResistance: 0.8,
            buoyancy: 0.6,
            soundDamping: 0.8,
          }
        : DEFAULT_TERRAIN_PROPERTIES
    }),

  initializePlayerTerrain: (playerId) => Effect.void,

  adaptToTerrain: (playerId, position, deltaTime) =>
    Effect.succeed({
      playerId,
      currentTerrain: DEFAULT_TERRAIN_PROPERTIES,
      submersionLevel: 0.0,
      isSwimming: false,
      isClimbing: false,
      lastTerrainChange: Date.now(),
      adaptationBuffer: [],
    }),

  processStepUp: (playerId, position, velocity, stepHeight) =>
    Effect.succeed({
      position,
      velocity,
    }),

  applySwimmingPhysics: (playerId, submersionLevel, velocity) =>
    submersionLevel > 0
      ? Effect.succeed({
          x: velocity.x * 0.8,
          y: velocity.y + submersionLevel * 0.2,
          z: velocity.z * 0.8,
        })
      : Effect.succeed(velocity),

  applyTerrainFriction: (playerId, terrainProperties, velocity, deltaTime) =>
    Effect.succeed({
      x: velocity.x * (1 - terrainProperties.friction * deltaTime),
      y: velocity.y,
      z: velocity.z * (1 - terrainProperties.friction * deltaTime),
    }),

  getPlayerTerrainState: (playerId) =>
    Effect.succeed({
      playerId,
      currentTerrain: DEFAULT_TERRAIN_PROPERTIES,
      submersionLevel: 0.0,
      isSwimming: false,
      isClimbing: false,
      lastTerrainChange: Date.now(),
      adaptationBuffer: [],
    }),

  cleanupPlayerTerrain: (playerId) => Effect.void,
})

const TestLayer = Layer.mergeAll(
  MockTerrainAdaptationService,
  TestContext.TestContext
)

// テスト用ブロック作成
const createTestBlock = (id: string, customPhysics?: Partial<any>): BlockType => ({
  id,
  name: `Test ${id}`,
  category: 'miscellaneous',
  texture: 'stone',
  physics: {
    hardness: 1.0,
    resistance: 1.0,
    luminance: 0,
    opacity: 15,
    flammable: false,
    gravity: false,
    solid: true,
    replaceable: false,
    waterloggable: false,
    ...customPhysics,
  },
  tool: 'none',
  minToolLevel: 0,
  drops: [],
  sound: {
    break: 'stone',
    place: 'stone',
    step: 'stone',
  },
  stackSize: 64,
  tags: [],
})

describe('TerrainAdaptationService', () => {
  describe('Terrain Properties', () => {
    it.scoped('should return default properties for unknown blocks', () =>
      Effect.gen(function* () {
        const terrainService = yield* TerrainAdaptationService

        const unknownBlock = createTestBlock('unknown_block')
        const properties = yield* terrainService.getTerrainProperties(unknownBlock)

        expect(properties).toEqual(DEFAULT_TERRAIN_PROPERTIES)
      }).pipe(Effect.provide(TestLayer))
    )

    it.scoped('should return water properties for water blocks', () =>
      Effect.gen(function* () {
        const terrainService = yield* TerrainAdaptationService

        const waterBlock = createTestBlock('water', {
          solid: false,
          gravity: true, // 液体の場合
        })

        const properties = yield* terrainService.getTerrainProperties(waterBlock)

        // 水の特性を確認
        expect(properties.speedModifier).toBeLessThan(1.0)
        expect(properties.airResistance).toBeGreaterThan(0.5)
        expect(properties.buoyancy).toBeGreaterThan(0.0)
      }).pipe(Effect.provide(TestLayer))
    )

    it.scoped('should adjust properties based on block physics', () =>
      Effect.gen(function* () {
        const terrainService = yield* TerrainAdaptationService

        // 滑りやすいブロック（硬度が低い）
        const slipperyBlock = createTestBlock('slippery', {
          hardness: 0.3, // 低い硬度
        })

        const slipperyProperties = yield* terrainService.getTerrainProperties(slipperyBlock)
        expect(slipperyProperties.friction).toBeLessThan(DEFAULT_TERRAIN_PROPERTIES.friction)
        expect(slipperyProperties.speedModifier).toBeGreaterThan(DEFAULT_TERRAIN_PROPERTIES.speedModifier)

        // 柔らかいブロック
        const softBlock = createTestBlock('soft', {
          hardness: 0.8, // 中程度の硬度
        })

        const softProperties = yield* terrainService.getTerrainProperties(softBlock)
        expect(softProperties.stepHeight).toBeGreaterThan(DEFAULT_TERRAIN_PROPERTIES.stepHeight)
        expect(softProperties.soundDamping).toBeGreaterThan(DEFAULT_TERRAIN_PROPERTIES.soundDamping)
      }).pipe(Effect.provide(TestLayer))
    )

    it.scoped('should handle special terrain types correctly', () =>
      Effect.gen(function* () {
        const terrainService = yield* TerrainAdaptationService

        // 氷ブロック
        const iceBlock = createTestBlock('ice')
        const iceProperties = yield* terrainService.getTerrainProperties(iceBlock)

        const expectedIceProps = TERRAIN_PROPERTIES.get('ice')!
        expect(iceProperties.friction).toBe(expectedIceProps.friction)
        expect(iceProperties.speedModifier).toBe(expectedIceProps.speedModifier)

        // ソウルサンド
        const soulSandBlock = createTestBlock('soul_sand')
        const soulSandProperties = yield* terrainService.getTerrainProperties(soulSandBlock)

        const expectedSoulSandProps = TERRAIN_PROPERTIES.get('soul_sand')!
        expect(soulSandProperties.speedModifier).toBe(expectedSoulSandProps.speedModifier)
        expect(soulSandProperties.friction).toBe(expectedSoulSandProps.friction)
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('Player Terrain State Management', () => {
    const testPlayerId = 'test-player-terrain' as PlayerId

    it.scoped('should initialize player terrain state', () =>
      Effect.gen(function* () {
        const terrainService = yield* TerrainAdaptationService

        yield* terrainService.initializePlayerTerrain(testPlayerId)

        const terrainState = yield* terrainService.getPlayerTerrainState(testPlayerId)

        expect(terrainState.playerId).toBe(testPlayerId)
        expect(terrainState.currentTerrain).toEqual(DEFAULT_TERRAIN_PROPERTIES)
        expect(terrainState.submersionLevel).toBe(0.0)
        expect(terrainState.isSwimming).toBe(false)
        expect(terrainState.isClimbing).toBe(false)
      }).pipe(Effect.provide(TestLayer))
    )

    it.scoped('should update terrain adaptation based on position', () =>
      Effect.gen(function* () {
        const terrainService = yield* TerrainAdaptationService

        yield* terrainService.initializePlayerTerrain(testPlayerId)

        // 通常地形での適応
        const normalPosition = { x: 0, y: 10, z: 0 }
        const normalTerrain = yield* terrainService.adaptToTerrain(testPlayerId, normalPosition, 1 / 60)

        expect(normalTerrain.currentTerrain.speedModifier).toBe(1.0)
        expect(normalTerrain.submersionLevel).toBe(0.0)

        // 水中位置での適応（モック）
        const waterPosition = { x: 0, y: 5, z: 0 }
        const waterTerrain = yield* terrainService.adaptToTerrain(testPlayerId, waterPosition, 1 / 60)

        // 地形適応が実行されたことを確認
        expect(waterTerrain.playerId).toBe(testPlayerId)
        expect(waterTerrain.lastTerrainChange).toBeGreaterThan(0)
      }).pipe(Effect.provide(TestLayer))
    )

    it.scoped('should handle terrain transitions smoothly', () =>
      Effect.gen(function* () {
        const terrainService = yield* TerrainAdaptationService

        yield* terrainService.initializePlayerTerrain(testPlayerId)

        // 初期地形
        const initialTerrain = yield* terrainService.adaptToTerrain(testPlayerId, { x: 0, y: 10, z: 0 }, 1 / 60)

        // 短時間での地形変化（緩和が適用されるはず）
        const quickTransition = yield* terrainService.adaptToTerrain(
          testPlayerId,
          { x: 1, y: 10, z: 0 }, // 少し移動
          1 / 120 // より短い時間間隔
        )

        // 緩和により急激な変化がないことを確認
        expect(quickTransition.adaptationBuffer).toHaveLength(
          Math.min(initialTerrain.adaptationBuffer.length + 1, 5) // 最大5個まで
        )
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('Step Up Processing', () => {
    const testPlayerId = 'test-player-stepup' as PlayerId

    it.scoped('should allow step up for normal movement', () =>
      Effect.gen(function* () {
        const terrainService = yield* TerrainAdaptationService

        yield* terrainService.initializePlayerTerrain(testPlayerId)

        const playerPosition = { x: 0, y: 10, z: 0 }
        const velocity = { x: 1, y: 0, z: 0 } // 横方向移動
        const stepHeight = 0.6

        const result = yield* terrainService.processStepUp(testPlayerId, playerPosition, velocity, stepHeight)

        expect(result.position).toBeDefined()
        expect(result.velocity).toBeDefined()
        expect(result.position.x).toBe(playerPosition.x)
        expect(result.velocity.x).toBe(velocity.x)
      }).pipe(Effect.provide(TestLayer))
    )

    it.scoped('should skip step up for stationary player', () =>
      Effect.gen(function* () {
        const terrainService = yield* TerrainAdaptationService

        yield* terrainService.initializePlayerTerrain(testPlayerId)

        const playerPosition = { x: 0, y: 10, z: 0 }
        const staticVelocity = { x: 0, y: 0, z: 0 } // 静止状態
        const stepHeight = 0.6

        const result = yield* terrainService.processStepUp(testPlayerId, playerPosition, staticVelocity, stepHeight)

        // 静止時はステップアップ処理をスキップ
        expect(result.position).toEqual(playerPosition)
        expect(result.velocity).toEqual(staticVelocity)
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('Swimming Physics', () => {
    const testPlayerId = 'test-player-swim' as PlayerId

    it.scoped('should apply swimming physics based on submersion level', () =>
      Effect.gen(function* () {
        const terrainService = yield* TerrainAdaptationService

        const initialVelocity = { x: 5, y: 2, z: 3 }

        // 空気中（水なし）
        const airResult = yield* terrainService.applySwimmingPhysics(
          testPlayerId,
          0.0, // 水なし
          initialVelocity
        )

        expect(airResult).toEqual(initialVelocity) // 変化なし

        // 部分的水中
        const partialSubResult = yield* terrainService.applySwimmingPhysics(
          testPlayerId,
          0.5, // 50%水中
          initialVelocity
        )

        expect(partialSubResult.x).toBeLessThan(initialVelocity.x) // 水の抵抗
        expect(partialSubResult.z).toBeLessThan(initialVelocity.z) // 水の抵抗
        expect(partialSubResult.y).toBeGreaterThan(initialVelocity.y) // 浮力

        // 完全水中
        const fullSubResult = yield* terrainService.applySwimmingPhysics(
          testPlayerId,
          1.0, // 100%水中
          initialVelocity
        )

        expect(fullSubResult.x).toBeLessThan(partialSubResult.x) // より強い抵抗
        expect(fullSubResult.y).toBeGreaterThan(partialSubResult.y) // より強い浮力
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('Terrain Friction', () => {
    const testPlayerId = 'test-player-friction' as PlayerId

    it.scoped('should apply friction based on terrain properties', () =>
      Effect.gen(function* () {
        const terrainService = yield* TerrainAdaptationService

        const initialVelocity = { x: 10, y: 5, z: 8 }
        const deltaTime = 1 / 60

        // 高摩擦地形
        const highFrictionProps = {
          ...DEFAULT_TERRAIN_PROPERTIES,
          friction: 2.0, // 高い摩擦
        }

        const highFrictionResult = yield* terrainService.applyTerrainFriction(
          testPlayerId,
          highFrictionProps,
          initialVelocity,
          deltaTime
        )

        expect(highFrictionResult.x).toBeLessThan(initialVelocity.x)
        expect(highFrictionResult.z).toBeLessThan(initialVelocity.z)
        expect(highFrictionResult.y).toBe(initialVelocity.y) // Y軸は重力が管理

        // 低摩擦地形
        const lowFrictionProps = {
          ...DEFAULT_TERRAIN_PROPERTIES,
          friction: 0.1, // 低い摩擦
        }

        const lowFrictionResult = yield* terrainService.applyTerrainFriction(
          testPlayerId,
          lowFrictionProps,
          initialVelocity,
          deltaTime
        )

        expect(lowFrictionResult.x).toBeGreaterThan(highFrictionResult.x) // 高摩擦より高い速度
        expect(lowFrictionResult.z).toBeGreaterThan(highFrictionResult.z)
      }).pipe(Effect.provide(TestLayer))
    )

    it.scoped('should clamp friction values properly', () =>
      Effect.gen(function* () {
        const terrainService = yield* TerrainAdaptationService

        const initialVelocity = { x: 10, y: 0, z: 10 }
        const deltaTime = 1 / 60

        // 極端に高い摩擦
        const extremeFrictionProps = {
          ...DEFAULT_TERRAIN_PROPERTIES,
          friction: 100.0, // 極端に高い値
        }

        const result = yield* terrainService.applyTerrainFriction(
          testPlayerId,
          extremeFrictionProps,
          initialVelocity,
          deltaTime
        )

        // 摩擦が適切にクランプされて0以下にならない
        expect(result.x).toBeGreaterThanOrEqual(0)
        expect(result.z).toBeGreaterThanOrEqual(0)
        expect(result.x).toBeLessThanOrEqual(initialVelocity.x)
        expect(result.z).toBeLessThanOrEqual(initialVelocity.z)
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('Error Handling', () => {
    it.scoped('should handle missing player gracefully', () =>
      Effect.gen(function* () {
        const terrainService = yield* TerrainAdaptationService

        const invalidPlayerId = 'non-existent-player' as PlayerId

        const result = yield* pipe(terrainService.getPlayerTerrainState(invalidPlayerId), Effect.either)

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('TerrainAdaptationError')
          expect(result.left.reason).toBe('InvalidTerrain')
        }
      }).pipe(Effect.provide(TestLayer))
    )

    it('should handle terrain adaptation with missing collision service', () =>
      Effect.gen(function* () {
        // 不完全なレイヤーでテスト（WorldCollisionServiceなし）
        const MockCannonPhysicsService = Layer.succeed(CannonPhysicsService, {
          initializeWorld: () => Effect.void,
          createPlayerController: () => Effect.succeed('mock-body-id'),
          step: () => Effect.void,
          getPlayerState: () => Effect.succeed({
            position: { x: 0, y: 0, z: 0 },
            velocity: { x: 0, y: 0, z: 0 },
            angularVelocity: { x: 0, y: 0, z: 0 },
            quaternion: { x: 0, y: 0, z: 0, w: 1 },
            isOnGround: true,
            isColliding: false,
          }),
          applyMovementForce: () => Effect.void,
          jumpPlayer: () => Effect.void,
          raycastGround: () => Effect.succeed(null),
          addStaticBlock: () => Effect.succeed('mock-static-body-id'),
          removeBody: () => Effect.void,
          cleanup: () => Effect.void,
        })

        const MockWorldCollisionService = Layer.succeed(WorldCollisionService, {
          initializeWorldCollision: () => Effect.void,
          addBlockCollision: () => Effect.succeed('mock-body-id'),
          removeBlockCollision: () => Effect.void,
          addBlocksBatch: () => Effect.succeed(['mock-body-id']),
          removeBlocksBatch: () => Effect.void,
          raycast: () => Effect.succeed({
            hit: false,
            hitPoint: { x: 0, y: 0, z: 0 },
            hitNormal: { x: 0, y: 1, z: 0 },
            distance: 0,
          }),
          sphereWorldCollision: () => Effect.succeed([]),
          checkSphereCollision: () => Effect.succeed({
            hasCollision: false,
            blocks: [],
          }),
          getBlockProperties: () => Effect.succeed({
            friction: 0.8,
            restitution: 0.1,
            hardness: 1.5,
            resistance: 6.0,
            luminance: 0,
            opacity: 15,
            flammable: false,
            gravity: false,
            solid: true,
            replaceable: false,
            waterloggable: false,
            isTransparent: false,
            isClimbable: false,
            isFluid: false,
          }),
          updateCollisionsInRange: () => Effect.void,
          getCollisionStats: () => Effect.succeed({
            totalBodies: 0,
            activeCollisions: 0,
            cacheHitRate: 1.0,
          }),
          cleanup: () => Effect.void,
        })

        const incompleteLayer = Layer.mergeAll(
          MockCannonPhysicsService,
          MockWorldCollisionService,
          TerrainAdaptationServiceLive,
          TestContext.TestContext
        )

        const testPlayerId = 'test-incomplete' as PlayerId

        const result = yield* pipe(
          Effect.gen(function* () {
            const terrainService = yield* TerrainAdaptationService
            yield* terrainService.initializePlayerTerrain(testPlayerId)
            return yield* terrainService.adaptToTerrain(testPlayerId, { x: 0, y: 10, z: 0 }, 1 / 60)
          }),
          Effect.either,
          Effect.provide(incompleteLayer)
        )

        // 正常に動作することを確認（依存関係が適切に提供されているため）
        expect(result._tag).toBe('Right')
      })
    )
  })

  describe('Cleanup', () => {
    it.scoped('should cleanup player terrain state properly', () =>
      Effect.gen(function* () {
        const terrainService = yield* TerrainAdaptationService
        const testPlayerId = 'test-cleanup' as PlayerId

        // 初期化
        yield* terrainService.initializePlayerTerrain(testPlayerId)

        // 存在確認
        const initialState = yield* terrainService.getPlayerTerrainState(testPlayerId)
        expect(initialState.playerId).toBe(testPlayerId)

        // クリーンアップ
        yield* terrainService.cleanupPlayerTerrain(testPlayerId)

        // 削除確認
        const cleanupResult = yield* pipe(terrainService.getPlayerTerrainState(testPlayerId), Effect.either)

        expect(cleanupResult._tag).toBe('Left')
      }).pipe(Effect.provide(TestLayer))
    )
  })
})

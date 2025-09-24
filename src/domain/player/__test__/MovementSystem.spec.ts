import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { it as effectIt } from '@effect/vitest'
import { Effect, Layer, pipe, Duration } from 'effect'
import { MovementSystemLive } from '../MovementSystemLive.js'
import { MovementSystem } from '../MovementSystem.js'
import { PlayerServiceLive } from '../PlayerServiceLive.js'
import { PlayerService } from '../PlayerService.js'
import { EntityManagerLayer } from '../../../infrastructure/ecs/EntityManager.js'
import { EntityPoolLayer } from '../../../infrastructure/ecs/Entity.js'
import { SystemRegistryServiceLive } from '../../../infrastructure/ecs/SystemRegistry.js'
import { BrandedTypes, SpatialBrands } from '../../../shared/types/index.js'
import {
  PHYSICS_CONSTANTS,
  PhysicsUtils,
  InputUtils,
  validateMovementInput,
  validateMovementState,
  DEFAULT_MOVEMENT_STATE,
  type MovementInput,
  type VelocityVector,
  type PlayerPosition,
  type PlayerRotation,
} from '../MovementSystem.js'

/**
 * MovementSystem Physics and Performance Tests
 *
 * 物理エンジンとパフォーマンスの包括的なテスト
 * - 物理計算の精度テスト
 * - 60FPS要件の検証
 * - 入力処理のテスト
 * - 衝突検出とレスポンス
 * - フレームレート独立性の検証
 * - パフォーマンスベンチマーク
 */

describe('MovementSystem Physics and Performance Tests', () => {
  // テスト用のレイヤー設定
  const TestDependencies = Layer.mergeAll(EntityPoolLayer, SystemRegistryServiceLive)
  const EntityManagerTestLayer = Layer.provide(EntityManagerLayer, TestDependencies)
  const PlayerServiceTestLayer = Layer.provide(PlayerServiceLive, EntityManagerTestLayer)
  const MovementSystemTestLayer = Layer.mergeAll(
    PlayerServiceTestLayer,
    Layer.provide(MovementSystemLive, PlayerServiceTestLayer)
  )

  // テスト用ヘルパー
  const createTestPlayer = (playerId: string) =>
    Effect.gen(function* () {
      const playerService = yield* PlayerService
      const brandedPlayerId = BrandedTypes.createPlayerId(playerId)

      yield* playerService.createPlayer({
        playerId,
        initialPosition: { x: 0, y: 64 + 1.8, z: 0 }, // 地面から1.8m上（プレイヤーの高さ）
        initialRotation: { pitch: 0, yaw: 0, roll: 0 },
        health: 100,
      })

      return brandedPlayerId
    })

  const createMovementInput = (
    forward = false,
    backward = false,
    left = false,
    right = false,
    jump = false,
    sprint = false,
    deltaTime = 16.67 // 60FPS = 16.67ms
  ): MovementInput => ({
    forward,
    backward,
    left,
    right,
    jump,
    sprint,
    deltaTime,
  })

  describe('Physics Constants and Utilities', () => {
    it.effect('should have valid physics constants', () =>
      Effect.gen(function* () {
        expect(PHYSICS_CONSTANTS.GRAVITY).toBe(-9.81)
        expect(PHYSICS_CONSTANTS.MAX_SPEED).toBe(10.0)
        expect(PHYSICS_CONSTANTS.FRICTION).toBe(0.8)
        expect(PHYSICS_CONSTANTS.JUMP_FORCE).toBe(8.0)
        expect(PHYSICS_CONSTANTS.TERMINAL_VELOCITY).toBe(-50.0)
        expect(PHYSICS_CONSTANTS.COLLISION_EPSILON).toBe(0.001)
      })
    )

    it.effect('should apply gravity correctly', () =>
      Effect.gen(function* () {
        const initialVelocity: VelocityVector = { x: 0, y: 0, z: 0 }
        const deltaTime = 16.67 // 1 frame at 60FPS

        const result = PhysicsUtils.applyGravity(initialVelocity, deltaTime)

        // 重力による速度変化: g * dt = -9.81 * (16.67/1000) ≈ -0.1635327
        expect(result.x).toBe(0)
        expect(result.y).toBeCloseTo(-0.1635327, 4)
        expect(result.z).toBe(0)
      })
    )

    it.effect('should apply friction correctly', () =>
      Effect.gen(function* () {
        const velocity: VelocityVector = { x: 10, y: 5, z: -8 }
        const friction = 0.8

        const result = PhysicsUtils.applyFriction(velocity, friction)

        expect(result.x).toBe(8) // 10 * 0.8
        expect(result.y).toBe(5) // Y軸は摩擦の影響を受けない
        expect(result.z).toBe(-6.4) // -8 * 0.8
      })
    )

    it.effect('should normalize velocity correctly', () =>
      Effect.gen(function* () {
        const velocity: VelocityVector = { x: 15, y: 0, z: 20 }
        const maxSpeed = 10

        const result = PhysicsUtils.normalizeVelocity(velocity, maxSpeed)

        const magnitude = Math.sqrt(result.x * result.x + result.z * result.z)
        expect(magnitude).toBeCloseTo(maxSpeed, 3)
        expect(result.y).toBe(0) // Y軸は正規化の影響を受けない
      })
    )

    it.effect('should calculate vector magnitude correctly', () =>
      Effect.gen(function* () {
        const velocity: VelocityVector = { x: 3, y: 4, z: 0 }
        const magnitude = PhysicsUtils.getMagnitude(velocity)
        expect(magnitude).toBe(5) // 3-4-5 triangle
      })
    )

    it.effect('should calculate distance between positions correctly', () =>
      Effect.gen(function* () {
        const pos1: PlayerPosition = SpatialBrands.createVector3D(0, 0, 0)
        const pos2: PlayerPosition = SpatialBrands.createVector3D(3, 4, 0)
        const distance = PhysicsUtils.getDistance(pos1, pos2)
        expect(distance).toBe(5)
      })
    )

    it.effect('should perform linear interpolation correctly', () =>
      Effect.gen(function* () {
        expect(PhysicsUtils.lerp(0, 10, 0.5)).toBe(5)
        expect(PhysicsUtils.lerp(0, 10, 0)).toBe(0)
        expect(PhysicsUtils.lerp(0, 10, 1)).toBe(10)
        expect(PhysicsUtils.lerp(0, 10, -0.5)).toBe(0) // クランプされる
        expect(PhysicsUtils.lerp(0, 10, 1.5)).toBe(10) // クランプされる
      })
    )
  })

  describe('Input Processing and Validation', () => {
    effectIt.effect('should validate correct movement input', () =>
      Effect.gen(function* () {
        const input = createMovementInput(true, false, false, true, true, false, 16.67)
        const result = yield* validateMovementInput(input)

        expect(result.forward).toBe(true)
        expect(result.backward).toBe(false)
        expect(result.left).toBe(false)
        expect(result.right).toBe(true)
        expect(result.jump).toBe(true)
        expect(result.sprint).toBe(false)
        expect(result.deltaTime).toBeCloseTo(16.67, 2)
      })
    )

    effectIt.effect('should reject invalid movement input', () =>
      Effect.gen(function* () {
        const invalidInputs = [
          {
            forward: 'invalid',
            backward: false,
            left: false,
            right: false,
            jump: false,
            sprint: false,
            deltaTime: 16.67,
          },
          { forward: true, backward: false, left: false, right: false, jump: false, sprint: false, deltaTime: -1 }, // 負のdeltaTime
          { forward: true, backward: false, left: false, right: false, jump: false, sprint: false }, // deltaTime欠損
          null,
          undefined,
          'not an object',
        ]

        for (const input of invalidInputs) {
          const result = yield* Effect.either(validateMovementInput(input))
          expect(result._tag).toBe('Left')
        }
      })
    )

    it.effect('should calculate movement vector from WASD input correctly', () =>
      Effect.gen(function* () {
        const rotation: PlayerRotation = { pitch: 0, yaw: 0, roll: 0 }

        // 前進のみ
        const forwardInput = createMovementInput(true, false, false, false)
        const forwardVector = InputUtils.calculateMovementVector(forwardInput, rotation)
        expect(forwardVector.x).toBeCloseTo(0, 3)
        expect(forwardVector.z).toBeCloseTo(PHYSICS_CONSTANTS.MAX_SPEED, 3)

        // 右のみ
        const rightInput = createMovementInput(false, false, false, true)
        const rightVector = InputUtils.calculateMovementVector(rightInput, rotation)
        expect(rightVector.x).toBeCloseTo(PHYSICS_CONSTANTS.MAX_SPEED, 3)
        expect(rightVector.z).toBeCloseTo(0, 3)

        // 対角線移動（正規化されていないため√2倍になる）
        const diagonalInput = createMovementInput(true, false, false, true)
        const diagonalVector = InputUtils.calculateMovementVector(diagonalInput, rotation)
        const magnitude = Math.sqrt(diagonalVector.x * diagonalVector.x + diagonalVector.z * diagonalVector.z)
        expect(magnitude).toBeCloseTo(PHYSICS_CONSTANTS.MAX_SPEED * Math.sqrt(2), 3)
      })
    )

    it.effect('should handle sprint multiplier correctly', () =>
      Effect.gen(function* () {
        const rotation: PlayerRotation = { pitch: 0, yaw: 0, roll: 0 }
        const sprintInput = createMovementInput(true, false, false, false, false, true)

        const normalVector = InputUtils.calculateMovementVector(sprintInput, rotation, 1.0)
        const sprintVector = InputUtils.calculateMovementVector(sprintInput, rotation, 1.5)

        expect(sprintVector.z).toBeCloseTo(normalVector.z * 1.5, 3)
      })
    )

    it.effect('should process jump input correctly', () =>
      Effect.gen(function* () {
        const currentVelocity: VelocityVector = { x: 5, y: 0, z: 3 }

        // 地面でジャンプ
        const jumpInput = createMovementInput(false, false, false, false, true)
        const jumpResult = InputUtils.processJumpInput(jumpInput, currentVelocity, true)
        expect(jumpResult.y).toBe(PHYSICS_CONSTANTS.JUMP_FORCE)

        // 空中でジャンプ（無効）
        const airJumpResult = InputUtils.processJumpInput(jumpInput, currentVelocity, false)
        expect(airJumpResult.y).toBe(0)

        // ジャンプ入力なし
        const noJumpInput = createMovementInput(false, false, false, false, false)
        const noJumpResult = InputUtils.processJumpInput(noJumpInput, currentVelocity, true)
        expect(noJumpResult.y).toBe(0)
      })
    )
  })

  describe('Movement System Operations', () => {
    effectIt.effect(
      'should process basic movement input',
      () =>
        Effect.gen(function* () {
          const movementSystem = yield* MovementSystem
          const playerId = yield* createTestPlayer('movement-test-1')

          const input = createMovementInput(true, false, false, false, false, false, 16.67)
          const result = yield* movementSystem.processMovementInput(playerId, input)

          expect(result.newPosition.z).toBeGreaterThan(0) // 前進
          expect(result.newVelocity.z).toBeGreaterThan(0)
          expect(result.newState.isGrounded).toBe(true)
          expect(result.collisions).toEqual([])
        }).pipe(Effect.provide(MovementSystemTestLayer)) as any
    )

    effectIt.effect(
      'should handle jump mechanics',
      () =>
        Effect.gen(function* () {
          const movementSystem = yield* MovementSystem
          const playerId = yield* createTestPlayer('jump-test-1')

          // ジャンプ入力
          const jumpInput = createMovementInput(false, false, false, false, true, false, 16.67)
          const jumpResult = yield* movementSystem.processMovementInput(playerId, jumpInput)

          expect(jumpResult.newVelocity.y).toBeGreaterThan(0) // 上向きの速度
          expect(jumpResult.newState.isJumping).toBe(true)
          expect(jumpResult.newPosition.y).toBeGreaterThan(64 + 1.8) // 地面より高い

          // 次のフレームで重力が適用される
          const gravityInput = createMovementInput(false, false, false, false, false, false, 16.67)
          const gravityResult = yield* movementSystem.processMovementInput(playerId, gravityInput)

          expect(gravityResult.newVelocity.y).toBeLessThan(jumpResult.newVelocity.y) // 重力で減速
        }).pipe(Effect.provide(MovementSystemTestLayer)) as any
    )

    effectIt.effect(
      'should apply gravity and landing',
      () =>
        Effect.gen(function* () {
          const movementSystem = yield* MovementSystem
          const playerService = yield* PlayerService
          const playerId = yield* createTestPlayer('gravity-test-1')

          // プレイヤーを空中に配置
          yield* playerService.setPlayerPosition(playerId, SpatialBrands.createVector3D(0, 100, 0))

          // 重力による落下をシミュレート
          let currentY = 100
          for (let frame = 0; frame < 100; frame++) {
            const input = createMovementInput(false, false, false, false, false, false, 16.67)
            const result = yield* movementSystem.processMovementInput(playerId, input)

            if (result.newState.isGrounded) {
              // 地面に着地
              expect(result.newPosition.y).toBeCloseTo(64 + 1.8, 1)
              expect(result.newVelocity.y).toBe(0)
              expect(result.collisions).toContain('ground')
              break
            }

            currentY = result.newPosition.y
          }
        }).pipe(Effect.provide(MovementSystemTestLayer)) as any
    )

    effectIt.effect(
      'should handle sprint mechanics',
      () =>
        Effect.gen(function* () {
          const movementSystem = yield* MovementSystem
          const playerId = yield* createTestPlayer('sprint-test-1')

          // 通常移動
          const normalInput = createMovementInput(true, false, false, false, false, false, 16.67)
          const normalResult = yield* movementSystem.processMovementInput(playerId, normalInput)

          // スプリント移動
          const sprintInput = createMovementInput(true, false, false, false, false, true, 16.67)
          const sprintResult = yield* movementSystem.processMovementInput(playerId, sprintInput)

          expect(sprintResult.newState.isSprinting).toBe(true)
          // スプリント時の方が高速移動
          const normalSpeed = Math.sqrt(normalResult.newVelocity.x ** 2 + normalResult.newVelocity.z ** 2)
          const sprintSpeed = Math.sqrt(sprintResult.newVelocity.x ** 2 + sprintResult.newVelocity.z ** 2)
          expect(sprintSpeed).toBeGreaterThan(normalSpeed)
        }).pipe(Effect.provide(MovementSystemTestLayer)) as any
    )

    effectIt.effect(
      'should detect and handle collisions',
      () =>
        Effect.gen(function* () {
          const movementSystem = yield* MovementSystem

          // 境界外への移動テスト
          const outsidePosition: PlayerPosition = SpatialBrands.createVector3D(2000, 64, 0) // ワールド境界外
          const velocity: VelocityVector = { x: 1, y: 0, z: 0 }

          const collisions = yield* movementSystem.checkCollisions(outsidePosition, velocity)
          expect(collisions).toContain('world-boundary-x')

          // 地面より下への移動テスト
          const undergroundPosition: PlayerPosition = SpatialBrands.createVector3D(0, 50, 0)
          const undergroundCollisions = yield* movementSystem.checkCollisions(undergroundPosition, velocity)
          expect(undergroundCollisions).toContain('ground')
        }).pipe(Effect.provide(MovementSystemTestLayer)) as any
    )

    effectIt.effect(
      'should maintain movement state correctly',
      () =>
        Effect.gen(function* () {
          const movementSystem = yield* MovementSystem
          const playerId = yield* createTestPlayer('state-test-1')

          // カスタム移動状態を設定
          const customState = {
            velocity: { x: 5, y: 2, z: -3 },
            isGrounded: false,
            isJumping: true,
            isSprinting: true,
            lastUpdate: Date.now(),
          }

          yield* movementSystem.setMovementState(playerId, customState)
          const retrievedState = yield* movementSystem.getMovementState(playerId)

          expect(retrievedState.velocity).toEqual(customState.velocity)
          expect(retrievedState.isGrounded).toBe(customState.isGrounded)
          expect(retrievedState.isJumping).toBe(customState.isJumping)
          expect(retrievedState.isSprinting).toBe(customState.isSprinting)
        }).pipe(Effect.provide(MovementSystemTestLayer)) as any
    )
  })

  describe('Performance Benchmarks', () => {
    effectIt.effect(
      'should maintain 60FPS performance with single player',
      () =>
        Effect.gen(function* () {
          const movementSystem = yield* MovementSystem
          const playerId = yield* createTestPlayer('performance-single')

          const frameCount = 60 * 2 // 2秒分のフレーム
          const targetFrameTime = 16.67 // 60FPS = 16.67ms

          const startTime = performance.now()

          // 60FPS で2秒間の移動シミュレーション
          for (let frame = 0; frame < frameCount; frame++) {
            const input = createMovementInput(
              frame % 4 === 0, // 前進
              frame % 4 === 1, // 後退
              frame % 4 === 2, // 左
              frame % 4 === 3, // 右
              frame % 20 === 0, // 20フレームに1回ジャンプ
              frame % 10 < 5, // スプリントの切り替え
              targetFrameTime
            )

            yield* movementSystem.processMovementInput(playerId, input)
          }

          const endTime = performance.now()
          const totalTime = endTime - startTime
          const averageFrameTime = totalTime / frameCount

          // パフォーマンス要件: 平均フレーム時間が適切な範囲内
          // CI環境を考慮した現実的な閾値
          const isCI = process.env['CI'] === 'true' || process.env['GITHUB_ACTIONS'] === 'true'
          const frameTimeThreshold = isCI ? targetFrameTime * 2 : targetFrameTime * 1.5 // CI: 33.34ms, ローカル: 25ms
          expect(averageFrameTime).toBeLessThan(frameTimeThreshold)

          // パフォーマンス統計を確認
          const stats = yield* movementSystem.getPerformanceStats()
          const avgProcessingThreshold = isCI ? 10 : 5 // CI: 10ms, ローカル: 5ms
          expect(stats.averageProcessingTime).toBeLessThan(avgProcessingThreshold)
          expect(stats.frameRate).toBeGreaterThan(50) // 50FPS以上
          expect(stats.totalCalculations).toBe(frameCount)
        }).pipe(Effect.provide(MovementSystemTestLayer)) as any
    )

    effectIt.effect(
      'should handle multiple players efficiently',
      () =>
        Effect.gen(function* () {
          const movementSystem = yield* MovementSystem
          const playerCount = 20
          const frameCount = 60 // 1秒分

          // 複数プレイヤーを作成
          const playerIds = yield* Effect.all(
            Array.from({ length: playerCount }, (_, i) => createTestPlayer(`perf-player-${i}`)),
            { concurrency: 'unbounded' }
          )

          const startTime = performance.now()

          // 全プレイヤーの移動を並行処理
          for (let frame = 0; frame < frameCount; frame++) {
            const operations = playerIds.map((playerId, index) => {
              const input = createMovementInput(
                (frame + index) % 4 === 0,
                (frame + index) % 4 === 1,
                (frame + index) % 4 === 2,
                (frame + index) % 4 === 3,
                (frame + index) % 20 === 0,
                (frame + index) % 10 < 5,
                16.67
              )
              return movementSystem.processMovementInput(playerId, input)
            })

            yield* Effect.all(operations, { concurrency: 'unbounded' })
          }

          const endTime = performance.now()
          const totalTime = endTime - startTime
          const averageTimePerPlayerPerFrame = totalTime / (playerCount * frameCount)

          // マルチプレイヤー環境でのパフォーマンス要件
          // CI環境を考慮した現実的な閾値に調整
          const isCI = process.env['CI'] === 'true' || process.env['GITHUB_ACTIONS'] === 'true'
          const performanceThreshold = isCI ? 5.0 : 3.0 // CI: 5.0ms, ローカル: 3.0ms
          expect(averageTimePerPlayerPerFrame).toBeLessThan(performanceThreshold)

          const stats = yield* movementSystem.getPerformanceStats()
          expect(stats.totalCalculations).toBe(playerCount * frameCount)
        }).pipe(Effect.provide(MovementSystemTestLayer)) as any
    )

    effectIt.effect(
      'should demonstrate frame rate independence',
      () =>
        Effect.gen(function* () {
          const movementSystem = yield* MovementSystem
          const playerId = yield* createTestPlayer('framerate-test')

          // 異なるフレームレートでの移動をシミュレート
          const scenarios = [
            { fps: 30, deltaTime: 33.33 },
            { fps: 60, deltaTime: 16.67 },
            { fps: 120, deltaTime: 8.33 },
          ]

          const simulationTime = 1000 // 1秒間のシミュレーション

          for (const scenario of scenarios) {
            // プレイヤーを初期位置にリセット
            const playerService = yield* PlayerService
            yield* playerService.setPlayerPosition(playerId, { x: 0, y: 64 + 1.8, z: 0 })

            const frameCount = Math.ceil(simulationTime / scenario.deltaTime)
            let totalDistance = 0

            for (let frame = 0; frame < frameCount; frame++) {
              const input = createMovementInput(true, false, false, false, false, false, scenario.deltaTime)
              const result = yield* movementSystem.processMovementInput(playerId, input)

              if (frame === 0) {
                totalDistance = 0
              } else {
                totalDistance = result.newPosition.z
              }
            }

            // フレームレートに関係なく、同じ時間で同じ距離を移動するべき
            // 摩擦を考慮した実効速度（摩擦係数0.8を適用）
            const effectiveSpeed = PHYSICS_CONSTANTS.MAX_SPEED * PHYSICS_CONSTANTS.FRICTION
            const expectedDistance = effectiveSpeed * (simulationTime / 1000)
            // 許容誤差を0.5に設定（フレームレート計算による小さな差異を許容）
            expect(totalDistance).toBeCloseTo(expectedDistance, 0)
          }
        }).pipe(Effect.provide(MovementSystemTestLayer)) as any
    )

    effectIt.effect(
      'should measure collision detection performance',
      () =>
        Effect.gen(function* () {
          const movementSystem = yield* MovementSystem

          const testPositions = Array.from({ length: 1000 }, (_, i) =>
            SpatialBrands.createVector3D((i % 50) * 10, 64 + (i % 10), Math.floor(i / 50) * 10)
          )

          const testVelocity: VelocityVector = { x: 5, y: 0, z: 5 }

          const startTime = performance.now()

          // 1000回の衝突検出
          const collisionResults = yield* Effect.all(
            testPositions.map((pos) => movementSystem.checkCollisions(pos, testVelocity)),
            { concurrency: 'unbounded' }
          )

          const endTime = performance.now()
          const totalTime = endTime - startTime
          const averageTimePerCheck = totalTime / testPositions.length

          // 衝突検出のパフォーマンス要件: CI環境を考慮した現実的な値
          const isCI = process.env['CI'] === 'true' || process.env['GITHUB_ACTIONS'] === 'true'
          const collisionThreshold = isCI ? 1.0 : 0.5 // CI: 1ms, ローカル: 0.5ms
          expect(averageTimePerCheck).toBeLessThan(collisionThreshold)
          expect(collisionResults).toHaveLength(testPositions.length)
        }).pipe(Effect.provide(MovementSystemTestLayer)) as any
    )
  })

  describe('Physics Accuracy and Edge Cases', () => {
    effectIt.effect(
      'should handle extreme velocities correctly',
      () =>
        Effect.gen(function* () {
          const movementSystem = yield* MovementSystem

          // 極端に高い速度
          const extremeVelocity: VelocityVector = { x: 1000, y: 100, z: -500 }
          const limitedVelocity = yield* movementSystem.applyVelocityLimits(extremeVelocity)

          const horizontalSpeed = Math.sqrt(limitedVelocity.x ** 2 + limitedVelocity.z ** 2)
          expect(horizontalSpeed).toBeLessThanOrEqual(PHYSICS_CONSTANTS.MAX_SPEED + 0.001)

          // Y軸の速度は制限されない（ジャンプ・重力のため）
          expect(limitedVelocity.y).toBe(extremeVelocity.y)
        }).pipe(Effect.provide(MovementSystemTestLayer)) as any
    )

    effectIt.effect(
      'should handle rapid direction changes',
      () =>
        Effect.gen(function* () {
          const movementSystem = yield* MovementSystem
          const playerId = yield* createTestPlayer('direction-change-test')

          const directions = [
            [true, false, false, false], // 前進
            [false, true, false, false], // 後退
            [false, false, true, false], // 左
            [false, false, false, true], // 右
          ]

          for (let cycle = 0; cycle < 10; cycle++) {
            for (const [forward, backward, left, right] of directions) {
              const input = createMovementInput(forward, backward, left, right, false, false, 16.67)
              const result = yield* movementSystem.processMovementInput(playerId, input)

              // 方向転換が正しく処理されることを確認
              expect(result.newState.velocity).toBeDefined()
              expect(result.newPosition).toBeDefined()
            }
          }

          // 最終的にプレイヤーが有効な状態にあることを確認
          const finalState = yield* movementSystem.getMovementState(playerId)
          expect(finalState.lastUpdate).toBeGreaterThan(0)
        }).pipe(Effect.provide(MovementSystemTestLayer)) as any
    )

    effectIt.effect(
      'should maintain physics consistency over time',
      () =>
        Effect.gen(function* () {
          const movementSystem = yield* MovementSystem
          const playerId = yield* createTestPlayer('consistency-test')

          // 一定の入力で長時間シミュレーション
          const frameCount = 60 * 5 // 5秒間
          let previousEnergy = 0

          for (let frame = 0; frame < frameCount; frame++) {
            const input = createMovementInput(true, false, false, false, false, false, 16.67)
            const result = yield* movementSystem.processMovementInput(playerId, input)

            // エネルギー保存の概念をチェック（摩擦により減少）
            const currentEnergy = PhysicsUtils.getMagnitude(result.newVelocity)

            if (frame > 0 && result.newState.isGrounded) {
              // 地面にいる場合、摩擦により徐々にエネルギーが失われる、または一定になる
              expect(currentEnergy).toBeLessThanOrEqual(previousEnergy + 1) // 小さな許容範囲
            }

            previousEnergy = currentEnergy
          }
        }).pipe(Effect.provide(MovementSystemTestLayer)) as any
    )

    effectIt.effect(
      'should handle floating point precision correctly',
      () =>
        Effect.gen(function* () {
          const movementSystem = yield* MovementSystem

          // 浮動小数点精度テスト
          const precisePositions = [
            SpatialBrands.createVector3D(0.1 + 0.2, 64.0000001, -0.0000001),
            SpatialBrands.createVector3D(Number.EPSILON, 64 + Number.EPSILON, Number.EPSILON),
            SpatialBrands.createVector3D(1e-10, 64, 1e10),
          ]

          for (const position of precisePositions) {
            const isGrounded = yield* movementSystem.checkGrounded(position)
            expect(typeof isGrounded).toBe('boolean')

            // フレームレート独立計算
            const velocity: VelocityVector = { x: 0.1, y: 0, z: 0.1 }
            const newPosition = yield* movementSystem.calculateFrameIndependentMovement(position, velocity, 16.67)

            expect(Number.isFinite(newPosition.x)).toBe(true)
            expect(Number.isFinite(newPosition.y)).toBe(true)
            expect(Number.isFinite(newPosition.z)).toBe(true)
          }
        }).pipe(Effect.provide(MovementSystemTestLayer)) as any
    )
  })

  describe('Error Handling and Resilience', () => {
    effectIt.effect(
      'should handle non-existent player gracefully',
      () =>
        Effect.gen(function* () {
          const movementSystem = yield* MovementSystem
          const nonExistentPlayerId = BrandedTypes.createPlayerId('non-existent-player')

          // 存在しないプレイヤーの移動処理
          const input = createMovementInput(true, false, false, false, false, false, 16.67)
          const inputResult = yield* Effect.either(movementSystem.processMovementInput(nonExistentPlayerId, input))
          expect(inputResult._tag).toBe('Left')

          // 存在しないプレイヤーの状態取得
          const stateResult = yield* Effect.either(movementSystem.getMovementState(nonExistentPlayerId))
          expect(stateResult._tag).toBe('Left')

          // 存在しないプレイヤーの状態設定
          const setStateResult = yield* Effect.either(
            movementSystem.setMovementState(nonExistentPlayerId, DEFAULT_MOVEMENT_STATE)
          )
          expect(setStateResult._tag).toBe('Left')
        }).pipe(Effect.provide(MovementSystemTestLayer)) as any
    )

    effectIt.effect(
      'should recover from invalid physics states',
      () =>
        Effect.gen(function* () {
          const movementSystem = yield* MovementSystem
          const playerId = yield* createTestPlayer('recovery-test')

          // 無効な移動状態を設定
          const invalidStates = [
            {
              velocity: { x: NaN, y: 0, z: 0 },
              isGrounded: true,
              isJumping: false,
              isSprinting: false,
              lastUpdate: Date.now(),
            },
            {
              velocity: { x: Infinity, y: 0, z: 0 },
              isGrounded: true,
              isJumping: false,
              isSprinting: false,
              lastUpdate: Date.now(),
            },
            null,
            undefined,
            'invalid',
          ]

          for (const invalidState of invalidStates) {
            const result = yield* Effect.either(movementSystem.setMovementState(playerId, invalidState))
            expect(result._tag).toBe('Left')
          }

          // 有効な入力で正常に動作することを確認
          const input = createMovementInput(true, false, false, false, false, false, 16.67)
          const validResult = yield* movementSystem.processMovementInput(playerId, input)
          expect(validResult.newPosition).toBeDefined()
          expect(validResult.newVelocity).toBeDefined()
        }).pipe(Effect.provide(MovementSystemTestLayer)) as any
    )
  })
})

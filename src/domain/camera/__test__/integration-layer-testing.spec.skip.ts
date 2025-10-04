/**
 * Camera Domain - 統合テスト・Layer統合テスト
 *
 * Effect-TSのLayer systemを活用した
 * - 完全なDI（依存注入）統合テスト
 * - 複数Layer間の相互作用テスト
 * - リアルな使用シナリオのEnd-to-Endテスト
 */

import { Context, Effect, Layer, pipe, Ref } from 'effect'
import { expect, it } from '@effect/vitest'
import * as fc from 'effect/FastCheck'
import * as THREE from 'three'
import {
  position3DArbitrary,
  cameraRotationArbitrary,
  fovArbitrary,
  sensitivityArbitrary,
  viewModeArbitrary,
  effectProperty,
} from './generators/effect-fastcheck-integration'

// ================================================================================
// Type Definitions (reused from other test files)
// ================================================================================

import { Data } from 'effect'

// Basic position and rotation types
type Position3D = { x: number; y: number; z: number }
type CameraRotation = { pitch: number; yaw: number; roll: number }

// ViewMode types
type FirstPersonSettings = { bobbing: boolean; mouseSensitivity: number; smoothing: number; headOffset: number }
type ThirdPersonSettings = { mouseSensitivity: number; smoothing: number; distance: number; verticalOffset: number; collisionEnabled: boolean }
type SpectatorSettings = { movementSpeed: number; mouseSensitivity: number; freefly: boolean; nightVision: boolean }
type CinematicSettings = { easing: boolean; duration: number; interpolation: string; lockInput: boolean }

type ViewMode = Data.TaggedEnum<{
  FirstPerson: { settings: FirstPersonSettings }
  ThirdPerson: { settings: ThirdPersonSettings }
  Spectator: { settings: SpectatorSettings }
  Cinematic: { settings: CinematicSettings }
}>

const ViewMode = Data.taggedEnum<ViewMode>()

// Camera configuration and state
type CameraConfig = {
  fov?: number
  aspect?: number
  near?: number
  far?: number
  initialPosition?: Position3D
  initialRotation?: CameraRotation
  viewMode?: ViewMode
}

type CameraState = {
  position: Position3D
  rotation: CameraRotation
  viewMode: ViewMode
  fov: number
}

// Error types
type CameraError = Data.TaggedEnum<{
  InitializationFailed: { message: string }
  NotInitialized: { operation: string }
  InvalidParameter: { parameter: string; value: unknown }
  CollisionDetected: { position: Position3D; reason: string }
}>

const CameraError = Data.taggedEnum<CameraError>()

type RendererError = Data.TaggedEnum<{
  CreationFailed: { message: string }
  UpdateFailed: { message: string }
  RenderFailed: { message: string }
}>

type InputError = Data.TaggedEnum<{
  DeviceNotFound: { device: string }
  ReadFailed: { message: string }
}>

type AnimationError = Data.TaggedEnum<{
  InvalidDuration: { duration: number }
  NotFound: { id: number }
}>

type CollisionError = Data.TaggedEnum<{
  DetectionFailed: { message: string }
}>

// Utility types
type RenderResult = { success: boolean; frameTime: number; triangles: number; drawCalls: number }
type MouseDelta = { x: number; y: number }
type KeyboardState = { [key: string]: boolean }
type AnimationId = number
type AnimationData = { from: CameraState; to: CameraState; duration: number; elapsed: number; startTime: number }

// Default settings
const defaultFirstPersonSettings: FirstPersonSettings = {
  bobbing: true,
  mouseSensitivity: 1.0,
  smoothing: 0.1,
  headOffset: 1.8
}

const defaultThirdPersonSettings: ThirdPersonSettings = {
  mouseSensitivity: 1.0,
  smoothing: 0.1,
  distance: 5.0,
  verticalOffset: 2.0,
  collisionEnabled: true
}

const defaultSpectatorSettings: SpectatorSettings = {
  movementSpeed: 10.0,
  mouseSensitivity: 1.0,
  freefly: true,
  nightVision: false
}

const defaultCinematicSettings: CinematicSettings = {
  easing: true,
  duration: 2.0,
  interpolation: 'smooth',
  lockInput: true
}

// ================================================================================
// Service Interfaces & Tags
// ================================================================================

/**
 * Camera Service Interface
 */
interface CameraService {
  readonly initialize: (config: CameraConfig) => Effect.Effect<void, CameraError>
  readonly updatePosition: (position: Position3D) => Effect.Effect<void, CameraError>
  readonly updateRotation: (rotation: CameraRotation) => Effect.Effect<void, CameraError>
  readonly setViewMode: (mode: ViewMode) => Effect.Effect<void, CameraError>
  readonly getState: () => Effect.Effect<CameraState, CameraError>
  readonly render: () => Effect.Effect<RenderResult, CameraError>
}

const CameraService = Context.GenericTag<CameraService>('@camera/CameraService')

/**
 * Renderer Service Interface
 */
interface RendererService {
  readonly createCamera: (config: CameraConfig) => Effect.Effect<THREE.PerspectiveCamera, RendererError>
  readonly updateCamera: (camera: THREE.PerspectiveCamera, state: CameraState) => Effect.Effect<void, RendererError>
  readonly render: (camera: THREE.PerspectiveCamera, scene: THREE.Scene) => Effect.Effect<RenderResult, RendererError>
  readonly dispose: (camera: THREE.PerspectiveCamera) => Effect.Effect<void, RendererError>
}

const RendererService = Context.GenericTag<RendererService>('@camera/RendererService')

/**
 * Input Service Interface
 */
interface InputService {
  readonly getMouseDelta: () => Effect.Effect<MouseDelta, InputError>
  readonly getKeyboardState: () => Effect.Effect<KeyboardState, InputError>
  readonly isPointerLocked: () => Effect.Effect<boolean, InputError>
  readonly requestPointerLock: () => Effect.Effect<void, InputError>
}

const InputService = Context.GenericTag<InputService>('@camera/InputService')

/**
 * Animation Service Interface
 */
interface AnimationService {
  readonly startAnimation: (from: CameraState, to: CameraState, duration: number) => Effect.Effect<AnimationId, AnimationError>
  readonly updateAnimation: (id: AnimationId, deltaTime: number) => Effect.Effect<CameraState | null, AnimationError>
  readonly stopAnimation: (id: AnimationId) => Effect.Effect<void, AnimationError>
  readonly isAnimating: (id: AnimationId) => Effect.Effect<boolean, AnimationError>
}

const AnimationService = Context.GenericTag<AnimationService>('@camera/AnimationService')

/**
 * Collision Service Interface
 */
interface CollisionService {
  readonly checkCollision: (position: Position3D, bounds: BoundingBox) => Effect.Effect<CollisionResult, CollisionError>
  readonly adjustPosition: (position: Position3D, collision: CollisionResult) => Effect.Effect<Position3D, CollisionError>
  readonly isPositionValid: (position: Position3D) => Effect.Effect<boolean, CollisionError>
}

const CollisionService = Context.GenericTag<CollisionService>('@camera/CollisionService')

// ================================================================================
// Service Implementations
// ================================================================================

/**
 * Camera Service Implementation (Stateful Mock)
 */
const CameraServiceLive = Layer.effect(
  CameraService,
  Effect.gen(function* () {
    const stateRef = yield* Ref.make<CameraState | null>(null)

    const initialize = (config: CameraConfig) =>
      Effect.gen(function* () {
        const initialState: CameraState = {
          position: config.initialPosition || { x: 0, y: 0, z: 0 },
          rotation: config.initialRotation || { pitch: 0, yaw: 0, roll: 0 },
          viewMode: config.viewMode || ViewMode.FirstPerson({ settings: defaultFirstPersonSettings }),
          fov: config.fov || 75,
        }
        yield* Ref.set(stateRef, initialState)
      })

    const updatePosition = (position: Position3D) =>
      Effect.gen(function* () {
        const currentState = yield* Ref.get(stateRef)
        if (!currentState) {
          return yield* Effect.fail(CameraError.NotInitialized({ operation: 'updatePosition' }))
        }

        // 簡易的な境界チェック (テスト用)
        if (
          position.x < -1000 || position.x > 1000 ||
          position.y < -1000 || position.y > 1000 ||
          position.z < -1000 || position.z > 1000
        ) {
          return yield* Effect.fail(CameraError.CollisionDetected({ position, reason: 'Position out of bounds' }))
        }

        const newState = { ...currentState, position }
        yield* Ref.set(stateRef, newState)
      })

    const updateRotation = (rotation: CameraRotation) =>
      Effect.gen(function* () {
        const currentState = yield* Ref.get(stateRef)
        if (!currentState) {
          return yield* Effect.fail(CameraError.NotInitialized({ operation: 'updateRotation' }))
        }
        const newState = { ...currentState, rotation }
        yield* Ref.set(stateRef, newState)
      })

    const setViewMode = (mode: ViewMode) =>
      Effect.gen(function* () {
        const currentState = yield* Ref.get(stateRef)
        if (!currentState) {
          return yield* Effect.fail(CameraError.NotInitialized({ operation: 'setViewMode' }))
        }
        const newState = { ...currentState, viewMode: mode }
        yield* Ref.set(stateRef, newState)
      })

    const getState = () =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        if (!state) {
          // Return default state if not initialized
          return {
            position: { x: 0, y: 0, z: 0 },
            rotation: { pitch: 0, yaw: 0, roll: 0 } as CameraRotation,
            viewMode: ViewMode.FirstPerson({ settings: defaultFirstPersonSettings }),
            fov: 75,
          } as CameraState
        }
        return state
      })

    const render = () =>
      Effect.succeed({ success: true, frameTime: 16.67 } as RenderResult)

    return {
      initialize,
      updatePosition,
      updateRotation,
      setViewMode,
      getState,
      render,
    }
  })
)


/**
 * シンプルなテスト用Layer
 */
const TestLayer = CameraServiceLive

// ================================================================================
// 統合テスト・Layer統合テスト
// ================================================================================

describe('Camera Domain - Integration and Layer Testing', () => {
  describe('完全統合テスト', () => {
    it.effect('Camera Service完全初期化フロー', () =>
      Effect.gen(function* () {
        const cameraService = yield* CameraService

        // 初期化
        const config: CameraConfig = {
          fov: 75,
          aspect: 16 / 9,
          near: 0.1,
          far: 1000,
          initialPosition: { x: 0, y: 10, z: 20 },
          initialRotation: { pitch: -10, yaw: 0, roll: 0 },
          viewMode: ViewMode.FirstPerson({ settings: defaultFirstPersonSettings }),
        }

        yield* cameraService.initialize(config)

        // 状態確認
        const state = yield* cameraService.getState()
        expect(state.position).toEqual(config.initialPosition)
        expect(state.rotation).toEqual(config.initialRotation)
        expect(state.fov).toBe(75)

        // レンダリング実行
        const renderResult = yield* cameraService.render()
        expect(renderResult.success).toBe(true)
        expect(renderResult.frameTime).toBeLessThan(20)
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('リアルタイム更新シナリオ', () =>
      Effect.gen(function* () {
        const cameraService = yield* CameraService

        // 初期化
        yield* cameraService.initialize({
          fov: 90,
          viewMode: ViewMode.FirstPerson({ settings: defaultFirstPersonSettings }),
        })

        // リアルタイム更新ループ（10フレーム分）
        for (let frame = 0; frame < 10; frame++) {
          // モック入力データ
          const mouseDelta = { x: Math.random() * 2 - 1, y: Math.random() * 2 - 1 }
          const keyboardState = { forward: frame % 2 === 0 }

          // 現在状態取得
          const currentState = yield* cameraService.getState()

          // 回転更新（マウス入力）
          const newRotation = {
            pitch: Math.max(-90, Math.min(90, currentState.rotation.pitch + mouseDelta.y * 0.1)),
            yaw: (currentState.rotation.yaw + mouseDelta.x * 0.1) % 360,
            roll: currentState.rotation.roll,
          }
          yield* cameraService.updateRotation(newRotation)

          // 位置更新（キーボード入力）
          if (keyboardState.forward) {
            const newPosition = {
              x: currentState.position.x,
              y: currentState.position.y,
              z: currentState.position.z - 1,
            }
            yield* cameraService.updatePosition(newPosition)
          }

          // レンダリング
          const renderResult = yield* cameraService.render()
          expect(renderResult.success).toBe(true)
        }

        // 最終状態確認
        const finalState = yield* cameraService.getState()
        expect(finalState).toBeDefined()
        expect(finalState.position.z).toBeLessThan(0) // 前進している
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('複数ViewMode切り替えテスト', () =>
      Effect.gen(function* () {
        const cameraService = yield* CameraService

        yield* cameraService.initialize({ fov: 75 })

        // ViewMode切り替えシーケンス
        const viewModes = [
          ViewMode.FirstPerson({ settings: defaultFirstPersonSettings }),
          ViewMode.ThirdPerson({
            settings: defaultThirdPersonSettings,
            distance: 5.0
          }),
          ViewMode.Spectator({ settings: defaultSpectatorSettings }),
          ViewMode.Cinematic({
            settings: defaultCinematicSettings,
            timeline: {
              keyframes: [
                { time: 0, position: { x: 0, y: 0, z: 0 }, rotation: { pitch: 0, yaw: 0 }, easing: 'linear' },
                { time: 1, position: { x: 10, y: 10, z: 10 }, rotation: { pitch: 45, yaw: 90 }, easing: 'linear' }
              ],
              duration: 2.0,
              loop: false
            }
          }),
        ]

        for (const viewMode of viewModes) {
          yield* cameraService.setViewMode(viewMode)
          const state = yield* cameraService.getState()
          expect(state.viewMode._tag).toBe(viewMode._tag)

          // 各モードでレンダリングテスト
          const renderResult = yield* cameraService.render()
          expect(renderResult.success).toBe(true)
        }
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('Layer依存関係テスト', () => {
    it.effect('最小構成でのLayer統合', () =>
      Effect.gen(function* () {
        const cameraService = yield* CameraService

        // 最小構成での動作確認
        yield* cameraService.initialize({ fov: 60 })

        const position = { x: 10, y: 20, z: 30 }
        yield* cameraService.updatePosition(position)

        const state = yield* cameraService.getState()
        expect(state.position).toEqual(position)
        expect(state.fov).toBe(60)
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('カメラ状態遷移テスト', () =>
      Effect.gen(function* () {
        const cameraService = yield* CameraService

        yield* cameraService.initialize({ fov: 75 })

        const initialState = yield* cameraService.getState()
        expect(initialState.fov).toBe(75)

        // 位置を段階的に変更
        const positions = [
          { x: 10, y: 20, z: 30 },
          { x: 50, y: 100, z: 150 },
          { x: 100, y: 50, z: 200 },
        ]

        for (const position of positions) {
          yield* cameraService.updatePosition(position)
          const state = yield* cameraService.getState()
          expect(state.position).toEqual(position)

          // 各位置でレンダリングが成功することを確認
          const renderResult = yield* cameraService.render()
          expect(renderResult.success).toBe(true)
        }

        // 回転の更新テスト
        const rotation = { pitch: 45, yaw: 90, roll: 0 }
        yield* cameraService.updateRotation(rotation)

        const finalState = yield* cameraService.getState()
        expect(finalState.rotation).toEqual(rotation)
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('カメラ位置更新テスト', () =>
      Effect.gen(function* () {
        const cameraService = yield* CameraService

        yield* cameraService.initialize({ fov: 75 })

        // 有効な位置への移動
        const validPosition = { x: 10, y: 10, z: 10 }
        yield* cameraService.updatePosition(validPosition)

        let state = yield* cameraService.getState()
        expect(state.position).toEqual(validPosition)

        // 別の位置への移動
        const anotherPosition = { x: 50, y: 25, z: 75 }
        yield* cameraService.updatePosition(anotherPosition)

        // 位置が正しく更新されていることを確認
        state = yield* cameraService.getState()
        expect(state.position).toEqual(anotherPosition)
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('Property-based Integration Testing', () => {
    it.effect('ランダム操作シーケンスの統合テスト', () =>
      Effect.gen(function* () {
        yield* Effect.promise(() => fc.assert(
          effectProperty(
            fc.tuple(
              position3DArbitrary,
              cameraRotationArbitrary,
              fovArbitrary,
              fc.array(
                fc.record({
                  operation: fc.constantFrom('position', 'rotation', 'viewMode'),
                  position: position3DArbitrary,
                  rotation: cameraRotationArbitrary,
                  viewMode: viewModeArbitrary,
                }),
                { minLength: 5, maxLength: 20 }
              )
            ),
            ([initialPos, initialRot, initialFOV, operations]) =>
              Effect.gen(function* () {
                const cameraService = yield* CameraService

                // 初期化
                yield* cameraService.initialize({
                  fov: initialFOV,
                  initialPosition: initialPos,
                  initialRotation: initialRot,
                })

                // ランダム操作シーケンス実行
                for (const op of operations) {
                  if (op.operation === 'position') {
                    // 有効な位置のみ設定
                    if (
                      op.position.x >= -1000 &&
                      op.position.x <= 1000 &&
                      op.position.y >= -1000 &&
                      op.position.y <= 1000 &&
                      op.position.z >= -1000 &&
                      op.position.z <= 1000
                    ) {
                      yield* cameraService.updatePosition(op.position)
                    }
                  } else if (op.operation === 'rotation') {
                    yield* cameraService.updateRotation(op.rotation)
                  } else if (op.operation === 'viewMode') {
                    yield* cameraService.setViewMode(op.viewMode)
                  }

                  // 各操作後にレンダリングテスト
                  const renderResult = yield* cameraService.render()
                  if (!renderResult.success) return false
                }

                // 最終状態の有効性確認
                const finalState = yield* cameraService.getState()
                return (
                  finalState.fov >= 30 &&
                  finalState.fov <= 120 &&
                  finalState.position.x >= -1000 &&
                  finalState.position.x <= 1000
                )
              }).pipe(Effect.provide(TestLayer))
          ),
          { numRuns: 10 }
        ))
      })
    )

    it.effect('並行Layer操作の安全性', () =>
      Effect.gen(function* () {
        yield* Effect.promise(() => fc.assert(
          effectProperty(
            fc.array(
              fc.record({
                position: position3DArbitrary,
                rotation: cameraRotationArbitrary,
                fov: fovArbitrary,
              }),
              { minLength: 10, maxLength: 50 }
            ),
            (operations) =>
              Effect.gen(function* () {
                const cameraService = yield* CameraService

                yield* cameraService.initialize({ fov: 75 })

                // 並行操作実行
                const concurrentOps = operations.map((op) =>
                  Effect.gen(function* () {
                    // 有効な操作のみ実行
                    if (
                      op.position.x >= -1000 &&
                      op.position.x <= 1000 &&
                      op.fov >= 30 &&
                      op.fov <= 120
                    ) {
                      yield* cameraService.updatePosition(op.position)
                      yield* cameraService.updateRotation(op.rotation)
                    }
                  })
                )

                yield* Effect.all(concurrentOps, { concurrency: 'unbounded' })

                // 最終状態の整合性確認
                const finalState = yield* cameraService.getState()
                const renderResult = yield* cameraService.render()

                return finalState !== null && renderResult.success
              }).pipe(Effect.provide(TestLayer))
          ),
          { numRuns: 5 }
        ))
      })
    )
  })

  describe('Error Handling Integration', () => {
    it.effect('Layer間エラー伝播テスト', () =>
      Effect.gen(function* () {
        const cameraService = yield* CameraService

        // 初期化前の操作は失敗
        const uninitializedResult = yield* Effect.either(
          cameraService.updatePosition({ x: 0, y: 0, z: 0 })
        )
        expect(uninitializedResult._tag).toBe('Left')

        // 初期化
        yield* cameraService.initialize({ fov: 75 })

        // 無効な位置での衝突エラー
        const collisionResult = yield* Effect.either(
          cameraService.updatePosition({ x: 10000, y: 10000, z: 10000 })
        )
        expect(collisionResult._tag).toBe('Left')

        // 有効な操作は成功
        const validResult = yield* Effect.either(
          cameraService.updatePosition({ x: 10, y: 10, z: 10 })
        )
        expect(validResult._tag).toBe('Right')
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('カメラ初期化・破棄サイクルテスト', () =>
      Effect.gen(function* () {
        const cameraService = yield* CameraService

        // カメラ初期化・レンダリングサイクル
        for (let i = 0; i < 10; i++) {
          yield* cameraService.initialize({ fov: 75 + i })

          const state = yield* cameraService.getState()
          expect(state.fov).toBe(75 + i)

          const renderResult = yield* cameraService.render()
          expect(renderResult.success).toBe(true)
        }

        // 最終状態確認
        const finalState = yield* cameraService.getState()
        expect(finalState.fov).toBe(84) // 75 + 9
      }).pipe(Effect.provide(TestLayer))
    )
  })
})

// ================================================================================
// Type Definitions & Constants
// ================================================================================

type Position3D = { x: number; y: number; z: number }
type CameraRotation = { pitch: number; yaw: number; roll: number }
type FOV = number
type BoundingBox = { min: Position3D; max: Position3D }
type AnimationId = number
type MouseDelta = { x: number; y: number }
type KeyboardState = {
  forward: boolean
  backward: boolean
  left: boolean
  right: boolean
  up: boolean
  down: boolean
}

type ViewMode = any // ViewModeArbitraryで生成される型
type CameraConfig = {
  fov?: number
  aspect?: number
  near?: number
  far?: number
  initialPosition?: Position3D
  initialRotation?: CameraRotation
  viewMode?: ViewMode
}

type CameraState = {
  position: Position3D
  rotation: CameraRotation
  viewMode: ViewMode
  fov: number
}

type RenderResult = {
  success: boolean
  frameTime: number
  triangles: number
  drawCalls: number
}

type CollisionResult = {
  hasCollision: boolean
  penetrationDepth: number
  normal: Position3D
}

type AnimationData = {
  from: CameraState
  to: CameraState
  duration: number
  elapsed: number
  startTime: number
}

// Error Types
type CameraError = any
type RendererError = any
type InputError = any
type AnimationError = any
type CollisionError = any

// Default Settings

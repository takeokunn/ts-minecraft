/**
 * Camera Aggregate Root - DDD不変性・ビジネスロジックテスト
 *
 * Aggregate Rootの責務、不変性保証、ドメインイベント、ビジネスルールの完全テスト
 */

import { Brand, Data, Effect, Either, Match, Option, pipe } from 'effect'
import * as fc from 'fast-check'
import { beforeEach, describe, expect, test } from 'vitest'

// Camera Aggregateの実装（実際のインポートパスに合わせて調整）

import type { CameraDistance, CameraRotation, Position3D, ViewOffset, ViewMode } from '../../value_object'

import {
  createCameraRotation,
  createFirstPersonViewMode,
  createPosition3D,
  createThirdPersonViewMode,
  DeterministicTestLayer,
  position3DGenerator,
  TestLayer,
} from '../helpers'

/**
 * Mock Camera Aggregate実装
 * 実際の実装に合わせて調整が必要
 */

// CameraIdのBrand型
type CameraId = string & Brand.Brand<'CameraId'>

// Camera Aggregateのインターフェース
interface CameraAggregate {
  readonly id: CameraId
  readonly position: Position3D
  readonly rotation: CameraRotation
  readonly viewMode: ViewMode
  readonly distance: CameraDistance
  readonly offset: ViewOffset
  readonly lastUpdated: Date
  readonly version: number
  readonly uncommittedEvents: readonly DomainEvent[]
}

// ドメインイベント
type DomainEvent = Data.TaggedEnum<{
  CameraCreated: {
    readonly cameraId: CameraId
    readonly position: Position3D
    readonly viewMode: ViewMode
    readonly timestamp: Date
  }
  PositionUpdated: {
    readonly cameraId: CameraId
    readonly oldPosition: Position3D
    readonly newPosition: Position3D
    readonly timestamp: Date
  }
  RotationUpdated: {
    readonly cameraId: CameraId
    readonly oldRotation: CameraRotation
    readonly newRotation: CameraRotation
    readonly timestamp: Date
  }
  ViewModeChanged: {
    readonly cameraId: CameraId
    readonly oldViewMode: ViewMode
    readonly newViewMode: ViewMode
    readonly timestamp: Date
  }
  DistanceAdjusted: {
    readonly cameraId: CameraId
    readonly oldDistance: CameraDistance
    readonly newDistance: CameraDistance
    readonly reason: string
    readonly timestamp: Date
  }
}>

const DomainEvent = Data.taggedEnum<DomainEvent>()

// Cameraエラー
type CameraError = Data.TaggedEnum<{
  InvalidConfiguration: {
    readonly message: string
    readonly config: Option.Option<unknown>
  }
  CameraNotInitialized: {
    readonly operation: string
  }
  InvalidMode: {
    readonly mode: string
  }
  InvalidParameter: {
    readonly parameter: string
    readonly value: unknown
    readonly expected: Option.Option<string>
  }
  BusinessRuleViolation: {
    readonly rule: string
    readonly details: string
  }
}>

const CameraError = Data.taggedEnum<CameraError>()

// Mock Camera Factory
const createCamera = (
  id: CameraId,
  position: Position3D,
  rotation: CameraRotation,
  viewMode: ViewMode,
  distance: CameraDistance = Brand.nominal<CameraDistance>()(5.0),
  offset: ViewOffset = Brand.nominal<ViewOffset>()({ x: 0, y: 0, z: 0 })
): Effect.Effect<CameraAggregate, CameraError> =>
  Effect.gen(function* () {
    const now = new Date()

    // ビジネスルール検証
    yield* validateCameraConfiguration(position, rotation, viewMode, distance)

    const createdEvent = DomainEvent.CameraCreated({
      cameraId: id,
      position,
      viewMode,
      timestamp: now,
    })

    return {
      id,
      position,
      rotation,
      viewMode,
      distance,
      offset,
      lastUpdated: now,
      version: 1,
      uncommittedEvents: [createdEvent],
    }
  })

// ビジネスルール検証
const validateCameraConfiguration = (
  position: Position3D,
  rotation: CameraRotation,
  viewMode: ViewMode,
  distance: CameraDistance
): Effect.Effect<void, CameraError> =>
  Effect.gen(function* () {
    // 位置制約チェック
    if (Math.abs(position.x) > 10000 || Math.abs(position.y) > 1000 || Math.abs(position.z) > 10000) {
      return yield* Effect.fail(
        CameraError.BusinessRuleViolation({
          rule: 'PositionBounds',
          details: `Position out of valid bounds: (${position.x}, ${position.y}, ${position.z})`,
        })
      )
    }

    // 回転制約チェック
    if (rotation.pitch < -90 || rotation.pitch > 90) {
      return yield* Effect.fail(
        CameraError.BusinessRuleViolation({
          rule: 'PitchConstraint',
          details: `Pitch must be between -90 and 90 degrees, got ${rotation.pitch}`,
        })
      )
    }

    // ViewModeとDistance整合性チェック
    yield* pipe(
      viewMode,
      Match.value,
      Match.tag('ThirdPerson', ({ distance: requiredDistance }) => {
        if (distance !== requiredDistance) {
          return Effect.fail(
            CameraError.BusinessRuleViolation({
              rule: 'ViewModeDistanceConsistency',
              details: `ThirdPerson mode distance mismatch: expected ${requiredDistance}, got ${distance}`,
            })
          )
        }
        return Effect.void
      }),
      Match.orElse(() => Effect.void)
    )
  })

// Camera操作メソッド
const updatePosition = (
  camera: CameraAggregate,
  newPosition: Position3D
): Effect.Effect<CameraAggregate, CameraError> =>
  Effect.gen(function* () {
    // 不変性確保：新しいオブジェクトを作成
    yield* validateCameraConfiguration(newPosition, camera.rotation, camera.viewMode, camera.distance)

    const now = new Date()
    const positionUpdatedEvent = DomainEvent.PositionUpdated({
      cameraId: camera.id,
      oldPosition: camera.position,
      newPosition,
      timestamp: now,
    })

    return {
      ...camera,
      position: newPosition,
      lastUpdated: now,
      version: camera.version + 1,
      uncommittedEvents: [...camera.uncommittedEvents, positionUpdatedEvent],
    }
  })

const updateRotation = (
  camera: CameraAggregate,
  newRotation: CameraRotation
): Effect.Effect<CameraAggregate, CameraError> =>
  Effect.gen(function* () {
    yield* validateCameraConfiguration(camera.position, newRotation, camera.viewMode, camera.distance)

    const now = new Date()
    const rotationUpdatedEvent = DomainEvent.RotationUpdated({
      cameraId: camera.id,
      oldRotation: camera.rotation,
      newRotation,
      timestamp: now,
    })

    return {
      ...camera,
      rotation: newRotation,
      lastUpdated: now,
      version: camera.version + 1,
      uncommittedEvents: [...camera.uncommittedEvents, rotationUpdatedEvent],
    }
  })

const switchViewMode = (camera: CameraAggregate, newViewMode: ViewMode): Effect.Effect<CameraAggregate, CameraError> =>
  Effect.gen(function* () {
    // ViewMode切り替え時の距離調整
    const newDistance = pipe(
      newViewMode,
      Match.value,
      Match.tag('ThirdPerson', ({ distance }) => distance),
      Match.orElse(() => camera.distance)
    )

    yield* validateCameraConfiguration(camera.position, camera.rotation, newViewMode, newDistance)

    const now = new Date()
    const viewModeChangedEvent = DomainEvent.ViewModeChanged({
      cameraId: camera.id,
      oldViewMode: camera.viewMode,
      newViewMode,
      timestamp: now,
    })

    return {
      ...camera,
      viewMode: newViewMode,
      distance: newDistance,
      lastUpdated: now,
      version: camera.version + 1,
      uncommittedEvents: [...camera.uncommittedEvents, viewModeChangedEvent],
    }
  })

// ヘルパー関数
const generateCameraId = (): Effect.Effect<CameraId, never> =>
  Effect.sync(() => Brand.nominal<CameraId>()(`camera_${Date.now()}_${Math.random()}`))

const markEventsAsCommitted = (camera: CameraAggregate): CameraAggregate => ({
  ...camera,
  uncommittedEvents: [],
})

describe('Camera Aggregate Root - DDD不変性・ビジネスロジックテスト', () => {
  beforeEach(() => {
    Effect.runSync(
      Effect.provide(
        Effect.sync(() => console.log('Camera Aggregate test suite initialized')),
        TestLayer
      ) as Effect.Effect<void, never, never>
    )
  })

  describe('Aggregate Root作成・不変性テスト', () => {
    test('Camera Aggregate作成時の初期状態検証', () => {
      const result = Effect.runSync(
        Effect.provide(
          Effect.gen(function* () {
            const cameraId = yield* generateCameraId()
            const position = yield* createPosition3D(0, 10, 0)
            const rotation = yield* createCameraRotation(0, 0, 0)
            const viewMode = yield* createFirstPersonViewMode()

            const camera = yield* createCamera(cameraId, position, rotation, viewMode)

            // 基本プロパティ確認
            expect(camera.id).toBe(cameraId)
            expect(camera.position).toEqual(position)
            expect(camera.rotation).toEqual(rotation)
            expect(camera.viewMode).toEqual(viewMode)
            expect(camera.version).toBe(1)

            // ドメインイベント確認
            expect(camera.uncommittedEvents.length).toBe(1)
            const createdEvent = camera.uncommittedEvents[0]
            expect(createdEvent?._tag).toBe('CameraCreated')

            // タイムスタンプ確認
            expect(camera.lastUpdated).toBeInstanceOf(Date)

            return true
          }) as Effect.Effect<boolean, never, never>,
          TestLayer
        )
      )

      expect(result).toBe(true)
    })

    test('状態更新時の不変性保証', () => {
      const property = fc.property(fc.tuple(position3DGenerator, position3DGenerator), ([originalPos, newPos]) => {
        const result = Effect.runSync(
          Effect.provide(
            Effect.gen(function* () {
              const cameraId = yield* generateCameraId()
              const rotation = yield* createCameraRotation(0, 0, 0)
              const viewMode = yield* createFirstPersonViewMode()

              const originalCamera = yield* createCamera(cameraId, originalPos, rotation, viewMode)
              const originalVersion = originalCamera.version
              const originalEventsCount = originalCamera.uncommittedEvents.length

              const updatedCamera = yield* updatePosition(originalCamera, newPos)

              // 元のオブジェクトが変更されていないことを確認
              expect(originalCamera.position).toEqual(originalPos)
              expect(originalCamera.version).toBe(originalVersion)
              expect(originalCamera.uncommittedEvents.length).toBe(originalEventsCount)

              // 新しいオブジェクトが正しく更新されていることを確認
              expect(updatedCamera.position).toEqual(newPos)
              expect(updatedCamera.version).toBe(originalVersion + 1)
              expect(updatedCamera.uncommittedEvents.length).toBe(originalEventsCount + 1)

              // アイデンティティの保持
              expect(updatedCamera.id).toBe(originalCamera.id)

              return true
            }) as Effect.Effect<boolean, never, never>,
            TestLayer
          )
        )

        return result
      })

      fc.assert(property, { numRuns: 50 })
    })

    test('複数操作での不変性チェーン', () => {
      const result = Effect.runSync(
        Effect.provide(
          Effect.gen(function* () {
            const cameraId = yield* generateCameraId()
            const initialPosition = yield* createPosition3D(0, 10, 0)
            const initialRotation = yield* createCameraRotation(0, 0, 0)
            const initialViewMode = yield* createFirstPersonViewMode()

            // 初期カメラ作成
            const camera1 = yield* createCamera(cameraId, initialPosition, initialRotation, initialViewMode)

            // 位置更新
            const newPosition = yield* createPosition3D(10, 15, 20)
            const camera2 = yield* updatePosition(camera1, newPosition)

            // 回転更新
            const newRotation = yield* createCameraRotation(30, 45, 0)
            const camera3 = yield* updateRotation(camera2, newRotation)

            // ViewMode切り替え
            const newViewMode = yield* createThirdPersonViewMode(8.0)
            const camera4 = yield* switchViewMode(camera3, newViewMode)

            // 各段階の不変性確認
            expect(camera1.position).toEqual(initialPosition)
            expect(camera1.version).toBe(1)

            expect(camera2.position).toEqual(newPosition)
            expect(camera2.rotation).toEqual(initialRotation) // 変更されていない
            expect(camera2.version).toBe(2)

            expect(camera3.position).toEqual(newPosition) // 変更されていない
            expect(camera3.rotation).toEqual(newRotation)
            expect(camera3.version).toBe(3)

            expect(camera4.viewMode).toEqual(newViewMode)
            expect(camera4.version).toBe(4)

            // イベント履歴確認
            expect(camera4.uncommittedEvents.length).toBe(4)

            return true
          }) as Effect.Effect<boolean, never, never>,
          TestLayer
        )
      )

      expect(result).toBe(true)
    })
  })

  describe('ビジネスルール適用テスト', () => {
    test('位置制約の適用確認', () => {
      const result = Effect.runSync(
        Effect.provide(
          Effect.gen(function* () {
            const cameraId = yield* generateCameraId()
            const validPosition = yield* createPosition3D(0, 10, 0)
            const rotation = yield* createCameraRotation(0, 0, 0)
            const viewMode = yield* createFirstPersonViewMode()

            // 有効なカメラ作成
            const camera = yield* createCamera(cameraId, validPosition, rotation, viewMode)

            // 無効な位置での更新試行
            const invalidPosition = yield* createPosition3D(15000, -2000, 15000) // 制限外

            const result = yield* Effect.either(updatePosition(camera, invalidPosition))

            yield* pipe(
              result,
              Either.match({
                onLeft: (error) =>
                  Effect.gen(function* () {
                    expect(error._tag).toBe('BusinessRuleViolation')
                    if (error._tag === 'BusinessRuleViolation') {
                      expect(error.rule).toBe('PositionBounds')
                    }
                  }),
                onRight: () => Effect.fail(new Error('制約違反が検出されなかった')),
              })
            )

            return true
          }) as Effect.Effect<boolean, never, never>,
          TestLayer
        )
      )

      expect(result).toBe(true)
    })

    test('Pitch角度制約の適用確認', () => {
      const result = Effect.runSync(
        Effect.provide(
          Effect.gen(function* () {
            const cameraId = yield* generateCameraId()
            const position = yield* createPosition3D(0, 10, 0)
            const validRotation = yield* createCameraRotation(0, 0, 0)
            const viewMode = yield* createFirstPersonViewMode()

            const camera = yield* createCamera(cameraId, position, validRotation, viewMode)

            // 無効なPitch角度での回転更新試行
            const invalidRotation = yield* createCameraRotation(95, 0, 0) // 90度超過

            const result = yield* Effect.either(updateRotation(camera, invalidRotation))

            yield* pipe(
              result,
              Either.match({
                onLeft: (error) =>
                  Effect.gen(function* () {
                    expect(error._tag).toBe('BusinessRuleViolation')
                    if (error._tag === 'BusinessRuleViolation') {
                      expect(error.rule).toBe('PitchConstraint')
                    }
                  }),
                onRight: () => Effect.fail(new Error('Pitch制約違反が検出されなかった')),
              })
            )

            return true
          }) as Effect.Effect<boolean, never, never>,
          TestLayer
        )
      )

      expect(result).toBe(true)
    })

    test('ViewModeとDistance整合性チェック', () => {
      const result = Effect.runSync(
        Effect.provide(
          Effect.gen(function* () {
            const cameraId = yield* generateCameraId()
            const position = yield* createPosition3D(0, 10, 0)
            const rotation = yield* createCameraRotation(0, 0, 0)
            const thirdPersonMode = yield* createThirdPersonViewMode(10.0)
            const wrongDistance = Brand.nominal<CameraDistance>()(5.0) // 不整合な距離

            // 不整合な設定でのカメラ作成試行
            const result = yield* Effect.either(
              createCamera(cameraId, position, rotation, thirdPersonMode, wrongDistance)
            )

            yield* pipe(
              result,
              Either.match({
                onLeft: (error) =>
                  Effect.gen(function* () {
                    expect(error._tag).toBe('BusinessRuleViolation')
                    if (error._tag === 'BusinessRuleViolation') {
                      expect(error.rule).toBe('ViewModeDistanceConsistency')
                    }
                  }),
                onRight: () => Effect.fail(new Error('距離整合性違反が検出されなかった')),
              })
            )

            return true
          }) as Effect.Effect<boolean, never, never>,
          TestLayer
        )
      )

      expect(result).toBe(true)
    })
  })

  describe('ドメインイベント記録テスト', () => {
    test('状態変更時のイベント発行', () => {
      const result = Effect.runSync(
        Effect.provide(
          Effect.gen(function* () {
            const cameraId = yield* generateCameraId()
            const position = yield* createPosition3D(0, 10, 0)
            const rotation = yield* createCameraRotation(0, 0, 0)
            const viewMode = yield* createFirstPersonViewMode()

            const camera = yield* createCamera(cameraId, position, rotation, viewMode)
            const newRotation = yield* createCameraRotation(45, 90, 0)

            const updatedCamera = yield* updateRotation(camera, newRotation)

            // イベント数確認
            expect(updatedCamera.uncommittedEvents.length).toBe(2) // Created + RotationUpdated

            // RotationUpdatedイベントの詳細確認
            const rotationEvent = updatedCamera.uncommittedEvents[1]
            expect(rotationEvent?._tag).toBe('RotationUpdated')

            if (rotationEvent?._tag === 'RotationUpdated') {
              expect(rotationEvent.cameraId).toBe(cameraId)
              expect(rotationEvent.oldRotation).toEqual(rotation)
              expect(rotationEvent.newRotation).toEqual(newRotation)
              expect(rotationEvent.timestamp).toBeInstanceOf(Date)
            }

            return true
          }) as Effect.Effect<boolean, never, never>,
          TestLayer
        )
      )

      expect(result).toBe(true)
    })

    test('イベントコミット機能', () => {
      const result = Effect.runSync(
        Effect.provide(
          Effect.gen(function* () {
            const cameraId = yield* generateCameraId()
            const position = yield* createPosition3D(0, 10, 0)
            const rotation = yield* createCameraRotation(0, 0, 0)
            const viewMode = yield* createFirstPersonViewMode()

            const camera = yield* createCamera(cameraId, position, rotation, viewMode)

            // イベントコミット前
            expect(camera.uncommittedEvents.length).toBeGreaterThan(0)

            // イベントコミット
            const committedCamera = markEventsAsCommitted(camera)

            // コミット後の確認
            expect(committedCamera.uncommittedEvents.length).toBe(0)
            expect(committedCamera.id).toBe(camera.id) // その他のプロパティは保持
            expect(committedCamera.version).toBe(camera.version)

            return true
          }) as Effect.Effect<boolean, never, never>,
          TestLayer
        )
      )

      expect(result).toBe(true)
    })

    test('複数操作でのイベント蓄積', () => {
      const result = Effect.runSync(
        Effect.provide(
          Effect.gen(function* () {
            const cameraId = yield* generateCameraId()
            const position = yield* createPosition3D(0, 10, 0)
            const rotation = yield* createCameraRotation(0, 0, 0)
            const viewMode = yield* createFirstPersonViewMode()

            // 初期カメラ作成
            let camera = yield* createCamera(cameraId, position, rotation, viewMode)
            expect(camera.uncommittedEvents.length).toBe(1)

            // 複数の操作実行
            const newPosition = yield* createPosition3D(10, 10, 10)
            const newRotation = yield* createCameraRotation(30, 45, 0)
            const newViewMode = yield* createThirdPersonViewMode(6.0)

            const operations = [
              () => updatePosition(camera, newPosition),
              () => updateRotation(camera, newRotation),
              () => switchViewMode(camera, newViewMode),
            ]

            for (let i = 0; i < operations.length; i++) {
              const operation = operations[i]
              if (operation) {
                camera = yield* operation()
                expect(camera.uncommittedEvents.length).toBe(i + 2) // 初期 + 各操作
                expect(camera.version).toBe(i + 2)
              }
            }

            // 最終的なイベント確認
            const eventTags = camera.uncommittedEvents.map((event) => event._tag)
            expect(eventTags).toEqual(['CameraCreated', 'PositionUpdated', 'RotationUpdated', 'ViewModeChanged'])

            return true
          }) as Effect.Effect<boolean, never, never>,
          TestLayer
        )
      )

      expect(result).toBe(true)
    })
  })

  describe('並行性・パフォーマンステスト', () => {
    test('大量Camera作成の並行処理安全性', () => {
      const result = Effect.runSync(
        Effect.provide(
          Effect.gen(function* () {
            // 100個のCameraを並行作成
            const cameraCreations = Array.from({ length: 100 }, (_, i) =>
              Effect.gen(function* () {
                const cameraId = yield* generateCameraId()
                const position = yield* createPosition3D(i, 10, i)
                const rotation = yield* createCameraRotation(0, i * 3.6, 0)
                const viewMode = yield* createFirstPersonViewMode()

                return yield* createCamera(cameraId, position, rotation, viewMode)
              })
            )

            const allCameras = yield* Effect.all(cameraCreations, { concurrency: 'unbounded' })

            expect(allCameras.length).toBe(100)

            // 各Cameraの整合性確認
            for (let i = 0; i < allCameras.length; i++) {
              const camera = allCameras[i]
              if (camera) {
                expect(camera.version).toBe(1)
                expect(camera.uncommittedEvents.length).toBe(1)
                expect(camera.position.x).toBe(i)
                expect(camera.position.z).toBe(i)
              }
            }

            return true
          }) as Effect.Effect<boolean, never, never>,
          DeterministicTestLayer
        )
      )

      expect(result).toBe(true)
    })

    test('Aggregateバージョン管理の正確性', () => {
      const result = Effect.runSync(
        Effect.provide(
          Effect.gen(function* () {
            const cameraId = yield* generateCameraId()
            const position = yield* createPosition3D(0, 10, 0)
            const rotation = yield* createCameraRotation(0, 0, 0)
            const viewMode = yield* createFirstPersonViewMode()

            let camera = yield* createCamera(cameraId, position, rotation, viewMode)
            expect(camera.version).toBe(1)

            // 1000回の更新操作
            for (let i = 0; i < 1000; i++) {
              const newPosition = yield* createPosition3D(i, 10, i)
              camera = yield* updatePosition(camera, newPosition)
              expect(camera.version).toBe(i + 2) // 初期1 + 更新回数
            }

            expect(camera.version).toBe(1001)
            expect(camera.uncommittedEvents.length).toBe(1001) // Created + 1000 updates

            return true
          }) as Effect.Effect<boolean, never, never>,
          TestLayer
        )
      )

      expect(result).toBe(true)
    })
  })
})

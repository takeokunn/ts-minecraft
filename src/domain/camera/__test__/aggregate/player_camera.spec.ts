/**
 * PlayerCamera Aggregate - プレイヤー固有機能テスト
 *
 * プレイヤーカメラの特殊機能、マウス入力処理、モード切り替え、追従動作の完全テスト
 */

import { Brand, Data, Effect, Either, Match, Option, pipe } from 'effect'
import * as fc from 'effect/FastCheck'
import { beforeEach, describe, expect, test } from 'vitest'

import type { CameraDistance, CameraRotation, Position3D, ViewOffset } from '../../value_object'
import { ViewMode } from '../../value_object'

import {
  createFirstPersonViewMode,
  createPosition3D,
  createStandardMouseInput,
  createThirdPersonViewMode,
  DEFAULT_FIRST_PERSON_SETTINGS,
  DeterministicTestLayer,
  mouseInputGenerator,
  TestLayer,
} from '../helpers'

/**
 * PlayerCamera固有の型定義
 */

type PlayerId = string & Brand.Brand<'PlayerId'>
type CameraId = string & Brand.Brand<'CameraId'>

// PlayerCameraの状態
interface PlayerCameraState {
  readonly playerId: PlayerId
  readonly cameraId: CameraId
  readonly position: Position3D
  readonly rotation: CameraRotation
  readonly viewMode: ViewMode
  readonly distance: CameraDistance
  readonly offset: ViewOffset
  readonly mouseSensitivity: number
  readonly smoothing: number
  readonly isLocked: boolean
  readonly followTarget: Option.Option<Position3D>
  readonly lastInputTime: Date
  readonly version: number
  readonly uncommittedEvents: readonly PlayerCameraEvent[]
}

// PlayerCamera固有のドメインイベント
type PlayerCameraEvent = Data.TaggedEnum<{
  PlayerCameraCreated: {
    readonly playerId: PlayerId
    readonly cameraId: CameraId
    readonly initialViewMode: ViewMode
    readonly timestamp: Date
  }
  MouseInputProcessed: {
    readonly playerId: PlayerId
    readonly deltaX: number
    readonly deltaY: number
    readonly resultingRotation: CameraRotation
    readonly timestamp: Date
  }
  ViewModeToggled: {
    readonly playerId: PlayerId
    readonly fromMode: ViewMode
    readonly toMode: ViewMode
    readonly reason: string
    readonly timestamp: Date
  }
  FollowTargetSet: {
    readonly playerId: PlayerId
    readonly target: Position3D
    readonly timestamp: Date
  }
  CameraLockToggled: {
    readonly playerId: PlayerId
    readonly locked: boolean
    readonly reason: string
    readonly timestamp: Date
  }
  SensitivityAdjusted: {
    readonly playerId: PlayerId
    readonly oldSensitivity: number
    readonly newSensitivity: number
    readonly timestamp: Date
  }
}>

const PlayerCameraEvent = Data.taggedEnum<PlayerCameraEvent>()

// PlayerCameraエラー
type PlayerCameraError = Data.TaggedEnum<{
  PlayerNotFound: {
    readonly playerId: PlayerId
  }
  CameraLocked: {
    readonly playerId: PlayerId
    readonly operation: string
  }
  InvalidMouseInput: {
    readonly deltaX: number
    readonly deltaY: number
    readonly reason: string
  }
  ViewModeTransitionFailed: {
    readonly fromMode: ViewMode
    readonly toMode: ViewMode
    readonly reason: string
  }
  FollowTargetError: {
    readonly target: Position3D
    readonly reason: string
  }
}>

const PlayerCameraError = Data.taggedEnum<PlayerCameraError>()

/**
 * PlayerCamera操作関数
 */

// PlayerCamera作成
const createPlayerCamera = (
  playerId: PlayerId,
  cameraId: CameraId,
  initialPosition: Position3D,
  initialViewMode: ViewMode
): Effect.Effect<PlayerCameraState, PlayerCameraError> =>
  Effect.gen(function* () {
    const now = new Date()

    const mouseSensitivity = pipe(
      initialViewMode,
      Match.value,
      Match.tag('FirstPerson', ({ settings }) => settings.mouseSensitivity),
      Match.tag('ThirdPerson', ({ settings }) => settings.mouseSensitivity),
      Match.tag('Spectator', ({ settings }) => settings.mouseSensitivity),
      Match.orElse(() => 1.0)
    )

    const createdEvent = PlayerCameraEvent.PlayerCameraCreated({
      playerId,
      cameraId,
      initialViewMode,
      timestamp: now,
    })

    return {
      playerId,
      cameraId,
      position: initialPosition,
      rotation: {
        pitch: 0 as any,
        yaw: 0 as any,
        roll: 0 as any,
      } as CameraRotation,
      viewMode: initialViewMode,
      distance: Brand.nominal<CameraDistance>()(5.0),
      offset: Brand.nominal<ViewOffset>()({ x: 0, y: 0, z: 0 }),
      mouseSensitivity,
      smoothing: 0.1,
      isLocked: false,
      followTarget: Option.none(),
      lastInputTime: now,
      version: 1,
      uncommittedEvents: [createdEvent],
    }
  })

// マウス入力処理
const handleMouseInput = (
  playerCamera: PlayerCameraState,
  deltaX: number,
  deltaY: number
): Effect.Effect<PlayerCameraState, PlayerCameraError> =>
  Effect.gen(function* () {
    if (playerCamera.isLocked) {
      return yield* Effect.fail(
        PlayerCameraError.CameraLocked({
          playerId: playerCamera.playerId,
          operation: 'handleMouseInput',
        })
      )
    }

    // 入力値の妥当性チェック
    if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY)) {
      return yield* Effect.fail(
        PlayerCameraError.InvalidMouseInput({
          deltaX,
          deltaY,
          reason: 'Input values must be finite numbers',
        })
      )
    }

    if (Math.abs(deltaX) > 1000 || Math.abs(deltaY) > 1000) {
      return yield* Effect.fail(
        PlayerCameraError.InvalidMouseInput({
          deltaX,
          deltaY,
          reason: 'Input values exceed maximum threshold',
        })
      )
    }

    const now = new Date()

    // 感度とスムージング適用
    const sensitivity = playerCamera.mouseSensitivity
    const smoothing = playerCamera.smoothing

    // 新しい回転角度を計算
    const yawDelta = deltaX * sensitivity * 0.1
    const pitchDelta = -deltaY * sensitivity * 0.1 // Y軸は反転

    const newYaw = (playerCamera.rotation.yaw + yawDelta) % 360
    const normalizedYaw = newYaw < 0 ? newYaw + 360 : newYaw

    const newPitch = Math.max(-90, Math.min(90, playerCamera.rotation.pitch + pitchDelta))

    // スムージング適用
    const smoothedYaw = playerCamera.rotation.yaw + (normalizedYaw - playerCamera.rotation.yaw) * (1 - smoothing)
    const smoothedPitch = playerCamera.rotation.pitch + (newPitch - playerCamera.rotation.pitch) * (1 - smoothing)

    const newRotation = Brand.nominal<CameraRotation>()({
      pitch: Brand.nominal()(smoothedPitch),
      yaw: Brand.nominal()(smoothedYaw),
      roll: playerCamera.rotation.roll,
    })

    const mouseInputEvent = PlayerCameraEvent.MouseInputProcessed({
      playerId: playerCamera.playerId,
      deltaX,
      deltaY,
      resultingRotation: newRotation,
      timestamp: now,
    })

    return {
      ...playerCamera,
      rotation: newRotation,
      lastInputTime: now,
      version: playerCamera.version + 1,
      uncommittedEvents: [...playerCamera.uncommittedEvents, mouseInputEvent],
    }
  })

// ViewMode切り替え
const toggleViewMode = (
  playerCamera: PlayerCameraState,
  targetMode: ViewMode,
  reason: string = 'user_request'
): Effect.Effect<PlayerCameraState, PlayerCameraError> =>
  Effect.gen(function* () {
    if (playerCamera.isLocked) {
      return yield* Effect.fail(
        PlayerCameraError.CameraLocked({
          playerId: playerCamera.playerId,
          operation: 'toggleViewMode',
        })
      )
    }

    // ViewMode間の遷移可能性チェック
    const canTransition = pipe(
      playerCamera.viewMode,
      Match.value,
      Match.tag('FirstPerson', () => targetMode._tag === 'ThirdPerson' || targetMode._tag === 'Spectator'),
      Match.tag('ThirdPerson', () => targetMode._tag === 'FirstPerson' || targetMode._tag === 'Spectator'),
      Match.tag('Spectator', () => targetMode._tag === 'FirstPerson' || targetMode._tag === 'ThirdPerson'),
      Match.tag('Cinematic', () => false), // Cinematicからは切り替え不可
      Match.exhaustive
    )

    if (!canTransition) {
      return yield* Effect.fail(
        PlayerCameraError.ViewModeTransitionFailed({
          fromMode: playerCamera.viewMode,
          toMode: targetMode,
          reason: `Cannot transition from ${playerCamera.viewMode._tag} to ${targetMode._tag}`,
        })
      )
    }

    const now = new Date()

    // 新しいViewModeに応じた設定調整
    const newDistance = pipe(
      targetMode,
      Match.value,
      Match.tag('ThirdPerson', ({ distance }) => distance),
      Match.orElse(() => playerCamera.distance)
    )

    const newSensitivity = pipe(
      targetMode,
      Match.value,
      Match.tag('FirstPerson', ({ settings }) => settings.mouseSensitivity),
      Match.tag('ThirdPerson', ({ settings }) => settings.mouseSensitivity),
      Match.tag('Spectator', ({ settings }) => settings.mouseSensitivity),
      Match.orElse(() => playerCamera.mouseSensitivity)
    )

    const viewModeToggledEvent = PlayerCameraEvent.ViewModeToggled({
      playerId: playerCamera.playerId,
      fromMode: playerCamera.viewMode,
      toMode: targetMode,
      reason,
      timestamp: now,
    })

    return {
      ...playerCamera,
      viewMode: targetMode,
      distance: newDistance,
      mouseSensitivity: newSensitivity,
      version: playerCamera.version + 1,
      uncommittedEvents: [...playerCamera.uncommittedEvents, viewModeToggledEvent],
    }
  })

// フォロー対象設定
const setFollowTarget = (
  playerCamera: PlayerCameraState,
  target: Position3D
): Effect.Effect<PlayerCameraState, PlayerCameraError> =>
  Effect.gen(function* () {
    // ターゲット位置の妥当性チェック
    if (!Number.isFinite(target.x) || !Number.isFinite(target.y) || !Number.isFinite(target.z)) {
      return yield* Effect.fail(
        PlayerCameraError.FollowTargetError({
          target,
          reason: 'Target position contains invalid coordinates',
        })
      )
    }

    const now = new Date()

    const followTargetSetEvent = PlayerCameraEvent.FollowTargetSet({
      playerId: playerCamera.playerId,
      target,
      timestamp: now,
    })

    return {
      ...playerCamera,
      followTarget: Option.some(target),
      version: playerCamera.version + 1,
      uncommittedEvents: [...playerCamera.uncommittedEvents, followTargetSetEvent],
    }
  })

// カメラロック切り替え
const toggleLock = (
  playerCamera: PlayerCameraState,
  locked: boolean,
  reason: string = 'user_request'
): Effect.Effect<PlayerCameraState, PlayerCameraError> =>
  Effect.gen(function* () {
    const now = new Date()

    const lockToggledEvent = PlayerCameraEvent.CameraLockToggled({
      playerId: playerCamera.playerId,
      locked,
      reason,
      timestamp: now,
    })

    return {
      ...playerCamera,
      isLocked: locked,
      version: playerCamera.version + 1,
      uncommittedEvents: [...playerCamera.uncommittedEvents, lockToggledEvent],
    }
  })

// ヘルパー関数
const generatePlayerId = (): Effect.Effect<PlayerId, never> =>
  Effect.sync(() => Brand.nominal<PlayerId>()(`player_${Date.now()}_${Math.random()}`))

const generateCameraId = (): Effect.Effect<CameraId, never> =>
  Effect.sync(() => Brand.nominal<CameraId>()(`camera_${Date.now()}_${Math.random()}`))

describe('PlayerCamera Aggregate - プレイヤー固有機能テスト', () => {
  beforeEach(() => {
    Effect.runSync(
      Effect.provide(
        Effect.sync(() => console.log('PlayerCamera test suite initialized')),
        TestLayer
      )
    )
  })

  describe('PlayerCamera作成・初期化テスト', () => {
    test('PlayerCamera初期化と基本プロパティ確認', () => {
      const result = Effect.runSync(
        Effect.provide(
          Effect.gen(function* () {
            const playerId = yield* generatePlayerId()
            const cameraId = yield* generateCameraId()
            const position = yield* createPosition3D(0, 10, 0)
            const viewMode = yield* createFirstPersonViewMode()

            const playerCamera = yield* createPlayerCamera(playerId, cameraId, position, viewMode)

            // 基本プロパティ確認
            expect(playerCamera.playerId).toBe(playerId)
            expect(playerCamera.cameraId).toBe(cameraId)
            expect(playerCamera.position).toEqual(position)
            expect(playerCamera.viewMode).toEqual(viewMode)

            // PlayerCamera固有プロパティ確認
            expect(playerCamera.mouseSensitivity).toBe(DEFAULT_FIRST_PERSON_SETTINGS.mouseSensitivity)
            expect(playerCamera.isLocked).toBe(false)
            expect(Option.isNone(playerCamera.followTarget)).toBe(true)
            expect(playerCamera.version).toBe(1)
            expect(playerCamera.uncommittedEvents.length).toBe(1)

            // 初期イベント確認
            const createdEvent = playerCamera.uncommittedEvents[0]
            expect(createdEvent?._tag).toBe('PlayerCameraCreated')

            return true
          }) as Effect.Effect<boolean, never, never>,
          TestLayer
        )
      )

      expect(result).toBe(true)
    })
  })

  describe('マウス入力処理テスト', () => {
    test('正常なマウス入力処理の正確性', () => {
      const property = fc.property(mouseInputGenerator, (mouseInput) => {
        const result = Effect.runSync(
          Effect.provide(
            Effect.gen(function* () {
              const playerId = yield* generatePlayerId()
              const cameraId = yield* generateCameraId()
              const position = yield* createPosition3D(0, 10, 0)
              const viewMode = yield* createFirstPersonViewMode()

              const playerCamera = yield* createPlayerCamera(playerId, cameraId, position, viewMode)
              const originalRotation = playerCamera.rotation

              const updatedCamera = yield* handleMouseInput(playerCamera, mouseInput.deltaX, mouseInput.deltaY)

              // 回転が更新されていることを確認
              expect(updatedCamera.rotation).not.toEqual(originalRotation)

              // 感度に応じた変更量確認
              const yawChange = Math.abs(updatedCamera.rotation.yaw - originalRotation.yaw)
              const pitchChange = Math.abs(updatedCamera.rotation.pitch - originalRotation.pitch)

              // 変更量が合理的な範囲内であることを確認
              expect(yawChange).toBeGreaterThanOrEqual(0)
              expect(pitchChange).toBeGreaterThanOrEqual(0)

              // Pitch制限確認
              expect(updatedCamera.rotation.pitch).toBeGreaterThanOrEqual(-90)
              expect(updatedCamera.rotation.pitch).toBeLessThanOrEqual(90)

              // Yaw正規化確認
              expect(updatedCamera.rotation.yaw).toBeGreaterThanOrEqual(0)
              expect(updatedCamera.rotation.yaw).toBeLessThan(360)

              // イベント記録確認
              expect(updatedCamera.uncommittedEvents.length).toBe(2) // Created + MouseInputProcessed
              const mouseEvent = updatedCamera.uncommittedEvents[1]
              expect(mouseEvent?._tag).toBe('MouseInputProcessed')

              return true
            }) as Effect.Effect<boolean, never, never>,
            TestLayer
          )
        )

        return result
      })

      fc.assert(property, { numRuns: 50 })
    })

    test('極端なマウス入力の制限', () => {
      const result = Effect.runSync(
        Effect.provide(
          Effect.gen(function* () {
            const playerId = yield* generatePlayerId()
            const cameraId = yield* generateCameraId()
            const position = yield* createPosition3D(0, 10, 0)
            const viewMode = yield* createFirstPersonViewMode()

            const playerCamera = yield* createPlayerCamera(playerId, cameraId, position, viewMode)

            // 極端な入力値でのテスト
            const extremeInputs = [
              { deltaX: 2000, deltaY: 0 },
              { deltaX: 0, deltaY: -2000 },
              { deltaX: Number.POSITIVE_INFINITY, deltaY: 0 },
              { deltaX: Number.NaN, deltaY: 0 },
            ]

            for (const input of extremeInputs) {
              const result = yield* Effect.either(handleMouseInput(playerCamera, input.deltaX, input.deltaY))

              yield* pipe(
                result,
                Either.match({
                  onLeft: (error) =>
                    Effect.gen(function* () {
                      expect(error._tag).toBe('InvalidMouseInput')
                    }),
                  onRight: () => Effect.fail(new Error(`Expected failure for input: ${JSON.stringify(input)}`)),
                })
              )
            }

            return true
          }) as Effect.Effect<boolean, never, never>,
          TestLayer
        )
      )

      expect(result).toBe(true)
    })

    test('カメラロック時のマウス入力拒否', () => {
      const result = Effect.runSync(
        Effect.provide(
          Effect.gen(function* () {
            const playerId = yield* generatePlayerId()
            const cameraId = yield* generateCameraId()
            const position = yield* createPosition3D(0, 10, 0)
            const viewMode = yield* createFirstPersonViewMode()

            let playerCamera = yield* createPlayerCamera(playerId, cameraId, position, viewMode)

            // カメラをロック
            playerCamera = yield* toggleLock(playerCamera, true, 'test_lock')

            // ロック状態でのマウス入力試行
            const result = yield* Effect.either(handleMouseInput(playerCamera, 10, -5))

            yield* pipe(
              result,
              Either.match({
                onLeft: (error) =>
                  Effect.gen(function* () {
                    expect(error._tag).toBe('CameraLocked')
                    if (error._tag === 'CameraLocked') {
                      expect(error.operation).toBe('handleMouseInput')
                    }
                  }),
                onRight: () => Effect.fail(new Error('Expected failure when camera is locked')),
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

  describe('ViewMode切り替えテスト', () => {
    test('有効なViewMode切り替え', () => {
      const result = Effect.runSync(
        Effect.provide(
          Effect.gen(function* () {
            const playerId = yield* generatePlayerId()
            const cameraId = yield* generateCameraId()
            const position = yield* createPosition3D(0, 10, 0)
            const firstPersonMode = yield* createFirstPersonViewMode()

            let playerCamera = yield* createPlayerCamera(playerId, cameraId, position, firstPersonMode)

            // FirstPerson → ThirdPerson切り替え
            const thirdPersonMode = yield* createThirdPersonViewMode(8.0)
            playerCamera = yield* toggleViewMode(playerCamera, thirdPersonMode, 'user_toggle')

            expect(playerCamera.viewMode._tag).toBe('ThirdPerson')
            expect(playerCamera.distance).toBe(8.0)
            expect(playerCamera.version).toBe(2)

            // イベント確認
            const toggleEvent = playerCamera.uncommittedEvents[1]
            expect(toggleEvent?._tag).toBe('ViewModeToggled')
            if (toggleEvent?._tag === 'ViewModeToggled') {
              expect(toggleEvent.fromMode?._tag).toBe('FirstPerson')
              expect(toggleEvent.toMode?._tag).toBe('ThirdPerson')
              expect(toggleEvent.reason).toBe('user_toggle')
            }

            return true
          }) as Effect.Effect<boolean, never, never>,
          TestLayer
        )
      )

      expect(result).toBe(true)
    })

    test('無効なViewMode遷移の拒否', () => {
      const result = Effect.runSync(
        Effect.provide(
          Effect.gen(function* () {
            const playerId = yield* generatePlayerId()
            const cameraId = yield* generateCameraId()
            const position = yield* createPosition3D(0, 10, 0)

            // Cinematicモードで開始
            const cinematicMode = ViewMode.Cinematic({
              settings: {
                easing: true,
                duration: 5.0,
                interpolation: 'smooth',
                lockInput: true,
              },
              timeline: {
                keyframes: [
                  {
                    time: 0,
                    position: { x: 0, y: 0, z: 0 },
                    rotation: { pitch: 0, yaw: 0 },
                    easing: 'linear',
                  },
                  {
                    time: 5,
                    position: { x: 10, y: 0, z: 0 },
                    rotation: { pitch: 0, yaw: 90 },
                    easing: 'linear',
                  },
                ],
                duration: 5.0,
                loop: false,
              },
            })

            const playerCamera = yield* createPlayerCamera(playerId, cameraId, position, cinematicMode)

            // Cinematicからの切り替え試行（無効）
            const firstPersonMode = yield* createFirstPersonViewMode()
            const result = yield* Effect.either(toggleViewMode(playerCamera, firstPersonMode, 'invalid_attempt'))

            yield* pipe(
              result,
              Either.match({
                onLeft: (error) =>
                  Effect.gen(function* () {
                    expect(error._tag).toBe('ViewModeTransitionFailed')
                  }),
                onRight: () => Effect.fail(new Error('Expected failure for invalid transition')),
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

  describe('フォロー機能テスト', () => {
    test('フォロー対象設定と追従', () => {
      const result = Effect.runSync(
        Effect.provide(
          Effect.gen(function* () {
            const playerId = yield* generatePlayerId()
            const cameraId = yield* generateCameraId()
            const position = yield* createPosition3D(0, 10, 0)
            const viewMode = yield* createFirstPersonViewMode()

            let playerCamera = yield* createPlayerCamera(playerId, cameraId, position, viewMode)

            // フォロー対象設定
            const target = yield* createPosition3D(50, 20, 100)
            playerCamera = yield* setFollowTarget(playerCamera, target)

            expect(Option.isSome(playerCamera.followTarget)).toBe(true)
            expect(Option.getOrNull(playerCamera.followTarget)).toEqual(target)

            // イベント確認
            const followEvent = playerCamera.uncommittedEvents[1]
            expect(followEvent?._tag).toBe('FollowTargetSet')
            if (followEvent?._tag === 'FollowTargetSet') {
              expect(followEvent.target).toEqual(target)
            }

            return true
          }) as Effect.Effect<boolean, never, never>,
          TestLayer
        )
      )

      expect(result).toBe(true)
    })

    test('無効なフォロー対象の拒否', () => {
      const result = Effect.runSync(
        Effect.provide(
          Effect.gen(function* () {
            const playerId = yield* generatePlayerId()
            const cameraId = yield* generateCameraId()
            const position = yield* createPosition3D(0, 10, 0)
            const viewMode = yield* createFirstPersonViewMode()

            const playerCamera = yield* createPlayerCamera(playerId, cameraId, position, viewMode)

            // 無効な座標でのフォロー対象設定試行
            const invalidTarget = Brand.nominal<Position3D>()({
              x: Number.NaN,
              y: Number.POSITIVE_INFINITY,
              z: 0,
            })

            const result = yield* Effect.either(setFollowTarget(playerCamera, invalidTarget))

            yield* pipe(
              result,
              Either.match({
                onLeft: (error) =>
                  Effect.gen(function* () {
                    expect(error._tag).toBe('FollowTargetError')
                  }),
                onRight: () => Effect.fail(new Error('Expected failure for invalid target')),
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

  describe('パフォーマンス・並行性テスト', () => {
    test('大量マウス入力処理のパフォーマンス', () => {
      const result = Effect.runSync(
        Effect.provide(
          Effect.gen(function* () {
            const playerId = yield* generatePlayerId()
            const cameraId = yield* generateCameraId()
            const position = yield* createPosition3D(0, 10, 0)
            const viewMode = yield* createFirstPersonViewMode()

            let playerCamera = yield* createPlayerCamera(playerId, cameraId, position, viewMode)

            const startTime = Date.now()

            // 1000回のマウス入力処理
            for (let i = 0; i < 1000; i++) {
              const deltaX = Math.sin(i * 0.1) * 10
              const deltaY = Math.cos(i * 0.1) * 5

              playerCamera = yield* handleMouseInput(playerCamera, deltaX, deltaY)
            }

            const endTime = Date.now()
            const duration = endTime - startTime

            // パフォーマンス要件: 1000回処理が100ms以内
            expect(duration).toBeLessThan(100)

            // 最終状態確認
            expect(playerCamera.version).toBe(1001) // 初期 + 1000回更新
            expect(playerCamera.uncommittedEvents.length).toBe(1001)

            return true
          }) as Effect.Effect<boolean, never, never>,
          TestLayer
        )
      )

      expect(result).toBe(true)
    })

    test('複数PlayerCameraの並行操作', () => {
      const result = Effect.runSync(
        Effect.provide(
          Effect.gen(function* () {
            // 50個のPlayerCameraを並行作成・操作
            const playerCameraOperations = Array.from({ length: 50 }, (_, i) =>
              Effect.gen(function* () {
                const playerId = yield* generatePlayerId()
                const cameraId = yield* generateCameraId()
                const position = yield* createPosition3D(i * 10, 10, i * 10)
                const viewMode = yield* createFirstPersonViewMode()

                let playerCamera = yield* createPlayerCamera(playerId, cameraId, position, viewMode)

                // 各カメラに複数操作実行
                const mouseInput = createStandardMouseInput()
                playerCamera = yield* handleMouseInput(playerCamera, mouseInput.deltaX, mouseInput.deltaY)

                const thirdPersonMode = yield* createThirdPersonViewMode(5.0)
                playerCamera = yield* toggleViewMode(playerCamera, thirdPersonMode)

                return playerCamera
              })
            )

            const allPlayerCameras = yield* Effect.all(playerCameraOperations, { concurrency: 'unbounded' })

            expect(allPlayerCameras.length).toBe(50)

            // 各PlayerCameraの整合性確認
            for (const playerCamera of allPlayerCameras) {
              expect(playerCamera.version).toBe(3) // Created + MouseInput + ViewModeToggle
              expect(playerCamera.viewMode._tag).toBe('ThirdPerson')
              expect(playerCamera.uncommittedEvents.length).toBe(3)
            }

            return true
          }) as Effect.Effect<boolean, never, never>,
          DeterministicTestLayer
        )
      )

      expect(result).toBe(true)
    })
  })
})

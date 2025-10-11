/**
 * Camera Aggregate Root
 *
 * カメラドメインのAggregate Rootです。
 * カメラの状態管理、位置・回転・設定の更新、アニメーションの制御、
 * ドメインイベントの管理を行います。
 *
 * DDD原則に基づき、ビジネスルールを内包し、不変性を保証します。
 */

import type { CameraError, CameraEvent, CameraId } from '@domain/camera/types'
import { createCameraEvent } from '@domain/camera/types'
import { Array, Data, DateTime, Effect, Match, Option, pipe } from 'effect'
import type { AnimationState, CameraRotation, CameraSettings, Position3D, ViewMode } from '../../value_object/index'

/**
 * Camera Aggregate Root Interface
 *
 * カメラドメインの中核となるAggregateです。
 * 全てのカメラ操作はこのAggregateを通じて行われます。
 */
export interface Camera extends Data.Case {
  readonly _tag: 'Camera'
  readonly id: CameraId
  readonly position: Position3D
  readonly rotation: CameraRotation
  readonly viewMode: ViewMode
  readonly settings: CameraSettings
  readonly animationState: Option.Option<AnimationState>
  readonly events: Array.ReadonlyArray<CameraEvent>
  readonly isEnabled: boolean
  readonly lastUpdated: Date
}

/**
 * Camera Aggregate Root Constructor
 */
export const Camera = Data.case<Camera>()

/**
 * Camera Aggregate Root Operations
 *
 * カメラAggregate Rootのビジネスロジックを提供します。
 */
export namespace CameraOps {
  /**
   * カメラ位置の更新
   *
   * 新しい位置を設定し、位置更新イベントを記録します。
   * ビジネスルールとして、カメラ設定の移動制限を適用します。
   */
  export const updatePosition = (camera: Camera, newPosition: Position3D): Effect.Effect<Camera, CameraError> =>
    Effect.gen(function* () {
      // カメラが有効でない場合はエラー
      yield* Effect.when(!camera.isEnabled, () =>
        Effect.fail(CameraError({ _tag: 'CameraNotInitializedError', message: 'Camera is disabled' }))
      )

      // 位置の変更量チェック（急激な移動の防止）
      const positionDelta = calculatePositionDelta(camera.position, newPosition)
      const maxDelta = getMaxPositionDelta(camera.settings)

      yield* Effect.when(positionDelta > maxDelta, () =>
        Effect.fail(
          CameraError({
            _tag: 'InvalidPositionError',
            message: `Position change too large: ${positionDelta} > ${maxDelta}`,
          })
        )
      )

      // 位置更新イベントの作成
      const event = createPositionUpdatedEvent(camera.id, camera.position, newPosition)

      // 現在時刻を取得
      const now = yield* DateTime.nowAsDate

      // 新しいAggregateインスタンスの返却
      return Camera({
        ...camera,
        position: newPosition,
        events: [...camera.events, event],
        lastUpdated: now,
      })
    })

  /**
   * カメラ回転の更新
   *
   * 新しい回転を設定し、回転更新イベントを記録します。
   * 回転制限とスムージングを適用します。
   */
  export const updateRotation = (camera: Camera, newRotation: CameraRotation): Effect.Effect<Camera, CameraError> =>
    Effect.gen(function* () {
      yield* Effect.when(!camera.isEnabled, () =>
        Effect.fail(CameraError({ _tag: 'CameraNotInitializedError', message: 'Camera is disabled' }))
      )

      // 回転制限の適用
      const constrainedRotation = applyRotationConstraints(newRotation, camera.settings)

      // 回転更新イベントの作成
      const event = createRotationUpdatedEvent(camera.id, camera.rotation, constrainedRotation)

      // 現在時刻を取得
      const now = yield* DateTime.nowAsDate

      return Camera({
        ...camera,
        rotation: constrainedRotation,
        events: [...camera.events, event],
        lastUpdated: now,
      })
    })

  /**
   * ビューモードの変更
   *
   * 新しいビューモードを設定し、必要に応じて位置・回転を調整します。
   */
  export const changeViewMode = (camera: Camera, newMode: ViewMode): Effect.Effect<Camera, CameraError> =>
    Effect.gen(function* () {
      yield* Effect.when(!camera.isEnabled, () =>
        Effect.fail(CameraError({ _tag: 'CameraNotInitializedError', message: 'Camera is disabled' }))
      )

      // ビューモード変更時の位置・回転調整
      const adjustedCamera = yield* adjustCameraForViewMode(camera, newMode)

      // ビューモード変更イベントの作成
      const event = createViewModeChangedEvent(camera.id, camera.viewMode, newMode)

      // 現在時刻を取得
      const now = yield* DateTime.nowAsDate

      return Camera({
        ...adjustedCamera,
        viewMode: newMode,
        events: [...adjustedCamera.events, event],
        lastUpdated: now,
      })
    })

  /**
   * アニメーションの開始
   *
   * 新しいアニメーションを開始し、アニメーション開始イベントを記録します。
   */
  export const startAnimation = (camera: Camera, animation: AnimationState): Effect.Effect<Camera, CameraError> =>
    Effect.gen(function* () {
      yield* Effect.when(!camera.isEnabled, () =>
        Effect.fail(CameraError({ _tag: 'CameraNotInitializedError', message: 'Camera is disabled' }))
      )

      // 既存のアニメーション停止
      const updatedCamera = stopAnimation(camera)

      // アニメーション開始イベントの作成
      const event = createAnimationStartedEvent(camera.id, animation)

      // 現在時刻を取得
      const now = yield* DateTime.nowAsDate

      return Camera({
        ...updatedCamera,
        animationState: Option.some(animation),
        events: [...updatedCamera.events, event],
        lastUpdated: now,
      })
    })

  /**
   * アニメーションの停止
   *
   * 現在のアニメーションを停止し、停止イベントを記録します。
   */
  export const stopAnimation = (camera: Camera): Effect.Effect<Camera> =>
    Effect.gen(function* () {
      return yield* pipe(
        camera.animationState,
        Option.match({
          onNone: () => Effect.succeed(camera),
          onSome: (animation) =>
            Effect.gen(function* () {
              const event = createAnimationStoppedEvent(camera.id, animation)
              const now = yield* DateTime.nowAsDate

              return Camera({
                ...camera,
                animationState: Option.none(),
                events: [...camera.events, event],
                lastUpdated: now,
              })
            }),
        })
      )
    })

  /**
   * カメラ設定の更新
   *
   * 新しい設定を適用し、設定変更イベントを記録します。
   */
  export const updateSettings = (
    camera: Camera,
    settingsUpdate: Partial<CameraSettings>
  ): Effect.Effect<Camera, CameraError> =>
    Effect.gen(function* () {
      if (!camera.isEnabled) {
        return yield* Effect.fail(CameraError({ _tag: 'CameraNotInitializedError', message: 'Camera is disabled' }))
      }

      // 設定の統合と検証
      const newSettings = { ...camera.settings, ...settingsUpdate }
      const validatedSettings = yield* validateCameraSettings(newSettings)

      // 設定変更イベントの作成
      const event = createSettingsChangedEvent(camera.id, camera.settings, validatedSettings)

      // 現在時刻を取得
      const now = yield* DateTime.nowAsDate

      return Camera({
        ...camera,
        settings: validatedSettings,
        events: [...camera.events, event],
        lastUpdated: now,
      })
    })

  /**
   * カメラの有効化
   */
  export const enable = (camera: Camera): Effect.Effect<Camera> =>
    Effect.gen(function* () {
      const now = yield* DateTime.nowAsDate

      return Camera({
        ...camera,
        isEnabled: true,
        events: [...camera.events, createCameraEnabledEvent(camera.id)],
        lastUpdated: now,
      })
    })

  /**
   * カメラの無効化
   */
  export const disable = (camera: Camera): Effect.Effect<Camera> =>
    Effect.gen(function* () {
      const now = yield* DateTime.nowAsDate

      const disabledCamera = Camera({
        ...camera,
        isEnabled: false,
        animationState: Option.none(),
        events: [...camera.events, createCameraDisabledEvent(camera.id)],
        lastUpdated: now,
      })

      return disabledCamera
    })

  /**
   * イベントのクリア
   *
   * 未コミットのイベントをクリアします。
   */
  export const clearEvents = (camera: Camera): Camera =>
    Camera({
      ...camera,
      events: [],
    })

  /**
   * 未コミットイベントの取得
   */
  export const getUncommittedEvents = (camera: Camera): ReadonlyArray<CameraEvent> => camera.events

  /**
   * カメラ状態のスナップショット取得
   */
  export const getSnapshot = (camera: Camera) => ({
    id: camera.id,
    position: camera.position,
    rotation: camera.rotation,
    viewMode: camera.viewMode,
    settings: camera.settings,
    animationState: camera.animationState,
    isEnabled: camera.isEnabled,
    lastUpdated: camera.lastUpdated,
  })
}

// ========================================
// 内部ヘルパー関数
// ========================================

/**
 * 位置変更量の計算
 */
const calculatePositionDelta = (oldPosition: Position3D, newPosition: Position3D): number => {
  // 3D距離の計算実装
  return Math.sqrt(
    Math.pow(newPosition.x - oldPosition.x, 2) +
      Math.pow(newPosition.y - oldPosition.y, 2) +
      Math.pow(newPosition.z - oldPosition.z, 2)
  )
}

/**
 * 設定から最大位置変更量を取得
 */
const getMaxPositionDelta = (settings: CameraSettings): number => {
  // カメラ設定から最大移動量を計算
  return 100.0 // 仮の値、実際は設定から取得
}

/**
 * 回転制限の適用
 */
const applyRotationConstraints = (rotation: CameraRotation, settings: CameraSettings): CameraRotation => {
  // 回転制限ロジックの実装
  return rotation // 仮実装
}

/**
 * ビューモード変更時のカメラ調整
 */
const adjustCameraForViewMode = (camera: Camera, newMode: ViewMode): Effect.Effect<Camera, CameraError> =>
  Effect.gen(function* () {
    return pipe(
      newMode,
      Match.value,
      Match.tag('FirstPerson', () => {
        // First Person用調整
        return Effect.succeed(camera)
      }),
      Match.tag('ThirdPerson', () => {
        // Third Person用調整
        return Effect.succeed(camera)
      }),
      Match.tag('Spectator', () => {
        // Spectator用調整
        return Effect.succeed(camera)
      }),
      Match.tag('Cinematic', () => {
        // Cinematic用調整
        return Effect.succeed(camera)
      }),
      Match.exhaustive
    )
  })

/**
 * カメラ設定の検証
 */
const validateCameraSettings = (settings: CameraSettings): Effect.Effect<CameraSettings, CameraError> =>
  Effect.gen(function* () {
    // 設定の検証ロジック
    return settings // 仮実装
  })

// ========================================
// イベント作成ヘルパー関数
// ========================================

const createPositionUpdatedEvent = (
  cameraId: CameraId,
  oldPosition: Position3D,
  newPosition: Position3D
): Effect.Effect<CameraEvent> => createCameraEvent.positionUpdated(cameraId, oldPosition, newPosition)

const createRotationUpdatedEvent = (
  cameraId: CameraId,
  oldRotation: CameraRotation,
  newRotation: CameraRotation
): Effect.Effect<CameraEvent> => createCameraEvent.rotationUpdated(cameraId, oldRotation, newRotation)

const createViewModeChangedEvent = (
  cameraId: CameraId,
  oldMode: ViewMode,
  newMode: ViewMode
): Effect.Effect<CameraEvent> => {
  // ViewModeをCameraModeに変換する必要がある場合の処理
  // TODO: ViewMode と CameraMode の型を統一する
  return Effect.succeed(
    Data.struct({
      _tag: 'ViewModeChanged' as const,
      cameraId,
      fromMode: 'first-person' as const,
      toMode: 'first-person' as const,
      timestamp: Date.now(),
    })
  )
}

const createAnimationStartedEvent = (cameraId: CameraId, animation: AnimationState): Effect.Effect<CameraEvent> =>
  createCameraEvent.animationStarted(cameraId, animation)

const createAnimationStoppedEvent = (cameraId: CameraId, animation: AnimationState): Effect.Effect<CameraEvent> =>
  createCameraEvent.animationCompleted(cameraId, animation)

const createSettingsChangedEvent = (
  cameraId: CameraId,
  oldSettings: CameraSettings,
  newSettings: CameraSettings
): Effect.Effect<CameraEvent> => {
  // 変更された設定のみを抽出
  const changedSettings: Partial<CameraSettings> = {}
  if (oldSettings.fov !== newSettings.fov) changedSettings.fov = newSettings.fov
  if (oldSettings.sensitivity !== newSettings.sensitivity) changedSettings.sensitivity = newSettings.sensitivity
  if (oldSettings.distance !== newSettings.distance) changedSettings.distance = newSettings.distance
  if (oldSettings.smoothing !== newSettings.smoothing) changedSettings.smoothing = newSettings.smoothing

  return createCameraEvent.settingsChanged(cameraId, changedSettings)
}

const createCameraEnabledEvent = (cameraId: CameraId): Effect.Effect<CameraEvent> =>
  createCameraEvent.cameraUnlocked(cameraId)

const createCameraDisabledEvent = (cameraId: CameraId): Effect.Effect<CameraEvent> =>
  createCameraEvent.cameraLocked(cameraId, 'Camera disabled')

/**
 * Camera Domain - Test Fixtures & Factory Functions
 *
 * 世界最高峰のテストデータ作成支援
 * Effect-TSパターンによる型安全なFixture管理
 */

import { Brand, Effect } from 'effect'
import type {
  BoundingBox,
  CameraDistance,
  Direction3D,
  LerpFactor,
  Position3D,
  ViewOffset,
} from '../../value_object/camera_position/types'
import type { Angle, CameraRotation, Pitch, Yaw } from '../../value_object/camera_rotation/types'
import type {
  AnimationKeyframe,
  AnimationTimeline,
  CinematicSettings,
  FirstPersonSettings,
  SpectatorSettings,
  ThirdPersonSettings,
  ViewMode as ViewModeType,
} from '../../value_object/view_mode/types'
import { ViewMode } from '../../value_object/view-mode'

/**
 * === 基本的なFixture定数 ===
 */

// デフォルトの3D位置
export const DEFAULT_POSITION = Brand.nominal<Position3D>()({
  x: 0,
  y: 10,
  z: 0,
} as const)

// デフォルトのカメラ回転
export const DEFAULT_ROTATION = Brand.nominal<CameraRotation>()({
  pitch: Brand.nominal<Pitch>()(0),
  yaw: Brand.nominal<Yaw>()(0),
  roll: Brand.nominal<Angle>()(0),
} as const)

// デフォルトのカメラ距離
export const DEFAULT_CAMERA_DISTANCE = Brand.nominal<CameraDistance>()(5.0)

// デフォルトのビューオフセット
export const DEFAULT_VIEW_OFFSET = Brand.nominal<ViewOffset>()({
  x: 0,
  y: 0,
  z: 0,
} as const)

/**
 * === ViewMode Settings Fixtures ===
 */

// デフォルトの一人称設定
export const DEFAULT_FIRST_PERSON_SETTINGS: FirstPersonSettings = {
  bobbing: true,
  mouseSensitivity: 1.0,
  smoothing: 0.1,
  headOffset: 1.7,
} as const

// デフォルトの三人称設定
export const DEFAULT_THIRD_PERSON_SETTINGS: ThirdPersonSettings = {
  mouseSensitivity: 1.0,
  smoothing: 0.2,
  distance: 8.0,
  verticalOffset: 0.5,
  collisionEnabled: true,
} as const

// デフォルトのスペクテイター設定
export const DEFAULT_SPECTATOR_SETTINGS: SpectatorSettings = {
  movementSpeed: 10.0,
  mouseSensitivity: 1.5,
  freefly: true,
  nightVision: false,
} as const

// デフォルトのシネマティック設定
export const DEFAULT_CINEMATIC_SETTINGS: CinematicSettings = {
  easing: true,
  duration: 5.0,
  interpolation: 'smooth',
  lockInput: true,
} as const

/**
 * === Factory関数（Effect-TSパターン） ===
 */

// Position3D作成ファクトリー
export const createPosition3D = (x: number = 0, y: number = 10, z: number = 0): Effect.Effect<Position3D, never> =>
  Effect.succeed(Brand.nominal<Position3D>()({ x, y, z } as const))

// CameraRotation作成ファクトリー
export const createCameraRotation = (
  pitch: number = 0,
  yaw: number = 0,
  roll: number = 0
): Effect.Effect<CameraRotation, never> =>
  Effect.succeed(
    Brand.nominal<CameraRotation>()({
      pitch: Brand.nominal<Pitch>()(pitch),
      yaw: Brand.nominal<Yaw>()(yaw),
      roll: Brand.nominal<Angle>()(roll),
    } as const)
  )

// CameraDistance作成ファクトリー（制約チェック付き）
export const createCameraDistance = (distance: number): Effect.Effect<CameraDistance, string> =>
  distance >= 1 && distance <= 50
    ? Effect.succeed(Brand.nominal<CameraDistance>()(distance))
    : Effect.fail(`Invalid camera distance: ${distance}. Must be between 1 and 50.`)

// ViewOffset作成ファクトリー
export const createViewOffset = (x: number = 0, y: number = 0, z: number = 0): Effect.Effect<ViewOffset, never> =>
  Effect.succeed(Brand.nominal<ViewOffset>()({ x, y, z } as const))

// LerpFactor作成ファクトリー（0-1制約チェック付き）
export const createLerpFactor = (factor: number): Effect.Effect<LerpFactor, string> =>
  factor >= 0 && factor <= 1
    ? Effect.succeed(Brand.nominal<LerpFactor>()(factor))
    : Effect.fail(`Invalid lerp factor: ${factor}. Must be between 0 and 1.`)

// 正規化されたDirection3D作成ファクトリー
export const createDirection3D = (x: number, y: number, z: number): Effect.Effect<Direction3D, string> =>
  Effect.gen(function* () {
    const magnitude = Math.sqrt(x * x + y * y + z * z)

    if (magnitude === 0) {
      return yield* Effect.fail('Cannot create direction from zero vector')
    }

    return Brand.nominal<Direction3D>()({
      x: x / magnitude,
      y: y / magnitude,
      z: z / magnitude,
    } as const)
  })

// BoundingBox作成ファクトリー
export const createBoundingBox = (minPos: Position3D, maxPos: Position3D): Effect.Effect<BoundingBox, string> =>
  Effect.gen(function* () {
    if (minPos.x > maxPos.x || minPos.y > maxPos.y || minPos.z > maxPos.z) {
      return yield* Effect.fail('Invalid bounding box: min values must be less than max values')
    }

    return Brand.nominal<BoundingBox>()({
      min: minPos,
      max: maxPos,
    } as const)
  })

/**
 * === ViewMode作成ファクトリー ===
 */

// FirstPerson ViewMode作成
export const createFirstPersonViewMode = (settings?: Partial<FirstPersonSettings>): Effect.Effect<ViewMode, never> =>
  Effect.succeed(
    ViewMode.FirstPerson({
      settings: { ...DEFAULT_FIRST_PERSON_SETTINGS, ...settings },
    })
  )

// ThirdPerson ViewMode作成
export const createThirdPersonViewMode = (
  distance: number = 5.0,
  settings?: Partial<ThirdPersonSettings>
): Effect.Effect<ViewMode, string> =>
  Effect.gen(function* () {
    const validDistance = yield* createCameraDistance(distance)

    return ViewMode.ThirdPerson({
      settings: { ...DEFAULT_THIRD_PERSON_SETTINGS, ...settings },
      distance: validDistance,
    })
  })

// Spectator ViewMode作成
export const createSpectatorViewMode = (settings?: Partial<SpectatorSettings>): Effect.Effect<ViewMode, never> =>
  Effect.succeed(
    ViewMode.Spectator({
      settings: { ...DEFAULT_SPECTATOR_SETTINGS, ...settings },
    })
  )

// Cinematic ViewMode作成
export const createCinematicViewMode = (
  timeline?: AnimationTimeline,
  settings?: Partial<CinematicSettings>
): Effect.Effect<ViewMode, never> =>
  Effect.succeed(
    ViewMode.Cinematic({
      settings: { ...DEFAULT_CINEMATIC_SETTINGS, ...settings },
      timeline: timeline ?? DEFAULT_ANIMATION_TIMELINE,
    })
  )

/**
 * === Animation Fixtures ===
 */

// デフォルトのアニメーションキーフレーム
export const DEFAULT_KEYFRAMES: readonly AnimationKeyframe[] = [
  {
    time: 0,
    position: { x: 0, y: 10, z: 0 },
    rotation: { pitch: 0, yaw: 0 },
    easing: 'linear',
  },
  {
    time: 2.5,
    position: { x: 10, y: 15, z: 10 },
    rotation: { pitch: -15, yaw: 45 },
    easing: 'ease-in-out',
  },
  {
    time: 5.0,
    position: { x: 0, y: 10, z: 0 },
    rotation: { pitch: 0, yaw: 90 },
    easing: 'ease-out',
  },
] as const

// デフォルトのアニメーションタイムライン
export const DEFAULT_ANIMATION_TIMELINE: AnimationTimeline = {
  keyframes: DEFAULT_KEYFRAMES,
  duration: 5.0,
  loop: false,
} as const

// カスタムアニメーションタイムライン作成
export const createAnimationTimeline = (
  keyframes: readonly AnimationKeyframe[],
  duration: number,
  loop: boolean = false
): Effect.Effect<AnimationTimeline, string> =>
  Effect.gen(function* () {
    if (keyframes.length < 2) {
      return yield* Effect.fail('Animation timeline must have at least 2 keyframes')
    }

    if (duration <= 0) {
      return yield* Effect.fail('Animation duration must be positive')
    }

    // キーフレームの時刻が昇順かチェック
    for (let i = 1; i < keyframes.length; i++) {
      if (keyframes[i].time <= keyframes[i - 1].time) {
        return yield* Effect.fail('Keyframe times must be in ascending order')
      }
    }

    return { keyframes, duration, loop }
  })

/**
 * === テストシナリオ用複合Fixtures ===
 */

// 完全なカメラ状態Fixture
export interface CameraStateFixture {
  readonly position: Position3D
  readonly rotation: CameraRotation
  readonly viewMode: ViewModeType
  readonly distance: CameraDistance
  readonly offset: ViewOffset
}

// 標準的なカメラ状態作成
export const createStandardCameraState = (): Effect.Effect<CameraStateFixture, string> =>
  Effect.gen(function* () {
    const position = yield* createPosition3D(0, 10, 0)
    const rotation = yield* createCameraRotation(0, 0, 0)
    const viewMode = yield* createFirstPersonViewMode()
    const distance = yield* createCameraDistance(5.0)
    const offset = yield* createViewOffset(0, 0, 0)

    return {
      position,
      rotation,
      viewMode,
      distance,
      offset,
    }
  })

// ゲームプレイ用カメラ状態作成
export const createGameplayCameraState = (): Effect.Effect<CameraStateFixture, string> =>
  Effect.gen(function* () {
    const position = yield* createPosition3D(100, 64, 200)
    const rotation = yield* createCameraRotation(-15, 135, 0)
    const viewMode = yield* createThirdPersonViewMode(8.0, {
      mouseSensitivity: 1.2,
      smoothing: 0.15,
      collisionEnabled: true,
    })
    const distance = yield* createCameraDistance(8.0)
    const offset = yield* createViewOffset(0, 1.7, 0)

    return {
      position,
      rotation,
      viewMode,
      distance,
      offset,
    }
  })

// 極端な値でのカメラ状態作成（エッジケーステスト用）
export const createExtremeCameraState = (): Effect.Effect<CameraStateFixture, string> =>
  Effect.gen(function* () {
    const position = yield* createPosition3D(999, -64, -999)
    const rotation = yield* createCameraRotation(90, 359.9, 180)
    const viewMode = yield* createSpectatorViewMode({
      movementSpeed: 50.0,
      mouseSensitivity: 5.0,
      freefly: true,
      nightVision: true,
    })
    const distance = yield* createCameraDistance(50.0)
    const offset = yield* createViewOffset(10, -10, 10)

    return {
      position,
      rotation,
      viewMode,
      distance,
      offset,
    }
  })

/**
 * === マウス入力テスト用Fixtures ===
 */

export interface MouseInputFixture {
  readonly deltaX: number
  readonly deltaY: number
  readonly sensitivity: number
  readonly expectedYawChange: number
  readonly expectedPitchChange: number
}

// 標準的なマウス入力作成
export const createStandardMouseInput = (): MouseInputFixture => ({
  deltaX: 10,
  deltaY: -5,
  sensitivity: 1.0,
  expectedYawChange: 1.0, // deltaX * sensitivity * scale
  expectedPitchChange: -0.5, // deltaY * sensitivity * scale
})

// 高感度マウス入力作成
export const createHighSensitivityMouseInput = (): MouseInputFixture => ({
  deltaX: 5,
  deltaY: -2,
  sensitivity: 3.0,
  expectedYawChange: 1.5,
  expectedPitchChange: -0.6,
})

// 極端なマウス入力作成
export const createExtremeMouseInput = (): MouseInputFixture => ({
  deltaX: 1000,
  deltaY: -500,
  sensitivity: 5.0,
  expectedYawChange: 500, // 回転量制限のテスト用
  expectedPitchChange: -250,
})

/**
 * === パフォーマンステスト用Fixtures ===
 */

// 大量のカメラ状態作成（並行処理テスト用）
export const createMassiveCameraStates = (count: number): Effect.Effect<readonly CameraStateFixture[], string> =>
  Effect.all(
    Array.from({ length: count }, (_, i) =>
      Effect.gen(function* () {
        const position = yield* createPosition3D(i * 10, 10, i * 10)
        const rotation = yield* createCameraRotation(0, i * 5, 0)
        const viewMode = yield* createFirstPersonViewMode()
        const distance = yield* createCameraDistance(5.0)
        const offset = yield* createViewOffset(0, 0, 0)

        return {
          position,
          rotation,
          viewMode,
          distance,
          offset,
        }
      })
    ),
    { concurrency: 'unbounded' }
  )

/**
 * === Invalid データ作成（エラーテスト用） ===
 */

// 無効なPosition3D作成試行
export const createInvalidPosition3D = () => [
  { x: Number.NaN, y: 0, z: 0 },
  { x: Number.POSITIVE_INFINITY, y: 0, z: 0 },
  { x: 0, y: Number.NEGATIVE_INFINITY, z: 0 },
  { x: 1e20, y: 1e20, z: 1e20 },
]

// 無効なCameraDistance作成試行
export const createInvalidCameraDistances = () => [-1, 0, 0.5, 51, 100, Number.NaN, Number.POSITIVE_INFINITY]

// 無効なLerpFactor作成試行
export const createInvalidLerpFactors = () => [-0.1, 1.1, 2.0, Number.NaN, Number.POSITIVE_INFINITY]

import { Effect, Match, pipe, Schema } from 'effect'
import {
  AnimationTimelineSchema,
  CameraDistanceSchema,
  CinematicSettingsSchema,
  FirstPersonSettingsSchema,
  SpectatorSettingsSchema,
  ThirdPersonSettingsSchema,
  ViewModeSchema,
} from './schema'
import {
  AnimationTimeline,
  CameraDistance,
  CinematicSettings,
  FirstPersonSettings,
  SpectatorSettings,
  ThirdPersonSettings,
  ViewMode,
  ViewModeError,
} from './types'

/**
 * CameraDistance ファクトリー関数
 */
export const createCameraDistance = (value: number): Effect.Effect<CameraDistance, ViewModeError> =>
  pipe(
    Schema.decodeUnknown(CameraDistanceSchema)(value),
    Effect.mapError(() =>
      ViewModeError.InvalidDistance({
        distance: value,
        min: 1,
        max: 50,
      })
    )
  )

/**
 * ViewMode ファクトリー関数群
 */
export const ViewModeFactory = {
  /**
   * 一人称カメラモード作成
   */
  createFirstPerson: (settings: unknown): Effect.Effect<ViewMode, ViewModeError> =>
    pipe(
      Schema.decodeUnknown(FirstPersonSettingsSchema)(settings),
      Effect.map((validatedSettings) => ViewMode.FirstPerson({ settings: validatedSettings })),
      Effect.mapError((parseError) =>
        ViewModeError.InvalidSettings({
          field: 'firstPersonSettings',
          value: settings,
          expected: parseError.message,
        })
      )
    ),

  /**
   * 三人称カメラモード作成
   */
  createThirdPerson: (settings: unknown, distance: number): Effect.Effect<ViewMode, ViewModeError> =>
    Effect.gen(function* () {
      const validatedSettings = yield* pipe(
        Schema.decodeUnknown(ThirdPersonSettingsSchema)(settings),
        Effect.mapError((parseError) =>
          ViewModeError.InvalidSettings({
            field: 'thirdPersonSettings',
            value: settings,
            expected: parseError.message,
          })
        )
      )

      const validatedDistance = yield* createCameraDistance(distance)

      return ViewMode.ThirdPerson({
        settings: validatedSettings,
        distance: validatedDistance,
      })
    }),

  /**
   * スペクテイターカメラモード作成
   */
  createSpectator: (settings: unknown): Effect.Effect<ViewMode, ViewModeError> =>
    pipe(
      Schema.decodeUnknown(SpectatorSettingsSchema)(settings),
      Effect.map((validatedSettings) => ViewMode.Spectator({ settings: validatedSettings })),
      Effect.mapError((parseError) =>
        ViewModeError.InvalidSettings({
          field: 'spectatorSettings',
          value: settings,
          expected: parseError.message,
        })
      )
    ),

  /**
   * シネマティックカメラモード作成
   */
  createCinematic: (settings: unknown, timeline: unknown): Effect.Effect<ViewMode, ViewModeError> =>
    Effect.gen(function* () {
      const validatedSettings = yield* pipe(
        Schema.decodeUnknown(CinematicSettingsSchema)(settings),
        Effect.mapError((parseError) =>
          ViewModeError.InvalidSettings({
            field: 'cinematicSettings',
            value: settings,
            expected: parseError.message,
          })
        )
      )

      const validatedTimeline = yield* pipe(
        Schema.decodeUnknown(AnimationTimelineSchema)(timeline),
        Effect.mapError((parseError) =>
          ViewModeError.InvalidTimeline({
            reason: parseError.message,
          })
        )
      )

      return ViewMode.Cinematic({
        settings: validatedSettings,
        timeline: validatedTimeline,
      })
    }),
}

/**
 * ViewMode 操作関数群
 */
export const ViewModeOps = {
  /**
   * ViewModeのタグを取得
   */
  getTag: (mode: ViewMode): string =>
    pipe(
      mode,
      Match.value,
      Match.tag('FirstPerson', () => 'first-person'),
      Match.tag('ThirdPerson', () => 'third-person'),
      Match.tag('Spectator', () => 'spectator'),
      Match.tag('Cinematic', () => 'cinematic'),
      Match.exhaustive
    ),

  /**
   * ViewModeの設定を取得
   */
  getSettings: (mode: ViewMode): FirstPersonSettings | ThirdPersonSettings | SpectatorSettings | CinematicSettings =>
    pipe(
      mode,
      Match.value,
      Match.tag('FirstPerson', ({ settings }) => settings),
      Match.tag('ThirdPerson', ({ settings }) => settings),
      Match.tag('Spectator', ({ settings }) => settings),
      Match.tag('Cinematic', ({ settings }) => settings),
      Match.exhaustive
    ),

  /**
   * カメラ距離を取得（三人称のみ）
   */
  getDistance: (mode: ViewMode): Effect.Effect<CameraDistance, ViewModeError> =>
    pipe(
      mode,
      Match.value,
      Match.tag('ThirdPerson', ({ distance }) => Effect.succeed(distance)),
      Match.orElse(() =>
        Effect.fail(
          ViewModeError.InvalidMode({
            mode: ViewModeOps.getTag(mode),
          })
        )
      )
    ),

  /**
   * アニメーションタイムラインを取得（シネマティックのみ）
   */
  getTimeline: (mode: ViewMode): Effect.Effect<AnimationTimeline, ViewModeError> =>
    pipe(
      mode,
      Match.value,
      Match.tag('Cinematic', ({ timeline }) => Effect.succeed(timeline)),
      Match.orElse(() =>
        Effect.fail(
          ViewModeError.InvalidMode({
            mode: ViewModeOps.getTag(mode),
          })
        )
      )
    ),

  /**
   * ViewModeが指定タグかチェック
   */
  isMode:
    <T extends ViewMode['_tag']>(tag: T) =>
    (mode: ViewMode): mode is Extract<ViewMode, { _tag: T }> =>
    (mode) =>
      mode._tag === tag,

  /**
   * ViewModeの検証
   */
  validate: (value: unknown): Effect.Effect<ViewMode, ViewModeError> =>
    pipe(
      Schema.decodeUnknown(ViewModeSchema)(value),
      Effect.mapError(() => ViewModeError.InvalidMode({ mode: value }))
    ),
}

/**
 * デフォルト設定値
 */
export const DefaultSettings = {
  firstPerson: (): FirstPersonSettings => ({
    bobbing: true,
    mouseSensitivity: 1.0,
    smoothing: 0.15,
    headOffset: 0.0,
  }),

  thirdPerson: (): ThirdPersonSettings => ({
    mouseSensitivity: 1.0,
    smoothing: 0.15,
    distance: 8.0,
    verticalOffset: 2.0,
    collisionEnabled: true,
  }),

  spectator: (): SpectatorSettings => ({
    movementSpeed: 2.0,
    mouseSensitivity: 1.0,
    freefly: true,
    nightVision: false,
  }),

  cinematic: (): CinematicSettings => ({
    easing: true,
    duration: 5.0,
    interpolation: 'smooth' as const,
    lockInput: true,
  }),
}

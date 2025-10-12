/**
 * SceneCamera Aggregate
 *
 * シーン管理専用のCamera Aggregateです。
 * カットシーン、シネマティック演出、複数ターゲットの追従、
 * 自動カメラワークなどの機能を提供します。
 */

import type { CameraError } from '@domain/camera/types'
import { Array, Data, Effect, Match, Option, pipe } from 'effect'
import { AnimationState, CameraRotation, Position3D } from '../../value_object/index'
import { Camera, CameraOps } from '../camera'

/**
 * Scene ID Brand Type
 */
export type SceneId = string & { readonly _brand: 'SceneId' }

/**
 * Follow Mode ADT
 *
 * カメラの追従モードを定義します。
 */
export type FollowMode = Data.TaggedEnum<{
  SingleTarget: {
    readonly target: Position3D
    readonly offset: Position3D
  }
  MultipleTargets: {
    readonly targets: Array.ReadonlyArray<Position3D>
    readonly strategy: TargetStrategy
  }
  FreeLook: {}
  Cinematic: {
    readonly sequence: CinematicSequence
  }
}>

export const FollowMode = Data.taggedEnum<FollowMode>()

/**
 * Target Strategy ADT
 *
 * 複数ターゲット追従時の戦略を定義します。
 */
export type TargetStrategy = Data.TaggedEnum<{
  Center: {} // ターゲットの中心点を追う
  Closest: {} // 最も近いターゲットを追う
  Average: {} // ターゲットの平均位置を追う
  Priority: {
    readonly priorities: Array.ReadonlyArray<number>
  } // 優先度に基づく重み付け
}>

export const TargetStrategy = Data.taggedEnum<TargetStrategy>()

/**
 * Cinematic Sequence
 *
 * シネマティックシーケンスの定義です。
 */
export interface CinematicSequence extends Data.Case {
  readonly _tag: 'CinematicSequence'
  readonly id: string
  readonly keyframes: Array.ReadonlyArray<CinematicKeyframe>
  readonly duration: number
  readonly loop: boolean
  readonly easing: EasingType
}

export const CinematicSequence = Data.case<CinematicSequence>()

/**
 * Cinematic Keyframe
 *
 * シネマティックキーフレームの定義です。
 */
export interface CinematicKeyframe extends Data.Case {
  readonly _tag: 'CinematicKeyframe'
  readonly time: number
  readonly position: Position3D
  readonly rotation: CameraRotation
  readonly lookAt?: Position3D
  readonly fov?: number
}

export const CinematicKeyframe = Data.case<CinematicKeyframe>()

/**
 * Easing Type
 */
export type EasingType = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out'

/**
 * Cinematic Settings
 *
 * シネマティック演出用の設定です。
 */
export interface CinematicSettings extends Data.Case {
  readonly _tag: 'CinematicSettings'
  readonly autoFocus: boolean
  readonly depthOfField: boolean
  readonly motionBlur: boolean
  readonly smoothTransitions: boolean
  readonly transitionDuration: number
}

export const CinematicSettings = Data.case<CinematicSettings>()

/**
 * SceneCamera Aggregate
 *
 * シーン管理用のカメラ機能を提供するAggregateです。
 */
export interface SceneCamera extends Data.Case {
  readonly _tag: 'SceneCamera'
  readonly camera: Camera
  readonly sceneId: SceneId
  readonly followMode: FollowMode
  readonly cinematicSettings: CinematicSettings
  readonly activeSequence: Option.Option<CinematicSequence>
  readonly sequenceProgress: number
  readonly isRecording: boolean
  readonly recordedKeyframes: Array.ReadonlyArray<CinematicKeyframe>
}

export const SceneCamera = Data.case<SceneCamera>()

/**
 * SceneCamera Operations
 *
 * シーンカメラの操作を提供します。
 */
export namespace SceneCameraOps {
  /**
   * ターゲットの追加
   *
   * 新しいターゲットを追従リストに追加します。
   */
  export const addTarget = (
    sceneCamera: SceneCamera,
    target: Position3D,
    priority?: number
  ): Effect.Effect<SceneCamera, CameraError> =>
    Effect.gen(function* () {
      const currentMode = sceneCamera.followMode

      // 現在のモードに応じてターゲット追加
      const newFollowMode = pipe(
        currentMode,
        Match.value,
        Match.tag('SingleTarget', (single) => {
          // Single → Multiple に変更
          return FollowMode.MultipleTargets({
            targets: [single.target, target],
            strategy: TargetStrategy.Average({}),
          })
        }),
        Match.tag('MultipleTargets', (multiple) => {
          // 既存リストに追加
          return FollowMode.MultipleTargets({
            targets: [...multiple.targets, target],
            strategy: multiple.strategy,
          })
        }),
        Match.tag('FreeLook', () => {
          // FreeLook → Single に変更
          return FollowMode.SingleTarget({
            target,
            offset: createDefaultOffset(),
          })
        }),
        Match.tag('Cinematic', () => currentMode), // Cinematicモードでは変更なし
        Match.exhaustive
      )

      return SceneCamera({
        ...sceneCamera,
        followMode: newFollowMode,
      })
    })

  /**
   * ターゲットの削除
   *
   * 指定されたターゲットを追従リストから削除します。
   */
  export const removeTarget = (sceneCamera: SceneCamera, target: Position3D): Effect.Effect<SceneCamera, CameraError> =>
    Effect.gen(function* () {
      const currentMode = sceneCamera.followMode

      const newFollowMode = pipe(
        currentMode,
        Match.value,
        Match.tag('SingleTarget', (single) =>
          // 削除対象の場合はFreeLookに変更
          positionsEqual(single.target, target) ? FollowMode.FreeLook({}) : single
        ),
        Match.tag('MultipleTargets', (multiple) => {
          const filteredTargets = multiple.targets.filter((t) => !positionsEqual(t, target))

          return pipe(
            filteredTargets.length,
            Match.value,
            Match.when(0, () => FollowMode.FreeLook({})),
            Match.when(1, () =>
              FollowMode.SingleTarget({
                target: filteredTargets[0],
                offset: createDefaultOffset(),
              })
            ),
            Match.orElse(() =>
              FollowMode.MultipleTargets({
                targets: filteredTargets,
                strategy: multiple.strategy,
              })
            )
          )
        }),
        Match.orElse(() => currentMode)
      )

      return SceneCamera({
        ...sceneCamera,
        followMode: newFollowMode,
      })
    })

  /**
   * 追従モードの設定
   */
  export const setFollowMode = (sceneCamera: SceneCamera, mode: FollowMode): Effect.Effect<SceneCamera, CameraError> =>
    Effect.gen(function* () {
      // モード変更時のカメラ調整
      const adjustedCamera = yield* adjustCameraForFollowMode(sceneCamera.camera, mode)

      return SceneCamera({
        ...sceneCamera,
        camera: adjustedCamera,
        followMode: mode,
      })
    })

  /**
   * シネマティックシーケンスの開始
   */
  export const startCinematicSequence = (
    sceneCamera: SceneCamera,
    sequence: CinematicSequence
  ): Effect.Effect<SceneCamera, CameraError> =>
    Effect.gen(function* () {
      // Cinematicモードに変更
      const cinematicMode = FollowMode.Cinematic({ sequence })

      // カメラにアニメーション開始
      const animationState = yield* createAnimationFromSequence(sequence)
      const updatedCamera = yield* CameraOps.startAnimation(sceneCamera.camera, animationState)

      return SceneCamera({
        ...sceneCamera,
        camera: updatedCamera,
        followMode: cinematicMode,
        activeSequence: Option.some(sequence),
        sequenceProgress: 0,
      })
    })

  /**
   * 指定位置を見る（LookAt）
   */
  export const lookAt = (sceneCamera: SceneCamera, target: Position3D): Effect.Effect<SceneCamera, CameraError> =>
    Effect.gen(function* () {
      // カメラ位置からターゲットへの回転を計算
      const newRotation = yield* calculateLookAtRotation(sceneCamera.camera.position, target)

      // カメラの回転を更新
      const updatedCamera = yield* CameraOps.updateRotation(sceneCamera.camera, newRotation)

      return SceneCamera({
        ...sceneCamera,
        camera: updatedCamera,
      })
    })

  /**
   * シネマティック設定の更新
   */
  export const updateCinematicSettings = (
    sceneCamera: SceneCamera,
    settingsUpdate: Partial<CinematicSettings>
  ): SceneCamera =>
    SceneCamera({
      ...sceneCamera,
      cinematicSettings: CinematicSettings({
        ...sceneCamera.cinematicSettings,
        ...settingsUpdate,
      }),
    })

  /**
   * 軌道記録の開始
   */
  export const startRecording = (sceneCamera: SceneCamera): SceneCamera =>
    SceneCamera({
      ...sceneCamera,
      isRecording: true,
      recordedKeyframes: [],
    })

  /**
   * 軌道記録の停止
   */
  export const stopRecording = (sceneCamera: SceneCamera): SceneCamera =>
    SceneCamera({
      ...sceneCamera,
      isRecording: false,
    })

  /**
   * キーフレームの記録
   */
  export const recordKeyframe = (sceneCamera: SceneCamera, time: number): SceneCamera =>
    sceneCamera.isRecording
      ? SceneCamera({
          ...sceneCamera,
          recordedKeyframes: [
            ...sceneCamera.recordedKeyframes,
            CinematicKeyframe({
              _tag: 'CinematicKeyframe',
              time,
              position: sceneCamera.camera.position,
              rotation: sceneCamera.camera.rotation,
            }),
          ],
        })
      : sceneCamera

  /**
   * 記録されたキーフレームからシーケンス作成
   */
  export const createSequenceFromRecording = (
    sceneCamera: SceneCamera,
    sequenceId: string
  ): Effect.Effect<CinematicSequence, CameraError> =>
    Effect.gen(function* () {
      yield* Effect.when(sceneCamera.recordedKeyframes.length === 0, () =>
        Effect.fail(
          CameraError({
            _tag: 'InvalidParameterError',
            message: 'No keyframes recorded',
          })
        )
      )

      const duration = Math.max(...sceneCamera.recordedKeyframes.map((kf) => kf.time))

      return CinematicSequence({
        _tag: 'CinematicSequence',
        id: sequenceId,
        keyframes: sceneCamera.recordedKeyframes,
        duration,
        loop: false,
        easing: 'ease-in-out',
      })
    })

  /**
   * シーケンス進行の更新
   */
  export const updateSequenceProgress = (sceneCamera: SceneCamera, progress: number): SceneCamera =>
    SceneCamera({
      ...sceneCamera,
      sequenceProgress: Math.max(0, Math.min(1, progress)),
    })

  /**
   * カメラの取得
   */
  export const getCamera = (sceneCamera: SceneCamera): Camera => sceneCamera.camera

  /**
   * 現在のターゲット一覧の取得
   */
  export const getCurrentTargets = (sceneCamera: SceneCamera): Array.ReadonlyArray<Position3D> =>
    pipe(
      sceneCamera.followMode,
      Match.value,
      Match.tag('SingleTarget', (single) => [single.target]),
      Match.tag('MultipleTargets', (multiple) => multiple.targets),
      Match.orElse(() => [])
    )
}

// ========================================
// 内部ヘルパー関数
// ========================================

/**
 * デフォルトオフセットの作成
 */
const createDefaultOffset = (): Position3D =>
  ({
    x: 0,
    y: 2,
    z: -5,
  }) as Position3D

/**
 * 位置の等価比較
 */
const positionsEqual = (a: Position3D, b: Position3D): boolean => {
  const epsilon = 0.001
  return Math.abs(a.x - b.x) < epsilon && Math.abs(a.y - b.y) < epsilon && Math.abs(a.z - b.z) < epsilon
}

/**
 * 追従モードに応じたカメラ調整
 */
const adjustCameraForFollowMode = (camera: Camera, mode: FollowMode): Effect.Effect<Camera, CameraError> =>
  Effect.gen(function* () {
    return pipe(
      mode,
      Match.value,
      Match.tag('Cinematic', () => {
        // Cinematicモード用の設定調整
        return Effect.succeed(camera)
      }),
      Match.orElse(() => Effect.succeed(camera))
    )
  })

/**
 * シーケンスからアニメーション状態の作成
 */
const createAnimationFromSequence = (sequence: CinematicSequence): Effect.Effect<AnimationState, CameraError> =>
  Effect.gen(function* () {
    // シーケンスからEffect-TSのAnimationStateを作成
    const timestamp = yield* Clock.currentTimeMillis
    return AnimationState.Playing({
      startTime: timestamp,
      duration: sequence.duration,
      currentProgress: 0,
    })
  })

/**
 * LookAt回転の計算
 */
const calculateLookAtRotation = (
  cameraPosition: Position3D,
  targetPosition: Position3D
): Effect.Effect<CameraRotation, CameraError> =>
  Effect.gen(function* () {
    // カメラ位置からターゲットを向く回転を計算
    const deltaX = targetPosition.x - cameraPosition.x
    const deltaY = targetPosition.y - cameraPosition.y
    const deltaZ = targetPosition.z - cameraPosition.z

    const distance = Math.sqrt(deltaX * deltaX + deltaZ * deltaZ)
    const pitch = Math.atan2(deltaY, distance) * (180 / Math.PI)
    const yaw = Math.atan2(deltaX, deltaZ) * (180 / Math.PI)

    return {
      pitch,
      yaw,
      roll: 0,
    } as CameraRotation
  })

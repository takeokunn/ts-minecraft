/**
 * SceneCamera Factory
 *
 * SceneCamera Aggregateの生成を担当するFactoryです。
 * シーン管理用のカメラ生成とシネマティック設定を行います。
 */

import { Array, Effect, Option } from 'effect'
import type { CameraError } from '../../types/errors.js'
import type { CameraId } from '../../types/events.js'
import { CameraRotation, Position3D } from '../../value_object/index.js'
import { Camera } from '../camera/camera.js'
import { CameraFactory } from '../camera/factory.js'
import {
  CinematicKeyframe,
  CinematicSequence,
  CinematicSettings,
  FollowMode,
  SceneCamera,
  SceneId,
  TargetStrategy,
} from './scene-camera.js'

/**
 * SceneCamera Factory Namespace
 */
export namespace SceneCameraFactory {
  /**
   * SceneCameraの基本生成
   *
   * 指定されたシーンIDとカメラでSceneCameraを生成します。
   */
  export const create = (
    sceneId: SceneId,
    camera: Camera,
    followMode?: FollowMode,
    cinematicSettings?: CinematicSettings
  ): Effect.Effect<SceneCamera, CameraError> =>
    Effect.gen(function* () {
      const defaultFollowMode = followMode ?? FollowMode.FreeLook({})
      const defaultCinematicSettings = cinematicSettings ?? (yield* createDefaultCinematicSettings())

      return SceneCamera({
        _tag: 'SceneCamera',
        camera,
        sceneId,
        followMode: defaultFollowMode,
        cinematicSettings: defaultCinematicSettings,
        activeSequence: Option.none(),
        sequenceProgress: 0,
        isRecording: false,
        recordedKeyframes: [],
      })
    })

  /**
   * デフォルトSceneCameraの生成
   *
   * デフォルト設定でSceneCameraを生成します。
   */
  export const createDefault = (
    sceneId: SceneId,
    initialPosition: Position3D
  ): Effect.Effect<SceneCamera, CameraError> =>
    Effect.gen(function* () {
      // デフォルトカメラの生成
      const cameraId = generateCameraId(sceneId)
      const camera = yield* CameraFactory.createSpectator(cameraId, initialPosition)

      return yield* create(sceneId, camera)
    })

  /**
   * Single Target追従のSceneCameraを生成
   */
  export const createWithSingleTarget = (
    sceneId: SceneId,
    targetPosition: Position3D,
    offset?: Position3D
  ): Effect.Effect<SceneCamera, CameraError> =>
    Effect.gen(function* () {
      // ターゲットオフセットを適用した初期位置
      const cameraOffset = offset ?? createDefaultCameraOffset()
      const initialPosition = {
        x: targetPosition.x + cameraOffset.x,
        y: targetPosition.y + cameraOffset.y,
        z: targetPosition.z + cameraOffset.z,
      } as Position3D

      // カメラの生成
      const cameraId = generateCameraId(sceneId)
      const camera = yield* CameraFactory.createCinematic(
        cameraId,
        initialPosition,
        yield* calculateLookAtRotation(initialPosition, targetPosition)
      )

      // Single Target追従モード
      const followMode = FollowMode.SingleTarget({
        target: targetPosition,
        offset: cameraOffset,
      })

      return yield* create(sceneId, camera, followMode)
    })

  /**
   * Multiple Target追従のSceneCameraを生成
   */
  export const createWithMultipleTargets = (
    sceneId: SceneId,
    targets: Array.ReadonlyArray<Position3D>,
    strategy?: TargetStrategy
  ): Effect.Effect<SceneCamera, CameraError> =>
    Effect.gen(function* () {
      if (targets.length === 0) {
        return yield* Effect.fail(
          CameraError({
            _tag: 'InvalidParameterError',
            message: 'At least one target is required',
          })
        )
      }

      // ターゲットの中心位置を計算
      const centerPosition = calculateCenterPosition(targets)

      // カメラの初期位置（中心から少し離れた位置）
      const initialPosition = {
        x: centerPosition.x,
        y: centerPosition.y + 10,
        z: centerPosition.z - 15,
      } as Position3D

      // カメラの生成
      const cameraId = generateCameraId(sceneId)
      const camera = yield* CameraFactory.createCinematic(
        cameraId,
        initialPosition,
        yield* calculateLookAtRotation(initialPosition, centerPosition)
      )

      // Multiple Target追従モード
      const targetStrategy = strategy ?? TargetStrategy.Center({})
      const followMode = FollowMode.MultipleTargets({
        targets,
        strategy: targetStrategy,
      })

      return yield* create(sceneId, camera, followMode)
    })

  /**
   * Cinematicシーケンス用のSceneCameraを生成
   */
  export const createCinematic = (
    sceneId: SceneId,
    sequence: CinematicSequence
  ): Effect.Effect<SceneCamera, CameraError> =>
    Effect.gen(function* () {
      if (sequence.keyframes.length === 0) {
        return yield* Effect.fail(
          CameraError({
            _tag: 'InvalidParameterError',
            message: 'Cinematic sequence must have at least one keyframe',
          })
        )
      }

      // 最初のキーフレームから初期状態を取得
      const firstKeyframe = sequence.keyframes[0]

      // カメラの生成
      const cameraId = generateCameraId(sceneId)
      const camera = yield* CameraFactory.createCinematic(cameraId, firstKeyframe.position, firstKeyframe.rotation)

      // Cinematicモード
      const followMode = FollowMode.Cinematic({ sequence })

      // Cinematic用設定
      const cinematicSettings = yield* createCinematicSettings()

      const sceneCamera = yield* create(sceneId, camera, followMode, cinematicSettings)

      return SceneCamera({
        ...sceneCamera,
        activeSequence: Option.some(sequence),
      })
    })

  /**
   * 記録用SceneCameraの生成
   *
   * キーフレーム記録用のSceneCameraを生成します。
   */
  export const createForRecording = (
    sceneId: SceneId,
    initialPosition: Position3D,
    initialRotation?: CameraRotation
  ): Effect.Effect<SceneCamera, CameraError> =>
    Effect.gen(function* () {
      // 記録用カメラの生成
      const cameraId = generateCameraId(sceneId)
      const rotation = initialRotation ?? (yield* createDefaultRotation())
      const camera = yield* CameraFactory.createCinematic(cameraId, initialPosition, rotation)

      // 記録用設定
      const cinematicSettings = yield* createRecordingSettings()

      const sceneCamera = yield* create(sceneId, camera, FollowMode.FreeLook({}), cinematicSettings)

      return SceneCamera({
        ...sceneCamera,
        isRecording: true,
      })
    })

  /**
   * カスタムシーケンスの作成
   */
  export const createCustomSequence = (
    id: string,
    keyframes: Array.ReadonlyArray<CinematicKeyframe>,
    duration: number,
    options?: {
      loop?: boolean
      easing?: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out'
    }
  ): CinematicSequence =>
    CinematicSequence({
      _tag: 'CinematicSequence',
      id,
      keyframes,
      duration,
      loop: options?.loop ?? false,
      easing: options?.easing ?? 'ease-in-out',
    })

  /**
   * フライバイシーケンスの作成
   *
   * 指定された経路をフライバイするシーケンスを作成します。
   */
  export const createFlybySequence = (
    id: string,
    waypoints: Array.ReadonlyArray<Position3D>,
    duration: number,
    height?: number
  ): Effect.Effect<CinematicSequence, CameraError> =>
    Effect.gen(function* () {
      if (waypoints.length < 2) {
        return yield* Effect.fail(
          CameraError({
            _tag: 'InvalidParameterError',
            message: 'Flyby sequence requires at least 2 waypoints',
          })
        )
      }

      const flyHeight = height ?? 10
      const timeStep = duration / waypoints.length

      // 各ウェイポイントからキーフレームを生成
      const keyframes = waypoints.map((waypoint, index) => {
        const position = {
          x: waypoint.x,
          y: waypoint.y + flyHeight,
          z: waypoint.z,
        } as Position3D

        // 次のウェイポイントを向く回転（最後は現在方向を保持）
        const nextWaypoint = index < waypoints.length - 1 ? waypoints[index + 1] : waypoints[index]

        const rotation = calculateLookAtRotationSync(position, nextWaypoint)

        return CinematicKeyframe({
          _tag: 'CinematicKeyframe',
          time: index * timeStep,
          position,
          rotation,
          lookAt: nextWaypoint,
        })
      })

      return CinematicSequence({
        _tag: 'CinematicSequence',
        id,
        keyframes,
        duration,
        loop: false,
        easing: 'ease-in-out',
      })
    })
}

// ========================================
// 設定作成ヘルパー関数
// ========================================

/**
 * デフォルトシネマティック設定の作成
 */
const createDefaultCinematicSettings = (): Effect.Effect<CinematicSettings, CameraError> =>
  Effect.gen(function* () {
    return CinematicSettings({
      _tag: 'CinematicSettings',
      autoFocus: true,
      depthOfField: false,
      motionBlur: false,
      smoothTransitions: true,
      transitionDuration: 1.0,
    })
  })

/**
 * シネマティック用設定の作成
 */
const createCinematicSettings = (): Effect.Effect<CinematicSettings, CameraError> =>
  Effect.gen(function* () {
    return CinematicSettings({
      _tag: 'CinematicSettings',
      autoFocus: true,
      depthOfField: true,
      motionBlur: true,
      smoothTransitions: true,
      transitionDuration: 2.0,
    })
  })

/**
 * 記録用設定の作成
 */
const createRecordingSettings = (): Effect.Effect<CinematicSettings, CameraError> =>
  Effect.gen(function* () {
    return CinematicSettings({
      _tag: 'CinematicSettings',
      autoFocus: false,
      depthOfField: false,
      motionBlur: false,
      smoothTransitions: false,
      transitionDuration: 0.1,
    })
  })

// ========================================
// ユーティリティ関数
// ========================================

/**
 * デフォルトカメラオフセットの作成
 */
const createDefaultCameraOffset = (): Position3D =>
  ({
    x: 0,
    y: 5,
    z: -10,
  }) as Position3D

/**
 * 中心位置の計算
 */
const calculateCenterPosition = (positions: Array.ReadonlyArray<Position3D>): Position3D => {
  const sum = positions.reduce(
    (acc, pos) => ({
      x: acc.x + pos.x,
      y: acc.y + pos.y,
      z: acc.z + pos.z,
    }),
    { x: 0, y: 0, z: 0 }
  )

  return {
    x: sum.x / positions.length,
    y: sum.y / positions.length,
    z: sum.z / positions.length,
  } as Position3D
}

/**
 * LookAt回転の計算
 */
const calculateLookAtRotation = (
  cameraPosition: Position3D,
  targetPosition: Position3D
): Effect.Effect<CameraRotation, CameraError> =>
  Effect.gen(function* () {
    return calculateLookAtRotationSync(cameraPosition, targetPosition)
  })

/**
 * LookAt回転の同期計算
 */
const calculateLookAtRotationSync = (cameraPosition: Position3D, targetPosition: Position3D): CameraRotation => {
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
}

/**
 * デフォルト回転の作成
 */
const createDefaultRotation = (): Effect.Effect<CameraRotation, CameraError> =>
  Effect.gen(function* () {
    return {
      pitch: 0,
      yaw: 0,
      roll: 0,
    } as CameraRotation
  })

/**
 * カメラIDの生成
 */
const generateCameraId = (sceneId: SceneId): CameraId => {
  return `scene-camera-${sceneId}` as CameraId
}

import { Context, Effect, Layer, pipe, Match, Ref } from 'effect'
import * as THREE from 'three'
import type { Vector3D } from '../../shared/schemas/spatial'
import type { PlayerId } from '../../shared/types/branded'
import { Player } from '../entities/Player'

/**
 * Player Camera Service
 * プレイヤー移動と連携するカメラシステム
 */

// カメラエラー
export interface PlayerCameraError {
  readonly _tag: 'PlayerCameraError'
  readonly message: string
  readonly playerId?: PlayerId
  readonly cause?: unknown
}

// カメラモード
export type CameraMode = 'FirstPerson' | 'ThirdPerson' | 'Spectator'

// カメラ設定
export interface CameraSettings {
  readonly fov: number
  readonly near: number
  readonly far: number
  readonly mouseSensitivity: number
  readonly smoothingFactor: number
  readonly thirdPersonDistance: number
  readonly thirdPersonHeight: number
  readonly maxPitchAngle: number
  readonly minPitchAngle: number
}

// デフォルトカメラ設定
export const DEFAULT_CAMERA_SETTINGS: CameraSettings = {
  fov: 75,
  near: 0.1,
  far: 1000,
  mouseSensitivity: 0.002,
  smoothingFactor: 0.1,
  thirdPersonDistance: 5.0,
  thirdPersonHeight: 1.5,
  maxPitchAngle: Math.PI / 2 - 0.01, // 89度
  minPitchAngle: -Math.PI / 2 + 0.01, // -89度
} as const

// カメラ状態
export interface CameraState {
  readonly camera: THREE.PerspectiveCamera
  readonly mode: CameraMode
  readonly targetPosition: Vector3D
  readonly targetRotation: { yaw: number; pitch: number }
  readonly currentPosition: Vector3D
  readonly currentRotation: { yaw: number; pitch: number }
  readonly lastUpdateTime: number
  readonly isLocked: boolean
}

// カメラアニメーション
export interface CameraAnimation {
  readonly _tag: 'CameraAnimation'
  readonly type: 'SmoothMove' | 'LookAt' | 'Orbit' | 'Shake'
  readonly duration: number
  readonly startTime: number
  readonly startPosition: Vector3D
  readonly targetPosition: Vector3D
  readonly startRotation: { yaw: number; pitch: number }
  readonly targetRotation: { yaw: number; pitch: number }
  readonly easing: 'linear' | 'easeInOut' | 'easeIn' | 'easeOut'
}

// Player Camera Service インターフェース
export interface PlayerCameraService {
  /**
   * カメラシステムの初期化
   */
  readonly initializeCamera: (
    playerId: PlayerId,
    canvas: HTMLCanvasElement,
    settings?: Partial<CameraSettings>
  ) => Effect.Effect<void, PlayerCameraError>

  /**
   * カメラをプレイヤーに追従
   */
  readonly followPlayer: (
    playerId: PlayerId,
    player: Player,
    deltaTime: number
  ) => Effect.Effect<void, PlayerCameraError>

  /**
   * カメラモードの変更
   */
  readonly setCameraMode: (playerId: PlayerId, mode: CameraMode) => Effect.Effect<void, PlayerCameraError>

  /**
   * マウスルック入力の処理
   */
  readonly processMouseInput: (
    playerId: PlayerId,
    deltaX: number,
    deltaY: number
  ) => Effect.Effect<void, PlayerCameraError>

  /**
   * カメラ位置の手動設定
   */
  readonly setCameraPosition: (
    playerId: PlayerId,
    position: Vector3D,
    rotation?: { yaw: number; pitch: number }
  ) => Effect.Effect<void, PlayerCameraError>

  /**
   * カメラアニメーションの実行
   */
  readonly animateCamera: (
    playerId: PlayerId,
    animation: Omit<CameraAnimation, '_tag' | 'startTime'>
  ) => Effect.Effect<void, PlayerCameraError>

  /**
   * カメラ設定の更新
   */
  readonly updateCameraSettings: (
    playerId: PlayerId,
    settings: Partial<CameraSettings>
  ) => Effect.Effect<void, PlayerCameraError>

  /**
   * Three.jsカメラの取得
   */
  readonly getThreeCamera: (playerId: PlayerId) => Effect.Effect<THREE.PerspectiveCamera, PlayerCameraError>

  /**
   * カメラ状態の取得
   */
  readonly getCameraState: (playerId: PlayerId) => Effect.Effect<CameraState, PlayerCameraError>

  /**
   * ポインターロックの設定
   */
  readonly setPointerLock: (playerId: PlayerId, enabled: boolean) => Effect.Effect<void, PlayerCameraError>

  /**
   * カメラのクリーンアップ
   */
  readonly cleanupCamera: (playerId: PlayerId) => Effect.Effect<void, PlayerCameraError>
}

// Context Tag定義
export const PlayerCameraService = Context.GenericTag<PlayerCameraService>('@minecraft/domain/PlayerCameraService')

// Player Camera Service実装
const makePlayerCameraService: Effect.Effect<PlayerCameraService> = Effect.gen(function* () {
  // プレイヤーカメラ状態の管理
  const cameraStatesRef = yield* Ref.make(new Map<PlayerId, CameraState>())
  const cameraSettingsRef = yield* Ref.make(new Map<PlayerId, CameraSettings>())
  const activeAnimationsRef = yield* Ref.make(new Map<PlayerId, CameraAnimation>())
  const canvasElementRef = yield* Ref.make<HTMLCanvasElement | null>(null)

  // カメラシステムの初期化
  const initializeCamera = (playerId: PlayerId, canvas: HTMLCanvasElement, settings: Partial<CameraSettings> = {}) =>
    Effect.gen(function* () {
      const finalSettings: CameraSettings = {
        ...DEFAULT_CAMERA_SETTINGS,
        ...settings,
      }

      // Three.jsカメラを作成
      const aspect = canvas.clientWidth / canvas.clientHeight
      const camera = new THREE.PerspectiveCamera(finalSettings.fov, aspect, finalSettings.near, finalSettings.far)

      // 初期カメラ状態
      const cameraState: CameraState = {
        camera,
        mode: 'FirstPerson',
        targetPosition: { x: 0, y: 70, z: 0 },
        targetRotation: { yaw: 0, pitch: 0 },
        currentPosition: { x: 0, y: 70, z: 0 },
        currentRotation: { yaw: 0, pitch: 0 },
        lastUpdateTime: Date.now(),
        isLocked: false,
      }

      // 状態を保存
      yield* Ref.update(cameraStatesRef, (states) => states.set(playerId, cameraState))
      yield* Ref.update(cameraSettingsRef, (settings) => settings.set(playerId, finalSettings))
      yield* Ref.set(canvasElementRef, canvas)

      // カメラ初期位置を設定
      camera.position.set(0, 70, 0)

      console.log(`Camera initialized for player ${playerId}`)
    })

  // カメラをプレイヤーに追従
  const followPlayer = (playerId: PlayerId, player: Player, deltaTime: number) =>
    Effect.gen(function* () {
      const cameraStates = yield* Ref.get(cameraStatesRef)
      const settings = yield* Ref.get(cameraSettingsRef)
      const cameraState = cameraStates.get(playerId)
      const cameraSettings = settings.get(playerId)

      if (!cameraState || !cameraSettings) {
        return yield* Effect.fail({
          _tag: 'PlayerCameraError',
          message: `Camera not initialized for player ${playerId}`,
          playerId,
        } as PlayerCameraError)
      }

      // アニメーション中はスキップ
      const activeAnimations = yield* Ref.get(activeAnimationsRef)
      if (activeAnimations.has(playerId)) {
        yield* updateCameraAnimation(playerId, deltaTime)
        return
      }

      // カメラモードに応じた位置計算
      const newTargetPosition = yield* pipe(
        Match.value(cameraState.mode),
        Match.when('FirstPerson', () =>
          Effect.succeed({
            x: player.position.x,
            y: player.position.y + 1.6, // プレイヤーの目の高さ
            z: player.position.z,
          })
        ),
        Match.when('ThirdPerson', () =>
          Effect.succeed(calculateThirdPersonPosition(player, cameraSettings, cameraState.currentRotation))
        ),
        Match.when(
          'Spectator',
          () => Effect.succeed(cameraState.targetPosition) // スペクテイターは手動制御
        ),
        Match.exhaustive
      )

      // 滑らかな移動のための補間
      const smoothingFactor = cameraSettings.smoothingFactor
      const newCurrentPosition = {
        x: lerp(cameraState.currentPosition.x, newTargetPosition.x, smoothingFactor),
        y: lerp(cameraState.currentPosition.y, newTargetPosition.y, smoothingFactor),
        z: lerp(cameraState.currentPosition.z, newTargetPosition.z, smoothingFactor),
      }

      // 回転の補間
      const newCurrentRotation = {
        yaw: lerpAngle(cameraState.currentRotation.yaw, cameraState.targetRotation.yaw, smoothingFactor),
        pitch: lerp(cameraState.currentRotation.pitch, cameraState.targetRotation.pitch, smoothingFactor),
      }

      // Three.jsカメラに適用
      cameraState.camera.position.set(newCurrentPosition.x, newCurrentPosition.y, newCurrentPosition.z)

      // カメラの向きを設定
      const lookAtTarget = calculateLookAtTarget(newCurrentPosition, newCurrentRotation)
      cameraState.camera.lookAt(lookAtTarget.x, lookAtTarget.y, lookAtTarget.z)

      // 状態を更新
      const updatedState: CameraState = {
        ...cameraState,
        targetPosition: newTargetPosition,
        currentPosition: newCurrentPosition,
        currentRotation: newCurrentRotation,
        lastUpdateTime: Date.now(),
      }

      yield* Ref.update(cameraStatesRef, (states) => states.set(playerId, updatedState))
    })

  // サードパーソン視点の位置計算
  const calculateThirdPersonPosition = (
    player: Player,
    settings: CameraSettings,
    rotation: { yaw: number; pitch: number }
  ): Vector3D => {
    const distance = settings.thirdPersonDistance
    const height = settings.thirdPersonHeight

    const yaw = rotation.yaw
    const pitch = rotation.pitch

    return {
      x: player.position.x - Math.sin(yaw) * Math.cos(pitch) * distance,
      y: player.position.y + height - Math.sin(pitch) * distance,
      z: player.position.z + Math.cos(yaw) * Math.cos(pitch) * distance,
    }
  }

  // 視線方向の計算
  const calculateLookAtTarget = (position: Vector3D, rotation: { yaw: number; pitch: number }): Vector3D => {
    const distance = 1.0 // 単位ベクトル
    const yaw = rotation.yaw
    const pitch = rotation.pitch

    return {
      x: position.x - Math.sin(yaw) * Math.cos(pitch) * distance,
      y: position.y - Math.sin(pitch) * distance,
      z: position.z + Math.cos(yaw) * Math.cos(pitch) * distance,
    }
  }

  // 線形補間
  const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

  // 角度の線形補間（周期性を考慮）
  const lerpAngle = (a: number, b: number, t: number): number => {
    let diff = b - a
    while (diff > Math.PI) diff -= 2 * Math.PI
    while (diff < -Math.PI) diff += 2 * Math.PI
    return a + diff * t
  }

  // カメラモードの変更
  const setCameraMode = (playerId: PlayerId, mode: CameraMode) =>
    Effect.gen(function* () {
      const cameraStates = yield* Ref.get(cameraStatesRef)
      const cameraState = cameraStates.get(playerId)

      if (!cameraState) {
        return yield* Effect.fail({
          _tag: 'PlayerCameraError',
          message: `Camera not found for player ${playerId}`,
          playerId,
        } as PlayerCameraError)
      }

      const updatedState: CameraState = {
        ...cameraState,
        mode,
      }

      yield* Ref.update(cameraStatesRef, (states) => states.set(playerId, updatedState))

      console.log(`Camera mode changed to ${mode} for player ${playerId}`)
    })

  // マウスルック入力の処理
  const processMouseInput = (playerId: PlayerId, deltaX: number, deltaY: number) =>
    Effect.gen(function* () {
      const cameraStates = yield* Ref.get(cameraStatesRef)
      const settings = yield* Ref.get(cameraSettingsRef)
      const cameraState = cameraStates.get(playerId)
      const cameraSettings = settings.get(playerId)

      if (!cameraState || !cameraSettings) {
        return yield* Effect.fail({
          _tag: 'PlayerCameraError',
          message: `Camera not found for player ${playerId}`,
          playerId,
        } as PlayerCameraError)
      }

      if (cameraState.isLocked) {
        return // ポインターロック中はマウス入力を無視
      }

      // マウス感度を適用
      const sensitivity = cameraSettings.mouseSensitivity
      const yawDelta = -deltaX * sensitivity // X軸は反転
      const pitchDelta = -deltaY * sensitivity // Y軸は反転

      // 新しい回転角度を計算
      const newYaw = cameraState.targetRotation.yaw + yawDelta
      const newPitch = Math.max(
        cameraSettings.minPitchAngle,
        Math.min(cameraSettings.maxPitchAngle, cameraState.targetRotation.pitch + pitchDelta)
      )

      const updatedState: CameraState = {
        ...cameraState,
        targetRotation: {
          yaw: newYaw,
          pitch: newPitch,
        },
      }

      yield* Ref.update(cameraStatesRef, (states) => states.set(playerId, updatedState))
    })

  // カメラアニメーションの更新
  const updateCameraAnimation = (playerId: PlayerId, deltaTime: number) =>
    Effect.gen(function* () {
      const animations = yield* Ref.get(activeAnimationsRef)
      const animation = animations.get(playerId)

      if (!animation) {
        return
      }

      const currentTime = Date.now()
      const elapsed = currentTime - animation.startTime
      const progress = Math.min(elapsed / animation.duration, 1.0)

      // イージング関数を適用
      const easedProgress = applyEasing(progress, animation.easing)

      // 位置と回転を補間
      const currentPosition = {
        x: lerp(animation.startPosition.x, animation.targetPosition.x, easedProgress),
        y: lerp(animation.startPosition.y, animation.targetPosition.y, easedProgress),
        z: lerp(animation.startPosition.z, animation.targetPosition.z, easedProgress),
      }

      const currentRotation = {
        yaw: lerpAngle(animation.startRotation.yaw, animation.targetRotation.yaw, easedProgress),
        pitch: lerp(animation.startRotation.pitch, animation.targetRotation.pitch, easedProgress),
      }

      // カメラ状態を更新
      const cameraStates = yield* Ref.get(cameraStatesRef)
      const cameraState = cameraStates.get(playerId)

      if (cameraState) {
        cameraState.camera.position.set(currentPosition.x, currentPosition.y, currentPosition.z)

        const lookAtTarget = calculateLookAtTarget(currentPosition, currentRotation)
        cameraState.camera.lookAt(lookAtTarget.x, lookAtTarget.y, lookAtTarget.z)

        const updatedState: CameraState = {
          ...cameraState,
          currentPosition,
          currentRotation,
        }

        yield* Ref.update(cameraStatesRef, (states) => states.set(playerId, updatedState))
      }

      // アニメーション完了チェック
      if (progress >= 1.0) {
        yield* Ref.update(activeAnimationsRef, (animations) => {
          const newAnimations = new Map(animations)
          newAnimations.delete(playerId)
          return newAnimations
        })
      }
    })

  // イージング関数の適用
  const applyEasing = (t: number, easing: CameraAnimation['easing']): number => {
    switch (easing) {
      case 'linear':
        return t
      case 'easeIn':
        return t * t
      case 'easeOut':
        return 1 - (1 - t) * (1 - t)
      case 'easeInOut':
        return t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t)
      default:
        return t
    }
  }

  // その他のメソッド実装（簡略化）
  const setCameraPosition = (playerId: PlayerId, position: Vector3D, rotation?: { yaw: number; pitch: number }) =>
    Effect.gen(function* () {
      // 実装省略
    })

  const animateCamera = (playerId: PlayerId, animation: Omit<CameraAnimation, '_tag' | 'startTime'>) =>
    Effect.gen(function* () {
      // 実装省略
    })

  const updateCameraSettings = (playerId: PlayerId, settings: Partial<CameraSettings>) =>
    Effect.gen(function* () {
      // 実装省略
    })

  const getThreeCamera = (playerId: PlayerId) =>
    Effect.gen(function* () {
      const cameraStates = yield* Ref.get(cameraStatesRef)
      const cameraState = cameraStates.get(playerId)

      if (!cameraState) {
        return yield* Effect.fail({
          _tag: 'PlayerCameraError',
          message: `Camera not found for player ${playerId}`,
          playerId,
        } as PlayerCameraError)
      }

      return cameraState.camera
    })

  const getCameraState = (playerId: PlayerId) =>
    Effect.gen(function* () {
      const cameraStates = yield* Ref.get(cameraStatesRef)
      const cameraState = cameraStates.get(playerId)

      if (!cameraState) {
        return yield* Effect.fail({
          _tag: 'PlayerCameraError',
          message: `Camera not found for player ${playerId}`,
          playerId,
        } as PlayerCameraError)
      }

      return cameraState
    })

  const setPointerLock = (playerId: PlayerId, enabled: boolean) =>
    Effect.gen(function* () {
      // 実装省略（DOM操作が必要）
    })

  const cleanupCamera = (playerId: PlayerId) =>
    Effect.gen(function* () {
      yield* Ref.update(cameraStatesRef, (states) => {
        const newStates = new Map(states)
        newStates.delete(playerId)
        return newStates
      })

      yield* Ref.update(cameraSettingsRef, (settings) => {
        const newSettings = new Map(settings)
        newSettings.delete(playerId)
        return newSettings
      })

      yield* Ref.update(activeAnimationsRef, (animations) => {
        const newAnimations = new Map(animations)
        newAnimations.delete(playerId)
        return newAnimations
      })

      console.log(`Camera cleaned up for player ${playerId}`)
    })

  const service: PlayerCameraService = {
    initializeCamera,
    followPlayer,
    setCameraMode,
    processMouseInput,
    setCameraPosition,
    animateCamera,
    updateCameraSettings,
    getThreeCamera,
    getCameraState,
    setPointerLock,
    cleanupCamera,
  }

  return service
})

// Live Layer実装
export const PlayerCameraServiceLive = Layer.effect(PlayerCameraService, makePlayerCameraService)

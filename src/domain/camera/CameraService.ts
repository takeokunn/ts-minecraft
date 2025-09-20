import { Schema } from '@effect/schema'
import { Context, Effect, Layer } from 'effect'

// カメラのビューモード
export const CameraMode = Schema.Literal('first-person', 'third-person')
export type CameraMode = typeof CameraMode.Type

// カメラの位置と向き
export const CameraState = Schema.Struct({
  position: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number,
  }),
  rotation: Schema.Struct({
    pitch: Schema.Number, // 上下の回転（-90〜90度）
    yaw: Schema.Number, // 左右の回転（0〜360度）
    roll: Schema.Number, // 傾き（通常は0）
  }),
  mode: CameraMode,
  fov: Schema.Number.pipe(
    Schema.clamp(30, 120) // FOVは30〜120度に制限
  ),
  distance: Schema.Number.pipe(
    Schema.clamp(1, 20) // 三人称時の距離（1〜20ユニット）
  ),
  smoothing: Schema.Number.pipe(
    Schema.clamp(0, 1) // スムージング係数（0=即座、1=最大スムーズ）
  ),
})
export type CameraState = typeof CameraState.Type

// カメラの更新パラメータ
export const CameraUpdateParams = Schema.Struct({
  deltaTime: Schema.Number, // 前フレームからの経過時間（秒）
  targetPosition: Schema.optional(
    Schema.Struct({
      x: Schema.Number,
      y: Schema.Number,
      z: Schema.Number,
    })
  ),
  targetRotation: Schema.optional(
    Schema.Struct({
      pitch: Schema.Number,
      yaw: Schema.Number,
    })
  ),
  mode: Schema.optional(CameraMode),
  fov: Schema.optional(Schema.Number),
  distance: Schema.optional(Schema.Number),
})
export type CameraUpdateParams = typeof CameraUpdateParams.Type

// カメラサービスのエラー
export const CameraError = Schema.TaggedStruct('CameraError', {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
})
export type CameraError = typeof CameraError.Type

// カメラサービスインターフェース
export const CameraService = Context.GenericTag<{
  readonly getState: () => Effect.Effect<CameraState, CameraError>
  readonly update: (params: CameraUpdateParams) => Effect.Effect<CameraState, CameraError>
  readonly setMode: (mode: CameraMode) => Effect.Effect<void, CameraError>
  readonly setFOV: (fov: number) => Effect.Effect<void, CameraError>
  readonly reset: () => Effect.Effect<void, CameraError>
  readonly smoothTransition: (
    target: Partial<CameraState>,
    duration: number
  ) => Effect.Effect<void, CameraError>
}>('@minecraft/CameraService')

// デフォルトのカメラ状態
export const defaultCameraState: CameraState = {
  position: { x: 0, y: 1.7, z: 0 }, // 目の高さ
  rotation: { pitch: 0, yaw: 0, roll: 0 },
  mode: 'first-person',
  fov: 75,
  distance: 5,
  smoothing: 0.15,
}

// カメラサービスのLive実装
export const CameraServiceLive = Layer.sync(
  CameraService,
  () => {
    let state = defaultCameraState

    // スムーズ補間用の関数
    const lerp = (start: number, end: number, factor: number): number => {
      return start + (end - start) * factor
    }

    // 角度の補間（最短経路を考慮）
    const lerpAngle = (start: number, end: number, factor: number): number => {
      let diff = end - start
      while (diff > 180) diff -= 360
      while (diff < -180) diff += 360
      return start + diff * factor
    }

    return CameraService.of({
      getState: () => Effect.succeed(state),

      update: (params) =>
        Effect.gen(function* () {
          const smoothing = state.smoothing * (params.deltaTime * 60) // 60FPS基準で正規化

          // モード更新
          if (params.mode !== undefined) {
            state = { ...state, mode: params.mode }
          }

          // FOV更新
          if (params.fov !== undefined) {
            state = {
              ...state,
              fov: Math.max(30, Math.min(120, params.fov)),
            }
          }

          // 距離更新（三人称モード用）
          if (params.distance !== undefined) {
            state = {
              ...state,
              distance: Math.max(1, Math.min(20, params.distance)),
            }
          }

          // 位置の更新（スムージング適用）
          if (params.targetPosition) {
            state = {
              ...state,
              position: {
                x: lerp(state.position.x, params.targetPosition.x, smoothing),
                y: lerp(state.position.y, params.targetPosition.y, smoothing),
                z: lerp(state.position.z, params.targetPosition.z, smoothing),
              },
            }
          }

          // 回転の更新（スムージング適用）
          if (params.targetRotation) {
            state = {
              ...state,
              rotation: {
                pitch: Math.max(
                  -90,
                  Math.min(90, lerp(state.rotation.pitch, params.targetRotation.pitch, smoothing))
                ),
                yaw: lerpAngle(state.rotation.yaw, params.targetRotation.yaw, smoothing) % 360,
                roll: state.rotation.roll, // 通常rollは変更しない
              },
            }
          }

          return state
        }),

      setMode: (mode) =>
        Effect.sync(() => {
          state = { ...state, mode }
        }),

      setFOV: (fov) =>
        Effect.sync(() => {
          state = {
            ...state,
            fov: Math.max(30, Math.min(120, fov)),
          }
        }),

      reset: () =>
        Effect.sync(() => {
          state = defaultCameraState
        }),

      smoothTransition: (target, duration): Effect.Effect<void, CameraError> =>
        Effect.gen(function* () {
          const startState = { ...state }
          const startTime = Date.now()

          // トランジション実行
          const transition: Effect.Effect<void, never> = Effect.gen(function* () {
            const elapsed = (Date.now() - startTime) / 1000
            const progress = Math.min(elapsed / duration, 1)
            const eased = progress * progress * (3 - 2 * progress) // smoothstep

            if (target.position) {
              state = { ...state, position: {
                x: lerp(startState.position.x, target.position.x, eased),
                y: lerp(startState.position.y, target.position.y, eased),
                z: lerp(startState.position.z, target.position.z, eased),
              }}
            }

            if (target.rotation) {
              state = { ...state, rotation: {
                pitch: lerp(startState.rotation.pitch, target.rotation.pitch, eased),
                yaw: lerpAngle(startState.rotation.yaw, target.rotation.yaw, eased),
                roll: lerp(startState.rotation.roll, target.rotation.roll, eased),
              }}
            }

            if (target.fov !== undefined) {
              state = { ...state, fov: lerp(startState.fov, target.fov, eased) }
            }

            if (target.distance !== undefined) {
              state = { ...state, distance: lerp(startState.distance, target.distance, eased) }
            }

            if (progress < 1) {
              yield* Effect.sleep('16 millis') // ~60fps
              yield* transition
            }
          })

          yield* transition
        }),
    })
  }
)

// テスト用のMockサービス
export const CameraServiceTest = Layer.sync(
  CameraService,
  () => {
    let state = defaultCameraState

    return CameraService.of({
      getState: () => Effect.succeed(state),
      update: (params) =>
        Effect.sync(() => {
          if (params.mode !== undefined) state = { ...state, mode: params.mode }
          if (params.fov !== undefined) {
            state = { ...state, fov: Math.max(30, Math.min(120, params.fov)) }
          }
          if (params.targetPosition) state = { ...state, position: params.targetPosition }
          if (params.targetRotation) {
            state = { ...state, rotation: {
              ...state.rotation,
              pitch: Math.max(-90, Math.min(90, params.targetRotation.pitch)),
              yaw: params.targetRotation.yaw
            }}
          }
          if (params.distance !== undefined) {
            state = { ...state, distance: Math.max(1, Math.min(20, params.distance)) }
          }
          return state
        }),
      setMode: (mode) => Effect.sync(() => { state = { ...state, mode } }),
      setFOV: (fov) => Effect.sync(() => {
        state = { ...state, fov: Math.max(30, Math.min(120, fov)) }
      }),
      reset: () => Effect.sync(() => { state = defaultCameraState }),
      smoothTransition: () => Effect.void,
    })
  }
)
import { Brand, Data } from 'effect'

/**
 * 一人称カメラ設定
 */
export interface FirstPersonSettings {
  readonly bobbing: boolean
  readonly mouseSensitivity: number
  readonly smoothing: number
  readonly headOffset: number
}

/**
 * 三人称カメラ設定
 */
export interface ThirdPersonSettings {
  readonly mouseSensitivity: number
  readonly smoothing: number
  readonly distance: number
  readonly verticalOffset: number
  readonly collisionEnabled: boolean
}

/**
 * スペクテイターカメラ設定
 */
export interface SpectatorSettings {
  readonly movementSpeed: number
  readonly mouseSensitivity: number
  readonly freefly: boolean
  readonly nightVision: boolean
}

/**
 * シネマティックカメラ設定
 */
export interface CinematicSettings {
  readonly easing: boolean
  readonly duration: number
  readonly interpolation: 'linear' | 'smooth' | 'bezier'
  readonly lockInput: boolean
}

/**
 * カメラ距離（三人称カメラ用）
 */
export type CameraDistance = number & Brand.Brand<'CameraDistance'>

/**
 * アニメーションタイムライン
 */
export interface AnimationTimeline {
  readonly keyframes: readonly AnimationKeyframe[]
  readonly duration: number
  readonly loop: boolean
}

/**
 * アニメーションキーフレーム
 */
export interface AnimationKeyframe {
  readonly time: number
  readonly position: { readonly x: number; readonly y: number; readonly z: number }
  readonly rotation: { readonly pitch: number; readonly yaw: number }
  readonly easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out'
}

/**
 * カメラモード ADT - Data.TaggedEnumを使用
 */
export type ViewMode = Data.TaggedEnum<{
  FirstPerson: { readonly settings: FirstPersonSettings }
  ThirdPerson: { readonly settings: ThirdPersonSettings; readonly distance: CameraDistance }
  Spectator: { readonly settings: SpectatorSettings }
  Cinematic: { readonly settings: CinematicSettings; readonly timeline: AnimationTimeline }
}>

/**
 * ViewMode コンストラクタ
 */
export const ViewMode = Data.taggedEnum<ViewMode>()

/**
 * ViewModeエラー
 */
export type ViewModeError = Data.TaggedEnum<{
  InvalidDistance: { readonly distance: number; readonly min: number; readonly max: number }
  InvalidSettings: { readonly field: string; readonly value: unknown; readonly expected: string }
  InvalidTimeline: { readonly reason: string }
  InvalidMode: { readonly mode: unknown }
}>

/**
 * ViewModeError コンストラクタ
 */
export const ViewModeError = Data.taggedEnum<ViewModeError>()

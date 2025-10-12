import type { PlayerId, Vector3D } from '@domain/entities'
import type { ErrorCause } from '@shared/schema/error'
import { Context, Effect } from 'effect'

/**
 * ドメイン層が依存する抽象的な物理エンジン契約
 * 具体的なエンジン実装（例: cannon-es）はインフラ層で注入する
 */

// 物理世界の設定定数（ユビキタス言語に基づくドメイン値）
export const PHYSICS_CONSTANTS = {
  GRAVITY: -9.81,
  PLAYER_MASS: 70,
  PLAYER_RADIUS: 0.3,
  PLAYER_HEIGHT: 1.8,
  TIME_STEP: 1 / 60,
  MAX_SUB_STEPS: 3,
  FRICTION: 0.4,
  RESTITUTION: 0.3,
  LINEAR_DAMPING: 0.01,
  ANGULAR_DAMPING: 0.01,
} as const

// 物理ボディの状態
export interface PhysicsBodyState {
  readonly position: Vector3D
  readonly velocity: Vector3D
  readonly angularVelocity: Vector3D
  readonly quaternion: { x: number; y: number; z: number; w: number }
  readonly isOnGround: boolean
  readonly isColliding: boolean
}

// 物理エラー定義
export interface PhysicsEngineError {
  readonly _tag: 'PhysicsEngineError'
  readonly message: string
  readonly cause?: ErrorCause
}

// Character Controller設定
export interface CharacterControllerConfig {
  readonly mass: number
  readonly radius: number
  readonly height: number
  readonly friction: number
  readonly restitution: number
}

/**
 * ドメインが利用する物理エンジンの抽象ポート
 * 物理演算の具体実装はインフラ層で提供する
 */
export interface PhysicsEnginePort {
  readonly initializeWorld: () => Effect.Effect<void, PhysicsEngineError>
  readonly createPlayerController: (
    playerId: PlayerId,
    initialPosition: Vector3D,
    config?: Partial<CharacterControllerConfig>
  ) => Effect.Effect<string, PhysicsEngineError>
  readonly step: (deltaTime: number) => Effect.Effect<void, PhysicsEngineError>
  readonly getPlayerState: (bodyId: string) => Effect.Effect<PhysicsBodyState, PhysicsEngineError>
  readonly applyMovementForce: (bodyId: string, force: Vector3D) => Effect.Effect<void, PhysicsEngineError>
  readonly jumpPlayer: (bodyId: string, jumpVelocity: number) => Effect.Effect<void, PhysicsEngineError>
  readonly raycastGround: (
    position: Vector3D,
    distance: number
  ) => Effect.Effect<{ hit: boolean; distance: number; normal: Vector3D } | null, PhysicsEngineError>
  readonly addStaticBlock: (position: Vector3D, size: Vector3D) => Effect.Effect<string, PhysicsEngineError>
  readonly removeBody: (bodyId: string) => Effect.Effect<void, PhysicsEngineError>
  readonly cleanup: () => Effect.Effect<void, PhysicsEngineError>
}

// Context Tag
export const PhysicsEngine = Context.GenericTag<PhysicsEnginePort>('@minecraft/domain/PhysicsEngine')


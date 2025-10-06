/**
 * PlayerCamera Aggregate Module
 *
 * プレイヤー専用カメラのAggregate Rootとその関連機能を提供します。
 */

import { Schema } from 'effect'

// Aggregate Root
export { PlayerCamera, PlayerCameraOps, PlayerCameraSettings, PlayerId, Sensitivity, SmoothingFactor } from './factory'

// Factory
export { PlayerCameraFactory } from './factory'
export type { PlayerCamera, PlayerId }

// Schema for type guards
const PlayerCameraTagSchema = Schema.Struct({
  _tag: Schema.Literal('PlayerCamera'),
})

const PlayerIdSchema = Schema.String

// Type Guards
export const isPlayerCamera = (value: unknown): value is PlayerCamera => Schema.is(PlayerCameraTagSchema)(value)

export const isPlayerId = (value: unknown): value is PlayerId => Schema.is(PlayerIdSchema)(value)

// Re-export for convenience
import { PlayerCamera } from './service'
export * from './player_camera'

/**
 * PlayerCamera Aggregate Module
 *
 * プレイヤー専用カメラのAggregate Rootとその関連機能を提供します。
 */

/**
 * PlayerCamera Aggregate Module
 *
 * プレイヤー専用カメラのAggregate Rootとその関連機能を提供します。
 */

import { Schema } from 'effect'

// Aggregate Root and related types
export * from './player_camera'

// Factory
export { PlayerCameraFactory } from './factory'

// Schema for type guards
import { PlayerIdSchema } from '@domain/shared/entities/player_id'
import {
  PlayerCamera,
  PlayerCameraSchema,
  PlayerCameraSettings,
  PlayerId,
  Sensitivity,
  SmoothingFactor,
} from './player_camera'

// Type Guards
export const isPlayerCamera = (value: unknown): value is PlayerCamera => Schema.is(PlayerCameraSchema)(value)
export const isPlayerId = (value: unknown): value is PlayerId => Schema.is(PlayerIdSchema)(value)

// Re-export types for convenience
export type { PlayerCamera, PlayerCameraSettings, PlayerId, Sensitivity, SmoothingFactor }

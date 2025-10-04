/**
 * PlayerCamera Aggregate Module
 *
 * プレイヤー専用カメラのAggregate Rootとその関連機能を提供します。
 */

// Aggregate Root
export {
  PlayerCamera,
  PlayerCameraOps,
  PlayerCameraSettings,
  PlayerId,
  Sensitivity,
  SmoothingFactor,
} from './player_camera.js'

// Factory
export { PlayerCameraFactory } from './factory.js'
export type { PlayerCamera }

// Type Guards
export const isPlayerCamera = (value: unknown): value is PlayerCamera => {
  return typeof value === 'object' && value !== null && '_tag' in value && (value as any)._tag === 'PlayerCamera'
}

export const isPlayerId = (value: unknown): value is PlayerId => {
  return typeof value === 'string'
}

// Re-export for convenience
import { PlayerCamera } from './player_camera.js'

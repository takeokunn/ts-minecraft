/**
 * SceneCamera Aggregate Module
 *
 * シーン管理専用カメラのAggregate Rootとその関連機能を提供します。
 */

// Aggregate Root
export {
  CinematicKeyframe,
  CinematicSequence,
  CinematicSettings,
  FollowMode,
  SceneCamera,
  SceneCameraOps,
  SceneId,
  TargetStrategy,
  type EasingType,
} from './index'

// Factory
export { SceneCameraFactory } from './index'
export type { SceneCamera }

// Type Guards
export const isSceneCamera = (value: unknown): value is SceneCamera => {
  return typeof value === 'object' && value !== null && '_tag' in value && (value as any)._tag === 'SceneCamera'
}

export const isSceneId = (value: unknown): value is SceneId => {
  return typeof value === 'string'
}

export const isCinematicSequence = (value: unknown): value is CinematicSequence => {
  return typeof value === 'object' && value !== null && '_tag' in value && (value as any)._tag === 'CinematicSequence'
}

// Re-export for convenience
import { SceneCamera } from './index'
export * from './scene_camera';

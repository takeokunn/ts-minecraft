/**
 * SceneCamera Aggregate Module
 *
 * シーン管理専用カメラのAggregate Rootとその関連機能を提供します。
 */

import { Schema } from 'effect'

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
} from './factory'

// Factory
export { SceneCameraFactory } from './factory'
export type { CinematicSequence, SceneCamera, SceneId }

// Schema for type guards
const SceneCameraTagSchema = Schema.Struct({
  _tag: Schema.Literal('SceneCamera'),
})

const SceneIdSchema = Schema.String

const CinematicSequenceTagSchema = Schema.Struct({
  _tag: Schema.Literal('CinematicSequence'),
})

// Type Guards
export const isSceneCamera = (value: unknown): value is SceneCamera => Schema.is(SceneCameraTagSchema)(value)

export const isSceneId = (value: unknown): value is SceneId => Schema.is(SceneIdSchema)(value)

export const isCinematicSequence = (value: unknown): value is CinematicSequence =>
  Schema.is(CinematicSequenceTagSchema)(value)

// Re-export for convenience
import { SceneCamera } from './service'
export * from './scene_camera'

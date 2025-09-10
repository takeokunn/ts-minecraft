import * as S from 'effect/Schema'
import { PositionComponent } from '../physics/position'

/**
 * Camera Component - Camera positioning and behavior
 */

export const CameraComponent = S.Struct({
  position: PositionComponent,
  target: S.optional(PositionComponent),
  damping: S.Number.pipe(S.finite(), S.clamp(0, 1)),
})

export type CameraComponent = S.Schema.Type<typeof CameraComponent>

/**
 * CameraState Component - Camera rotation state
 */
export const CameraStateComponent = S.Struct({
  pitch: S.Number.pipe(S.finite()),
  yaw: S.Number.pipe(S.finite()),
})

export type CameraStateComponent = S.Schema.Type<typeof CameraStateComponent>
import * as S from 'effect/Schema'

/**
 * InputState Component - Current input state for controllable entities
 */

export const InputStateComponent = S.Struct({
  forward: S.Boolean,
  backward: S.Boolean,
  left: S.Boolean,
  right: S.Boolean,
  jump: S.Boolean,
  sprint: S.Boolean,
  place: S.Boolean,
  destroy: S.Boolean,
  isLocked: S.Boolean,
})

export type InputStateComponent = S.Schema.Type<typeof InputStateComponent>
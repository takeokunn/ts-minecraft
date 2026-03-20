/**
 * InputServicePort — application-layer interface for keyboard and mouse input.
 *
 * Defined here (application layer) so application-layer services and tests can
 * reference input capability without importing from the presentation layer.
 * The concrete implementation lives in src/presentation/input/input-service.ts.
 */
import { Effect } from 'effect'
import type { MouseDelta } from './player-input-service'

export interface InputServicePort {
  readonly isKeyPressed: (key: string) => Effect.Effect<boolean, never>
  readonly consumeKeyPress: (key: string) => Effect.Effect<boolean, never>
  readonly getMouseDelta: () => Effect.Effect<MouseDelta, never>
  readonly isMouseDown: (button: number) => Effect.Effect<boolean, never>
  readonly requestPointerLock: () => Effect.Effect<void, never>
  readonly exitPointerLock: () => Effect.Effect<void, never>
  readonly isPointerLocked: () => Effect.Effect<boolean, never>
  readonly consumeMouseClick: (button: number) => Effect.Effect<boolean, never>
  readonly consumeWheelDelta: () => Effect.Effect<number, never>
}

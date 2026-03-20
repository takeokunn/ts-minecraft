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
  readonly isKeyPressed: (key: string) => Effect.Effect<boolean>
  readonly consumeKeyPress: (key: string) => Effect.Effect<boolean>
  readonly getMouseDelta: () => Effect.Effect<MouseDelta>
  readonly isMouseDown: (button: number) => Effect.Effect<boolean>
  readonly requestPointerLock: () => Effect.Effect<void>
  readonly exitPointerLock: () => Effect.Effect<void>
  readonly isPointerLocked: () => Effect.Effect<boolean>
  readonly consumeMouseClick: (button: number) => Effect.Effect<boolean>
  readonly consumeWheelDelta: () => Effect.Effect<number>
}

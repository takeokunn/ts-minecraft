/**
 * InputServicePort — application-layer interface for keyboard and mouse input.
 *
 * Defined here (application layer) so application-layer services and tests can
 * reference input capability without importing from the presentation layer.
 * The concrete implementation lives in src/presentation/input/input-service.ts.
 */
import { Effect } from 'effect'
import type { MouseDelta } from './player-input-service'

export class InputServicePort extends Effect.Service<InputServicePort>()(
  '@minecraft/application/InputServicePort',
  {
    succeed: {
      isKeyPressed: (_key: string): Effect.Effect<boolean, never> => Effect.succeed(false),
      consumeKeyPress: (_key: string): Effect.Effect<boolean, never> => Effect.succeed(false),
      getMouseDelta: (): Effect.Effect<MouseDelta, never> => Effect.succeed({ x: 0, y: 0 }),
      isMouseDown: (_button: number): Effect.Effect<boolean, never> => Effect.succeed(false),
      requestPointerLock: (): Effect.Effect<void, never> => Effect.void,
      exitPointerLock: (): Effect.Effect<void, never> => Effect.void,
      isPointerLocked: (): Effect.Effect<boolean, never> => Effect.succeed(false),
      consumeMouseClick: (_button: number): Effect.Effect<boolean, never> => Effect.succeed(false),
      consumeWheelDelta: (): Effect.Effect<number, never> => Effect.succeed(0),
    },
  }
) {}

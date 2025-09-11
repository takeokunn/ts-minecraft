/**
 * Input Port - Interface for input device operations
 *
 * This port defines the contract for input operations,
 * allowing the domain layer to receive input without
 * depending on specific input implementations.
 */

import * as Effect from 'effect/Effect'
import * as Context from 'effect/Context'

export interface MouseState {
  readonly dx: number
  readonly dy: number
  readonly x: number
  readonly y: number
  readonly leftPressed: boolean
  readonly rightPressed: boolean
  readonly middlePressed: boolean
}

export interface KeyboardState {
  readonly keysPressed: ReadonlySet<string>
  readonly keysJustPressed: ReadonlySet<string>
  readonly keysJustReleased: ReadonlySet<string>
}

export interface IInputPort {
  // Mouse operations
  readonly getMouseState: () => Effect.Effect<MouseState, never, never>
  readonly resetMouseDelta: () => Effect.Effect<void, never, never>

  // Keyboard operations
  readonly getKeyboardState: () => Effect.Effect<KeyboardState, never, never>
  readonly isKeyPressed: (key: string) => Effect.Effect<boolean, never, never>
  readonly isKeyJustPressed: (key: string) => Effect.Effect<boolean, never, never>
  readonly isKeyJustReleased: (key: string) => Effect.Effect<boolean, never, never>

  // Input management
  readonly update: () => Effect.Effect<void, never, never>
  readonly lockPointer: () => Effect.Effect<void, never, never>
  readonly unlockPointer: () => Effect.Effect<void, never, never>
  readonly isPointerLocked: () => Effect.Effect<boolean, never, never>
}

export const InputPort = Context.GenericTag<IInputPort>('InputPort')

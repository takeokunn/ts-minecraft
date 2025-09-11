import { Context, Effect, Ref } from 'effect'

/**
 * Input state type
 */
export interface InputState {
  readonly forward: boolean
  readonly backward: boolean
  readonly left: boolean
  readonly right: boolean
  readonly jump: boolean
  readonly sprint: boolean
  readonly place: boolean
  readonly destroy: boolean
}

/**
 * Mouse state type
 */
export interface MouseState {
  readonly dx: number
  readonly dy: number
}

/**
 * InputManager Service - Manages user input
 */
export class InputManager extends Context.Tag('InputManager')<
  InputManager,
  {
    readonly isLocked: Ref.Ref<boolean>
    readonly getState: () => Effect.Effect<InputState, never, never>
    readonly getMouseState: () => Effect.Effect<MouseState, never, never>
    readonly getHotbarSelection: () => Effect.Effect<number, never, never>
  }
>() {}
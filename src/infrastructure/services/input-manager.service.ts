import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'

export interface InputManagerInterface {
  readonly initialize: () => Effect.Effect<void, never, never>
  readonly getInputState: () => Effect.Effect<any, never, never>
  readonly updateInputState: (state: any) => Effect.Effect<void, never, never>
  readonly dispose: () => Effect.Effect<void, never, never>
}

export class InputManager extends Context.GenericTag('InputManager')<
  InputManager,
  InputManagerInterface
>() {}
import { Effect, Context } from 'effect'
import type { InputHandler, MouseDelta, InputState, InputError } from './types'

// InputServiceインターフェース定義
export interface InputService {
  readonly isKeyPressed: (key: string) => Effect.Effect<boolean, never>
  readonly isMousePressed: (button: number) => Effect.Effect<boolean, never>
  readonly getMouseDelta: () => Effect.Effect<MouseDelta, never>
  readonly registerHandler: (handler: InputHandler) => Effect.Effect<void, never>
  readonly unregisterHandler: (id: string) => Effect.Effect<void, InputError>
  readonly getState: () => Effect.Effect<InputState, never>
  readonly reset: () => Effect.Effect<void, never>
}

// InputServiceタグ定義
export const InputService = Context.GenericTag<InputService>('@services/InputService')

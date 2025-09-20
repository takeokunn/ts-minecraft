import { Context, Effect } from 'effect'
import type { InputHandler } from './types'
import { InputHandlerRegistrationError, InputSystemError, MouseDelta } from './types'

// 入力サービスインターフェース
export interface InputService {
  readonly isKeyPressed: (key: string) => Effect.Effect<boolean, InputSystemError>
  readonly isMousePressed: (button: number) => Effect.Effect<boolean, InputSystemError>
  readonly getMouseDelta: () => Effect.Effect<MouseDelta, InputSystemError>
  readonly registerHandler: (handler: InputHandler) => Effect.Effect<void, InputHandlerRegistrationError>
}

// InputServiceのコンテキストタグ
export const InputService = Context.GenericTag<InputService>('@minecraft/InputService')

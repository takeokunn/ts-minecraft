import { Context, Effect } from 'effect'
import type { InputDomainError } from './errors'
import type { InputEvent, KeyCode, MouseButton, MouseDelta } from './model'
import type { InputSnapshot } from './state'

export type InputEventHandler = (event: InputEvent, snapshot: InputSnapshot) => Effect.Effect<void, never>

export interface InputService {
  readonly ingest: (event: InputEvent) => Effect.Effect<void, InputDomainError>
  readonly currentSnapshot: () => Effect.Effect<InputSnapshot>
  readonly isKeyPressed: (key: KeyCode) => Effect.Effect<boolean>
  readonly isMousePressed: (button: MouseButton) => Effect.Effect<boolean>
  readonly latestMouseDelta: () => Effect.Effect<MouseDelta>
  readonly bindAction: (handler: InputEventHandler) => Effect.Effect<void>
}

export const InputService = Context.GenericTag<InputService>('@domain/input/InputService')

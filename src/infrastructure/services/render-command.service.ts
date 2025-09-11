import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'

export interface RenderCommandInterface {
  readonly execute: (command: any) => Effect.Effect<void, never, never>
  readonly enqueue: (command: any) => Effect.Effect<void, never, never>
  readonly flush: () => Effect.Effect<void, never, never>
  readonly clear: () => Effect.Effect<void, never, never>
}

export class RenderCommand extends Context.GenericTag('RenderCommand')<
  RenderCommand,
  RenderCommandInterface
>() {}
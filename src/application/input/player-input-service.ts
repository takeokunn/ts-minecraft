import { Effect, Schema } from 'effect'

export const MouseDeltaSchema = Schema.Struct({
  x: Schema.Number.pipe(Schema.finite()),
  y: Schema.Number.pipe(Schema.finite()),
})
export type MouseDelta = Schema.Schema.Type<typeof MouseDeltaSchema>

export class PlayerInputService extends Effect.Service<PlayerInputService>()(
  '@minecraft/application/PlayerInputService',
  {
    succeed: {
      isKeyPressed: (_key: string): Effect.Effect<boolean> => Effect.succeed(false),
      consumeKeyPress: (_key: string): Effect.Effect<boolean> => Effect.succeed(false),
      consumeWheelDelta: (): Effect.Effect<number> => Effect.succeed(0),
      getMouseDelta: (): Effect.Effect<MouseDelta> => Effect.succeed({ x: 0, y: 0 }),
      isPointerLocked: (): Effect.Effect<boolean> => Effect.succeed(false),
    },
  }
) {}

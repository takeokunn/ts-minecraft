import { Effect, Schema } from 'effect';
export const MouseDeltaSchema = Schema.Struct({
    x: Schema.Number.pipe(Schema.finite()),
    y: Schema.Number.pipe(Schema.finite()),
});
export class PlayerInputService extends Effect.Service()('@minecraft/application/PlayerInputService', {
    succeed: {
        isKeyPressed: (_key) => Effect.succeed(false),
        consumeKeyPress: (_key) => Effect.succeed(false),
        consumeWheelDelta: () => Effect.succeed(0),
        getMouseDelta: () => Effect.succeed({ x: 0, y: 0 }),
        isPointerLocked: () => Effect.succeed(false),
    },
}) {
}
//# sourceMappingURL=../../../dist/packages/player/application/player-input-service.js.map
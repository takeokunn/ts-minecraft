import { Effect, Schema } from 'effect';
export declare const MouseDeltaSchema: Schema.Struct<{
    x: Schema.filter<typeof Schema.Number>;
    y: Schema.filter<typeof Schema.Number>;
}>;
export type MouseDelta = Schema.Schema.Type<typeof MouseDeltaSchema>;
declare const PlayerInputService_base: Effect.Service.Class<PlayerInputService, "@minecraft/application/PlayerInputService", {
    readonly succeed: {
        readonly isKeyPressed: (_key: string) => Effect.Effect<boolean, never>;
        readonly consumeKeyPress: (_key: string) => Effect.Effect<boolean, never>;
        readonly consumeWheelDelta: () => Effect.Effect<number, never>;
        readonly getMouseDelta: () => Effect.Effect<MouseDelta, never>;
        readonly isPointerLocked: () => Effect.Effect<boolean, never>;
    };
}>;
export declare class PlayerInputService extends PlayerInputService_base {
}
export {};
//# sourceMappingURL=player-input-service.d.ts.map
import { Schema } from 'effect';
export declare const PlayerStateSchema: Schema.Struct<{
    id: Schema.brand<typeof Schema.String, "PlayerId">;
    position: Schema.Struct<{
        x: Schema.filter<typeof Schema.Number>;
        y: Schema.filter<typeof Schema.Number>;
        z: Schema.filter<typeof Schema.Number>;
    }>;
    velocity: Schema.Struct<{
        x: Schema.filter<typeof Schema.Number>;
        y: Schema.filter<typeof Schema.Number>;
        z: Schema.filter<typeof Schema.Number>;
    }>;
    rotation: Schema.Struct<{
        x: Schema.filter<typeof Schema.Number>;
        y: Schema.filter<typeof Schema.Number>;
        z: Schema.filter<typeof Schema.Number>;
        w: Schema.filter<typeof Schema.Number>;
    }>;
}>;
export type PlayerState = Schema.Schema.Type<typeof PlayerStateSchema>;
//# sourceMappingURL=player-state.d.ts.map
import { Schema } from 'effect';
export declare const PositionSchema: Schema.Struct<{
    x: Schema.filter<typeof Schema.Number>;
    y: Schema.filter<typeof Schema.Number>;
    z: Schema.filter<typeof Schema.Number>;
}>;
export type Position = Schema.Schema.Type<typeof PositionSchema>;
//# sourceMappingURL=position.d.ts.map
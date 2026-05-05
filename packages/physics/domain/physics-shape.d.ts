import { Schema } from 'effect';
export declare const BoxShapeConfigSchema: Schema.Struct<{
    halfExtents: Schema.Struct<{
        x: Schema.filter<typeof Schema.Number>;
        y: Schema.filter<typeof Schema.Number>;
        z: Schema.filter<typeof Schema.Number>;
    }>;
}>;
export type BoxShapeConfig = Schema.Schema.Type<typeof BoxShapeConfigSchema>;
export declare const SphereShapeConfigSchema: Schema.Struct<{
    radius: Schema.filter<Schema.filter<typeof Schema.Number>>;
}>;
export type SphereShapeConfig = Schema.Schema.Type<typeof SphereShapeConfigSchema>;
//# sourceMappingURL=physics-shape.d.ts.map
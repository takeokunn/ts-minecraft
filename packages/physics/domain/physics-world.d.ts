import { Schema } from 'effect';
export declare const WorldConfigSchema: Schema.Struct<{
    gravity: Schema.Struct<{
        x: Schema.filter<typeof Schema.Number>;
        y: Schema.filter<typeof Schema.Number>;
        z: Schema.filter<typeof Schema.Number>;
    }>;
}>;
export type WorldConfig = Schema.Schema.Type<typeof WorldConfigSchema>;
export declare const CustomWorldSchema: Schema.mutable<Schema.Struct<{
    gravity: Schema.Struct<{
        x: Schema.filter<typeof Schema.Number>;
        y: Schema.filter<typeof Schema.Number>;
        z: Schema.filter<typeof Schema.Number>;
    }>;
    bodies: Schema.mutable<Schema.Array$<Schema.mutable<Schema.Struct<{
        position: Schema.mutable<Schema.Struct<{
            x: Schema.filter<typeof Schema.Number>;
            y: Schema.filter<typeof Schema.Number>;
            z: Schema.filter<typeof Schema.Number>;
        }>>;
        velocity: Schema.mutable<Schema.Struct<{
            x: Schema.filter<typeof Schema.Number>;
            y: Schema.filter<typeof Schema.Number>;
            z: Schema.filter<typeof Schema.Number>;
        }>>;
        mass: Schema.filter<Schema.filter<typeof Schema.Number>>;
        type: Schema.Literal<["dynamic", "static", "kinematic"]>;
        shape: Schema.Union<[Schema.Struct<{
            kind: Schema.Literal<["box"]>;
            halfExtents: Schema.Struct<{
                x: Schema.filter<typeof Schema.Number>;
                y: Schema.filter<typeof Schema.Number>;
                z: Schema.filter<typeof Schema.Number>;
            }>;
        }>, Schema.Struct<{
            kind: Schema.Literal<["sphere"]>;
            radius: Schema.filter<Schema.filter<typeof Schema.Number>>;
        }>, Schema.Struct<{
            kind: Schema.Literal<["plane"]>;
        }>]>;
    }>>>>;
}>>;
export type CustomWorld = Schema.Schema.Type<typeof CustomWorldSchema>;
//# sourceMappingURL=physics-world.d.ts.map
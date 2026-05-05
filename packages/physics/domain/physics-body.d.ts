import { Schema } from 'effect';
export declare const CustomShapeSchema: Schema.Union<[Schema.Struct<{
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
export type CustomShape = Schema.Schema.Type<typeof CustomShapeSchema>;
export declare const CustomBodySchema: Schema.mutable<Schema.Struct<{
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
}>>;
export type CustomBody = Schema.Schema.Type<typeof CustomBodySchema>;
export declare const RigidBodyConfigSchema: Schema.Struct<{
    mass: Schema.filter<Schema.filter<typeof Schema.Number>>;
    position: Schema.Struct<{
        x: Schema.filter<typeof Schema.Number>;
        y: Schema.filter<typeof Schema.Number>;
        z: Schema.filter<typeof Schema.Number>;
    }>;
    type: Schema.optional<Schema.Literal<["dynamic", "static", "kinematic"]>>;
}>;
export type RigidBodyConfig = Schema.Schema.Type<typeof RigidBodyConfigSchema>;
//# sourceMappingURL=physics-body.d.ts.map
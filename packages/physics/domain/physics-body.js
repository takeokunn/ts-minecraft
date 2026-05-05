import { Schema } from 'effect';
import { Vector3Schema } from '@ts-minecraft/kernel';
export const CustomShapeSchema = Schema.Union(Schema.Struct({ kind: Schema.Literal('box'), halfExtents: Vector3Schema }), Schema.Struct({ kind: Schema.Literal('sphere'), radius: Schema.Number.pipe(Schema.finite(), Schema.positive()) }), Schema.Struct({ kind: Schema.Literal('plane') }));
export const CustomBodySchema = Schema.mutable(Schema.Struct({
    position: Schema.mutable(Vector3Schema),
    velocity: Schema.mutable(Vector3Schema),
    mass: Schema.Number.pipe(Schema.finite(), Schema.nonNegative()),
    type: Schema.Literal('dynamic', 'static', 'kinematic'),
    shape: CustomShapeSchema,
}));
export const RigidBodyConfigSchema = Schema.Struct({
    mass: Schema.Number.pipe(Schema.finite(), Schema.nonNegative()),
    position: Vector3Schema,
    type: Schema.optional(Schema.Literal('dynamic', 'static', 'kinematic')),
});
//# sourceMappingURL=physics-body.js.map
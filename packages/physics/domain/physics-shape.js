import { Schema } from 'effect';
import { Vector3Schema } from '@ts-minecraft/kernel';
export const BoxShapeConfigSchema = Schema.Struct({
    halfExtents: Vector3Schema,
});
export const SphereShapeConfigSchema = Schema.Struct({
    radius: Schema.Number.pipe(Schema.finite(), Schema.positive()),
});
//# sourceMappingURL=../../../dist/packages/physics/domain/physics-shape.js.map
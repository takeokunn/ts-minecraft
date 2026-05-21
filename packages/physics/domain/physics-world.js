import { Schema } from 'effect';
import { Vector3Schema } from '@ts-minecraft/kernel';
import { CustomBodySchema } from './physics-body';
export const WorldConfigSchema = Schema.Struct({
    gravity: Vector3Schema,
});
export const CustomWorldSchema = Schema.mutable(Schema.Struct({
    gravity: Vector3Schema,
    bodies: Schema.mutable(Schema.Array(CustomBodySchema)),
}));
//# sourceMappingURL=../../../dist/packages/physics/domain/physics-world.js.map
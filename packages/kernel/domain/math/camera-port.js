// Duck-typed: satisfied structurally by THREE.PerspectiveCamera and test doubles with the same shape.
import { Schema } from 'effect';
export const CameraRotationPortSchema = Schema.mutable(Schema.Struct({
    rotation: Schema.Struct({
        set: Schema.declare((u) => typeof u === 'function'),
    }),
}));
// Extended port with position + lookAt; used by third-person camera to relocate and orient.
export const CameraTransformPortSchema = Schema.mutable(Schema.Struct({
    rotation: Schema.Struct({
        set: Schema.declare((u) => typeof u === 'function'),
    }),
    position: Schema.Struct({
        set: Schema.declare((u) => typeof u === 'function'),
    }),
    lookAt: Schema.declare((u) => typeof u === 'function'),
}));
//# sourceMappingURL=camera-port.js.map
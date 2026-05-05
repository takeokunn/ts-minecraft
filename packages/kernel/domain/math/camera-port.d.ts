import { Schema } from 'effect';
type EulerOrder = 'XYZ' | 'YZX' | 'ZXY' | 'XZY' | 'YXZ' | 'ZYX';
type CameraRotationSet = (x: number, y: number, z: number, order?: EulerOrder) => void;
type CameraVec3Set = (x: number, y: number, z: number) => void;
type CameraLookAt = (x: number, y: number, z: number) => void;
export declare const CameraRotationPortSchema: Schema.mutable<Schema.Struct<{
    rotation: Schema.Struct<{
        set: Schema.declare<CameraRotationSet, CameraRotationSet, readonly [], never>;
    }>;
}>>;
export type CameraRotationPort = Schema.Schema.Type<typeof CameraRotationPortSchema>;
export declare const CameraTransformPortSchema: Schema.mutable<Schema.Struct<{
    rotation: Schema.Struct<{
        set: Schema.declare<CameraRotationSet, CameraRotationSet, readonly [], never>;
    }>;
    position: Schema.Struct<{
        set: Schema.declare<CameraVec3Set, CameraVec3Set, readonly [], never>;
    }>;
    lookAt: Schema.declare<CameraLookAt, CameraLookAt, readonly [], never>;
}>>;
export type CameraTransformPort = Schema.Schema.Type<typeof CameraTransformPortSchema>;
export {};
//# sourceMappingURL=camera-port.d.ts.map
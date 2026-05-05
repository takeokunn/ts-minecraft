import { Schema } from 'effect';
import type { Vector3 } from './vector3';
export declare const QuaternionSchema: Schema.Struct<{
    x: Schema.filter<typeof Schema.Number>;
    y: Schema.filter<typeof Schema.Number>;
    z: Schema.filter<typeof Schema.Number>;
    w: Schema.filter<typeof Schema.Number>;
}>;
export type Quaternion = Schema.Schema.Type<typeof QuaternionSchema>;
export declare const identity: Quaternion;
export declare const makeQuaternion: (x: number, y: number, z: number, w: number) => Quaternion;
export declare const fromAxisAngle: (axis: Vector3, angle: number) => Quaternion;
export declare const multiply: (a: Quaternion, b: Quaternion) => Quaternion;
export declare const slerp: (a: Quaternion, b: Quaternion, t: number) => Quaternion;
//# sourceMappingURL=quaternion.d.ts.map
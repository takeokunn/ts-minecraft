import { Schema } from 'effect';
export declare const Vector3Schema: Schema.Struct<{
    x: Schema.filter<typeof Schema.Number>;
    y: Schema.filter<typeof Schema.Number>;
    z: Schema.filter<typeof Schema.Number>;
}>;
export type Vector3 = Schema.Schema.Type<typeof Vector3Schema>;
export declare const makeVector3: (x: number, y: number, z: number) => Vector3;
export declare const zero: Vector3;
export declare const one: Vector3;
export declare const up: Vector3;
export declare const down: Vector3;
export declare const left: Vector3;
export declare const right: Vector3;
export declare const forward: Vector3;
export declare const backward: Vector3;
export declare const add: (a: Vector3, b: Vector3) => Vector3;
export declare const subtract: (a: Vector3, b: Vector3) => Vector3;
export declare const scale: (v: Vector3, s: number) => Vector3;
export declare const dot: (a: Vector3, b: Vector3) => number;
export declare const cross: (a: Vector3, b: Vector3) => Vector3;
export declare const length: (v: Vector3) => number;
export declare const lengthSquared: (v: Vector3) => number;
export declare const normalize: (v: Vector3) => Vector3;
export declare const distance: (a: Vector3, b: Vector3) => number;
export declare const toJSON: (v: Vector3) => {
    x: number;
    y: number;
    z: number;
};
export declare const fromJSON: (json: {
    x: number;
    y: number;
    z: number;
}) => Vector3;
//# sourceMappingURL=vector3.d.ts.map
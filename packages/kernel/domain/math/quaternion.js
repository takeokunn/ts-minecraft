import { Schema } from 'effect';
import { normalize } from './vector3';
export const QuaternionSchema = Schema.Struct({ x: Schema.Number.pipe(Schema.finite()), y: Schema.Number.pipe(Schema.finite()), z: Schema.Number.pipe(Schema.finite()), w: Schema.Number.pipe(Schema.finite()) });
export const identity = { x: 0, y: 0, z: 0, w: 1 };
export const makeQuaternion = (x, y, z, w) => ({ x, y, z, w });
export const fromAxisAngle = (axis, angle) => {
    const unitAxis = normalize(axis);
    const halfAngle = angle / 2;
    const sinHalfAngle = Math.sin(halfAngle);
    return {
        x: unitAxis.x * sinHalfAngle,
        y: unitAxis.y * sinHalfAngle,
        z: unitAxis.z * sinHalfAngle,
        w: Math.cos(halfAngle),
    };
};
export const multiply = (a, b) => ({
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
});
const length = (q) => Math.sqrt(q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w);
const normalizeQuaternion = (q) => {
    const len = length(q);
    if (len === 0)
        return identity;
    return { x: q.x / len, y: q.y / len, z: q.z / len, w: q.w / len };
};
export const slerp = (a, b, t) => {
    const dot = a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w;
    const target = dot < 0
        ? { x: -b.x, y: -b.y, z: -b.z, w: -b.w }
        : b;
    const cosHalfTheta = Math.min(1, Math.max(-1, Math.abs(dot)));
    if (cosHalfTheta > 0.9995) {
        return normalizeQuaternion({
            x: a.x + t * (target.x - a.x),
            y: a.y + t * (target.y - a.y),
            z: a.z + t * (target.z - a.z),
            w: a.w + t * (target.w - a.w),
        });
    }
    const halfTheta = Math.acos(cosHalfTheta);
    const sinHalfTheta = Math.sqrt(1 - cosHalfTheta * cosHalfTheta);
    const ratioA = Math.sin((1 - t) * halfTheta) / sinHalfTheta;
    const ratioB = Math.sin(t * halfTheta) / sinHalfTheta;
    return {
        x: a.x * ratioA + target.x * ratioB,
        y: a.y * ratioA + target.y * ratioB,
        z: a.z * ratioA + target.z * ratioB,
        w: a.w * ratioA + target.w * ratioB,
    };
};
//# sourceMappingURL=quaternion.js.map
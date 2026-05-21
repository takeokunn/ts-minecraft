export { Vector3Schema } from '@ts-minecraft/kernel';
export const makeVector3 = (x, y, z) => ({ x, y, z });
export const zero = { x: 0, y: 0, z: 0 };
export const one = { x: 1, y: 1, z: 1 };
export const up = { x: 0, y: 1, z: 0 };
export const down = { x: 0, y: -1, z: 0 };
export const left = { x: -1, y: 0, z: 0 };
export const right = { x: 1, y: 0, z: 0 };
export const forward = { x: 0, y: 0, z: -1 };
export const backward = { x: 0, y: 0, z: 1 };
export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const subtract = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const scale = (v, s) => ({ x: v.x * s, y: v.y * s, z: v.z * s });
export const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
export const cross = (a, b) => ({
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
});
export const length = (v) => Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
export const lengthSquared = (v) => v.x * v.x + v.y * v.y + v.z * v.z;
export const normalize = (v) => {
    const len = length(v);
    if (len === 0)
        return zero;
    return scale(v, 1 / len);
};
export const distance = (a, b) => length({ x: b.x - a.x, y: b.y - a.y, z: b.z - a.z });
//# sourceMappingURL=../../../../dist/packages/physics/domain/core/vector3.js.map
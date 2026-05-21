import { Schema } from 'effect';
// Finite branded velocity; negative values are valid (deceleration, reverse movement).
export const MetersPerSecSchema = Schema.Number.pipe(Schema.finite(), Schema.brand('MetersPerSec'));
export const MetersPerSec = {
    make: (n) => Schema.decodeUnknownSync(MetersPerSecSchema)(n),
    toNumber: (v) => v,
};
//# sourceMappingURL=../../../dist/packages/kernel/domain/physics.js.map
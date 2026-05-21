import { Schema } from 'effect';
export const SlotIndexSchema = Schema.Number.pipe(Schema.int(), Schema.nonNegative(), Schema.brand('SlotIndex'));
export const SlotIndex = {
    make: (n) => Schema.decodeUnknownSync(SlotIndexSchema)(n),
    // Brand is a nominal type tag only; the underlying value is always a plain number
    toNumber: (idx) => idx,
};
export const DeltaTimeSecsSchema = Schema.Number.pipe(Schema.finite(), Schema.positive(), Schema.brand('DeltaTimeSecs'));
export const DeltaTimeSecs = {
    make: (n) => Schema.decodeUnknownSync(DeltaTimeSecsSchema)(n),
};
export const BlockIndexSchema = Schema.Number.pipe(Schema.int(), Schema.nonNegative(), Schema.lessThanOrEqualTo(65535), Schema.brand('BlockIndex'));
export const BlockIndex = {
    make: (n) => Schema.decodeUnknownSync(BlockIndexSchema)(n),
};
//# sourceMappingURL=../../../dist/packages/kernel/domain/numerics.js.map
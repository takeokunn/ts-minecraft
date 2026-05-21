import { Schema } from 'effect';
export const PositionSchema = Schema.Struct({
    x: Schema.Number.pipe(Schema.finite()),
    y: Schema.Number.pipe(Schema.finite()),
    z: Schema.Number.pipe(Schema.finite()),
});
//# sourceMappingURL=../../../dist/packages/kernel/domain/position.js.map
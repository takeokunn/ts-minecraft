import { Schema } from 'effect';
export const ColorSchema = Schema.Struct({
    r: Schema.Number.pipe(Schema.finite(), Schema.between(0, 1)),
    g: Schema.Number.pipe(Schema.finite(), Schema.between(0, 1)),
    b: Schema.Number.pipe(Schema.finite(), Schema.between(0, 1)),
});
export const makeColor = (r, g, b) => ({ r, g, b });
export const fromHex = (hex) => {
    const normalized = hex.startsWith('#') ? hex.slice(1) : hex;
    const numeric = Number.parseInt(normalized, 16);
    return {
        r: ((numeric >> 16) & 0xff) / 255,
        g: ((numeric >> 8) & 0xff) / 255,
        b: (numeric & 0xff) / 255,
    };
};
//# sourceMappingURL=../../../../dist/packages/kernel/domain/math/color.js.map
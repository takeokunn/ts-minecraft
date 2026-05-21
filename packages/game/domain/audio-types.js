import { Schema } from 'effect';
export const OscillatorWaveSchema = Schema.Literal('sine', 'square', 'sawtooth', 'triangle', 'custom');
export const ToneRequestSchema = Schema.Struct({
    frequency: Schema.Number.pipe(Schema.finite(), Schema.positive()),
    durationMs: Schema.Number.pipe(Schema.finite(), Schema.nonNegative()),
    gain: Schema.Number.pipe(Schema.finite(), Schema.between(0, 1)),
    pan: Schema.Number.pipe(Schema.finite(), Schema.between(-1, 1)),
    wave: OscillatorWaveSchema,
    loop: Schema.Boolean,
});
export const ToneHandleSchema = Schema.Struct({
    id: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
});
export const clamp01 = (value) => Math.max(0, Math.min(1, value));
export const clampPan = (value) => Math.max(-1, Math.min(1, value));
//# sourceMappingURL=../../../dist/packages/game/domain/audio-types.js.map
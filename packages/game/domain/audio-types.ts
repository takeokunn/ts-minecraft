import { Schema } from 'effect'

export const OscillatorWaveSchema = Schema.Literal('sine', 'square', 'sawtooth', 'triangle', 'custom')
export type OscillatorWave = Schema.Schema.Type<typeof OscillatorWaveSchema>

export const AudioPositionSchema = Schema.Struct({
  x: Schema.Number.pipe(Schema.finite()),
  y: Schema.Number.pipe(Schema.finite()),
  z: Schema.Number.pipe(Schema.finite()),
})
export type AudioPosition = Schema.Schema.Type<typeof AudioPositionSchema>

export const ToneRequestSchema = Schema.Struct({
  frequency: Schema.Number.pipe(Schema.finite(), Schema.positive()),
  durationMs: Schema.Number.pipe(Schema.finite(), Schema.nonNegative()),
  gain: Schema.Number.pipe(Schema.finite(), Schema.between(0, 1)),
  pan: Schema.optionalWith(Schema.Number.pipe(Schema.finite(), Schema.between(-1, 1)), { default: () => 0 }),
  position: Schema.optional(AudioPositionSchema),
  wave: OscillatorWaveSchema,
  loop: Schema.Boolean,
})
export type ToneRequest = Schema.Schema.Type<typeof ToneRequestSchema>

export const ToneHandleSchema = Schema.Struct({
  id: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
})
export type ToneHandle = Schema.Schema.Type<typeof ToneHandleSchema>

import { Schema } from 'effect'
import { DeltaTimeSecsSchema, FIRST_FRAME_DELTA_SECS } from '@ts-minecraft/core'
import { DeltaTimeSecs } from '@ts-minecraft/core'

export const TimingStateSchema = Schema.Struct({
  lastFrameTime: Schema.Number.pipe(Schema.finite(), Schema.nonNegative()),
  deltaTime: DeltaTimeSecsSchema,
  frameCount: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
})
export type TimingState = Schema.Schema.Type<typeof TimingStateSchema>

export const INITIAL_TIMING_STATE: TimingState = {
  lastFrameTime: 0,
  deltaTime: DeltaTimeSecs.make(FIRST_FRAME_DELTA_SECS),
  frameCount: 0,
}

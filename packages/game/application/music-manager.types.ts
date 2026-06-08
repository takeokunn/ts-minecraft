import { Schema } from 'effect'

export const MusicEnvironmentSchema = Schema.Literal('day', 'night', 'cave')
export type MusicEnvironment = Schema.Schema.Type<typeof MusicEnvironmentSchema>

export const MusicSettingsSchema = Schema.Struct({
  enabled: Schema.Boolean,
  masterVolume: Schema.Number.pipe(Schema.finite(), Schema.between(0, 1)),
  musicVolume: Schema.Number.pipe(Schema.finite(), Schema.between(0, 1)),
})
export type MusicSettings = Schema.Schema.Type<typeof MusicSettingsSchema>

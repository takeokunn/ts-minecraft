import { Schema } from 'effect'
import { SOUND_LIBRARY } from './sound-manager.config'

export const SoundEffectSchema = Schema.Literal('blockBreak', 'blockPlace', 'playerHurt', 'entityHit', 'mobHurt', 'mobDeath', 'enchant')
export type SoundEffect = Schema.Schema.Type<typeof SoundEffectSchema>

// Bidirectional lockstep between the schema union and the synth table. The
// schema→table direction is already enforced by `SOUND_LIBRARY[effect]` indexing
// in playEffect (a union member with no table key would be ill-typed). This
// `satisfies` clause adds the table→schema direction: a SOUND_LIBRARY key with
// no matching literal would make the table not assignable to the keyed record,
// so adding either side without the other is a tsc error.
SOUND_LIBRARY satisfies Record<SoundEffect, unknown>

export const SoundSettingsSchema = Schema.Struct({
  enabled: Schema.Boolean,
  masterVolume: Schema.Number.pipe(Schema.finite(), Schema.between(0, 1)),
  sfxVolume: Schema.Number.pipe(Schema.finite(), Schema.between(0, 1)),
})
export type SoundSettings = Schema.Schema.Type<typeof SoundSettingsSchema>

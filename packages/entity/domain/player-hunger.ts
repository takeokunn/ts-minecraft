import { Schema } from 'effect'

// Minecraft hunger model. Three coupled values, all on the vanilla scale:
//   foodLevel  — 0..20 (the visible drumstick bar; 20 = full)
//   saturation — 0..20, a hidden reserve drained before foodLevel; capped at foodLevel
//   exhaustion — 0..40 accumulator; each whole MAX_EXHAUSTION unit consumes 1 saturation
//                (or 1 foodLevel when saturation is empty)
export class PlayerHunger extends Schema.Class<PlayerHunger>('PlayerHunger')({
  foodLevel: Schema.Number.pipe(Schema.int(), Schema.between(0, 20)),
  saturation: Schema.Number.pipe(Schema.finite(), Schema.between(0, 20)),
  exhaustion: Schema.Number.pipe(Schema.finite(), Schema.between(0, 40)),
}) {}

// Cross-field invariant: saturation is a reserve *behind* foodLevel and can never
// exceed it. Field-level validators above only enforce per-field bounds.
// Use this schema at storage deserialization boundaries.
// HungerService maintains the invariant internally via clamp logic (Math.min).
export const PlayerHungerInvariant = PlayerHunger.pipe(
  Schema.filter(
    (h: PlayerHunger) => h.saturation <= h.foodLevel
      ? true
      : `saturation (${h.saturation}) must not exceed foodLevel (${h.foodLevel})`,
    { identifier: 'PlayerHungerInvariant' }
  )
)

export type HungerState = {
  readonly hunger: PlayerHunger
  readonly tickTimer: number
}

export type HungerTickEffect = 'none' | 'regen' | 'starve'

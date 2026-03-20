import { Schema } from 'effect'

export class PlayerHealth extends Schema.Class<PlayerHealth>('PlayerHealth')({
  current: Schema.Number.pipe(Schema.between(0, 20)),
  max: Schema.Number.pipe(Schema.between(1, 20)),
  invincibilityTicks: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0)),
}) {}

// Cross-field invariant: current health must not exceed max health.
// Field-level validators above only enforce per-field bounds (e.g., 0–20).
// Use this schema at storage deserialization boundaries.
// HealthService maintains the invariant internally via clamp logic (Math.min/max).
export const PlayerHealthInvariant = PlayerHealth.pipe(
  Schema.filter(
    (h: PlayerHealth) => h.current <= h.max
      ? true
      : `current health (${h.current}) must not exceed max health (${h.max})`,
    { identifier: 'PlayerHealthInvariant' }
  )
)

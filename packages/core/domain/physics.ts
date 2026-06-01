import { Schema } from 'effect'

// Finite branded velocity; negative values are valid (deceleration, reverse movement).
export const MetersPerSecSchema = Schema.Number.pipe(
  Schema.finite(),
  Schema.brand('MetersPerSec')
)
export type MetersPerSec = Schema.Schema.Type<typeof MetersPerSecSchema>
export const MetersPerSec = {
  make: (n: number): MetersPerSec => Schema.decodeUnknownSync(MetersPerSecSchema)(n),
  toNumber: (v: MetersPerSec): number => v,
}

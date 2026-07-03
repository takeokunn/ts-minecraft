import { Schema } from 'effect'
import { PositionSchema } from '@ts-minecraft/core'

export const RedstonePowerLevelSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.between(0, 15),
  Schema.brand('RedstonePowerLevel'),
)
export type RedstonePowerLevel = Schema.Schema.Type<typeof RedstonePowerLevelSchema>
export const RedstonePowerLevel = {
  make: (n: number): RedstonePowerLevel => Schema.decodeUnknownSync(RedstonePowerLevelSchema)(n),
  toNumber: (p: RedstonePowerLevel): number => Number(p),
}

export const RedstoneComponentTypeSchema = Schema.Literal('wire', 'lever', 'button', 'torch', 'piston', 'pressure_plate', 'lamp', 'observer', 'hopper', 'repeater', 'comparator', 'dispenser')
export type RedstoneComponentType = Schema.Schema.Type<typeof RedstoneComponentTypeSchema>
export const RedstoneComponentType = {
  Wire: 'wire' as const,
  Lever: 'lever' as const,
  Button: 'button' as const,
  Torch: 'torch' as const,
  Piston: 'piston' as const,
  PressurePlate: 'pressure_plate' as const,
  Lamp: 'lamp' as const,
  Observer: 'observer' as const,
  Hopper: 'hopper' as const,
  Repeater: 'repeater' as const,
  Comparator: 'comparator' as const,
  Dispenser: 'dispenser' as const,
}

// Direction a piston pushes toward, captured from the player's view direction
// at placement (vanilla-style orientation); east = +x, south = +z, up = +y.
// Steep view pitch (dominant vertical component) selects up/down.
export const PistonFacingSchema = Schema.Literal('north', 'south', 'east', 'west', 'up', 'down')
export type PistonFacing = Schema.Schema.Type<typeof PistonFacingSchema>

export const RedstoneComponentStateSchema = Schema.Struct({
  active: Schema.Boolean,
  buttonTicksRemaining: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  pistonExtended: Schema.Boolean,
  // Optional so every pre-facing construction site stays valid; readers
  // default absent to 'east' (the old fixed +x push direction).
  pistonFacing: Schema.optional(PistonFacingSchema),
  // Comparator output strength (0-15): rear signal when rear >= max(sides),
  // else 0. Optional so pre-comparator states stay valid; readers default 0.
  comparatorOutput: Schema.optional(Schema.Number),
  // Comparator mode: subtract (true) or compare (false/absent, the default).
  comparatorSubtract: Schema.optional(Schema.Boolean),
})
export type RedstoneComponentState = Schema.Schema.Type<typeof RedstoneComponentStateSchema>

export const RedstoneComponentSchema = Schema.Struct({
  type: RedstoneComponentTypeSchema,
  position: PositionSchema,
  state: RedstoneComponentStateSchema,
})
export type RedstoneComponent = Schema.Schema.Type<typeof RedstoneComponentSchema>

export const RedstoneTickSnapshotSchema = Schema.Struct({
  tick: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  poweredPositions: Schema.Array(
    Schema.Struct({
      position: PositionSchema,
      power: RedstonePowerLevelSchema,
    }),
  ),
})
export type RedstoneTickSnapshot = Schema.Schema.Type<typeof RedstoneTickSnapshotSchema>

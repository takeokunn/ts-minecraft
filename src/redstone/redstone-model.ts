import { Schema } from 'effect'
import { PositionSchema } from '@/shared/kernel'

export const RedstonePowerLevelSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.between(0, 15),
  Schema.brand('RedstonePowerLevel'),
)
export type RedstonePowerLevel = Schema.Schema.Type<typeof RedstonePowerLevelSchema>
export const RedstonePowerLevel = {
  make: (n: number): RedstonePowerLevel => Schema.decodeUnknownSync(RedstonePowerLevelSchema)(n),
  toNumber: (p: RedstonePowerLevel): number => p as unknown as number,
}

export const RedstoneComponentTypeSchema = Schema.Literal('wire', 'lever', 'button', 'torch', 'piston')
export type RedstoneComponentType = Schema.Schema.Type<typeof RedstoneComponentTypeSchema>
export const RedstoneComponentType = {
  Wire: 'wire' as const,
  Lever: 'lever' as const,
  Button: 'button' as const,
  Torch: 'torch' as const,
  Piston: 'piston' as const,
}

export const RedstoneComponentStateSchema = Schema.Struct({
  active: Schema.Boolean,
  buttonTicksRemaining: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  pistonExtended: Schema.Boolean,
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

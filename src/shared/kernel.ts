import { Schema } from 'effect'

export const WorldIdSchema = Schema.String.pipe(Schema.brand('WorldId'))
export type WorldId = Schema.Schema.Type<typeof WorldIdSchema>

export const PlayerIdSchema = Schema.String.pipe(Schema.brand('PlayerId'))
export type PlayerId = Schema.Schema.Type<typeof PlayerIdSchema>

export const BlockIdSchema = Schema.String.pipe(Schema.brand('BlockId'))
export type BlockId = Schema.Schema.Type<typeof BlockIdSchema>

export const PhysicsBodyIdSchema = Schema.String.pipe(Schema.brand('PhysicsBodyId'))
export type PhysicsBodyId = Schema.Schema.Type<typeof PhysicsBodyIdSchema>

export const ChunkIdSchema = Schema.String.pipe(Schema.brand('ChunkId'))
export type ChunkId = Schema.Schema.Type<typeof ChunkIdSchema>

export const SlotIndexSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.nonNegative(),
  Schema.brand('SlotIndex')
)
export type SlotIndex = Schema.Schema.Type<typeof SlotIndexSchema>
export const SlotIndex = {
  make: (n: number): SlotIndex => Schema.decodeUnknownSync(SlotIndexSchema)(n),
  toNumber: (idx: SlotIndex): number => idx as unknown as number,
}

export const DeltaTimeSecsSchema = Schema.Number.pipe(
  Schema.positive(),
  Schema.brand('DeltaTimeSecs')
)
export type DeltaTimeSecs = Schema.Schema.Type<typeof DeltaTimeSecsSchema>
export const DeltaTimeSecs = {
  make: (n: number): DeltaTimeSecs => Schema.decodeUnknownSync(DeltaTimeSecsSchema)(n),
}

export const BlockIndexSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.nonNegative(),
  Schema.brand('BlockIndex')
)
export type BlockIndex = Schema.Schema.Type<typeof BlockIndexSchema>
export const BlockIndex = {
  make: (n: number): BlockIndex => Schema.decodeUnknownSync(BlockIndexSchema)(n),
}

export const BlockXSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.nonNegative(),
  Schema.brand('BlockX')
)
export type BlockX = Schema.Schema.Type<typeof BlockXSchema>

export const BlockYSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.nonNegative(),
  Schema.brand('BlockY')
)
export type BlockY = Schema.Schema.Type<typeof BlockYSchema>

export const BlockZSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.nonNegative(),
  Schema.brand('BlockZ')
)
export type BlockZ = Schema.Schema.Type<typeof BlockZSchema>

export const PositionSchema = Schema.Struct({
  x: Schema.Number.pipe(Schema.finite()),
  y: Schema.Number.pipe(Schema.finite()),
  z: Schema.Number.pipe(Schema.finite()),
})
export type Position = Schema.Schema.Type<typeof PositionSchema>

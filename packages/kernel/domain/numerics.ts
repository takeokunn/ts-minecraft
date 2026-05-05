import { Schema } from 'effect'

export const SlotIndexSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.nonNegative(),
  Schema.brand('SlotIndex')
)
export type SlotIndex = Schema.Schema.Type<typeof SlotIndexSchema>
export const SlotIndex = {
  make: (n: number): SlotIndex => Schema.decodeUnknownSync(SlotIndexSchema)(n),
  // Brand is a nominal type tag only; the underlying value is always a plain number
  toNumber: (idx: SlotIndex): number => idx,
}

export const DeltaTimeSecsSchema = Schema.Number.pipe(
  Schema.finite(),
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
  Schema.lessThanOrEqualTo(65535),
  Schema.brand('BlockIndex')
)
export type BlockIndex = Schema.Schema.Type<typeof BlockIndexSchema>
export const BlockIndex = {
  make: (n: number): BlockIndex => Schema.decodeUnknownSync(BlockIndexSchema)(n),
}

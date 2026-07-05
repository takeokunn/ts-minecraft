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

// Stack size of a non-empty inventory stack. Mirrors the ItemStack schema
// constraint (int, 1-64); brands the value at layer boundaries (e.g. the
// hotbar HUD) so a raw or out-of-range number cannot masquerade as a count.
export const StackCountSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.between(1, 64),
  Schema.brand('StackCount')
)
export type StackCount = Schema.Schema.Type<typeof StackCountSchema>
export const StackCount = {
  make: (n: number): StackCount => Schema.decodeUnknownSync(StackCountSchema)(n),
  // Brand is a nominal type tag only; the underlying value is always a plain number
  toNumber: (c: StackCount): number => c,
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

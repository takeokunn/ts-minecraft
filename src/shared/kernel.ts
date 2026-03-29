import { Schema } from 'effect'

// ---------------------------------------------------------------------------
// String branded types
// ---------------------------------------------------------------------------
// Companions use direct casts because the only constraint is "must be a string",
// which TypeScript enforces at compile time via the `s: string` parameter type.
// No runtime schema validation is needed (contrast with numeric types below
// which validate range constraints such as int(), positive(), between()).
// ---------------------------------------------------------------------------

export const WorldIdSchema = Schema.String.pipe(Schema.brand('WorldId'))
export type WorldId = Schema.Schema.Type<typeof WorldIdSchema>
export const WorldId = {
  make: (s: string): WorldId => Schema.decodeUnknownSync(WorldIdSchema)(s),
}

export const PlayerIdSchema = Schema.String.pipe(Schema.brand('PlayerId'))
export type PlayerId = Schema.Schema.Type<typeof PlayerIdSchema>
export const PlayerId = {
  make: (s: string): PlayerId => Schema.decodeUnknownSync(PlayerIdSchema)(s),
}

export const BlockIdSchema = Schema.String.pipe(Schema.brand('BlockId'))
export type BlockId = Schema.Schema.Type<typeof BlockIdSchema>
export const BlockId = {
  make: (s: string): BlockId => Schema.decodeUnknownSync(BlockIdSchema)(s),
}

export const PhysicsBodyIdSchema = Schema.String.pipe(Schema.brand('PhysicsBodyId'))
export type PhysicsBodyId = Schema.Schema.Type<typeof PhysicsBodyIdSchema>
export const PhysicsBodyId = {
  make: (s: string): PhysicsBodyId => Schema.decodeUnknownSync(PhysicsBodyIdSchema)(s),
}

export const ChunkIdSchema = Schema.String.pipe(Schema.brand('ChunkId'))
export type ChunkId = Schema.Schema.Type<typeof ChunkIdSchema>
export const ChunkId = {
  make: (s: string): ChunkId => Schema.decodeUnknownSync(ChunkIdSchema)(s),
}

export const RecipeIdSchema = Schema.String.pipe(Schema.brand('RecipeId'))
export type RecipeId = Schema.Schema.Type<typeof RecipeIdSchema>
export const RecipeId = {
  make: (s: string): RecipeId => Schema.decodeUnknownSync(RecipeIdSchema)(s),
}

// ---------------------------------------------------------------------------
// Numeric branded types — validated at runtime via Schema.decodeUnknownSync
// ---------------------------------------------------------------------------

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
  Schema.brand('BlockIndex')
)
export type BlockIndex = Schema.Schema.Type<typeof BlockIndexSchema>
export const BlockIndex = {
  make: (n: number): BlockIndex => Schema.decodeUnknownSync(BlockIndexSchema)(n),
}

export const PositionSchema = Schema.Struct({
  x: Schema.Number.pipe(Schema.finite()),
  y: Schema.Number.pipe(Schema.finite()),
  z: Schema.Number.pipe(Schema.finite()),
})
export type Position = Schema.Schema.Type<typeof PositionSchema>

// ---------------------------------------------------------------------------
// Domain-specific string branded types
// ---------------------------------------------------------------------------

/**
 * Composite key for chunk coordinate cache ("x,z" format).
 * Branded to prevent accidental use of arbitrary strings as cache keys.
 */
export const ChunkCacheKeySchema = Schema.String.pipe(Schema.brand('ChunkCacheKey'))
export type ChunkCacheKey = Schema.Schema.Type<typeof ChunkCacheKeySchema>
export const ChunkCacheKey = {
  make: (coord: { x: number; z: number }): ChunkCacheKey => Schema.decodeUnknownSync(ChunkCacheKeySchema)(`${coord.x},${coord.z}`),
}

/**
 * URL string for a texture asset (relative path or absolute URL).
 * Branded to prevent mixing texture URLs with arbitrary strings.
 */
export const TextureUrlSchema = Schema.String.pipe(Schema.brand('TextureUrl'))
export type TextureUrl = Schema.Schema.Type<typeof TextureUrlSchema>
export const TextureUrl = {
  make: (url: string): TextureUrl => Schema.decodeUnknownSync(TextureUrlSchema)(url),
}

/**
 * Composite key for the material cache ("material-<type>-<value>" format).
 * Branded to prevent accidental use of arbitrary strings as cache keys.
 */
export const MaterialCacheKeySchema = Schema.String.pipe(Schema.brand('MaterialCacheKey'))
export type MaterialCacheKey = Schema.Schema.Type<typeof MaterialCacheKeySchema>
export const MaterialCacheKey = {
  make: (colorOrUrl: string | number): MaterialCacheKey =>
    Schema.decodeUnknownSync(MaterialCacheKeySchema)(`material-${typeof colorOrUrl}-${colorOrUrl}`),
}

// ---------------------------------------------------------------------------
// Physics / movement numeric branded types — validated at runtime
// ---------------------------------------------------------------------------

/**
 * Velocity in meters per second. Finite, can be negative (deceleration / reverse).
 */
export const MetersPerSecSchema = Schema.Number.pipe(
  Schema.finite(),
  Schema.brand('MetersPerSec')
)
export type MetersPerSec = Schema.Schema.Type<typeof MetersPerSecSchema>
export const MetersPerSec = {
  make: (n: number): MetersPerSec => Schema.decodeUnknownSync(MetersPerSecSchema)(n),
  toNumber: (v: MetersPerSec): number => v,
}

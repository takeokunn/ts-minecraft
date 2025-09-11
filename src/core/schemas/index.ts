import * as S from "@effect/schema/Schema"
import { Brand } from 'effect'

/**
 * Centralized Schema Definitions
 * All schemas are defined here for consistency and reusability
 */

// ============================================
// Brand Types for Type Safety
// ============================================

export type EntityId = string & Brand.Brand<'EntityId'>
export const EntityId = Brand.nominal<EntityId>()
export const EntityIdSchema = S.String.pipe(S.brand('EntityId'))

export type ChunkX = number & Brand.Brand<'ChunkX'>
export const ChunkX = Brand.nominal<ChunkX>()
export const ChunkXSchema = S.Int.pipe(S.brand('ChunkX'))

export type ChunkZ = number & Brand.Brand<'ChunkZ'>
export const ChunkZ = Brand.nominal<ChunkZ>()
export const ChunkZSchema = S.Int.pipe(S.brand('ChunkZ'))

// ============================================
// Value Objects Schemas
// ============================================

export const PositionSchema = S.Struct({
  x: S.Number.pipe(S.finite()),
  y: S.Number.pipe(S.finite(), S.clamp(0, 255)),
  z: S.Number.pipe(S.finite()),
})
export type Position = S.Schema.Type<typeof PositionSchema>

export const VelocitySchema = S.Struct({
  dx: S.Number.pipe(S.finite(), S.clamp(-100, 100)),
  dy: S.Number.pipe(S.finite(), S.clamp(-100, 100)),
  dz: S.Number.pipe(S.finite(), S.clamp(-100, 100)),
})
export type Velocity = S.Schema.Type<typeof VelocitySchema>

export const ChunkCoordinatesSchema = S.Struct({
  x: ChunkXSchema,
  z: ChunkZSchema,
})
export type ChunkCoordinates = S.Schema.Type<typeof ChunkCoordinatesSchema>

// ============================================
// Component Schemas
// ============================================

// Physics Components
export const ColliderSchema = S.Struct({
  width: S.Number.pipe(S.positive(), S.finite()),
  height: S.Number.pipe(S.positive(), S.finite()),
  depth: S.Number.pipe(S.positive(), S.finite()),
  offsetX: S.optionalWith(S.Number.pipe(S.finite()), { default: () => 0 }),
  offsetY: S.optionalWith(S.Number.pipe(S.finite()), { default: () => 0 }),
  offsetZ: S.optionalWith(S.Number.pipe(S.finite()), { default: () => 0 }),
})
export type Collider = S.Schema.Type<typeof ColliderSchema>

export const GravitySchema = S.Struct({
  value: S.optionalWith(S.Number.pipe(S.finite()), { default: () => -32 }),
  multiplier: S.optionalWith(S.Number.pipe(S.positive(), S.finite()), { default: () => 1.0 }),
})
export type Gravity = S.Schema.Type<typeof GravitySchema>

// Gameplay Components
export const PlayerSchema = S.Struct({
  isGrounded: S.Boolean,
  isSprinting: S.optional(S.Boolean).pipe(S.withDefault(() => false)),
  isCrouching: S.optional(S.Boolean).pipe(S.withDefault(() => false)),
  isFlying: S.optional(S.Boolean).pipe(S.withDefault(() => false)),
  health: S.optional(S.Number.pipe(S.finite(), S.clamp(0, 20))).pipe(S.withDefault(() => 20)),
  hunger: S.optional(S.Number.pipe(S.finite(), S.clamp(0, 20))).pipe(S.withDefault(() => 20)),
  experience: S.optional(S.Number.pipe(S.int(), S.nonNegative())).pipe(S.withDefault(() => 0)),
})
export type Player = S.Schema.Type<typeof PlayerSchema>

export const InputStateSchema = S.Struct({
  forward: S.Boolean,
  backward: S.Boolean,
  left: S.Boolean,
  right: S.Boolean,
  jump: S.Boolean,
  sprint: S.Boolean,
  crouch: S.Boolean,
  place: S.Boolean,
  destroy: S.Boolean,
  interact: S.Boolean,
  inventory: S.Boolean,
  menu: S.Boolean,
  mouseDeltaX: S.optional(S.Number.pipe(S.finite())).pipe(S.withDefault(() => 0)),
  mouseDeltaY: S.optional(S.Number.pipe(S.finite())).pipe(S.withDefault(() => 0)),
  isLocked: S.Boolean,
})
export type InputState = S.Schema.Type<typeof InputStateSchema>

// Rendering Components
export const CameraSchema = S.Struct({
  pitch: S.Number.pipe(S.finite(), S.clamp(-Math.PI / 2, Math.PI / 2)),
  yaw: S.Number.pipe(S.finite()),
  fov: S.optional(S.Number.pipe(S.positive(), S.finite())).pipe(S.withDefault(() => 75)),
  near: S.optional(S.Number.pipe(S.positive(), S.finite())).pipe(S.withDefault(() => 0.1)),
  far: S.optional(S.Number.pipe(S.positive(), S.finite())).pipe(S.withDefault(() => 1000)),
  isActive: S.optional(S.Boolean).pipe(S.withDefault(() => false)),
})
export type Camera = S.Schema.Type<typeof CameraSchema>

// ============================================
// Message Schemas (for Workers)
// ============================================

export const GenerateChunkMessageSchema = S.Struct({
  type: S.Literal('generate-chunk'),
  seed: S.Number.pipe(S.int()),
  coords: ChunkCoordinatesSchema,
})
export type GenerateChunkMessage = S.Schema.Type<typeof GenerateChunkMessageSchema>

export const ChunkGenerationResultSchema = S.Struct({
  coords: ChunkCoordinatesSchema,
  blocks: S.Array(S.Number.pipe(S.int(), S.nonNegative())),
  heightMap: S.Array(S.Number.pipe(S.int(), S.nonNegative())),
})
export type ChunkGenerationResult = S.Schema.Type<typeof ChunkGenerationResultSchema>

export const GenerateMeshMessageSchema = S.Struct({
  type: S.Literal('generate-mesh'),
  chunk: S.Struct({
    x: S.Number.pipe(S.int()),
    z: S.Number.pipe(S.int()),
    blocks: S.Array(S.Number.pipe(S.int(), S.nonNegative())),
  }),
})
export type GenerateMeshMessage = S.Schema.Type<typeof GenerateMeshMessageSchema>

export const MeshGenerationResultSchema = S.Struct({
  positions: S.instanceOf(Float32Array),
  normals: S.instanceOf(Float32Array),
  uvs: S.instanceOf(Float32Array),
  indices: S.instanceOf(Uint32Array),
})
export type MeshGenerationResult = S.Schema.Type<typeof MeshGenerationResultSchema>

// ============================================
// Aggregate Schemas
// ============================================

/**
 * All schemas in one place for easy access
 */
export const Schemas = {
  // Brands
  EntityId: EntityIdSchema,
  ChunkX: ChunkXSchema,
  ChunkZ: ChunkZSchema,
  
  // Values
  Position: PositionSchema,
  Velocity: VelocitySchema,
  ChunkCoordinates: ChunkCoordinatesSchema,
  
  // Components
  Collider: ColliderSchema,
  Gravity: GravitySchema,
  Player: PlayerSchema,
  InputState: InputStateSchema,
  Camera: CameraSchema,
  
  // Messages
  GenerateChunkMessage: GenerateChunkMessageSchema,
  ChunkGenerationResult: ChunkGenerationResultSchema,
  GenerateMeshMessage: GenerateMeshMessageSchema,
  MeshGenerationResult: MeshGenerationResultSchema,
} as const

/**
 * Type helper for getting the type of a schema
 */
export type SchemaType<K extends keyof typeof Schemas> = S.Schema.Type<typeof Schemas[K]>

/**
 * Validation helpers
 */
export const decode = <K extends keyof typeof Schemas>(
  schemaKey: K,
  value: unknown
) => S.decodeUnknown(Schemas[schemaKey])(value)

export const encode = <K extends keyof typeof Schemas>(
  schemaKey: K,
  value: SchemaType<K>
) => S.encode(Schemas[schemaKey])(value as any)

export const validate = <K extends keyof typeof Schemas>(
  schemaKey: K,
  value: unknown
) => S.validateSync(Schemas[schemaKey])(value)
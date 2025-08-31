import { Schema } from "effect";
import { BlockType, BlockTypeSchema } from "./block";
import * as EntityId from "./entity";

// --- Storage Type Annotation ---
export const StorageType = {
  Float32: Schema.annotations({ storage: "Float32" }),
  Uint8: Schema.annotations({ storage: "Uint8" }),
  Uint16: Schema.annotations({ storage: "Uint16" }),
  Int8: Schema.annotations({ storage: "Int8" }),
};

// --- Component Schemas ---

export const Position = Schema.Struct({
  _tag: Schema.Literal("Position"),
  x: Schema.Number.pipe(StorageType.Float32),
  y: Schema.Number.pipe(StorageType.Float32),
  z: Schema.Number.pipe(StorageType.Float32),
}).pipe(Schema.identifier("Position"));
export type Position = Schema.Schema.Type<typeof Position>;

export const Velocity = Schema.Struct({
  _tag: Schema.Literal("Velocity"),
  dx: Schema.Number.pipe(StorageType.Float32),
  dy: Schema.Number.pipe(StorageType.Float32),
  dz: Schema.Number.pipe(StorageType.Float32),
}).pipe(Schema.identifier("Velocity"));
export type Velocity = Schema.Schema.Type<typeof Velocity>;

export const Renderable = Schema.Struct({
  _tag: Schema.Literal("Renderable"),
  geometry: Schema.Literal("box"),
  blockType: BlockTypeSchema.pipe(StorageType.Uint8),
}).pipe(Schema.identifier("Renderable"));
export type Renderable = Schema.Schema.Type<typeof Renderable>;

export const Player = Schema.Struct({
  _tag: Schema.Literal("Player"),
  isGrounded: Schema.Boolean.pipe(StorageType.Uint8),
}).pipe(Schema.identifier("Player"));
export type Player = Schema.Schema.Type<typeof Player>;

export const InputState = Schema.Struct({
  _tag: Schema.Literal("InputState"),
  forward: Schema.Boolean.pipe(StorageType.Uint8),
  backward: Schema.Boolean.pipe(StorageType.Uint8),
  left: Schema.Boolean.pipe(StorageType.Uint8),
  right: Schema.Boolean.pipe(StorageType.Uint8),
  jump: Schema.Boolean.pipe(StorageType.Uint8),
  sprint: Schema.Boolean.pipe(StorageType.Uint8),
  place: Schema.Boolean.pipe(StorageType.Uint8),
}).pipe(Schema.identifier("InputState"));
export type InputState = Schema.Schema.Type<typeof InputState>;

export const Gravity = Schema.Struct({
  _tag: Schema.Literal("Gravity"),
  value: Schema.Number.pipe(StorageType.Float32),
}).pipe(Schema.identifier("Gravity"));
export type Gravity = Schema.Schema.Type<typeof Gravity>;

export const CameraState = Schema.Struct({
  _tag: Schema.Literal("CameraState"),
  pitch: Schema.Number.pipe(StorageType.Float32),
  yaw: Schema.Number.pipe(StorageType.Float32),
}).pipe(Schema.identifier("CameraState"));
export type CameraState = Schema.Schema.Type<typeof CameraState>;

export const TerrainBlock = Schema.Struct({
  _tag: Schema.Literal("TerrainBlock"),
}).pipe(
  Schema.identifier("TerrainBlock"),
);
export type TerrainBlock = Schema.Schema.Type<typeof TerrainBlock>;

export const Chunk = Schema.Struct({
  _tag: Schema.Literal("Chunk"),
  x: Schema.Number.pipe(StorageType.Int8),
  z: Schema.Number.pipe(StorageType.Int8),
}).pipe(Schema.identifier("Chunk"));
export type Chunk = Schema.Schema.Type<typeof Chunk>;

export const Collider = Schema.Struct({
  _tag: Schema.Literal("Collider"),
  width: Schema.Number.pipe(StorageType.Float32),
  height: Schema.Number.pipe(StorageType.Float32),
  depth: Schema.Number.pipe(StorageType.Float32),
}).pipe(Schema.identifier("Collider"));
export type Collider = Schema.Schema.Type<typeof Collider>;

export const Hotbar = Schema.Struct({
  _tag: Schema.Literal("Hotbar"),
  slot0: BlockTypeSchema.pipe(StorageType.Uint8),
  slot1: BlockTypeSchema.pipe(StorageType.Uint8),
  slot2: BlockTypeSchema.pipe(StorageType.Uint8),
  slot3: BlockTypeSchema.pipe(StorageType.Uint8),
  slot4: BlockTypeSchema.pipe(StorageType.Uint8),
  slot5: BlockTypeSchema.pipe(StorageType.Uint8),
  slot6: BlockTypeSchema.pipe(StorageType.Uint8),
  slot7: BlockTypeSchema.pipe(StorageType.Uint8),
  slot8: BlockTypeSchema.pipe(StorageType.Uint8),
  selectedSlot: Schema.Number.pipe(StorageType.Uint8),
}).pipe(Schema.identifier("Hotbar"));
export type Hotbar = Schema.Schema.Type<typeof Hotbar>;

export const Target = Schema.Struct({
  _tag: Schema.Literal("Target"),
  entityId: Schema.Number.pipe(StorageType.Int8), // Using Int8 to allow for -1 as a sentinel
  faceX: Schema.Number.pipe(StorageType.Float32),
  faceY: Schema.Number.pipe(StorageType.Float32),
  faceZ: Schema.Number.pipe(StorageType.Float32),
}).pipe(Schema.identifier("Target"));
export type Target = Schema.Schema.Type<typeof Target>;

export const InstancedMeshRenderable = Schema.Struct({
  _tag: Schema.Literal("InstancedMeshRenderable"),
  meshType: Schema.String,
}).pipe(Schema.identifier("InstancedMeshRenderable"));
export type InstancedMeshRenderable = Schema.Schema.Type<
  typeof InstancedMeshRenderable
>;

export const componentSchemas = {
  Position,
  Velocity,
  Renderable,
  Player,
  InputState,
  Gravity,
  CameraState,
  TerrainBlock,
  Chunk,
  Collider,
  Hotbar,
  Target,
  InstancedMeshRenderable,
};

export const ComponentUnion = Schema.Union(
  ...Object.values(componentSchemas),
);
export type ComponentAny = Schema.Schema.Type<typeof ComponentUnion>;

// --- Save State Schemas ---
export const PlacedBlock = Schema.Struct({
  _tag: Schema.Literal("PlacedBlock"),
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number,
  blockType: Schema.String.pipe(Schema.compose(BlockTypeSchema)),
}).pipe(Schema.identifier("PlacedBlock"));
export type PlacedBlock = Schema.Schema.Type<typeof PlacedBlock>;

export const DestroyedBlock = Schema.Struct({
  _tag: Schema.Literal("DestroyedBlock"),
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number,
}).pipe(Schema.identifier("DestroyedBlock"));
export type DestroyedBlock = Schema.Schema.Type<typeof DestroyedBlock>;

export const SaveState = Schema.Struct({
  _tag: Schema.Literal("SaveState"),
  seeds: Schema.Struct({
    world: Schema.Number,
    biome: Schema.Number,
    trees: Schema.Number,
  }),
  amplitude: Schema.Number,
  cameraPosition: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number,
  }),
  playerRotation: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number,
  }),
  editedBlocks: Schema.Struct({
    placed: Schema.Array(PlacedBlock),
    destroyed: Schema.Array(DestroyedBlock),
  }),
}).pipe(Schema.identifier("SaveState"));
export type SaveState = Schema.Schema.Type<typeof SaveState>;

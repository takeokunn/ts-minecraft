import { Schema } from 'effect';
import { blockTypes } from '../runtime/game-state';

const BlockTypeSchema = Schema.Union(
  ...Object.keys(blockTypes).map(Schema.Literal),
);
export type BlockType = Schema.Schema.Type<typeof BlockTypeSchema>;

export const PositionSchema = Schema.Struct({
  _tag: Schema.Literal('Position'),
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number,
});
export type Position = Schema.Schema.Type<typeof PositionSchema>;

export const VelocitySchema = Schema.Struct({
  _tag: Schema.Literal('Velocity'),
  dx: Schema.Number,
  dy: Schema.Number,
  dz: Schema.Number,
});
export type Velocity = Schema.Schema.Type<typeof VelocitySchema>;

export const RenderableSchema = Schema.Struct({
  _tag: Schema.Literal('Renderable'),
  geometry: Schema.Literal('box'),
  blockType: BlockTypeSchema,
});
export type Renderable = Schema.Schema.Type<typeof RenderableSchema>;

export const PlayerSchema = Schema.Struct({
  _tag: Schema.Literal('Player'),
  isGrounded: Schema.Boolean,
});
export type Player = Schema.Schema.Type<typeof PlayerSchema>;

export const InputStateSchema = Schema.Struct({
  _tag: Schema.Literal('InputState'),
  forward: Schema.Boolean,
  backward: Schema.Boolean,
  left: Schema.Boolean,
  right: Schema.Boolean,
  jump: Schema.Boolean,
  sprint: Schema.Boolean,
  place: Schema.Boolean,
});
export type InputState = Schema.Schema.Type<typeof InputStateSchema>;

export const GravitySchema = Schema.Struct({
  _tag: Schema.Literal('Gravity'),
  value: Schema.Number,
});
export type Gravity = Schema.Schema.Type<typeof GravitySchema>;

export const CameraStateSchema = Schema.Struct({
  _tag: Schema.Literal('CameraState'),
  pitch: Schema.Number,
  yaw: Schema.Number,
});
export type CameraState = Schema.Schema.Type<typeof CameraStateSchema>;

export const TerrainBlockSchema = Schema.Struct({
  _tag: Schema.Literal('TerrainBlock'),
});
export type TerrainBlock = Schema.Schema.Type<typeof TerrainBlockSchema>;

export const ChunkSchema = Schema.Struct({
  _tag: Schema.Literal('Chunk'),
  x: Schema.Number,
  z: Schema.Number,
});
export type Chunk = Schema.Schema.Type<typeof ChunkSchema>;

export const ColliderSchema = Schema.Struct({
  _tag: Schema.Literal('Collider'),
  width: Schema.Number,
  height: Schema.Number,
  depth: Schema.Number,
});
export type Collider = Schema.Schema.Type<typeof ColliderSchema>;

export const HotbarSchema = Schema.Struct({
  _tag: Schema.Literal('Hotbar'),
  slots: Schema.Array(BlockTypeSchema),
  selectedSlot: Schema.Number,
});
export type Hotbar = Schema.Schema.Type<typeof HotbarSchema>;

export const TargetSchema = Schema.Struct({
  _tag: Schema.Literal('Target'),
  id: Schema.String, // EntityId of the targeted block
  position: PositionSchema,
  face: Schema.Tuple(Schema.Number, Schema.Number, Schema.Number),
});
export type Target = Schema.Schema.Type<typeof TargetSchema>;

export const ComponentSchema = Schema.Union(
  PositionSchema,
  VelocitySchema,
  RenderableSchema,
  PlayerSchema,
  InputStateSchema,
  GravitySchema,
  CameraStateSchema,
  TerrainBlockSchema,
  ChunkSchema,
  ColliderSchema,
  HotbarSchema,
  TargetSchema,
);
export type Component = Schema.Schema.Type<typeof ComponentSchema>;

// --- Save State Schemas ---

export const PlacedBlockSchema = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number,
  blockType: Schema.String,
});
export type PlacedBlock = Schema.Schema.Type<typeof PlacedBlockSchema>;

export const DestroyedBlockSchema = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number,
});
export type DestroyedBlock = Schema.Schema.Type<typeof DestroyedBlockSchema>;

export const SaveStateSchema = Schema.Struct({
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
    placed: Schema.Array(PlacedBlockSchema),
    destroyed: Schema.Array(DestroyedBlockSchema),
  }),
});
export type SaveState = Schema.Schema.Type<typeof SaveStateSchema>;

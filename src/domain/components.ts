import * as S from '@effect/schema/Schema';
import { match } from 'ts-pattern';
import { BlockType, blockTypeNames } from './block';
import { EntityId } from './entity';

// --- Primitive Schemas ---
const Float = S.Number;
const Int = S.Number.pipe(S.int());

// --- Vector Schemas ---
const Vector3FloatSchema = S.Struct({
  x: Float,
  y: Float,
  z: Float,
});
const Vector3IntSchema = S.Struct({
  x: Int,
  y: Int,
  z: Int,
});

// --- Component Schemas ---
import * as S from '@effect/schema/Schema';
import { match } from 'ts-pattern';
import { BlockType, blockTypeNames } from './block';
import {
  Float,
  Int,
  Vector3FloatSchema,
  Vector3IntSchema,
} from './common';
import { EntityId } from './entity';

// --- Component Schemas ---
export const ComponentSchemas = {
  position: Vector3FloatSchema,
  velocity: S.Struct({
    dx: Float,
    dy: Float,
    dz: Float,
  }),
  player: S.Struct({ isGrounded: S.Boolean }),
  inputState: S.Struct({
    forward: S.Boolean,
    backward: S.Boolean,
    left: S.Boolean,
    right: S.Boolean,
    jump: S.Boolean,
    sprint: S.Boolean,
    place: S.Boolean,
    destroy: S.Boolean,
    isLocked: S.Boolean,
  }),
  cameraState: S.Struct({ pitch: Float, yaw: Float }),
  hotbar: S.Struct({
    slots: S.Array(S.Literal(...blockTypeNames)),
    selectedIndex: Int,
  }),
  target: S.Union(
    S.Struct({ type: S.Literal('none') }),
    S.Struct({
      type: S.Literal('block'),
      entityId: EntityId,
      face: Vector3IntSchema,
    }),
  ),
  gravity: S.Struct({ value: Float }),
  collider: S.Struct({
    width: Float,
    height: Float,
    depth: Float,
  }),
  renderable: S.Struct({
    geometry: S.String,
    blockType: BlockType,
  }),
  instancedMeshRenderable: S.Struct({ meshType: S.String }),
  terrainBlock: S.Struct({}),
  chunk: S.Struct({ chunkX: Int, chunkZ: Int }),
  camera: S.Struct({}),
  targetBlock: S.Struct({}),
  chunkLoaderState: S.Struct({
    loadedChunks: S.ReadonlySet(S.String),
  }),
};

// --- Component Types ---
export type Position = S.Schema.Type<typeof ComponentSchemas.position>;
export type Velocity = S.Schema.Type<typeof ComponentSchemas.velocity>;
export type Player = S.Schema.Type<typeof ComponentSchemas.player>;
export type InputState = S.Schema.Type<typeof ComponentSchemas.inputState>;
export type CameraState = S.Schema.Type<typeof ComponentSchemas.cameraState>;
export type Hotbar = S.Schema.Type<typeof ComponentSchemas.hotbar>;
export type Target = S.Schema.Type<typeof ComponentSchemas.target>;
export type Gravity = S.Schema.Type<typeof ComponentSchemas.gravity>;
export type Collider = S.Schema.Type<typeof ComponentSchemas.collider>;
export type Renderable = S.Schema.Type<typeof ComponentSchemas.renderable>;
export type InstancedMeshRenderable = S.Schema.Type<
  typeof ComponentSchemas.instancedMeshRenderable
>;
export type TerrainBlock = S.Schema.Type<typeof ComponentSchemas.terrainBlock>;
export type Chunk = S.Schema.Type<typeof ComponentSchemas.chunk>;
export type Camera = S.Schema.Type<typeof ComponentSchemas.camera>;
export type TargetBlock = S.Schema.Type<typeof ComponentSchemas.targetBlock>;
export type ChunkLoaderState = S.Schema.Type<
  typeof ComponentSchemas.chunkLoaderState
>;

export type Components = {
  readonly [K in keyof typeof ComponentSchemas]: S.Schema.Type<
    (typeof ComponentSchemas)[K]
  >;
};

export type ComponentName = keyof Components;
export const componentNames = Object.keys(
  ComponentSchemas,
) as unknown as ReadonlyArray<ComponentName>;

// --- Factory Functions ---

export const createPlayer = (isGrounded: boolean): Player => ({ isGrounded });
export const createCameraState = (pitch: number, yaw: number): CameraState => ({
  pitch,
  yaw,
});
export const createHotbar = (
  slots: ReadonlyArray<BlockType>,
  selectedIndex: number,
): Hotbar => ({ slots, selectedIndex });
export const createTargetNone = (): Target => ({ type: 'none' });
export const createTargetBlock = (
  entityId: EntityId,
  face: { readonly x: number; readonly y: number; readonly z: number },
): Target => ({ type: 'block', entityId, face });
export const createPosition = (x: number, y: number, z: number): Position => ({
  x,
  y,
  z,
});
export const createVelocity = (dx: number, dy: number, dz: number): Velocity => ({
  dx,
  dy,
  dz,
});
export const createInputState = (): InputState => ({
  forward: false,
  backward: false,
  left: false,
  right: false,
  jump: false,
  sprint: false,
  place: false,
  destroy: false,
  isLocked: false,
});
export const createGravity = (value: number): Gravity => ({ value });
export const createCollider = (
  width: number,
  height: number,
  depth: number,
): Collider => ({
  width,
  height,
  depth,
});
export const createChunk = (chunkX: number, chunkZ: number): Chunk => ({
  chunkX,
  chunkZ,
});
export const createChunkLoaderState = (
  loadedChunks: ReadonlySet<string>,
): ChunkLoaderState => ({
  loadedChunks,
});
export const createCamera = (): Camera => ({});
export const createTargetBlockComponent = (): TargetBlock => ({});
export const createTerrainBlock = (): TerrainBlock => ({});
export const createInstancedMeshRenderable = (
  meshType: string,
): InstancedMeshRenderable => ({ meshType });
export const createRenderable = (
  geometry: string,
  blockType: BlockType,
): Renderable => ({
  geometry,
  blockType,
});

// --- Immutable Update Functions ---

export const setPlayerGrounded = (player: Player, isGrounded: boolean): Player => ({
  ...player,
  isGrounded,
});
export const setInputState = (
  state: InputState,
  changes: Partial<InputState>,
): InputState => ({ ...state, ...changes });
export const setCameraState = (
  state: CameraState,
  changes: Partial<CameraState>,
): CameraState => ({ ...state, ...changes });
export const setHotbarSelectedIndex = (
  hotbar: Hotbar,
  selectedIndex: number,
): Hotbar => ({ ...hotbar, selectedIndex });

export const setPosition = (
  position: Position,
  changes: Partial<Position>,
): Position => ({ ...position, ...changes });
export const setVelocity = (
  velocity: Velocity,
  changes: Partial<Velocity>,
): Velocity => ({ ...velocity, ...changes });
export const setChunkLoaderState = (
  state: ChunkLoaderState,
  loadedChunks: ReadonlySet<string>,
): ChunkLoaderState => ({ ...state, loadedChunks });

// --- Pattern Matching ---

export const matchTarget = <T>(
  target: Target,
  handlers: {
    onNone: () => T;
    onBlock: (
      entityId: EntityId,
      face: { readonly x: number; readonly y: number; readonly z: number },
    ) => T;
  },
): T =>
  match(target)
    .with({ type: 'none' }, handlers.onNone)
    .with({ type: 'block' }, ({ entityId, face }) =>
      handlers.onBlock(entityId, face),
    )
    .exhaustive();


// --- Component Types ---
export type Position = S.Schema.Type<typeof ComponentSchemas.position>;
export type Velocity = S.Schema.Type<typeof ComponentSchemas.velocity>;
export type Player = S.Schema.Type<typeof ComponentSchemas.player>;
export type InputState = S.Schema.Type<typeof ComponentSchemas.inputState>;
export type CameraState = S.Schema.Type<typeof ComponentSchemas.cameraState>;
export type Hotbar = S.Schema.Type<typeof ComponentSchemas.hotbar>;
export type Target = S.Schema.Type<typeof ComponentSchemas.target>;
export type Gravity = S.Schema.Type<typeof ComponentSchemas.gravity>;
export type Collider = S.Schema.Type<typeof ComponentSchemas.collider>;
export type Renderable = S.Schema.Type<typeof ComponentSchemas.renderable>;
export type InstancedMeshRenderable = S.Schema.Type<
  typeof ComponentSchemas.instancedMeshRenderable
>;
export type TerrainBlock = S.Schema.Type<typeof ComponentSchemas.terrainBlock>;
export type Chunk = S.Schema.Type<typeof ComponentSchemas.chunk>;
export type Camera = S.Schema.Type<typeof ComponentSchemas.camera>;
export type TargetBlock = S.Schema.Type<typeof ComponentSchemas.targetBlock>;
export type ChunkLoaderState = S.Schema.Type<
  typeof ComponentSchemas.chunkLoaderState
>;

export type Components = {
  readonly [K in keyof typeof ComponentSchemas]: S.Schema.Type<
    (typeof ComponentSchemas)[K]
  >;
};

export type ComponentName = keyof Components;
export const componentNames = Object.keys(
  ComponentSchemas,
) as unknown as ReadonlyArray<ComponentName>;

// --- Factory Functions ---

export const createPlayer = (isGrounded: boolean): Player => ({ isGrounded });
export const createCameraState = (pitch: number, yaw: number): CameraState => ({
  pitch,
  yaw,
});
export const createHotbar = (
  slots: ReadonlyArray<BlockType>,
  selectedIndex: number,
): Hotbar => ({ slots, selectedIndex });
export const createTargetNone = (): Target => ({ type: 'none' });
export const createTargetBlock = (
  entityId: EntityId,
  face: { readonly x: number; readonly y: number; readonly z: number },
): Target => ({ type: 'block', entityId, face });
export const createPosition = (x: number, y: number, z: number): Position => ({
  x,
  y,
  z,
});
export const createVelocity = (dx: number, dy: number, dz: number): Velocity => ({
  dx,
  dy,
  dz,
});
export const createInputState = (): InputState => ({
  forward: false,
  backward: false,
  left: false,
  right: false,
  jump: false,
  sprint: false,
  place: false,
  destroy: false,
  isLocked: false,
});
export const createGravity = (value: number): Gravity => ({ value });
export const createCollider = (
  width: number,
  height: number,
  depth: number,
): Collider => ({
  width,
  height,
  depth,
});
export const createChunk = (chunkX: number, chunkZ: number): Chunk => ({
  chunkX,
  chunkZ,
});
export const createChunkLoaderState = (
  loadedChunks: ReadonlySet<string>,
): ChunkLoaderState => ({
  loadedChunks,
});
export const createCamera = (): Camera => ({});
export const createTargetBlockComponent = (): TargetBlock => ({});
export const createTerrainBlock = (): TerrainBlock => ({});
export const createInstancedMeshRenderable = (
  meshType: string,
): InstancedMeshRenderable => ({ meshType });
export const createRenderable = (
  geometry: string,
  blockType: BlockType,
): Renderable => ({
  geometry,
  blockType,
});

// --- Immutable Update Functions ---

export const setPlayerGrounded = (player: Player, isGrounded: boolean): Player => ({
  ...player,
  isGrounded,
});
export const setInputState = (
  state: InputState,
  changes: Partial<InputState>,
): InputState => ({ ...state, ...changes });
export const setCameraState = (
  state: CameraState,
  changes: Partial<CameraState>,
): CameraState => ({ ...state, ...changes });
export const setHotbarSelectedIndex = (
  hotbar: Hotbar,
  selectedIndex: number,
): Hotbar => ({ ...hotbar, selectedIndex });

export const setPosition = (
  position: Position,
  changes: Partial<Position>,
): Position => ({ ...position, ...changes });
export const setVelocity = (
  velocity: Velocity,
  changes: Partial<Velocity>,
): Velocity => ({ ...velocity, ...changes });
export const setChunkLoaderState = (
  state: ChunkLoaderState,
  loadedChunks: ReadonlySet<string>,
): ChunkLoaderState => ({ ...state, loadedChunks });

// --- Pattern Matching ---

export const matchTarget = <T>(
  target: Target,
  handlers: {
    onNone: () => T;
    onBlock: (
      entityId: EntityId,
      face: { readonly x: number; readonly y: number; readonly z: number },
    ) => T;
  },
): T =>
  match(target)
    .with({ type: 'none' }, handlers.onNone)
    .with({ type: 'block' }, ({ entityId, face }) =>
      handlers.onBlock(entityId, face),
    )
    .exhaustive();
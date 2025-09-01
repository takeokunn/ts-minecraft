import { BlockType } from './block';
import { EntityId } from './entity';

export const componentNames = [
  'position',
  'velocity',
  'renderable',
  'player',
  'inputState',
  'gravity',
  'cameraState',
  'terrainBlock',
  'chunk',
  'collider',
  'hotbar',
  'target',
  'instancedMeshRenderable',
  'chunkLoaderState',
] as const;
export type ComponentName = (typeof componentNames)[number];

export type Position = {
  x: number;
  y: number;
  z: number;
};

export type Velocity = {
  dx: number;
  dy: number;
  dz: number;
};

export type Renderable = {
  geometry: 'box';
  blockType: BlockType;
};

export type Player = {
  isGrounded: boolean;
};

export type InputState = {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
  sprint: boolean;
  place: boolean;
  destroy: boolean;
};

export type Gravity = {
  value: number;
};

export type CameraState = {
  pitch: number;
  yaw: number;
};

export type TerrainBlock = Record<string, never>;

export type Chunk = {
  x: number;
  z: number;
};

export type Collider = {
  width: number;
  height: number;
  depth: number;
};

export type Hotbar = {
  slot0: BlockType;
  slot1: BlockType;
  slot2: BlockType;
  slot3: BlockType;
  slot4: BlockType;
  slot5: BlockType;
  slot6: BlockType;
  slot7: BlockType;
  slot8: BlockType;
  selectedSlot: number;
};

export type Target = {
  entityId: EntityId | -1;
  faceX: number;
  faceY: number;
  faceZ: number;
};

export type InstancedMeshRenderable = {
  meshType: string;
};

export type ChunkLoaderState = {
  currentPlayerChunkX: number;
  currentPlayerChunkZ: number;
};

export type Components = {
  position: Position;
  velocity: Velocity;
  renderable: Renderable;
  player: Player;
  inputState: InputState;
  gravity: Gravity;
  cameraState: CameraState;
  terrainBlock: TerrainBlock;
  chunk: Chunk;
  collider: Collider;
  hotbar: Hotbar;
  target: Target;
  instancedMeshRenderable: InstancedMeshRenderable;
  chunkLoaderState: ChunkLoaderState;
};
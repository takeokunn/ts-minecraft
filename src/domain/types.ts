import type {
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
  Mesh,
  InstancedMesh,
} from 'three';
import type { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import type Stats from 'three/examples/jsm/libs/stats.module.js';

import { BlockType } from './block';
import { EntityId } from './entity';
import type { Components } from './components';

export type ComponentStore<T> = Map<EntityId, T>;

export interface World {
  nextEntityId: EntityId;
  entities: Set<EntityId>;
  components: {
    [K in keyof Components]: ComponentStore<Components[K]>;
  };
  tags: {
    terrainBlock: Set<EntityId>;
  };
  globalState: {
    scene: 'Title' | 'InGame' | 'Paused';
    seeds: {
      world: number;
      biome: number;
      trees: number;
    };
    amplitude: number;
    editedBlocks: {
      placed: Map<string, PlacedBlock>;
      destroyed: Set<string>;
    };
  };
}

export type System = (world: World) => void;

export type AABB = {
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
};
export type SpatialGrid = Map<string, Set<EntityId>>;
export interface BrowserInputState {
  keyboard: Set<string>;
  mouse: { dx: number; dy: number };
}
export interface ThreeCamera {
  camera: PerspectiveCamera;
  controls: PointerLockControls;
}

export interface ThreeContext {
  scene: Scene;
  camera: ThreeCamera;
  renderer: WebGLRenderer;
  highlightMesh: Mesh;
  stats: Stats;
  chunkMeshes: Map<string, Mesh>;
  instancedMeshes: Map<string, InstancedMesh>;
}

export interface PlacedBlock {
  x: number;
  y: number;
  z: number;
  blockType: BlockType;
}
export interface BlockData {
  x: number;
  y: number;
  z: number;
  blockType: BlockType;
}
export interface ChunkMeshData {
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  indices: Uint32Array;
}
export interface ChunkGenerationResult {
  blocks: BlockData[];
  mesh: ChunkMeshData;
  chunkX: number;
  chunkZ: number;
}
export type ChunkDataQueue = ChunkGenerationResult[];

export interface GenerationParams {
  chunkX: number;
  chunkZ: number;
  seeds: {
    world: number;
    biome: number;
    trees: number;
  };
  amplitude: number;
  editedBlocks: {
    destroyed: { x: number; y: number; z: number }[];
    placed: PlacedBlock[];
  };
}

export type GenerateChunkCommand = {
  _tag: 'GenerateChunk';
  chunkX: number;
  chunkZ: number;
};
export type SystemCommand = GenerateChunkCommand;

export type UpsertChunkRenderCommand = {
  _tag: 'UpsertChunk';
  chunkX: number;
  chunkZ: number;
  mesh: ChunkMeshData;
};
export type RemoveChunkRenderCommand = {
  _tag: 'RemoveChunk';
  chunkX: number;
  chunkZ: number;
};
export type RenderCommand = UpsertChunkRenderCommand | RemoveChunkRenderCommand;
export type RenderQueue = RenderCommand[];

export type ComputationPool = Worker[];

export type ComputationResult<T> = {
  result: T;
  workerId: number;
};
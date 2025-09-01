import * as S from '@effect/schema/Schema';
import type {
  InstancedMesh,
  Mesh,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three';
import type { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import type Stats from 'three/examples/jsm/libs/stats.module.js';

import { BlockType, PlacedBlockSchema } from './block';
import { ComponentSchemas } from './components';

// --- Three.js Related Types (Not using Schema) ---
export type ThreeCamera = {
  camera: PerspectiveCamera;
  controls: PointerLockControls;
};
export type ThreeContext = {
  scene: Scene;
  camera: ThreeCamera;
  renderer: WebGLRenderer;
  highlightMesh: Mesh;
  stats: Stats;
  chunkMeshes: Map<string, Mesh>;
  instancedMeshes: Map<string, InstancedMesh>;
};

// --- Schemas for Core Data Structures ---

export const ChunkGenerationResultSchema = S.Struct({
  blocks: S.Array(PlacedBlockSchema),
  mesh: S.Struct({
    positions: S.instanceOf(Float32Array),
    normals: S.instanceOf(Float32Array),
    uvs: S.instanceOf(Float32Array),
    indices: S.instanceOf(Uint32Array),
  }),
  chunkX: S.Number,
  chunkZ: S.Number,
});
export type ChunkGenerationResult = S.Schema.Type<
  typeof ChunkGenerationResultSchema
>;

export const UpsertChunkRenderCommandSchema = S.Struct({
  _tag: S.Literal('UpsertChunk'),
  chunkX: S.Number,
  chunkZ: S.Number,
  mesh: ChunkGenerationResultSchema.pipe(S.pick('mesh')),
});
export type UpsertChunkRenderCommand = S.Schema.Type<
  typeof UpsertChunkRenderCommandSchema
>;

export const RemoveChunkRenderCommandSchema = S.Struct({
  _tag: S.Literal('RemoveChunk'),
  chunkX: S.Number,
  chunkZ: S.Number,
});

export const RenderCommandSchema = S.Union(
  UpsertChunkRenderCommandSchema,
  RemoveChunkRenderCommandSchema,
);
export type RenderCommand = S.Schema.Type<typeof RenderCommandSchema>;

export const SystemCommandSchema = S.Struct({
  _tag: S.Literal('GenerateChunk'),
  chunkX: S.Number,
  chunkZ: S.Number,
});
export type SystemCommand = S.Schema.Type<typeof SystemCommandSchema>;

// --- Mutable Queues (using plain arrays) ---
export type ChunkDataQueue = ChunkGenerationResult[];
export type RenderQueue = RenderCommand[];

export const BrowserInputStateSchema = S.Struct({
  keyboard: S.Set(S.String),
  mouse: S.Struct({ dx: S.Number, dy: S.Number }),
  isLocked: S.Boolean,
});
export type BrowserInputState = S.Schema.Type<typeof BrowserInputStateSchema>;

const EditedBlockValueSchema = S.Struct({
  position: ComponentSchemas.position,
  blockType: BlockType,
});

import * as S from '@effect/schema/Schema';
import type {
  InstancedMesh,
  Mesh,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three';
import type { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import type Stats from 'three/examples/jsm/libs/stats.module.js';

import { BlockType, PlacedBlockSchema } from './block';
import { ComponentSchemas } from './components';

// --- Three.js Related Types (Not using Schema) ---
export type ThreeCamera = {
  readonly camera: PerspectiveCamera;
  readonly controls: PointerLockControls;
};
export type ThreeContext = {
  readonly scene: Scene;
  readonly camera: ThreeCamera;
  readonly renderer: WebGLRenderer;
  readonly highlightMesh: Mesh;
  readonly stats: Stats;
  readonly chunkMeshes: Map<string, Mesh>;
  readonly instancedMeshes: Map<string, InstancedMesh>;
};

// --- Schemas for Core Data Structures ---

export const ChunkGenerationResultSchema = S.Struct({
  blocks: S.Array(PlacedBlockSchema),
  mesh: S.Struct({
    positions: S.instanceOf(Float32Array),
    normals: S.instanceOf(Float32Array),
    uvs: S.instanceOf(Float32Array),
    indices: S.instanceOf(Uint32Array),
  }),
  chunkX: S.Number,
  chunkZ: S.Number,
});
export type ChunkGenerationResult = S.Schema.Type<
  typeof ChunkGenerationResultSchema
>;

export const UpsertChunkRenderCommandSchema = S.Struct({
  _tag: S.Literal('UpsertChunk'),
  chunkX: S.Number,
  chunkZ: S.Number,
  mesh: ChunkGenerationResultSchema.pipe(S.pick('mesh')),
});
export type UpsertChunkRenderCommand = S.Schema.Type<
  typeof UpsertChunkRenderCommandSchema
>;

export const RemoveChunkRenderCommandSchema = S.Struct({
  _tag: S.Literal('RemoveChunk'),
  chunkX: S.Number,
  chunkZ: S.Number,
});

export const RenderCommandSchema = S.Union(
  UpsertChunkRenderCommandSchema,
  RemoveChunkRenderCommandSchema,
);
export type RenderCommand = S.Schema.Type<typeof RenderCommandSchema>;

export const SystemCommandSchema = S.Struct({
  _tag: S.Literal('GenerateChunk'),
  chunkX: S.Number,
  chunkZ: S.Number,
});
export type SystemCommand = S.Schema.Type<typeof SystemCommandSchema>;

// --- Mutable Queues (using plain arrays) ---
export type ChunkDataQueue = ChunkGenerationResult[];
export type RenderQueue = RenderCommand[];

export const BrowserInputStateSchema = S.Struct({
  keyboard: S.Set(S.String),
  mouse: S.Struct({ dx: S.Number, dy: S.Number }),
  isLocked: S.Boolean,
});
export type BrowserInputState = S.Schema.Type<typeof BrowserInputStateSchema>;

const EditedBlockValueSchema = S.Struct({
  position: ComponentSchemas.position,
  blockType: BlockType,
});

export const GenerationParamsSchema = S.Struct({
  chunkX: S.Number,
  chunkZ: S.Number,
  seeds: S.Struct({
    world: S.Number,
    biome: S.Number,
    trees: S.Number,
  }),
  amplitude: S.Number,
  editedBlocks: S.Struct({
    placed: S.Record({ key: S.String, value: EditedBlockValueSchema }),
    destroyed: S.Set(S.String),
  }),
});
export type GenerationParams = S.Schema.Type<typeof GenerationParamsSchema>;

// --- Re-exports ---
export * from './block';
export * from './geometry';
export * from './entity';
export * from './components';

export type GenerationParams = S.Schema.Type<typeof GenerationParamsSchema>;

// --- Re-exports ---
export * from './block';
export * from './geometry';
export * from './entity';
export * from './components';
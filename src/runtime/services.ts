import type { World } from './world';
import type {
  BlockData,
  ChunkGenerationResult,
  GenerationParams,
} from '../workers/generation.worker';

// --- Render Queue Service ---

export type UpsertChunkRenderCommand = {
  readonly _tag: 'UpsertChunk';
  readonly chunkX: number;
  readonly chunkZ: number;
  readonly mesh: {
    readonly positions: Float32Array;
    readonly normals: Float32Array;
    readonly uvs: Float32Array;
    readonly indices: Uint32Array;
  };
};

export type RemoveChunkRenderCommand = {
  readonly _tag: 'RemoveChunk';
  readonly chunkX: number;
  readonly chunkZ: number;
};

export type UpsertEntityRenderCommand = {
  readonly _tag: 'UpsertEntity';
  readonly entityId: EntityId;
  readonly position: { x: number; y: number; z: number };
  // rotation, scaleなども将来的に必要
  readonly meshType: 'player' | 'item'; // boxはチャンクメッシュに統合
};

export type RemoveEntityRenderCommand = {
  readonly _tag: 'RemoveEntity';
  readonly entityId: EntityId;
};

export type RenderCommand =
  | UpsertChunkRenderCommand
  | RemoveChunkRenderCommand
  | UpsertEntityRenderCommand
  | RemoveEntityRenderCommand;

/**
 * A queue for sending render commands from the game logic to the renderer.
 */
export interface RenderQueue {
  readonly offer: (command: RenderCommand) => Effect.Effect<void>;
  readonly takeAll: () => Effect.Effect<Chunk.Chunk<RenderCommand>>;
}
export const RenderQueue = Context.GenericTag<RenderQueue>('RenderQueue');

/**
 * Service for rendering the game world.
 * It consumes commands from the RenderQueue.
 */
export interface Renderer {
  readonly render: () => Effect.Effect<void>;
  readonly updateHighlight: (
    target: THREE.Intersection | null,
  ) => Effect.Effect<void>;
  readonly getRaycastables: () => Effect.Effect<{
    readonly scene: THREE.Scene;
    readonly instanceIdToEntityId: ReadonlyMap<
      BlockType,
      ReadonlyMap<number, EntityId>
    >;
  }>;
}
export const Renderer: Context.Tag<Renderer, Renderer> =
  Context.GenericTag<Renderer>('@services/Renderer');

type MouseState = {
  dx: number;
  dy: number;
  leftClick: boolean;
  rightClick: boolean;
};

/**
 * Service for handling user input.
 */
export interface Input {
  readonly poll: () => Effect.Effect<void, never, World>;
  readonly getMouseState: () => Effect.Effect<MouseState>;
  readonly getKeyboardState: () => Effect.Effect<Set<string>>;
}
export const Input: Context.Tag<Input, Input> =
  Context.GenericTag<Input>('@services/Input');

/**
 * Service for managing Three.js materials.
 */
export interface MaterialManager {
  readonly get: (
    blockType: BlockType,
  ) => Effect.Effect<THREE.Material | THREE.Material[]>;
}
export const MaterialManager: Context.Tag<MaterialManager, MaterialManager> =
  Context.GenericTag<MaterialManager>('@services/MaterialManager');

/**
 * Service for interacting with the UI (DOM).
 */
export interface UI {
  readonly setScene: (scene: Scene) => Effect.Effect<void>;
  readonly updateHotbar: (hotbar: Hotbar) => Effect.Effect<void>;
  readonly events: {
    readonly newGame: Stream.Stream<never, never, void>;
    readonly loadGame: Stream.Stream<never, never, File>;
    readonly saveGame: Stream.Stream<never, never, void>;
    readonly backToGame: Stream.Stream<never, never, void>;
  };
}
export const UI: Context.Tag<UI, UI> = Context.GenericTag<UI>('@services/UI');

/**
 * Service for controlling the camera.
 */
export interface Camera {
  readonly moveRight: (delta: number) => Effect.Effect<void>;
  readonly rotatePitch: (delta: number) => Effect.Effect<void>;
  readonly getYaw: () => Effect.Effect<number>;
  readonly getPitch: () => Effect.Effect<number>;
}
export const Camera = Context.GenericTag<Camera>('Camera');

export type RaycastResult = {
  readonly entityId: EntityId;
  readonly position: Position;
  readonly face: { x: number; y: number; z: number };
  readonly intersection: unknown; // Opaque type for the renderer
};

/**
 * Service for performing raycasts into the scene.
 */
export interface RaycastService {
  readonly cast: () => Effect.Effect<Option.Option<RaycastResult>>;
}
export const RaycastService =
  Context.GenericTag<RaycastService>('RaycastService');

// --- SpatialGrid Service ---

export type AABB = {
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
};

/**
 * A service that provides a spatial grid for efficient querying of entities within a given area.
 * This is used for broad-phase collision detection, AI target acquisition, etc.
 */
export interface SpatialGrid {
  readonly register: (entityId: EntityId, aabb: AABB) => Effect.Effect<void>;
  readonly query: (aabb: AABB) => Effect.Effect<readonly EntityId[]>;
  readonly clear: () => Effect.Effect<void>;
}
export const SpatialGrid = Context.GenericTag<SpatialGrid>('SpatialGrid');

/**
 * Service for offloading heavy computations to a Web Worker.
 */
export interface ComputationWorker {
  readonly postTask: <T extends ComputationTask>(
    task: T,
  ) => Effect.Effect<ComputationResult<T>>;
}
export const ComputationWorker = Context.GenericTag<ComputationWorker>(
  'ComputationWorker',
);

/**
 * A queue for holding chunk data generated by the worker,
 * waiting to be applied to the world.
 */
export interface ChunkDataQueue {
  readonly offer: (chunkData: ChunkGenerationResult) => Effect.Effect<void>;
  readonly take: () => Effect.Effect<Option.Option<ChunkGenerationResult>>;
}
export const ChunkDataQueue = Context.GenericTag<ChunkDataQueue>(
  'ChunkDataQueue',
);

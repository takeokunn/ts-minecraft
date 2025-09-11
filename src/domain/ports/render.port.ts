/**
 * Render Port - Interface for rendering operations
 *
 * This port defines the contract for rendering operations,
 * allowing the domain layer to render without depending on
 * specific rendering implementations (Three.js, WebGPU, etc.).
 */

import * as Effect from 'effect/Effect'
import * as Context from 'effect/Context'
import * as Data from 'effect/Data'
import * as Option from 'effect/Option'
import * as Schedule from 'effect/Schedule'

// Error types for rendering operations
export class RenderError extends Data.TaggedError('RenderError')<{
  readonly message: string
  readonly cause?: unknown
}> {}

export class MeshError extends Data.TaggedError('MeshError')<{
  readonly message: string
  readonly chunkX: number
  readonly chunkZ: number
  readonly cause?: unknown
}> {}

export class CameraError extends Data.TaggedError('CameraError')<{
  readonly message: string
  readonly cause?: unknown
}> {}

export class ResourceError extends Data.TaggedError('ResourceError')<{
  readonly message: string
  readonly resourceType: string
  readonly cause?: unknown
}> {}

// Domain-specific types (no external library dependencies)
export interface Camera {
  readonly position: { x: number; y: number; z: number }
  readonly rotation: { x: number; y: number; z: number }
  readonly fov?: number
  readonly aspect?: number
  readonly near?: number
  readonly far?: number
}

export interface ChunkMeshData {
  readonly chunkX: number
  readonly chunkZ: number
  readonly positions: Float32Array
  readonly normals: Float32Array
  readonly uvs: Float32Array
  readonly indices: Uint32Array
}

export interface MeshHandle {
  readonly id: string
  readonly chunkX: number
  readonly chunkZ: number
}

export interface RenderStats {
  readonly fps: number
  readonly frameTime: number
  readonly drawCalls: number
  readonly triangles: number
  readonly memoryUsage: number
  readonly activeMeshes: number
}

export interface ViewportConfig {
  readonly width: number
  readonly height: number
  readonly pixelRatio?: number
}

export interface FogConfig {
  readonly enabled: boolean
  readonly color?: { r: number; g: number; b: number }
  readonly near?: number
  readonly far?: number
  readonly density?: number
}

export interface LightingConfig {
  readonly ambient?: { color: { r: number; g: number; b: number }; intensity: number }
  readonly directional?: Array<{ 
    color: { r: number; g: number; b: number }
    intensity: number
    direction: { x: number; y: number; z: number }
  }>
}

export interface IRenderPort {
  // Basic rendering operations
  readonly render: () => Effect.Effect<void, RenderError, never>
  readonly clear: () => Effect.Effect<void, RenderError, never>
  readonly resize: (config: ViewportConfig) => Effect.Effect<void, RenderError, never>

  // Camera operations
  readonly updateCamera: (camera: Camera) => Effect.Effect<void, CameraError, never>
  readonly getCamera: () => Effect.Effect<Camera, CameraError, never>

  // Mesh operations with resource management
  readonly createMesh: (meshData: ChunkMeshData) => Effect.Effect<MeshHandle, MeshError, never>
  readonly updateMesh: (handle: MeshHandle, meshData: ChunkMeshData) => Effect.Effect<void, MeshError, never>
  readonly removeMesh: (handle: MeshHandle) => Effect.Effect<void, MeshError, never>
  readonly getMesh: (handle: MeshHandle) => Effect.Effect<Option.Option<ChunkMeshData>, MeshError, never>
  
  // Batch operations for performance
  readonly createMeshes: (meshes: ReadonlyArray<ChunkMeshData>) => Effect.Effect<ReadonlyArray<MeshHandle>, MeshError, never>
  readonly updateMeshes: (updates: ReadonlyArray<{ handle: MeshHandle; meshData: ChunkMeshData }>) => Effect.Effect<void, MeshError, never>
  readonly removeMeshes: (handles: ReadonlyArray<MeshHandle>) => Effect.Effect<void, MeshError, never>
  
  // Backward compatibility - these will be deprecated
  readonly addChunkMesh: (meshData: ChunkMeshData) => Effect.Effect<void, MeshError, never>
  readonly removeChunkMesh: (chunkX: number, chunkZ: number) => Effect.Effect<void, MeshError, never>
  readonly updateChunkMesh: (meshData: ChunkMeshData) => Effect.Effect<void, MeshError, never>

  // Performance monitoring with scheduled updates
  readonly getStats: () => Effect.Effect<RenderStats, RenderError, never>
  readonly getStatsStream: () => Effect.Effect<Effect.Effect<RenderStats, RenderError, never>, RenderError, never>
  readonly setWireframe: (enabled: boolean) => Effect.Effect<void, RenderError, never>
  
  // Lighting and atmosphere
  readonly setFog: (config: FogConfig) => Effect.Effect<void, RenderError, never>
  readonly setLighting: (config: LightingConfig) => Effect.Effect<void, RenderError, never>

  // Resource management with automatic cleanup
  readonly dispose: () => Effect.Effect<void, ResourceError, never>
  readonly getMemoryUsage: () => Effect.Effect<{ totalBytes: number; textureBytes: number; geometryBytes: number }, ResourceError, never>
  readonly collectGarbage: () => Effect.Effect<{ freedBytes: number }, ResourceError, never>
  
  // Render state management
  readonly isReady: () => Effect.Effect<boolean, RenderError, never>
  readonly waitForReady: () => Effect.Effect<void, RenderError, never>
}

export const RenderPort = Context.GenericTag<IRenderPort>('RenderPort')

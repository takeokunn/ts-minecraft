/**
 * Render Port - Interface for rendering operations
 *
 * This port defines the contract for rendering operations,
 * allowing the domain layer to render without depending on
 * specific rendering implementations (Three.js, WebGPU, etc.).
 */

import * as Effect from 'effect/Effect'
import * as Context from 'effect/Context'

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

export interface RenderStats {
  readonly fps: number
  readonly frameTime: number
  readonly drawCalls: number
  readonly triangles: number
  readonly memoryUsage: number
}

export interface IRenderPort {
  // Basic rendering operations
  readonly render: () => Effect.Effect<void, never, never>
  readonly clear: () => Effect.Effect<void, never, never>
  readonly resize: (width: number, height: number) => Effect.Effect<void, never, never>

  // Camera operations
  readonly updateCamera: (camera: Camera) => Effect.Effect<void, never, never>
  readonly getCamera: () => Effect.Effect<Camera, never, never>

  // Mesh operations
  readonly addChunkMesh: (meshData: ChunkMeshData) => Effect.Effect<void, never, never>
  readonly removeChunkMesh: (chunkX: number, chunkZ: number) => Effect.Effect<void, never, never>
  readonly updateChunkMesh: (meshData: ChunkMeshData) => Effect.Effect<void, never, never>

  // Performance monitoring
  readonly getStats: () => Effect.Effect<RenderStats, never, never>
  readonly setWireframe: (enabled: boolean) => Effect.Effect<void, never, never>
  readonly setFog: (enabled: boolean, color?: { r: number; g: number; b: number }, near?: number, far?: number) => Effect.Effect<void, never, never>

  // Resource management
  readonly dispose: () => Effect.Effect<void, never, never>
}

export class RenderPort extends Context.GenericTag('RenderPort')<RenderPort, IRenderPort>() {}

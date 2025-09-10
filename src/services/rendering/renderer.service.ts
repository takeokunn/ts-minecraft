import { Context, Effect, Queue } from 'effect'
import * as THREE from 'three'

/**
 * Render command types for the rendering queue
 */
export type RenderCommand =
  | {
      readonly type: 'ADD_CHUNK'
      readonly chunkX: number
      readonly chunkZ: number
      readonly positions: Float32Array
      readonly normals: Float32Array
      readonly uvs: Float32Array
      readonly indices: Uint32Array
    }
  | {
      readonly type: 'REMOVE_CHUNK'
      readonly chunkX: number
      readonly chunkZ: number
    }

/**
 * Renderer Service - Manages 3D rendering operations
 */
export class Renderer extends Context.Tag('Renderer')<
  Renderer,
  {
    readonly renderQueue: Queue.Queue<RenderCommand>
    readonly updateCamera: (position: THREE.Vector3, rotation: THREE.Euler) => Effect.Effect<void>
  }
>() {}
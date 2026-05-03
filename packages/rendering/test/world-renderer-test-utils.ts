import { vi } from 'vitest'
import { Array as Arr, Effect, Layer, Option } from 'effect'
import * as THREE from 'three'

// ---------------------------------------------------------------------------
// DOM mocks — vitest runs in 'node' (no real DOM)
// chunk-mesh.ts needs document.createElement (canvas) and Image for atlas build.
// ---------------------------------------------------------------------------
if (typeof globalThis.document === 'undefined') {
  const ctx = {
    fillStyle: '',
    fillRect: vi.fn(),
    strokeStyle: '',
    lineWidth: 0,
    beginPath: vi.fn(),
    arc: vi.fn(),
    stroke: vi.fn(),
    strokeRect: vi.fn(),
    drawImage: vi.fn(),
  }
  Object.defineProperty(globalThis, 'document', {
    value: {
      createElement: vi.fn(() => ({
        width: 256, height: 256,
        getContext: () => ctx,
      })),
      body: { appendChild: vi.fn() },
    },
    writable: true,
  })
}

if (typeof globalThis.Image === 'undefined') {
  class MockImage {
    onload: (() => void) | null = null
    onerror: ((_e: unknown) => void) | null = null
    private _src = ''
    get src(): string { return this._src }
    set src(url: string) {
      this._src = url
      // Trigger onload synchronously — simulates successful texture load
      if (this.onload) this.onload()
    }
  }
  Object.defineProperty(globalThis, 'Image', { value: MockImage, writable: true })
}

import { WorldRendererService, WorldRendererServiceLive, ChunkMeshService, SceneService } from '@ts-minecraft/rendering'
import type { Chunk } from '@ts-minecraft/terrain'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export const makeChunk = (x: number, z: number): Chunk => ({
  coord: { x, z },
  blocks: new Uint8Array(16 * 256 * 16),
  fluid: Option.none(),
})

export const makeMockMesh = (coord: { x: number; z: number }) => ({
  geometry: { dispose: vi.fn(), getAttribute: vi.fn(() => undefined) },
  material: {},
  visible: true,
  userData: { chunkCoord: coord },
  position: { set: vi.fn() },
})

// Build a test-specific Layer that bypasses WorldRendererServiceLive's bundled dependencies.
// We use Layer.effect to construct WorldRendererService with injected mocks.
export const buildTestLayer = (
  createChunkMesh: ReturnType<typeof vi.fn> = vi.fn((chunk: Chunk) =>
    Effect.succeed({ opaqueMesh: makeMockMesh(chunk.coord) as unknown as THREE.Mesh, waterMesh: Option.none<THREE.Mesh>() })
  ),
  updateChunkMesh: ReturnType<typeof vi.fn> = vi.fn((_m: THREE.Mesh, w: Option.Option<THREE.Mesh>) => Effect.succeed(w)),
  sceneAdd: ReturnType<typeof vi.fn> = vi.fn((_s: unknown, _m: unknown) => Effect.void),
  sceneRemove: ReturnType<typeof vi.fn> = vi.fn((_s: unknown, _m: unknown) => Effect.void)
) => {
  const chunkMeshLayer = Layer.succeed(ChunkMeshService, {
    atlasTexture: {} as THREE.Texture,
    createChunkMesh,
    updateChunkMesh,
    disposeMesh: vi.fn((_m: THREE.Mesh) => Effect.void),
  } as unknown as ChunkMeshService)

  const sceneLayer = Layer.succeed(SceneService, {
    create: () => Effect.succeed({} as THREE.Scene),
    add: sceneAdd,
    remove: sceneRemove,
  } as unknown as SceneService)

  return Layer.provide(WorldRendererServiceLive, Layer.mergeAll(chunkMeshLayer, sceneLayer))
}

export const makeScene = (): THREE.Scene => new THREE.Scene()

export const makeRenderer = (): THREE.WebGLRenderer =>
  ({
    setRenderTarget: vi.fn(),
    render: vi.fn(),
    shadowMap: { autoUpdate: true, needsUpdate: false },
  } as unknown as THREE.WebGLRenderer)

// Drain helper: call syncChunksToScene repeatedly until it returns true
// (i.e. all new chunks have been meshed). The time-budget throttle in
// syncChunksToScene means a single call may not mesh every chunk if real
// wall-clock time is slow (test scheduler delay can blow past the 4ms
// budget), so tests that want to assert on the post-drain state must drive
// it to completion. Bounded at 32 iterations so a logic bug can't infinite-loop.
export const drainSync = (
  s: { syncChunksToScene: (chunks: ReadonlyArray<Chunk>, scene: THREE.Scene) => Effect.Effect<boolean, never> },
  chunks: ReadonlyArray<Chunk>,
  scene: THREE.Scene,
): Effect.Effect<void, never> =>
  Effect.iterate({ done: false, i: 0 }, {
    while: (state) => !state.done && state.i < 32,
    body: (state) => Effect.gen(function* () {
      const done = yield* s.syncChunksToScene(chunks, scene)
      return { done, i: state.i + 1 }
    }),
  }).pipe(Effect.asVoid)

export { WorldRendererService, WorldRendererServiceLive, ChunkMeshService, SceneService }
export type { Chunk }
export { Arr, Effect, Layer, Option }

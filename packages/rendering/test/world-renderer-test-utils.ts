import { vi } from 'vitest'
import { Effect, Layer, Option } from 'effect'
import * as THREE from 'three'
import { createFluidBuffer, encodeFluidCell } from '@ts-minecraft/block/domain/fluid'
import { blockTypeToIndex } from '@ts-minecraft/core'

const makeAtlasTexture = (): THREE.Texture =>
  new THREE.CanvasTexture({ width: 1, height: 1 } as unknown as HTMLCanvasElement)

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

import { WorldRendererService, ChunkMeshService, SceneService } from '@ts-minecraft/rendering'
import type { Chunk } from '@ts-minecraft/world'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export const makeChunk = (x: number, z: number): Chunk => ({
  coord: { x, z },
  ...makeChunkData(),
})

export const makeMockMesh = (coord: { x: number; z: number }): THREE.Mesh => {
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshLambertMaterial())
  mesh.visible = true
  mesh.userData['chunkCoord'] = coord
  return mesh
}

const WATER_BLOCK_TYPE = blockTypeToIndex('WATER')
const WATER_SOURCE_BYTE = encodeFluidCell({ level: 0, source: true, type: 'water' })

const isBlockArrayIndex = (property: string | symbol): property is string => {
  if (typeof property !== 'string') return false
  const index = Number(property)
  return Number.isInteger(index) && index >= 0
}

const makeWaterAwareBlocks = (fluid: Uint8Array<ArrayBufferLike>): Uint8Array =>
  new Proxy(new Uint8Array(fluid.byteLength), {
    get: (target, property) => {
      const value = Reflect.get(target, property, target)
      return typeof value === 'function' ? value.bind(target) : value
    },
    set: (target, property, value, receiver) => {
      const didSet = Reflect.set(target, property, value, receiver)
      if (didSet && isBlockArrayIndex(property)) {
        const index = Number(property)
        if (index < fluid.byteLength) {
          fluid[index] = value === WATER_BLOCK_TYPE ? WATER_SOURCE_BYTE : 0
        }
      }
      return didSet
    },
  })

const makeChunkData = (): Pick<Chunk, 'blocks' | 'fluid'> => {
  const fluid = createFluidBuffer()
  return {
    blocks: makeWaterAwareBlocks(fluid),
    fluid: Option.some(fluid),
  }
}

const chunkHasWater = (chunk: Chunk): boolean => chunk.blocks.includes(WATER_BLOCK_TYPE)

const makeDefaultWaterMesh = (
  chunk: Chunk,
  existingWaterMesh: Option.Option<THREE.Mesh>,
): Option.Option<THREE.Mesh> => {
  if (!chunkHasWater(chunk)) return Option.none()
  return Option.isSome(existingWaterMesh)
    ? existingWaterMesh
    : Option.some(makeMockMesh(chunk.coord))
}

const makeDefaultChunkMeshes = (chunk: Chunk) => ({
  opaqueMesh: makeMockMesh(chunk.coord),
  waterMesh: makeDefaultWaterMesh(chunk, Option.none()),
  transparentSolidMesh: Option.none<THREE.Mesh>(),
})

// Build a test-specific Layer that bypasses WorldRendererService.Default's bundled dependencies.
// We use Layer.effect to construct WorldRendererService with injected mocks.
export const buildTestLayer = (
  createChunkMesh: ReturnType<typeof vi.fn> = vi.fn((chunk: Chunk) =>
    Effect.succeed(makeDefaultChunkMeshes(chunk))
  ),
  updateChunkMesh: ReturnType<typeof vi.fn> = vi.fn((
    _mesh: THREE.Mesh,
    waterMesh: Option.Option<THREE.Mesh>,
    chunk: Chunk,
  ) =>
    Effect.succeed({ waterMesh: makeDefaultWaterMesh(chunk, waterMesh), transparentSolidMesh: Option.none<THREE.Mesh>() })
  ),
  sceneAdd: ReturnType<typeof vi.fn> = vi.fn((scene: THREE.Scene, mesh: THREE.Object3D) =>
    Effect.sync(() => scene.add(mesh))
  ),
  sceneRemove: ReturnType<typeof vi.fn> = vi.fn((scene: THREE.Scene, mesh: THREE.Object3D) =>
    Effect.sync(() => scene.remove(mesh))
  )
) => {
  const chunkMeshLayer = Layer.succeed(ChunkMeshService, ChunkMeshService.of({
    _tag: '@minecraft/infrastructure/three/ChunkMeshService' as const,
    atlasTexture: makeAtlasTexture(),
    createChunkMesh,
    updateChunkMesh,
    disposeMesh: vi.fn((_m: THREE.Mesh) => Effect.void),
    setSunIntensity: (_value: number) => Effect.void,
    releasePrevCachedMesh: vi.fn(() => Effect.void),
  }))

  const sceneLayer = Layer.succeed(SceneService, SceneService.of({
    _tag: '@minecraft/infrastructure/three/SceneService' as const,
    create: () => Effect.succeed(new THREE.Scene()),
    add: sceneAdd,
    remove: sceneRemove,
  }))

  return Layer.provide(WorldRendererService.Default, Layer.mergeAll(chunkMeshLayer, sceneLayer))
}

export const makeScene = (): THREE.Scene => new THREE.Scene()

export const makeRenderer = (): THREE.WebGLRenderer => ({
  setRenderTarget: vi.fn(),
  render: vi.fn(),
  shadowMap: { autoUpdate: true, needsUpdate: false },
} as THREE.WebGLRenderer)

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

export { WorldRendererService, ChunkMeshService, SceneService }
export type { Chunk }
export { Effect, Layer, Option }

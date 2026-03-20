import { describe, it, expect, vi } from 'vitest'
import { Effect, Layer } from 'effect'
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

// ---------------------------------------------------------------------------
// THREE.js mock — must be declared before any imports that touch 'three'
// ---------------------------------------------------------------------------
vi.mock('three', () => ({
  Mesh: vi.fn(() => ({
    geometry: { dispose: vi.fn() },
    material: {},
    visible: true,
    userData: {} as Record<string, unknown>,
    position: { set: vi.fn() },
    renderOrder: 0,
    castShadow: false,
    receiveShadow: false,
  })),
  BufferGeometry: vi.fn(() => ({ setAttribute: vi.fn(), setIndex: vi.fn(), dispose: vi.fn() })),
  BufferAttribute: vi.fn(),
  Scene: vi.fn(() => ({ add: vi.fn(), remove: vi.fn(), children: [] })),
  Frustum: vi.fn(() => ({ setFromProjectionMatrix: vi.fn(), intersectsBox: vi.fn(() => true) })),
  Box3: vi.fn(() => ({ set: vi.fn() })),
  Vector3: vi.fn(() => ({ set: vi.fn(), copy: vi.fn(), x: 0, y: 0, z: 0 })),
  Vector2: vi.fn(() => ({ set: vi.fn(), x: 0, y: 0 })),
  Matrix4: vi.fn(() => ({ multiplyMatrices: vi.fn(), elements: Array.from({ length: 16 }, () => 0) })),
  PerspectiveCamera: vi.fn(() => ({
    updateMatrixWorld: vi.fn(),
    projectionMatrix: { elements: Array.from({ length: 16 }, () => 0) },
    matrixWorldInverse: { elements: Array.from({ length: 16 }, () => 0) },
    isCamera: true,
    position: { set: vi.fn(), copy: vi.fn(), x: 0, y: 0, z: 0 },
  })),
  MeshStandardMaterial: vi.fn(() => ({ map: null, dispose: vi.fn() })),
  ShaderMaterial: vi.fn(() => ({ uniforms: {}, transparent: true, depthWrite: false, dispose: vi.fn() })),
  CanvasTexture: vi.fn(() => ({ magFilter: 0, minFilter: 0, wrapS: 0, wrapT: 0, dispose: vi.fn() })),
  WebGLRenderTarget: vi.fn(() => ({ texture: {}, setSize: vi.fn(), dispose: vi.fn() })),
  NearestFilter: 0,
  LinearFilter: 1,
  ClampToEdgeWrapping: 0,
  RGBAFormat: 0,
  FrontSide: 0,
}))

import { WorldRendererService, WorldRendererServiceLive } from './world-renderer'
import { ChunkMeshService } from './meshing/chunk-mesh'
import { SceneService } from './scene/scene-service'
import type { Chunk } from '@/domain/chunk'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeChunk = (x: number, z: number): Chunk => ({
  coord: { x, z },
  blocks: new Uint8Array(16 * 256 * 16),
})

const makeMockMesh = (coord: { x: number; z: number }) => ({
  geometry: { dispose: vi.fn() },
  material: {},
  visible: true,
  userData: { chunkCoord: coord, blockPositions: [] },
  position: { set: vi.fn() },
})

// Build a test-specific Layer that bypasses WorldRendererServiceLive's bundled dependencies.
// We use Layer.effect to construct WorldRendererService with injected mocks.
const buildTestLayer = (
  createChunkMesh: ReturnType<typeof vi.fn> = vi.fn((chunk: Chunk) =>
    Effect.succeed({ opaqueMesh: makeMockMesh(chunk.coord) as unknown as THREE.Mesh, waterMesh: null })
  ),
  sceneAdd: ReturnType<typeof vi.fn> = vi.fn((_s: unknown, _m: unknown) => Effect.void),
  sceneRemove: ReturnType<typeof vi.fn> = vi.fn((_s: unknown, _m: unknown) => Effect.void)
) => {
  const chunkMeshLayer = Layer.succeed(ChunkMeshService, {
    atlasTexture: {} as THREE.Texture,
    createChunkMesh,
    updateChunkMesh: vi.fn((_m: THREE.Mesh, _w: THREE.Mesh | null, _c: Chunk) => Effect.void),
    disposeMesh: vi.fn((_m: THREE.Mesh) => Effect.void),
  } as unknown as ChunkMeshService)

  const sceneLayer = Layer.succeed(SceneService, {
    create: () => Effect.succeed({} as THREE.Scene),
    add: sceneAdd,
    remove: sceneRemove,
  } as unknown as SceneService)

  return Layer.provide(WorldRendererServiceLive, Layer.mergeAll(chunkMeshLayer, sceneLayer))
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('infrastructure/three/world-renderer', () => {
  describe('WorldRendererServiceLive', () => {
    it('should be defined', () => {
      expect(WorldRendererServiceLive).toBeDefined()
    })

    it('should expose all required methods', async () => {
      const TestLayer = buildTestLayer()
      const result = await Effect.gen(function* () {
        const s = yield* WorldRendererService
        return {
          hasSyncChunks: typeof s.syncChunksToScene === 'function',
          hasUpdate: typeof s.updateChunkInScene === 'function',
          hasFrustum: typeof s.applyFrustumCulling === 'function',
          hasClear: typeof s.clearScene === 'function',
        }
      }).pipe(Effect.provide(TestLayer), Effect.runPromise)
      expect(result.hasSyncChunks).toBe(true)
      expect(result.hasUpdate).toBe(true)
      expect(result.hasFrustum).toBe(true)
      expect(result.hasClear).toBe(true)
    })
  })

  // SceneService.Default calls scene.add(object) and scene.remove(object) directly.
  // The THREE.js mock provides Scene with add/remove spy functions, so we use that.
  const makeScene = (): THREE.Scene => new THREE.Scene()

  describe('syncChunksToScene', () => {
    it('should add new chunk meshes to scene', async () => {
      // WorldRendererServiceLive uses ChunkMeshService from dependencies (not mock layer).
      // We verify behavior by observing scene.add calls (using THREE.Scene mock which has spy add()).
      const TestLayer = buildTestLayer()
      const scene = makeScene()

      await Effect.gen(function* () {
        const s = yield* WorldRendererService
        yield* s.syncChunksToScene([makeChunk(0, 0), makeChunk(1, 0)], scene)
      }).pipe(Effect.provide(TestLayer), Effect.runPromise)

      // scene.add should be called once per new chunk
      expect(scene.add).toHaveBeenCalledTimes(2)
    })

    it('should not add mesh again when chunks are unchanged', async () => {
      const TestLayer = buildTestLayer()
      const scene = makeScene()
      const chunks = [makeChunk(0, 0)]

      const result = await Effect.gen(function* () {
        const s = yield* WorldRendererService
        yield* s.syncChunksToScene(chunks, scene)
        const addCountAfterFirst = (scene.add as ReturnType<typeof vi.fn>).mock.calls.length
        yield* s.syncChunksToScene(chunks, scene)
        const addCountAfterSecond = (scene.add as ReturnType<typeof vi.fn>).mock.calls.length
        return { addCountAfterFirst, addCountAfterSecond }
      }).pipe(Effect.provide(TestLayer), Effect.runPromise)

      expect(result.addCountAfterFirst).toBe(1)
      expect(result.addCountAfterSecond).toBe(1) // no additional adds
    })

    it('should remove meshes for stale chunks', async () => {
      const createChunkMesh = vi.fn((chunk: Chunk) =>
        Effect.succeed(makeMockMesh(chunk.coord) as unknown as THREE.Mesh)
      )
      const TestLayer = buildTestLayer(createChunkMesh)
      const scene = makeScene()

      await Effect.gen(function* () {
        const s = yield* WorldRendererService
        yield* s.syncChunksToScene([makeChunk(0, 0), makeChunk(1, 0)], scene)
        yield* s.syncChunksToScene([makeChunk(0, 0)], scene)
      }).pipe(Effect.provide(TestLayer), Effect.runPromise)

      expect(scene.remove).toHaveBeenCalledTimes(1)
    })

    it('should handle empty chunk list without error', async () => {
      const TestLayer = buildTestLayer()
      const scene = makeScene()
      const result = await Effect.gen(function* () {
        const s = yield* WorldRendererService
        yield* s.syncChunksToScene([], scene)
        return { success: true }
      }).pipe(Effect.provide(TestLayer), Effect.runPromise)
      expect(result.success).toBe(true)
    })
  })

  describe('clearScene', () => {
    it('should remove all tracked chunk meshes', async () => {
      const createChunkMesh = vi.fn((chunk: Chunk) =>
        Effect.succeed(makeMockMesh(chunk.coord) as unknown as THREE.Mesh)
      )
      const TestLayer = buildTestLayer(createChunkMesh)
      const scene = makeScene()

      await Effect.gen(function* () {
        const s = yield* WorldRendererService
        yield* s.syncChunksToScene([makeChunk(0, 0), makeChunk(1, 0), makeChunk(0, 1)], scene)
        yield* s.clearScene(scene)
      }).pipe(Effect.provide(TestLayer), Effect.runPromise)

      // 3 added, then 3 removed
      expect(scene.remove).toHaveBeenCalledTimes(3)
    })

    it('should be safe to call on empty state', async () => {
      const TestLayer = buildTestLayer()
      const scene = makeScene()
      const result = await Effect.gen(function* () {
        const s = yield* WorldRendererService
        yield* s.clearScene(scene)
        return { success: true }
      }).pipe(Effect.provide(TestLayer), Effect.runPromise)
      expect(result.success).toBe(true)
    })
  })

  // ---------------------------------------------------------------------------
  // D8: Block placement → worldRenderer mesh rebuild test
  // ---------------------------------------------------------------------------

  describe('updateChunkInScene', () => {
    it('updateChunkInScene on a known chunk does not call scene.add again', async () => {
      // Observable invariant: if the chunk is already in the scene, updateChunkInScene
      // should update the mesh in-place and NOT call scene.add a second time.
      const TestLayer = buildTestLayer()
      const scene = makeScene()
      const chunk = makeChunk(2, 3)

      const result = await Effect.gen(function* () {
        const s = yield* WorldRendererService

        // First: sync puts the chunk in the scene (1 scene.add call)
        yield* s.syncChunksToScene([chunk], scene)
        const addCountAfterSync = (scene.add as ReturnType<typeof vi.fn>).mock.calls.length

        // Modify the chunk blocks to simulate a block placement
        chunk.blocks[0] = 1 // GRASS

        // Update: must NOT add a second mesh to the scene
        yield* s.updateChunkInScene(chunk, scene)
        const addCountAfterUpdate = (scene.add as ReturnType<typeof vi.fn>).mock.calls.length

        return { addCountAfterSync, addCountAfterUpdate }
      }).pipe(Effect.provide(TestLayer), Effect.runPromise)

      expect(result.addCountAfterSync).toBe(1)
      expect(result.addCountAfterUpdate).toBe(1) // no extra scene.add on in-place update
    })

    it('updateChunkInScene on an unknown chunk adds it to the scene once', async () => {
      // If the chunk has NOT been synced yet, updateChunkInScene must create
      // a new mesh and add it to the scene (exactly one scene.add call).
      const TestLayer = buildTestLayer()
      const scene = makeScene()
      const chunk = makeChunk(7, 9)

      const result = await Effect.gen(function* () {
        const s = yield* WorldRendererService

        // Call updateChunkInScene WITHOUT prior syncChunksToScene
        yield* s.updateChunkInScene(chunk, scene)

        return {
          sceneAddCallCount: (scene.add as ReturnType<typeof vi.fn>).mock.calls.length,
        }
      }).pipe(Effect.provide(TestLayer), Effect.runPromise)

      // The new mesh must be added to the scene exactly once
      expect(result.sceneAddCallCount).toBe(1)
    })

    it('does not call scene.add again when updating an already-tracked chunk mesh', async () => {
      const createChunkMesh = vi.fn((chunk: Chunk) =>
        Effect.succeed(makeMockMesh(chunk.coord) as unknown as THREE.Mesh)
      )
      const TestLayer = buildTestLayer(createChunkMesh)

      const scene = makeScene()
      const chunk = makeChunk(4, 4)

      const result = await Effect.gen(function* () {
        const s = yield* WorldRendererService

        // First sync adds the chunk mesh (one scene.add call)
        yield* s.syncChunksToScene([chunk], scene)
        const addCountAfterSync = (scene.add as ReturnType<typeof vi.fn>).mock.calls.length

        // Modify block and call update — should NOT call scene.add again
        chunk.blocks[0] = 2
        yield* s.updateChunkInScene(chunk, scene)
        const addCountAfterUpdate = (scene.add as ReturnType<typeof vi.fn>).mock.calls.length

        return { addCountAfterSync, addCountAfterUpdate }
      }).pipe(Effect.provide(TestLayer), Effect.runPromise)

      expect(result.addCountAfterSync).toBe(1)
      expect(result.addCountAfterUpdate).toBe(1) // no extra scene.add on update
    })
  })

  // ---------------------------------------------------------------------------
  // applyFrustumCulling behavioral tests
  //
  // applyFrustumCulling(camera) takes only a PerspectiveCamera (no scene arg).
  // The THREE mocks provide:
  //   - PerspectiveCamera: updateMatrixWorld() vi.fn, projectionMatrix, matrixWorldInverse
  //   - Frustum: setFromProjectionMatrix() vi.fn, intersectsBox() returns true by default
  // ---------------------------------------------------------------------------

  describe('applyFrustumCulling', () => {
    it('sets mesh.visible = true for chunks inside the frustum', async () => {
      // Default Frustum mock: intersectsBox returns true → all meshes visible.
      const mockMeshes: ReturnType<typeof makeMockMesh>[] = []
      const createChunkMesh = vi.fn((chunk: Chunk) => {
        const mesh = makeMockMesh(chunk.coord)
        mockMeshes.push(mesh)
        return Effect.succeed(mesh as unknown as THREE.Mesh)
      })
      const TestLayer = buildTestLayer(createChunkMesh)
      const scene = makeScene()
      const camera = new THREE.PerspectiveCamera()

      await Effect.gen(function* () {
        const s = yield* WorldRendererService
        yield* s.syncChunksToScene([makeChunk(0, 0), makeChunk(1, 0)], scene)
        yield* s.applyFrustumCulling(camera)
      }).pipe(Effect.provide(TestLayer), Effect.runPromise)

      // All meshes visible (intersectsBox = true from default mock)
      for (const mesh of mockMeshes) {
        expect(mesh.visible).toBe(true)
      }
    })

    it('sets mesh.visible = false for chunks outside the frustum', async () => {
      // Temporarily override Frustum mock to return intersectsBox = false.
      const FrustumCtor = THREE.Frustum as ReturnType<typeof vi.fn>
      const originalImpl = FrustumCtor.getMockImplementation()
      FrustumCtor.mockImplementation(() => ({
        setFromProjectionMatrix: vi.fn(),
        intersectsBox: vi.fn(() => false),
      }))

      const mockMeshes: ReturnType<typeof makeMockMesh>[] = []
      const createChunkMesh = vi.fn((chunk: Chunk) => {
        const mesh = makeMockMesh(chunk.coord)
        mesh.visible = true // start visible so we can detect the change
        mockMeshes.push(mesh)
        return Effect.succeed(mesh as unknown as THREE.Mesh)
      })
      const TestLayer = buildTestLayer(createChunkMesh)
      const scene = makeScene()
      const camera = new THREE.PerspectiveCamera()

      await Effect.gen(function* () {
        const s = yield* WorldRendererService
        yield* s.syncChunksToScene([makeChunk(0, 0), makeChunk(1, 0)], scene)
        yield* s.applyFrustumCulling(camera)
      }).pipe(Effect.provide(TestLayer), Effect.runPromise)

      // Restore original Frustum implementation
      if (originalImpl !== undefined) {
        FrustumCtor.mockImplementation(originalImpl)
      } else {
        FrustumCtor.mockImplementation(() => ({
          setFromProjectionMatrix: vi.fn(),
          intersectsBox: vi.fn(() => true),
        }))
      }

      // All meshes hidden (intersectsBox = false)
      for (const mesh of mockMeshes) {
        expect(mesh.visible).toBe(false)
      }
    })

    it('completes without error when no chunks are loaded', async () => {
      const TestLayer = buildTestLayer()
      const camera = new THREE.PerspectiveCamera()

      const result = await Effect.gen(function* () {
        const s = yield* WorldRendererService
        yield* s.applyFrustumCulling(camera)
        return { success: true }
      }).pipe(Effect.provide(TestLayer), Effect.runPromise)

      expect(result.success).toBe(true)
    })
  })
})

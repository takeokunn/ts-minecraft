import { describe, it } from '@effect/vitest'
import { expect, vi } from 'vitest'
import * as THREE from 'three'

// ---------------------------------------------------------------------------
// THREE.js mock — must be declared before any imports that touch 'three'
// ---------------------------------------------------------------------------
vi.mock('three', () => ({
  Mesh: vi.fn((geometry?: unknown, material?: unknown) => ({
    geometry: geometry ?? { dispose: vi.fn() },
    material: material ?? {},
    visible: true,
    userData: {} as Record<string, unknown>,
    position: { set: vi.fn() },
    renderOrder: 0,
    castShadow: false,
    receiveShadow: false,
  })),
  BufferGeometry: vi.fn(() => {
    const attributes: Record<string, unknown> = {}
    let index: unknown = null
    return {
      setAttribute: vi.fn((name: string, attr: unknown) => { attributes[name] = attr }),
      getAttribute: vi.fn((name: string) => attributes[name]),
      setIndex: vi.fn((attr: unknown) => { index = attr }),
      getIndex: vi.fn(() => index),
      setDrawRange: vi.fn(),
      computeBoundingSphere: vi.fn(),
      dispose: vi.fn(),
    }
  }),
  BufferAttribute: vi.fn((array: ArrayLike<number>, _itemSize: number) => ({
    array,
    needsUpdate: false,
  })),
  Scene: vi.fn(() => ({ add: vi.fn(), remove: vi.fn(), children: [] })),
  Frustum: vi.fn(() => ({ setFromProjectionMatrix: vi.fn(), intersectsBox: vi.fn(() => true) })),
  Box3: vi.fn(() => ({ set: vi.fn() })),
  Vector3: vi.fn(() => ({ set: vi.fn(), copy: vi.fn(), x: 0, y: 0, z: 0 })),
  Vector4: vi.fn(() => ({ set: vi.fn(), applyMatrix4: vi.fn(), x: 0, y: 0, z: 0, w: 1 })),
  Vector2: vi.fn(() => ({ set: vi.fn(), x: 0, y: 0 })),
  Matrix4: vi.fn(() => ({ multiplyMatrices: vi.fn(), elements: Array.from({ length: 16 }, () => 0) })),
  PerspectiveCamera: vi.fn(() => ({
    updateMatrixWorld: vi.fn(),
    updateProjectionMatrix: vi.fn(),
    projectionMatrix: { elements: Array.from({ length: 16 }, () => 0) },
    matrixWorldInverse: { elements: Array.from({ length: 16 }, () => 0) },
    isCamera: true,
    isPerspectiveCamera: true,
    far: 1000,
    aspect: 1,
    position: { set: vi.fn(), copy: vi.fn(), x: 0, y: 0, z: 0 },
    quaternion: { copy: vi.fn() },
  })),
  MeshLambertMaterial: vi.fn(() => ({ map: null, dispose: vi.fn() })),
  ShaderMaterial: vi.fn((params: { uniforms?: Record<string, { value: unknown }> } = {}) => ({
    uniforms: params.uniforms ?? {},
    transparent: true,
    depthWrite: false,
    dispose: vi.fn(),
  })),
  CanvasTexture: vi.fn(() => ({ magFilter: 0, minFilter: 0, wrapS: 0, wrapT: 0, generateMipmaps: false, anisotropy: 1, dispose: vi.fn() })),
  WebGLRenderTarget: vi.fn((width: number, height: number) => ({ texture: { width, height }, setSize: vi.fn(), dispose: vi.fn() })),
  NearestFilter: 0,
  LinearFilter: 1,
  NearestMipmapNearestFilter: 2,
  NearestMipmapLinearFilter: 3,
  LinearMipmapNearestFilter: 4,
  LinearMipmapLinearFilter: 5,
  ClampToEdgeWrapping: 0,
  RGBAFormat: 0,
  FrontSide: 0,
  DoubleSide: 2,
  SRGBColorSpace: 'srgb',
}))

import { Effect, Option } from 'effect'
import {
  makeChunk,
  makeMockMesh,
  buildTestLayer,
  makeScene,
  drainSync,
  WorldRendererService,
} from './world-renderer-test-utils'
import type { Chunk } from '@ts-minecraft/world'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('infrastructure/three/world-renderer', () => {
  describe('WorldRendererService.Default', () => {
    it('should be defined', () => {
      expect(WorldRendererService.Default).toBeDefined()
    })

    it.effect('creates the refraction render target at reduced resolution', () => {
      const TestLayer = buildTestLayer()
      return Effect.gen(function* () {
        yield* WorldRendererService
        expect(THREE.WebGLRenderTarget).toHaveBeenCalledWith(400, 300, expect.any(Object))
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('should expose all required methods', () => {
      const TestLayer = buildTestLayer()
      return Effect.gen(function* () {
        const s = yield* WorldRendererService
        expect(typeof s.syncChunksToScene === 'function').toBe(true)
        expect(typeof s.updateChunkInScene === 'function').toBe(true)
        expect(typeof s.applyFrustumCulling === 'function').toBe(true)
        expect(typeof s.clearScene === 'function').toBe(true)
      }).pipe(Effect.provide(TestLayer))
    })
  })

  describe('syncChunksToScene', () => {
    it.effect('should add new chunk meshes to scene', () => {
      const TestLayer = buildTestLayer()
      const scene = makeScene()
      return Effect.gen(function* () {
        const s = yield* WorldRendererService
        yield* drainSync(s, [makeChunk(0, 0), makeChunk(1, 0)], scene)
        // scene.add should be called once per new chunk
        expect(scene.add).toHaveBeenCalledTimes(2)
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('should not add mesh again when chunks are unchanged', () => {
      const TestLayer = buildTestLayer()
      const scene = makeScene()
      const chunks = [makeChunk(0, 0)]
      return Effect.gen(function* () {
        const s = yield* WorldRendererService
        yield* s.syncChunksToScene(chunks, scene)
        const addCountAfterFirst = (scene.add as ReturnType<typeof vi.fn>).mock.calls.length
        yield* s.syncChunksToScene(chunks, scene)
        const addCountAfterSecond = (scene.add as ReturnType<typeof vi.fn>).mock.calls.length
        expect(addCountAfterFirst).toBe(1)
        expect(addCountAfterSecond).toBe(1) // no additional adds
      }).pipe(Effect.provide(TestLayer))
    })

     it.effect('should remove meshes for stale chunks', () => {
       const createChunkMesh = vi.fn((chunk: Chunk) =>
         Effect.succeed({ opaqueMesh: makeMockMesh(chunk.coord) as THREE.Mesh, waterMesh: Option.none<THREE.Mesh>(), transparentSolidMesh: Option.none<THREE.Mesh>() })
       )
      const TestLayer = buildTestLayer(createChunkMesh)
      const scene = makeScene()
      return Effect.gen(function* () {
        const s = yield* WorldRendererService
        yield* drainSync(s, [makeChunk(0, 0), makeChunk(1, 0)], scene)
        yield* s.syncChunksToScene([makeChunk(0, 0)], scene)
        expect(scene.remove).toHaveBeenCalledTimes(1)
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('should handle empty chunk list without error', () => {
      const TestLayer = buildTestLayer()
      const scene = makeScene()
      return Effect.gen(function* () {
        const s = yield* WorldRendererService
        yield* s.syncChunksToScene([], scene)
        expect(true).toBe(true) // completes without error
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('removes the water mesh from scene when a water chunk is unloaded (exercises syncChunksToScene onSome removal, lines 211-213)', () => {
      // Real ChunkMeshService + block 6 = WATER. Sync a water chunk, then remove it by
      // passing an empty loadedChunks to syncChunksToScene. The removal path must call
      // sceneService.remove for the water mesh as well.
      const TestLayer = buildTestLayer()
      const scene = makeScene()
      const waterChunk = makeChunk(0, 0)
      waterChunk.blocks[0] = 6 // WATER
      return Effect.gen(function* () {
        const s = yield* WorldRendererService
        // Add the water chunk to the scene
        yield* drainSync(s, [waterChunk], scene)
        const removeCountAfterAdd = (scene.remove as ReturnType<typeof vi.fn>).mock.calls.length
        // Remove all chunks — syncChunksToScene with empty list triggers removal path
        yield* s.syncChunksToScene([], scene)
        // scene.remove called for both opaque and water meshes
        expect((scene.remove as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(removeCountAfterAdd + 1)
      }).pipe(Effect.provide(TestLayer))
    })
  })

  describe('clearScene', () => {
     it.effect('should remove all tracked chunk meshes', () => {
       const createChunkMesh = vi.fn((chunk: Chunk) =>
         Effect.succeed({ opaqueMesh: makeMockMesh(chunk.coord) as THREE.Mesh, waterMesh: Option.none<THREE.Mesh>(), transparentSolidMesh: Option.none<THREE.Mesh>() })
       )
      const TestLayer = buildTestLayer(createChunkMesh)
      const scene = makeScene()
      return Effect.gen(function* () {
        const s = yield* WorldRendererService
        yield* drainSync(s, [makeChunk(0, 0), makeChunk(1, 0), makeChunk(0, 1)], scene)
        yield* s.clearScene(scene)
        // 3 added, then 3 removed
        expect(scene.remove).toHaveBeenCalledTimes(3)
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('should be safe to call on empty state', () => {
      const TestLayer = buildTestLayer()
      const scene = makeScene()
      return Effect.gen(function* () {
        const s = yield* WorldRendererService
        yield* s.clearScene(scene)
        expect(true).toBe(true) // completes without error
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('removes water meshes when clearing a scene with water chunks (exercises clearScene onSome branch)', () => {
      // Real ChunkMeshService + block 6 (WATER) → water mesh produced.
      // clearScene must call scene.remove for both the opaque and water mesh.
      const TestLayer = buildTestLayer()
      const scene = makeScene()
      const waterChunk = makeChunk(0, 0)
      waterChunk.blocks[0] = 6 // WATER block
      return Effect.gen(function* () {
        const s = yield* WorldRendererService
        yield* drainSync(s, [waterChunk], scene)
        const removeCountBefore = (scene.remove as ReturnType<typeof vi.fn>).mock.calls.length
        yield* s.clearScene(scene)
        // Both opaque and water mesh removed → at least 2 removes for this chunk
        expect((scene.remove as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(removeCountBefore + 1)
      }).pipe(Effect.provide(TestLayer))
    })
  })
})

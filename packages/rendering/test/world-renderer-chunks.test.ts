import { describe, it } from '@effect/vitest'
import * as THREE from 'three'
import { expect,vi } from 'vitest'

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

import type { Chunk } from '@ts-minecraft/world'
import { Effect,Option } from 'effect'
import {
buildTestLayer,
makeChunk,
makeMockMesh,
makeScene,
WorldRendererService
} from './world-renderer-test-utils'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('infrastructure/three/world-renderer', () => {
  // ---------------------------------------------------------------------------
  // D8: Block placement → worldRenderer mesh rebuild test
  // ---------------------------------------------------------------------------

  describe('updateChunkInScene', () => {
    it.effect('updateChunkInScene on a known chunk does not call scene.add again', () => {
      const TestLayer = buildTestLayer()
      const scene = makeScene()
      const chunk = makeChunk(2, 3)
      return Effect.gen(function* () {
        const s = yield* WorldRendererService

        // First: sync puts the chunk in the scene (1 scene.add call)
        yield* s.syncChunksToScene([chunk], scene)
        const addCountAfterSync = (scene.add as ReturnType<typeof vi.fn>).mock.calls.length

        // Modify the chunk blocks to simulate a block placement
        chunk.blocks[0] = 1 // GRASS

        // Update: must NOT add a second mesh to the scene
        yield* s.updateChunkInScene(chunk, scene)
        const addCountAfterUpdate = (scene.add as ReturnType<typeof vi.fn>).mock.calls.length

        expect(addCountAfterSync).toBe(1)
        expect(addCountAfterUpdate).toBe(1) // no extra scene.add on in-place update
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('updateChunkInScene on an unknown chunk adds it to the scene once', () => {
      const TestLayer = buildTestLayer()
      const scene = makeScene()
      const chunk = makeChunk(7, 9)
      return Effect.gen(function* () {
        const s = yield* WorldRendererService

        // Call updateChunkInScene WITHOUT prior syncChunksToScene
        yield* s.updateChunkInScene(chunk, scene)

        // The new mesh must be added to the scene exactly once
        expect((scene.add as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1)
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('updateChunkInScene on an unknown chunk with water block adds both opaque and water mesh (exercises onNone/onSome path, lines 280-282)', () => {
      // Real ChunkMeshService + block 6 (WATER) → water mesh produced.
      // updateChunkInScene (onNone path) adds both opaque mesh and water mesh to scene.
      // The water mesh Ref.update also registers the water mesh in waterMeshesRef.
      const TestLayer = buildTestLayer()
      const scene = makeScene()
      const waterChunk = makeChunk(5, 5)
      waterChunk.blocks[0] = 6 // WATER block → real greedy meshing produces water mesh
      return Effect.gen(function* () {
        const s = yield* WorldRendererService
        // Call updateChunkInScene on a chunk NOT yet in the mesh map
        yield* s.updateChunkInScene(waterChunk, scene)
        // Both opaque and water meshes must be added: scene.add called at least twice
        expect((scene.add as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(2)
        // waterMeshesRef must also contain the water mesh
        const waterMeshes = yield* s.getWaterMeshes()
        expect(waterMeshes.length).toBeGreaterThan(0)
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('does not call scene.add again when updating an already-tracked chunk mesh', () => {
        const createChunkMesh = vi.fn((chunk: Chunk) =>
          Effect.succeed({ opaqueMesh: makeMockMesh(chunk.coord) as THREE.Mesh, waterMesh: Option.none<THREE.Mesh>(), transparentSolidMesh: Option.none<THREE.Mesh>() })
        )
      const TestLayer = buildTestLayer(createChunkMesh)
      const scene = makeScene()
      const chunk = makeChunk(4, 4)
      return Effect.gen(function* () {
        const s = yield* WorldRendererService

        // First sync adds the chunk mesh (one scene.add call)
        yield* s.syncChunksToScene([chunk], scene)
        const addCountAfterSync = (scene.add as ReturnType<typeof vi.fn>).mock.calls.length

        // Modify block and call update — should NOT call scene.add again
        chunk.blocks[0] = 2
        yield* s.updateChunkInScene(chunk, scene)
        const addCountAfterUpdate = (scene.add as ReturnType<typeof vi.fn>).mock.calls.length

        expect(addCountAfterSync).toBe(1)
        expect(addCountAfterUpdate).toBe(1) // no extra scene.add on update
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('adds a water mesh when an updated chunk gains water', () => {
      const TestLayer = buildTestLayer()
      const scene = makeScene()
      const chunk = makeChunk(2, 3)

      return Effect.gen(function* () {
        const s = yield* WorldRendererService
        yield* s.syncChunksToScene([chunk], scene)
        const addCountBeforeUpdate = (scene.add as ReturnType<typeof vi.fn>).mock.calls.length
        chunk.blocks[0] = 6
        yield* s.updateChunkInScene(chunk, scene)

        expect((scene.add as ReturnType<typeof vi.fn>).mock.calls.length).toBe(addCountBeforeUpdate + 1)
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('removes a water mesh when an updated chunk loses water', () => {
      const TestLayer = buildTestLayer()
      const scene = makeScene()
      const chunk = makeChunk(4, 4)
      chunk.blocks[0] = 6

      return Effect.gen(function* () {
        const s = yield* WorldRendererService
        yield* s.syncChunksToScene([chunk], scene)
        const removeCountBeforeUpdate = (scene.remove as ReturnType<typeof vi.fn>).mock.calls.length
        chunk.blocks[0] = 0
        yield* s.updateChunkInScene(chunk, scene)

        expect((scene.remove as ReturnType<typeof vi.fn>).mock.calls.length).toBe(removeCountBeforeUpdate + 1)
      }).pipe(Effect.provide(TestLayer))
    })
  })
})

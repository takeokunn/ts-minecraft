import { describe, expect, vi } from 'vitest'
import { it } from '@effect/vitest'
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('infrastructure/three/world-renderer', () => {
  describe('updateChunkInScene — existing water mesh replacement', () => {
    it.effect('updateChunkInScene replaces existing water mesh in scene (exercises onSome oldWaterMesh path)', () => {
      // To reach line 254 (onSome: oldWaterMesh), the chunk must be in meshesRef
      // with water: Option.some(...). Use a custom createChunkMesh that returns a real water
      // mesh on the first call, so syncChunksToScene stores Option.some(waterMesh).
      // Then updateChunkInScene hits existing.water = Option.some → onSome branch fires.
      const waterMesh = makeMockMesh({ x: 0, z: 0 }) as THREE.Mesh
      const createChunkMesh = vi.fn(() =>
        Effect.succeed({
          opaqueMesh: makeMockMesh({ x: 0, z: 0 }) as THREE.Mesh,
          waterMesh: Option.some(waterMesh),
        })
      )
      // Default updateChunkMesh returns w unchanged (Option.some(waterMesh) → same ref)
      const TestLayer = buildTestLayer(createChunkMesh)
      const scene = makeScene()
      const waterChunk = makeChunk(0, 0)
      waterChunk.blocks[0] = 6

      return Effect.gen(function* () {
        const s = yield* WorldRendererService
        // Sync: createChunkMesh returns Option.some(waterMesh) → stored in meshesRef
        yield* drainSync(s, [waterChunk], scene)
        const addCountAfterSync = (scene.add as ReturnType<typeof vi.fn>).mock.calls.length
        expect(addCountAfterSync).toBeGreaterThan(0) // sanity: both meshes added

        // Update: existing.water = Option.some(waterMesh) → onSome branch at line 254 fires
        // updateChunkMesh (default mock) returns same Option.some(waterMesh) → same reference
        // → oldWaterMesh === newWaterMesh → /* c8 ignore */ path → no scene changes
        yield* s.updateChunkInScene(waterChunk, scene)
        // No additional scene.remove/add for the same-reference water mesh
        expect((scene.add as ReturnType<typeof vi.fn>).mock.calls.length).toBe(addCountAfterSync)
      }).pipe(Effect.provide(TestLayer))
    })
  })

  describe('getSceneVersion', () => {
    it.effect('getSceneVersion returns a numeric version counter', () => {
      const TestLayer = buildTestLayer()
      return Effect.gen(function* () {
        const s = yield* WorldRendererService
        const version = yield* s.getSceneVersion()
        expect(typeof version).toBe('number')
      }).pipe(Effect.provide(TestLayer))
    })
  })
})

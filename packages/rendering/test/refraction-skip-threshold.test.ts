// FR-4.4 — refraction pre-pass skip when on-screen water pixel ratio is below the
// preset-resolved threshold. Uses real THREE so the projection math runs end-to-end.
import { describe, expect, vi } from 'vitest'
import { it } from '@effect/vitest'
import { Effect, MutableRef, Ref } from 'effect'
import * as THREE from 'three'
import { createWaterMaterial } from '@ts-minecraft/rendering'
import {
  doRefractionPrePass,
  type RefractionContext,
} from '../infrastructure/renderer/world-renderer-refraction'

const initialLastState = () => ({
  version: -1,
  x: Number.NaN, y: Number.NaN, z: Number.NaN,
  qx: Number.NaN, qy: Number.NaN, qz: Number.NaN, qw: Number.NaN,
  p0: Number.NaN, p5: Number.NaN, p10: Number.NaN, p14: Number.NaN,
})

const makeContext = (waterMeshes: ReadonlyArray<THREE.Mesh>): Effect.Effect<RefractionContext, never> =>
  Effect.gen(function* () {
    const waterMeshesRef = yield* Ref.make(waterMeshes)
    const sceneVersionRef = yield* Ref.make(0)
    return {
      waterMeshesRef,
      sceneVersionRef,
      _savedWaterVisibility: MutableRef.make(new Map<THREE.Mesh, boolean>()),
      _waterMeshCache: MutableRef.make<ReadonlyArray<THREE.Mesh>>([]),
      _lastRefractionState: MutableRef.make(initialLastState()),
      refractionCamera: new THREE.PerspectiveCamera(75, 1, 0.1, 256),
      refractionRT: new THREE.WebGLRenderTarget(400, 300),
      waterMaterial: createWaterMaterial(new THREE.Texture(), 800, 600),
    } satisfies RefractionContext
  })

const makeWaterMesh = (coord: { x: number; z: number }, chunkMaxY: number): THREE.Mesh => {
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial())
  mesh.userData['chunkCoord'] = coord
  mesh.userData['chunkMaxY'] = chunkMaxY
  mesh.visible = true
  return mesh
}

const makeFakeRenderer = (): THREE.WebGLRenderer => ({
  setRenderTarget: vi.fn(),
  render: vi.fn(),
  shadowMap: { autoUpdate: true, needsUpdate: false },
}) as unknown as THREE.WebGLRenderer

// Camera helper: positions the camera at (x, y, z) looking down the -Z axis.
// The -Z look direction matches Three.js default; chunks at +Z relative to camera
// are in front of it (w > 0 after view-transform), -Z chunks are behind (w <= 0).
const placeCamera = (camera: THREE.PerspectiveCamera, x: number, y: number, z: number) => {
  camera.position.set(x, y, z)
  camera.lookAt(x, y, z - 1)
  camera.updateMatrixWorld(true)
}

describe('FR-4.4 — refraction pre-pass screen-ratio skip', () => {
  it.effect('skips when minScreenRatio is positive and water is a tiny on-screen sliver (sub-threshold)', () =>
    Effect.gen(function* () {
      // Camera at (0, 80, 0) looking -Z. Water chunk at coord (-1, -50) → world x∈[-16, 0], z∈[-800, -784].
      // Camera looks at -Z, so chunk is in front → w > 0 for all corners. Distance ~800 blocks
      // through 75deg FOV gives a vanishingly small angular footprint, well below the 0.05 threshold.
      const tinySliverMesh = makeWaterMesh({ x: -1, z: -50 }, 4)
      const ctx = yield* makeContext([tinySliverMesh])
      const renderer = makeFakeRenderer()
      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 4096)
      placeCamera(camera, 0, 80, 0)

      yield* doRefractionPrePass(ctx, renderer, scene, camera, 0.05)

      expect(renderer.render).not.toHaveBeenCalled()
      expect(renderer.setRenderTarget).not.toHaveBeenCalled()
    })
  )

  it.effect('renders when on-screen water footprint exceeds the threshold (fills view)', () =>
    Effect.gen(function* () {
      // Place camera right above a water chunk (1,1) → world x∈[16,32], z∈[16,32]; camera at (24, 80, 24).
      // Looking at -Z covers part of chunk in front; AABB includes corners both behind and
      // in front of camera → near-plane corner triggers conservative ratio=1.
      const closeMesh = makeWaterMesh({ x: 1, z: 1 }, 64)
      const ctx = yield* makeContext([closeMesh])
      const renderer = makeFakeRenderer()
      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 256)
      placeCamera(camera, 24, 80, 24)

      yield* doRefractionPrePass(ctx, renderer, scene, camera, 0.05)

      expect(renderer.render).toHaveBeenCalledTimes(1)
    })
  )

  it.effect('legacy behavior: minScreenRatio=0 disables the gate (always renders when water visible)', () =>
    Effect.gen(function* () {
      // Same far-water setup as the skip test; with minScreenRatio=0 the new gate is bypassed.
      const farMesh = makeWaterMesh({ x: -1, z: -50 }, 4)
      const ctx = yield* makeContext([farMesh])
      const renderer = makeFakeRenderer()
      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 4096)
      placeCamera(camera, 0, 80, 0)

      yield* doRefractionPrePass(ctx, renderer, scene, camera, 0)

      expect(renderer.render).toHaveBeenCalledTimes(1)
    })
  )

  it.effect('high-preset threshold (0.005) keeps frames that low-preset (0.05) would skip', () =>
    Effect.gen(function* () {
      // Mid-distance water sized to land between the two preset thresholds.
      // Chunk (0, -12) → world x∈[0,16], z∈[-192,-176]. Camera at (8, 10, 0) looking -Z.
      // 60deg FOV: NDC x-span ≈ 16/(184·tan30°) ≈ 0.15, NDC y-span ≈ 0.42 (camera y=10 above
      // ground, chunk y=0..48). Clamped area ≈ 0.063 → ratio ≈ 0.016, between 0.005 and 0.05.
      const midMesh = makeWaterMesh({ x: 0, z: -12 }, 48)
      const skipCtx = yield* makeContext([midMesh])
      const keepCtx = yield* makeContext([midMesh])
      const skipRenderer = makeFakeRenderer()
      const keepRenderer = makeFakeRenderer()
      const scene = new THREE.Scene()
      const skipCamera = new THREE.PerspectiveCamera(60, 1, 0.1, 1024)
      const keepCamera = new THREE.PerspectiveCamera(60, 1, 0.1, 1024)
      placeCamera(skipCamera, 8, 10, 0)
      placeCamera(keepCamera, 8, 10, 0)

      // Low preset (0.05): skip
      yield* doRefractionPrePass(skipCtx, skipRenderer, scene, skipCamera, 0.05)
      // High preset (0.005): render
      yield* doRefractionPrePass(keepCtx, keepRenderer, scene, keepCamera, 0.005)

      expect(skipRenderer.render).not.toHaveBeenCalled()
      expect(keepRenderer.render).toHaveBeenCalledTimes(1)
    })
  )

  it.effect('skips early (no rendering) when every water mesh is invisible regardless of threshold', () =>
    Effect.gen(function* () {
      const hiddenMesh = makeWaterMesh({ x: 0, z: 0 }, 64)
      hiddenMesh.visible = false
      const ctx = yield* makeContext([hiddenMesh])
      const renderer = makeFakeRenderer()
      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 256)
      placeCamera(camera, 8, 80, 8)

      // The visible-check guard runs before the screen-ratio gate, so threshold is irrelevant here.
      yield* doRefractionPrePass(ctx, renderer, scene, camera, 0.005)

      expect(renderer.render).not.toHaveBeenCalled()
    })
  )
})

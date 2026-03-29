import { describe, expect, vi } from 'vitest'
import { it } from '@effect/vitest'
import { Array as Arr, Effect, Layer, Option } from 'effect'
import * as THREE from 'three'
import { CHUNK_SIZE, CHUNK_HEIGHT } from '@/domain/chunk'
import type { Chunk, ChunkCoord } from '@/domain/chunk'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TOTAL_BLOCKS = CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT

const makeSingleBlockChunk = (coord: ChunkCoord = { x: 0, z: 0 }): Chunk => {
  const blocks = new Uint8Array(TOTAL_BLOCKS)
  // DIRT index = 1; block at lx=0, y=0, lz=0 → flat index 0
  blocks[0] = 1
  return { coord, blocks, fluid: Option.none() }
}

// ─── Test double: ChunkMeshService built without canvas/DOM ───────────────────
//
// ChunkMeshService.Default calls buildAtlasTexture() which requires a browser
// canvas (document.createElement('canvas')).  The vitest environment is 'node'
// so document is unavailable.
//
// Strategy: build a hand-crafted Effect.Service layer that uses the SAME
// service interface (`createChunkMesh`, `updateChunkMesh`, `disposeMesh`) but
// replaces `buildAtlasTexture` with a plain MeshBasicMaterial — no DOM needed.
// This lets us exercise all the geometry / userData / dispose logic without any
// browser dependency.

import { greedyMeshChunk } from './greedy-meshing'
import { ChunkMeshService } from './chunk-mesh'

/**
 * A test-only layer for ChunkMeshService that avoids any DOM / canvas calls.
 * The shared material is a simple MeshBasicMaterial (no texture required).
 */
const ChunkMeshServiceTest = Layer.succeed(
  ChunkMeshService,
  (() => {
    const sharedMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff })

    const buildGeometry = (chunk: Chunk): THREE.BufferGeometry => {
      const meshed = greedyMeshChunk(chunk, {
        wx: chunk.coord.x * CHUNK_SIZE,
        wz: chunk.coord.z * CHUNK_SIZE,
      })
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.BufferAttribute(meshed.opaque.positions, 3))
      geometry.setAttribute('normal', new THREE.BufferAttribute(meshed.opaque.normals, 3, true))
      geometry.setAttribute('color', new THREE.BufferAttribute(meshed.opaque.colors, 3, true))
      geometry.setAttribute('uv', new THREE.BufferAttribute(meshed.opaque.uvs, 2))
      geometry.setIndex(new THREE.BufferAttribute(meshed.opaque.indices, 1))
      return geometry
    }

    return {
      atlasTexture: {} as THREE.Texture,

      createChunkMesh: (chunk: Chunk): Effect.Effect<{ opaqueMesh: THREE.Mesh; waterMesh: Option.Option<THREE.Mesh> }, never> =>
        Effect.sync(() => {
          const geometry = buildGeometry(chunk)
          const opaqueMesh = new THREE.Mesh(geometry, sharedMaterial)
          opaqueMesh.userData['chunkCoord'] = chunk.coord
          return { opaqueMesh, waterMesh: Option.none() }
        }),

      updateChunkMesh: (opaqueMesh: THREE.Mesh, _waterMesh: Option.Option<THREE.Mesh>, chunk: Chunk): Effect.Effect<Option.Option<THREE.Mesh>, never> =>
        Effect.sync(() => {
          const oldGeometry = opaqueMesh.geometry
          opaqueMesh.geometry = buildGeometry(chunk)
          opaqueMesh.userData['chunkCoord'] = chunk.coord
          oldGeometry.dispose()
          return _waterMesh
        }),

      disposeMesh: (mesh: THREE.Mesh): Effect.Effect<void, never> =>
        Effect.sync(() => {
          mesh.geometry.dispose()
        }),
    } as unknown as ChunkMeshService
  })()
)

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ChunkMeshService', () => {
  describe('createChunkMesh', () => {
    it.effect('returns a THREE.Mesh with userData.chunkCoord matching the input chunk', () => {
      const coord: ChunkCoord = { x: 3, z: 7 }
      const chunk = makeSingleBlockChunk(coord)

      return Effect.gen(function* () {
        const service = yield* ChunkMeshService
        const { opaqueMesh } = yield* service.createChunkMesh(chunk)
        expect(opaqueMesh).toBeInstanceOf(THREE.Mesh)
        expect(opaqueMesh.userData['chunkCoord']).toEqual(coord)
        expect(opaqueMesh.userData['chunkCoord'].x).toBe(3)
        expect(opaqueMesh.userData['chunkCoord'].z).toBe(7)
      }).pipe(Effect.provide(ChunkMeshServiceTest))
    })

    it.effect('returns a Mesh whose geometry is a BufferGeometry', () => {
      const chunk = makeSingleBlockChunk({ x: 0, z: 0 })

      return Effect.gen(function* () {
        const service = yield* ChunkMeshService
        const { opaqueMesh } = yield* service.createChunkMesh(chunk)
        expect(opaqueMesh.geometry).toBeDefined()
        expect(opaqueMesh.geometry).toBeInstanceOf(THREE.BufferGeometry)
      }).pipe(Effect.provide(ChunkMeshServiceTest))
    })

    it.effect('stores correct chunkCoord for a negative coordinate', () => {
      const coord: ChunkCoord = { x: -5, z: -3 }
      const chunk = makeSingleBlockChunk(coord)

      return Effect.gen(function* () {
        const service = yield* ChunkMeshService
        const { opaqueMesh } = yield* service.createChunkMesh(chunk)
        expect(opaqueMesh.userData['chunkCoord']).toEqual(coord)
        expect(opaqueMesh.userData['chunkCoord'].x).toBe(-5)
        expect(opaqueMesh.userData['chunkCoord'].z).toBe(-3)
      }).pipe(Effect.provide(ChunkMeshServiceTest))
    })

    it.effect('applies the world offset from coord to vertex positions', () => {
      // Chunk at coord {x:1,z:0} → wx=16; block at lx=0 so X verts start at 16
      const coord: ChunkCoord = { x: 1, z: 0 }
      const chunk = makeSingleBlockChunk(coord)

      return Effect.gen(function* () {
        const service = yield* ChunkMeshService
        const { opaqueMesh } = yield* service.createChunkMesh(chunk)
        const posAttr = opaqueMesh.geometry.getAttribute('position') as THREE.BufferAttribute
        expect(posAttr).toBeDefined()
        // All X-coordinates should be >= CHUNK_SIZE (16) due to world offset
        Arr.forEach(Arr.makeBy(posAttr.count, i => i), i => {
          expect(posAttr.getX(i)).toBeGreaterThanOrEqual(CHUNK_SIZE)
        })
      }).pipe(Effect.provide(ChunkMeshServiceTest))
    })
  })

  describe('updateChunkMesh', () => {
    it.effect('calls geometry.dispose() on the OLD geometry when updating', () => {
      const chunk = makeSingleBlockChunk({ x: 0, z: 0 })

      return Effect.gen(function* () {
        const service = yield* ChunkMeshService
        const { opaqueMesh } = yield* service.createChunkMesh(chunk)

        // Spy on the OLD geometry's dispose method before calling update
        const oldGeometry = opaqueMesh.geometry
        const disposeSpy = vi.spyOn(oldGeometry, 'dispose')

        yield* service.updateChunkMesh(opaqueMesh, Option.none(), chunk)

        expect(disposeSpy).toHaveBeenCalledOnce()
      }).pipe(Effect.provide(ChunkMeshServiceTest))
    })

    it.effect('replaces the geometry object reference after update', () => {
      const chunk = makeSingleBlockChunk({ x: 0, z: 0 })

      return Effect.gen(function* () {
        const service = yield* ChunkMeshService
        const { opaqueMesh } = yield* service.createChunkMesh(chunk)
        const oldGeometry = opaqueMesh.geometry

        yield* service.updateChunkMesh(opaqueMesh, Option.none(), chunk)

        expect(opaqueMesh.geometry).not.toBe(oldGeometry)
        expect(opaqueMesh.geometry).toBeInstanceOf(THREE.BufferGeometry)
      }).pipe(Effect.provide(ChunkMeshServiceTest))
    })

    it.effect('updates userData.chunkCoord to the new chunk coord', () => {
      const coord1: ChunkCoord = { x: 1, z: 2 }
      const coord2: ChunkCoord = { x: 9, z: 5 }
      const chunk1 = makeSingleBlockChunk(coord1)
      const chunk2 = makeSingleBlockChunk(coord2)

      return Effect.gen(function* () {
        const service = yield* ChunkMeshService
        const { opaqueMesh } = yield* service.createChunkMesh(chunk1)
        expect(opaqueMesh.userData['chunkCoord']).toEqual(coord1)

        yield* service.updateChunkMesh(opaqueMesh, Option.none(), chunk2)
        expect(opaqueMesh.userData['chunkCoord']).toEqual(coord2)
      }).pipe(Effect.provide(ChunkMeshServiceTest))
    })
  })

  describe('disposeMesh', () => {
    it.effect('calls geometry.dispose() on the mesh geometry', () => {
      const chunk = makeSingleBlockChunk({ x: 0, z: 0 })

      return Effect.gen(function* () {
        const service = yield* ChunkMeshService
        const { opaqueMesh } = yield* service.createChunkMesh(chunk)

        const disposeSpy = vi.spyOn(opaqueMesh.geometry, 'dispose')
        yield* service.disposeMesh(opaqueMesh)

        expect(disposeSpy).toHaveBeenCalledOnce()
      }).pipe(Effect.provide(ChunkMeshServiceTest))
    })

    it.effect('calling disposeMesh twice calls geometry.dispose() twice', () => {
      const chunk = makeSingleBlockChunk({ x: 0, z: 0 })

      return Effect.gen(function* () {
        const service = yield* ChunkMeshService
        const { opaqueMesh } = yield* service.createChunkMesh(chunk)

        const disposeSpy = vi.spyOn(opaqueMesh.geometry, 'dispose')
        yield* service.disposeMesh(opaqueMesh)
        yield* service.disposeMesh(opaqueMesh)

        expect(disposeSpy).toHaveBeenCalledTimes(2)
      }).pipe(Effect.provide(ChunkMeshServiceTest))
    })
  })

  describe('service interface', () => {
    it.effect('exposes createChunkMesh, updateChunkMesh, and disposeMesh functions', () =>
      Effect.gen(function* () {
        const service = yield* ChunkMeshService
        expect(typeof service.createChunkMesh).toBe('function')
        expect(typeof service.updateChunkMesh).toBe('function')
        expect(typeof service.disposeMesh).toBe('function')
      }).pipe(Effect.provide(ChunkMeshServiceTest))
    )
  })
})

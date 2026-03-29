import { describe, it } from '@effect/vitest'
import { expect, vi, beforeEach, afterEach } from 'vitest'
import { Effect } from 'effect'
import * as THREE from 'three'
import { BlockMeshService, BlockMeshServiceLive } from './block-mesh'

describe('three/meshing/block-mesh', () => {
  beforeEach(() => {
    vi.stubGlobal('document', {
      createElement: vi.fn((tag: string) => {
        if (tag === 'canvas') {
          return {
            width: 64,
            height: 64,
            getContext: (contextType: string) => {
              if (contextType === '2d') {
                return {
                  fillStyle: '#ffffff',
                  fillRect: () => {},
                }
              }
              return null
            },
          } as unknown as HTMLCanvasElement
        }
        return {} as any
      }),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('BlockMeshServiceLive', () => {
    const layer = BlockMeshServiceLive

    it('should provide BlockMeshService as Layer', () => {
      const serviceLayer = BlockMeshServiceLive

      expect(serviceLayer).toBeDefined()
      expect(typeof serviceLayer).toBe('object')
    })

    it.effect('should have createSolidBlockMesh, getSharedGeometry, disposeMesh, and disposeAll methods', () =>
      Effect.gen(function* () {
        const service = yield* BlockMeshService

        expect(typeof service.createSolidBlockMesh).toBe('function')
        expect(typeof service.getSharedGeometry).toBe('function')
        expect(typeof service.disposeMesh).toBe('function')
        expect(typeof service.disposeAll).toBe('function')
      }).pipe(Effect.provide(layer))
    )

    describe('createSolidBlockMesh', () => {
      it.effect('should create colored mesh', () =>
        Effect.gen(function* () {
          const service = yield* BlockMeshService

          const position = new THREE.Vector3(0, 0, 0)
          const mesh = yield* service.createSolidBlockMesh('#ff0000', position)

          expect(mesh).toBeDefined()
          expect(mesh).toBeInstanceOf(THREE.Mesh)
          expect(mesh.geometry).toBeInstanceOf(THREE.BoxGeometry)
        }).pipe(Effect.provide(layer))
      )

      it.effect('should set mesh position correctly', () =>
        Effect.gen(function* () {
          const service = yield* BlockMeshService

          const position = new THREE.Vector3(5, 10, 15)
          const mesh = yield* service.createSolidBlockMesh('#00ff00', position)

          expect(mesh.position.x).toBe(5)
          expect(mesh.position.y).toBe(10)
          expect(mesh.position.z).toBe(15)
        }).pipe(Effect.provide(layer))
      )

      it.effect('should create mesh from number color', () =>
        Effect.gen(function* () {
          const service = yield* BlockMeshService

          const position = new THREE.Vector3(0, 0, 0)
          const mesh = yield* service.createSolidBlockMesh(0x0000ff, position)

          expect(mesh).toBeDefined()
          expect(mesh).toBeInstanceOf(THREE.Mesh)
        }).pipe(Effect.provide(layer))
      )
    })

    describe('getSharedGeometry', () => {
      it.effect('should return shared BoxGeometry', () =>
        Effect.gen(function* () {
          const service = yield* BlockMeshService

          const geometry = yield* service.getSharedGeometry()

          expect(geometry).toBeDefined()
          expect(geometry).toBeInstanceOf(THREE.BoxGeometry)

          const secondGeometry = yield* service.getSharedGeometry()
          expect(geometry).toBe(secondGeometry)
        }).pipe(Effect.provide(layer))
      )
    })

    describe('material cache', () => {
      it.effect('should prevent duplicate material creation', () =>
        Effect.gen(function* () {
          const service = yield* BlockMeshService

          const position1 = new THREE.Vector3(0, 0, 0)
          const position2 = new THREE.Vector3(1, 0, 0)

          const mesh1 = yield* service.createSolidBlockMesh('#ff0000', position1)
          const mesh2 = yield* service.createSolidBlockMesh('#ff0000', position2)

          expect(mesh1.material).toBe(mesh2.material)
        }).pipe(Effect.provide(layer))
      )

      it.effect('should create different materials for different colors', () =>
        Effect.gen(function* () {
          const service = yield* BlockMeshService

          const position1 = new THREE.Vector3(0, 0, 0)
          const position2 = new THREE.Vector3(1, 0, 0)

          const mesh1 = yield* service.createSolidBlockMesh('#ff0000', position1)
          const mesh2 = yield* service.createSolidBlockMesh('#00ff00', position2)

          expect(mesh1.material).not.toBe(mesh2.material)
        }).pipe(Effect.provide(layer))
      )
    })

    describe('disposeMesh', () => {
      it.effect('should dispose material but not shared geometry', () =>
        Effect.gen(function* () {
          const service = yield* BlockMeshService

          const position = new THREE.Vector3(0, 0, 0)
          const mesh = yield* service.createSolidBlockMesh('#ff0000', position)

          const geometryBefore = mesh.geometry

          yield* service.disposeMesh(mesh)

          expect(mesh.geometry).toBe(geometryBefore)
        }).pipe(Effect.provide(layer))
      )
    })

    describe('disposeAll', () => {
      it.effect('should clear material cache', () =>
        Effect.gen(function* () {
          const service = yield* BlockMeshService

          const position1 = new THREE.Vector3(0, 0, 0)
          const position2 = new THREE.Vector3(1, 0, 0)

          yield* service.createSolidBlockMesh('#ff0000', position1)
          yield* service.createSolidBlockMesh('#00ff00', position2)

          yield* service.disposeAll()
        }).pipe(Effect.provide(layer))
      )
    })
  })
})

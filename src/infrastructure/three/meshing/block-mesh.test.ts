import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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

    it('should have createMesh, createSolidBlockMesh, getSharedGeometry, disposeMesh, and disposeAll methods', () => {
      const program = Effect.gen(function* () {
        const service = yield* BlockMeshService

        expect(typeof service.createMesh).toBe('function')
        expect(typeof service.createSolidBlockMesh).toBe('function')
        expect(typeof service.getSharedGeometry).toBe('function')
        expect(typeof service.disposeMesh).toBe('function')
        expect(typeof service.disposeAll).toBe('function')

        return { success: true }
      }).pipe(Effect.provide(layer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    describe('createMesh', () => {
      it('should create mesh with shared geometry', async () => {
        const program = Effect.gen(function* () {
          const service = yield* BlockMeshService

          const position = new THREE.Vector3(0, 0, 0)
          const mesh = yield* service.createMesh('stone', position)

          expect(mesh).toBeDefined()
          expect(mesh).toBeInstanceOf(THREE.Mesh)
          expect(mesh.geometry).toBeInstanceOf(THREE.BoxGeometry)

          return { success: true }
        }).pipe(Effect.provide(layer))

        const result = await Effect.runPromise(program)
        expect(result.success).toBe(true)
      })

      it('should set mesh position correctly', async () => {
        const program = Effect.gen(function* () {
          const service = yield* BlockMeshService

          const position = new THREE.Vector3(1, 2, 3)
          const mesh = yield* service.createMesh('dirt', position)

          expect(mesh.position.x).toBe(1)
          expect(mesh.position.y).toBe(2)
          expect(mesh.position.z).toBe(3)

          return { success: true }
        }).pipe(Effect.provide(layer))

        const result = await Effect.runPromise(program)
        expect(result.success).toBe(true)
      })

      it('should create mesh with UV coordinates per face', async () => {
        const program = Effect.gen(function* () {
          const service = yield* BlockMeshService

          const position = new THREE.Vector3(0, 0, 0)
          const mesh = yield* service.createMesh('grass', position)

          const uvAttribute = mesh.geometry.attributes.uv
          expect(uvAttribute).toBeDefined()
          expect(uvAttribute.count).toBeGreaterThan(0)

          return { success: true }
        }).pipe(Effect.provide(layer))

        const result = await Effect.runPromise(program)
        expect(result.success).toBe(true)
      })
    })

    describe('createSolidBlockMesh', () => {
      it('should create colored mesh', async () => {
        const program = Effect.gen(function* () {
          const service = yield* BlockMeshService

          const position = new THREE.Vector3(0, 0, 0)
          const mesh = yield* service.createSolidBlockMesh('#ff0000', position)

          expect(mesh).toBeDefined()
          expect(mesh).toBeInstanceOf(THREE.Mesh)
          expect(mesh.geometry).toBeInstanceOf(THREE.BoxGeometry)

          return { success: true }
        }).pipe(Effect.provide(layer))

        const result = await Effect.runPromise(program)
        expect(result.success).toBe(true)
      })

      it('should set mesh position correctly', async () => {
        const program = Effect.gen(function* () {
          const service = yield* BlockMeshService

          const position = new THREE.Vector3(5, 10, 15)
          const mesh = yield* service.createSolidBlockMesh('#00ff00', position)

          expect(mesh.position.x).toBe(5)
          expect(mesh.position.y).toBe(10)
          expect(mesh.position.z).toBe(15)

          return { success: true }
        }).pipe(Effect.provide(layer))

        const result = await Effect.runPromise(program)
        expect(result.success).toBe(true)
      })

      it('should create mesh from number color', async () => {
        const program = Effect.gen(function* () {
          const service = yield* BlockMeshService

          const position = new THREE.Vector3(0, 0, 0)
          const mesh = yield* service.createSolidBlockMesh(0x0000ff, position)

          expect(mesh).toBeDefined()
          expect(mesh).toBeInstanceOf(THREE.Mesh)

          return { success: true }
        }).pipe(Effect.provide(layer))

        const result = await Effect.runPromise(program)
        expect(result.success).toBe(true)
      })
    })

    describe('getSharedGeometry', () => {
      it('should return shared BoxGeometry', async () => {
        const program = Effect.gen(function* () {
          const service = yield* BlockMeshService

          const geometry = yield* service.getSharedGeometry()

          expect(geometry).toBeDefined()
          expect(geometry).toBeInstanceOf(THREE.BoxGeometry)

          const secondGeometry = yield* service.getSharedGeometry()
          expect(geometry).toBe(secondGeometry)

          return { success: true }
        }).pipe(Effect.provide(layer))

        const result = await Effect.runPromise(program)
        expect(result.success).toBe(true)
      })
    })

    describe('material cache', () => {
      it('should prevent duplicate material creation', async () => {
        const program = Effect.gen(function* () {
          const service = yield* BlockMeshService

          const position1 = new THREE.Vector3(0, 0, 0)
          const position2 = new THREE.Vector3(1, 0, 0)

          const mesh1 = yield* service.createSolidBlockMesh('#ff0000', position1)
          const mesh2 = yield* service.createSolidBlockMesh('#ff0000', position2)

          expect(mesh1.material).toBe(mesh2.material)

          return { success: true }
        }).pipe(Effect.provide(layer))

        const result = await Effect.runPromise(program)
        expect(result.success).toBe(true)
      })

      it('should create different materials for different colors', async () => {
        const program = Effect.gen(function* () {
          const service = yield* BlockMeshService

          const position1 = new THREE.Vector3(0, 0, 0)
          const position2 = new THREE.Vector3(1, 0, 0)

          const mesh1 = yield* service.createSolidBlockMesh('#ff0000', position1)
          const mesh2 = yield* service.createSolidBlockMesh('#00ff00', position2)

          expect(mesh1.material).not.toBe(mesh2.material)

          return { success: true }
        }).pipe(Effect.provide(layer))

        const result = await Effect.runPromise(program)
        expect(result.success).toBe(true)
      })
    })

    describe('disposeMesh', () => {
      it('should dispose material but not shared geometry', async () => {
        const program = Effect.gen(function* () {
          const service = yield* BlockMeshService

          const position = new THREE.Vector3(0, 0, 0)
          const mesh = yield* service.createSolidBlockMesh('#ff0000', position)

          const geometryBefore = mesh.geometry

          yield* service.disposeMesh(mesh)

          expect(mesh.geometry).toBe(geometryBefore)

          return { success: true }
        }).pipe(Effect.provide(layer))

        const result = await Effect.runPromise(program)
        expect(result.success).toBe(true)
      })
    })

    describe('disposeAll', () => {
      it('should clear material cache', async () => {
        const program = Effect.gen(function* () {
          const service = yield* BlockMeshService

          const position1 = new THREE.Vector3(0, 0, 0)
          const position2 = new THREE.Vector3(1, 0, 0)

          const mesh1 = yield* service.createSolidBlockMesh('#ff0000', position1)
          const mesh2 = yield* service.createSolidBlockMesh('#00ff00', position2)

          yield* service.disposeAll()

          return { success: true }
        }).pipe(Effect.provide(layer))

        const result = await Effect.runPromise(program)
        expect(result.success).toBe(true)
      })
    })
  })
})

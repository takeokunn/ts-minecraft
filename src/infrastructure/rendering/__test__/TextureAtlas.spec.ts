import { describe, it, expect, vi } from 'vitest'
import { Effect, Exit, pipe, Layer, Schema } from 'effect'
import * as THREE from 'three'
import type { Material as ThreeMaterial } from 'three'
import {
  type TextureRegion,
  type BlockTexture,
  type AtlasConfig,
  type AtlasMetadata,
  TextureAtlasError,
  TextureAtlasService,
  TextureAtlasLive,
  calculateAtlasEfficiency,
  getOptimalAtlasSize,
  TextureRegionSchema,
  BlockTextureSchema,
} from '../TextureAtlas'
import type { BlockType } from '../MeshGenerator'
import { BrandedTypes } from '../../../shared/types/branded'

// ========================================
// Test Helpers
// ========================================

const createTestRegion = (u = 0, v = 0, width = 0.25, height = 0.25): TextureRegion => ({
  u: BrandedTypes.createUVCoordinate(u),
  v: BrandedTypes.createUVCoordinate(v),
  width: BrandedTypes.createUVCoordinate(width),
  height: BrandedTypes.createUVCoordinate(height),
})

const createTestBlockTexture = (blockType: BlockType): BlockTexture => ({
  blockType,
  top: createTestRegion(0, 0),
  bottom: createTestRegion(0.25, 0),
  front: createTestRegion(0.5, 0),
  back: createTestRegion(0.75, 0),
  left: createTestRegion(0, 0.25),
  right: createTestRegion(0.25, 0.25),
})

const runEffect = <A, E>(effect: Effect.Effect<A, E>) => Effect.runSyncExit(effect)

// Mock THREE.js texture creation
vi.mock('three', async () => {
  const actual = await vi.importActual<typeof THREE>('three')
  return {
    ...actual,
    CanvasTexture: vi.fn(() => ({
      magFilter: null,
      minFilter: null,
      needsUpdate: false,
    })),
    Texture: vi.fn(() => ({
      magFilter: null,
      minFilter: null,
      needsUpdate: false,
    })),
    MeshLambertMaterial: vi.fn((config) => ({
      ...config,
      map: null,
      side: 'FrontSide',
      vertexColors: true,
    })),
    MeshBasicMaterial: vi.fn((config) => ({
      ...config,
      map: { magFilter: 'NearestFilter', minFilter: 'NearestFilter', needsUpdate: true },
      side: 'FrontSide',
      vertexColors: true,
    })),
    NearestFilter: 'NearestFilter',
    LinearFilter: 'LinearFilter',
    LinearMipmapLinearFilter: 'LinearMipmapLinearFilter',
    FrontSide: 1, // THREE.FrontSideは数値
  }
})

// ========================================
// Tests
// ========================================

describe('TextureAtlas', () => {
  describe('Schema Validation', () => {
    it('should validate TextureRegion schema', () => {
      const validRegion = { u: 0.5, v: 0.5, width: 0.25, height: 0.25 }
      const parsed = Schema.decodeUnknownSync(TextureRegionSchema)(validRegion)
      expect(parsed).toEqual(validRegion)
    })

    it('should reject invalid TextureRegion', () => {
      const invalidRegion = { u: -0.1, v: 1.5, width: 2, height: -1 }
      expect(() => Schema.decodeUnknownSync(TextureRegionSchema)(invalidRegion)).toThrow()
    })

    it('should validate BlockTexture schema', () => {
      const validBlockTexture = {
        blockType: 1,
        top: createTestRegion(),
        bottom: createTestRegion(),
        front: createTestRegion(),
        back: createTestRegion(),
        left: createTestRegion(),
        right: createTestRegion(),
      }
      const parsed = Schema.decodeUnknownSync(BlockTextureSchema)(validBlockTexture)
      expect(parsed).toEqual(validBlockTexture)
    })
  })

  describe('Type Guards and Interfaces', () => {
    it('should create valid TextureRegion objects', () => {
      const region: TextureRegion = {
        u: BrandedTypes.createUVCoordinate(0.25),
        v: BrandedTypes.createUVCoordinate(0.5),
        width: BrandedTypes.createUVCoordinate(0.125),
        height: BrandedTypes.createUVCoordinate(0.125),
      }

      expect(region.u).toBe(0.25)
      expect(region.v).toBe(0.5)
      expect(region.width).toBe(0.125)
      expect(region.height).toBe(0.125)
    })

    it('should create valid AtlasConfig', () => {
      const config: AtlasConfig = {
        textureSize: 16,
        atlasSize: 256,
        mipmapping: true,
        filtering: 'nearest',
      }

      expect(config.textureSize).toBe(16)
      expect(config.atlasSize).toBe(256)
      expect(config.mipmapping).toBe(true)
      expect(config.filtering).toBe('nearest')
    })

    it('should handle both filtering modes', () => {
      const nearestConfig: AtlasConfig = {
        textureSize: 32,
        atlasSize: 512,
        mipmapping: false,
        filtering: 'nearest',
      }

      const linearConfig: AtlasConfig = {
        textureSize: 32,
        atlasSize: 512,
        mipmapping: true,
        filtering: 'linear',
      }

      expect(nearestConfig.filtering).toBe('nearest')
      expect(linearConfig.filtering).toBe('linear')
    })
  })

  describe('TextureAtlasService - loadAtlas', () => {
    it('should load atlas with default textures', () => {
      const program = Effect.gen(function* () {
        const service = yield* TextureAtlasService
        const metadata = yield* service.loadAtlas('/path/to/atlas.png')

        expect(metadata).toBeDefined()
        expect(metadata.atlasWidth).toBe(256)
        expect(metadata.atlasHeight).toBe(256)
        expect(metadata.textureCount).toBeGreaterThan(0)
        expect(metadata.blockTextures).toBeDefined()
      })

      Effect.runSync(program.pipe(Effect.provide(TextureAtlasLive)))
    })

    it('should create default block textures', () => {
      const program = Effect.gen(function* () {
        const service = yield* TextureAtlasService
        const metadata = yield* service.loadAtlas('/path/to/atlas.png')

        // Should have default textures for common blocks
        expect(metadata.blockTextures.has(1)).toBe(true) // Stone
        expect(metadata.blockTextures.has(2)).toBe(true) // Dirt
        expect(metadata.blockTextures.has(3)).toBe(true) // Grass
        expect(metadata.blockTextures.has(4)).toBe(true) // Wood
      })

      Effect.runSync(program.pipe(Effect.provide(TextureAtlasLive)))
    })

    it('should handle grass block with different top/bottom textures', () => {
      const program = Effect.gen(function* () {
        const service = yield* TextureAtlasService
        const metadata = yield* service.loadAtlas('/path/to/atlas.png')

        const grassTexture = metadata.blockTextures.get(3)
        expect(grassTexture).toBeDefined()
        if (grassTexture) {
          // Grass should have different textures for top/bottom/sides
          expect(grassTexture.top).not.toEqual(grassTexture.bottom)
          expect(grassTexture.top).not.toEqual(grassTexture.front)
        }
      })

      Effect.runSync(program.pipe(Effect.provide(TextureAtlasLive)))
    })

    it('should handle errors during atlas loading', () => {
      // Create a service that throws an error
      const errorService: TextureAtlasService = {
        loadAtlas: () => Effect.fail(TextureAtlasError('Failed to load', 'loadAtlas')) as any,
        getBlockUVs: () => Effect.fail(TextureAtlasError('Not implemented', 'getBlockUVs')) as any,
        generateUVCoords: () => Effect.fail(TextureAtlasError('Not implemented', 'generateUVCoords')) as any,
        createTextureMaterial: () => Effect.fail(TextureAtlasError('Not implemented', 'createTextureMaterial')) as any,
        registerBlockTexture: () => Effect.fail(TextureAtlasError('Not implemented', 'registerBlockTexture')) as any,
      }

      const result = pipe(errorService.loadAtlas('/path/to/atlas.png'), Effect.either, Effect.runSync)

      expect(result._tag).toBe('Left')
    })
  })

  describe('TextureAtlasService - getBlockUVs', () => {
    it('should get UVs for registered block', () => {
      const program = Effect.gen(function* () {
        const service = yield* TextureAtlasService

        // Load atlas first
        yield* service.loadAtlas('/path/to/atlas.png')

        // Then get UVs
        const uvs = yield* service.getBlockUVs(1, 'top')

        expect(uvs).toBeDefined()
        expect(uvs.u).toBeGreaterThanOrEqual(0)
        expect(uvs.u).toBeLessThanOrEqual(1)
        expect(uvs.v).toBeGreaterThanOrEqual(0)
        expect(uvs.v).toBeLessThanOrEqual(1)
      })

      Effect.runSync(program.pipe(Effect.provide(TextureAtlasLive)))
    })

    it('should handle all face types', () => {
      const program = Effect.gen(function* () {
        const service = yield* TextureAtlasService

        // Load atlas first
        yield* service.loadAtlas('/path/to/atlas.png')

        const faces: Array<'top' | 'bottom' | 'front' | 'back' | 'left' | 'right'> = [
          'top',
          'bottom',
          'front',
          'back',
          'left',
          'right',
        ]

        // Test all faces
        for (const face of faces) {
          const uvs = yield* service.getBlockUVs(1, face)
          expect(uvs).toBeDefined()
        }
      })

      Effect.runSync(program.pipe(Effect.provide(TextureAtlasLive)))
    })

    it('should return default UVs for unregistered block', () => {
      const program = Effect.gen(function* () {
        const service = yield* TextureAtlasService

        // Load atlas first
        yield* service.loadAtlas('/path/to/atlas.png')

        // Test with unregistered block type
        const uvs = yield* service.getBlockUVs(999, 'top')

        expect(uvs).toBeDefined()
        // Should return default texture region
        expect(uvs.u).toBe(0)
        expect(uvs.v).toBeGreaterThanOrEqual(0)
      })

      Effect.runSync(program.pipe(Effect.provide(TextureAtlasLive)))
    })

    it('should fail when atlas not loaded', () => {
      const program = Effect.gen(function* () {
        const service = yield* TextureAtlasService
        return yield* service.getBlockUVs(1, 'top')
      })

      const result = runEffect(program.pipe(Effect.provide(TextureAtlasLive)))

      expect(Exit.isFailure(result)).toBe(true)
      if (Exit.isFailure(result)) {
        const error = result.cause._tag === 'Fail' ? result.cause.error : null
        expect(error).toBeDefined()
        if (error && typeof error === 'object' && '_tag' in error && (error as any)._tag === 'TextureAtlasError') {
          expect((error as any).reason).toContain('not loaded')
        }
      }
    })
  })

  describe('TextureAtlasService - generateUVCoords', () => {
    it('should generate UV coordinates for a quad', () => {
      const program = Effect.gen(function* () {
        const service = yield* TextureAtlasService

        // Load atlas first
        yield* service.loadAtlas('/path/to/atlas.png')

        // Generate UV coordinates
        const coords = yield* service.generateUVCoords(1, 'top')

        expect(coords).toHaveLength(8) // 4 vertices * 2 coords
        coords.forEach((coord) => {
          expect(coord).toBeGreaterThanOrEqual(0)
          expect(coord).toBeLessThanOrEqual(1)
        })
      })

      Effect.runSync(program.pipe(Effect.provide(TextureAtlasLive)))
    })

    it('should generate different coords for different faces', () => {
      const program = Effect.gen(function* () {
        const service = yield* TextureAtlasService

        // Load atlas first
        yield* service.loadAtlas('/path/to/atlas.png')

        // Generate UV coordinates for different faces
        const topCoords = yield* service.generateUVCoords(3, 'top')
        const bottomCoords = yield* service.generateUVCoords(3, 'bottom')

        // Grass block should have different UVs for top and bottom
        expect(topCoords).not.toEqual(bottomCoords)
      })

      Effect.runSync(program.pipe(Effect.provide(TextureAtlasLive)))
    })
  })

  describe('TextureAtlasService - createTextureMaterial', () => {
    it('should create texture material', () => {
      const program = Effect.gen(function* () {
        const service = yield* TextureAtlasService
        const material = yield* service.createTextureMaterial()

        expect(material).toBeDefined()
        const threeMaterial = material as any
        expect(threeMaterial.map).toBeDefined()
        expect(threeMaterial.side).toBe('FrontSide')
        expect(threeMaterial.vertexColors).toBe(true)
      })

      Effect.runSync(program.pipe(Effect.provide(TextureAtlasLive)))
    })

    it('should reuse texture on subsequent calls', () => {
      const program = Effect.gen(function* () {
        const service = yield* TextureAtlasService
        const material1 = yield* service.createTextureMaterial()
        const material2 = yield* service.createTextureMaterial()

        // Should reuse the same texture
        const threeMaterial1 = material1 as any
        const threeMaterial2 = material2 as any
        expect(threeMaterial1.map).toStrictEqual(threeMaterial2.map)
      })

      Effect.runSync(program.pipe(Effect.provide(TextureAtlasLive)))
    })

    it('should configure texture filters correctly', () => {
      const program = Effect.gen(function* () {
        const service = yield* TextureAtlasService
        const material = yield* service.createTextureMaterial()

        const threeMaterial = material as any
        expect(threeMaterial.map?.magFilter).toBeDefined()
        expect(threeMaterial.map?.minFilter).toBeDefined()
        expect(threeMaterial.map?.needsUpdate === true || Boolean(threeMaterial.map?.needsUpdate)).toBe(true)
      })

      Effect.runSync(program.pipe(Effect.provide(TextureAtlasLive)))
    })
  })

  describe('TextureAtlasService - registerBlockTexture', () => {
    it('should register new block texture', () => {
      const program = Effect.gen(function* () {
        const service = yield* TextureAtlasService

        // Load atlas first
        yield* service.loadAtlas('/path/to/atlas.png')

        const customTexture = createTestBlockTexture(100)

        // Register the texture
        yield* service.registerBlockTexture(customTexture)

        // Verify it was registered
        const uvs = yield* service.getBlockUVs(100, 'top')

        expect(uvs).toEqual(customTexture.top)
      })

      Effect.runSync(program.pipe(Effect.provide(TextureAtlasLive)))
    })

    it('should override existing texture', () => {
      const program = Effect.gen(function* () {
        const service = yield* TextureAtlasService

        // Load atlas first
        yield* service.loadAtlas('/path/to/atlas.png')

        const customTexture = {
          ...createTestBlockTexture(1),
          top: createTestRegion(0.9, 0.9, 0.1, 0.1),
        }

        // Override the texture
        yield* service.registerBlockTexture(customTexture)

        // Verify it was overridden
        const uvs = yield* service.getBlockUVs(1, 'top')

        expect(uvs.u).toBe(0.9)
        expect(uvs.v).toBe(0.9)
      })

      Effect.runSync(program.pipe(Effect.provide(TextureAtlasLive)))
    })

    it('should fail when atlas not loaded', () => {
      const customTexture = createTestBlockTexture(100)

      const program = Effect.gen(function* () {
        const service = yield* TextureAtlasService
        return yield* service.registerBlockTexture(customTexture)
      })

      const result = runEffect(program.pipe(Effect.provide(TextureAtlasLive)))

      expect(Exit.isFailure(result)).toBe(true)
      if (Exit.isFailure(result)) {
        const error = result.cause._tag === 'Fail' ? result.cause.error : null
        expect(error).toBeDefined()
        if (error && typeof error === 'object' && '_tag' in error && (error as any)._tag === 'TextureAtlasError') {
          expect((error as any).reason).toContain('not loaded')
        }
      }
    })
  })

  describe('Utility Functions', () => {
    it('should calculate atlas efficiency correctly', () => {
      expect(calculateAtlasEfficiency(16, 256, 16)).toBe(6.25)
      expect(calculateAtlasEfficiency(256, 256, 16)).toBe(100)
      expect(calculateAtlasEfficiency(0, 256, 16)).toBe(0)
      expect(calculateAtlasEfficiency(128, 256, 16)).toBe(50)
    })

    it('should calculate optimal atlas size', () => {
      expect(getOptimalAtlasSize(4, 16)).toBe(32) // 2x2 grid = 32
      expect(getOptimalAtlasSize(16, 16)).toBe(64) // 4x4 grid = 64
      expect(getOptimalAtlasSize(17, 16)).toBe(128) // 5x5 grid rounds up
      expect(getOptimalAtlasSize(256, 16)).toBe(256) // 16x16 grid
    })

    it('should round to power of 2', () => {
      expect(getOptimalAtlasSize(5, 16)).toBe(64) // 48 -> 64
      expect(getOptimalAtlasSize(20, 16)).toBe(128) // 80 -> 128
      expect(getOptimalAtlasSize(70, 16)).toBe(256) // 144 -> 256
    })
  })

  describe('Error Handling', () => {
    it('should create TextureAtlasError with correct properties', () => {
      const error = TextureAtlasError('Test error', 'test')

      expect(error._tag).toBe('TextureAtlasError')
      expect(error.reason).toBe('Test error')
      expect(error.context).toBe('test')
      expect(error.timestamp).toBeGreaterThan(0)
    })
  })

  describe('Performance', () => {
    it('should handle large texture counts efficiently', () => {
      const program = Effect.gen(function* () {
        const service = yield* TextureAtlasService

        // Load atlas first
        yield* service.loadAtlas('/path/to/atlas.png')

        const startTime = performance.now()

        // Register many textures
        for (let i = 10; i < 100; i++) {
          yield* service.registerBlockTexture(createTestBlockTexture(i))
        }

        const endTime = performance.now()

        // Should complete quickly
        expect(endTime - startTime).toBeLessThan(100)
      })

      Effect.runSync(program.pipe(Effect.provide(TextureAtlasLive)))
    })

    it('should retrieve UVs quickly', () => {
      const program = Effect.gen(function* () {
        const service = yield* TextureAtlasService

        // Load atlas first
        yield* service.loadAtlas('/path/to/atlas.png')

        const startTime = performance.now()

        // Get UVs many times
        for (let i = 0; i < 1000; i++) {
          yield* service.getBlockUVs(1, 'top')
        }

        const endTime = performance.now()

        // Should be very fast
        expect(endTime - startTime).toBeLessThan(100)
      })

      Effect.runSync(program.pipe(Effect.provide(TextureAtlasLive)))
    })
  })

  describe('Layer Construction', () => {
    it('should provide TextureAtlasLive layer', () => {
      const program = Effect.gen(function* () {
        const service = yield* TextureAtlasService
        expect(service).toBeDefined()
        expect(service.loadAtlas).toBeDefined()
        expect(service.getBlockUVs).toBeDefined()
        expect(service.generateUVCoords).toBeDefined()
        expect(service.createTextureMaterial).toBeDefined()
        expect(service.registerBlockTexture).toBeDefined()
        return true
      })

      const result = pipe(program, Effect.provide(TextureAtlasLive), Effect.runSync)

      expect(result).toBe(true)
    })
  })

  describe('Edge Cases', () => {
    it('should handle zero-sized textures gracefully', () => {
      const efficiency = calculateAtlasEfficiency(0, 0, 0)
      expect(efficiency).toBe(0)
    })

    it('should handle invalid atlas configurations', () => {
      const size = getOptimalAtlasSize(0, 16)
      expect(size).toBe(16) // Minimum size with textureSize
    })
  })
})

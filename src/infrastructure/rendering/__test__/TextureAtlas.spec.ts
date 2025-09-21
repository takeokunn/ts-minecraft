import { describe, it, expect, vi } from 'vitest'
import { Effect, Exit, pipe, Layer } from 'effect'
import * as THREE from 'three'
import {
  TextureRegion,
  BlockTexture,
  AtlasConfig,
  AtlasMetadata,
  TextureAtlasError,
  TextureAtlasService,
  TextureAtlasLive,
  calculateAtlasEfficiency,
  getOptimalAtlasSize,
  TextureRegionSchema,
  BlockTextureSchema,
} from '../TextureAtlas'
import type { BlockType } from '../MeshGenerator'

// ========================================
// Test Helpers
// ========================================

const createTestRegion = (u = 0, v = 0, width = 0.25, height = 0.25): TextureRegion => ({
  u,
  v,
  width,
  height,
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

const runEffect = <A, E>(effect: Effect.Effect<A, E>) =>
  Effect.runSyncExit(effect)

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
    MeshLambertMaterial: vi.fn((config) => config),
    NearestFilter: 'NearestFilter',
    LinearFilter: 'LinearFilter',
    LinearMipmapLinearFilter: 'LinearMipmapLinearFilter',
    FrontSide: 'FrontSide',
  }
})

// ========================================
// Tests
// ========================================

describe('TextureAtlas', () => {
  describe('Schema Validation', () => {
    it('should validate TextureRegion schema', () => {
      const validRegion = { u: 0.5, v: 0.5, width: 0.25, height: 0.25 }
      const parsed = TextureRegionSchema.decodeUnknownSync(validRegion)
      expect(parsed).toEqual(validRegion)
    })

    it('should reject invalid TextureRegion', () => {
      const invalidRegion = { u: -0.1, v: 1.5, width: 2, height: -1 }
      expect(() => TextureRegionSchema.decodeUnknownSync(invalidRegion)).toThrow()
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
      const parsed = BlockTextureSchema.decodeUnknownSync(validBlockTexture)
      expect(parsed).toEqual(validBlockTexture)
    })
  })

  describe('Type Guards and Interfaces', () => {
    it('should create valid TextureRegion objects', () => {
      const region: TextureRegion = {
        u: 0.25,
        v: 0.5,
        width: 0.125,
        height: 0.125,
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
    const getService = () => Effect.gen(function* () {
      return yield* TextureAtlasService
    }).pipe(
      Effect.provide(TextureAtlasLive),
      Effect.runSync
    )

    it('should load atlas with default textures', async () => {
      const metadata = await pipe(
        getService().loadAtlas('/path/to/atlas.png'),
        Effect.runPromise
      )

      expect(metadata).toBeDefined()
      expect(metadata.atlasWidth).toBe(256)
      expect(metadata.atlasHeight).toBe(256)
      expect(metadata.textureCount).toBeGreaterThan(0)
      expect(metadata.blockTextures).toBeDefined()
    })

    it('should create default block textures', async () => {
      const metadata = await pipe(
        getService().loadAtlas('/path/to/atlas.png'),
        Effect.runPromise
      )

      // Should have default textures for common blocks
      expect(metadata.blockTextures.has(1)).toBe(true) // Stone
      expect(metadata.blockTextures.has(2)).toBe(true) // Dirt
      expect(metadata.blockTextures.has(3)).toBe(true) // Grass
      expect(metadata.blockTextures.has(4)).toBe(true) // Wood
    })

    it('should handle grass block with different top/bottom textures', async () => {
      const metadata = await pipe(
        getService().loadAtlas('/path/to/atlas.png'),
        Effect.runPromise
      )

      const grassTexture = metadata.blockTextures.get(3)
      expect(grassTexture).toBeDefined()
      if (grassTexture) {
        // Grass should have different textures for top/bottom/sides
        expect(grassTexture.top).not.toEqual(grassTexture.bottom)
        expect(grassTexture.top).not.toEqual(grassTexture.front)
      }
    })

    it('should handle errors during atlas loading', async () => {
      // Create a service that throws an error
      const errorService = TextureAtlasService.of({
        loadAtlas: () => Effect.fail(new TextureAtlasError({
          reason: 'Failed to load',
          context: 'loadAtlas',
          timestamp: Date.now(),
        })),
        getBlockUVs: () => Effect.fail(new TextureAtlasError({
          reason: 'Not implemented',
          context: 'getBlockUVs',
          timestamp: Date.now(),
        })),
        generateUVCoords: () => Effect.fail(new TextureAtlasError({
          reason: 'Not implemented',
          context: 'generateUVCoords',
          timestamp: Date.now(),
        })),
        createTextureMaterial: () => Effect.fail(new TextureAtlasError({
          reason: 'Not implemented',
          context: 'createTextureMaterial',
          timestamp: Date.now(),
        })),
        registerBlockTexture: () => Effect.fail(new TextureAtlasError({
          reason: 'Not implemented',
          context: 'registerBlockTexture',
          timestamp: Date.now(),
        })),
      })

      const result = await pipe(
        errorService.loadAtlas('/path/to/atlas.png'),
        Effect.either,
        Effect.runPromise
      )

      expect(result._tag).toBe('Left')
    })
  })

  describe('TextureAtlasService - getBlockUVs', () => {
    it('should get UVs for registered block', async () => {
      const getService = () => Effect.gen(function* () {
        return yield* TextureAtlasService
      }).pipe(
        Effect.provide(TextureAtlasLive),
        Effect.runSync
      )

      // Load atlas first
      await pipe(
        getService().loadAtlas('/path/to/atlas.png'),
        Effect.runPromise
      )

      const uvs = await pipe(
        getService().getBlockUVs(1, 'top'),
        Effect.runPromise
      )

      expect(uvs).toBeDefined()
      expect(uvs.u).toBeGreaterThanOrEqual(0)
      expect(uvs.u).toBeLessThanOrEqual(1)
      expect(uvs.v).toBeGreaterThanOrEqual(0)
      expect(uvs.v).toBeLessThanOrEqual(1)
    })

    it('should handle all face types', async () => {
      const getService = () => Effect.gen(function* () {
        return yield* TextureAtlasService
      }).pipe(
        Effect.provide(TextureAtlasLive),
        Effect.runSync
      )

      await pipe(
        getService().loadAtlas('/path/to/atlas.png'),
        Effect.runPromise
      )

      const faces: Array<'top' | 'bottom' | 'front' | 'back' | 'left' | 'right'> =
        ['top', 'bottom', 'front', 'back', 'left', 'right']

      for (const face of faces) {
        const uvs = await pipe(
          getService().getBlockUVs(1, face),
          Effect.runPromise
        )
        expect(uvs).toBeDefined()
      }
    })

    it('should return default UVs for unregistered block', async () => {
      const getService = () => Effect.gen(function* () {
        return yield* TextureAtlasService
      }).pipe(
        Effect.provide(TextureAtlasLive),
        Effect.runSync
      )

      await pipe(
        getService().loadAtlas('/path/to/atlas.png'),
        Effect.runPromise
      )

      const uvs = await pipe(
        getService().getBlockUVs(999, 'top'),
        Effect.runPromise
      )

      expect(uvs).toBeDefined()
      // Should return default texture region
      expect(uvs.u).toBe(0)
      expect(uvs.v).toBeGreaterThanOrEqual(0)
    })

    it('should fail when atlas not loaded', async () => {
      const getService = () => Effect.gen(function* () {
        return yield* TextureAtlasService
      }).pipe(
        Effect.provide(TextureAtlasLive),
        Effect.runSync
      )

      const result = runEffect(getService().getBlockUVs(1, 'top'))

      expect(Exit.isFailure(result)).toBe(true)
      if (Exit.isFailure(result)) {
        const error = result.cause._tag === 'Fail' ? result.cause.error : null
        expect(error).toBeInstanceOf(TextureAtlasError)
        if (error instanceof TextureAtlasError) {
          expect(error.reason).toContain('not loaded')
        }
      }
    })
  })

  describe('TextureAtlasService - generateUVCoords', () => {
    const getService = () => Effect.gen(function* () {
      return yield* TextureAtlasService
    }).pipe(
      Effect.provide(TextureAtlasLive),
      Effect.runSync
    )

    it('should generate UV coordinates for a quad', async () => {
      await pipe(
        getService().loadAtlas('/path/to/atlas.png'),
        Effect.runPromise
      )

      const coords = await pipe(
        getService().generateUVCoords(1, 'top'),
        Effect.runPromise
      )

      expect(coords).toHaveLength(8) // 4 vertices * 2 coords
      coords.forEach(coord => {
        expect(coord).toBeGreaterThanOrEqual(0)
        expect(coord).toBeLessThanOrEqual(1)
      })
    })

    it('should generate different coords for different faces', async () => {
      await pipe(
        getService().loadAtlas('/path/to/atlas.png'),
        Effect.runPromise
      )

      const topCoords = await pipe(
        getService().generateUVCoords(3, 'top'),
        Effect.runPromise
      )

      const bottomCoords = await pipe(
        getService().generateUVCoords(3, 'bottom'),
        Effect.runPromise
      )

      // Grass block should have different UVs for top and bottom
      expect(topCoords).not.toEqual(bottomCoords)
    })
  })

  describe('TextureAtlasService - createTextureMaterial', () => {
    const getService = () => Effect.gen(function* () {
      return yield* TextureAtlasService
    }).pipe(
      Effect.provide(TextureAtlasLive),
      Effect.runSync
    )

    it('should create texture material', async () => {
      const material = await pipe(
        getService().createTextureMaterial(),
        Effect.runPromise
      )

      expect(material).toBeDefined()
      expect(material.map).toBeDefined()
      expect(material.side).toBe('FrontSide')
      expect(material.vertexColors).toBe(true)
    })

    it('should reuse texture on subsequent calls', async () => {
      const material1 = await pipe(
        getService().createTextureMaterial(),
        Effect.runPromise
      )

      const material2 = await pipe(
        getService().createTextureMaterial(),
        Effect.runPromise
      )

      // Should reuse the same texture
      expect(material1.map).toBe(material2.map)
    })

    it('should configure texture filters correctly', async () => {
      const material = await pipe(
        getService().createTextureMaterial(),
        Effect.runPromise
      )

      expect(material.map.magFilter).toBeDefined()
      expect(material.map.minFilter).toBeDefined()
      expect(material.map.needsUpdate).toBe(true)
    })
  })

  describe('TextureAtlasService - registerBlockTexture', () => {
    const getService = () => Effect.gen(function* () {
      return yield* TextureAtlasService
    }).pipe(
      Effect.provide(TextureAtlasLive),
      Effect.runSync
    )

    it('should register new block texture', async () => {
      await pipe(
        getService().loadAtlas('/path/to/atlas.png'),
        Effect.runPromise
      )

      const customTexture = createTestBlockTexture(100)

      await pipe(
        getService().registerBlockTexture(customTexture),
        Effect.runPromise
      )

      // Verify it was registered
      const uvs = await pipe(
        getService().getBlockUVs(100, 'top'),
        Effect.runPromise
      )

      expect(uvs).toEqual(customTexture.top)
    })

    it('should override existing texture', async () => {
      await pipe(
        getService().loadAtlas('/path/to/atlas.png'),
        Effect.runPromise
      )

      const customTexture = createTestBlockTexture(1)
      customTexture.top = createTestRegion(0.9, 0.9, 0.1, 0.1)

      await pipe(
        getService().registerBlockTexture(customTexture),
        Effect.runPromise
      )

      const uvs = await pipe(
        getService().getBlockUVs(1, 'top'),
        Effect.runPromise
      )

      expect(uvs.u).toBe(0.9)
      expect(uvs.v).toBe(0.9)
    })

    it('should fail when atlas not loaded', async () => {
      const customTexture = createTestBlockTexture(100)

      const result = runEffect(getService().registerBlockTexture(customTexture))

      expect(Exit.isFailure(result)).toBe(true)
      if (Exit.isFailure(result)) {
        const error = result.cause._tag === 'Fail' ? result.cause.error : null
        expect(error).toBeInstanceOf(TextureAtlasError)
        if (error instanceof TextureAtlasError) {
          expect(error.reason).toContain('not loaded')
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
      expect(getOptimalAtlasSize(4, 16)).toBe(64) // 2x2 grid
      expect(getOptimalAtlasSize(16, 16)).toBe(64) // 4x4 grid
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
      const error = new TextureAtlasError({
        reason: 'Test error',
        context: 'test',
        timestamp: Date.now(),
      })

      expect(error).toBeInstanceOf(TextureAtlasError)
      expect(error.reason).toBe('Test error')
      expect(error.context).toBe('test')
      expect(error.timestamp).toBeGreaterThan(0)
    })
  })

  describe('Performance', () => {
    it('should handle large texture counts efficiently', async () => {
      const getService = () => Effect.gen(function* () {
        return yield* TextureAtlasService
      }).pipe(
        Effect.provide(TextureAtlasLive),
        Effect.runSync
      )

      await pipe(
        getService().loadAtlas('/path/to/atlas.png'),
        Effect.runPromise
      )

      const startTime = performance.now()

      // Register many textures
      for (let i = 10; i < 100; i++) {
        await pipe(
          getService().registerBlockTexture(createTestBlockTexture(i)),
          Effect.runPromise
        )
      }

      const endTime = performance.now()

      // Should complete quickly
      expect(endTime - startTime).toBeLessThan(100)
    })

    it('should retrieve UVs quickly', async () => {
      const getService = () => Effect.gen(function* () {
        return yield* TextureAtlasService
      }).pipe(
        Effect.provide(TextureAtlasLive),
        Effect.runSync
      )

      await pipe(
        getService().loadAtlas('/path/to/atlas.png'),
        Effect.runPromise
      )

      const startTime = performance.now()

      // Get UVs many times
      for (let i = 0; i < 1000; i++) {
        await pipe(
          getService().getBlockUVs(1, 'top'),
          Effect.runPromise
        )
      }

      const endTime = performance.now()

      // Should be very fast
      expect(endTime - startTime).toBeLessThan(100)
    })
  })

  describe('Layer Construction', () => {
    it('should provide TextureAtlasLive layer', async () => {
      const program = Effect.gen(function* () {
        const service = yield* TextureAtlasService
        expect(service).toBeDefined()
        expect(getService().loadAtlas).toBeDefined()
        expect(getService().getBlockUVs).toBeDefined()
        expect(getService().generateUVCoords).toBeDefined()
        expect(getService().createTextureMaterial).toBeDefined()
        expect(getService().registerBlockTexture).toBeDefined()
        return true
      })

      const result = await pipe(
        program,
        Effect.provide(TextureAtlasLive),
        Effect.runPromise
      )

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
      expect(size).toBe(1) // Minimum power of 2
    })
  })
})
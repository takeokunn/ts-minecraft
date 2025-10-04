/**
 * @fileoverview World Repository Layer Integration Test
 * ワールドリポジトリ層統合テスト
 *
 * 全Repository層の包括的統合テスト
 * パフォーマンス・エラーハンドリング・Layer統合検証
 */

import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'
import { BiomeSystemRepository, type BiomeDefinition } from '../biome_system_repository'
import { GenerationSessionRepository, type GenerationSession } from '../generation_session_repository'
import {
  WorldRepositoryLayer,
  WorldRepositoryMemoryLayer,
  WorldRepositoryMixedLayer,
  WorldRepositoryPersistenceLayer,
  collectRepositoryMetrics,
  defaultWorldRepositoryLayerConfig,
  getRepositoryPerformanceStats,
  validateRepositoryHealth,
} from '../index'
import { WorldGeneratorRepository, type WorldGenerator } from '../world_generator_repository'
import { WorldMetadataRepository, type WorldMetadata } from '../world_metadata_repository'

// === Test Data Factories ===

const createTestWorldGenerator = (): WorldGenerator => ({
  id: 'test-generator-1' as any,
  name: 'Test World Generator',
  description: 'A test world generator for integration testing',
  version: '1.0.0',
  author: 'Test Suite',
  category: 'test',
  tags: ['test', 'integration'],
  parameters: {
    seed: { type: 'number', default: 12345, min: 0, max: 2147483647 },
    difficulty: { type: 'enum', default: 'normal', options: ['peaceful', 'easy', 'normal', 'hard'] },
    structures: { type: 'boolean', default: true },
  },
  algorithmId: 'perlin-noise' as any,
  supportedBiomes: ['forest', 'desert', 'ocean'] as any[],
  configuration: {
    seed: 12345 as any,
    difficulty: 'normal' as any,
    generateStructures: true,
    generateOres: true,
    generateCaves: true,
    worldHeight: 256,
    bedrockLevel: 0,
    seaLevel: 64,
    biomeSize: 4,
    temperatureScale: 1.0,
    humidityScale: 1.0,
    customSettings: {},
  },
  metadata: {
    estimatedGenerationTime: 30000,
    memoryRequirement: 512 * 1024 * 1024, // 512MB
    supportedVersions: ['1.20', '1.21'],
    dependencies: [],
    limitations: [],
    features: ['biomes', 'structures', 'ores', 'caves'],
  },
  createdAt: new Date(),
  updatedAt: new Date(),
})

const createTestGenerationSession = (): GenerationSession => ({
  id: 'session-1' as any,
  worldId: 'world-1' as any,
  generatorId: 'test-generator-1' as any,
  state: 'active',
  priority: 'normal',
  chunks: [],
  progress: {
    totalChunks: 100,
    completedChunks: 50,
    failedChunks: 2,
    overallProgress: 0.5,
    estimatedTimeRemaining: 15000,
    currentPhase: 'generation',
    throughput: 3.5,
  },
  performance: {
    startTime: new Date(Date.now() - 30000),
    endTime: undefined,
    duration: 30000,
    averageChunkTime: 300,
    peakMemoryUsage: 256 * 1024 * 1024,
    cpuUsage: 0.45,
    ioOperations: 1250,
    cacheHitRate: 0.85,
  },
  configuration: {
    concurrency: 4,
    chunkBatchSize: 16,
    enableCheckpoints: true,
    retryFailedChunks: true,
    maxRetries: 3,
    timeoutMs: 30000,
    enableProfiling: false,
    customOptions: {},
  },
  checkpoints: [],
  createdAt: new Date(Date.now() - 30000),
  lastUpdated: new Date(),
})

const createTestBiomeDefinition = (): BiomeDefinition => ({
  id: 'test-forest' as any,
  name: 'Test Forest',
  category: 'forest',
  temperature: 0.7 as any,
  humidity: 0.8 as any,
  properties: {
    color: '#228B22',
    foliageColor: '#228B22',
    grassColor: '#7CBD7C',
    skyColor: '#87CEEB',
    precipitation: 'rain',
    depth: 0.1,
    scale: 0.2,
    canRain: true,
    canSnow: false,
    hasStorms: true,
  },
  createdAt: new Date(),
  updatedAt: new Date(),
})

const createTestWorldMetadata = (): WorldMetadata => ({
  id: 'world-1' as any,
  name: 'Test World',
  description: 'A test world for integration testing',
  seed: '12345' as any,
  generatorId: 'test-generator-1' as any,
  version: '1.0.0',
  gameVersion: '1.21',
  createdAt: new Date(),
  lastModified: new Date(),
  lastAccessed: new Date(),
  tags: ['test', 'integration'],
  properties: {},
  settings: {
    gameMode: 'survival',
    difficulty: 'normal',
    worldType: 'default',
    generateStructures: true,
    generateBonusChest: false,
    allowCheats: false,
    hardcore: false,
    pvp: true,
    spawnProtection: 16,
    worldBorder: {
      centerX: 0 as any,
      centerZ: 0 as any,
      size: 60000000,
      warningBlocks: 5,
      warningTime: 15,
      damageAmount: 0.2,
      damageBuffer: 5,
    },
    gameRules: {
      doMobSpawning: true,
      doFireTick: true,
      doMobLoot: true,
      mobGriefing: true,
      keepInventory: false,
      doEntityDrops: true,
      doTileDrops: true,
      commandBlockOutput: true,
      naturalRegeneration: true,
      doDaylightCycle: true,
      logAdminCommands: true,
      showDeathMessages: true,
      randomTickSpeed: 3,
      sendCommandFeedback: true,
    },
    dataPackSettings: {
      enabled: ['vanilla'],
      disabled: [],
      available: ['vanilla'],
    },
  },
  statistics: {
    size: {
      totalChunks: 100,
      loadedChunks: 50,
      generatedChunks: 75,
      compressedSize: 50 * 1024 * 1024, // 50MB
      uncompressedSize: 150 * 1024 * 1024, // 150MB
    },
    performance: {
      averageGenerationTime: 300,
      averageLoadTime: 50,
      totalGenerationTime: 22500,
      cacheHitRate: 0.85,
      compressionRatio: 0.33,
    },
    content: {
      biomeCount: { forest: 45, desert: 20, ocean: 35 },
      structureCount: { village: 3, dungeon: 8, stronghold: 1 },
      entityCount: { passive: 150, hostile: 75, neutral: 25 },
      tileEntityCount: { chest: 25, furnace: 12, bed: 8 },
    },
    player: {
      playerCount: 1,
      totalPlayTime: 3600000, // 1 hour
      lastPlayerActivity: new Date(),
      spawnLocations: [
        {
          playerId: 'player-1',
          x: 0 as any,
          y: 64 as any,
          z: 0 as any,
        },
      ],
    },
    lastUpdated: new Date(),
  },
  checksum: '',
})

// === Integration Tests ===

describe('World Repository Layer Integration', () => {
  describe('Layer Configuration', () => {
    it('should create memory layer with default configuration', async () => {
      const layer = WorldRepositoryMemoryLayer()
      expect(layer).toBeDefined()
    })

    it('should create persistence layer with default configuration', async () => {
      const layer = WorldRepositoryPersistenceLayer()
      expect(layer).toBeDefined()
    })

    it('should create mixed layer with default configuration', async () => {
      const layer = WorldRepositoryMixedLayer()
      expect(layer).toBeDefined()
    })

    it('should auto-select layer based on configuration', async () => {
      const memoryLayer = WorldRepositoryLayer({
        ...defaultWorldRepositoryLayerConfig,
        implementation: 'memory',
      })

      const persistenceLayer = WorldRepositoryLayer({
        ...defaultWorldRepositoryLayerConfig,
        implementation: 'persistence',
      })

      const mixedLayer = WorldRepositoryLayer({
        ...defaultWorldRepositoryLayerConfig,
        implementation: 'mixed',
      })

      expect(memoryLayer).toBeDefined()
      expect(persistenceLayer).toBeDefined()
      expect(mixedLayer).toBeDefined()
    })
  })

  describe('Repository Integration', () => {
    it('should integrate all repositories successfully', async () => {
      const program = Effect.gen(function* () {
        const worldGenRepo = yield* WorldGeneratorRepository
        const sessionRepo = yield* GenerationSessionRepository
        const biomeRepo = yield* BiomeSystemRepository
        const metadataRepo = yield* WorldMetadataRepository

        // Verify all repositories are available
        expect(worldGenRepo).toBeDefined()
        expect(sessionRepo).toBeDefined()
        expect(biomeRepo).toBeDefined()
        expect(metadataRepo).toBeDefined()

        return {
          worldGenRepo,
          sessionRepo,
          biomeRepo,
          metadataRepo,
        }
      })

      const layer = WorldRepositoryMemoryLayer()
      const result = await Effect.runPromise(Effect.provide(program, layer))

      expect(result.worldGenRepo).toBeDefined()
      expect(result.sessionRepo).toBeDefined()
      expect(result.biomeRepo).toBeDefined()
      expect(result.metadataRepo).toBeDefined()
    })

    it('should perform CRUD operations across all repositories', async () => {
      const program = Effect.gen(function* () {
        const worldGenRepo = yield* WorldGeneratorRepository
        const sessionRepo = yield* GenerationSessionRepository
        const biomeRepo = yield* BiomeSystemRepository
        const metadataRepo = yield* WorldMetadataRepository

        // Create test data
        const generator = createTestWorldGenerator()
        const session = createTestGenerationSession()
        const biome = createTestBiomeDefinition()
        const metadata = createTestWorldMetadata()

        // Save data
        yield* worldGenRepo.saveGenerator(generator)
        yield* sessionRepo.saveSession(session)
        yield* biomeRepo.saveBiomeDefinition(biome)
        yield* metadataRepo.saveMetadata(metadata)

        // Retrieve data
        const retrievedGenerator = yield* worldGenRepo.findGenerator(generator.id)
        const retrievedSession = yield* sessionRepo.findSession(session.id)
        const retrievedBiome = yield* biomeRepo.findBiomeDefinition(biome.id)
        const retrievedMetadata = yield* metadataRepo.findMetadata(metadata.id)

        return {
          generator: retrievedGenerator,
          session: retrievedSession,
          biome: retrievedBiome,
          metadata: retrievedMetadata,
        }
      })

      const layer = WorldRepositoryMemoryLayer()
      const result = await Effect.runPromise(Effect.provide(program, layer))

      expect(result.generator._tag).toBe('Some')
      expect(result.session._tag).toBe('Some')
      expect(result.biome._tag).toBe('Some')
      expect(result.metadata._tag).toBe('Some')
    })
  })

  describe('Cross-Repository Operations', () => {
    it('should handle world generation workflow', async () => {
      const program = Effect.gen(function* () {
        const worldGenRepo = yield* WorldGeneratorRepository
        const sessionRepo = yield* GenerationSessionRepository
        const biomeRepo = yield* BiomeSystemRepository
        const metadataRepo = yield* WorldMetadataRepository

        // Setup world generation workflow
        const generator = createTestWorldGenerator()
        const session = createTestGenerationSession()
        const biome = createTestBiomeDefinition()
        const metadata = createTestWorldMetadata()

        // Step 1: Save generator and biome
        yield* worldGenRepo.saveGenerator(generator)
        yield* biomeRepo.saveBiomeDefinition(biome)

        // Step 2: Create generation session
        yield* sessionRepo.saveSession(session)

        // Step 3: Create world metadata
        yield* metadataRepo.saveMetadata(metadata)

        // Step 4: Verify relationships
        const allGenerators = yield* worldGenRepo.findAllGenerators()
        const allSessions = yield* sessionRepo.findAllSessions()
        const allBiomes = yield* biomeRepo.findAllBiomeDefinitions()
        const allMetadata = yield* metadataRepo.findAllMetadata()

        return {
          generators: allGenerators.length,
          sessions: allSessions.length,
          biomes: allBiomes.length,
          metadata: allMetadata.length,
        }
      })

      const layer = WorldRepositoryMemoryLayer()
      const result = await Effect.runPromise(Effect.provide(program, layer))

      expect(result.generators).toBe(1)
      expect(result.sessions).toBe(1)
      expect(result.biomes).toBe(1)
      expect(result.metadata).toBe(1)
    })

    it('should handle complex search operations', async () => {
      const program = Effect.gen(function* () {
        const worldGenRepo = yield* WorldGeneratorRepository
        const biomeRepo = yield* BiomeSystemRepository
        const metadataRepo = yield* WorldMetadataRepository

        // Setup test data
        const generator = createTestWorldGenerator()
        const biome = createTestBiomeDefinition()
        const metadata = createTestWorldMetadata()

        yield* worldGenRepo.saveGenerator(generator)
        yield* biomeRepo.saveBiomeDefinition(biome)
        yield* metadataRepo.saveMetadata(metadata)

        // Perform searches
        const generatorSearch = yield* worldGenRepo.searchGenerators({
          name: 'Test',
          category: 'test',
          tags: ['integration'],
          limit: 10,
        })

        const metadataSearch = yield* metadataRepo.searchMetadata({
          name: 'Test',
          tags: ['integration'],
          gameMode: 'survival',
          limit: 10,
        })

        return {
          generatorResults: generatorSearch.length,
          metadataResults: metadataSearch.length,
        }
      })

      const layer = WorldRepositoryMemoryLayer()
      const result = await Effect.runPromise(Effect.provide(program, layer))

      expect(result.generatorResults).toBeGreaterThan(0)
      expect(result.metadataResults).toBeGreaterThan(0)
    })
  })

  describe('Performance and Monitoring', () => {
    it('should collect repository metrics', async () => {
      const program = Effect.gen(function* () {
        const worldGenRepo = yield* WorldGeneratorRepository
        const sessionRepo = yield* GenerationSessionRepository
        const biomeRepo = yield* BiomeSystemRepository
        const metadataRepo = yield* WorldMetadataRepository

        const services = {
          worldGenerator: worldGenRepo,
          generationSession: sessionRepo,
          biomeSystem: biomeRepo,
          worldMetadata: metadataRepo,
        }

        // Collect metrics
        const health = validateRepositoryHealth(services)
        const performance = getRepositoryPerformanceStats(services)
        const metrics = collectRepositoryMetrics(services)

        return { health, performance, metrics }
      })

      const layer = WorldRepositoryMemoryLayer()
      const result = await Effect.runPromise(Effect.provide(program, layer))

      expect(result.health).toBeDefined()
      expect(result.health.worldGenerator.isInitialized).toBe(true)
      expect(result.health.generationSession.isInitialized).toBe(true)
      expect(result.health.biomeSystem.isInitialized).toBe(true)
      expect(result.health.worldMetadata.isInitialized).toBe(true)

      expect(result.performance.overall.totalMemoryUsage).toBeDefined()
      expect(result.performance.breakdown).toBeDefined()
      expect(result.performance.recommendations).toBeInstanceOf(Array)

      expect(result.metrics.timestamp).toBeDefined()
      expect(result.metrics.metrics.cache).toBeDefined()
      expect(result.metrics.metrics.performance).toBeDefined()
      expect(result.metrics.metrics.storage).toBeDefined()
      expect(result.metrics.metrics.errors).toBeDefined()
    })

    it('should handle concurrent operations', async () => {
      const program = Effect.gen(function* () {
        const worldGenRepo = yield* WorldGeneratorRepository
        const sessionRepo = yield* GenerationSessionRepository

        // Create multiple concurrent operations
        const generator1 = { ...createTestWorldGenerator(), id: 'gen-1' as any }
        const generator2 = { ...createTestWorldGenerator(), id: 'gen-2' as any }
        const generator3 = { ...createTestWorldGenerator(), id: 'gen-3' as any }

        const session1 = { ...createTestGenerationSession(), id: 'sess-1' as any }
        const session2 = { ...createTestGenerationSession(), id: 'sess-2' as any }
        const session3 = { ...createTestGenerationSession(), id: 'sess-3' as any }

        // Execute concurrent operations
        yield* Effect.all(
          [
            worldGenRepo.saveGenerator(generator1),
            worldGenRepo.saveGenerator(generator2),
            worldGenRepo.saveGenerator(generator3),
            sessionRepo.saveSession(session1),
            sessionRepo.saveSession(session2),
            sessionRepo.saveSession(session3),
          ],
          { concurrency: 6 }
        )

        // Verify all operations completed
        const allGenerators = yield* worldGenRepo.findAllGenerators()
        const allSessions = yield* sessionRepo.findAllSessions()

        return {
          generators: allGenerators.length,
          sessions: allSessions.length,
        }
      })

      const layer = WorldRepositoryMemoryLayer()
      const result = await Effect.runPromise(Effect.provide(program, layer))

      expect(result.generators).toBe(3)
      expect(result.sessions).toBe(3)
    })
  })

  describe('Error Handling', () => {
    it('should handle repository errors gracefully', async () => {
      const program = Effect.gen(function* () {
        const worldGenRepo = yield* WorldGeneratorRepository
        const metadataRepo = yield* WorldMetadataRepository

        // Try to find non-existent resources
        const missingGenerator = yield* worldGenRepo.findGenerator('non-existent' as any)
        const missingMetadata = yield* metadataRepo.findMetadata('non-existent' as any)

        // Try to update non-existent resources
        const generator = createTestWorldGenerator()
        generator.id = 'non-existent' as any

        const updateResult = yield* Effect.either(worldGenRepo.updateGenerator(generator))

        return {
          missingGenerator: missingGenerator._tag,
          missingMetadata: missingMetadata._tag,
          updateError: updateResult._tag,
        }
      })

      const layer = WorldRepositoryMemoryLayer()
      const result = await Effect.runPromise(Effect.provide(program, layer))

      expect(result.missingGenerator).toBe('None')
      expect(result.missingMetadata).toBe('None')
      expect(result.updateError).toBe('Left') // Should be an error
    })
  })
})

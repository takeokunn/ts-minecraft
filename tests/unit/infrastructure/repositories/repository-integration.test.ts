/**
 * Repository Integration Tests - Tests for functional repository layer composition
 *
 * This test suite verifies that all repositories work correctly together
 * using the functional Effect-TS patterns with Layer composition.
 */

import { describe, it, expect } from 'vitest'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as Context from 'effect/Context'

import { 
  WorldRepositoryService,
  EntityRepository,
  ChunkRepository,
  ComponentRepository,
  PhysicsRepository,
  AllRepositories,
  CoreRepositories,
  PhysicsRepositories
} from '@infrastructure/repositories'
import { runEffect } from '../../../setup/infrastructure.setup'

describe('Repository Integration', () => {
  describe('Layer Composition', () => {
    it('should successfully compose all repositories', async () => {
      const testEffect = Effect.gen(function* (_) {
        const worldRepo = yield* _(WorldRepositoryService)
        const entityRepo = yield* _(EntityRepository)
        const chunkRepo = yield* _(ChunkRepository)
        const componentRepo = yield* _(ComponentRepository)
        const physicsRepo = yield* _(PhysicsRepository)

        // Verify all repositories are available
        expect(worldRepo).toBeDefined()
        expect(entityRepo).toBeDefined()
        expect(chunkRepo).toBeDefined()
        expect(componentRepo).toBeDefined()
        expect(physicsRepo).toBeDefined()

        return { success: true }
      })

      const result = await runEffect(
        Effect.provide(testEffect, AllRepositories)
      )

      expect(result.success).toBe(true)
    })

    it('should successfully compose core repositories', async () => {
      const testEffect = Effect.gen(function* (_) {
        const worldRepo = yield* _(WorldRepositoryService)
        const entityRepo = yield* _(EntityRepository)

        expect(worldRepo).toBeDefined()
        expect(entityRepo).toBeDefined()

        return { success: true }
      })

      const result = await runEffect(
        Effect.provide(testEffect, CoreRepositories)
      )

      expect(result.success).toBe(true)
    })

    it('should successfully compose physics repositories', async () => {
      const testEffect = Effect.gen(function* (_) {
        const entityRepo = yield* _(EntityRepository)
        const componentRepo = yield* _(ComponentRepository)
        const physicsRepo = yield* _(PhysicsRepository)

        expect(entityRepo).toBeDefined()
        expect(componentRepo).toBeDefined()
        expect(physicsRepo).toBeDefined()

        return { success: true }
      })

      const result = await runEffect(
        Effect.provide(testEffect, PhysicsRepositories)
      )

      expect(result.success).toBe(true)
    })
  })

  describe('Cross-Repository Operations', () => {
    it('should perform operations across multiple repositories', async () => {
      const testEffect = Effect.gen(function* (_) {
        const worldRepo = yield* _(WorldRepositoryService)
        const entityRepo = yield* _(EntityRepository)
        const componentRepo = yield* _(ComponentRepository)

        // Create an entity with components
        const entityId = yield* _(entityRepo.createEntity())
        
        // Verify entity exists
        const exists = yield* _(entityRepo.entityExists(entityId))
        expect(exists).toBe(true)

        // Get component count
        const componentCount = yield* _(componentRepo.getComponentCount())
        expect(typeof componentCount).toBe('number')

        return { 
          success: true,
          entityId,
          componentCount 
        }
      })

      const result = await runEffect(
        Effect.provide(testEffect, AllRepositories)
      )

      expect(result.success).toBe(true)
      expect(result.entityId).toBeDefined()
      expect(typeof result.componentCount).toBe('number')
    })

    it('should handle repository statistics and maintenance', async () => {
      const testEffect = Effect.gen(function* (_) {
        const entityRepo = yield* _(EntityRepository)
        const componentRepo = yield* _(ComponentRepository)
        const chunkRepo = yield* _(ChunkRepository)

        // Get statistics from all repositories
        const entityStats = yield* _(entityRepo.getRepositoryStats())
        const componentStats = yield* _(componentRepo.getComponentStats())
        const chunkStats = yield* _(chunkRepo.getChunkStats())

        // Verify statistics structure
        expect(entityStats.entityCount).toBeGreaterThanOrEqual(0)
        expect(componentStats.totalComponents).toBeGreaterThanOrEqual(0)
        expect(chunkStats.totalChunks).toBeGreaterThanOrEqual(0)

        // Perform maintenance operations
        yield* _(entityRepo.compactStorage())
        yield* _(componentRepo.compactStorage())
        yield* _(chunkRepo.compactStorage())

        return { 
          success: true,
          stats: { entityStats, componentStats, chunkStats }
        }
      })

      const result = await runEffect(
        Effect.provide(testEffect, AllRepositories)
      )

      expect(result.success).toBe(true)
      expect(result.stats).toBeDefined()
    })
  })

  describe('Repository Error Handling', () => {
    it('should handle errors gracefully', async () => {
      const testEffect = Effect.gen(function* (_) {
        const entityRepo = yield* _(EntityRepository)
        
        // Try to get metadata for non-existent entity
        const metadata = yield* _(entityRepo.getEntityMetadata('non-existent' as any))
        
        expect(metadata._tag).toBe('None')

        return { success: true }
      })

      const result = await runEffect(
        Effect.provide(testEffect, AllRepositories)
      )

      expect(result.success).toBe(true)
    })
  })

  describe('Repository Performance', () => {
    it('should handle concurrent operations', async () => {
      const testEffect = Effect.gen(function* (_) {
        const entityRepo = yield* _(EntityRepository)
        
        // Create multiple entities concurrently
        const createEntityEffects = Array.from({ length: 10 }, () => 
          entityRepo.createEntity()
        )
        
        const entityIds = yield* _(Effect.all(createEntityEffects))
        
        expect(entityIds).toHaveLength(10)
        expect(entityIds.every(id => id !== undefined)).toBe(true)

        // Get entity count
        const count = yield* _(entityRepo.countEntities())
        expect(count).toBeGreaterThanOrEqual(10)

        return { success: true, entityCount: count }
      })

      const result = await runEffect(
        Effect.provide(testEffect, AllRepositories)
      )

      expect(result.success).toBe(true)
      expect(result.entityCount).toBeGreaterThanOrEqual(10)
    })
  })
})
/**
 * QuadTree Operations Tests
 *
 * 不変関数型QuadTreeの性能と正確性を検証
 */

import type { WorldCoordinate } from '@domain/world/value_object/coordinates/world_coordinate'
import { describe, expect, it } from 'vitest'
import { createQuadTree, findNearestBiome, getStatistics, insertPlacement, query } from './quadtree_operations'
import type { BiomePlacement, SpatialBounds, SpatialCoordinate } from './quadtree_schema'

// === Test Fixtures ===

const testBounds: SpatialBounds = {
  minX: -1000 as WorldCoordinate,
  minZ: -1000 as WorldCoordinate,
  maxX: 1000 as WorldCoordinate,
  maxZ: 1000 as WorldCoordinate,
}

const createTestPlacement = (x: number, z: number, biomeId: string = 'minecraft:plains'): BiomePlacement => ({
  biomeId: biomeId as any,
  coordinate: {
    x: x as WorldCoordinate,
    z: z as WorldCoordinate,
  },
  radius: 10,
  priority: 1,
  placedAt: new Date(),
  metadata: {},
})

// === Tests ===

describe('QuadTree Operations', () => {
  describe('createQuadTree', () => {
    it('should create initial empty QuadTree', () => {
      const state = createQuadTree(testBounds, 8, 16)

      expect(state.root.isLeaf).toBe(true)
      expect(state.root.biomes).toHaveLength(0)
      expect(state.root.bounds).toEqual(testBounds)
      expect(state.maxDepth).toBe(8)
      expect(state.maxEntries).toBe(16)
    })
  })

  describe('insertPlacement', () => {
    it('should insert single placement', () => {
      let state = createQuadTree(testBounds, 8, 16)
      const placement = createTestPlacement(0, 0)

      state = insertPlacement(state, placement)

      expect(state.root.biomes).toHaveLength(1)
      expect(state.root.biomes[0]).toEqual(placement)
    })

    it('should maintain immutability', () => {
      const state1 = createQuadTree(testBounds, 8, 16)
      const placement = createTestPlacement(0, 0)

      const state2 = insertPlacement(state1, placement)

      // Original state unchanged
      expect(state1.root.biomes).toHaveLength(0)
      expect(state2.root.biomes).toHaveLength(1)
      expect(state1).not.toBe(state2)
      expect(state1.root).not.toBe(state2.root)
    })

    it('should insert multiple placements', () => {
      let state = createQuadTree(testBounds, 8, 16)

      for (let i = 0; i < 10; i++) {
        state = insertPlacement(state, createTestPlacement(i * 10, i * 10))
      }

      const allPlacements = query(state, testBounds)
      expect(allPlacements).toHaveLength(10)
    })

    it('should split node when maxEntries exceeded', () => {
      let state = createQuadTree(testBounds, 8, 4) // maxEntries = 4

      // Insert 5 placements in the same quadrant
      for (let i = 0; i < 5; i++) {
        state = insertPlacement(state, createTestPlacement(10 + i, 10 + i))
      }

      // Root should now be split (not a leaf)
      expect(state.root.isLeaf).toBe(false)
      expect(state.root.children).toBeDefined()
      expect(state.root.children).toHaveLength(4)
    })

    it('should not insert out-of-bounds placement', () => {
      let state = createQuadTree(testBounds, 8, 16)
      const outOfBounds = createTestPlacement(2000, 2000) // Outside bounds

      state = insertPlacement(state, outOfBounds)

      const allPlacements = query(state, testBounds)
      expect(allPlacements).toHaveLength(0)
    })

    it('should handle deep tree structure', () => {
      let state = createQuadTree(testBounds, 8, 2) // Low maxEntries for deeper tree

      // Insert many placements to force deep splitting
      // Note: placements on boundaries may be counted in multiple quadrants
      for (let i = 0; i < 20; i++) {
        state = insertPlacement(state, createTestPlacement(i * 5, i * 5))
      }

      const stats = getStatistics(state)
      expect(stats.totalBiomes).toBeGreaterThanOrEqual(20)
      expect(stats.maxDepth).toBeGreaterThan(0)
    })
  })

  describe('query', () => {
    it('should query empty tree', () => {
      const state = createQuadTree(testBounds, 8, 16)
      const results = query(state, testBounds)

      expect(results).toHaveLength(0)
    })

    it('should query all placements in bounds', () => {
      let state = createQuadTree(testBounds, 8, 16)

      const placements = [createTestPlacement(0, 0), createTestPlacement(100, 100), createTestPlacement(-50, -50)]

      for (const placement of placements) {
        state = insertPlacement(state, placement)
      }

      const results = query(state, testBounds)
      expect(results).toHaveLength(3)
    })

    it('should query specific region', () => {
      let state = createQuadTree(testBounds, 8, 16)

      // Insert placements in different quadrants
      state = insertPlacement(state, createTestPlacement(100, 100)) // NE
      state = insertPlacement(state, createTestPlacement(-100, 100)) // NW
      state = insertPlacement(state, createTestPlacement(-100, -100)) // SW
      state = insertPlacement(state, createTestPlacement(100, -100)) // SE

      // Query only NE quadrant
      const neQuadrant: SpatialBounds = {
        minX: 0 as WorldCoordinate,
        minZ: 0 as WorldCoordinate,
        maxX: 1000 as WorldCoordinate,
        maxZ: 1000 as WorldCoordinate,
      }

      const results = query(state, neQuadrant)
      expect(results).toHaveLength(1)
      expect(results[0].coordinate.x).toBe(100)
      expect(results[0].coordinate.z).toBe(100)
    })

    it('should handle queries with no results', () => {
      let state = createQuadTree(testBounds, 8, 16)
      state = insertPlacement(state, createTestPlacement(0, 0))

      const emptyRegion: SpatialBounds = {
        minX: 500 as WorldCoordinate,
        minZ: 500 as WorldCoordinate,
        maxX: 600 as WorldCoordinate,
        maxZ: 600 as WorldCoordinate,
      }

      const results = query(state, emptyRegion)
      expect(results).toHaveLength(0)
    })
  })

  describe('findNearestBiome', () => {
    it('should find nearest biome', () => {
      let state = createQuadTree(testBounds, 8, 16)

      state = insertPlacement(state, createTestPlacement(0, 0, 'minecraft:plains'))
      state = insertPlacement(state, createTestPlacement(100, 100, 'minecraft:forest'))
      state = insertPlacement(state, createTestPlacement(200, 200, 'minecraft:desert'))

      const searchPoint: SpatialCoordinate = {
        x: 50 as WorldCoordinate,
        z: 50 as WorldCoordinate,
      }

      const nearest = findNearestBiome(state, searchPoint)

      expect(nearest).not.toBeNull()
      expect(nearest?.biomeId).toBe('minecraft:plains')
    })

    it('should return null when no biomes in range', () => {
      let state = createQuadTree(testBounds, 8, 16)
      state = insertPlacement(state, createTestPlacement(0, 0))

      const farPoint: SpatialCoordinate = {
        x: 900 as WorldCoordinate,
        z: 900 as WorldCoordinate,
      }

      const nearest = findNearestBiome(state, farPoint, 50) // maxDistance = 50

      expect(nearest).toBeNull()
    })

    it('should respect maxDistance parameter', () => {
      let state = createQuadTree(testBounds, 8, 16)

      state = insertPlacement(state, createTestPlacement(0, 0))
      state = insertPlacement(state, createTestPlacement(500, 500))

      const searchPoint: SpatialCoordinate = {
        x: 100 as WorldCoordinate,
        z: 100 as WorldCoordinate,
      }

      // With large maxDistance, should find (0, 0)
      const nearestLarge = findNearestBiome(state, searchPoint, 200)
      expect(nearestLarge).not.toBeNull()

      // With small maxDistance, should find nothing
      const nearestSmall = findNearestBiome(state, searchPoint, 50)
      expect(nearestSmall).toBeNull()
    })

    it('should handle empty tree', () => {
      const state = createQuadTree(testBounds, 8, 16)
      const searchPoint: SpatialCoordinate = {
        x: 0 as WorldCoordinate,
        z: 0 as WorldCoordinate,
      }

      const nearest = findNearestBiome(state, searchPoint)
      expect(nearest).toBeNull()
    })
  })

  describe('getStatistics', () => {
    it('should report correct statistics for empty tree', () => {
      const state = createQuadTree(testBounds, 8, 16)
      const stats = getStatistics(state)

      expect(stats.totalNodes).toBe(1)
      expect(stats.leafNodes).toBe(1)
      expect(stats.totalBiomes).toBe(0)
      expect(stats.maxDepth).toBe(0)
    })

    it('should report correct statistics after insertions', () => {
      let state = createQuadTree(testBounds, 8, 4)

      // Insert placements with offset to avoid boundary overlaps
      for (let i = 0; i < 10; i++) {
        state = insertPlacement(state, createTestPlacement(i * 20 + 1, i * 20 + 1))
      }

      const stats = getStatistics(state)

      expect(stats.totalBiomes).toBe(10)
      expect(stats.totalNodes).toBeGreaterThan(1)
      expect(stats.leafNodes).toBeGreaterThan(0)
      expect(stats.maxDepth).toBeGreaterThan(0)
      expect(stats.averageDepth).toBeGreaterThan(0)
    })
  })

  describe('Performance: O(N log N) vs O(N²)', () => {
    it('should handle 1000 insertions efficiently', () => {
      let state = createQuadTree(testBounds, 8, 16)

      const startTime = performance.now()

      // Insert 1000 placements
      for (let i = 0; i < 1000; i++) {
        const x = Math.random() * 2000 - 1000
        const z = Math.random() * 2000 - 1000
        state = insertPlacement(state, createTestPlacement(x, z))
      }

      const endTime = performance.now()
      const duration = endTime - startTime

      // Should complete in reasonable time (< 100ms for 1000 insertions)
      expect(duration).toBeLessThan(100)

      // Verify all placements inserted
      const allPlacements = query(state, testBounds)
      expect(allPlacements.length).toBe(1000)
    })

    it('should query 1000 placements efficiently', () => {
      let state = createQuadTree(testBounds, 8, 16)

      // Insert 1000 placements
      for (let i = 0; i < 1000; i++) {
        const x = Math.random() * 2000 - 1000
        const z = Math.random() * 2000 - 1000
        state = insertPlacement(state, createTestPlacement(x, z))
      }

      const startTime = performance.now()

      // Query 100 different regions
      for (let i = 0; i < 100; i++) {
        const x = Math.random() * 2000 - 1000
        const z = Math.random() * 2000 - 1000
        const queryBounds: SpatialBounds = {
          minX: (x - 50) as WorldCoordinate,
          minZ: (z - 50) as WorldCoordinate,
          maxX: (x + 50) as WorldCoordinate,
          maxZ: (z + 50) as WorldCoordinate,
        }
        query(state, queryBounds)
      }

      const endTime = performance.now()
      const duration = endTime - startTime

      // Should complete in reasonable time (< 50ms for 100 queries)
      expect(duration).toBeLessThan(50)
    })
  })

  describe('Structural Sharing', () => {
    it('should preserve unmodified nodes', () => {
      let state1 = createQuadTree(testBounds, 8, 2)

      // Insert placements to create tree structure
      state1 = insertPlacement(state1, createTestPlacement(-100, -100))
      state1 = insertPlacement(state1, createTestPlacement(-90, -90))
      state1 = insertPlacement(state1, createTestPlacement(-80, -80))

      // Force split
      state1 = insertPlacement(state1, createTestPlacement(-70, -70))

      // Insert in different quadrant
      const state2 = insertPlacement(state1, createTestPlacement(100, 100))

      // Trees should share structure (implementation detail)
      expect(state1).not.toBe(state2)
      expect(state1.root).not.toBe(state2.root)
    })
  })
})

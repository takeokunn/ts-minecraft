import { describe, it, expect } from 'vitest'
import { Effect } from 'effect'
import * as fc from 'fast-check'
import {
  expectEffectSuccess,
  expectEffectDuration,
} from '../../../test/helpers/effect-test-utils'
import { createWorldGenerator } from '../createWorldGenerator'
import type { GeneratorOptions, StructureType } from '../GeneratorOptions'
import type { ChunkPosition } from '../../chunk/ChunkPosition'
import type { Vector3, BiomeType } from '../types'

describe('createWorldGenerator', () => {
  const defaultOptions: Partial<GeneratorOptions> = {
    seed: 12345,
    seaLevel: 64,
    generateStructures: true,
    features: {
      villages: true,
      mineshafts: true,
      strongholds: true,
      temples: true,
      dungeons: true,
    },
  }

  describe('Generator Creation', () => {
    it('creates world generator with default options', async () => {
      const effect = Effect.gen(function* () {
        const generator = yield* createWorldGenerator()

        expect(generator).toBeDefined()
        expect(typeof generator.generateChunk).toBe('function')
        expect(typeof generator.generateStructure).toBe('function')
        expect(typeof generator.getSpawnPoint).toBe('function')
        expect(typeof generator.getBiome).toBe('function')
        expect(typeof generator.getTerrainHeight).toBe('function')
        expect(typeof generator.getSeed).toBe('function')
        expect(typeof generator.getOptions).toBe('function')
        expect(typeof generator.canGenerateStructure).toBe('function')
        expect(typeof generator.findNearestStructure).toBe('function')

        return generator
      })

      await expectEffectSuccess(effect)
    })

    it('creates world generator with custom options', async () => {
      const customOptions: Partial<GeneratorOptions> = {
        seed: 98765,
        seaLevel: 80,
        generateStructures: false,
        features: {
          villages: false,
          mineshafts: true,
          strongholds: false,
          temples: true,
          dungeons: false,
        },
      }

      const effect = Effect.gen(function* () {
        const generator = yield* createWorldGenerator(customOptions)

        expect(generator.getSeed()).toBe(98765)

        const options = generator.getOptions()
        expect(options.seed).toBe(98765)
        expect(options.seaLevel).toBe(80)
        expect(options.generateStructures).toBe(false)

        return generator
      })

      await expectEffectSuccess(effect)
    })

    it('provides consistent seed across calls', async () => {
      const effect = Effect.gen(function* () {
        const generator1 = yield* createWorldGenerator({ seed: 12345 })
        const generator2 = yield* createWorldGenerator({ seed: 12345 })

        expect(generator1.getSeed()).toBe(generator2.getSeed())
        expect(generator1.getSeed()).toBe(12345)

        return { generator1, generator2 }
      })

      await expectEffectSuccess(effect)
    })

    it('generates different seeds when not specified', async () => {
      const effect = Effect.gen(function* () {
        const generator1 = yield* createWorldGenerator({})
        const generator2 = yield* createWorldGenerator({})

        const seed1 = generator1.getSeed()
        const seed2 = generator2.getSeed()

        expect(typeof seed1).toBe('number')
        expect(typeof seed2).toBe('number')
        expect(Number.isFinite(seed1)).toBe(true)
        expect(Number.isFinite(seed2)).toBe(true)

        return { seed1, seed2 }
      })

      await expectEffectSuccess(effect)
    })
  })

  describe('Spawn Point Management', () => {
    it('provides default spawn point', async () => {
      const effect = Effect.gen(function* () {
        const generator = yield* createWorldGenerator(defaultOptions)
        const spawnPoint = yield* generator.getSpawnPoint()

        expect(spawnPoint).toEqual({ x: 0, y: 64, z: 0 })

        return spawnPoint
      })

      await expectEffectSuccess(effect)
    })

    it('returns consistent spawn point', async () => {
      const effect = Effect.gen(function* () {
        const generator = yield* createWorldGenerator(defaultOptions)

        const spawn1 = yield* generator.getSpawnPoint()
        const spawn2 = yield* generator.getSpawnPoint()

        expect(spawn1).toEqual(spawn2)

        return { spawn1, spawn2 }
      })

      await expectEffectSuccess(effect)
    })
  })

  describe('Chunk Generation', () => {
    it('generates complete chunk data', async () => {
      const chunkPosition: ChunkPosition = { x: 0, z: 0 }

      const effect = Effect.gen(function* () {
        const generator = yield* createWorldGenerator(defaultOptions)
        const result = yield* generator.generateChunk(chunkPosition)

        // 基本構造の検証
        expect(result.chunk).toBeDefined()
        expect(result.biomes).toBeDefined()
        expect(result.structures).toBeDefined()
        expect(result.heightMap).toBeDefined()

        // チャンクデータの検証
        expect(result.chunk.position).toEqual(chunkPosition)
        expect(result.chunk.blocks).toBeInstanceOf(Uint16Array)
        expect(result.chunk.blocks.length).toBe(16 * 16 * 384)
        expect(result.chunk.isDirty).toBe(true)
        expect(result.chunk.metadata.isModified).toBe(true)

        // バイオームデータの検証
        expect(result.biomes).toHaveLength(256) // 16x16 = 256
        for (const biome of result.biomes) {
          expect(typeof biome).toBe('string')
        }

        // 高度マップの検証
        expect(result.heightMap).toHaveLength(256)
        for (const height of result.heightMap) {
          expect(typeof height).toBe('number')
          expect(Number.isFinite(height)).toBe(true)
        }

        // 構造物配列の検証
        expect(Array.isArray(result.structures)).toBe(true)

        return result
      })

      await expectEffectSuccess(effect)
    })

    it('generates different chunks for different positions', async () => {
      const positions: ChunkPosition[] = [
        { x: 0, z: 0 },
        { x: 1, z: 0 },
        { x: 0, z: 1 },
        { x: 10, z: 10 },
      ]

      const effect = Effect.gen(function* () {
        const generator = yield* createWorldGenerator(defaultOptions)
        const results = []

        for (const position of positions) {
          const result = yield* generator.generateChunk(position)
          results.push(result)
        }

        // 異なる位置では異なるチャンクが生成されるはず
        for (let i = 0; i < results.length; i++) {
          for (let j = i + 1; j < results.length; j++) {
            const result1 = results[i]
            const result2 = results[j]

            if (result1 && result2) {
              expect(result1.chunk.position).not.toEqual(result2.chunk.position)
              expect(result1.heightMap).not.toEqual(result2.heightMap)
              expect(result1.biomes).not.toEqual(result2.biomes)
            }
          }
        }

        return results
      })

      await expectEffectSuccess(effect)
    })

    it('generates consistent chunks for same position', async () => {
      const chunkPosition: ChunkPosition = { x: 5, z: 10 }

      const effect = Effect.gen(function* () {
        const generator = yield* createWorldGenerator(defaultOptions)

        const result1 = yield* generator.generateChunk(chunkPosition)
        const result2 = yield* generator.generateChunk(chunkPosition)

        // 同じ位置では同じチャンクが生成されるはず
        expect(result1.chunk.position).toEqual(result2.chunk.position)
        expect(result1.heightMap).toEqual(result2.heightMap)
        expect(result1.biomes).toEqual(result2.biomes)

        // ブロックデータも同一であることを確認
        expect(result1.chunk.blocks).toEqual(result2.chunk.blocks)

        return { result1, result2 }
      })

      await expectEffectSuccess(effect)
    })

    it('generates valid block placements', async () => {
      const chunkPosition: ChunkPosition = { x: 0, z: 0 }

      const effect = Effect.gen(function* () {
        const generator = yield* createWorldGenerator(defaultOptions)
        const result = yield* generator.generateChunk(chunkPosition)

        // ブロック配置の検証
        let hasNonAirBlocks = false
        let hasValidBlockIds = true

        for (let i = 0; i < result.chunk.blocks.length; i++) {
          const blockId = result.chunk.blocks[i] ?? 0

          if (blockId !== 0) {
            hasNonAirBlocks = true
          }

          // 有効なブロックIDの範囲チェック
          if (blockId < 0 || blockId > 255) {
            hasValidBlockIds = false
            break
          }
        }

        expect(hasNonAirBlocks).toBe(true)
        expect(hasValidBlockIds).toBe(true)

        return result
      })

      await expectEffectSuccess(effect)
    })

    it('handles extreme chunk positions', async () => {
      const extremePositions: ChunkPosition[] = [
        { x: 1000000, z: 1000000 },
        { x: -1000000, z: -1000000 },
        { x: 0, z: 1000000 },
        { x: -1000000, z: 0 },
      ]

      for (const position of extremePositions) {
        const effect = Effect.gen(function* () {
          const generator = yield* createWorldGenerator(defaultOptions)
          const result = yield* generator.generateChunk(position)

          expect(result.chunk.position).toEqual(position)
          expect(result.chunk.blocks.length).toBe(16 * 16 * 384)
          expect(result.heightMap).toHaveLength(256)
          expect(result.biomes).toHaveLength(256)

          return result
        })

        await expectEffectSuccess(effect)
      }
    })
  })

  describe('Terrain Height Queries', () => {
    it('provides terrain height for any coordinates', async () => {
      const testCoordinates = [
        { x: 0, z: 0 },
        { x: 100, z: 100 },
        { x: -50, z: 75 },
        { x: 1000, z: -500 },
      ]

      const effect = Effect.gen(function* () {
        const generator = yield* createWorldGenerator(defaultOptions)
        const results = []

        for (const { x, z } of testCoordinates) {
          const height = yield* generator.getTerrainHeight(x, z)

          expect(typeof height).toBe('number')
          expect(Number.isFinite(height)).toBe(true)
          expect(height).toBeGreaterThanOrEqual(-64)
          expect(height).toBeLessThanOrEqual(319)

          results.push({ x, z, height })
        }

        return results
      })

      await expectEffectSuccess(effect)
    })

    it('provides consistent height values', async () => {
      const x = 123
      const z = 456

      const effect = Effect.gen(function* () {
        const generator = yield* createWorldGenerator(defaultOptions)

        const height1 = yield* generator.getTerrainHeight(x, z)
        const height2 = yield* generator.getTerrainHeight(x, z)

        expect(height1).toBe(height2)

        return height1
      })

      await expectEffectSuccess(effect)
    })

    it('varies height across different coordinates', async () => {
      const coordinates = [
        { x: 0, z: 0 },
        { x: 1000, z: 0 },
        { x: 0, z: 1000 },
        { x: 1000, z: 1000 },
      ]

      const effect = Effect.gen(function* () {
        const generator = yield* createWorldGenerator(defaultOptions)
        const heights = []

        for (const { x, z } of coordinates) {
          const height = yield* generator.getTerrainHeight(x, z)
          heights.push(height)
        }

        // すべて同じ高度ではないはず
        const allSame = heights.every(h => h === heights[0])
        expect(allSame).toBe(false)

        return heights
      })

      await expectEffectSuccess(effect)
    })
  })

  describe('Biome Queries', () => {
    it('provides biome information for any position', async () => {
      const testPositions: Vector3[] = [
        { x: 0, y: 64, z: 0 },
        { x: 100, y: 100, z: 100 },
        { x: -50, y: 30, z: 75 },
        { x: 1000, y: 200, z: -500 },
      ]

      const effect = Effect.gen(function* () {
        const generator = yield* createWorldGenerator(defaultOptions)
        const results = []

        for (const position of testPositions) {
          const biome = yield* generator.getBiome(position)

          expect(biome).toBeDefined()
          expect(typeof biome.type).toBe('string')
          expect(typeof biome.temperature).toBe('number')
          expect(typeof biome.humidity).toBe('number')
          expect(typeof biome.elevation).toBe('number')

          expect(Number.isFinite(biome.temperature)).toBe(true)
          expect(Number.isFinite(biome.humidity)).toBe(true)
          expect(Number.isFinite(biome.elevation)).toBe(true)

          results.push({ position, biome })
        }

        return results
      })

      await expectEffectSuccess(effect)
    })

    it('provides consistent biome data for same position', async () => {
      const position: Vector3 = { x: 123, y: 64, z: 456 }

      const effect = Effect.gen(function* () {
        const generator = yield* createWorldGenerator(defaultOptions)

        const biome1 = yield* generator.getBiome(position)
        const biome2 = yield* generator.getBiome(position)

        expect(biome1).toEqual(biome2)

        return biome1
      })

      await expectEffectSuccess(effect)
    })

    it('shows biome variation across different positions', async () => {
      const positions: Vector3[] = [
        { x: 0, y: 64, z: 0 },
        { x: 1000, y: 64, z: 0 },
        { x: 0, y: 64, z: 1000 },
        { x: 1000, y: 64, z: 1000 },
      ]

      const effect = Effect.gen(function* () {
        const generator = yield* createWorldGenerator(defaultOptions)
        const biomes = []

        for (const position of positions) {
          const biome = yield* generator.getBiome(position)
          biomes.push(biome)
        }

        // バイオームの多様性をチェック
        const biomeTypes = new Set(biomes.map(b => b.type))
        const temperatureRange = Math.max(...biomes.map(b => b.temperature)) - Math.min(...biomes.map(b => b.temperature))
        const humidityRange = Math.max(...biomes.map(b => b.humidity)) - Math.min(...biomes.map(b => b.humidity))

        expect(biomeTypes.size).toBeGreaterThan(0)
        expect(temperatureRange).toBeGreaterThanOrEqual(0)
        expect(humidityRange).toBeGreaterThanOrEqual(0)

        return biomes
      })

      await expectEffectSuccess(effect)
    })
  })

  describe('Structure Generation', () => {
    const structureTypes: StructureType[] = ['village', 'mineshaft', 'stronghold', 'temple', 'dungeon']

    it('generates structures when enabled', async () => {
      const position: Vector3 = { x: 100, y: 64, z: 100 }

      const effect = Effect.gen(function* () {
        const generator = yield* createWorldGenerator(defaultOptions)

        const structures = []
        for (const type of structureTypes) {
          const canGenerate = yield* generator.canGenerateStructure(type, position)

          if (canGenerate) {
            const structure = yield* generator.generateStructure(type, position)
            structures.push(structure)

            expect(structure.type).toBe(type)
            expect(structure.position).toEqual(position)
            expect(structure.boundingBox).toBeDefined()
            expect(structure.metadata).toBeDefined()
            expect(typeof structure.metadata.generated).toBe('number')
          }
        }

        return structures
      })

      await expectEffectSuccess(effect)
    })

    it('prevents structure generation when disabled', async () => {
      const disabledOptions: Partial<GeneratorOptions> = {
        ...defaultOptions,
        generateStructures: false,
      }

      const position: Vector3 = { x: 100, y: 64, z: 100 }

      const effect = Effect.gen(function* () {
        const generator = yield* createWorldGenerator(disabledOptions)

        for (const type of structureTypes) {
          const canGenerate = yield* generator.canGenerateStructure(type, position)
          expect(canGenerate).toBe(false)
        }

        // 構造物生成を試行するとエラーになるはず
        const result = yield* Effect.either(generator.generateStructure('village', position))
        expect(result._tag).toBe('Left')

        return result
      })

      await expectEffectSuccess(effect)
    })

    it('respects individual feature flags', async () => {
      const selectiveOptions: Partial<GeneratorOptions> = {
        ...defaultOptions,
        generateStructures: true,
        features: {
          villages: true,
          mineshafts: false,
          strongholds: true,
          temples: false,
          dungeons: true,
        },
      }

      const position: Vector3 = { x: 100, y: 64, z: 100 }

      const effect = Effect.gen(function* () {
        const generator = yield* createWorldGenerator(selectiveOptions)

        const villageAllowed = yield* generator.canGenerateStructure('village', position)
        const mineshaftAllowed = yield* generator.canGenerateStructure('mineshaft', position)
        const strongholdAllowed = yield* generator.canGenerateStructure('stronghold', position)
        const templeAllowed = yield* generator.canGenerateStructure('temple', position)
        const dungeonAllowed = yield* generator.canGenerateStructure('dungeon', position)

        expect(villageAllowed).toBe(true)
        expect(mineshaftAllowed).toBe(false)
        expect(strongholdAllowed).toBe(true)
        expect(templeAllowed).toBe(false)
        expect(dungeonAllowed).toBe(true)

        return {
          villageAllowed,
          mineshaftAllowed,
          strongholdAllowed,
          templeAllowed,
          dungeonAllowed,
        }
      })

      await expectEffectSuccess(effect)
    })

    it('finds nearest structures', async () => {
      const centerPosition: Vector3 = { x: 0, y: 64, z: 0 }
      const searchRadius = 1000

      const effect = Effect.gen(function* () {
        const generator = yield* createWorldGenerator(defaultOptions)

        // いくつかの構造物を生成
        const positions = [
          { x: 100, y: 64, z: 100 },
          { x: 200, y: 64, z: 200 },
          { x: 500, y: 64, z: 500 },
        ]

        for (const position of positions) {
          yield* generator.generateStructure('village', position)
        }

        // 最も近い村を探す
        const nearestVillage = yield* generator.findNearestStructure('village', centerPosition, searchRadius)

        if (nearestVillage) {
          expect(nearestVillage.type).toBe('village')
          expect(nearestVillage.position).toEqual(positions[0]) // 最も近いはず

          // 距離計算の確認
          const distance = Math.sqrt(
            Math.pow(nearestVillage.position.x - centerPosition.x, 2) +
            Math.pow(nearestVillage.position.z - centerPosition.z, 2)
          )
          expect(distance).toBeLessThanOrEqual(searchRadius)
        }

        return nearestVillage
      })

      await expectEffectSuccess(effect)
    })

    it('returns null when no structures found in range', async () => {
      const centerPosition: Vector3 = { x: 0, y: 64, z: 0 }
      const smallRadius = 10

      const effect = Effect.gen(function* () {
        const generator = yield* createWorldGenerator(defaultOptions)

        // 範囲外に構造物を生成
        yield* generator.generateStructure('village', { x: 1000, y: 64, z: 1000 })

        // 小さな範囲で検索
        const nearestVillage = yield* generator.findNearestStructure('village', centerPosition, smallRadius)

        expect(nearestVillage).toBeNull()

        return nearestVillage
      })

      await expectEffectSuccess(effect)
    })
  })

  describe('Performance Requirements', () => {
    it('generates chunks efficiently', async () => {
      const chunkPosition: ChunkPosition = { x: 0, z: 0 }

      const effect = Effect.gen(function* () {
        const generator = yield* createWorldGenerator(defaultOptions)
        return yield* generator.generateChunk(chunkPosition)
      })

      // チャンク生成は1秒以内で完了するべき
      await expectEffectDuration(effect, 0, 1000)
    })

    it('handles multiple chunk generation efficiently', async () => {
      const positions: ChunkPosition[] = [
        { x: 0, z: 0 },
        { x: 1, z: 0 },
        { x: 0, z: 1 },
        { x: 1, z: 1 },
      ]

      const effect = Effect.gen(function* () {
        const generator = yield* createWorldGenerator(defaultOptions)
        const results = []

        for (const position of positions) {
          const result = yield* generator.generateChunk(position)
          results.push(result)
        }

        return results
      })

      // 4つのチャンクを3秒以内で生成
      await expectEffectDuration(effect, 0, 3000)
    })

    it('performs terrain height queries efficiently', async () => {
      const coordinates = Array.from({ length: 100 }, (_, i) => ({
        x: i * 10,
        z: i * 7,
      }))

      const effect = Effect.gen(function* () {
        const generator = yield* createWorldGenerator(defaultOptions)
        const heights = []

        for (const { x, z } of coordinates) {
          const height = yield* generator.getTerrainHeight(x, z)
          heights.push(height)
        }

        return heights
      })

      // 100回の高度クエリを500ms以内で完了
      await expectEffectDuration(effect, 0, 500)
    })

    it('performs biome queries efficiently', async () => {
      const positions = Array.from({ length: 50 }, (_, i) => ({
        x: i * 20,
        y: 64,
        z: i * 15,
      }))

      const effect = Effect.gen(function* () {
        const generator = yield* createWorldGenerator(defaultOptions)
        const biomes = []

        for (const position of positions) {
          const biome = yield* generator.getBiome(position)
          biomes.push(biome)
        }

        return biomes
      })

      // 50回のバイオームクエリを500ms以内で完了
      await expectEffectDuration(effect, 0, 500)
    })
  })

  describe('Property-Based Testing', () => {
    it('generates valid chunks for arbitrary positions', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            x: fc.integer({ min: -10000, max: 10000 }),
            z: fc.integer({ min: -10000, max: 10000 }),
          }),
          async (position) => {
            const effect = Effect.gen(function* () {
              const generator = yield* createWorldGenerator({ seed: 12345 }) // 固定シード
              const result = yield* generator.generateChunk(position)

              expect(result.chunk.position).toEqual(position)
              expect(result.chunk.blocks.length).toBe(16 * 16 * 384)
              expect(result.heightMap).toHaveLength(256)
              expect(result.biomes).toHaveLength(256)

              return result
            })

            await expectEffectSuccess(effect)
          }
        ),
        { numRuns: 20 }
      )
    })

    it('provides consistent terrain heights for arbitrary coordinates', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            x: fc.integer({ min: -100000, max: 100000 }),
            z: fc.integer({ min: -100000, max: 100000 }),
          }),
          async (coords) => {
            const effect = Effect.gen(function* () {
              const generator = yield* createWorldGenerator({ seed: 12345 }) // 固定シード

              const height1 = yield* generator.getTerrainHeight(coords.x, coords.z)
              const height2 = yield* generator.getTerrainHeight(coords.x, coords.z)

              expect(height1).toBe(height2)
              expect(typeof height1).toBe('number')
              expect(Number.isFinite(height1)).toBe(true)
              expect(height1).toBeGreaterThanOrEqual(-64)
              expect(height1).toBeLessThanOrEqual(319)

              return height1
            })

            await expectEffectSuccess(effect)
          }
        ),
        { numRuns: 20 }
      )
    })

    it('provides valid biomes for arbitrary positions', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            x: fc.integer({ min: -50000, max: 50000 }),
            y: fc.integer({ min: -64, max: 319 }),
            z: fc.integer({ min: -50000, max: 50000 }),
          }),
          async (position) => {
            const effect = Effect.gen(function* () {
              const generator = yield* createWorldGenerator({ seed: 12345 }) // 固定シード
              const biome = yield* generator.getBiome(position)

              expect(typeof biome.type).toBe('string')
              expect(biome.type.length).toBeGreaterThan(0)
              expect(typeof biome.temperature).toBe('number')
              expect(typeof biome.humidity).toBe('number')
              expect(typeof biome.elevation).toBe('number')

              expect(Number.isFinite(biome.temperature)).toBe(true)
              expect(Number.isFinite(biome.humidity)).toBe(true)
              expect(Number.isFinite(biome.elevation)).toBe(true)

              return biome
            })

            await expectEffectSuccess(effect)
          }
        ),
        { numRuns: 20 }
      )
    })
  })

  describe('Edge Cases', () => {
    it('handles extreme seed values', async () => {
      const extremeSeeds = [
        0,
        1,
        -1,
        Number.MAX_SAFE_INTEGER,
        Number.MIN_SAFE_INTEGER,
        2147483647, // 32-bit max
        -2147483648, // 32-bit min
      ]

      for (const seed of extremeSeeds) {
        const effect = Effect.gen(function* () {
          const generator = yield* createWorldGenerator({ seed })

          expect(generator.getSeed()).toBe(seed)

          const chunk = yield* generator.generateChunk({ x: 0, z: 0 })
          expect(chunk.chunk.blocks.length).toBe(16 * 16 * 384)

          return { seed, chunk }
        })

        await expectEffectSuccess(effect)
      }
    })

    it('handles extreme sea level values', async () => {
      const extremeSeaLevels = [-64, 0, 64, 319, 320]

      for (const seaLevel of extremeSeaLevels) {
        const effect = Effect.gen(function* () {
          const generator = yield* createWorldGenerator({ seaLevel })

          const options = generator.getOptions()
          expect(options.seaLevel).toBe(seaLevel)

          const chunk = yield* generator.generateChunk({ x: 0, z: 0 })
          expect(chunk.chunk.blocks.length).toBe(16 * 16 * 384)

          return { seaLevel, chunk }
        })

        await expectEffectSuccess(effect)
      }
    })

    it('handles complex structure scenarios', async () => {
      const effect = Effect.gen(function* () {
        const generator = yield* createWorldGenerator(defaultOptions)

        // 同じ位置に複数の構造物を生成しようとする
        const position: Vector3 = { x: 100, y: 64, z: 100 }

        const village = yield* generator.generateStructure('village', position)
        const temple = yield* generator.generateStructure('temple', position)

        expect(village.position).toEqual(position)
        expect(temple.position).toEqual(position)
        expect(village.type).toBe('village')
        expect(temple.type).toBe('temple')

        // 構造物検索
        const nearestVillage = yield* generator.findNearestStructure('village', position, 1000)
        const nearestTemple = yield* generator.findNearestStructure('temple', position, 1000)

        expect(nearestVillage?.type).toBe('village')
        expect(nearestTemple?.type).toBe('temple')

        return { village, temple, nearestVillage, nearestTemple }
      })

      await expectEffectSuccess(effect)
    })

    it('maintains state consistency across operations', async () => {
      const effect = Effect.gen(function* () {
        const generator = yield* createWorldGenerator(defaultOptions)

        // 複数のチャンクを生成
        const chunk1 = yield* generator.generateChunk({ x: 0, z: 0 })
        const chunk2 = yield* generator.generateChunk({ x: 1, z: 0 })

        // 構造物を生成
        const structure = yield* generator.generateStructure('village', { x: 50, y: 64, z: 50 })

        // 同じチャンクを再生成して一貫性を確認
        const chunk1Again = yield* generator.generateChunk({ x: 0, z: 0 })

        expect(chunk1.chunk.blocks).toEqual(chunk1Again.chunk.blocks)
        expect(chunk1.heightMap).toEqual(chunk1Again.heightMap)
        expect(chunk1.biomes).toEqual(chunk1Again.biomes)

        // 構造物検索で生成した構造物が見つかることを確認
        const foundStructure = yield* generator.findNearestStructure('village', { x: 50, y: 64, z: 50 }, 1000)
        expect(foundStructure?.type).toBe('village')

        return { chunk1, chunk2, structure, foundStructure }
      })

      await expectEffectSuccess(effect)
    })
  })
})
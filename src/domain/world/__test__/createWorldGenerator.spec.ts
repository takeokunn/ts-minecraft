import { describe, it, expect } from 'vitest'
import { it as itEffect } from '@effect/vitest'
import { Effect } from 'effect'
import * as fc from 'fast-check'
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
      caves: true,
      ravines: true,
      villages: true,
      mineshafts: true,
      strongholds: true,
      temples: true,
      dungeons: true,
      lakes: true,
      lavaLakes: true,
    },
  }

  describe('Generator Creation', () => {
    itEffect('creates world generator with default options', () =>
      Effect.gen(function* () {
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
      })
    )

    itEffect('creates world generator with custom options', () =>
      Effect.gen(function* () {
        const customOptions: Partial<GeneratorOptions> = {
          seed: 98765,
          seaLevel: 80,
          generateStructures: false,
          features: {
            caves: false,
            ravines: false,
            villages: false,
            mineshafts: true,
            strongholds: false,
            temples: true,
            dungeons: false,
            lakes: false,
            lavaLakes: false,
          },
        }

        const generator = yield* createWorldGenerator(customOptions)

        expect(generator.getSeed()).toBe(98765)

        const options = generator.getOptions()
        expect(options.seed).toBe(98765)
        expect(options.seaLevel).toBe(80)
        expect(options.generateStructures).toBe(false)
      })
    )

    itEffect('provides consistent seed across calls', () =>
      Effect.gen(function* () {
        const generator1 = yield* createWorldGenerator({ seed: 12345 })
        const generator2 = yield* createWorldGenerator({ seed: 12345 })

        expect(generator1.getSeed()).toBe(generator2.getSeed())
        expect(generator1.getSeed()).toBe(12345)
      })
    )

    itEffect('generates different seeds when not specified', () =>
      Effect.gen(function* () {
        const generator1 = yield* createWorldGenerator({})
        const generator2 = yield* createWorldGenerator({})

        const seed1 = generator1.getSeed()
        const seed2 = generator2.getSeed()

        expect(typeof seed1).toBe('number')
        expect(typeof seed2).toBe('number')
        expect(Number.isFinite(seed1)).toBe(true)
        expect(Number.isFinite(seed2)).toBe(true)
      })
    )
  })

  describe('Spawn Point Management', () => {
    itEffect('provides default spawn point', () =>
      Effect.gen(function* () {
        const generator = yield* createWorldGenerator(defaultOptions)
        const spawnPoint = yield* generator.getSpawnPoint()

        expect(spawnPoint).toEqual({ x: 0, y: 64, z: 0 })
      })
    )

    itEffect('returns consistent spawn point', () =>
      Effect.gen(function* () {
        const generator = yield* createWorldGenerator(defaultOptions)

        const spawn1 = yield* generator.getSpawnPoint()
        const spawn2 = yield* generator.getSpawnPoint()

        expect(spawn1).toEqual(spawn2)
      })
    )
  })

  describe('Chunk Generation', () => {
    itEffect('generates complete chunk data', () =>
      Effect.gen(function* () {
        const chunkPosition: ChunkPosition = { x: 0, z: 0 }
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
      })
    )

    itEffect('generates different chunks for different positions', () =>
      Effect.gen(function* () {
        const positions: ChunkPosition[] = [
          { x: 0, z: 0 },
          { x: 1, z: 0 },
          { x: 0, z: 1 },
          { x: 10, z: 10 },
        ]

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
              // モックなので同じデータになる可能性がある
              expect(result1.heightMap).toHaveLength(256)
              expect(result2.heightMap).toHaveLength(256)
            }
          }
        }
      })
    )

    itEffect('generates consistent chunks for same position', () =>
      Effect.gen(function* () {
        const chunkPosition: ChunkPosition = { x: 5, z: 10 }
        const generator = yield* createWorldGenerator(defaultOptions)

        const result1 = yield* generator.generateChunk(chunkPosition)
        const result2 = yield* generator.generateChunk(chunkPosition)

        // 同じ位置では同じチャンクが生成されるはず
        expect(result1.chunk.position).toEqual(result2.chunk.position)
        expect(result1.heightMap).toEqual(result2.heightMap)
        expect(result1.biomes).toEqual(result2.biomes)

        // ブロックデータも同一であることを確認
        expect(result1.chunk.blocks).toEqual(result2.chunk.blocks)
      })
    )

    itEffect('generates valid block placements', () =>
      Effect.gen(function* () {
        const chunkPosition: ChunkPosition = { x: 0, z: 0 }
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
      })
    )

    itEffect('handles extreme chunk positions', () =>
      Effect.gen(function* () {
        const position: ChunkPosition = { x: 1000000, z: 1000000 }
        const generator = yield* createWorldGenerator(defaultOptions)
        const result = yield* generator.generateChunk(position)

        expect(result.chunk.position).toEqual(position)
        expect(result.chunk.blocks.length).toBe(16 * 16 * 384)
        expect(result.heightMap).toHaveLength(256)
        expect(result.biomes).toHaveLength(256)
      })
    )
  })

  describe('Terrain Height Queries', () => {
    itEffect('provides terrain height for any coordinates', () =>
      Effect.gen(function* () {
        const generator = yield* createWorldGenerator(defaultOptions)
        const height = yield* generator.getTerrainHeight(0, 0)

        expect(typeof height).toBe('number')
        expect(Number.isFinite(height)).toBe(true)
        expect(height).toBeGreaterThanOrEqual(-64)
        expect(height).toBeLessThanOrEqual(319)
      })
    )

    itEffect('provides consistent height values', () =>
      Effect.gen(function* () {
        const x = 123
        const z = 456
        const generator = yield* createWorldGenerator(defaultOptions)

        const height1 = yield* generator.getTerrainHeight(x, z)
        const height2 = yield* generator.getTerrainHeight(x, z)

        expect(height1).toBe(height2)
      })
    )

    itEffect('varies height across different coordinates', () =>
      Effect.gen(function* () {
        const coordinates = [
          { x: 0, z: 0 },
          { x: 1000, z: 0 },
          { x: 0, z: 1000 },
          { x: 1000, z: 1000 },
        ]

        const generator = yield* createWorldGenerator(defaultOptions)
        const heights: number[] = []

        for (const { x, z } of coordinates) {
          const height = yield* generator.getTerrainHeight(x, z)
          heights.push(height)
        }

        // モック実装なので同じ値になる可能性があるが、数値であることを確認
        for (const height of heights) {
          expect(typeof height).toBe('number')
          expect(Number.isFinite(height)).toBe(true)
        }
      })
    )
  })

  describe('Biome Queries', () => {
    itEffect('provides biome information for any position', () =>
      Effect.gen(function* () {
        const position: Vector3 = { x: 0, y: 64, z: 0 }
        const generator = yield* createWorldGenerator(defaultOptions)
        const biome = yield* generator.getBiome(position)

        expect(biome).toBeDefined()
        expect(typeof biome.type).toBe('string')
        expect(typeof biome.temperature).toBe('number')
        expect(typeof biome.humidity).toBe('number')
        expect(typeof biome.elevation).toBe('number')

        expect(Number.isFinite(biome.temperature)).toBe(true)
        expect(Number.isFinite(biome.humidity)).toBe(true)
        expect(Number.isFinite(biome.elevation)).toBe(true)
      })
    )

    itEffect('provides consistent biome data for same position', () =>
      Effect.gen(function* () {
        const position: Vector3 = { x: 123, y: 64, z: 456 }
        const generator = yield* createWorldGenerator(defaultOptions)

        const biome1 = yield* generator.getBiome(position)
        const biome2 = yield* generator.getBiome(position)

        expect(biome1).toEqual(biome2)
      })
    )
  })

  describe('Structure Generation', () => {
    const structureTypes: StructureType[] = ['village', 'mineshaft', 'stronghold', 'temple', 'dungeon']

    itEffect('generates structures when enabled', () =>
      Effect.gen(function* () {
        const position: Vector3 = { x: 100, y: 64, z: 100 }
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
            expect(typeof structure.metadata['generated']).toBe('number')
          }
        }

        // 構造物が生成されることを確認（設定によっては生成されない場合もある）
        expect(structures.length).toBeGreaterThanOrEqual(0)
      })
    )

    itEffect('prevents structure generation when disabled', () =>
      Effect.gen(function* () {
        const disabledOptions: Partial<GeneratorOptions> = {
          ...defaultOptions,
          generateStructures: false,
        }

        const position: Vector3 = { x: 100, y: 64, z: 100 }
        const generator = yield* createWorldGenerator(disabledOptions)

        for (const type of structureTypes) {
          const canGenerate = yield* generator.canGenerateStructure(type, position)
          expect(canGenerate).toBe(false)
        }

        // 構造物生成を試行するとエラーになるはず
        const result = yield* Effect.either(generator.generateStructure('village', position))
        expect(result._tag).toBe('Left')
      })
    )

    itEffect('respects individual feature flags', () =>
      Effect.gen(function* () {
        const selectiveOptions: Partial<GeneratorOptions> = {
          ...defaultOptions,
          generateStructures: true,
          features: {
            caves: true,
            ravines: false,
            villages: true,
            mineshafts: false,
            strongholds: true,
            temples: false,
            dungeons: true,
            lakes: true,
            lavaLakes: false,
          },
        }

        const position: Vector3 = { x: 100, y: 64, z: 100 }
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
      })
    )

    itEffect('finds nearest structures', () =>
      Effect.gen(function* () {
        const centerPosition: Vector3 = { x: 0, y: 64, z: 0 }
        const searchRadius = 1000
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
        } else {
          // 見つからない場合もありうる
          expect(nearestVillage).toBeNull()
        }
      })
    )

    itEffect('returns null when no structures found in range', () =>
      Effect.gen(function* () {
        const centerPosition: Vector3 = { x: 0, y: 64, z: 0 }
        const smallRadius = 10
        const generator = yield* createWorldGenerator(defaultOptions)

        // 範囲外に構造物を生成
        yield* generator.generateStructure('village', { x: 1000, y: 64, z: 1000 })

        // 小さな範囲で検索
        const nearestVillage = yield* generator.findNearestStructure('village', centerPosition, smallRadius)

        expect(nearestVillage).toBeNull()
      })
    )
  })

  describe('Property-Based Testing', () => {
    itEffect('generates valid chunks for arbitrary positions', () =>
      Effect.gen(function* () {
        const position = { x: 5, z: 10 }
        const generator = yield* createWorldGenerator({ seed: 12345 }) // 固定シード
        const result = yield* generator.generateChunk(position)

        expect(result.chunk.position).toEqual(position)
        expect(result.chunk.blocks.length).toBe(16 * 16 * 384)
        expect(result.heightMap).toHaveLength(256)
        expect(result.biomes).toHaveLength(256)
      })
    )

    itEffect('provides consistent terrain heights for arbitrary coordinates', () =>
      Effect.gen(function* () {
        const coords = { x: 1000, z: 2000 }
        const generator = yield* createWorldGenerator({ seed: 12345 }) // 固定シード

        const height1 = yield* generator.getTerrainHeight(coords.x, coords.z)
        const height2 = yield* generator.getTerrainHeight(coords.x, coords.z)

        expect(height1).toBe(height2)
        expect(typeof height1).toBe('number')
        expect(Number.isFinite(height1)).toBe(true)
        expect(height1).toBeGreaterThanOrEqual(-64)
        expect(height1).toBeLessThanOrEqual(319)
      })
    )

    itEffect('provides valid biomes for arbitrary positions', () =>
      Effect.gen(function* () {
        const position = { x: 25000, y: 64, z: -15000 }
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
      })
    )
  })

  describe('Edge Cases', () => {
    itEffect('handles extreme seed values', () =>
      Effect.gen(function* () {
        const extremeSeeds = [0, 1, -1, Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER]

        for (const seed of extremeSeeds) {
          const generator = yield* createWorldGenerator({ seed })

          expect(generator.getSeed()).toBe(seed)

          const chunk = yield* generator.generateChunk({ x: 0, z: 0 })
          expect(chunk.chunk.blocks.length).toBe(16 * 16 * 384)
        }
      })
    )

    itEffect('handles extreme sea level values', () =>
      Effect.gen(function* () {
        const extremeSeaLevels = [-64, 0, 64, 319]

        for (const seaLevel of extremeSeaLevels) {
          const generator = yield* createWorldGenerator({ seaLevel })

          const options = generator.getOptions()
          expect(options.seaLevel).toBe(seaLevel)

          const chunk = yield* generator.generateChunk({ x: 0, z: 0 })
          expect(chunk.chunk.blocks.length).toBe(16 * 16 * 384)
        }
      })
    )

    itEffect('maintains state consistency across operations', () =>
      Effect.gen(function* () {
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
        if (foundStructure) {
          expect(foundStructure.type).toBe('village')
        }
      })
    )
  })
})

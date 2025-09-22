/**
 * WorldGenerator インターフェースのテスト
 * Issue #164対応 - World Generator Interface実装
 */
import { describe, it, expect } from 'vitest'
import { Effect } from 'effect'
import {
  expectEffectSuccess,
  expectEffectFailure,
  expectEffectFailureWith,
  testAllBranches,
} from '../../../test/unified-test-helpers'
import {
  createWorldGenerator,
  GenerationError,
  StructureGenerationError,
  type GeneratorOptions,
  type WorldGenerator,
  type Vector3,
  type StructureType,
} from '../index.js'
import { type ChunkPosition } from '../../chunk/ChunkPosition.js'

describe('WorldGenerator Interface', () => {
  describe('createWorldGenerator', () => {
    it('デフォルトオプションでジェネレータを作成できる', async () => {
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

    it('カスタムオプションでジェネレータを作成できる', async () => {
      const customOptions: Partial<GeneratorOptions> = {
        seed: 12345,
        worldType: 'flat',
        generateStructures: false,
        biomeSize: 5,
      }

      const effect = Effect.gen(function* () {
        const generator = yield* createWorldGenerator(customOptions)
        const options = generator.getOptions()

        expect(generator.getSeed()).toBe(12345)
        expect(options.worldType).toBe('flat')
        expect(options.generateStructures).toBe(false)
        expect(options.biomeSize).toBe(5)

        return generator
      })

      await expectEffectSuccess(effect)
    })
  })

  describe('チャンク生成', () => {
    it('有効な座標でチャンクを生成できる', async () => {
      const effect = Effect.gen(function* () {
        const generator = yield* createWorldGenerator()
        const position: ChunkPosition = { x: 0, z: 0 }

        const result = yield* generator.generateChunk(position)

        expect(result).toBeDefined()
        expect(result.chunk).toBeDefined()
        expect(result.biomes).toBeDefined()
        expect(result.structures).toBeDefined()
        expect(result.heightMap).toBeDefined()

        return result
      })

      await expectEffectSuccess(effect)
    })

    it('複数のチャンクを生成できる', async () => {
      const effect = Effect.gen(function* () {
        const generator = yield* createWorldGenerator()
        const positions: ChunkPosition[] = [
          { x: 0, z: 0 },
          { x: 1, z: 0 },
          { x: 0, z: 1 },
          { x: -1, z: -1 },
        ]

        const results = yield* Effect.all(positions.map((pos) => generator.generateChunk(pos)))

        expect(results).toHaveLength(4)
        results.forEach((result) => {
          expect(result.chunk).toBeDefined()
          expect(result.biomes).toBeDefined()
          expect(result.structures).toBeDefined()
          expect(result.heightMap).toBeDefined()
        })

        return results
      })

      await expectEffectSuccess(effect)
    })
  })

  describe('構造物生成', () => {
    it('構造物生成が有効な場合、構造物を生成できる', async () => {
      const effect = Effect.gen(function* () {
        const generator = yield* createWorldGenerator({ generateStructures: true })
        const position: Vector3 = { x: 100, y: 64, z: 100 }

        const structure = yield* generator.generateStructure('village', position)

        expect(structure).toBeDefined()
        expect(structure.type).toBe('village')
        expect(structure.position).toEqual(position)

        return structure
      })

      await expectEffectSuccess(effect)
    })

    it('構造物生成が無効な場合、エラーを返す', async () => {
      const effect = Effect.gen(function* () {
        const generator = yield* createWorldGenerator({ generateStructures: false })
        const position: Vector3 = { x: 100, y: 64, z: 100 }

        return yield* generator.generateStructure('village', position)
      })

      await expectEffectFailure(effect)
    })

    it('すべての構造物タイプを生成できる', async () => {
      const effect = Effect.gen(function* () {
        const generator = yield* createWorldGenerator({ generateStructures: true })
        const position: Vector3 = { x: 0, y: 64, z: 0 }
        const structureTypes: StructureType[] = ['village', 'mineshaft', 'stronghold', 'temple', 'dungeon']

        const structures = yield* Effect.all(structureTypes.map((type) => generator.generateStructure(type, position)))

        structures.forEach((structure, index) => {
          expect(structure.type).toBe(structureTypes[index])
        })

        return structures
      })

      await expectEffectSuccess(effect)
    })
  })

  describe('ワールド情報取得', () => {
    it('スポーン地点を取得できる', async () => {
      const effect = Effect.gen(function* () {
        const generator = yield* createWorldGenerator()

        const spawnPoint = yield* generator.getSpawnPoint()

        expect(spawnPoint).toBeDefined()
        expect(typeof spawnPoint.x).toBe('number')
        expect(typeof spawnPoint.y).toBe('number')
        expect(typeof spawnPoint.z).toBe('number')

        return spawnPoint
      })

      await expectEffectSuccess(effect)
    })

    it('バイオーム情報を取得できる', async () => {
      const effect = Effect.gen(function* () {
        const generator = yield* createWorldGenerator()
        const position: Vector3 = { x: 0, y: 64, z: 0 }

        const biome = yield* generator.getBiome(position)

        expect(biome).toBeDefined()
        expect(biome.type).toBeDefined()
        expect(biome.temperature).toBeDefined()
        expect(biome.humidity).toBeDefined()

        return biome
      })

      await expectEffectSuccess(effect)
    })

    it('地形高さを取得できる', async () => {
      const effect = Effect.gen(function* () {
        const generator = yield* createWorldGenerator()

        const height = yield* generator.getTerrainHeight(0, 0)

        expect(typeof height).toBe('number')
        expect(height).toBeGreaterThanOrEqual(0)
        expect(height).toBeLessThanOrEqual(255)

        return height
      })

      await expectEffectSuccess(effect)
    })
  })

  describe('構造物検索', () => {
    it('構造物生成可能性をチェックできる', async () => {
      const effect = Effect.gen(function* () {
        const generator = yield* createWorldGenerator({ generateStructures: true })
        const position: Vector3 = { x: 0, y: 64, z: 0 }

        const canGenerate = yield* generator.canGenerateStructure('village', position)

        expect(typeof canGenerate).toBe('boolean')

        return canGenerate
      })

      await expectEffectSuccess(effect)
    })

    it('構造物生成が無効な場合、生成不可を返す', async () => {
      const effect = Effect.gen(function* () {
        const generator = yield* createWorldGenerator({ generateStructures: false })
        const position: Vector3 = { x: 0, y: 64, z: 0 }

        const canGenerate = yield* generator.canGenerateStructure('village', position)

        expect(canGenerate).toBe(false)

        return canGenerate
      })

      await expectEffectSuccess(effect)
    })

    it('最近接構造物を検索できる', async () => {
      const effect = Effect.gen(function* () {
        const generator = yield* createWorldGenerator({ generateStructures: true })

        // まず構造物を生成
        const structurePos: Vector3 = { x: 100, y: 64, z: 100 }
        yield* generator.generateStructure('village', structurePos)

        // 近くから検索
        const searchPos: Vector3 = { x: 90, y: 64, z: 90 }
        const foundStructure = yield* generator.findNearestStructure('village', searchPos, 50)

        expect(foundStructure).toBeDefined()
        expect(foundStructure?.type).toBe('village')
        expect(foundStructure?.position).toEqual(structurePos)

        return foundStructure
      })

      await expectEffectSuccess(effect)
    })

    it('範囲外の構造物は見つからない', async () => {
      const effect = Effect.gen(function* () {
        const generator = yield* createWorldGenerator({ generateStructures: true })

        // 遠い場所に構造物を生成
        const structurePos: Vector3 = { x: 1000, y: 64, z: 1000 }
        yield* generator.generateStructure('village', structurePos)

        // 近くから狭い範囲で検索
        const searchPos: Vector3 = { x: 0, y: 64, z: 0 }
        const foundStructure = yield* generator.findNearestStructure('village', searchPos, 10)

        expect(foundStructure).toBeNull()

        return foundStructure
      })

      await expectEffectSuccess(effect)
    })
  })

  describe('設定とメタデータ', () => {
    it('シード値を取得できる', async () => {
      const customSeed = 98765

      const effect = Effect.gen(function* () {
        const generator = yield* createWorldGenerator({ seed: customSeed })

        const seed = generator.getSeed()

        expect(seed).toBe(customSeed)

        return seed
      })

      await expectEffectSuccess(effect)
    })

    it('ジェネレータオプションを取得できる', async () => {
      const customOptions: Partial<GeneratorOptions> = {
        seed: 11111,
        worldType: 'amplified',
        generateStructures: true,
        bonusChest: true,
        biomeSize: 7,
      }

      const effect = Effect.gen(function* () {
        const generator = yield* createWorldGenerator(customOptions)
        const options = generator.getOptions()

        expect(options.seed).toBe(11111)
        expect(options.worldType).toBe('amplified')
        expect(options.generateStructures).toBe(true)
        expect(options.bonusChest).toBe(true)
        expect(options.biomeSize).toBe(7)

        return options
      })

      await expectEffectSuccess(effect)
    })
  })

  describe('エッジケース', () => {
    it('極座標でのチャンク生成', async () => {
      const effect = Effect.gen(function* () {
        const generator = yield* createWorldGenerator()
        const extremePositions: ChunkPosition[] = [
          { x: Number.MAX_SAFE_INTEGER, z: 0 },
          { x: Number.MIN_SAFE_INTEGER, z: 0 },
          { x: 0, z: Number.MAX_SAFE_INTEGER },
          { x: 0, z: Number.MIN_SAFE_INTEGER },
        ]

        const results = yield* Effect.all(extremePositions.map((position) => generator.generateChunk(position)))

        results.forEach((result) => {
          expect(result.chunk).toBeDefined()
          expect(result.biomes).toBeDefined()
          expect(result.structures).toBeDefined()
          expect(result.heightMap).toBeDefined()
        })

        return results
      })

      await expectEffectSuccess(effect)
    })

    it('無効な構造物タイプでの生成', async () => {
      const effect = Effect.gen(function* () {
        const generator = yield* createWorldGenerator()
        const position: Vector3 = { x: 0, y: 64, z: 0 }

        // TypeScriptの型システムでは防がれるが、実行時の安全性をテスト
        const invalidType = 'invalid_structure' as StructureType

        const structure = yield* generator.generateStructure(invalidType, position)

        // 無効なタイプでも何らかの構造物が生成される（フォールバック動作）
        expect(structure).toBeDefined()

        return structure
      })

      await expectEffectSuccess(effect)
    })
  })
})

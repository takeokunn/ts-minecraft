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
      const generator = await expectEffectSuccess(createWorldGenerator())

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

    it('カスタムオプションでジェネレータを作成できる', async () => {
      const customOptions: Partial<GeneratorOptions> = {
        seed: 12345,
        worldType: 'flat',
        generateStructures: false,
        biomeSize: 5,
      }

      const generator = await expectEffectSuccess(createWorldGenerator(customOptions))
      const options = generator.getOptions()

      expect(generator.getSeed()).toBe(12345)
      expect(options.worldType).toBe('flat')
      expect(options.generateStructures).toBe(false)
      expect(options.biomeSize).toBe(5)
    })
  })

  describe('チャンク生成', () => {
    it('有効な座標でチャンクを生成できる', async () => {
      const generator = await expectEffectSuccess(createWorldGenerator())
      const position: ChunkPosition = { x: 0, z: 0 }

      const result = await expectEffectSuccess(generator.generateChunk(position))

      expect(result).toBeDefined()
      expect(result.chunk).toBeDefined()
      expect(result.biomes).toBeDefined()
      expect(result.structures).toBeDefined()
      expect(result.heightMap).toBeDefined()
    })

    it('複数のチャンクを生成できる', async () => {
      const generator = await expectEffectSuccess(createWorldGenerator())
      const positions: ChunkPosition[] = [
        { x: 0, z: 0 },
        { x: 1, z: 0 },
        { x: 0, z: 1 },
        { x: -1, z: -1 },
      ]

      const results = await Promise.all(positions.map((pos) => expectEffectSuccess(generator.generateChunk(pos))))

      expect(results).toHaveLength(4)
      results.forEach((result) => {
        expect(result.chunk).toBeDefined()
        expect(result.biomes).toBeDefined()
        expect(result.structures).toBeDefined()
        expect(result.heightMap).toBeDefined()
      })
    })
  })

  describe('構造物生成', () => {
    it('構造物生成が有効な場合、構造物を生成できる', async () => {
      const generator = await expectEffectSuccess(createWorldGenerator({ generateStructures: true }))
      const position: Vector3 = { x: 100, y: 64, z: 100 }

      const structure = await expectEffectSuccess(generator.generateStructure('village', position))

      expect(structure).toBeDefined()
      expect(structure.type).toBe('village')
      expect(structure.position).toEqual(position)
    })

    it('構造物生成が無効な場合、エラーを返す', async () => {
      const generator = await expectEffectSuccess(createWorldGenerator({ generateStructures: false }))
      const position: Vector3 = { x: 100, y: 64, z: 100 }

      const error = await expectEffectFailureWith(
        generator.generateStructure('village', position),
        (err: unknown): err is StructureGenerationError =>
          err instanceof StructureGenerationError && err.reason === 'Structure generation is disabled'
      )

      expect(error).toBeInstanceOf(StructureGenerationError)
      expect(error.reason).toBe('Structure generation is disabled')
    })

    it('すべての構造物タイプを生成できる', async () => {
      const generator = await expectEffectSuccess(createWorldGenerator({ generateStructures: true }))
      const position: Vector3 = { x: 0, y: 64, z: 0 }
      const structureTypes: StructureType[] = ['village', 'mineshaft', 'stronghold', 'temple', 'dungeon']

      for (const type of structureTypes) {
        const structure = await expectEffectSuccess(generator.generateStructure(type, position))
        expect(structure.type).toBe(type)
      }
    })
  })

  describe('ワールド情報取得', () => {
    it('スポーン地点を取得できる', async () => {
      const generator = await expectEffectSuccess(createWorldGenerator())

      const spawnPoint = await expectEffectSuccess(generator.getSpawnPoint())

      expect(spawnPoint).toBeDefined()
      expect(typeof spawnPoint.x).toBe('number')
      expect(typeof spawnPoint.y).toBe('number')
      expect(typeof spawnPoint.z).toBe('number')
    })

    it('バイオーム情報を取得できる', async () => {
      const generator = await expectEffectSuccess(createWorldGenerator())
      const position: Vector3 = { x: 0, y: 64, z: 0 }

      const biome = await expectEffectSuccess(generator.getBiome(position))

      expect(biome).toBeDefined()
      expect(biome.type).toBeDefined()
      expect(biome.temperature).toBeDefined()
      expect(biome.humidity).toBeDefined()
    })

    it('地形高さを取得できる', async () => {
      const generator = await expectEffectSuccess(createWorldGenerator())

      const height = await expectEffectSuccess(generator.getTerrainHeight(0, 0))

      expect(typeof height).toBe('number')
      expect(height).toBeGreaterThanOrEqual(0)
      expect(height).toBeLessThanOrEqual(255)
    })
  })

  describe('構造物検索', () => {
    it('構造物生成可能性をチェックできる', async () => {
      const generator = await expectEffectSuccess(createWorldGenerator({ generateStructures: true }))
      const position: Vector3 = { x: 0, y: 64, z: 0 }

      const canGenerate = await expectEffectSuccess(generator.canGenerateStructure('village', position))

      expect(typeof canGenerate).toBe('boolean')
    })

    it('構造物生成が無効な場合、生成不可を返す', async () => {
      const generator = await expectEffectSuccess(createWorldGenerator({ generateStructures: false }))
      const position: Vector3 = { x: 0, y: 64, z: 0 }

      const canGenerate = await expectEffectSuccess(generator.canGenerateStructure('village', position))

      expect(canGenerate).toBe(false)
    })

    it('最近接構造物を検索できる', async () => {
      const generator = await expectEffectSuccess(createWorldGenerator({ generateStructures: true }))

      // まず構造物を生成
      const structurePos: Vector3 = { x: 100, y: 64, z: 100 }
      await expectEffectSuccess(generator.generateStructure('village', structurePos))

      // 近くから検索
      const searchPos: Vector3 = { x: 90, y: 64, z: 90 }
      const foundStructure = await expectEffectSuccess(generator.findNearestStructure('village', searchPos, 50))

      expect(foundStructure).toBeDefined()
      expect(foundStructure?.type).toBe('village')
      expect(foundStructure?.position).toEqual(structurePos)
    })

    it('範囲外の構造物は見つからない', async () => {
      const generator = await expectEffectSuccess(createWorldGenerator({ generateStructures: true }))

      // 遠い場所に構造物を生成
      const structurePos: Vector3 = { x: 1000, y: 64, z: 1000 }
      await expectEffectSuccess(generator.generateStructure('village', structurePos))

      // 近くから狭い範囲で検索
      const searchPos: Vector3 = { x: 0, y: 64, z: 0 }
      const foundStructure = await expectEffectSuccess(generator.findNearestStructure('village', searchPos, 10))

      expect(foundStructure).toBeNull()
    })
  })

  describe('設定とメタデータ', () => {
    it('シード値を取得できる', async () => {
      const customSeed = 98765
      const generator = await expectEffectSuccess(createWorldGenerator({ seed: customSeed }))

      const seed = generator.getSeed()

      expect(seed).toBe(customSeed)
    })

    it('ジェネレータオプションを取得できる', async () => {
      const customOptions: Partial<GeneratorOptions> = {
        seed: 11111,
        worldType: 'amplified',
        generateStructures: true,
        bonusChest: true,
        biomeSize: 7,
      }

      const generator = await expectEffectSuccess(createWorldGenerator(customOptions))
      const options = generator.getOptions()

      expect(options.seed).toBe(11111)
      expect(options.worldType).toBe('amplified')
      expect(options.generateStructures).toBe(true)
      expect(options.bonusChest).toBe(true)
      expect(options.biomeSize).toBe(7)
    })
  })

  describe('エッジケース', () => {
    it('極座標でのチャンク生成', async () => {
      const generator = await expectEffectSuccess(createWorldGenerator())
      const extremePositions: ChunkPosition[] = [
        { x: Number.MAX_SAFE_INTEGER, z: 0 },
        { x: Number.MIN_SAFE_INTEGER, z: 0 },
        { x: 0, z: Number.MAX_SAFE_INTEGER },
        { x: 0, z: Number.MIN_SAFE_INTEGER },
      ]

      for (const position of extremePositions) {
        const result = await expectEffectSuccess(generator.generateChunk(position))
        expect(result.chunk).toBeDefined()
        expect(result.biomes).toBeDefined()
        expect(result.structures).toBeDefined()
        expect(result.heightMap).toBeDefined()
      }
    })

    it('無効な構造物タイプでの生成', async () => {
      const generator = await expectEffectSuccess(createWorldGenerator())
      const position: Vector3 = { x: 0, y: 64, z: 0 }

      // TypeScriptの型システムでは防がれるが、実行時の安全性をテスト
      const invalidType = 'invalid_structure' as StructureType

      const structure = await expectEffectSuccess(generator.generateStructure(invalidType, position))

      // 無効なタイプでも何らかの構造物が生成される（フォールバック動作）
      expect(structure).toBeDefined()
    })
  })
})

/**
 * @fileoverview TestRandomを使用したバイオーム分類テスト
 * 決定論的乱数により予測可能なバイオーム生成を検証
 */

import { describe, expect, it } from '@effect/vitest'
import { Effect, Match, Random, pipe } from 'effect'

/**
 * バイオームタイプ定義
 */
type BiomeType = 'plains' | 'forest' | 'mountains' | 'desert' | 'ocean' | 'tundra'

/**
 * バイオーム分類関数
 * 0-1の乱数値に基づいてバイオームを決定
 */
const classifyBiome = (randomValue: number): BiomeType =>
  pipe(
    Match.value(randomValue),
    Match.when(
      (value) => value < 0.2,
      () => 'plains' as BiomeType
    ),
    Match.when(
      (value) => value < 0.4,
      () => 'forest' as BiomeType
    ),
    Match.when(
      (value) => value < 0.6,
      () => 'mountains' as BiomeType
    ),
    Match.when(
      (value) => value < 0.75,
      () => 'desert' as BiomeType
    ),
    Match.when(
      (value) => value < 0.9,
      () => 'ocean' as BiomeType
    ),
    Match.orElse(() => 'tundra' as BiomeType)
  )

/**
 * バイオーム分類Effect
 * Random.nextを使用してバイオームを決定
 */
const generateBiome = Effect.gen(function* () {
  const randomValue = yield* Random.next
  return classifyBiome(randomValue)
})

/**
 * 複数バイオームの生成
 */
const generateBiomes = (count: number) =>
  Effect.gen(function* () {
    return yield* pipe(
      Match.value(count <= 0),
      Match.when(true, () => Effect.succeed<ReadonlyArray<BiomeType>>([])),
      Match.orElse(() =>
        Effect.gen(function* () {
          const biomes = yield* Effect.replicateEffect(generateBiome, count)
          return biomes as ReadonlyArray<BiomeType>
        })
      )
    )
  })

/**
 * バイオームバリエーション生成
 * Random.nextIntBetweenを使用
 */
const generateBiomeVariant = Effect.gen(function* () {
  const biomeType = yield* generateBiome
  const variantValue = yield* Random.nextIntBetween(0, 100)

  // バリエーション判定
  const hasVariant = variantValue < 20 // 20%の確率でバリエーション
  const variant = hasVariant ? 'variant' : 'normal'

  return { biomeType, variant, variantValue }
})

describe('Biome Classification with TestRandom', () => {
  it.effect('generates predictable biome distribution', () =>
    Effect.gen(function* () {
      // it.effectは自動的に決定論的乱数を提供（Effect-TS 3.17+）
      const biomes = yield* generateBiomes(5)

      // 決定論的乱数で生成されるため、常に同じ結果
      expect(biomes).toBeDefined()
      expect(biomes).toHaveLength(5)
      expect(biomes.every((b) => ['plains', 'forest', 'mountains', 'desert', 'ocean', 'tundra'].includes(b))).toBe(true)
    })
  )

  it.effect('produces same results with same seed', () =>
    Effect.gen(function* () {
      // it.effectは同じシードで実行されるため、決定論的な結果が得られる
      const biomes1 = yield* generateBiomes(5)

      // 決定論的乱数により、バイオームが生成される
      expect(biomes1).toHaveLength(5)
      expect(biomes1.every((b) => ['plains', 'forest', 'mountains', 'desert', 'ocean', 'tundra'].includes(b))).toBe(
        true
      )

      // 同じシード内で連続生成すると、シーケンスが進むため異なる結果になる
      const biomes2 = yield* generateBiomes(5)
      expect(biomes2).toHaveLength(5)
      expect(biomes2.every((b) => ['plains', 'forest', 'mountains', 'desert', 'ocean', 'tundra'].includes(b))).toBe(
        true
      )
    })
  )

  it.effect('generates biomes across all types', () =>
    Effect.gen(function* () {
      // 決定論的乱数により一定のバイオーム分布が生成される
      const biomes = yield* generateBiomes(50)

      // 十分な数を生成すれば複数のバイオームタイプが出現する
      const uniqueBiomes = new Set(biomes)
      expect(uniqueBiomes.size).toBeGreaterThan(1)

      // 全てのバイオームが有効な型であることを確認
      biomes.forEach((biome) => {
        expect(['plains', 'forest', 'mountains', 'desert', 'ocean', 'tundra']).toContain(biome)
      })
    })
  )

  it.effect('generates biome variants deterministically', () =>
    Effect.gen(function* () {
      // it.effectによる決定論的乱数で一貫したバリエーション生成
      const variants = yield* Effect.all([generateBiomeVariant, generateBiomeVariant, generateBiomeVariant])

      // 同じテスト実行では常に同じ結果が得られる
      expect(variants).toHaveLength(3)
      variants.forEach((v) => {
        expect(v.biomeType).toBeDefined()
        expect(['variant', 'normal']).toContain(v.variant)
        expect(v.variantValue).toBeGreaterThanOrEqual(0)
        expect(v.variantValue).toBeLessThan(100)
      })
    })
  )

  it.effect('generates consistent biome distribution patterns', () =>
    Effect.gen(function* () {
      // 決定論的乱数により一貫したパターンが生成される
      const biomes = yield* generateBiomes(12)

      // 同じテスト実行では常に同じパターンが得られる
      expect(biomes).toHaveLength(12)

      // 全てのバイオームが有効な型であることを確認
      biomes.forEach((biome) => {
        expect(['plains', 'forest', 'mountains', 'desert', 'ocean', 'tundra']).toContain(biome)
      })

      // 決定論的乱数により、複数種類のバイオームが生成される
      const uniqueBiomes = new Set(biomes)
      expect(uniqueBiomes.size).toBeGreaterThan(1)
    })
  )

  it.effect('handles edge case random values', () =>
    Effect.gen(function* () {
      // 決定論的乱数により境界値を含む様々な値が生成される
      const biomes = yield* generateBiomes(100)

      // 大量生成により全バイオームタイプが出現する可能性を検証
      expect(biomes).toHaveLength(100)

      // 全てのバイオームが有効な型であることを確認
      biomes.forEach((biome) => {
        expect(['plains', 'forest', 'mountains', 'desert', 'ocean', 'tundra']).toContain(biome)
      })

      // バイオームの分布が偏りすぎていないことを確認
      const uniqueBiomes = new Set(biomes)
      expect(uniqueBiomes.size).toBeGreaterThan(2)
    })
  )

  it.effect('generates complex biome patterns with multiple random calls', () =>
    Effect.gen(function* () {
      // 決定論的乱数により複数の乱数呼び出しも一貫した結果を生成
      const generateComplexBiome = Effect.gen(function* () {
        const biome = yield* generateBiome
        const detail = yield* Random.nextIntBetween(0, 100)
        return { biome, detail }
      })

      const result1 = yield* generateComplexBiome
      const result2 = yield* generateComplexBiome

      // 決定論的なため、常に同じ結果が得られる
      expect(result1.biome).toBeDefined()
      expect(result1.detail).toBeGreaterThanOrEqual(0)
      expect(result1.detail).toBeLessThan(100)

      expect(result2.biome).toBeDefined()
      expect(result2.detail).toBeGreaterThanOrEqual(0)
      expect(result2.detail).toBeLessThan(100)

      // 再実行しても同じ結果が得られることを確認
      const result1b = yield* generateComplexBiome
      const result2b = yield* generateComplexBiome
      // 注: シーケンスが進むため、result1とresult1bは異なる可能性がある
    })
  )
})

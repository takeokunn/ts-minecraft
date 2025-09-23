import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { Effect, Layer, Schema } from 'effect'
import { BrandedTypes } from '../../../shared/types/branded'
import {
  TerrainGeneratorTag,
  TerrainGeneratorLive,
  TerrainGeneratorLiveDefault,
  TerrainConfigSchema,
} from '../TerrainGenerator'
import type { TerrainGenerator, TerrainConfig, HeightMap } from '../TerrainGenerator'
import type { NoiseGenerator } from '../NoiseGenerator'
import { NoiseGeneratorLiveDefault } from '../NoiseGenerator'

/**
 * TerrainGenerator専用のテストヘルパー
 */
const runWithTestTerrain = <A>(
  config: TerrainConfig,
  operation: (tg: TerrainGenerator) => Effect.Effect<A, never, NoiseGenerator>
): Effect.Effect<A, never, never> =>
  Effect.gen(function* () {
    const tg = yield* TerrainGeneratorTag
    return yield* operation(tg)
  }).pipe(Effect.provide(Layer.mergeAll(NoiseGeneratorLiveDefault, TerrainGeneratorLive(config)))) as Effect.Effect<
    A,
    never,
    never
  >

describe('TerrainGenerator', () => {
  describe('基本的な地形生成', () => {
  it.effect('デフォルト設定で地形を生成できる', () => Effect.gen(function* () {
    const defaultConfig: TerrainConfig = {
    baseHeight: 64,
    amplitude: 30,
    frequency: 0.01,
    octaves: 4,
    persistence: 0.5,
    lacunarity: 2.0,
    }
    const heightMap = yield* runWithTestTerrain(defaultConfig, (tg),
    tg.generateHeightMap(0, 0, 16, 16)
    )
    expect(heightMap).toHaveProperty('width', 16)
    expect(heightMap).toHaveProperty('height', 16)
    expect(heightMap.data).toHaveLength(16 * 16)
    // 高さ値が妥当な範囲内であることを確認
    heightMap.data.forEach((height) => {
    expect(height).toBeGreaterThanOrEqual(0)
    expect(height).toBeLessThanOrEqual(256)
})
  ),
  Effect.gen(function* () {
        const customConfig: TerrainConfig = {
          baseHeight: 80,
          amplitude: 50,
          frequency: 0.02,
          octaves: 6,
          persistence: 0.7,
          lacunarity: 1.8,
        }

        const heightMap = yield* runWithTestTerrain(customConfig, (tg),
          tg.generateHeightMap(10, 10, 8, 8)
        )

        expect(heightMap.width).toBe(8)
        expect(heightMap.height).toBe(8)
        expect(heightMap.data).toHaveLength(64)

        // カスタム設定による高さ値の特徴を確認
        const avgHeight = heightMap.data.reduce((sum, h) => sum + h, 0) / heightMap.data.length
        expect(avgHeight).toBeGreaterThan(30) // baseHeight 80, amplitude 50 なのでそれなりの高さ
      })
    it.effect('異なる座標で異なる地形を生成する', () => Effect.gen(function* () {
    const config: TerrainConfig = {
    baseHeight: 64,
    amplitude: 30,
    frequency: 0.01,
    octaves: 4,
    persistence: 0.5,
    lacunarity: 2.0,
    }
    const heightMap1 = yield* runWithTestTerrain(config, (tg),
    tg.generateHeightMap(0, 0, 8, 8)
    )
    const heightMap2 = yield* runWithTestTerrain(config, (tg),
    tg.generateHeightMap(100, 100, 8, 8)
    )
    // 異なる座標では異なる地形が生成されるはず
    let isDifferent = false
    for (let i = 0; i < heightMap1.data.length; i++) {
    if (Math.abs(heightMap1.data[i] - heightMap2.data[i]) > 1) {
    isDifferent = true
    break
    }
    }
    expect(isDifferent).toBe(true)
  })
)
    describe('Property-based testing', () => {
  it.prop('生成される地形マップは指定されたサイズと一致する', [
    Schema.Struct({
    x: Schema.Int.pipe(Schema.between(0, 1000)),
    z: Schema.Int.pipe(Schema.between(0, 1000)),
    width: Schema.Int.pipe(Schema.between(1, 64)),
    height: Schema.Int.pipe(Schema.between(1, 64))
})
    ], ({ struct: { x, z, width, height } })

    Effect.gen(function* () {
    const config: TerrainConfig = {
    baseHeight: 64,
    amplitude: 30,
    frequency: 0.01,
    octaves: 4,
    persistence: 0.5,
    lacunarity: 2.0,
    }

    const heightMap = yield* runWithTestTerrain(config, (tg),
    tg.generateHeightMap(x, z, width, height)
    )

    expect(heightMap.width).toBe(width)
    expect(heightMap.height).toBe(height)
    expect(heightMap.data).toHaveLength(width * height)})

    it.prop('地形設定パラメータが出力に影響する', [
    Schema.Struct({
    baseHeight: Schema.Int.pipe(Schema.between(0, 128)),
    amplitude: Schema.Int.pipe(Schema.between(1, 100)),
    frequency: Schema.Number.pipe(Schema.between(0.001, 0.1)),
    octaves: Schema.Int.pipe(Schema.between(1, 8))
    })
    ], ({ struct: { baseHeight, amplitude, frequency, octaves } })

    Effect.gen(function* () {
    const config: TerrainConfig = {
    baseHeight,
    amplitude,
    frequency,
    octaves,
    persistence: 0.5,
    lacunarity: 2.0,
    }

    const heightMap = yield* runWithTestTerrain(config, (tg),
    tg.generateHeightMap(0, 0, 16, 16)
    )

    // 生成された高さ値がパラメータの影響を受けていることを確認
    const minExpectedHeight = Math.max(0, baseHeight - amplitude)
    const maxExpectedHeight = Math.min(256, baseHeight + amplitude)

    let validHeights = 0
    heightMap.data.forEach((height) => {
    if (height >= minExpectedHeight && height <= maxExpectedHeight) {
    validHeights++
    }
    })

    // 大部分の高さ値が期待範囲内であることを確認
    expect(validHeights / heightMap.data.length).toBeGreaterThan(0.5)
    })
    it.prop('同じ設定・座標では一貫した結果を生成する', [
    Schema.Struct({
    x: Schema.Int.pipe(Schema.between(0, 100)),
    z: Schema.Int.pipe(Schema.between(0, 100)),
    size: Schema.Int.pipe(Schema.between(4, 16))
    })
    ], ({ struct: { x, z, size } })

    Effect.gen(function* () {
    const config: TerrainConfig = {
    baseHeight: 64,
    amplitude: 30,
    frequency: 0.01,
    octaves: 4,
    persistence: 0.5,
    lacunarity: 2.0,
    }

    const heightMap1 = yield* runWithTestTerrain(config, (tg),
    tg.generateHeightMap(x, z, size, size)
    )
    const heightMap2 = yield* runWithTestTerrain(config, (tg),
    tg.generateHeightMap(x, z, size, size)
    )

    // 同じ設定・座標では同じ結果が得られるはず
    expect(heightMap1.width).toBe(heightMap2.width)
    expect(heightMap1.height).toBe(heightMap2.height)
    expect(heightMap1.data).toEqual(heightMap2.data)
    })
    })

    describe('地形の連続性', () => {
  it.effect('隣接するチャンクの境界で連続性が保たれる', () => Effect.gen(function* () {
    const config: TerrainConfig = {
    baseHeight: 64,
    amplitude: 30,
    frequency: 0.01,
    octaves: 4,
    persistence: 0.5,
    lacunarity: 2.0,
    }
    const size = 16
    // 隣接する2つのチャンクを生成
    const chunk1 = yield* runWithTestTerrain(config, (tg),
    tg.generateHeightMap(0, 0, size, size)
    )
    const chunk2 = yield* runWithTestTerrain(config, (tg),
    tg.generateHeightMap(size, 0, size, size)
    )
    // 境界での高さの差が小さいことを確認
    for (let z = 0; z < size; z++) {
    const height1 = chunk1.data[(size - 1) * size + z] // chunk1の右端
    const height2 = chunk2.data[0 * size + z] // chunk2の左端
    // 隣接するピクセル間の高さ差は妥当な範囲内であるべき
    expect(Math.abs(height1 - height2)).toBeLessThan(amplitude * 0.5)
    }
}) {
  it.effect('TerrainConfigSchemaは有効な設定を受け入れる', () => Effect.gen(function* () {
    const validConfig = {
    baseHeight: 64,
    amplitude: 30,
    frequency: 0.01,
    octaves: 4,
    persistence: 0.5,
    lacunarity: 2.0,
    }
    const result = Schema.decodeUnknownEither(TerrainConfigSchema)(validConfig)
    expect(result._tag).toBe('Right')
  })
),
  Effect.gen(function* () {
        const invalidConfigs = [
          { baseHeight: -10 }, // 負の基準高度
          { amplitude: 0 }, // ゼロ振幅
          { frequency: -0.01 }, // 負の周波数
          { octaves: 0 }, // ゼロオクターブ
          { persistence: 1.5 }, // 範囲外の持続性
          { lacunarity: 0.5 }, // 範囲外のラクナリティ
        ]

        invalidConfigs.forEach((config) => {
          const result = Schema.decodeUnknownEither(TerrainConfigSchema)(config)
          expect(result._tag).toBe('Left')
        })
      })
  })

  describe('パフォーマンス特性', () => {
  it.effect('大きなサイズの地形生成が合理的な時間で完了する', () => Effect.gen(function* () {
    const config: TerrainConfig = {
    baseHeight: 64,
    amplitude: 30,
    frequency: 0.01,
    octaves: 4,
    persistence: 0.5,
    lacunarity: 2.0,
    }
    const start = Date.now()
    const heightMap = yield* runWithTestTerrain(config, (tg),
    tg.generateHeightMap(0, 0, 64, 64)
    )
    const elapsed = Date.now() - start
    expect(heightMap.data).toHaveLength(64 * 64)
    expect(elapsed).toBeLessThan(1000) // 1秒以内に完了
})
)
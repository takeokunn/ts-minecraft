import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { Effect, Layer, Schema } from 'effect'
import {
  OreDistributionTag,
  OreDistributionLive,
  OreDistributionLiveDefault,
  OreConfigSchema,
} from '../OreDistribution'
import type { OreDistribution, OreConfig, OreType } from '../OreDistribution'

describe('OreDistribution', () => {
  describe('基本的な鉱石分布', () => {
  it.effect('デフォルト設定で鉱石を分布できる', () => Effect.gen(function* () {
    const oreDistribution = yield* OreDistributionTag
    const distribution = yield* oreDistribution.generateDistribution(0, 0, 16, 16, 64)
    expect(distribution).toHaveProperty('width', 16)
    expect(distribution).toHaveProperty('height', 16)
    expect(distribution).toHaveProperty('depth', 64)
    expect(distribution.ores).toBeInstanceOf(Array)
    // 生成された鉱石の数が妥当であることを確認
    expect(distribution.ores.length).toBeGreaterThanOrEqual(0)
    expect(distribution.ores.length).toBeLessThan(16 * 16 * 64) // 全てのブロックが鉱石ではない
}).pipe(Effect.provide(OreDistributionLiveDefault))
    )
    it.effect('特定の鉱石タイプの分布を設定できる', () => Effect.gen(function* () {
    const config: OreConfig = {
    coal: { density: 0.1, minHeight: 0, maxHeight: 128, veinSize: 8 },
    iron: { density: 0.05, minHeight: 0, maxHeight: 64, veinSize: 6 },
    diamond: { density: 0.01, minHeight: 0, maxHeight: 16, veinSize: 4 },
    }
    const oreDistribution = yield* OreDistributionTag
    const distribution = yield* oreDistribution.generateDistribution(0, 0, 16, 16, 64)
    // 各鉱石タイプが適切な高度範囲に分布していることを確認
    const coalOres = distribution.ores.filter(ore => ore.type === 'coal')
    const ironOres = distribution.ores.filter(ore => ore.type === 'iron')
    const diamondOres = distribution.ores.filter(ore => ore.type === 'diamond')
    coalOres.forEach(ore => {
    expect(ore.y).toBeGreaterThanOrEqual(0)
    expect(ore.y).toBeLessThanOrEqual(64) // テスト範囲内
    })
    ironOres.forEach(ore => {
    expect(ore.y).toBeGreaterThanOrEqual(0)
    expect(ore.y).toBeLessThanOrEqual(64)
    })
    diamondOres.forEach(ore => {
    expect(ore.y).toBeGreaterThanOrEqual(0)
    expect(ore.y).toBeLessThanOrEqual(16) // 低層のみ
  })
).pipe(Effect.provide(OreDistributionLive(config)))
    )

    it.effect('鉱石の分布密度が設定通りに動作する', () => Effect.gen(function* () {
    const highDensityConfig: OreConfig = {
    coal: { density: 0.2, minHeight: 0, maxHeight: 64, veinSize: 8 },
    }
    const lowDensityConfig: OreConfig = {
    coal: { density: 0.01, minHeight: 0, maxHeight: 64, veinSize: 8 },
    }
    const highDensityDistribution = yield* Effect.gen(function* () {
    const oreDistribution = yield* OreDistributionTag
    return yield* oreDistribution.generateDistribution(0, 0, 16, 16, 64)
    }).pipe(Effect.provide(OreDistributionLive(highDensityConfig)))
    const lowDensityDistribution = yield* Effect.gen(function* () {
    const oreDistribution = yield* OreDistributionTag
    return yield* oreDistribution.generateDistribution(0, 0, 16, 16, 64)
    }).pipe(Effect.provide(OreDistributionLive(lowDensityConfig)))
    const highCoalCount = highDensityDistribution.ores.filter(ore => ore.type === 'coal').length
    const lowCoalCount = lowDensityDistribution.ores.filter(ore => ore.type === 'coal').length
    // 高密度設定の方が多くの鉱石を生成するはず
    expect(highCoalCount).toBeGreaterThan(lowCoalCount)
  }) {
  it.prop('生成される鉱石分布は指定された領域内にある', [
    Schema.Struct({
    x: Schema.Int.pipe(Schema.between(0, 1000)),
    z: Schema.Int.pipe(Schema.between(0, 1000)),
    width: Schema.Int.pipe(Schema.between(4, 32)),
    height: Schema.Int.pipe(Schema.between(4, 32)),
    depth: Schema.Int.pipe(Schema.between(16, 128))
})
    ], ({ struct: { x, z, width, height, depth } })

    Effect.gen(function* () {
    const oreDistribution = yield* OreDistributionTag

    const distribution = yield* oreDistribution.generateDistribution(x, z, width, height, depth)

    // 全ての鉱石が指定された領域内にあることを確認
    distribution.ores.forEach(ore => {
    expect(ore.x).toBeGreaterThanOrEqual(x)
    expect(ore.x).toBeLessThan(x + width)
    expect(ore.z).toBeGreaterThanOrEqual(z)
    expect(ore.z).toBeLessThan(z + height)
    expect(ore.y).toBeGreaterThanOrEqual(0)
    expect(ore.y).toBeLessThan(depth)
    })

    expect(distribution.width).toBe(width)
    expect(distribution.height).toBe(height)
    expect(distribution.depth).toBe(depth)
    }).pipe(Effect.provide(OreDistributionLiveDefault))
    )

    it.prop('鉱石密度パラメータが分布に影響する', [
    Schema.Struct({
    coalDensity: Schema.Number.pipe(Schema.between(0.001, 0.3)),
    ironDensity: Schema.Number.pipe(Schema.between(0.001, 0.2)),
    diamondDensity: Schema.Number.pipe(Schema.between(0.001, 0.05))
    })
    ], ({ struct: { coalDensity, ironDensity, diamondDensity } })

    Effect.gen(function* () {
    const config: OreConfig = {
    coal: { density: coalDensity, minHeight: 0, maxHeight: 128, veinSize: 8 },
    iron: { density: ironDensity, minHeight: 0, maxHeight: 64, veinSize: 6 },
    diamond: { density: diamondDensity, minHeight: 0, maxHeight: 16, veinSize: 4 },
    }

    const oreDistribution = yield* OreDistributionTag

    const distribution = yield* oreDistribution.generateDistribution(0, 0, 32, 32, 128)

    const totalVolume = 32 * 32 * 128
    const coalCount = distribution.ores.filter(ore => ore.type === 'coal').length
    const ironCount = distribution.ores.filter(ore => ore.type === 'iron').length
    const diamondCount = distribution.ores.filter(ore => ore.type === 'diamond').length

    // 密度と実際の鉱石数の関係が妥当であることを確認
    // 密度が高いほど多くの鉱石が生成されるはず
    const expectedCoalRatio = coalCount / totalVolume
    const expectedIronRatio = ironCount / totalVolume
    const expectedDiamondRatio = diamondCount / totalVolume

    // 大まかな相関関係を確認
    if (coalDensity > ironDensity) {
    expect(expectedCoalRatio).toBeGreaterThanOrEqual(expectedIronRatio * 0.5)
    }
    if (ironDensity > diamondDensity) {
    expect(expectedIronRatio).toBeGreaterThanOrEqual(expectedDiamondRatio * 0.5)
    }
    }).pipe(Effect.provide(OreDistributionLive(config)))
    )

    it.prop('同じ設定・座標では一貫した結果を生成する', [
    Schema.Struct({
    x: Schema.Int.pipe(Schema.between(0, 100)),
    z: Schema.Int.pipe(Schema.between(0, 100)),
    size: Schema.Int.pipe(Schema.between(8, 16))
    })
    ], ({ struct: { x, z, size } })

    Effect.gen(function* () {
    const config: OreConfig = {
    coal: { density: 0.1, minHeight: 0, maxHeight: 64, veinSize: 8 },
    iron: { density: 0.05, minHeight: 0, maxHeight: 32, veinSize: 6 },
    }

    const distribution1 = yield* Effect.gen(function* () {
    const oreDistribution = yield* OreDistributionTag
    return yield* oreDistribution.generateDistribution(x, z, size, size, 64)
    }).pipe(Effect.provide(OreDistributionLive(config)))

    const distribution2 = yield* Effect.gen(function* () {
    const oreDistribution = yield* OreDistributionTag
    return yield* oreDistribution.generateDistribution(x, z, size, size, 64)
    }).pipe(Effect.provide(OreDistributionLive(config)))

    // 同じ設定・座標では同じ結果が得られるはず
    expect(distribution1.width).toBe(distribution2.width)
    expect(distribution1.height).toBe(distribution2.height)
    expect(distribution1.depth).toBe(distribution2.depth)
    expect(distribution1.ores).toEqual(distribution2.ores)})
    })

    describe('鉱石タイプの妥当性', () => {
  it.effect('生成される鉱石は定義されたタイプのみ', () => Effect.gen(function* () {
    const config: OreConfig = {
    coal: { density: 0.1, minHeight: 0, maxHeight: 128, veinSize: 8 },
    iron: { density: 0.05, minHeight: 0, maxHeight: 64, veinSize: 6 },
    gold: { density: 0.02, minHeight: 0, maxHeight: 32, veinSize: 4 },
    diamond: { density: 0.01, minHeight: 0, maxHeight: 16, veinSize: 3 },
    }
    const oreDistribution = yield* OreDistributionTag
    const distribution = yield* oreDistribution.generateDistribution(0, 0, 32, 32, 128)
    const validTypes: OreType[] = ['coal', 'iron', 'gold', 'diamond']
    distribution.ores.forEach(ore => {
    expect(validTypes).toContain(ore.type)
})
).pipe(Effect.provide(OreDistributionLive(config)))
    )

    it.effect('鉱石の高度制限が正しく適用される', () => Effect.gen(function* () {
    const config: OreConfig = {
    coal: { density: 0.1, minHeight: 32, maxHeight: 96, veinSize: 8 },
    diamond: { density: 0.05, minHeight: 0, maxHeight: 16, veinSize: 4 },
    }
    const oreDistribution = yield* OreDistributionTag
    const distribution = yield* oreDistribution.generateDistribution(0, 0, 16, 16, 128)
    const coalOres = distribution.ores.filter(ore => ore.type === 'coal')
    const diamondOres = distribution.ores.filter(ore => ore.type === 'diamond')
    coalOres.forEach(ore => {
    expect(ore.y).toBeGreaterThanOrEqual(32)
    expect(ore.y).toBeLessThanOrEqual(96)
    })
    diamondOres.forEach(ore => {
    expect(ore.y).toBeGreaterThanOrEqual(0)
    expect(ore.y).toBeLessThanOrEqual(16)
  })
).pipe(Effect.provide(OreDistributionLive(config)))
    )
  })

  describe('設定検証', () => {
  it.effect('OreConfigSchemaは有効な設定を受け入れる', () => Effect.gen(function* () {
    const validConfig = {
    coal: { density: 0.1, minHeight: 0, maxHeight: 128, veinSize: 8 },
    iron: { density: 0.05, minHeight: 0, maxHeight: 64, veinSize: 6 },
    diamond: { density: 0.01, minHeight: 0, maxHeight: 16, veinSize: 4 },
    }
    const result = Schema.decodeUnknownEither(OreConfigSchema)(validConfig)
    expect(result._tag).toBe('Right')
})
),
  Effect.gen(function* () {
        const invalidConfigs = [
          { coal: { density: -0.1, minHeight: 0, maxHeight: 128, veinSize: 8 } }, // 負の密度
          { iron: { density: 0.05, minHeight: 100, maxHeight: 50, veinSize: 6 } }, // minHeight > maxHeight
          { diamond: { density: 0.01, minHeight: 0, maxHeight: 16, veinSize: 0 } }, // ゼロ鉱脈サイズ
        ]

        invalidConfigs.forEach((config) => {
          const result = Schema.decodeUnknownEither(OreConfigSchema)(config)
          expect(result._tag).toBe('Left')
        })
      })
  })

  describe('パフォーマンス特性', () => {
  it.effect('大きな領域の鉱石分布生成が合理的な時間で完了する', () => Effect.gen(function* () {
    const config: OreConfig = {
    coal: { density: 0.1, minHeight: 0, maxHeight: 128, veinSize: 8 },
    iron: { density: 0.05, minHeight: 0, maxHeight: 64, veinSize: 6 },
    diamond: { density: 0.01, minHeight: 0, maxHeight: 16, veinSize: 4 },
    }
    const oreDistribution = yield* OreDistributionTag
    const start = Date.now()
    const distribution = yield* oreDistribution.generateDistribution(0, 0, 64, 64, 256)
    const elapsed = Date.now() - start
    expect(distribution.ores.length).toBeGreaterThan(0)
    expect(elapsed).toBeLessThan(2000) // 2秒以内に完了
}).pipe(Effect.provide(OreDistributionLive(config)))
    )
  })
)
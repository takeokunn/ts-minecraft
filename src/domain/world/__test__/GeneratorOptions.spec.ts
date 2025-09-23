import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { Effect } from 'effect'
import { Schema } from '@effect/schema'
import {
  WorldType,
  StructureType,
  GenerationFeatureSchema,
  GeneratorOptionsSchema,
  defaultGenerationFeatures,
  defaultGeneratorOptions,
  createGeneratorOptions,
  type WorldType as WorldTypeT,
  type StructureType as StructureTypeT,
  type GenerationFeature,
  type GeneratorOptions,
} from '../GeneratorOptions'

describe('GeneratorOptions', () => {
  describe('WorldType', () => {
  it.effect('validates all supported world types', () => Effect.gen(function* () {
    const validWorldTypes: WorldTypeT[] = ['default', 'flat', 'amplified', 'large_biomes', 'custom']
    expect(validWorldTypes).toHaveLength(5)
    for (
    expect(() => Schema.decodeUnknownSync(WorldType)(worldType)).not.toThrow()
    const decoded = Schema.decodeUnknownSync(WorldType)(worldType)
    expect(decoded).toBe(worldType)
    ) {$2
})
),
    Effect.gen(function* () {
    const invalidWorldTypes = [
    'invalid_world',
    'DEFAULT', // 大文字
    'Default', // 大文字混じり
    'normal', // 似ているが違う
    'superflat', // 似ているが違う
    'default_world', // 追加文字
    '',
    ' default', // 前スペース
    'default ', // 後スペース
    null,
    undefined,
    123,
    true,
    [],
    {},
    ]
    for (
    expect(() => Schema.decodeUnknownSync(WorldType)(worldType)).toThrow()
    ) {$2}
    )

    it.effect('categorizes world types by complexity', () => Effect.gen(function* () {
    const standardTypes = ['default', 'flat']
    const enhancedTypes = ['amplified', 'large_biomes']
    const customTypes = ['custom']
    const allTypes = [...standardTypes, ...enhancedTypes, ...customTypes]
    // すべてのタイプが有効であることを確認
    for (
    expect(() => Schema.decodeUnknownSync(WorldType)(worldType)).not.toThrow()
    expect(allTypes).toHaveLength(5)
    ) {$2}
    )
  }) {
    it.effect('validates all supported structure types', () => Effect.gen(function* () {
    const validStructureTypes: StructureTypeT[] = [
    'village',
    'mineshaft',
    'stronghold',
    'temple',
    'dungeon',
    'fortress',
    'monument',
    'mansion',
    'outpost',
    'portal',
    ]
    expect(validStructureTypes).toHaveLength(10)
    for (
    expect(() => Schema.decodeUnknownSync(StructureType)(structureType)).not.toThrow()
    const decoded = Schema.decodeUnknownSync(StructureType)(structureType)
    expect(decoded).toBe(structureType)
    ) {$2}
    )
    it.effect('rejects invalid structure types', () => Effect.gen(function* () {
    const invalidStructureTypes = [
    'invalid_structure',
    'VILLAGE', // 大文字
    'Village', // 大文字混じり
    'city', // 似ているが違う
    'town', // 似ているが違う
    'village_house', // 追加文字
    'mine_shaft', // アンダースコア位置違い
    '',
    ' village', // 前スペース
    'village ', // 後スペース
    null,
    undefined,
    123,
    false,
    [],
    {},
    ]
    for (
    expect(() => Schema.decodeUnknownSync(StructureType)(structureType)).toThrow()
    ) {$2}
    )
    it.effect('categorizes structures by biome compatibility', () => Effect.gen(function* () {
    const overworldStructures = [
    'village',
    'mineshaft',
    'stronghold',
    'temple',
    'dungeon',
    'monument',
    'mansion',
    'outpost',
    ]
    const netherStructures = ['fortress']
    const specialStructures = ['portal']
    const allStructures = [...overworldStructures, ...netherStructures, ...specialStructures]
    // すべての構造物タイプが有効であることを確認
    for (
    expect(() => Schema.decodeUnknownSync(StructureType)(structureType)).not.toThrow()
    expect(allStructures).toHaveLength(10)
    ) {$2}
    )
  }) {
    it.effect('validates complete generation feature configuration', () => Effect.gen(function* () {
    const validFeatureConfigs: GenerationFeature[] = [
    {
    caves: true,
    ravines: true,
    mineshafts: true,
    villages: true,
    strongholds: true,
    temples: true,
    dungeons: true,
    lakes: true,
    lavaLakes: true,
    },
    {
    caves: false,
    ravines: false,
    mineshafts: false,
    villages: false,
    strongholds: false,
    temples: false,
    dungeons: false,
    lakes: false,
    lavaLakes: false,
    },
    {
    caves: true,
    ravines: false,
    mineshafts: true,
    villages: false,
    strongholds: true,
    temples: false,
    dungeons: true,
    lakes: false,
    lavaLakes: true,
    },
    ]
    for (
    expect(() => Schema.decodeUnknownSync(GenerationFeatureSchema)(featureConfig)).not.toThrow()
    const decoded = Schema.decodeUnknownSync(GenerationFeatureSchema)(featureConfig)
    expect(decoded).toEqual(featureConfig)
    ) {$2}
    )
    it.effect('rejects invalid generation feature configurations', () => Effect.gen(function* () {
    const invalidFeatureConfigs = [
    // missing properties
    { caves: true, ravines: true }, // missing other properties
    { villages: true }, // missing most properties
    {},
    // invalid property types
    {
    caves: 'true',
    ravines: true,
    mineshafts: true,
    villages: true,
    strongholds: true,
    temples: true,
    dungeons: true,
    lakes: true,
    lavaLakes: true,
    },
    {
    caves: true,
    ravines: 1,
    mineshafts: true,
    villages: true,
    strongholds: true,
    temples: true,
    dungeons: true,
    lakes: true,
    lavaLakes: true,
    },
    // 完全に間違った型
    null,
    undefined,
    'string',
    123,
    [],
    true,
    ]
    for (
    expect(() => Schema.decodeUnknownSync(GenerationFeatureSchema)(featureConfig)).toThrow()
    ) {$2}
    )
    it.effect('validates generation features using property-based testing', () => Effect.gen(function* () {
    // REMOVED: // REMOVED: fc.assert(
    // REMOVED: fc.property(
    // REMOVED: fc.record({
    caves: // REMOVED: fc.boolean(),
    ravines: // REMOVED: fc.boolean(),
    mineshafts: // REMOVED: fc.boolean(),
    villages: // REMOVED: fc.boolean(),
    strongholds: // REMOVED: fc.boolean(),
    temples: // REMOVED: fc.boolean(),
    dungeons: // REMOVED: fc.boolean(),
    lakes: // REMOVED: fc.boolean(
    }),
    lavaLakes: // REMOVED: fc.boolean(),
    ),
    (featureConfig) => {
    expect(() => Schema.decodeUnknownSync(GenerationFeatureSchema)(featureConfig)).not.toThrow()
    const decoded = Schema.decodeUnknownSync(GenerationFeatureSchema)(featureConfig)
    expect(decoded).toEqual(featureConfig)
    ),
    { numRuns: 100 }
    )
    describe('GeneratorOptionsSchema', () => {
    it.effect('validates complete generator options configuration', () => Effect.gen(function* () {
    const validOptionConfigs: GeneratorOptions[] = [
    {
    seed: 12345,
    worldType: 'default',
    generateStructures: true,
    bonusChest: false,
    biomeSize: 4,
    seaLevel: 63,
    features: defaultGenerationFeatures,
    renderDistance: 8,
    simulationDistance: 6,
    },
    {
    seed: 0,
    worldType: 'flat',
    generateStructures: false,
    bonusChest: true,
    biomeSize: 1,
    seaLevel: 0,
    features: {
    caves: false,
    ravines: false,
    mineshafts: false,
    villages: false,
    strongholds: false,
    temples: false,
    dungeons: false,
    lakes: false,
    lavaLakes: false,
    },
    renderDistance: 2,
    simulationDistance: 2,
    },
    {
    seed: -999999,
    worldType: 'amplified',
    generateStructures: true,
    bonusChest: true,
    biomeSize: 10,
    seaLevel: 255,
    features: defaultGenerationFeatures,
    renderDistance: 32,
    simulationDistance: 32,
    },
    ]
    for (
    expect(() => Schema.decodeUnknownSync(GeneratorOptionsSchema)(optionConfig)).not.toThrow()
    const decoded = Schema.decodeUnknownSync(GeneratorOptionsSchema)(optionConfig)
    expect(decoded).toEqual(optionConfig)
    ) {$2
})
),
    Effect.gen(function* () {
    const invalidOptionConfigs = [
    // missing required properties
    {
    worldType: 'default',
    generateStructures: true,
    bonusChest: false,
    biomeSize: 4,
    seaLevel: 63,
    features: defaultGenerationFeatures,
    renderDistance: 8,
    simulationDistance: 6,
    }, // missing seed
    // invalid property types
    {
    seed: 'invalid',
    worldType: 'default',
    generateStructures: true,
    bonusChest: false,
    biomeSize: 4,
    seaLevel: 63,
    features: defaultGenerationFeatures,
    renderDistance: 8,
    simulationDistance: 6,
    },
    // invalid worldType
    {
    seed: 12345,
    worldType: 'invalid',
    generateStructures: true,
    bonusChest: false,
    biomeSize: 4,
    seaLevel: 63,
    features: defaultGenerationFeatures,
    renderDistance: 8,
    simulationDistance: 6,
    },
    // out of range values
    {
    seed: 12345,
    worldType: 'default',
    generateStructures: true,
    bonusChest: false,
    biomeSize: 0, // below minimum
    seaLevel: 63,
    features: defaultGenerationFeatures,
    renderDistance: 8,
    simulationDistance: 6,
    },
    {
    seed: 12345,
    worldType: 'default',
    generateStructures: true,
    bonusChest: false,
    biomeSize: 11, // above maximum
    seaLevel: 63,
    features: defaultGenerationFeatures,
    renderDistance: 8,
    simulationDistance: 6,
    },
    {
    seed: 12345,
    worldType: 'default',
    generateStructures: true,
    bonusChest: false,
    biomeSize: 4,
    seaLevel: -1, // below minimum
    features: defaultGenerationFeatures,
    renderDistance: 8,
    simulationDistance: 6,
    },
    {
    seed: 12345,
    worldType: 'default',
    generateStructures: true,
    bonusChest: false,
    biomeSize: 4,
    seaLevel: 256, // above maximum
    features: defaultGenerationFeatures,
    renderDistance: 8,
    simulationDistance: 6,
    },
    {
    seed: 12345,
    worldType: 'default',
    generateStructures: true,
    bonusChest: false,
    biomeSize: 4,
    seaLevel: 63,
    features: defaultGenerationFeatures,
    renderDistance: 1, // below minimum
    simulationDistance: 6,
    },
    {
    seed: 12345,
    worldType: 'default',
    generateStructures: true,
    bonusChest: false,
    biomeSize: 4,
    seaLevel: 63,
    features: defaultGenerationFeatures,
    renderDistance: 33, // above maximum
    simulationDistance: 6,
    },
    null,
    undefined,
    'string',
    123,
    [],
    {},
    ]
    for (
    expect(() => Schema.decodeUnknownSync(GeneratorOptionsSchema)(optionConfig)).toThrow()
    ) {$2}
    )

    it.effect('validates range constraints for numerical properties', () => Effect.gen(function* () {
    const rangeTests = [
    // biomeSize range (1-10)
    { property: 'biomeSize', validValues: [1, 5, 10], invalidValues: [0, 11, -1, 0.5] },
    // seaLevel range (0-255)
    { property: 'seaLevel', validValues: [0, 63, 255], invalidValues: [-1, 256, -10, 300] },
    // renderDistance range (2-32)
    { property: 'renderDistance', validValues: [2, 8, 32], invalidValues: [1, 33, 0, 50] },
    // simulationDistance range (2-32)
    { property: 'simulationDistance', validValues: [2, 6, 32], invalidValues: [1, 33, 0, 40] },
    ]
    for (
    // Valid values should pass
    for (const validValue of test.validValues) {
    const config = {
    ...defaultGeneratorOptions,
    [test.property]: validValue,
    expect(() => Schema.decodeUnknownSync(GeneratorOptionsSchema)(config)).not.toThrow()
    // Invalid values should fail
    for (const invalidValue of test.invalidValues) {
    const config = {
    ...defaultGeneratorOptions,
    [test.property]: invalidValue,
    expect(() => Schema.decodeUnknownSync(GeneratorOptionsSchema)(config)).toThrow()
    ) {$2}
    )
    it.effect('validates generator options using property-based testing', () => Effect.gen(function* () {
    // REMOVED: // REMOVED: fc.assert(
    // REMOVED: fc.property(
    // REMOVED: fc.record({
    seed: // REMOVED: fc.integer({ min: -1000000, max: 1000000
    ),
    worldType: // REMOVED: fc.constantFrom('default', 'flat', 'amplified', 'large_biomes', 'custom'),
    generateStructures: // REMOVED: fc.boolean(),
    bonusChest: // REMOVED: fc.boolean(
    }),
    biomeSize: // REMOVED: fc.integer({ min: 1, max: 10 }),
    seaLevel: // REMOVED: fc.integer({ min: 0, max: 255 }),
    features: // REMOVED: fc.record({
    caves: // REMOVED: fc.boolean(),
    ravines: // REMOVED: fc.boolean(),
    mineshafts: // REMOVED: fc.boolean(),
    villages: // REMOVED: fc.boolean(),
    strongholds: // REMOVED: fc.boolean(),
    temples: // REMOVED: fc.boolean(),
    dungeons: // REMOVED: fc.boolean(),
    lakes: // REMOVED: fc.boolean(),
    lavaLakes: // REMOVED: fc.boolean(),
    }),
    renderDistance: // REMOVED: fc.integer({ min: 2, max: 32 }),
    simulationDistance: // REMOVED: fc.integer({ min: 2, max: 32 }),
    }),
    (optionConfig) => {
    expect(() => Schema.decodeUnknownSync(GeneratorOptionsSchema)(optionConfig)).not.toThrow()
    const decoded = Schema.decodeUnknownSync(GeneratorOptionsSchema)(optionConfig)
    expect(decoded).toEqual(optionConfig)
    ),
    { numRuns: 100 }
    )
    describe('Default Configurations', () => {
    it.effect('provides valid default generation features', () => Effect.gen(function* () {
    expect(() => Schema.decodeUnknownSync(GenerationFeatureSchema)(defaultGenerationFeatures)).not.toThrow()
    expect(defaultGenerationFeatures).toEqual({
    caves: true,
    ravines: true,
    mineshafts: true,
    villages: true,
    strongholds: true,
    temples: true,
    dungeons: true,
    lakes: true,
    lavaLakes: true,
    )
    // すべてのフィーチャーがデフォルトで有効
    const featureKeys = Object.keys(defaultGenerationFeatures) as (keyof GenerationFeature)[]
    for (
    expect(defaultGenerationFeatures[key]).toBe(true)
    it.effect('provides valid default generator options', () => Effect.gen(function* () {
    expect(() => Schema.decodeUnknownSync(GeneratorOptionsSchema)(defaultGeneratorOptions)).not.toThrow()
    expect(defaultGeneratorOptions.worldType).toBe('default')
    expect(defaultGeneratorOptions.generateStructures).toBe(true)
    expect(defaultGeneratorOptions.bonusChest).toBe(false)
    expect(defaultGeneratorOptions.biomeSize).toBe(4)
    expect(defaultGeneratorOptions.seaLevel).toBe(63)
    expect(defaultGeneratorOptions.features).toEqual(defaultGenerationFeatures)
    expect(defaultGeneratorOptions.renderDistance).toBe(8)
    expect(defaultGeneratorOptions.simulationDistance).toBe(6)
    // seed は動的生成されるので数値であることを確認
    expect(typeof defaultGeneratorOptions.seed).toBe('number')
    expect(Number.isFinite(defaultGeneratorOptions.seed)).toBe(true)
    )
    it.effect('validates that default options satisfy all constraints', () => Effect.gen(function* () {
    // 範囲制約の確認
    expect(defaultGeneratorOptions.biomeSize).toBeGreaterThanOrEqual(1)
    expect(defaultGeneratorOptions.biomeSize).toBeLessThanOrEqual(10)
    expect(defaultGeneratorOptions.seaLevel).toBeGreaterThanOrEqual(0)
    expect(defaultGeneratorOptions.seaLevel).toBeLessThanOrEqual(255)
    expect(defaultGeneratorOptions.renderDistance).toBeGreaterThanOrEqual(2)
    expect(defaultGeneratorOptions.renderDistance).toBeLessThanOrEqual(32)
    expect(defaultGeneratorOptions.simulationDistance).toBeGreaterThanOrEqual(2)
    expect(defaultGeneratorOptions.simulationDistance).toBeLessThanOrEqual(32)
    // 論理的制約の確認
    expect(defaultGeneratorOptions.simulationDistance).toBeLessThanOrEqual(defaultGeneratorOptions.renderDistance)
    )
    describe('createGeneratorOptions Helper', () => {
    it.effect('creates options with default values when no arguments provided', () => Effect.gen(function* () {
    const options = createGeneratorOptions()
    expect(options).toEqual(defaultGeneratorOptions)
    expect(() => Schema.decodeUnknownSync(GeneratorOptionsSchema)(options)).not.toThrow()
    )
    it.effect('merges partial options with defaults', () => Effect.gen(function* () {
    const partialOptions: Partial<GeneratorOptions> = {
    seed: 99999,
    worldType: 'flat',
    generateStructures: false,
    const options = createGeneratorOptions(partialOptions)
    expect(options.seed).toBe(99999)
    expect(options.worldType).toBe('flat')
    expect(options.generateStructures).toBe(false)
    expect(options.bonusChest).toBe(defaultGeneratorOptions.bonusChest) // default value
    expect(options.biomeSize).toBe(defaultGeneratorOptions.biomeSize) // default value
    expect(options.features).toEqual(defaultGeneratorOptions.features) // default value
    expect(() => Schema.decodeUnknownSync(GeneratorOptionsSchema)(options)).not.toThrow()
    ) {$2
})
),
    Effect.gen(function* () {
    const partialOptions: Partial<GeneratorOptions> = {
    seed: 12345,
    features: {
    caves: false,
    ravines: true,
    mineshafts: true,
    villages: false,
    strongholds: true,
    temples: true,
    dungeons: true,
    lakes: true,
    lavaLakes: true,
    },
    const options = createGeneratorOptions(partialOptions)
    expect(options.seed).toBe(12345)
    expect(options.features.caves).toBe(false)
    expect(options.features.villages).toBe(false)
    expect(options.features.ravines).toBe(true) // default value
    expect(options.features.mineshafts).toBe(true) // default value
    expect(options.features.temples).toBe(true) // default value
    expect(() => Schema.decodeUnknownSync(GeneratorOptionsSchema)(options)).not.toThrow()
  })
),
  Effect.gen(function* () {
        const customFeatures: GenerationFeature = {
        caves: false,
        ravines: false,
        mineshafts: false,
        villages: true,
        strongholds: true,
        temples: false,
        dungeons: false,
        lakes: false,
        lavaLakes: false,
        const partialOptions: Partial<GeneratorOptions> = {
        features: customFeatures,
        const options = createGeneratorOptions(partialOptions)
        expect(options.features).toEqual(customFeatures)
        expect(options.features.caves).toBe(false)
        expect(options.features.villages).toBe(true)
        expect(() => Schema.decodeUnknownSync(GeneratorOptionsSchema)(options)).not.toThrow()

      })
    it.effect('handles multiple option overrides correctly', () => Effect.gen(function* () {
    const complexOptions: Partial<GeneratorOptions> = {
    seed: 777,
    worldType: 'amplified',
    generateStructures: false,
    bonusChest: true,
    biomeSize: 2,
    seaLevel: 100,
    features: {
    caves: true,
    ravines: false,
    mineshafts: true,
    villages: false,
    strongholds: true,
    temples: false,
    dungeons: true,
    lakes: false,
    lavaLakes: true,
    },
    renderDistance: 16,
    simulationDistance: 12,
    const options = createGeneratorOptions(complexOptions)
    expect(options).toEqual({
    ...defaultGeneratorOptions,
    ...complexOptions,
    expect(() => Schema.decodeUnknownSync(GeneratorOptionsSchema)(options)).not.toThrow()
  })
),
    Effect.gen(function* () {
    // REMOVED: // REMOVED: fc.assert(
    // REMOVED: fc.property(
    // REMOVED: fc.record({
    seed: // REMOVED: fc.option(// REMOVED: fc.integer({ min: -1000000, max: 1000000
    ), { nil: undefined }),
    worldType: // REMOVED: fc.option(// REMOVED: fc.constantFrom('default', 'flat', 'amplified', 'large_biomes', 'custom'), {
    nil: undefined,
    }),
    generateStructures: // REMOVED: fc.option(// REMOVED: fc.boolean(), { nil: undefined }),
    bonusChest: // REMOVED: fc.option(// REMOVED: fc.boolean(), { nil: undefined }),
    biomeSize: // REMOVED: fc.option(// REMOVED: fc.integer({ min: 1, max: 10 }), { nil: undefined }),
    seaLevel: // REMOVED: fc.option(// REMOVED: fc.integer({ min: 0, max: 255 }), { nil: undefined }),
    renderDistance: // REMOVED: fc.option(// REMOVED: fc.integer({ min: 2, max: 32 }), { nil: undefined }),
    simulationDistance: // REMOVED: fc.option(// REMOVED: fc.integer({ min: 2, max: 32 }), { nil: undefined }),
    }),
    (partialOptions) => {
    // undefinedプロパティを除去
    const cleanedOptions = Object.fromEntries(
    Object.entries(partialOptions).filter(([, value]) => value !== undefined)
    ) as Partial<GeneratorOptions>
    const options = createGeneratorOptions(cleanedOptions)
    expect(() => Schema.decodeUnknownSync(GeneratorOptionsSchema)(options)).not.toThrow()
    // 提供された値が適用されていることを確認
    for (const [key, value] of Object.entries(cleanedOptions)) {
    if (key !== 'features') {
    expect(options[key as keyof GeneratorOptions]).toBe(value)
    ),
    { numRuns: 50 }
    )
    describe('Edge Cases and Performance', () => {
  it.effect('handles extreme seed values', () => Effect.gen(function* () {
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
    const options = createGeneratorOptions({ seed
    )
    expect(options.seed).toBe(seed)
    expect(() => Schema.decodeUnknownSync(GeneratorOptionsSchema)(options)).not.toThrow()
    it.effect('maintains immutability of default objects', () => Effect.gen(function* () {
    const originalFeatures = { ...defaultGenerationFeatures }
    const originalOptions = { ...defaultGeneratorOptions }
    // 生成オプションを作成
    const newOptions = createGeneratorOptions({ seed: 12345
})
    // デフォルト値が変更されていないことを確認
    expect(defaultGenerationFeatures).toEqual(originalFeatures)
    expect(defaultGeneratorOptions.worldType).toBe(originalOptions.worldType)
    expect(defaultGeneratorOptions.generateStructures).toBe(originalOptions.generateStructures)
    // 新しいオプションは独立していることを確認
    const modifiedOptions = createGeneratorOptions({
    ...newOptions,
    features: { ...newOptions.features, caves: false },
    expect(modifiedOptions.features.caves).toBe(false)
    expect(defaultGenerationFeatures.caves).toBe(true)
  })
),
  Effect.gen(function* () {
        const complexCombinations = [
        // Flat world with no structures
        {
        worldType: 'flat' as WorldTypeT,
        generateStructures: false,
        features: {
        caves: false,
        ravines: false,
        mineshafts: false,
        villages: false,
        strongholds: false,
        temples: false,
        dungeons: false,
        lakes: false,
        lavaLakes: false,
        },
        },
        // Amplified world with maximum features
        {
        worldType: 'amplified' as WorldTypeT,
        biomeSize: 10,
        renderDistance: 32,
        simulationDistance: 32,
        features: defaultGenerationFeatures,
        },
        // Custom world with selective features
        {
        worldType: 'custom' as WorldTypeT,
        biomeSize: 1,
        seaLevel: 0,
        features: {
        caves: true,
        ravines: true,
        mineshafts: false,
        villages: true,
        strongholds: false,
        temples: true,
        dungeons: false,
        lakes: false,
        lavaLakes: false,
        },
        },
        ]
        for (
        const options = createGeneratorOptions(combination)
        expect(() => Schema.decodeUnknownSync(GeneratorOptionsSchema)(options)).not.toThrow()
) {$2}
)

    it.effect('handles large-scale validation efficiently', () => Effect.gen(function* () {
    const startTime = performance.now()
    // 大量のオプション検証
    for (
    const options = createGeneratorOptions({
    seed: i,
    biomeSize: (i % 10) + 1,
    seaLevel: i % 256,
    renderDistance: (i % 31) + 2,
    simulationDistance: (i % 31) + 2,
    ) {$2}
    )
    expect(() => Schema.decodeUnknownSync(GeneratorOptionsSchema)(options)).not.toThrow()
    }
    const endTime = performance.now()
    const duration = endTime - startTime
    // 大量検証が合理的な時間内で完了することを確認（1秒以内）
    expect(duration).toBeLessThan(1000)
  })
)
import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { Effect } from 'effect'
import { Schema } from '@effect/schema'
import {
  Vector3Schema,
  BiomeType,
  BiomeInfoSchema,
  StructureSchema,
  type Vector3,
  type BiomeType as BiomeTypeT,
  type BiomeInfo,
  type Structure,
} from '../types'

describe('World Generation Types', () => {
  describe('Vector3Schema', () => {
  it.effect('validates valid 3D coordinates', () => Effect.gen(function* () {
    const validVectors: Vector3[] = [
    { x: 0, y: 0, z: 0 },
    { x: 100, y: 64, z: -50 },
    { x: -1000, y: 319, z: 1000 },
    { x: 1.5, y: 2.7, z: -3.14159 },
    { x: Number.MAX_SAFE_INTEGER, y: Number.MIN_SAFE_INTEGER, z: 0 },
    ]
    for (
    expect(() => Schema.decodeUnknownSync(Vector3Schema)(vector)).not.toThrow()
    ) {$2
})
),
    Effect.gen(function* () {
    const invalidVectors = [
    { x: 'invalid', y: 0, z: 0 },
    { x: 0, y: null, z: 0 },
    { x: 0, y: 0, z: undefined },
    { x: 0, y: 0 }, // missing z
    { y: 0, z: 0 }, // missing x
    { x: 0, z: 0 }, // missing y
    { x: 0, y: 0, z: 0, extra: 'property' },
    { x: Infinity, y: 0, z: 0 },
    { x: 0, y: NaN, z: 0 },
    null,
    undefined,
    'string',
    123,
    [],
    ]
    for (const [index, vector] of invalidVectors.entries()) {
    expect(
    () => Schema.decodeUnknownSync(Vector3Schema)(vector),
    `Test case ${index}: ${JSON.stringify(vector)}`
    ).toThrow()
  })
),
  Effect.gen(function* () {
        // REMOVED: // REMOVED: fc.assert(
        // REMOVED: fc.property(
        // REMOVED: fc.record({
        x: // REMOVED: fc.float({ min: -1000000, max: 1000000, noNaN: true
        
    }),
    y: // REMOVED: fc.float({ min: -1000000, max: 1000000, noNaN: true }),
        z: // REMOVED: fc.float({ min: -1000000, max: 1000000, noNaN: true }),
        }),
        (vector) => {
        expect(() => Schema.decodeUnknownSync(Vector3Schema)(vector)).not.toThrow()
        const decoded = Schema.decodeUnknownSync(Vector3Schema)(vector)
        expect(decoded.x).toBe(vector.x)
        expect(decoded.y).toBe(vector.y)
        expect(decoded.z).toBe(vector.z)
        ),
        { numRuns: 100 }
        )
        it.effect('preserves exact numerical values', () => Effect.gen(function* () {
    const preciseVectors = [
    { x: 0.123456789, y: -0.987654321, z: 3.141592653589793 },
    { x: 1e-10, y: 1e10, z: -1e-10 },
    { x: 2.2250738585072014e-308, y: 1.7976931348623157e308, z: 0 },
    ]
    for (
    const decoded = Schema.decodeUnknownSync(Vector3Schema)(vector)
    expect(decoded.x).toBe(vector.x)
    expect(decoded.y).toBe(vector.y)
    expect(decoded.z).toBe(vector.z)
    ) {$2}
    )
  }) {it.effect('validates all supported biome types', () => Effect.gen(function* () {
    const validBiomeTypes: BiomeTypeT[] = [
    'plains',
    'desert',
    'forest',
    'jungle',
    'swamp',
    'taiga',
    'snowy_tundra',
    'mountains',
    'ocean',
    'river',
    'beach',
    'mushroom_fields',
    'savanna',
    'badlands',
    'nether',
    'end',
    'void',
    ]
    expect(validBiomeTypes).toHaveLength(17) // 17の異なるバイオーム
    for (
    expect(() => Schema.decodeUnknownSync(BiomeType)(biomeType)).not.toThrow()
    const decoded = Schema.decodeUnknownSync(BiomeType)(biomeType)
    expect(decoded).toBe(biomeType)
    ) {$2}
    )
    it.effect('rejects invalid biome types', () => Effect.gen(function* () {
    const invalidBiomeTypes = [
    'invalid_biome',
    'PLAINS', // 大文字
    'Desert', // 大文字混じり
    'plains_biome', // 追加文字
    'plain', // 短縮
    '',
    ' plains', // 前スペース
    'plains ', // 後スペース
    'plains\n', // 改行
    'plains\t', // タブ
    null,
    undefined,
    123,
    [],
    {},
    true,
    false,
    ]
    for (
    expect(() => Schema.decodeUnknownSync(BiomeType)(biomeType)).toThrow()
    ) {$2}
    )
    it.effect('categorizes biomes by environment type', () => Effect.gen(function* () {
    const temperateTypes = ['plains', 'forest', 'river', 'beach']
    const coldTypes = ['taiga', 'snowy_tundra', 'mountains']
    const hotTypes = ['desert', 'savanna', 'badlands']
    const wetTypes = ['swamp', 'jungle', 'ocean']
    const specialTypes = ['mushroom_fields', 'nether', 'end', 'void']
    const allTypes = [...temperateTypes, ...coldTypes, ...hotTypes, ...wetTypes, ...specialTypes]
    // すべてのタイプが有効であることを確認
    for (
    expect(() => Schema.decodeUnknownSync(BiomeType)(biomeType)).not.toThrow()
    // 重複がないことを確認
    const uniqueTypes = new Set(allTypes)
    expect(uniqueTypes.size).toBe(allTypes.length)
    expect(uniqueTypes.size).toBe(17)
    ) {$2}
    )
    it.effect('maintains biome type immutability', () => Effect.gen(function* () {
    const biomeType: BiomeTypeT = 'forest'
    const decoded = Schema.decodeUnknownSync(BiomeType)(biomeType)
    expect(decoded).toBe(biomeType)
    // プリミティブ値（string）自体はfreezeできないが、Schema処理後も同じ値であることを確認
    expect(typeof decoded).toBe('string')
    expect(decoded).toEqual('forest')
    )
    describe('BiomeInfoSchema', () => {
    it.effect('validates complete biome information', () => Effect.gen(function* () {
    const validBiomeInfos: BiomeInfo[] = [
    {
    type: 'plains',
    temperature: 0.8,
    humidity: 0.4,
    elevation: 0.1,
    },
    {
    type: 'desert',
    temperature: 2.0,
    humidity: 0.0,
    elevation: 0.125,
    },
    {
    type: 'snowy_tundra',
    temperature: 0.0,
    humidity: 0.5,
    elevation: 0.125,
    },
    {
    type: 'ocean',
    temperature: 0.5,
    humidity: 0.5,
    elevation: -0.5,
    },
    {
    type: 'mountains',
    temperature: 0.2,
    humidity: 0.3,
    elevation: 0.8,
    },
    ]
    for (
    expect(() => Schema.decodeUnknownSync(BiomeInfoSchema)(biomeInfo)).not.toThrow()
    const decoded = Schema.decodeUnknownSync(BiomeInfoSchema)(biomeInfo)
    expect(decoded.type).toBe(biomeInfo.type)
    expect(decoded.temperature).toBe(biomeInfo.temperature)
    expect(decoded.humidity).toBe(biomeInfo.humidity)
    expect(decoded.elevation).toBe(biomeInfo.elevation)
    ) {$2
})
),
    Effect.gen(function* () {
    const invalidBiomeInfos = [
    { type: 'plains', temperature: 0.8, humidity: 0.4 }, // missing elevation
    { temperature: 0.8, humidity: 0.4, elevation: 0.1 }, // missing type
    { type: 'invalid_type', temperature: 0.8, humidity: 0.4, elevation: 0.1 },
    { type: 'plains', temperature: 'hot', humidity: 0.4, elevation: 0.1 },
    { type: 'plains', temperature: 0.8, humidity: null, elevation: 0.1 },
    { type: 'plains', temperature: 0.8, humidity: 0.4, elevation: undefined },
    { type: 'plains', temperature: NaN, humidity: 0.4, elevation: 0.1 },
    { type: 'plains', temperature: Infinity, humidity: 0.4, elevation: 0.1 },
    null,
    undefined,
    'string',
    123,
    [],
    ]
    for (
    expect(() => Schema.decodeUnknownSync(BiomeInfoSchema)(biomeInfo)).toThrow()
    ) {$2}
    )

    it.effect('validates biome info using property-based testing', () => Effect.gen(function* () {
    // REMOVED: // REMOVED: fc.assert(
    // REMOVED: fc.property(
    // REMOVED: fc.record({
    type: // REMOVED: fc.constantFrom(
    'plains',
    'desert',
    'forest',
    'jungle',
    'swamp',
    'taiga',
    'snowy_tundra',
    'mountains',
    'ocean',
    'river',
    'beach',
    'mushroom_fields',
    'savanna',
    'badlands',
    'nether',
    'end',
    'void'
    ),
    temperature: // REMOVED: fc.float({ min: -10, max: 10, noNaN: true
    
    }),
    humidity: // REMOVED: fc.float({ min: -5, max: 5, noNaN: true }),
    elevation: // REMOVED: fc.float({ min: -2, max: 2, noNaN: true }),
    }),
    (biomeInfo) => {
    expect(() => Schema.decodeUnknownSync(BiomeInfoSchema)(biomeInfo)).not.toThrow()
    const decoded = Schema.decodeUnknownSync(BiomeInfoSchema)(biomeInfo)
    expect(decoded).toEqual(biomeInfo)
    ),
    { numRuns: 100 }
    )
    it.effect('handles extreme numerical values', () => Effect.gen(function* () {
    const extremeBiomeInfos: BiomeInfo[] = [
    {
    type: 'nether',
    temperature: Number.MAX_SAFE_INTEGER,
    humidity: Number.MIN_SAFE_INTEGER,
    elevation: 0,
    },
    {
    type: 'void',
    temperature: -1e10,
    humidity: 1e10,
    elevation: -1e10,
    },
    {
    type: 'end',
    temperature: 1e-10,
    humidity: -1e-10,
    elevation: 1e-10,
    },
    ]
    for (
    expect(() => Schema.decodeUnknownSync(BiomeInfoSchema)(biomeInfo)).not.toThrow()
    const decoded = Schema.decodeUnknownSync(BiomeInfoSchema)(biomeInfo)
    expect(decoded.temperature).toBe(biomeInfo.temperature)
    expect(decoded.humidity).toBe(biomeInfo.humidity)
    expect(decoded.elevation).toBe(biomeInfo.elevation)
    ) {$2}
    )
  }) {
    it.effect('validates complete structure information', () => Effect.gen(function* () {
    const validStructures: Structure[] = [
    {
    type: 'village',
    position: { x: 100, y: 64, z: 200 },
    boundingBox: {
    min: { x: 90, y: 64, z: 190 },
    max: { x: 110, y: 80, z: 210 },
    },
    metadata: {
    population: 10,
    generated: Date.now(),
    biome: 'plains',
    },
    },
    {
    type: 'mineshaft',
    position: { x: 0, y: 30, z: 0 },
    boundingBox: {
    min: { x: -50, y: 10, z: -50 },
    max: { x: 50, y: 50, z: 50 },
    },
    metadata: {
    length: 500,
    depth: 40,
    hasChests: true,
    },
    },
    {
    type: 'stronghold',
    position: { x: -500, y: 20, z: 1000 },
    boundingBox: {
    min: { x: -600, y: 0, z: 900 },
    max: { x: -400, y: 60, z: 1100 },
    },
    metadata: {
    rooms: 15,
    hasPortal: true,
    discovered: false,
    },
    },
    ]
    for (
    expect(() => Schema.decodeUnknownSync(StructureSchema)(structure)).not.toThrow()
    const decoded = Schema.decodeUnknownSync(StructureSchema)(structure)
    expect(decoded.type).toBe(structure.type)
    expect(decoded.position).toEqual(structure.position)
    expect(decoded.boundingBox).toEqual(structure.boundingBox)
    expect(decoded.metadata).toEqual(structure.metadata)
    ) {$2}
    )
    it.effect('rejects invalid structure information', () => Effect.gen(function* () {
    const invalidStructures = [
    // missing type
    {
    position: { x: 100, y: 64, z: 200 },
    boundingBox: {
    min: { x: 90, y: 64, z: 190 },
    max: { x: 110, y: 80, z: 210 },
    },
    metadata: {},
    },
    // invalid position
    {
    type: 'village',
    position: { x: 'invalid', y: 64, z: 200 },
    boundingBox: {
    min: { x: 90, y: 64, z: 190 },
    max: { x: 110, y: 80, z: 210 },
    },
    metadata: {},
    },
    // missing boundingBox
    {
    type: 'village',
    position: { x: 100, y: 64, z: 200 },
    metadata: {},
    },
    // invalid boundingBox min
    {
    type: 'village',
    position: { x: 100, y: 64, z: 200 },
    boundingBox: {
    min: { x: 90, z: 190 }, // missing y
    max: { x: 110, y: 80, z: 210 },
    },
    metadata: {},
    },
    // invalid boundingBox max
    {
    type: 'village',
    position: { x: 100, y: 64, z: 200 },
    boundingBox: {
    min: { x: 90, y: 64, z: 190 },
    max: { x: null, y: 80, z: 210 },
    },
    metadata: {},
    },
    // missing metadata
    {
    type: 'village',
    position: { x: 100, y: 64, z: 200 },
    boundingBox: {
    min: { x: 90, y: 64, z: 190 },
    max: { x: 110, y: 80, z: 210 },
    },
    },
    // invalid metadata (not an object)
    {
    type: 'village',
    position: { x: 100, y: 64, z: 200 },
    boundingBox: {
    min: { x: 90, y: 64, z: 190 },
    max: { x: 110, y: 80, z: 210 },
    },
    metadata: 'invalid',
    },
    null,
    undefined,
    'string',
    123,
    [],
    ]
    for (
    expect(() => Schema.decodeUnknownSync(StructureSchema)(structure)).toThrow()
    ) {$2}
    )
    it.effect('validates structures with diverse metadata', () => Effect.gen(function* () {
    const structuresWithDiverseMetadata: Structure[] = [
    {
    type: 'temple',
    position: { x: 0, y: 64, z: 0 },
    boundingBox: {
    min: { x: -10, y: 60, z: -10 },
    max: { x: 10, y: 80, z: 10 },
    },
    metadata: {}, // 空のメタデータ
    },
    {
    type: 'dungeon',
    position: { x: 50, y: 40, z: 100 },
    boundingBox: {
    min: { x: 45, y: 35, z: 95 },
    max: { x: 55, y: 45, z: 105 },
    },
    metadata: {
    // 様々な型のメタデータ
    stringValue: 'test',
    numberValue: 123,
    booleanValue: true,
    arrayValue: [1, 2, 3],
    objectValue: { nested: 'value' },
    nullValue: null,
    undefinedValue: undefined,
    },
    },
    {
    type: 'custom_structure',
    position: { x: -100, y: 100, z: -200 },
    boundingBox: {
    min: { x: -150, y: 80, z: -250 },
    max: { x: -50, y: 120, z: -150 },
    },
    metadata: {
    // 複雑なネストされたメタデータ
    config: {
    levels: [
    { floor: 1, rooms: 5 },
    { floor: 2, rooms: 3 },
    ],
    features: {
    hasElevator: true,
    hasSecretRoom: false,
    treasureRooms: [
    { level: 1, position: { x: 10, y: 5 } },
    { level: 2, position: { x: -5, y: 15 } },
    ],
    },
    },
    },
    },
    ]
    for (
    expect(() => Schema.decodeUnknownSync(StructureSchema)(structure)).not.toThrow()
    const decoded = Schema.decodeUnknownSync(StructureSchema)(structure)
    expect(decoded.metadata).toEqual(structure.metadata)
    ) {$2}
    )
    it.effect('validates structures using property-based testing', () => Effect.gen(function* () {
    // REMOVED: // REMOVED: fc.assert(
    // REMOVED: fc.property(
    // REMOVED: fc.record({
    type: // REMOVED: fc.string({ minLength: 1, maxLength: 50
    
    }),
    position: // REMOVED: fc.record({
    x: // REMOVED: fc.float({ min: -100000, max: 100000, noNaN: true }),
    y: // REMOVED: fc.float({ min: -100, max: 500, noNaN: true }),
    z: // REMOVED: fc.float({ min: -100000, max: 100000, noNaN: true }),
    }),
    boundingBox: // REMOVED: fc.record({
    min: // REMOVED: fc.record({
    x: // REMOVED: fc.float({ min: -100000, max: 100000, noNaN: true }),
    y: // REMOVED: fc.float({ min: -100, max: 500, noNaN: true }),
    z: // REMOVED: fc.float({ min: -100000, max: 100000, noNaN: true }),
    }),
    max: // REMOVED: fc.record({
    x: // REMOVED: fc.float({ min: -100000, max: 100000, noNaN: true }),
    y: // REMOVED: fc.float({ min: -100, max: 500, noNaN: true }),
    z: // REMOVED: fc.float({ min: -100000, max: 100000, noNaN: true }),
    }),
    }),
    metadata: // REMOVED: fc.dictionary(
    fc
    .string({ minLength: 1, maxLength: 20
  }) !['__proto__', 'constructor', 'prototype'].includes(key)),
        // REMOVED: fc.oneof(// REMOVED: fc.string(), // REMOVED: fc.integer(), // REMOVED: fc.boolean(), // REMOVED: fc.constant(null))
        ),
        }),
        (structure) => {
        expect(() => Schema.decodeUnknownSync(StructureSchema)(structure)).not.toThrow()
        const decoded = Schema.decodeUnknownSync(StructureSchema)(structure)
        // metadataのプロトタイプの違いを無視して比較
        expect(decoded.type).toEqual(structure.type)
        expect(decoded.position).toEqual(structure.position)
        expect(decoded.boundingBox).toEqual(structure.boundingBox)
        // metadataの内容を比較（プロトタイプの違いは無視）
        expect(Object.keys(decoded.metadata)).toEqual(Object.keys(structure.metadata))
        for (const key of Object.keys(structure.metadata)) {
        expect(decoded.metadata[key]).toEqual(structure.metadata[key])
        ),
        { numRuns: 50 }
        )
        it.effect('handles structures with extreme coordinate values', () => Effect.gen(function* () {
    const extremeStructure: Structure = {
    type: 'extreme_test',
    position: {
    x: Number.MAX_SAFE_INTEGER,
    y: Number.MIN_SAFE_INTEGER,
    z: 0,
    },
    boundingBox: {
    min: {
    x: Number.MIN_SAFE_INTEGER,
    y: -1e10,
    z: -1e10,
    },
    max: {
    x: Number.MAX_SAFE_INTEGER,
    y: 1e10,
    z: 1e10,
    },
    },
    metadata: {
    extremeTest: true,
    maxValue: Number.MAX_SAFE_INTEGER,
    minValue: Number.MIN_SAFE_INTEGER,
    },
    expect(() => Schema.decodeUnknownSync(StructureSchema)(extremeStructure)).not.toThrow()
    const decoded = Schema.decodeUnknownSync(StructureSchema)(extremeStructure)
    expect(decoded.position.x).toBe(Number.MAX_SAFE_INTEGER)
    expect(decoded.position.y).toBe(Number.MIN_SAFE_INTEGER)
    expect(decoded.boundingBox.min.x).toBe(Number.MIN_SAFE_INTEGER)
    expect(decoded.boundingBox.max.x).toBe(Number.MAX_SAFE_INTEGER)
  }) {
  it.effect('validates complex world data combining all types', () => Effect.gen(function* () {
    const worldData = {
    playerPosition: { x: 128, y: 64, z: 256 },
    spawnPoint: { x: 0, y: 64, z: 0 },
    currentBiome: {
    type: 'forest' as BiomeTypeT,
    temperature: 0.7,
    humidity: 0.8,
    elevation: 0.2,
    },
    nearbyStructures: [
    {
    type: 'village',
    position: { x: 200, y: 64, z: 300 },
    boundingBox: {
    min: { x: 180, y: 64, z: 280 },
    max: { x: 220, y: 80, z: 320 },
    },
    metadata: {
    population: 15,
    biome: 'forest',
    },
    },
    {
    type: 'mineshaft',
    position: { x: 150, y: 30, z: 200 },
    boundingBox: {
    min: { x: 100, y: 10, z: 150 },
    max: { x: 200, y: 50, z: 250 },
    },
    metadata: {
    depth: 40,
    explored: false,
    },
    },
    ],
    // 各コンポーネントを個別に検証
    expect(() => Schema.decodeUnknownSync(Vector3Schema)(worldData.playerPosition)).not.toThrow()
    expect(() => Schema.decodeUnknownSync(Vector3Schema)(worldData.spawnPoint)).not.toThrow()
    expect(() => Schema.decodeUnknownSync(BiomeInfoSchema)(worldData.currentBiome)).not.toThrow()
    for (
    expect(() => Schema.decodeUnknownSync(StructureSchema)(structure)).not.toThrow()
    ) {$2
  })
),
    Effect.gen(function* () {
    // Vector3を必要とする構造体でBiomeInfoを使おうとするとエラーになることを確認
    const biomeInfo: BiomeInfo = {
    type: 'plains',
    temperature: 0.8,
    humidity: 0.4,
    elevation: 0.1,
    // biomeInfoはVector3ではないため、型エラーとなる
    expect(() => Schema.decodeUnknownSync(Vector3Schema)(biomeInfo)).toThrow()
    // 正しい型の場合は成功
    const vector: Vector3 = { x: 0, y: 0, z: 0 }
    expect(() => Schema.decodeUnknownSync(Vector3Schema)(vector)).not.toThrow()
  })
),
  Effect.gen(function* () {
        // Vector3Schemaを使用した複合スキーマの例
        const LocationWithBiomeSchema = Schema.Struct({
        position: Vector3Schema,
        biome: BiomeInfoSchema,
        timestamp: Schema.Number,
        )
        const locationData = {
        position: { x: 100, y: 64, z: 200 },
        biome: {
        type: 'desert' as BiomeTypeT,
        temperature: 2.0,
        humidity: 0.0,
        elevation: 0.125,
        },
        timestamp: Date.now(),
        expect(() => Schema.decodeUnknownSync(LocationWithBiomeSchema)(locationData)).not.toThrow()
        const decoded = Schema.decodeUnknownSync(LocationWithBiomeSchema)(locationData)
        expect(decoded.position).toEqual(locationData.position)
        expect(decoded.biome).toEqual(locationData.biome)
        expect(decoded.timestamp).toBe(locationData.timestamp)
        describe('Performance and Edge Cases', () => {
  it.effect('handles large-scale validation efficiently', () => Effect.gen(function* () {
    const largeDataset = {
    positions: Array.from({ length: 1000 }, (_, i) => ({
    x: i * 10,
    y: 64 + (i % 100),
    z: i * 7,
}),
    biomes: Array.from({ length: 500 }, (_, i) => ({
    type: (['plains', 'forest', 'desert', 'ocean', 'mountains'] as BiomeTypeT[])[i % 5],
    temperature: (i % 10) / 10,
    humidity: ((i + 3) % 10) / 10,
    elevation: ((i + 7) % 20) / 100,
  })
),
    const startTime = performance.now()
    for (
    expect(() => Schema.decodeUnknownSync(Vector3Schema)(position)).not.toThrow()
    for (const biome of largeDataset.biomes) {
    expect(() => Schema.decodeUnknownSync(BiomeInfoSchema)(biome)).not.toThrow()
    const endTime = performance.now()
    const duration = endTime - startTime
    // 大量データの検証が合理的な時間内で完了することを確認（1秒以内）
    expect(duration).toBeLessThan(1000)
) {$2}
    )

    it.effect('maintains schema stability across different JavaScript engines', () => Effect.gen(function* () {
    // 型の基本的な動作が環境に依存しないことを確認
    const testData = {
    vector: { x: 1.23456789, y: -9.87654321, z: 0 },
    biomeType: 'forest' as BiomeTypeT,
    biomeInfo: {
    type: 'ocean' as BiomeTypeT,
    temperature: 0.5,
    humidity: 0.9,
    elevation: -0.3,
    },
    // 異なる数値表現での一貫性
    expect(Schema.decodeUnknownSync(Vector3Schema)(testData.vector).x).toBe(1.23456789)
    expect(Schema.decodeUnknownSync(BiomeType)(testData.biomeType)).toBe('forest')
    expect(Schema.decodeUnknownSync(BiomeInfoSchema)(testData.biomeInfo).temperature).toBe(0.5)
  })
)
})

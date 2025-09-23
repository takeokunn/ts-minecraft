---
title: 'チャンクフォーマット仕様 - バイナリデータ構造・圧縮'
description: '16x16x384ブロックチャンクのバイナリフォーマット、圧縮アルゴリズム、パフォーマンス最適化の完全仕様。'
category: 'specification'
difficulty: 'advanced'
tags: ['chunk-format', 'binary-data', 'compression', 'data-serialization', 'world-data', 'performance-optimization']
prerequisites: ['effect-ts-fundamentals', 'binary-data-handling', 'compression-algorithms', 'chunk-system']
estimated_reading_time: '15分'
related_patterns: ['data-serialization-patterns', 'compression-patterns', 'optimization-patterns']
related_docs:
  [
    '../../explanations/game-mechanics/core-features/chunk-system.md',
    './world-data-structure.md',
    './save-file-format.md',
  ]
---

# チャンクフォーマット仕様

## 概要

Minecraftチャンクの詳細なデータフォーマット仕様です。16x256x16ブロックの効率的な格納と高速アクセスを実現する最適化されたデータ構造を定義します。

## チャンク基本構造

### チャンク定数

```typescript
export const CHUNK_CONSTANTS = {
  WIDTH: 16, // X軸サイズ
  HEIGHT: 256, // Y軸サイズ（ワールド高さ）
  DEPTH: 16, // Z軸サイズ
  SECTION_HEIGHT: 16, // セクション高さ
  SECTIONS: 16, // セクション数 (256 / 16)
  TOTAL_BLOCKS: 65536, // 16 * 256 * 16
  SECTION_BLOCKS: 4096, // 16 * 16 * 16
} as const
```

### チャンクスキーマ

```typescript
import { Schema, Effect, pipe, Match, Option } from 'effect'

// エラー型定義
export const CompressionErrorSchema = Schema.Struct({
  _tag: Schema.Literal('CompressionError'),
  message: Schema.String,
  operation: Schema.Union(
    Schema.Literal('serialize'),
    Schema.Literal('deserialize'),
    Schema.Literal('compress'),
    Schema.Literal('decompress')
  ),
})

export type CompressionError = Schema.Schema.Type<typeof CompressionErrorSchema>

export const CompressionError = (params: Omit<CompressionError, '_tag'>): CompressionError => ({
  _tag: 'CompressionError' as const,
  ...params,
})

export const FileErrorSchema = Schema.Struct({
  _tag: Schema.Literal('FileError'),
  message: Schema.String,
  operation: Schema.Union(
    Schema.Literal('read'),
    Schema.Literal('write'),
    Schema.Literal('create'),
    Schema.Literal('delete')
  ),
})

export type FileError = Schema.Schema.Type<typeof FileErrorSchema>

export const FileError = (params: Omit<FileError, '_tag'>): FileError => ({
  _tag: 'FileError' as const,
  ...params,
})

// バイオームデータスキーマ（仮定義）
export const BiomeDataSchema = Schema.Struct({
  biomes: Schema.Array(Schema.Number.pipe(Schema.int(), Schema.nonnegative())).pipe(
    Schema.maxItems(1024) // 16x16x4 (Y軸は4セクション単位)
  ),
})
export type BiomeData = Schema.Schema.Type<typeof BiomeDataSchema>

// チャンク座標
export const ChunkPositionSchema = Schema.Struct({
  x: Schema.Number.pipe(Schema.int()),
  z: Schema.Number.pipe(Schema.int()),
})
export type ChunkPosition = Schema.Schema.Type<typeof ChunkPositionSchema>

// バージョン情報
export const ChunkVersionSchema = Schema.Struct({
  format: Schema.Number.pipe(Schema.int(), Schema.positive(), Schema.brand('ChunkFormatVersion')),
  gameVersion: Schema.String.pipe(Schema.pattern(/^\d+\.\d+\.\d+$/), Schema.brand('GameVersion')),
})
export type ChunkVersion = Schema.Schema.Type<typeof ChunkVersionSchema>

// チャンクステータス
export const ChunkStatusSchema = Schema.Union(
  Schema.Literal('empty'),
  Schema.Literal('structure_starts'),
  Schema.Literal('structure_references'),
  Schema.Literal('biomes'),
  Schema.Literal('noise'),
  Schema.Literal('surface'),
  Schema.Literal('carvers'),
  Schema.Literal('liquid_carvers'),
  Schema.Literal('features'),
  Schema.Literal('light'),
  Schema.Literal('spawn'),
  Schema.Literal('heightmaps'),
  Schema.Literal('full')
)
export type ChunkStatus = Schema.Schema.Type<typeof ChunkStatusSchema>

// メタデータ
export const ChunkMetadataSchema = Schema.Struct({
  generatedAt: Schema.Number.pipe(Schema.int(), Schema.nonnegative(), Schema.brand('Timestamp')),
  lastModified: Schema.Number.pipe(Schema.int(), Schema.nonnegative(), Schema.brand('Timestamp')),
  inhabitedTime: Schema.Number.pipe(Schema.int(), Schema.nonnegative(), Schema.brand('InhabitedTime')),
  status: ChunkStatusSchema,
})
export type ChunkMetadata = Schema.Schema.Type<typeof ChunkMetadataSchema>

// メインチャンクスキーマ
export const ChunkSchema = Schema.Struct({
  position: ChunkPositionSchema,
  version: ChunkVersionSchema,
  sections: Schema.Array(ChunkSectionSchema).pipe(Schema.itemsCount(16), Schema.brand('ChunkSections')),
  biomes: BiomeDataSchema,
  blockEntities: Schema.Array(BlockEntitySchema),
  heightMaps: HeightMapSchema,
  lighting: LightingSchema,
  metadata: ChunkMetadataSchema,
})
export type Chunk = Schema.Schema.Type<typeof ChunkSchema>
```

## チャンクセクション構造

### セクションフォーマット

```typescript
// セクションY座標ブランド型
export const SectionYSchema = Schema.Number.pipe(Schema.int(), Schema.between(0, 15), Schema.brand('SectionY'))
export type SectionY = Schema.Schema.Type<typeof SectionYSchema>

// ビットストレージスキーマ
export const BitStorageSchema = Schema.Struct({
  data: Schema.instanceOf(Uint32Array).pipe(Schema.brand('BitStorageData')),
  bitsPerEntry: Schema.Number.pipe(Schema.int(), Schema.between(4, 32), Schema.brand('BitsPerEntry')),
  mask: Schema.Number.pipe(Schema.int(), Schema.nonnegative(), Schema.brand('BitMask')),
  entriesPerLong: Schema.Number.pipe(Schema.int(), Schema.positive(), Schema.brand('EntriesPerLong')),
}).pipe(
  Schema.filter(({ data, bitsPerEntry, entriesPerLong }) => {
    const expectedSize = Math.ceil(4096 / entriesPerLong)
    return data.length === expectedSize
  })
)
export type BitStorage = Schema.Schema.Type<typeof BitStorageSchema>

// パレット化されたコンテナ
export const PalettedContainerSchema = Schema.Struct({
  palette: Schema.Array(Schema.Number.pipe(Schema.int(), Schema.nonnegative(), Schema.brand('BlockStateId'))).pipe(
    Schema.minItems(1),
    Schema.maxItems(4096) // 最大ブロック状態数
  ),
  storage: BitStorageSchema,
}).pipe(
  Schema.filter(({ palette, storage }) => {
    // パレットサイズとビット数の整合性をチェック
    const requiredBits = Math.max(4, Math.ceil(Math.log2(palette.length)))
    return storage.bitsPerEntry >= requiredBits
  })
)
export type PalettedContainer = Schema.Schema.Type<typeof PalettedContainerSchema>

// チャンクセクション
export const ChunkSectionSchema = Schema.Struct({
  y: SectionYSchema,
  blockStates: PalettedContainerSchema,
  biomes: Schema.optional(PalettedContainerSchema),
  skyLight: Schema.optional(NibbleArraySchema),
  blockLight: Schema.optional(NibbleArraySchema),
  empty: Schema.Boolean,
})
export type ChunkSection = Schema.Schema.Type<typeof ChunkSectionSchema>
```

### 高性能ビットストレージ実装

```typescript
import { Effect, pipe } from 'effect'

// ビットストレージエラー型
export class BitStorageError extends Error {
  readonly _tag = 'BitStorageError'
  constructor(
    readonly message: string,
    readonly details?: unknown
  ) {
    super(message)
  }
}

// インデックス境界エラー
export class IndexOutOfBoundsError extends BitStorageError {
  readonly _tag = 'IndexOutOfBoundsError'
  constructor(
    readonly index: number,
    readonly maxIndex: number
  ) {
    super(`Index ${index} is out of bounds (max: ${maxIndex})`)
  }
}

// ビットストレージサービス
export const BitStorageService = {
  // 安全な作成
  create: (bitsPerEntry: number, size: number): Effect.Effect<BitStorage, BitStorageError> =>
    Effect.gen(function* () {
      if (bitsPerEntry < 4 || bitsPerEntry > 32) {
        return yield* Effect.fail(new BitStorageError('Bits per entry must be between 4 and 32'))
      }
      if (size <= 0) {
        return yield* Effect.fail(new BitStorageError('Size must be positive'))
      }

      const mask = (1 << bitsPerEntry) - 1
      const entriesPerLong = Math.floor(32 / bitsPerEntry)
      const longsNeeded = Math.ceil(size / entriesPerLong)
      const data = new Uint32Array(longsNeeded)

      return {
        data,
        bitsPerEntry,
        mask,
        entriesPerLong,
      }
    }),

  // 安全なアクセス
  get: (storage: BitStorage, index: number): Effect.Effect<number, IndexOutOfBoundsError> =>
    Effect.gen(function* () {
      const maxIndex = BitStorageService.getSize(storage) - 1
      if (index < 0 || index > maxIndex) {
        return yield* Effect.fail(new IndexOutOfBoundsError(index, maxIndex))
      }

      const longIndex = Math.floor(index / storage.entriesPerLong)
      const bitIndex = (index % storage.entriesPerLong) * storage.bitsPerEntry

      return (storage.data[longIndex] >>> bitIndex) & storage.mask
    }),

  // 安全な設定
  set: (
    storage: BitStorage,
    index: number,
    value: number
  ): Effect.Effect<BitStorage, IndexOutOfBoundsError | BitStorageError> =>
    Effect.gen(function* () {
      const maxIndex = BitStorageService.getSize(storage) - 1
      if (index < 0 || index > maxIndex) {
        return yield* Effect.fail(new IndexOutOfBoundsError(index, maxIndex))
      }
      if (value < 0 || value > storage.mask) {
        return yield* Effect.fail(new BitStorageError(`Value ${value} exceeds mask ${storage.mask}`))
      }

      const longIndex = Math.floor(index / storage.entriesPerLong)
      const bitIndex = (index % storage.entriesPerLong) * storage.bitsPerEntry

      const newData = new Uint32Array(storage.data)
      newData[longIndex] = (newData[longIndex] & ~(storage.mask << bitIndex)) | ((value & storage.mask) << bitIndex)

      return {
        ...storage,
        data: newData,
      }
    }),

  // 動的リサイズ（エラーハンドリング付き）
  resize: (storage: BitStorage, newBitsPerEntry: number): Effect.Effect<BitStorage, BitStorageError> =>
    Effect.gen(function* () {
      const size = BitStorageService.getSize(storage)
      const newStorage = yield* BitStorageService.create(newBitsPerEntry, size)

      let result = newStorage
      for (let i = 0; i < size; i++) {
        const value = yield* BitStorageService.get(storage, i)
        result = yield* BitStorageService.set(result, i, value)
      }

      return result
    }),

  // サイズ計算
  getSize: (storage: BitStorage): number => {
    return storage.entriesPerLong * storage.data.length
  },

  // バイナリシリアライゼーション
  serialize: (storage: BitStorage): Effect.Effect<Uint8Array, never> =>
    Effect.succeed(new Uint8Array(storage.data.buffer)),

  // デシリアライゼーション
  deserialize: (
    data: Uint8Array,
    bitsPerEntry: number,
    entriesPerLong: number
  ): Effect.Effect<BitStorage, BitStorageError> =>
    Effect.gen(function* () {
      if (data.length % 4 !== 0) {
        return yield* Effect.fail(new BitStorageError('Data length must be multiple of 4'))
      }

      const uint32Data = new Uint32Array(data.buffer, data.byteOffset, data.length / 4)
      const mask = (1 << bitsPerEntry) - 1

      return {
        data: uint32Data,
        bitsPerEntry,
        mask,
        entriesPerLong,
      }
    }),
}

// Schemaとサービスの統合
export const createBitStorage = (bitsPerEntry: number, size: number) =>
  pipe(
    BitStorageService.create(bitsPerEntry, size),
    Effect.flatMap((storage) => Schema.encode(BitStorageSchema)(storage))
  )
```

## パレットシステム

### Effect-TS パレット管理システム

```typescript
// パレットコンテナエラー型
export class PalettedContainerError extends Error {
  readonly _tag = 'PalettedContainerError'
  constructor(
    readonly message: string,
    readonly details?: unknown
  ) {
    super(message)
  }
}

export class PaletteOverflowError extends PalettedContainerError {
  readonly _tag = 'PaletteOverflowError'
  constructor(
    readonly currentSize: number,
    readonly maxSize: number
  ) {
    super(`Palette size ${currentSize} exceeds maximum ${maxSize}`)
  }
}

// パレットコンテナサービス
export const PalettedContainerService = {
  // 安全なコンテナ作成
  create: (size: number = CHUNK_CONSTANTS.SECTION_BLOCKS): Effect.Effect<PalettedContainer, BitStorageError> =>
    Effect.gen(function* () {
      const storage = yield* BitStorageService.create(4, size) // 初期4ビット

      return {
        palette: [0], // Air block (ID: 0)
        storage,
      }
    }),

  // 型安全なブロック設定
  set: (
    container: PalettedContainer,
    index: number,
    blockState: number
  ): Effect.Effect<PalettedContainer, PalettedContainerError | BitStorageError | IndexOutOfBoundsError> =>
    Effect.gen(function* () {
      if (blockState < 0) {
        return yield* Effect.fail(new PalettedContainerError(`Invalid block state: ${blockState}`))
      }

      let paletteIndex = container.palette.indexOf(blockState)

      if (paletteIndex === -1) {
        // パレットに新しいブロック状態を追加
        paletteIndex = container.palette.length
        const newPalette = [...container.palette, blockState]

        // パレットサイズの検証
        const maxPaletteSize = 1 << container.storage.bitsPerEntry
        if (newPalette.length > maxPaletteSize) {
          // 自動リサイズを試行
          const resizedContainer = yield* PalettedContainerService.resize({
            ...container,
            palette: newPalette,
          })
          return yield* PalettedContainerService.set(resizedContainer, index, blockState)
        }

        const newStorage = yield* BitStorageService.set(container.storage, index, paletteIndex)
        return {
          palette: newPalette,
          storage: newStorage,
        }
      }

      const newStorage = yield* BitStorageService.set(container.storage, index, paletteIndex)
      return {
        ...container,
        storage: newStorage,
      }
    }),

  // 安全なブロック取得
  get: (container: PalettedContainer, index: number): Effect.Effect<number, IndexOutOfBoundsError> =>
    Effect.gen(function* () {
      const paletteIndex = yield* BitStorageService.get(container.storage, index)

      // パレットインデックスの境界チェック
      if (paletteIndex >= container.palette.length) {
        // フォールバック: Air block
        return 0
      }

      return container.palette[paletteIndex] || 0
    }),

  // インテリジェントリサイズ
  resize: (container: PalettedContainer): Effect.Effect<PalettedContainer, BitStorageError | PalettedContainerError> =>
    Effect.gen(function* () {
      const requiredBits = Math.max(4, Math.ceil(Math.log2(container.palette.length)))
      const optimalBits = Math.min(requiredBits, 14) // 最大14ビット

      if (optimalBits > 8) {
        // 直接ストレージモードに切り替え（パレット不使用）
        return yield* PalettedContainerService.convertToDirectStorage(container)
      }

      // パレットモードでリサイズ
      const newStorage = yield* BitStorageService.resize(container.storage, optimalBits)
      return {
        ...container,
        storage: newStorage,
      }
    }),

  // 直接ストレージモードへの変換
  convertToDirectStorage: (
    container: PalettedContainer
  ): Effect.Effect<PalettedContainer, BitStorageError | IndexOutOfBoundsError> =>
    Effect.gen(function* () {
      const size = BitStorageService.getSize(container.storage)
      let newStorage = yield* BitStorageService.create(14, size)

      // 全エントリを直接ストレージに変換
      for (let i = 0; i < size; i++) {
        const blockState = yield* PalettedContainerService.get(container, i)
        newStorage = yield* BitStorageService.set(newStorage, i, blockState)
      }

      return {
        palette: [], // 直接モードではパレット不要
        storage: newStorage,
      }
    }),

  // メモリ使用量推定
  getMemoryUsage: (container: PalettedContainer): number => {
    const paletteSize = container.palette.length * 4 // 32-bit integers
    const storageSize = container.storage.data.byteLength
    return paletteSize + storageSize
  },

  // 圧縮率計算
  getCompressionRatio: (container: PalettedContainer): number => {
    const uncompressedSize = BitStorageService.getSize(container.storage) * 4 // 32-bit per entry
    const compressedSize = PalettedContainerService.getMemoryUsage(container)
    return uncompressedSize / compressedSize
  },

  // パフォーマンス統計
  getStats: (container: PalettedContainer) => ({
    paletteSize: container.palette.length,
    bitsPerEntry: container.storage.bitsPerEntry,
    memoryUsage: PalettedContainerService.getMemoryUsage(container),
    compressionRatio: PalettedContainerService.getCompressionRatio(container),
    isDirect: container.palette.length === 0,
  }),
}
```

## 高さマップ

### 型安全な高さマップシステム

```typescript
// 高さ値のブランド型（0-384の範囲）
export const HeightValueSchema = Schema.Number.pipe(Schema.int(), Schema.between(0, 384), Schema.brand('HeightValue'))
export type HeightValue = Schema.Schema.Type<typeof HeightValueSchema>

// 圧縮された高さデータ配列
export const CompactLongArraySchema = Schema.Struct({
  data: Schema.instanceOf(BigUint64Array).pipe(Schema.brand('CompactLongData')),
  bitsPerValue: Schema.Number.pipe(Schema.int(), Schema.between(1, 64), Schema.brand('BitsPerValue')),
  size: Schema.Number.pipe(Schema.int(), Schema.positive(), Schema.brand('ArraySize')),
}).pipe(
  Schema.filter(({ data, bitsPerValue, size }) => {
    const expectedLongCount = Math.ceil((size * bitsPerValue) / 64)
    return data.length === expectedLongCount
  })
)
export type CompactLongArray = Schema.Schema.Type<typeof CompactLongArraySchema>

// 高さマップタイプ列挙
export const HeightMapTypeSchema = Schema.Union(
  Schema.Literal('MOTION_BLOCKING'),
  Schema.Literal('MOTION_BLOCKING_NO_LEAVES'),
  Schema.Literal('OCEAN_FLOOR'),
  Schema.Literal('WORLD_SURFACE')
)
export type HeightMapType = Schema.Schema.Type<typeof HeightMapTypeSchema>

// 個別の高さマップ
export const SingleHeightMapSchema = Schema.Struct({
  type: HeightMapTypeSchema,
  data: CompactLongArraySchema,
})
export type SingleHeightMap = Schema.Schema.Type<typeof SingleHeightMapSchema>

// 完全な高さマップコレクション
export const HeightMapSchema = Schema.Struct({
  MOTION_BLOCKING: CompactLongArraySchema,
  MOTION_BLOCKING_NO_LEAVES: CompactLongArraySchema,
  OCEAN_FLOOR: CompactLongArraySchema,
  WORLD_SURFACE: CompactLongArraySchema,
})
export type HeightMap = Schema.Schema.Type<typeof HeightMapSchema>
```

### Effect-TS 高さマップサービス

```typescript
// 高さマップエラー型
export class HeightMapError extends Error {
  readonly _tag = 'HeightMapError'
  constructor(
    readonly message: string,
    readonly details?: unknown
  ) {
    super(message)
  }
}

export const HeightMapService = {
  // 空の高さマップ作成
  createEmpty: (): Effect.Effect<HeightMap, HeightMapError> =>
    Effect.gen(function* () {
      const emptyData = yield* CompactLongArrayService.create(256, 9) // 16x16, 9 bits per height

      return {
        MOTION_BLOCKING: emptyData,
        MOTION_BLOCKING_NO_LEAVES: emptyData,
        OCEAN_FLOOR: emptyData,
        WORLD_SURFACE: emptyData,
      }
    }),

  // 特定位置の高さ取得
  getHeight: (heightMap: CompactLongArray, x: number, z: number): Effect.Effect<HeightValue, HeightMapError> =>
    Effect.gen(function* () {
      if (x < 0 || x >= 16 || z < 0 || z >= 16) {
        return yield* Effect.fail(new HeightMapError(`Coordinates out of bounds: (${x}, ${z})`))
      }

      const index = x + z * 16
      const height = yield* CompactLongArrayService.get(heightMap, index)

      return yield* Schema.decode(HeightValueSchema)(height)
    }),

  // 特定位置の高さ設定
  setHeight: (
    heightMap: CompactLongArray,
    x: number,
    z: number,
    height: HeightValue
  ): Effect.Effect<CompactLongArray, HeightMapError> =>
    Effect.gen(function* () {
      if (x < 0 || x >= 16 || z < 0 || z >= 16) {
        return yield* Effect.fail(new HeightMapError(`Coordinates out of bounds: (${x}, ${z})`))
      }

      const index = x + z * 16
      return yield* CompactLongArrayService.set(heightMap, index, height)
    }),
}

// 圧縮長整数配列サービス
export const CompactLongArrayService = {
  // 新しい配列作成
  create: (size: number, bitsPerValue: number): Effect.Effect<CompactLongArray, HeightMapError> =>
    Effect.gen(function* () {
      if (size <= 0 || bitsPerValue <= 0 || bitsPerValue > 64) {
        return yield* Effect.fail(new HeightMapError('Invalid parameters for CompactLongArray'))
      }

      const longCount = Math.ceil((size * bitsPerValue) / 64)
      const data = new BigUint64Array(longCount)

      return {
        data,
        bitsPerValue,
        size,
      }
    }),

  // 値の取得
  get: (array: CompactLongArray, index: number): Effect.Effect<number, HeightMapError> =>
    Effect.gen(function* () {
      if (index < 0 || index >= array.size) {
        return yield* Effect.fail(new HeightMapError(`Index ${index} out of bounds`))
      }

      const bitIndex = index * array.bitsPerValue
      const longIndex = Math.floor(bitIndex / 64)
      const bitOffset = bitIndex % 64

      const mask = (1n << BigInt(array.bitsPerValue)) - 1n
      const value = (array.data[longIndex] >> BigInt(bitOffset)) & mask

      return Number(value)
    }),

  // 値の設定
  set: (array: CompactLongArray, index: number, value: number): Effect.Effect<CompactLongArray, HeightMapError> =>
    Effect.gen(function* () {
      if (index < 0 || index >= array.size) {
        return yield* Effect.fail(new HeightMapError(`Index ${index} out of bounds`))
      }

      const maxValue = (1 << array.bitsPerValue) - 1
      if (value < 0 || value > maxValue) {
        return yield* Effect.fail(new HeightMapError(`Value ${value} exceeds ${maxValue}`))
      }

      const bitIndex = index * array.bitsPerValue
      const longIndex = Math.floor(bitIndex / 64)
      const bitOffset = bitIndex % 64

      const newData = new BigUint64Array(array.data)
      const mask = (1n << BigInt(array.bitsPerValue)) - 1n

      // 既存ビットをクリアして新しい値を設定
      newData[longIndex] = (newData[longIndex] & ~(mask << BigInt(bitOffset))) | (BigInt(value) << BigInt(bitOffset))

      return {
        ...array,
        data: newData,
      }
    }),
}
```

## ライティングデータ

### 高性能ライティングシステム

```typescript
// ライトレベル（0-15）のブランド型
export const LightLevelSchema = Schema.Number.pipe(Schema.int(), Schema.between(0, 15), Schema.brand('LightLevel'))
export type LightLevel = Schema.Schema.Type<typeof LightLevelSchema>

// 最適化されたNibble配列（4ビット値を効率的に格納）
export const NibbleArraySchema = Schema.transform(
  Schema.instanceOf(Uint8Array).pipe(
    Schema.filter((data) => data.length === 2048), // 16x16x16 / 2 = 2048 bytes
    Schema.brand('NibbleArrayData')
  ),
  Schema.Array(LightLevelSchema).pipe(
    Schema.itemsCount(4096), // 16x16x16 values
    Schema.brand('LightLevelArray')
  ),
  {
    decode: (data) =>
      Effect.gen(function* () {
        const result: LightLevel[] = []
        for (let i = 0; i < data.length; i++) {
          const lower = yield* Schema.decode(LightLevelSchema)(data[i] & 0x0f)
          const upper = yield* Schema.decode(LightLevelSchema)((data[i] >> 4) & 0x0f)
          result.push(lower, upper)
        }
        return result
      }),
    encode: (values) =>
      Effect.gen(function* () {
        if (values.length !== 4096) {
          return yield* Effect.fail(new Error('Invalid nibble array size'))
        }

        const data = new Uint8Array(2048)
        for (let i = 0; i < values.length; i += 2) {
          const lower = values[i] & 0x0f
          const upper = (values[i + 1] & 0x0f) << 4
          data[i / 2] = lower | upper
        }
        return data
      }),
  }
)
export type NibbleArray = Schema.Schema.Type<typeof NibbleArraySchema>

// セクション固有のライトデータ
export const SectionLightDataSchema = Schema.Struct({
  skyLight: Schema.optional(NibbleArraySchema),
  blockLight: Schema.optional(NibbleArraySchema),
})
export type SectionLightData = Schema.Schema.Type<typeof SectionLightDataSchema>

// 完全なライトデータ構造
export const LightDataSchema = Schema.Struct({
  sections: Schema.Array(Schema.optional(SectionLightDataSchema)).pipe(
    Schema.itemsCount(18), // 16 main sections + 2 boundary sections
    Schema.brand('LightSections')
  ),
})
export type LightData = Schema.Schema.Type<typeof LightDataSchema>

// ライティングシステム全体
export const LightingSchema = Schema.Struct({
  skyLight: LightDataSchema,
  blockLight: LightDataSchema,
  isLightCorrect: Schema.Boolean,
  lastUpdateTick: Schema.Number.pipe(Schema.int(), Schema.nonnegative(), Schema.brand('GameTick')),
})
export type Lighting = Schema.Schema.Type<typeof LightingSchema>

// ライティングエラー型
export class LightingError extends Error {
  readonly _tag = 'LightingError'
  constructor(
    readonly message: string,
    readonly details?: unknown
  ) {
    super(message)
  }
}

// 高性能ライティングサービス
export const LightingService = {
  // 空のライティングデータ作成
  createEmpty: (): Effect.Effect<Lighting, LightingError> =>
    Effect.gen(function* () {
      const emptySections = Array(18).fill(null) as Array<SectionLightData | null>

      return {
        skyLight: { sections: emptySections },
        blockLight: { sections: emptySections },
        isLightCorrect: false,
        lastUpdateTick: 0,
      }
    }),

  // 特定座標のライトレベル取得
  getLightLevel: (
    lighting: LightData,
    x: number,
    y: number,
    z: number,
    lightType: 'sky' | 'block'
  ): Effect.Effect<LightLevel, LightingError> =>
    Effect.gen(function* () {
      if (x < 0 || x >= 16 || z < 0 || z >= 16 || y < -16 || y >= 320) {
        return yield* Effect.fail(new LightingError(`Coordinates out of bounds: (${x}, ${y}, ${z})`))
      }

      const sectionY = Math.floor((y + 16) / 16) // -1 to 19 -> 0 to 17
      const section = lighting.sections[sectionY]

      if (!section) {
        return yield* Schema.decode(LightLevelSchema)(lightType === 'sky' ? 15 : 0)
      }

      const nibbleArray = lightType === 'sky' ? section.skyLight : section.blockLight
      if (!nibbleArray) {
        return yield* Schema.decode(LightLevelSchema)(lightType === 'sky' ? 15 : 0)
      }

      const localY = (((y + 16) % 16) + 16) % 16
      const index = localY * 256 + z * 16 + x

      return nibbleArray[index]
    }),

  // ライトレベル設定
  setLightLevel: (
    lighting: LightData,
    x: number,
    y: number,
    z: number,
    level: LightLevel,
    lightType: 'sky' | 'block'
  ): Effect.Effect<LightData, LightingError> =>
    Effect.gen(function* () {
      if (x < 0 || x >= 16 || z < 0 || z >= 16 || y < -16 || y >= 320) {
        return yield* Effect.fail(new LightingError(`Coordinates out of bounds: (${x}, ${y}, ${z})`))
      }

      const sectionY = Math.floor((y + 16) / 16)
      const localY = (((y + 16) % 16) + 16) % 16
      const index = localY * 256 + z * 16 + x

      const newSections = [...lighting.sections]

      // セクションが存在しない場合は作成
      if (!newSections[sectionY]) {
        newSections[sectionY] = {
          skyLight: lightType === 'sky' ? (Array(4096).fill(15) as LightLevel[]) : undefined,
          blockLight: lightType === 'block' ? (Array(4096).fill(0) as LightLevel[]) : undefined,
        }
      }

      const section = newSections[sectionY]!

      if (lightType === 'sky') {
        if (!section.skyLight) {
          section.skyLight = Array(4096).fill(15) as LightLevel[]
        }
        const newSkyLight = [...section.skyLight]
        newSkyLight[index] = level
        section.skyLight = newSkyLight
      } else {
        if (!section.blockLight) {
          section.blockLight = Array(4096).fill(0) as LightLevel[]
        }
        const newBlockLight = [...section.blockLight]
        newBlockLight[index] = level
        section.blockLight = newBlockLight
      }

      return {
        ...lighting,
        sections: newSections,
      }
    }),

  // ライティング再計算
  recalculateLighting: (lighting: Lighting, chunk: Chunk): Effect.Effect<Lighting, LightingError> =>
    Effect.gen(function* () {
      // 実装省略: 複雑なライティング計算アルゴリズム
      return {
        ...lighting,
        isLightCorrect: true,
        lastUpdateTick: yield* Effect.sync(() => Date.now()),
      }
    }),
}
```

## ブロックエンティティ

```typescript
// ブロックエンティティ位置（チャンク内の相対座標）
export const BlockEntityPositionSchema = Schema.Struct({
  x: Schema.Number.pipe(Schema.int(), Schema.between(0, 15), Schema.brand('RelativeX')),
  y: Schema.Number.pipe(Schema.int(), Schema.between(0, 383), Schema.brand('RelativeY')),
  z: Schema.Number.pipe(Schema.int(), Schema.between(0, 15), Schema.brand('RelativeZ')),
})
export type BlockEntityPosition = Schema.Schema.Type<typeof BlockEntityPositionSchema>

// ブロックエンティティタイプ
export const BlockEntityTypeSchema = Schema.Union(
  Schema.Literal('chest'),
  Schema.Literal('furnace'),
  Schema.Literal('sign'),
  Schema.Literal('spawner'),
  Schema.Literal('enchanting_table'),
  Schema.Literal('brewing_stand'),
  Schema.Literal('beacon'),
  Schema.Literal('hopper'),
  Schema.Literal('dropper'),
  Schema.Literal('dispenser'),
  Schema.Literal('shulker_box'),
  Schema.Literal('ender_chest'),
  Schema.Literal('barrel')
)
export type BlockEntityType = Schema.Schema.Type<typeof BlockEntityTypeSchema>

// NBTデータ型（型安全なNBTタグ）
export const NBTTagSchema = Schema.Union(
  Schema.Struct({ type: Schema.Literal('byte'), value: Schema.Number.pipe(Schema.int(), Schema.between(-128, 127)) }),
  Schema.Struct({
    type: Schema.Literal('short'),
    value: Schema.Number.pipe(Schema.int(), Schema.between(-32768, 32767)),
  }),
  Schema.Struct({ type: Schema.Literal('int'), value: Schema.Number.pipe(Schema.int()) }),
  Schema.Struct({ type: Schema.Literal('long'), value: Schema.BigInt }),
  Schema.Struct({ type: Schema.Literal('float'), value: Schema.Number }),
  Schema.Struct({ type: Schema.Literal('double'), value: Schema.Number }),
  Schema.Struct({ type: Schema.Literal('string'), value: Schema.String }),
  Schema.Struct({ type: Schema.Literal('byteArray'), value: Schema.instanceOf(Uint8Array) }),
  Schema.Struct({ type: Schema.Literal('intArray'), value: Schema.instanceOf(Int32Array) }),
  Schema.Struct({ type: Schema.Literal('longArray'), value: Schema.instanceOf(BigInt64Array) })
)
export type NBTTag = Schema.Schema.Type<typeof NBTTagSchema>

// NBTコンパウンドデータ
export const NBTCompoundSchema: Schema.Schema<Record<string, NBTTag>, Record<string, NBTTag>> = Schema.Record({
  key: Schema.String,
  value: Schema.suspend(() => NBTTagSchema),
})
export type NBTCompound = Schema.Schema.Type<typeof NBTCompoundSchema>

// ブロックエンティティ固有データのユニオン型
export const BlockEntityDataSchema = Schema.Union(
  // チェスト
  Schema.Struct({
    type: Schema.Literal('chest'),
    items: Schema.Array(
      Schema.Struct({
        slot: Schema.Number.pipe(Schema.int(), Schema.between(0, 26)),
        id: Schema.String,
        count: Schema.Number.pipe(Schema.int(), Schema.between(1, 64)),
        tag: Schema.optional(NBTCompoundSchema),
      })
    ),
    customName: Schema.optional(Schema.String),
  }),

  // かまど
  Schema.Struct({
    type: Schema.Literal('furnace'),
    items: Schema.Array(
      Schema.Struct({
        slot: Schema.Number.pipe(Schema.int(), Schema.between(0, 2)), // input, fuel, output
        id: Schema.String,
        count: Schema.Number.pipe(Schema.int(), Schema.between(1, 64)),
      })
    ),
    burnTime: Schema.Number.pipe(Schema.int(), Schema.nonnegative()),
    cookTime: Schema.Number.pipe(Schema.int(), Schema.nonnegative()),
    cookTimeTotal: Schema.Number.pipe(Schema.int(), Schema.nonnegative()),
  }),

  // 看板
  Schema.Struct({
    type: Schema.Literal('sign'),
    text: Schema.Array(Schema.String).pipe(Schema.itemsCount(4)), // 4 lines
    color: Schema.optional(Schema.String),
    glowing: Schema.optional(Schema.Boolean),
  }),

  // 汎用フォールバック
  Schema.Struct({
    type: BlockEntityTypeSchema,
    rawData: NBTCompoundSchema,
  })
)
export type BlockEntityData = Schema.Schema.Type<typeof BlockEntityDataSchema>

// ブロックエンティティメインスキーマ
export const BlockEntitySchema = Schema.Struct({
  position: BlockEntityPositionSchema,
  type: BlockEntityTypeSchema,
  data: BlockEntityDataSchema,
  id: Schema.String.pipe(Schema.uuid(), Schema.brand('BlockEntityId')),
  keepPacked: Schema.optional(Schema.Boolean),
})
export type BlockEntity = Schema.Schema.Type<typeof BlockEntitySchema>

// ブロックエンティティエラー型
export class BlockEntityError extends Error {
  readonly _tag = 'BlockEntityError'
  constructor(
    readonly message: string,
    readonly details?: unknown
  ) {
    super(message)
  }
}

// ブロックエンティティサービス
export const BlockEntityService = {
  // 新しいブロックエンティティ作成
  create: (
    position: BlockEntityPosition,
    type: BlockEntityType,
    data: Partial<BlockEntityData>
  ): Effect.Effect<BlockEntity, BlockEntityError> =>
    Effect.gen(function* () {
      const id = yield* Effect.sync(() => crypto.randomUUID())

      const defaultData = yield* BlockEntityService.getDefaultData(type)
      const mergedData = { ...defaultData, ...data, type }

      return {
        position,
        type,
        data: mergedData,
        id: id as Schema.Brand<string, 'BlockEntityId'>,
        keepPacked: false,
      }
    }),

  // デフォルトデータ取得
  getDefaultData: (type: BlockEntityType): Effect.Effect<BlockEntityData, BlockEntityError> =>
    Effect.gen(function* () {
      return Match.value(type).pipe(
        Match.when('chest', () => ({
          type: 'chest' as const,
          items: [],
          customName: undefined,
        })),
        Match.when('furnace', () => ({
          type: 'furnace' as const,
          items: [],
          burnTime: 0,
          cookTime: 0,
          cookTimeTotal: 200,
        })),
        Match.when('sign', () => ({
          type: 'sign' as const,
          text: ['', '', '', ''],
          color: undefined,
          glowing: false,
        })),
        Match.orElse((unknownType) => ({
          type: unknownType,
          rawData: {},
        }))
      )
    }),

  // ブロックエンティティの検証
  validate: (blockEntity: unknown): Effect.Effect<BlockEntity, BlockEntityError> =>
    pipe(
      Schema.decodeUnknown(BlockEntitySchema)(blockEntity),
      Effect.mapError((error) => new BlockEntityError('Invalid block entity data', error))
    ),
}
```

## チャンク圧縮

### 圧縮アルゴリズム

```typescript
export const ChunkCompression = {
  // Zlib圧縮
  compress: (chunk: ChunkData): Effect.Effect<Uint8Array, CompressionError> =>
    Effect.gen(function* () {
      const serialized = yield* Effect.try({
        try: () => serializeChunk(chunk),
        catch: (error) => CompressionError({ message: `Serialization failed: ${error}`, operation: 'serialize' }),
      })

      // pako or native compressionを使用
      const compressed = yield* Effect.tryPromise({
        try: () => compressZlib(serialized),
        catch: (error) => CompressionError({ message: `Compression failed: ${error}`, operation: 'compress' }),
      })

      // ヘッダー付加
      const header = new Uint8Array(8)
      const view = new DataView(header.buffer)
      view.setUint32(0, serialized.length) // 元のサイズ
      view.setUint32(4, compressed.length) // 圧縮後サイズ

      return concatenate(header, compressed)
    }),

  // 解凍
  decompress: (data: Uint8Array): Effect.Effect<ChunkData, CompressionError> =>
    Effect.gen(function* () {
      const view = new DataView(data.buffer)
      const originalSize = view.getUint32(0)
      const compressedSize = view.getUint32(4)

      const compressed = data.slice(8, 8 + compressedSize)
      const decompressed = yield* Effect.tryPromise({
        try: () => decompressZlib(compressed),
        catch: (error) => CompressionError({ message: `Decompression failed: ${error}`, operation: 'decompress' }),
      })

      return yield* Effect.try({
        try: () => deserializeChunk(decompressed),
        catch: (error) => CompressionError({ message: `Deserialization failed: ${error}`, operation: 'deserialize' }),
      })
    }),
}
```

## リージョンファイル形式

### リージョン構造

```typescript
export const RegionFileSchema = Schema.Struct({
  // ヘッダー（8KB）
  header: Schema.Struct({
    locations: Schema.Array(
      Schema.Struct({
        offset: Schema.Number, // 4KBセクタ単位
        sectors: Schema.Number, // セクタ数
      })
    ).pipe(
      Schema.itemsCount(1024) // 32x32チャンク
    ),

    timestamps: Schema.Array(
      Schema.Number // Unix timestamp
    ).pipe(Schema.itemsCount(1024)),
  }),

  // チャンクデータ
  chunks: Schema.Map({
    key: Schema.String, // "x,z" format
    value: CompressedChunkSchema,
  }),
})

export const CompressedChunkSchema = Schema.Struct({
  length: Schema.Number,
  compressionType: Schema.Literal('zlib', 'gzip', 'none'),
  data: Schema.Uint8Array,
  checksum: Schema.Number, // CRC32
})
```

### リージョンファイル管理

```typescript
export interface RegionFile {
  private static readonly SECTOR_SIZE = 4096
  private static readonly HEADER_SIZE = 8192
  private file: FileHandle
  private locations: Map<string, { offset: number; sectors: number }>

  loadChunk(x: number, z: number): Effect.Effect<Option.Option<ChunkData>, FileError> {
    return Effect.gen(function* () {
      const key = `${x},${z}`
      const location = this.locations.get(key)

      if (!location || location.offset === 0) {
        return Option.none()
      }

      // セクタ読み込み
      const buffer = Buffer.alloc(location.sectors * RegionFile.SECTOR_SIZE)
      yield* Effect.tryPromise({
        try: () => this.file.read(
          buffer,
          0,
          buffer.length,
          location.offset * RegionFile.SECTOR_SIZE
        ),
        catch: (error) => FileError({ message: `Failed to read chunk data: ${error}`, operation: 'read' })
      })

      // 解凍とデシリアライズ
      const chunkData = yield* ChunkCompression.decompress(buffer)
      return Option.some(chunkData)
    }.bind(this))
  }

  saveChunk(x: number, z: number, chunk: ChunkData): Effect.Effect<void, FileError | CompressionError> {
    return Effect.gen(function* () {
      const compressed = yield* ChunkCompression.compress(chunk)
      const sectors = Math.ceil(compressed.length / RegionFile.SECTOR_SIZE)

      // 空きセクタを探す
      const offset = yield* this.findFreeSectors(sectors)

      // データ書き込み
      yield* Effect.tryPromise({
        try: () => this.file.write(
          compressed,
          0,
          compressed.length,
          offset * RegionFile.SECTOR_SIZE
        ),
        catch: (error) => FileError({ message: `Failed to write chunk data: ${error}`, operation: 'write' })
      })

      // ヘッダー更新
      this.locations.set(`${x},${z}`, { offset, sectors })
      yield* this.updateHeader()
    }.bind(this))
  }
}
```

## メモリ最適化

### チャンクプール

```typescript
export interface ChunkPool {
  readonly pool: ReadonlyArray<ChunkData>
  readonly maxSize: number
}

export const ChunkPool = {
  create: (maxSize: number = 100): ChunkPool => ({
    pool: [],
    maxSize,
  }),

  acquire: (pool: ChunkPool): Effect.Effect<[ChunkData, ChunkPool], never> =>
    Effect.gen(function* () {
      if (pool.pool.length > 0) {
        const chunk = pool.pool[pool.pool.length - 1]
        const newPool = {
          ...pool,
          pool: pool.pool.slice(0, -1),
        }
        const resetChunk = yield* ChunkData.reset(chunk)
        return [resetChunk, newPool]
      }
      const newChunk = yield* ChunkData.create()
      return [newChunk, pool]
    }),

  release: (pool: ChunkPool, chunk: ChunkData): ChunkPool => {
    if (pool.pool.length < pool.maxSize) {
      return {
        ...pool,
        pool: [...pool.pool, chunk],
      }
    }
    return pool
  },

  // メモリ使用量推定
  getMemoryUsage: (pool: ChunkPool): number => {
    const chunkSize =
      16 * 256 * 16 * 2 + // ブロックデータ (Uint16)
      (16 * 256 * 16) / 2 + // ライトデータ (nibble)
      1024 // その他メタデータ

    return pool.pool.length * chunkSize
  },
}
```

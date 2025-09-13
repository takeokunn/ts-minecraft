# チャンクフォーマット仕様

## 概要

Minecraftチャンクの詳細なデータフォーマット仕様です。16x256x16ブロックの効率的な格納と高速アクセスを実現する最適化されたデータ構造を定義します。

## チャンク基本構造

### チャンク定数

```typescript
export const CHUNK_CONSTANTS = {
  WIDTH: 16,           // X軸サイズ
  HEIGHT: 256,         // Y軸サイズ（ワールド高さ）
  DEPTH: 16,           // Z軸サイズ
  SECTION_HEIGHT: 16,  // セクション高さ
  SECTIONS: 16,        // セクション数 (256 / 16)
  TOTAL_BLOCKS: 65536, // 16 * 256 * 16
  SECTION_BLOCKS: 4096 // 16 * 16 * 16
} as const
```

### チャンクスキーマ

```typescript
import { Schema } from "effect"

export const ChunkSchema = Schema.Struct({
  // チャンク座標
  position: Schema.Struct({
    x: Schema.Number,
    z: Schema.Number
  }),

  // バージョン情報
  version: Schema.Struct({
    format: Schema.Number,      // フォーマットバージョン
    gameVersion: Schema.String  // ゲームバージョン
  }),

  // セクションデータ（Y軸で分割）
  sections: Schema.Array(ChunkSectionSchema).pipe(
    Schema.itemsCount(16)
  ),

  // バイオームデータ
  biomes: BiomeDataSchema,

  // ブロックエンティティ
  blockEntities: Schema.Array(BlockEntitySchema),

  // 高さマップ
  heightMaps: HeightMapSchema,

  // ライティング
  lighting: LightingSchema,

  // メタデータ
  metadata: Schema.Struct({
    generatedAt: Schema.Number,
    lastModified: Schema.Number,
    inhabitedTime: Schema.Number,
    status: ChunkStatusSchema
  })
})
```

## チャンクセクション構造

### セクションフォーマット

```typescript
export const ChunkSectionSchema = Schema.Struct({
  y: Schema.Number.pipe(       // セクションY座標 (0-15)
    Schema.clamp(0, 15)
  ),

  // パレット方式のブロックストレージ
  blockStates: PalettedContainerSchema,

  // バイオームパレット
  biomes: Schema.optional(PalettedContainerSchema),

  // ライティングデータ
  skyLight: Schema.optional(NibbleArraySchema),
  blockLight: Schema.optional(NibbleArraySchema),

  // セクションが空かどうか
  empty: Schema.Boolean
})

// パレット化されたコンテナ
export const PalettedContainerSchema = Schema.Struct({
  palette: Schema.Array(Schema.Number), // ブロックIDのパレット
  data: BitStorageSchema,               // インデックスデータ
  bitsPerEntry: Schema.Number.pipe(
    Schema.clamp(4, 14)                 // エントリあたりのビット数
  )
})
```

### ビットストレージ実装

```typescript
export interface BitStorage {
  readonly data: Uint32Array
  readonly bitsPerEntry: number
  readonly mask: number
  readonly entriesPerLong: number
}

export const BitStorage = {
  create: (bitsPerEntry: number, size: number): BitStorage => {
    const mask = (1 << bitsPerEntry) - 1
    const entriesPerLong = Math.floor(32 / bitsPerEntry)
    const longsNeeded = Math.ceil(size / entriesPerLong)
    const data = new Uint32Array(longsNeeded)

    return {
      data,
      bitsPerEntry,
      mask,
      entriesPerLong
    }
  },

  get: (storage: BitStorage, index: number): number => {
    const longIndex = Math.floor(index / storage.entriesPerLong)
    const bitIndex = (index % storage.entriesPerLong) * storage.bitsPerEntry

    return (storage.data[longIndex] >>> bitIndex) & storage.mask
  },

  set: (storage: BitStorage, index: number, value: number): BitStorage => {
    const longIndex = Math.floor(index / storage.entriesPerLong)
    const bitIndex = (index % storage.entriesPerLong) * storage.bitsPerEntry

    const newData = new Uint32Array(storage.data)
    newData[longIndex] =
      (newData[longIndex] & ~(storage.mask << bitIndex)) |
      ((value & storage.mask) << bitIndex)

    return {
      ...storage,
      data: newData
    }
  },

  // 動的リサイズ
  resize: (storage: BitStorage, newBitsPerEntry: number): BitStorage => {
    const size = BitStorage.getSize(storage)
    const newStorage = BitStorage.create(newBitsPerEntry, size)

    let result = newStorage
    for (let i = 0; i < size; i++) {
      const value = BitStorage.get(storage, i)
      result = BitStorage.set(result, i, value)
    }

    return result
  },

  getSize: (storage: BitStorage): number => {
    return storage.entriesPerLong * storage.data.length
  },

  serialize: (storage: BitStorage): Uint8Array => {
    return new Uint8Array(storage.data.buffer)
  }
}
```

## パレットシステム

### 動的パレット管理

```typescript
export interface PalettedContainer {
  readonly palette: ReadonlyArray<number>
  readonly storage: BitStorage
  readonly size: number
}

export const PalettedContainer = {
  create: (size: number = CHUNK_CONSTANTS.SECTION_BLOCKS): PalettedContainer => ({
    palette: [0], // Air block
    storage: BitStorage.create(4, size), // 初期4ビット
    size
  }),

  set: (container: PalettedContainer, index: number, blockState: number): PalettedContainer => {
    let paletteIndex = container.palette.indexOf(blockState)

    if (paletteIndex === -1) {
      // パレットに追加
      paletteIndex = container.palette.length
      const newPalette = [...container.palette, blockState]

      // パレットサイズチェック
      if (newPalette.length > (1 << container.storage.bitsPerEntry)) {
        return PalettedContainer.resize({
          ...container,
          palette: newPalette
        })
      }

      const newStorage = BitStorage.set(container.storage, index, paletteIndex)
      return {
        ...container,
        palette: newPalette,
        storage: newStorage
      }
    }

    const newStorage = BitStorage.set(container.storage, index, paletteIndex)
    return {
      ...container,
      storage: newStorage
    }
  },

  get: (container: PalettedContainer, index: number): number => {
    const paletteIndex = BitStorage.get(container.storage, index)
    return container.palette[paletteIndex] || 0
  },

  resize: (container: PalettedContainer): PalettedContainer => {
    const newBits = Math.min(
      Math.ceil(Math.log2(container.palette.length)),
      14 // 最大14ビット
    )

    if (newBits > 8) {
      // 直接ストレージモードに切り替え
      return PalettedContainer.convertToDirectStorage(container)
    } else {
      const newStorage = BitStorage.resize(container.storage, newBits)
      return {
        ...container,
        storage: newStorage
      }
    }
  },

  convertToDirectStorage: (container: PalettedContainer): PalettedContainer => {
    let newStorage = BitStorage.create(14, container.size)

    for (let i = 0; i < container.size; i++) {
      const blockState = PalettedContainer.get(container, i)
      newStorage = BitStorage.set(newStorage, i, blockState)
    }

    return {
      ...container,
      storage: newStorage,
      palette: [] // 直接モードではパレット不要
    }
  }
}
```

## 高さマップ

### 高さマップタイプ

```typescript
export const HeightMapSchema = Schema.Struct({
  // 固体ブロックの最高点
  MOTION_BLOCKING: CompactLongArraySchema,

  // 固体または流体ブロックの最高点
  MOTION_BLOCKING_NO_LEAVES: CompactLongArraySchema,

  // 光を通さないブロックの最高点
  OCEAN_FLOOR: CompactLongArraySchema,

  // ワールド生成用の高さマップ
  WORLD_SURFACE: CompactLongArraySchema
})

// 圧縮された高さデータ
export const CompactLongArraySchema = Schema.Struct({
  data: Schema.Array(Schema.Number),
  bitsPerValue: Schema.Number
})
```

### 高さマップ実装

```typescript
export type HeightMapType = 'MOTION_BLOCKING' | 'MOTION_BLOCKING_NO_LEAVES' | 'OCEAN_FLOOR' | 'WORLD_SURFACE'

export interface HeightMap {
  readonly data: Uint16Array // 16x16の高さデータ
  readonly type: HeightMapType
}

export const HeightMap = {
  create: (type: HeightMapType): HeightMap => ({
    type,
    data: new Uint16Array(256) // 16 * 16
  }),

  update: (heightMap: HeightMap, x: number, z: number, height: number): HeightMap => {
    const index = x + z * 16
    const newData = new Uint16Array(heightMap.data)
    newData[index] = height
    return {
      ...heightMap,
      data: newData
    }
  },

  get: (heightMap: HeightMap, x: number, z: number): number => {
    const index = x + z * 16
    return heightMap.data[index]
  },

  // 高さマップの再計算
  recalculate: (heightMap: HeightMap, chunk: ChunkData): HeightMap => {
    let result = heightMap

    for (let x = 0; x < 16; x++) {
      for (let z = 0; z < 16; z++) {
        let height = 0

        for (let y = 255; y >= 0; y--) {
          const block = chunk.getBlock(x, y, z)

          if (HeightMap.shouldInclude(heightMap.type, block)) {
            height = y + 1
            break
          }
        }

        result = HeightMap.update(result, x, z, height)
      }
    }

    return result
  },

  shouldInclude: (type: HeightMapType, block: BlockType): boolean => {
    return Match.value(type).pipe(
      Match.when('MOTION_BLOCKING', () => block.isSolid || block.isFluid),
      Match.when('MOTION_BLOCKING_NO_LEAVES', () => (block.isSolid && !block.isLeaves) || block.isFluid),
      Match.when('OCEAN_FLOOR', () => block.isSolid),
      Match.when('WORLD_SURFACE', () => !block.isAir),
      Match.exhaustive
    )
  }
}
```

## ライティングデータ

### ライティング構造

```typescript
export const LightingSchema = Schema.Struct({
  // スカイライト（太陽光）
  skyLight: LightDataSchema,

  // ブロックライト（松明など）
  blockLight: LightDataSchema,

  // ライティング完了フラグ
  isLightCorrect: Schema.Boolean
})

export const LightDataSchema = Schema.Struct({
  // セクションごとのライトデータ
  sections: Schema.Array(
    Schema.nullable(NibbleArraySchema)
  ).pipe(
    Schema.itemsCount(18) // 16セクション + 上下の境界
  )
})

// 4ビット配列（0-15の値を格納）
export const NibbleArraySchema = Schema.transform(
  Schema.Uint8Array,
  Schema.Array(Schema.Number),
  {
    decode: (data) => {
      const result: number[] = []
      for (let i = 0; i < data.length; i++) {
        result.push(data[i] & 0x0F)
        result.push((data[i] >> 4) & 0x0F)
      }
      return result
    },
    encode: (values) => {
      const data = new Uint8Array(Math.ceil(values.length / 2))
      for (let i = 0; i < values.length; i += 2) {
        data[i / 2] = (values[i] & 0x0F) | ((values[i + 1] & 0x0F) << 4)
      }
      return data
    }
  }
)
```

## ブロックエンティティ

```typescript
export const BlockEntitySchema = Schema.Struct({
  // 位置
  position: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number
  }),

  // タイプ
  type: Schema.Literal(
    'chest', 'furnace', 'sign', 'spawner',
    'enchanting_table', 'brewing_stand',
    'beacon', 'hopper', 'dropper', 'dispenser'
  ),

  // NBTデータ
  data: NBTDataSchema,

  // カスタムデータ
  customData: Schema.optional(Schema.Unknown)
})
```

## チャンク圧縮

### 圧縮アルゴリズム

```typescript
export const ChunkCompression = {
  // Zlib圧縮
  compress: async (chunk: ChunkData): Promise<Uint8Array> => {
    const serialized = serializeChunk(chunk)

    // pako or native compressionを使用
    const compressed = await compressZlib(serialized)

    // ヘッダー付加
    const header = new Uint8Array(8)
    const view = new DataView(header.buffer)
    view.setUint32(0, serialized.length) // 元のサイズ
    view.setUint32(4, compressed.length) // 圧縮後サイズ

    return concatenate(header, compressed)
  },

  // 解凍
  decompress: async (data: Uint8Array): Promise<ChunkData> => {
    const view = new DataView(data.buffer)
    const originalSize = view.getUint32(0)
    const compressedSize = view.getUint32(4)

    const compressed = data.slice(8, 8 + compressedSize)
    const decompressed = await decompressZlib(compressed)

    return deserializeChunk(decompressed)
  }
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
        offset: Schema.Number,  // 4KBセクタ単位
        sectors: Schema.Number  // セクタ数
      })
    ).pipe(
      Schema.itemsCount(1024) // 32x32チャンク
    ),

    timestamps: Schema.Array(
      Schema.Number // Unix timestamp
    ).pipe(
      Schema.itemsCount(1024)
    )
  }),

  // チャンクデータ
  chunks: Schema.Map({
    key: Schema.String, // "x,z" format
    value: CompressedChunkSchema
  })
})

export const CompressedChunkSchema = Schema.Struct({
  length: Schema.Number,
  compressionType: Schema.Literal('zlib', 'gzip', 'none'),
  data: Schema.Uint8Array,
  checksum: Schema.Number // CRC32
})
```

### リージョンファイル管理

```typescript
export class RegionFile {
  private static readonly SECTOR_SIZE = 4096
  private static readonly HEADER_SIZE = 8192
  private file: FileHandle
  private locations: Map<string, { offset: number; sectors: number }>

  async loadChunk(x: number, z: number): Promise<ChunkData | null> {
    const key = `${x},${z}`
    const location = this.locations.get(key)

    if (!location || location.offset === 0) {
      return null
    }

    // セクタ読み込み
    const buffer = Buffer.alloc(location.sectors * RegionFile.SECTOR_SIZE)
    await this.file.read(
      buffer,
      0,
      buffer.length,
      location.offset * RegionFile.SECTOR_SIZE
    )

    // 解凍とデシリアライズ
    return ChunkCompression.decompress(buffer)
  }

  async saveChunk(x: number, z: number, chunk: ChunkData): Promise<void> {
    const compressed = await ChunkCompression.compress(chunk)
    const sectors = Math.ceil(compressed.length / RegionFile.SECTOR_SIZE)

    // 空きセクタを探す
    const offset = await this.findFreeSectors(sectors)

    // データ書き込み
    await this.file.write(
      compressed,
      0,
      compressed.length,
      offset * RegionFile.SECTOR_SIZE
    )

    // ヘッダー更新
    this.locations.set(`${x},${z}`, { offset, sectors })
    await this.updateHeader()
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
    maxSize
  }),

  acquire: (pool: ChunkPool): Effect.Effect<[ChunkData, ChunkPool], never> => Effect.gen(function* () {
    if (pool.pool.length > 0) {
      const chunk = pool.pool[pool.pool.length - 1]
      const newPool = {
        ...pool,
        pool: pool.pool.slice(0, -1)
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
        pool: [...pool.pool, chunk]
      }
    }
    return pool
  },

  // メモリ使用量推定
  getMemoryUsage: (pool: ChunkPool): number => {
    const chunkSize =
      16 * 256 * 16 * 2 + // ブロックデータ (Uint16)
      16 * 256 * 16 / 2 + // ライトデータ (nibble)
      1024                 // その他メタデータ

    return pool.pool.length * chunkSize
  }
}
```
# ワールドデータ構造仕様

## 概要

Minecraftワールドの完全なデータ構造定義です。Effect-TSのSchemaを使用した型安全なデータモデルと、効率的なメモリレイアウトを実現します。

## ワールド構造

### World Schema

```typescript
import { Schema } from "effect"

// ワールドメタデータ
export const WorldMetadataSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  seed: Schema.Number,
  createdAt: Schema.Number,
  lastPlayed: Schema.Number,
  playTime: Schema.Number,
  version: Schema.String,
  gameMode: Schema.Literal('survival', 'creative', 'adventure', 'spectator'),
  difficulty: Schema.Literal('peaceful', 'easy', 'normal', 'hard'),
  hardcore: Schema.Boolean,
  allowCheats: Schema.Boolean,
  spawnPosition: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number
  })
})

// ワールド設定
export const WorldSettingsSchema = Schema.Struct({
  renderDistance: Schema.Number.pipe(
    Schema.clamp(2, 32)
  ),
  simulationDistance: Schema.Number.pipe(
    Schema.clamp(2, 32)
  ),
  randomTickSpeed: Schema.Number.pipe(
    Schema.clamp(0, 4096)
  ),
  doMobSpawning: Schema.Boolean,
  doWeatherCycle: Schema.Boolean,
  doDaylightCycle: Schema.Boolean,
  keepInventory: Schema.Boolean,
  mobGriefing: Schema.Boolean,
  fireSpread: Schema.Boolean,
  tntExplodes: Schema.Boolean
})

// 完全なワールドデータ
export const WorldDataSchema = Schema.Struct({
  metadata: WorldMetadataSchema,
  settings: WorldSettingsSchema,
  dimensions: Schema.Array(DimensionSchema),
  players: Schema.Array(PlayerDataSchema),
  time: Schema.Struct({
    worldTime: Schema.Number,
    dayTime: Schema.Number,
    moonPhase: Schema.Number.pipe(
      Schema.clamp(0, 7)
    )
  }),
  weather: Schema.Struct({
    clear: Schema.Boolean,
    rain: Schema.Boolean,
    thunder: Schema.Boolean,
    rainTime: Schema.Number,
    thunderTime: Schema.Number
  })
})
```

### Dimension構造

```typescript
export const DimensionSchema = Schema.Struct({
  id: Schema.Literal('overworld', 'nether', 'end'),
  regions: Schema.Array(RegionReferenceSchema),
  loadedChunks: Schema.Map({
    key: Schema.String, // "x,z" format
    value: ChunkReferenceSchema
  }),
  biomeMap: BiomeMapSchema,
  structureMap: StructureMapSchema,
  lightingData: LightingDataSchema
})

// リージョン参照
export const RegionReferenceSchema = Schema.Struct({
  x: Schema.Number,
  z: Schema.Number,
  fileName: Schema.String,
  lastModified: Schema.Number,
  chunkCount: Schema.Number
})

// チャンク参照
export const ChunkReferenceSchema = Schema.Struct({
  x: Schema.Number,
  z: Schema.Number,
  regionX: Schema.Number,
  regionZ: Schema.Number,
  loaded: Schema.Boolean,
  dirty: Schema.Boolean,
  lastAccess: Schema.Number,
  generationStage: Schema.Literal(
    'empty',
    'terrain',
    'features',
    'light',
    'spawn',
    'complete'
  )
})
```

## バイオームデータ

```typescript
export const BiomeSchema = Schema.Struct({
  id: Schema.String,
  temperature: Schema.Number.pipe(
    Schema.clamp(-2.0, 2.0)
  ),
  humidity: Schema.Number.pipe(
    Schema.clamp(0, 1.0)
  ),
  elevation: Schema.Number.pipe(
    Schema.clamp(-1.0, 1.0)
  ),
  precipitation: Schema.Literal('none', 'rain', 'snow'),
  category: Schema.Literal(
    'ocean', 'plains', 'desert', 'mountains',
    'forest', 'taiga', 'swamp', 'river',
    'nether', 'the_end', 'icy', 'mushroom',
    'beach', 'jungle', 'savanna', 'mesa'
  ),
  grassColor: Schema.Number, // RGB packed
  foliageColor: Schema.Number, // RGB packed
  waterColor: Schema.Number, // RGB packed
  waterFogColor: Schema.Number, // RGB packed
  skyColor: Schema.Number, // RGB packed
  fogColor: Schema.Number // RGB packed
})

// バイオームマップ
export const BiomeMapSchema = Schema.Struct({
  scale: Schema.Number, // バイオームグリッドスケール
  data: Schema.Array(
    Schema.Struct({
      x: Schema.Number,
      z: Schema.Number,
      biomeId: Schema.String
    })
  )
})
```

## 構造物データ

```typescript
export const StructureSchema = Schema.Struct({
  id: Schema.String,
  type: Schema.Literal(
    'village', 'mineshaft', 'stronghold', 'fortress',
    'monument', 'temple', 'mansion', 'outpost',
    'ruins', 'shipwreck', 'buried_treasure', 'dungeon'
  ),
  boundingBox: Schema.Struct({
    minX: Schema.Number,
    minY: Schema.Number,
    minZ: Schema.Number,
    maxX: Schema.Number,
    maxY: Schema.Number,
    maxZ: Schema.Number
  }),
  pieces: Schema.Array(StructurePieceSchema),
  generated: Schema.Boolean,
  references: Schema.Number // 参照カウント
})

export const StructurePieceSchema = Schema.Struct({
  id: Schema.String,
  type: Schema.String,
  position: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number
  }),
  rotation: Schema.Literal(0, 90, 180, 270),
  mirror: Schema.Boolean,
  template: Schema.String // テンプレート名
})

// 構造物マップ
export const StructureMapSchema = Schema.Struct({
  structures: Schema.Map({
    key: Schema.String, // structure ID
    value: StructureSchema
  }),
  startPoints: Schema.Array(
    Schema.Struct({
      chunkX: Schema.Number,
      chunkZ: Schema.Number,
      structureId: Schema.String
    })
  )
})
```

## 照明データ

```typescript
export const LightingDataSchema = Schema.Struct({
  skyLight: Schema.Struct({
    level: Schema.Number.pipe(
      Schema.clamp(0, 15)
    ),
    sources: Schema.Array(
      Schema.Struct({
        position: PositionSchema,
        intensity: Schema.Number
      })
    )
  }),
  blockLight: Schema.Map({
    key: Schema.String, // "x,y,z" format
    value: Schema.Number.pipe(
      Schema.clamp(0, 15)
    )
  }),
  ambientLight: Schema.Number.pipe(
    Schema.clamp(0, 1)
  )
})
```

## プレイヤーデータ

```typescript
export const PlayerDataSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  uuid: Schema.UUID,
  position: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number
  }),
  rotation: Schema.Struct({
    yaw: Schema.Number.pipe(
      Schema.clamp(-180, 180)
    ),
    pitch: Schema.Number.pipe(
      Schema.clamp(-90, 90)
    )
  }),
  velocity: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number
  }),
  health: Schema.Number.pipe(
    Schema.clamp(0, 20)
  ),
  hunger: Schema.Number.pipe(
    Schema.clamp(0, 20)
  ),
  saturation: Schema.Number.pipe(
    Schema.clamp(0, 20)
  ),
  experience: Schema.Struct({
    level: Schema.Number,
    points: Schema.Number,
    total: Schema.Number
  }),
  gameMode: Schema.Literal('survival', 'creative', 'adventure', 'spectator'),
  inventory: InventorySchema,
  effects: Schema.Array(StatusEffectSchema),
  statistics: PlayerStatisticsSchema,
  achievements: Schema.Array(Schema.String),
  lastLogin: Schema.Number,
  playTime: Schema.Number
})
```

### インベントリ構造

```typescript
export const InventorySchema = Schema.Struct({
  main: Schema.Array(
    Schema.nullable(ItemStackSchema)
  ).pipe(
    Schema.itemsCount(36) // メインインベントリ
  ),
  armor: Schema.Array(
    Schema.nullable(ItemStackSchema)
  ).pipe(
    Schema.itemsCount(4) // 防具スロット
  ),
  offhand: Schema.nullable(ItemStackSchema),
  enderChest: Schema.Array(
    Schema.nullable(ItemStackSchema)
  ).pipe(
    Schema.itemsCount(27)
  ),
  selectedSlot: Schema.Number.pipe(
    Schema.clamp(0, 8)
  )
})

export const ItemStackSchema = Schema.Struct({
  id: Schema.String,
  count: Schema.Number.pipe(
    Schema.clamp(1, 64)
  ),
  damage: Schema.Number.pipe(
    Schema.clamp(0, Schema.Number)
  ),
  nbt: Schema.optional(NBTDataSchema),
  enchantments: Schema.Array(EnchantmentSchema),
  customName: Schema.optional(Schema.String),
  lore: Schema.Array(Schema.String)
})
```

## エンティティデータ

```typescript
export const EntityDataSchema = Schema.Struct({
  id: Schema.String,
  type: EntityTypeSchema,
  position: Vec3Schema,
  velocity: Vec3Schema,
  rotation: Schema.Struct({
    yaw: Schema.Number,
    pitch: Schema.Number
  }),
  health: Schema.optional(Schema.Number),
  age: Schema.Number,
  persistent: Schema.Boolean,
  customName: Schema.optional(Schema.String),
  tags: Schema.Array(Schema.String),
  passengers: Schema.Array(Schema.String), // Entity IDs
  nbt: Schema.optional(NBTDataSchema)
})

export const EntityTypeSchema = Schema.Union(
  // Passive Mobs
  Schema.Literal('cow', 'pig', 'sheep', 'chicken', 'horse'),
  // Hostile Mobs
  Schema.Literal('zombie', 'skeleton', 'creeper', 'spider', 'enderman'),
  // Neutral Mobs
  Schema.Literal('wolf', 'iron_golem', 'bee'),
  // Other
  Schema.Literal('item', 'arrow', 'minecart', 'boat', 'tnt')
)
```

## NBTデータ構造

```typescript
export const NBTValueSchema: Schema.Schema<NBTValue> = Schema.Union(
  Schema.Number,
  Schema.String,
  Schema.Boolean,
  Schema.Array(Schema.suspend(() => NBTValueSchema)),
  Schema.Record(
    Schema.String,
    Schema.suspend(() => NBTValueSchema)
  )
)

export const NBTDataSchema = Schema.Struct({
  version: Schema.Number,
  data: Schema.Record(Schema.String, NBTValueSchema)
})
```

## メモリ最適化構造

### Structure of Arrays (SoA) 形式

```typescript
// 従来のArray of Structures (AoS)
interface BlockAoS {
  type: number
  light: number
  metadata: number
}
const blocks: BlockAoS[] = []

// 最適化されたStructure of Arrays (SoA)
export interface BlockSoA {
  types: Uint16Array      // ブロックタイプ
  light: Uint8Array       // 明るさレベル
  metadata: Uint8Array    // メタデータ
  count: number           // ブロック数
}

// TypedArray使用による効率的なメモリレイアウト
export const createBlockStorage = (size: number): BlockSoA => ({
  types: new Uint16Array(size),
  light: new Uint8Array(size),
  metadata: new Uint8Array(size),
  count: 0
})
```

### ビットパッキング

```typescript
// ブロック状態の効率的な格納
export const BlockStateFormat = {
  // 32ビット整数に複数の値をパック
  pack: (type: number, rotation: number, waterlogged: boolean): number => {
    return (type & 0xFFFF) |           // 16 bits: block type
           ((rotation & 0x3) << 16) |   // 2 bits: rotation (0-3)
           ((waterlogged ? 1 : 0) << 18) // 1 bit: waterlogged
  },

  unpack: (packed: number) => ({
    type: packed & 0xFFFF,
    rotation: (packed >> 16) & 0x3,
    waterlogged: ((packed >> 18) & 0x1) === 1
  })
}
```

## データ圧縮

```typescript
// ランレングス圧縮
export const compressChunkData = (blocks: Uint16Array): Uint8Array => {
  const runs: Array<{ value: number; length: number }> = []
  let current = blocks[0]
  let length = 1

  for (let i = 1; i < blocks.length; i++) {
    if (blocks[i] === current && length < 255) {
      length++
    } else {
      runs.push({ value: current, length })
      current = blocks[i]
      length = 1
    }
  }
  runs.push({ value: current, length })

  // バイナリ形式に変換
  const buffer = new ArrayBuffer(runs.length * 3)
  const view = new DataView(buffer)
  runs.forEach((run, i) => {
    view.setUint16(i * 3, run.value)
    view.setUint8(i * 3 + 2, run.length)
  })

  return new Uint8Array(buffer)
}
```

## インデックス構造

```typescript
// 空間インデックス
export const SpatialIndex = {
  // 3D座標を1Dインデックスに変換
  toIndex: (x: number, y: number, z: number, size: number): number => {
    return x + z * size + y * size * size
  },

  // 1Dインデックスを3D座標に変換
  fromIndex: (index: number, size: number) => ({
    x: index % size,
    z: Math.floor(index / size) % size,
    y: Math.floor(index / (size * size))
  }),

  // モートンオーダー（Z-order curve）
  morton3D: (x: number, y: number, z: number): number => {
    const spread = (v: number): number => {
      v = (v | (v << 16)) & 0x030000FF
      v = (v | (v << 8)) & 0x0300F00F
      v = (v | (v << 4)) & 0x030C30C3
      v = (v | (v << 2)) & 0x09249249
      return v
    }
    return spread(x) | (spread(y) << 1) | (spread(z) << 2)
  }
}
```

## Related Documents

**Core System Implementation**:
- [World Management System](../00-core-features/01-world-management-system.md) - ワールドデータの生成と管理
- [Chunk System](../00-core-features/07-chunk-system.md) - チャンクデータ構造と管理
- [Block System](../00-core-features/03-block-system.md) - ブロックデータとメタデータ
- [Entity System](../00-core-features/04-entity-system.md) - エンティティデータ管理

**Data Models**:
- [Chunk Format](./01-chunk-format.md) - チャンク内部データ構造
- [Save File Format](./02-save-file-format.md) - 永続化形式

**Architecture**:
- [Overall Design](../../01-architecture/00-overall-design.md) - データ層アーキテクチャ
- [Effect-TS Patterns](../../01-architecture/06-effect-ts-patterns.md) - Schema定義パターン

## Glossary Terms Used

- **Biome (バイオーム)**: 環境の分類システム ([詳細](../../04-appendix/00-glossary.md#biome))
- **Chunk (チャンク)**: 16x16x256ブロックの管理単位 ([詳細](../../04-appendix/00-glossary.md#chunk))
- **Entity (エンティティ)**: 動的ゲームオブジェクト ([詳細](../../04-appendix/00-glossary.md#entity))
- **Schema (スキーマ)**: 型安全なデータ定義 ([詳細](../../04-appendix/00-glossary.md#schema))
- **Structure of Arrays (SoA)**: メモリ最適化レイアウト ([詳細](../../04-appendix/00-glossary.md#soa))
- **Voxel (ボクセル)**: 3D空間の立方体単位 ([詳細](../../04-appendix/00-glossary.md#voxel))
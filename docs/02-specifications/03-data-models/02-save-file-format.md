# セーブファイル仕様

## 概要

Minecraftワールドの永続化に使用するセーブファイルフォーマットの詳細仕様です。IndexedDBとファイルシステムの両方に対応した効率的な保存形式を定義します。

## ディレクトリ構造

```
saves/
└── [world-name]/
    ├── level.dat           # ワールドメタデータ
    ├── level.dat.backup    # バックアップ
    ├── player/             # プレイヤーデータ
    │   └── [uuid].dat
    ├── region/             # オーバーワールドチャンク
    │   └── r.[x].[z].mca
    ├── DIM-1/              # ネザー
    │   └── region/
    │       └── r.[x].[z].mca
    ├── DIM1/               # エンド
    │   └── region/
    │       └── r.[x].[z].mca
    ├── data/               # その他データ
    │   ├── structures.dat
    │   ├── villages.dat
    │   └── maps/
    └── stats/              # 統計
        └── [uuid].json
```

## レベルデータ（level.dat）

### ファイル構造

```typescript
export const LevelFileSchema = Schema.Struct({
  // ファイルヘッダー
  header: Schema.Struct({
    magic: Schema.Literal(0x4D435346), // "MCSF" in hex
    version: Schema.Number,
    checksum: Schema.Number // CRC32
  }),

  // データセクション
  data: Schema.Struct({
    // バージョン情報
    DataVersion: Schema.Number,
    Version: Schema.Struct({
      Id: Schema.Number,
      Name: Schema.String,
      Snapshot: Schema.Boolean
    }),

    // ワールド基本情報
    LevelName: Schema.String,
    GeneratorName: Schema.String,
    GeneratorVersion: Schema.Number,
    RandomSeed: Schema.BigInt,

    // ゲーム設定
    GameType: Schema.Number, // 0=Survival, 1=Creative, 2=Adventure, 3=Spectator
    Difficulty: Schema.Number, // 0=Peaceful, 1=Easy, 2=Normal, 3=Hard
    DifficultyLocked: Schema.Boolean,
    Hardcore: Schema.Boolean,

    // ワールド状態
    Time: Schema.BigInt,
    DayTime: Schema.BigInt,
    LastPlayed: Schema.BigInt,

    // スポーン設定
    SpawnX: Schema.Number,
    SpawnY: Schema.Number,
    SpawnZ: Schema.Number,
    SpawnAngle: Schema.Number,

    // ワールドボーダー
    BorderSize: Schema.Number,
    BorderCenterX: Schema.Number,
    BorderCenterZ: Schema.Number,
    BorderSafeZone: Schema.Number,
    BorderWarningDistance: Schema.Number,
    BorderWarningTime: Schema.Number,
    BorderDamagePerBlock: Schema.Number,

    // ゲームルール
    GameRules: Schema.Record(Schema.String, Schema.String),

    // データパック
    DataPacks: Schema.Struct({
      Enabled: Schema.Array(Schema.String),
      Disabled: Schema.Array(Schema.String)
    }),

    // カスタムボスバー
    CustomBossEvents: Schema.Record(Schema.String, BossBarSchema)
  })
})
```

### 保存実装

```typescript
export const LevelDataManager = {
  save: (world: WorldData) => Effect.gen(function* () {
    const levelData = createLevelData(world)

    // シリアライズ
    const encoded = yield* Schema.encodeSync(LevelFileSchema)(levelData)

    // 圧縮
    const compressed = yield* compress(encoded)

    // チェックサム計算
    const checksum = calculateCRC32(compressed)

    // ファイル保存
    yield* saveToFile('level.dat', compressed, checksum)

    // バックアップ作成
    yield* createBackup('level.dat', 'level.dat.backup')
  }),

  load: () => Effect.gen(function* () {
    // ファイル読み込み
    const data = yield* loadFromFile('level.dat')

    // チェックサム検証
    const checksum = calculateCRC32(data)
    yield* verifyChecksum(data, checksum)

    // 解凍
    const decompressed = yield* decompress(data)

    // デコード
    const levelData = yield* Schema.decodeUnknownSync(LevelFileSchema)(decompressed)

    return levelData
  })
}
```

## プレイヤーデータ形式

### プレイヤーファイル構造

```typescript
export const PlayerFileSchema = Schema.Struct({
  // プレイヤー識別
  UUID: Schema.UUID,
  Name: Schema.String,

  // 位置と向き
  Pos: Schema.Tuple(
    Schema.Number, // X
    Schema.Number, // Y
    Schema.Number  // Z
  ),
  Rotation: Schema.Tuple(
    Schema.Number, // Yaw
    Schema.Number  // Pitch
  ),
  Motion: Schema.Tuple(
    Schema.Number, // X velocity
    Schema.Number, // Y velocity
    Schema.Number  // Z velocity
  ),

  // ステータス
  Health: Schema.Number,
  HurtTime: Schema.Number,
  DeathTime: Schema.Number,
  FallDistance: Schema.Number,
  Fire: Schema.Number,
  Air: Schema.Number,
  OnGround: Schema.Boolean,

  // 食料と経験値
  FoodLevel: Schema.Number,
  FoodSaturationLevel: Schema.Number,
  FoodExhaustionLevel: Schema.Number,
  XpLevel: Schema.Number,
  XpP: Schema.Number,
  XpTotal: Schema.Number,
  XpSeed: Schema.Number,

  // インベントリ
  Inventory: Schema.Array(InventoryItemSchema),
  EnderItems: Schema.Array(InventoryItemSchema),

  // 装備
  SelectedItemSlot: Schema.Number,

  // ゲームモード
  PlayerGameType: Schema.Number,
  PreviousPlayerGameType: Schema.Number,

  // 能力
  Abilities: Schema.Struct({
    Flying: Schema.Boolean,
    InstantBuild: Schema.Boolean,
    Invulnerable: Schema.Boolean,
    MayBuild: Schema.Boolean,
    MayFly: Schema.Boolean,
    WalkSpeed: Schema.Number,
    FlySpeed: Schema.Number
  }),

  // ステータス効果
  ActiveEffects: Schema.Array(StatusEffectSchema),

  // 統計とスコア
  Stats: Schema.Record(Schema.String, Schema.Number),
  Score: Schema.Number,

  // その他
  SpawnPoint: Schema.optional(Schema.Struct({
    X: Schema.Number,
    Y: Schema.Number,
    Z: Schema.Number,
    Dimension: Schema.String
  })),

  RecipeBook: RecipeBookSchema,
  Attributes: Schema.Array(AttributeSchema)
})
```

### インベントリアイテム形式

```typescript
export const InventoryItemSchema = Schema.Struct({
  Slot: Schema.Number,
  id: Schema.String,
  Count: Schema.Number,
  Damage: Schema.Number,

  tag: Schema.optional(Schema.Struct({
    // エンチャント
    Enchantments: Schema.optional(
      Schema.Array(Schema.Struct({
        id: Schema.String,
        lvl: Schema.Number
      }))
    ),

    // 表示
    display: Schema.optional(Schema.Struct({
      Name: Schema.optional(Schema.String),
      Lore: Schema.optional(Schema.Array(Schema.String)),
      color: Schema.optional(Schema.Number)
    })),

    // 修復
    RepairCost: Schema.optional(Schema.Number),

    // 属性
    AttributeModifiers: Schema.optional(
      Schema.Array(AttributeModifierSchema)
    ),

    // 不破壊
    Unbreakable: Schema.optional(Schema.Boolean),

    // カスタムデータ
    CustomModelData: Schema.optional(Schema.Number),
    CustomData: Schema.optional(Schema.Record(Schema.String, Schema.Unknown))
  }))
})
```

## リージョンファイル形式（.mca）

### MCAnvilフォーマット

```typescript
export const RegionFileFormat = {
  // ファイルヘッダー（8KB）
  HEADER_SIZE: 8192,

  // セクタサイズ
  SECTOR_SIZE: 4096,

  // チャンク数（32x32）
  CHUNKS_PER_REGION: 1024,

  // ファイル構造
  structure: {
    // Location Table (4KB)
    locations: new Uint32Array(1024),

    // Timestamp Table (4KB)
    timestamps: new Uint32Array(1024),

    // Chunk Data (variable)
    chunks: new Map<string, CompressedChunk>()
  }
}

export interface MCAnvilFile {
  readonly buffer: ArrayBuffer
  readonly view: DataView
}

export const MCAnvilFile = {
  create: (buffer: ArrayBuffer): MCAnvilFile => ({
    buffer,
    view: new DataView(buffer)
  }),

  // チャンク位置取得
  getChunkLocation: (file: MCAnvilFile, x: number, z: number): { offset: number; sectors: number } => {
    const index = (x & 31) + (z & 31) * 32
    const location = file.view.getUint32(index * 4)

    return {
      offset: (location >> 8) * RegionFileFormat.SECTOR_SIZE,
      sectors: location & 0xFF
    }
  },

  // チャンク読み込み
  readChunk: (file: MCAnvilFile, x: number, z: number): Effect.Effect<Uint8Array | null, CompressionError> => Effect.gen(function* () {
    const location = MCAnvilFile.getChunkLocation(file, x, z)

    if (location.offset === 0) {
      return null
    }

    // チャンクヘッダー読み込み
    const length = file.view.getUint32(location.offset)
    const compression = file.view.getUint8(location.offset + 4)

    // チャンクデータ読み込み
    const data = new Uint8Array(
      file.buffer,
      location.offset + 5,
      length - 1
    )

    return yield* MCAnvilFile.decompress(data, compression)
  }),

  // チャンク書き込み
  writeChunk: (file: MCAnvilFile, x: number, z: number, data: Uint8Array): Effect.Effect<MCAnvilFile, CompressionError> => Effect.gen(function* () {
    const compressed = yield* MCAnvilFile.compress(data)
    const sectors = Math.ceil((compressed.length + 5) / RegionFileFormat.SECTOR_SIZE)

    // 空きセクタ検索
    const offset = yield* MCAnvilFile.findFreeSectors(file, sectors)

    // 新しいバッファを作成（immutable update）
    const newBuffer = file.buffer.slice()
    const newView = new DataView(newBuffer)

    // ヘッダー書き込み
    newView.setUint32(offset, compressed.length + 1)
    newView.setUint8(offset + 4, 2) // Zlib compression

    // データ書き込み
    new Uint8Array(newBuffer, offset + 5).set(compressed)

    // Location Table更新
    const index = (x & 31) + (z & 31) * 32
    const location = ((offset / RegionFileFormat.SECTOR_SIZE) << 8) | sectors
    newView.setUint32(index * 4, location)

    // Timestamp更新
    newView.setUint32(RegionFileFormat.HEADER_SIZE / 2 + index * 4, Date.now() / 1000)

    return {
      buffer: newBuffer,
      view: newView
    }
  }),

  compress: (data: Uint8Array): Effect.Effect<Uint8Array, CompressionError> => {
    // 圧縮実装
    return Effect.succeed(data) // プレースホルダー
  },

  decompress: (data: Uint8Array, compression: number): Effect.Effect<Uint8Array, CompressionError> => {
    // 解凍実装
    return Effect.succeed(data) // プレースホルダー
  },

  findFreeSectors: (file: MCAnvilFile, sectors: number): Effect.Effect<number, FileError> => {
    // 空きセクタ検索実装
    return Effect.succeed(RegionFileFormat.HEADER_SIZE) // プレースホルダー
  }
}
```

## IndexedDB保存形式

### データベース構造

```typescript
export const IndexedDBSchema = {
  name: 'MinecraftWorlds',
  version: 1,

  stores: {
    // ワールドメタデータ
    worlds: {
      keyPath: 'id',
      indexes: {
        name: { unique: false },
        lastPlayed: { unique: false }
      }
    },

    // チャンクデータ
    chunks: {
      keyPath: ['worldId', 'dimension', 'x', 'z'],
      indexes: {
        worldId: { unique: false },
        lastAccess: { unique: false }
      }
    },

    // プレイヤーデータ
    players: {
      keyPath: ['worldId', 'uuid'],
      indexes: {
        worldId: { unique: false },
        name: { unique: false }
      }
    },

    // 構造物データ
    structures: {
      keyPath: ['worldId', 'id'],
      indexes: {
        worldId: { unique: false },
        type: { unique: false }
      }
    }
  }
}

export const IndexedDBManager = {
  // データベース初期化
  initialize: () => Effect.gen(function* () {
    const db = yield* openDatabase(IndexedDBSchema)

    // ストア作成
    for (const [storeName, config] of Object.entries(IndexedDBSchema.stores)) {
      const store = db.createObjectStore(storeName, {
        keyPath: config.keyPath
      })

      // インデックス作成
      for (const [indexName, indexConfig] of Object.entries(config.indexes)) {
        store.createIndex(indexName, indexName, indexConfig)
      }
    }

    return db
  }),

  // チャンク保存（バッチ最適化）
  saveChunks: (worldId: string, chunks: ChunkData[]) => Effect.gen(function* () {
    const db = yield* getDatabase()
    const transaction = db.transaction(['chunks'], 'readwrite')
    const store = transaction.objectStore('chunks')

    // バッチ保存
    yield* Effect.all(
      chunks.map(chunk =>
        Effect.promise(() =>
          store.put({
            worldId,
            dimension: chunk.dimension,
            x: chunk.position.x,
            z: chunk.position.z,
            data: yield* compressChunk(chunk),
            lastAccess: Date.now()
          })
        )
      ),
      { concurrency: 10 }
    )

    yield* Effect.promise(() => transaction.complete)
  })
}
```

## 圧縮とエンコーディング

### 圧縮戦略

```typescript
export const CompressionStrategies = {
  // Zlib圧縮（標準）
  zlib: {
    compress: (data: Uint8Array) => Effect.gen(function* () {
      const pako = yield* importPako()
      return pako.deflate(data, { level: 6 })
    }),

    decompress: (data: Uint8Array) => Effect.gen(function* () {
      const pako = yield* importPako()
      return pako.inflate(data)
    })
  },

  // LZ4圧縮（高速）
  lz4: {
    compress: (data: Uint8Array) => Effect.gen(function* () {
      const lz4 = yield* importLZ4()
      return lz4.compress(data)
    }),

    decompress: (data: Uint8Array) => Effect.gen(function* () {
      const lz4 = yield* importLZ4()
      return lz4.decompress(data)
    })
  },

  // Brotli圧縮（高圧縮率）
  brotli: {
    compress: (data: Uint8Array) => Effect.gen(function* () {
      return new Uint8Array(
        await new Response(
          new Blob([data]).stream().pipeThrough(
            new CompressionStream('br')
          )
        ).arrayBuffer()
      )
    }),

    decompress: (data: Uint8Array) => Effect.gen(function* () {
      return new Uint8Array(
        await new Response(
          new Blob([data]).stream().pipeThrough(
            new DecompressionStream('br')
          )
        ).arrayBuffer()
      )
    })
  }
}
```

## バックアップとリカバリ

### 自動バックアップ

```typescript
export const BackupManager = {
  // 定期バックアップ
  scheduleBackup: (worldId: string) =>
    Stream.periodic(Duration.minutes(5)).pipe(
      Stream.mapEffect(() =>
        createBackup(worldId)
      ),
      Stream.retry(
        Schedule.exponential(Duration.seconds(10))
      )
    ),

  // バックアップ作成
  createBackup: (worldId: string) => Effect.gen(function* () {
    const timestamp = Date.now()
    const backupId = `${worldId}_${timestamp}`

    // メタデータコピー
    const metadata = yield* loadWorldMetadata(worldId)
    yield* saveBackupMetadata(backupId, metadata)

    // チャンクデータコピー（差分のみ）
    const modifiedChunks = yield* getModifiedChunks(worldId)
    yield* Effect.all(
      modifiedChunks.map(chunk =>
        copyChunkToBackup(worldId, backupId, chunk)
      ),
      { concurrency: 4 }
    )

    // 古いバックアップ削除
    yield* pruneOldBackups(worldId, 10) // 最新10個保持

    return backupId
  }),

  // リストア
  restore: (backupId: string) => Effect.gen(function* () {
    // バックアップ検証
    yield* verifyBackup(backupId)

    // 現在のワールドをバックアップ
    const currentBackup = yield* createBackup('current')

    try {
      // バックアップからリストア
      yield* restoreMetadata(backupId)
      yield* restoreChunks(backupId)
      yield* restorePlayers(backupId)

    } catch (error) {
      // エラー時は元に戻す
      yield* restore(currentBackup)
      throw error
    }
  })
}
```

## マイグレーション

### バージョンマイグレーション

```typescript
export const MigrationManager = {
  migrations: new Map([
    [1, migration_v1_to_v2],
    [2, migration_v2_to_v3],
    // ...
  ]),

  migrate: (data: any, fromVersion: number, toVersion: number) =>
    Effect.gen(function* () {
      let current = data
      let version = fromVersion

      while (version < toVersion) {
        const migration = MigrationManager.migrations.get(version)

        if (!migration) {
          yield* Effect.fail(new MigrationError(`No migration from v${version}`))
        }

        current = yield* migration(current)
        version++
      }

      return current
    })
}
```
---
title: "02 Save File Format"
description: "02 Save File Formatに関する詳細な説明とガイド。"
category: "specification"
difficulty: "intermediate"
tags: ["typescript", "minecraft", "specification"]
prerequisites: ["basic-typescript"]
estimated_reading_time: "15分"
---


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

// V1からV2へのマイグレーション例
const migration_v1_to_v2 = (data: any) => Effect.gen(function* () {
  // 新しいフィールド追加
  return {
    ...data,
    version: 2,
    newField: 'default_value',
    // 古いフィールドの変換
    renamedField: data.oldField,
  }
})

// V2からV3へのマイグレーション例
const migration_v2_to_v3 = (data: any) => Effect.gen(function* () {
  // データ構造の変更
  return {
    ...data,
    version: 3,
    // 配列から Map に変換
    itemsMap: new Map(data.itemsArray.map((item: any) => [item.id, item]))
  }
})
```

## パフォーマンス最適化

### 遅延読み込み

```typescript
export const LazyChunkLoader = {
  // チャンク需要予測
  predictChunkNeed: (playerPos: Vector3, viewDistance: number) => Effect.gen(function* () {
    const center = ChunkPos.fromWorldPos(playerPos)
    const needed = new Set<string>()

    // 現在位置周辺
    for (let x = -viewDistance; x <= viewDistance; x++) {
      for (let z = -viewDistance; z <= viewDistance; z++) {
        const distance = Math.sqrt(x * x + z * z)
        if (distance <= viewDistance) {
          needed.add(`${center.x + x},${center.z + z}`)
        }
      }
    }

    return needed
  }),

  // プリロード
  preloadChunks: (worldId: string, chunkKeys: Set<string>) => Effect.gen(function* () {
    const loadTasks = Array.from(chunkKeys).map(key => {
      const [x, z] = key.split(',').map(Number)
      return loadChunkAsync(worldId, x, z)
    })

    // 並列ロード（制限付き）
    yield* Effect.all(loadTasks, { concurrency: 4 })
  }),

  // キャッシュ管理
  manageCache: (maxCachedChunks: number = 64) => Effect.gen(function* () {
    const cache = yield* ChunkCache.get()

    if (cache.size <= maxCachedChunks) {
      return
    }

    // LRU方式で古いチャンクを削除
    const sortedByAccess = Array.from(cache.entries())
      .sort(([, a], [, b]) => a.lastAccess - b.lastAccess)

    const toRemove = sortedByAccess.slice(0, cache.size - maxCachedChunks)

    for (const [key] of toRemove) {
      yield* ChunkCache.remove(key)
    }
  })
}
```

### ストリーミングアーキテクチャ

```typescript
export const StreamingWorldLoader = {
  // チャンクストリーム
  chunkStream: (worldId: string, center: ChunkPos, radius: number) =>
    Stream.fromIterable(generateChunkPositions(center, radius)).pipe(
      Stream.mapEffect(pos =>
        loadChunk(worldId, pos.x, pos.z).pipe(
          Effect.retry(Schedule.exponential(Duration.millis(100))),
          Effect.timeout(Duration.seconds(5))
        )
      ),
      Stream.buffer(8), // バッファリング
      Stream.mapEffect(chunk =>
        processChunk(chunk) // 後処理
      )
    ),

  // プライオリティキュー
  priorityLoader: (requests: ChunkLoadRequest[]) => Effect.gen(function* () {
    // プライオリティソート
    const sorted = requests.sort((a, b) => {
      const distanceA = Math.sqrt(
        (a.x - a.playerX) ** 2 + (a.z - a.playerZ) ** 2
      )
      const distanceB = Math.sqrt(
        (b.x - b.playerX) ** 2 + (b.z - b.playerZ) ** 2
      )

      return distanceA - distanceB
    })

    // 高優先度から順次処理
    for (const request of sorted.slice(0, 4)) {
      yield* loadChunk(request.worldId, request.x, request.z).pipe(
        Effect.fork // 並行実行
      )
    }
  })
}
```

## セキュリティ考慮事項

### データ検証

```typescript
export const SecurityValidator = {
  // ファイル完整性チェック
  validateFileIntegrity: (file: Uint8Array, expectedHash: string) => Effect.gen(function* () {
    const hash = yield* calculateSHA256(file)

    if (hash !== expectedHash) {
      yield* Effect.fail(new SecurityError('File integrity check failed'))
    }
  }),

  // セーブデータサニタイズ
  sanitizeSaveData: (data: any) => Effect.gen(function* () {
    // 危険なスクリプト削除
    const sanitized = deep(cleanObject(data, [
      '__proto__',
      'constructor',
      'prototype'
    ]))

    // サイズ制限チェック
    const serialized = JSON.stringify(sanitized)
    if (serialized.length > MAX_SAVE_SIZE) {
      yield* Effect.fail(new SecurityError('Save data too large'))
    }

    return sanitized
  }),

  // アクセス権限チェック
  checkWorldAccess: (worldId: string, userId: string) => Effect.gen(function* () {
    const world = yield* loadWorldMetadata(worldId)

    if (world.owner !== userId && !world.allowedUsers.includes(userId)) {
      yield* Effect.fail(new SecurityError('Access denied'))
    }
  })
}
```

### 暗号化（オプション）

```typescript
export const EncryptionManager = {
  // AES-256-GCM暗号化
  encrypt: (data: Uint8Array, password: string) => Effect.gen(function* () {
    const key = yield* deriveKey(password)
    const iv = crypto.getRandomValues(new Uint8Array(12))

    const encrypted = yield* Effect.promise(() =>
      crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        data
      )
    )

    // IV + 暗号化データ
    return concatenate(iv, new Uint8Array(encrypted))
  }),

  // 復号化
  decrypt: (encryptedData: Uint8Array, password: string) => Effect.gen(function* () {
    const key = yield* deriveKey(password)
    const iv = encryptedData.slice(0, 12)
    const data = encryptedData.slice(12)

    const decrypted = yield* Effect.promise(() =>
      crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        data
      )
    )

    return new Uint8Array(decrypted)
  }),

  // PBKDF2キー導出
  deriveKey: (password: string, salt?: Uint8Array) => Effect.gen(function* () {
    const encoder = new TextEncoder()
    const keyMaterial = yield* Effect.promise(() =>
      crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
      )
    )

    const derivedKey = yield* Effect.promise(() =>
      crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: salt || encoder.encode('minecraft_salt'),
          iterations: 100000,
          hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      )
    )

    return derivedKey
  })
}
```

## トラブルシューティング

### 一般的な問題と解決策

```typescript
export const TroubleshootingGuide = {
  // 破損ファイル修復
  repairCorruptedSave: (worldId: string) => Effect.gen(function* () {
    console.log('セーブファイル修復を開始...')

    // バックアップから復旧を試行
    const backups = yield* listBackups(worldId)

    if (backups.length > 0) {
      console.log('バックアップから復旧を試行...')
      yield* BackupManager.restore(backups[0].id)
      return
    }

    // 部分修復を試行
    console.log('部分修復を試行...')
    yield* attemptPartialRepair(worldId)
  }),

  // メモリ使用量最適化
  optimizeMemoryUsage: () => Effect.gen(function* () {
    // 未使用チャンクを解放
    yield* ChunkCache.clearUnused()

    // ガベージコレクション促進
    if (typeof window !== 'undefined' && window.gc) {
      window.gc()
    }

    // メモリ使用量ログ出力
    if (performance.memory) {
      console.log({
        used: performance.memory.usedJSHeapSize,
        total: performance.memory.totalJSHeapSize,
        limit: performance.memory.jsHeapSizeLimit
      })
    }
  }),

  // 診断情報収集
  collectDiagnostics: (worldId: string) => Effect.gen(function* () {
    const info = {
      world: {
        id: worldId,
        metadata: yield* loadWorldMetadata(worldId),
        chunkCount: yield* countChunks(worldId),
        totalSize: yield* calculateWorldSize(worldId)
      },
      system: {
        browser: navigator.userAgent,
        memory: performance.memory || null,
        storage: yield* getStorageQuota(),
        webgl: yield* getWebGLInfo()
      },
      performance: {
        loadTimes: yield* getAverageLoadTimes(),
        saveTimes: yield* getAverageSaveTimes(),
        memoryUsage: yield* getCurrentMemoryUsage()
      }
    }

    return info
  })
}
```

`★ Insight ─────────────────────────────────────`
この保存ファイル形式仕様では、Minecraftワールドの効率的な永続化を実現するため、3つの重要な設計パターンを採用している：1) **パレット化圧縮**により重複データを大幅に削減、2) **リージョンファイル**で地理的に近いチャンクをまとめて管理、3) **Effect-TSによる型安全な非同期処理**でファイルI/Oエラーを確実にハンドリング。特に注目すべきは、IndexedDBとファイルシステムの両方に対応した統一インターフェースにより、WebとDesktopの両環境で一貫したデータ管理を実現していることだ。
`─────────────────────────────────────────────────`

## 関連ドキュメント

- [チャンクフォーマット](./chunk-format.md) - チャンクの詳細バイナリ形式
- [ワールドデータ構造](./world-data-structure.md) - メモリ内データ構造
- [パフォーマンスガイドライン](../../explanations/architecture/performance-guidelines.md) - パフォーマンス最適化指針
- [セキュリティ仕様](../../explanations/architecture/security-specification.md) - セキュリティ要件
# ワールドシステム

TypeScript Minecraftのワールドシステムは、チャンクベースの無限ワールド生成とリアルタイム管理を提供する。Effect-TSの関数型プログラミングパラダイムに基づき、純粋関数と不変データ構造を使用して実装されている。

## アーキテクチャ概要

```
ワールドシステム構成:
┌─────────────────────────────────────────┐
│ アプリケーション層                        │
│ - WorldGenerateUseCase                   │
│ - ChunkLoadUseCase                      │
│ - WorldUpdateWorkflow                   │
└─────────────────────────────────────────┘
           │
┌─────────────────────────────────────────┐
│ ドメイン層                               │
│ - ChunkLoadingService                   │
│ - TerrainGenerationService              │  
│ - WorldManagementDomainService          │
│ - ChunkBusinessLogic                    │
└─────────────────────────────────────────┘
           │
┌─────────────────────────────────────────┐
│ インフラストラクチャ層                      │
│ - TerrainGeneratorAdapter               │
│ - ChunkRepository                       │
│ - ChunkCache                           │
└─────────────────────────────────────────┘
```

## チャンク管理システム

### チャンク構造

```typescript
// チャンクの基本構造 
interface Chunk {
  readonly coordinate: ChunkCoordinate
  readonly blocks: ReadonlyArray<Block>
  readonly biome: ChunkBiome
  readonly generated: boolean
  readonly modified: boolean
  readonly lastUpdate: number
}

// チャンクサイズ定数
const CHUNK_SIZE = 16      // 16x16 ブロック
const CHUNK_HEIGHT = 256   // 256ブロックの高さ
```

### チャンクビジネスロジック

`ChunkBusinessLogic`は、チャンクの状態管理と検証を担当する：

```typescript
const ChunkBusinessLogic = {
  // チャンクの準備状態チェック
  isReady: (chunk: Chunk): boolean => chunk.generated,
  
  // 変更状態チェック
  hasChanges: (chunk: Chunk): boolean => chunk.modified,
  
  // 再生成が必要かチェック（最大3600秒後）
  needsRegeneration: (chunk: Chunk, maxAge: number = 3600000): boolean => {
    const age = Date.now() - chunk.lastUpdate
    return age > maxAge || (!chunk.generated && chunk.blocks.length === 0)
  },

  // ワールド座標からチャンク内座標に変換
  worldToChunkBlockPosition: (worldX: number, worldY: number, worldZ: number) => ({
    x: worldX - Math.floor(worldX / CHUNK_SIZE) * CHUNK_SIZE,
    y: worldY,
    z: worldZ - Math.floor(worldZ / CHUNK_SIZE) * CHUNK_SIZE,
  }),

  // チャンクのワールド境界取得
  getWorldBounds: (chunk: Chunk) => {
    const startX = chunk.coordinate.x * CHUNK_SIZE
    const startZ = chunk.coordinate.z * CHUNK_SIZE
    return {
      minX: startX, maxX: startX + CHUNK_SIZE - 1,
      minY: 0, maxY: CHUNK_HEIGHT - 1,
      minZ: startZ, maxZ: startZ + CHUNK_SIZE - 1,
    }
  }
}
```

## チャンクローディング戦略

### 非同期ローディングシステム

`ChunkLoadingService`は、優先度ベースのローディングキューを実装している：

```typescript
interface ChunkLoadingService {
  readonly requestChunkLoad: (request: ChunkLoadRequest) => Effect.Effect<void>
  readonly getChunkData: (coordinates: ChunkCoordinates) => Effect.Effect<ChunkData, ChunkNotLoadedError>
  readonly isChunkLoaded: (coordinates: ChunkCoordinates) => Effect.Effect<boolean>
  readonly preloadArea: (center: ChunkCoordinates, radius: number, entityId: EntityId) => Effect.Effect<number>
  readonly waitForChunkLoad: (coordinates: ChunkCoordinates, timeout?: Duration) => Effect.Effect<ChunkData, ChunkNotLoadedError>
}
```

### ローディング優先度

```typescript
type ChunkPriority = 'high' | 'normal' | 'low'

interface ChunkLoadRequest {
  coordinates: ChunkCoordinates
  priority: ChunkPriority
  requesterEntityId: EntityId
  options?: {
    generateMesh?: boolean
    preloadNeighbors?: boolean
  }
}
```

### ローディングフロー

1. **リクエスト受信**: プライオリティキューにリクエスト登録
2. **キャッシュ確認**: メモリキャッシュから即座に返却可能か確認
3. **永続化確認**: リポジトリから既存データ読み込み
4. **地形生成**: 新規チャンクの場合、地形生成実行
5. **メッシュ生成**: 必要に応じてレンダリング用メッシュ生成
6. **キャッシュ保存**: メモリとストレージに保存

### パフォーマンス最適化

```typescript
// 統計情報の追跡
interface ChunkLoadingStats {
  totalRequests: number
  completedLoads: number
  failedLoads: number
  averageLoadTime: number
  currentlyLoading: number
  queueSize: number
  cacheHitRate: number
  memoryUsage: number
}
```

## 地形生成アルゴリズム

### Perlinノイズベース生成

地形生成は`TerrainGenerationDomainService`で実装される：

```typescript
interface TerrainGenerationRequest {
  coordinates: ChunkCoordinates
  seed: number
  biome: BiomeConfiguration
  noise: NoiseSettings
  features: FeatureSettings
}

interface NoiseSettings {
  scale: number
  octaves: number
  heightMultiplier: number
  persistence: number
  lacunarity: number
}
```

### バイオーム別パラメータ

```typescript
const getBiomeParameters = (biome: ChunkBiome) => {
  const biomeData = {
    plains: { temperature: 0.8, humidity: 0.4, elevation: 64 },
    desert: { temperature: 2.0, humidity: 0.0, elevation: 64 },
    forest: { temperature: 0.7, humidity: 0.8, elevation: 64 },
    mountains: { temperature: 0.2, humidity: 0.3, elevation: 128 },
    ocean: { temperature: 0.5, humidity: 0.9, elevation: 32 }
  }
  return biomeData[biome]
}
```

### 地形生成プロセス

1. **ノイズマップ生成**: Perlinノイズで高度マップ作成
2. **バイオーム決定**: 温度と湿度による分類
3. **ブロック配置**: 高度とバイオームに応じたブロック種別決定
4. **特徴生成**: 洞窟、鉱石、構造物の配置

```typescript
const generateHeightMapLogic = (
  chunkX: number,
  chunkZ: number,
  seed: number,
  noise: NoiseSettings
): readonly number[] => {
  const heightMap: number[] = []
  
  for (let x = 0; x < CHUNK_SIZE; x++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      const worldX = chunkX * CHUNK_SIZE + x
      const worldZ = chunkZ * CHUNK_SIZE + z
      
      // マルチオクターブPerlinノイズ
      let height = 0
      let amplitude = 1
      let frequency = noise.scale
      
      for (let octave = 0; octave < noise.octaves; octave++) {
        height += simpleNoise(worldX * frequency, worldZ * frequency, seed) * amplitude
        amplitude *= noise.persistence
        frequency *= noise.lacunarity
      }
      
      // 基準高度 + ノイズ値 * 高度倍率
      const finalHeight = Math.floor(64 + height * noise.heightMultiplier)
      heightMap.push(Math.max(1, Math.min(CHUNK_HEIGHT - 1, finalHeight)))
    }
  }
  
  return heightMap
}
```

## セーブ・ロード機能

### チャンクリポジトリ

```typescript
interface ChunkRepositoryPort {
  readonly loadChunk: (coordinates: ChunkCoordinates) => Effect.Effect<Option.Option<ChunkData>>
  readonly saveChunk: (chunkData: ChunkData) => Effect.Effect<void>
  readonly deleteChunk: (coordinates: ChunkCoordinates) => Effect.Effect<void>
  readonly listChunks: () => Effect.Effect<ReadonlyArray<ChunkCoordinates>>
}
```

### データ永続化

- **メモリキャッシュ**: 高速アクセス用のLRUキャッシュ
- **ローカルストレージ**: ブラウザIndexedDBへの永続化
- **バックアップ**: 定期的な自動保存

### 保存戦略

1. **即座保存**: 重要な変更（プレイヤー構造物）
2. **バッチ保存**: 定期的な一括保存
3. **遅延保存**: アイドル時間での最適化保存

## ワールド更新サイクル

### 更新システム

```typescript
const WorldUpdateWorkflow = {
  // メインループ
  update: Effect.gen(function* () {
    const worldService = yield* WorldManagementDomainService
    
    // アクティブチャンク更新
    yield* worldService.updateActiveChunks()
    
    // プレイヤー周辺のチャンクローディング
    yield* worldService.loadNearbyChunks()
    
    // 不要チャンクのアンロード  
    yield* worldService.unloadDistantChunks()
    
    // パフォーマンス統計更新
    yield* worldService.updateStats()
  })
}
```

### 更新タイミング

- **フレーム毎**: プレイヤー位置に基づくチャンクローディング判定
- **秒毎**: 非アクティブチャンクのアンロード
- **分毎**: 統計情報とキャッシュ最適化

## エラーハンドリング

### 例外型定義

```typescript
class ChunkNotLoadedError extends Data.TaggedError('ChunkNotLoadedError')<{
  chunkX: number
  chunkZ: number
  message: string
}> {}

class ChunkGenerationError extends Data.TaggedError('ChunkGenerationError')<{
  chunkX: number
  chunkZ: number
  reason: string
}> {}
```

### 回復戦略

1. **再試行**: 一時的な失敗の場合の自動リトライ
2. **フォールバック**: 空チャンクでの代替
3. **通知**: 致命的エラーのユーザー通知

## パフォーマンス特性

### 最適化ポイント

- **空間分割**: チャンク単位でのメモリ管理
- **遅延ローディング**: 必要時のみデータ読み込み
- **キャッシュ戦略**: LRUによる効率的なメモリ使用
- **並列処理**: Web Workersでの地形生成

### メモリ使用量

- チャンク当たり約1MB（16x16x256ブロック）
- LRUキャッシュで最大100チャンクまで保持
- アクティブ領域外の自動アンロード

このワールドシステムは、関数型プログラミングの原則に従って設計され、高いパフォーマンスとスケーラビリティを提供している。Effect-TSの型安全性とエラーハンドリング機能により、堅牢で保守性の高い実装となっている。
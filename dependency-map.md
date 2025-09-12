# TypeScript Minecraft - Infrastructure層 依存関係マップ

## 概要
Infrastructure層の各ファイルとその依存関係を分析した結果です。Effect-TSのLayerパターンに基づいたDDDアーキテクチャの実装状況を示しています。

---

## 🏗️ アーキテクチャ概観

### 依存関係の方向性
```
Presentation Layer → Application Layer → Domain Layer ← Infrastructure Layer
```

**重要な発見**: Application層からInfrastructure層への直接的なimportは存在せず、DDDの依存関係逆転原則が正しく実装されています。

---

## 📁 Infrastructure層ディレクトリ構造

### メインエントリーポイント
- **`src/infrastructure/index.ts`** - 主要なコアサービスのみをexport
- **`src/infrastructure/layers/unified.layer.ts`** - 統一されたレイヤー定義（メインのサービス実装）

### 主要サブディレクトリ
```
src/infrastructure/
├── adapters/           # ドメインポート実装 (Hexagonal Architecture)
├── layers/            # Effect-TS Layer定義
├── repositories/      # データアクセス実装
├── workers/           # バックグラウンド処理
├── performance/       # パフォーマンス最適化
├── gpu/              # GPU関連サービス
├── network/          # ネットワーク通信
├── storage/          # データストレージ
├── monitoring/       # 監視・メトリクス
├── communication/    # システム間通信
└── services/         # その他のインフラサービス
```

---

## 🔗 主要な依存関係マップ

### 1. エントリーポイントからの依存関係

#### **`src/layers.ts`** (最重要エントリーポイント)
```typescript
依存先:
├── @infrastructure/layers/unified.layer         # 統一レイヤー定義
├── @infrastructure/layers/optimized-compositions # 最適化レイヤー
└── @infrastructure/adapters                     # アダプター実装
```

#### **`src/presentation/web/main.ts`** (Webエントリーポイント)
```typescript
依存先:
└── @infrastructure/layers/unified.layer         # UnifiedAppLiveのみ使用
```

#### **`src/main.ts`** (メインエントリーポイント)
```typescript
依存先:
└── @infrastructure/layers/unified.layer         # World サービスのみ使用
```

### 2. Infrastructure内部の依存関係

#### **統一レイヤーシステム** (`src/infrastructure/layers/`)
```
unified.layer.ts (1,424行の大規模ファイル)
├── サービス定義: Clock, Stats, World, ChunkManager等
├── ドメインサービス: WorldDomainService, PhysicsDomainService
├── Live実装: 各サービスの具体的な実装
└── レイヤー合成: DomainServicesLive, CoreServicesLive等

optimized-compositions.ts
├── 最適化レイヤー構成
├── 環境別プリセット (Development, Production, Test)
└── カスタムレイヤービルダー

service-aliases.ts
└── レガシー互換性のためのサービスエイリアス
```

#### **アダプターシステム** (`src/infrastructure/adapters/`)
```
adapter-exports.ts (123行)
├── Three.js Adapter
├── WebGPU Adapter
├── Input/Clock Adapter
├── Math Adapters (ThreeJS vs Native)
├── 通信系 Adapter
└── 完全なアダプター層構成

complete-adapter-layer.ts
├── CompleteAdapterLayer
├── DevelopmentAdapterLayer
├── ProductionAdapterLayer
└── MinimalAdapterLayer
```

#### **リポジトリシステム** (`src/infrastructure/repositories/`)
```
repository-exports.ts (78行)
├── WorldRepository
├── EntityRepository  
├── ChunkRepository
├── ComponentRepository
├── PhysicsRepository
└── RepositoryFactory
```

#### **ワーカーシステム** (`src/infrastructure/workers/`)
```
unified/ (統一ワーカーシステム)
├── worker-manager.ts
├── worker-pool.ts
├── worker-pool-bridge.ts
├── protocols/ (通信プロトコル)
│   ├── mesh.protocol.ts
│   ├── terrain.protocol.ts
│   ├── physics.protocol.ts
│   └── lighting.protocol.ts
├── workers/ (実際のワーカー)
│   ├── mesh-generation.worker.ts
│   ├── terrain-generation.worker.ts
│   ├── physics.worker.ts
│   └── computation.worker.ts
└── schemas/ (データスキーマ)
```

---

## 📊 使用状況分析

### 重要度: 最高 🔥
これらのファイルはプロジェクトの中核として広く使用されています。

1. **`src/infrastructure/layers/unified.layer.ts`**
   - 使用箇所: 9個のファイル
   - 役割: Effect-TSレイヤー定義の中心
   - 特徴: 1,424行の大規模な実装

2. **`src/infrastructure/adapters/`**
   - 使用箇所: layers.ts, テストファイル等
   - 役割: Hexagonal ArchitectureのPort実装

### 重要度: 高 🔸
これらは特定のコンテキストで重要な役割を果たします。

3. **`src/infrastructure/repositories/`**
   - 使用箇所: 主にテストとユーティリティ
   - 役割: データアクセス層の抽象化

4. **`src/infrastructure/workers/`**
   - 使用箇所: 内部相互依存が強い
   - 役割: バックグラウンド処理システム

5. **`src/infrastructure/performance/`**
   - 使用箇所: GPU関連サービスとワーカー
   - 役割: パフォーマンス最適化

---

## 🔄 内部依存関係ネットワーク

### Infrastructure内部のimportチェーン

#### **パフォーマンス系**
```
performance/object-pool.layer.ts
├── gpu/webgpu-renderer.ts
├── gpu/shader-manager.ts  
├── gpu/texture-manager.ts
├── storage/chunk-cache.ts
└── services/wasm-integration.service.ts
```

#### **ワーカー系の相互依存**
```
workers/base/typed-worker.ts
├── workers/unified/worker-manager.ts
├── workers/unified/worker-pool.ts
└── workers/unified/workers/*.worker.ts

workers/schemas/
├── worker-messages.schema.ts
├── worker-pool.schema.ts
└── worker-bridge.schema.ts
```

#### **アダプター系の内部依存**
```
adapters/adapter-exports.ts
├── 12個の個別アダプターファイル
└── ports-adapters-validation.ts (検証ユーティリティ)

adapters/adapter-utils.ts
├── three-js.adapter.ts
├── browser-input.adapter.ts
├── clock.adapter.ts
└── 他のアダプター実装
```

---

## 🎯 アーキテクチャの健全性

### ✅ 良い点
1. **DDDの依存関係逆転**: Application層からInfrastructure層への直接importなし
2. **統一レイヤーシステム**: 一元的なサービス管理
3. **Hexagonal Architecture**: ポート/アダプター分離が明確
4. **Effect-TSパターン**: 関数型アーキテクチャの適切な実装

### ⚠️ 注意点
1. **大規模な統一ファイル**: `unified.layer.ts`が1,424行と大規模
2. **内部依存関係**: Infrastructure内でのimport循環の潜在的リスク
3. **複雑なワーカーシステム**: 多層的な抽象化による複雑性

---

## 📈 使用頻度統計

### ファイル別使用回数
| ファイル | 使用箇所数 | 重要度 |
|---------|-----------|-------|
| layers/unified.layer.ts | 9 | 🔥 最高 |
| adapters/ (全体) | 6 | 🔸 高 |
| repositories/ (全体) | 4 | 🔸 中 |
| workers/ (内部依存) | 多数 | 🔸 高 |
| performance/ | 6 | 🔸 中 |

### カテゴリ別分析
- **レイヤー定義**: 最も重要（アプリケーション全体の基盤）
- **アダプター**: 重要（ポート実装）
- **ワーカー**: 特殊用途だが自己完結
- **パフォーマンス**: 支援的役割

---

## 🔍 次のステップ

このマップを基に、未使用のexportと削除可能なファイルの特定を進めます。
# コア機能概要

## 重要: Context7による外部パッケージ確認

**すべての外部パッケージ使用時は、Context7で最新のAPIを確認すること**

## 1. コア機能の定義

Minecraft クローンの最小限のプレイ可能な実装に必要な機能群です。これらはゲームの基本的な体験を提供するために**必須**の機能です。

## 2. コア機能一覧

### 2.1 ワールドシステム
- **チャンク管理**: 無限ワールドの効率的な読み込み/アンロード
- **地形生成**: 基本的なバイオームと地形
- **ブロックシステム**: ブロックの配置/破壊
- **照明システム**: 日光と人工光の計算

### 2.2 プレイヤーシステム
- **移動**: 歩行、走行、ジャンプ
- **視点**: 一人称/三人称カメラ
- **インタラクション**: ブロック操作、アイテム使用
- **インベントリ**: 基本的なアイテム管理

### 2.3 物理システム
- **重力**: エンティティとブロックの落下
- **衝突判定**: AABB衝突検出
- **水/溶岩**: 流体シミュレーション基礎

### 2.4 レンダリングシステム
- **ボクセルレンダリング**: 効率的なメッシュ生成
- **視錐台カリング**: 描画最適化
- **チャンクメッシュ**: グリーディーメッシング

### 2.5 基本的なゲームプレイ
- **サバイバルモード**: 体力、空腹度
- **クリエイティブモード**: 無限リソース、飛行
- **昼夜サイクル**: 時間経過と照明変化

## 3. 実装優先順位

### Phase 1: 基盤（1-2週間）
1. チャンクシステム
2. 基本的なブロックタイプ
3. プレイヤー移動
4. 基本レンダリング

### Phase 2: インタラクション（2-3週間）
1. ブロック配置/破壊
2. インベントリシステム
3. 物理演算
4. 照明計算

### Phase 3: ゲームプレイ（2-3週間）
1. サバイバル要素
2. 基本的なクラフティング
3. 昼夜サイクル
4. セーブ/ロード

## 4. 技術的制約

### 4.1 パフォーマンス目標
- **FPS**: 60fps維持（標準的なハードウェア）
- **描画距離**: 最小8チャンク
- **メモリ使用**: 2GB以下

### 4.2 最小システム要件
- **ブラウザ**: Chrome/Firefox最新版
- **WebGL**: 2.0サポート
- **RAM**: 4GB以上

## 5. DDD+ECS+Effect-TS統合

```typescript
import { Effect, Layer, Schema, pipe } from "effect"

// コア機能のレイヤー構成
export const CoreFeaturesLayer = Layer.mergeAll(
  // ワールドドメイン
  ChunkServiceLive,
  TerrainGeneratorLive,
  BlockSystemLive,

  // プレイヤードメイン
  PlayerServiceLive,
  InventoryServiceLive,

  // 物理ドメイン
  PhysicsEngineLive,
  CollisionSystemLive,

  // レンダリング
  RenderingPipelineLive,
  MeshGeneratorLive
)

// ECSシステム登録
export const coreSystems = [
  MovementSystem,
  PhysicsSystem,
  RenderSystem,
  ChunkLoadingSystem,
  LightingSystem
]
```

## 6. 次のステップ

各コア機能の詳細な実装ガイド：
- [01-world-system.md](./01-world-system.md) - ワールドシステム詳細
- [02-player-system.md](./02-player-system.md) - プレイヤーシステム詳細
- [03-physics-system.md](./03-physics-system.md) - 物理システム詳細
- [04-rendering-system.md](./04-rendering-system.md) - レンダリングシステム詳細
- [05-gameplay-basics.md](./05-gameplay-basics.md) - 基本ゲームプレイ詳細
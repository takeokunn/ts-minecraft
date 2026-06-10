---
title: 'Phase 06 - Enhanced World'
description: 'チャンクシステムと地形生成の実装'
phase: 6
estimated_duration: '5日間'
difficulty: 'advanced'
---

# Phase 06 - Enhanced World

## 目標
スケーラブルなチャンクシステム（16x16x384）とシンプルな地形生成を実装する。最適化（貪欲メッシュ化、フラスタムカリング）を追加する。

## ✅ 受け入れ条件（画面で確認）

### チャンクシステム
- [x] 16x16x384のチャンクがロードされる
- [x] プレイヤーの移動に合わせてチャンクがロード/アンロードされる
- [x] メモリ使用量が500MB以下（200チャンク）

### 地形生成
- [x] 平坦な地形ではなく、高低差のある地形
- [x] 少なくとも3種類のブロックタイプ（草、土、石）

### パフォーマンス
- [x] 30 FPS以上を維持（100+チャンク）
- [x] チャンク生成時間が100ms以下

## 📝 タスク

### Day 1: チャンクシステム

#### チャンク定義
- [x] `src/domain/chunk.ts` の作成
  - [x] `Chunk` 集約ルート
  - [x] `ChunkCoordinate` 型（x, z）
  - [x] `ChunkCoordinateSchema`（ブランドタイプ）
  - [x] ブロックデータ（16 * 384 * 16 = 98,304ブロック）
  - [x] Uint8Arrayを使用した効率的なストレージ

#### チャンク座標ユーティリティ
- [x] `src/domain/chunkCoord.ts` の作成
  - [x] `worldToChunk(position)` - ワールド座標からチャンク座標へ
  - [x] `chunkToWorld(chunkCoord)` - チャンク座標からワールド座標へ
  - [x] `blockToChunkOffset(position)` - ワールド座標からチャンク内オフセットへ

### Day 2: ChunkManagerとLRUキャッシュ

#### ChunkManager
- [x] `src/rendering/services.ts` の更新
  - [x] `ChunkManager = Context.GenericTag<ChunkManager>('@minecraft/ChunkManager')`

#### LRUキャッシュ実装
- [x] チャンクキャッシュ（Mapで実装）
  ```typescript
  const chunkCache = yield* Ref.make(new Map<ChunkCoordinate, Chunk>())
  const activeChunks = yield* Ref.make(new Set<ChunkCoordinate>())
  ```

#### チャンクロード/アンロード
- [x] `loadChunk(coord)` - チャンクをロード
  - [x] キャッシュチェック
  - [x] 未ロードなら生成
- [x] `unloadChunk(coord)` - チャンクをアンロード
- [x] `getVisibleChunks(playerPos)` - プレイヤー周囲のチャンクを取得

#### 動的チャンク管理
- [x] プレイヤー位置に基づくチャンクロード
- [x] 一定距離離のチャンクをアンロード
- [x] LRUポリシーによるメモリ管理

### Day 3: シンプルな地形生成

#### 地形ジェネレーター
- [x] `src/rendering/terrain/simple.ts` の作成
  - [x] ノイズ関数（シンプルな疑似乱数または簡易Perlin）
  - [x] 高度マップ生成
  - [x] ブロックタイプの決定（高度に基づく）

#### バイオームの基礎
- [x] 少なくとも2種類の地形タイプ
  - [x] 平原（平坦、草ブロック）
  - [x] 山地（起伏、石ブロック）

#### 木の生成（簡易版）
- [x] 地表にランダムな木を生成
- [x] 簡単な木構造（幹+葉）

### Day 4: 最適化 - メッシュ化とカリング

#### チャンクメッシュ
- [x] `src/rendering/meshing/chunk-mesh.ts` の作成
  - [x] チャンク全体のメッシュ生成
  - [x] 単一のTHREE.BufferGeometry
  - [x] 面ごとのインデックス管理

#### 貪欲メッシュ化（Greedy Meshing）
- [x] `src/rendering/meshing/greedy-meshing.ts` の作成
  - [x] 隣接する同一タイプのブロックの面を結合
  - [x] 面カリング（隠れた面の削除）
  - [x] 三角形数の50-90%削減を目標

#### フラスタムカリング
- [x] `src/rendering/culling.ts` の作成
  - [x] THREE.Frustumを使用
  - [x] 視野外のチャンクをレンダリング除外
  - [x] ビュー距離の設定

#### メッシュ更新
- [x] 変更されたチャンクのみ再メッシュ化
- [x] 効率的な更新トリガー

### Day 5: パフォーマンス検証と最適化

#### パフォーマンス計測
- [x] FPSカウンターの拡張
  - [x] チャンク数の表示
  - [x] 三角形数の表示
  - [x] メモリ使用量

#### 最適化
- [x] ボトルネックの特定
- [x] 必要に応じて最適化
  - [x] Web Workersの導入（オプション）
  - [x] インスタンス化されたメッシュ（オプション）

#### テスト
- [x] `src/domain/chunk.test.ts` の作成
  - [x] チャンク座標変換のテスト
  - [x] チャンクデータアクセスのテスト
- [x] `src/domain/chunkCoord.test.ts` の作成
  - [x] 座標変換のテスト
- [x] `src/rendering/meshing/greedy-meshing.test.ts` の作成
  - [x] メッシュ化アルゴリズムのテスト

#### 最終検証
- [x] 大きな世界を探索できる（100+チャンク）
- [x] 地形に高低差がある
- [x] FPSが30以上を維持
- [x] プレイヤー移動に合わせてチャンクがロード/アンロードされる
- [x] コンソールにエラーがない
- [x] すべてのテストが成功

## 🎯 成功基準
- スケーラブルなチャンクシステムが実装されている
- シンプルな地形生成が動作している
- 30 FPS以上を維持している（最適化が効いている）
- Effect-TSパターンでチャンク管理が実装されている

## 📊 依存関係
- Phase 05: Block Operations

## 🔗 関連ドキュメント
- [Phase 05](./05-block-operations.md)
- チャンクシステム（ドキュメント未作成）
- 貪欲メッシュ化（ドキュメント未作成）
- フラスタムカリング（ドキュメント未作成）

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
- [ ] 16x16x384のチャンクがロードされる
- [ ] プレイヤーの移動に合わせてチャンクがロード/アンロードされる
- [ ] メモリ使用量が500MB以下（200チャンク）

### 地形生成
- [ ] 平坦な地形ではなく、高低差のある地形
- [ ] 少なくとも3種類のブロックタイプ（草、土、石）

### パフォーマンス
- [ ] 30 FPS以上を維持（100+チャンク）
- [ ] チャンク生成時間が100ms以下

## 📝 タスク

### Day 1: チャンクシステム

#### チャンク定義
- [ ] `src/domain/chunk.ts` の作成
  - [ ] `Chunk` 集約ルート
  - [ ] `ChunkCoordinate` 型（x, z）
  - [ ] `ChunkCoordinateSchema`（ブランドタイプ）
  - [ ] ブロックデータ（16 * 384 * 16 = 98,304ブロック）
  - [ ] Uint8Arrayを使用した効率的なストレージ

#### チャンク座標ユーティリティ
- [ ] `src/domain/chunkCoord.ts` の作成
  - [ ] `worldToChunk(position)` - ワールド座標からチャンク座標へ
  - [ ] `chunkToWorld(chunkCoord)` - チャンク座標からワールド座標へ
  - [ ] `blockToChunkOffset(position)` - ワールド座標からチャンク内オフセットへ

### Day 2: ChunkManagerとLRUキャッシュ

#### ChunkManager
- [ ] `src/rendering/services.ts` の更新
  - [ ] `ChunkManager = Context.GenericTag<ChunkManager>('@minecraft/ChunkManager')`

#### LRUキャッシュ実装
- [ ] チャンクキャッシュ（Mapで実装）
  ```typescript
  const chunkCache = yield* Ref.make(new Map<ChunkCoordinate, Chunk>())
  const activeChunks = yield* Ref.make(new Set<ChunkCoordinate>())
  ```

#### チャンクロード/アンロード
- [ ] `loadChunk(coord)` - チャンクをロード
  - [ ] キャッシュチェック
  - [ ] 未ロードなら生成
- [ ] `unloadChunk(coord)` - チャンクをアンロード
- [ ] `getVisibleChunks(playerPos)` - プレイヤー周囲のチャンクを取得

#### 動的チャンク管理
- [ ] プレイヤー位置に基づくチャンクロード
- [ ] 一定距離離のチャンクをアンロード
- [ ] LRUポリシーによるメモリ管理

### Day 3: シンプルな地形生成

#### 地形ジェネレーター
- [ ] `src/rendering/terrain/simple.ts` の作成
  - [ ] ノイズ関数（シンプルな疑似乱数または簡易Perlin）
  - [ ] 高度マップ生成
  - [ ] ブロックタイプの決定（高度に基づく）

#### バイオームの基礎
- [ ] 少なくとも2種類の地形タイプ
  - [ ] 平原（平坦、草ブロック）
  - [ ] 山地（起伏、石ブロック）

#### 木の生成（簡易版）
- [ ] 地表にランダムな木を生成
- [ ] 簡単な木構造（幹+葉）

### Day 4: 最適化 - メッシュ化とカリング

#### チャンクメッシュ
- [ ] `src/rendering/meshing/chunk-mesh.ts` の作成
  - [ ] チャンク全体のメッシュ生成
  - [ ] 単一のTHREE.BufferGeometry
  - [ ] 面ごとのインデックス管理

#### 貪欲メッシュ化（Greedy Meshing）
- [ ] `src/rendering/meshing/greedy-meshing.ts` の作成
  - [ ] 隣接する同一タイプのブロックの面を結合
  - [ ] 面カリング（隠れた面の削除）
  - [ ] 三角形数の50-90%削減を目標

#### フラスタムカリング
- [ ] `src/rendering/culling.ts` の作成
  - [ ] THREE.Frustumを使用
  - [ ] 視野外のチャンクをレンダリング除外
  - [ ] ビュー距離の設定

#### メッシュ更新
- [ ] 変更されたチャンクのみ再メッシュ化
- [ ] 効率的な更新トリガー

### Day 5: パフォーマンス検証と最適化

#### パフォーマンス計測
- [ ] FPSカウンターの拡張
  - [ ] チャンク数の表示
  - [ ] 三角形数の表示
  - [ ] メモリ使用量

#### 最適化
- [ ] ボトルネックの特定
- [ ] 必要に応じて最適化
  - [ ] Web Workersの導入（オプション）
  - [ ] インスタンス化されたメッシュ（オプション）

#### テスト
- [ ] `src/domain/chunk.test.ts` の作成
  - [ ] チャンク座標変換のテスト
  - [ ] チャンクデータアクセスのテスト
- [ ] `src/domain/chunkCoord.test.ts` の作成
  - [ ] 座標変換のテスト
- [ ] `src/rendering/meshing/greedy-meshing.test.ts` の作成
  - [ ] メッシュ化アルゴリズムのテスト

#### 最終検証
- [ ] 大きな世界を探索できる（100+チャンク）
- [ ] 地形に高低差がある
- [ ] FPSが30以上を維持
- [ ] プレイヤー移動に合わせてチャンクがロード/アンロードされる
- [ ] コンソールにエラーがない
- [ ] すべてのテストが成功

## 🎯 成功基準
- スケーラブルなチャンクシステムが実装されている
- シンプルな地形生成が動作している
- 30 FPS以上を維持している（最適化が効いている）
- Effect-TSパターンでチャンク管理が実装されている

## 📊 依存関係
- Phase 05: Block Operations

## 🔗 関連ドキュメント
- [Phase 05](./05-block-operations.md)
- [チャンクシステム](../docs/explanations/game-mechanics/core-features/chunk-system.md)
- [貪欲メッシュ化](../docs/explanations/game-mechanics/core-features/greedy-meshing.md)
- [フラスタムカリング](../docs/explanations/game-mechanics/core-features/frustum-culling.md)

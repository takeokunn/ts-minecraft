---
title: 'Phase 02 - Visual Foundation - Three.js'
description: 'Three.jsによる3Dブロックのレンダリング'
phase: 2
estimated_duration: '3日間'
difficulty: 'beginner'
---

# Phase 02 - Visual Foundation - Three.js

## 目標
Three.jsを使って3Dブロックを画面上にレンダリングする。初めての視覚的な出力を達成する。

## ✅ 受け入れ条件（画面で確認）

### 視覚的出力
- [ ] ブラウザで3Dブロックが表示される
- [ ] 少なくとも5つの異なるブロックが表示される
- [ ] FPSカウンターが表示され、30 FPS以上である

### 技術的検証
- [ ] ブロックメッシュが正しく生成されている
- [ ] カメラが適切に配置されている
- [ ] レンダリングループがスムーズに動作している

## 📝 タスク

### Day 1: ドメインモデル - ブロック

#### ブロックタイプ定義
- [ ] `src/domain/block.ts` の作成
  - [ ] `BlockType` enumまたはSchema定義
  - [ ] `BlockIdSchema`（共通カーネルから使用）
  - [ ] ブロックプロパティ（堅硬度、透明度など）

#### ブロックレジストリサービス
- [ ] `src/domain/blockRegistry.ts` の作成
  - [ ] `BlockRegistry = Context.GenericTag<BlockRegistry>('@minecraft/BlockRegistry')`
  - [ ] `register(id, type)` - ブロックの登録
  - [ ] `get(id)` - ブロックタイプの取得
  - [ ] 初期ブロックの登録（草ブロック、土、石、木材など）

#### テクスチャ管理
- [ ] `src/rendering/textures/` ディレクトリの作成
  - [ ] 単一のテクスチャローダー実装（`texture-loader.ts`）
  - [ ] 単色テクスチャまたはプレースホルダー画像

### Day 2: ブロックメッシュ生成

#### シンプルなブロックメッシュ
- [ ] `src/rendering/meshing/block-mesh.ts` の作成
  - [ ] 単一ブロック用のTHREE.BoxGeometry生成
  - [ ] マテリアルの適用
  - [ ] メッシュの最適化（共有ジオメトリ）

#### シーンへのブロック追加
- [ ] `src/rendering/scene.ts` の更新
  - [ ] 地面プレーンの追加
  - [ ] 複数ブロックの配置
  - [ ] カメラの位置調整（ブロックが見える位置に）

#### カメラコントロール
- [ ] `src/rendering/camera.ts` の作成
  - [ ] 基本的なカメラ位置設定
  - [ ] オービットコントロール（オプション：デバッグ用）

### Day 3: 最終検証と最適化

#### FPSカウンター
- [ ] `src/rendering/fps-counter.ts` の作成
  - [ ] `requestAnimationFrame` のデルタ時間計測
  - [ ] FPS表示のオーバーレイ実装

#### パフォーマンスベースライン
- [ ] レンダリングパフォーマンスの計測
  - [ ] フレームタイムの記録
  - [ ] メモリ使用量の確認（オプション）
- [ ] 目標: 30 FPS以上

#### テスト
- [ ] `src/domain/block.test.ts` の作成
  - [ ] ブロックタイプのバリデーション
  - [ ] ブロックレジストリのテスト
- [ ] `src/rendering/meshing/block-mesh.test.ts` の作成
  - [ ] メッシュ生成のテスト

#### 最終検証
- [ ] `pnpm dev` で開発サーバーを起動
- [ ] ブラウザで5つ以上のブロックが表示される
- [ ] FPSが30以上である
- [ ] コンソールにエラーがない
- [ ] ユニットテストが全て成功

## 🎯 成功基準
- **初めての視覚的出力**: 3Dブロックが画面上に表示される
- Effect-TSパターンでサービスが実装されている
- パフォーマンスベースラインが確立されている
- テストカバレッジが80%以上

## 📊 依存関係
- Phase 01: Foundation + Effect-TS Core

## 🔗 関連ドキュメント
- [Phase 01](./01-foundation.md)
- [Vite設定](../docs/reference/configuration/vite-config.md)
- [Three.jsドキュメント](https://threejs.org/docs/)

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
- [x] ブラウザで3Dブロックが表示される
- [x] 少なくとも5つの異なるブロックが表示される
- [x] FPSカウンターが表示され、30 FPS以上である

### 技術的検証
- [x] ブロックメッシュが正しく生成されている
- [x] カメラが適切に配置されている
- [x] レンダリングループがスムーズに動作している

## 📝 タスク

### Day 1: ドメインモデル - ブロック

#### ブロックタイプ定義
- [x] `src/domain/block.ts` の作成
  - [x] `BlockType` enumまたはSchema定義
  - [x] `BlockIdSchema`（共通カーネルから使用）
  - [x] ブロックプロパティ（堅硬度、透明度など）

#### ブロックレジストリサービス
- [x] `src/domain/blockRegistry.ts` の作成
  - [x] `BlockRegistry = Context.GenericTag<BlockRegistry>('@minecraft/BlockRegistry')`
  - [x] `register(id, type)` - ブロックの登録
  - [x] `get(id)` - ブロックタイプの取得
  - [x] 初期ブロックの登録（草ブロック、土、石、木材など）

#### テクスチャ管理
- [x] `src/rendering/textures/` ディレクトリの作成
  - [x] 単一のテクスチャローダー実装（`texture-loader.ts`）
  - [x] 単色テクスチャまたはプレースホルダー画像

### Day 2: ブロックメッシュ生成

#### シンプルなブロックメッシュ
- [x] `src/rendering/meshing/block-mesh.ts` の作成
  - [x] 単一ブロック用のTHREE.BoxGeometry生成
  - [x] マテリアルの適用
  - [x] メッシュの最適化（共有ジオメトリ）

#### シーンへのブロック追加
- [x] `src/rendering/scene.ts` の更新
  - [x] 地面プレーンの追加
  - [x] 複数ブロックの配置
  - [x] カメラの位置調整（ブロックが見える位置に）

#### カメラコントロール
- [x] `src/rendering/camera.ts` の作成
  - [x] 基本的なカメラ位置設定
  - [x] オービットコントロール（オプション：デバッグ用）

### Day 3: 最終検証と最適化

#### FPSカウンター
- [x] `src/rendering/fps-counter.ts` の作成
  - [x] `requestAnimationFrame` のデルタ時間計測
  - [x] FPS表示のオーバーレイ実装

#### パフォーマンスベースライン
- [x] レンダリングパフォーマンスの計測
  - [x] フレームタイムの記録
  - [x] メモリ使用量の確認（オプション）
- [x] 目標: 30 FPS以上

#### テスト
- [x] `src/domain/block.test.ts` の作成
  - [x] ブロックタイプのバリデーション
  - [x] ブロックレジストリのテスト
- [x] `src/rendering/meshing/block-mesh.test.ts` の作成
  - [x] メッシュ生成のテスト

#### 最終検証
- [x] `pnpm dev` で開発サーバーを起動
- [x] ブラウザで5つ以上のブロックが表示される
- [x] FPSが30以上である
- [x] コンソールにエラーがない
- [x] ユニットテストが全て成功

## 🎯 成功基準
- **初めての視覚的出力**: 3Dブロックが画面上に表示される
- Effect-TSパターンでサービスが実装されている
- パフォーマンスベースラインが確立されている
- テストカバレッジが80%以上

## 📊 依存関係
- Phase 01: Foundation + Effect-TS Core

## 🔗 関連ドキュメント
- [Phase 01](./01-foundation.md)
- Vite設定（ドキュメント未作成）
- [Three.jsドキュメント](https://threejs.org/docs/)

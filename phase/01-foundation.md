---
title: 'Phase 01 - Foundation + Effect-TS Core'
description: '環境構築とEffect-TSパターンの確立'
phase: 1
estimated_duration: '3日間'
difficulty: 'beginner'
---

# Phase 01 - Foundation + Effect-TS Core

## 目標
動作する開発環境を構築し、Effect-TSパターンを確立する。Three.jsの基本設定を完了する。

## ✅ 受け入れ条件（画面で確認）

### ローカル環境
- [x] `pnpm install` がエラーなしで終了
- [x] `pnpm tsc --noEmit` がエラーなしで終了
- [x] `pnpm vitest run` がテストを実行して成功する
- [x] ブラウザで `http://localhost:5173` を開き、空白のThree.jsキャンバスが表示される

### CI
- [x] PRでGitHub Actionsの型チェックが✅になる
- [x] PRでGitHub Actionsのテストが✅になる

## 📝 タスク

### Day 1: 環境構築 + Effect-TS Core

#### 依存関係のセットアップ
- [x] `package.json` の作成
  - [x] 依存パッケージ: `three`, `effect`, `@effect/schema`
  - [x] 開発依存: `vite`, `typescript`, `vitest`, `@types/three`
- [x] `pnpm install` を実行して成功を確認
- [x] `vite.config.ts` の作成（Three.js対応）
- [x] `tsconfig.json` の作成（strict mode）

#### Effect-TS 共通カーネル
- [x] `src/shared/kernel.ts` の作成
  - [x] `WorldIdSchema = Schema.String.pipe(Schema.brand('WorldId'))`
  - [x] `PlayerIdSchema = Schema.String.pipe(Schema.brand('PlayerId'))`
  - [x] `BlockIdSchema = Schema.String.pipe(Schema.brand('BlockId'))`
  - [x] `PositionSchema`（x, y, zの座標）

#### Effect-TS レイヤー定義
- [x] `src/shared/layers.ts` の作成
  - [x] 基本的なLayer定義
  - [x] サービス用のContext.GenericTagプレースホルダー

### Day 2: Three.js 基本設定

#### レンダラーサービス
- [x] `src/rendering/renderer.ts` の作成
  - [x] `RendererService = Context.GenericTag<RendererService>('@minecraft/RendererService')`
  - [x] THREE.WebGLRendererの初期化
  - [x] レンダリングループの実装（requestAnimationFrame）
  - [x] canvas要素のDOM追加

#### 基本シーン設定
- [x] `src/rendering/scene.ts` の作成
  - [x] THREE.Sceneの初期化
  - [x] THREE.PerspectiveCameraの初期化
  - [x] 基本的なライティング（AmbientLight）

#### エントリーポイント
- [x] `src/main.ts` の作成
  - [x] Layerの構成
  - [x] レンダリングループの起動
  - [x] Effect.runによる初期化

### Day 3: テストとCI

#### ユニットテスト
- [x] `src/shared/kernel.test.ts` の作成
  - [x] Schemaバリデーションのテスト
  - [x] Brandタイプのテスト
- [x] `src/rendering/renderer.test.ts` の作成
  - [x] RendererServiceの初期化テスト
- [x] `pnpm vitest run` が全テスト成功することを確認

#### GitHub Actions
- [x] `.github/workflows/check.yml` の作成（型チェック）
- [x] `.github/workflows/test.yml` の作成（テスト）
- [x] ブランチを作成してPR
- [x] CIが✅になることを確認

#### 最終検証
- [x] `pnpm dev` で開発サーバーを起動
- [x] ブラウザで `http://localhost:5173` を開く
- [x] 空白のキャンバス（またはデフォルトのThree.jsシーン）が表示される
- [x] コンソールにエラーがないこと

## 🎯 成功基準
- Effect-TSパターン（Context.GenericTag, Schema.Struct, Effect.gen）が確立されている
- Three.jsが正しく初期化され、レンダリングループが動いている
- すべてのテストが成功
- CIが正常に動作

## 📊 依存関係
- なし（最初のフェーズ）

## 🔗 関連ドキュメント
- [README](../README.md)
- 開発環境セットアップ（ドキュメント未作成）
- Effect-TSパターン（ドキュメント未作成）

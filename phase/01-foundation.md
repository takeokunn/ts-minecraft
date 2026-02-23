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
- [ ] `pnpm install` がエラーなしで終了
- [ ] `pnpm tsc --noEmit` がエラーなしで終了
- [ ] `pnpm vitest run` がテストを実行して成功する
- [ ] ブラウザで `http://localhost:5173` を開き、空白のThree.jsキャンバスが表示される

### CI
- [ ] PRでGitHub Actionsの型チェックが✅になる
- [ ] PRでGitHub Actionsのテストが✅になる

## 📝 タスク

### Day 1: 環境構築 + Effect-TS Core

#### 依存関係のセットアップ
- [ ] `package.json` の作成
  - [ ] 依存パッケージ: `three`, `effect`, `@effect/schema`
  - [ ] 開発依存: `vite`, `typescript`, `vitest`, `@types/three`
- [ ] `pnpm install` を実行して成功を確認
- [ ] `vite.config.ts` の作成（Three.js対応）
- [ ] `tsconfig.json` の作成（strict mode）

#### Effect-TS 共通カーネル
- [ ] `src/shared/kernel.ts` の作成
  - [ ] `WorldIdSchema = Schema.String.pipe(Schema.brand('WorldId'))`
  - [ ] `PlayerIdSchema = Schema.String.pipe(Schema.brand('PlayerId'))`
  - [ ] `BlockIdSchema = Schema.String.pipe(Schema.brand('BlockId'))`
  - [ ] `PositionSchema`（x, y, zの座標）

#### Effect-TS レイヤー定義
- [ ] `src/shared/layers.ts` の作成
  - [ ] 基本的なLayer定義
  - [ ] サービス用のContext.GenericTagプレースホルダー

### Day 2: Three.js 基本設定

#### レンダラーサービス
- [ ] `src/rendering/renderer.ts` の作成
  - [ ] `RendererService = Context.GenericTag<RendererService>('@minecraft/RendererService')`
  - [ ] THREE.WebGLRendererの初期化
  - [ ] レンダリングループの実装（requestAnimationFrame）
  - [ ] canvas要素のDOM追加

#### 基本シーン設定
- [ ] `src/rendering/scene.ts` の作成
  - [ ] THREE.Sceneの初期化
  - [ ] THREE.PerspectiveCameraの初期化
  - [ ] 基本的なライティング（AmbientLight）

#### エントリーポイント
- [ ] `src/main.ts` の作成
  - [ ] Layerの構成
  - [ ] レンダリングループの起動
  - [ ] Effect.runによる初期化

### Day 3: テストとCI

#### ユニットテスト
- [ ] `src/shared/kernel.test.ts` の作成
  - [ ] Schemaバリデーションのテスト
  - [ ] Brandタイプのテスト
- [ ] `src/rendering/renderer.test.ts` の作成
  - [ ] RendererServiceの初期化テスト
- [ ] `pnpm vitest run` が全テスト成功することを確認

#### GitHub Actions
- [ ] `.github/workflows/check.yml` の作成（型チェック）
- [ ] `.github/workflows/test.yml` の作成（テスト）
- [ ] ブランチを作成してPR
- [ ] CIが✅になることを確認

#### 最終検証
- [ ] `pnpm dev` で開発サーバーを起動
- [ ] ブラウザで `http://localhost:5173` を開く
- [ ] 空白のキャンバス（またはデフォルトのThree.jsシーン）が表示される
- [ ] コンソールにエラーがないこと

## 🎯 成功基準
- Effect-TSパターン（Context.GenericTag, Schema.Struct, Effect.gen）が確立されている
- Three.jsが正しく初期化され、レンダリングループが動いている
- すべてのテストが成功
- CIが正常に動作

## 📊 依存関係
- なし（最初のフェーズ）

## 🔗 関連ドキュメント
- [README](../README.md)
- [開発環境セットアップ](../docs/how-to/development/setup-dev-environment.md)
- [Effect-TSパターン](../docs/reference/configuration/typescript-config-practical.md)

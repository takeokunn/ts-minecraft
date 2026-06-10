---
title: 'Phase 07 - MVP Polish'
description: 'MVPの完成とドキュメント'
phase: 7
estimated_duration: '3日間'
difficulty: 'beginner'
---

# Phase 07 - MVP Polish

## 目標
完全にプレイ可能なMVP（Minimum Viable Product）を完成させる。セーブ/ロード機能、設定、ドキュメントを追加する。

## ✅ 受け入れ条件（画面で確認）

### セーブ/ロード
- [x] ワールドをセーブできる（localStorageまたはIndexedDB）
- [x] ワールドをロードできる
- [x] ページリロード後にワールドが復元される

### UI/設定
- [x] ホットバーが完全に機能している
- [x] 設定メニューがある（描画距離など）
- [x] 十字線とHUDが表示されている

### ドキュメント
- [x] READMEが最新の状態
- [x] 加速開発アプローチのドキュメントがある
- [x] デモビデオまたはスクリーンショットがある（オプション）

## 📝 タスク

### Day 1: セーブ/ロード機能

#### SaveService
- [x] `src/presentation/storage.ts` の作成
  - [x] `SaveService = Context.GenericTag<SaveService>('@minecraft/SaveService')`

#### ローカルストレージ
- [x] `saveWorld()` メソッド
  ```typescript
  const saveWorld = () => Effect.gen(function* () {
    const worldService = yield* WorldService
    const chunkManager = yield* ChunkManager
    const playerService = yield* PlayerService

    const saveData = {
      player: yield* playerService.getPlayerData(),
      chunks: yield* chunkManager.getAllChunks(),
      timestamp: new Date().toISOString()
    }

    yield* Effect.tryPromise({
      try: () => localStorage.setItem('minecraft_save', JSON.stringify(saveData)),
      catch: (error) => SaveError(error)
    })
  })
  ```
- [x] `loadWorld()` メソッド
  - [x] localStorageからデータ読み込み
  - [x] JSONパースとバリデーション
  - [x] ワールドの復元

#### 自動セーブ
- [x] 定期的な自動セーブ（例: 5分ごと）
- [x] 手動セーブ（F5キー）

#### テスト
- [x] セーブ/ロードの統合テスト
- [x] データ整合性の検証

### Day 2: 設定とUI

#### 設定サービス
- [x] `src/presentation/settings.ts` の作成
  - [x] `SettingsService = Context.GenericTag<SettingsService>('@minecraft/SettingsService')`
  - [x] 設定のRef管理
  - [x] 設定の永続化

#### 設定項目
- [x] 描画距離（チャンク数）
- [x] マウス感度
- [x] 音量（音声実装時）

#### 設定UI
- [x] 設定メニューのオーバーレイ
- [x] スライダー/トグルで設定変更
- [x] 設定の即時反映

#### ホットバーの完成
- [x] すべてのスロットが機能している
- [x] アイコン/色でブロックタイプを区別
- [x] スムーズな選択アニメーション

### Day 3: テストとドキュメント

#### 統合テスト
- [x] エンドツーエンドテスト
  - [x] プレイヤーが移動できる
  - [x] ブロックを配置/破壊できる
  - [x] セーブ/ロードが動作する
  - [x] 設定が反映される

#### ユニットテスト
- [x] 全テストが成功することを確認
- [x] カバレッジの確認（目標80%以上）

#### ドキュメント更新
- [x] `README.md` の更新
  - [x] インストール手順
  - [x] 実行方法
  - [x] 操作方法
  - [x] MVP機能一覧

- [x] `docs/how-to/accelerated-development.md` の作成
  - [x] 加速開発アプローチの説明
  - [x] 各フェーズの達成目標
  - [x] 効果-TSパターンの使用例

- [x] `phase/README.md` の更新
  - [x] 新しい7フェーズ構造の説明
  - [x] 依存関係グラフ
  - [x] タイムライン

#### デモ
- [x] ゲームプレイのデモビデオ（オプション）
  - [x] 移動
  - [x] ブロック操作
  - [x] 地形の探索

- [x] スクリーンショット
  - [x] ホットバー
  - [x] 地形
  - [x] 設定画面

#### 最終検証チェックリスト
- [x] `pnpm install` が成功
- [x] `pnpm tsc --noEmit` が成功
- [x] `pnpm vitest run` が全成功
- [x] `pnpm dev` でゲームが起動
- [x] WASDで移動できる
- [x] スペースでジャンプできる
- [x] 左クリックでブロック破壊
- [x] 右クリックでブロック配置
- [x] 1-9キーでブロック選択
- [x] ホットバーが表示される
- [x] 十字線が表示される
- [x] 地形を探索できる
- [x] ワールドをセーブできる
- [x] ワールドをロードできる
- [x] 設定を変更できる
- [x] 30 FPS以上
- [x] コンソールにエラーがない

## 🎯 成功基準
- **完全にプレイ可能なMVP**: 移動、ブロック操作、探索ができる
- セーブ/ロードが動作している
- ドキュメントが完全である
- すべてのテストが成功している
- CIが通っている

## 📊 依存関係
- Phase 06: Enhanced World

## 🔗 関連ドキュメント
- [Phase 06](./06-enhanced-world.md)
- [README](../README.md)
- プロジェクトドキュメント（ドキュメント未作成）

## 🎉 MVP完了おめでとう！

これでMVPの開発が完了しました。達成したこと：

- ✅ Day 6: 初めての3Dレンダリング
- ✅ Day 10: アニメーションするシーン
- ✅ Day 14: プレイヤー操作
- ✅ Day 17: ブロック配置/破壊
- ✅ Day 22: 大きなワールド
- ✅ Day 25: 完全なMVP

**総期間: 22-25日間（約3-4週間）**

元の計画（20週間）と比較して、**84%高速化**しました！

## 次のステップ

MVP完了後、以下の機能を追加できます：

- 完全な地形生成（Perlinノイズ、複雑なバイオーム）
- インベントリシステム
- クラフトシステム
- 体力・空腹システム
- 戦闘システム
- モブ/エンティティ
- サウンドと音楽
- レッドストーン
- ネザーとエンド
- マルチプレイヤー（ネットワーク）

これらは元のPhase 7-20に対応しており、MVPの基礎の上に構築できます。

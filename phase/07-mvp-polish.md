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
- [ ] ワールドをセーブできる（localStorageまたはIndexedDB）
- [ ] ワールドをロードできる
- [ ] ページリロード後にワールドが復元される

### UI/設定
- [ ] ホットバーが完全に機能している
- [ ] 設定メニューがある（描画距離など）
- [ ] 十字線とHUDが表示されている

### ドキュメント
- [ ] READMEが最新の状態
- [ ] 加速開発アプローチのドキュメントがある
- [ ] デモビデオまたはスクリーンショットがある（オプション）

## 📝 タスク

### Day 1: セーブ/ロード機能

#### SaveService
- [ ] `src/presentation/storage.ts` の作成
  - [ ] `SaveService = Context.GenericTag<SaveService>('@minecraft/SaveService')`

#### ローカルストレージ
- [ ] `saveWorld()` メソッド
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
- [ ] `loadWorld()` メソッド
  - [ ] localStorageからデータ読み込み
  - [ ] JSONパースとバリデーション
  - [ ] ワールドの復元

#### 自動セーブ
- [ ] 定期的な自動セーブ（例: 5分ごと）
- [ ] 手動セーブ（F5キー）

#### テスト
- [ ] セーブ/ロードの統合テスト
- [ ] データ整合性の検証

### Day 2: 設定とUI

#### 設定サービス
- [ ] `src/presentation/settings.ts` の作成
  - [ ] `SettingsService = Context.GenericTag<SettingsService>('@minecraft/SettingsService')`
  - [ ] 設定のRef管理
  - [ ] 設定の永続化

#### 設定項目
- [ ] 描画距離（チャンク数）
- [ ] マウス感度
- [ ] 音量（音声実装時）

#### 設定UI
- [ ] 設定メニューのオーバーレイ
- [ ] スライダー/トグルで設定変更
- [ ] 設定の即時反映

#### ホットバーの完成
- [ ] すべてのスロットが機能している
- [ ] アイコン/色でブロックタイプを区別
- [ ] スムーズな選択アニメーション

### Day 3: テストとドキュメント

#### 統合テスト
- [ ] エンドツーエンドテスト
  - [ ] プレイヤーが移動できる
  - [ ] ブロックを配置/破壊できる
  - [ ] セーブ/ロードが動作する
  - [ ] 設定が反映される

#### ユニットテスト
- [ ] 全テストが成功することを確認
- [ ] カバレッジの確認（目標80%以上）

#### ドキュメント更新
- [ ] `README.md` の更新
  - [ ] インストール手順
  - [ ] 実行方法
  - [ ] 操作方法
  - [ ] MVP機能一覧

- [ ] `docs/how-to/accelerated-development.md` の作成
  - [ ] 加速開発アプローチの説明
  - [ ] 各フェーズの達成目標
  - [ ] 効果-TSパターンの使用例

- [ ] `phase/README.md` の更新
  - [ ] 新しい7フェーズ構造の説明
  - [ ] 依存関係グラフ
  - [ ] タイムライン

#### デモ
- [ ] ゲームプレイのデモビデオ（オプション）
  - [ ] 移動
  - [ ] ブロック操作
  - [ ] 地形の探索

- [ ] スクリーンショット
  - [ ] ホットバー
  - [ ] 地形
  - [ ] 設定画面

#### 最終検証チェックリスト
- [ ] `pnpm install` が成功
- [ ] `pnpm tsc --noEmit` が成功
- [ ] `pnpm vitest run` が全成功
- [ ] `pnpm dev` でゲームが起動
- [ ] WASDで移動できる
- [ ] スペースでジャンプできる
- [ ] 左クリックでブロック破壊
- [ ] 右クリックでブロック配置
- [ ] 1-9キーでブロック選択
- [ ] ホットバーが表示される
- [ ] 十字線が表示される
- [ ] 地形を探索できる
- [ ] ワールドをセーブできる
- [ ] ワールドをロードできる
- [ ] 設定を変更できる
- [ ] 30 FPS以上
- [ ] コンソールにエラーがない

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
- [プロジェクトドキュメント](../docs/README.md)

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

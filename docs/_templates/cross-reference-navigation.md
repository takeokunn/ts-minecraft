# クロスリファレンスナビゲーション最適化テンプレート

Context7とTSDocベストプラクティスに基づく統一されたドキュメント間ナビゲーション設計。

## 基本ナビゲーション構造

### 1. コンテキスト認識ナビゲーション

各ドキュメントの末尾に、現在のコンテキストに応じた次のステップを提示：

```markdown
## 🔗 関連ドキュメント

### 📚 このトピックをさらに学ぶ
- **[Tutorial: プレイヤーシステム実装](../../tutorials/basic-game-development/02-player-system.md)** - 実際の実装手順を学ぶ
- **[Reference: Player API](../../reference/api/player-api.md)** - 詳細なAPI仕様を確認

### 🔧 関連する問題解決
- **[How-to: プレイヤー状態管理](../../how-to/development/player-state-management.md)** - 実装時の具体的問題解決
- **[Troubleshooting: プレイヤーエラー](../../how-to/troubleshooting/player-errors.md)** - エラー発生時の対処法

### 🧠 背景理解を深める
- **[Explanation: プレイヤーシステム設計](../../explanations/game-mechanics/00-core-features/02-player-system.md)** - 設計判断の背景理解

## 📍 現在位置
現在のドキュメント: **[Tutorials](../../../tutorials/) > [Basic Game Development](../../basic-game-development/) > プレイヤーシステム実装**
```

### 2. 双方向リンクパターン

```markdown
## ⬅️ 前のステップ
**[ワールド生成の基本](./01-world-generation.md)**
- 前提知識: ワールドシステムの基本理解
- 完了時間: 約15分

## ➡️ 次のステップ
**[インベントリシステム](./03-inventory-system.md)**
- 学習内容: アイテム管理の実装
- 推定時間: 約25分

## 🎯 この章の位置づけ
**学習パス**: [基礎セットアップ](./01-world-generation.md) → **現在：プレイヤーシステム** → [インベントリ管理](./03-inventory-system.md) → [ゲームループ](./04-game-loop.md)
```

### 3. タイプ別クロスリファレンス

#### Tutorialから他セクションへ
```markdown
## 🎓 学習完了後の次ステップ

### 実践で活用する
- **[How-to: 実装ベストプラクティス](../../how-to/development/implementation-best-practices.md)**
- **[How-to: パフォーマンス最適化](../../how-to/development/performance-optimization.md)**

### 詳細仕様を確認する
- **[Reference: Effect-TS API](../../reference/api/effect-ts-api.md)**
- **[Reference: ゲームシステム仕様](../../reference/game-systems/)**

### 設計思想を理解する
- **[Explanation: Effect-TS選択理由](../../explanations/design-patterns/why-effect-ts.md)**
- **[Explanation: DDD統合パターン](../../explanations/architecture/ddd-integration.md)**
```

#### How-toから他セクションへ
```markdown
## 🛠 問題解決完了後のリソース

### 基礎理解を深める
- **[Tutorial: 関連機能の学習](../../tutorials/)**

### 技術仕様を詳しく確認
- **[Reference: 設定オプション](../../reference/configuration/)**
- **[Reference: API詳細](../../reference/api/)**

### 設計背景を理解する
- **[Explanation: この解決策を採用した理由](../../explanations/)**
```

#### Referenceから他セクションへ
```markdown
## 📋 API理解後の学習リソース

### 実装方法を学ぶ
- **[Tutorial: このAPIを使った実装](../../tutorials/)**
- **[How-to: 実践的な使用方法](../../how-to/)**

### 設計判断を理解する
- **[Explanation: このAPI設計の背景](../../explanations/)**
```

#### Explanationから他セクションへ
```markdown
## 💡 理解後の実践ステップ

### 実際に実装してみる
- **[Tutorial: 段階的実装学習](../../tutorials/)**
- **[How-to: 実装時のベストプラクティス](../../how-to/)**

### 詳細仕様を確認する
- **[Reference: 技術詳細](../../reference/)**
```

## 4. 動的ナビゲーション強化

### 学習進捗表示
```markdown
## 📊 学習進捗

**基本ゲーム開発 (3/5完了)**
- [x] ワールド生成基礎
- [x] プレイヤーシステム
- [x] **現在: インベントリシステム**
- [ ] ブロック配置システム
- [ ] ゲームループ統合

**推定残り時間**: 約1時間30分
```

### 関連度スコア表示
```markdown
## 🎯 関連ドキュメント (関連度順)

### 🔥 高関連度 (90%以上)
- **[プレイヤーAPI仕様](../../reference/api/player-api.md)** - このチュートリアルで使用するAPI
- **[エラーハンドリングパターン](../../explanations/design-patterns/error-handling.md)** - 実装で必須の概念

### 🔶 中関連度 (70-89%)
- **[Effect-TS基礎](../../tutorials/effect-ts-fundamentals/basics.md)** - 使用技術の理解
- **[テストパターン](../../how-to/testing/unit-testing.md)** - 品質保証に有用

### 🔸 低関連度 (50-69%)
- **[デプロイメント](../../how-to/deployment/basic-deployment.md)** - 将来的に必要
```

### 知識マップビジュアル
```markdown
## 🗺 知識マップ

```
現在位置：プレイヤーシステム実装

        ┌─ ワールド生成 ────────────┐
        │                          │
        ▼                          ▼
   プレイヤーシステム ────── インベントリシステム
        │                          │
        ▼                          ▼
   レンダリング ──────────── ゲームループ統合
```

**学習の流れ**:
1. ワールドの基盤理解 → 2. **プレイヤー機能実装** → 3. アイテム管理 → 4. 総合統合
```

## 5. セマンティック関連性

### コンセプト基準の関連付け
```markdown
## 🧩 コンセプト関連

### 同じコンセプトを扱うドキュメント
**「状態管理」について**:
- Tutorial: [基本的な状態管理実装](../../tutorials/state-management.md)
- How-to: [複雑な状態の扱い方](../../how-to/advanced-state.md)
- Reference: [状態管理API](../../reference/state-api.md)
- Explanation: [状態管理パターンの選択理由](../../explanations/state-patterns.md)

### 前提となるコンセプト
**理解しておくべき概念**:
- **[Effect-TS基礎](../../tutorials/effect-ts-fundamentals/)** - 必須の前提知識
- **[関数型プログラミング](../../explanations/fp-concepts.md)** - 理解推奨

### 発展的コンセプト
**次に学ぶべき概念**:
- **[非同期処理パターン](../../explanations/async-patterns.md)** - より高度な実装
- **[パフォーマンス最適化](../../how-to/performance/)** - 実用化のために
```

## 6. コンテキスト保持ナビゲーション

```markdown
## 📌 ナビゲーションコンテキスト

### あなたの学習目標
- [ ] **基本機能実装スキル習得** ← 現在のフォーカス
- [ ] Effect-TS実践パターン理解
- [ ] プロダクション品質コード作成

### 現在の学習セッション
- **開始時間**: 14:30 (推定残り45分)
- **今日の目標**: プレイヤーシステムの基本実装完了
- **次回予定**: インベントリシステムの詳細学習
```

`★ Insight ─────────────────────────────────────`
このクロスリファレンス設計の特徴：
1. **Context7準拠**: 最新のドキュメント発見可能性パターンを適用
2. **TSDoc互換**: TypeScriptエコシステムとの整合性確保
3. **単一責務徹底**: 各ナビゲーション要素が明確な目的を持つ
`─────────────────────────────────────────────────`
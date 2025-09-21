---
title: 'GitHub Issue管理 - プロジェクト管理完全ガイド'
description: '効率的なIssue作成・ラベル管理・マイルストーン活用の実践ガイド'
category: 'project-management'
difficulty: 'beginner'
tags: ['github-issues', 'project-management', 'labels', 'milestones', 'templates']
prerequisites: ['basic-github']
estimated_reading_time: '10分'
---

# GitHub Issue管理

> **🎯 目標**: TypeScript Minecraftプロジェクトの効率的なIssue管理システムを構築

## 🚀 Issue駆動開発ワークフロー

### **Claude Agent自動実装フロー**

```bash
# 1. Issue作成（ROADMAPから自動生成）
claude "ROADMAP Phase 0 のIssueを作成して"
# または直接実行
./scripts/create-phase-issues.sh 0

# 2. Issue実装（Claude Agent自動実行）
claude "Issue #123 を実装して"
# → GitHub Issue内の8段階実行計画を自動実行

# 3. 品質確認（GitHub Actions自動実行）
# PR作成時に自動的に品質ゲートが実行されます
```

### **AI Task Issueテンプレート**

`.github/ISSUE_TEMPLATE/ai-task.yml` を使用した構造化されたIssue作成：

- **8段階実行ステップ**
  - Step 1: 事前調査・分析
  - Step 2: ディレクトリ構造作成
  - Step 3: 型定義・データ構造
  - Step 4: Service実装
  - Step 5: ECSシステム統合
  - Step 6: テスト実装
  - Step 7: 統合・エクスポート
  - Step 8: 品質確認・最適化

- **自動実行機能**
  - Effect-TS Service/Layerパターン実装
  - Schema.Struct型定義
  - vitest テストケース（100%カバレッジ）
  - 自動エラー修正・トラブルシューティング

---

## 🎯 AI実行計画書テンプレート活用ガイド

### 📋 テンプレート活用のベストプラクティス

#### **1. ROADMAPからのIssue作成フロー**

```bash
# GitHub Issues画面でのテンプレート選択
1. GitHub Issues → New Issue
2. "AI実行計画書 - 詳細実装Issue" テンプレート選択
3. ROADMAPタスクに基づいて各フィールド入力
4. Claude Agent実行可能レベルまで詳細化
```

#### **2. 入力フィールド活用法**

```markdown
## 📋 必須入力項目の記載方法

### ROADMAPタスクID
- 形式: P{Phase}-{番号} (例: P1-012)
- トレーサビリティ確保のため必須

### 実装サイズ選択基準
- XS (30分): 設定ファイル修正、簡単なタイプ追加
- S (1-2時間): 小さなユーティリティ関数、Schema定義
- M (4-5時間): Service/Layer実装、基本機能
- L (6-8時間): システム間統合、複雑なロジック

### アーキテクチャ層選択
- Domain: ビジネスロジック、Entity、Service
- Application: ユースケース、アプリケーション層サービス
- Infrastructure: データアクセス、外部システム連携
- Presentation: UI、コントローラー
- Shared: 共通ユーティリティ、型定義

### 見積もり時間記載
- 数値のみ入力（単位: 時間）
- 実装 + テスト + 統合の総時間
- バッファ含む現実的な見積もり
```

#### **3. Acceptance Criteria定義のコツ**

```markdown
## ✅ 効果的なAcceptance Criteria

### 具体的で測定可能
❌ "ブロックシステムを実装する"
✅ "石、土、草ブロックの配置・削除・取得ができる"

### 技術要件も含める
✅ "Schema.Structでブロック型を定義済み"
✅ "vitestでカバレッジ80%以上のテスト完了"
✅ "TypeScript型エラー0件"

### 統合確認を含める
✅ "ECSシステムにBlockComponentが統合済み"
✅ "WorldServiceからブロック操作が可能"
```

#### **4. 依存関係記載のベストプラクティス**

```markdown
## 🔗 依存関係の正しい記載法

### Depends on (事前完了必須)
```
**⚠️ Depends on** (事前完了必須):
- #004 - Effect-TS基盤構築
- #006 - ECSシステム基盤
```

### Blocks (完了まで他を待機)
```
**🟠 Blocks** (このIssue完了まで待機):
- #013 - レンダリングサービス統合
- #015 - チャンクシステム実装
```

### 並列実行可能の明記
```
**🟢 Can work in parallel** (並列実行可能):
- #007 - プレイヤーシステム
- #009 - インベントリシステム
```
```

### 📊 実行時間見積もりガイド

#### **時間見積もりの参考指標**

```markdown
## ⏱️ 実装時間の目安

### Effect-TS Service/Layer実装
- 基本Service: 1-2時間
- 複雑なService: 3-4時間
- Layer統合: 0.5-1時間

### Schema定義・型実装
- 基本Schema: 0.5-1時間
- 複雑なSchema: 1-2時間
- Branded型: 0.5時間

### テスト実装
- 単体テスト: 実装時間の50%
- Property-based Testing: 実装時間の30%
- 統合テスト: 実装時間の70%

### ECS統合
- Component定義: 0.5時間
- System実装: 1-2時間
- Entity操作: 0.5-1時間
```

### 🎮 実行例とコマンド

#### **Claude Agent実行パターン**

```bash
# 基本実行（Issue単体完了）
claude "Issue #123 を実装して"

# CI確認付き実行（推奨）
claude "Issue #123 を実装してPRを作成してCIが通ることを確認して"

# 複数Issue並列実行
claude "Issue #123 と #124 を並列で実装して"

# トラブルシューティング付き実行
claude "Issue #123 を実装してエラーが出たら自動修正して"
```

#### **実行結果の期待値**

```markdown
## 🎯 Claude Agent実行後の成果物

### 1. 実装コード
- Effect-TS Service/Layerパターン完全準拠
- Schema.Struct型定義
- エラーハンドリング（TaggedError）
- 完全型安全性（any/unknown禁止）

### 2. テストコード
- 単体テスト（vitest）
- Property-based Testing（fast-check）
- カバレッジ80%以上

### 3. 統合・エクスポート
- モジュールエクスポート設定
- 上位レイヤーとの統合
- アプリケーション統合

### 4. 品質確認
- TypeScript型エラー0件
- oxlint警告0件
- CI/CDパイプライン成功
```

### ⚡ トラブルシューティング

#### **よくある問題と解決法**

```typescript
// ❌ よくあるエラー
const MyService = Context.Tag<MyServiceInterface>()  // 古いパターン

// ✅ 正しいパターン
const MyService = Context.GenericTag<MyServiceInterface>('MyService')

// ❌ Schema定義エラー
const BlockSchema = Data.struct({  // Data.struct使用禁止
  type: S.string,
})

// ✅ 正しいSchema定義
const BlockSchema = Schema.Struct({  // Schema.Struct使用
  type: Schema.String,
})

// ❌ Match.value使用エラー
Match.value(input)
  .pipe(Match.when(...))  // pipe使用は非推奨

// ✅ 正しいMatch.value使用
pipe(
  input,
  Match.value,
  Match.when(...),
  Match.orElse(...)
)
```

### 📈 成功パターンの共有

#### **実績のある実装パターン**

参考: [`docs/examples/sample-execution-plan-issue.md`](../../examples/sample-execution-plan-issue.md)

```markdown
## 🏆 成功事例: P1-012基本ブロックシステム

### 実装統計
- **見積もり時間**: 4.5時間
- **実際の実装時間**: 4.2時間
- **作成ファイル数**: 12ファイル
- **総行数**: 847行（実装 + テスト）
- **テストカバレッジ**: 87%
- **型エラー**: 0件
- **CI/CD結果**: 完全PASS

### 実装構成
1. `src/domain/block/` - Domain層実装
2. `src/shared/schemas/` - Schema定義
3. `src/application/services/` - Service層
4. `__tests__/` - テストスイート
```

## 📋 Issue分類体系

### 🏷️ **ラベル体系（完全版）**

#### **🎯 Priority（優先度）**

| ラベル               | 色           | 使用基準                           |
| -------------------- | ------------ | ---------------------------------- |
| `priority: critical` | 🔴 `#D73A49` | ブロッキング、プロジェクト進行停止 |
| `priority: high`     | 🟠 `#FB8C00` | Phase目標達成に必須                |
| `priority: medium`   | 🟡 `#FBCA04` | 重要だが少し遅延可能               |
| `priority: low`      | 🟢 `#28A745` | 改善・最適化系                     |

#### **📦 Type（タイプ）**

| ラベル                | 色           | 説明                   |
| --------------------- | ------------ | ---------------------- |
| `type: feature`       | 🔵 `#0366D6` | 新機能実装             |
| `type: bug`           | 🔴 `#D73A49` | バグ修正               |
| `type: enhancement`   | 🟣 `#A2EEEF` | 既存機能改善           |
| `type: documentation` | 📚 `#0075CA` | ドキュメント作成・更新 |
| `type: refactor`      | 🟨 `#D4C5F9` | リファクタリング       |
| `type: test`          | 🧪 `#C2E0C6` | テスト関連             |
| `type: config`        | ⚙️ `#F9D0C4` | 設定・環境構築         |

#### **🔄 Status（状態）**

| ラベル                | 色           | 意味               |
| --------------------- | ------------ | ------------------ |
| `status: ready`       | 🟢 `#28A745` | 作業開始可能       |
| `status: in-progress` | 🟡 `#FBCA04` | 作業中             |
| `status: blocked`     | 🔴 `#D73A49` | ブロックされている |
| `status: review`      | 🟣 `#6F42C1` | レビュー中         |
| `status: testing`     | 🔵 `#0366D6` | テスト中           |

#### **📊 Dependency（依存関係）**

| ラベル                 | 色           | 使用例             |
| ---------------------- | ------------ | ------------------ |
| `depends-on: #XXX`     | 🔴 `#D73A49` | `depends-on: #004` |
| `blocks: #XXX`         | 🟠 `#FB8C00` | `blocks: #010`     |
| `parallel-safe`        | 🟢 `#28A745` | 完全並列実行可能   |
| `parallel-conditional` | 🟡 `#FBCA04` | 条件付き並列可能   |

#### **🏗️ Architecture（アーキテクチャ）**

| ラベル                  | 色           | 対象                 |
| ----------------------- | ------------ | -------------------- |
| `layer: domain`         | 💎 `#E1F5FE` | ドメイン層           |
| `layer: application`    | 🔧 `#F3E5F5` | アプリケーション層   |
| `layer: infrastructure` | 🏗️ `#FFF3E0` | インフラ層           |
| `layer: presentation`   | 🎨 `#E8F5E8` | プレゼンテーション層 |

### 📂 **マイルストーン構造**

```mermaid
gantt
    title プロジェクトマイルストーン
    dateFormat X
    axisFormat Week %d

    section Phase 1
    基盤構築 :milestone, m1, 0, 0

    section Phase 2
    基本ゲームプレイ :milestone, m2, 5, 0

    section Phase 3
    システム拡張 :milestone, m3, 10, 0

    section Phase 4
    体験向上 :milestone, m4, 15, 0

    section Phase 5
    高度機能 :milestone, m5, 20, 0
```

**マイルストーン詳細**:

- **Phase 1 - Foundation**: プロジェクト基盤構築
- **Phase 2 - MVP**: 基本ゲーム機能実装
- **Phase 3 - Core**: コアシステム拡張
- **Phase 4 - Polish**: ユーザー体験向上
- **Phase 5 - Advanced**: 高度機能・最適化

---

## 📝 Issue Template集

### 🎯 **Feature Issue Template**

```markdown
---
name: 🎯 Feature Implementation
about: 新機能実装のためのIssue
title: '[FEATURE] '
labels: 'type: feature, status: ready'
assignees: ''
---

## 🎯 Feature Overview

[実装する機能の概要]

## 📋 Requirements

### 必須要件

- [ ] [要件1]
- [ ] [要件2]

### オプション要件

- [ ] [拡張機能1]

## 🔗 Dependencies

**⚠️ 事前完了必須**:

- [ ] #XXX - [依存タスク名]

**🟢 並列実行可能**:

- [ ] #YYY - [同時進行可能タスク]

## 🏗️ Architecture Impact

- **影響層**: [ ] Domain [ ] Application [ ] Infrastructure [ ] Presentation
- **新規追加**: [ファイル・クラス・関数]
- **既存修正**: [修正対象]

## ✅ Acceptance Criteria

- [ ] [具体的な完了条件1]
- [ ] [具体的な完了条件2]
- [ ] TypeScript型エラーなし
- [ ] テストカバレッジ ≥90%
- [ ] CI/CDパイプライン成功

## 📊 Estimation

- **実装**: X.Yd
- **テスト**: A.Bd
- **レビュー**: C.Dd
- **合計**: Z.Wd

## 📚 Related Documentation

- [関連仕様書]
- [参考資料]

## 🧪 Test Plan

- [ ] 単体テスト
- [ ] 統合テスト
- [ ] E2Eテスト（必要時）
```

### 🐛 **Bug Issue Template**

```markdown
---
name: 🐛 Bug Report
about: バグ報告・修正のためのIssue
title: '[BUG] '
labels: 'type: bug, priority: high'
assignees: ''
---

## 🐛 Bug Description

[バグの詳細な説明]

## 🔄 Steps to Reproduce

1. [ステップ1]
2. [ステップ2]
3. [ステップ3]

## ❌ Expected vs Actual

**期待する結果**: [正常な動作]
**実際の結果**: [現在の問題のある動作]

## 📱 Environment

- **ブラウザ**: Chrome/Firefox/Safari
- **OS**: Windows/macOS/Linux
- **Node.js**: v20.x
- **コミット**: [git commit hash]

## 📊 Impact

- **ユーザー影響**: [ ] Critical [ ] High [ ] Medium [ ] Low
- **頻度**: [ ] Always [ ] Often [ ] Sometimes [ ] Rare

## 🔍 Root Cause Analysis

[原因の調査結果]

## 🛠️ Proposed Solution

[修正案]

## ✅ Fix Verification

- [ ] バグ再現手順でテスト
- [ ] 関連機能への副作用確認
- [ ] リグレッションテスト実行
```

### ⚙️ **Configuration Issue Template**

```markdown
---
name: ⚙️ Configuration
about: 設定・環境構築のためのIssue
title: '[CONFIG] '
labels: 'type: config, parallel-safe'
assignees: ''
---

## ⚙️ Configuration Target

[設定対象：TypeScript/Vite/ESLint等]

## 📋 Configuration Items

- [ ] [設定項目1]
- [ ] [設定項目2]

## 🎯 Goals

- [設定の目的・効果]

## 📝 Files to Create/Modify

- [ ] `package.json`
- [ ] `tsconfig.json`
- [ ] [その他設定ファイル]

## ✅ Verification Steps

- [ ] 設定ファイル構文チェック
- [ ] ツール動作確認
- [ ] CI/CDでの動作確認

## 🔗 Dependencies

**⚠️ 並列実行安全性**: 🟢 他タスクと衝突なし
```

---

## 🎯 Issue作成ワークフロー

### 📅 **Phase開始前準備**

```mermaid
graph LR
    A[Phase計画確定] --> B[Issue一括作成]
    B --> C[依存関係設定]
    C --> D[ラベル付与]
    D --> E[担当者仮割当]
    E --> F[マイルストーン設定]
    F --> G[並列作業準備完了]
```

### 🔄 **日次Issue管理**

```bash
# Morning Standup前
1. blocked Issueの確認・解決
2. ready Issueの選択
3. 並列作業可能性チェック

# 作業中
4. status更新（ready→in-progress→review）
5. ブロッカー発見時のissue comment

# Evening Wrap-up
6. 進捗報告
7. 翌日ready Issueの準備
8. 依存関係更新
```

---

## 📊 Issue管理の自動化

### 🤖 **GitHub Actions統合**

```yaml
# .github/workflows/issue-management.yml
name: Issue Management

on:
  issues:
    types: [opened, closed, labeled]
  pull_request:
    types: [opened, closed, merged]

jobs:
  update-dependencies:
    runs-on: ubuntu-latest
    steps:
      - name: Update dependent issues
        uses: actions/github-script@v7
        with:
          script: |
            // PR merged時に依存Issueを"ready"に更新
            if (context.eventName === 'pull_request' && context.payload.action === 'closed' && context.payload.pull_request.merged) {
              // 依存関係を持つIssueを検索・更新
            }
```

### 📋 **Project Board自動化**

```mermaid
graph LR
    A[Issue作成] --> B[Ready Column]
    C[In Progress Label] --> D[In Progress Column]
    E[PR作成] --> F[Review Column]
    G[PR Merged] --> H[Done Column]
    I[Issue Closed] --> J[Archive]
```

---

## 📈 進捗トラッキング

### 📊 **KPI指標**

```markdown
## 日次メトリクス

- **新規Issue**: X件
- **完了Issue**: Y件
- **ブロック解決**: Z件
- **並列作業率**: A%

## 週次メトリクス

- **Phase進捗**: X%
- **ベロシティ**: Y pt/week
- **バーンダウン**: 予定通り/遅延
- **品質指標**: CI成功率Z%
```

### 🎯 **マイルストーン進捗**

```mermaid
pie title Phase 1 進捗
    "完了" : 45
    "進行中" : 30
    "待機中" : 15
    "未着手" : 10
```

---

## 🔗 Issue間リンク管理

### 🔄 **関係性の種類**

| 関係         | 表記                | 意味               | 例                  |
| ------------ | ------------------- | ------------------ | ------------------- |
| **依存**     | `depends on #XXX`   | 事前完了必須       | `depends on #004`   |
| **ブロック** | `blocks #XXX`       | 完了まで他を止める | `blocks #010`       |
| **関連**     | `related to #XXX`   | 関連性あり         | `related to #007`   |
| **重複**     | `duplicate of #XXX` | 重複Issue          | `duplicate of #003` |
| **親子**     | `parent of #XXX`    | Epic関係           | `parent of #015`    |

### 📋 **Issue Cross-Reference Template**

```markdown
## 🔗 Issue Relationships

**🔴 Depends on** (事前完了必須):

- #004 - Effect-TS導入
- #006 - 品質ツール設定

**🟠 Blocks** (このIssue完了まで待機):

- #012 - 基本ブロックエンティティ
- #013 - レンダリングサービス

**🔵 Related** (関連Issue):

- #008 - ECS基盤実装
- #011 - 基本テストセットアップ

**🟢 Can work in parallel** (並列実行可能):

- #001 - Package.json作成
- #002 - TypeScript設定
- #003 - Vite設定
```

---

## 🚀 効率化のベストプラクティス

### ✅ **Issue作成時のチェックリスト**

- [ ] 明確で具体的なタイトル
- [ ] 詳細な説明と背景
- [ ] 適切なラベル付与
- [ ] 依存関係の明記
- [ ] 見積もり時間の記載
- [ ] Acceptance Criteriaの定義
- [ ] 担当者・マイルストーン設定

### 🎯 **Issue完了時のチェックリスト**

- [ ] Acceptance Criteria全て満足
- [ ] 関連ドキュメント更新
- [ ] テスト実行・品質確認
- [ ] 依存Issue Ready状態更新
- [ ] ナレッジ共有・引き継ぎ

---

## 🔗 関連ドキュメント

- **[並列開発ワークフロー](./10-parallel-development-workflow.md)** - 効率的な並列作業戦略
- **[ROADMAP](../ROADMAP.md)** - 全Issue詳細とタイムライン
- **[開発規約](./00-development-conventions.md)** - コード品質基準

---

**📋 Ready for Systematic Issue Management! Let's Track Every Progress!**

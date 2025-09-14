# Task Decomposer - タスク自動分解

## 目的
ROADMAPから実行可能な最小単位のタスクに自動分解

## 分解ルール

### タスクサイズ
```yaml
XS: # 1-2時間
  - 単一ファイル作成
  - 型定義
  - 設定ファイル

S: # 2-4時間
  - サービス実装
  - テスト作成
  - 単一機能

M: # 4-8時間
  - 複数サービス連携
  - 統合テスト
  - ドキュメント含む

L: # 禁止 - さらに分解
```

### 分解パターン

#### サービス実装タスク
```
GameLoopService実装
├── GameLoopService インターフェース定義 (XS)
├── GameLoopServiceLive 実装 (S)
├── GameLoopService 単体テスト (S)
├── GameLoopService PBTテスト (S)
└── GameLoopService ドキュメント (XS)
```

#### システム実装タスク
```
Rendering System実装
├── Three.js Layer作成 (S)
├── Renderer Service実装 (M)
├── Camera System実装 (S)
├── Mesh Generator実装 (S)
├── 統合テスト (S)
└── パフォーマンステスト (S)
```

## 自動分解スクリプト

```typescript
export const decomposeTask = (task: RoadmapTask): Issue[] => {
  return Match.value(task.type).pipe(
    Match.when("service", () => [
      createIssue(`${task.name} インターフェース定義`, "XS"),
      createIssue(`${task.name}Live 実装`, "S"),
      createIssue(`${task.name} 単体テスト`, "S"),
      createIssue(`${task.name} PBTテスト`, "S"),
      createIssue(`${task.name} ドキュメント`, "XS")
    ]),
    Match.when("system", () => [
      ...task.components.map(c => createIssue(`${c} 実装`, "S")),
      createIssue(`${task.name} 統合テスト`, "S"),
      createIssue(`${task.name} パフォーマンステスト`, "S")
    ]),
    Match.when("feature", () => [
      createIssue(`${task.name} ドメインロジック`, "S"),
      createIssue(`${task.name} UI実装`, "S"),
      createIssue(`${task.name} テスト`, "S")
    ]),
    Match.exhaustive
  )
}
```

## Issue生成ルール

### 命名規則
```
[Phase]-[Number]: [Component] [Action]

例:
P0-001: GameLoopService インターフェース定義
P0-002: GameLoopService 実装
P1-010: ChunkSystem メモリ管理実装
```

### 依存関係
```yaml
sequential: # 順次実行
  - インターフェース定義
  - 実装
  - テスト

parallel: # 並行可能
  - 各サービス実装
  - ドキュメント作成
  - パフォーマンステスト
```

## 実行コマンド

```bash
# ROADMAPからタスク分解
claude "ROADMAPのPhase 0をタスク分解して"

# 特定機能の分解
claude "Game Loop Systemを実装可能なタスクに分解"

# Sprint分のタスク生成
claude "Sprint 1用に20個のタスクを生成"
```
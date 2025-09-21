# TypeScript Minecraft Clone - コントリビューションガイド

## 🤝 コントリビューションへようこそ

TypeScript Minecraft Cloneプロジェクトへの貢献に興味を持っていただき、ありがとうございます。このドキュメントでは、プロジェクトへの貢献方法とガイドラインを説明します。

## 📋 目次

- [開発環境のセットアップ](#開発環境のセットアップ)
- [開発ワークフロー](#開発ワークフロー)
- [コードスタイルガイド](#コードスタイルガイド)
- [コミットメッセージ規約](#コミットメッセージ規約)
- [プルリクエストのプロセス](#プルリクエストのプロセス)
- [Issue駆動開発](#issue駆動開発)
- [テスト方針](#テスト方針)
- [ドキュメント更新](#ドキュメント更新)

## 🚀 開発環境のセットアップ

### 必要要件

- Node.js 22.x (`.nvmrc`で指定)
- pnpm 9.15+
- TypeScript 5.9+
- Git

### セットアップ手順

```bash
# リポジトリをクローン
git clone https://github.com/takeokunn/ts-minecraft.git
cd ts-minecraft

# Node.jsバージョンの設定
nvm use

# 依存関係のインストール
pnpm install

# 開発サーバーの起動
pnpm dev

# ビルドの実行
pnpm build

# テストの実行
pnpm test

# 型チェック
pnpm typecheck

# 総合的なコード品質チェック
pnpm check
```

## 🔄 開発ワークフロー

### Issue駆動開発

すべての開発作業はGitHub Issueから開始します：

1. **Issue選択または作成**
   - 既存のIssueから作業を選択
   - 新機能の場合は新規Issue作成
   - IssueにはROADMAP.mdのタスク番号を記載

2. **ブランチ作成**

   ```bash
   # Issue番号を含むブランチ名
   git checkout -b feat/issue-123-player-movement
   git checkout -b fix/issue-124-chunk-rendering
   ```

3. **実装とテスト**
   - Effect-TSパターンに従った実装
   - テストカバレッジ80%以上を維持
   - 型安全性の確保

4. **プルリクエスト作成**
   - Issue番号を含むPRタイトル
   - 実装内容の詳細説明
   - テスト結果の記載

### Claude Agent活用

プロジェクトはAI Agent駆動開発を前提としています：

```bash
# Issueの自動実装
claude "Issue #123 を実装して"

# ROADMAPからIssue作成
claude "ROADMAP Phase 0 のIssueを作成して"

# PR作成
claude "現在の変更でPRを作成して"
```

## 💻 コードスタイルガイド

### TypeScript規約

#### 必須規約

```typescript
// ✅ 良い例: Effect-TSパターン
import { Effect, Context, Layer, Schema } from 'effect'

// Service定義
export interface PlayerService {
  readonly move: (delta: Vector3) => Effect.Effect<void, MovementError>
  readonly jump: () => Effect.Effect<void, JumpError>
}

// Context.GenericTag使用
export const PlayerService = Context.GenericTag<PlayerService>('PlayerService')

// Schema.Struct使用
export const PlayerState = Schema.Struct({
  position: Vector3Schema,
  velocity: Vector3Schema,
  health: Schema.Number.pipe(Schema.between(0, 100)),
})
```

#### 禁止事項

```typescript
// ❌ 悪い例: クラス使用禁止
class Player {
  constructor() {} // クラス禁止
}

// ❌ 悪い例: throw文禁止
function move() {
  throw new Error('error') // throwは禁止、Effect.fail使用
}

// ❌ 悪い例: async/await禁止
async function loadWorld() {
  // async/await禁止、Effect使用
  await fetchData()
}
```

### ディレクトリ構造

```
src/
├── domain/           # DDD - ビジネスロジック
│   ├── player/      # プレイヤードメイン
│   ├── world/       # ワールドドメイン
│   └── inventory/   # インベントリドメイン
├── application/      # ユースケース層
│   └── use-cases/   # ユースケース実装
├── infrastructure/   # 技術実装層
│   ├── renderer/    # Three.js実装
│   └── storage/     # ストレージ実装
├── presentation/     # UI層
│   └── components/  # UIコンポーネント
└── shared/          # 共通モジュール
    ├── services/    # 共通サービス
    └── types/       # 共通型定義
```

### 命名規則

- **ファイル名**: PascalCase (`PlayerService.ts`, `WorldGenerator.ts`)
- **サービス**: `XxxService` (`PlayerService`, `ChunkService`)
- **エラー**: `XxxError` (`MovementError`, `RenderError`)
- **スキーマ**: `XxxSchema` (`PlayerStateSchema`, `BlockSchema`)
- **型**: `Xxx` (`Player`, `Block`, `Chunk`)

## 📝 コミットメッセージ規約

### フォーマット

```
<type>(<scope>): <subject> (#issue-number)

<body>

<footer>
```

### タイプ

- `feat`: 新機能追加
- `fix`: バグ修正
- `docs`: ドキュメント更新
- `style`: フォーマット変更
- `refactor`: リファクタリング
- `test`: テスト追加・修正
- `chore`: ビルド・ツール変更
- `perf`: パフォーマンス改善

### 例

```bash
feat(player): implement player movement system (#123)

- Add PlayerService with move and jump methods
- Implement collision detection
- Add movement validation with Effect-TS

Closes #123
```

## 🔀 プルリクエストのプロセス

### PRテンプレート

```markdown
## 概要

Issue #xxx の実装

## 変更内容

- [ ] PlayerServiceの実装
- [ ] テストの追加
- [ ] ドキュメントの更新

## テスト結果

- カバレッジ: 85%
- 全テスト合格

## スクリーンショット

（該当する場合）

## チェックリスト

- [ ] 型チェック合格
- [ ] Lint合格
- [ ] テスト合格
- [ ] ビルド成功
- [ ] ドキュメント更新
```

### レビュー基準

1. **コード品質**
   - Effect-TSパターン遵守
   - 型安全性の確保
   - エラーハンドリング適切性

2. **テスト**
   - カバレッジ80%以上
   - 単体テスト・統合テスト実装

3. **パフォーマンス**
   - 60FPS維持
   - メモリ効率性

## 🧪 テスト方針

### テスト種別

1. **単体テスト**

   ```typescript
   import { describe, it, expect } from 'vitest'
   import { Effect, TestClock } from 'effect'

   describe('PlayerService', () => {
     it('should move player correctly', () => {
       const result = Effect.runSync(PlayerService.move({ x: 1, y: 0, z: 0 }))
       expect(result).toBeDefined()
     })
   })
   ```

2. **統合テスト**
   - Service間の連携テスト
   - レンダリングパイプラインテスト

3. **E2Eテスト**
   - ゲームプレイシナリオテスト
   - パフォーマンステスト

### カバレッジ目標

- 全体: 80%以上
- Core機能: 90%以上
- Service層: 85%以上

## 📖 ドキュメント更新

### 更新が必要なドキュメント

1. **技術ドキュメント** (`docs/`)
   - API変更時: `docs/reference/api/`
   - 新機能追加時: `docs/how-to/`
   - アーキテクチャ変更時: `docs/explanations/`

2. **コード内ドキュメント**
   - JSDocコメント（複雑なロジックのみ）
   - 型定義の説明

3. **README更新**
   - 新機能の追加
   - セットアップ手順の変更

### ドキュメント規約

- 日本語での記述を基本とする
- 技術用語は英語のまま使用
- コード例を豊富に含める
- Diátaxisフレームワークに従う

## 🎯 品質基準

### 必須要件

- ✅ TypeScript strict mode合格
- ✅ ESLint/Prettier合格
- ✅ テストカバレッジ80%以上
- ✅ ビルド成功
- ✅ 60FPS動作維持
- ✅ メモリリーク無し

### 推奨事項

- 📊 パフォーマンスプロファイリング実施
- 🔍 コードレビューフィードバック反映
- 📝 詳細なコミットメッセージ
- 🎨 UIの一貫性維持

## 🤔 質問とサポート

### 質問がある場合

1. **GitHub Discussions**でディスカッション開始
2. **Issue**で技術的な質問
3. **Discord**コミュニティ（準備中）

### 貢献者向けリソース

- [プロジェクトドキュメント](./docs/README.md)
- [Effect-TSドキュメント](https://effect.website)
- [Three.jsドキュメント](https://threejs.org/docs/)
- [TypeScriptハンドブック](https://www.typescriptlang.org/docs/)

## 🏆 コントリビューター

貢献いただいたすべての方に感謝します！

<!-- ALL-CONTRIBUTORS-LIST:START -->
<!-- ALL-CONTRIBUTORS-LIST:END -->

## 📄 ライセンス

このプロジェクトはMITライセンスの下で公開されています。詳細は[LICENSE](./LICENSE)ファイルをご確認ください。

---

**ご質問やご提案がある場合は、お気軽にIssueを作成してください。皆様の貢献をお待ちしています！** 🎮✨

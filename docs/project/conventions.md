# 規約 (Conventions)

このドキュメントでは、ts-minecraftプロジェクトにおける開発を円滑に進めるための各種規約を定めます。

## 1. コーディングスタイル

コードの品質と一貫性を保つため、以下のツールとルールセットを強制します。コミット前に、必ずフォーマットとリンティングを実行してください。

```bash
# コード全体のフォーマット
pnpm format
# コード全体の静的解析
pnpm lint
```

- **エディタ設定:** `.editorconfig`
  - プロジェクト共通のインデントスタイル（スペース2）、文字コード（UTF-8）、改行コード（LF）などを定義しています。エディタがこのファイルを自動的に読み込むことで、基本的なスタイルを統一します。

- **フォーマッタ:** [Biome](https://biomejs.dev/)
  - 設定ファイル: `biome.json`
  - `pnpm format` で実行されます。コードの見た目に関するあらゆる議論をなくし、統一されたスタイルを自動的に適用します。Prettierも `.prettierrc` として設定が残っていますが、Biomeが主要なフォーマッタです。

- **リンター:** [Oxlint](https://oxc-project.github.io/docs/linter/introduction.html)
  - 設定: `package.json` 内の `scripts.lint` コマンドで実行
  - `pnpm lint` で実行されます。パフォーマンスに優れたリンターであり、コードの潜在的なバグやアンチパターンを検出します。

- **TypeScript:**
  - 設定ファイル: `tsconfig.json`
  - `"strict": true` を基本とし、厳格な型チェックを強制します。これにより、多くの一般的なエラーをコンパイル時に検出できます。

## 2. Git / GitHub 運用ルール

### ブランチ戦略

- **`main`**: 常に安定し、リリース可能な状態を保ちます。直接のコミットは禁止し、Pull Request経由でのみマージを許可します。
- **featureブランチ**: 新機能の開発やバグ修正は、必ず`main`からブランチを作成して行います。
  - ブランチ名の命名規則: `feature/機能名` or `fix/問題名` (例: `feature/add-inventory`, `fix/player-collision-bug`)

### コミットメッセージ

コミットメッセージは、[Conventional Commits](https://www.conventionalcommits.org/) の規約に従います。これにより、変更履歴の可読性が向上し、CHANGELOGの自動生成も可能になります。

- **フォーマット:** `<type>(<scope>): <subject>`
  - **type**:
    - `feat`: 新機能の追加
    - `fix`: バグ修正
    - `docs`: ドキュメントの変更
    - `style`: コードスタイルの変更（フォーマット、セミコロんなど）
    - `refactor`: リファクタリング
    - `test`: テストの追加・修正
    - `chore`: ビルドプロセスや補助ツールの変更
  - **scope** (任意): 変更の範囲 (例: `player`, `world`, `rendering`)
  - **subject**: 変更内容を簡潔に記述

- **例:**
  - `feat(world): add desert biome`
  - `fix(player): prevent falling through blocks`
  - `docs(architecture): update directory structure diagram`

### Pull Request (PR)

- `main`ブランチへのマージは、必ずPull Requestを作成し、レビューを経てから行います。
- PRのテンプレートに従い、変更の概要、目的、テスト内容を明確に記述してください。
- CI（継続的インテグレーション）のチェックがすべてパスしていることがマージの必須条件です。

## 3. ディレクトリとファイル命名規則

プロジェクト内での命名は、一貫性を保つために以下の規則に従います。

- **ディレクトリ**: `kebab-case` (例: `chunk-loading`)
- **ファイル**: `kebab-case` (例: `render-context.ts`, `player.test.ts`)
- **クラス/TypeScriptの型**: `PascalCase` (例: `PlayerState`, `RenderService`, `Position`)
- **関数/変数**: `camelCase` (例: `calculatePhysics`, `playerPosition`)
- **定数**: `camelCase` または `UPPER_SNAKE_CASE`。ローカルな定数は `camelCase` を優先し、グローバルな設定値やマジックナンバーの定義には `UPPER_SNAKE_CASE` を使用します (例: `CHUNK_SIZE`)。
- **コンポーネント (ECS)**: `PascalCase` で定義します (例: `Position`, `Velocity`)。これは `Schema.Class` を用いてクラスとして定義されているためです。
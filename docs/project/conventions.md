# プロジェクト規約 (Project Conventions)

このドキュメントでは、プロジェクト全体で一貫性、可読性、保守性を維持するために遵守すべきコーディングスタイル、規約、設計パターンについて詳述します。

---

## 1. コードフォーマット & 静的解析

コードの品質とスタイルは、**BiomeJS** と **Oxlint** によって自動的に維持されます。コミット前には、必ず以下のコマンドを実行してください。

```bash
# BiomeJSによる自動フォーマット
npm run format

# Oxlintによる静的解析と自動修正
npm run lint
```

### フォーマッタ: BiomeJS

-   設定ファイル: `biome.json`
-   主なルール:
    -   インデント: スペース2つ (`"indentStyle": "space", "indentWidth": 2`)
    -   引用符: シングルクォート (`"quoteStyle": "single"`)
    -   末尾のカンマ: 常に付与 (`"trailingCommas": "all"`)

### 静的解析: Oxlint

-   設定: `package.json` の `lint` スクリプトで実行
-   役割: パフォーマンスが高く、潜在的なバグやコードの臭いを検出します。設定は最小限に抑え、コミュニティのベストプラクティスに従います。

---

## 2. 命名規則

| 対象 | 規則 | 例 |
| :--- | :--- | :--- |
| **ファイル** | `kebab-case` | `block-interaction.ts`, `player-movement.ts` |
| **変数・関数** | `camelCase` | `playerMovementSystem`, `calculateVelocity` |
| **クラス・型・インターフェース** | `PascalCase` | `Position`, `EntityId`, `RenderService` |
| **定数** | `UPPER_SNAKE_CASE` | `MAX_CHUNK_HEIGHT`, `PLAYER_SPEED` |

---

## 3. TypeScriptの厳格なルール

本プロジェクトでは、コードの堅牢性を最大限に高めるため、`tsconfig.json` でTypeScriptの最も厳格な設定を有効にしています。

```json
"strict": true,
"noUnusedLocals": true,
"noUnusedParameters": true,
"noImplicitReturns": true,
"noFallthroughCasesInSwitch": true,
"noUncheckedIndexedAccess": true,
"forceConsistentCasingInFileNames": true
```

これらの設定は、`null` や `undefined` の意図しない使用、未使用変数、暗黙的な型変換といった、多くの一般的なバグをコンパイル時に検出することを目的としています。

---

## 4. アーキテクチャ原則

プロジェクトは、**Effect-TS** を全面的に採用した **Entity Component System (ECS)** アーキテクチャに基づいています。

### コンポーネントは純粋なデータである

`domain/components.ts` で定義されるコンポーネントは、`@effect/schema` を用いた純粋なデータコンテナでなければなりません。ロジックやメソッドを含むことは固く禁じられています。これはデータ指向設計の核心的な原則です。

### システムは単一責任を持つ

`systems/` ディレクトリ内の各システムは、明確に定義された単一の責務を持つべきです。システムの役割は、`World` からコンポーnentを読み取り、計算を行い、結果をコンポーネントに書き戻すことだけです。

例えば、かつての巨大な `playerControlSystem` は、以下の3つの独立したシステムにリファクタリングされました。
-   `inputPollingSystem`: ユーザー入力をポーリングし、`InputState` コンポーネントを更新する。
-   `cameraControlSystem`: マウスの動きを検知し、`CameraState` コンポーネントを更新する。
-   `playerMovementSystem`: `InputState` と `CameraState` に基づいてプレイヤーの `Velocity` を計算する。

この分割により、各システムの理解、テスト、再利用が容易になります。

### クエリAPIは適切に選択する

`World` サービスは2種類のクエリAPIを提供しており、用途に応じて使い分ける必要があります。

-   **`world.query()`**:
    -   **用途**: 結果を `Map<EntityId, Components>` 形式で返し、柔軟なデータアクセスが必要な場合に適しています。デバッグや、エンティティ数が少ないことが保証されているシステムでの使用が推奨されます。
    -   **注意**: このAPIはクエリのたびに新しいコンポーネントオブジェクトを生成するため、パフォーマンスが重要なシステムでの使用は避けるべきです。

-   **`world.querySoA()`**:
    -   **用途**: パフォーマンスが最優先されるシステム（例: `physics`, `collision`, `scene`）で使用します。結果をStructure of Arrays (SoA) 形式で直接返し、メモリアロケーションを最小限に抑えます。
    -   **規約**: ゲームループ内で毎フレーム多数のエンティティを処理するシステムは、**原則として `querySoA` を使用しなければなりません。**

### エンティティ生成にはArchetype（原型）を使用する

一貫性を保ち、ヒューマンエラーを避けるため、すべてのエンティティは `domain/archetypes.ts` で定義されたファクトリ関数（Archetype/Prefab）を通じて生成されるべきです。

システム内で `world.createEntity().with(...)` のように手動でコンポーネントを組み立てるのではなく、`createPlayer(position)` や `createBlock(position, type)` のような関数を使用してください。これにより、エンティティの構成がカプセル化され、管理と変更が容易になります。

### 依存性の注入 (DI) とサービス

`World`、`Input`、`Renderer`、`RaycastService` といった依存関係は、すべてEffectの `Context` と `Layer` によって管理されます。システムは、自身の `Effect` シグネチャで必要なサービスを宣言的に要求します。これにより、疎結合と高いテスト容易性が実現されます。

---

## 5. コミットメッセージ

本プロジェクトは、明確で追跡しやすいコミット履歴を維持するため、[**Conventional Commits**](https://www.conventionalcommits.org/) 仕様に厳密に従います。

-   **`feat`**: 新機能の追加
-   **`fix`**: バグ修正
-   **`docs`**: ドキュメントの変更
-   **`style`**: コードスタイルに関する変更（フォーマット、セミコロンなど）
-   **`refactor`**: パフォーマンスや保守性に影響しないコードのリファクタリング
-   **`test`**: テストの追加・修正
-   **`chore`**: ビルドプロセスや補助ツールの変更

すべてのコミットメッセージは、この規約に準拠している必要があります。

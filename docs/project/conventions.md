# プロジェクト規約 (Project Conventions)

このドキュメントでは、プロジェクト全体で一貫性、可読性、保守性を維持するために遵守すべきコーディングスタイル、規約、設計パターンについて詳述します。

---

## 1. コードフォーマット & 静的解析

コードの品質とスタイルは、**BiomeJS** によって自動的に維持されます。コミット前には、必ず以下のコマンドを実行してください。

```bash
# BiomeJSによる自動フォーマット・静的解析・自動修正
npm run format
npm run lint
```

### フォーマッタ & リンター: BiomeJS

-   設定ファイル: `biome.json`
-   主なルール:
    -   インデント: スペース2つ (`"indentStyle": "space", "indentWidth": 2`)
    -   引用符: シングルクォート (`"quoteStyle": "single"`)
    -   末尾のカンマ: 常に付与 (`"trailingCommas": "all"`)
-   役割: Biomeはフォーマッタとリンターの機能を兼ね備えており、コードスタイルを統一し、潜在的なバグやコードの臭いを検出します。

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

### クエリAPIは `queryEntities` を原則とする

`World` サービスからエンティティを取得する際のAPIは、パフォーマンス上の理由から `world.queryEntities()` に一本化されています。

-   **`world.queryEntities()`**:
    -   **用途**: パフォーマンスが最優先されるシステム（例: `physics`, `collision`, `scene`）だけでなく、**プロジェクト内のすべてのシステム**で使用します。
    -   **規約**: ゲームループ内でエンティティを処理するシステムは、**必ず `queryEntities` を使用しなければなりません。**

### コンポーネントストアへの直接アクセス

パフォーマンスを最大化するため、システムは `queryEntities` で取得したエンティティIDを使い、`world.getComponentStore(Component)` で取得したSoA(Structure of Arrays)ストアに直接アクセスしてデータを読み書きします。

```typescript
// src/systems/physics.ts
const entities = yield* _(queryEntities(physicsQuery));
const positions = yield* _(getComponentStore(Position));
const velocities = yield* _(getComponentStore(Velocity));

for (const id of entities) {
  positions.y[id] += velocities.dy[id];
}
```
このアプローチは、中間オブジェクトの生成を完全に排除し、GC（ガベージコレクション）の負荷を最小限に抑えます。

### クエリは `domain/queries.ts` で共通化する

システムの可読性と保守性を高めるため、`world.queryEntities` に渡すクエリオブジェクトは `src/domain/queries.ts` で一元管理します。

```typescript
// src/domain/queries.ts
export const movableQuery = { all: [Position, Velocity], not: [Frozen] };

// src/systems/physics.ts
import { movableQuery } from '../domain/queries';
const entities = yield* queryEntities(movableQuery);
```

これにより、どのようなデータにアクセスするかの関心が分離され、システムは純粋なロジックに集中できます。

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

---

## 6. 継続的インテグレーション (CI)

品質を維持するため、すべてのプルリクエストと `main` 以外のブランチへのプッシュに対して、CIパイプラインが自動的に実行されます。

-   **設定ファイル**: `.github/workflows/ci.yml`
-   **実行トリガー**:
    -   `main` 以外のブランチへのプッシュ
    -   `workflow_call`による外部からの呼び出し
-   **チェック項目**:
    1.  **依存関係のインストール**: `pnpm i`
    2.  **静的解析**: `pnpm lint`
    3.  **型チェック**: `pnpm exec tsc`
    4.  **単体テスト**: `pnpm test` (Vitest)

すべてのチェックが成功しなければ、プルリクエストをマージすることはできません。これにより、`main` ブランチの健全性が常に保たれます。

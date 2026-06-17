# ts-minecraft 実装完成プロンプト（Codex /goal 用）

## 目標

`docs/reference/feature-verification-matrix.md` に記載された全チェック項目を参照し、
ts-minecraft を **vanilla Minecraft Java Edition 1.21 の完成したブラウザゲーム** として実装完成させる。

---

## リポジトリの概要（必ず先に把握すること）

- **言語/FW**: TypeScript + Effect-TS + Three.js + Vite
- **構造**: 11 パッケージの DDD モノレポ（`packages/*`）。各パッケージに `domain/`, `application/`, `infrastructure/`, `presentation/` 層
- **テスト**: `pnpm vitest run`（現在 5000+ テスト）
- **型検査**: `pnpm typecheck`（0 エラー必須）
- **Lint**: `pnpm lint`（oxlint 0 警告 0 エラー必須）
- **ビルド**: `pnpm build`（vite build 成功必須）
- **開発サーバー**: `pnpm dev`（http://localhost:5173/）
- **QA API**: ブラウザの `window.__TS_MINECRAFT_QA__` でゲーム状態を自動テスト可能

### 必読ファイル（実装前に読む）

```
docs/reference/feature-verification-matrix.md   # 全チェック項目（343 エントリ）
packages/core/domain/block-type.ts              # ブロック型定義
packages/core/domain/item-type.ts               # アイテム型定義
packages/entity/domain/mob/entity.ts            # モブ型定義
packages/app/application/frame-handler.config.ts # キーバインド定数
packages/game/application/settings-service.ts   # 設定スキーマ
```

---

## 実装方針

### フェーズ 0: 現状把握（最初に必ず実行）

1. `docs/reference/feature-verification-matrix.md` を全文読む
2. GAP（未実装）エントリと CONFIRMED（実装済み）エントリを分類する
3. `pnpm vitest run && pnpm typecheck && pnpm build` で現在の通過状態を確認する
4. `pnpm dev` でサーバーを起動し Playwright MCP でブラウザを開いて動作確認する

### フェーズ 1: 優先度付けとトリアージ

GAP エントリを以下の基準で優先順位付けする：

| 優先度 | 基準 | 例 |
|--------|------|-----|
| **P0** | コアサバイバルループに直結 | 難易度設定・窒息・虚空ダメージ・草伝播 |
| **P1** | ゲームプレイ体験を大きく損なう | チェスト不在・CHEST ブロック実装・ハシゴ・ドア |
| **P2** | コンテンツ充実（ブロック/モブ追加） | 花・サボテン・スライム・コウモリ |
| **P3** | UI/UX 改善 | ツールチップ・レシピブック・足音 |
| **P4** | 新バージョンコンテンツ（1.17+） | ネザライト・銅・新規モブ |

### フェーズ 2: 実装サイクル（1 機能ずつ繰り返す）

各 GAP エントリに対して以下のサイクルを実行する：

```
1. エントリを読む（file:line 参照先を確認）
2. 影響範囲を調査する（grep/read で依存関係を把握）
3. DDD 層に従って実装する
   - domain/: 純粋ドメインロジック（副作用なし）
   - application/: Effect-TS サービス
   - infrastructure/: 外部 IO（Three.js/IndexedDB 等）
   - presentation/: DOM/Three.js 描画
4. テストを書く（vitest）
5. pnpm typecheck で型チェック
6. pnpm lint で lint
7. Playwright MCP でブラウザ動作確認
8. コミット
```

### フェーズ 3: マトリクス未記載の問題への対応

Playwright でゲームを実際にプレイし、マトリクスに載っていないバグや欠落を発見した場合：

1. **必ず修正する**（マトリクスに依存しない）
2. 発見した問題を `docs/reference/feature-verification-matrix.md` の §12 テーブルに追記する（番号を続番で付ける）
3. 修正をコミットする

---

## Effect-TS コーディング規約（違反禁止）

```typescript
// ✅ 正しい: Effect.gen でサービスを合成
Effect.gen(function* () {
  const service = yield* SomeService
  return yield* service.doSomething()
})

// ✅ 正しい: Layer 合成順序（consumer が先）
MyServiceLive.pipe(Layer.provideMerge(DependencyLive))

// ✅ 正しい: ブランド型コンストラクタ使用
DeltaTimeSecs.make(0.016)
WorldId.make('world-1')

// ❌ 禁止: Effect.map を pipe 内でネスト
pipe(effect, Effect.map(x => Effect.map(y => ...)))  // flatMap を使う

// ❌ 禁止: 新しい抽象を不必要に追加しない
// 3 行が似ていても早期に抽象化しない
```

---

## Playwright MCP でのゲーム自動テスト手順

```javascript
// 開発サーバー起動後に使用する QA API パターン

// 1. ゲームを開く（?world= でメインメニューをスキップ）
await browser_navigate({ url: 'http://localhost:5173/?world=test-world-id' })

// 2. ゲーム状態を取得
await browser_evaluate({ script: 'JSON.stringify(window.__TS_MINECRAFT_QA__.getPlayerState())' })

// 3. キーイベントを送信
await browser_press_key({ key: 'KeyW' })  // 前進

// 4. マウスクリック（ブロック破壊/設置）
await browser_evaluate({ script: 'window.__TS_MINECRAFT_QA__.dispatchMouseClick(0)' })  // 左クリック

// 5. ブロック状態確認
await browser_evaluate({ script: `
  JSON.stringify(window.__TS_MINECRAFT_QA__.getBlockAt({x:0,y:64,z:0}))
` })

// 6. スクリーンショットで視覚確認
await browser_take_screenshot()
```

---

## 実装時の注意事項

### ブロックを追加するとき

`block-type.ts` に追加した場合、以下を **必ず** 更新する：
- `packages/rendering/infrastructure/textures/block-texture-map.config.ts`（テクスチャアトラスインデックス）
- `packages/world/application/block-service.config.ts`（ドロップ・採掘設定）
- `packages/block/domain/blocks.config.*.ts`（ハードネス・不透明度）

### アイテムを追加するとき

`item-type.ts` に追加した場合、以下を **必ず** 更新する：
- `packages/rendering/infrastructure/textures/item-texture-map.config.ts`（`Record<InventoryItem, number>` — 網羅チェックあり）
- `packages/world/application/block-service.config.ts`（NON_PLACEABLE_ITEM_TYPES に食料/道具を追加）

### モブを追加するとき

`entity.ts` の EntityType に追加した場合：
- `packages/entity/domain/mob/mobs/` に個別ファイルを作成
- `packages/entity/domain/mob/mobs/index.ts` に登録
- `packages/entity/domain/mob/spawner-config.ts` にスポーン設定追加

### テストでの注意

- `it.effect` + `Effect.fork` + `Deferred.await` の組み合わせはデッドロックする → `it` + `Effect.runPromise` を使う
- モックが新しいインターフェースメソッドを欠いていると vitest は通るが `pnpm typecheck` で TS2741 エラー → **必ず typecheck も実行**

---

## マトリクスの読み方

`docs/reference/feature-verification-matrix.md` §12 テーブルの各行：

```
| N | 説明 | 詳細 | source file:line |
```

- **説明が「〜なし」「〜未実装」「非公式」**: GAP → 実装が必要
- **説明が「〜が公式準拠」「〜が実装済み」**: CONFIRMED → 壊さないように注意

---

## 完了基準

以下をすべて満たした状態が「完成」：

1. `pnpm vitest run` — 全テスト PASS
2. `pnpm typecheck` — 0 エラー
3. `pnpm lint` — 0 警告 0 エラー
4. `pnpm build` — exit 0
5. Playwright でサバイバルモードのゲームループが動作する：
   - スポーン → 移動 → ブロック採掘 → インベントリ確認 → クラフト → ダメージ → 死亡 → リスポーン
6. `docs/reference/feature-verification-matrix.md` の P0/P1 GAP が全て修正済み

---

## 開始コマンド

```bash
# 依存インストール
pnpm install

# 現状確認
pnpm vitest run 2>&1 | tail -5
pnpm typecheck 2>&1 | tail -5

# 開発サーバー起動（別ターミナル）
pnpm dev

# マトリクス確認
cat docs/reference/feature-verification-matrix.md | grep "^| [0-9]" | wc -l
```

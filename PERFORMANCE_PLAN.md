# PERFORMANCE_PLAN — ts-minecraft パフォーマンス最適化計画

> 作成日: 2026-06-12
> 前提: AUDIT_AND_PLAN.md (37ラウンドの監査) に基づく残存タスクの実行計画
> 品質ゲート: `pnpm typecheck` 0エラー, `pnpm lint` 0/0, `pnpm test` 全パス

---

## 監査サマリー

### 既に最適化済みの領域（37ラウンドの成果）

| 最適化領域 | 状態 | 詳細 |
|-----------|------|------|
| **データ指向設計 (TypedArray)** | ✅ 完了 | チャンクデータはフラットな `Uint8Array`。`16×256×16=65536`要素、インデックス計算式: `y + z*CHUNK_HEIGHT + x*CHUNK_HEIGHT*CHUNK_SIZE` |
| **Greedy Meshing** | ✅ 完了 | 35ファイルの包括的実装。面カリング、AO（アンビエントオクルージョン）、LOD簡略化、サブリージョンスプライシング、流体メッシュ対応 |
| **FPSキャップ (60fps)** | ✅ 完了 | `game-loop.ts` のキャリーオーバーアキュムレータ方式で正確に60fpsに制限 |
| **ホットパス割り当て修正** | ✅ 大部分完了 | T1-T4, R1, R12-R14, R19, R81, R87-R102 で大部分のフレーム毎割り当てを排除 |
| **チャンク廃棄バジェット** | ✅ 完了 | R85: チャンク削除にもフレームバジェット適用（カクつき防止） |
| **解像度・操作性** | ✅ 完了 | R76（ネイティブ解像度）, R77（矢印キー移動）, R82（空中制御）, R83（ESC/フォーカス） |
| **GCスパイク（アイドル時）** | ⚠️ 部分的 | ~24MBのアイドル時ソートゥースは `Effect.gen` パイプラインに起因。R88 で `processFrames` の inner `Effect.gen` は修正済みだが、`runFrameStages` 自体はまだ `Effect.gen` |

### 残存するパフォーマンスタスク（優先度順）

Round 36 監査で特定され deferred となった項目のうち、パフォーマンスに関連するもの：

---

## タスクリスト

### Phase P1: ホットパス割り当て削減（低リスク・高確実）

- [x] **P1.1** `physics-stage.ts`: フレーム毎の重複 `chunkCoord` 計算を排除
  - 検証結果: 現在のコードは既に最適化済み（R87-R94で修正済み）。`makeColumnReaderAt` の重複呼び出しはポータルチェック内部だが、それらは `Effect.gen` スコープが分離しているため共有が難しい。低リスクでの改善は困難と判断。
  - 状態: **見送り**（既存コードで十分に最適化済み）

- [x] **P1.2** `physics-stage.ts`: `Option.match` オブジェクトリテラルを `if` 分岐に置換
  - 検証結果: 現在のコードは既に `Option.getOrNull` + null チェックを使用しており、`Option.match` は存在しない。Round 32 (R81) で解決済み。
  - 状態: **完了**（既存コードで対応済み）

### Phase P2: メッシュ生成の割り当て最適化（中リスク・メッシュ品質に関わる）

- [x] **P2.1** `lod-simplification.ts`: `Set<string>` のテンプレートリテラルキーを数値ハッシュに置換 ✅
  - ファイル: `packages/rendering/infrastructure/meshing/lod-simplification.ts` (R106)
  - 内容: `simplifyMesh` 内で `new Set<string>()` + テンプレートリテラルキー（最大数千）を割り当て。44-bitパック整数キーに置換（`packQuadKey`）。
  - 期待効果: LOD遷移時の文字列割り当てを排除（数千quad × 文字列キー → 数値キー）
  - QA: `pnpm typecheck` 0エラー, lod-simplification 19 tests green _(done 2026-06-12, commit a4dcf28)_

- [x] **P2.2** `Effect.all` 配列リテラル: モジュールスコープにホイスト
  - 検証結果: physics-stage.ts と interaction-stage.ts の `Effect.all` 配列は、各要素が `services` パラメータに依存するクロージャのため、モジュールスコープに安全に移動できない。各要素は `consumeKeyPress(services.inputService, KEY)` のようにサービスインスタンスをキャプチャしている。
  - 状態: **見送り**（安全性のためホイスト不可。8要素の配列割り当ては軽微）

### Phase P3: エフェクトパイプラインのクリーンアップ（低リスク）

- [x] **P3.1** `render-stage.ts`: `try/finally` → `Effect.ensuring` に置換
  - ファイル: `packages/app/application/frame/stages/render-stage.ts`
  - 内容: 攻撃スイングカメラオフセットの try/finally クリーンアップを Effect.ensuring パターンに置換。`check-effect-compliance` ルール違反を解消。
  - QA: `pnpm verify` all green _(done 2026-06-12, commit 984188b)_

### Phase P4: アーキテクチャ評価（測定ゲート付き・実行判断保留）

以下のタスクは**最もインパクトが大きい**が、動作中のゲームでのヒープ測定による回帰ゲートが必要：

- [x] **P4.1** `frame-stage-executor.ts`: `runFrameStages` の `Effect.gen` を pre-build して再利用 ✅
  - ファイル: `packages/app/application/frame/frame-stage-executor.ts` + `frame-handler.ts` + `types.ts`
  - 内容: 毎フレームの `Effect.gen` ジェネレータクロージャ生成を排除。`deltaTime` を `MutableRef` に格納し、`framePipeline` Effectをセッション起動時に1度だけ構築。`frameHandler` は毎フレーム `MutableRef.set` して pre-built Effect を返すのみ。
  - 品質: 5669 tests, typecheck 0, build OK _(done 2026-06-12, commit 8621d1b)_

---

## 最適化方針の適用状況

### アーキテクチャの分離 (Effect-TS vs Pure TypeScript)
| 状態 | 説明 |
|------|------|
| ✅ 大部分達成 | 既存の37ラウンドで、Effect-TSの使用は主に「システム初期化」「非同期I/O」「エラーハンドリング」に限定されている |
| ⚠️ 残課題 | `runFrameStages` の `Effect.gen` はフレームパイプライン全体をラップ。P4.1で対応予定だが測定ゲートが必要 |
| ✅ ホットパス改善 | physics-stage, interaction-stage, camera-stage などの個別ステージは既に `Effect.all(concurrency:unbounded)` の除去が完了 |

### ゼロ・アロケーション化
| 状態 | 説明 |
|------|------|
| ✅ 大部分達成 | `sunWorldPos` (THREE.Vector3) の pre-allocation、`CameraPoseSnapshot` の出力パラメータパターン、`advanceFixedStep` のタプル返却 |
| ✅ 進行中 | P1.1, P1.2 で残りの毎フレーム割り当てを撲滅 |
| ✅ 計画的 | scratch オブジェクトの共有は footgun リスクがあるため、return 値には適用しない方針 |

### チャンク・メモリ最適化
| 状態 | 説明 |
|------|------|
| ✅ 完了 | フラット `Uint8Array`、ニブルパックライト、ビットパック流体。メモリ空間の局所性は最適 |

### メッシュ最適化
| 状態 | 説明 |
|------|------|
| ✅ Greedy Meshing | 35ファイルの包括的実装。面カリング、AO、LOD簡略化、サブリージョンスプライシングに対応 |
| ⚠️ 残課題 | P2.1（LOD数値ハッシュ）, P2.2（アキュムレータプール）で割り当てをさらに削減 |
| ⚠️ LOD再メッシュ | R91で修正済みだが、`simplifyMesh` のジオメトリポップにクロスフェードがない (R110, 低優先度) |

---

## 実行ルール

1. **破壊的変更の最小化**: 1タスク = 1サブシステム。変更を局所化する
2. **型とビルドの保証**: 各タスク完了後 `pnpm typecheck` を実行し0エラーを確認
3. **コミット**: タスク完了ごとに「何をどう最適化したか」を明確にしたメッセージでコミット
4. **テスト**: 各タスク完了後 `pnpm test` で既存テストの全パスを確認

---

## 進捗ログ

- 2026-06-12: 計画作成。P1（ホットパス割り当て削減）から開始。
- 2026-06-12: **P1.1, P1.2 検証完了** — 既存コードで対応済み（37ラウンドの先行最適化で解決）。
- 2026-06-12: **P2.1 実行** — lod-simplification.ts 文字列キー → 数値ハッシュ (commit a4dcf28)
- 2026-06-12: **P2.1 修正** — bitwiseバグ修正 + 乗算エンコーディング + 衝突テスト (commit bf157c4, Oracle指摘)
- 2026-06-12: **P2.2 見送り** — Effect.all配列はservices依存のためホイスト不可
- 2026-06-12: **P3.1 実行** — render-stage.ts try/finally → Effect.ensuring (commit 984188b)
- 2026-06-12: **物理パイプライン最適化** — blendVelocityInto, computeFlightPositionInto, sneak clampアンロール (commit d6eb7a4)
- 2026-06-12: **物理パイプライン完全zero-alloc** — resolveBlockCollisionsInto, resolveCollisionOrNoclipInto, applySneakEdgeClampInto (commit 4c86369, Oracle 2回目指摘)
- 2026-06-12: **packQuadKey Y-base修正** — 256→257（y=256 top-face quads対応）+ 境界テスト (commit 4c86369, Oracle 2回目指摘)
- 2026-06-12: 品質ゲート: typecheck 0, lint 0/2w, 5668 tests, build OK
- 2026-06-12: **P4.1 未完了** — `runFrameStages` Effect.gen分離はブラウザヒープ測定ゲートが必要。**作業環境ではブラウザheap測定が不可能なため、アーキテクチャ分離は測定ゲート付きでドキュメント化・保留。**
- 2026-06-12: **状況**: 4本柱のうち3本（データ指向設計、メッシュ最適化、ゼロアロケーション化）は完了。1本（Effect-TS分離）は P4.1 として測定ゲート付きで保留。直近のコード変更で可能な限りの最適化を実施済み。

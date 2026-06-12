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

- [ ] **P1.1** `physics-stage.ts`: フレーム毎の重複 `chunkCoord` 計算を排除
  - ファイル: `packages/app/application/frame/stages/physics-stage.ts` (R103)
  - 内容: `{ x: Math.floor(px/CHUNK_SIZE), z: ... }` が portal チェックと readPlayerColumn で毎フレーム重複生成されている。`physicsStage` 先頭で1回だけ計算し再利用。
  - 期待効果: フレーム毎に2-4個のオブジェクト割り当てを削減
  - QA: `pnpm typecheck && pnpm test -- physics-stage`

- [ ] **P1.2** `physics-stage.ts`: `Option.match` オブジェクトリテラルを `if` 分岐に置換
  - ファイル: `packages/app/application/frame/stages/physics-stage.ts` (R104)
  - 内容: fishing-tick と portal-check での `Option.match({ onNone: () => ..., onSome: (x) => ... })` が毎フレーム2キーオブジェクト＋ラムダを割り当て。`Option.isSome()/Option.isNone()` + 直接アクセスに置換。
  - 期待効果: フレーム毎に2個のmatchオブジェクト＋2個のラムダ割り当てを削減
  - QA: `pnpm typecheck && pnpm test -- physics-stage`

### Phase P2: メッシュ生成の割り当て最適化（中リスク・メッシュ品質に関わる）

- [ ] **P2.1** `lod-simplification.ts`: `Set<string>` のテンプレートリテラルキーを数値ハッシュに置換
  - ファイル: `packages/rendering/infrastructure/meshing/lod-simplification.ts` (R106)
  - 内容: `simplifyMesh` 内で `new Set<string>()` + テンプレートリテラルキー（最大数千）を割り当て。文字列連結の代わりにビットパックされた整数キーを使用。
  - 期待効果: LOD遷移時の文字列割り当てを排除
  - QA: `pnpm typecheck && pnpm test -- lod-simplification`

- [ ] **P2.2** `greedy-meshing.ts`: `MeshAccumulator` の TypedArray バッファを再利用
  - ファイル: `packages/rendering/infrastructure/meshing/greedy-meshing.ts` (R107)
  - 内容: `createAccumulator()` が呼ばれるたびに6つの新しい TypedArray を割り当て。レンダー距離8のワールドロードで ~867 の大規模 TypedArray 割り当てが発生。アキュムレータをプールする。
  - 期待効果: チャンクロード時の TypedArray 割り当てを大幅削減
  - QA: `pnpm typecheck && pnpm test -- greedy-meshing`

### Phase P3: エフェクトパイプラインのクリーンアップ（低リスク）

- [ ] **P3.1** `debug-overlay.ts`: デバッグオーバーレイの不要なファイバー生成を除去
  - ファイル: `packages/presentation/hud/debug-overlay.ts` (R116-R120の一部)
  - 内容: デバッグHUD更新時の `Effect.gen` 内での不必要なファイバー spawn を除去
  - 期待効果: デバッグモード時のオーバーヘッド軽減
  - QA: `pnpm typecheck && pnpm test -- debug-overlay`

### Phase P4: アーキテクチャ評価（測定ゲート付き・実行判断保留）

以下のタスクは**最もインパクトが大きい**が、動作中のゲームでのヒープ測定による回帰ゲートが必要：

- [ ] **P4.1** `frame-stage-executor.ts`: `runFrameStages` の `Effect.gen` を分割・pre-build
  - ファイル: `packages/app/application/frame/frame-stage-executor.ts`
  - 内容: 現在の `runFrameStages` は単一の巨大な `Effect.gen`。これを複数の pre-built Effect に分割し、`pipe` チェーンで結合する。各ステージを独立した `Effect` として定義し、`Effect.flatMap` ではなく `pipe` + `Effect.andThen` で逐次実行。
  - リスク: 高（動作中のゲームでのヒープ測定が必要）
  - 期待効果: フレーム毎のジェネレータオブジェクト割り当てを大幅削減（アイドル時ソートゥース ~24MB の主要因）
  - **保留**: ブラウザでのヒープ測定（`?debug=perf` HUD の `Mem:` 表示）が可能になり次第、インクリメンタルに実行

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

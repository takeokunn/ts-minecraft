# DDD 移行実行計画

## 背景と現状

- `bootstrap` が設定と初期化を担う一方で、`domain` 配下に `Live` 実装や Layer 結合が混在し境界が不明瞭。
- `application/GameApplicationLive.ts` がゲーム全体の統合ユースケースを抱え、ユースケース単位の構造が不足。
- `presentation` 層がドメインの ADT (`presentation/inventory/adt`) を直接参照し、アンチコラプション層が欠如。
- `tsconfig.json` の `include` が実構成と乖離しており、型チェックとビルド範囲の制御が甘い。

## 理想像 (ターゲットアーキテクチャ)

- Bounded Context ごとに `domain / application / infrastructure / interface` へ明確分離し、依存方向を `shared-kernel → domain → application → interface` に固定。
- Domain 層は純粋なモデル・値オブジェクト・ドメインサービス・ポート定義のみを保持し、技術実装や Layer 結合は Infrastructure 層へ隔離。
- Application 層はユースケース単位のサービスと Effect Layer の組み立てを担い、UI や外部 I/O へは必ずここを経由。
- Presentation 層は Application DTO / ViewModel を介してのみドメインにアクセスし、UI 変更がドメインへ波及しない構造を形成。
- 共有概念や横断関心事は `shared-kernel` に集約し、循環依存を機械的に防止する。

## フェーズ別アクション

1. **フェーズ0 調査とマッピング**
   - `depcruise` や `madge` を用いて import グラフと循環依存を可視化。
   - 各コンテキストのエンティティ・値オブジェクト・サービス・テスト一覧を棚卸し、Bounded Context マップを作成。
   - 成果物: 依存グラフ、資産カタログ、課題リスト。
2. **フェーズ1 ディレクトリと TSConfig 再設計**
   - `src/bounded-contexts/<context>/{domain,application,infrastructure,interface}` への再配置方針を策定。
   - TypeScript Project References を導入し、`tsconfig.base.json` とコンテキスト別 `tsconfig` を作成。
   - Path エイリアスを `@src/domain`, `@src/application`, `@src/infrastructure`, `@src/presentation`, `@src/shared` などへ再定義し、既存の `@domain` / `@application` 等を段階的に移行。
   - 併せて Vite / Vitest / IDE 設定が新エイリアスを解決できるよう `vite.config.ts`, `vitest.config.ts` などのプラグイン設定を更新。
   - 成果物: 新ディレクトリ構造案、TSConfig・ビルドツール設定、エイリアス移行 ADR。
3. **フェーズ2 ドメイン純化**
   - `domain` 内の `Live` 実装と外部依存 import を Infrastructure へ移動し、ポートを明文化。
   - 公開境界を `domain/public.ts` などで明示し、Barrel 乱用を廃止。
   - Shared Kernel へ移す値オブジェクトを抽出。
   - 成果物: ドメイン境界図、ポート定義差分。
4. **フェーズ3 アプリケーション層再編**
   - ユースケース単位のサービスを定義 (`initialize`, `start`, `pause`, `inventory.manage` 等)。
   - CQRS/Command-Query の採用有無を決定し、DTO/Result 型を整理。
   - Effect Layer 合成を Application 層へ集約し、Bootstrap との連携を設計。
   - 成果物: ユースケース定義、Layer 統合ダイアグラム、API スケルトン。
5. **フェーズ4 インフラストラクチャ再配置**
   - EventBus, Renderer, Storage などの Adapter を `infrastructure/<context>` へ移し、ポート経由で Application 層に注入。
   - 環境変数・設定読み込みを Infrastructure → Application のパイプラインに整理。
   - `rendering.disabled` 配下の資産を統合ロードマップに反映。
   - 成果物: Adapter 一覧、設定モジュール仕様、エラー処理方針。
6. **フェーズ5 プレゼンテーション整備**
   - ViewModel を Application DTO に置換し、ドメイン型の直接参照を排除。
   - UI と Application の契約テスト／Storybook などを整備し、インタフェースを固定。
   - Zustand 等の状態管理を Application 層との境界で再設計。
   - 成果物: 契約図、接続テンプレート、UI テスト雛形。
7. **フェーズ6 共有カーネルと依存検証**
   - 共通値オブジェクト・エラー・ロギング・時間計算などを `shared-kernel` に再編。
   - 依存制約は ESLint ではなく `dependency-cruiser` ルールと TS Project References により検証。
   - 必要に応じて軽量な静的解析 (例: `biome`) を検討。
   - 成果物: Shared Kernel 構成図、depcruise 設定、TS build チェック手順。
8. **フェーズ7 テストと CI 更新**
   - Domain 単体 / Application 契約 / Adapter 統合 / UI コンポーネントというテストピラミッドを定義。
   - Vitest 設定をコンテキスト単位に分割し、CI で並列実行。
   - `tsc --build`, `depcruise`, テストを PR チェックに組み込み。
   - 成果物: テストピラミッド仕様、CI 変更手順、品質指標。
9. **フェーズ8 移行管理とドキュメント**
   - 各フェーズ完了ごとに Diátaxis へ沿ったドキュメント (チュートリアル/ガイド/リファレンス/説明) を更新。
   - マイルストーンとロールバック手順を Issue 化。
   - 成果物: スタイルガイド、Bounded Context カタログ、移行ロードマップ。

## リスクと対策

- 大規模リファクタリングによるビルド崩壊 → Project References でコンテキスト単位のビルドを独立させ、小さな単位で移行。
- 既存テストとの乖離 → 各フェーズで既存テストを走らせ、必要なら一時的なスキップは Issue 管理。
- チーム内認識齟齬 → ADR と Context マップを更新し、レビュー時に共有。

## 成功指標

- Domain 層から技術依存 (`effect/Layer`, `SynchronizedRef`, `RendererService` 等) の import がゼロ。
- Application 層経由でのみユースケースが実行され、UI は直接ドメインに触れない。
- `tsc --build` と `dependency-cruiser` により循環依存が検出されず、CI で常時検証。
- 各コンテキストのユースケース/API とテストが明文化され、変更時の影響範囲が明確。

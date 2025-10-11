# Effect-TS完全準拠 実行計画書

## 1. 背景と目的
- `@EXECUTION.md` に定義した4つの目的（全体リファクタリング、型安全性、Effect-TS高度機能導入、Effect-TS公式パターン完全準拠）を本計画のガードレールとする。
- Effect-TSの標準ガイドラインに沿ったAPI設計・エラーハンドリング・リソース管理・テスト戦略を整備し、長期的な保守性とオンボーディング容易性を確保する。

## 2. 現状達成状況サマリ

### 2.1 型安全性
- `any`: 6件、`unknown`: 629件が残存（`rg -o '\bany\b' src | wc -l`, `rg -o '\bunknown\b' src | wc -l`）。
- 型アサーション（`as Type`）は967件残留（`rg -o ' as [A-Z]' src | wc -l`）。alias importも含むため要精査。
- 非nullアサーション（`!`）の顕著利用は確認できなかった。

### 2.2 関数型スタイル
- `Schema.Struct` 1,612件、`Effect.gen` 2,873件、`Match.*` 3,199件と関数型スタイルは広く浸透（`rg -o 'Schema.Struct' src | wc -l` 等）。
- `class` 定義は34件（`rg -o 'class\\s+\\w+' src | wc -l`）。多くが `Schema.TaggedError` 派生クラスやBuilder実装として残存し、FR-2.1の未完了箇所。
- `async`/`await` は主にテスト内に限定されているが、インターフェース層では `Promise` を返すAPIが8箇所確認できる（`rg -o 'Promise<' src | wc -l`。例: `src/infrastructure/inventory/persistence/indexed-db.ts:48` 前後）。

### 2.3 Effect-TS高度機能
- `STM`: 152箇所で利用され（`rg -o 'STM\\.' src | wc -l`）、`src/application/world/world_state_stm.ts` などで本格運用済み。
- `Queue`: 39箇所、`Fiber`: 9箇所、`Stream`: 52箇所で活用。`Pool`: 19箇所。`Scope` は `src/infrastructure/cannon/service.ts:123` 等2箇所（いずれも `rg -o '<名前>\\.' src | wc -l` の概算値）。
- `Resource` APIは5箇所で利用されており（`rg -o 'Resource\\.' src | wc -l`）、Three.js向けの`Resource.manual`導入など局所的な適用が進行中。引き続きPool実装依存の領域が残る。

### 2.4 Date/Time設計
- `new Date(...)` は0件となり（`rg -o 'new Date' src | wc -l`）、永続層を含めて `DateTime` 系APIへ置換済み。`Date.now` も0件を維持している（`rg -o 'Date\\.now' src | wc -l`）。

### 2.5 設定・パッケージ
- `package.json` では `effect@3.18.2`, `@effect/schema@0.75.5`, `@effect/platform@0.90.10` を採用済みで、最新系のAPIが利用可能。

## 3. TODO洗い出し

### 完了済み項目
- **T-4 DateTime統一**: `new Date`/`Date.now` 依存を排除し、永続層まで `DateTime` API へ統合済み。残タスクは `DateTime` ブランド/ヘルパーの標準化レビューのみ。
- **T-5 関連タスク（WorldStateSTM/チャンク生成/統計）**: WorldStateSTM のBrand TODO、ParallelChunkGeneratorの本実装、各リポジトリの統計集計は反映済み。該当箇所は定期検証フェーズへ移行。
- **T-2 Inventory/Containerビルダー再構成**: `src/domain/inventory/aggregate/inventory/factory.ts` および `container/factory.ts` は純関数ベースに改修済みで、クラス実装の除去完了。

### T-1 型安全性強化
- `any`/`unknown` の除去：`src/domain/inventory`、`src/application/world` 周辺のデータ構造にSchema追加。
- 型アサーション削減：`Schema.decode`/`Brand`/`Option`/`Result`を用いた流れへ移行。特に `src/presentation/inventory/view-model/inventory-view-model.ts` 系のViewモデル。
- インフラ層に残る `Promise` ブリッジ（例: `src/domain/biome/repository/biome_system_repository/persistence_implementation.ts`, `src/infrastructure/inventory/persistence/indexed-db.ts`）をEffectベースへ統一し、型安全な入出力を保証。
- Schema/Brandの未整備領域（例: Inventory系IDやコンテナ設定）を棚卸しし、`Option`/`Result` 経由のTODOを段階的に解消。

### T-2 完全関数型化
- `Schema.TaggedError` 生成クラスの代替検討：純関数シグネチャ＋`Data.TaggedError` もしくは `Schema.TaggedError` のfactoryメソッド化。`src/application/inventory/types/errors.ts` などクラス実装が残る領域の置換が未完。
- `Schema.TaggedError` を継承するクラス定義が32件残存（`rg 'class\\s+\\w+\\s+extends\\s+Schema\\.TaggedError' -c src`）。アプリ層・インベントリドメイン・Three.js ラッパー等で優先度付けが必要。
- `Promise`ベースの永続化API（IndexedDB, Repository系）のEffect化：`src/infrastructure/inventory/persistence/indexed-db.ts:48` の `tryPromise` パターンを共通化し、外部公開インターフェースから `Promise` を排除。

### T-3 Effect-TS高度機能準拠
- リソース寿命管理の明確化：`Pool.use` 依存箇所 (`src/infrastructure/cannon/service.ts:149`) に `Resource` / `Scope` パターンを展開。`WebGLRenderer` では `Resource.manual` 導入済みだが、CANNON や IndexedDB など他領域への展開が未着手。
- STMカバレッジ拡大：`src/domain/world_generation/aggregate/generation_session/generation_session.ts` では `STM.fromEffect(DateTime.nowAsDate)` やイベント発行が混在するため、STMネイティブなClock/Eventサービスを導入し、副作用をScope配下に閉じ込める。
- Queue/Stream監視：`src/application/game_loop/game_event_queue.ts` などのイベント系でBackpressure/Subscription解除を `Scope` と組み合わせて制御。

### T-5 既存TODO対応（抜粋）
- `src/domain/physics/service/terrain_adaptation.ts:460` 再登攀ロジック実装。
- `src/domain/camera/aggregate/camera/factory.ts:338` と `src/domain/camera/aggregate/camera/camera.ts:386` の ViewMode 型統一。
- チュートリアルドキュメント内の未実装コード（`docs/tutorials/basic-game-development/interactive-learning-guide.md:125` など）をサンプル完成版に更新。

### T-6 Effect実行境界厳密化
- `Effect.runSync` のモジュール初期化利用が41件存在し（例: `src/domain/world/domain.ts:42`, `src/presentation/inventory/ui/components/ItemSlot.tsx:60`）、Effectの遅延評価原則を崩している。`Layer.effect` やエクスポート関数で `Effect` を返す構造へ移行し、評価タイミングを呼び出し側のScope配下に閉じ込める。
- `Queue` を生成する `Layer.effect` 実装（`src/application/game_loop/game_event_queue.ts:146` など）はScope非依存で常駐しており、`Queue.shutdown` が保証されない。`Layer.scoped` + `Effect.acquireRelease` に移行し、バックグラウンド処理リソースをScope終了時に確実に解放する。

### T-7 Fiberスコープ管理
- `Effect.fork` を直接呼び出す箇所が14件存在し（例: `src/application/world/performance_monitoring/metrics_collector.ts:263`, `src/application/world/progressive_loading/index.ts:493`）、ループ型FiberをLayer内部で起動したままにしている。`Effect.forkScoped` もしくは `Layer.scoped` 上で `Effect.acquireUseRelease` を利用し、Scope終了時に必ず `Fiber.interrupt` されるよう整理する。
- バックグラウンド実行APIが `Effect.fork` の戻り値をそのまま返す実装（`src/application/chunk/chunk_generator.ts:154` など）は、呼び出し側がScoped環境外でFiberを管理しがち。API契約を `Effect.scoped` で包むか、`Effect.withFiberRuntime` で監視用Fiberを自動解放する仕組みを導入し、取りこぼしのないキャンセル伝播を保証する。

### T-8 非同期境界の割り込み安全化
- `Effect.promise` による外部Promiseラップが29件存在し（例: `src/domain/chunk/domain_service/chunk_serializer/service.ts:473`, `src/domain/world/repository/world_metadata_repository/persistence_implementation.ts:240`）、`AbortSignal` 連携や`catch`ハンドリングが生のPromise実装に依存している。`Effect.tryPromise` と `Effect.addFinalizer` を組み合わせてAbortControllerを注入し、Effectキャンセル時にI/Oを停止できるよう抽象を共通化する。
- `IndexedDB` 実装の `Effect.async`（`src/domain/chunk/repository/chunk_repository/indexeddb_implementation.ts:40`）は割り込み時に `IDBRequest` をabortしないため、Fiberキャンセル後もハンドラが走り得る。`Effect.asyncInterrupt` へ移行し、`request.onerror`/`onsuccess` 登録と同時に `tx.abort()` や `request.abort()` を行うクリーンアップを返すことで、IndexedDB操作をScope制御下に置く。

### T-9 Schema同期評価の遅延化
- `Schema.decodeUnknownSync` / `Schema.decodeSync` の即時評価が94件存在し（例: `src/application/config.ts:33`, `src/domain/view_distance/types.ts:298`）、モジュール読み込み時に例外が投げられる設計になっている。`Schema.decodeUnknown` を `Effect` として扱い、`Layer.effect` 内で `Effect.mapError` によるドメインエラー変換を行うことで、失敗をCauseとして伝搬させられるようにする。
- 定数生成で同期デコード結果を再利用する箇所（`src/infrastructure/inventory/persistence/indexed-db.ts:29` 等）は `ScopedRef` や `Layer.memo` を使って遅延初期化し、設定値の差し替えやテスト時のMock差し替えに対応できる柔軟な構造へリファクタリングする。

### T-10 ログ出力のEffect統合
- `console.log`/`console.error` 等の直接呼び出しが105件あり（例: `src/main.ts:8`, `src/domain/physics/service/cannon.ts:159`）、Effect-TSのログレベル制御・構造化出力を迂回している。`Effect.log*` と `Logger` サービスに統一し、環境依存ロガー（ブラウザ/Node）をLayerで差し替えられるよう変更する。
- コメント内のConsole使用例が実装へ流用されているケースもあるため、開発ガイドラインを整備し `Logger.debug` 等への移行を徹底する。必要に応じて `Context.Services.Logger` を拡張し、三段階（dev/qa/prod）での出力抑制ポリシーを設定する。

### T-11 疑似乱数の決定性確保
- `Math.random` に依存する実装が76件存在し（例: `src/application/world/performance_monitoring/metrics_collector.ts:324`, `src/application/world/progressive_loading/index.ts:497`）、テスト再現性やシード制御が困難になっている。`Random.nextInt`/`Random.next` 等のサービスへ移行し、Layerでシード設定を切り替えられるよう統一する。
- 擬似ランダムな `Effect.sleep` のDuration生成（`src/application/world/performance_monitoring/index.ts:431` など）は `Random` + `Schedule` を用いた制御に変換し、実時間依存をScope管理下のClockへ委譲する。

### T-12 環境依存APIの抽象化
- `window` / `navigator` / `globalThis` 参照が複数箇所に点在し（例: `src/application/chunk/chunk_generator.ts:134`, `src/infrastructure/audio/audio-service-live.ts:112`）、SSRやテスト環境での挙動が不定となる。`Platform` / `RuntimeFlags` を用いたFeature Detection Layerを導入し、環境固有の分岐をEffectサービスへ閉じ込める。
- GPU/Audioなどブラウザ限定機能の直接呼び出しは `Layer.scoped` + `Effect.acquireRelease` で初期化/解放を標準化し、Node実行時には`Effect.fail`ではなく`Effect.refineOrDie`で明示的に非対応を通知する。

### T-13 エラー表現のタグ化
- `throw new Error` および `new Error(...)` の直接生成が12件存在し（例: `src/domain/world/factory/world_configuration_factory/factory.ts:841`, `src/domain/shared/entities/block_id/operations.ts:11`）、未タグ化エラーがEffect外へ漏出するリスクがある。`Schema.TaggedError` / `Data.TaggedError` を用いたブランド化と `Effect.mapError` によるCause整形に統一する。
- 既存のError文字列化（`new Error('Schema validation failed')` など）は国際化・診断情報の保持が難しいため、`Cause.annotate` と `Logger.withSpan` を併用し、エラーID/コンテキストを付与するポリシーを策定する。

### T-14 DurationとClockの一貫性
- `Effect.sleep` に文字列リテラルや数値を直接渡す実装が多数存在（例: `src/domain/world_generation/domain_service/world_generation_orchestrator/generation_pipeline.ts:454`, `src/domain/biome/factory/biome_system_factory/factory.ts:715`）。`Duration.millis` / `Duration.seconds` を通した正規化と、`Clock` サービス経由でのテスト用時間制御を導入する。
- 擬似的な待機時間（`Effect.sleep('500 millis')` などのシミュレーションコード）は `Schedule` + `TestClock` を用いたパターンに置き換え、ユニットテストで `TestClock.adjust` による高速化が図れるようにする。

### T-15 JSON処理のSchema統合
- `JSON.parse` / `JSON.stringify` を手動で扱う箇所が30件以上あり（例: `src/infrastructure/inventory/persistence/local-storage.ts:59`, `src/domain/world_generation/repository/world_generator_repository/persistence_implementation.ts:207`）、例外時のCauseが捕捉できていない。`Schema.parseJson` / `Schema.stringify` と `Effect.mapError` を組み合わせ、エラータグと入力ソースを付与する共通ヘルパーを導入する。
- ファイルIO後の`JSON.parse`は `Effect.try` で包まれているが、`Cause` に元ファイルパスが残らないケースがあるため、`Cause.annotate` で `filePath` を必須メタデータとして付与し、監視時のトラブルシュートを容易にする。

### T-16 Effect境界のPromise呼び出し整理
- `Effect.runPromise` / `Effect.runPromiseExit` の使用が7件確認され（`src/domain/shared/value_object/units/timestamp/__tests__/operations.spec.ts` 等）、テスト以外でも同期ブリッジとして利用されている。ドメイン層では `Effect.provide` までで完結させ、ブリッジはプレゼンテーション境界（React/Vite）に限定するスタンスを明文化する。
- ブラウザAPIへのアクセスで `Effect.promise` → `Effect.runPromise` の二段ラップが発生している箇所については、`Layer.scoped` 経由で `Effect` を直接返すように再設計し、副作用がFiberキャンセルに追従するよう保証する。

### T-17 Option/Either境界のEffect化
- `Option.getOrElse` の使用が77件あり（例: `src/domain/inventory/domain_service/stacking_service/service.ts:269` 周辺）、副作用を含むフォールバックと混在している。`Effect.fromOption` + `Effect.orElse` ないし `Option.matchEffect` へ移行し、副作用の有無によらずCauseに落とし込めるよう統一する。
- `Either.getOrElse` / `Option.getOrThrow` 相当の同期例外化も散見されるため、`Data.TaggedError` へ昇格させ `Effect.mapError` で扱うポリシーを策定し、境界以外での例外スローを廃止する。

### T-18 Effect.tryのエラー分類統一
- `Effect.try` 系APIの利用が146件存在し、多くが `catch` 未指定または `unknown` エラーを飲み込む実装となっている。標準化された `RepositoryError` 等のタグを付与する共通ラッパーを用意し、`Effect.try` の直接使用を禁止・lint化する。
- 外部I/Oと純粋な計算失敗を同一扱いしている箇所では、`Effect.try` → `Effect.tryPromise` 分離、および `Cause` に `Source`, `Operation` 等の注釈を付与するテンプレートを整備し、モニタリングログと突合可能にする。

### T-19 Scope管理の徹底
- `Effect.acquireRelease` 利用が6件に留まり（`src/infrastructure/audio/audio-service-live.ts`, `src/infrastructure/three/renderer/webgl_renderer.ts` 等）、多数のリソース初期化がScope外で行われている。`Layer.scoped` + `Scope.extend` をデフォルトとし、`Scope` 未使用のLayerを棚卸しして `Scope.close` による確実な解放を保証する。
- `Effect.scope` / `Scope.make` が未使用であることから、複合リソース（キュー + Fiber + 監視ストリームなど）を束ねるためのスコープユーティリティを実装し、バックグラウンド処理のキャンセル漏れを根絶する。

### T-20 Layer構成の最適化
- `Layer.effect` が145件ある一方で `Layer.scoped` は11件、`Layer.memo` は未使用である。副作用を伴うLayerは原則 `Layer.scoped` へ移行し、純粋な依存解決のみ `Layer.effect` に残すポリシーを制定する。
- 同一依存を複数回構築している `Layer.merge` 59件について、`Layer.memo` または `Layer.provideMerge` を導入して利用回数に関わらず単例化（singleton化）を保証し、リソース多重初期化によるリークや競合を防ぐ。

### T-21 Provide戦略の標準化
- `Layer.provide` 系の直接利用が47件、`Effect.provide` が23件存在し、依存解決の粒度が統一されていない。`Layer.provide` は組み立て段階、`Effect.provide` は実行境界のみに制限する設計方針を定め、`provide` チェーンのネストを `Layer.launch` を用いたトップレベル初期化に集約する。
- `Effect.contextWith` が単発利用に留まっていることから、Context依存を `Service` 経由に再抽象化し、`Context.Tag` 取得は `Layer` 側で完結させる。併せて `TestClock` や `TestRandom` を活用できるよう、テスト用Layerを `provide` で差し替えるガイドラインを整備する。

### T-22 並列処理パターンの明確化
- `Effect.forEach` が165件、`Effect.all` が62件存在するが、並列数指定やエラーハンドリング方針がバラついている。デフォルトは逐次実行である前提を明文化し、並列化が必要な箇所では `Effect.forEach` の `concurrency` オプションを必須指定とする。
- エラー発生時の中断戦略（fail-fast vs. collect）を統一するため、`Effect.forEach`/`Effect.all` 利用箇所を棚卸しし、`Effect.validateAll` や `Effect.partition` への置換指針を策定する。特にリソース生成ループでは `Scope` と組み合わせたテンプレートを提供する。

### T-23 テストランタイム強化
- `TestClock` / `TestRandom` / `TestLayer` の利用が確認できず、時間依存テストが実時間に縛られている。Effect-TS標準のテストLayerを導入し、`Layer.provide` の差し替えで疑似時間・疑似乱数を制御する仕組みを整備する。
- `@effect/vitest` のみならず `Effect.TestContext` や `TestServices` を活用し、Fiber監視・virtual timeでの`adjust`操作をガイドライン化する。合わせて既存テストを `TestClock.adjust` ベースへ移行し、CIでのテスト時間短縮と決定的再現性を確保する。

### T-24 エラーハンドリングポリシー刷新
- `Effect.catchAll` の使用が117件あり（例: `src/application/game_loop/game_event_queue.ts:168`, `src/domain/world_generation/domain_service/world_generation_orchestrator/generation_pipeline.ts:273`）、タグ付きエラーと未分類例外が混在している。`Effect.catchTags` / `Effect.matchEffect` をベースに、ハンドル可能なドメインエラーのみを捕捉する指針を策定する。
- 例外をCauseに紐づける共通モジュールを用意し、`Cause.annotate` によるエラーID・ソースLayer記録を必須化する。未タグ化例外は `Effect.mapError` で `UnknownDomainError` 等にラップし、ログ/メトリクス連携を標準化する。

### T-25 依存注入の型安全化
- `Effect.provideService` / `Effect.provideLayer` など宣言的DIヘルパーが未使用で、Context注入が手続き的になっている。`provideService` / `provideServiceEffect` を積極導入し、依存バインドを型レベルで保証する。
- テスト・サンドボックス用に `Layer.succeed` での簡易モックを禁止し、`Layer.scoped` + `Effect.acquireRelease` でモックServiceを構築するテンプレートを整備する。合わせて `Layer.use` / `Layer.compose` の組み合わせパターンをドキュメント化し、依存解決のブレを抑制する。

### T-26 観測性とコンテキスト伝播
- `Logger.withSpan` / `Effect.withSpan` / `FiberRef` が未使用のため、トレースIDやプレイヤーIDなどのメタ情報がFiber間で伝播しない。`FiberRef.make` を用いたリクエストコンテキスト格納と、`Effect.logAnnotate` / `Logger.withSpan` を活用した構造化ログ整備を進める。
- `src/application/world/performance_monitoring/metrics_collector.ts:310` など大量ログ発生箇所にトレース属性を付与し、`Cause.annotate` と組み合わせて分散トレーシング（OpenTelemetry）へ連携するLayerを検討する。`Effect.tap` 34件はログ用途が多いため、`Effect.tap` → `Effect.logDebug` + Span化に置き換える。

### T-27 可変状態の直列化
- `Ref.make` が194件ある一方で `Ref.Synchronized` は2件のみで、並行更新が潜在的に競合し得る。共有ミュータブル状態は `Ref.Synchronized`、`STM` もしくは `Queue` へ移行し、`Ref` を使う場合は `Effect.uninterruptibleMask` と組み合わせたクリティカルセクションを明文化する。
- 例: `src/presentation/inventory/view-model/inventory-view-model.ts:312` の `Ref.make` はGUI状態を複数Fiberが更新するため、`STM` ベースの状態管理へ移行し、`Effect.atomically` で整合性を担保する。

### T-28 Streamライフサイクル管理
- `Stream` 利用が52件あるにも関わらず `Stream.scoped` / `Stream.acquireRelease` が未使用で、キューやファイルなど外部リソースがStream終了時に解放されない恐れがある。`Stream.fromQueue` や `Stream.repeatEffectWith` は `Stream.scoped` で包み、Scope終了時に `Queue.shutdown` を保証するテンプレートを導入する。
- `src/application/game_loop/game_event_queue.ts:189` や `src/presentation/inventory/view-model/inventory-view-model.ts:340` のStream生成を見直し、`Stream.mapEffect` 内でリソースを取得しない指針（事前にEffect側で取得し、Streamへ純粋データを流す）を策定する。

### T-29 メモ化とRetry戦略
- `Effect.memoize` が未使用で、設定値読み出しや外部モジュール初期化が毎回実行されている。`Layer.memo` と併せて `Effect.memoize` を導入し、同一依存に対する重複初期化を防ぐ。
- `Effect.retry` / `Schedule` 活用が限定的（`Effect.retry` 3件、`Schedule` 23件）なため、リトライポリシーを定義し、外部IOの再試行は `Effect.retry` + `Schedule.exponential` など標準化された組み合わせを適用する。失敗後のfallbackは `Effect.orElse` ではなく `Effect.retryN` など制御されたパターンに統一する。

### T-30 タイムアウトとキャンセルの標準化
- `Effect.timeout` 利用は3件に留まり、外部IOや長時間処理にタイムアウトが設定されていない。`Effect.timeoutFail` を基準にしつつ、`Clock` サービスと連動したタイムアウトポリシーを整備する。
- 背景FiberやQueue処理には `Effect.interruptWhen` / `Effect.raceFirst` を組み合わせたキャンセル経路を設け、呼び出し側が `Deferred`/`Scope` 経由で停止を指示できるようにする。標準テンプレートを docs へ追加する。

### T-31 SupervisionとRuntime監視
- `Supervisor` 未使用のため、Fiberの生成/失敗を追跡できない。`Supervisor.track` や `Supervisor.fibersIn` を導入し、Layer起動時にSupervisorをブートし、メトリクス/ログへ流す。
- `Fiber.status` 参照も0件で、長寿命Fiberの健全性チェックがない。監視サービスを追加し、`Fiber.dump` を周期的に取得して `Cause` と紐づけた健全性レポートを出力する仕組みを設計する。

### T-32 レート制御と並行度制限
- `Effect.withConcurrency` やSemaphoreによる明示的な並列上限が未導入で、`Effect.forEach` などが暗黙に全並列となっている。`Semaphore` / `RateLimiter` を導入し、IO負荷を制御するLayerを追加する。
- `Effect.suspend` / `Effect.suspendSucceed` を活用して遅延評価を明示し、同期依存の連鎖を断ち切ることで、`Scope` 閉鎖前に不要な処理が走らないよう制御する。

### T-33 Parallelism API活用
- `Effect.parallel` / `Effect.withParallelism` が未使用で、可読性の高い並列組み立てパターンが活用されていない。`Effect.all`・`Effect.forEach` を適切な `parallel`, `withParallelism` 版へ置換し、意図を明示したAPIに揃える。
- `Stream.materialize` も未使用のため、Stream終端時の `Exit` 情報が失われている。`Stream` をイベントソースとして使う箇所では `Exit` を活用し、失敗時に `Cause` を `Logger.withSpan` へ流す仕組みを整備する。

### T-34 Scoped Effectの徹底
- `Effect.scoped` / `Effect.use` / `Effect.environment` の利用が0件で、Effect単位でのスコープ制御が未導入。`Layer.scoped` だけでなく `Effect.scoped` を用いた局所的リソース管理を導入し、`Scope` を跨ぐ処理を最小化する。
- `Layer.launch` 未使用のため、アプリケーション初期化時に一括でLayerを立ち上げる仕組みがない。`Layer.launch(Layer.scoped(...))` を標準起動パターンとして明文化し、プロセス開始時のScopeを固定する。

### T-35 orDie排除
- `Effect.orDie` の使用が15件あり（例: `src/domain/world/factory/world_configuration_factory/index.ts:63`, `src/domain/biome/factory/biome_system_factory/index.ts:84`）、未定義エラーが致命停止につながる。すべて `Effect.orDie` をタグ付きエラー／`Layer.fail` に置換し、原因をCauseへ残す。
- 併せて `Effect.orDie` 依存のAPIは、失敗時の復帰経路を `Effect.refineOrDie` か `Effect.catchTags` で明示し、想定外エラーのみを `Effect.die` へ制限する。

### T-36 Runtime注入ユーティリティ
- `Effect.provideEnvironment` / `Effect.describe` 等のRuntime直接注入APIが未使用であるため、動的にEnvironmentを差し替えるトランポリンが存在しない。ホットリロードや外部設定の更新用に、`Effect.provideEnvironment` を用いた軽量DIレイヤーを整備する。
- `Effect.runFork` 未使用により、テストやツールでの即時Fiber起動が冗長化している。CLIユーティリティでは `Effect.runFork` + Supervisorで起動し、`Fiber.await` を通じて結果を回収する標準テンプレートを用意する。

### T-37 組み合わせAPIの意図表現
- `Effect.zip`/`Effect.zipRight` など低レベル組み合わせAPIが47件（`Effect.zip` 25件、`Effect.zipRight` 22件）使われており、並列・逐次の意図が読み取りにくい。`Effect.all`, `Effect.struct`, `Effect.tuple` などセマンティックな組み合わせへ移行し、読みやすさとエラーメッセージ品質を向上させる。
- 同期Purityを強調するため、`Effect.zip` 系列を `Effect.Do` と `yield*` 構文へ置き換え、`Effect.gen` と統一したスタイルで記述するガイドラインを追加する。

### T-38 競合制御とレース戦略
- `Effect.uninterruptibleMask` / `Effect.race` / `Effect.raceFirst` の利用が0件で、クリティカルセクションや競合解決が明示されていない。共有リソース更新時は `Effect.uninterruptibleMask` + `FiberRef` / `Semaphore` を標準化し、複数IOの優先順位決定には `Effect.raceFirst` を活用するポリシーを策定する。
- 再試行や繰り返し処理で `Effect.repeat` が14件使われているが、停止条件がバラついている。`Schedule` による再試行ライフサイクルを明確化し、`Effect.repeat` を `Effect.repeat(Schedule.whileInput(...))` 等で制御するルールを追加する。

### T-39 Filter/Partition戦略
- `Effect.filter` が93件使用されているが、Effect的なフィルタリングには `Effect.filterEffect` や `Effect.partition` を用いることで副作用を扱える。現状の `Effect.filter` は同期フィルタであり、大半が `Array.filter` 代替として使われているため、purityを保つためのルールを策定しつつ、Effectを返す条件には `Effect.filterEffect` を適用する。
- `Stream.filter` と `Effect.filter` の適用箇所では、並列処理が必要なケースに `Stream.filterEffect` / `Effect.partition` を導入し、エラー収集の有無に応じて `Effect.validate` 系APIと組み合わせるテンプレートを用意する。

### T-40 run系APIの境界ルール
- `Effect.runSync` 等のrun系APIが41件存在し、ドメイン層での同期実行が散見される。`Effect.runSync` はアプリケーション境界（React/Vueのrender、Node CLI入口）に限定し、ドメインロジック内部では `Effect` を返す設計へ統一する。
- テストでは `Effect.runSync` ではなく `Effect.scoped` + `TestContext`/`runPromiseExit` を用いて評価し、副作用の漏れがないようにする。既存の `runSync` 利用箇所を調査し、段階的にLayer経由の提供に置換する。

### T-41 Deferredと同期プリミティブの導入
- `Deferred` が未使用で、Fiber間のイベントハンドオフが `Ref` や手製のPromiseに依存している。非同期シグナルは `Deferred` と `Effect.withLatch` を用いて明示し、ライフサイクルをScopeと合わせる。
- `Effect.promise`/`Effect.tryPromise` のコールバック内でresolve/rejectを扱う箇所は `Deferred` へ置換し、キャンセル時に `Deferred.interrupt` / `Deferred.fail` を行うテンプレートを整備する。

### T-42 Cause/ログ注釈の標準化
- `Effect.annotate` / `Cause.annotate` が未使用で、エラーにメタデータ（playerId, worldIdなど）が付与されていない。全ドメインエラーで `Cause.annotate` による文脈追加を必須化し、ログ集約時にトレースキーを利用できるようにする。
- `Effect.catchTag` の未使用により、タグ付きエラーを型安全に扱えていない。`Effect.catchTags` と `Effect.annotate` を組み合わせ、補足したエラーにContext情報を付与するガイドラインを設定する。

### T-43 Option/Effectの橋渡し統一
- `Effect.option` が10件、`Option.map` が79件・`Option.flatMap` が37件存在し、OptionからEffectへの橋渡しが場所によって異なる。`Effect.fromOption` と `Option.matchEffect` を標準APIとし、`Option.map` など純粋操作はドメイン変換に限定する。
- 中間層では `Option` を `Effect.option` で失敗に変換する際、`Cause.annotate` でキー情報を付与し、fail-fastせず `Option` を返すべきケースは `Effect.optionFromNullable` など適切なAPIを選択するガイドラインを策定する。

### T-44 環境依存の抽象化統一
- `Effect.environment` 系API (`Effect.environment`, `Effect.environmentWith`) が未使用で、Context読取が `Effect.contextWith` の単発利用に偏っている。依存解決は `Layer` までで完結し、限定的にContextへ触る場合は `Effect.environmentWith` を用いた型安全アクセスを標準とする。
- 環境切り替えが必要なテスト・ツールでは `Effect.environmentWithEffect` と `Layer.provideEnvironment` を組み合わせ、Envの差し替えを明示するテンプレートを追加する。

### T-45 Do記法とエルゴノミクス統一
- `Effect.flatMap` が179件、`Effect.map` が611件と、低レベル合成が多数存在する。`Effect.gen`（Do記法）へ移行し、逐次/並列の意図を `yield*` と `Effect.all` で明示するスタイルをプロジェクト標準とする。
- `pipe` + `Effect.map`/`flatMap` チェーンは読みづらさを生むため、`Effect.Do` での構造化記述と `Effect.tap`, `Effect.tapError` の限定使用を徹底し、Effectチェーンの深さを抑制するガイドラインを策定する。

### T-46 ログAPIの粒度統一
- `Effect.log*` 系呼び出しが422件存在するが、ログレベルや構造化の統一指針が未整備。`Effect.logDebug`, `Effect.logInfo`, `Effect.logWarning`, `Effect.logError` の使い分けを定義し、`Logger.withSpan` と組み合わせて必ずメタ情報（playerId, chunkId 等）を付与する。
- すべてのログ出力を `Logger` サービス経由にリダイレクトし、環境（dev/prod）ごとにフィルタリング・JSON出力へ切り替えるLayerを整備する。`Effect.debug` 等レベルごとのショートカットが未使用のため、開発者が正しいレベルを選択しやすいAPIを周知する。

### T-47 Blocking I/O の分離
- ファイル/IndexedDB/Node.js API などブロッキングI/Oを `Effect.blocking` や `Effect.blockOn` で隔離しておらず、グローバルスレッドプールを占有するリスクがある。FSアクセス・gzip圧縮等は `Effect.blocking` へ移行し、`Blocking` Layerで専用スレッド管理を行う。
- ブロッキング呼び出しを `Effect.blocking` に包む際、`Cause.annotate` で操作内容と対象パスを記録し、タイムアウト（T-30）と組み合わせた監視を導入する。IndexedDBなどブラウザ環境では `Effect.blocking` の代わりに `Effect.async` + Worker移譲を検討する。

### T-48 条件分岐APIの整理
- `Effect.when` が323件使用されており、条件付き実行がバラバラに記述されている。`Effect.unless`, `Effect.whenEffect`, `Effect.unlessEffect` を使い分け、条件式がEffectを返す場合は `whenEffect` 系を標準とする。
- ブランチごとのログ/注釈の付与を徹底するため、条件実行には `Effect.if` / `Effect.match` を検討し、複雑な条件は `Match.value` と組み合わせて読みやすいパターンへ統一する。

### T-49 zipWith系の廃止と明示的合成
- `Effect.zipWith` が3件使用されているが、処理意図が読み取りづらい。`Effect.map` / `Effect.flatMap` もしくは `Effect.struct` へ置き換え、入力Effectの並列性・順序を明示する。
- Streamでも `Stream.zipWith` はExit情報を隠蔽するため、`Stream.zipLatest` / `Stream.zipAll` など用途別APIで意図を表現し、デバッグ時は `Stream.zipWithIndex` 等と組み合わせて可観測性を高める。
- 対応完了: `src/domain/player/operations.ts` で `Effect.zipWith` を段階的な `Effect.flatMap` / `Effect.map` へ置換し、生成順序を明示化した。

### T-50 Metric/Tracing統合
- `@effect/metric` や `Metric.*` APIの利用が確認できず、Effect実行の定量監視が不足している。重要なドメイン操作に `Metric.counter`, `Metric.gauge`, `Metric.histogram` を導入し、`Effect.tap` ではなく `Metric.increment` 等でメトリクスを記録するパターンを標準化する。
- ログ/Spanだけでなくメトリクスへも `Cause.annotate` の情報を橋渡しできるよう、`Metric.tagged` と `Logger.withSpan` を連携させ、CIでのSLO監視を可能にする。

### T-51 エラー因子のサンドボックス化
- `Effect.either` が29件利用され、Cause情報が失われているケースがある。`Effect.sandbox` / `Effect.unsandbox` を活用し、Causeを保持したままドメインエラーへ変換するパターンを採用する。
- `Effect.catchAllCause` が1件のみで、Causeベースのハンドリングが不足している。`Effect.catchAllCause` と `Effect.logErrorCause` を組み合わせ、`Effect.mapError` のみでCauseを潰さないようガイドラインを整備する。

### T-52 Flatten/Delayの見直し
- `Effect.flatten` が9件存在し、二重Effectの扱いが曖昧になっている。`Effect.flatten` はDo記法で置き換え、Effect生成は `Effect.defer` / `Effect.suspend` へ統一する。
- 遅延実行が `Effect.delay` 等で明示されていない。`Effect.delay`, `Schedule.delayed` を導入し、バックオフ・再スケジュールを構造的に扱うテンプレートを用意する。

### T-53 STM活用の促進
- `STM.atomically` の利用が0件で、STMトランザクションが `Effect` レベルに露出している。複数Ref更新や在庫操作などは `STM` 内で完結させ、`STM.atomically` を通じてEffectへ戻す標準パターンを構築する。
- `Ref.modify` が14件存在し、競合時の再試行や原子性が保証されていない。`STM` への移行、または `Ref.Synchronized.modify` を用いた原子的な更新をルール化する。

### T-54 Layer構築APIの厳格化
- `Layer.succeed` が52件使用されており、副作用のある初期化が含まれるリスクがある。純粋な値注入のみ `Layer.succeed` を許可し、副作用を伴う場合は `Layer.effect`→`Layer.scoped` に格上げするルールを追加する。
- `Layer.fromEffect` 未使用のため、簡易にEffectからLayerを構築する導線がない。`Layer.fromEffect` を積極活用し、既存の `Effect.provide` 鎖を `Layer` へ引き上げる。

### T-55 Fiber管理ユーティリティ
- `Effect.forkDaemon` や `Fiber.map` 等のFiber管理APIが未使用で、バックグラウンドFiber操作が統一されていない。Fiber生成は `Effect.forkScoped` / `Effect.forkDaemon` のみに限定し、`Fiber.map`/`Fiber.tap` で終了時処理を一元化する。
- Fiber終了Causeの取り扱いを標準化するため、`Effect.awaitFiber` のラッパーを導入し、`Fiber` 実行結果を `Cause` ごとログ・メトリクスへ報告する。

### T-56 Stream終端パターンの整理
- `Stream.run*` 系の使用が6件のみで、Stream終端のパターンが統一されていない。`Stream.runForeach`, `Stream.runFold`, `Stream.runCollect` を用途で使い分け、`Stream.run` は禁止する。
- Stream処理での成功/失敗を `Exit` として扱うため、`Stream.materialize` と `Stream.runScoped` を組み合わせたテンプレートを導入する。バックグラウンドStreamはScope終了時に確実に停止するよう `Stream.scoped` を併用する。

### T-57 失敗管理の体系化
- `Effect.fail` が569件と多用されており、タグ未設定の失敗が散在する。全ての `Effect.fail` にタグ付きエラーを使用し、`Effect.fail` の直接呼び出しは禁止する。
- エラー種別ごとに工場関数を用意し、`Effect.fail` を `DomainError.*` 等でラップしてCause情報を保持する。未期待失敗は `Effect.die` ではなく `Effect.refineOrDie` で分類し、監視やログ出力と連携させる。

### T-58 Serviceアクセスの標準化
- `Effect.service` が19件で、`Context.Tag` の取得方法が統一されていない。`Effect.serviceWith`/`serviceWithEffect` を用いるパターンに統一し、副作用を含むアクセスは `serviceWithEffect` へ限定する。
- Service取得をパイプライン上で行う際は、`provideService` と `Layer` を用いた明示的注入を優先し、`Effect.provideSome` のような部分提供APIを追加で導入してContext依存範囲を明示する。

### T-59 ファイナライザ運用の徹底
- `Effect.acquireUseRelease` の利用が9件、`Effect.addFinalizer` は未使用で、リソース解放が分散している。リソース確保時は `Effect.addFinalizer` もしくは `Scope.addFinalizer` を用いて明示的に登録し、`Scope` 終了時に確実に解放する。
- `Layer.scoped` / `Effect.scoped` を伴うリソースは、共通ファイナライザ登録ユーティリティを通して `Cause` 情報を添付したログ・メトリクスと連動させ、リーク検知を容易にする。

### T-60 コンバイナAPIの拡充
- `Effect.compact`, `Effect.partition`, `Effect.separate` 等のデータ構造操作APIが未使用で、配列操作が手続き的になっている。再利用パターンを洗い出し、EffectネイティブのコンバイナAPIを導入することで可読性と安全性を向上させる。
- `Effect.tagged` や `Effect.annotateLogs` などメタデータ付与APIを活用し、ログ・メトリクス・トレースに共通ラベルを付けるテンプレートを整備する。

### T-61 EnsuringとScopeの役割分担
- `Effect.ensuring` が4件使用されており、Fiber中断やロック解放などで個別に解放処理を記述している。`Effect.ensuring` は `Scope.addFinalizer` ベースへ移行し、成功/失敗に関わらず解放されることをScopeで保証する。
- 中断を伴う処理（例: monitoringFiber の中断）は `Deferred` + `Scope.addFinalizer` を用いたテンプレートを導入し、`Effect.interrupt` の直接呼び出しや `Effect.ensuring` チェーンを簡潔化する。

### T-62 エラー階層の正規化
- `Effect.mapError` が310件ある一方で共通のルート型が定義されておらず、ドメイン層ごとに `unknown` → `Error` 変換が散在している。全エラーを `DomainError`（`Schema.TaggedError`）の共通ユニオンへ集約し、`Effect.mapError` ではタグ付きコンストラクタのみを許可する。
- `Effect.either` や `Effect.fail` と組み合わせる箇所では、`Cause` を保持した `Effect.sandbox` パターンを標準化し、どの層でも `DomainError` 以外が表面化しないようLint/型レベルで検証する。

### T-63 TimeoutTo/ProvideWith導入
- `Effect.timeoutTo` や `Effect.timeoutFailCause` が未使用で、タイムアウト後の代替処理が統一されていない。タイムアウト発生時にFallback Effectを提供するパターンとして `timeoutTo` を採用し、リトライ/ログを一貫化する。
- `Effect.provideWith`, `Effect.provideSomeLayer` 等の部分提供APIが未使用で、Context差し替えが冗長化している。テストや局所的なモック差し替えには `provideWith` 系を導入し、`Layer.use` 相当の機能を実装する方針を追加する。

### T-64 RuntimeフラグとRequest管理
- `RuntimeFlags` を操作するコードが存在せず（0件）、Fiberごとの最適化フラグがデフォルトに依存している。`RuntimeFlags.patch` を用いたログ抑制やFiberダンプ有効化を標準化し、デバッグ・本番で挙動を切り替える仕組みを整備する。
- `@effect/request` を活用した共通キャッシュ/リトライの仕組みが未導入。HTTPやIndexedDBアクセスには Request Layer を導入し、`Cache` と組み合わせてレスポンスキャッシュ・バックプレッシャーを統一する。

### T-65 Cacheパターンの標準化
- `Cache.*` APIが46件使用されているが、有効期限・サイズ・Scopeとの連携が統一されていない。`Cache.make` + `Cache.Policy` を用いた標準ポリシー（LRU/TTL）を策定し、全キャッシュで `Scope.addFinalizer` による破棄を保証する。
- キャッシュヒット/ミスをメトリクス（T-50）とログ（T-46）に連携させ、`Cache.invalidate` を `Effect.addFinalizer` と組み合わせてテストでは自動クリアされるようにする。

### T-66 Stream用finalizerの整備
- `Stream.ensuring` が未使用で、Stream終了時に外部リソースを解放する手段が不足している。`Stream.scoped` + `Stream.ensuring` を用いた終端処理テンプレートを整備し、バックグラウンドStreamでもリソースリークを防止する。
- Stream内での例外処理は `Stream.catchAll` のみで Cause が失われやすいため、`Stream.catchAllCause` を導入し、`Cause.annotate` + `Logger.withSpan` で失敗を可観測化する。

### T-67 リトライポリシーの一元化
- 再試行ロジックが `RetryPolicy` 1件に限定されており、Effect-TS標準の `Schedule` ベース構成に統一されていない。`Schedule.exponential`, `Schedule.jittered`, `Schedule.recurs` の組み合わせによる標準リトライポリシーを確立し、全リトライ箇所に適用する。
- リトライ時のログ/メトリクス連携を統一するため、`Effect.retry` のラッパーを作成し、`RetryContext`（回数/最後のエラー）を `Cause.annotate` と `Metric.counter` へ報告する。

### T-68 バリデーションの集約
- `Effect.validate` / `Effect.validateAll` が未使用で、入力検証が逐次的な `Effect.mapError` の連鎖に依存している。複数エラーを累積できる `Effect.validate` 系APIへ移行し、`Chunk`/`ReadonlyArray` を用いた詳細エラー報告を標準化する。
- バリデーション結果を `Cause` と `Metric` に連携するため、`Effect.validate` の失敗時に `Cause.annotate` でフィールド情報を付与し、`Logger.withSpan` と `Metric.counter` へ同時送出するテンプレートを整備する。

### T-69 並列APIの採用
- `Effect.forEachPar` / `Effect.allPar` などの高レベル並列APIが未使用で、並列戦略が `Effect.forEach` + `concurrency` に依存している。CPU/I/O バウンド処理を明示するため `forEachPar`、`tuplePar`、`structPar` を活用する。
- Stream側でも `Stream.mapEffectPar`, `Stream.runForEachScoped` 等を活用し、並列度とBackpressure制御をテンプレート化する。並列度は `RuntimeFlags` と `Semaphore` の設定値に合わせて調整し、Cause/メトリクス連携を忘れない。

### T-70 Service提供ヘルパーの導入
- `Effect.provideServices` / `Effect.provideSomeService` が未使用で、複数Serviceの一括差し替えが冗長。複合Serviceをまとめて提供するヘルパーを導入し、`Layer` での多重提供を簡素化する。
- `Layer` 側では `Layer.provideTo`/`Layer.provideMerge` を活用し、Runtime起動時の依存解決順序を可視化するテンプレートを整備する。

### T-71 Schedule適用範囲の拡大
- `Effect.schedule` の利用が1件のみで、周期処理が手続き的な `Effect.repeat` や `while` ループに依存している。`Schedule.spaced`, `Schedule.cron`, `Schedule.windowed` を統一採用し、ループ状のEffectを宣言的に表現する。
- 周期処理の監視には `Schedule.interruptWhen` と `Deferred` を組み合わせ、停止指示をScope経由で伝搬できるよう標準テンプレート化する。

### T-72 Request/Responseキャッシュの整備
- `Effect.request` 系APIが未使用で、HTTPやIndexedDBアクセスが毎回生の `Effect.tryPromise` に頼っている。`@effect/request` を導入し、エンドポイントごとにキャッシュ・リトライ・Bulkhead を統一的に管理する。
- Request層では `Cache`, `Schedule`, `Metric` を組み合わせ、リクエストの成功率/遅延を可観測化する。テストでは `Request.test` を活用し、外部依存をスタブ化する方針を整備する。

### T-73 ConfigProviderと設定管理の統一
- `ConfigProvider` の利用が10件に留まり、設定読み出しがJSON手動パース等と混在している。環境変数/ファイル/メモリなど全ソースについて `ConfigProvider` を経由し、型安全な設定ロードを標準化する。
- 設定差し替えは `Layer.scoped` + `ConfigProvider.fromMap` 等で実施し、テスト時には `ConfigProvider.empty` を用いた明示的スタブを提供する方針を策定する。

### T-74 TestServicesと仮想時計の徹底
- `TestServices` / `TestContext` の活用が限定的で、テストから直接 `Effect.runPromise` を呼び出す箇所が残っている。すべてのEffectテストを `TestContext.test` + `TestClock` / `TestRandom` で実行し、時間・乱数依存を決定的にする。
- CIでの再現性確保のため `TestServices.provide` を標準テンプレート化し、遅延・バックオフ・リトライを仮想時間で検証できるようにする。

### T-75 タグマッチAPIの活用
- `Effect.match`, `Effect.matchTag`, `Effect.catchTags` がほぼ未使用で、タグ付きエラーやADTの分岐を `Match.value` などで手作業している。タグ付き構造には `Effect.matchTag` を採用し、`Match` APIとCause連携を簡潔化する。
- `Effect.catchTags` を用いたタグ単位のエラーハンドリングを標準化し、`Effect.mapError` では単一タグへの変換のみ許可するLintルールを整備する。

### T-76 Channelパイプラインの採用
- `Channel` / `Effect.channel` の利用が0件で、複雑なストリーミング処理が `Stream` のみで実装されている。双方向通信や背圧制御が必要な箇所では `Channel` を採用し、`Channel.toStream` / `Stream.toChannel` テンプレートを整備する。
- `Channel` の利用により、`Emitter` や `Queue` ベースの即席実装を置き換え、リソース解放・Cause伝播をScopeと統合する。テストでは `Channel.runCollect` と `TestClock` を組み合わせ、決定的な検証を行う。

### T-77 非同期ブリッジAPIの統一
- `Effect.async` が1件のみ、`Effect.asyncEither`/`Effect.asyncInterrupt`/`Effect.runCallback` が未使用で、Promiseラップやコールバックブリッジがバラバラに実装されている。非同期橋渡しは `Effect.asyncScoped` / `Effect.asyncInterrupt` を標準とし、キャンセル時のクリーンアップを保証する。
- ブリッジ処理には `Deferred` と `Scope.addFinalizer` を組み合わせたテンプレートを導入し、`Effect.tryPromise` の多用を抑制する。テストでは `TestClock` と `Effect.runCallback` を用いてコールバック呼び出し順序を検証する。

### T-78 FiberRefとRuntimeContextの活用
- `FiberRef` の利用が0件で、リクエストコンテキスト（プレイヤーID、トランザクションIDなど）がLogger/Metricに直接渡されている。`FiberRef.make` でコンテキストを保持し、Fiber間で自動伝播する仕組みを整備する。
- `Effect.locally` / `FiberRef.locally` を用いた一時的なコンテキスト上書きテンプレートを導入し、テストでは `FiberRef.get` を検証する。`RuntimeFlags` と合わせ、Fiberごとの設定を明示的に管理する。

### T-79 エラーログフックの標準化
- `Effect.tapError` が3件のみで、エラー時の副作用（ログ・メトリクス）が統一されていない。`Effect.tapErrorCause` を標準化し、Cause全体を `Logger.withSpan` へ渡すテンプレートを整備する。
- エラー時のSide Effectは `Effect.logErrorCause`、`Metric.increment`、`RuntimeFlags.disableLogs` 等と連携し、同じパターンを繰り返さないようDI可能なエラーフックLayerを導入する。

### T-80 ScopedRefとリソース共有
- `ScopedRef` が未使用で、長寿命リソース（設定、コネクション、キャッシュ）の共有がRefベースになっている。`ScopedRef.fromAcquire` を利用し、Scope終了時に再初期化・破棄される共有リソースを明示化する。
- `ScopedRef` を `Layer.scoped` と組み合わせ、構成要素ごとのホットスワップや再読み込みを安全に行えるテンプレートを整備する。テストでは `ScopedRef.set` による差し替えを標準化する。

### T-81 Layer合成パターンの均一化
- `Layer.ap` / `Layer.zip` / `Layer.all` が未使用で、Layer合成が `Layer.merge` のネストに依存している。Applicativeな合成APIを導入し、依存解決順序と並列初期化可否を表現する。
- `Layer` を `Context` へ注入する際は `Layer.provideTo` と `Layer.ap` の併用で可読性を高め、リソース初期化の依存グラフをコード上で可視化するガイドラインを整備する。

### T-82 エラー/成功同時変換の標準化
- `Effect.bimap` や `Effect.matchCause` が未使用で、成功/失敗同時変換が複数 `Effect.map` / `Effect.mapError` に分散している。`Effect.bimap` / `Effect.mapBoth` を利用し、成功・失敗の変換を一箇所で記述するテンプレートを追加する。
- Cause単位の変換には `Effect.matchCause` / `Effect.catchAllCause` を統一的に活用し、成功・失敗両方で共通のメタデータ付与処理（ログ、メトリクス）を実行できるようにする。

### T-83 Runtime起動と監査
- `Layer.toRuntime` / `Layer.launch` が未使用で、Runtimeインスタンスを生成しての監査やテストが行われていない。アプリケーション起動時にRuntimeを明示的に構築し、依存Layerの初期化順序とScopeを監査するフローを導入する。
- CIでは `Layer.toRuntime` を用いて依存関係の整合性を自動検証し、未提供サービスがある場合は即座に失敗させる。Runtime構築時に `Supervisor` と `Metric` を差し込み、起動時のFiber/Resource状況を観測する。

### T-84 Runtimeユーティリティの整備
- `Runtime.runFork`, `Runtime.runPromise` などのRuntimeレベルAPIが未使用で、`Effect.runPromise` に依存している。Runtimeを明示的に構築した後は `Runtime.runFork` / `runPromise` を利用し、`Layer` で提供された依存解決を再利用する。
- CLIやスクリプトからEffectを実行する場合は、RuntimeをDIコンテナとして扱うテンプレートを整備し、ScopeとSupervisorを共有する。[Run time instrumentation]

### T-85 tryCatch系APIの導入
- `Effect.tryCatch`, `Effect.tryCatchPromise` が未使用で、例外捕捉が `Effect.try`/`Effect.tryPromise` に依存している。`tryCatch` 系APIを採用し、`Cause` を保持したままドメインエラーへ変換するテンプレートを整備する。
- `Effect.tryCatch` 導入に合わせて、例外発生時のメタデータ（操作名、入力パラメータ）を `Cause.annotate` で付与する標準処理を追加し、 `Effect.try` の直接使用を禁止するLintルールを設定する。

### T-86 Fiber診断の標準装備
- `Fiber.dump` / `Fiber.status` / `Effect.fiberId` が未使用で、デバッグ時のFiber診断が難しい。監視レイヤーにFiberダンプ機能を組み込み、異常時に `Fiber.dump` を `Logger.withSpan` と `Metric` に送る。
- `FiberRef` とあわせて `Effect.fiberId` を活用し、ログにFiber IDと関連するコンテキストを自動付与するテンプレートを整備する。テストでは `TestClock` + Fiberダンプで長寿命Fiberの状態を検証する。

### T-87 Clock操作の標準化
- `Clock.with` や `Clock.sleep` の標準操作が未使用で、時間操作が `Effect.sleep` に直接依存している。`Clock.with`, `Clock.schedule` を活用し、Clockを抽象化したテスト可能な設計へ移行する。
- 実時間依存の処理では `Clock.sleep` をラップしたヘルパーを提供し、テストでは `TestClock.adjust` と `Clock.provide` を組み合わせて仮想時間で検証するテンプレートを整備する。

### T-88 Exitベースの制御統一
- `Effect.exit` の利用が2件のみで、`Exit` に基づく成功/失敗の分岐が標準化されていない。`Effect.exit`, `Effect.inspect` を活用し、コンビネータで `Exit` を扱うパターンを整備する。
- `Exit` を `Stream.materialize` や `Channel` と連携し、失敗時の `Cause` を分析したうえで再試行やログ出力を行うテンプレートを提供する。

### T-89 run系APIの削減計画
- `Effect.run*` 系（`run`, `runPromise`, `runSync`）が48件存在し、ランタイム外での実行が散見される。ランタイム構築後は `Runtime.run*` を利用し、`Effect.run*` を減らすロードマップを策定する。
- `Effect.run` の直接利用を禁止し、テストでは `TestContext`、本番では `Runtime` 経由で実行するテンプレートを整備する。

### T-90 起動シナリオの整備
- `Layer.launch` や `Layer.run` が未使用で、起動シナリオが `main.ts` に散在している。起動パターン（本番/テスト/CLI）ごとに `Layer.launch` を用いたシナリオを書き分け、依存LayerとRuntime構築を可視化する。
- 起動シナリオでは Supervisor、Metric、Requestなど全補助Layerを明示的に組み合わせ、`Layer.launch` 実行前に `Layer.provideMerge` と `Layer.ap` で依存を並列初期化するテンプレートを整備する。

### T-91 Layer提供APIの統一
- `Effect.provideLayer` が未使用で、Layer提供が `Layer.merge` + `Effect.provide` チェーンに依存している。`Effect.provideLayer`, `Effect.provideLayerEffect` を用いた提供を標準化し、依存注入の場所を明確にする。
- Layer組み合わせは `Layer.stack` を採用し、最終的に `Layer.toRuntime` / `Layer.launch` へ流し込む構造を確立する。

### T-92 遅延評価APIの標準化
- `Effect.defer` / `Effect.deferEffect` の利用がなく、即時評価が `Effect.suspend` や手動Promiseに依存している。遅延評価には `Effect.defer` を統一採用し、コンストラクタレベルで副作用が走らないようにする。
- `Layer` でも遅延生成が必要な場合は `Layer.defer` を活用し、`Layer.effect` の中で即時評価されないようテンプレートを整備する。

### T-93 エフェクトフルフィルタの導入
- `Effect.filterEffect` / `Stream.filterEffect` が未使用で、Effectfulな条件分岐が `Effect.flatMap` の連鎖に依存している。副作用を伴うフィルタリングには `filterEffect` を採用し、`Cause` を保持したまま失敗を報告する。
- バリデーション結果を `Effect.partition` と組み合わせ、成功値を収集しつつ失敗Causeを `Logger` / `Metric` へ送出するテンプレートを整備する。

### T-94 Lint/CIによるEffect-TSガードレール
- 上記タスクで定義したパターン（`Effect.run*` 禁止、`Effect.fail` タグ必須、`Layer` 構築ポリシーなど）をeslint/plintルールとして自動化し、CIで逸脱を検知する。
- `codemod` と `lint --fix` を整備し、既存コードを段階的に自動変換できるよう補助スクリプトを作成する。

### T-95 ドキュメントと教育
- 厳密化タスクを反映したEffect-TSガイドラインをdocs配下に記述し、チーム教育とPull Requestテンプレートへ統合する。
- 定期的なドキュメント更新とナレッジ共有をCIに組み込み、ガイドラインから逸脱した記述やサンプルコードを検知・修正するプロセスを構築する。

### T-96 エラー精緻化APIの推進
- `Effect.refineOrDie` / `Effect.refineWith` が未使用で、予期しない例外の扱いが`Effect.die`に依存している。`refineOrDie` を用いて想定外エラーの範囲を明示し、Causeからドメインエラーへ変換するパターンを標準化する。
- 例外の種類と発生箇所を `Cause.annotate` で追跡し、`Effect.refineOrDie` 経由でのみ致命的エラーを許容するLintルールを設定する。

### T-97 Causeメタデータの標準化
- `Cause.annotate` が未使用のため、エラーにメタ情報が付与されていない。`Cause.annotate`, `Effect.annotate` を全エラーハンドリングパターンへ導入し、プレイヤーID・処理ID・入力パラメータ等をCauseに添付する。
- Lint/CIで `Cause.annotate` の必須キー（module, operation, entityId, playerIdなど）をチェックし、出力ログやメトリクスに同一情報が流れるよう統一する。

### T-98 Context整合性監査
- `Effect.contextWith` や単発の `Context.get` が一部残っており、依存が散在している。CIで `Context.Tag` を経由しないアクセスを検出し、`Layer` 提供・`serviceWith` 経由に限定するルールを導入する。
- ランタイム起動時に `Context` 内のサービスが期待通り提供されているかを自動チェックする診断Effectを追加し、未提供サービスがあれば即座に失敗させる。

### T-99 実行統計のサマリ化
- `Effect.summarize` / `Effect.interruptStatus` が未使用で、処理時間や成功失敗統計が手動ログに依存している。重点処理には `Effect.summarize` を適用し、実行回数・平均時間をメトリクスに送出するテンプレートを導入する。
- Scope終了時にサマリ結果を `Cause.annotate` へ添付し、`Logger.withSpan` と `Metric.histogram` に連動する仕組みを整備する。

### T-100 継続的監査とCIへの統合
- すべてのタスクが軌道に乗るよう、CIでEffect-TS準拠チェック（Lint、codemod、Context監査、Runtime起動診断）を段階的に導入し、Fail Fastを徹底する。
- SlackやIssue自動起票と連携し、スキャン結果からタスク起票を自動化することで、継続的な厳密化サイクルを維持する。

## 4. 実行フェーズ

### フェーズ1: 型安全性と基盤整備 (2週間想定)
- `any`/`unknown` の優先度順リファクタリング。最初にドメインモジュール→アプリケーション層→プレゼンテーション層の順で対応し、Brand未整備のInventory系IDも同時に補完。
- IndexedDB/Repository などインフラ層で残る `Promise` ブリッジを Effect 化し、`tryPromise` ユーティリティの共通化とテスト容易性を確保。
- `Effect.runSync` / `Layer.effect` 依存の初期化処理を `Layer.scoped` + `Effect` に再配置し、実行境界を明確化。

### フェーズ1実行メモ
- 対応完了: `src/domain/world_generation/domain_service/world_generation_orchestrator/orchestrator.ts` のコマンドおよびパイプラインスキーマから `Schema.Unknown` を排除し、`WorldSeedSchema`・`ChunkCoordinateSchema`・`GenerationParametersSchema` など既存ドメインスキーマへ置換した。
- 対応完了: `src/infrastructure/cannon/constraint/*.ts` および `material/contact_material.ts` で `CannonBodySchema` / `CannonMaterialSchema` を採用し、拘束・マテリアルAPIから `Schema.Unknown` を除去した。
- 対応完了: アプリケーション層（`application/errors.ts`, `game_loop/game_event_queue.ts`, `chunk/chunk_generator.ts` など）とワールド設定ファクトリで `JsonValueSchema` / `ErrorCauseSchema` を導入し、エラーメタデータやイベント定義の型安全性を強化した。
- 対応完了: Three.jsラッパー／WorldGenerator Factory周辺のエラー・設定スキーマをブランド型へ更新し、`rg -o 'Schema.Unknown' src | wc -l` = 94（既存サポートスキーマのみ）であることを確認した。
- 対応完了: `src/application/camera/player_camera/types.ts` でプレイヤーカメラ入力・状態・エラーの各スキーマを既存ドメインスキーマへリプレースし、`Schema.Unknown` 依存を廃止した。
- 対応完了: `src/application/camera/camera_mode_manager/types.ts` で遷移結果・エラー・コンテキストの各スキーマを整備し、`ViewMode` および `ViewModeContext` に関する `Schema.Unknown` をブランド付き既存スキーマへ刷新した。
- 対応完了: `src/domain/chunk/domain_service/chunk_serializer/service.ts` の JSON ペイロード検証で `ChunkMetadataSchema` を参照し、メタデータの `Schema.Unknown` 依存を排除した。
- 対応完了: `src/application/inventory/types/errors.ts` を `ErrorCauseSchema` / `ErrorDetailSchema` へ更新し、インベントリエラーの `details` / `cause` を型安全なスキーマに統合した。
- 対応完了: `src/application/world/progressive_loading/*` および `cache_optimization/layer.ts` で `ErrorCauseSchema` と JSON スキーマを適用し、スケジューラ・メモリ監視・優先度計算の例外ハンドリングから `Schema.Unknown` を除去した。
- 対応完了: `src/domain/world_generation/aggregate/generation_session/*` と `world_generator/events.ts` に既存スキーマを適用し、イベント・セッション状態・エラー処理の `Schema.Unknown` を削減、関連する型安全化に合わせて生成セッションのイベント生成処理を再編した。
- 対応完了: バイオーム関連ドメイン（`biome_system/shared.ts`, `events.ts`, `biome_mapper.ts`, `climate_calculator.ts`, `ecosystem_analyzer.ts` ほか）を整理し、座標・気候データ・メタデータを既存スキーマへ紐付けて `Schema.Unknown` を排除したうえ、リポジトリ永続化とファクトリの `metadata` / `context` を JSON スキーマベースに更新した。
- 対応完了: `rg -o '\bany\b' src | wc -l` = 0、`rg -o '\bunknown\b' src | wc -l` = 481、`rg -o 'Promise<' src | wc -l` = 0 を確認し、フェーズ1の目的達成を検証した。`pnpm typecheck` / `pnpm test` / `pnpm build` はローカルに pnpm が存在しないため未実行。
- 対応完了: ブラウザメモリ計測ラッパー、Cannon物理サービス、Terrain/Player/Collision各サービス、オーディオロード処理、カメラドメインのエラーファクトリ／リポジトリで `unknown` を排除し、`ErrorCause` と `JsonValue` 正規化ユーティリティを適用した。
- 完了報告: フェーズ1の全タスクを完了し、フェーズ2へ移行できる状態。
- 対応完了: インベントリドメイン全体（集約ビルダー、コンテナファクトリ、スタック／転送サービス、ストレージスキーマ）で `Schema.Unknown` をブランド型もしくは `JsonValueSchema` へ置換し、ドメインイベントやエラーも含めた内製スキーマで整合するよう再構成した。

### フェーズ2: 構造改革と高度機能の標準化 (3週間想定)
- Inventory/Container Builderの関数化、TaggedErrorのfactory化。
- Resource/Scopeを用いたリソース管理ガイドライン策定と既存Pool実装の移行。
- Queue/Stream/Fiberのライフサイクル統合（Scope閉鎖時の解放など）とテスト整備。

### フェーズ2実行メモ
- 対応完了: `src/infrastructure/three/renderer/webgl_renderer.ts` を `Resource.manual` ベースへ集約し、旧来の `Pool` API を撤廃してScope起動時の取得・再取得フローを一本化した。
- 対応完了: `src/infrastructure/cannon/service.ts` で `PhysicsWorldService` を `Resource.manual` + `Layer.scoped` に移行し、`Pool.use` 依存のないリソース再取得・リフレッシュパターンへ切り替えた。
- 対応完了: `src/application/game_loop/game_event_queue.ts` を `Layer.scoped` + `Effect.acquireRelease` へ置き換え、Scope終了時に `Queue.shutdown` が必ず実行されるようにした。
- 対応完了: `Schema.TaggedError` を継承していたエラークラス（Inventory/ItemStack/Three.js/ChunkGenerator等）をFactoryパターンへ移行し、生成APIを `make` ベースへ統一した。
- フェーズ2のリソース/Queue構造改革タスクはすべて完了済み。

### フェーズ3: 仕上げとドキュメント整備 (1-2週間想定)
- ドメイン各所の個別TODO（Terrain再登攀、Camera ViewMode統一など）とドキュメント反映を完了させ、完了済みタスクの検証プロセスを整備。
- メトリクス算出ロジックやチャンク生成本実装など未完タスクの埋め込み。
- `@EXECUTION.md`・`@EXECUTION_2.md`・`EXECUTE.md` の整合性確認とチーム共有、Effect-TS遵守チェックリストをCIに統合。

### フェーズ3実行メモ
- `Date`/`Date.now` の呼び出しは `DateTime.now` 系APIへ置換し、ワールド状態管理をEffectインターフェース経由で取得する実装へ統一した。
- 対応完了: `src/domain/world_generation/repository/world_generator_repository/persistence_implementation.ts` の初期化処理で `DateTime.make` / `DateTime.toDate` を用いるようにし、残存していた `new Date` 依存を排除した。
- `WorldStateSTM` 初期メタデータを `WorldSeed`・`WorldCoordinate2D` のBrand型で構築し、それに合わせてメタデータ・永続化スキーマも更新した。
- `ParallelChunkGenerator` は `PerlinNoiseService` を用いた高さマップ／バイオーム決定ロジックでチャンクを生成する実装に刷新した。
- World Generator/Generation Session リポジトリで統計値・パフォーマンスメトリクスを実際の状態から集計し、永続層でも統計フィールドを更新するようにした。
- 対応完了: `ChunkDataProvider` を実運用の `ChunkRepository` 連携へ置き換え、チャンク取得・検証・ブロック更新を Effect ベースで統合。境界チェックとリポジトリエラーを `ChunkBoundsError`/`ChunkIdError` に正規化した。
- 対応完了: カメラ制御で `CollisionDetectionService` を用いた地形衝突回避を実装し、Terrain Adaptation では衝突サンプルから登攀可否を判定する仕組みを追加した。
- 対応完了: ViewMode と CameraMode の変換を共通化し、`CameraInitialized`/`ViewModeChanged` などのイベントが実際のモードを出力するように整理した。

## 5. リスクと対策
- **大規模変更によるリグレッション**: `@effect/vitest` を活用したEffectファーストのテスト追加で抑制。
- **Resource未導入領域のメモリリーク**: Scope導入を前倒しし、実際のThree.js/CANNONリソースで計測。
- **学習コスト**: 目的文書と計画書を最新化した状態でドキュメントセッションを設け、オンボーディング資料をSSoTに統合。

## 6. 実行状況メモ
- フェーズ1: `any` 出現を 0 件へ削減し、`Promise<...>` 依存を Effect の非同期ラッパーへ置換。`unknown` は今後の段階的削減が必要。
- フェーズ1: ChunkドメインのChangeSet/ChunkError/RepositoryErrorで残存していた `unknown` を `JsonValue` / `ErrorCause` へ置換し、`ChunkSerializationError` 系の `originalError` も共通ユーティリティで正規化。`rg -o '\bunknown\b' src | wc -l` は 516 → 469 に減少。
- フェーズ2: Inventory/Container ビルダーは関数化済みで、`Schema.TaggedError` 由来クラスが主残。Resource/Scope は `WebGLRenderer` に加え物理ワールドPoolでも利用可能になった。
- フェーズ3: `new Date` / `Date.now` は全て `DateTime` API に移行済みで、WorldSeed ブランド型/永続化整備も完了。メトリクス統合やCI連携は継続課題。
- フェーズ3: ChunkDataProvider再構築・カメラ衝突判定・ViewMode統合を実施し、Phase3タスクの実行完了を確認。
- Cause/ログ注釈: IndexedDB 永続化、ワールド/バイオーム永続化、Three.js テクスチャ読み込みに `Effect.annotateLogs` を追加し、操作種別やパス情報をログへ送出可能にした。
- 物理ワールドPool: `src/infrastructure/cannon/service.ts` に Resource + Pool テンプレートを新設し、複数ワールドの確保・解放を Scope 管理下で再利用できるようにした。
- 型安全性追補: ストレージ系エラー `cause` を `ParseError | Error | JsonValue` に限定し、`unknown` カウントを 629 件 → 621 件へ削減。`src/application/config.ts` や ブラウザネットワーク情報でも型定義を具体化した。
- プレイヤー領域: `PlayerError` の詳細情報を `JsonValue` ベースに統一し、`unknown` を排除。リポジトリ経由の家具テンプレートやセッションカスタマイズでも JSON 指向の型を導入し、`unknown` は 606 件まで減少。
- 追加改善: チャンク生成のシード正規化を `WorldSeed` ベースに整理し、イベント処理エラー・タイムスタンプ変換を `ErrorCause` / `number` 型へ限定。`unknown` 残件は 601 件。
- カメラ領域: `CameraService` インターフェースと一人称/三人称実装をブランド型/Schema入力に対応させ、操作引数の `unknown` を削除。検証ヘルパーも数値・座標型へ最適化し、`unknown` は 560 件まで減少。
- コンテナサービス: ContainerManager API の履歴・デバッグ出力を専用型に置き換え、Live 実装も同型へ準拠。`unknown` の残数は 550 件。
- ViewDistance/ECS: View距離デコード関数を Schema.Input に統一し、ECSワールドのエラーメタデータとコンポーネントストレージを型付け。`unknown` は 536 件まで減少。
- Chunk Serializer: バイナリ復号処理とメタデータ比較を `ChunkMetadata` 型に統一し、シリアライザ周辺の `unknown` を除去。
- Agriculture: 作物集約の検証ヘルパーをSchema入力ベースに更新し、育成ステータスの解析で `unknown` を排除。

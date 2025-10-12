# DDD.md から抽出した設計上の懸念点

## 1. ドメイン層にインフラ実装が常駐している
- 該当箇所: DDD.md 5.5「repository/」および 6.3–6.4 の `memory.ts` / `persistent.ts` 標準パターン、9.1 の Layer 統合例。
- 内容: ドメイン配下に `Layer.effect` を介した Repository 実装と IndexedDB 依存 (`IndexedDBService`) が配置され、Domain 層が永続化技術を直接参照している。
- 問題点: 「Domain → Domain のみ」とする 3.2 の依存制約に反し、インフラ変更時にドメイン構造の変更が必須になる。DDD の戦略的分離が形骸化し、テスト容易性も Layer 実装に縛られる。
- 対応方針: リポジトリは Domain で抽象インターフェースのみ公開し、IndexedDB などの具体実装は infrastructure/composition 配下へ移し、Effect Layer の組み立ては Application 層で注入する。

## 2. ドメイン層が DI/ライブ実装を抱え込んでいる
- 該当箇所: 4.3 inventory BC 構成における `inventory-service-live.ts`、5.4/5.5 の Layer ベース実装、9.1 の `CameraServiceLive` など。
- 内容: `<Service>Live` や Repository Live 実装がドメイン階層に常駐し、Effect Layer による依存解決が Domain フォルダ内で完結している。
- 問題点: 実行時構成は本来 Infrastructure 層の責務であり、Domain は抽象契約の提供に留めるべき。現在の構造では環境差分（テスト/本番）ごとにドメイン配下を編集する必要が生じ、関心分離を損なう。
- 対応方針: `<Service>Live` などのライブ実装を infrastructure 層へ移し、Domain にはサービス契約とテストダブルのみ残して Application 層で Layer/DI を構成する。

## 3. CQRS コマンド/クエリがドメイン層に滞在している
- 該当箇所: 7.3 inventory BC の `src/domain/inventory/types/commands.ts`・`queries.ts`。
- 内容: Command/Query DTO を Domain の型定義として保持し、Application 層の API サービスから直接参照している。
- 問題点: コマンドはユースケース境界の表現であり Application 層の語彙に属する。Domain が CQRS DTO に依存すると、ユースケース追加・変更ごとに Domain 型が揺れ、戦術的 DDD とユースケース設計の分離が崩れる。
- 対応方針: Command/Query DTO を Application 層へ移管し、Domain はユースケースが利用する集約・値オブジェクトに集中させ、境界越えのマッピングを Application サービス側で実施する。

## 4. プレゼンテーション層の依存方向が自己矛盾
- 該当箇所: 3.2 依存制約（Presentation → Application）と 10.2 React 統合例。
- 内容: 10.2 の `InventoryPanel` は `InventoryService`（Domain）と `MainLayer` を直接参照し、Presentation 層から Domain 層へ依存が伸びている。
- 問題点: レイヤー制約の記述と実装ガイドのサンプルが矛盾し、UI 実装者が Application 層を経由しないアンチパターンを踏襲する恐れがある。イベント/状態同期の責務が UI 側に流れ込み、ユースケースロジックが散在する。
- 対応方針: React 統合例を Application 層ユースケースのファサード（例: `InventoryApplicationService`）経由に改訂し、Presentation 層が参照するのは DTO とイベントハンドラに限定する。Domain 層で行っている Layer 組み立ては Composition ルートへ移し、Hook/Adapter で UI イベントをユースケース呼び出しへ変換するガイドを整備する。

## 5. Bounded Context 境界が技術基準に偏重
- 該当箇所: 4.2「Bounded Context一覧」。
- 内容: `camera`・`chunk`・`world_generation`・`physics` など、エンジン技術やサブシステム単位で BC を定義し、26 BC 中 19 個は「その他」とだけ示されている。
- 問題点: ユビキタス言語に基づく業務ドメインのまとまりが不明確で、技術的関心ごとに境界を切っている。コンテキスト境界の重複や責務の欠落が発生しやすく、チーム分割やモデル整合性の指針として機能しない。
- 対応方針: イベントストーミングでプレイヤー体験と業務語彙を整理し、ユースケース起点の Bounded Context を再定義する。技術モジュールは各 BC の内部モジュールへ収容し、BC 一覧にはユビキタス言語による名称・責務・代表ユースケースを記載して「その他」区分を撤廃する。

## 6. ドメインのロジックが Effect/Schema に過度依存
- 該当箇所: 5.2 aggregate／5.3 value_object の実装パターン。
- 内容: 集約操作でも `Schema.decodeUnknown`・`Effect.gen` を多用し、純粋なドメイン演算が副作用コンテキスト越しでなければ成立しない設計になっている。
- 問題点: 単純なドメイン計算が Effect に包まれ、テストやリファクタリング時にモナディック制御が必須となる。ユビキタス言語で表現されるルールよりライブラリ API が前面に出てしまい、ドメインモデルの意図が読み取りづらい。
- 対応方針: Schema/Effect は入力検証と副作用境界に限定し、集約操作は純粋関数 `calculate*` 系へ分離する。`Effect.gen` を多用するサービスは Application 層へ持ち上げ、Domain ではポート経由の値変換とルール評価のみを担う構造に改修する。

## 7. 物理ドメインが Cannon-es を直接操作
- 該当箇所: `src/domain/physics/service/cannon.ts:4` 以降。
- 内容: ドメインサービス `makeCannonPhysicsService` が `cannon-es` の `World` 生成や剛体管理を直接行い、マテリアル・レイキャスト・ボディ更新などインフラ依存の手続きを内包している。
- 問題点: 物理エンジンという技術的詳細がドメイン層に漏出し、別実装（例: PhysX）へ差し替える際にドメインコード全体が巻き込まれる。イベントや計算ルールといった純粋なモデル表現が技術 API 操作に埋もれる。
- 対応方針: 物理演算の契約を表す `PhysicsEnginePort` を Domain 層で定義し、`cannon-es` 依存コードは Infrastructure 層のアダプタへ移設する。マテリアルや設定は値オブジェクト化してポート引数に渡し、Composition 層でエンジンごとの差し替えができる Layer 構成にする。

## 8. ドメインリポジトリがブラウザ API を直接利用
- 該当箇所: `src/domain/inventory/repository/inventory_repository/persistent.ts:109` 以降。
- 内容: `InventoryRepositoryPersistent` が `localStorage` への読み書きを直に実装し、JSON パースや `setItem`、オートセーブ処理まで抱え込む。
- 問題点: ブラウザ環境固有の IO を扱うことでドメインが実行環境に固着し、テスト時のモックや他プラットフォームへの移行が困難になる。本来は Infrastructure 層で管理すべき責務。
- 対応方針: `InventoryRepository` は永続化ポートを抽象契約として保持し、`localStorage` 操作は Infrastructure 層の `InventoryRepositoryLocalStorageAdapter` に閉じ込める。ブラウザ API への依存は Composition 層で注入し、Domain は永続化結果のイベントと例外制御に専念できるよう責務を整理する。

## 9. ドメインリポジトリが Node.js ファイルシステムへ依存
- 該当箇所: `src/domain/inventory/repository/item_definition_repository/json_file.ts:36` 以降。
- 内容: `ItemDefinitionRepositoryJsonFile` が `require('fs')` や `path` を用いたファイル IO、バックアップ生成、ディレクトリ作成を行っている。
- 問題点: Node.js のファイルシステム API が Domain 層に入り込み、サーバー／クライアント双方で同一コードを共有する設計が破綻する。永続化手段の差し替えにも大規模なドメイン改修が必要になる。
- 対応方針: ファイル IO やバックアップ処理はインフラ層へ移設し、Domain には ItemDefinition リポジトリのポートとエンティティ変換だけを残す。

## 10. ドメインが Application 層を再輸出
- 該当箇所: `src/domain/equipment/types.ts:1`。
- 内容: ドメインのエントリーポイントが `EquipmentServiceLive` など Application 層の Layer をそのまま re-export している。
- 問題点: Onion アーキテクチャの依存方向を逆行させ、Application の実装変更が Domain の公開 API に波及する。ユースケースとモデリングの境界が曖昧になり、利用側が層分離の意図を理解できなくなる。
- 対応方針: Domain エントリポイントでは集約・値オブジェクト・ポートのみを輸出し、`EquipmentServiceLive` などの具象 Layer は Application/Composition 側で Facade（例: `createEquipmentUseCase`）として組み立てる。既存の参照箇所を洗い出して Facade 経由に差し替え、境界の責務をドキュメント化する。

## 11. ドメイン層で実行環境による実装切り替えを実施
- 該当箇所: `src/domain/inventory/repository/layers.ts:17-118`。
- 内容: `InventoryRepositoryLayers.auto` などが `window`・`localStorage`・`process` を参照し、ブラウザ/Node.js を判別して永続化方式を選択している。
- 問題点: 実行環境検出と構成選択は Infrastructure/Composition 層の責務であり、ドメインがプラットフォーム条件分岐を持つと再利用性とテスタビリティが低下する。ユースケースごとの Layer 差し替えもドメインファイルの編集を伴ってしまう。
- 対応方針: 実行環境判定と Layer 構成をブートストラップコードへ抽出し、Domain 層では `InventoryRepositoryPort` など抽象依存だけを宣言する。ブラウザ/Node の分岐は DI コンテナや設定モジュールで解決し、Domain ファイルに環境条件分岐が現れないよう整理する。

## 12. ドメインリポジトリがブラウザ API の利用可否を直接判定
- 該当箇所: `src/domain/chunk/repository/strategy/repository_strategy.ts:88-154`、`src/domain/inventory/repository/container_repository/persistent.ts:80` 付近。
- 内容: `window`・`indexedDB`・`Worker`・`navigator.connection` などブラウザ固有 API の存在確認や性能推定をドメインロジックに組み込んでいる。
- 問題点: プラットフォーム診断がドメイン層に常駐し、ビジネスルールより環境依存コードが主導する構造になっている。別環境（サーバー/テスト）では分岐が破綻し、DDDの普遍的なモデル表現から乖離する。
- 対応方針: ブラウザ API の機能検出を `EnvironmentCapabilitiesPort` として抽象化し、インフラ層で `indexedDbAvailable` や `workerThreadsAvailable` 等のフラグを提供する。Domain 側は受け取った能力フラグを基に戦略を切り替え、実際の API 判定コードを保持しない。

## 13. ドメインリポジトリが複数の永続化詳細を抱え込み過ぎている
- 該当箇所: `src/domain/chunk/repository/chunk_repository/indexeddb_implementation.ts:42` 以降、`src/domain/world/repository/world_metadata_repository/persistence_implementation.ts:23` 以降、`src/domain/biome/repository/biome_system_repository/persistence_implementation.ts:27` 以降。
- 内容: IndexedDB のオープン手続きや Node.js ファイルシステム（`fs`/`path`）を直接操作しており、永続化戦略ごとにドメイン配下へ実装が増殖している。
- 問題点: ポート/アダプタの境界が不明瞭で、インフラ選択を変更するたびにドメインコードが巻き込まれる。また Node.js API を含むため共有ライブラリとしての利用（ブラウザ・ワーカーなど）が制限される。
- 対応方針: 永続化戦略ごとにポートを定義し、IndexedDB や Node FS などの具象アダプタは infrastructure 層へ移管して Domain から外す。

## 14. ドメインでハードウェア検出が行われている
- 該当箇所: `src/domain/world_generation/factory/generation_session_factory/configuration.ts:176-211`。
- 内容: `detectHardwareSpec` が `navigator.hardwareConcurrency` などブラウザ固有 API を直接参照し、CPU コア数等を推定している。
- 問題点: ハードウェア/環境検出はインフラ層やブートストラップで行うべきであり、ドメインがプラットフォーム API に依存すると他環境（サーバー、テスト）での利用が破綻する。ユースケースの純粋なルールが環境依存ロジックに埋もれる。
- 対応方針: ハードウェア検出ロジックを起動時構成サービスへ移し、Domain には必要な設定値（スレッド数等）だけを渡す。

## 15. ドメインがブラウザの Performance API に依存
- 該当箇所: `src/domain/performance/memory_schema.ts:1-120`、`src/domain/chunk/aggregate/chunk/performance_optics.ts:473-495` など。
- 内容: `performance.memory` や `performance.now()` をドメイン層が直接呼び出し、メトリクス測定や最適化判定を行っている。
- 問題点: 実行プラットフォーム固有の API をドメイン側が意識する形になり、テストダブル差し替えや環境非依存な評価が難しくなる。計測・監視はアプリケーション/インフラ層に委ね、ドメインには抽象化された時間・計測ポートを渡すべき。
- 対応方針: 計測 API への依存を抽象化したタイマー/メモリ監視ポートに置換し、Effect/time 測定はアプリケーション・インフラで実装する。

## 16. World BC が World Generation BC を再輸出
- 該当箇所: `src/domain/world/repository/index.ts:12-47`。
- 内容: World リポジトリのインデックスが `world_generation` のリポジトリ実装と設定型をそのまま re-export し、`world` BC の外へ公開している。
- 問題点: Bounded Context 間の境界が事実上消え、World BC を利用する側が World Generation の内部契約に直接依存してしまう。コンテキスト境界の互換性保証や独立進化が阻害され、DDD のコンテキスト分離が形骸化する。
- 対応方針: World BC の公開 API を再設計し、他 BC の実装を再輸出せずにポート経由で連携させ、相互依存は Application 層が調停する。

## 17. Domain 層で Layer 組み立てと構成選択を担っている
- 該当箇所: `src/domain/world/layers.ts:1-84`。
- 内容: World Domain Layer が Repository 実装の選択（`memory`/`mixed`/`persistence`）、他 BC（world_generation・biome）との Layer 組み合わせ、構成モード（default/performance/quality）の解決まで行っている。
- 問題点: 実行時構成や他 BC の束ねは Application/Bootstrap 層の責務であり、Domain が環境モードや依存 Layer を組み立てると関心が混在し、ユースケース側での柔軟な構成変更が困難になる。
- 対応方針: Layer 組み立て・モード選択は Application/Bootstrap 層のコンポジションに移し、Domain 層では必要なポート定義とデフォルト構成情報のみに留める。

## 18. Chunk リポジトリ戦略が環境検出と WebWorker 制御を内包
- 該当箇所: `src/domain/chunk/repository/strategy/repository_strategy.ts:42-340`、`webworker_implementation.ts:5-12`。
- 内容: Domain 内で `window`・`self`・`Worker`・`indexedDB` の存在チェックを行い、WebWorker 実装や永続化方式を自動選択している。WebWorker 専用 Layer も Domain 配下に存在。
- 問題点: 実行環境に応じた実装切り替えはインフラ層のポリシーであり、Domain に WebWorker/ブラウザ固有の分岐が入ると他プラットフォームやテストで再利用しづらい。ポート/アダプタ境界が崩れる。
- 対応方針: 環境検出と WebWorker 選択をインフラ層のストラテジー/ファクトリに分離し、Domain には永続化ポートと選択結果を渡すだけにする。

## 19. Domain レベルの設定にインフラ詳細が混入
- 該当箇所: `src/domain/world/repository/index.ts:31-76`、`world_metadata_repository/interface.ts:1-160`。
- 内容: Domain の設定型が `compression.algorithm`（gzip/brotli 等）、`backup`、`storage.type`（memory/persistence）など技術的パラメータを保持し、Repository インターフェースでも圧縮やバックアップ戦略が前提になっている。
- 問題点: Domain モデルが永続化テクノロジーや運用ポリシーに固着し、実装差し替え時にドメイン型自体を変更せざるを得なくなる。DDD のポート/アダプタ分離やモデリングの独立性が損なわれる。
- 対応方針: Domain の設定型から技術的パラメータを排除し、圧縮方式やバックアップといった詳細はインフラ構成オブジェクトへ移動させる。

## 20. Domain サービスがロギングを直接実行
- 該当箇所: `src/domain/physics/service/cannon.ts:206-500`、`src/domain/world_generation/domain_service/world_generation_orchestrator/*.ts`、`src/domain/chunk/aggregate/chunk/performance_optics.ts:473-513` など。
- 内容: `Effect.logInfo`/`Effect.logWarning`/`Effect.logError` を通じて Domain 内でログ出力・メトリクス記録を行っている。
- 問題点: ロギングは技術的横断関心であり、Domain ロジックに組み込むと純粋性が失われる。テスト時に副作用抑制が必要になり、ユースケース側でのロギング方針変更が困難になる。
- 対応方針: ロギングは Logger ポートを介してアプリケーションから注入し、Domain では副作用を発生させずにイベントや結果のみを返す。
## 21. Node.js 固有のメモリ API へ依存
- 該当箇所: `src/domain/chunk/repository/chunk_query_repository/implementation.ts:734-775`。
- 内容: クエリ性能計測で `process.memoryUsage()` を直接呼び、ヒープ差分を算出している。
- 問題点: `process` は Node.js 専用 API のため、ブラウザや Worker では動作せず、Repository が実行環境と結び付いてしまう。性能監視はインフラ層に切り出すべき。
- 対応方針: メモリ計測はモニタリング用のポートを定義し、Node/ブラウザ実装をインフラ側で用意して Domain には抽象化された計測値を注入する。

## 22. ドメインリポジトリが待機シミュレーションを行う
- 該当箇所: `src/domain/world_generation/repository/generation_session_repository/memory_implementation.ts:900-906`、`session_recovery.ts:166`。
- 内容: セッション復旧やリカバリ分析で `Effect.sleep` を直接実行し、擬似的な待機時間を挿入している。
- 問題点: 実際のスケジューリングや遅延シミュレーションはアプリケーション/インフラ側の責務であり、ドメインが時間制御を持つとテストや別環境での再利用が困難。
- 対応方針: 待機処理はアプリケーション層のジョブスケジューラへ移し、Domain は遅延の必要性をイベントやフラグで伝えるだけに留める。

## 23. `structuredClone` などブラウザ API 前提のコピー処理
- 該当箇所: `src/domain/inventory/repository/inventory_repository/persistent.ts:498`、`memory.ts:270`、`container_repository/persistent.ts:458`、`world_generation/domain_service/world_generation_orchestrator/error_recovery.ts:324-344` など。
- 内容: 状態スナップショットの複製に `structuredClone` を使用しており、ブラウザ実装を前提にしている。
- 問題点: Node.js や一部環境では未実装のため、純粋なデータコピー手段を Domain 層に持たせると互換性が崩れる。シリアライズ/コピーはインフラ抽象を介すべき。
- 対応方針: データ複製はシリアライザーポートに委譲し、Domain では純粋なデータ構造操作を行い、環境依存のコピー手段はインフラ側で差し替える。

## 24. ドメインが暗号化実装を直接扱う
- 該当箇所: `src/domain/world/repository/world_metadata_repository/persistence_implementation.ts:21-278`。
- 内容: Node の `crypto` モジュールで AES 暗号・復号を実装し、鍵管理まで担っている。
- 問題点: セキュリティ実装はインフラ/アプリケーション層の責務であり、Domain が暗号モジュールに依存すると環境に縛られるうえにセキュリティ要件の差し替えが難しい。
- 対応方針: 暗号化・鍵管理はセキュリティポートを介してインフラ層に委任し、Domain では暗号化されたデータ契約とエラー処理のみを扱う。

## 25. Web Crypto 依存のハッシュ計算
- 該当箇所: `src/domain/chunk/domain_service/chunk_validator/service.ts:154-156`、`chunk_serializer/service.ts:436-438`。
- 内容: チャンク整合性検証に `crypto.subtle.digest` を直接呼び出し、Web Crypto API を仮定している。
- 問題点: Web Crypto が存在しない Node などでは失敗する。ハッシュ計算はポート化してインフラで差し替えられるようにするべき。
- 対応方針: ハッシュ計算ポートを定義し、Web Crypto/Node Crypto など複数実装をインフラ側で提供することで Domain からランタイム依存を排除する。

## 26. Node Buffer / zlib による圧縮処理をドメインが所有
- 該当箇所: `src/domain/chunk/domain_service/chunk_serializer/service.ts:3-4`。
- 内容: `node:buffer` や `node:zlib` を import し、Brotli/GZip 圧縮を直接実装している。
- 問題点: 圧縮アルゴリズムの選択・実行は技術的詳細であり、Domain 層が Node 専用 API に依存するとブラウザ移植が不可能になる。
- 対応方針: 圧縮・展開は圧縮ポート経由で扱い、具体的なアルゴリズム選択とバッファ操作はインフラアダプタに委任する。

## 27. ガーベジコレクタ呼び出しをドメインで実行
- 該当箇所: `src/domain/chunk/aggregate/chunk/composite_operations.ts:468-481`、`chunk/performance_optics.ts:437-452`。
- 内容: メモリ最適化処理で `global.gc?.()` を呼び、ランタイム GC を直接起動している。
- 問題点: GC 制御はランタイム依存の技術詳細であり、Domain ロジックがこれを持つとテストや異なる VM で破綻する。
- 対応方針: メモリ回収要求はイベントやメトリクスとして通知し、GC トリガーはインフラ/運用層で制御する。

## 28. IndexedDB リポジトリが人工遅延を注入
- 該当箇所: `src/domain/chunk_system/repository.indexeddb.ts:12-33`。
- 内容: `simulateLatency` で `Effect.sleep(Duration.millis(2))` を必ず実行し、疑似的な I/O 待機を再現している。
- 問題点: 遅延シミュレーションはテスト専用のインフラ関心であり、Domain の Repository 実装に組み込むと本番・テスト双方で制御できない。
- 対応方針: 疑似遅延はテスト用アダプタや Application 層のテストダブルで注入し、Domain の永続化処理からは外す。

## 29. ワールド生成パイプラインが固定スリープを持つ
- 該当箇所: `src/domain/world_generation/domain_service/world_generation_orchestrator/generation_pipeline.ts:474-517`。
- 内容: 各ステージで `Effect.sleep(Duration.millis(...))` を直接呼び、処理時間をハードコードしている。
- 問題点: ビジネスロジックとスケジューリングが混在し、テストで高速化できない。スリープ制御はインフラ層の責務。
- 対応方針: ステージの待機制御はスケジューラポートを介して Application 層に任せ、Domain は進行状態と要求タイミングのみを指示する。

## 30. CommonJS `require` 前提のファイルアクセス
- 該当箇所: `src/domain/inventory/repository/item_definition_repository/json_file.ts:43-89`。
- 内容: `typeof require !== 'undefined'` で CommonJS 可否を判定し、`require('fs')` / `require('path')` に依存。
- 問題点: ES Modules やブラウザ環境では `require` が存在せず、Domain がモジュールシステムに依存してしまう。
- 対応方針: ファイルアクセスは抽象ポート越しに行い、CommonJS/E SM の分岐やモジュール解決はインフラ層のアダプタで処理する。

## 31. `TextEncoder` など Web API によるサイズ計測
- 該当箇所: `src/domain/chunk/domain_service/chunk_serializer/service.ts:90-309`、`src/domain/world/repository/world_metadata_repository/interface.ts:799` など。
- 内容: バイト長推定に `TextEncoder` を直接利用し、Web API の存在を前提としている。
- 問題点: Node のバージョン差や他ランタイムで互換性が保証されず、Domain モデルの計測が環境依存となる。
- 対応方針: エンコード/サイズ計測ポートを定義し、ブラウザ・Node それぞれの実装をインフラ側に切り出して Domain は抽象化されたインターフェースを利用する。

## 32. ワールド生成リポジトリが Node バッファと zlib を直接利用
- 該当箇所: `src/domain/world_generation/repository/world_generator_repository/persistence_implementation.ts:21-300`。
- 内容: `node:buffer`・`zlib` を import し、圧縮／展開やバイナリ処理をその場で行っている。
- 問題点: Node 専用 API により、Domain 層がランタイムと密結合し、他環境への移植やテストダブル差し替えが困難。
- 対応方針: バッファ操作・圧縮処理はインフラアダプタへ移し、Domain では圧縮結果の契約とバリデーションのみに集中する。

## 33. バイオームリポジトリも Node ファイルシステムへ依存
- 該当箇所: `src/domain/biome/repository/biome_system_repository/persistence_implementation.ts:27-232`。
- 内容: `fs`・`path`・`zlib` を使って JSON 圧縮・バックアップを実装。
- 問題点: こちらも Domain がリソース I/O と圧縮を直に担っており、Bounded Context 全体が Node 依存になる。
- 対応方針: リソース I/O と圧縮の責務を分離し、Domain はポートを通じてデータの保存/取得を要求するだけにする。

## 34. ドメインが `crypto.randomUUID` で ID を生成
- 該当箇所: `src/domain/world_generation/factory/world_generator_factory/factory.ts:437`、`generation_session_factory/factory.ts:452`。
- 内容: 生成 ID を `crypto.randomUUID()` で直接生成している。
- 問題点: ID 生成はインフラポートとして外出しすべきであり、ランタイム依存の関数を Domain が直接呼ぶとテスト時の決定性や差し替えが難しい。
- 対応方針: ID 生成サービスをポート化し、テスト用の決定的実装と本番用のランダム実装をアプリケーション/インフラ層から注入する。

## 35. ドメインイベントの識別子生成もランタイム依存
- 該当箇所: `src/domain/world/types/events/world_events.ts:518`、`lifecycle_events.ts:500-565`。
- 内容: イベント作成時に `crypto.randomUUID()` を直接利用。
- 問題点: イベント ID はドメイン固有の値オブジェクトとして扱うべきで、生成戦略はポート経由で切り替えられるようにする必要がある。
- 対応方針: イベント ID を値オブジェクト化し、生成は ID ポートを通じて行うように改修する。

## 36. 自動保存スケジューリングをドメインが内包
- 該当箇所: `src/domain/inventory/repository/inventory_repository/persistent.ts:189-237`。
- 内容: `setupAutoSave` で `autoSaveInterval` を評価し、（コメントアウトとはいえ）`setInterval` によるスケジューリングを視野に入れている。
- 問題点: バックグラウンドジョブの実行制御はアプリケーション層の責務であり、Domain Repository が時間ベースの副作用を持つと関心の分離が崩れる。
- 対応方針: 自動保存はアプリケーション側のジョブ管理へ切り出し、Domain リポジトリは保存リクエストの受け付けと状態変換のみに集中する。

## 37. リポジトリの未実装メソッドがドメインに残存
- 該当箇所: `src/domain/world_generation/repository/generation_session_repository/memory_implementation.ts:914-933`。
- 内容: `archiveCompletedSessions` や `cleanupOldCheckpoints` が `Effect.succeed(0)` を返すスタブのまま。
- 問題点: Domain 契約を満たさないダミー処理が残ると、上位層が擬似的な成功に依存してしまい、モデリング上一貫性が確保できない。
- 対応方針: 未実装メソッドは Application/インフラ層の具体的な実装へ接続するか、不要であればインターフェース定義から削除し契約を再定義する。

## 38. リポジトリがパフォーマンスメトリクスを保持
- 該当箇所: `src/domain/chunk/repository/chunk_query_repository/implementation.ts:720-771`。
- 内容: `performanceMetricsRef` にクエリ実行時間やメモリ使用量を蓄積し、監視機能まで担っている。
- 問題点: メトリクス収集は監視インフラの関心であり、Domain Repository が分析データを保持すると責務が肥大化する。
- 対応方針: メトリクス収集は監視サービスのポートに移し、Domain は必要なイベント/統計を通知するだけにする。

## 39. バックアップ生成をドメインが直接実行
- 該当箇所: `src/domain/inventory/repository/item_definition_repository/json_file.ts:158-188`。
- 内容: `fs.copyFile` でバックアップファイルを作成し、失敗時には `console.warn` を出力。
- 問題点: バックアップ策略・ローテーションはインフラ制御であり、Domain 側でファイルコピーを行うと導入環境ごとに差し替えられない。
- 対応方針: バックアップ戦略はインフラ層へ外出しし、Domain からはバックアップ要求やメタデータのみを発行する。

## 40. ドメインリポジトリがイベントキューを内製
- 該当箇所: `src/domain/chunk_system/repository.indexeddb.ts:14-30`。
- 内容: `Queue.unbounded` と `Stream.fromQueue` によりイベントブロードキャストを実装し、取得者へ `observe` を提供している。
- 問題点: イベント配送の仕組みはアプリケーション/インフラ側のメッセージングで扱うべきで、ドメインリポジトリが Pub/Sub を抱えると境界が曖昧になる。

## 41. World集約インデックスが他BCを再輸出
- 該当箇所: `src/domain/world/aggregate/index.ts:14-24`。
- 内容: World BC のエントリーポイントが world_generation BC の集約 (`WorldGenerator`, `GenerationSession`) をそのままエクスポートしている。
- 問題点: Bounded Context の境界が崩れ、World モジュール利用者が world_generation 内部の集約に直接依存する。コンテキスト独立性を失い、モデル進化時の影響範囲が制御できない。

## 42. Worldドメインサービスが world_generation サービスを丸ごと公開
- 該当箇所: `src/domain/world/domain_service/index.ts:7-12`。
- 内容: World ドメインサービスのインデックスが world_generation のノイズ生成・手続き生成サービスをエクスポートしている。
- 問題点: World BC が他 BC のドメインサービスを外部 API として提供しており、境界付けられた文脈同士の独立性が損なわれる。

## 43. Worldファクトリ層が world_generation ファクトリを再輸出
- 該当箇所: `src/domain/world/factory/index.ts:10-18`。
- 内容: World ファクトリの公開窓口が world_generation のファクトリ群をそのまま再輸出している。
- 問題点: world_generation の実装詳細が World BC から漏れてしまい、利用側が直接 world_generation の API に依存する構造になる。

## 44. World値オブジェクトが Biome座標を直接再利用
- 該当箇所: `src/domain/world/value_object/coordinates/index.ts:6`。
- 内容: World BC の座標モジュールが biome BC の座標値オブジェクトを `export *` している。
- 問題点: World 側のユビキタス言語で定義すべき値が別 BC の型に固定され、コンテキスト固有のモデリングができない。

## 45. Inventory Repository Layer が環境別実装を内包
- 該当箇所: `src/domain/inventory/repository/layers.ts:205-331`。
- 内容: `Development/Browser/Server/Hybrid` などの Layer を Domain 内で組み立て、環境に応じた実装をマッチングしている。
- 問題点: 実行環境の選択ロジックは本来ブートストラップ層の責務であり、Domain が環境分岐を抱えると保守ポイントが分散する。

## 46. Inventory Repository が初期化/クリーンアップを直接制御
- 該当箇所: `src/domain/inventory/repository/layers.ts:333-360`。
- 内容: `initializeInventoryRepositories` / `cleanupInventoryRepositories` で複数リポジトリのライフサイクルを Domain 側がまとめて呼び出している。
- 問題点: データストアのセットアップやシャットダウンはアプリケーション層の関心であり、Domain が一括制御すると層分離が曖昧になる。

## 47. リポジトリが直接システムクロックを参照
- 該当箇所: `src/domain/inventory/repository/inventory_repository/persistent.ts:135-220`。
- 内容: `Clock.currentTimeMillis` で保存時刻を取得し、DomainClock などの抽象を介さずにシステム時刻へ依存している。
- 問題点: テストや再現性確保のための時間抽象が無視され、環境差異に左右されるドメインロジックになる。

## 48. ドメインが乱数生成を直接使用
- 該当箇所: `src/domain/inventory/types/commands.ts:724-732` ほか各所。
- 内容: ID や仕様判定に `Random.nextIntBetween` を多用し、乱数サービスの差し替えを前提としていない。
- 問題点: ドメインルールが非決定的になり、テストやリプレイが困難。乱数生成はポートとして抽象化すべき。

## 49. キャッシュ戦略が Domain 内でスケジューリング
- 該当箇所: `src/domain/world_generation/repository/world_generator_repository/cache_strategy.ts:338-339`。
- 内容: `Schedule.fixed` で定期クリーンアップを Domain に内包している。
- 問題点: バックグラウンド処理のスケジュールはアプリケーション/インフラの責務であり、Domain がジョブ管理まで抱えると責務が膨張する。

## 50. 世代セッション永続化が Node FS を直接使用
- 該当箇所: `src/domain/world_generation/repository/generation_session_repository/persistence_implementation.ts:19-40`。
- 内容: `@effect/platform-node/NodeFileSystem` や `NodePath` を import してファイル操作を行っている。
- 問題点: Node 依存の I/O が Domain 層に入り込み、ブラウザや他環境へ移植できない。

## 51. World型ガードが world_generation の Schema に依存
- 該当箇所: `src/domain/world/typeguards.ts:1-12`。
- 内容: World の型ガードが Biome/WorldGenerator Schema を直接参照している。
- 問題点: World BC の検証が他 BC の型定義に固定され、境界が曖昧になる。

## 52. Worldファクトリヘルパーが他BCのファクトリを直接組み合わせ
- 該当箇所: `src/domain/world/factory/helpers.ts:1-60`。
- 内容: World のヘルパーが world_generation のファクトリ (`createQuickGenerator` など) を直接呼び出す。
- 問題点: World BC 内で他 BC の生成ロジックを組み立てており、境界の独立性が失われる。

## 53. Worldリポジトリ層が world_generation の設定型に結合
- 該当箇所: `src/domain/world/repository/layers.ts:9-74`。
- 内容: WorldRepositoryLayer の構成に world_generation の RepositoryConfig を直接組み込み、Layer.mergeAll で統合している。
- 問題点: World BC の永続化層が他 BC の構成型に依存し、独自のリポジトリ境界が保てない。

## 54. Worldヘルパーがアプリケーションサービスへ依存
- 該当箇所: `src/domain/world/helpers.ts:2`、`163-173`。
- 内容: Domain ヘルパーが `WorldApplicationService`（アプリケーション層）を取得してチャンク生成を委譲している。
- 問題点: Domain → Application の逆依存が発生し、層構造が完全に崩れている。

## 55. WorldDomainコンテナが ApplicationServices を同居
- 該当箇所: `src/domain/world/domain.ts:1-38`。
- 内容: WorldDomain エクスポート構造に `ApplicationServices` を含め、Domain インターフェースの一部として公開している。
- 問題点: Domain API がアプリケーション層の実装を前提にし、層分離が事実上不可能になる。

## 56. chunk_loader のアプリケーションロジックが Domain 配下に存在
- 該当箇所: `src/domain/chunk_loader/application/chunk_loading_provider.ts:1-200`。
- 内容: `application` ディレクトリが Domain ツリー内にあり、ロードキュー管理・メトリクス集計・乱数判定まで実装している。
- 問題点: アプリケーション層のユースケース実装が Domain に混在し、役割境界が崩壊している。

## 57. ドメインサービスがアプリケーションの計測メトリクスへ依存
- 該当箇所: `src/domain/world_generation/domain_service/procedural_generation/terrain_generator.ts:29-32`。
- 内容: `chunkGenerationCounter` などアプリケーション層の観測メトリクスを直接 import してカウンタ更新を行っている。
- 問題点: Domain ロジックがアプリ観測基盤に結合し、層間依存とテスト容易性を損なう。

## 58. 物理ドメインがアプリケーション監視に結合
- 該当箇所: `src/domain/physics/service/cannon.ts:1-5`。
- 内容: 物理シミュレーションが `physicsStepDuration`（アプリ観測メトリクス）を直接 import している。
- 問題点: Domain とアプリケーション層の関心が分離されておらず、メトリクス変更がドメイン再配布を伴う。

## 59. 永続化モジュールに未実装スタブが残存
- 該当箇所: `src/domain/world_generation/repository/generation_session_repository/persistence_implementation.ts:200-204`。
- 内容: `compressData` / `decompressData` が `Effect.succeed(data)` のモック実装のまま放置されている。
- 問題点: ドメイン層で未実装スタブが成功扱いになり、実際の圧縮/復元処理が行われないまま本番コードに混入する。

## 60. 擬似チェックサムをドメインが実装
- 該当箇所: `src/domain/world_generation/repository/generation_session_repository/persistence_implementation.ts:186-198`。
- 内容: `calculateChecksum` が単純な文字コード加算ハッシュで代用されている。
- 問題点: 技術的整合性を担保するべきチェックサムが健全な実装になっておらず、データ整合性保証をドメインが誤魔化している。
- 対応方針: イベント配信はメッセージングポートへ委譲し、Domain リポジトリは変更イベントを発行するだけの役割に絞る。

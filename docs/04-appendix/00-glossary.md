# 用語集

このドキュメントは、TypeScript Minecraft Cloneプロジェクトで使用される主要な技術用語やドメイン固有の概念を定義します。

## A

-   **Aggregate (アグリゲート)** {#aggregate}
    -   DDDの概念。一貫性の境界として機能するエンティティと値オブジェクトのまとまり。トランザクションは単一のアグリゲートに対してのみ行われるべきです。本プロジェクトでは、World、Player、Inventoryなどがアグリゲートとして設計されています。
-   **Ambient Occlusion (アンビエントオクルージョン)** {#ambient-occlusion}
    -   隙間や角の部分を暗くする陰影効果。リアルな陰影表現を提供し、視覚的品質を向上させます。
-   **Application Service (アプリケーションサービス)** {#application-service}
    -   DDDのレイヤードアーキテクチャの一部。ドメインロジックを呼び出し、ユースケースを実現するサービス。
-   **Archetype (アーキタイプ)** {#archetype}
    -   ECSの概念。同じコンポーネントの組み合わせを持つエンティティのグループ。クエリの最適化に使用されます。メモリレイアウトの効率化と高速なクエリ実行を実現します。
-   **AABB (Axis-Aligned Bounding Box)** {#aabb}
    -   軸に平行な境界ボックス。物理衝突検知システムで使用される基本的な形状表現。
-   **Asset Pipeline (アセットパイプライン)** {#asset-pipeline}
    -   ゲームアセット（テクスチャ、モデル、音声等）の処理・最適化・管理のワークフロー。

## B

-   **Batch Processing (バッチ処理)** {#batch-processing}
    -   複数の処理を一括で実行する手法。ECSにおいて、同じアーキタイプのエンティティをまとめて処理することでパフォーマンスを向上させます。
-   **Biome (バイオーム)** {#biome}
    -   Minecraftのワールド生成における環境の分類。草原、砂漠、森林など、異なる地形と特性を持つ地域を表現します。
-   **Block (ブロック)** {#block}
    -   Minecraftワールドの最小単位。16x16x16のブロック空間がチャンク内に格納され、ワールドの構造を形成します。
-   **Block State (ブロック状態)** {#block-state}
    -   ブロックの追加的な状態情報。方向、成長段階、開閉状態などのメタデータを保持します。
-   **Bounded Context (境界づけられたコンテキスト)** {#bounded-context}
    -   DDDの戦略的パターン。特定のドメイン領域とその言葉の境界を定義します。本プロジェクトでは、World、Player、Inventory、Physics等のコンテキストに分割されています。
-   **Broadphase (ブロードフェーズ)** {#broadphase}
    -   物理衝突検知の第一段階。空間分割や境界ボリューム階層を使用して、衝突可能性のあるオブジェクトペアを効率的に特定します。

## C

-   **Cache Locality (キャッシュ局所性)** {#cache-locality}
    -   CPUキャッシュの効率的活用のため、関連データを物理的に近い場所に配置する最適化手法。
-   **Chunk (チャンク)** {#chunk}
    -   16x16x256ブロックの単位。Minecraftワールドの管理と最適化の基本単位です。メモリ効率とレンダリング最適化のため、動的にロード・アンロードされます。
-   **Chunk Loading (チャンクローディング)** {#chunk-loading}
    -   プレイヤーの位置に基づいて必要なチャンクを動的にメモリに読み込む処理。
-   **Component (コンポーネント)** {#component}
    -   ECSのC。エンティティにアタッチされるデータの塊。Position、Velocity、Health等、純粋なデータのみを保持します。
-   **Compute Shader (コンピュートシェーダー)** {#compute-shader}
    -   GPU上で汎用計算を実行するプログラム。地形生成や物理計算などの並列処理に使用されます。
-   **Concurrent Processing (並行処理)** {#concurrent}
    -   複数のタスクを並行して実行する処理手法。Effect-TSのConcurrentを活用し、高性能な非同期処理を実現します。
-   **Context (コンテキスト)** {#context}
    -   Effect-TSの依存性注入システム。サービスやリソースへの型安全なアクセスを提供します。
-   **Culling (カリング)** {#culling}
    -   描画対象から不要なオブジェクトを除外する最適化技術。フラスタムカリング、オクルージョンカリングなどがあります。

## D

-   **Data-Oriented Design (DOD)** {#dod}
    -   データ構造とメモリレイアウトを最適化することでパフォーマンスを向上させる設計手法。ECSと相性が良い。
-   **Dependency Injection (依存性注入)** {#dependency-injection}
    -   オブジェクトの依存関係を外部から注入する設計パターン。Effect-TSでは Context を通じて実現されます。
-   **Domain-Driven Design (DDD)** {#ddd}
    -   ドメイン駆動設計。複雑なドメインのモデル化に焦点を当てたソフトウェア開発アプローチ。戦略的設計と戦術的設計の両面からシステムを構築します。
-   **Domain Event (ドメインイベント)** {#domain-event}
    -   ドメイン内で発生する重要な出来事を表現するオブジェクト。BlockPlaced、PlayerMoved、ChunkLoaded等のイベントが該当します。
-   **Domain Service (ドメインサービス)** {#domain-service}
    -   複数のアグリゲートにまたがるビジネスロジックを扱うサービス。単一のエンティティや値オブジェクトに属さない処理を担当します。
-   **DRY (Don't Repeat Yourself)** {#dry}
    -   「繰り返しを避ける」という原則。コードや情報の重複をなくし、保守性を高めます。

## E

-   **Effect (エフェクト)** {#effect}
    -   Effect-TSの核となる型。非同期処理、エラーハンドリング、依存性を統一的に表現します。Effect<Success, Error, Requirements>の形式で型安全性を保証します。
-   **Effect-TS** {#effect-ts}
    -   TypeScriptで純粋関数型プログラミングを行うためのエコシステム。副作用管理、依存性注入、並行処理、スキーマバリデーションなどを提供します。
-   **Entity (エンティティ)** {#entity}
    -   DDDの戦術パターン。一意のIDを持つドメインオブジェクト。ECSでは、コンポーネントを持つ識別子としても使用されます。
-   **Entity Component System (ECS)** {#ecs}
    -   ゲーム開発でよく用いられるアーキテクチャパターン。エンティティ（識別子）、コンポーネント（データ）、システム（ロジック）の3要素で構成されます。
-   **Event Bus (イベントバス)** {#event-bus}
    -   ドメインイベントの発行と購読を管理するシステム。疎結合なコンポーネント間通信を実現します。
-   **Event Sourcing (イベントソーシング)** {#event-sourcing}
    -   状態の変更をイベント列として記録する設計パターン。タイムトラベルデバッグや監査証跡に有用です。

## F

-   **Factory Pattern (ファクトリーパターン)** {#factory-pattern}
    -   オブジェクトの生成ロジックをカプセル化するデザインパターン。複雑な生成処理を隠蔽します。
-   **Functional Programming (関数型プログラミング)** {#functional-programming}
    -   副作用を避け、関数の合成によってプログラムを構築するプログラミングパラダイム。
-   **Frustum Culling (フラスタムカリング)** {#frustum-culling}
    -   レンダリング最適化技術。カメラの視錐台外にあるオブジェクトを描画対象から除外します。

## G

-   **Game Loop (ゲームループ)** {#game-loop}
    -   ゲームの中核となる実行サイクル。更新、レンダリング、入力処理を継続的に実行します。
-   **GPU (Graphics Processing Unit)** {#gpu}
    -   並列計算に特化したプロセッサ。グラフィックス描画だけでなく、汎用計算にも使用されます。
-   **Greedy Meshing (グリーディメッシング)** {#greedy-meshing}
    -   ボクセル描画の最適化アルゴリズム。隣接する同じ種類のブロック面を結合して、メッシュ数を削減します。

## H

-   **Hexagonal Architecture (ヘキサゴナルアーキテクチャ)** {#hexagonal-architecture}
    -   ドメインロジックを中心に置き、外部依存を適応するアーキテクチャパターン。ポート・アダプターパターンとも呼ばれます。
-   **Hot Path (ホットパス)** {#hot-path}
    -   プログラム実行において頻繁に実行される処理経路。最適化の対象として重要です。

## I

-   **Immutability (不変性)** {#immutability}
    -   オブジェクトの状態が生成後に変更されない性質。関数型プログラミングの重要な概念です。
-   **Infrastructure Layer (インフラストラクチャレイヤー)** {#infrastructure-layer}
    -   DDDのレイヤードアーキテクチャの一部。永続化、外部API呼び出し、メッセージングなどを担当します。
-   **Instancing (インスタンシング)** {#instancing}
    -   同じメッシュの複数のコピーを効率的に描画するGPU技術。草や木などの大量オブジェクトに使用されます。
-   **Interpolation (補間)** {#interpolation}
    -   離散的なデータ点の間の値を推定する数学的手法。アニメーションやノイズ生成で使用されます。

## J

-   **Job System (ジョブシステム)** {#job-system}
    -   タスクを小さな単位に分割し、並列実行を効率化するシステム。マルチスレッド処理の抽象化層です。

## K

-   **Kernel (カーネル)** {#kernel}
    -   コンピュートシェーダーにおける実行単位。並列計算の基本的な処理単位です。

## L

-   **Layered Architecture (レイヤードアーキテクチャ)** {#layered-architecture}
    -   システムを論理的な層に分割するアーキテクチャパターン。各層は下位層のみに依存します。
-   **LOD (Level of Detail)** {#lod}
    -   距離に応じて描画品質を調整する最適化技術。遠くのオブジェクトほど簡略化されたモデルを使用します。

## M

-   **Material System (マテリアルシステム)** {#material-system}
    -   ゲーム内オブジェクトの視覚的・物理的特性を管理するシステム。
-   **Mesh (メッシュ)** {#mesh}
    -   3Dモデルを表現する頂点とポリゴンの集合。
-   **Memory Pool (メモリプール)** {#memory-pool}
    -   事前にメモリを確保し、オブジェクトの生成・削除を高速化する手法。
-   **Memoization (メモ化)** {#memoization}
    -   関数の計算結果をキャッシュして、同じ引数での再計算を避ける最適化技術。
-   **Model-View-Controller (MVC)** {#mvc}
    -   アプリケーションをモデル、ビュー、コントローラーに分離するアーキテクチャパターン。

## N

-   **Narrowphase (ナローフェーズ)** {#narrowphase}
    -   物理衝突検知の第二段階。ブロードフェーズで特定されたペアの詳細な衝突判定を行います。
-   **Noise Function (ノイズ関数)** {#noise-function}
    -   プロシージャル生成に使用される数学関数。Perlin Noise、Simplex Noiseなどがあり、自然な地形生成に使用されます。

## N

-   **Noise Function (ノイズ関数)** {#noise-function}
    -   プロシージャル生成に使用される数学関数。Perlin Noise、Simplex Noiseなどがあり、自然な地形生成に使用されます。

## P

-   **Procedural Generation (プロシージャル生成)** {#procedural-generation}
    -   アルゴリズムによる自動コンテンツ生成。地形、構造物、ダンジョンなどを手動作成ではなく、数学的ルールに基づいて生成します。

## R

-   **Repository (リポジトリ)** {#repository}
    -   DDDのパターン。ドメインオブジェクトの永続化と取得を抽象化するインターフェース。データベースやファイルシステムの詳細を隠蔽します。

## S

-   **Schema (スキーマ)** {#schema}
    -   Effect-TSの一部。データ構造の定義、バリデーション、シリアライゼーションを型安全に行うためのライブラリ。
-   **Service (サービス)** {#service}
    -   DDDおよびEffect-TSの概念。ドメインロジックやインフラストラクチャ機能を提供するオブジェクト。Effect-TSではContext経由で依存性注入されます。
-   **Structure of Arrays (SoA)** {#soa}
    -   データをコンポーネントの型ごとに配列で管理するメモリレイアウト。キャッシュ効率が高く、ECSのパフォーマンス最適化に用いられます。
-   **System (システム)** {#system}
    -   ECSのS。特定のコンポーネント組み合わせを持つエンティティに対して処理を実行するロジック。MovementSystem、RenderingSystem等があります。

## T

-   **Three.js** {#threejs}
    -   WebGL/WebGPUベースの3Dグラフィックスライブラリ。本プロジェクトのレンダリングエンジンとして使用されています。
-   **TSL (Three.js Shading Language)** {#tsl}
    -   Three.js r160+で導入されたシェーダー記述言語。WebGL/WebGPUの両方に対応し、より表現力豊かなシェーダーを記述できます。

## V

-   **Value Object (値オブジェクト)** {#value-object}
    -   DDDの戦術パターン。等価性がその値によって決まるオブジェクト。Position、Color、MaterialType等が該当します。
-   **Voxel (ボクセル)** {#voxel}
    -   3D空間における立方体単位。"Volume Pixel"の略。Minecraftのブロックベース世界表現の基礎となる概念です。

## W

-   **WebGPU** {#webgpu}
    -   次世代のWebグラフィックスAPI。WebGLの後継として、より低レベルで高性能なグラフィックス処理を可能にします。
-   **World (ワールド)** {#world}
    -   ECSの概念で、全てのエンティティとコンポーネントを管理するコンテナ。Minecraftでは、ゲーム世界全体を表現するドメインオブジェクトでもあります。

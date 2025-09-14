---
title: "用語集 - 技術用語・ドメイン概念辞典"
description: "TypeScript Minecraft Cloneで使用される専門用語、DDD・ECS・Effect-TS概念の包括的定義集。"
category: "reference"
difficulty: "beginner"
tags: ["glossary", "terminology", "ddd", "ecs", "effect-ts", "reference", "domain-concepts"]
prerequisites: []
estimated_reading_time: "15分"
dependencies: []
status: "complete"
---

# 用語集

TypeScript Minecraftプロジェクトで使用される主要な技術用語とドメイン固有概念の定義集です。

## アーキテクチャ用語

### DDD (Domain-Driven Design) 関連用語

**Aggregate (アグリゲート)**
一貫性の境界として機能するエンティティと値オブジェクトのまとまり。トランザクションは単一のアグリゲートに対してのみ行われるべきです。
参照: [DDD戦略設計](../01-architecture/02-ddd-strategic-design.md)

**Bounded Context (境界づけられたコンテキスト)**
特定のドメイン領域とその言葉の境界を定義します。本プロジェクトでは、World、Player、Inventory、Physics等のコンテキストに分割されています。
参照: [DDD戦略設計](../01-architecture/02-ddd-strategic-design.md)

**Domain Event (ドメインイベント)**
ドメイン内で発生する重要な出来事を表現するオブジェクト。BlockPlaced、PlayerMoved、ChunkLoaded等のイベントが該当します。
参照: [イベントバス仕様](../02-specifications/02-api-design/02-event-bus-specification.md)

**Domain Service (ドメインサービス)**
複数のアグリゲートにまたがるビジネスロジックを扱うサービス。単一のエンティティや値オブジェクトに属さない処理を担当します。
参照: [サービスパターン](../07-pattern-catalog/01-service-patterns.md)

**Entity (エンティティ)**
一意のIDを持つドメインオブジェクト。生存期間を通じて同一性を保持します。
参照: [戦術設計](../01-architecture/01-tactical-design.md)

**Repository (リポジトリ)**
ドメインオブジェクトの永続化と取得を抽象化するインターフェース。データベースやファイルシステムの詳細を隠蔽します。
参照: [インフラストラクチャAPI](../05-reference/api-reference/infrastructure-apis.md)

**Value Object (値オブジェクト)**
等価性がその値によって決まるオブジェクト。Position、Color、MaterialType等が該当します。
参照: [戦術設計](../01-architecture/01-tactical-design.md)

### Clean Architecture 関連用語

**Application Service (アプリケーションサービス)**
ドメインロジックを呼び出し、ユースケースを実現するサービス。
参照: [レイヤードアーキテクチャ](../01-architecture/04-layered-architecture.md)

**Infrastructure Layer (インフラストラクチャレイヤー)**
永続化、外部API呼び出し、メッセージングなどの技術的な詳細を担当するレイヤー。
参照: [レイヤードアーキテクチャ](../01-architecture/04-layered-architecture.md)

**Hexagonal Architecture (ヘキサゴナルアーキテクチャ)**
ドメインロジックを中心に置き、外部依存を適応するアーキテクチャパターン。ポート・アダプターパターンとも呼ばれます。
参照: [全体設計](../01-architecture/00-overall-design.md)

### ECS (Entity Component System) 関連用語

**Archetype (アーキタイプ)**
同じコンポーネントの組み合わせを持つエンティティのグループ。クエリの最適化に使用されます。
参照: [ECS統合](../01-architecture/05-ecs-integration.md)

**Component (コンポーネント)**
エンティティにアタッチされるデータの塊。Position、Velocity、Health等、純粋なデータのみを保持します。
参照: [エンティティシステム](../02-specifications/00-core-features/04-entity-system.md)

**Entity (エンティティ)**
ECSでは、コンポーネントを持つ識別子として使用されます。
参照: [エンティティシステム](../02-specifications/00-core-features/04-entity-system.md)

**System (システム)**
特定のコンポーネント組み合わせを持つエンティティに対して処理を実行するロジック。MovementSystem、RenderingSystem等があります。
参照: [エンティティシステム](../02-specifications/00-core-features/04-entity-system.md)

**World (ワールド)**
全てのエンティティとコンポーネントを管理するコンテナ。
参照: [ワールド管理システム](../02-specifications/00-core-features/01-world-management-system.md)

## Effect-TS関連用語

**Effect (エフェクト)**
Effect-TSの核となる型。非同期処理、エラーハンドリング、依存性を統一的に表現します。Effect<Success, Error, Requirements>の形式で型安全性を保証します。
参照: [Effect-TS基礎](../01-architecture/06a-effect-ts-basics.md)
コード例: [Effect合成パターン](../06-examples/02-advanced-patterns/01-effect-composition.md)

**Context (コンテキスト)**
Effect-TSの依存性注入システム。サービスやリソースへの型安全なアクセスを提供します。
参照: [Effect-TSサービス](../01-architecture/06b-effect-ts-services.md)
API: [Effect-TS Context API](../05-reference/effect-ts-context-api.md)

**Layer (レイヤー)**
Contextの実装を提供し、依存関係の解決を行う仕組み。
参照: [Effect-TSサービス](../01-architecture/06b-effect-ts-services.md)

**Pipe (パイプ)**
関数の合成を可読性高く記述するためのヘルパー関数。
参照: [Effect-TS基礎](../01-architecture/06a-effect-ts-basics.md)
コード例: [Effect合成パターン](../06-examples/02-advanced-patterns/01-effect-composition.md)

**Schema (スキーマ)**
データ構造の定義、バリデーション、シリアライゼーションを型安全に行うためのライブラリ。
参照: [Effect-TS基礎](../01-architecture/06a-effect-ts-basics.md)
API: [Effect-TS Schema API](../05-reference/effect-ts-schema-api.md)
コード例: [スキーマバリデーション](../06-examples/02-advanced-patterns/02-schema-validation.md)

## Three.js/WebGL用語

**Geometry (ジオメトリ)**
3Dオブジェクトの形状を定義するデータ構造。頂点、法線、UV座標等を含みます。
参照: [レンダリングシステム](../02-specifications/00-core-features/05-rendering-system.md)

**Material (マテリアル)**
オブジェクトの表面特性（色、光沢、透明度等）を定義します。
参照: [マテリアルシステム](../02-specifications/00-core-features/10-material-system.md)

**Mesh (メッシュ)**
GeometryとMaterialを組み合わせた描画可能な3Dオブジェクト。
参照: [レンダリングシステム](../02-specifications/00-core-features/05-rendering-system.md)

**Renderer (レンダラー)**
3Dシーンを2D画像として描画するエンジン。WebGLRenderer、WebGPURenderer等があります。
参照: [レンダリングシステム](../02-specifications/00-core-features/05-rendering-system.md)

**Scene (シーン)**
描画対象となる3Dオブジェクト、ライト、カメラ等を含む3D空間。
参照: [シーン管理システム](../02-specifications/00-core-features/11-scene-management-system.md)

**Shader (シェーダー)**
GPU上で実行されるグラフィックス描画プログラム。頂点シェーダーとフラグメントシェーダーがあります。
参照: [レンダリングシステム](../02-specifications/00-core-features/05-rendering-system.md)

**Texture (テクスチャ)**
3Dオブジェクトの表面に貼り付ける2D画像。
参照: [レンダリングシステム](../02-specifications/00-core-features/05-rendering-system.md)

**TSL (Three.js Shading Language)**
Three.js r160+で導入されたシェーダー記述言語。WebGL/WebGPUの両方に対応します。
参照: [レンダリングシステム](../02-specifications/00-core-features/05-rendering-system.md)

**WebGPU**
次世代のWebグラフィックスAPI。WebGLの後継として、より低レベルで高性能なグラフィックス処理を可能にします。
参照: [技術スタック](../01-architecture/03-technology-stack.md)

## プロジェクト固有用語

### Minecraft関連概念

**Biome (バイオーム)**
ワールド生成における環境の分類。草原、砂漠、森林など、異なる地形と特性を持つ地域を表現します。
参照: [拡張バイオームシステム](../02-specifications/01-enhanced-features/12-extended-biome-system.md)

**Block (ブロック)**
Minecraftワールドの最小単位。1x1x1の立方体として表現されます。
参照: [ブロックシステム](../02-specifications/00-core-features/03-block-system.md)
API: [ブロックAPI](../05-reference/game-block-api.md)

**Block State (ブロック状態)**
ブロックの追加的な状態情報。方向、成長段階、開閉状態などのメタデータを保持します。
参照: [ブロックシステム](../02-specifications/00-core-features/03-block-system.md)

**Chunk (チャンク)**
16x16x256ブロックの単位。ワールドの管理と最適化の基本単位です。
参照: [チャンクシステム](../02-specifications/00-core-features/07-chunk-system.md)
コード例: [簡単ブロック配置](../06-examples/01-basic-usage/01-simple-block-placement.md)

**Inventory (インベントリ)**
プレイヤーが保持するアイテムの格納領域。
参照: [インベントリシステム](../02-specifications/00-core-features/01-inventory-system.md)
コード例: [インベントリ管理](../06-examples/01-basic-usage/03-inventory-management.md)

**Item (アイテム)**
プレイヤーが保持可能なゲーム内オブジェクト。ブロック、ツール、武器等があります。
参照: [インベントリシステム](../02-specifications/00-core-features/01-inventory-system.md)

**Player (プレイヤー)**
ゲーム内でユーザーが操作するキャラクター。
参照: [プレイヤーシステム](../02-specifications/00-core-features/02-player-system.md)
API: [プレイヤーAPI](../05-reference/game-player-api.md)
コード例: [プレイヤー移動](../06-examples/01-basic-usage/02-player-movement.md)

**Voxel (ボクセル)**
3D空間における立方体単位。"Volume Pixel"の略。Minecraftのブロックベース世界表現の基礎となる概念です。
参照: [ブロックシステム](../02-specifications/00-core-features/03-block-system.md)

### ゲーム開発用語

**AABB (Axis-Aligned Bounding Box)**
軸に平行な境界ボックス。物理衝突検知システムで使用される基本的な形状表現。
参照: [物理システム](../02-specifications/00-core-features/06-physics-system.md)

**Culling (カリング)**
描画対象から不要なオブジェクトを除外する最適化技術。フラスタムカリング、オクルージョンカリングなどがあります。
参照: [レンダリングシステム](../02-specifications/00-core-features/05-rendering-system.md)

**Game Loop (ゲームループ)**
ゲームの中核となる実行サイクル。更新、レンダリング、入力処理を継続的に実行します。
参照: [ゲームループシステム](../02-specifications/00-core-features/22-game-loop-system.md)

**Greedy Meshing (グリーディメッシング)**
ボクセル描画の最適化アルゴリズム。隣接する同じ種類のブロック面を結合して、メッシュ数を削減します。
参照: [レンダリングシステム](../02-specifications/00-core-features/05-rendering-system.md)

**LOD (Level of Detail)**
距離に応じて描画品質を調整する最適化技術。遠くのオブジェクトほど簡略化されたモデルを使用します。
参照: [最適化パターン](../07-pattern-catalog/06-optimization-patterns.md)

**Noise Function (ノイズ関数)**
プロシージャル生成に使用される数学関数。Perlin Noise、Simplex Noiseなどがあり、自然な地形生成に使用されます。
参照: [構造生成](../02-specifications/01-enhanced-features/09-structure-generation.md)

**Procedural Generation (プロシージャル生成)**
アルゴリズムによる自動コンテンツ生成。地形、構造物、ダンジョンなどを数学的ルールに基づいて生成します。
参照: [構造生成](../02-specifications/01-enhanced-features/09-structure-generation.md)

## 参照

- [包括的用語集](../04-appendix/00-glossary.md) - より詳細な定義
- [技術スタック](../01-architecture/03-technology-stack.md) - 使用技術の概要
- [設計原則](../01-architecture/01-design-principles.md) - アーキテクチャ指針
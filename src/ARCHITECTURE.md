# プロジェクトアーキテクチャ

## 概要
このプロジェクトはクリーンアーキテクチャの原則に基づいて再構成されました。各層は明確な責務を持ち、依存関係の方向が制御されています。

## ディレクトリ構造

```
src/
├── domain/           # ドメイン層（純粋なビジネスロジック）
│   ├── entities/     # エンティティ（業務オブジェクト）
│   ├── value-objects/ # 値オブジェクト（不変な値）
│   └── services/     # ドメインサービス（ドメイン固有の処理）
│
├── application/      # アプリケーション層（ユースケース）
│   ├── commands/     # コマンド（状態変更操作）
│   ├── queries/      # クエリ（データ取得操作）
│   └── workflows/    # ワークフロー（複合処理）
│
├── infrastructure/   # インフラストラクチャ層（外部システム連携）
│   ├── gpu/         # WebGPU関連（シェーダー、テクスチャ）
│   ├── storage/     # データ永続化（チャンクキャッシュ、ワールド）
│   └── network/     # ネットワーク通信
│
├── presentation/     # プレゼンテーション層（UI）
│   ├── cli/         # CLI関連（開発ツール）
│   └── web/         # Web UI関連（メインアプリケーション）
│
├── shared/          # 共有コード
│   ├── types/       # 共通型定義
│   └── utils/       # ユーティリティ関数
│
├── core/            # 既存コア（段階的移行中）
├── runtime/         # ランタイム最適化（既存）
├── services/        # サービス層（既存、段階的に移行予定）
├── systems/         # ECSシステム（既存、段階的に移行予定）
└── workers/         # Web Workers（既存）
```

## 層間の依存関係

### 依存方向
```
Presentation → Application → Domain
Infrastructure → Application → Domain
Shared ← すべての層
```

### 依存関係ルール
- **Domain Layer**: 他の層に依存せず、純粋なビジネスロジックのみ（Effect依存は許可）
- **Application Layer**: Domain Layerにのみ依存し、ユースケースを実装
- **Infrastructure Layer**: ApplicationとDomainに依存し、外部システムとの接続を実装
- **Presentation Layer**: ApplicationとInfrastructureに依存し、UIを実装
- **Shared Layer**: すべての層から参照可能

## 主要な変更点

### 1. ドメイン層の統合
- `src/core/values/` → `src/domain/value-objects/`
- `src/core/entities/` → `src/domain/entities/`
- `src/domain/camera-logic.ts` → `src/domain/services/`

### 2. アプリケーション層の新設
- `src/systems/block-interaction.ts` → `src/application/commands/`
- `src/systems/player-movement.ts` → `src/application/commands/`
- `src/core/queries/` → `src/application/queries/`
- `src/systems/world-update.ts` → `src/application/workflows/`

### 3. インフラストラクチャ層の再編成
- WebGPU関連ファイル → `src/infrastructure/gpu/`
- ストレージ関連ファイル → `src/infrastructure/storage/`

### 4. プレゼンテーション層の新設
- `src/main.ts` → `src/presentation/web/`
- `src/dev-tools/` → `src/presentation/cli/`

### 5. 共有層の新設
- `src/@types/` → `src/shared/types/`
- `src/core/common.ts` → `src/shared/utils/`
- `src/core/effect-utils.ts` → `src/shared/utils/`

## 移行ステータス

### ✅ 完了
- 新しいディレクトリ構造の作成
- 主要ファイルの移動
- 基本的なインデックスファイルの作成

### 🔄 段階的移行中
- 既存の`core/`, `systems/`, `services/`ディレクトリ
- インポートパスの完全な更新
- 循環依存の完全解消

### 📋 今後の作業
1. 残りのインポートパス更新
2. 型エラーの解消
3. テストの追加・更新
4. 既存ディレクトリの段階的削除

## 利点

1. **明確な責務分離**: 各層の役割が明確
2. **テスタビリティ向上**: ドメインロジックの独立性
3. **保守性向上**: 依存関係の制御
4. **拡張性**: 新機能の追加が容易
5. **Effect-TS統合**: 関数型プログラミングとの親和性

## 注意事項

現在は段階的移行期間中のため、元のファイル構造も一時的に保持しています。
完全移行後に既存の`core/`, `systems/`, `services/`ディレクトリを削除予定です。
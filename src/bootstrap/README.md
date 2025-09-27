# Bootstrap Layer

## 概要

Bootstrap層は、アプリケーション全体の起動と統合を管理する層です。
DDD（Domain-Driven Design）の4層アーキテクチャの上位に位置し、全レイヤーの統合と初期化を担当します。

## 役割

- **アプリケーション起動**: アプリケーションの初期化とライフサイクル管理
- **レイヤー統合**: Domain, Application, Infrastructure, Presentation層の統合
- **依存性注入**: Effect-TSのLayerパターンによる依存性の組み立て
- **設定管理**: アプリケーション全体の設定とスキーマ定義

## ディレクトリ構造

```
bootstrap/
├── config/      # 設定管理
├── errors/      # アプリケーションレベルエラー
├── layers/      # レイヤー統合
├── schemas/     # スキーマ定義
└── services/    # 起動サービス
```

## アーキテクチャ位置づけ

```
┌─────────────────────┐
│   Bootstrap Layer   │  ← このレイヤー
├─────────────────────┤
│  Presentation Layer │
├─────────────────────┤
│  Application Layer  │
├─────────────────────┤
│ Infrastructure Layer│
├─────────────────────┤
│    Domain Layer     │
└─────────────────────┘
```

## 主要コンポーネント

### MainLayer

全レイヤーを統合し、アプリケーション全体の依存関係グラフを構築します。

### AppService

アプリケーションの初期化とライフサイクル管理を提供します。

### Config

アプリケーション全体の設定スキーマと検証を提供します。

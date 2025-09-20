# Domain Layer

## 概要
Domain Layerは、アプリケーションのビジネスロジックとドメインモデルを含む層です。
この層は技術的な詳細から独立しており、純粋なビジネスルールを表現します。

## 責務
- エンティティ（Entities）の定義
- 値オブジェクト（Value Objects）の定義
- ドメインイベント（Domain Events）の管理
- ドメインサービス（Domain Services）の実装
- ビジネスルールの実装

## ディレクトリ構造（予定）
```
domain/
├── entities/       # エンティティ
├── value-objects/  # 値オブジェクト
├── events/        # ドメインイベント
├── services/      # ドメインサービス
└── repositories/  # リポジトリインターフェース
```

## 設計原則
- 技術的な詳細からの独立
- ビジネスルールの集約
- 不変性の重視
- Effect-TSを活用した型安全性の確保
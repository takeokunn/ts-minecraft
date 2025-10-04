# Infrastructure Layer

## 概要

Infrastructure Layerは、技術的な実装詳細と外部システムとの統合を担当する層です。
アプリケーションのポートに対する具体的なアダプターを提供します。

## 責務

- 永続化の実装（Persistence）
- 外部APIとの通信
- ファイルシステムの操作
- メッセージングシステムの統合
- 設定管理
- ログ記録とモニタリング

## ディレクトリ構造（Bounded Context）

```
infrastructure/
├── audio/               # AudioService ポートのアダプタ
├── ecs/                 # Entity / System / World 実装
├── inventory/           # 永続化ストレージ (localStorage / IndexedDB)
├── rendering.disabled/  # 一時的に無効化された Three.js 実装
└── README.md
```

各ディレクトリはドメイン側の境界づけられたコンテキストに対応し、`index.ts` は純粋なバレルエクスポートのみを提供します。

## 設計原則

- ヘキサゴナルアーキテクチャのアダプター実装
- ドメイン層への依存の回避
- 技術的関心事の分離
- Effect-TSによる副作用の管理（`Effect`, `Layer`, `Clock` でリソースライフサイクルを制御）
- `Data.tagged` ADT を用いたエラー表現（`SystemError`, `SystemRegistryError`, `EntityManagerError`, `StorageError` など）
- 制御構文は `Effect.forEach` / `Match` / `Option` / `Schedule` などのコンビネータで表現し、`for` / `if` / `Promise` を直接使用しない

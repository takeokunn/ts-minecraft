---
title: "技術スタック"
description: "技術スタックに関する詳細な説明とガイド。"
category: "architecture"
difficulty: "advanced"
tags: ['typescript', 'minecraft', 'architecture']
prerequisites: ['basic-typescript', 'effect-ts-fundamentals']
estimated_reading_time: "5分"
last_updated: "2025-09-14"
version: "1.0.0"
---

# 技術スタック

TypeScript Minecraft Cloneは、モダンで高性能なWeb技術と関数型プログラミングの原則を組み合わせた堅牢な技術スタックを採用しています。

## コアフレームワーク

-   **[Effect-TS 3.17+](https://effect.website/)**: プロジェクト全体の根幹をなす関数型プログラミングエコシステム。型安全な副作用管理、依存性注入 (Layer)、並行処理 (Fiber)、スキーマ駆動開発 (Schema) を担当します。
-   **[TypeScript 5.6+](https://www.typescriptlang.org/)**: 静的型付けによるコードの堅牢性と開発効率を保証します。`strict`モードを最大限に活用します。
-   **[Schema (Effect-TS内蔵)](https://effect.website/docs/schema/introduction)**: データ構造の定義、バリデーション、シリアライゼーションを一元管理し、`class`構文を完全に代替します。

## 3Dレンダリング

-   **[Three.js](https://threejs.org/)**: WebGLベースの3Dレンダリングエンジン。チャンクメッシュの描画、カメラ制御、ライティングを担当します。
-   **WebGPU**: 次世代のGPU API。パフォーマンスが重要な領域で統合サポートを提供し、メインのレンダリングバックエンドとしてWebGLと並行稼働します。

## ビルドツール・開発環境

-   **[Vite](https://vitejs.dev/)**: 高速な開発サーバーと最適化されたビルドを提供するフロントエンドツール。
-   **[Vitest](https://vitest.dev/)**: Viteと親和性の高い、高速なテストフレームワーク。
-   **[Oxlint](https://github.com/oxc-project/oxc)**: Rust製の高速なリンター。コード品質の一貫性を保ちます。
-   **[Prettier](https://prettier.io/)**: コードフォーマッター。コーディングスタイルを統一します。
-   **[pnpm](https://pnpm.io/)**: 高速でディスク効率の良いパッケージマネージャー。

## その他の主要ライブラリ

-   **simplex-noise**: プロシージャルな地形生成に使用するノイズ関数ライブラリ。
-   **alea**: シード可能な高品質な乱数生成器。ワールド生成の再現性を保証します。
-   **stats.js**: パフォーマンスモニタリング用のシンプルなUIライブラリ。
-   **uuid**: エンティティIDなどの一意な識別子を生成します。
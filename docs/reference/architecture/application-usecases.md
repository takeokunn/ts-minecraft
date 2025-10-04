---
title: 'Game Application Use Case Matrix'
description: 'フェーズ3で再編するアプリケーション層のユースケースと依存サブシステム一覧。'
category: 'architecture'
priority: 'high'
tags: ['application-layer', 'use-case', 'ddd']
related_docs:
  - '../architecture/src-directory-structure.md'
  - '../../explanations/architecture/bounded-context-refactor.md'
---

# Game Application Use Case Matrix

| Use Case | 説明 | 呼び出し層 | 主要依存 | 対応 Bounded Context |
| --- | --- | --- | --- | --- |
| initialize | 設定を読み込み、GameLoop/Scene/Renderer/Input/ECS を接続して初期化する | `bootstrap` | GameLoop, Scene, Renderer, Input, ECS | `world`, `player`, `inventory`, `platform` |
| start | 初期化済みシステムを稼働状態へ遷移させる | `bootstrap` | GameLoop, Renderer, Input | `world`, `player` |
| pause | 実行中システムを停止し、状態を保持する | UI / `interface` | GameLoop, Renderer | `world`, `player` |
| resume | 停止状態から実行を再開する | UI / `interface` | GameLoop, Renderer | `world`, `player` |
| stop | 全システムを安全に停止しリソースを解放する | `bootstrap` | GameLoop, Renderer, Scene, ECS | `world`, `platform` |
| getState | 現在の統合ゲーム状態を取得する | UI / `interface` | Scene, Inventory, PlayerState | `world`, `inventory`, `player` |
| getLifecycleState | アプリケーションライフサイクルの段階を取得する | Monitoring | Lifecycle service | `platform` |
| tick | 1 フレーム更新を手動実行する (デバッグ用途) | Dev tooling | GameLoop, Scene, Renderer | `world`, `platform` |
| updateConfig | 実行時設定の差し替えを行う | Settings UI | Config store, Renderer, GameLoop | `platform`, `world` |
| healthCheck | サブシステム健全性を集約して返す | Observability | GameLoop metrics, Renderer metrics, Scene registry | `platform`, `world` |
| reset | システム状態を初期化し再起動可能にする | `bootstrap` | Scene, Inventory, Player, GameLoop | `world`, `inventory`, `player` |
| inventory-ui:getInventory | プレゼンテーション向け簡易 DTO を返却する | `interface` | InventoryUiService | `inventory` |

追加のユースケース (inventory 管理、クラフト系など) は `bounded-contexts/inventory/application` 以下にユースケース単位のサービスとして分解する。

# Bounded Context Reclassification

プレイヤー体験を起点にユースケースを整理し、技術モジュールではなく共通語彙で境界づけられた 6 コンテキストに再定義した。旧「その他」区分は廃止し、以下を Single Source of Truth として参照する。

| 新境界               | 主な責務                                         | 既存モジュールの収容先                                                                                                                               | 代表ユースケース                                           |
| -------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| サバイバル体験       | プレイヤー状態遷移・戦闘・装備管理・行動制御     | `src/domain/player`, `src/domain/combat`, `src/domain/equipment`, `src/domain/interaction`, `src/domain/entities`                                    | スポーン/死亡/リスポーン、ダメージ計算、装備切替           |
| アイテム経済         | 資源取得・インベントリ・クラフト・建築要素の管理 | `src/domain/inventory`, `src/domain/crafting`, `src/domain/block`, `src/domain/materials`, `src/domain/furniture`, `src/domain/agriculture`          | アイテム取得、クラフト検証、自動整列、家具設置             |
| ワールド運営         | ワールド状態管理・チャンク読み込み・距離制御     | `src/domain/world`, `src/domain/chunk`, `src/domain/chunk_loader`, `src/domain/chunk_manager`, `src/domain/chunk_system`, `src/domain/view_distance` | チャンクロード、保存、LOD 調整、バックアップ               |
| プロシージャル生成   | 地形/バイオーム/構造物生成とテンプレート運用     | `src/domain/world_generation`, `src/domain/biome`                                                                                                    | 地形パイプライン組成、バイオーム判定、生成テンプレート選択 |
| シミュレーション基盤 | 物理・メトリクス・ゲームループの統制             | `src/domain/physics`, `src/domain/performance`, `src/domain/game_loop`                                                                               | 物理ステップ更新、メトリクス収集、バックプレッシャー制御   |
| 体験統合             | 入力/シーン/カメラの状態同期とアダプタ           | `src/domain/input`, `src/domain/scene`, `src/domain/camera`                                                                                          | UI とユースケースの橋渡し、ビュー構成、入力マッピング      |

## 次アクション

- docs/INDEX.md と ROADMAP の境界一覧を本テーブルに合わせて更新する。
- `src/domain` ディレクトリの移設は Phase 2 で World/Chunk 系、Phase 3 で Generation/Biome 系を中心に順次実施する。

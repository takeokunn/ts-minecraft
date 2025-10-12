import { Context, Effect, Option } from 'effect'
import type {
  Container,
  ContainerId,
  ContainerQuery,
  ContainerSnapshot,
  ContainerType,
  PlayerId,
  WorldPosition,
} from '../../types'
import type { AllRepositoryErrors } from '../types'

/**
 * Container Repository
 *
 * コンテナ（チェスト、樽、シュルカーボックス等）の永続化を抽象化する
 * Repository層インターフェース。ワールドに配置されたコンテナや
 * 一時的なコンテナの状態管理を行う。
 */
export interface ContainerRepository {
  /**
   * コンテナの保存
   *
   * コンテナの状態を永続化層に保存する。
   * 既存のコンテナIDが存在する場合は上書きする。
   *
   * @param container - 保存するコンテナ
   * @returns void (成功時) | RepositoryError (失敗時)
   *
   * @example
   * ```typescript
   * const container: Container = {
   *   id: 'chest-001' as ContainerId,
   *   type: 'chest',
   *   capacity: 27,
   *   position: { x: 100, y: 64, z: 200 },
   *   worldId: 'overworld',
   *   slots: new Map([
   *     [0, { itemId: 'diamond' as ItemId, count: 16, metadata: {} }],
   *     [1, { itemId: 'gold_ingot' as ItemId, count: 32, metadata: {} }]
   *   ]),
   *   metadata: { locked: false, title: 'Treasure Chest' },
   *   permissions: { public: false, allowedPlayers: ['player-1'] },
   *   lastAccessed: yield* Clock.currentTimeMillis,
   *   version: 1
   * }
   *
   * yield* repo.save(container)
   * console.log('コンテナ保存完了')
   * ```
   */
  readonly save: (container: Container) => Effect.Effect<void, AllRepositoryErrors>

  /**
   * コンテナIDによる検索
   *
   * 指定されたコンテナIDに一致するコンテナを取得する。
   * 存在しない場合はOption.noneを返す。
   *
   * @param id - 検索するコンテナID
   * @returns Option<コンテナ> (成功時) | RepositoryError (失敗時)
   *
   * @example
   * ```typescript
   * const containerOption = yield* repo.findById('chest-001' as ContainerId)
   *
   * yield* pipe(
   *   containerOption,
   *   Option.match({
   *     onNone: () => Effect.sync(() =>
   *       console.log('コンテナが見つかりません')
   *     ),
   *     onSome: (container) => Effect.sync(() =>
   *       console.log(`コンテナ発見: ${container.type} (${container.capacity}スロット)`)
   *     ),
   *   })
   * )
   * ```
   */
  readonly findById: (id: ContainerId) => Effect.Effect<Option.Option<Container>, AllRepositoryErrors>

  /**
   * 位置による検索
   *
   * 指定された座標に配置されているコンテナを取得する。
   * 存在しない場合はOption.noneを返す。
   *
   * @param position - 検索する座標
   * @param worldId - ワールドID
   * @returns Option<コンテナ> (成功時) | RepositoryError (失敗時)
   *
   * @example
   * ```typescript
   * const position: WorldPosition = { x: 100, y: 64, z: 200 }
   * const containerOption = yield* repo.findByPosition(position, 'overworld')
   *
   * yield* pipe(
   *   containerOption,
   *   Option.match({
   *     onNone: () => Effect.sync(() =>
   *       console.log('その座標にコンテナはありません')
   *     ),
   *     onSome: (container) => Effect.sync(() =>
   *       console.log(`コンテナ発見: ${container.type}`)
   *     ),
   *   })
   * )
   * ```
   */
  readonly findByPosition: (
    position: WorldPosition,
    worldId: string
  ) => Effect.Effect<Option.Option<Container>, AllRepositoryErrors>

  /**
   * タイプによる検索
   *
   * 指定されたタイプのコンテナ一覧を取得する。
   * 該当するコンテナが存在しない場合は空配列を返す。
   *
   * @param type - 検索するコンテナタイプ
   * @returns コンテナ配列 (成功時) | RepositoryError (失敗時)
   *
   * @example
   * ```typescript
   * const chests = yield* repo.findByType('chest')
   * console.log(`チェストの数: ${chests.length}`)
   *
   * const shulkerBoxes = yield* repo.findByType('shulker_box')
   * console.log(`シュルカーボックスの数: ${shulkerBoxes.length}`)
   * ```
   */
  readonly findByType: (type: ContainerType) => Effect.Effect<ReadonlyArray<Container>, AllRepositoryErrors>

  /**
   * プレイヤーアクセス可能コンテナの検索
   *
   * 指定されたプレイヤーがアクセス可能なコンテナ一覧を取得する。
   * パーミッション設定を考慮して絞り込みを行う。
   *
   * @param playerId - 検索するプレイヤーID
   * @returns アクセス可能コンテナ配列 (成功時) | RepositoryError (失敗時)
   *
   * @example
   * ```typescript
   * const accessibleContainers = yield* repo.findAccessibleByPlayer('player-1' as PlayerId)
   * console.log(`アクセス可能コンテナ数: ${accessibleContainers.length}`)
   * ```
   */
  readonly findAccessibleByPlayer: (playerId: PlayerId) => Effect.Effect<ReadonlyArray<Container>, AllRepositoryErrors>

  /**
   * 範囲内コンテナの検索
   *
   * 指定された範囲内にあるコンテナ一覧を取得する。
   * ワールド座標の矩形範囲で絞り込みを行う。
   *
   * @param minPosition - 範囲の最小座標
   * @param maxPosition - 範囲の最大座標
   * @param worldId - ワールドID
   * @returns 範囲内コンテナ配列 (成功時) | RepositoryError (失敗時)
   *
   * @example
   * ```typescript
   * const minPos: WorldPosition = { x: 0, y: 0, z: 0 }
   * const maxPos: WorldPosition = { x: 100, y: 100, z: 100 }
   * const containers = yield* repo.findInRange(minPos, maxPos, 'overworld')
   * console.log(`範囲内コンテナ数: ${containers.length}`)
   * ```
   */
  readonly findInRange: (
    minPosition: WorldPosition,
    maxPosition: WorldPosition,
    worldId: string
  ) => Effect.Effect<ReadonlyArray<Container>, AllRepositoryErrors>

  /**
   * 全コンテナの取得
   *
   * 永続化されている全てのコンテナを取得する。
   * パフォーマンス上の理由で大量データ時は注意が必要。
   *
   * @returns コンテナ配列 (成功時) | RepositoryError (失敗時)
   *
   * @example
   * ```typescript
   * const allContainers = yield* repo.findAll()
   * console.log(`総コンテナ数: ${allContainers.length}`)
   *
   * const types = new Set(allContainers.map(container => container.type))
   * console.log(`コンテナタイプ数: ${types.size}`)
   * ```
   */
  readonly findAll: () => Effect.Effect<ReadonlyArray<Container>, AllRepositoryErrors>

  /**
   * コンテナの削除
   *
   * 指定されたコンテナIDのコンテナを永続化層から削除する。
   * 存在しないIDを指定してもエラーとしない。
   *
   * @param id - 削除するコンテナID
   * @returns void (成功時) | RepositoryError (失敗時)
   *
   * @example
   * ```typescript
   * yield* repo.delete('chest-001' as ContainerId)
   * console.log('コンテナを削除しました')
   * ```
   */
  readonly delete: (id: ContainerId) => Effect.Effect<void, AllRepositoryErrors>

  /**
   * 位置のコンテナ削除
   *
   * 指定された座標のコンテナを削除する。
   * ブロック破壊時などで使用される。
   *
   * @param position - 削除する座標
   * @param worldId - ワールドID
   * @returns void (成功時) | RepositoryError (失敗時)
   *
   * @example
   * ```typescript
   * const position: WorldPosition = { x: 100, y: 64, z: 200 }
   * yield* repo.deleteByPosition(position, 'overworld')
   * console.log('座標のコンテナを削除しました')
   * ```
   */
  readonly deleteByPosition: (position: WorldPosition, worldId: string) => Effect.Effect<void, AllRepositoryErrors>

  /**
   * コンテナ存在確認
   *
   * 指定されたコンテナIDのコンテナが存在するかを確認する。
   * findById よりも軽量な操作として提供される。
   *
   * @param id - 確認するコンテナID
   * @returns 存在フラグ (成功時) | RepositoryError (失敗時)
   *
   * @example
   * ```typescript
   * const exists = yield* repo.exists('chest-001' as ContainerId)
   * yield* pipe(
   *   Match.value(exists),
   *   Match.when(true, () => Effect.log('コンテナは存在します')),
   *   Match.orElse(() => Effect.log('コンテナは存在しません'))
   * )
   * ```
   */
  readonly exists: (id: ContainerId) => Effect.Effect<boolean, AllRepositoryErrors>

  /**
   * コンテナ数の取得
   *
   * 現在永続化されているコンテナの総数を取得する。
   * パフォーマンス監視やリソース管理での使用を想定。
   *
   * @returns コンテナ数 (成功時) | RepositoryError (失敗時)
   *
   * @example
   * ```typescript
   * const count = yield* repo.count()
   * yield* Effect.log(`登録コンテナ数: ${count}`)
   * yield* pipe(
   *   Match.value(count > 100000),
   *   Match.when(true, () => Effect.log('⚠️ コンテナ数が上限に近づいています')),
   *   Match.orElse(() => Effect.unit)
   * )
   * ```
   */
  readonly count: () => Effect.Effect<number, AllRepositoryErrors>

  /**
   * 複数コンテナの一括保存
   *
   * 複数のコンテナを効率的に一括保存する。
   * トランザクション的な処理で、一部失敗時は全体をロールバック。
   *
   * @param containers - 保存するコンテナ配列
   * @returns void (成功時) | RepositoryError (失敗時)
   *
   * @example
   * ```typescript
   * const containers: Container[] = [
   *   { id: 'chest-1', type: 'chest', ... },
   *   { id: 'barrel-1', type: 'barrel', ... },
   *   { id: 'shulker-1', type: 'shulker_box', ... }
   * ]
   *
   * yield* repo.saveMany(containers)
   * console.log(`${containers.length}個のコンテナを一括保存`)
   * ```
   */
  readonly saveMany: (containers: ReadonlyArray<Container>) => Effect.Effect<void, AllRepositoryErrors>

  /**
   * 検索クエリによる絞り込み
   *
   * 複雑な検索条件でコンテナを絞り込む。
   * 位置、タイプ、容量、アクセス権等を組み合わせた検索が可能。
   *
   * @param query - 検索クエリオブジェクト
   * @returns 絞り込み結果 (成功時) | RepositoryError (失敗時)
   *
   * @example
   * ```typescript
   * const query: ContainerQuery = {
   *   types: ['chest', 'barrel'],
   *   minCapacity: 27,
   *   withinRange: {
   *     center: { x: 0, y: 64, z: 0 },
   *     radius: 100
   *   },
   *   worldId: 'overworld',
   *   accessibleToPlayer: 'player-1',
   *   notEmpty: true
   * }
   *
   * const results = yield* repo.findByQuery(query)
   * console.log(`検索結果: ${results.length}個のコンテナ`)
   * ```
   */
  readonly findByQuery: (query: ContainerQuery) => Effect.Effect<ReadonlyArray<Container>, AllRepositoryErrors>

  /**
   * コンテナスナップショットの作成
   *
   * 指定されたコンテナの現在状態をスナップショットとして保存する。
   * バックアップやロールバック機能で使用される。
   *
   * @param containerId - 対象コンテナID
   * @param snapshotName - スナップショット名
   * @returns スナップショット (成功時) | RepositoryError (失敗時)
   *
   * @example
   * ```typescript
   * const snapshot = yield* repo.createSnapshot('chest-001' as ContainerId, 'before-raid')
   * console.log(`スナップショット作成: ${snapshot.name}`)
   * ```
   */
  readonly createSnapshot: (
    containerId: ContainerId,
    snapshotName: string
  ) => Effect.Effect<ContainerSnapshot, AllRepositoryErrors>

  /**
   * スナップショットからの復元
   *
   * 指定されたスナップショットからコンテナ状態を復元する。
   * 現在の状態は失われるので注意が必要。
   *
   * @param snapshotId - 復元するスナップショットID
   * @returns void (成功時) | RepositoryError (失敗時)
   *
   * @example
   * ```typescript
   * yield* repo.restoreFromSnapshot('snapshot-123')
   * console.log('スナップショットから復元完了')
   * ```
   */
  readonly restoreFromSnapshot: (snapshotId: string) => Effect.Effect<void, AllRepositoryErrors>

  /**
   * アクセス権の更新
   *
   * 指定されたコンテナのアクセス権限を更新する。
   * 所有者や許可されたプレイヤーリストを変更可能。
   *
   * @param containerId - 対象コンテナID
   * @param permissions - 新しいアクセス権限
   * @returns void (成功時) | RepositoryError (失敗時)
   *
   * @example
   * ```typescript
   * const permissions = {
   *   public: false,
   *   allowedPlayers: ['player-1', 'player-2'],
   *   owner: 'player-1'
   * }
   *
   * yield* repo.updatePermissions('chest-001' as ContainerId, permissions)
   * console.log('アクセス権限更新完了')
   * ```
   */
  readonly updatePermissions: (
    containerId: ContainerId,
    permissions: Container['permissions']
  ) => Effect.Effect<void, AllRepositoryErrors>

  /**
   * Repository の初期化
   *
   * 必要に応じてストレージの初期化処理を実行する。
   * アプリケーション起動時に1回だけ呼び出される。
   *
   * @returns void (成功時) | RepositoryError (失敗時)
   *
   * @example
   * ```typescript
   * yield* repo.initialize()
   * console.log('ContainerRepository初期化完了')
   * ```
   */
  readonly initialize: () => Effect.Effect<void, AllRepositoryErrors>

  /**
   * Repository のクリーンアップ
   *
   * リソースの解放やクリーンアップ処理を実行する。
   * アプリケーション終了時に呼び出される。
   *
   * @returns void (成功時) | RepositoryError (失敗時)
   *
   * @example
   * ```typescript
   * yield* repo.cleanup()
   * console.log('ContainerRepository終了処理完了')
   * ```
   */
  readonly cleanup: () => Effect.Effect<void, AllRepositoryErrors>
}

/**
 * ContainerRepository Context Tag
 */
export const ContainerRepository = Context.GenericTag<ContainerRepository>(
  '@minecraft/domain/inventory/repository/ContainerRepository'
)

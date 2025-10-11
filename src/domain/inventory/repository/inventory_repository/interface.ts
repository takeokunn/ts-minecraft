import { Context, Effect, Option } from 'effect'
import type {
  Inventory,
  InventoryQuery,
  InventorySnapshot,
  InventoryTransferRequest,
  ItemId,
  ItemStack,
  PlayerId,
  SlotPosition,
  StackOperationRequest,
} from '../../types'
import type { AllRepositoryErrors } from '../types'

/**
 * Inventory Repository
 *
 * インベントリの永続化を抽象化するRepository層インターフェース。
 * メモリ、ローカルストレージ、IndexedDB等の具体的な実装から独立し、
 * ドメインロジックに集中できるようにする。
 */
export interface InventoryRepository {
  /**
   * インベントリの保存
   *
   * プレイヤーのインベントリ状態を永続化層に保存する。
   * 既存のプレイヤーIDのインベントリが存在する場合は上書きする。
   *
   * @param inventory - 保存するインベントリ
   * @returns void (成功時) | RepositoryError (失敗時)
   *
   * @example
   * ```typescript
   * const inventory: Inventory = {
   *   playerId: 'player-123' as PlayerId,
   *   type: 'player',
   *   capacity: 36,
   *   slots: new Map([
   *     [0, { itemId: 'stone' as ItemId, count: 64, metadata: {} }],
   *     [1, { itemId: 'wood' as ItemId, count: 32, metadata: {} }]
   *   ]),
   *   metadata: { isHotbarEnabled: true },
   *   version: 1,
   *   lastUpdated: yield* Clock.currentTimeMillis
   * }
   *
   * yield* repo.save(inventory)
   * console.log('インベントリ保存完了')
   * ```
   */
  readonly save: (inventory: Inventory) => Effect.Effect<void, AllRepositoryErrors>

  /**
   * プレイヤーIDによるインベントリ検索
   *
   * 指定されたプレイヤーIDに一致するインベントリを取得する。
   * 存在しない場合はOption.noneを返す。
   *
   * @param playerId - 検索するプレイヤーID
   * @returns Option<インベントリ> (成功時) | RepositoryError (失敗時)
   *
   * @example
   * ```typescript
   * const inventoryOption = yield* repo.findByPlayerId('player-123' as PlayerId)
   *
   * yield* pipe(
   *   inventoryOption,
   *   Option.match({
   *     onNone: () => Effect.sync(() =>
   *       console.log('インベントリが見つかりません')
   *     ),
   *     onSome: (inventory) => Effect.sync(() =>
   *       console.log(`インベントリ発見: ${inventory.capacity}スロット`)
   *     ),
   *   })
   * )
   * ```
   */
  readonly findByPlayerId: (playerId: PlayerId) => Effect.Effect<Option.Option<Inventory>, AllRepositoryErrors>

  /**
   * アイテム検索
   *
   * 指定されたプレイヤーのインベントリから、特定のアイテムを含むスロットを検索する。
   * アイテムが存在しない場合は空配列を返す。
   *
   * @param playerId - 検索するプレイヤーID
   * @param itemId - 検索するアイテムID
   * @returns スロット位置とアイテムスタックのペア配列 (成功時) | RepositoryError (失敗時)
   *
   * @example
   * ```typescript
   * const stoneItems = yield* repo.findItemsByPlayerId('player-123' as PlayerId, 'stone' as ItemId)
   * console.log(`石アイテムのスロット数: ${stoneItems.length}`)
   *
   * stoneItems.forEach(([position, stack]) => {
   *   console.log(`スロット ${position}: ${stack.count}個`)
   * })
   * ```
   */
  readonly findItemsByPlayerId: (
    playerId: PlayerId,
    itemId: ItemId
  ) => Effect.Effect<ReadonlyArray<readonly [SlotPosition, ItemStack]>, AllRepositoryErrors>

  /**
   * アイテムスタックの更新
   *
   * 指定されたプレイヤーの特定スロットのアイテムスタックを更新する。
   * スロットが存在しない場合はエラーを返す。
   *
   * @param playerId - 対象プレイヤーID
   * @param position - スロット位置
   * @param itemStack - 更新するアイテムスタック（nullの場合はスロットを空にする）
   * @returns void (成功時) | RepositoryError (失敗時)
   *
   * @example
   * ```typescript
   * const newStack: ItemStack = {
   *   itemId: 'stone' as ItemId,
   *   count: 32,
   *   metadata: { quality: 'high' }
   * }
   *
   * yield* repo.updateSlot('player-123' as PlayerId, 0, newStack)
   * console.log('スロット0を更新しました')
   * ```
   */
  readonly updateSlot: (
    playerId: PlayerId,
    position: SlotPosition,
    itemStack: ItemStack | null
  ) => Effect.Effect<void, AllRepositoryErrors>

  /**
   * スロットのクリア
   *
   * 指定されたプレイヤーの特定スロットを空にする。
   * スロットが既に空の場合もエラーとしない。
   *
   * @param playerId - 対象プレイヤーID
   * @param position - スロット位置
   * @returns void (成功時) | RepositoryError (失敗時)
   *
   * @example
   * ```typescript
   * yield* repo.clearSlot('player-123' as PlayerId, 5)
   * console.log('スロット5をクリアしました')
   * ```
   */
  readonly clearSlot: (playerId: PlayerId, position: SlotPosition) => Effect.Effect<void, AllRepositoryErrors>

  /**
   * インベントリの削除
   *
   * 指定されたプレイヤーのインベントリを永続化層から削除する。
   * 存在しないプレイヤーIDを指定してもエラーとしない。
   *
   * @param playerId - 削除するプレイヤーID
   * @returns void (成功時) | RepositoryError (失敗時)
   *
   * @example
   * ```typescript
   * yield* repo.delete('player-123' as PlayerId)
   * console.log('プレイヤーのインベントリを削除しました')
   * ```
   */
  readonly delete: (playerId: PlayerId) => Effect.Effect<void, AllRepositoryErrors>

  /**
   * インベントリ存在確認
   *
   * 指定されたプレイヤーのインベントリが存在するかを確認する。
   * findByPlayerId よりも軽量な操作として提供される。
   *
   * @param playerId - 確認するプレイヤーID
   * @returns 存在フラグ (成功時) | RepositoryError (失敗時)
   *
   * @example
   * ```typescript
   * const exists = yield* repo.exists('player-123' as PlayerId)
   * if (exists) {
   *   console.log('プレイヤーのインベントリは存在します')
   * } else {
   *   console.log('プレイヤーのインベントリは未作成です')
   * }
   * ```
   */
  readonly exists: (playerId: PlayerId) => Effect.Effect<boolean, AllRepositoryErrors>

  /**
   * インベントリ数の取得
   *
   * 現在永続化されているインベントリの総数を取得する。
   * パフォーマンス監視やリソース管理での使用を想定。
   *
   * @returns インベントリ数 (成功時) | RepositoryError (失敗時)
   *
   * @example
   * ```typescript
   * const count = yield* repo.count()
   * console.log(`登録インベントリ数: ${count}`)
   *
   * if (count > 10000) {
   *   console.warn('インベントリ数が上限に近づいています')
   * }
   * ```
   */
  readonly count: () => Effect.Effect<number, AllRepositoryErrors>

  /**
   * 複数インベントリの一括保存
   *
   * 複数のインベントリを効率的に一括保存する。
   * トランザクション的な処理で、一部失敗時は全体をロールバック。
   *
   * @param inventories - 保存するインベントリ配列
   * @returns void (成功時) | RepositoryError (失敗時)
   *
   * @example
   * ```typescript
   * const inventories: Inventory[] = [
   *   { playerId: 'player-1', type: 'player', ... },
   *   { playerId: 'player-2', type: 'player', ... },
   *   { playerId: 'player-3', type: 'player', ... }
   * ]
   *
   * yield* repo.saveMany(inventories)
   * console.log(`${inventories.length}個のインベントリを一括保存`)
   * ```
   */
  readonly saveMany: (inventories: ReadonlyArray<Inventory>) => Effect.Effect<void, AllRepositoryErrors>

  /**
   * 検索クエリによる絞り込み
   *
   * 複雑な検索条件でインベントリを絞り込む。
   * 容量、アイテム数、更新日時等を組み合わせた検索が可能。
   *
   * @param query - 検索クエリオブジェクト
   * @returns 絞り込み結果 (成功時) | RepositoryError (失敗時)
   *
   * @example
   * ```typescript
   * const now = yield* Clock.currentTimeMillis
   * const query: InventoryQuery = {
   *   minCapacity: 36,
   *   hasItems: ['stone', 'wood'],
   *   updatedAfter: now - 86400000, // 24時間以内
   *   excludeEmpty: true
   * }
   *
   * const results = yield* repo.findByQuery(query)
   * console.log(`検索結果: ${results.length}個のインベントリ`)
   * ```
   */
  readonly findByQuery: (query: InventoryQuery) => Effect.Effect<ReadonlyArray<Inventory>, AllRepositoryErrors>

  /**
   * アイテム転送の実行
   *
   * インベントリ間でのアイテム転送を原子的に実行する。
   * 転送元・転送先の整合性を保ちながら、安全に移動を行う。
   *
   * @param request - 転送リクエスト
   * @returns void (成功時) | RepositoryError (失敗時)
   *
   * @example
   * ```typescript
   * const transferRequest: InventoryTransferRequest = {
   *   fromPlayerId: 'player-1' as PlayerId,
   *   toPlayerId: 'player-2' as PlayerId,
   *   fromSlot: 0,
   *   toSlot: 5,
   *   quantity: 32
   * }
   *
   * yield* repo.transfer(transferRequest)
   * console.log('アイテム転送完了')
   * ```
   */
  readonly transfer: (request: InventoryTransferRequest) => Effect.Effect<void, AllRepositoryErrors>

  /**
   * スタック操作の実行
   *
   * 同一アイテムのスタック分割・結合を原子的に実行する。
   * スタック制限を考慮した安全な操作を提供。
   *
   * @param request - スタック操作リクエスト
   * @returns void (成功時) | RepositoryError (失敗時)
   *
   * @example
   * ```typescript
   * const stackRequest: StackOperationRequest = {
   *   playerId: 'player-1' as PlayerId,
   *   operation: 'split',
   *   sourceSlot: 0,
   *   targetSlot: 1,
   *   quantity: 32
   * }
   *
   * yield* repo.stackOperation(stackRequest)
   * console.log('スタック操作完了')
   * ```
   */
  readonly stackOperation: (request: StackOperationRequest) => Effect.Effect<void, AllRepositoryErrors>

  /**
   * インベントリスナップショットの作成
   *
   * 指定されたプレイヤーのインベントリの現在状態をスナップショットとして保存する。
   * バックアップやロールバック機能で使用される。
   *
   * @param playerId - 対象プレイヤーID
   * @param snapshotName - スナップショット名
   * @returns スナップショット (成功時) | RepositoryError (失敗時)
   *
   * @example
   * ```typescript
   * const snapshot = yield* repo.createSnapshot('player-1' as PlayerId, 'before-trade')
   * console.log(`スナップショット作成: ${snapshot.name}`)
   * ```
   */
  readonly createSnapshot: (
    playerId: PlayerId,
    snapshotName: string
  ) => Effect.Effect<InventorySnapshot, AllRepositoryErrors>

  /**
   * スナップショットからの復元
   *
   * 指定されたスナップショットからインベントリ状態を復元する。
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
   * console.log('InventoryRepository初期化完了')
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
   * console.log('InventoryRepository終了処理完了')
   * ```
   */
  readonly cleanup: () => Effect.Effect<void, AllRepositoryErrors>
}

/**
 * InventoryRepository Context Tag
 */
export const InventoryRepository = Context.GenericTag<InventoryRepository>(
  '@minecraft/domain/inventory/repository/InventoryRepository'
)

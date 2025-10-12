/**
 * Application-facing facade for inventory domain services used by Presentation層。
 * ドメインの実装を直接参照せず、アプリケーション層経由で依存を解決する。
 */
export { InventoryService, type Inventory, type ItemStack, type PlayerId } from '@/domain/inventory'
export { PlayerIdOperations, PlayerIdSchema } from '@domain/shared/entities/player_id'

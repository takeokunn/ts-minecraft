import { Effect, Option } from 'effect'

/** Creates an empty inventory service fake. */
export const makeInventoryService = () => ({
  getAllSlots: () => Effect.succeed([]),
  getSlot: (_index: unknown) => Effect.succeed(Option.none()),
  setSlot: (_index: unknown, _stack: unknown) => Effect.void,
  damageSlot: (_index: unknown, _amount?: unknown) => Effect.void,
  repairMendingItemsWithXP: (amount: number) => Effect.succeed(amount),
  moveStack: (_from: unknown, _to: unknown) => Effect.void,
  addBlock: (_type: unknown, _count: unknown) => Effect.succeed(true),
  removeBlock: (_type: unknown, _count: unknown, _slot?: unknown) => Effect.succeed(true),
  getHotbarSlots: () => Effect.succeed([]),
  serialize: () => Effect.succeed({ slots: [] }),
  deserialize: (_data: unknown) => Effect.void,
}) as unknown as InstanceType<typeof import('@ts-minecraft/inventory').InventoryService>

/** Creates an empty hotbar service fake with slot zero selected. */
export const makeHotbarService = () => ({
  update: () => Effect.void,
  getSlots: () => Effect.succeed([]),
  getSelectedSlot: () => Effect.succeed(0),
  getSelectedBlockType: () => Effect.succeed({ _tag: 'None' }),
}) as unknown as InstanceType<typeof import('@ts-minecraft/inventory').HotbarService>

/** Creates an equipment service fake with no equipped armor. */
export const makeEquipmentService = () => ({
  equip: (_stack: unknown) => Effect.succeed(false),
  unequipSlot: (_slot: unknown) => Effect.succeed(Option.none()),
  getEquippedItem: (_slot: unknown) => Effect.succeed(Option.none()),
  getAll: () => Effect.succeed({ HELMET: Option.none(), CHESTPLATE: Option.none(), LEGGINGS: Option.none(), BOOTS: Option.none() }),
  getTotalArmorPoints: () => Effect.succeed(0),
  getTotalProtectionReduction: () => Effect.succeed(0),
  getTotalProjectileProtectionReduction: () => Effect.succeed(0),
  getTotalBlastProtectionReduction: () => Effect.succeed(0),
  damageArmorSlot: (_slot: unknown, _amount?: unknown) => Effect.void,
  repairMendingItemsWithXP: (amount: number) => Effect.succeed(amount),
  serialize: () => Effect.succeed({}),
  deserialize: (_saved: unknown) => Effect.void,
  reset: () => Effect.void,
}) as unknown as InstanceType<typeof import('@ts-minecraft/inventory').EquipmentService>
